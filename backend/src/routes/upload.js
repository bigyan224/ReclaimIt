import express from "express";
import { uploadTemp, uploadPermanent } from "../middleware/upload.js";
import { requireAuth } from "../middleware/clerkAuth.js";

const router = express.Router();

// Temp upload - images go to reclaimit/temp folder
// Returns both url and publicId for cleanup tracking
router.post(
  "/temp",
  requireAuth,
  uploadTemp.single("image"),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided" });
    }
    res.json({
      url: req.file.path, // Cloudinary secure URL
      publicId: req.file.filename, // Cloudinary public_id for cleanup
    });
  }
);

// Legacy route - direct permanent upload (kept for backward compatibility)
router.post(
  "/image",
  requireAuth,
  uploadPermanent.single("image"),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided" });
    }
    res.json({
      imageUrl: req.file.path, // Cloudinary URL
    });
  }
);

export default router;
