import mongoose from "mongoose";
import "dotenv/config";

// Database initialization function
export async function initDB() {
  try {
    const mongoURL = process.env.MONGODB_URL || "mongodb://localhost:27017/wallet-app";
    
    await mongoose.connect(mongoURL,{
      dbName: "reclaimit",
    });
    
    console.log("✅ Connected to MongoDB");
  } catch (error) {
    console.error("❌ Error connecting to MongoDB:", error);
    process.exit(1);
  }
}
