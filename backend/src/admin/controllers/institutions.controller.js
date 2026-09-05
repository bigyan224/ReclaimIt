import Institution from "../../models/institution.model.js";
import User from "../../models/user.model.js";
import { syncUserInstitutionMembership } from "../../utils/userSync.js";
import { INSTITUTION_STATUSES } from "../utils/constants.js";
import { buildPagination, parsePagination } from "../utils/pagination.js";
import { slugify } from "../utils/slugify.js";
import { safeRegex } from "../utils/safeSearch.js";

const generateUniqueSlug = async (base) => {
  const seed = slugify(base) || "institution";
  let candidate = seed;
  let suffix = 1;
  while (await Institution.exists({ slug: candidate })) {
    suffix += 1;
    candidate = `${seed}-${suffix}`;
  }
  return candidate;
};

const pickString = (value, { maxLength, required = false } = {}) => {
  if (value === undefined || value === null) return undefined;
  const str = String(value).trim();
  if (!str) return required ? null : "";
  if (maxLength && str.length > maxLength) return str.slice(0, maxLength);
  return str;
};

const pickStringArray = (value) => {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) {
    throw new Error("Expected an array of strings");
  }
  return value
    .map((entry) => String(entry || "").toLowerCase().trim())
    .filter(Boolean);
};

export const listInstitutions = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const search = String(req.query.search || "").trim();
    const status = String(req.query.status || "").toUpperCase();

    const filter = {};
    if (INSTITUTION_STATUSES.includes(status)) filter.status = status;

    // Non-master-admins can only see their own institutions
    if (!req.isMasterAdmin && req.localUser) {
      filter._id = {
        $in: [
          ...(req.localUser.institutions || []).map((id) => id),
          ...(req.localUser.adminInstitutions || []).map((id) => id),
        ],
      };
    }

    const searchPattern = safeRegex(search);
    if (searchPattern) {
      filter.$or = [
        { name: searchPattern },
        { slug: searchPattern },
        { description: searchPattern },
      ];
    }

    const [institutions, total] = await Promise.all([
      Institution.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Institution.countDocuments(filter),
    ]);

    const ids = institutions.map((inst) => inst._id);
    const [memberCounts, adminCounts] = await Promise.all([
      User.aggregate([
        { $match: { institutions: { $in: ids } } },
        { $unwind: "$institutions" },
        { $match: { institutions: { $in: ids } } },
        { $group: { _id: "$institutions", count: { $sum: 1 } } },
      ]),
      User.aggregate([
        { $match: { adminInstitutions: { $in: ids } } },
        { $unwind: "$adminInstitutions" },
        { $match: { adminInstitutions: { $in: ids } } },
        { $group: { _id: "$adminInstitutions", count: { $sum: 1 } } },
      ]),
    ]);

    const memberMap = new Map(memberCounts.map((entry) => [String(entry._id), entry.count]));
    const adminMap = new Map(adminCounts.map((entry) => [String(entry._id), entry.count]));

    const enriched = institutions.map((inst) => ({
      ...inst.toObject(),
      memberCount: memberMap.get(String(inst._id)) || 0,
      adminCount: adminMap.get(String(inst._id)) || 0,
    }));

    res
      .status(200)
      .json({ success: true, institutions: enriched, pagination: buildPagination({ page, limit, total }) });
  } catch (error) {
    log.error("Admin list institutions error:", error);
    res.status(500).json({ success: false, message: "Failed to load institutions" });
  }
};

