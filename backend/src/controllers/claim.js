import MatchedItem from "../models/matchedItem.model.js";
import Item from "../models/item.model.js";
import Chat from "../models/chat.model.js";
import Notification from "../models/notification.model.js";
import { getOrCreateUser } from "../utils/userSync.js";

const ensureClaim = (matchedItem) => {
  if (!matchedItem.claim) {
    matchedItem.claim = { status: "NONE", requestedBy: null, confirmedBy: null, confirmedAt: null };
  }
};

export const requestClaim = async (req, res) => {
  try {
    const { matchedItemId } = req.params;
    const user = await getOrCreateUser(req.clerkUserId);
    if (!user) return res.status(401).json({ success: false, message: "Unauthorized" });

    const matchedItem = await MatchedItem.findById(matchedItemId).populate("sourceItem matchedItem");
    if (!matchedItem) return res.status(404).json({ success: false, message: "Match not found" });

    ensureClaim(matchedItem);

    if (matchedItem.claim.status !== "NONE") {
      return res.status(400).json({ success: false, message: "Claim already in progress" });
    }

    const userId = String(user._id);
    const isParticipant =
      String(matchedItem.sourceUser) === userId || String(matchedItem.matchedUser) === userId;
    if (!isParticipant) return res.status(403).json({ success: false, message: "Not a participant" });

    matchedItem.claim.status = "REQUESTED";
    matchedItem.claim.requestedBy = req.clerkUserId;
    matchedItem.markModified("claim");
    await matchedItem.save();

    const otherUserId =
      String(matchedItem.sourceUser) === userId ? matchedItem.matchedUser : matchedItem.sourceUser;

    await Notification.create({
      user: otherUserId,
      title: "Return requested",
      body: `${user.name || user.email} has marked the item as returned. Please confirm.`,
      type: "claim_requested",
      meta: { matchedItemId: matchedItem._id, chatId: req.body.chatId },
    });

    res.json({ success: true, matchedItem });
  } catch (error) {
    console.error("Request claim error:", error);
    res.status(500).json({ success: false, message: "Failed to request claim" });
  }
};

export const confirmClaim = async (req, res) => {
  try {
    const { matchedItemId } = req.params;
    const user = await getOrCreateUser(req.clerkUserId);
    if (!user) return res.status(401).json({ success: false, message: "Unauthorized" });

    const matchedItem = await MatchedItem.findById(matchedItemId);
    if (!matchedItem) return res.status(404).json({ success: false, message: "Match not found" });

    ensureClaim(matchedItem);

    if (matchedItem.claim.status !== "REQUESTED") {
      return res.status(400).json({ success: false, message: "No pending claim to confirm" });
    }

    const userId = String(user._id);
    const isParticipant =
      String(matchedItem.sourceUser) === userId || String(matchedItem.matchedUser) === userId;
    if (!isParticipant) return res.status(403).json({ success: false, message: "Not a participant" });

    if (matchedItem.claim.requestedBy === req.clerkUserId) {
      return res.status(400).json({ success: false, message: "You cannot confirm your own claim request" });
    }

    matchedItem.claim.status = "CONFIRMED";
    matchedItem.claim.confirmedBy = req.clerkUserId;
    matchedItem.claim.confirmedAt = new Date();
    matchedItem.status = "accepted";
    matchedItem.resolvedAt = new Date();
    matchedItem.markModified("claim");
    await matchedItem.save();

    const [sourceItem, matchedItemDoc] = await Promise.all([
      Item.findById(matchedItem.sourceItem),
      Item.findById(matchedItem.matchedItem),
    ]);

    if (sourceItem) {
      sourceItem.status = "CLAIMED";
      sourceItem.claimedBy = user._id;
      await sourceItem.save();
    }
    if (matchedItemDoc) {
      matchedItemDoc.status = "CLAIMED";
      matchedItemDoc.claimedBy = user._id;
      await matchedItemDoc.save();
    }

    // Close all other matches for both items
    await MatchedItem.updateMany(
      {
        _id: { $ne: matchedItem._id },
        $or: [
          { sourceItem: matchedItem.sourceItem },
          { matchedItem: matchedItem.sourceItem },
          { sourceItem: matchedItem.matchedItem },
          { matchedItem: matchedItem.matchedItem },
        ],
        "claim.status": { $ne: "CONFIRMED" },
      },
      { status: "rejected", resolvedAt: new Date() }
    );

    const otherUserId =
      String(matchedItem.sourceUser) === userId ? matchedItem.matchedUser : matchedItem.sourceUser;

    await Notification.create({
      user: otherUserId,
      title: "Return confirmed",
      body: `${user.name || user.email} has confirmed the return. Item marked as claimed.`,
      type: "claim_confirmed",
      meta: { matchedItemId: matchedItem._id, chatId: req.body.chatId },
    });

    res.json({ success: true, matchedItem });
  } catch (error) {
    console.error("Confirm claim error:", error);
    res.status(500).json({ success: false, message: "Failed to confirm claim" });
  }
};

export const cancelClaim = async (req, res) => {
  try {
    const { matchedItemId } = req.params;
    const user = await getOrCreateUser(req.clerkUserId);
    if (!user) return res.status(401).json({ success: false, message: "Unauthorized" });

    const matchedItem = await MatchedItem.findById(matchedItemId);
    if (!matchedItem) return res.status(404).json({ success: false, message: "Match not found" });

    ensureClaim(matchedItem);

    if (matchedItem.claim.status === "NONE") {
      return res.status(400).json({ success: false, message: "No claim to cancel" });
    }
    if (matchedItem.claim.status === "CONFIRMED") {
      return res.status(400).json({ success: false, message: "Cannot cancel a confirmed claim" });
    }

    const userId = String(user._id);
    const isParticipant =
      String(matchedItem.sourceUser) === userId || String(matchedItem.matchedUser) === userId;
    if (!isParticipant) return res.status(403).json({ success: false, message: "Not a participant" });

    matchedItem.claim.status = "NONE";
    matchedItem.claim.requestedBy = null;
    matchedItem.markModified("claim");
    await matchedItem.save();

    const otherUserId =
      String(matchedItem.sourceUser) === userId ? matchedItem.matchedUser : matchedItem.sourceUser;

    await Notification.create({
      user: otherUserId,
      title: "Return cancelled",
      body: `${user.name || user.email} has cancelled the return request.`,
      type: "claim_cancelled",
      meta: { matchedItemId: matchedItem._id, chatId: req.body.chatId },
    });

    res.json({ success: true, matchedItem });
  } catch (error) {
    console.error("Cancel claim error:", error);
    res.status(500).json({ success: false, message: "Failed to cancel claim" });
  }
};
