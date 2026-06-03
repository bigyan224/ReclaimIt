import { verifyToken } from "@clerk/clerk-sdk-node";

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

    req.clerkUserId = payload.sub; // 🔑 Clerk user id
    next();
  } catch (error) {
    console.error("Auth error:", error);
    res.status(401).json({ error: "Invalid or expired token" });
  }
};
