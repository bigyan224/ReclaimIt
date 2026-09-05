import { clerkClient } from "@clerk/clerk-sdk-node";
import Item from "../../models/item.model.js";
import User from "../../models/user.model.js";
import { USER_ROLES, USER_STATUSES } from "../utils/constants.js";
import { buildPagination, parsePagination } from "../utils/pagination.js";
import { userInstitutionFilter } from "../utils/institutionFilter.js";
import { safeRegex } from "../utils/safeSearch.js";

export const listUsers = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const search = String(req.query.search || "").trim();
    const status = String(req.query.status || "").toUpperCase();
    const role = String(req.query.role || "").toUpperCase();

    const filter = { ...userInstitutionFilter(req) };
    if (USER_STATUSES.includes(status)) filter.status = status;
    if (USER_ROLES.includes(role)) filter.role = role;
    const searchPattern = safeRegex(search);
    if (searchPattern) {
      filter.$or = [
        { name: searchPattern },
        { email: searchPattern },
        { clerkId: searchPattern },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(filter),
    ]);

    const userIds = users.map((user) => user._id);
    const [reports, claims] = await Promise.all([
      Item.aggregate([{ $match: { user: { $in: userIds } } }, { $group: { _id: "$user", count: { $sum: 1 } } }]),
      Item.aggregate([{ $match: { claimedBy: { $in: userIds } } }, { $group: { _id: "$claimedBy", count: { $sum: 1 } } }]),
    ]);

    const reportMap = new Map(reports.map((entry) => [String(entry._id), entry.count]));
    const claimMap = new Map(claims.map((entry) => [String(entry._id), entry.count]));
    const enrichedUsers = users.map((user) => ({
      ...user.toObject(),
      reportCount: reportMap.get(String(user._id)) || 0,
      claimCount: claimMap.get(String(user._id)) || 0,
    }));

    res.status(200).json({ success: true, users: enrichedUsers, pagination: buildPagination({ page, limit, total }) });
  } catch (error) {
    console.error("Admin list users error:", error);
    res.status(500).json({ success: false, message: "Failed to load users" });
  }
};

export const updateUserBan = async (req, res) => {
  try {
    const banned = Boolean(req.body.banned);
    const user = await User.findByIdAndUpdate(req.params.id, { status: banned ? "BANNED" : "ACTIVE" }, { new: true });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    try {
      if (banned && clerkClient.users.banUser) await clerkClient.users.banUser(user.clerkId);
      if (!banned && clerkClient.users.unbanUser) await clerkClient.users.unbanUser(user.clerkId);
    } catch (error) {
      console.warn("Clerk ban sync failed:", error?.message || error);
    }

    res.status(200).json({ success: true, user });
  } catch (error) {
    console.error("Admin ban user error:", error);
    res.status(500).json({ success: false, message: "Failed to update user ban status" });
  }
};

export const updateUserRole = async (req, res) => {
  try {
    const role = String(req.body.role || "").toUpperCase();
    if (!USER_ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: `Invalid role. Use one of: ${USER_ROLES.join(", ")}` });
    }

    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    try {
      await clerkClient.users.updateUserMetadata(user.clerkId, {
        publicMetadata: { role: role === "ADMIN" ? "admin" : "user" },
      });
    } catch (error) {
      console.warn("Clerk role metadata sync failed:", error?.message || error);
    }

    res.status(200).json({ success: true, user });
  } catch (error) {
    console.error("Admin update user role error:", error);
    res.status(500).json({ success: false, message: "Failed to update user role" });
  }
};

export const updateUserStatus = async (req, res) => {
  try {
    const status = String(req.body.status || "").toUpperCase();
    if (!USER_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Use one of: ${USER_STATUSES.join(", ")}` });
    }

    const user = await User.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.status(200).json({ success: true, user });
  } catch (error) {
    console.error("Admin update user status error:", error);
    res.status(500).json({ success: false, message: "Failed to update user status" });
  }
};
