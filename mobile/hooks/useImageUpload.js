import axios from "axios";
import { Platform } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { API_URL } from "../config/env";

export const useImageUpload = () => {
  const { getToken } = useAuth();

  /**
   * Upload image to temp folder
   * @param {string} uri - Local image URI
   * @param {function} onProgress - Progress callback (0-100)
   * @returns {Promise<{url: string, publicId: string}>} - Cloudinary URL and publicId
   */
  const uploadImage = async (uri, onProgress) => {
    const token = await getToken({ skipCache: true });
    if (!token) throw new Error("Not authenticated");
    if (!API_URL) throw new Error("API URL is not configured");

    const normalizedUri = Platform.OS === "ios" ? uri.replace("file://", "") : uri;

    const formData = new FormData();
    formData.append("image", {
      uri: normalizedUri,
      type: "image/jpeg",
      name: "item.jpg",
    });

    // Fallback progress simulator in case server doesn't provide total
    let fallbackTimer = null;
    let lastPercent = 0;
    const startFallback = () => {
      if (!onProgress) return;
      fallbackTimer = setInterval(() => {
        // Increment slowly up to 95%
        lastPercent = Math.min(95, lastPercent + Math.floor(Math.random() * 3) + 1);
        try { onProgress(lastPercent); } catch (e) {}
      }, 700);
    };

    try {
      // Start fallback to ensure UI shows progress even when `total` is not provided
      startFallback();

      const response = await axios.post(
        `${API_URL}/upload/temp`, // Upload to temp folder
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
          onUploadProgress: (progressEvent) => {
            if (!onProgress) return;

            // If server provides a total, use it for accurate progress
            if (progressEvent?.total) {
              let percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              percent = Math.min(percent, 95);
              lastPercent = Math.max(lastPercent, percent);
              try { onProgress(lastPercent); } catch (e) {}
              return;
            }

            // If total is missing, try to make a best-effort estimate from loaded bytes
            if (progressEvent?.loaded) {
              // Heuristic: normalize loaded against a soft cap to produce a rising value
              const estimate = Math.min(95, Math.round((progressEvent.loaded / (progressEvent.loaded + 250000)) * 100));
              lastPercent = Math.max(lastPercent, estimate);
              try { onProgress(lastPercent); } catch (e) {}
            }
          },
        }
      );

      // Finished: clear fallback and report completion
      if (fallbackTimer) clearInterval(fallbackTimer);
      if (onProgress) onProgress(100);

      return {
        url: response.data.url,
        publicId: response.data.publicId,
      };
    } catch (error) {
      if (fallbackTimer) clearInterval(fallbackTimer);
      console.error("Image upload failed", error.response?.data || error.message);
      // Reset progress on error
      if (onProgress) try { onProgress(0); } catch (e) {}
      throw error;
    }
  };

  return { uploadImage };
};
