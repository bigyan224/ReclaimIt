import cron from "cron";
import cloudinary from "./cloudinary.js";
import Item from "../models/item.model.js";
import { createLogger } from "./logger.js";

const log = createLogger("cleanup");

// Cleanup threshold: 1 hour in milliseconds
const CLEANUP_THRESHOLD_MS = 60 * 60 * 1000;

/**
 * Cleanup orphaned temp images from Cloudinary
 * 
 * This job:
 * 1. Fetches all images from reclaimit/temp folder
 * 2. Checks each image's age (using created_at from Cloudinary)
 * 3. Checks if the image's publicId is referenced in any Item document
 * 4. Deletes images that are:
 *    - Older than CLEANUP_THRESHOLD_MS (1 hour)
 *    - NOT referenced in any Item.image.publicId
 */
const cleanupTempImages = async () => {
  log.debug("Starting temp image cleanup job");

  try {
    // Fetch all images from reclaimit/temp folder
    const result = await cloudinary.api.resources({
      type: "upload",
      prefix: "reclaimit/temp",
      max_results: 500, // Adjust based on expected volume
    });

    if (!result.resources || result.resources.length === 0) {
      log.debug("No temp images found");
      return;
    }

    log.debug("Temp images to check", { count: result.resources.length });

    const now = Date.now();
    let deletedCount = 0;
    let skippedCount = 0;

    for (const resource of result.resources) {
      const createdAt = new Date(resource.created_at).getTime();
      const ageMs = now - createdAt;

      // Skip images that are not old enough
      if (ageMs < CLEANUP_THRESHOLD_MS) {
        skippedCount++;
        continue;
      }

      // Check if this publicId is referenced in any Item
      const isReferenced = await Item.exists({ "image.publicId": resource.public_id });

      if (isReferenced) {
        // Image is used by an item, don't delete
        skippedCount++;
        continue;
      }

      // Image is orphaned and old enough - delete it
      try {
        await cloudinary.uploader.destroy(resource.public_id);
        deletedCount++;
        log.debug("Deleted orphaned image", { publicId: resource.public_id });
      } catch (deleteError) {
        log.warn("Failed to delete orphaned image", { publicId: resource.public_id, err: deleteError });
      }
    }

    log.info("Temp image cleanup completed", { deleted: deletedCount, skipped: skippedCount });
  } catch (error) {
    log.error("Error during temp image cleanup", error);
  }
};

// Run every 30 minutes
// Cron expression: "*/30 * * * *" = every 30 minutes
const tempImageCleanupJob = new cron.CronJob("*/30 * * * *", cleanupTempImages);

// Export for manual testing
export { cleanupTempImages };
export default tempImageCleanupJob;
