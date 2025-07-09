/**
 * Upload Service for Whispr
 * Handles audio file uploads to Firebase Storage and Firestore document creation
 */

import { StorageService } from "./storageService";
import { getFirestoreService } from "./firestoreService";
import { getAuthService } from "./authService";

import {
  formatFileSize,
  generateUniqueFilename,
  isValidAudioFormat,
} from "../utils/fileUtils";

export interface UploadProgress {
  progress: number;
  bytesTransferred: number;
  totalBytes: number;
}

export interface WhisperUploadData {
  audioUri: string;
  duration: number;
  whisperPercentage: number;
  averageLevel: number;
  confidence: number;
}

export class UploadService {
  private static instance: UploadService;
  private firestoreService: ReturnType<typeof getFirestoreService>;
  private authService: ReturnType<typeof getAuthService>;

  private constructor() {
    this.firestoreService = getFirestoreService();
    this.authService = getAuthService();
  }

  static getInstance(): UploadService {
    if (!UploadService.instance) {
      UploadService.instance = new UploadService();
    }
    return UploadService.instance;
  }

  /**
   * Upload whisper audio and metadata
   */
  async uploadWhisper(uploadData: WhisperUploadData): Promise<string> {
    try {
      const user = await this.authService.getCurrentUser();
      if (!user) {
        throw new Error("User not authenticated");
      }

      console.log("🚀 Starting whisper upload...");

      // Validate audio file
      if (!isValidAudioFormat(uploadData.audioUri)) {
        throw new Error("Invalid audio file format");
      }

      // Upload audio file to storage using StorageService
      const audioUrl = await StorageService.uploadAudio(
        {
          uri: uploadData.audioUri,
          duration: uploadData.duration,
          volume: uploadData.averageLevel,
          isWhisper: uploadData.whisperPercentage > 0.5,
          timestamp: new Date(),
        },
        user.uid
      );

      console.log("✅ Audio uploaded successfully");

      // Create whisper document in Firestore
      const whisperId = await this.firestoreService.createWhisper(
        user.uid,
        user.displayName || "Anonymous",
        user.profileColor || "#007AFF",
        {
          audioUrl,
          duration: uploadData.duration,
          whisperPercentage: uploadData.whisperPercentage,
          averageLevel: uploadData.averageLevel,
          confidence: uploadData.confidence,
        }
      );

      console.log("✅ Whisper created successfully:", whisperId);

      return whisperId;
    } catch (error) {
      console.error("❌ Error uploading whisper:", error);
      throw error;
    }
  }

  /**
   * Delete whisper and associated audio file
   */
  async deleteWhisper(whisperId: string): Promise<void> {
    try {
      const user = await this.authService.getCurrentUser();
      if (!user) {
        throw new Error("User not authenticated");
      }

      // Get whisper data to find audio URL
      const whisper = await this.firestoreService.getWhisper(whisperId);
      if (!whisper) {
        throw new Error("Whisper not found");
      }

      // Check if user owns the whisper
      if (whisper.userId !== user.uid) {
        throw new Error("Not authorized to delete this whisper");
      }

      // Delete from Firestore first
      await this.firestoreService.deleteWhisper(whisperId);

      // Delete audio file from storage
      if (whisper.audioUrl) {
        await StorageService.deleteAudio(whisper.audioUrl);
      }

      console.log("✅ Whisper deleted successfully");
    } catch (error) {
      console.error("❌ Error deleting whisper:", error);
      throw error;
    }
  }

  /**
   * Update whisper transcription
   */
  async updateTranscription(
    whisperId: string,
    transcription: string
  ): Promise<void> {
    try {
      await this.firestoreService.updateTranscription(whisperId, transcription);
      console.log("✅ Transcription updated successfully");
    } catch (error) {
      console.error("❌ Error updating transcription:", error);
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
  formatFileSize,

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
  generateFilename: generateUniqueFilename,

  /**
   * Validate audio file format
   */
  isValidAudioFormat,
};
