import Item from "../models/item.model.js";
import User from "../models/user.model.js";
import cloudinary from "../config/cloudinary.js";
import { autoMatchNewItem } from "./matching.js";
import { getOrCreateUser } from "../utils/userSync.js";

// Controller to handle reporting lost or found items
export const reportItem = async (req, res) => {
  console.log(req.body)
  try {
    const {
      name,
      description,
      location,
      date,
      category,
      brandName,
      color,
      image, // Now expects { url, publicId } object
      type,
      coords, // { latitude, longitude }
    } = req.body;
    const user = await getOrCreateUser(req.clerkUserId);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "User authentication failed"
      });
    }

    // Validate required fields
    if (!name || !description || !location || !date || !category || !color || !type) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: name, description, location, date, category, color, type",
      });
    }

    // Validate type
    if (!["lost", "found"].includes(type.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: "Invalid type. Must be 'lost' or 'found'",
      });
    }

    // Validate image for FOUND items
    if (type.toUpperCase() === "FOUND" && (!image || !image.url)) {
      return res.status(400).json({
        success: false,
        message: "Image is required for found items",
      });
    }

    // Prepare image data - handle both old string format and new object format
    let imageData = null;
    if (image) {
      if (typeof image === "string") {
        // Legacy: plain URL string
        imageData = { url: image, publicId: null };
      } else if (typeof image === "object" && image.url) {
        // New format: { url, publicId }
        imageData = { url: image.url, publicId: image.publicId || null };
      }
    }

    // If a publicId is provided, verify the resource still exists in Cloudinary
    if (imageData?.publicId) {
      try {
        await cloudinary.api.resource(imageData.publicId);
      } catch (err) {
        console.error("Image verification failed:", err?.message || err);
        return res.status(400).json({
          success: false,
          message: "Uploaded image not found or expired. Please re-upload the image.",
        });
      }
    }

    // Prepare item data
    const itemData = {
      type: type.toUpperCase(),
      itemName: name,
      description,
      category,
      color,
      brandName: brandName || "",
      image: imageData,
      location: {
        name: location,
        coordinates: {
          type: "Point",
          coordinates: [coords.longitude, coords.latitude], // [lng, lat]
        },
      },
      dateTime: new Date(date),
      user: user._id,
      status: "ACTIVE",
    };
    // Create and save the item
    const newItem = new Item(itemData);
    await newItem.save();

    console.log(`📝 Item saved: ${newItem._id} - Starting background matching...`);

    // Run matching algorithm in background (non-blocking)
    autoMatchNewItem(newItem._id).catch(err => {
      console.error("❌ Background matching failed:", err);
    });

    res.status(201).json({
      success: true,
      message: `${type.charAt(0).toUpperCase() + type.slice(1)} item reported successfully`,
      item: newItem,
    });
  } catch (error) {
    console.error("Error reporting item:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Controller to get all items (for testing or listing)
export const getItems = async (req, res) => {
  console.log("Fetching items...");
  try {
    const items = await Item.find().populate("user", "name email");
    res.status(200).json({
      success: true,
      items,
    });
  } catch (error) {
    console.error("Error fetching items:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Controller to delete an item (only owner can delete)
export const deleteItem = async (req, res) => {
  try {
    const itemId = req.params.id;
    const user = await getOrCreateUser(req.clerkUserId);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User authentication failed' });
    }

    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    // Only the owner can delete their item
    if (String(item.user) !== String(user._id)) {
      return res.status(403).json({ success: false, message: 'You are not authorized to delete this item' });
    }

    // If image has publicId, attempt to remove it from Cloudinary
    if (item.image && item.image.publicId) {
      try {
        await cloudinary.uploader.destroy(item.image.publicId);
      } catch (err) {
        console.warn('Cloudinary deletion failed for', item.image.publicId, err?.message || err);
        // Do not fail the whole request if image cleanup fails
      }
    }

    await item.deleteOne();

    res.status(200).json({ success: true, message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
