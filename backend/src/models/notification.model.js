import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema(
  {
    // The user who should receive the notification
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Short title for the notification
    title: {
      type: String,
      required: true,
      trim: true,
    },

    // Optional descriptive message/body
    body: {
      type: String,
      trim: true,
      default: "",
    },

    // Optional reference to an Item (or other resource) related to this notification
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
      default: null,
    },

    // Has the user seen/acknowledged this notification?
    read: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Any additional metadata (e.g., url, action type)
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

// Add an index so it is fast to query by user + unread
NotificationSchema.index({ user: 1, read: 1, createdAt: -1 });

export default mongoose.models.Notification || mongoose.model("Notification", NotificationSchema);