export const createInstitution = async (req, res) => {
  try {
    const name = pickString(req.body.name, { maxLength: 120, required: true });
    if (!name) {
      return res.status(400).json({ success: false, message: "Name is required" });
    }

    const description = pickString(req.body.description, { maxLength: 1000 }) || "";
    const logoUrl = pickString(req.body.logoUrl, { maxLength: 500 }) || "";
    const logoPublicId = pickString(req.body.logoPublicId, { maxLength: 200 }) || "";

    let emailDomains;
    let adminEmails;
    try {
      emailDomains = pickStringArray(req.body.emailDomains) ?? [];
      adminEmails = pickStringArray(req.body.adminEmails) ?? [];
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }

    const requestedSlug = req.body.slug ? slugify(req.body.slug) : "";
    const slug = requestedSlug || (await generateUniqueSlug(name));

    const existing = await Institution.findOne({ slug });
    if (existing) {
      return res.status(409).json({ success: false, message: `Slug already in use: ${slug}` });
    }

    // Auto-add the creator's email as institution admin
    const creatorEmail = req.adminUser?.email
      ? String(req.adminUser.email).toLowerCase().trim()
      : "";
    if (creatorEmail && !adminEmails.includes(creatorEmail)) {
      adminEmails.push(creatorEmail);
    }

    const institution = await Institution.create({
      name,
      slug,
      description,
      logo: { url: logoUrl, publicId: logoPublicId },
      emailDomains,
      adminEmails,
      status: "ACTIVE",
      createdBy: req.adminUser?._id || null,
    });

    // Sync creator's institution membership so they become an admin
    if (req.adminUser) {
      await syncUserInstitutionMembership(req.adminUser);
    }

    res.status(201).json({ success: true, institution });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ success: false, message: "Slug already in use" });
    }
    log.error("Admin create institution error:", error);
    if (error?.message?.startsWith("Invalid email domain") || error?.message?.startsWith("Invalid email domain or email") || error?.message?.startsWith("Invalid admin email")) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error?.name === "ValidationError") {
      const messages = Object.values(error.errors || {}).map((e) => e.message).filter(Boolean);
      return res.status(400).json({ success: false, message: messages.join("; ") || "Validation failed" });
    }
    res.status(500).json({ success: false, message: "Failed to create institution" });
  }
};

export const getInstitutionById = async (req, res) => {
  try {
    const institution = await Institution.findById(req.params.id);
    if (!institution) {
      return res.status(404).json({ success: false, message: "Institution not found" });
    }

    // Non-master-admins can only access their own institutions
    if (!req.isMasterAdmin && req.localUser) {
      const userInstIds = [
        ...(req.localUser.institutions || []).map((id) => String(id)),
        ...(req.localUser.adminInstitutions || []).map((id) => String(id)),
      ];
      if (!userInstIds.includes(String(institution._id))) {
        return res.status(403).json({ success: false, message: "Access denied" });
      }
    }

    const [memberCount, adminCount] = await Promise.all([
      User.countDocuments({ institutions: institution._id }),
      User.countDocuments({ adminInstitutions: institution._id }),
    ]);

    res.status(200).json({
      success: true,
      institution: {
        ...institution.toObject(),
        memberCount,
        adminCount,
      },
    });
  } catch (error) {
    log.error("Admin get institution error:", error);
    res.status(500).json({ success: false, message: "Failed to load institution" });
  }
};

export const updateInstitution = async (req, res) => {
  try {
    const institution = await Institution.findById(req.params.id);
    if (!institution) {
      return res.status(404).json({ success: false, message: "Institution not found" });
    }

    // Non-master-admins can only update institutions they admin
    if (!req.isMasterAdmin && req.localUser) {
      const adminInstIds = (req.localUser.adminInstitutions || []).map((id) => String(id));
      if (!adminInstIds.includes(String(institution._id))) {
        return res.status(403).json({ success: false, message: "Access denied" });
      }
    }

    if (req.body.name !== undefined) {
      const name = pickString(req.body.name, { maxLength: 120, required: true });
      if (!name) {
        return res.status(400).json({ success: false, message: "Name cannot be empty" });
      }
      institution.name = name;
    }

    if (req.body.description !== undefined) {
      institution.description = pickString(req.body.description, { maxLength: 1000 }) || "";
    }

    if (req.body.logoUrl !== undefined || req.body.logoPublicId !== undefined) {
      institution.logo = institution.logo || { url: "", publicId: "" };
      if (req.body.logoUrl !== undefined) {
        institution.logo.url = pickString(req.body.logoUrl, { maxLength: 500 }) || "";
      }
      if (req.body.logoPublicId !== undefined) {
        institution.logo.publicId = pickString(req.body.logoPublicId, { maxLength: 200 }) || "";
      }
    }

    if (req.body.emailDomains !== undefined) {
      try {
        institution.emailDomains = pickStringArray(req.body.emailDomains) ?? [];
      } catch (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
    }

    if (req.body.adminEmails !== undefined) {
      try {
        institution.adminEmails = pickStringArray(req.body.adminEmails) ?? [];
      } catch (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
    }

    if (req.body.status !== undefined) {
      const next = String(req.body.status).toUpperCase();
      if (!INSTITUTION_STATUSES.includes(next)) {
        return res.status(400).json({ success: false, message: `Invalid status. Use one of: ${INSTITUTION_STATUSES.join(", ")}` });
      }
      institution.status = next;
    }

    await institution.save();
    res.status(200).json({ success: true, institution });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ success: false, message: "Slug already in use" });
    }
    log.error("Admin update institution error:", error);
    if (error?.message?.startsWith("Invalid email domain") || error?.message?.startsWith("Invalid email domain or email") || error?.message?.startsWith("Invalid admin email")) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error?.name === "ValidationError") {
      const messages = Object.values(error.errors || {}).map((e) => e.message).filter(Boolean);
      return res.status(400).json({ success: false, message: messages.join("; ") || "Validation failed" });
    }
    res.status(500).json({ success: false, message: "Failed to update institution" });
  }
};

