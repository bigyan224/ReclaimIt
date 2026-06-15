# AI & ML Matching System — Full Explanation

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
   │  MATCH_PROVIDER=mixed  (default)                    │
   │                                                       │
   │   ┌── Python Cross-Encoder ──┐  50% blend            │
   │   │  (local ML model)        │  of scores             │
   │   └──────────────────────────┘                        │
   │                         +                             │
   │   ┌── Google Gemini ─────────┐  50% blend            │
   │   │  (cloud AI)              │  of scores             │
   │   └──────────────────────────┘                        │
   │                                                       │
   │  If either fails → falls back to rule-based scoring   │
   │  If both fail → uses only rule-based scoring          │
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

## 2. The Python Cross-Encoder Model (Local ML Matcher)

### 2.1 What Model Is It?

| Property     | Value                                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Architecture | **Cross-Encoder (BERT-style)** with 6 transformer layers, 384 hidden dimensions, 12 attention heads                       |
| Base model   | `cross-encoder/ms-marco-MiniLM-L-6-v2` (a small, fast cross-encoder pre-trained on Microsoft's MARCO passage ranking dataset) |
| Trained on   | Our synthetic lost-and-found dataset (fine-tuned)                                                                               |
| File size    | ~91 MB (`model.safetensors`)                                                                                                  |
| Runs on      | Local Python server (FastAPI on port 8000)                                                                                      |
| Input        | Two items converted to text strings                                                                                             |
| Output       | A similarity score (0–1) → converted to 0–100                                                                                |

### 2.2 How Does the Cross-Encoder Work?

A cross-encoder takes **two texts at once** and outputs a single similarity score. Unlike a bi-encoder (which converts each text to a vector separately), the cross-encoder can attend to relationships *between* the two texts, making it more accurate but slower (it processes every pair individually).

**Step by step inference:**

```
Input: source item text + candidate item text
         │
         ▼
Both texts are concatenated and fed into BERT
         │
         ▼
BERT processes them through 6 transformer layers,
each layer computing self-attention across ALL tokens
from BOTH texts (hence "cross"-encoder)
         │
         ▼
The [CLS] token's final hidden state is passed
through a linear layer → single sigmoid score (0–1)
         │
         ▼
Score * 100 → final matchScore (0–100)
```

### 2.3 How Are Items Converted to Text?

The `item_to_match_text()` function converts each item to a pipe-separated string:

```
type: LOST | title: Black Samsung Galaxy S24 |
description: Lost near the cafe counter, cracked transparent case |
category: electronics | color: black | brand: samsung |
date: 2026-05-25T14:30:00.000Z | place: Durbar Marg, Kathmandu |
coordinates: 27.7120, 85.3168 |
distance_to_other_item_km: 1.34
```

When scoring a pair, both items are converted to this format and passed into the cross-encoder as a pair.

### 2.4 The Training Data

| Statistic             | Value                                                                 |
| --------------------- | --------------------------------------------------------------------- |
| Total items generated | **12,000** (3,000 groups × 4 reports per group)                |
| Training pairs        | **19,342** (9,671 positive + 9,671 negative, balanced)          |
| Validation pairs      | 292 (146 positive + 146 negative)                                     |
| Test pairs            | 270 (135 positive + 135 negative)                                     |
| Data origin           | **Synthetic** (generated by `generate_lost_found_dataset.py`) |
| Context               | South Asian locations (Nepal, India), 5 categories                    |

**How the synthetic data is generated:**

1. A "possible pair group" is created (e.g., "Black Samsung phone lost at Durbar Marg").
2. 4 reports are generated from that group — some LOST, some FOUND, with realistic variations in name, description, color wording.
3. **Positive pairs**: items from the SAME group → label = 1
4. **Hard-negative pairs**: items from DIFFERENT groups that share similar category, color, or are within 6km of each other → label = 0

The hard-negatives force the model to learn subtle distinguishing features instead of just memorizing categories.

### 2.5 Training Configuration

| Hyperparameter      | Value                                    |
| ------------------- | ---------------------------------------- |
| Base model          | `cross-encoder/ms-marco-MiniLM-L-6-v2` |
| Epochs              | 3                                        |
| Batch size          | 16                                       |
| Max sequence length | 256 tokens                               |
| Optimizer           | Adam (CrossEncoder default)              |
| Learning rate       | CrossEncoder default (typically 2e-5)    |
| Warmup steps        | 10% of training steps                    |
| Seed                | 20260525                                 |

### 2.6 Reported Metrics (Important Caveat)

```
Validation: accuracy=1.0, precision=1.0, recall=1.0, f1=1.0
Test:       accuracy=1.0, precision=1.0, recall=1.0, f1=1.0
```

**These metrics are unrealistically perfect.** This is because:

- The synthetic data is generated from the same script that creates the pairs — the "different group" items are very clearly different.
- Real-world items have ambiguous descriptions, similar objects, and human error in reporting.
- The model would likely score lower on real user data.

The metrics are correct for testing *whether the model learned the synthetic pattern*, but they don't predict real-world performance.

---

## 3. The Gemini AI Model (Cloud Matcher)

| Property        | Value                                                                         |
| --------------- | ----------------------------------------------------------------------------- |
| Model           | `gemini-2.5-flash` (configurable via `GEMINI_MODEL`)                      |
| API             | Google Generative Language API                                                |
| Key variable    | `GEMINI_API_KEY`                                                            |
| Temperature     | **0.1** (very low — we want deterministic scores, not creative output) |
| Response format | `responseMimeType: "application/json"`                                      |

**What the system prompt tells Gemini:**

> "You are an item matching engine for a lost-and-found application. Score each candidate from 0 to 100 where 100 means almost certainly the same physical item. Use all available details: name, description, category, color, brand, type consistency, date/time proximity, and location proximity."

Gemini receives the **same normalized data** as the Python model (source + all candidates with distances). It returns a JSON array with one score per candidate.

---

## 4. The Rule-Based Fallback (Deterministic Scoring)

This runs in `controllers/matching.js:scoreCandidatesWithRuleFallback()`. It has **zero AI/ML** — pure deterministic rules.

### 4.1 Full Weight Table

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

### 4.2 What Is Jaccard Similarity?

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

### 4.3 Confidence Formula

```
confidence = clamp(0.35 + matchScore / 200, 0.35, 0.85)
```

A score of 40 gives confidence 0.55, 70 gives 0.70, 100 gives 0.85.

---

## 5. The "Mixed" Provider — 50/50 Score Blending

When `MATCH_PROVIDER=mixed` (the default):

```
finalScore = (pythonScore × 0.5) + (geminiScore × 0.5)
```

**Why blend?**

- **Python model**: fast (local, no network), consistent, but trained on synthetic data → may miss real-world patterns
- **Gemini**: slow (API call), costs money, but has broad world knowledge and can understand nuanced descriptions
- **Blend**: each compensates for the other's weakness

**Fallback chain:**

1. If both Python and Gemini succeed → 50/50 blend
2. If only Python succeeds → use Python scores
3. If only Gemini succeeds → use Gemini scores
4. If both fail → use rule-based fallback

---

## 6. Scoring Thresholds & Notifications

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

## 7. End-to-End Example

```
User A reports: "Black Samsung Galaxy S24" (LOST)
at location: [85.3168, 27.7120] near Durbar Marg
        │
        ▼
Backend finds 50 nearby FOUND items within 20km
        │
        ▼
For each candidate, sends both to Python matcher
and Gemini (mixed mode)
        │
        ▼
Python scores "Black Android phone" at 82/100
Gemini scores it at 78/100
Blended score = (82 × 0.5) + (78 × 0.5) = 80
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

### Q1: Why did you build TWO AI models? Isn't one enough?

**Answer:** We actually built a third — the rule-based fallback makes it three. The reason is reliability.

- The **Python cross-encoder** is a small (~91 MB) model running on the same machine. It's fast (milliseconds) and costs nothing per prediction. But it was trained on synthetic data, so it may miss real-world patterns.
- **Gemini** is much larger and has broad world knowledge — it can understand descriptions like "cracked corner" or "blue SIM tray" in a human-like way. But it's slow (~1-2 seconds per call), costs money per API call, and requires internet.
- The **rule-based fallback** runs entirely on the backend server with zero external dependencies. It uses token overlap and exact field matching — primitive but always available.

If Gemini's API goes down, the system still works (Python + fallback). If the Python service crashes, Gemini + fallback still works. If both go down, the fallback alone handles matching. This makes the system resilient.

### Q2: 1.0 accuracy on the test set — is that realistic?

**Answer:** No, it's misleading and I would not claim 1.0 accuracy in production. The test data is synthetic — generated by the same script that creates the training pairs. Positive pairs come from the same generation group and are obviously related; negative pairs come from different groups. Real-world items won't be that cleanly separable.

A student might report "Black iPhone 15" while another reports "black iphone fifteen" — exact token matching would fail. A cross-encoder might handle it better, but it wouldn't hit 100%.

In practice, this model would need to be retrained on real user-reported items after launch to get meaningful metrics. The 1.0 is a sanity check that the model learned *something* from the synthetic data, not a guarantee of production performance.

### Q3: Why use a Cross-Encoder instead of a Bi-Encoder?

**Answer:** Cross-encoders are more accurate for pairwise comparison.

- **Bi-encoder**: converts each item to a fixed vector independently. When a new item comes in, we'd need to precompute vectors for ALL existing items and compare them. This is fast at search time (cosine similarity between vectors) but loses information because each item is encoded in isolation.
- **Cross-encoder**: takes both items as a single input. Attention layers can directly compare "Black Samsung" in one item against "Black Samsung" in the other. This is more accurate but slower — you have to run the model for every pair.

In our app, when a new item is reported, we find up to 100 candidates and score each pair individually. A cross-encoder is the right choice here because the candidate pool is small (100) and accuracy matters more than raw speed.

A bi-encoder would make sense if we had 100,000+ items and needed fast real-time search, but then we'd sacrifice match quality.

### Q4: Why 20km radius? Why not search the whole city?

**Answer:** 20km is chosen based on the app's use case. Lost items in a lost-and-found context are typically found near where they were lost. A phone lost at a campus cafe is likely found within the campus or nearby, not 50km away.

From a technical perspective, the `$near` geospatial query uses MongoDB's 2dsphere index, which is efficient within bounded radii. Larger radii would return more candidates, making the scoring pipeline slower (more API calls to Gemini, more cross-encoder predictions).

The 20km boundary is a pragmatic balance between:

- High probability of finding the actual match (most real matches fall within this range)
- Manageable number of candidates (cap at 100)
- Query performance (geospatial index)

This constant can be tuned per deployment — a campus deployment might use 5km while a city-wide deployment might use 50km.

### Q5: How does the rule-based fallback differ from the ML models?

**Answer:** The rule-based fallback is a **deterministic function** — given the same inputs, it always produces the same output. There is no training, no weights file, no probability distribution. It simply:

1. Tokenizes the name and description
2. Counts overlapping tokens (Jaccard similarity)
3. Checks if category/color/brand are exact string matches
4. Computes time difference and geographic distance
5. Adds up the weighted points

The ML models (Python cross-encoder and Gemini) learn **latent patterns**. They can recognize that "iPhone" and "Apple phone" refer to the same brand, or that "transparent case" and "clear cover" describe the same accessory — something the rule-based approach cannot do because it only matches exact substrings.

### Q6: How would you improve this system?

**Answer:** Several ways:

1. **Retrain on real data.** The synthetic 1.0 metrics are worthless for production. After collecting 1,000+ real user verifications (users confirming "this match is correct" or "no, that's not mine"), we'd retrain the cross-encoder on real pairs with real labels.
2. **Image similarity.** Currently matching is text-only. An item's photo could be passed through a vision model (e.g., CLIP) to generate an embedding, and visual similarity could be incorporated into the score.
3. **Per-user personalization.** If a user has reported 5 lost items previously, the model could learn their reporting style and weighting.
4. **Active learning loop.** When a user rejects a match (says "this isn't mine"), that's a labeled hard-negative example. We could periodically retrain with these real rejections.
5. **Replace the cross-encoder with a larger model.** MiniLM-L-6 is small. For GPU deployments, `BAAI/bge-reranker-base` or even a distilled DeBERTa would give better accuracy.

### Q7: What does each environment variable control in the matching pipeline?

| Variable                   | Default                         | What It Does                                                   |
| -------------------------- | ------------------------------- | -------------------------------------------------------------- |
| `MATCH_PROVIDER`         | `mixed`                       | `python`, `gemini`, or `mixed` — which scorer(s) to use |
| `GEMINI_API_KEY`         | (required)                      | API key for Google Gemini                                      |
| `GEMINI_MODEL`           | `gemini-2.5-flash`            | Which Gemini model version to use                              |
| `MATCHER_API_URL`        | `http://127.0.0.1:8000/score` | Where the Python cross-encoder service runs                    |
| `MATCHER_API_TIMEOUT_MS` | `30000`                       | How long to wait before timing out the Python service          |

### Q8: What are the MongoDB collections involved?

| Collection               | Role                                                                              |
| ------------------------ | --------------------------------------------------------------------------------- |
| `items`                | Stores user-reported lost/found items with location, category, description        |
| `matchedItems`         | Stores the result of each match: which two items, the score, strength, and status |
| `notifications`        | Stores push notification records for matched users                                |
| `chats` + `messages` | Created when users open a match to coordinate return                              |

### Q9: How does the matcher_api.py (FastAPI) convert scores?

The Python cross-encoder outputs a raw sigmoid value between 0 and 1. The `score_to_confidence()` function:

```python
def score_to_confidence(match_score):
    # 0 → 0.5, 50 → 0.745, 100 → 0.99
    midpoint = 50.0
    distance = abs(match_score - midpoint)
    return 0.5 + (distance / midpoint) * 0.49
```

And the model output is sigmoid → multiplied by 100 → clamped to [0, 100]:

```python
raw_score = model.predict([(text_a, text_b)])[0]
if raw_score < 0 or raw_score > 1:
    raw_score = 1 / (1 + math.exp(-raw_score))
final = round(max(0.0, min(1.0, raw_score)) * 100, 2)
```

### Q10: What happens if the Python matcher is down?

The system degrades gracefully:

```
If MATCH_PROVIDER=mixed and Python fails:
  → Logs: "Local matcher unavailable: <error>"
  → Only Gemini scores are used
  → If Gemini also fails → uses rule-based fallback

If MATCH_PROVIDER=python and Python fails:
  → Logs: "Python mode selected but API unavailable, falling back to rules"
  → Uses rule-based fallback entirely

No crash. No data loss. The matching just becomes less accurate.
```
