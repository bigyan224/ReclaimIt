import mongoose from "mongoose";

const normalizeStringArray = (values) => {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => String(value || "").toLowerCase().trim())
    .filter(Boolean);
};

const isValidDomain = (value) =>
  /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(value);

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const isDomainOrEmail = (value) => isValidDomain(value) || isValidEmail(value);

const InstitutionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      default: "",
      maxlength: 1000,
    },
    logo: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },
    emailDomains: {
      type: [String],
      default: [],
      set: (values) => {
        const list = normalizeStringArray(values);
        const invalid = list.find((entry) => !isDomainOrEmail(entry));
        if (invalid) {
          throw new Error(`Invalid email domain or email: ${invalid}`);
        }
        return Array.from(new Set(list));
      },
    },
    adminEmails: {
      type: [String],
      default: [],
      set: (values) => {
        const list = normalizeStringArray(values);
        const invalid = list.find((email) => !isValidEmail(email));
        if (invalid) {
          throw new Error(`Invalid admin email: ${invalid}`);
        }
        return Array.from(new Set(list));
      },
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

InstitutionSchema.index({ emailDomains: 1, status: 1 });
InstitutionSchema.index({ adminEmails: 1, status: 1 });

export default mongoose.models.Institution ||
  mongoose.model("Institution", InstitutionSchema);
