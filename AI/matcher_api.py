import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from lost_found_matcher import LostFoundMatcher


DEFAULT_MODEL_DIR = Path(__file__).resolve().parent / "models"
MODEL_DIR = Path(os.getenv("MATCHER_MODEL_DIR", str(DEFAULT_MODEL_DIR))).resolve()

app = FastAPI(title="Reclaimit Lost-and-Found Matcher", version="1.0.0")
matcher: Optional[LostFoundMatcher] = None


class ScoreRequest(BaseModel):
    sourceItem: Dict[str, Any]
    candidates: List[Dict[str, Any]] = Field(default_factory=list)


class ScoreResult(BaseModel):
    candidateId: str
    matchScore: float
    confidence: float


@app.on_event("startup")
def load_model() -> None:
    global matcher

    if not MODEL_DIR.exists():
        raise RuntimeError(f"Matcher model directory does not exist: {MODEL_DIR}")

    matcher = LostFoundMatcher(str(MODEL_DIR))


@app.get("/health")
def health() -> Dict[str, Any]:
    return {
        "ok": matcher is not None,
        "modelDir": str(MODEL_DIR),
    }


@app.post("/score", response_model=List[ScoreResult])
def score_matches(payload: ScoreRequest) -> List[ScoreResult]:
    if matcher is None:
        raise HTTPException(status_code=503, detail="Matcher model is not loaded")

    if not payload.sourceItem:
        raise HTTPException(status_code=400, detail="sourceItem is required")

    if not payload.candidates:
        return []

    scores = matcher.score_candidates(payload.sourceItem, payload.candidates)
    return [
        ScoreResult(
            candidateId=row["candidateId"],
            matchScore=row["matchScore"],
            confidence=score_to_confidence(row["matchScore"]),
        )
        for row in scores
    ]


def score_to_confidence(match_score: float) -> float:
    distance_from_middle = abs(float(match_score) - 50.0) / 50.0
    return round(min(0.99, 0.5 + distance_from_middle * 0.49), 2)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("matcher_api:app", host="0.0.0.0", port=8000, reload=False)
