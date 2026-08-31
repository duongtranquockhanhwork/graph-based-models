"""Train the Energy-Based Concept Bottleneck Model on labeled news.

Run inside the backend container (needs DB access):

    python -m core.prediction.train

Ground truth priority, per article:

1. NewsArticle.actual_trend - a REAL trend derived from historical stock price
   movement (see core/prediction/price_labels.py + scripts/import_semantic_v4.py).
   This is the honest target: it does not depend on any sentiment/event signal
   the model also uses as input, so training against it is not circular.
2. NewsArticle.manual_sentiment, mapped to a trend via SENTIMENT_TO_TREND -
   used only as a fallback for articles that don't have a price outcome yet
   (e.g. a freshly imported live article, where "3 trading days later" hasn't
   happened). This mirrors prediction_service.py/validation_service.py's own
   convention, but is a weaker, human-review-based proxy, not a substitute for
   (1) once real price data is available.
"""
import argparse
import json
import os
from typing import Tuple

import numpy as np
import torch
from torch import nn
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import train_test_split

from app.core.database import SessionLocal
from app.models.news import NewsArticle
from app.services.graph_service import get_graph_features
from core.prediction.concepts import CONCEPT_NAMES, ConceptStats, build_concept_vector
from core.prediction.ecbm import (
    METRICS_PATH,
    EnergyBasedConceptBottleneckModel,
    TREND_LABELS,
    save_checkpoint,
)
from core.prediction.kg_pretrain import fit_concept_stats_from_semantic_corpus

SENTIMENT_TO_TREND = {"Positive": "INCREASING", "Negative": "DECREASING", "Neutral": "UNCHANGED"}
MIN_TRAIN_SAMPLES = 30


def _load_labeled_dataset() -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    db = SessionLocal()
    try:
        labeled = (
            db.query(NewsArticle)
            .filter(
                NewsArticle.is_analyzed == True,  # noqa: E712
                (NewsArticle.actual_trend.isnot(None)) | (NewsArticle.manual_sentiment.isnot(None)),
            )
            .all()
        )
        vectors, targets, label_sources = [], [], []
        for n in labeled:
            analysis = {
                "sentiment": n.sentiment or "Neutral",
                "events": n.events_detected or [],
                "impact_score": n.impact_score if n.impact_score is not None else 50.0,
            }
            gf = {}
            for stock in (n.stocks_mentioned or [])[:1]:
                gf = get_graph_features(stock)
            if n.actual_trend:
                trend, source = n.actual_trend, "price"
            else:
                trend, source = SENTIMENT_TO_TREND.get(n.manual_sentiment, "UNCHANGED"), "sentiment_proxy"
            vectors.append(build_concept_vector(analysis, gf))
            targets.append(TREND_LABELS.index(trend))
            label_sources.append(source)
        if not vectors:
            empty = np.empty((0,), dtype=np.int64)
            return np.empty((0, len(CONCEPT_NAMES)), dtype=np.float32), empty, np.empty((0,), dtype=object)
        return np.stack(vectors), np.array(targets, dtype=np.int64), np.array(label_sources, dtype=object)
    finally:
        db.close()


