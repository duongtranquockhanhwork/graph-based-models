from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import engine, Base
from app.routers import news, graph, prediction, analytics

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

app.include_router(news.router, prefix="/api/news", tags=["news"])
app.include_router(graph.router, prefix="/api/graph", tags=["graph"])
app.include_router(prediction.router, prefix="/api/prediction", tags=["prediction"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])


@app.get("/")
def root():
    return {"message": "FinNexus KG API", "version": "1.0.0", "status": "running"}


@app.get("/health")
def health():
    return {"status": "healthy"}
