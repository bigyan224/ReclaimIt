# AI Matching System — Full Explanation

## 1. Big Picture: What Happens When a User Reports an Item?

```
User reports an item (lost/found)
        │
        ▼
1. Item is saved to MongoDB
        │
        ▼
2. `autoMatchNewItem(itemId)` fires in background
        │
        ▼
3. Query: find opposite-type items within 20km radius
   (e.g., if user posted LOST, search for FOUND items nearby)
        │
        ▼
4. Score each candidate using the configured provider(s)
   ┌─────────────────────────────────────────────────────┐
   │  MATCH_PROVIDER=gemini  (default)                   │
   │                                                     │
   │   ┌── Google Gemini ────────────────┐               │
   │   │  (cloud AI)                     │               │
   │   └─────────────────────────────────┘               │
   │                                                     │
   │  If Gemini fails → falls back to rule-based scoring │
   └─────────────────────────────────────────────────────┘
        │
        ▼
5. Scores range 0–100 for every candidate
        │
        ▼
6. Only scores >= 40 are saved as MatchedItem records
        │
        ▼
7. If score >= 50 (medium) or >= 70 (strong):
   → Push notification to BOTH users involved
   → A chat is created when someone opens the match
```

---

## 2. The Gemini AI Model (Cloud Matcher)

| Property        | Value                                                                         |
| --------------- | ----------------------------------------------------------------------------- |
| Model           | `gemini-2.5-flash` (configurable via `GEMINI_MODEL`)                      |
| API             | Google Generative Language API                                                |
| Key variable    | `GEMINI_API_KEY`                                                            |
| Temperature     | **0.1** (very low — we want deterministic scores, not creative output) |
| Response format | `responseMimeType: "application/json"`                                      |

**What the system prompt tells Gemini:**

> "You are an item matching engine for a lost-and-found application. Score each candidate from 0 to 100 where 100 means almost certainly the same physical item. Use all available details: name, description, category, color, brand, type consistency, date/time proximity, and location proximity."

Gemini receives the normalized data (source + all candidates with distances). It returns a JSON array with one score per candidate.

---

## 3. The Rule-Based Fallback (Deterministic Scoring)

This runs in `controllers/matching.js:scoreCandidatesWithRuleFallback()`. It has **zero AI/ML** — pure deterministic rules. It is used automatically whenever Gemini is unavailable (e.g., missing API key, API failure, no network).

### 3.1 Full Weight Table

| Signal                           | Max Points    | How It's Calculated                                                                                   |
| -------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------- |
| **Name similarity**        | 30            | Jaccard similarity of tokenized `itemName` × 30. e.g., if 2 of 4 tokens match → 50% → 15 points. |
| **Description similarity** | 20            | Jaccard similarity of tokenized `description` × 20.                                                |
| **Category match**         | 15            | +15 if both items have the exact same category (case-insensitive).                                    |
| **Color match**            | 15            | +15 if both items have the exact same color (case-insensitive).                                       |
| **Brand match**            | 10            | +10 if both items have the exact same brand name (case-insensitive).                                  |
| **Time proximity**         | 5             | +5 if within 24 hours, +3 within 72 hours, +1 within 1 week, else 0.                                  |
| **Distance proximity**     | 5             | +5 if ≤1km, +4 if ≤5km, +3 if ≤10km, +2 if ≤20km, else 0.                                         |
| **Total**                  | **100** | Clamped to [0, 100].                                                                                  |

### 3.2 What Is Jaccard Similarity?

```
Jaccard(A, B) = |A ∩ B| / |A ∪ B|

Example:
  Item A name: "Black Samsung Galaxy S24"
  Item B name: "Black Samsung Phone"
  
  Tokens A: {black, samsung, galaxy, s24}
  Tokens B: {black, samsung, phone}
  
  Intersection: {black, samsung} → 2
  Union: {black, samsung, galaxy, s24, phone} → 5
  
  Jaccard = 2/5 = 0.4
  Name score = 0.4 × 30 = 12 points
```

Everything is lowercased, split on non-alphanumeric characters, and empty tokens are discarded.

### 3.3 Confidence Formula

```
confidence = clamp(0.35 + matchScore / 200, 0.35, 0.85)
```

A score of 40 gives confidence 0.55, 70 gives 0.70, 100 gives 0.85.

---

## 4. Scoring Thresholds & Notifications

| Score Range | Strength Label   | Creates Notification?               |
| ----------- | ---------------- | ----------------------------------- |
| 70–100     | **Strong** | Yes — "🎯 Strong Match Found!"     |
| 50–69      | **Medium** | Yes — "✨ Possible Match Found"    |
| 40–49      | **Weak**   | No notification (still saved to DB) |
| Below 40    | None             | Completely discarded                |

**For each match saved, TWO notifications are created:**

1. To the user who reported the source item
2. To the user who owns the matched item

---

## 5. End-to-End Example

