import { getFirestoreService } from "./firestoreService";
import { getPrivacyService } from "./privacyService";
import { StorageService } from "./storageService";
import { TranscriptionService } from "./transcriptionService";
import { AudioFormatTest } from "../utils/audioFormatTest";
import { Whisper, AudioRecording, ModerationResult } from "@/types";
import { FEATURE_FLAGS } from "@/constants";
import {
  QueryDocumentSnapshot,
  DocumentData,
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  where,
  startAfter,
  getDocs,
  doc,
  getDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
} from "firebase/firestore";
import { getFirestoreInstance } from "../config/firebase";
import { FIRESTORE_COLLECTIONS } from "../constants";
import { getErrorMessage } from "../utils/errorHelpers";

export interface WhisperCreationOptions {
  enableTranscription?: boolean;
}

export interface WhisperCreationResult {
  success: boolean;
  whisper?: Whisper;
  error?: string;
}

export interface WhisperFeedOptions {
  limit?: number;
  lastWhisper?: QueryDocumentSnapshot<DocumentData>;
  userId?: string; // For user-specific feeds
  startAfter?: QueryDocumentSnapshot<DocumentData>; // For pagination
  userAge?: number; // For age-based filtering
  isMinor?: boolean; // For minor content filtering
  contentPreferences?: {
    allowAdultContent: boolean;
    strictFiltering: boolean;
  };
  excludeBlockedUsers?: boolean; // Whether to exclude blocked users
  excludeMutedUsers?: boolean; // Whether to exclude muted users
  currentUserId?: string; // Current user ID for blocking/muting checks
}

