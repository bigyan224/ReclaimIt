import mongoose from "mongoose";

const ChatSchema = new mongoose.Schema(
  {
    // The two participants in the conversation
    participants: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    }],

    // Reference to the matched item that initiated this chat
    matchedItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MatchedItem",
      required: true,
      index: true,
    },

    // The two items involved in the match
    items: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
    }],

    // Last message preview
    lastMessage: {
      type: String,
      default: "",
    },

    // When was the last message sent
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },

    // Who sent the last message
    lastMessageBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Unread count for each participant
    unreadCount: {
      type: Map,
      of: Number,
      default: {},
    },

    // Chat status
    status: {
      type: String,
      enum: ["active", "archived", "blocked"],
      default: "active",
    },
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
ChatSchema.index({ participants: 1, status: 1, lastMessageAt: -1 });

// Ensure exactly 2 participants
ChatSchema.pre("save", function () {
  if (this.participants.length !== 2) {
    throw new Error("Chat must have exactly 2 participants");
  }
});

export default mongoose.models.Chat || mongoose.model("Chat", ChatSchema);
