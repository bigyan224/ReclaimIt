import mongoose from "mongoose";

const MatchedItemSchema = new mongoose.Schema(
  {
    // Source item (the item for which we found a match)
    sourceItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
      required: true,
      index: true,
    },

    // Matched item (the item that was matched)
    matchedItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
      required: true,
    },

    // Owner of the source item
    sourceUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Owner of the matched item
    matchedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Match score (0-100)
    matchScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },

    // Match strength: strong, medium, weak
    matchStrength: {
      type: String,
      enum: ["strong", "medium", "weak"],
      required: true,
    },

    // Detailed AI output for match scoring
    breakdown: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Distance between items in km
    distanceKm: {
      type: Number,
    },

    // Status of the match
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "expired"],
      default: "pending",
      index: true,
    },

    // Has the source user viewed this match?
    viewedBySource: {
      type: Boolean,
      default: false,
    },

    // Has the matched user been notified?
    notificationSent: {
      type: Boolean,
      default: false,
    },

    // Claim tracking for item return
    claim: {
      status: {
        type: String,
        enum: ["NONE", "REQUESTED", "CONFIRMED"],
        default: "NONE",
      },
      requestedBy: {
        type: String,
        default: null,
      },
      confirmedBy: {
        type: String,
        default: null,
      },
      confirmedAt: {
        type: Date,
        default: null,
      },
    },

    // Response from matched user (optional message)
    response: {
      type: String,
      trim: true,
    },

    // When was this match accepted/rejected
    resolvedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
MatchedItemSchema.index({ sourceItem: 1, matchedItem: 1 }, { unique: true });
MatchedItemSchema.index({ sourceUser: 1, status: 1, createdAt: -1 });
MatchedItemSchema.index({ matchedUser: 1, status: 1, createdAt: -1 });
MatchedItemSchema.index({ status: 1, matchStrength: 1 });

// Prevent duplicate matches (A->B and B->A)
MatchedItemSchema.pre("save", async function () {
  const reverseMatch = await this.constructor.findOne({
    sourceItem: this.matchedItem,
    matchedItem: this.sourceItem,
  });

  if (reverseMatch) {
    const error = new Error("Reverse match already exists");
    error.code = "DUPLICATE_MATCH";
    throw error;
  }
});

export default mongoose.models.MatchedItem || mongoose.model("MatchedItem", MatchedItemSchema);
