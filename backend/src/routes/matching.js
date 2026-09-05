import express from "express";
import { findMatches, getMyItemMatches, getMyMatchesCount, getMatchedItemByItems, getMatchedItemById } from "../controllers/matching.js";
import { requestClaim, confirmClaim, cancelClaim } from "../controllers/claim.js";
import { requireAuth } from "../middleware/clerkAuth.js";
import { matchesLimiter } from "../middleware/rateLimit.js";

const router = express.Router();

// IMPORTANT: Specific routes MUST come before parameterized routes
// Otherwise Express will match "find" as an itemId

// NOTE: matchesLimiter sits AFTER requireAuth so buckets key by user id,
// not by shared campus-NAT IP. Every hit here can trigger a Gemini call.

// GET /api/matches/my/count - DB count only, no Gemini (for profile stats)
router.get("/my/count", requireAuth, matchesLimiter, getMyMatchesCount);

// GET /api/matches/my/items - Live re-scoring via Gemini (expensive, rate-limited)
router.get("/my/items", requireAuth, matchesLimiter, getMyItemMatches);

// GET /api/matches/find - Get matched item by two item IDs
router.get("/find", requireAuth, matchesLimiter, getMatchedItemByItems);

// GET /api/matches/detail/:id - Get a single matched item by its _id
router.get("/detail/:id", requireAuth, matchesLimiter, getMatchedItemById);

// Claim routes
router.post("/:matchedItemId/claim", requireAuth, matchesLimiter, requestClaim);
router.post("/:matchedItemId/confirm", requireAuth, matchesLimiter, confirmClaim);
router.post("/:matchedItemId/cancel-claim", requireAuth, matchesLimiter, cancelClaim);

// GET /api/matches/:itemId - Find matches for a specific item (auth required: triggers Gemini)
router.get("/:itemId", requireAuth, matchesLimiter, findMatches);

export default router;
