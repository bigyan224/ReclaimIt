import AdminConfig from "../models/adminConfig.model.js";
import { DEFAULT_MATCHING_CONFIG } from "./constants.js";

export async function getMatchingConfig() {
  const doc = await AdminConfig.findOne({ key: "matching" });
  return {
    ...DEFAULT_MATCHING_CONFIG,
    ...(doc?.value || {}),
    weights: {
      ...DEFAULT_MATCHING_CONFIG.weights,
      ...(doc?.value?.weights || {}),
    },
  };
}

export async function saveMatchingConfig(value) {
  const doc = await AdminConfig.findOneAndUpdate(
    { key: "matching" },
    { value },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  return doc.value;
}

export function getMatchStrength(score) {
  if (score >= 70) return "strong";
  if (score >= 50) return "medium";
  return "weak";
}
