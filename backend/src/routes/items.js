import express from "express";
import { reportItem, getItems, deleteItem } from "../controllers/items.js";
import { requireAuth } from "../middleware/clerkAuth.js";

const router = express.Router();

// Add a middleware function for logging
const logRequest = (req, res, next) => {
  console.log("Handling report item request");
  next();
};

// POST /api/items/report - Report a lost or found item
router.post("/report", logRequest, requireAuth, reportItem);

// GET /api/items - Get all items (for testing or listing)
router.get("/", getItems);

// DELETE /api/items/:id - Delete an item (owner only)
router.delete('/:id', requireAuth, deleteItem);

export default router;