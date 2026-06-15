import Item from "../models/item.model.js";
import MatchedItem from "../models/matchedItem.model.js";
import Notification from "../models/notification.model.js";
import { scoreCandidatesWithGemini } from "../services/geminiMatching.js";
import { scoreCandidatesWithLocalMatcher } from "../services/localMatcher.js";
import { getOrCreateUser } from "../utils/userSync.js";

// Simple configuration
const GEO_RADIUS_KM = 20;
const GEO_RADIUS_METERS = 20 * 1000;
const MIN_MATCH_SCORE = 40; // Out of 100

// Match strength thresholds for notifications
const MATCH_STRONG = 70;   // 70+ = strong match
const MATCH_MEDIUM = 50;   // 50-69 = medium match
// 40-49 = weak match

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(coords1, coords2) {
  const R = 6371; // Earth's radius in km
  const [lon1, lat1] = coords1;
  const [lon2, lat2] = coords2;
  
  const toRad = (deg) => deg * Math.PI / 180;
  
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;
  
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Categorize match strength based on score
function getMatchStrength(score) {
  if (score >= MATCH_STRONG) return "strong";
  if (score >= MATCH_MEDIUM) return "medium";
  return "weak";
}

function buildCandidatesWithDistance(sourceCoords, candidates) {
  return candidates.map((candidate) => {
    const candCoords = candidate.location?.coordinates?.coordinates;
    const distanceKm = candCoords ? calculateDistance(sourceCoords, candCoords) : null;
    return {
      item: candidate,
      distanceKm,
    };
  });
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function tokenize(value) {
  const normalized = normalizeText(value);
  if (!normalized) return [];
  return normalized.split(/[^a-z0-9]+/).filter(Boolean);
}

function jaccardSimilarity(a, b) {
  const setA = new Set(tokenize(a));
  const setB = new Set(tokenize(b));

  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection += 1;
  }

  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? intersection / union : 0;
}

function equalsNormalized(a, b) {
  const left = normalizeText(a);
  const right = normalizeText(b);
  return Boolean(left && right && left === right);
}

function getTimeProximityScore(sourceDate, candidateDate) {
  if (!sourceDate || !candidateDate) return 0;

  const sourceTs = new Date(sourceDate).getTime();
  const candidateTs = new Date(candidateDate).getTime();
  if (!Number.isFinite(sourceTs) || !Number.isFinite(candidateTs)) return 0;

  const diffHours = Math.abs(sourceTs - candidateTs) / (1000 * 60 * 60);
  if (diffHours <= 24) return 5;
  if (diffHours <= 72) return 3;
  if (diffHours <= 168) return 1;
  return 0;
}

function getDistanceProximityScore(distanceKm) {
  if (!Number.isFinite(distanceKm)) return 0;
  if (distanceKm <= 1) return 5;
  if (distanceKm <= 5) return 4;
  if (distanceKm <= 10) return 3;
  if (distanceKm <= 20) return 2;
  return 0;
}

function scoreCandidatesWithRuleFallback(item, candidatesWithDistance) {
  return candidatesWithDistance.map(({ item: candidate, distanceKm }) => {
    let score = 0;
    const reasoning = [];

    const nameSimilarity = jaccardSimilarity(item.itemName, candidate.itemName);
    const descriptionSimilarity = jaccardSimilarity(item.description, candidate.description);

    if (nameSimilarity > 0) {
      const nameScore = nameSimilarity * 30;
      score += nameScore;
      reasoning.push(`Name similarity ${Math.round(nameSimilarity * 100)}%`);
    }

    if (descriptionSimilarity > 0) {
      const descriptionScore = descriptionSimilarity * 20;
      score += descriptionScore;
      reasoning.push(`Description similarity ${Math.round(descriptionSimilarity * 100)}%`);
    }

    if (equalsNormalized(item.category, candidate.category)) {
      score += 15;
      reasoning.push("Same category");
    }

    if (equalsNormalized(item.color, candidate.color)) {
      score += 15;
      reasoning.push("Same color");
    }

    if (equalsNormalized(item.brandName, candidate.brandName)) {
      score += 10;
      reasoning.push("Same brand");
    }

    const timeScore = getTimeProximityScore(item.dateTime, candidate.dateTime);
    if (timeScore > 0) {
      score += timeScore;
      reasoning.push("Close report time");
    }

    const distanceScore = getDistanceProximityScore(distanceKm);
    if (distanceScore > 0) {
      score += distanceScore;
      reasoning.push("Close location");
    }

    const matchScore = Math.round(clamp(score, 0, 100) * 100) / 100;
    const confidence = Math.round(clamp(0.35 + matchScore / 200, 0.35, 0.85) * 100) / 100;

    return {
      candidateId: String(candidate._id),
      matchScore,
      confidence,
      reasoning: reasoning.length > 0 ? reasoning : ["Fallback scoring: insufficient overlapping signals"],
      provider: "rule-based-fallback",
    };
  });
}

// Matching mode configuration
// Options: "python" | "mixed" | "gemini"
// Set via environment variable MATCH_PROVIDER
const MATCH_PROVIDER = process.env.MATCH_PROVIDER || "mixed";

console.log(`[Matching] Using provider mode: ${MATCH_PROVIDER}`);

async function scoreCandidatesForItem(item, candidatesWithDistance) {
  let pythonScores = [];
  let geminiScores = [];
  let pythonError = null;
  let geminiError = null;

  // Get Python scores if needed
  if (MATCH_PROVIDER === "python" || MATCH_PROVIDER === "mixed") {
    try {
      pythonScores = await scoreCandidatesWithLocalMatcher({
        sourceItem: item,
        candidates: candidatesWithDistance,
      });
    } catch (error) {
      pythonError = error?.message || error;
      console.error("Local matcher unavailable:", pythonError);
    }
  }

  // Get Gemini scores if needed
  if (MATCH_PROVIDER === "gemini" || MATCH_PROVIDER === "mixed") {
    try {
      geminiScores = await scoreCandidatesWithGemini({
        sourceItem: item,
        candidates: candidatesWithDistance,
      });
    } catch (error) {
      geminiError = error?.message || error;
      console.error("Gemini scoring unavailable:", geminiError);
    }
  }

  // Handle mode-specific logic
  if (MATCH_PROVIDER === "python") {
    // Python only
    if (pythonScores.length === 0) {
      console.warn("Python mode selected but API unavailable, falling back to rules");
      const fallbackScores = scoreCandidatesWithRuleFallback(item, candidatesWithDistance);
      return candidatesWithDistance.map(({ item: candidate, distanceKm }) => {
        const fallbackScore = fallbackScores.find((s) => s.candidateId === String(candidate._id)) || {
          matchScore: 0,
          confidence: 0,
          reasoning: ["Python unavailable, using fallback"],
          provider: "rule-based-fallback",
        };
        return {
          candidate,
          score: fallbackScore.matchScore,
          confidence: fallbackScore.confidence,
          breakdown: {
            provider: fallbackScore.provider,
            confidence: fallbackScore.confidence,
            reasoning: fallbackScore.reasoning,
          },
          distanceKm,
        };
      });
    }
    return mapScoresToCandidates(candidatesWithDistance, pythonScores, "local-python-matcher");
  }

  if (MATCH_PROVIDER === "gemini") {
    // Gemini only
    if (geminiScores.length === 0) {
      console.warn("Gemini mode selected but API unavailable, falling back to rules");
      const fallbackScores = scoreCandidatesWithRuleFallback(item, candidatesWithDistance);
      return candidatesWithDistance.map(({ item: candidate, distanceKm }) => {
        const fallbackScore = fallbackScores.find((s) => s.candidateId === String(candidate._id)) || {
          matchScore: 0,
          confidence: 0,
          reasoning: ["Gemini unavailable, using fallback"],
          provider: "rule-based-fallback",
        };
        return {
          candidate,
          score: fallbackScore.matchScore,
          confidence: fallbackScore.confidence,
          breakdown: {
            provider: fallbackScore.provider,
            confidence: fallbackScore.confidence,
            reasoning: fallbackScore.reasoning,
          },
          distanceKm,
        };
      });
    }
    return mapScoresToCandidates(candidatesWithDistance, geminiScores, "gemini");
  }

  // Mixed mode (default)
  if (pythonScores.length === 0 && geminiScores.length === 0) {
    console.error("Both scorers failed, using rule-based fallback");
    const fallbackScores = scoreCandidatesWithRuleFallback(item, candidatesWithDistance);
    return candidatesWithDistance.map(({ item: candidate, distanceKm }) => {
      const fallbackScore = fallbackScores.find((s) => s.candidateId === String(candidate._id)) || {
        matchScore: 0,
        confidence: 0,
        reasoning: ["Both AI scorers failed"],
        provider: "rule-based-fallback",
      };
      return {
        candidate,
        score: fallbackScore.matchScore,
        confidence: fallbackScore.confidence,
        breakdown: {
          provider: fallbackScore.provider,
          confidence: fallbackScore.confidence,
          reasoning: fallbackScore.reasoning,
        },
        distanceKm,
      };
    });
  }

  // Blend scores: 50% Python + 50% Gemini
  const scoreByCandidateId = new Map();

  candidatesWithDistance.forEach(({ item: candidate }) => {
    const candidateId = String(candidate._id);
    const pythonScore = pythonScores.find((s) => s.candidateId === candidateId);
    const geminiScore = geminiScores.find((s) => s.candidateId === candidateId);

    let blendedScore = 0;
    let blendedConfidence = 0;
    let provider = "mixed";
    let reasoning = [];

    if (pythonScore && geminiScore) {
      // Both available: 50/50 blend
      blendedScore = (pythonScore.matchScore * 0.5) + (geminiScore.matchScore * 0.5);
      blendedConfidence = (pythonScore.confidence * 0.5) + (geminiScore.confidence * 0.5);
      reasoning = [
        `Python: ${Math.round(pythonScore.matchScore)}/100`,
        `Gemini: ${Math.round(geminiScore.matchScore)}/100`,
        `Blended (50/50): ${Math.round(blendedScore)}/100`,
      ];
    } else if (pythonScore) {
      // Only Python available
      blendedScore = pythonScore.matchScore;
      blendedConfidence = pythonScore.confidence;
      provider = "local-python-matcher";
      reasoning = pythonScore.reasoning;
    } else if (geminiScore) {
      // Only Gemini available
      blendedScore = geminiScore.matchScore;
      blendedConfidence = geminiScore.confidence;
      provider = "gemini";
      reasoning = geminiScore.reasoning;
    }

    scoreByCandidateId.set(candidateId, {
      matchScore: Math.round(blendedScore * 100) / 100,
      confidence: Math.round(blendedConfidence * 100) / 100,
      reasoning,
      provider,
    });
  });

  return candidatesWithDistance.map(({ item: candidate, distanceKm }) => {
    const blended = scoreByCandidateId.get(String(candidate._id)) || {
      matchScore: 0,
      confidence: 0,
      reasoning: ["No scores available"],
      provider: "none",
    };

    return {
      candidate,
      score: blended.matchScore,
      confidence: blended.confidence,
      breakdown: {
        provider: blended.provider,
        confidence: blended.confidence,
        reasoning: blended.reasoning,
      },
      distanceKm,
    };
  });
}

function mapScoresToCandidates(candidatesWithDistance, scores, provider) {
  const scoreByCandidateId = new Map(
    scores.map((score) => [String(score.candidateId), score])
  );

  return candidatesWithDistance.map(({ item: candidate, distanceKm }) => {
    const score = scoreByCandidateId.get(String(candidate._id)) || {
      matchScore: 0,
      confidence: 0,
      reasoning: [`No ${provider} score returned`],
      provider,
    };

    return {
      candidate,
      score: score.matchScore,
      confidence: score.confidence,
      breakdown: {
        provider: score.provider || provider,
        confidence: score.confidence,
        reasoning: score.reasoning,
      },
      distanceKm,
    };
  });
}

// Find matches for a specific item
export const findMatches = async (req, res) => {
  try {
    const { itemId } = req.params;
    
    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({ 
        success: false, 
        message: "Item not found" 
      });
    }

    // Check if item has location
    const itemCoords = item.location?.coordinates?.coordinates;
    if (!itemCoords) {
      return res.status(400).json({ 
        success: false, 
        message: "Item must have location to find matches" 
      });
    }

    // Find opposite type items within 20km radius
    const oppositeType = item.type === "LOST" ? "FOUND" : "LOST";
    
    const candidates = await Item.find({
      type: oppositeType,
      status: "ACTIVE",
      _id: { $ne: itemId },
      "location.coordinates": {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: itemCoords
          },
          $maxDistance: GEO_RADIUS_METERS
        }
      }
    }).limit(100);

    const candidatesWithDistance = buildCandidatesWithDistance(itemCoords, candidates);
    const scoredCandidates = await scoreCandidatesForItem(item, candidatesWithDistance);

    // Calculate scores for all candidates
    const matches = scoredCandidates.map(({ candidate, score, breakdown, distanceKm }) => {
      return {
        item: candidate,
        matchScore: score,
        matchStrength: getMatchStrength(score),
        breakdown,
        distanceKm: distanceKm ? distanceKm.toFixed(2) : null,
      };
    });

    // Sort by score and filter
    matches.sort((a, b) => b.matchScore - a.matchScore);
    const goodMatches = matches.filter(m => m.matchScore >= MIN_MATCH_SCORE);
    
    // Count by strength
    const strongMatches = goodMatches.filter(m => m.matchStrength === "strong").length;
    const mediumMatches = goodMatches.filter(m => m.matchStrength === "medium").length;
    const weakMatches = goodMatches.filter(m => m.matchStrength === "weak").length;

    res.status(200).json({
      success: true,
      sourceItem: {
        _id: item._id,
        name: item.itemName,
        type: item.type,
        category: item.category
      },
      totalCandidates: candidates.length,
      matchesFound: goodMatches.length,
      matchSummary: {
        strong: strongMatches,
        medium: mediumMatches,
        weak: weakMatches
      },
      matches: goodMatches.slice(0, 20) // Top 20 matches
    });
  } catch (error) {
    console.error("Error finding matches:", error);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error" 
    });
  }
};

