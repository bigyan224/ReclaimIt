import express from "express";
import { getChatTranscript, listChatDisputes } from "./controllers/chats.controller.js";
import { getDashboardAnalytics, getDashboardStats } from "./controllers/dashboard.controller.js";
import { deleteItemAsAdmin, listItems, quickEditItem, updateItemStatus } from "./controllers/items.controller.js";
import {
  createManualOverride,
  getMatchingConfigController,
  listMatches,
  updateMatchingConfig,
} from "./controllers/matching.controller.js";
import { listUsers, updateUserBan, updateUserRole, updateUserStatus } from "./controllers/users.controller.js";
import {
  archiveInstitution,
  createInstitution,
  getInstitutionById,
  listInstitutionMembers,
  listInstitutions,
  restoreInstitution,
  updateInstitution,
} from "./controllers/institutions.controller.js";
import { getAdminUser } from "./controllers/user.controller.js";
import { requireAdminPanelAccess, requireInstitutionAccess, requireMasterAdmin } from "./middleware/adminAuth.middleware.js";
import { adminLimiter } from "../middleware/rateLimit.js";

const router = express.Router();

// Panel routes — master admins AND institution admins only (enforced in
// requireAdminPanelAccess); controllers further scope data by role
router.use("/dashboard", requireAdminPanelAccess, adminLimiter);
router.use("/items", requireAdminPanelAccess, adminLimiter);
router.use("/users", requireAdminPanelAccess, adminLimiter);
router.use("/matching", requireAdminPanelAccess, adminLimiter);
router.use("/chats", requireAdminPanelAccess, adminLimiter);

// Institution routes — accessible by master admins AND institution admins
router.use("/institutions", requireInstitutionAccess, adminLimiter);

// Current user info
router.get("/me", requireAdminPanelAccess, getAdminUser);

router.get("/dashboard/stats", getDashboardStats);
router.get("/dashboard/analytics", getDashboardAnalytics);

router.get("/items", listItems);
router.put("/items/:id/status", requireMasterAdmin, updateItemStatus);
router.put("/items/:id", requireMasterAdmin, quickEditItem);
router.delete("/items/:id", requireMasterAdmin, deleteItemAsAdmin);

router.get("/users", listUsers);
router.put("/users/:id/ban", requireMasterAdmin, updateUserBan);
router.put("/users/:id/role", requireMasterAdmin, updateUserRole);
router.put("/users/:id/status", requireMasterAdmin, updateUserStatus);

router.get("/matching/matches", listMatches);
router.post("/matching/override", requireMasterAdmin, createManualOverride);
router.get("/matching/config", requireMasterAdmin, getMatchingConfigController);
router.put("/matching/config", requireMasterAdmin, updateMatchingConfig);

router.get("/institutions", listInstitutions);
router.post("/institutions", createInstitution);
router.get("/institutions/:id", getInstitutionById);
router.put("/institutions/:id", updateInstitution);
router.delete("/institutions/:id", archiveInstitution);
router.post("/institutions/:id/restore", restoreInstitution);
router.get("/institutions/:id/members", listInstitutionMembers);

router.get("/chats/disputes", listChatDisputes);
router.get("/chats/:id/transcript", getChatTranscript);

export default router;
