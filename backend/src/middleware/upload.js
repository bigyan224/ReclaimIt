import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";

// Temp storage - images uploaded here before form submission
const tempStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "reclaimit/temp",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 800, height: 800, crop: "limit" }],
  },
});

// Permanent storage - for direct uploads (legacy)
const permanentStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "reclaimit/items",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 800, height: 800, crop: "limit" }],
  },
});

export const uploadTemp = multer({
  storage: tempStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

export const uploadPermanent = multer({
  storage: permanentStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// Default export for backward compatibility
export default uploadPermanent;
