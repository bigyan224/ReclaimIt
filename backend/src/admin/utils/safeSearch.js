// Build a ReDoS-safe case-insensitive regex filter from user input.
// Escapes regex metacharacters and caps length so crafted input like
// "^(a+)+$" can't pin the event loop.
const MAX_SEARCH_LENGTH = 100;

export function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function safeRegex(search) {
  const cleaned = String(search || "").trim().slice(0, MAX_SEARCH_LENGTH);
  if (!cleaned) return null;
  return { $regex: escapeRegExp(cleaned), $options: "i" };
}
