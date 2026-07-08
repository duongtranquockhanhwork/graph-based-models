from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import engine, Base
from app.core.deps import get_current_user
from app.models.user import User  # noqa: F401 (registers table with Base metadata)
from app.routers import auth, news, graph, prediction, analytics

Base.metadata.create_all(bind=engine)

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


@app.get("/")
def root():
    return {"message": "FinNexus KG API", "version": "1.0.0", "status": "running"}


@app.get("/health")
def health():
    return {"status": "healthy"}
