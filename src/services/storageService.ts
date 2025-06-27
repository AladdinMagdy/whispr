import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { storage } from "@/config/firebase";
import { STORAGE_PATHS } from "@/constants";

export interface UploadProgress {
  progress: number;
  bytesTransferred: number;
  totalBytes: number;
}

export interface UploadResult {
  url: string;
  path: string;
}

export class StorageService {
  /**
   * Upload audio file to Firebase Storage
   */
  static async uploadAudio(
    fileUri: string,
    userId: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    try {
      // Convert file URI to blob
      const response = await fetch(fileUri);
      const blob = await response.blob();

      // Generate unique filename
      const timestamp = Date.now();
      const filename = `whisper_${userId}_${timestamp}.m4a`;
      const storagePath = `${STORAGE_PATHS.AUDIO}/${userId}/${filename}`;

      // Create storage reference
      const storageRef = ref(storage, storagePath);

      // Upload with progress tracking
      const uploadTask = uploadBytesResumable(storageRef, blob);

      return new Promise((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const progress =
              (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            onProgress?.({
              progress,
              bytesTransferred: snapshot.bytesTransferred,
              totalBytes: snapshot.totalBytes,
            });
          },
          (error) => {
            console.error("Upload error:", error);
            reject(new Error("Failed to upload audio file"));
          },
          async () => {
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              resolve({
                url: downloadURL,
                path: storagePath,
              });
            } catch (error) {
              console.error("Error getting download URL:", error);
              reject(new Error("Failed to get download URL"));
            }
          }
        );
      });
    } catch (error) {
      console.error("Error uploading audio:", error);
      throw new Error("Failed to upload audio file");
    }
  }

  /**
   * Delete audio file from Firebase Storage
   */
  static async deleteAudio(storagePath: string): Promise<void> {
    try {
      const storageRef = ref(storage, storagePath);
      await deleteObject(storageRef);
    } catch (error) {
      console.error("Error deleting audio:", error);
      throw new Error("Failed to delete audio file");
    }
  }

  /**
   * Get download URL for a file
   */
  static async getDownloadURL(storagePath: string): Promise<string> {
    try {
      const storageRef = ref(storage, storagePath);
      return await getDownloadURL(storageRef);
    } catch (error) {
      console.error("Error getting download URL:", error);
      throw new Error("Failed to get download URL");
    }
  }

  /**
   * Generate storage path for audio file
   */
  static generateAudioPath(userId: string, filename?: string): string {
    const timestamp = Date.now();
    const finalFilename = filename || `whisper_${userId}_${timestamp}.m4a`;
    return `${STORAGE_PATHS.AUDIO}/${userId}/${finalFilename}`;
  }

  /**
   * Validate file before upload
   */
  static validateAudioFile(
    fileUri: string,
    maxSizeMB: number = 10
  ): Promise<boolean> {
    return new Promise((resolve) => {
      fetch(fileUri)
        .then((response) => {
          const contentLength = response.headers.get("content-length");
          if (contentLength) {
            const fileSizeMB = parseInt(contentLength) / (1024 * 1024);
            resolve(fileSizeMB <= maxSizeMB);
          } else {
            resolve(true); // Can't determine size, allow upload
          }
        })
        .catch(() => {
          resolve(false);
        });
    });
  }
}

export default StorageService;
