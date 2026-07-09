from collections import defaultdict
from typing import Dict, List

from sqlalchemy.orm import Session

from app.models.event_keyword import EventKeyword
from app.services.nlp_service import EVENT_PATTERNS


def get_active_event_patterns(db: Session) -> Dict[str, List[str]]:
    rows = db.query(EventKeyword).filter(EventKeyword.is_active == True).all()  # noqa: E712
    if not rows:
        return EVENT_PATTERNS

    patterns: Dict[str, List[str]] = defaultdict(list)
    for row in rows:
        patterns[row.event_type].append(row.keyword)
    return dict(patterns)
