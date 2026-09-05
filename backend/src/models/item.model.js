import mongoose from "mongoose";

const ItemSchema = new mongoose.Schema(
  {
    // LOST or FOUND
    type: {
      type: String,
      enum: ["LOST", "FOUND"],
      required: true,
      index: true,
    },

    itemName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    color: {
      type: String,
      trim: true,
      maxlength: 60,
    },

    brandName: {
      type: String,
      trim: true,
      maxlength: 60,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 2000,
    },

    category: {
      type: String,
      required: true,
      index: true,
      maxlength: 60,
    },

    // Image object with url and publicId for cleanup tracking
    image: {
      url: {
        type: String,
        validate: {
          validator: function (value) {
            // If FOUND → image url is required
            if (this.type === "FOUND") {
              if (!value) return false;
              // Enforce image file extensions or Cloudinary URLs
              return /\.(jpg|jpeg|png|webp)$/i.test(value) || value.includes("cloudinary");
            }
            // If LOST → image optional
            return true;
          },
          message: "Found items must include a valid image URL.",
        },
      },
      publicId: {
        type: String, // Cloudinary public_id for cleanup reference
      },

    },


    location: {
      name: {
        type: String, // human readable (optional but recommended)
        maxlength: 200,
      },

      coordinates: {
        type: {
          type: String,
          enum: ["Point"],
          default: "Point",
          required: true,
        },
        coordinates: {
          type: [Number], // [longitude, latitude]
          required: true,
        },
      },
    },

    dateTime: {
      type: Date,
      required: true,
    },

    // user who posted
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: ["ACTIVE", "MATCHED", "CLOSED", "FLAGGED", "ARCHIVED", "CLAIMED"],
      default: "ACTIVE",
    },

    claimedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    institution: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Institution",
      default: null,
      index: true,
    },

    visibility: {
      type: String,
      enum: ["PUBLIC", "INSTITUTION"],
      default: "PUBLIC",
      index: true,
    },
  },
  { timestamps: true }
);

// 🌍 Geo index (MANDATORY for location queries)
ItemSchema.index({ "location.coordinates": "2dsphere" });

// 📊 Compound indexes for matching queries
ItemSchema.index({ type: 1, status: 1, category: 1 });
ItemSchema.index({ type: 1, status: 1, createdAt: -1 });
ItemSchema.index({ status: 1, dateTime: -1 });
ItemSchema.index({ institution: 1, status: 1, createdAt: -1 });
ItemSchema.index({ visibility: 1, status: 1, createdAt: -1 });

/**
 * ✅ EXPORT THE MODEL
 * (prevents model overwrite errors in dev)
 */
export default mongoose.models.Item || mongoose.model("Item", ItemSchema);
