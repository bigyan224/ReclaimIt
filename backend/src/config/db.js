import mongoose from "mongoose";
import "dotenv/config";
import { createLogger } from "./logger.js";

const log = createLogger("db");

// Database initialization function
export async function initDB() {
  try {
    const mongoURL = process.env.MONGODB_URL || "mongodb://localhost:27017/wallet-app";
    
    await mongoose.connect(mongoURL,{
      dbName: "reclaimit",
    });
    
    log.info("Connected to MongoDB");
  } catch (error) {
    log.error("Error connecting to MongoDB", error);
    process.exit(1);
  }
}