export const archiveInstitution = async (req, res) => {
  try {
    // Non-master-admins can only archive their own institutions
    if (!req.isMasterAdmin && req.localUser) {
      const inst = await Institution.findById(req.params.id).select("_id").lean();
      if (!inst) return res.status(404).json({ success: false, message: "Institution not found" });
      const adminInstIds = (req.localUser.adminInstitutions || []).map((id) => String(id));
      if (!adminInstIds.includes(String(inst._id))) {
        return res.status(403).json({ success: false, message: "Access denied" });
      }
    }

    const institution = await Institution.findByIdAndUpdate(
      req.params.id,
      { status: "INACTIVE" },
      { new: true }
    );
    if (!institution) {
      return res.status(404).json({ success: false, message: "Institution not found" });
    }
    res.status(200).json({ success: true, institution });
  } catch (error) {
    log.error("Admin archive institution error:", error);
    res.status(500).json({ success: false, message: "Failed to archive institution" });
  }
};

export const restoreInstitution = async (req, res) => {
  try {
    // Non-master-admins can only restore their own institutions
    if (!req.isMasterAdmin && req.localUser) {
      const inst = await Institution.findById(req.params.id).select("_id").lean();
      if (!inst) return res.status(404).json({ success: false, message: "Institution not found" });
      const adminInstIds = (req.localUser.adminInstitutions || []).map((id) => String(id));
      if (!adminInstIds.includes(String(inst._id))) {
        return res.status(403).json({ success: false, message: "Access denied" });
      }
    }

    const institution = await Institution.findByIdAndUpdate(
      req.params.id,
      { status: "ACTIVE" },
      { new: true }
    );
    if (!institution) {
      return res.status(404).json({ success: false, message: "Institution not found" });
    }
    res.status(200).json({ success: true, institution });
  } catch (error) {
    log.error("Admin restore institution error:", error);
    res.status(500).json({ success: false, message: "Failed to restore institution" });
  }
};

export const listInstitutionMembers = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const search = String(req.query.search || "").trim();
    const roleFilter = String(req.query.role || "").toUpperCase();

    const institution = await Institution.findById(req.params.id).select("_id").lean();
    if (!institution) {
      return res.status(404).json({ success: false, message: "Institution not found" });
    }

    // Non-master-admins can only list members of their own institutions
    if (!req.isMasterAdmin && req.localUser) {
      const userInstIds = [
        ...(req.localUser.institutions || []).map((id) => String(id)),
        ...(req.localUser.adminInstitutions || []).map((id) => String(id)),
      ];
      if (!userInstIds.includes(String(institution._id))) {
        return res.status(403).json({ success: false, message: "Access denied" });
      }
    }

    const filter = {
      $or: [{ institutions: institution._id }, { adminInstitutions: institution._id }],
    };

    if (roleFilter === "ADMIN") {
      filter.adminInstitutions = institution._id;
    } else if (roleFilter === "MEMBER") {
      filter.institutions = institution._id;
      filter.adminInstitutions = { $ne: institution._id };
    }

    const memberSearchPattern = safeRegex(search);
    if (memberSearchPattern) {
      filter.$and = [
        {
          $or: [
            { name: memberSearchPattern },
            { email: memberSearchPattern },
          ],
        },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select("clerkId email name role status institutions adminInstitutions createdAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    const enriched = users.map((user) => ({
      ...user,
      isAdmin: (user.adminInstitutions || []).map(String).includes(String(institution._id)),
    }));

    res
      .status(200)
      .json({ success: true, members: enriched, pagination: buildPagination({ page, limit, total }) });
  } catch (error) {
    log.error("Admin list institution members error:", error);
    res.status(500).json({ success: false, message: "Failed to load members" });
  }
};
