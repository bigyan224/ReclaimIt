export function mapItem(item) {
  const coords = item.location?.coordinates?.coordinates;
  return {
    id: item._id,
    title: item.itemName || "Untitled item",
    type: item.type || "UNKNOWN",
    category: item.category || "Uncategorized",
    status: item.status || "ACTIVE",
    owner: item.user?.name || item.user?.email || "Unknown user",
    ownerEmail: item.user?.email || "",
    location: item.location?.name || "Unknown location",
    coords: Array.isArray(coords) ? `${coords[1] ?? "-"}, ${coords[0] ?? "-"}` : "No coordinates",
    age: formatDate(item.createdAt),
    risk: item.status === "FLAGGED" ? "High" : item.status === "ARCHIVED" ? "Medium" : "Low",
    image: getThumbKind(item),
    imageUrl: item.image?.url || null,
    description: item.description || "No description provided.",
    tags: [item.category, item.color, item.brandName].filter(Boolean),
    raw: item,
  };
}

export function mapInstitution(institution) {
  return {
    id: institution._id,
    name: institution.name || "Unnamed institution",
    slug: institution.slug || "",
    description: institution.description || "",
    logoUrl: institution.logo?.url || "",
    emailDomains: institution.emailDomains || [],
    adminEmails: institution.adminEmails || [],
    status: institution.status || "ACTIVE",
    memberCount: institution.memberCount || 0,
    adminCount: institution.adminCount || 0,
    createdAt: formatDate(institution.createdAt),
    raw: institution,
  };
}

export function mapUser(user) {
  return {
    id: user._id,
    name: user.name || "Unnamed user",
    email: user.email || "No email",
    role: user.role || "USER",
    status: user.status || "ACTIVE",
    reports: user.reportCount || 0,
    claims: user.claimCount || 0,
    karma: Math.max(20, 100 - (user.status === "BANNED" ? 70 : user.status === "FLAGGED" ? 30 : 0)),
    joined: formatMonth(user.createdAt),
    raw: user,
  };
}

export function mapMatch(match) {
  const source = match.sourceItem;
  const matched = match.matchedItem;
  const breakdown = match.breakdown || {};
  return {
    id: match._id,
    lost: source?.type === "LOST" ? source?.itemName : matched?.itemName,
    found: source?.type === "FOUND" ? source?.itemName : matched?.itemName,
    owner: match.sourceUser?.name || match.sourceUser?.email || "Source user",
    finder: match.matchedUser?.name || match.matchedUser?.email || "Matched user",
    score: Math.round(match.matchScore || 0),
    location: Math.round(breakdown.locationScore || breakdown.location || match.matchScore || 0),
    title: Math.round(breakdown.titleScore || breakdown.nameScore || match.matchScore || 0),
    brand: Math.round(breakdown.brandScore || breakdown.brand || 0),
    color: Math.round(breakdown.colorScore || breakdown.color || match.matchScore || 0),
    status: titleCase(match.matchStrength || match.status || "pending"),
    raw: match,
  };
}

export function mapDispute(chat) {
  const itemName = chat.items?.[0]?.itemName || chat.matchedItem?.sourceItem?.itemName || "Chat dispute";
  return {
    id: chat._id,
    item: itemName,
    priority: chat.status === "blocked" ? "High" : "Medium",
    reason: chat.status === "blocked" ? "Blocked conversation" : "Conversation review",
    reporter: chat.participants?.[0]?.name || chat.participants?.[0]?.email || "Unknown",
    assigned: "Unassigned",
    lastMessage: chat.lastMessage || "No messages yet",
    raw: chat,
  };
}

export function mapTranscript(payload) {
  const chat = payload.chat;
  return {
    id: chat?._id || "Transcript",
    item: chat?.items?.[0]?.itemName || "Chat transcript",
    reporter: chat?.participants?.[0]?.name || "Unknown",
    assigned: "Unassigned",
    reason: chat?.status === "blocked" ? "Blocked conversation" : "Conversation review",
    priority: chat?.status === "blocked" ? "High" : "Medium",
    messages: (payload.messages || []).map((message) => [
      message.sender?.name || message.sender?.email || "System",
      message.content || message.transcriptText || "(empty message)",
    ]),
  };
}

export function buildAnalytics(itemVolume = [], matchVolume = []) {
  const byDay = new Map();

  for (const entry of itemVolume) {
    const day = entry._id?.day || "Unknown";
    const current = byDay.get(day) || { day, lost: 0, found: 0, returned: 0 };
    if (entry._id?.type === "LOST") current.lost = entry.count;
    if (entry._id?.type === "FOUND") current.found = entry.count;
    byDay.set(day, current);
  }

  for (const entry of matchVolume) {
    const day = entry._id || "Unknown";
    const current = byDay.get(day) || { day, lost: 0, found: 0, returned: 0 };
    current.returned = entry.count || 0;
    byDay.set(day, current);
  }

  return [...byDay.values()].map((entry) => ({ ...entry, day: formatDay(entry.day) }));
}

function getThumbKind(item) {
  const text = `${item.category || ""} ${item.itemName || ""}`.toLowerCase();
  if (text.includes("phone") || text.includes("electronics")) return "phone";
  if (text.includes("wallet") || text.includes("document") || text.includes("card")) return "wallet";
  if (text.includes("bag") || text.includes("backpack")) return "bag";
  if (text.includes("ring") || text.includes("jewelry")) return "ring";
  return "bag";
}

function formatDate(value) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function formatMonth(value) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" }).format(new Date(value));
}

function formatDay(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date);
}

function titleCase(value) {
  return String(value).charAt(0).toUpperCase() + String(value).slice(1).toLowerCase();
}
