import express from "express";
import {
  uploadTemp,
  uploadPermanent,
  uploadToCloudinary,
  cleanupLocalFile,
} from "../middleware/upload.js";
import { requireAuth } from "../middleware/clerkAuth.js";
import { uploadLimiter, uploadDailyQuota } from "../middleware/rateLimit.js";

const router = express.Router();

// Temp upload: store locally → upload to Cloudinary → cleanup
router.post("/temp", requireAuth, uploadLimiter, uploadDailyQuota, uploadTemp.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided" });
    }

    const localFilePath = req.file.path;
    let cloudinaryResult = null;

    try {
      cloudinaryResult = await uploadToCloudinary(localFilePath, "reclaimit/temp");
    } finally {
      cleanupLocalFile(localFilePath);
    }

    res.json({
      success: true,
      url: cloudinaryResult.secure_url,
      publicId: cloudinaryResult.public_id,
    });
  } catch (error) {
    console.error("Error in temp upload:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process image upload",
      message: error.message,
    });
  }
});

// Legacy route - preserves original functionality without AI detection
router.post("/image", requireAuth, uploadLimiter, uploadDailyQuota, uploadPermanent.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No image file provided" });
  }
  res.json({
    imageUrl: req.file.path, // Cloudinary URL
  });
});

export default router;
