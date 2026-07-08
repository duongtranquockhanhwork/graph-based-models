from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://finnexus:finnexus123@postgres:5432/finnexus_db"
    NEO4J_URI: str = "bolt://neo4j:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = "finnexus123"

    class Config:
        env_file = ".env"


settings = Settings()
