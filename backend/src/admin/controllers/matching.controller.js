import Item from "../../models/item.model.js";
import MatchedItem from "../../models/matchedItem.model.js";
import Notification from "../../models/notification.model.js";
import { isObjectId } from "../utils/ids.js";
import { getMatchingConfig, getMatchStrength, saveMatchingConfig } from "../utils/matchingConfig.js";
import { buildPagination, parsePagination } from "../utils/pagination.js";
import { adminInstitutionIds, itemInstitutionFilter } from "../utils/institutionFilter.js";
import { createLogger } from "../../config/logger.js";

const log = createLogger("admin-matching");

export const listMatches = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);

    let matchFilter = {};

    if (!req.isMasterAdmin && req.isInstitutionAdmin) {
      const itemFilter = itemInstitutionFilter(req);
      const instItems = await Item.find(itemFilter).select("_id").lean();
      const itemIds = instItems.map((i) => i._id);
      matchFilter = {
        $or: [{ sourceItem: { $in: itemIds } }, { matchedItem: { $in: itemIds } }],
      };
    }

    const [matches, total] = await Promise.all([
      MatchedItem.find(matchFilter)
        .populate("sourceItem")
        .populate("matchedItem")
        .populate("sourceUser", "name email clerkId")
        .populate("matchedUser", "name email clerkId")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      MatchedItem.countDocuments(matchFilter),
    ]);

    res.status(200).json({ success: true, matches, pagination: buildPagination({ page, limit, total }) });
  } catch (error) {
    log.error("Admin list matches error:", error);
    res.status(500).json({ success: false, message: "Failed to load matches" });
  }
};

export const createManualOverride = async (req, res) => {
  try {
    const { lostItemId, foundItemId, score = 100, notify = true } = req.body;
    if (!isObjectId(lostItemId) || !isObjectId(foundItemId)) {
      return res.status(400).json({ success: false, message: "Valid lostItemId and foundItemId are required" });
    }

    const [lostItem, foundItem] = await Promise.all([
      Item.findById(lostItemId).populate("user"),
      Item.findById(foundItemId).populate("user"),
    ]);

    if (!lostItem || !foundItem) {
      return res.status(404).json({ success: false, message: "Lost or found item not found" });
    }

    if (lostItem.type !== "LOST" || foundItem.type !== "FOUND") {
      return res.status(400).json({ success: false, message: "Manual override requires one LOST item and one FOUND item" });
    }

    const matchScore = Math.min(Math.max(Number(score), 0), 100);
    const match = await MatchedItem.findOneAndUpdate(
      { sourceItem: lostItem._id, matchedItem: foundItem._id },
      {
        sourceItem: lostItem._id,
        matchedItem: foundItem._id,
        sourceUser: lostItem.user._id,
        matchedUser: foundItem.user._id,
        matchScore,
        matchStrength: getMatchStrength(matchScore),
        breakdown: { provider: "admin-manual-override", adminUserId: req.adminUser?._id || null },
        status: "pending",
        notificationSent: Boolean(notify),
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    if (notify) {
      await Notification.insertMany([
        {
          user: lostItem.user._id,
          title: "Admin verified item match",
          body: `Your lost item "${lostItem.itemName}" was manually linked to a found item.`,
          item: lostItem._id,
          meta: { matchId: match._id, sourceItemId: lostItem._id, matchedItemId: foundItem._id, adminOverride: true },
        },
        {
          user: foundItem.user._id,
          title: "Admin verified item match",
          body: `Your found item "${foundItem.itemName}" was manually linked to a lost item.`,
          item: foundItem._id,
          meta: { matchId: match._id, sourceItemId: lostItem._id, matchedItemId: foundItem._id, adminOverride: true },
        },
      ]);
    }

    log.info("Admin created manual match override", {
      matchId: String(match._id),
      lostItemId: String(lostItem._id),
      foundItemId: String(foundItem._id),
      by: String(req.adminUser?._id || req.clerkUserId),
    });
    res.status(201).json({ success: true, match });
  } catch (error) {
    log.error("Admin manual override error:", error);
    res.status(500).json({ success: false, message: "Failed to create manual override" });
  }
};

export const getMatchingConfigController = async (req, res) => {
  try {
    const config = await getMatchingConfig();
    res.status(200).json({ success: true, config });
  } catch (error) {
    log.error("Admin get matching config error:", error);
    res.status(500).json({ success: false, message: "Failed to load matching config" });
  }
};

export const updateMatchingConfig = async (req, res) => {
  try {
    const current = await getMatchingConfig();
    const next = {
      ...current,
      ...req.body,
      weights: {
        ...current.weights,
        ...(req.body.weights || {}),
      },
    };

    next.minimumScore = Math.min(Math.max(Number(next.minimumScore), 0), 100);

    const config = await saveMatchingConfig(next);
    log.info("Admin updated matching config", {
      minimumScore: next.minimumScore,
      by: String(req.adminUser?._id || req.clerkUserId),
    });
    res.status(200).json({ success: true, config });
  } catch (error) {
    log.error("Admin update matching config error:", error);
    res.status(500).json({ success: false, message: "Failed to update matching config" });
  }
};
