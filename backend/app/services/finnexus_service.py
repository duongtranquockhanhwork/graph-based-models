"""Cầu nối tới mô hình dự đoán FinNexus KG (repo nghiên cứu).

Mô hình sống trong repo nghiên cứu, không phải trong repo này. Lý do: bảng giá,
đồ thị tri thức và artifact cộng lại ~51 MB và được cập nhật theo nhịp nghiên
cứu. Nhân đôi chúng sẽ tạo ra hai bản có thể lệch nhau, và bản lệch sẽ chấm điểm
bằng dữ liệu cũ mà không báo lỗi. Ở đây ta trỏ tới một nguồn duy nhất qua
``settings.FINNEXUS_ROOT``.

Hai thứ module này KHÔNG làm, và đó là điều quan trọng nhất:

1. Không tự bịa kết quả khi mô hình từ chối. ``score_article`` ném ``Refusal``
   ở đúng chỗ nó không thể trả lời trung thực (không nhận ra mã, không đủ 20
   phiên giá trước ngày đăng, bảng giá quá cũ). Ta chuyển nguyên vẹn lý do đó
   ra ngoài thành một trạng thái hiển thị được, chứ không rơi về phỏng đoán.
2. Không nới cổng chính sách. ``buy_reachable``, ``decision``, và
   ``confidence_floor`` do repo nghiên cứu quyết định. Tầng web chỉ đọc.
"""

from __future__ import annotations

import json
import logging
import sys
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.core.config import settings

logger = logging.getLogger("finnexus.model")

# Nạp tài nguyên tốn ~1s và giữ vài chục MB trong RAM, nên nạp một lần cho cả
# tiến trình. Lock để hai request đầu tiên đến cùng lúc không nạp hai lần.
_lock = threading.Lock()
_state: Dict[str, Any] = {"loaded": False, "resources": None, "config": None, "error": None}


class ModelUnavailable(RuntimeError):
    """Không nạp được mô hình. Khác hẳn với 'mô hình từ chối trả lời'."""


def _finnexus_root() -> Optional[Path]:
    raw = (settings.FINNEXUS_ROOT or "").strip()
    if not raw:
        return None
    root = Path(raw).expanduser()
    return root if root.is_dir() else None


def _load() -> Dict[str, Any]:
    """Nạp config + tài nguyên mô hình. Ném ModelUnavailable kèm lý do đọc được."""
    root = _finnexus_root()
    if root is None:
        raise ModelUnavailable(
            "FINNEXUS_ROOT chưa được cấu hình hoặc không phải thư mục hợp lệ "
            f"(giá trị hiện tại: {settings.FINNEXUS_ROOT!r})"
        )

    config_path = root / settings.FINNEXUS_CONFIG
    if not config_path.is_file():
        raise ModelUnavailable(f"Không tìm thấy file cấu hình suy luận: {config_path}")

    # Repo nghiên cứu import nội bộ theo kiểu `scripts.dataset_build…`, nên gốc
    # của nó phải nằm ĐẦU sys.path — chèn vào cuối thì `scripts` sẽ phân giải
    # về package cùng tên của repo này. Vì lý do đó, các script CLI của backend
    # đã được đổi sang package `tools/`, nên không còn tên nào va nhau.
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))

    try:
        import yaml

        from scripts.inference.score_article_url import load_resources
    except Exception as exc:  # pragma: no cover - phụ thuộc môi trường
        raise ModelUnavailable(f"Không import được pipeline suy luận: {exc}") from exc

    config = yaml.safe_load(config_path.read_text(encoding="utf-8"))
    resources = load_resources(config)
    logger.info("Đã nạp mô hình FinNexus %s từ %s", resources["contract"]["version"], root)
    return {"config": config, "resources": resources}


def _ensure_loaded() -> Dict[str, Any]:
    if _state["loaded"]:
        if _state["error"]:
            raise ModelUnavailable(_state["error"])
        return _state
    with _lock:
        if not _state["loaded"]:
            try:
                loaded = _load()
                _state.update(loaded)
                _state["error"] = None
            except ModelUnavailable as exc:
                _state["error"] = str(exc)
                logger.warning("Mô hình FinNexus không khả dụng: %s", exc)
            except Exception as exc:  # pragma: no cover
                _state["error"] = f"Lỗi không mong đợi khi nạp mô hình: {exc}"
                logger.exception("Nạp mô hình FinNexus thất bại")
            finally:
                _state["loaded"] = True
    if _state["error"]:
        raise ModelUnavailable(_state["error"])
    return _state


