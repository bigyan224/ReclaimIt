import express from "express";
import { reportItem, getItems, getItemById, updateItem, deleteItem } from "../controllers/items.js";
import { requireAuth } from "../middleware/clerkAuth.js";

const router = express.Router();

const logRequest = (req, res, next) => {
  console.log("Handling report item request");
  next();
};

router.post("/report", logRequest, requireAuth, reportItem);
router.get("/", requireAuth, getItems);
router.get("/:id", requireAuth, getItemById);
router.put("/:id", requireAuth, updateItem);
router.delete('/:id', requireAuth, deleteItem);

export default router;
