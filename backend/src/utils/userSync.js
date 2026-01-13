import { clerkClient } from "@clerk/clerk-sdk-node";
import User from "../models/user.model.js";

/**
 * Finds a user by Clerk ID in MongoDB, or fetches from Clerk and creates one.
 * Returns the user document or null if not available.
 */
export async function getOrCreateUser(clerkUserId) {
  if (!clerkUserId) return null;

  let user = await User.findOne({ clerkId: clerkUserId });
  if (user) return user;

  try {
    const clerkUser = await clerkClient.users.getUser(clerkUserId);
    if (!clerkUser) return null;

    user = await User.create({
      clerkId: clerkUserId,
      email: clerkUser.emailAddresses?.[0]?.emailAddress || "",
      name: `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim(),
    });

    console.log(`Synced user from Clerk: ${clerkUserId} -> ${user._id}`);
    return user;
  } catch (err) {
    console.error("Failed to sync user from Clerk:", err?.message || err);
    return null;
  }
}
