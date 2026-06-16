import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    clerkId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
    },
    name: {
      type: String,
    },
    role: {
      type: String,
      enum: ["USER", "ADMIN"],
      default: "USER",
    },
    status: {
      type: String,
      enum: ["ACTIVE", "FLAGGED", "BANNED"],
      default: "ACTIVE",
      index: true,
    },
    institutions: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Institution",
      default: [],
      index: true,
    },
    adminInstitutions: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Institution",
      default: [],
      index: true,
    },
    agreedToTerms: {
      type: Boolean,
      default: false,
    },
    agreedToTermsAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
