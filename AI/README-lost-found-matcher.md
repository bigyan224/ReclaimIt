# Lost-and-Found Matcher Training

This folder contains a local training pipeline for the synthetic lost-and-found
matching dataset.

## Files

- `datasets/lost_found_matching/items.json`
- `datasets/lost_found_matching/training_pairs.json`
- `train_lost_found_matcher.py`
- `lost_found_matcher.py`
- `requirements-ml.txt`

## Install ML dependencies

Use a Python environment with PyTorch and sentence-transformers:

```bash
pip install -r AI/requirements-ml.txt
```

## Train

```bash
python AI/train_lost_found_matcher.py
```

The default output is:

```text
AI/models/lost_found_cross_encoder/
```

The trainer uses:

- a cross-encoder model for pairwise matching accuracy
- group-aware train/validation/test splitting to avoid leakage
- balanced positive and hard-negative pairs
- validation and test metrics
- a saved `matcher_metadata.json` with the recommended score threshold

## Better Accuracy

For stronger accuracy on a GPU machine, train with a larger reranker:

```bash
python AI/train_lost_found_matcher.py --base-model BAAI/bge-reranker-base --batch-size 8
```

For CPU-only training, keep the default small model:

```bash
python AI/train_lost_found_matcher.py --base-model cross-encoder/ms-marco-MiniLM-L-6-v2
```

## App Inference Shape

After training, the server can load the model and score one source item against
many candidates:

```python
from AI.lost_found_matcher import LostFoundMatcher

matcher = LostFoundMatcher("AI/models/lost_found_cross_encoder")
scores = matcher.score_candidates(source_item, candidate_items)
```

Each result looks like:

```json
{
  "candidateId": "item id",
  "matchScore": 87.42
}
```

`matchScore` is a 0-100 percentage-style score sorted from best to worst.

## Run Local API

Create and activate a virtual environment:

```bash
python -m venv .venv
.\.venv\Scripts\activate
pip install -r AI\requirements-ml.txt
```

Start the FastAPI matcher server from the project root:

```bash
cd D:\Downloads\Reclaimit\AI
uvicorn matcher_api:app --host 0.0.0.0 --port 8000
```

The API loads the trained model from:

```text
AI\models
```

Override the model path with `MATCHER_MODEL_DIR` if needed:

```bash
set MATCHER_MODEL_DIR=D:\Downloads\Reclaimit\AI\models
uvicorn matcher_api:app --host 0.0.0.0 --port 8000
```

Endpoint:

```text
POST /score
```

Response:

```json
[
  {
    "candidateId": "found-1",
    "matchScore": 92.4,
    "confidence": 0.91
  }
]
```
