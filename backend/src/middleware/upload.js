import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createLogger } from "../config/logger.js";

const log = createLogger("upload");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create temp directory for file processing
const tempDir = path.join(process.cwd(), "temp");
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Local disk storage for metadata extraction
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  },
});

// Cloudinary storage for direct uploads (legacy/fallback)
const tempStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "reclaimit/temp",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 800, height: 800, crop: "limit" }],
  },
});

// Permanent storage folder setup
const permanentStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "reclaimit/items",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 800, height: 800, crop: "limit" }],
  },
});

export const uploadTemp = multer({
  storage: diskStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, JPG, PNG, and WEBP are allowed."));
    }
  },
});

export const uploadPermanent = multer({
  storage: permanentStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, JPG, PNG, and WEBP are allowed."));
    }
  },
});

// Helper function to upload to Cloudinary
export const uploadToCloudinary = async (filePath, folder = "reclaimit/temp") => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: folder,
      allowed_formats: ["jpg", "jpeg", "png", "webp"],
      transformation: [{ width: 800, height: 800, crop: "limit" }],
    });
    return result;
  } catch (error) {
    log.error("Error uploading to Cloudinary", error);
    throw error;
  }
};

// Helper function to cleanup local file
export const cleanupLocalFile = (filePath) => {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

// Default export for backward compatibility
export default uploadPermanent;
