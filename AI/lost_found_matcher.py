import json
import math
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional


def haversine_km(left: Dict[str, Any], right: Dict[str, Any]) -> Optional[float]:
    left_loc = left.get("location") or {}
    right_loc = right.get("location") or {}
    lat1 = left_loc.get("lat")
    lng1 = left_loc.get("lng")
    lat2 = right_loc.get("lat")
    lng2 = right_loc.get("lng")

    if None in (lat1, lng1, lat2, lng2):
        return None

    radius_km = 6371.0
    dlat = math.radians(float(lat2) - float(lat1))
    dlng = math.radians(float(lng2) - float(lng1))
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(float(lat1)))
        * math.cos(math.radians(float(lat2)))
        * math.sin(dlng / 2) ** 2
    )
    return 2 * radius_km * math.asin(math.sqrt(a))


def _coerce_app_item(item: Dict[str, Any]) -> Dict[str, Any]:
    """Accept both synthetic dataset rows and backend Item model shaped objects."""
    location = item.get("location") or {}
    raw_coordinates = location.get("coordinates") or []
    coordinates = (
        raw_coordinates.get("coordinates") or []
        if isinstance(raw_coordinates, dict)
        else raw_coordinates
    )
    lng = coordinates[0] if len(coordinates) >= 2 else location.get("lng")
    lat = coordinates[1] if len(coordinates) >= 2 else location.get("lat")

    return {
        "id": str(item.get("_id") or item.get("id") or item.get("itemId") or item.get("candidateId") or ""),
        "type": item.get("type"),
        "title": item.get("title") or item.get("itemName") or item.get("name") or "",
        "description": item.get("description") or "",
        "category": item.get("category") or "",
        "color": item.get("color") or "",
        "brand": item.get("brand") if "brand" in item else item.get("brandName"),
        "location": {"lat": lat, "lng": lng},
        "dateReported": item.get("dateReported") or item.get("dateTime") or "",
        "locationName": location.get("name") or "",
    }


def item_to_match_text(
    item: Dict[str, Any],
    *,
    other_item: Optional[Dict[str, Any]] = None,
) -> str:
    normalized = _coerce_app_item(item)
    parts = [
        f"type: {normalized['type'] or 'unknown'}",
        f"title: {normalized['title']}",
        f"description: {normalized['description']}",
        f"category: {normalized['category']}",
        f"color: {normalized['color']}",
        f"brand: {normalized['brand'] or 'unknown'}",
        f"date: {normalized['dateReported']}",
    ]

    if normalized["locationName"]:
        parts.append(f"place: {normalized['locationName']}")

    lat = normalized["location"].get("lat")
    lng = normalized["location"].get("lng")
    if lat is not None and lng is not None:
        parts.append(f"coordinates: {float(lat):.4f}, {float(lng):.4f}")

    if other_item is not None:
        other = _coerce_app_item(other_item)
        distance = haversine_km(normalized, other)
        if distance is not None:
            parts.append(f"distance_to_other_item_km: {distance:.2f}")

    return " | ".join(str(part).strip() for part in parts if str(part).strip())


class LostFoundMatcher:
    def __init__(self, model_dir: str):
        from sentence_transformers import CrossEncoder

        self.model_dir = Path(model_dir)
        self.model = CrossEncoder(str(self.model_dir))
        metadata_path = self.model_dir / "matcher_metadata.json"
        self.metadata = (
            json.loads(metadata_path.read_text(encoding="utf-8"))
            if metadata_path.exists()
            else {}
        )

    def score_pair(self, source_item: Dict[str, Any], candidate_item: Dict[str, Any]) -> float:
        source_text = item_to_match_text(source_item, other_item=candidate_item)
        candidate_text = item_to_match_text(candidate_item, other_item=source_item)
        raw_score = float(self.model.predict([(source_text, candidate_text)])[0])

        if raw_score < 0 or raw_score > 1:
            raw_score = 1 / (1 + math.exp(-raw_score))

        return round(max(0.0, min(1.0, raw_score)) * 100, 2)

    def score_candidates(
        self,
        source_item: Dict[str, Any],
        candidate_items: Iterable[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        candidates = list(candidate_items)
        if not candidates:
            return []

        sentence_pairs = [
            (
                item_to_match_text(source_item, other_item=candidate),
                item_to_match_text(candidate, other_item=source_item),
            )
            for candidate in candidates
        ]
        raw_scores = self.model.predict(sentence_pairs)
        results = []

        for candidate, raw_score in zip(candidates, raw_scores):
            score = float(raw_score)
            if score < 0 or score > 1:
                score = 1 / (1 + math.exp(-score))

            candidate_id = str(
                candidate.get("_id")
                or candidate.get("id")
                or candidate.get("itemId")
                or candidate.get("candidateId")
            )
            results.append(
                {
                    "candidateId": candidate_id,
                    "matchScore": round(max(0.0, min(1.0, score)) * 100, 2),
                }
            )

        results.sort(key=lambda row: row["matchScore"], reverse=True)
        return results
