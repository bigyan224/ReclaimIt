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
  try {
    const { fullName, agreedToTerms } = req.body;
    const clerkUserId = req.clerkUserId;

    const clerkUser = await clerkClient.users.getUser(clerkUserId);

    let user = await User.findOne({ clerkId: clerkUserId });

    if (!user) {
      user = await User.create({
        clerkId: clerkUserId,
        email: clerkUser.emailAddresses[0].emailAddress,
        name:
          fullName ||
          `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim(),
        agreedToTerms: !!agreedToTerms,
        agreedToTermsAt: agreedToTerms ? new Date() : null,
      });
    } else if (fullName && !user.name) {
      user.name = fullName;
      await user.save();
    }

    res.status(200).json(user);
  } catch (error) {
    log.error("User sync error:", error);
    res.status(500).json({ error: "Failed to sync user" });
  }
});

/**
 * GET /api/users/me
 * Returns current user info
 */
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findOne({ clerkId: req.clerkUserId });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (error) {
    log.error("Get user error:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

/**
 * PATCH /api/users/me/terms
 * Accept terms of service
 */
router.patch("/me/terms", requireAuth, async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
      { clerkId: req.clerkUserId },
      { agreedToTerms: true, agreedToTermsAt: new Date() },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (error) {
    log.error("Accept terms error:", error);
    res.status(500).json({ error: "Failed to accept terms" });
  }
});

export default router;
