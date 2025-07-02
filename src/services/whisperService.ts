import { getFirestoreService } from "./firestoreService";
import { StorageService } from "./storageService";
import { TranscriptionService } from "./transcriptionService";
import { AudioFormatTest } from "../utils/audioFormatTest";
import { Whisper, AudioRecording, User } from "@/types";
import { FEATURE_FLAGS } from "@/constants";

export interface WhisperCreationOptions {
  enableTranscription?: boolean;
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
    userDisplayName: string,
    userProfileColor: string,
    options: WhisperCreationOptions = {}
  ): Promise<WhisperCreationResult> {
    try {
      const { enableTranscription = true, onUploadProgress } = options;

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

      // Create whisper document in Firestore using the new service
      const firestoreService = getFirestoreService();

      const whisperUploadData = {
        audioUrl,
        duration: audioRecording.duration,
        whisperPercentage: audioRecording.isWhisper ? 100 : 0, // Convert boolean to percentage
        averageLevel: audioRecording.volume,
        confidence: audioRecording.isWhisper ? 0.9 : 0.1, // Simple confidence based on whisper status
      };

      const whisperId = await firestoreService.createWhisper(
        userId,
        userDisplayName,
        userProfileColor,
        whisperUploadData
      );

      // Update transcription if available
      if (transcription) {
        await firestoreService.updateTranscription(whisperId, transcription);
      }

      // Get the created whisper
      const whispers = await firestoreService.getWhispers();
      const whisper = whispers.find((w) => w.id === whisperId);

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
      const firestoreService = getFirestoreService();
      return await firestoreService.getWhispers({ limit });
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
      const firestoreService = getFirestoreService();
      return await firestoreService.getUserWhispers(userId);
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
      const firestoreService = getFirestoreService();
      const whispers = await firestoreService.getWhispers();
      return whispers.find((w) => w.id === whisperId) || null;
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
      const firestoreService = getFirestoreService();
      await firestoreService.likeWhisper(whisperId, userId);
    } catch (error) {
      console.error("Error liking whisper:", error);
      throw new Error("Failed to like whisper");
    }
  }

  /**
   * Delete a whisper
   */
  static async deleteWhisper(whisperId: string, userId: string): Promise<void> {
    try {
      const firestoreService = getFirestoreService();
      // Delete from Firestore
      await firestoreService.deleteWhisper(whisperId, userId);

      // TODO: Delete from Storage if needed
      // await StorageService.deleteAudio(audioUrl);
    } catch (error) {
      console.error("Error deleting whisper:", error);
      throw new Error("Failed to delete whisper");
    }
  }

  /**
   * Update whisper transcription
   */
  static async updateTranscription(
    whisperId: string,
    transcription: string
  ): Promise<void> {
    try {
      const firestoreService = getFirestoreService();
      await firestoreService.updateTranscription(whisperId, transcription);
    } catch (error) {
      console.error("Error updating transcription:", error);
      throw new Error("Failed to update transcription");
    }
  }

  /**
   * Estimate transcription cost
   */
  static estimateTranscriptionCost(durationSeconds: number): number {
    // OpenAI Whisper pricing: $0.006 per minute
    const costPerMinute = 0.006;
    const durationMinutes = durationSeconds / 60;
    return durationMinutes * costPerMinute;
  }

  /**
   * Check if transcription is available
   */
  static isTranscriptionAvailable(): boolean {
    return FEATURE_FLAGS.ENABLE_TRANSCRIPTION;
  }
}

export default WhisperService;
