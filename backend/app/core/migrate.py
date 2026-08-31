import logging

from sqlalchemy import text
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)

# Plain SQLAlchemy + create_all only creates missing TABLES, not missing
# columns on tables that already exist. These statements let an existing
# dev database pick up new columns introduced after it was first created,
# without requiring `docker compose down -v`.
_STATEMENTS = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'customer'",
    "ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS needs_manual_label BOOLEAN DEFAULT FALSE",
    "ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS manual_sentiment VARCHAR(20)",
    "ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS manual_event_type VARCHAR(50)",
    "ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS labeled_by_id INTEGER REFERENCES users(id)",
    "ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS labeled_at TIMESTAMPTZ",
    "ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS actual_trend VARCHAR(20)",
    "ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS actual_trend_pct_change FLOAT",
]


def run_migrations(engine: Engine) -> None:
    with engine.connect() as conn:
        for stmt in _STATEMENTS:
            try:
                conn.execute(text(stmt))
                conn.commit()
            except Exception:
                conn.rollback()
                logger.warning("Migration statement skipped/failed: %s", stmt, exc_info=True)
