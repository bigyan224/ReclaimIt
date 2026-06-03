import argparse
import json
import random
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np

from lost_found_matcher import item_to_match_text


DEFAULT_DATASET_DIR = Path(__file__).resolve().parent / "datasets" / "lost_found_matching"
DEFAULT_OUTPUT_DIR = Path(__file__).resolve().parent / "models" / "lost_found_cross_encoder"


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def group_split(items: List[dict], seed: int) -> Dict[str, str]:
    groups = sorted({item["possiblePairGroup"] for item in items})
    rng = random.Random(seed)
    rng.shuffle(groups)

    train_end = int(len(groups) * 0.80)
    val_end = int(len(groups) * 0.90)

    split_by_group = {}
    for group in groups[:train_end]:
        split_by_group[group] = "train"
    for group in groups[train_end:val_end]:
        split_by_group[group] = "val"
    for group in groups[val_end:]:
        split_by_group[group] = "test"

    return split_by_group


def split_pairs(
    items_by_id: Dict[str, dict],
    pairs: List[dict],
    split_by_group: Dict[str, str],
) -> Dict[str, List[dict]]:
    splits = {"train": [], "val": [], "test": []}

    for pair in pairs:
        item1 = items_by_id[pair["item1_id"]]
        item2 = items_by_id[pair["item2_id"]]
        split1 = split_by_group[item1["possiblePairGroup"]]
        split2 = split_by_group[item2["possiblePairGroup"]]

        # Keep the split group-aware. Negative pairs that cross split boundaries are
        # dropped so test examples do not share generated source groups with train.
        if split1 == split2:
            splits[split1].append(pair)

    return {name: balance_pairs(rows) for name, rows in splits.items()}


def balance_pairs(pairs: List[dict]) -> List[dict]:
    by_label = defaultdict(list)
    for pair in pairs:
        by_label[int(pair["label"])].append(pair)

    keep = min(len(by_label[0]), len(by_label[1]))
    if keep == 0:
        raise ValueError("A split has no positive or no negative pairs after group splitting.")

    balanced = by_label[0][:keep] + by_label[1][:keep]
    random.shuffle(balanced)
    return balanced


def make_sentence_pairs(
    pairs: List[dict],
    items_by_id: Dict[str, dict],
) -> Tuple[List[Tuple[str, str]], List[int]]:
    sentence_pairs = []
    labels = []

    for pair in pairs:
        item1 = items_by_id[pair["item1_id"]]
        item2 = items_by_id[pair["item2_id"]]
        sentence_pairs.append(
            (
                item_to_match_text(item1, other_item=item2),
                item_to_match_text(item2, other_item=item1),
            )
        )
        labels.append(int(pair["label"]))

    return sentence_pairs, labels


def binary_metrics(labels: List[int], scores: List[float], threshold: float = 0.5) -> Dict[str, float]:
    labels_np = np.asarray(labels, dtype=np.int32)
    scores_np = np.asarray(scores, dtype=np.float64)
    preds = (scores_np >= threshold).astype(np.int32)

    tp = int(((preds == 1) & (labels_np == 1)).sum())
    fp = int(((preds == 1) & (labels_np == 0)).sum())
    tn = int(((preds == 0) & (labels_np == 0)).sum())
    fn = int(((preds == 0) & (labels_np == 1)).sum())

    precision = tp / max(1, tp + fp)
    recall = tp / max(1, tp + fn)
    f1 = 2 * precision * recall / max(1e-12, precision + recall)
    accuracy = (tp + tn) / max(1, len(labels_np))

    return {
        "accuracy": round(float(accuracy), 4),
        "precision": round(float(precision), 4),
        "recall": round(float(recall), 4),
        "f1": round(float(f1), 4),
        "tp": tp,
        "fp": fp,
        "tn": tn,
        "fn": fn,
    }


def find_best_threshold(labels: List[int], scores: List[float]) -> Tuple[float, Dict[str, float]]:
    best_threshold = 0.5
    best_metrics = binary_metrics(labels, scores, best_threshold)

    for threshold in np.linspace(0.05, 0.95, 91):
        metrics = binary_metrics(labels, scores, float(threshold))
        if metrics["f1"] > best_metrics["f1"]:
            best_threshold = float(threshold)
            best_metrics = metrics

    return round(best_threshold, 3), best_metrics


