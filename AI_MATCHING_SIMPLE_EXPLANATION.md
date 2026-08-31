# AI Matching System — Simple Explanation

## 1. The Big Picture: What Happens When Someone Reports a Lost or Found Item?

Imagine you lose your phone and report it on the app. Here's what happens behind the scenes:

1. Your report gets saved to the database.
2. The app automatically looks for the opposite type of report nearby (if you lost something, it searches for found items).
3. It finds all items within 20km.
4. It scores each potential match using AI (Google Gemini).
5. If the score is high enough, both users get notified.
6. If someone opens the match, a chat starts so they can coordinate.

---

## 2. The AI Used: Google Gemini (Cloud)

### What is it?
- **Name:** `gemini-2.5-flash`
- **Type:** Large language model (like ChatGPT)
- **Runs on:** Google's servers (cloud)
- **Needs:** Internet connection and API key

### How it works:
Gemini receives the source item plus each nearby candidate and is told:
> "Score each candidate from 0 to 100 where 100 means almost certainly the same physical item."

It uses its broad world knowledge to understand descriptions — for example, knowing that "iPhone" and "Apple phone" are the same thing, or that "cafe" and "coffee shop" are the same place.

### Pros and Cons:
- **Pros:** Very smart, understands nuanced language, no training or model-hosting needed
- **Cons:** Costs money per use, needs internet, slower (1-2 seconds)

---

## 3. How Items Are Prepared for the AI

Before Gemini can compare two items, they are converted into a normalized format:

```
type: LOST
title: Black Samsung Galaxy S24
description: Lost near the cafe counter
category: electronics
color: black
brand: samsung
date: 2026-05-25
place: Durbar Marg, Kathmandu
coordinates: 27.7120, 85.3168
distance_km_to_source: 1.34
```

Both items are turned into this format, then sent to Gemini together.

---

## 4. The Rule-Based Fallback (No AI)

If Gemini is unavailable (no API key, API outage, no internet), the system uses simple deterministic rules:

| Factor | Points | How it's calculated |
|--------|--------|-------------------|
| Name similarity | 30 | Count matching words |
| Description similarity | 20 | Count matching words |
| Same category | 15 | Exact match |
| Same color | 15 | Exact match |
| Same brand | 10 | Exact match |
| Time proximity | 5 | How close in time |
| Distance proximity | 5 | How close in location |
| **Total** | **100** | |

### Example of Jaccard Similarity (Name Matching):
- Item A: "Black Samsung Galaxy S24" → words: {black, samsung, galaxy, s24}
- Item B: "Black Samsung Phone" → words: {black, samsung, phone}
- Matching words: {black, samsung} = 2
- Total unique words: {black, samsung, galaxy, s24, phone} = 5
- Score: 2/5 = 0.4 → 0.4 × 30 = **12 points**

The fallback can only match exact words — it cannot understand that "iPhone" and "Apple phone" are the same. That's why Gemini is the primary scorer.

---

## 5. How the Primary AI and Fallback Work Together

The default setting is `MATCH_PROVIDER=gemini`:

```
1. Try Gemini → use its 0-100 score
2. If Gemini fails → use the rule-based fallback
```

**Fallback order:**
1. Gemini works → Use Gemini scores
2. Gemini fails → Use rule-based scoring

The system never crashes or silently stops matching — if the API is down, matching just becomes less accurate until it recovers.

---

## 6. Match Scores and What They Mean

| Score | Meaning | Action |
|-------|---------|--------|
| 70-100 | Strong match | Send notification to both users |
| 50-69 | Medium match | Send notification to both users |
| 40-49 | Weak match | Save to database, no notification |
| Below 40 | No match | Discard |

---

## 7. Real Example Walkthrough

**Scenario:** You lose your phone.

1. You report: "Black Samsung Galaxy S24" (LOST) at Durbar Marg
2. System finds 50 found items within 20km
3. For each found item, it sends the pair to Gemini and gets a score
4. One item "Black Android phone" gets: **80/100**
5. Since 80 ≥ 70, it's a **strong match**
6. Both users get notified: "🎯 Strong Match Found!"
7. When someone opens it, a chat starts

---

## 8. Key Questions Your Teacher Might Ask

### Q: Why Gemini AND a rule-based fallback?
**A:** For reliability. Gemini gives the smartest matches, but it needs internet and an API key. If it fails, simple rules still keep the matching working. It's like having a backup plan.

### Q: Why not use just the rule-based system?
**A:** Rules can only match exact words. Gemini can understand that "iPhone" and "Apple phone" are the same, or that "cafe" and "coffee shop" are the same place.

### Q: Is Gemini slow or expensive?
**A:** Each call takes about 1-2 seconds and costs a small amount of money. That's acceptable because the candidate pool per report is capped (100), and only genuinely nearby items ever get scored.

### Q: Why 20km radius?
**A:** Most lost items are found near where they were lost. 20km is a good balance between finding matches and not having too many items to check.

---

## 9. Summary Table: The Two Scoring Methods

| Feature | Google Gemini | Rule-Based Fallback |
|---------|---------------|---------------------|
| **Type** | Cloud AI | Simple rules |
| **Needs Internet** | Yes | No |
| **Cost per use** | Costs money | Free |
| **Speed** | Slow (1-2 seconds) | Very fast |
| **Smartness** | Very good | Basic |
| **When it works** | When online + API key set | Always |

---

## 10. Simple Analogy for the Whole System

Imagine you're trying to match lost and found items in a lost-and-found box:

1. **The Rule-Based System** is like a person who only looks at labels: "Both say black? Both say Samsung? They match!" But they get confused if one says "phone" and the other says "mobile."

2. **Gemini** is like asking a very smart staff member who knows everything about everything. They understand context and nuance — "this is clearly the same phone" — but you need to call them (internet) to ask.

3. **The System** asks the smart staff member first. If they are unavailable, it falls back to the simple label-matching person.

This way, no matter what happens, someone is always available to help match the items!