def reset() -> None:
    """Buộc lần gọi sau nạp lại — dùng sau khi đổi cấu hình, và trong test."""
    with _lock:
        _state.update({"loaded": False, "resources": None, "config": None, "error": None})
    _last_refresh.clear()


def is_available() -> bool:
    try:
        _ensure_loaded()
        return True
    except ModelUnavailable:
        return False


# --------------------------------------------------------------------------
# Thông tin mô hình
# --------------------------------------------------------------------------

# Bằng chứng cho lớp khuyến nghị minh bạch, sinh bởi
# tools/measure_recommendation_evidence.py bằng cách chấm chính mô hình đang chạy
# trên bài 2026 nó chưa từng thấy. Đọc lại ở mỗi lần gọi: chạy lại công cụ là có
# hiệu lực ngay, không cần khởi động lại, và file chỉ vài KB.
_EVIDENCE_PATH = Path(__file__).resolve().parents[2] / "data" / "recommendation_evidence.json"


_LADDER_PATH = Path(__file__).resolve().parents[2] / "data" / "entry_ladder.json"


def entry_ladder() -> Optional[Dict[str, Any]]:
    """Thống kê "đặt mua ở giá nào thì được gì", hoặc None nếu chưa từng dựng.

    Sinh bởi scripts/modeling/build_v89_entry_ladder.py ở repo nghiên cứu: với
    mỗi mức giá đặt mua thấp hơn giá tham chiếu, lệnh khớp bao nhiêu phần trăm số
    lần trong 3 phiên và lãi/lỗ sau phí khi khớp — ước lượng trên 2019–2025, kiểm
    lại trên 2026. Là số liệu mô tả, không phải dự đoán hay lời khuyên.
    """
    try:
        return json.loads(_LADDER_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def recommendation_evidence() -> Optional[Dict[str, Any]]:
    """Bằng chứng đã đo, hoặc None nếu chưa từng đo.

    None nghĩa là giao diện KHÔNG hiện lớp khuyến nghị. Không có số đo thì không
    có gì để nói — và tuyệt đối không được thay bằng một con số tự đặt.
    """
    try:
        return json.loads(_EVIDENCE_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def model_info() -> Dict[str, Any]:
    """Mọi con số hiển thị cho người dùng đều lấy từ đây, và mỗi con số đi kèm
    baseline của nó. Một Macro-F1 đứng một mình không nói lên điều gì."""
    try:
        state = _ensure_loaded()
    except ModelUnavailable as exc:
        return {
            "available": False,
            "reason": str(exc),
            "active_model": "heuristic_rules",
            "is_investment_advice": False,
            "tradeable": False,
        }

    resources = state["resources"]
    contract = resources["contract"]
    performance = contract.get("performance", {})
    operating = resources["operating"]
    gates = resources["gates"]

    oof = performance.get("out_of_fold_macro_f1")
    baseline = performance.get("out_of_fold_baseline_macro_f1")
    delta = round(oof - baseline, 4) if oof is not None and baseline is not None else None

    return {
        "available": True,
        "active_model": "market_reaction_xgboost",
        "version": contract.get("version"),
        "status": contract.get("status"),
        "labels": contract.get("labels", []),
        "label_meaning": "giá cổ phiếu nhích lên, đi ngang, hay giảm xuống trong 3 phiên sau tin (so với mức biến động chung của thị trường)",
        "frozen_threshold": contract.get("frozen_threshold"),
        "feature_count": contract.get("feature_contract", {}).get("count"),
        "performance": {
            "out_of_fold_macro_f1": oof,
            "baseline_macro_f1": baseline,
            "delta_vs_baseline": delta,
            "baseline_description": "mức tham chiếu khi chỉ nhìn một chỉ số biến động giá trước khi tin ra",
            "beats_majority_on_accuracy": contract.get("claim_boundary", {}).get(
                "beats_majority_on_accuracy"
            ),
        },
        "operating_point": {
            "confidence_floor": resources["confidence_floor"],
            "coverage_on_development": operating.get("coverage"),
            "expected_accuracy_at_this_coverage": operating.get(
                "expected_accuracy_on_judged"
            ),
            "evidence_grade": "DEVELOPMENT_ONLY",
            "meaning": "Khi hệ thống không đủ chắc chắn, nó nói thẳng là chưa trả lời được, thay vì đưa ra một phỏng đoán yếu.",
        },
        "policy_gates": gates,
        "buy_reachable": all(gates.values()),
        "recommendation_evidence": recommendation_evidence(),
        "entry_ladder": entry_ladder(),
        "price_data": price_freshness(resources),
        "is_investment_advice": False,
        "tradeable": False,
        "disclaimer": (
            "Đây là công cụ tham khảo, không phải lời khuyên mua bán. "
            "Hệ thống chỉ ước lượng giá có xu hướng lên hay xuống sau tin, "
            "không nói giá sẽ là bao nhiêu, và không đưa ra tín hiệu mua bán nào."
        ),
    }


# --------------------------------------------------------------------------
# Chấm một bài báo
# --------------------------------------------------------------------------

# Lý do không dự đoán được, viết cho người đọc báo tài chính chứ không cho kỹ
# sư. Mỗi câu nói ba điều: chuyện gì xảy ra, vì sao, và người dùng làm gì được.
#
# Nguyên tắc: không dùng "mô hình", "pipeline", "đặc trưng", "từ điển 257 mã",
# "phiên giá" — người dùng không cần biết hệ thống được xây thế nào để hiểu vì
# sao nó im lặng.
_REFUSAL_MESSAGES = {
    "no_symbol_found": (
        "Bài này không nhắc tới mã cổ phiếu nào mà hệ thống nhận ra. "
        "Thử bài báo có nêu rõ tên mã (ví dụ FPT, VNM) hoặc tên công ty niêm yết."
    ),
    "unparseable_publication_date": (
        "Không đọc được ngày đăng của bài. Hệ thống cần biết bài viết ra ngày nào "
        "mới so sánh được với diễn biến giá quanh thời điểm đó."
    ),
    "insufficient_price_history": (
        "Chưa có đủ lịch sử giá quanh ngày đăng bài để so sánh. "
        "Thường gặp với mã mới lên sàn, hoặc bài quá cũ."
    ),
    "price_history_too_stale_for_this_article": (
        "Dữ liệu giá gần nhất cách ngày đăng bài quá xa, nên đối chiếu sẽ không "
        "còn đúng với thời điểm bài viết ra."
    ),
    "price_panel_behind_publication": (
        "Dữ liệu giá chưa có những phiên giao dịch ngay trước ngày đăng bài. Chấm "
        "lúc này nghĩa là dựa trên giá cũ, nên hệ thống dừng lại. Hệ thống đã thử "
        "tải giá mới nhưng chưa được — thử lại sau ít phút."
    ),
    "price_history_behind_publication": (
        "Giá của mã này chưa được cập nhật tới phiên ngay trước ngày đăng bài, nên "
        "hệ thống không chấm để tránh dựa trên giá cũ. Thử lại sau ít phút."
    ),
    "unsupported_publisher": (
        "Hệ thống chưa đọc được trang báo này. Hiện hỗ trợ CafeF, VnExpress, "
        "Vietstock, Tin Nhanh Chứng Khoán, VietnamBiz và Người Quan Sát."
    ),
}


def _humanize_refusal(stage: str, reason: str, detail: Any = None) -> str:
    message = _REFUSAL_MESSAGES.get(
        reason,
        "Hệ thống dừng lại giữa chừng khi xử lý bài này nên chưa đưa ra được kết luận.",
    )
    if reason == "price_panel_behind_publication" and isinstance(detail, dict):
        newest = detail.get("newest_price_session")
        missing = detail.get("missing_sessions") or []
        if newest:
            message += f" (Giá mới có tới phiên {newest}, còn thiếu {len(missing)} phiên.)"
    return message


# Repo nghiên cứu viết phần giải thích quyết định cho người đọc báo cáo khoa
# học ("ngưỡng vận hành", "dữ liệu phát triển", "cổng đánh giá"). Giao diện web
# phục vụ nhà đầu tư, nên diễn đạt lại theo `reason` — một khoá ổn định — thay
# vì sửa repo nghiên cứu hoặc dò theo chuỗi tiếng Việt dễ đổi.
_DECISION_EXPLANATIONS = {
    "confidence_below_operating_point": (
        "Hệ thống không đủ chắc chắn về bài này. Ở mức chắc chắn thấp như vậy, "
        "kết quả gần như là đoán bừa, nên hệ thống chọn im lặng thay vì đưa ra "
        "một phỏng đoán mà bạn không nên tin."
    ),
    "policy_gates_closed": (
        "Hệ thống có nhận định về hướng giá, nhưng không đưa ra gợi ý mua bán nào. "
        "Việc dùng nhận định này để giao dịch chưa được chứng minh là có lợi, nên "
        "chức năng đó đang tắt."
    ),
    "no_policy_threshold_selected": (
        "Hệ thống chỉ nêu nhận định về hướng giá, không đưa ra gợi ý mua bán."
    ),
}


def _plain_decision_explanation(row: Dict[str, Any]) -> Optional[str]:
    reason = row.get("reason")
    if reason in _DECISION_EXPLANATIONS:
        return _DECISION_EXPLANATIONS[reason]
    return row.get("explanation")


# Linker của mô hình chỉ nhận mã viết tường minh kèm ngữ cảnh chứng khoán
# ("cổ phiếu FPT"), trong khi báo tiếng Việt thường chỉ gọi tên công ty
# ("Vinamilk ký hợp đồng…"). Từ điển của app đã phân giải sẵn tên công ty sang
# mã, nên ta bổ sung phần phân giải đó vào cuối văn bản gửi cho mô hình.
#
# Việc này CHỈ ảnh hưởng bước liên kết thực thể (mã nào được chấm) và bước phân
# loại dạng bài. Nó KHÔNG chạm tới 33 đặc trưng của mô hình — chúng được tính
# hoàn toàn từ lịch sử giá của mã, không từ văn bản. Nói cách khác: ta nói cho
# mô hình biết bài này về mã nào, chứ không thay đổi thứ nó học được.
_LINK_HINT_PREFIX = "\n\nMã cổ phiếu liên quan được nhận diện: "


def _with_link_hints(content: Optional[str], linked_symbols: Optional[List[str]]) -> str:
    text = content or ""
    if not linked_symbols:
        return text
    return text + _LINK_HINT_PREFIX + ", ".join(sorted(set(linked_symbols))) + "."


def score_article(
    title: str,
    content: Optional[str],
    published_date: Optional[str],
    url: Optional[str] = None,
    source: Optional[str] = None,
    linked_symbols: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Chấm một bài báo. Luôn trả về dict có khoá ``status``.

    ``linked_symbols`` là các mã mà bộ NLP của app đã phân giải được từ tên
    công ty; xem ghi chú ở ``_LINK_HINT_PREFIX``.

    ``status`` là một trong:
      * ``SCORED``      — mô hình đã chấm; xem ``scored`` và ``graph_view``
      * ``REFUSED``     — mô hình từ chối trả lời, kèm ``stage``/``reason``
      * ``UNAVAILABLE`` — không nạp được mô hình

    Từ chối là một kết quả hợp lệ, không phải sự cố. Gọi hàm này không bao giờ
    ném exception vì lý do nghiệp vụ.
    """
    try:
        state = _ensure_loaded()
    except ModelUnavailable as exc:
        return {"status": "UNAVAILABLE", "reason": str(exc)}

    article = {
        "title": title or "",
        "content": _with_link_hints(content, linked_symbols),
        "published_date": published_date or "",
        "url": url or "",
        "source": source or "",
    }
    result = _score_once(article, state)
    # Thiếu phiên giá gần nhất thì tải về rồi chấm lại, đúng một lần. Chấm ngay
    # trên giá cũ là điều không được phép: kết quả vẫn trông bình thường nhưng
    # mô tả một thị trường khác với lúc bài được viết ra.
    lagging = _lagging_symbols(result)
    if lagging and _refresh_prices(state, lagging):
        result = _score_once(article, state)
        result["prices_refreshed_for"] = lagging
    return result


def _score_once(article: Dict[str, Any], state: Dict[str, Any]) -> Dict[str, Any]:
    from scripts.inference.score_article_url import Refusal, score_article as _score

    try:
        result = _score(article, state["config"], state["resources"])
    except Refusal as refusal:
        return {
            "status": "REFUSED",
            "stage": refusal.stage,
            "reason": refusal.reason,
            "detail": refusal.detail,
            "message": _humanize_refusal(refusal.stage, refusal.reason, refusal.detail),
        }
    except Exception as exc:  # pragma: no cover - lỗi thật sự bất ngờ
        logger.exception("score_article thất bại ngoài dự kiến")
        return {"status": "ERROR", "reason": str(exc)}

    # Diễn đạt lại ngay tại đây, không chỉ ở to_prediction_fields: endpoint
    # /api/prediction/score trả thẳng `result` cho giao diện, nên nếu chỉ dịch
    # ở một đường thì cùng một tình huống sẽ hiện ra hai kiểu chữ khác nhau.
    for row in result.get("scored", []):
        plain = _plain_decision_explanation(row)
        if plain:
            row["explanation"] = plain

    return result


# --------------------------------------------------------------------------
# Giá của phiên gần nhất
# --------------------------------------------------------------------------

# Hai lý do từ chối mà tải thêm giá là sửa được. Mọi lý do khác (không nhận ra
# mã, mã mới lên sàn...) thì tải lại cũng vô ích.
_LAGGING_REASONS = {"price_panel_behind_publication", "price_history_behind_publication"}
# Mỗi mã chỉ được tải lại một lần trong khoảng này, để việc nhập một file CSV
# nhiều bài về một mã đã huỷ niêm yết không biến thành một tràng gọi API.
_REFRESH_COOLDOWN_SECONDS = 1800
_refresh_lock = threading.Lock()
_last_refresh: Dict[str, float] = {}


def _lagging_symbols(result: Dict[str, Any]) -> List[str]:
    """Các mã bị bỏ qua chỉ vì thiếu phiên giá gần nhất."""
    if result.get("status") == "REFUSED" and result.get("reason") in _LAGGING_REASONS:
        detail = result.get("detail")
        if not isinstance(detail, dict):
            return []
        names = detail.get("newest_session_by_symbol") or detail.get("symbols") or []
        return sorted(set(names))
    if result.get("status") == "SCORED":
        return sorted({r["symbol"] for r in result.get("refused", [])
                       if r.get("reason") == "price_history_behind_publication"})
    return []


def _refresh_prices(state: Dict[str, Any], symbols: List[str]) -> bool:
    """Tải các phiên còn thiếu cho những mã này rồi gắn vào mô hình đang chạy.

    Trả về True khi có giá mới để chấm lại. Mọi thất bại — mất mạng, sắp chạm
    hạn mức API, bản mô hình cũ chưa có lớp giá live — đều trả về False: bài vẫn
    bị từ chối kèm lý do rõ ràng, và không bao giờ bị chấm trên giá cũ.
    """
    if not settings.FINNEXUS_LIVE_PRICES or not symbols:
        return False
    live_settings = (state["config"].get("features") or {}).get("live") or {}
    if not live_settings.get("enabled", False):
        return False
    try:
        from scripts.inference.live_prices import BUDGET, refresh
        from scripts.inference.score_article_url import ROOT as model_root, attach_live
    except Exception:  # pragma: no cover - bản mô hình cũ
        return False

    now = time.monotonic()

    def due(name: str) -> bool:
        return now - _last_refresh.get(name, float("-inf")) >= _REFRESH_COOLDOWN_SECONDS

    wanted = [s for s in symbols if due(s)]
    indices = [i for i in ("VNINDEX", "HNXINDEX") if due(i)]
    if not wanted:
        return False
    # Nhà cung cấp kết thúc cả tiến trình khi bị gọi quá hạn mức, nên thà bỏ
    # qua lần tải này còn hơn làm sập máy chủ.
    if BUDGET.available() < len(wanted) + len(indices):
        logger.warning("Bỏ qua cập nhật giá cho %s: sắp chạm hạn mức gọi API", wanted)
        return False
    with _refresh_lock:
        try:
            report = refresh(wanted, indices, live_settings, model_root)
            attach_live(state["resources"], state["config"])
        except Exception:
            logger.exception("Cập nhật giá live thất bại")
            return False
        for name in wanted + indices:
            _last_refresh[name] = now
    updated = [s for s, v in report["symbols"].items() if v.get("status") == "OK"]
    logger.info("Đã cập nhật giá live cho %s, tới phiên %s", updated, report.get("through"))
    return bool(updated)


def price_freshness(resources: Dict[str, Any]) -> Dict[str, Any]:
    """Giá có tới phiên nào — để người dùng biết kết quả dựa trên dữ liệu tới đâu."""
    info: Dict[str, Any] = {
        "frozen_newest_session": str(resources["indices"]["date"].max().date()),
        "live_newest_session": None,
        "live_refreshed_at": None,
    }
    live = resources.get("live")
    if live:
        info["live_newest_session"] = live.get("newest_session")
        info["live_refreshed_at"] = ((live.get("manifest") or {}).get("last_refresh") or {}).get("at")
    return info


# --------------------------------------------------------------------------
# Quy đổi sang mô hình dữ liệu của app
# --------------------------------------------------------------------------

# Nhãn của mô hình mô tả hướng abnormal return, không phải "giá sẽ lên/xuống".
# Giữ nguyên ba tên này ở tầng lưu trữ và chỉ dịch sang tiếng Việt ở tầng hiển
# thị, để không có chỗ nào trong hệ thống hiểu nhầm nhãn thành lời khuyên.
LABEL_TO_TREND = {
    "POSITIVE": "INCREASING",
    "NEGATIVE": "DECREASING",
    "NEUTRAL": "UNCHANGED",
}


def primary_result(scored: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Mã chủ thể của bài. Mô hình KHÔNG xếp hạng mức độ ảnh hưởng (ở bài toán
    xếp hạng nó không vượt baseline, AUC cặp 0.5973), nên ta lấy chủ thể theo
    ``focus_role`` mà pipeline đã xác định, chứ không tự sắp theo confidence."""
    if not scored:
        return None
    for row in scored:
        if row.get("focus_role") == "PRIMARY":
            return row
    return scored[0]


def to_prediction_fields(result: Dict[str, Any]) -> Dict[str, Any]:
    """Chuyển kết quả FinNexus thành các cột NewsArticle.

    Khi mô hình từ chối hoặc không khả dụng, ``predicted_trend`` để trống —
    hệ thống nói "chưa trả lời được" thay vì điền một nhãn không có cơ sở.
    """
    status = result.get("status")
    if status != "SCORED":
        return {
            "predicted_trend": None,
            "prediction_confidence": None,
            "prediction_decision": status,
            "prediction_explanation": {
                "engine": "finnexus",
                "status": status,
                "stage": result.get("stage"),
                "reason": result.get("reason"),
                "message": result.get("message") or result.get("reason"),
            },
        }

    row = primary_result(result.get("scored") or [])
    if row is None:
        return {
            "predicted_trend": None,
            "prediction_confidence": None,
            "prediction_decision": "REFUSED",
            "prediction_explanation": {
                "engine": "finnexus",
                "status": "REFUSED",
                "reason": "no_scored_symbol",
                "message": (
                    "Không dự đoán được bài này vì không tìm thấy mã cổ phiếu nào "
                    "đủ dữ liệu giá để đối chiếu."
                ),
            },
        }

    return {
        "predicted_trend": LABEL_TO_TREND.get(row["predicted_label"]),
        "prediction_confidence": float(row["model_confidence"]),
        "prediction_decision": row.get("decision"),
        "prediction_explanation": {
            "engine": "finnexus",
            "status": "SCORED",
            "model_version": result.get("model_version") or result.get("version"),
            "primary_symbol": row["symbol"],
            "focus_role": row.get("focus_role"),
            "focus_reason": row.get("focus_reason"),
            "predicted_label": row["predicted_label"],
            "probabilities": row.get("probabilities"),
            "volatility_20d": row.get("volatility_20d"),
            "reference_close": row.get("reference_close"),
            "reference_session": row.get("reference_session"),
            "last_price_session": row.get("last_price_session"),
            "one_variable_baseline_label": row.get("one_variable_baseline_label"),
            "decision": row.get("decision"),
            "decision_reason": row.get("reason"),
            "human_explanation": row.get("explanation"),
            "confidence_floor": row.get("confidence_floor"),
            "kg_explanation": row.get("kg_explanation", []),
            "article_type": result.get("article_type"),
            "article_type_caveat": result.get("article_type_caveat"),
            "label_meaning": result.get("label_meaning"),
            "evidence": result.get("evidence"),
            "graph_view": result.get("graph_view"),
            "scored_symbols": [
                {
                    "symbol": r["symbol"],
                    "predicted_label": r["predicted_label"],
                    "confidence": round(float(r["model_confidence"]), 4),
                    "decision": r["decision"],
                    "focus_role": r.get("focus_role"),
                }
                for r in result.get("scored", [])
            ],
            "refused_symbols": result.get("refused", []),
            "buy_reachable": result.get("buy_reachable", False),
            "is_investment_advice": False,
            "tradeable": False,
        },
    }
