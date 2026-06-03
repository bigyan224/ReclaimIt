const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeItem(item, { distanceKm = null } = {}) {
  const normalized = {
    type: item?.type || null,
    itemName: item?.itemName || null,
    description: item?.description || null,
    category: item?.category || null,
    color: item?.color || null,
    brandName: item?.brandName || null,
    location: {
      name: item?.location?.name || null,
      coordinates: item?.location?.coordinates?.coordinates || null,
    },
    dateTime: item?.dateTime ? new Date(item.dateTime).toISOString() : null,
  };

  if (typeof distanceKm === "number") {
    normalized.distanceKm = Number(distanceKm.toFixed(2));
  }

  return normalized;
}

function extractResponseText(apiResponse) {
  const parts = apiResponse?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join("\n")
    .trim();
}

function parseJsonFromText(text) {
  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

  try {
    return JSON.parse(text);
  } catch {
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");

    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const maybeJson = text.slice(firstBrace, lastBrace + 1);
      return JSON.parse(maybeJson);
    }

    throw new Error("Gemini response is not valid JSON");
  }
}

export async function scoreCandidatesWithGemini({ sourceItem, candidates }) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY environment variable");
  }

  if (!sourceItem?._id) {
    throw new Error("Invalid source item for Gemini scoring");
  }

  if (!Array.isArray(candidates) || candidates.length === 0) {
    return [];
  }

  const requestPayload = {
    system_instruction: {
      parts: [
        {
          text: [
            "You are an item matching engine for a lost-and-found application.",
            "You will receive one source item and multiple candidate items.",
            "Return JSON only. No markdown, no code fences, no extra keys.",
            "Score each candidate from 0 to 100 where 100 means almost certainly the same physical item.",
            "Use all available details: name, description, category, color, brand, type consistency, date/time proximity, and location proximity.",
            "Do not skip candidates. Return one score object for every candidateId provided."
          ].join(" "),
        },
      ],
    },
    contents: [
      {
        role: "user",
        parts: [
          {
            text: JSON.stringify(
              {
                task: "Score match probability for each candidate item.",
                outputContract: {
                  scores: [
                    {
                      candidateId: "string",
                      matchScore: "number 0..100",
                      confidence: "number 0..1",
                      reasoning: ["short reason string"],
                    },
                  ],
                },
                sourceItem: {
                  sourceItemId: String(sourceItem._id),
                  ...normalizeItem(sourceItem),
                },
                candidates: candidates.map(({ item, distanceKm }) => ({
                  candidateId: String(item._id),
                  ...normalizeItem(item, { distanceKm }),
                })),
              },
              null,
              2
            ),
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
    },
  };

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    GEMINI_MODEL
  )}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestPayload),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Gemini API request failed (${response.status}): ${details.slice(0, 500)}`);
  }

  const apiResponse = await response.json();
  const text = extractResponseText(apiResponse);
  const parsed = parseJsonFromText(text);
  const rawScores = Array.isArray(parsed?.scores) ? parsed.scores : [];

  const byCandidateId = new Map(
    rawScores
      .filter((entry) => entry?.candidateId)
      .map((entry) => {
        const candidateId = String(entry.candidateId);
        const rawScore = Number(entry.matchScore);
        const rawConfidence = Number(entry.confidence);

        return [
          candidateId,
          {
            candidateId,
            matchScore: Number.isFinite(rawScore) ? clamp(rawScore, 0, 100) : 0,
            confidence: Number.isFinite(rawConfidence) ? clamp(rawConfidence, 0, 1) : 0,
            reasoning: Array.isArray(entry.reasoning)
              ? entry.reasoning.filter((r) => typeof r === "string").slice(0, 5)
              : [],
          },
        ];
      })
  );

  return candidates.map(({ item }) => {
    const candidateId = String(item._id);
    const matched = byCandidateId.get(candidateId);

    if (matched) {
      return {
        ...matched,
        matchScore: Math.round(matched.matchScore * 100) / 100,
        confidence: Math.round(matched.confidence * 100) / 100,
      };
    }

    return {
      candidateId,
      matchScore: 0,
      confidence: 0,
      reasoning: ["No score returned by Gemini for this candidate"],
    };
  });
}
