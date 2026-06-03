const MATCHER_API_URL = process.env.MATCHER_API_URL || "http://127.0.0.1:8000/score";
const MATCHER_API_TIMEOUT_MS = Number(process.env.MATCHER_API_TIMEOUT_MS || 30000);

function toIsoDate(value) {
  if (!value) return null;

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function normalizeItemForMatcher(item, { candidateId = null } = {}) {
  const coordinates = item?.location?.coordinates?.coordinates || null;

  return {
    itemId: String(item?._id || item?.id || ""),
    candidateId: candidateId ? String(candidateId) : undefined,
    type: item?.type || null,
    itemName: item?.itemName || "",
    description: item?.description || "",
    category: item?.category || "",
    color: item?.color || "",
    brandName: item?.brandName || "",
    dateTime: toIsoDate(item?.dateTime),
    location: {
      name: item?.location?.name || "",
      coordinates: Array.isArray(coordinates) ? coordinates : null,
    },
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export async function scoreCandidatesWithLocalMatcher({ sourceItem, candidates }) {
  if (!sourceItem?._id) {
    throw new Error("Invalid source item for local matcher scoring");
  }

  if (!Array.isArray(candidates) || candidates.length === 0) {
    return [];
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MATCHER_API_TIMEOUT_MS);

  const payload = {
    sourceItem: normalizeItemForMatcher(sourceItem),
    candidates: candidates.map(({ item }) =>
      normalizeItemForMatcher(item, { candidateId: item?._id })
    ),
  };

  try {
    const response = await fetch(MATCHER_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Local matcher request failed (${response.status}): ${details.slice(0, 500)}`);
    }

    const rawScores = await response.json();
    if (!Array.isArray(rawScores)) {
      throw new Error("Local matcher response must be an array");
    }

    return rawScores
      .filter((entry) => entry?.candidateId)
      .map((entry) => {
        const matchScore = Number(entry.matchScore);
        const confidence = Number(entry.confidence);

        return {
          candidateId: String(entry.candidateId),
          matchScore: Number.isFinite(matchScore) ? clamp(matchScore, 0, 100) : 0,
          confidence: Number.isFinite(confidence) ? clamp(confidence, 0, 1) : 0,
          reasoning: ["Scored by local trained matcher model"],
          provider: "local-python-matcher",
        };
      });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`Local matcher request timed out after ${MATCHER_API_TIMEOUT_MS}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
