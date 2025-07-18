/**
 * Upload Service for Whispr
 * Handles audio file uploads to Firebase Storage and Firestore document creation
 */

import {
  WhisperUploadData,
  UploadProgress,
  validateUserAuthentication,
  validateAudioFormat,
  uploadAudioToStorage,
  transcribeAudio,
  verifyUserAge,
  moderateContent,
  createWhisperDocument,
  updateUserReputation,
  getWhisperForDeletion,
  validateWhisperOwnership,
  deleteWhisperFromFirestore,
  deleteAudioFromStorage,
  updateWhisperTranscription,
  formatUploadProgress,
  generateUniqueFilenameForUpload,
  validateAudioFileFormat,
  createAudioUploadData,
  createWhisperData,
  createAgeVerificationData,
  createModerationData,
  logUploadProgress,
  validateUploadData,
} from "../utils/uploadUtils";

// Re-export types for backward compatibility
export type { WhisperUploadData, UploadProgress };

export class UploadService {
  private static instance: UploadService;

  private constructor() {}

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
      // Validate upload data
      validateUploadData(uploadData);

      // Validate user authentication
      const { user, userId } = await validateUserAuthentication();

      logUploadProgress("Starting whisper upload");

      // Validate audio file
      validateAudioFormat(uploadData.audioUri);

      // Create audio upload data
      const audioData = createAudioUploadData(
        uploadData.audioUri,
        uploadData.duration,
        uploadData.averageLevel,
        uploadData.whisperPercentage
      );

      // Upload audio file to storage
      const audioUrl = await uploadAudioToStorage(audioData, userId);

      // Transcribe the audio
      const transcription = await transcribeAudio(audioUrl);

      // Verify user age
      const ageData = createAgeVerificationData(
        uploadData.userAge,
        uploadData.dateOfBirth
      );
      const ageVerification = await verifyUserAge(ageData);

      // Moderate the transcription
      const moderationData = createModerationData(
        transcription.text,
        userId,
        ageVerification.age
      );
      const moderationResult = await moderateContent(moderationData);

      // Create whisper data
      const whisperData = createWhisperData(
        audioUrl,
        uploadData.duration,
        uploadData.whisperPercentage,
        uploadData.averageLevel,
        uploadData.confidence,
        transcription.text,
        moderationResult
      );

      // Create whisper document in Firestore
      const whisperId = await createWhisperDocument(
        userId,
        user.displayName || "Anonymous",
        user.profileColor || "#007AFF",
        whisperData
      );

      // Update user reputation
      try {
        await updateUserReputation(userId);
      } catch (error) {
        // Don't fail the upload if reputation update fails
        console.warn(
          "⚠️ Reputation update failed, but upload completed:",
          error
        );
      }

      return whisperId;
    } catch (error) {
      console.error("❌ Error in uploadWhisper:", error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Unknown error in uploadWhisper: ${String(error)}`);
    }
  }

  /**
   * Delete whisper and associated audio file
   */
  async deleteWhisper(whisperId: string): Promise<void> {
    try {
      // Validate user authentication
      const { userId } = await validateUserAuthentication();

      // Get whisper data for deletion
      const { whisper, audioUrl } = await getWhisperForDeletion(whisperId);

      // Validate whisper ownership
      validateWhisperOwnership(whisper.userId, userId);

      // Delete from Firestore first
      await deleteWhisperFromFirestore(whisperId);

      // Delete audio file from storage
      await deleteAudioFromStorage(audioUrl);

      console.log("✅ Whisper deleted successfully");
    } catch (error) {
      console.error("❌ Error in deleteWhisper:", error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Unknown error in deleteWhisper: ${String(error)}`);
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
      await updateWhisperTranscription(whisperId, transcription);
    } catch (error) {
      console.error("❌ Error in updateTranscription:", error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Unknown error in updateTranscription: ${String(error)}`);
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
   * Format upload progress for display
   */
  formatProgress: formatUploadProgress,

  /**
   * Generate unique filename
   */
  generateFilename: generateUniqueFilenameForUpload,

  /**
   * Validate audio file format
   */
  isValidAudioFormat: validateAudioFileFormat,

  /**
   * Format file size for display
   */
  formatFileSize: (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  },
};
