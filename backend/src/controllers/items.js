import Item from "../models/item.model.js";
import User from "../models/user.model.js";
import MatchedItem from "../models/matchedItem.model.js";
import Notification from "../models/notification.model.js";
import cloudinary from "../config/cloudinary.js";
import { autoMatchNewItem } from "./matching.js";
import { getOrCreateUser } from "../utils/userSync.js";
import { createLogger } from "../config/logger.js";

const log = createLogger("items");

// Controller to handle reporting lost or found items
export const reportItem = async (req, res) => {
  try {
    const {
      name,
      description,
      location,
      date,
      category,
      brandName,
      color,
      image,
      type,
      coords,
      institution: institutionId,
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

    // Validate coordinates are finite numbers in range (rejects NaN/strings/undefined)
    const lng = Number(coords?.longitude);
    const lat = Number(coords?.latitude);
    if (!Number.isFinite(lng) || !Number.isFinite(lat) || lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      return res.status(400).json({
        success: false,
        message: "Valid coordinates are required",
      });
    }

    let imageData = null;
    if (image) {
      if (typeof image === "string") {
        imageData = { url: image, publicId: null };
      } else if (typeof image === "object" && image.url) {
        imageData = {
          url: image.url,
          publicId: image.publicId || null,
        };
      }
    }

    // If a publicId is provided, verify the resource still exists in Cloudinary
    if (imageData?.publicId) {
      try {
        await cloudinary.api.resource(imageData.publicId);
      } catch (err) {
        log.debug("Image verification failed", err);
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
          coordinates: [lng, lat], // [lng, lat] — validated finite numbers above
        },
      },
      dateTime: new Date(date),
      user: user._id,
      status: "ACTIVE",
    };
    // If institution was provided, validate user is a member and assign it
    if (institutionId) {
      const userInstIds = [
        ...(user.institutions || []).map((id) => String(id)),
        ...(user.adminInstitutions || []).map((id) => String(id)),
      ];
      if (userInstIds.includes(String(institutionId))) {
        itemData.institution = institutionId;
        itemData.visibility = "INSTITUTION";
      }
    }

    // Create and save the item
    const newItem = new Item(itemData);
    await newItem.save();

    log.info("Item reported", { itemId: String(newItem._id), type: newItem.type });

    // Run matching algorithm in background (non-blocking), pass io for live notification push
    const io = req.app?.get("io") || null;
    autoMatchNewItem(newItem._id, io).catch(err => {
      log.error("Background matching failed", err);
    });

    res.status(201).json({
      success: true,
      message: `${type.charAt(0).toUpperCase() + type.slice(1)} item reported successfully`,
      item: newItem,
    });
  } catch (error) {
    log.error("Error reporting item", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Controller to get items with optional type, location, and institution filters
export const getItems = async (req, res) => {
  try {
    const filter = {};
    const { type, near, radius, institution } = req.query;
    // Bounded page size — the mobile app used to pull the entire collection
    // (with populate) on every open, which gets slower as data grows
    const limit = Math.min(Math.max(Number(req.query.limit || 100), 1), 200);

    if (type) filter.type = type.toUpperCase();

    if (institution) {
      const user = await getOrCreateUser(req.clerkUserId);
      if (!user) return res.status(401).json({ success: false, message: "Unauthorized" });
      const userInstIds = [
        ...(user.institutions || []).map((id) => String(id)),
        ...(user.adminInstitutions || []).map((id) => String(id)),
      ];
      if (!userInstIds.includes(String(institution))) {
        return res.status(403).json({ success: false, message: "Access denied" });
      }
      filter.institution = institution;
    }

    if (near) {
      const parts = String(near).split(",").map(Number);
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        const [lat, lng] = parts;
        const radiusMeters = (Number(radius) || 20) * 1000;
        filter["location.coordinates"] = {
          $near: {
            $geometry: { type: "Point", coordinates: [lng, lat] },
            $maxDistance: radiusMeters,
          },
        };
      }
    }

    const items = await Item.find(filter).populate("user", "name email clerkId").sort({ createdAt: -1 }).limit(limit);
    res.status(200).json({
      success: true,
      items,
    });
  } catch (error) {
    log.error("Error fetching items", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Lightweight counts for profile stats — one aggregation instead of pulling
// the whole collection with populate just to count two numbers
export const getMyItemsSummary = async (req, res) => {
  try {
    const { clerkUserId } = req;

    const user = await getOrCreateUser(clerkUserId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User authentication failed",
      });
    }

    const counts = await Item.aggregate([
      { $match: { user: user._id } },
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]);

    let found = 0;
    let lost = 0;
    for (const row of counts) {
      if (row._id === "FOUND") found = row.count;
      else if (row._id === "LOST") lost = row.count;
    }

    res.status(200).json({ success: true, found, lost, total: found + lost });
  } catch (error) {
    log.error("Error fetching my items summary", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getItemById = async (req, res) => {
  try {
    const { clerkUserId } = req;
    const { id } = req.params;

    const user = await getOrCreateUser(clerkUserId);
    if (!user) {
      return res.status(401).json({ success: false, message: "User authentication failed" });
    }

    const item = await Item.findById(id).populate("user", "name email clerkId");
    if (!item) {
      return res.status(404).json({ success: false, message: "Item not found" });
    }

    if (String(item.user?._id || item.user) !== String(user._id)) {
      return res.status(403).json({ success: false, message: "You are not authorized to edit this item" });
    }

    res.status(200).json({ success: true, item });
  } catch (error) {
    log.error("Error fetching item by id", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const updateItem = async (req, res) => {
  try {
    const { clerkUserId } = req;
    const { id } = req.params;

    const user = await getOrCreateUser(clerkUserId);
    if (!user) {
      return res.status(401).json({ success: false, message: "User authentication failed" });
    }

    const item = await Item.findById(id);
    if (!item) {
      return res.status(404).json({ success: false, message: "Item not found" });
    }

    if (String(item.user) !== String(user._id)) {
      return res.status(403).json({ success: false, message: "You are not authorized to update this item" });
    }

    const {
      name,
      description,
      location,
      date,
      category,
      brandName,
      color,
      image,
      type,
      coords,
    } = req.body;

    if (!name || !description || !location || !date || !category || !color || !type) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: name, description, location, date, category, color, type",
      });
    }

    if (!['lost', 'found'].includes(String(type).toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: "Invalid type. Must be 'lost' or 'found'",
      });
    }

    let imageData = item.image || null;
    if (image) {
      if (typeof image === 'string') {
        imageData = { url: image, publicId: null };
      } else if (typeof image === 'object' && image.url) {
        imageData = { url: image.url, publicId: image.publicId || null };
      }
    }

    if (String(type).toUpperCase() === 'FOUND' && (!imageData || !imageData.url)) {
      return res.status(400).json({
        success: false,
        message: 'Image is required for found items',
      });
    }

    const updLng = Number(coords?.longitude);
    const updLat = Number(coords?.latitude);
    if (!Number.isFinite(updLng) || !Number.isFinite(updLat) || updLng < -180 || updLng > 180 || updLat < -90 || updLat > 90) {
      return res.status(400).json({
        success: false,
        message: 'Valid coordinates are required',
      });
    }

    if (imageData?.publicId) {
      try {
        await cloudinary.api.resource(imageData.publicId);
      } catch (err) {
        log.debug("Image verification failed on update", err);
        return res.status(400).json({
          success: false,
          message: 'Uploaded image not found or expired. Please re-upload the image.',
        });
      }
    }

    item.type = String(type).toUpperCase();
    item.itemName = name;
    item.description = description;
    item.category = category;
    item.color = color;
    item.brandName = brandName || "";
    item.image = imageData;
    item.location = {
      name: location,
      coordinates: {
        type: 'Point',
        coordinates: [updLng, updLat],
      },
    };
    item.dateTime = new Date(date);
    item.status = 'ACTIVE';
    item.claimedBy = null;

    const savedItem = await item.save();

    await MatchedItem.deleteMany({
      $or: [{ sourceItem: savedItem._id }, { matchedItem: savedItem._id }],
    });

    await Notification.deleteMany({
      $or: [
        { 'meta.sourceItemId': savedItem._id },
        { 'meta.matchedItemId': savedItem._id },
        { item: savedItem._id },
      ],
    });

    log.info("Item updated", { itemId: String(savedItem._id) });

    // Run matching algorithm in background (non-blocking), pass io for live notification push
    const io = req.app?.get("io") || null;
    autoMatchNewItem(savedItem._id, io).catch(err => {
      log.error('Background matching failed on update', err);
    });

    const updatedItem = await Item.findById(savedItem._id).populate('user', 'name email clerkId');

    res.status(200).json({
      success: true,
      message: 'Item updated successfully',
      item: updatedItem,
    });
  } catch (error) {
    log.error('Error updating item', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
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
        log.warn('Cloudinary deletion failed', { publicId: item.image.publicId, err });
        // Do not fail the whole request if image cleanup fails
      }
    }

    await item.deleteOne();
    log.info("Item deleted", { itemId: String(itemId) });

    res.status(200).json({ success: true, message: 'Item deleted successfully' });
  } catch (error) {
    log.error('Error deleting item', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
