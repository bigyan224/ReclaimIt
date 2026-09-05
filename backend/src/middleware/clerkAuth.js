import { verifyToken } from "@clerk/clerk-sdk-node";
import User from "../models/user.model.js";
import { createLogger } from "../config/logger.js";

const log = createLogger("auth");

const CLERK_CLOCK_SKEW_MS = Number(process.env.CLERK_CLOCK_SKEW_MS || 5 * 60 * 1000);

export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];

    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
      clockSkewInMs: CLERK_CLOCK_SKEW_MS,
    });

    // Check if the user is banned in the local database
    const localUser = await User.findOne({ clerkId: payload.sub });
    if (localUser && localUser.status === "BANNED") {
      return res.status(403).json({ error: "Your account is banned. Access denied." });
    }

    req.clerkUserId = payload.sub; // 🔑 Clerk user id
    next();
  } catch (error) {
    log.debug("Auth rejected", error);
    res.status(401).json({ error: "Invalid or expired token" });
  }
};
