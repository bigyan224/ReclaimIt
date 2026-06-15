import { clerkClient } from "@clerk/clerk-sdk-node";
import Institution from "../models/institution.model.js";
import User from "../models/user.model.js";

const emailDomainOf = (email) => {
  const value = String(email || "").toLowerCase().trim();
  const atIndex = value.lastIndexOf("@");
  return atIndex >= 0 ? value.slice(atIndex + 1) : "";
};

const uniqueIdStrings = (ids) => {
  const seen = new Set();
  const result = [];
  for (const id of ids) {
    const key = String(id);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(id);
    }
  }
  return result;
};

const sortedIds = (ids) => ids.map((id) => String(id)).sort().join(",");

export async function syncUserInstitutionMembership(user) {
  if (!user) return user;

  const email = String(user.email || "").toLowerCase().trim();
  if (!email) {
    return user;
  }

  const domain = emailDomainOf(email);

  const [domainMatches, emailMatches, adminMatches] = await Promise.all([
    domain
      ? Institution.find({ status: "ACTIVE", emailDomains: domain }).select("_id").lean()
      : Promise.resolve([]),
    Institution.find({ status: "ACTIVE", emailDomains: email }).select("_id").lean(),
    Institution.find({ status: "ACTIVE", adminEmails: email }).select("_id").lean(),
  ]);

  const memberIds = uniqueIdStrings([
    ...domainMatches.map((inst) => inst._id),
    ...emailMatches.map((inst) => inst._id),
    ...adminMatches.map((inst) => inst._id),
  ]);
  const adminIds = uniqueIdStrings(adminMatches.map((inst) => inst._id));

  const currentMemberIds = sortedIds(user.institutions);
  const currentAdminIds = sortedIds(user.adminInstitutions);
  const targetMemberIds = sortedIds(memberIds);
  const targetAdminIds = sortedIds(adminIds);

  if (currentMemberIds === targetMemberIds && currentAdminIds === targetAdminIds) {
    return user;
  }

  user.institutions = memberIds;
  user.adminInstitutions = adminIds;
  await user.save();

  console.log(
    `Synced institution membership for user ${user._id} (${email}): ` +
      `${memberIds.length} member(s), ${adminIds.length} admin(s)`
  );

  return user;
}

/**
 * Finds a user by Clerk ID in MongoDB, or fetches from Clerk and creates one.
 * Returns the user document or null if not available.
 */
export async function getOrCreateUser(clerkUserId) {
  if (!clerkUserId) return null;

  let user = await User.findOne({ clerkId: clerkUserId });
  if (user) {
    return syncUserInstitutionMembership(user);
  }

  try {
    const clerkUser = await clerkClient.users.getUser(clerkUserId);
    if (!clerkUser) return null;

    user = await User.create({
      clerkId: clerkUserId,
      email: clerkUser.emailAddresses?.[0]?.emailAddress || "",
      name: `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim(),
    });

    console.log(`Synced user from Clerk: ${clerkUserId} -> ${user._id}`);

    return syncUserInstitutionMembership(user);
  } catch (err) {
    console.error("Failed to sync user from Clerk:", err?.message || err);
    return null;
  }
}