// Get matches for all user's items
export const getMyItemMatches = async (req, res) => {
  try {
    const { clerkUserId } = req;
    
    const user = await getOrCreateUser(clerkUserId);
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: "User not found" 
      });
    }

    // Get user's active items with location
    const userItems = await Item.find({ 
      user: user._id, 
      status: "ACTIVE",
      "location.coordinates": { $exists: true }
    });

    if (userItems.length === 0) {
      return res.status(200).json({
        success: true,
        itemsWithMatches: 0,
        results: []
      });
    }

    const results = [];
    
    // Process each user item
    for (const item of userItems) {
      const itemCoords = item.location?.coordinates?.coordinates;
      if (!itemCoords) continue;

      const oppositeType = item.type === "LOST" ? "FOUND" : "LOST";
      
      // Find candidates within 20km
      const candidates = await Item.find({
        type: oppositeType,
        status: "ACTIVE",
        _id: { $ne: item._id },
        "location.coordinates": {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: itemCoords
            },
            $maxDistance: GEO_RADIUS_METERS
          }
        }
      }).limit(50);

      const candidatesWithDistance = buildCandidatesWithDistance(itemCoords, candidates);
      const scoredCandidates = await scoreCandidatesForItem(item, candidatesWithDistance);

      // Score and filter
      const topMatches = scoredCandidates
        .map(({ candidate, score, breakdown }) => ({
          candidate,
          score,
          matchStrength: getMatchStrength(score),
          breakdown,
        }))
        .filter(m => m.score >= MIN_MATCH_SCORE)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5); // Top 5 per item

      if (topMatches.length > 0) {
        results.push({
          itemId: item._id,
          itemName: item.itemName,
          itemType: item.type,
          matchCount: topMatches.length,
          topMatches: topMatches.map(m => ({
            _id: m.candidate._id,
            name: m.candidate.itemName,
            type: m.candidate.type,
            category: m.candidate.category,
            matchScore: m.score,
            matchStrength: m.matchStrength,
            location: m.candidate.location?.name,
            breakdown: m.breakdown
          }))
        });
      }
    }

    res.status(200).json({
      success: true,
      itemsWithMatches: results.length,
      totalItems: userItems.length,
      results
    });
  } catch (error) {
    console.error("Error getting matches:", error);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error" 
    });
  }
};

