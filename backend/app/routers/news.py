import io
import logging
import re
from typing import List, Optional
from urllib.parse import urlparse

import pandas as pd
from bs4 import BeautifulSoup
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import Text, cast
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal, get_db
from app.core.deps import get_current_user, owner_scope, require_admin
from app.core.ratelimit import ai_analysis_limit, import_url_limit, upload_limit
from app.core.settings_store import get_float_setting
from app.core.url_guard import UnsafeUrl, safe_get
from app.models.news import NewsArticle
from app.models.user import User
from app.schemas.admin import NewsPatch
from app.schemas.schemas import NewsCreate, NewsResponse
from app.services import ai_analysis_service, watchlist_service
from app.services.finnexus_service import recommendation_evidence
from app.services.graph_service import get_graph_features
from app.services.nlp_service import analyze_article
from app.services.prediction_service import predict_for_article

logger = logging.getLogger("finnexus.news")

router = APIRouter()


class UrlImportRequest(BaseModel):
    url: str


_KNOWN_ARTICLE_BODY_SELECTORS = [
    "article.fck_detail", ".fck_detail", "article",
    ".article-content", ".article-body", ".detail-content", ".content-detail",
    ".post-content", ".entry-content", "main",
]


def _extract_by_known_selectors(soup) -> Optional[str]:
    for sel in _KNOWN_ARTICLE_BODY_SELECTORS:
        elem = soup.select_one(sel)
        if elem:
            text = elem.get_text(separator="\n", strip=True)
            if len(text) > 100:
                return text[:5000]
    return None


_DATE_LINE_RE = re.compile(
    r"^\d{1,2}[/-]\d{1,2}[/-]\d{4}(\s+\d{1,2}:\d{2}(:\d{2})?)?([+-]\d{2}:?\d{2})?$"
)


def _strip_leading_metadata(content: str, title: str) -> str:
    """Nhiều trang (vd. vietstock.vn) chèn tiêu đề + ngày đăng LẶP LẠI ngay
    trong khối chứa nội dung, trước đoạn văn thật — lỗi CSS/bố cục của họ,
    ``get_text()`` gom hết vào một khối. Cắt các dòng đầu nếu chúng chỉ lặp
    lại tiêu đề hoặc là một dòng ngày/giờ, dừng ngay khi gặp dòng văn bản thật.
    """
    lines = content.split("\n")
    title_norm = " ".join(title.split()).strip().lower()
    idx = 0
    while idx < len(lines):
        line_norm = " ".join(lines[idx].split()).strip().lower()
        if not line_norm:
            idx += 1
            continue
        if line_norm == title_norm or _DATE_LINE_RE.match(line_norm):
            idx += 1
            continue
        break
    return "\n".join(lines[idx:]).strip()


def _extract_by_paragraph_density(soup) -> Optional[str]:
    """Site-agnostic fallback for when none of the known selectors match
    (a new site, or a known one that redesigned again): the article body is,
    on essentially every news site, whichever container holds the most text
    packed into direct-child <p> tags - nav/sidebar/ad blocks don't cluster
    paragraphs that way. Cheap density heuristic, no per-site maintenance."""
    best_elem, best_len = None, 0
    for candidate in soup.find_all(["div", "article", "section"]):
        paragraphs = candidate.find_all("p", recursive=False)
        total = sum(len(p.get_text(strip=True)) for p in paragraphs)
        if total > best_len:
            best_len, best_elem = total, candidate
    if best_elem and best_len > 150:
        return best_elem.get_text(separator="\n", strip=True)[:5000]
    return None


