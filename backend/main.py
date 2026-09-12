import logging

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, SessionLocal, engine
from app.core.deps import get_current_user, require_admin
from app.core.migrate import run_migrations
from app.core.seed import seed_all
from app.models.activity_log import AdminActivityLog  # noqa: F401
from app.models.event_keyword import EventKeyword  # noqa: F401
from app.models.news import NewsArticle  # noqa: F401
from app.models.system_setting import SystemSetting  # noqa: F401
from app.models.user import User  # noqa: F401 (registers table with Base metadata)
from app.models.watchlist import WatchlistItem  # noqa: F401
from app.routers import admin as admin_routes
from app.routers import analytics, auth, graph, news, prediction, stock_detail, watchlist

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("finnexus")

Base.metadata.create_all(bind=engine)
run_migrations(engine)

with SessionLocal() as _seed_db:
    seed_all(_seed_db)

# /docs và /openapi.json phơi toàn bộ bề mặt API. Hữu ích khi phát triển, không
# có lý do để mở công khai trong production.
_docs_enabled = not settings.is_production

app = FastAPI(
    title="FinNexus KG API",
    description="Phân tích tin tức chứng khoán Việt Nam bằng Knowledge Graph",
    version="2.0.0",
    docs_url="/docs" if _docs_enabled else None,
    redoc_url="/redoc" if _docs_enabled else None,
    openapi_url="/openapi.json" if _docs_enabled else None,
)

# Chỉ cho phép chính giao diện của hệ thống. Bản trước dùng allow_origins=["*"]
# kèm allow_credentials=True, khiến Starlette phản chiếu lại bất kỳ Origin nào.
_allowed_origins = sorted(
    {
        settings.FRONTEND_URL.rstrip("/"),
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    }
    if not settings.is_production
    else {settings.FRONTEND_URL.rstrip("/")}
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(
    news.router, prefix="/api/news", tags=["news"], dependencies=[Depends(get_current_user)]
)
app.include_router(
    graph.router, prefix="/api/graph", tags=["graph"], dependencies=[Depends(get_current_user)]
)
app.include_router(
    prediction.router,
    prefix="/api/prediction",
    tags=["prediction"],
    dependencies=[Depends(get_current_user)],
)
app.include_router(
    analytics.router,
    prefix="/api/analytics",
    tags=["analytics"],
    dependencies=[Depends(get_current_user)],
)
app.include_router(
    admin_routes.router,
    prefix="/api/admin",
    tags=["admin"],
    dependencies=[Depends(require_admin)],
)
app.include_router(
    watchlist.router,
    prefix="/api/watchlist",
    tags=["watchlist"],
    dependencies=[Depends(get_current_user)],
)
app.include_router(
    stock_detail.router,
    prefix="/api/stock-detail",
    tags=["stock-detail"],
    dependencies=[Depends(get_current_user)],
)


@app.on_event("startup")
def warm_model() -> None:
    """Nạp mô hình lúc khởi động thay vì ở request đầu tiên.

    Nạp mất ~1s và giữ vài chục MB. Làm ở đây để người dùng đầu tiên không
    phải trả chi phí đó, và để log nói ngay mô hình có sẵn sàng hay không —
    thay vì im lặng cho tới khi ai đó nhập bài báo.
    """
    from app.services import finnexus_service

    info = finnexus_service.model_info()
    if info.get("available"):
        logger.info(
            "Mô hình dự đoán: %s (Macro-F1 %.4f vs baseline %.4f)",
            info["version"],
            info["performance"]["out_of_fold_macro_f1"],
            info["performance"]["baseline_macro_f1"],
        )
    else:
        logger.warning(
            "Mô hình FinNexus không khả dụng (%s). Hệ thống sẽ chạy bằng bộ luật "
            "heuristic và đánh dấu rõ điều đó trên giao diện.",
            info.get("reason"),
        )


@app.get("/")
def root():
    return {"message": "FinNexus KG API", "version": "2.0.0", "status": "running"}


@app.get("/health")
def health():
    from app.services import finnexus_service

    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "model_available": finnexus_service.is_available(),
    }
