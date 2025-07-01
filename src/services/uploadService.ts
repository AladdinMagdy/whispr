/**
 * Upload Service for Whispr
 * Handles audio file uploads to Firebase Storage and Firestore document creation
 */

import {
  getStorageInstance,
  getFirestoreInstance,
  getAuthInstance,
} from "../config/firebase";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  uploadBytesResumable,
} from "firebase/storage";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export interface UploadProgress {
  progress: number; // 0-100
  bytesTransferred: number;
  totalBytes: number;
}

export interface WhisperUploadData {
  audioUri: string;
  duration: number;
  whisperPercentage: number;
  averageLevel: number;
  confidence: number;
  transcription?: string;
  metadata?: Record<string, any>;
}

export interface WhisperDocument {
  id: string;
  userId: string;
  audioUrl: string;
  duration: number;
  whisperPercentage: number;
  averageLevel: number;
  confidence: number;
  transcription?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export class UploadService {
  private static instance: UploadService;

  static getInstance(): UploadService {
    if (!UploadService.instance) {
      UploadService.instance = new UploadService();
    }
    return UploadService.instance;
  }

  /**
   * Get current authenticated user
   */
  private async getCurrentUser(): Promise<string> {
    return new Promise((resolve, reject) => {
      const auth = getAuthInstance();
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        unsubscribe();
        if (user) {
          resolve(user.uid);
        } else {
          reject(new Error("User not authenticated"));
        }
      });
    });
  }

  /**
   * Upload audio file to Firebase Storage
   */
  async uploadAudioFile(
    audioUri: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<string> {
    try {
      // Get current user
      const userId = await this.getCurrentUser();

      // Get Firebase Storage instance
      const storage = getStorageInstance();

      // Create unique filename
      const timestamp = Date.now();
      const filename = `whispers/${userId}/${timestamp}.m4a`;
      const storageRef = ref(storage, filename);

      // Convert URI to blob
      const response = await fetch(audioUri);
      const blob = await response.blob();

      // Upload to Firebase Storage with progress tracking
      const uploadTask = uploadBytesResumable(storageRef, blob);

      // Monitor upload progress
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
          throw error;
        }
      );

      // Wait for upload to complete
      await uploadTask;

      // Get download URL
      const downloadURL = await getDownloadURL(storageRef);
      return downloadURL;
    } catch (error) {
      console.error("Error uploading audio file:", error);
      throw new Error(
        `Failed to upload audio: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Create Firestore document for the whisper
   */
  async createWhisperDocument(
    audioUrl: string,
    uploadData: WhisperUploadData
  ): Promise<string> {
    try {
      // Get current user
      const userId = await this.getCurrentUser();

      // Get Firestore instance
      const firestore = getFirestoreInstance();

      // Prepare document data
      const whisperData = {
        userId,
        audioUrl,
        duration: uploadData.duration,
        whisperPercentage: uploadData.whisperPercentage,
        averageLevel: uploadData.averageLevel,
        confidence: uploadData.confidence,
        transcription: uploadData.transcription || null,
        metadata: uploadData.metadata || {},
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // Add document to Firestore
      const docRef = await addDoc(
        collection(firestore, "whispers"),
        whisperData
      );

      console.log("Whisper document created with ID:", docRef.id);
      return docRef.id;
    } catch (error) {
      console.error("Error creating whisper document:", error);
      throw new Error(
        `Failed to create whisper document: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Complete whisper upload process
   */
  async uploadWhisper(
    uploadData: WhisperUploadData,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<{ audioUrl: string; documentId: string }> {
    try {
      // Step 1: Upload audio file
      console.log("Uploading audio file...");
      const audioUrl = await this.uploadAudioFile(
        uploadData.audioUri,
        onProgress
      );

      // Step 2: Create Firestore document
      console.log("Creating whisper document...");
      const documentId = await this.createWhisperDocument(audioUrl, uploadData);

      return {
        audioUrl,
        documentId,
      };
    } catch (error) {
      console.error("Error in complete whisper upload:", error);
      throw error;
    }
  }

  /**
   * Validate upload data before uploading
   */
  validateUploadData(uploadData: WhisperUploadData): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!uploadData.audioUri) {
      errors.push("Audio URI is required");
    }

    if (uploadData.duration < 2) {
      errors.push("Recording must be at least 2 seconds long");
    }

    if (uploadData.duration > 30) {
      errors.push("Recording must be no longer than 30 seconds");
    }

    if (uploadData.whisperPercentage < 0.5) {
      errors.push("At least 50% of the recording must be whispered");
    }

    if (uploadData.confidence < 0.3) {
      errors.push("Whisper confidence is too low");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get upload statistics for a user
   */
  async getUserUploadStats(): Promise<{
    totalWhispers: number;
    totalDuration: number;
    averageConfidence: number;
  }> {
    try {
      const userId = await this.getCurrentUser();

      // This would typically query Firestore for user's whispers
      // For now, return mock data
      return {
        totalWhispers: 0,
        totalDuration: 0,
        averageConfidence: 0,
      };
    } catch (error) {
      console.error("Error getting user upload stats:", error);
      throw error;
    }
  }
}

/**
 * Factory function to get UploadService instance
 */
export const getUploadService = (): UploadService => {
  return UploadService.getInstance();
};

/**
 * Utility functions for upload operations
 */
export const UploadUtils = {
  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  },

  /**
   * Format upload progress for display
   */
  formatProgress(progress: UploadProgress): string {
    return `${progress.progress.toFixed(1)}% (${UploadUtils.formatFileSize(
      progress.bytesTransferred
    )} / ${UploadUtils.formatFileSize(progress.totalBytes)})`;
  },

  /**
   * Generate unique filename
   */
  generateFilename(userId: string, extension: string = "m4a"): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `whispers/${userId}/${timestamp}_${random}.${extension}`;
  },

  /**
   * Validate audio file format
   */
  isValidAudioFormat(filename: string): boolean {
    const validExtensions = [".m4a", ".mp3", ".wav", ".aac"];
    const extension = filename
      .toLowerCase()
      .substring(filename.lastIndexOf("."));
    return validExtensions.includes(extension);
  },
};
