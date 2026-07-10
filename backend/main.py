from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import engine, Base, SessionLocal
from app.core.deps import get_current_user, require_admin
from app.core.migrate import run_migrations
from app.core.seed import seed_all
from app.services.graph_service import rebuild_graph_from_db
from app.models.user import User  # noqa: F401 (registers table with Base metadata)
from app.models.news import NewsArticle  # noqa: F401
from app.models.event_keyword import EventKeyword  # noqa: F401
from app.models.system_setting import SystemSetting  # noqa: F401
from app.models.activity_log import AdminActivityLog  # noqa: F401
from app.models.watchlist import WatchlistItem  # noqa: F401
from app.routers import auth, news, graph, prediction, analytics, watchlist, stock_detail
from app.routers import admin as admin_routes

Base.metadata.create_all(bind=engine)
run_migrations(engine)

with SessionLocal() as _seed_db:
    seed_all(_seed_db)
    rebuild_graph_from_db(_seed_db)

app = FastAPI(
    title="FinNexus KG API",
    description="Vietnamese Stock News Analysis with Knowledge Graph",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


@app.get("/")
def root():
    return {"message": "FinNexus KG API", "version": "1.0.0", "status": "running"}


@app.get("/health")
def health():
    return {"status": "healthy"}
