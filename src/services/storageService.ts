import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  UploadResult,
} from "firebase/storage";
import { getStorageInstance } from "@/config/firebase";
import { AudioRecording } from "@/types";

export class StorageService {
  /**
   * Upload audio file to Firebase Storage
   */
  static async uploadAudio(
    audioRecording: AudioRecording,
    userId: string
  ): Promise<string> {
    try {
      const storage = getStorageInstance();

      // Create unique filename
      const timestamp = Date.now();
      const filename = `whispers/${userId}/${timestamp}.m4a`;
      const storagePath = `audio/${filename}`;

      // Create storage reference
      const storageRef = ref(storage, storagePath);

      // Convert URI to blob
      const response = await fetch(audioRecording.uri);
      const blob = await response.blob();

      // Upload to Firebase Storage
      const uploadResult: UploadResult = await uploadBytes(storageRef, blob, {
        contentType: "audio/m4a",
        customMetadata: {
          userId,
          duration: audioRecording.duration.toString(),
          volume: audioRecording.volume.toString(),
          isWhisper: audioRecording.isWhisper.toString(),
          timestamp: audioRecording.timestamp.toISOString(),
        },
      });

      // Get download URL
      const downloadURL = await getDownloadURL(uploadResult.ref);

      return downloadURL;
    } catch (error) {
      console.error("Error uploading audio:", error);
      throw new Error("Failed to upload audio file");
    }
  }

  /**
   * Delete audio file from Firebase Storage
   */
  static async deleteAudio(audioUrl: string): Promise<void> {
    try {
      const storage = getStorageInstance();

      // Extract path from URL
      const url = new URL(audioUrl);
      const path = decodeURIComponent(
        url.pathname.split("/o/")[1]?.split("?")[0] || ""
      );

      if (!path) {
        throw new Error("Invalid audio URL");
      }

      // Create storage reference
      const storageRef = ref(storage, path);

      // Delete file
      await deleteObject(storageRef);
    } catch (error) {
      console.error("Error deleting audio:", error);
      throw new Error("Failed to delete audio file");
    }
  }

  /**
   * Get download URL for audio file
   */
  static async getAudioDownloadURL(storagePath: string): Promise<string> {
    try {
      const storage = getStorageInstance();

      const storageRef = ref(storage, storagePath);
      return await getDownloadURL(storageRef);
    } catch (error) {
      console.error("Error getting download URL:", error);
      throw new Error("Failed to get download URL");
    }
  }

  /**
   * Refresh download URL for audio file (useful for expired URLs)
   */
  static async refreshAudioDownloadURL(audioUrl: string): Promise<string> {
    try {
      const storage = getStorageInstance();

      // Extract path from URL
      const url = new URL(audioUrl);
      const path = decodeURIComponent(
        url.pathname.split("/o/")[1]?.split("?")[0] || ""
      );

      if (!path) {
        throw new Error("Invalid audio URL");
      }

      // Create storage reference
      const storageRef = ref(storage, path);

      // Get fresh download URL
      return await getDownloadURL(storageRef);
    } catch (error) {
      console.error("Error refreshing download URL:", error);
      throw new Error("Failed to refresh download URL");
    }
  }

  /**
   * Check if a Firebase Storage URL is expired or invalid
   */
  static async isAudioUrlValid(audioUrl: string): Promise<boolean> {
    try {
      const response = await fetch(audioUrl, { method: "HEAD" });
      return response.ok;
    } catch (error) {
      console.warn("Audio URL validation failed:", error);
      return false;
    }
  }
}

export default StorageService;
