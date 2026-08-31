"""Fit concept normalization stats from the larger offline SEMANTIC_V4 corpus.

`backend/data/Model Training/data/SEMANTIC_V4/semantic_event_quality.csv` holds
~1200 weak-labeled news samples (sentiment, event_type_detail, impact_level)
from the FinNexus research dataset - far more than the manually labeled rows
in the live app DB. It has no future price outcome (layer_manifest.json: market
outcomes are kept physically separate from this release), so it CANNOT be used
as a training target for the ECBM. It IS useful to estimate a realistic
mean/std for the sentiment/impact/event concepts before training on the small
DB-labeled set, so the energy net does not overfit to whatever narrow range
happens to appear in those few labeled rows. Graph concepts have no equivalent
in this offline corpus and are left at zero here; ConceptStats.normalize()
falls back to unit std for concepts with ~zero variance, so this only affects
the sentiment/impact/event dimensions.
"""
import csv
import os
from typing import Dict, List

import numpy as np

from core.prediction.concepts import EVENT_KEYS, GRAPH_KEYS, SENTIMENT_KEYS, ConceptStats

_CSV_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "data", "Model Training", "data", "SEMANTIC_V4", "semantic_event_quality.csv"
)

_SENTIMENT_MAP = {"POSITIVE": "Positive", "NEUTRAL": "Neutral", "NEGATIVE": "Negative"}
_IMPACT_LEVEL_TO_SCORE = {"LOW": 25.0, "MODERATE": 55.0, "HIGH": 80.0, "CRITICAL": 95.0}

# Maps the offline corpus's event_type_detail vocabulary onto the app's own
# EVENT_PATTERNS keys (nlp_service.py); values with no clear match (MACRO_POLICY,
# SECTOR_NEWS, MARKET_TRADING, OTHER) are left unmapped, same as how the live
# rule-based extractor simply does not flag an event for this kind of article.
_EVENT_DETAIL_MAP = {
    "PROFIT_GROWTH": "profit_growth",
    "PROFIT_DECLINE": "profit_decline",
    "DIVIDEND": "dividend",
    "M_AND_A": "merger",
    "NEW_CONTRACT": "new_contract",
    "LEGAL_RISK": "penalty",
    "LEADERSHIP_CHANGE": "leadership_change",
    "STOCK_ISSUANCE": "share_issuance",
    "PROJECT_EXPANSION": "expansion",
}


def _row_to_concept_vector(row: Dict[str, str]) -> np.ndarray:
    sentiment = _SENTIMENT_MAP.get((row.get("sentiment") or "").upper(), "Neutral")
    impact = _IMPACT_LEVEL_TO_SCORE.get((row.get("impact_level") or "").upper(), 50.0)
    mapped_event = _EVENT_DETAIL_MAP.get((row.get("event_type_detail") or "").upper())

    values: List[float] = [1.0 if sentiment == s else 0.0 for s in SENTIMENT_KEYS]
    values.append(impact / 100.0)
    values.extend(1.0 if mapped_event == e else 0.0 for e in EVENT_KEYS)
    values.extend(0.0 for _ in GRAPH_KEYS)
    return np.asarray(values, dtype=np.float32)


def fit_concept_stats_from_semantic_corpus() -> ConceptStats:
    if not os.path.exists(_CSV_PATH):
        return ConceptStats()

    with open(_CSV_PATH, encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))

    if not rows:
        return ConceptStats()

    vectors = np.stack([_row_to_concept_vector(r) for r in rows])
    return ConceptStats.fit(vectors)
