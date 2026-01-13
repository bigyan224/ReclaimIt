import express from "express";
import User from "../models/user.model.js";
import { requireAuth } from "../middleware/clerkAuth.js";
import { clerkClient } from "@clerk/clerk-sdk-node";

const router = express.Router();

/**
 * POST /api/users
 * Creates user in Mongo if not exists
 */
router.post("/", requireAuth, async (req, res) => {
    console.log("🔥 /api/users hit");
  console.log("Auth header:", req.headers.authorization?.slice(0, 20));
  try {
    const { fullName } = req.body;
    const clerkUserId = req.clerkUserId;

    // Get user from Clerk (secure source)
    const clerkUser = await clerkClient.users.getUser(clerkUserId);

    let user = await User.findOne({ clerkId: clerkUserId });

    if (!user) {
      user = await User.create({
        clerkId: clerkUserId,
        email: clerkUser.emailAddresses[0].emailAddress,
        name:
          fullName ||
          `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim(),
      });
    } else if (fullName && !user.name) {
      user.name = fullName;
      await user.save();
    }

    res.status(200).json(user);
  } catch (error) {
    console.error("User sync error:", error);
    res.status(500).json({ error: "Failed to sync user" });
  }
});

export default router;
