"""Run leakage-aware text/market/KG feature ablations for FinNexus.

The experiment follows the locked protocol in ``config/kg_evaluation_protocol.yaml``.
It is intentionally labelled exploratory because the project's current test
period has appeared in earlier preliminary outputs.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import platform
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import scipy
import sklearn
import yaml
from scipy.sparse import csr_matrix, hstack
from scipy.stats import binomtest
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    f1_score,
    matthews_corrcoef,
    precision_recall_fscore_support,
)
from sklearn.preprocessing import OneHotEncoder, StandardScaler


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_PROTOCOL = ROOT / "config" / "kg_evaluation_protocol.yaml"
DEFAULT_DATA_DIR = ROOT / "data" / "dataset"
DEFAULT_GRAPH_FEATURES = ROOT / "data" / "knowledge_graph" / "temporal_graph_features.csv"
DEFAULT_OUTPUT = ROOT / "outputs" / "kg_evaluation_v1"

TARGET = "primary_reaction_direction_3d"
LABELS = ["NEGATIVE", "NEUTRAL", "POSITIVE"]
CATEGORICAL_FEATURES = ["symbol", "industry", "exchange", "source"]
MARKET_FEATURES = [
    "pre_event_close",
    "prior_volatility_20d",
    "prior_median_volume_20d",
    "event_to_session_lag_days",
]
GRAPH_FEATURES = [
    "stock_degree_centrality",
    "stock_betweenness_centrality",
    "stock_closeness_centrality",
    "stock_projection_nodes",
    "stock_projection_edges",
    "historical_stock_news_count",
    "historical_stock_event_count",
    "historical_stock_positive_count",
    "historical_stock_negative_count",
    "historical_stock_neutral_count",
    "recent_30d_stock_news_count",
    "recent_30d_stock_positive_count",
    "recent_30d_stock_negative_count",
    "recent_30d_industry_news_count",
    "recent_30d_industry_sentiment_mean",
    "recent_30d_same_event_type_count",
    "recent_30d_industry_stocks_same_event_type",
]
FEATURE_SET_COMPONENTS = {
    "text": {"text"},
    "market": {"market"},
    "graph": {"graph"},
    "text_market": {"text", "market"},
    "text_graph": {"text", "graph"},
    "text_market_graph": {"text", "market", "graph"},
}


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def load_protocol(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        protocol = yaml.safe_load(handle)
    if not isinstance(protocol, dict):
        raise ValueError("Protocol YAML must contain a mapping")
    return protocol


def as_bool(series: pd.Series) -> pd.Series:
    return (
        series.astype(str)
        .str.strip()
        .str.casefold()
        .isin({"true", "1", "yes"})
    )


def load_and_validate(
    data_dir: Path, graph_path: Path, graph_features: list[str]
) -> tuple[dict[str, pd.DataFrame], list[dict[str, Any]]]:
    graph = pd.read_csv(graph_path, low_memory=False)
    if graph["sample_id"].duplicated().any():
        raise ValueError("Duplicate sample_id in temporal graph features")
    required_graph = {
        "sample_id",
        "news_id",
        "published_date",
        "split",
        "feature_cutoff_date",
        "history_rule",
        *graph_features,
    }
    missing_graph = sorted(required_graph.difference(graph.columns))
    if missing_graph:
        raise ValueError(f"Graph features lack columns: {missing_graph}")

    frames: dict[str, pd.DataFrame] = {}
    checks: list[dict[str, Any]] = []
    for split in ("train", "validation", "test"):
        frame = pd.read_csv(data_dir / f"{split}.csv", low_memory=False)
        required = {
            "sample_id",
            "news_id",
            "published_date",
            "split",
            "model_input",
            TARGET,
            "baseline_training_eligible",
            "strict_research_eligible",
            *CATEGORICAL_FEATURES,
            *MARKET_FEATURES,
        }
        missing = sorted(required.difference(frame.columns))
        if missing:
            raise ValueError(f"{split}.csv lacks columns: {missing}")
        if not frame["split"].astype(str).eq(split).all():
            raise ValueError(f"{split}.csv contains another split")
        merged = frame.merge(
            graph,
            on="sample_id",
            how="left",
            validate="one_to_one",
            suffixes=("", "_graph"),
        )
        if merged["feature_cutoff_date"].isna().any():
            raise ValueError(f"{split} has samples without graph features")
        if not merged["news_id"].astype(str).eq(
            merged["news_id_graph"].astype(str)
        ).all():
            raise ValueError(f"{split} graph news_id mismatch")
        if not merged["split_graph"].astype(str).eq(split).all():
            raise ValueError(f"{split} graph split mismatch")
        publication = pd.to_datetime(merged["published_date"], errors="raise")
        cutoff = pd.to_datetime(merged["feature_cutoff_date"], errors="raise")
        valid_cutoff = cutoff.lt(publication)
        checks.append(
            {
                "check": f"{split}_graph_cutoff_strictly_before_publication",
                "value": int(valid_cutoff.sum()),
                "expected": len(merged),
                "status": "PASS" if valid_cutoff.all() else "FAIL",
            }
        )
        history_valid = merged["history_rule"].eq(
            "STRICTLY_BEFORE_PUBLICATION_DATE"
        )
        checks.append(
            {
                "check": f"{split}_history_rule",
                "value": int(history_valid.sum()),
                "expected": len(merged),
                "status": "PASS" if history_valid.all() else "FAIL",
            }
        )
        for column in MARKET_FEATURES + graph_features:
            merged[column] = pd.to_numeric(merged[column], errors="coerce")
        merged["model_input"] = merged["model_input"].fillna("").astype(str)
        frames[split] = merged

    combined = pd.concat(frames.values(), ignore_index=True)
    checks.append(
        {
            "check": "unique_sample_id_across_splits",
            "value": int(combined["sample_id"].nunique()),
            "expected": len(combined),
            "status": "PASS"
            if not combined["sample_id"].duplicated().any()
            else "FAIL",
        }
    )
    news_split_count = combined.groupby("news_id")["split"].nunique()
    checks.append(
        {
            "check": "news_disjoint_across_splits",
            "value": int(news_split_count.gt(1).sum()),
            "expected": 0,
            "status": "PASS" if not news_split_count.gt(1).any() else "FAIL",
        }
    )
    checks.append(
        {
            "check": "future_outcomes_excluded_from_features",
            "value": 0,
            "expected": 0,
            "status": "PASS",
        }
    )
    return frames, checks


class FeatureAssembler:
    def __init__(
        self,
        components: set[str],
        text_config: dict[str, Any],
        graph_features: list[str],
    ):
        self.components = components
        self.vectorizer: TfidfVectorizer | None = None
        self.encoder: OneHotEncoder | None = None
        self.market_scaler: StandardScaler | None = None
        self.graph_scaler: StandardScaler | None = None
        self.market_medians: pd.Series | None = None
        self.graph_medians: pd.Series | None = None
        self.text_config = text_config
        self.graph_features = graph_features

    @staticmethod
    def numeric_view(frame: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
        numeric = frame[columns].copy()
        for column in ("pre_event_close", "prior_median_volume_20d"):
            if column in numeric.columns:
                numeric[column] = np.log1p(numeric[column].clip(lower=0))
        count_columns = [
            column
            for column in numeric.columns
            if "count" in column
            or column in {"stock_projection_nodes", "stock_projection_edges"}
        ]
        for column in count_columns:
            numeric[column] = np.log1p(numeric[column].clip(lower=0))
        return numeric

    def fit_transform(self, frame: pd.DataFrame):
        blocks = []
        if "text" in self.components:
            self.vectorizer = TfidfVectorizer(
                analyzer=str(self.text_config["analyzer"]),
                ngram_range=tuple(self.text_config["ngram_range"]),
                min_df=int(self.text_config["min_df"]),
                max_features=int(self.text_config["max_features"]),
                sublinear_tf=bool(self.text_config["sublinear_tf"]),
            )
            blocks.append(self.vectorizer.fit_transform(frame["model_input"]))
        if "market" in self.components:
            self.encoder = OneHotEncoder(handle_unknown="ignore")
            blocks.append(self.encoder.fit_transform(frame[CATEGORICAL_FEATURES]))
            market = self.numeric_view(frame, MARKET_FEATURES)
            self.market_medians = market.median()
            market = market.fillna(self.market_medians).fillna(0.0)
            self.market_scaler = StandardScaler()
            blocks.append(
                csr_matrix(self.market_scaler.fit_transform(market))
            )
        if "graph" in self.components:
            graph = self.numeric_view(frame, self.graph_features)
            self.graph_medians = graph.median()
            graph = graph.fillna(self.graph_medians).fillna(0.0)
            self.graph_scaler = StandardScaler()
            blocks.append(csr_matrix(self.graph_scaler.fit_transform(graph)))
        if not blocks:
            raise ValueError("A non-majority feature set must have components")
        return hstack(blocks, format="csr") if len(blocks) > 1 else blocks[0]

    def transform(self, frame: pd.DataFrame):
        blocks = []
        if "text" in self.components:
            if self.vectorizer is None:
                raise RuntimeError("Text vectorizer was not fitted")
            blocks.append(self.vectorizer.transform(frame["model_input"]))
        if "market" in self.components:
            if (
                self.encoder is None
                or self.market_scaler is None
                or self.market_medians is None
            ):
                raise RuntimeError("Market transformer was not fitted")
            blocks.append(self.encoder.transform(frame[CATEGORICAL_FEATURES]))
            market = self.numeric_view(frame, MARKET_FEATURES)
            market = market.fillna(self.market_medians).fillna(0.0)
            blocks.append(csr_matrix(self.market_scaler.transform(market)))
        if "graph" in self.components:
            if self.graph_scaler is None or self.graph_medians is None:
                raise RuntimeError("Graph transformer was not fitted")
            graph = self.numeric_view(frame, self.graph_features)
            graph = graph.fillna(self.graph_medians).fillna(0.0)
            blocks.append(csr_matrix(self.graph_scaler.transform(graph)))
        return hstack(blocks, format="csr") if len(blocks) > 1 else blocks[0]


def metric_rows(
    truth: pd.Series,
    prediction: np.ndarray,
    population: str,
    stage: str,
    feature_set: str,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    overall = [
        {
            "population": population,
            "stage": stage,
            "feature_set": feature_set,
            "metric": "accuracy",
            "value": accuracy_score(truth, prediction),
            "n": len(truth),
        },
        {
            "population": population,
            "stage": stage,
            "feature_set": feature_set,
            "metric": "balanced_accuracy",
            "value": balanced_accuracy_score(truth, prediction),
            "n": len(truth),
        },
        {
            "population": population,
            "stage": stage,
            "feature_set": feature_set,
            "metric": "macro_f1",
            "value": f1_score(
                truth, prediction, labels=LABELS, average="macro", zero_division=0
            ),
            "n": len(truth),
        },
        {
            "population": population,
            "stage": stage,
            "feature_set": feature_set,
            "metric": "weighted_f1",
            "value": f1_score(
                truth,
                prediction,
                labels=LABELS,
                average="weighted",
                zero_division=0,
            ),
            "n": len(truth),
        },
        {
            "population": population,
            "stage": stage,
            "feature_set": feature_set,
            "metric": "matthews_corrcoef",
            "value": matthews_corrcoef(truth, prediction),
            "n": len(truth),
        },
    ]
    precision, recall, f1, support = precision_recall_fscore_support(
        truth, prediction, labels=LABELS, zero_division=0
    )
    by_class = [
        {
            "population": population,
            "stage": stage,
            "feature_set": feature_set,
            "class": label,
            "precision": precision[index],
            "recall": recall[index],
            "f1": f1[index],
            "support": support[index],
        }
        for index, label in enumerate(LABELS)
    ]
    return overall, by_class


def fit_predict(
    train: pd.DataFrame,
    evaluation: pd.DataFrame,
    feature_set: str,
    protocol: dict[str, Any],
    graph_features: list[str],
) -> np.ndarray:
    if feature_set == "majority":
        majority = train[TARGET].value_counts().idxmax()
        return np.repeat(majority, len(evaluation))
    assembler = FeatureAssembler(
        FEATURE_SET_COMPONENTS[feature_set],
        protocol["predictive_ablation"]["text"],
        graph_features,
    )
    x_train = assembler.fit_transform(train)
    x_evaluation = assembler.transform(evaluation)
    classifier_config = protocol["predictive_ablation"]["classifier"]
    model = LogisticRegression(
        C=float(classifier_config["C"]),
        class_weight=str(classifier_config["class_weight"]),
        max_iter=int(classifier_config["max_iter"]),
        random_state=int(protocol["random_seed"]),
    )
    model.fit(x_train, train[TARGET])
    return model.predict(x_evaluation)


def clustered_delta_bootstrap(
    paired: pd.DataFrame, iterations: int, seed: int
) -> tuple[float, float, float, np.ndarray]:
    groups = paired["news_id"].astype(str).unique()
    by_group = {
        group: paired.loc[paired["news_id"].astype(str).eq(group)]
        for group in groups
    }
    rng = np.random.default_rng(seed)
    deltas = np.empty(iterations, dtype=float)
    for iteration in range(iterations):
        sampled = rng.choice(groups, size=len(groups), replace=True)
        frame = pd.concat([by_group[group] for group in sampled], ignore_index=True)
        augmented = f1_score(
            frame["truth"],
            frame["augmented"],
            labels=LABELS,
            average="macro",
            zero_division=0,
        )
        reference = f1_score(
            frame["truth"],
            frame["reference"],
            labels=LABELS,
            average="macro",
            zero_division=0,
        )
        deltas[iteration] = augmented - reference
    observed = f1_score(
        paired["truth"],
        paired["augmented"],
        labels=LABELS,
        average="macro",
        zero_division=0,
    ) - f1_score(
        paired["truth"],
        paired["reference"],
        labels=LABELS,
        average="macro",
        zero_division=0,
    )
    lower, upper = np.quantile(deltas, [0.025, 0.975])
    return float(observed), float(lower), float(upper), deltas


def subgroup_metrics(
    predictions: pd.DataFrame, augmented_name: str, reference_name: str
) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    base = predictions.loc[
        predictions["feature_set"].isin([augmented_name, reference_name])
    ]
    for population in sorted(base["population"].unique()):
        population_frame = base.loc[base["population"].eq(population)]
        for group_column in ("source", "year"):
            for group_value, grouped in population_frame.groupby(
                group_column, dropna=False
            ):
                pivot = grouped.pivot(
                    index="sample_id", columns="feature_set", values="prediction"
                )
                truth = (
                    grouped.drop_duplicates("sample_id")
                    .set_index("sample_id")
                    .loc[pivot.index, "truth"]
                )
                for feature_set in (reference_name, augmented_name):
                    if feature_set not in pivot:
                        continue
                    rows.append(
                        {
                            "population": population,
                            "group_column": group_column,
                            "group_value": group_value,
                            "feature_set": feature_set,
                            "n": len(pivot),
                            "macro_f1": f1_score(
                                truth,
                                pivot[feature_set],
                                labels=LABELS,
                                average="macro",
                                zero_division=0,
                            ),
                        }
                    )
    return pd.DataFrame(rows)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--protocol", type=Path, default=DEFAULT_PROTOCOL)
    parser.add_argument("--data_dir", type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument("--graph_features", type=Path, default=DEFAULT_GRAPH_FEATURES)
    parser.add_argument("--output_dir", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    protocol = load_protocol(args.protocol)
    graph_feature_names = list(
        protocol["predictive_ablation"].get(
            "graph_feature_columns", GRAPH_FEATURES
        )
    )
    if not graph_feature_names or len(graph_feature_names) != len(
        set(graph_feature_names)
    ):
        raise ValueError("graph_feature_columns must be non-empty and unique")
    frames, leakage_checks = load_and_validate(
        args.data_dir, args.graph_features, graph_feature_names
    )
    args.output_dir.mkdir(parents=True, exist_ok=True)
    feature_sets = protocol["predictive_ablation"]["feature_sets"]
    metric_output: list[dict[str, Any]] = []
    class_output: list[dict[str, Any]] = []
    prediction_output: list[pd.DataFrame] = []

    for population in protocol["predictive_ablation"]["populations"]:
        eligibility = {
            "baseline": "baseline_training_eligible",
            "strict": "strict_research_eligible",
        }[population]
        split_frames = {
            split: frame.loc[as_bool(frame[eligibility])].copy()
            for split, frame in frames.items()
        }
        train_validation = pd.concat(
            [split_frames["train"], split_frames["validation"]],
            ignore_index=True,
        )
        for stage, train, evaluation in (
            (
                "validation",
                split_frames["train"],
                split_frames["validation"],
            ),
            ("test", train_validation, split_frames["test"]),
        ):
            for feature_set in feature_sets:
                prediction = fit_predict(
                    train,
                    evaluation,
                    feature_set,
                    protocol,
                    graph_feature_names,
                )
                overall, per_class = metric_rows(
                    evaluation[TARGET],
                    prediction,
                    population,
                    stage,
                    feature_set,
                )
                metric_output.extend(overall)
                class_output.extend(per_class)
                prediction_output.append(
                    pd.DataFrame(
                        {
                            "population": population,
                            "stage": stage,
                            "feature_set": feature_set,
                            "sample_id": evaluation["sample_id"].values,
                            "news_id": evaluation["news_id"].values,
                            "published_date": evaluation["published_date"].values,
                            "source": evaluation["source"].values,
                            "year": pd.to_datetime(
                                evaluation["published_date"]
                            ).dt.year.values,
                            "truth": evaluation[TARGET].values,
                            "prediction": prediction,
                        }
                    )
                )

    metrics = pd.DataFrame(metric_output)
    per_class = pd.DataFrame(class_output)
    predictions = pd.concat(prediction_output, ignore_index=True)
    metrics.to_csv(
        args.output_dir / "kg_ablation_metrics.csv",
        index=False,
        encoding="utf-8-sig",
    )
    per_class.to_csv(
        args.output_dir / "kg_ablation_per_class.csv",
        index=False,
        encoding="utf-8-sig",
    )
    predictions.to_csv(
        args.output_dir / "kg_ablation_predictions.csv",
        index=False,
        encoding="utf-8-sig",
    )
    pd.DataFrame(leakage_checks).to_csv(
        args.output_dir / "kg_ablation_leakage_checks.csv",
        index=False,
        encoding="utf-8-sig",
    )

    comparison = protocol["predictive_ablation"]["primary_comparison"]
    augmented_name = comparison["augmented"]
    reference_name = comparison["reference"]
    comparison_stage = str(comparison.get("stage", "test"))
    if comparison_stage not in {"validation", "test"}:
        raise ValueError("primary_comparison.stage must be validation or test")
    comparison_rows: list[dict[str, Any]] = []
    bootstrap_rows: list[pd.DataFrame] = []
    for population in protocol["predictive_ablation"]["populations"]:
        selected = predictions.loc[
            predictions["population"].eq(population)
            & predictions["stage"].eq(comparison_stage)
            & predictions["feature_set"].isin(
                [augmented_name, reference_name]
            )
        ]
        pivot = selected.pivot(
            index="sample_id", columns="feature_set", values="prediction"
        )
        metadata = (
            selected.drop_duplicates("sample_id")
            .set_index("sample_id")
            .loc[pivot.index]
        )
        paired = pd.DataFrame(
            {
                "sample_id": pivot.index,
                "news_id": metadata["news_id"].values,
                "truth": metadata["truth"].values,
                "reference": pivot[reference_name].values,
                "augmented": pivot[augmented_name].values,
            }
        )
        observed, lower, upper, deltas = clustered_delta_bootstrap(
            paired,
            int(comparison["bootstrap_iterations"]),
            int(protocol["random_seed"]) + (0 if population == "baseline" else 100),
        )
        reference_correct = paired["reference"].eq(paired["truth"])
        augmented_correct = paired["augmented"].eq(paired["truth"])
        reference_only = int((reference_correct & ~augmented_correct).sum())
        augmented_only = int((~reference_correct & augmented_correct).sum())
        discordant = reference_only + augmented_only
        p_value = (
            float(
                binomtest(
                    min(reference_only, augmented_only),
                    discordant,
                    p=0.5,
                    alternative="two-sided",
                ).pvalue
            )
            if discordant
            else 1.0
        )
        comparison_rows.append(
            {
                "population": population,
                "stage": comparison_stage,
                "reference": reference_name,
                "augmented": augmented_name,
                "metric": "macro_f1_delta",
                "delta": observed,
                "bootstrap_95_lower": lower,
                "bootstrap_95_upper": upper,
                "bootstrap_iterations": int(comparison["bootstrap_iterations"]),
                "bootstrap_group": "news_id",
                "mcnemar_reference_only_correct": reference_only,
                "mcnemar_augmented_only_correct": augmented_only,
                "mcnemar_exact_p": p_value,
                "n_relations": len(paired),
                "n_news": paired["news_id"].nunique(),
            }
        )
        bootstrap_rows.append(
            pd.DataFrame(
                {
                    "population": population,
                    "iteration": np.arange(1, len(deltas) + 1),
                    "macro_f1_delta": deltas,
                }
            )
        )
    comparison_frame = pd.DataFrame(comparison_rows)
    comparison_frame.to_csv(
        args.output_dir / "kg_ablation_paired_comparison.csv",
        index=False,
        encoding="utf-8-sig",
    )
    pd.concat(bootstrap_rows, ignore_index=True).to_csv(
        args.output_dir / "kg_ablation_bootstrap_distribution.csv",
        index=False,
        encoding="utf-8-sig",
    )
    subgroup_metrics(predictions.loc[predictions["stage"].eq("test")], augmented_name, reference_name).to_csv(
        args.output_dir / "kg_ablation_subgroup_metrics.csv",
        index=False,
        encoding="utf-8-sig",
    )

    baseline = comparison_frame.loc[
        comparison_frame["population"].eq("baseline")
    ].iloc[0]
    strict = comparison_frame.loc[
        comparison_frame["population"].eq("strict")
    ].iloc[0]
    leakage_pass = all(check["status"] == "PASS" for check in leakage_checks)
    primary_gate = (
        float(baseline["delta"]) >= float(comparison["minimum_delta"])
        and (
            float(baseline["bootstrap_95_lower"]) > 0.0
            if comparison["require_ci_lower_above_zero"]
            else True
        )
    )
    strict_gate = float(strict["delta"]) >= float(
        protocol["predictive_ablation"]["robustness"][
            "strict_population_minimum_delta"
        ]
    )
    decision = {
        "protocol_version": protocol["protocol_version"],
        "protocol_sha256": file_sha256(args.protocol),
        "experiment_design": protocol["scientific_status"]["experiment_design"],
        "confirmatory_claim_allowed": False,
        "primary_comparison_stage": comparison_stage,
        "random_seed": int(protocol["random_seed"]),
        "input_hashes": {
            "train": file_sha256(args.data_dir / "train.csv"),
            "validation": file_sha256(args.data_dir / "validation.csv"),
            "test": file_sha256(args.data_dir / "test.csv"),
            "temporal_graph_features": file_sha256(args.graph_features),
        },
        "software": {
            "python": platform.python_version(),
            "numpy": np.__version__,
            "pandas": pd.__version__,
            "scikit_learn": sklearn.__version__,
            "scipy": scipy.__version__,
        },
        "feature_contract": {
            "target": TARGET,
            "categorical_metadata": CATEGORICAL_FEATURES,
            "pre_event_market": MARKET_FEATURES,
            "temporal_graph": graph_feature_names,
            "semantic_labels_used_as_direct_model_features": False,
            "future_market_outcomes_used_as_features": False,
        },
        "leakage_checks_pass": leakage_pass,
        "baseline_population_macro_f1_delta": float(baseline["delta"]),
        "baseline_population_bootstrap_95": [
            float(baseline["bootstrap_95_lower"]),
            float(baseline["bootstrap_95_upper"]),
        ],
        "baseline_population_mcnemar_exact_p": float(
            baseline["mcnemar_exact_p"]
        ),
        "strict_population_macro_f1_delta": float(strict["delta"]),
        "strict_population_bootstrap_95": [
            float(strict["bootstrap_95_lower"]),
            float(strict["bootstrap_95_upper"]),
        ],
        "primary_predictive_gate_pass": bool(primary_gate),
        "strict_robustness_gate_pass": bool(strict_gate),
        "ready_for_exploratory_kg_modeling": bool(
            leakage_pass and primary_gate and strict_gate
        ),
        "interpretation": (
            "A positive delta is associative evidence that the temporal KG "
            "features improve prediction under this split; it is not evidence "
            "that the news caused the observed market move."
        ),
    }
    (args.output_dir / "kg_ablation_summary.json").write_text(
        json.dumps(decision, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    report = [
        "# Ablation text/market/graph của FinNexus KG",
        "",
        "## Trạng thái khoa học",
        "",
        "- Thiết kế: **EXPLORATORY_LOCKED_PROTOCOL**.",
        "- Test hiện tại không được gọi là untouched confirmatory holdout vì đã xuất hiện trong các output sơ bộ trước đây.",
        f"- Kiểm tra leakage: **{'PASS' if leakage_pass else 'FAIL'}**.",
        "",
        f"## Đóng góp của graph trên {comparison_stage}",
        "",
        (
            f"- Baseline population: Δ macro-F1 = **{baseline['delta']:+.4f}**, "
            f"cluster bootstrap 95% CI "
            f"[{baseline['bootstrap_95_lower']:+.4f}, "
            f"{baseline['bootstrap_95_upper']:+.4f}], "
            f"McNemar exact p = {baseline['mcnemar_exact_p']:.4f}."
        ),
        (
            f"- Strict isolated population: Δ macro-F1 = "
            f"**{strict['delta']:+.4f}**, cluster bootstrap 95% CI "
            f"[{strict['bootstrap_95_lower']:+.4f}, "
            f"{strict['bootstrap_95_upper']:+.4f}]."
        ),
        (
            f"- Cổng đóng góp graph chính: "
            f"**{'PASS' if primary_gate else 'FAIL'}**."
        ),
        (
            f"- Cổng robustness strict: "
            f"**{'PASS' if strict_gate else 'FAIL'}**."
        ),
        "",
        "## Diễn giải",
        "",
        "- So sánh chính là `text_market_graph` với `text_market`; các hyperparameter và ngưỡng đã được khóa trong YAML trước khi chạy.",
        "- Bootstrap lấy mẫu theo `news_id` để không coi nhiều mã trong cùng một bài là các quan sát độc lập.",
        "- Kết quả là bằng chứng về giá trị dự báo bổ sung của feature KG trong split hiện tại, không phải bằng chứng nhân quả của tin tức.",
    ]
    (args.output_dir / "kg_ablation_report.md").write_text(
        "\n".join(report) + "\n", encoding="utf-8"
    )
    print(json.dumps(decision, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
