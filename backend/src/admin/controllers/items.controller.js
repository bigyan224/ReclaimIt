import cloudinary from "../../config/cloudinary.js";
import Item from "../../models/item.model.js";
import MatchedItem from "../../models/matchedItem.model.js";
import Notification from "../../models/notification.model.js";
import { ITEM_STATUSES } from "../utils/constants.js";
import { buildPagination, parsePagination } from "../utils/pagination.js";
import { itemInstitutionFilter } from "../utils/institutionFilter.js";
import { safeRegex } from "../utils/safeSearch.js";

export const listItems = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const search = String(req.query.search || "").trim();
    const status = String(req.query.status || "").toUpperCase();
    const type = String(req.query.type || "").toUpperCase();

    const filter = { ...itemInstitutionFilter(req) };
    if (ITEM_STATUSES.includes(status)) filter.status = status;
    if (["LOST", "FOUND"].includes(type)) filter.type = type;
    const searchPattern = safeRegex(search);
    if (searchPattern) {
      filter.$or = [
        { itemName: searchPattern },
        { description: searchPattern },
        { category: searchPattern },
        { "location.name": searchPattern },
      ];
    }

    const [items, total] = await Promise.all([
      Item.find(filter)
        .populate("user", "name email clerkId role status")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Item.countDocuments(filter),
    ]);

    res.status(200).json({ success: true, items, pagination: buildPagination({ page, limit, total }) });
  } catch (error) {
    console.error("Admin list items error:", error);
    res.status(500).json({ success: false, message: "Failed to load items" });
  }
};

export const updateItemStatus = async (req, res) => {
  try {
    const status = String(req.body.status || "").toUpperCase();
    if (!ITEM_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Use one of: ${ITEM_STATUSES.join(", ")}` });
    }

    const item = await Item.findByIdAndUpdate(req.params.id, { status }, { new: true }).populate("user", "name email clerkId role status");
    if (!item) {
      return res.status(404).json({ success: false, message: "Item not found" });
    }

    res.status(200).json({ success: true, item });
  } catch (error) {
    console.error("Admin update item status error:", error);
    res.status(500).json({ success: false, message: "Failed to update item status" });
  }
};

export const quickEditItem = async (req, res) => {
  try {
    const allowed = ["itemName", "description", "category", "color", "brandName"];
    const patch = {};

    for (const key of allowed) {
      if (typeof req.body[key] === "string") patch[key] = req.body[key].trim();
    }

    const item = await Item.findByIdAndUpdate(req.params.id, patch, { new: true, runValidators: true }).populate("user", "name email clerkId role status");
    if (!item) {
      return res.status(404).json({ success: false, message: "Item not found" });
    }

    res.status(200).json({ success: true, item });
  } catch (error) {
    console.error("Admin quick edit item error:", error);
    res.status(500).json({ success: false, message: "Failed to edit item" });
  }
};

export const deleteItemAsAdmin = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: "Item not found" });
    }

    if (item.image?.publicId) {
      try {
        await cloudinary.uploader.destroy(item.image.publicId);
      } catch (error) {
        console.warn("Admin Cloudinary cleanup failed:", error?.message || error);
      }
    }

    await Promise.all([
      MatchedItem.deleteMany({ $or: [{ sourceItem: item._id }, { matchedItem: item._id }] }),
      Notification.deleteMany({
        $or: [
          { item: item._id },
          { "meta.sourceItemId": item._id },
          { "meta.matchedItemId": item._id },
        ],
      }),
    ]);

    await item.deleteOne();

    res.status(200).json({ success: true, message: "Item deleted" });
  } catch (error) {
    console.error("Admin delete item error:", error);
    res.status(500).json({ success: false, message: "Failed to delete item" });
  }
};
