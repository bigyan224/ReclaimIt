import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema(
  {
    // Reference to the chat this message belongs to
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
      index: true,
    },

    // Who sent the message
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Message content
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    // Message type (text, image, system)
    type: {
      type: String,
      enum: ["text", "image", "system"],
      default: "text",
    },

    // Optional image URL for image messages
    imageUrl: {
      type: String,
    },

    // Read status - array of user IDs who have read this message
    readBy: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }],

    // Delivery status
    status: {
      type: String,
      enum: ["sent", "delivered", "read"],
      default: "sent",
    },
  },
  { timestamps: true }
);

// Indexes for efficient queries
MessageSchema.index({ chat: 1, createdAt: -1 });
MessageSchema.index({ sender: 1, createdAt: -1 });

export default mongoose.models.Message || mongoose.model("Message", MessageSchema);
