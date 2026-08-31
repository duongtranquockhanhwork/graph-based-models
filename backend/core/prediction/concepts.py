"""Concept bottleneck vector: named, interpretable features the ECBM reasons over.

Every concept here is already produced by nlp_service.analyze_article() and
graph_service.get_graph_features() - this module only assembles and normalizes
them into a fixed-order vector. It does not extract anything new from text, so
the ECBM is forced to reason through the same human-readable signals the app
already shows in its UI (sentiment, detected events, graph centrality/mentions).
"""
import json
from dataclasses import dataclass, field
from typing import Dict, List, Optional

import numpy as np

from app.services.nlp_service import EVENT_PATTERNS

SENTIMENT_KEYS: List[str] = ["Positive", "Neutral", "Negative"]
EVENT_KEYS: List[str] = list(EVENT_PATTERNS.keys())
GRAPH_KEYS: List[str] = [
    "degree_centrality",
    "betweenness_centrality",
    "mention_frequency",
    "positive_news_count",
    "negative_news_count",
    "sentiment_ratio",
]

CONCEPT_NAMES: List[str] = (
    [f"sentiment_{s.lower()}" for s in SENTIMENT_KEYS]
    + ["impact_score"]
    + [f"event_{e}" for e in EVENT_KEYS]
    + [f"graph_{g}" for g in GRAPH_KEYS]
)

N_CONCEPTS = len(CONCEPT_NAMES)

# Caps used to squash unbounded counts into a roughly comparable range; these
# mirror the caps predict_trend() already used (min(count, 5) * weight) so the
# ECBM sees the same effective signal strength as the heuristic baseline.
_GRAPH_CAPS = {
    "mention_frequency": 20.0,
    "positive_news_count": 5.0,
    "negative_news_count": 5.0,
}


def build_concept_vector(analysis: Dict, graph_features: Optional[Dict]) -> np.ndarray:
    gf = graph_features or {}
    sentiment = analysis.get("sentiment", "Neutral")
    events = set(analysis.get("events", []))
    impact = analysis.get("impact_score", 50.0)

    values: List[float] = [1.0 if sentiment == s else 0.0 for s in SENTIMENT_KEYS]
    values.append(float(impact) / 100.0)
    values.extend(1.0 if e in events else 0.0 for e in EVENT_KEYS)

    for g in GRAPH_KEYS:
        raw = float(gf.get(g, 0.0))
        cap = _GRAPH_CAPS.get(g)
        values.append(raw / cap if cap else raw)

    return np.asarray(values, dtype=np.float32)


@dataclass
class ConceptStats:
    """Per-concept mean/std used to standardize vectors before the energy net.

    Fit on the larger SEMANTIC_V4 corpus (see kg_pretrain.py) so the model sees
    a realistic concept scale even though the manually labeled DB set used for
    the actual training target is small.
    """

    mean: List[float] = field(default_factory=lambda: [0.0] * N_CONCEPTS)
    std: List[float] = field(default_factory=lambda: [1.0] * N_CONCEPTS)

    def normalize(self, vec: np.ndarray) -> np.ndarray:
        mean = np.asarray(self.mean, dtype=np.float32)
        std = np.asarray(self.std, dtype=np.float32)
        std = np.where(std < 1e-6, 1.0, std)
        return (vec - mean) / std

    def save(self, path: str) -> None:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(
                {"mean": self.mean, "std": self.std, "concept_names": CONCEPT_NAMES},
                f,
                ensure_ascii=False,
                indent=2,
            )

    @classmethod
    def load(cls, path: str) -> "ConceptStats":
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return cls(mean=data["mean"], std=data["std"])

    @classmethod
    def fit(cls, vectors: np.ndarray) -> "ConceptStats":
        return cls(mean=vectors.mean(axis=0).tolist(), std=vectors.std(axis=0).tolist())
