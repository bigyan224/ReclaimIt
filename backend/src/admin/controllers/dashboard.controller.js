import mongoose from "mongoose";
import Chat from "../../models/chat.model.js";
import Item from "../../models/item.model.js";
import MatchedItem from "../../models/matchedItem.model.js";
import User from "../../models/user.model.js";
import { itemInstitutionFilter, userInstitutionFilter } from "../utils/institutionFilter.js";

export const getDashboardStats = async (req, res) => {
  try {
    const itemFilter = itemInstitutionFilter(req);
    const userFilter = userInstitutionFilter(req);

    let userIds = null;
    if (!req.isMasterAdmin && req.isInstitutionAdmin) {
      const users = await User.find(userFilter).select("_id").lean();
      userIds = users.map((u) => u._id);
    }

    const itemStatusFilter = (type, status) => {
      const f = { type, status, ...itemFilter };
      return f;
    };

    const [activeLost, activeFound, successfulMatches, activeChats, unresolvedDisputes, users, flaggedItems] =
      await Promise.all([
        Item.countDocuments(itemStatusFilter("LOST", "ACTIVE")),
        Item.countDocuments(itemStatusFilter("FOUND", "ACTIVE")),
        userIds
          ? MatchedItem.countDocuments({
              $or: [{ sourceUser: { $in: userIds } }, { matchedUser: { $in: userIds } }],
              status: "accepted",
            })
          : MatchedItem.countDocuments({ status: "accepted" }),
        userIds
          ? Chat.countDocuments({
              participants: { $in: userIds },
              status: "active",
            })
          : Chat.countDocuments({ status: "active" }),
        userIds
          ? Chat.countDocuments({
              participants: { $in: userIds },
              status: "blocked",
            })
          : Chat.countDocuments({ status: "blocked" }),
        User.countDocuments(userFilter),
        Item.countDocuments(itemStatusFilter(null, "FLAGGED")),
      ]);

    res.status(200).json({
      success: true,
      stats: {
        activeLost,
        activeFound,
        successfulMatches,
        activeChats,
        unresolvedDisputes,
        users,
        flaggedItems,
      },
      health: {
        api: "ok",
        database: mongoose.connection.readyState === 1 ? "connected" : "not_connected",
        cloudinaryConfigured: Boolean(process.env.CLOUDINARY_CLOUD_NAME),
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
      },
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    res.status(500).json({ success: false, message: "Failed to load dashboard stats" });
  }
};

export const getDashboardAnalytics = async (req, res) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days || 14), 1), 90);
    const start = new Date();
    start.setDate(start.getDate() - days + 1);
    start.setHours(0, 0, 0, 0);

    const itemFilter = itemInstitutionFilter(req);
    const matchFilter = { createdAt: { $gte: start } };

    if (!req.isMasterAdmin && req.isInstitutionAdmin) {
      const users = await User.find(userInstitutionFilter(req)).select("_id").lean();
      const userIds = users.map((u) => u._id);
      matchFilter.$or = [{ sourceUser: { $in: userIds } }, { matchedUser: { $in: userIds } }];
    }

    const itemVolume = await Item.aggregate([
      { $match: { createdAt: { $gte: start }, ...itemFilter } },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            type: "$type",
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.day": 1 } },
    ]);

    const matchVolume = await MatchedItem.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
          averageScore: { $avg: "$matchScore" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json({ success: true, itemVolume, matchVolume });
  } catch (error) {
    console.error("Admin analytics error:", error);
    res.status(500).json({ success: false, message: "Failed to load analytics" });
  }
};