export interface PaginatedWhispersResult {
  whispers: Whisper[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

export interface WhisperUploadData {
  audioUrl: string;
  duration: number;
  whisperPercentage: number;
  averageLevel: number;
  confidence: number;
  transcription?: string;
  moderationResult?: ModerationResult;
}

export class WhisperService {
  private static instance: WhisperService;
  private firestore = getFirestoreInstance();
  private firestoreService = getFirestoreService();
  private privacyService = getPrivacyService();
  private whispersCollection = FIRESTORE_COLLECTIONS.WHISPERS;

  private constructor() {}

  static getInstance(): WhisperService {
    if (!WhisperService.instance) {
      WhisperService.instance = new WhisperService();
    }
    return WhisperService.instance;
  }

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
      const { enableTranscription = true } = options;

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
      const whisperService = getWhisperService();

      const whisperUploadData: WhisperUploadData = {
        audioUrl,
        duration: audioRecording.duration,
        whisperPercentage: audioRecording.isWhisper ? 100 : 0, // Convert boolean to percentage
        averageLevel: audioRecording.volume,
        confidence: audioRecording.isWhisper ? 0.9 : 0.1, // Simple confidence based on whisper status
        transcription,
      };

      const whisperId = await whisperService.createWhisper(
        userId,
        userDisplayName,
        userProfileColor,
        whisperUploadData
      );

      // Get the created whisper
      const whisper = await whisperService.getWhisper(whisperId);

      return {
        success: true,
        whisper: whisper || undefined,
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
  static async getPublicWhispers(): Promise<Whisper[]> {
    try {
      const whisperService = getWhisperService();
      const result = await whisperService.getWhispers({ limit: 20 });
      return result.whispers;
    } catch (error) {
      console.error("Error getting public whispers:", error);
      throw new Error("Failed to get public whispers");
    }
  }

  /**
   * Get user's whispers
   */
  static async getUserWhispers(userId: string): Promise<Whisper[]> {
    try {
      const whisperService = getWhisperService();
      const result = await whisperService.getUserWhispers(userId);
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
      const whisperService = getWhisperService();
      return await whisperService.getWhisper(whisperId);
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
  static async deleteWhisper(whisperId: string): Promise<void> {
    try {
      const whisperService = getWhisperService();
      await whisperService.deleteWhisper(whisperId);

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
      const whisperService = getWhisperService();
      await whisperService.updateTranscription(whisperId, transcription);
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
    return costPerMinute * durationMinutes;
  }

  /**
   * Check if transcription is available
   */
  static isTranscriptionAvailable(): boolean {
    return FEATURE_FLAGS.ENABLE_TRANSCRIPTION;
  }

  // ===== INSTANCE METHODS IMPLEMENTED DIRECTLY =====

  /**
   * Create a new whisper (instance method version)
   */
  async createWhisper(
    userId: string,
    userDisplayName: string,
    userProfileColor: string,
    uploadData: WhisperUploadData
  ): Promise<string> {
    try {
      const whisperData = {
        userId,
        userDisplayName,
        userProfileColor,
        audioUrl: uploadData.audioUrl,
        duration: uploadData.duration,
        whisperPercentage: uploadData.whisperPercentage,
        averageLevel: uploadData.averageLevel,
        confidence: uploadData.confidence,
        transcription: uploadData.transcription,
        moderationResult: uploadData.moderationResult,
        likes: 0,
        replies: 0,
        createdAt: serverTimestamp(),
        isTranscribed: !!uploadData.transcription,
      };

      const docRef = await addDoc(
        collection(this.firestore, this.whispersCollection),
        whisperData
      );

      console.log("✅ Whisper created successfully:", docRef.id);
      return docRef.id;
    } catch (error) {
      console.error("❌ Error creating whisper:", error);
      throw new Error(`Failed to create whisper: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Get whispers with pagination and filtering
   */
  async getWhispers(
    options: WhisperFeedOptions = {}
  ): Promise<PaginatedWhispersResult> {
    try {
      const {
        limit: limitCount = 20,
        startAfter: startAfterDoc,
        userId,
        isMinor,
        contentPreferences,
      } = options;

      let q = query(collection(this.firestore, this.whispersCollection));

      // Apply filters
      const constraints: Array<
        | ReturnType<typeof where>
        | ReturnType<typeof orderBy>
        | ReturnType<typeof limit>
        | ReturnType<typeof startAfter>
      > = [];

      // User-specific feed
      if (userId) {
        constraints.push(where("userId", "==", userId));
      }

      // Age-based filtering
      if (isMinor !== undefined) {
        constraints.push(where("isMinorSafe", "==", true));
      }

      // Content preferences
      if (contentPreferences?.strictFiltering) {
        constraints.push(where("moderationResult.status", "==", "approved"));
      }

      // Order by creation date (newest first)
      constraints.push(orderBy("createdAt", "desc"));

      // Apply limit
      constraints.push(limit(limitCount));

      // Apply pagination
      if (startAfterDoc) {
        constraints.push(startAfter(startAfterDoc));
      }

      // Build and execute query
      q = query(
        collection(this.firestore, this.whispersCollection),
        ...constraints
      );
      const querySnapshot = await getDocs(q);

      const whispers: Whisper[] = [];
      querySnapshot.forEach((doc) => {
        whispers.push({ id: doc.id, ...doc.data() } as Whisper);
      });

      const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1] || null;
      const hasMore = querySnapshot.docs.length === limitCount;

      return {
        whispers,
        lastDoc,
        hasMore,
      };
    } catch (error) {
      console.error("❌ Error getting whispers:", error);
      throw new Error(`Failed to get whispers: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Get a single whisper by ID (instance method version)
   */
  async getWhisper(whisperId: string): Promise<Whisper | null> {
    try {
      const docRef = doc(this.firestore, this.whispersCollection, whisperId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Whisper;
      }
      return null;
    } catch (error) {
      console.error("❌ Error getting whisper:", error);
      throw new Error(`Failed to get whisper: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Delete a whisper (instance method version)
   */
  async deleteWhisper(whisperId: string): Promise<void> {
    try {
      const docRef = doc(this.firestore, this.whispersCollection, whisperId);
      await deleteDoc(docRef);
      console.log("✅ Whisper deleted successfully:", whisperId);
    } catch (error) {
      console.error("❌ Error deleting whisper:", error);
      throw new Error(`Failed to delete whisper: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Update whisper transcription (instance method version)
   */
  async updateTranscription(
    whisperId: string,
    transcription: string
  ): Promise<void> {
    try {
      const docRef = doc(this.firestore, this.whispersCollection, whisperId);
      await updateDoc(docRef, {
        transcription,
        isTranscribed: true,
      });
      console.log("✅ Whisper transcription updated:", whisperId);
    } catch (error) {
      console.error("❌ Error updating transcription:", error);
      throw new Error(
        `Failed to update transcription: ${getErrorMessage(error)}`
      );
    }
  }

  /**
   * Get user's whispers (instance method version)
   */
  async getUserWhispers(userId: string): Promise<PaginatedWhispersResult> {
    return this.getWhispers({ userId });
  }

  /**
   * Validate and fix like count for a whisper
   */
  async validateAndFixLikeCount(whisperId: string): Promise<number> {
    // This method will be implemented when we extract interaction methods
    // For now, delegate to FirestoreService
    const firestoreService = getFirestoreService();
    return firestoreService.validateAndFixLikeCount(whisperId);
  }

  /**
   * Get whisper likes with privacy filtering
   */
  async getWhisperLikesWithPrivacy(
    whisperId: string,
    currentUserId: string,
    limit: number = 50,
    lastDoc?: QueryDocumentSnapshot<DocumentData>
  ): Promise<{
    likes: Array<{
      id: string;
      whisperId: string;
      userId: string;
      userDisplayName: string;
      userProfileColor: string;
      createdAt: Date;
    }>;
    hasMore: boolean;
    lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  }> {
    return this.privacyService.getWhisperLikesWithPrivacy(
      whisperId,
      currentUserId,
      limit,
      lastDoc
    );
  }

  /**
   * Get deleted whisper count for a user
   */
  async getDeletedWhisperCount(
    userId: string,
    daysBack: number = 90
  ): Promise<number> {
    return this.privacyService.getDeletedWhisperCount(userId, daysBack);
  }

  /**
   * Subscribe to whispers in real-time
   */
  subscribeToWhispers(
    callback: (whispers: Whisper[]) => void,
    options: WhisperFeedOptions = {}
  ): () => void {
    try {
      const { limit: limitCount = 20, userId, isMinor } = options;

      let q = query(collection(this.firestore, this.whispersCollection));

      const constraints: Array<
        | ReturnType<typeof where>
        | ReturnType<typeof orderBy>
        | ReturnType<typeof limit>
      > = [];

      if (userId) {
        constraints.push(where("userId", "==", userId));
      }

      if (isMinor !== undefined) {
        constraints.push(where("isMinorSafe", "==", true));
      }

      constraints.push(orderBy("createdAt", "desc"));
      constraints.push(limit(limitCount));

      q = query(
        collection(this.firestore, this.whispersCollection),
        ...constraints
      );

      return onSnapshot(q, (querySnapshot) => {
        const whispers: Whisper[] = [];
        querySnapshot.forEach((doc) => {
          whispers.push({ id: doc.id, ...doc.data() } as Whisper);
        });
        callback(whispers);
      });
    } catch (error) {
      console.error("❌ Error subscribing to whispers:", error);
      throw new Error(
        `Failed to subscribe to whispers: ${getErrorMessage(error)}`
      );
    }
  }

  /**
   * Subscribe to new whispers since a timestamp
   */
  subscribeToNewWhispers(
    callback: (newWhisper: Whisper) => void,
    sinceTimestamp?: Date,
    options: WhisperFeedOptions = {}
  ): () => void {
    try {
      const { userId, isMinor } = options;

      let q = query(collection(this.firestore, this.whispersCollection));

      const constraints: Array<
        ReturnType<typeof where> | ReturnType<typeof orderBy>
      > = [];

      if (userId) {
        constraints.push(where("userId", "==", userId));
      }

      if (isMinor !== undefined) {
        constraints.push(where("isMinorSafe", "==", true));
      }

      if (sinceTimestamp) {
        constraints.push(where("createdAt", ">", sinceTimestamp));
      }

      constraints.push(orderBy("createdAt", "desc"));

      q = query(
        collection(this.firestore, this.whispersCollection),
        ...constraints
      );

      return onSnapshot(q, (querySnapshot) => {
        querySnapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const whisper = {
              id: change.doc.id,
              ...change.doc.data(),
            } as Whisper;
            callback(whisper);
          }
        });
      });
    } catch (error) {
      console.error("❌ Error subscribing to new whispers:", error);
      throw new Error(
        `Failed to subscribe to new whispers: ${getErrorMessage(error)}`
      );
    }
  }

  /**
   * Reset singleton instance
   */
  static resetInstance(): void {
    if (WhisperService.instance) {
      WhisperService.instance = new WhisperService();
      console.log("🔄 WhisperService singleton reset successfully");
    }
  }

  /**
   * Destroy singleton instance
   */
  static destroyInstance(): void {
    if (WhisperService.instance) {
      WhisperService.instance = null as unknown as WhisperService;
      console.log("🗑️ WhisperService singleton destroyed");
    }
  }
}

/**
 * Factory function to get WhisperService instance
 */
export const getWhisperService = (): WhisperService => {
  return WhisperService.getInstance();
};

/**
 * Reset the WhisperService singleton instance
 */
export const resetWhisperService = (): void => {
  WhisperService.resetInstance();
};

/**
 * Destroy the WhisperService singleton instance
 */
export const destroyWhisperService = (): void => {
  WhisperService.destroyInstance();
};