// Get matched item by two item IDs
export const getMatchedItemByItems = async (req, res) => {
  try {
    const { clerkUserId } = req;
    const { item1Id, item2Id } = req.query;

    if (!item1Id || !item2Id) {
      return res.status(400).json({
        success: false,
        message: "Both item1Id and item2Id are required"
      });
    }

    const user = await getOrCreateUser(clerkUserId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found"
      });
    }

    // Find matched item (could be in either direction)
    const matchedItem = await MatchedItem.findOne({
      $or: [
        { sourceItem: item1Id, matchedItem: item2Id },
        { sourceItem: item2Id, matchedItem: item1Id }
      ]
    }).populate('sourceItem matchedItem sourceUser matchedUser');

    if (!matchedItem) {
      return res.status(404).json({
        success: false,
        message: "Matched item not found"
      });
    }

    // Verify user is part of this match
    const isParticipant = 
      matchedItem.sourceUser._id.toString() === user._id.toString() ||
      matchedItem.matchedUser._id.toString() === user._id.toString();

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: "You are not part of this match"
      });
    }

    res.status(200).json({
      success: true,
      matchedItem
    });
  } catch (error) {
    console.error("Error getting matched item:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

export const getMatchedItemById = async (req, res) => {
  try {
    const { clerkUserId } = req;
    const { id } = req.params;

    const user = await getOrCreateUser(clerkUserId);
    if (!user) return res.status(401).json({ success: false, message: "User not found" });

    const matchedItem = await MatchedItem.findById(id)
      .populate("sourceItem matchedItem sourceUser matchedUser");

    if (!matchedItem) return res.status(404).json({ success: false, message: "Match not found" });

    const isParticipant =
      String(matchedItem.sourceUser._id) === String(user._id) ||
      String(matchedItem.matchedUser._id) === String(user._id);

    if (!isParticipant) return res.status(403).json({ success: false, message: "Not a participant" });

    res.json({ success: true, matchedItem });
  } catch (error) {
    console.error("Error getting matched item:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Auto-run matching when a new item is created
export const autoMatchNewItem = async (itemId) => {
  try {
    console.log(`\n🔍 Starting auto-match for item: ${itemId}`);
    
    const item = await Item.findById(itemId).populate('user');
    if (!item) {
      console.error("❌ Item not found for auto-matching:", itemId);
      return;
    }

    console.log(`✓ Item found: ${item.itemName} (${item.type})`);

    // Check if item has location
    const itemCoords = item.location?.coordinates?.coordinates;
    if (!itemCoords) {
      console.log("⚠️ Item has no coordinates, skipping auto-match:", itemId);
      return;
    }

    console.log(`✓ Item coordinates: [${itemCoords[0]}, ${itemCoords[1]}]`);

    // Find opposite type items within 20km
    const oppositeType = item.type === "LOST" ? "FOUND" : "LOST";
    console.log(`🔎 Looking for ${oppositeType} items within ${GEO_RADIUS_KM}km...`);
    
    const candidates = await Item.find({
      type: oppositeType,
      status: "ACTIVE",
      _id: { $ne: itemId },
      "location.coordinates": {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: itemCoords
          },
          $maxDistance: GEO_RADIUS_METERS
        }
      }
    }).limit(100).populate('user');

    console.log(`✓ Found ${candidates.length} candidate items`);

    const candidatesWithDistance = buildCandidatesWithDistance(itemCoords, candidates);
    const scoredCandidates = await scoreCandidatesForItem(item, candidatesWithDistance);

    // Score all candidates and filter by minimum score
    const matchesToSave = [];
    
    for (const { candidate, score, breakdown, distanceKm } of scoredCandidates) {
      console.log(`  - ${candidate.itemName}: Score ${score.toFixed(1)} (${getMatchStrength(score)})`);
      
      // Only save matches above minimum threshold
      if (score >= MIN_MATCH_SCORE) {
        matchesToSave.push({
          sourceItem: item._id,
          matchedItem: candidate._id,
          sourceUser: item.user._id,
          matchedUser: candidate.user._id,
          matchScore: score,
          matchStrength: getMatchStrength(score),
          breakdown,
          distanceKm,
          status: "pending",
          viewedBySource: false,
          notificationSent: false
        });
      }
    }

    console.log(`\n📊 Matches to save: ${matchesToSave.length}`);

    // Bulk insert matches (ignore duplicates)
    if (matchesToSave.length > 0) {
      await MatchedItem.insertMany(matchesToSave, { ordered: false })
        .catch(err => {
          // Ignore duplicate key errors (code 11000)
          if (err.code !== 11000) {
            console.error("❌ Error saving matches:", err);
            throw err;
          } else {
            console.log("⚠️ Some duplicate matches were skipped");
          }
        });
      
      console.log(`✅ Successfully saved ${matchesToSave.length} matches to database`);
      
      // Count by strength for logging
      const strong = matchesToSave.filter(m => m.matchStrength === "strong").length;
      const medium = matchesToSave.filter(m => m.matchStrength === "medium").length;
      const weak = matchesToSave.filter(m => m.matchStrength === "weak").length;
      
      console.log(`   💪 Strong: ${strong}, 👍 Medium: ${medium}, 👌 Weak: ${weak}`);

      // Create notifications for medium and strong matches
      const notificationsToCreate = [];
      
      for (const match of matchesToSave) {
        if (match.matchStrength === "strong" || match.matchStrength === "medium") {
          const matchedItem = candidates.find(c => c._id.toString() === match.matchedItem.toString());
          
          const notificationTitle = match.matchStrength === "strong" 
            ? "🎯 Strong Match Found!"
            : "✨ Possible Match Found";
          
          // Notification for the user who just reported the item
          const notificationBodyForSource = `Your ${item.type.toLowerCase()} item "${item.itemName}" matches with a ${matchedItem.type.toLowerCase()} item "${matchedItem.itemName}" (${match.matchScore.toFixed(0)}% match)`;
          
          notificationsToCreate.push({
            user: item.user._id,
            title: notificationTitle,
            body: notificationBodyForSource,
            item: matchedItem._id,
            read: false,
            meta: {
              matchScore: match.matchScore,
              matchStrength: match.matchStrength,
              matchedItemId: matchedItem._id,
              sourceItemId: item._id
            }
          });

          // Notification for the user who owns the matched item
          const notificationBodyForMatched = `Your ${matchedItem.type.toLowerCase()} item "${matchedItem.itemName}" matches with a ${item.type.toLowerCase()} item "${item.itemName}" (${match.matchScore.toFixed(0)}% match)`;
          
          notificationsToCreate.push({
            user: matchedItem.user._id,
            title: notificationTitle,
            body: notificationBodyForMatched,
            item: item._id,
            read: false,
            meta: {
              matchScore: match.matchScore,
              matchStrength: match.matchStrength,
              matchedItemId: item._id,
              sourceItemId: matchedItem._id
            }
          });
        }
      }

      // Save notifications
      if (notificationsToCreate.length > 0) {
        await Notification.insertMany(notificationsToCreate);
        const strongCount = notificationsToCreate.filter(n => n.title.includes("Strong")).length;
        const mediumCount = notificationsToCreate.filter(n => n.title.includes("Possible")).length;
        console.log(`🔔 Created ${notificationsToCreate.length} notifications for both users (${strongCount} strong, ${mediumCount} medium)\n`);
      }
      
    } else {
      console.log(`⚠️ No matches found above threshold (${MIN_MATCH_SCORE}) for item ${itemId}\n`);
    }

  } catch (error) {
    console.error("❌ Error in auto-matching:", error);
    console.error(error.stack);
  }
};