def evaluate_cross_encoder(model, pairs: List[Tuple[str, str]], labels: List[int], batch_size: int):
    scores = model.predict(pairs, batch_size=batch_size, show_progress_bar=True)
    scores = [float(score) for score in scores]
    threshold, metrics = find_best_threshold(labels, scores)
    metrics["threshold"] = threshold
    return metrics, scores


def train(args):
    try:
        from sentence_transformers import CrossEncoder, InputExample
        from torch.utils.data import DataLoader
    except ImportError as exc:
        raise SystemExit(
            "Missing ML dependencies. Install them with:\n"
            "  pip install -r AI/requirements-ml.txt\n\n"
            f"Original import error: {exc}"
        )

    random.seed(args.seed)
    np.random.seed(args.seed)

    dataset_dir = Path(args.dataset_dir)
    output_dir = Path(args.output_dir)
    items = load_json(dataset_dir / "items.json")
    pairs = load_json(dataset_dir / "training_pairs.json")
    items_by_id = {item["id"]: item for item in items}

    split_by_group = group_split(items, args.seed)
    pair_splits = split_pairs(items_by_id, pairs, split_by_group)

    train_pairs, train_labels = make_sentence_pairs(pair_splits["train"], items_by_id)
    val_pairs, val_labels = make_sentence_pairs(pair_splits["val"], items_by_id)
    test_pairs, test_labels = make_sentence_pairs(pair_splits["test"], items_by_id)

    train_examples = [
        InputExample(texts=[left, right], label=float(label))
        for (left, right), label in zip(train_pairs, train_labels)
    ]
    train_loader = DataLoader(train_examples, shuffle=True, batch_size=args.batch_size)

    model = CrossEncoder(
        args.base_model,
        num_labels=1,
        max_length=args.max_length,
    )

    warmup_steps = max(10, int(len(train_loader) * args.epochs * 0.10))
    output_dir.mkdir(parents=True, exist_ok=True)

    model.fit(
        train_dataloader=train_loader,
        epochs=args.epochs,
        warmup_steps=warmup_steps,
        output_path=str(output_dir),
        show_progress_bar=True,
    )

    trained_model = CrossEncoder(str(output_dir), max_length=args.max_length)
    val_metrics, _ = evaluate_cross_encoder(
        trained_model, val_pairs, val_labels, args.eval_batch_size
    )
    test_metrics, _ = evaluate_cross_encoder(
        trained_model, test_pairs, test_labels, args.eval_batch_size
    )

    metadata = {
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "baseModel": args.base_model,
        "maxLength": args.max_length,
        "seed": args.seed,
        "datasetDir": str(dataset_dir),
        "items": len(items),
        "allPairs": len(pairs),
        "splitPairCounts": {name: len(rows) for name, rows in pair_splits.items()},
        "trainLabelCounts": dict(Counter(train_labels)),
        "valLabelCounts": dict(Counter(val_labels)),
        "testLabelCounts": dict(Counter(test_labels)),
        "recommendedThreshold": val_metrics["threshold"],
        "validationMetrics": val_metrics,
        "testMetrics": test_metrics,
        "scoreContract": "model output is converted to 0..100 percent matchScore",
    }
    (output_dir / "matcher_metadata.json").write_text(
        json.dumps(metadata, indent=2),
        encoding="utf-8",
    )

    print(json.dumps(metadata, indent=2))


def parse_args():
    parser = argparse.ArgumentParser(
        description="Train a cross-encoder lost-and-found item matcher."
    )
    parser.add_argument("--dataset-dir", default=str(DEFAULT_DATASET_DIR))
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    parser.add_argument(
        "--base-model",
        default="cross-encoder/ms-marco-MiniLM-L-6-v2",
        help="A small strong cross-encoder. Use a larger cross-encoder for better accuracy if you have GPU.",
    )
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--eval-batch-size", type=int, default=64)
    parser.add_argument("--max-length", type=int, default=256)
    parser.add_argument("--seed", type=int, default=20260525)
    return parser.parse_args()


if __name__ == "__main__":
    train(parse_args())
