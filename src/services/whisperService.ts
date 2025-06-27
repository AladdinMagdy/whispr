import { AudioRecording } from "@/types";
import { defaultWhisperValidator } from "@/utils/whisperValidator";
import { StorageService, UploadProgress } from "./storageService";
import { FirestoreService } from "./firestoreService";
import { TranscriptionService } from "./transcriptionService";
import { FEATURE_FLAGS } from "@/constants";

export interface CreateWhisperOptions {
  isPublic?: boolean;
  enableTranscription?: boolean;
  onUploadProgress?: (progress: UploadProgress) => void;
}

export interface WhisperCreationResult {
  whisperId: string;
  audioUrl: string;
  transcription?: string;
  success: boolean;
  error?: string;
}

export class WhisperService {
  /**
   * Create a complete whisper (validate, upload, transcribe, store)
   */
  static async createWhisper(
    recording: AudioRecording,
    userId: string,
    options: CreateWhisperOptions = {}
  ): Promise<WhisperCreationResult> {
    try {
      // 1. Validate the recording
      const validation = defaultWhisperValidator.validateWhisper(recording);
      if (!validation.isValid) {
        return {
          whisperId: "",
          audioUrl: "",
          success: false,
          error: validation.error || "Invalid whisper recording",
        };
      }

      // 2. Upload audio to Firebase Storage
      const uploadResult = await StorageService.uploadAudio(
        recording.uri,
        userId,
        options.onUploadProgress
      );

      // 3. Transcribe audio (if enabled)
      let transcription: string | undefined;
      if (
        FEATURE_FLAGS.ENABLE_TRANSCRIPTION &&
        options.enableTranscription !== false
      ) {
        try {
          const transcriptionResult =
            await TranscriptionService.transcribeWithRetry(uploadResult.url);
          transcription = transcriptionResult.text;
        } catch (error) {
          console.warn("Transcription failed, continuing without it:", error);
          // Continue without transcription if it fails
        }
      }

      // 4. Create whisper document in Firestore
      const whisperId = await FirestoreService.createWhisper({
        userId,
        audioUrl: uploadResult.url,
        transcription,
        duration: recording.duration,
        volume: recording.volume,
        isWhisper: recording.isWhisper,
        isPublic: options.isPublic ?? true,
        likes: 0,
        replies: 0,
      });

      return {
        whisperId,
        audioUrl: uploadResult.url,
        transcription,
        success: true,
      };
    } catch (error) {
      console.error("Error creating whisper:", error);
      return {
        whisperId: "",
        audioUrl: "",
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create whisper",
      };
    }
  }

  /**
   * Get public whispers for feed
   */
  static async getPublicWhispers(limit: number = 20) {
    try {
      return await FirestoreService.getPublicWhispers(limit);
    } catch (error) {
      console.error("Error getting public whispers:", error);
      throw new Error("Failed to get public whispers");
    }
  }

  /**
   * Get user's whispers
   */
  static async getUserWhispers(userId: string, limit: number = 20) {
    try {
      return await FirestoreService.getUserWhispers(userId, limit);
    } catch (error) {
      console.error("Error getting user whispers:", error);
      throw new Error("Failed to get user whispers");
    }
  }

  /**
   * Like a whisper
   */
  static async likeWhisper(whisperId: string) {
    try {
      await FirestoreService.likeWhisper(whisperId);
    } catch (error) {
      console.error("Error liking whisper:", error);
      throw new Error("Failed to like whisper");
    }
  }

  /**
   * Delete a whisper (and its audio file)
   */
  static async deleteWhisper(whisperId: string, audioStoragePath?: string) {
    try {
      // Delete from Firestore first
      await FirestoreService.deleteWhisper(whisperId);

      // Delete audio file from storage if path is provided
      if (audioStoragePath) {
        await StorageService.deleteAudio(audioStoragePath);
      }
    } catch (error) {
      console.error("Error deleting whisper:", error);
      throw new Error("Failed to delete whisper");
    }
  }

  /**
   * Subscribe to real-time public whispers
   */
  static subscribeToPublicWhispers(
    callback: (whispers: any[]) => void,
    limit: number = 20
  ) {
    return FirestoreService.subscribeToPublicWhispers(callback, limit);
  }

  /**
   * Subscribe to real-time user whispers
   */
  static subscribeToUserWhispers(
    userId: string,
    callback: (whispers: any[]) => void,
    limit: number = 20
  ) {
    return FirestoreService.subscribeToUserWhispers(userId, callback, limit);
  }

  /**
   * Search whispers by transcription text
   */
  static async searchWhispers(searchTerm: string, limit: number = 20) {
    try {
      return await FirestoreService.searchWhispers(searchTerm, limit);
    } catch (error) {
      console.error("Error searching whispers:", error);
      throw new Error("Failed to search whispers");
    }
  }

  /**
   * Validate recording before processing
   */
  static validateRecording(recording: AudioRecording) {
    return defaultWhisperValidator.validateWhisper(recording);
  }

  /**
   * Get feedback for improving whisper
   */
  static getWhisperFeedback(recording: AudioRecording) {
    return defaultWhisperValidator.getWhisperFeedback(recording);
  }

  /**
   * Estimate transcription cost
   */
  static estimateTranscriptionCost(durationSeconds: number): number {
    return TranscriptionService.estimateCost(durationSeconds);
  }

  /**
   * Check if transcription service is available
   */
  static isTranscriptionAvailable(): boolean {
    return TranscriptionService.isAvailable();
  }
}

export default WhisperService;
