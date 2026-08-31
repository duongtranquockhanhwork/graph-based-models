"""Energy-Based Concept Bottleneck Model (ECBM) for stock trend prediction.

E_theta(c, y): a small MLP maps a concept vector c (see concepts.py) to one
energy value per trend class. logits = -energy, so softmax(logits) is the
Gibbs/Boltzmann distribution P(y | c) at temperature 1 - the standard
energy-based reading of a softmax classifier (as in Joint Energy Models).
Two things distinguish this from "just an MLP classifier":

- free_energy(c) = -logsumexp(logits) is exposed as an extra confidence/OOD
  signal: how well this concept pattern matches anything seen at train time.
- intervene() lets a caller override one or more source signals (e.g. after a
  human corrects manual_sentiment/manual_event_type via the labeling UI) and
  re-scores immediately - concept intervention is the defining feature of a
  concept bottleneck model, as opposed to an opaque end-to-end classifier.
"""
import os
from typing import Dict, List, Optional

import numpy as np
import torch
from torch import nn

from core.prediction.concepts import CONCEPT_NAMES, N_CONCEPTS, ConceptStats, build_concept_vector

TREND_LABELS: List[str] = ["INCREASING", "DECREASING", "UNCHANGED"]

MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data", "models")
CHECKPOINT_PATH = os.path.join(MODEL_DIR, "ecbm.pt")
STATS_PATH = os.path.join(MODEL_DIR, "ecbm_concept_stats.json")
METRICS_PATH = os.path.join(MODEL_DIR, "ecbm_metrics.json")


class EnergyBasedConceptBottleneckModel(nn.Module):
    def __init__(self, n_concepts: int = N_CONCEPTS, n_classes: int = len(TREND_LABELS)):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(n_concepts, 32),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(32, 16),
            nn.ReLU(),
            nn.Linear(16, n_classes),
        )

    def forward(self, c: torch.Tensor) -> torch.Tensor:
        """logits = -energy; softmax(forward(c)) is the Gibbs distribution P(y|c)."""
        return self.net(c)

    def energy(self, c: torch.Tensor) -> torch.Tensor:
        return -self.forward(c)


def save_checkpoint(model: EnergyBasedConceptBottleneckModel, stats: ConceptStats) -> None:
    os.makedirs(MODEL_DIR, exist_ok=True)
    torch.save(model.state_dict(), CHECKPOINT_PATH)
    stats.save(STATS_PATH)


class ECBMPredictor:
    """Loads a trained ECBM checkpoint and serves predict/intervene/explain."""

    def __init__(self, model: EnergyBasedConceptBottleneckModel, stats: ConceptStats):
        self.model = model
        self.model.eval()
        self.stats = stats

    @classmethod
    def load(cls) -> Optional["ECBMPredictor"]:
        if not (os.path.exists(CHECKPOINT_PATH) and os.path.exists(STATS_PATH)):
            return None
        model = EnergyBasedConceptBottleneckModel()
        model.load_state_dict(torch.load(CHECKPOINT_PATH, map_location="cpu"))
        stats = ConceptStats.load(STATS_PATH)
        return cls(model, stats)

    def _logits(self, concept_vec: np.ndarray) -> torch.Tensor:
        normed = self.stats.normalize(concept_vec)
        c = torch.from_numpy(normed).float().unsqueeze(0)
        with torch.no_grad():
            return self.model(c).squeeze(0)

    def _score(self, concept_vec: np.ndarray) -> Dict:
        logits = self._logits(concept_vec)
        probs = torch.softmax(logits, dim=0)
        free_energy = -torch.logsumexp(logits, dim=0)
        idx = int(torch.argmax(probs).item())
        return {
            "trend": TREND_LABELS[idx],
            "confidence": float(probs[idx].item()),
            "probs": {label: float(p) for label, p in zip(TREND_LABELS, probs.tolist())},
            "free_energy": float(free_energy.item()),
        }

    def predict(self, analysis: Dict, graph_features: Optional[Dict]) -> Dict:
        concept_vec = build_concept_vector(analysis, graph_features)
        result = self._score(concept_vec)
        result["concepts"] = {name: float(v) for name, v in zip(CONCEPT_NAMES, concept_vec.tolist())}
        result["reasons"] = self._explain(concept_vec, result["trend"])
        return result

    def intervene(self, analysis: Dict, graph_features: Optional[Dict], overrides: Dict) -> Dict:
        """Re-score after a human corrects one or more source signals.

        `overrides` may contain any key analyze_article()/get_graph_features()
        would produce, e.g. {"sentiment": "Positive"} or {"events": ["dividend"]}.
        """
        analysis_keys = {"sentiment", "events", "impact_score"}
        patched_analysis = {**analysis, **{k: v for k, v in overrides.items() if k in analysis_keys}}
        patched_graph = {**(graph_features or {}), **{k: v for k, v in overrides.items() if k not in analysis_keys}}
        return self.predict(patched_analysis, patched_graph)

    def _explain(self, concept_vec: np.ndarray, predicted_trend: str) -> List[str]:
        """Cheap attribution: zero out each active concept and see how much the
        logit of the predicted class drops. Concepts whose removal hurts the
        predicted class the most are reported as the reasons behind it.
        """
        idx = TREND_LABELS.index(predicted_trend)
        base = float(self._logits(concept_vec)[idx].item())
        contributions = []
        for i, name in enumerate(CONCEPT_NAMES):
            if concept_vec[i] == 0:
                continue
            probed = concept_vec.copy()
            probed[i] = 0.0
            dropped = float(self._logits(probed)[idx].item())
            delta = base - dropped
            if delta > 1e-3:
                contributions.append((name, delta))
        contributions.sort(key=lambda x: x[1], reverse=True)
        return [
            f"{_humanize_concept(name)} (đóng góp +{delta:.2f} vào dự đoán)"
            for name, delta in contributions[:5]
        ]


def _humanize_concept(name: str) -> str:
    from app.services.nlp_service import EVENT_LABELS_VI

    if name.startswith("event_"):
        key = name[len("event_"):]
        return EVENT_LABELS_VI.get(key, key)
    if name.startswith("sentiment_"):
        return {
            "sentiment_positive": "Cảm xúc tích cực",
            "sentiment_neutral": "Cảm xúc trung lập",
            "sentiment_negative": "Cảm xúc tiêu cực",
        }.get(name, name)
    if name == "impact_score":
        return "Điểm tác động tin tức"
    graph_labels = {
        "graph_degree_centrality": "Mức độ trung tâm trong Knowledge Graph",
        "graph_betweenness_centrality": "Vai trò trung gian trong Knowledge Graph",
        "graph_mention_frequency": "Tần suất được nhắc đến",
        "graph_positive_news_count": "Số tin tích cực liên quan",
        "graph_negative_news_count": "Số tin tiêu cực liên quan",
        "graph_sentiment_ratio": "Tỷ lệ tin tích cực trong graph",
    }
    return graph_labels.get(name, name)