def train(epochs: int = 200, lr: float = 1e-2, seed: int = 42, pretrain_concepts: bool = True) -> dict:
    X, y, label_sources = _load_labeled_dataset()
    if len(X) < MIN_TRAIN_SAMPLES:
        message = (
            f"Chưa đủ dữ liệu để train ECBM: chỉ có {len(X)} tin đã có nhãn (giá thật hoặc "
            f"gán nhãn tay), cần tối thiểu {MIN_TRAIN_SAMPLES}. Hãy import/gán nhãn thêm "
            "trước khi chạy lại."
        )
        print(message)
        return {"trained": False, "reason": message, "sample_size": int(len(X))}

    n_price = int((label_sources == "price").sum())
    n_proxy = int((label_sources == "sentiment_proxy").sum())

    stats = fit_concept_stats_from_semantic_corpus() if pretrain_concepts else ConceptStats.fit(X)
    X_norm = np.stack([stats.normalize(v) for v in X])

    try:
        X_train, X_val, y_train, y_val = train_test_split(
            X_norm, y, test_size=0.2, random_state=seed, stratify=y
        )
    except ValueError:
        X_train, X_val, y_train, y_val = train_test_split(X_norm, y, test_size=0.2, random_state=seed)

    # Real price-based labels skew UNCHANGED-heavy (see price_labels.py's +-2%
    # threshold), and plain CrossEntropyLoss lets the model minimize its
    # average loss by collapsing to that majority class - it did, in
    # practice, before this weighting was added (0% recall on both
    # INCREASING and DECREASING). Inverse-frequency class weights make
    # misclassifying a minority-class sample cost as much as a majority-class
    # one, which is the standard fix (sklearn's class_weight="balanced").
    class_counts = np.bincount(y_train, minlength=len(TREND_LABELS))
    class_weights = torch.tensor(
        len(y_train) / (len(TREND_LABELS) * np.maximum(class_counts, 1)), dtype=torch.float32
    )

    torch.manual_seed(seed)
    model = EnergyBasedConceptBottleneckModel()
    optimizer = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=1e-4)
    loss_fn = nn.CrossEntropyLoss(weight=class_weights)

    X_train_t = torch.from_numpy(X_train).float()
    y_train_t = torch.from_numpy(y_train).long()
    X_val_t = torch.from_numpy(X_val).float()
    y_val_t = torch.from_numpy(y_val).long()

    best_val_loss = float("inf")
    best_state = None
    patience, bad_epochs = 20, 0
    epoch = 0

    for epoch in range(epochs):
        model.train()
        optimizer.zero_grad()
        loss = loss_fn(model(X_train_t), y_train_t)
        loss.backward()
        optimizer.step()

        model.eval()
        with torch.no_grad():
            val_loss = loss_fn(model(X_val_t), y_val_t).item()

        if val_loss < best_val_loss - 1e-4:
            best_val_loss = val_loss
            best_state = {k: v.clone() for k, v in model.state_dict().items()}
            bad_epochs = 0
        else:
            bad_epochs += 1
            if bad_epochs >= patience:
                break

    if best_state is not None:
        model.load_state_dict(best_state)

    model.eval()
    with torch.no_grad():
        val_pred = torch.argmax(model(X_val_t), dim=1).numpy()

    metrics = {
        "trained": True,
        "sample_size": int(len(X)),
        "real_price_labels": n_price,
        "sentiment_proxy_labels": n_proxy,
        "train_size": int(len(X_train)),
        "val_size": int(len(X_val)),
        "val_accuracy": round(accuracy_score(y_val, val_pred), 4),
        "val_f1_weighted": round(f1_score(y_val, val_pred, average="weighted", zero_division=0), 4),
        # weighted F1 alone hides class collapse (a model that always predicts
        # the majority class can still score decently on it); macro F1 treats
        # all 3 trend classes equally and is what actually caught the
        # UNCHANGED-only collapse this class weighting fixes.
        "val_f1_macro": round(f1_score(y_val, val_pred, average="macro", zero_division=0), 4),
        "epochs_run": epoch + 1,
        "labels": TREND_LABELS,
    }

    save_checkpoint(model, stats)
    with open(METRICS_PATH, "w", encoding="utf-8") as f:
        json.dump(metrics, f, ensure_ascii=False, indent=2)

    print(json.dumps(metrics, ensure_ascii=False, indent=2))
    return metrics


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train the ECBM trend predictor")
    parser.add_argument("--epochs", type=int, default=200)
    parser.add_argument("--lr", type=float, default=1e-2)
    parser.add_argument("--no-pretrain-concepts", action="store_true")
    args = parser.parse_args()
    train(epochs=args.epochs, lr=args.lr, pretrain_concepts=not args.no_pretrain_concepts)
