import { FirestoreService } from "./firestoreService";
import { StorageService } from "./storageService";
import { TranscriptionService } from "./transcriptionService";
import { AudioFormatTest } from "../utils/audioFormatTest";
import { Whisper, AudioRecording, User } from "@/types";
import { defaultWhisperValidator } from "@/utils/whisperValidator";
import { FEATURE_FLAGS } from "@/constants";

export interface WhisperCreationOptions {
  enableTranscription?: boolean;
  isPublic?: boolean;
  onUploadProgress?: (progress: number) => void;
}

export interface WhisperCreationResult {
  success: boolean;
  whisper?: Whisper;
  error?: string;
}

export class WhisperService {
  /**
   * Create a new whisper with audio upload and optional transcription
   */
  static async createWhisper(
    audioRecording: AudioRecording,
    userId: string,
    options: WhisperCreationOptions = {}
  ): Promise<WhisperCreationResult> {
    try {
      const {
        enableTranscription = true,
        isPublic = true,
        onUploadProgress,
      } = options;

      // Test audio format before processing
      console.log("🔍 Testing audio format before processing...");
      await AudioFormatTest.logAudioInfo(audioRecording.uri);

      // Upload audio to Firebase Storage
      const audioUrl = await StorageService.uploadAudio(audioRecording, userId);

      // Transcribe audio if enabled
      let transcription: string | undefined;
      let transcriptionError: string | undefined;

      if (enableTranscription) {
        try {
          console.log("🎤 Starting transcription...");
          const transcriptionResult =
            await TranscriptionService.transcribeWithRetry(audioUrl);
          transcription = transcriptionResult.text || undefined;
          console.log(
            "✅ Transcription completed:",
            transcription?.substring(0, 50) + "..."
          );
        } catch (error) {
          console.warn(
            "❌ Transcription failed, continuing without it:",
            error
          );
          transcriptionError =
            error instanceof Error ? error.message : "Transcription failed";
          // Keep transcription as undefined - the whisper will still be created
        }
      }

      // Create whisper document in Firestore
      const whisperData: Omit<Whisper, "id" | "createdAt" | "updatedAt"> = {
        userId,
        audioUrl,
        transcription, // This can be undefined, which is fine for the type
        duration: audioRecording.duration,
        volume: audioRecording.volume,
        isWhisper: audioRecording.isWhisper,
        isPublic,
        likes: 0,
        replies: 0,
      };

      const whisper = await FirestoreService.createWhisper(whisperData);

      return {
        success: true,
        whisper,
        error: transcriptionError, // Include transcription error if it occurred
      };
    } catch (error) {
      console.error("❌ Error creating whisper:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create whisper",
      };
    }
  }

  /**
   * Get public whispers for feed
   */
  static async getPublicWhispers(limit: number = 20): Promise<Whisper[]> {
    try {
      const result = await FirestoreService.getPublicWhispers({ limit });
      return result.whispers;
    } catch (error) {
      console.error("Error getting public whispers:", error);
      throw new Error("Failed to get public whispers");
    }
  }

  /**
   * Get user's whispers
   */
  static async getUserWhispers(
    userId: string,
    limit: number = 20
  ): Promise<Whisper[]> {
    try {
      const result = await FirestoreService.getUserWhispers(userId, { limit });
      return result.whispers;
    } catch (error) {
      console.error("Error getting user whispers:", error);
      throw new Error("Failed to get user whispers");
    }
  }

  /**
   * Get a single whisper by ID
   */
  static async getWhisper(whisperId: string): Promise<Whisper | null> {
    try {
      return await FirestoreService.getWhisper(whisperId);
    } catch (error) {
      console.error("Error getting whisper:", error);
      return null;
    }
  }

  /**
   * Like a whisper
   */
  static async likeWhisper(whisperId: string, userId: string): Promise<void> {
    try {
      await FirestoreService.likeWhisper(whisperId, userId);
    } catch (error) {
      console.error("Error liking whisper:", error);
      throw new Error("Failed to like whisper");
    }
  }

  /**
   * Unlike a whisper
   */
  static async unlikeWhisper(whisperId: string, userId: string): Promise<void> {
    try {
      await FirestoreService.unlikeWhisper(whisperId, userId);
    } catch (error) {
      console.error("Error unliking whisper:", error);
      throw new Error("Failed to unlike whisper");
    }
  }

  /**
   * Delete a whisper
   */
  static async deleteWhisper(
    whisperId: string,
    audioUrl: string
  ): Promise<void> {
    try {
      // Delete from Firestore
      await FirestoreService.deleteWhisper(whisperId);

      // Delete from Storage
      await StorageService.deleteAudio(audioUrl);
    } catch (error) {
      console.error("Error deleting whisper:", error);
      throw new Error("Failed to delete whisper");
    }
  }

  /**
   * Update whisper visibility
   */
  static async updateWhisperVisibility(
    whisperId: string,
    isPublic: boolean
  ): Promise<void> {
    try {
      await FirestoreService.updateWhisper(whisperId, { isPublic });
    } catch (error) {
      console.error("Error updating whisper visibility:", error);
      throw new Error("Failed to update whisper visibility");
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
