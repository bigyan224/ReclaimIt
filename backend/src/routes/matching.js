import express from "express";
import { findMatches, getMyItemMatches, getMyMatchesCount, getMatchedItemByItems, getMatchedItemById } from "../controllers/matching.js";
import { requestClaim, confirmClaim, cancelClaim } from "../controllers/claim.js";
import { requireAuth } from "../middleware/clerkAuth.js";

const router = express.Router();

// IMPORTANT: Specific routes MUST come before parameterized routes
// Otherwise Express will match "find" as an itemId

// GET /api/matches/my/count - DB count only, no Gemini (for profile stats)
router.get("/my/count", requireAuth, getMyMatchesCount);

// GET /api/matches/my/items - Live re-scoring via Gemini (expensive, rate-limited)
router.get("/my/items", requireAuth, getMyItemMatches);

// GET /api/matches/find - Get matched item by two item IDs
router.get("/find", requireAuth, getMatchedItemByItems);

// GET /api/matches/detail/:id - Get a single matched item by its _id
router.get("/detail/:id", requireAuth, getMatchedItemById);

// Claim routes
router.post("/:matchedItemId/claim", requireAuth, requestClaim);
router.post("/:matchedItemId/confirm", requireAuth, confirmClaim);
router.post("/:matchedItemId/cancel-claim", requireAuth, cancelClaim);

// GET /api/matches/:itemId - Find matches for a specific item
router.get("/:itemId", findMatches);

export default router;
