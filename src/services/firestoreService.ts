/**
 * Firestore Service for Whispers
 * Handles whisper data operations and real-time listeners
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  DocumentData,
  QueryDocumentSnapshot,
  Timestamp,
  increment,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { getFirestoreInstance } from "@/config/firebase";
import { Whisper, Comment, Like, CommentLike } from "@/types";
import { FIRESTORE_COLLECTIONS } from "@/constants";

export interface WhisperUploadData {
  audioUrl: string;
  duration: number;
  whisperPercentage: number;
  averageLevel: number;
  confidence: number;
}

export interface WhisperFeedOptions {
  limit?: number;
  lastWhisper?: QueryDocumentSnapshot<DocumentData>;
  userId?: string; // For user-specific feeds
  startAfter?: QueryDocumentSnapshot<DocumentData>; // For pagination
}

export interface PaginatedWhispersResult {
  whispers: Whisper[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

export class FirestoreService {
  private static instance: FirestoreService;
  private firestore = getFirestoreInstance();
  private whispersCollection = "whispers";
  private usersCollection = "users";

  private constructor() {}

  static getInstance(): FirestoreService {
    if (!FirestoreService.instance) {
      FirestoreService.instance = new FirestoreService();
    }
    return FirestoreService.instance;
  }

  /**
   * Create a new whisper in Firestore
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
        likes: 0,
        replies: 0,
        createdAt: serverTimestamp(),
        isTranscribed: false,
      };

      const docRef = await addDoc(
        collection(this.firestore, this.whispersCollection),
        whisperData
      );

      console.log("✅ Whisper created successfully:", docRef.id);
      return docRef.id;
    } catch (error) {
      console.error("❌ Error creating whisper:", error);
      throw new Error(
        `Failed to create whisper: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Fetch whispers with pagination
   */
  async getWhispers(
    options: WhisperFeedOptions = {}
  ): Promise<PaginatedWhispersResult> {
    try {
      const {
        limit: limitCount = 20,
        startAfter: startAfterDoc,
        userId,
      } = options;

      let q = query(
        collection(this.firestore, this.whispersCollection),
        orderBy("createdAt", "desc"),
        limit(limitCount)
      );

      // Filter by user if specified
      if (userId) {
        q = query(q, where("userId", "==", userId));
      }

      // Add pagination
      if (startAfterDoc) {
        q = query(q, startAfter(startAfterDoc));
      }

      const querySnapshot = await getDocs(q);
      const whispers: Whisper[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        whispers.push({
          id: doc.id,
          userId: data.userId,
          userDisplayName: data.userDisplayName,
          userProfileColor: data.userProfileColor,
          audioUrl: data.audioUrl,
          duration: data.duration,
          whisperPercentage: data.whisperPercentage,
          averageLevel: data.averageLevel,
          confidence: data.confidence,
          likes: data.likes || 0,
          replies: data.replies || 0,
          createdAt: data.createdAt?.toDate() || new Date(),
          transcription: data.transcription,
          isTranscribed: data.isTranscribed || false,
        });
      });

      const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1] || null;
      const hasMore = querySnapshot.docs.length === limitCount;

      console.log(
        `✅ Fetched ${whispers.length} whispers, hasMore: ${hasMore}`
      );
      return {
        whispers,
        lastDoc,
        hasMore,
      };
    } catch (error) {
      console.error("❌ Error fetching whispers:", error);
      throw new Error(
        `Failed to fetch whispers: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Set up real-time listener for whispers
   */
  subscribeToWhispers(
    callback: (whispers: Whisper[]) => void,
    options: WhisperFeedOptions = {}
  ): () => void {
    try {
      const { limit: limitCount = 20, userId } = options;

      let q = query(
        collection(this.firestore, this.whispersCollection),
        orderBy("createdAt", "desc"),
        limit(limitCount)
      );

      // Filter by user if specified
      if (userId) {
        q = query(q, where("userId", "==", userId));
      }

      const unsubscribe = onSnapshot(
        q,
        (querySnapshot) => {
          const whispers: Whisper[] = [];

          querySnapshot.forEach((doc) => {
            const data = doc.data();
            whispers.push({
              id: doc.id,
              userId: data.userId,
              userDisplayName: data.userDisplayName,
              userProfileColor: data.userProfileColor,
              audioUrl: data.audioUrl,
              duration: data.duration,
              whisperPercentage: data.whisperPercentage,
              averageLevel: data.averageLevel,
              confidence: data.confidence,
              likes: data.likes || 0,
              replies: data.replies || 0,
              createdAt: data.createdAt?.toDate() || new Date(),
              transcription: data.transcription,
              isTranscribed: data.isTranscribed || false,
            });
          });

          console.log(`🔄 Real-time update: ${whispers.length} whispers`);
          callback(whispers);
        },
        (error) => {
          console.error("❌ Real-time listener error:", error);
        }
      );

      return unsubscribe;
    } catch (error) {
      console.error("❌ Error setting up real-time listener:", error);
      throw new Error(
        `Failed to set up real-time listener: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Set up real-time listener for NEW whispers only (scalable approach)
   */
  subscribeToNewWhispers(
    callback: (newWhisper: Whisper) => void,
    sinceTimestamp?: Date
  ): () => void {
    try {
      // Listen to whispers created after the given timestamp
      const startTime = sinceTimestamp || new Date(Date.now() - 60000); // Default: last minute

      let q = query(
        collection(this.firestore, this.whispersCollection),
        where("createdAt", ">", startTime),
        orderBy("createdAt", "desc")
      );

      const unsubscribe = onSnapshot(
        q,
        (querySnapshot) => {
          querySnapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
              const data = change.doc.data();
              const newWhisper: Whisper = {
                id: change.doc.id,
                userId: data.userId,
                userDisplayName: data.userDisplayName,
                userProfileColor: data.userProfileColor,
                audioUrl: data.audioUrl,
                duration: data.duration,
                whisperPercentage: data.whisperPercentage,
                averageLevel: data.averageLevel,
                confidence: data.confidence,
                likes: data.likes || 0,
                replies: data.replies || 0,
                createdAt: data.createdAt?.toDate() || new Date(),
                transcription: data.transcription,
                isTranscribed: data.isTranscribed || false,
              };

              console.log(`🆕 New whisper detected: ${newWhisper.id}`);
              callback(newWhisper);
            }
          });
        },
        (error) => {
          console.error("❌ New whispers listener error:", error);
        }
      );

      return unsubscribe;
    } catch (error) {
      console.error("❌ Error setting up new whispers listener:", error);
      throw new Error(
        `Failed to set up new whispers listener: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Like a whisper (enhanced with individual like tracking)
   */
  async likeWhisper(whisperId: string, userId: string): Promise<void> {
    try {
      const whisperRef = doc(
        this.firestore,
        this.whispersCollection,
        whisperId
      );

      // Check if user already liked this whisper
      const likeQuery = query(
        collection(this.firestore, FIRESTORE_COLLECTIONS.LIKES),
        where("whisperId", "==", whisperId),
        where("userId", "==", userId)
      );

      const likeSnapshot = await getDocs(likeQuery);

      if (likeSnapshot.empty) {
        // User hasn't liked this whisper yet - add like
        await addDoc(collection(this.firestore, FIRESTORE_COLLECTIONS.LIKES), {
          whisperId,
          userId,
          createdAt: serverTimestamp(),
        });

        // Increment whisper like count
        await updateDoc(whisperRef, {
          likes: increment(1),
        });

        console.log("✅ Whisper liked successfully");
      } else {
        // User already liked this whisper - remove like
        const likeDoc = likeSnapshot.docs[0];
        await deleteDoc(
          doc(this.firestore, FIRESTORE_COLLECTIONS.LIKES, likeDoc.id)
        );

        // Decrement whisper like count
        await updateDoc(whisperRef, {
          likes: increment(-1),
        });

        console.log("✅ Whisper unliked successfully");
      }
    } catch (error) {
      console.error("❌ Error liking/unliking whisper:", error);
      throw new Error(
        `Failed to like/unlike whisper: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Check if user has liked a whisper
   */
  async hasUserLikedWhisper(
    whisperId: string,
    userId: string
  ): Promise<boolean> {
    try {
      const likeQuery = query(
        collection(this.firestore, FIRESTORE_COLLECTIONS.LIKES),
        where("whisperId", "==", whisperId),
        where("userId", "==", userId)
      );

      const likeSnapshot = await getDocs(likeQuery);
      return !likeSnapshot.empty;
    } catch (error) {
      console.error("❌ Error checking like status:", error);
      return false;
    }
  }

  /**
   * Add a comment to a whisper
   */
  async addComment(
    whisperId: string,
    userId: string,
    userDisplayName: string,
    userProfileColor: string,
    text: string
  ): Promise<string> {
    try {
      // Add comment to comments collection
      const commentData = {
        whisperId,
        userId,
        userDisplayName,
        userProfileColor,
        text,
        likes: 0,
        createdAt: serverTimestamp(),
        isEdited: false,
      };

      const commentRef = await addDoc(
        collection(this.firestore, FIRESTORE_COLLECTIONS.REPLIES),
        commentData
      );

      // Increment whisper reply count
      const whisperRef = doc(
        this.firestore,
        this.whispersCollection,
        whisperId
      );

      await updateDoc(whisperRef, {
        replies: increment(1),
      });

      console.log("✅ Comment added successfully:", commentRef.id);
      return commentRef.id;
    } catch (error) {
      console.error("❌ Error adding comment:", error);
      throw new Error(
        `Failed to add comment: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get a single whisper with updated data
   */
  async getWhisper(whisperId: string): Promise<Whisper | null> {
    try {
      const whisperDoc = await getDoc(
        doc(this.firestore, this.whispersCollection, whisperId)
      );

      if (!whisperDoc.exists()) {
        return null;
      }

      const data = whisperDoc.data();
      return {
        id: whisperDoc.id,
        userId: data.userId,
        userDisplayName: data.userDisplayName,
        userProfileColor: data.userProfileColor,
        audioUrl: data.audioUrl,
        duration: data.duration,
        whisperPercentage: data.whisperPercentage,
        averageLevel: data.averageLevel,
        confidence: data.confidence,
        likes: data.likes || 0,
        replies: data.replies || 0,
        createdAt: data.createdAt?.toDate() || new Date(),
        transcription: data.transcription,
        isTranscribed: data.isTranscribed || false,
      };
    } catch (error) {
      console.error("❌ Error fetching whisper:", error);
      return null;
    }
  }

  /**
   * Get comments for a whisper
   */
  async getComments(whisperId: string): Promise<Comment[]> {
    try {
      const commentsQuery = query(
        collection(this.firestore, FIRESTORE_COLLECTIONS.REPLIES),
        where("whisperId", "==", whisperId),
        orderBy("createdAt", "desc")
      );

      const querySnapshot = await getDocs(commentsQuery);
      const comments: Comment[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        comments.push({
          id: doc.id,
          whisperId: data.whisperId,
          userId: data.userId,
          userDisplayName: data.userDisplayName,
          userProfileColor: data.userProfileColor,
          text: data.text,
          likes: data.likes || 0,
          createdAt: data.createdAt?.toDate() || new Date(),
          isEdited: data.isEdited || false,
          editedAt: data.editedAt?.toDate(),
        });
      });

      console.log(
        `✅ Fetched ${comments.length} comments for whisper ${whisperId}`
      );
      return comments;
    } catch (error) {
      console.error("❌ Error fetching comments:", error);
      throw new Error(
        `Failed to fetch comments: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Like a comment
   */
  async likeComment(commentId: string, userId: string): Promise<void> {
    try {
      const commentRef = doc(
        this.firestore,
        FIRESTORE_COLLECTIONS.REPLIES,
        commentId
      );

      // Check if user already liked this comment
      const likeQuery = query(
        collection(this.firestore, "commentLikes"),
        where("commentId", "==", commentId),
        where("userId", "==", userId)
      );

      const likeSnapshot = await getDocs(likeQuery);

      if (likeSnapshot.empty) {
        // User hasn't liked this comment yet - add like
        await addDoc(collection(this.firestore, "commentLikes"), {
          commentId,
          userId,
          createdAt: serverTimestamp(),
        });

        // Increment comment like count
        await updateDoc(commentRef, {
          likes: increment(1),
        });

        console.log("✅ Comment liked successfully");
      } else {
        // User already liked this comment - remove like
        const likeDoc = likeSnapshot.docs[0];
        await deleteDoc(doc(this.firestore, "commentLikes", likeDoc.id));

        // Decrement comment like count
        await updateDoc(commentRef, {
          likes: increment(-1),
        });

        console.log("✅ Comment unliked successfully");
      }
    } catch (error) {
      console.error("❌ Error liking/unliking comment:", error);
      throw new Error(
        `Failed to like/unlike comment: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Delete a comment (only by the creator)
   */
  async deleteComment(commentId: string, userId: string): Promise<void> {
    try {
      const commentRef = doc(
        this.firestore,
        FIRESTORE_COLLECTIONS.REPLIES,
        commentId
      );

      // Get comment to check ownership and get whisperId
      const commentDoc = await getDoc(commentRef);
      if (!commentDoc.exists()) {
        throw new Error("Comment not found");
      }

      const commentData = commentDoc.data();
      if (commentData.userId !== userId) {
        throw new Error("You can only delete your own comments");
      }

      // Delete the comment
      await deleteDoc(commentRef);

      // Decrement whisper reply count
      const whisperRef = doc(
        this.firestore,
        this.whispersCollection,
        commentData.whisperId
      );

      await updateDoc(whisperRef, {
        replies: increment(-1),
      });

      console.log("✅ Comment deleted successfully");
    } catch (error) {
      console.error("❌ Error deleting comment:", error);
      throw new Error(
        `Failed to delete comment: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Delete a whisper (only by the creator)
   */
  async deleteWhisper(whisperId: string, userId: string): Promise<void> {
    try {
      const whisperRef = doc(
        this.firestore,
        this.whispersCollection,
        whisperId
      );

      // TODO: Add security rule to ensure only creator can delete
      await deleteDoc(whisperRef);

      console.log("✅ Whisper deleted successfully");
    } catch (error) {
      console.error("❌ Error deleting whisper:", error);
      throw new Error(
        `Failed to delete whisper: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
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
      const whisperRef = doc(
        this.firestore,
        this.whispersCollection,
        whisperId
      );

      await updateDoc(whisperRef, {
        transcription,
        isTranscribed: true,
      });

      console.log("✅ Transcription updated successfully");
    } catch (error) {
      console.error("❌ Error updating transcription:", error);
      throw new Error(
        `Failed to update transcription: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get user's whispers
   */
  async getUserWhispers(userId: string): Promise<PaginatedWhispersResult> {
    return this.getWhispers({ userId });
  }

  /**
   * Reset singleton instance
   */
  static resetInstance(): void {
    if (FirestoreService.instance) {
      FirestoreService.instance = new FirestoreService();
      console.log("🔄 FirestoreService singleton reset successfully");
    }
  }

  /**
   * Destroy singleton instance
   */
  static destroyInstance(): void {
    if (FirestoreService.instance) {
      FirestoreService.instance = null as any;
      console.log("🗑️ FirestoreService singleton destroyed");
    }
  }
}

/**
 * Factory function to get FirestoreService instance
 */
export const getFirestoreService = (): FirestoreService => {
  return FirestoreService.getInstance();
};

/**
 * Reset the FirestoreService singleton instance
 */
export const resetFirestoreService = (): void => {
  FirestoreService.resetInstance();
};

/**
 * Destroy the FirestoreService singleton instance
 */
export const destroyFirestoreService = (): void => {
  FirestoreService.destroyInstance();
};
