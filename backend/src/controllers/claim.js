import mongoose from "mongoose";
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

const emitClaimToChatRoom = (req, matchedItem) => {
  const io = req.app.get("io");
  if (!io || !matchedItem?.matchedItem) return;
  // Find chat for this matchedItem
  Chat.findOne({ matchedItem: matchedItem._id }).then((chat) => {
    if (!chat) return;
    io.to(`chat:${chat._id}`).emit("claim:updated", {
      matchedItemId: String(matchedItem._id),
      claim: matchedItem.claim,
      status: matchedItem.status,
    });
  }).catch(() => {});
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

    // Block if either item already claimed
    const sourceStatus = matchedItem.sourceItem?.status;
    const targetStatus = matchedItem.matchedItem?.status;
    if (sourceStatus === "CLAIMED" || targetStatus === "CLAIMED") {
      return res.status(409).json({ success: false, message: "Item already claimed" });
    }

    const userId = String(user._id);
    const isParticipant =
      String(matchedItem.sourceUser) === userId || String(matchedItem.matchedUser) === userId;
    if (!isParticipant) return res.status(403).json({ success: false, message: "Not a participant" });

    matchedItem.claim.status = "REQUESTED";
    matchedItem.claim.requestedBy = String(user._id);
    matchedItem.claim.confirmedBy = null;
    matchedItem.claim.confirmedAt = null;
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

    emitClaimToChatRoom(req, matchedItem);

    res.json({ success: true, matchedItem });
  } catch (error) {
    console.error("Request claim error:", error);
    res.status(500).json({ success: false, message: "Failed to request claim" });
  }
};

export const confirmClaim = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { matchedItemId } = req.params;
    const user = await getOrCreateUser(req.clerkUserId);
    if (!user) {
      await session.abortTransaction();
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const matchedItem = await MatchedItem.findById(matchedItemId).session(session);
    if (!matchedItem) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: "Match not found" });
    }

    ensureClaim(matchedItem);

    if (matchedItem.claim.status !== "REQUESTED") {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: "No pending claim to confirm" });
    }

    const userId = String(user._id);
    const isParticipant =
      String(matchedItem.sourceUser) === userId || String(matchedItem.matchedUser) === userId;
    if (!isParticipant) {
      await session.abortTransaction();
      return res.status(403).json({ success: false, message: "Not a participant" });
    }

    const requestedByStr = String(matchedItem.claim.requestedBy || "");
    if (requestedByStr === userId || requestedByStr === req.clerkUserId) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: "You cannot confirm your own claim request" });
    }

    const [sourceItem, matchedItemDoc] = await Promise.all([
      Item.findById(matchedItem.sourceItem).session(session),
      Item.findById(matchedItem.matchedItem).session(session),
    ]);

    if (!sourceItem || !matchedItemDoc) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: "Linked item not found" });
    }

    if (sourceItem.status === "CLAIMED" || matchedItemDoc.status === "CLAIMED") {
      await session.abortTransaction();
      return res.status(409).json({ success: false, message: "Item already claimed" });
    }

    matchedItem.claim.status = "CONFIRMED";
    matchedItem.claim.confirmedBy = String(user._id);
    matchedItem.claim.confirmedAt = new Date();
    matchedItem.status = "accepted";
    matchedItem.resolvedAt = new Date();
    matchedItem.markModified("claim");
    await matchedItem.save({ session });

    sourceItem.status = "CLAIMED";
    sourceItem.claimedBy = user._id;
    await sourceItem.save({ session });

    matchedItemDoc.status = "CLAIMED";
    matchedItemDoc.claimedBy = user._id;
    await matchedItemDoc.save({ session });

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
      { status: "rejected", resolvedAt: new Date() },
      { session }
    );

    await Notification.create([{
      user: String(matchedItem.sourceUser) === userId ? matchedItem.matchedUser : matchedItem.sourceUser,
      title: "Return confirmed",
      body: `${user.name || user.email} has confirmed the return. Item marked as claimed.`,
      type: "claim_confirmed",
      meta: { matchedItemId: matchedItem._id, chatId: req.body.chatId },
    }], { session });

    await session.commitTransaction();

    emitClaimToChatRoom(req, matchedItem);

    // Re-fetch for response
    const updated = await MatchedItem.findById(matchedItem._id);
    res.json({ success: true, matchedItem: updated });
  } catch (error) {
    await session.abortTransaction();
    console.error("Confirm claim error:", error);
    res.status(500).json({ success: false, message: "Failed to confirm claim" });
  } finally {
    session.endSession();
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

    // Only requester or the other participant can cancel a pending request (either side)
    matchedItem.claim.status = "NONE";
    matchedItem.claim.requestedBy = null;
    matchedItem.claim.confirmedBy = null;
    matchedItem.claim.confirmedAt = null;
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

    emitClaimToChatRoom(req, matchedItem);

    res.json({ success: true, matchedItem });
  } catch (error) {
    console.error("Cancel claim error:", error);
    res.status(500).json({ success: false, message: "Failed to cancel claim" });
  }
};