```
User A reports: "Black Samsung Galaxy S24" (LOST)
at location: [85.3168, 27.7120] near Durbar Marg
        │
        ▼
Backend finds 50 nearby FOUND items within 20km
        │
        ▼
For each candidate, sends it to Gemini
        │
        ▼
Gemini scores "Black Android phone" at 80/100
        │
        ▼
Score 80 ≥ 70 → "Strong match"
        │
        ▼
MatchedItem document saved: { sourceItem, matchedItem,
  matchScore: 80, matchStrength: "strong", ... }
        │
        ▼
Two Notifications created:
  → User A: "🎯 Strong Match Found! Your lost item
     'Black Samsung Galaxy S24' matches with 'Black
     Android phone in case' (80% match)"
  → User B (finder): same notification
        │
        ▼
Either user opens the match → chat is created →
they coordinate return
```

---

## Teacher Questions & Answers

### Q1: Why use Gemini AND a rule-based fallback? Isn't one enough?

**Answer:** The two systems play different roles.

- **Gemini** is a large cloud model with broad world knowledge — it can understand descriptions like "cracked corner" or "blue SIM tray" in a human-like way. But it's slow (~1-2 seconds per call), costs money per API call, and requires internet.
- The **rule-based fallback** runs entirely on the backend server with zero external dependencies. It uses token overlap and exact field matching — primitive but always available.

If Gemini's API goes down, or the API key is missing, the system still works via the rule-based fallback. This makes the system resilient.

### Q2: Why is matching text-only?

**Answer:** Currently matching is based on item metadata (name, description, category, color, brand, time, location). A future improvement would be **image similarity** — passing an item's photo through a vision model (e.g., CLIP) to generate an embedding and incorporate visual similarity into the score.

### Q3: Why use a cloud LLM instead of a locally-trained model?

**Answer:** A cloud LLM like Gemini has broad world knowledge, needs no training pipeline, and understands nuanced, real-world descriptions out of the box. A locally-trained model would need a large dataset of real user reports to train on, plus infrastructure to serve it. Gemini gives better results with far less operational overhead for a small app. The trade-off is per-call cost and latency, which is acceptable because the candidate pool is capped (100 items).

### Q4: Why 20km radius? Why not search the whole city?

**Answer:** 20km is chosen based on the app's use case. Lost items in a lost-and-found context are typically found near where they were lost. A phone lost at a campus cafe is likely found within the campus or nearby, not 50km away.

From a technical perspective, the `$near` geospatial query uses MongoDB's 2dsphere index, which is efficient within bounded radii. Larger radii would return more candidates, making the scoring pipeline slower (more API calls to Gemini).

The 20km boundary is a pragmatic balance between:

- High probability of finding the actual match (most real matches fall within this range)
- Manageable number of candidates (cap at 100)
- Query performance (geospatial index)

This constant can be tuned per deployment — a campus deployment might use 5km while a city-wide deployment might use 50km.

### Q5: How does the rule-based fallback differ from Gemini?

**Answer:** The rule-based fallback is a **deterministic function** — given the same inputs, it always produces the same output. There is no training, no weights file, no probability distribution. It simply:

1. Tokenizes the name and description
2. Counts overlapping tokens (Jaccard similarity)
3. Checks if category/color/brand are exact string matches
4. Computes time difference and geographic distance
5. Adds up the weighted points

Gemini learns **latent patterns**. It can recognize that "iPhone" and "Apple phone" refer to the same brand, or that "transparent case" and "clear cover" describe the same accessory — something the rule-based approach cannot do because it only matches exact substrings.

### Q6: How would you improve this system?

**Answer:** Several ways:

1. **Active learning loop.** When a user rejects a match (says "this isn't mine"), that's a labeled hard-negative example. We could use those real rejections to tune weights or craft better Gemini prompts.
2. **Image similarity.** An item's photo could be passed through a vision model (e.g., CLIP) to generate an embedding, and visual similarity could be incorporated into the score.
3. **Per-user personalization.** If a user has reported 5 lost items previously, the model could learn their reporting style and weighting.
4. **Caching / batching.** Batch multiple candidate scores into fewer Gemini calls to reduce cost and latency.

### Q7: What does each environment variable control in the matching pipeline?

| Variable           | Default              | What It Does                                          |
| ------------------ | -------------------- | ----------------------------------------------------- |
| `MATCH_PROVIDER` | `gemini`           | `gemini` — which scorer to use                       |
| `GEMINI_API_KEY` | (required for Gemini) | API key for Google Gemini                             |
| `GEMINI_MODEL`   | `gemini-2.5-flash` | Which Gemini model version to use                     |

### Q8: What are the MongoDB collections involved?

| Collection               | Role                                                                              |
| ------------------------ | --------------------------------------------------------------------------------- |
| `items`                | Stores user-reported lost/found items with location, category, description        |
| `matchedItems`         | Stores the result of each match: which two items, the score, strength, and status |
| `notifications`        | Stores push notification records for matched users                                |
| `chats` + `messages` | Created when users open a match to coordinate return                              |

### Q9: What happens if Gemini is unavailable?

The system degrades gracefully:

```
If MATCH_PROVIDER=gemini and Gemini fails:
  → Logs: "Gemini scoring unavailable: <error>"
  → Uses rule-based fallback entirely

No crash. No data loss. The matching just becomes less accurate.
```
