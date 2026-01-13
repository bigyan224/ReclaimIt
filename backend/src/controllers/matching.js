import Item from "../models/item.model.js";
import MatchedItem from "../models/matchedItem.model.js";
import User from "../models/user.model.js";
import Notification from "../models/notification.model.js";
import { getOrCreateUser } from "../utils/userSync.js";

// Simple configuration
const GEO_RADIUS_KM = 20;
const GEO_RADIUS_METERS = 20 * 1000;
const MIN_MATCH_SCORE = 40; // Out of 100

// Match strength thresholds for notifications
const MATCH_STRONG = 70;   // 70+ = strong match
const MATCH_MEDIUM = 50;   // 50-69 = medium match
// 40-49 = weak match

// Simple string similarity using Levenshtein distance
function stringSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  
  const distance = levenshteinDistance(s1, s2);
  const maxLen = Math.max(s1.length, s2.length);
  
  return maxLen === 0 ? 0 : (maxLen - distance) / maxLen;
}

function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2[i - 1] === str1[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

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

// Calculate match score - simple and straightforward
function calculateScore(item, candidate) {
  let score = 0;
  const breakdown = {};

  // 1. Title similarity (35 points) - Most important
  const titleSim = stringSimilarity(item.itemName, candidate.itemName);
  const titleScore = titleSim * 35;
  score += titleScore;
  breakdown.title = { 
    similarity: titleSim.toFixed(2), 
    score: titleScore.toFixed(2) 
  };

  // 2. Color similarity (25 points) - Very important
  if (item.color && candidate.color) {
    const colorSim = stringSimilarity(item.color, candidate.color);
    const colorScore = colorSim * 25;
    score += colorScore;
    breakdown.color = { 
      similarity: colorSim.toFixed(2), 
      score: colorScore.toFixed(2) 
    };
  }

  // 3. Brand similarity (20 points) - Important if provided
  if (item.brandName && candidate.brandName) {
    const brandSim = stringSimilarity(item.brandName, candidate.brandName);
    const brandScore = brandSim * 20;
    score += brandScore;
    breakdown.brand = { 
      similarity: brandSim.toFixed(2), 
      score: brandScore.toFixed(2) 
    };
  }

  // 4. Category (20 points if exact match, 5 points otherwise)
  const categoryMatch = item.category?.toLowerCase() === candidate.category?.toLowerCase();
  const categoryScore = categoryMatch ? 20 : 5;
  score += categoryScore;
  breakdown.category = { 
    match: categoryMatch, 
    score: categoryScore 
  };

  return {
    totalScore: Math.round(score * 100) / 100,
    breakdown
  };
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

    // Calculate scores for all candidates
    const matches = candidates.map(candidate => {
      const candCoords = candidate.location?.coordinates?.coordinates;
      const distance = candCoords ? calculateDistance(itemCoords, candCoords) : null;
      
      const scoring = calculateScore(item, candidate);
      
      return {
        item: candidate,
        matchScore: scoring.totalScore,
        matchStrength: getMatchStrength(scoring.totalScore),
        breakdown: scoring.breakdown,
        distanceKm: distance ? distance.toFixed(2) : null
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

      // Score and filter
      const topMatches = candidates
        .map(candidate => {
          const scoring = calculateScore(item, candidate);
          return {
            candidate,
            score: scoring.totalScore,
            matchStrength: getMatchStrength(scoring.totalScore),
            breakdown: scoring.breakdown
          };
        })
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

    // Score all candidates and filter by minimum score
    const matchesToSave = [];
    
    for (const candidate of candidates) {
      const candCoords = candidate.location?.coordinates?.coordinates;
      const distance = candCoords ? calculateDistance(itemCoords, candCoords) : null;
      
      const scoring = calculateScore(item, candidate);
      
      console.log(`  - ${candidate.itemName}: Score ${scoring.totalScore.toFixed(1)} (${getMatchStrength(scoring.totalScore)})`);
      
      // Only save matches above minimum threshold
      if (scoring.totalScore >= MIN_MATCH_SCORE) {
        matchesToSave.push({
          sourceItem: item._id,
          matchedItem: candidate._id,
          sourceUser: item.user._id,
          matchedUser: candidate.user._id,
          matchScore: scoring.totalScore,
          matchStrength: getMatchStrength(scoring.totalScore),
          breakdown: scoring.breakdown,
          distanceKm: distance,
          status: "pending",
          viewedBySource: false,
          notificationSent: false
        });
      }
    }

    console.log(`\n📊 Matches to save: ${matchesToSave.length}`);

    // Bulk insert matches (ignore duplicates)
    if (matchesToSave.length > 0) {
      const result = await MatchedItem.insertMany(matchesToSave, { ordered: false })
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
