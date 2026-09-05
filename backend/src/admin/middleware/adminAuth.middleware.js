import { clerkClient, verifyToken } from "@clerk/clerk-sdk-node";
import User from "../../models/user.model.js";

const CLERK_CLOCK_SKEW_MS = Number(process.env.CLERK_CLOCK_SKEW_MS || 5 * 60 * 1000);

// SECURITY: Only trust server-set publicMetadata.role.
// unsafeMetadata is writable by the user from the frontend — trusting it
// lets ANY signed-in user escalate to master admin.
function hasAdminMetadata(payload, clerkUser) {
  const payloadRole = payload?.publicMetadata?.role;

  if (payloadRole && String(payloadRole).toLowerCase() === "admin") return true;

  const clerkRole = clerkUser?.publicMetadata?.role;

  if (clerkRole && String(clerkRole).toLowerCase() === "admin") return true;

  return false;
}

async function authenticate(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.split(" ")[1];
  const payload = await verifyToken(token, {
    secretKey: process.env.CLERK_SECRET_KEY,
    clockSkewInMs: CLERK_CLOCK_SKEW_MS,
  });

  req.clerkUserId = payload.sub;
  req.localUser = await User.findOne({ clerkId: payload.sub });

  let isMasterAdmin = hasAdminMetadata(payload, null);
  if (!isMasterAdmin) {
    try {
      const clerkUser = await clerkClient.users.getUser(payload.sub);
      isMasterAdmin = hasAdminMetadata(payload, clerkUser);
    } catch (error) {
      console.warn("Unable to fetch Clerk user for admin metadata check:", error?.message || error);
    }
  }
  req.isMasterAdmin = isMasterAdmin;

  return payload;
}

export const requireMasterAdmin = async (req, res, next) => {
  try {
    const payload = await authenticate(req);
    if (!payload) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    if (!req.isMasterAdmin) {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }
    req.adminUser = req.localUser;
    next();
  } catch (error) {
    console.error("Admin auth error:", error);
    res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

export const requireInstitutionAccess = async (req, res, next) => {
  try {
    const payload = await authenticate(req);
    if (!payload) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    if (req.isMasterAdmin) {
      req.adminUser = req.localUser;
      return next();
    }
    if (!req.localUser) {
      return res.status(403).json({ success: false, message: "Access denied. User not found." });
    }
    const institutionId = req.params.id;
    if (institutionId) {
      const hasAccess = req.localUser.adminInstitutions.some(
        (id) => String(id) === institutionId
      );
      if (!hasAccess) {
        return res.status(403).json({ success: false, message: "Access denied" });
      }
    }
    req.adminUser = req.localUser;
    next();
  } catch (error) {
    console.error("Auth error:", error);
    res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

export const requireAdminPanelAccess = async (req, res, next) => {
  try {
    const payload = await authenticate(req);
    if (!payload) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    req.adminUser = req.localUser;
    req.isInstitutionAdmin = !!(req.localUser && req.localUser.adminInstitutions && req.localUser.adminInstitutions.length > 0);
    // SECURITY: panel access requires master admin OR institution admin.
    // Plain users get empty-scope filters in controllers, so deny them here.
    if (!req.isMasterAdmin && !req.isInstitutionAdmin) {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }
    next();
  } catch (error) {
    console.error("Auth error:", error);
    res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};