def _run_analysis(news_id: int, importer_user_id: Optional[int] = None) -> None:
    """Phân tích một bài báo trong tác vụ nền.

    Tác vụ này mở phiên CSDL của riêng nó. Bản trước nhận phiên của request
    truyền vào; từ FastAPI 0.106 phần dọn dẹp của dependency ``yield`` chạy
    TRƯỚC khi response được gửi, nên tác vụ nền nhận một phiên đã đóng — và
    nhiều tác vụ từ cùng một request dùng chung một đối tượng Session vốn
    không an toàn với đa luồng.
    """
    with SessionLocal() as db:
        news = db.query(NewsArticle).filter(NewsArticle.id == news_id).first()
        if not news:
            return

        result = analyze_article(news.title, news.content, db=db)

        # Đặc trưng đồ thị tính trên đúng "vũ trụ dữ liệu" của chủ bài này
        # (owner_id) — một mã được nhắc nhiều trong CHÍNH các bài người này đã
        # thêm, không phải trong toàn hệ thống. admin re-analyze bài của
        # khách hàng vẫn dùng owner_id của bài đó, không phải của admin.
        gf = {}
        for stock in result.get("stocks", []):
            gf.update(get_graph_features(db, news.owner_id, stock))

        prediction = predict_for_article(
            analysis=result,
            graph_features=gf,
            title=news.title,
            content=news.content,
            published_date=news.published_date,
            url=news.url,
            source=news.source,
        )

        news.stocks_mentioned = result["stocks"]
        news.companies_mentioned = result["companies"]
        news.industries_mentioned = result["industries"]
        news.events_detected = result["events"]
        news.sentiment = result["sentiment"]
        news.impact_score = result["impact_score"]
        news.predicted_trend = prediction["predicted_trend"]
        news.prediction_confidence = prediction["prediction_confidence"]
        news.prediction_decision = prediction["prediction_decision"]
        news.prediction_explanation = prediction["prediction_explanation"]
        news.is_analyzed = True

        # Bản giải thích của Claude chỉ còn đúng nếu đầu vào của nó không đổi.
        # Kết quả mô hình đổi thì bỏ bản cũ; không đổi thì giữ — mỗi lần tạo tốn
        # tiền, không có lý do gì để vứt một bản vẫn còn đúng.
        if news.ai_analysis and not ai_analysis_service.is_fresh(
            news.ai_analysis, ai_analysis_service.article_payload(news), recommendation_evidence()
        ):
            news.ai_analysis = None

        # Vào hàng chờ gán nhãn khi mô hình KHÔNG trả lời được, hoặc trả lời
        # với độ tin cậy dưới ngưỡng. Bài mô hình đã chấm dứt khoát thì không
        # cần người xem lại — trước đây ngưỡng 0.6 cao hơn mọi độ tin cậy mà
        # bộ dự đoán từng sinh ra, nên 100% bài rơi vào hàng chờ.
        review_threshold = get_float_setting(db, "manual_review_confidence_threshold", 0.45)
        confidence = news.prediction_confidence
        news.needs_manual_label = confidence is None or confidence < review_threshold

        # Đồ thị không còn được mutate ở đây — nó được dựng lại từ DB mỗi lần
        # đọc (graph_service.build_graph), lọc theo owner_id. graph_built chỉ
        # còn là cờ "đã phân tích, đủ điều kiện xuất hiện trên đồ thị".
        news.graph_built = True
        db.commit()

        if importer_user_id is not None:
            for stock in result.get("stocks", []):
                watchlist_service.add_symbol(db, importer_user_id, stock)


