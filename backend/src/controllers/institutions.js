import Institution from "../models/institution.model.js";
import { getOrCreateUser } from "../utils/userSync.js";

const ensureInstitutionVisible = (user, institution) => {
  if (!user || !institution) return false;
  if (institution.status !== "ACTIVE") return false;
  const memberIds = user.institutions.map((id) => String(id));
  const adminIds = (user.adminInstitutions || []).map((id) => String(id));
  return (
    memberIds.includes(String(institution._id)) ||
    adminIds.includes(String(institution._id))
  );
};

export const getMyInstitutions = async (req, res) => {
  try {
    const user = await getOrCreateUser(req.clerkUserId);
    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const memberIds = user.institutions.map((id) => String(id));
    const adminIds = (user.adminInstitutions || []).map((id) => String(id));

    const ids = [...new Set([...memberIds, ...adminIds])];
    if (ids.length === 0) {
      return res.status(200).json({ success: true, institutions: [] });
    }

    const institutions = await Institution.find({ _id: { $in: ids }, status: "ACTIVE" })
      .select("name slug description logo emailDomains status createdAt")
      .sort({ name: 1 })
      .lean();

    const enriched = institutions.map((inst) => ({
      ...inst,
      role: adminIds.includes(String(inst._id)) ? "ADMIN" : "MEMBER",
    }));

    res.status(200).json({ success: true, institutions: enriched });
  } catch (error) {
    console.error("Get my institutions error:", error);
    res.status(500).json({ success: false, message: "Failed to load institutions" });
  }
};

export const getInstitutionById = async (req, res) => {
  try {
    const user = await getOrCreateUser(req.clerkUserId);
    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const institution = await Institution.findById(req.params.id).lean();
    if (!ensureInstitutionVisible(user, institution)) {
      return res.status(404).json({ success: false, message: "Institution not found" });
    }

    const adminIds = (user.adminInstitutions || []).map((id) => String(id));
    res.status(200).json({
      success: true,
      institution: {
        ...institution,
        role: adminIds.includes(String(institution._id)) ? "ADMIN" : "MEMBER",
      },
    });
  } catch (error) {
    console.error("Get institution by id error:", error);
    res.status(500).json({ success: false, message: "Failed to load institution" });
  }
};
