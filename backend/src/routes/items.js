import express from "express";
import { reportItem, getItems, getMyItemsSummary, getItemById, updateItem, deleteItem } from "../controllers/items.js";
import { requireAuth } from "../middleware/clerkAuth.js";

const router = express.Router();

const logRequest = (req, res, next) => {
  next();
};

router.post("/report", logRequest, requireAuth, reportItem);
router.get("/", requireAuth, getItems);
// IMPORTANT: specific routes before ":id" or "mine" matches an itemId
router.get("/mine/summary", requireAuth, getMyItemsSummary);
router.get("/:id", requireAuth, getItemById);
router.put("/:id", requireAuth, updateItem);
router.delete('/:id', requireAuth, deleteItem);

export default router;