@router.post("/upload-csv", dependencies=[Depends(upload_limit)])
async def upload_csv(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    raw = await file.read()
    if len(raw) > settings.MAX_CSV_BYTES:
        raise HTTPException(
            413,
            f"File vượt quá giới hạn {settings.MAX_CSV_BYTES // (1024 * 1024)} MB.",
        )

    try:
        df = pd.read_csv(io.StringIO(raw.decode("utf-8")))
    except UnicodeDecodeError:
        df = pd.read_csv(io.StringIO(raw.decode("utf-8-sig", errors="replace")))
    except Exception:
        raise HTTPException(400, "Không đọc được file CSV. Kiểm tra định dạng và mã hoá UTF-8.")

    if "title" not in df.columns:
        raise HTTPException(400, "CSV phải có cột 'title'")
    if len(df) > settings.MAX_CSV_ROWS:
        raise HTTPException(
            413, f"CSV có {len(df)} dòng, vượt giới hạn {settings.MAX_CSV_ROWS} dòng mỗi lần nhập."
        )

    def cell(row, name):
        return str(row[name]) if name in row and pd.notna(row[name]) else None

    articles = [
        NewsArticle(
            owner_id=current_user.id,
            title=str(row.get("title", ""))[:500],
            content=cell(row, "content"),
            source=cell(row, "source"),
            published_date=cell(row, "published_date"),
            url=cell(row, "url"),
        )
        for _, row in df.iterrows()
        if str(row.get("title", "")).strip()
    ]

    # Một transaction cho cả lô thay vì commit từng dòng.
    db.add_all(articles)
    db.commit()
    ids = []
    for article in articles:
        db.refresh(article)
        ids.append(article.id)
        background_tasks.add_task(_run_analysis, article.id, current_user.id)

    return {"message": f"Đã nhập {len(ids)} bài báo", "ids": ids}


@router.post("/import-url", dependencies=[Depends(import_url_limit)])
def import_from_url(
    req: UrlImportRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        html, final_url = safe_get(
            req.url, timeout=15, max_bytes=settings.MAX_FETCH_BYTES
        )
    except UnsafeUrl as exc:
        # Thông điệp đã được url_guard làm sạch: không lộ lỗi upstream, nên
        # endpoint này không dùng được để dò quét mạng nội bộ.
        raise HTTPException(400, str(exc))

    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["script", "style", "nav", "header", "footer", "aside", "form", "iframe"]):
        tag.decompose()

    title = None
    for sel in ["h1.title-detail", "h1.article-title", "h1.post-title", ".article-title h1", ".title-detail", "h1"]:
        elem = soup.select_one(sel)
        if elem:
            title = elem.get_text(strip=True)
            break
    if not title:
        og_title = soup.find("meta", property="og:title")
        if og_title:
            title = (og_title.get("content") or "").strip()
    if not title:
        title_tag = soup.find("title")
        if title_tag:
            title = title_tag.get_text(strip=True)
    if not title or len(title) < 5:
        raise HTTPException(400, "Không thể trích xuất tiêu đề từ URL này")

    # Known selectors are a fast path for sites we've already checked; they
    # inevitably go stale as sites redesign. The density fallback covers any
    # site not in the list without needing a new selector added every time.
    content = _extract_by_known_selectors(soup) or _extract_by_paragraph_density(soup)
    if content:
        content = _strip_leading_metadata(content, title)

    # Không trích được nội dung nghĩa là URL này không phải một trang bài báo
    # (ví dụ trang tra cứu/dữ liệu mã chứng khoán, trang danh mục, trang chủ).
    # Lưu bài rỗng rồi để bộ chấm điểm coi "không thấy từ khoá" => TRUNG LẬP
    # sẽ trông như hệ thống chấm sai, trong khi thực ra không có gì để chấm.
    if not content:
        raise HTTPException(
            400,
            "Không trích xuất được nội dung bài viết từ URL này. Hãy kiểm tra "
            "đây có đúng là link một bài báo không (không phải trang tra cứu/dữ liệu, "
            "trang danh mục hay trang chủ).",
        )

    published_date = None
    for prop in ["article:published_time", "og:updated_time"]:
        meta = soup.find("meta", property=prop) or soup.find("meta", attrs={"name": prop})
        if meta and meta.get("content"):
            published_date = meta["content"][:10]
            break

    source = urlparse(final_url).netloc.replace("www.", "")

    news_item = NewsArticle(
        owner_id=current_user.id,
        title=title[:500],
        content=content,
        source=source,
        published_date=published_date,
        url=final_url[:500],
    )
    db.add(news_item)
    db.commit()
    db.refresh(news_item)
    background_tasks.add_task(_run_analysis, news_item.id, current_user.id)

    return {
        "id": news_item.id,
        "title": title,
        "source": source,
        "published_date": published_date,
        "message": "Đã import và đang phân tích",
    }


@router.post("/")
def create_news(
    news_in: NewsCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    n = NewsArticle(owner_id=current_user.id, **news_in.model_dump())
    db.add(n)
    db.commit()
    db.refresh(n)
    background_tasks.add_task(_run_analysis, n.id, current_user.id)
    return {"id": n.id, "message": "Đã tạo và đưa vào hàng đợi phân tích"}


@router.get("/", response_model=List[NewsResponse])
def list_news(
    skip: int = 0,
    limit: int = 50,
    q: Optional[str] = None,
    source: Optional[str] = None,
    sentiment: Optional[str] = None,
    event_type: Optional[str] = None,
    stock: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    limit = max(1, min(limit, 200))
    query = db.query(NewsArticle)
    scope = owner_scope(current_user)
    if scope is not None:
        query = query.filter(NewsArticle.owner_id == scope)
    if q:
        query = query.filter(NewsArticle.title.ilike(f"%{q}%"))
    if source:
        query = query.filter(NewsArticle.source == source)
    if sentiment:
        query = query.filter(NewsArticle.sentiment == sentiment)
    if date_from:
        query = query.filter(NewsArticle.published_date >= date_from)
    if date_to:
        query = query.filter(NewsArticle.published_date <= date_to)

    if event_type or stock:
        # Cột JSON generic không có toán tử "chứa" dùng chung được cho mọi
        # dialect. Lọc thô bằng LIKE trên biểu diễn text ngay tại CSDL để
        # không phải nạp cả bảng vào Python (cách làm cũ), rồi lọc chính xác
        # trong Python trên tập đã hẹp lại.
        if event_type:
            query = query.filter(cast(NewsArticle.events_detected, Text).ilike(f"%{event_type}%"))
        if stock:
            query = query.filter(cast(NewsArticle.stocks_mentioned, Text).ilike(f"%{stock.upper()}%"))

        rows = query.order_by(NewsArticle.id.desc()).limit(skip + limit * 5).all()
        if event_type:
            rows = [n for n in rows if event_type in (n.events_detected or [])]
        if stock:
            stock_upper = stock.upper()
            rows = [n for n in rows if stock_upper in (n.stocks_mentioned or [])]
        return rows[skip : skip + limit]

    return query.order_by(NewsArticle.id.desc()).offset(skip).limit(limit).all()


class AnalysisStatusRequest(BaseModel):
    ids: List[int]


@router.post("/analysis-status")
def analysis_status(
    payload: AnalysisStatusRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tiến trình phân tích của một lô bài vừa nhập.

    Phân tích chạy trong tác vụ nền, nên response của lệnh nhập trả về ngay khi
    bài đã được lưu — chưa phân tích xong. Trước đây giao diện không có cách nào
    biết lúc nào xong: người dùng phải tự bấm "Làm mới" và đoán. Endpoint này
    cho phép giao diện theo dõi và báo khi hoàn tất.

    Trả về cả những mã mô hình chấm được lẫn số bài mô hình từ chối, để thông
    báo nói đúng chuyện đã xảy ra thay vì chỉ "xong rồi".
    """
    ids = payload.ids[:500]
    if not ids:
        return {"total": 0, "analyzed": 0, "pending": 0, "done": True}

    query = db.query(NewsArticle).filter(NewsArticle.id.in_(ids))
    scope = owner_scope(current_user)
    if scope is not None:
        # Id thuộc về người khác không được đếm vào — coi như không tồn tại
        # với người gọi, không rò rỉ việc id đó có thật hay không.
        query = query.filter(NewsArticle.owner_id == scope)
    rows = query.all()
    analyzed = [n for n in rows if n.is_analyzed]
    scored = [n for n in analyzed if n.predicted_trend]

    symbols: List[str] = []
    for n in scored:
        explanation = n.prediction_explanation or {}
        primary = explanation.get("primary_symbol")
        if primary and primary not in symbols:
            symbols.append(primary)

    # Bài đã bị xoá giữa chừng vẫn phải tính là "xong", nếu không giao diện sẽ
    # chờ mãi một id không bao giờ xuất hiện.
    missing = len(ids) - len(rows)

    return {
        "total": len(ids),
        "analyzed": len(analyzed) + missing,
        "pending": len(ids) - len(analyzed) - missing,
        "done": len(analyzed) + missing >= len(ids),
        "scored": len(scored),
        "refused": len(analyzed) - len(scored),
        "needs_review": sum(1 for n in analyzed if n.needs_manual_label),
        "symbols": symbols[:12],
    }


@router.get("/ai-analysis/status")
def ai_analysis_status(_user: User = Depends(get_current_user)):
    """Giao diện hỏi trước khi hiện nút, để không bày ra một nút mà bấm vào chỉ
    nhận được thông báo "chưa cấu hình"."""
    return {"configured": ai_analysis_service.is_configured(), "model": settings.ANTHROPIC_MODEL}


@router.post("/{news_id}/ai-analysis", dependencies=[Depends(ai_analysis_limit)])
def create_ai_analysis(
    news_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Claude giải thích một bài. Có bản còn hiệu lực thì trả ngay, không gọi API.

    Chạy đồng bộ chứ không đưa vào hàng đợi: người dùng vừa bấm nút và đang chờ
    đúng câu trả lời này. FastAPI chạy hàm ``def`` trong thread pool, nên việc
    chờ Claude không chặn các request khác.
    """
    n = db.query(NewsArticle).filter(NewsArticle.id == news_id).first()
    if not n or (owner_scope(_user) is not None and n.owner_id != _user.id):
        raise HTTPException(404, "Không tìm thấy bài báo")
    if not n.is_analyzed:
        raise HTTPException(
            409, {"message": "Bài đang được phân tích. Thử lại sau ít giây.", "reason": "not_analyzed"}
        )

    article = ai_analysis_service.article_payload(n)
    evidence = recommendation_evidence()
    if ai_analysis_service.is_fresh(n.ai_analysis, article, evidence):
        return n.ai_analysis

    try:
        record = ai_analysis_service.analyze(article, evidence)
    except ai_analysis_service.AnalysisUnavailable as exc:
        raise HTTPException(exc.status, {"message": exc.message, "reason": exc.reason}) from exc

    n.ai_analysis = record
    db.commit()
    return record


@router.get("/{news_id}", response_model=NewsResponse)
def get_news(
    news_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    n = db.query(NewsArticle).filter(NewsArticle.id == news_id).first()
    if not n or (owner_scope(current_user) is not None and n.owner_id != current_user.id):
        raise HTTPException(404, "Không tìm thấy bài báo")
    return n


@router.patch("/{news_id}", response_model=NewsResponse)
def patch_news(
    news_id: int,
    payload: NewsPatch,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    n = db.query(NewsArticle).filter(NewsArticle.id == news_id).first()
    if not n:
        raise HTTPException(404, "Không tìm thấy bài báo")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(n, field, value)
    db.commit()
    db.refresh(n)
    return n


@router.post("/{news_id}/analyze")
def analyze_news(
    news_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    n = db.query(NewsArticle).filter(NewsArticle.id == news_id).first()
    if not n:
        raise HTTPException(404, "Không tìm thấy bài báo")
    background_tasks.add_task(_run_analysis, news_id, None)
    return {"message": "Đã đưa vào hàng đợi", "news_id": news_id}


@router.post("/analyze-all")
def analyze_all(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    pending = db.query(NewsArticle).filter(NewsArticle.is_analyzed == False).all()  # noqa: E712
    for n in pending:
        background_tasks.add_task(_run_analysis, n.id, None)
    return {"message": f"Đã đưa {len(pending)} bài vào hàng đợi"}


@router.delete("/{news_id}")
def delete_news(
    news_id: int,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    """Chỉ admin được xoá, bất kể bài thuộc về ai — admin quản trị toàn bộ dữ
    liệu hệ thống. Bản trước không kiểm quyền ở đây, nên bất kỳ tài khoản nào
    cũng xoá được dữ liệu của người khác."""
    n = db.query(NewsArticle).filter(NewsArticle.id == news_id).first()
    if not n:
        raise HTTPException(404, "Không tìm thấy bài báo")
    db.delete(n)
    db.commit()
    return {"message": "Đã xoá"}
