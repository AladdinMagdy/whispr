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
  onSnapshot,
  serverTimestamp,
  increment,
  Timestamp,
  FieldValue,
  setDoc,
  UpdateData,
} from "firebase/firestore";
import { getFirestoreInstance } from "@/config/firebase";
import {
  Whisper,
  Comment,
  Like,
  UserReputation,
  ModerationResult,
  ViolationType,
  Report,
  ReportFilters,
  ReportStats,
  ReportCategory,
  ReportStatus,
  ReportPriority,
  Appeal,
  AppealStatus,
  Suspension,
} from "@/types";
import { FIRESTORE_COLLECTIONS } from "@/constants";
import type { ViolationRecord } from "@/types";

export interface WhisperUploadData {
  audioUrl: string;
  duration: number;
  whisperPercentage: number;
  averageLevel: number;
  confidence: number;
  transcription?: string;
  moderationResult?: ModerationResult;
}

export interface LikeData {
  whisperId: string;
  userId: string;
  userDisplayName?: string;
  userProfileColor?: string;
  createdAt: Timestamp | Date | null | FieldValue;
}

export interface CommentLikeData {
  commentId: string;
  userId: string;
  userDisplayName?: string;
  userProfileColor?: string;
  createdAt: Timestamp | Date | null | FieldValue;
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
        isMinor,
        contentPreferences,
      } = options;

      let q = query(
        collection(this.firestore, this.whispersCollection),
        orderBy("createdAt", "desc"),
        limit(limitCount)
      );

      // Apply age-based content filtering
      if (isMinor) {
        // Minors only see G and PG content
        q = query(q, where("moderationResult.contentRank", "in", ["G", "PG"]));
      } else if (contentPreferences && !contentPreferences.allowAdultContent) {
        // Adults with strict filtering see G, PG, and PG13 content
        q = query(
          q,
          where("moderationResult.contentRank", "in", ["G", "PG", "PG13"])
        );
      }
      // Adults with allowAdultContent: true see all content (no additional filter)

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
          moderationResult: data.moderationResult,
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
      const {
        limit: limitCount = 20,
        userId,
        isMinor,
        contentPreferences,
      } = options;

      let q = query(
        collection(this.firestore, this.whispersCollection),
        orderBy("createdAt", "desc"),
        limit(limitCount)
      );

      // Apply age-based content filtering
      if (isMinor) {
        // Minors only see G and PG content
        q = query(q, where("moderationResult.contentRank", "in", ["G", "PG"]));
      } else if (contentPreferences && !contentPreferences.allowAdultContent) {
        // Adults with strict filtering see G, PG, and PG13 content
        q = query(
          q,
          where("moderationResult.contentRank", "in", ["G", "PG", "PG13"])
        );
      }
      // Adults with allowAdultContent: true see all content (no additional filter)

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
              moderationResult: data.moderationResult,
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
    sinceTimestamp?: Date,
    options: WhisperFeedOptions = {}
  ): () => void {
    try {
      // Listen to whispers created after the given timestamp
      const startTime = sinceTimestamp || new Date(Date.now() - 60000); // Default: last minute
      const { isMinor, contentPreferences } = options;

      let q = query(
        collection(this.firestore, this.whispersCollection),
        where("createdAt", ">", startTime),
        orderBy("createdAt", "desc")
      );

      // Apply age-based content filtering
      if (isMinor) {
        // Minors only see G and PG content
        q = query(q, where("moderationResult.contentRank", "in", ["G", "PG"]));
      } else if (contentPreferences && !contentPreferences.allowAdultContent) {
        // Adults with strict filtering see G, PG, and PG13 content
        q = query(
          q,
          where("moderationResult.contentRank", "in", ["G", "PG", "PG13"])
        );
      }
      // Adults with allowAdultContent: true see all content (no additional filter)

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
                moderationResult: data.moderationResult,
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
  async likeWhisper(
    whisperId: string,
    userId: string,
    userDisplayName?: string,
    userProfileColor?: string
  ): Promise<void> {
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
        const likeData: LikeData = {
          whisperId,
          userId,
          createdAt: serverTimestamp(),
        };

        // Add user display info if provided
        if (userDisplayName) {
          likeData.userDisplayName = userDisplayName;
        }
        if (userProfileColor) {
          likeData.userProfileColor = userProfileColor;
        }

        await addDoc(
          collection(this.firestore, FIRESTORE_COLLECTIONS.LIKES),
          likeData
        );

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
   * Get likes for a whisper (paginated)
   */
  async getWhisperLikes(
    whisperId: string,
    limitCount: number = 50,
    startAfterDoc?: QueryDocumentSnapshot<DocumentData>
  ): Promise<{
    likes: Like[];
    lastDoc: QueryDocumentSnapshot<DocumentData> | null;
    hasMore: boolean;
  }> {
    try {
      const likesQuery = query(
        collection(this.firestore, FIRESTORE_COLLECTIONS.LIKES),
        where("whisperId", "==", whisperId),
        orderBy("createdAt", "desc"),
        ...(startAfterDoc ? [startAfter(startAfterDoc)] : []),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(likesQuery);
      const likes: Like[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        likes.push({
          id: doc.id,
          whisperId: data.whisperId,
          userId: data.userId,
          userDisplayName: data.userDisplayName || "Anonymous",
          userProfileColor: data.userProfileColor || "#9E9E9E",
          createdAt: data.createdAt?.toDate() || new Date(),
        });
      });

      const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1] || null;
      const hasMore = querySnapshot.docs.length === limitCount;

      console.log(
        `✅ Fetched ${likes.length} likes for whisper ${whisperId}, hasMore: ${hasMore}`
      );
      return { likes, lastDoc, hasMore };
    } catch (error) {
      console.error("❌ Error fetching whisper likes:", error);
      throw new Error(
        `Failed to fetch whisper likes: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Validate and fix like count for a whisper
   */
  async validateAndFixLikeCount(whisperId: string): Promise<number> {
    try {
      // Get all likes for this whisper
      const likesQuery = query(
        collection(this.firestore, FIRESTORE_COLLECTIONS.LIKES),
        where("whisperId", "==", whisperId)
      );

      const querySnapshot = await getDocs(likesQuery);
      const actualLikeCount = querySnapshot.size;

      // Get current whisper like count
      const whisper = await this.getWhisper(whisperId);
      const currentLikeCount = whisper?.likes || 0;

      // If counts don't match, fix the whisper's like count
      if (actualLikeCount !== currentLikeCount) {
        console.log(
          `⚠️ Like count mismatch for whisper ${whisperId}: whisper says ${currentLikeCount}, but there are ${actualLikeCount} like documents`
        );

        const whisperRef = doc(
          this.firestore,
          this.whispersCollection,
          whisperId
        );
        await updateDoc(whisperRef, {
          likes: actualLikeCount,
        });

        console.log(
          `✅ Fixed like count for whisper ${whisperId}: ${actualLikeCount}`
        );
      }

      return actualLikeCount;
    } catch (error) {
      console.error("❌ Error validating like count:", error);
      throw new Error(
        `Failed to validate like count: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
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
        moderationResult: data.moderationResult,
      };
    } catch (error) {
      console.error("❌ Error fetching whisper:", error);
      return null;
    }
  }

  /**
   * Get comments for a whisper (paginated)
   */
  async getComments(
    whisperId: string,
    limitCount: number = 20,
    startAfterDoc?: QueryDocumentSnapshot<DocumentData>
  ): Promise<{
    comments: Comment[];
    lastDoc: QueryDocumentSnapshot<DocumentData> | null;
    hasMore: boolean;
  }> {
    try {
      const commentsQuery = query(
        collection(this.firestore, FIRESTORE_COLLECTIONS.REPLIES),
        where("whisperId", "==", whisperId),
        orderBy("createdAt", "desc"),
        ...(startAfterDoc ? [startAfter(startAfterDoc)] : []),
        limit(limitCount)
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

      const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1] || null;
      const hasMore = querySnapshot.docs.length === limitCount;

      console.log(
        `✅ Fetched ${comments.length} comments for whisper ${whisperId}, hasMore: ${hasMore}`
      );
      return { comments, lastDoc, hasMore };
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
  async likeComment(
    commentId: string,
    userId: string,
    userDisplayName?: string,
    userProfileColor?: string
  ): Promise<void> {
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
        const likeData: {
          commentId: string;
          userId: string;
          createdAt: FieldValue;
          userDisplayName?: string;
          userProfileColor?: string;
        } = {
          commentId,
          userId,
          createdAt: serverTimestamp(),
        };

        // Add user display info if provided
        if (userDisplayName) {
          likeData.userDisplayName = userDisplayName;
        }
        if (userProfileColor) {
          likeData.userProfileColor = userProfileColor;
        }

        await addDoc(collection(this.firestore, "commentLikes"), likeData);

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
  async deleteWhisper(whisperId: string): Promise<void> {
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
      FirestoreService.instance = null as unknown as FirestoreService;
      console.log("🗑️ FirestoreService singleton destroyed");
    }
  }

  /**
   * Get a single comment by ID
   */
  async getComment(commentId: string): Promise<Comment | null> {
    try {
      const commentRef = doc(
        this.firestore,
        FIRESTORE_COLLECTIONS.REPLIES,
        commentId
      );

      const commentDoc = await getDoc(commentRef);
      if (!commentDoc.exists()) {
        return null;
      }

      const data = commentDoc.data();
      return {
        id: commentDoc.id,
        whisperId: data.whisperId,
        userId: data.userId,
        userDisplayName: data.userDisplayName,
        userProfileColor: data.userProfileColor,
        text: data.text,
        likes: data.likes || 0,
        createdAt: data.createdAt?.toDate() || new Date(),
        isEdited: data.isEdited || false,
        editedAt: data.editedAt?.toDate(),
      };
    } catch (error) {
      console.error("❌ Error fetching comment:", error);
      throw new Error(
        `Failed to fetch comment: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Check if user has liked a comment
   */
  async hasUserLikedComment(
    commentId: string,
    userId: string
  ): Promise<boolean> {
    try {
      const likeQuery = query(
        collection(this.firestore, "commentLikes"),
        where("commentId", "==", commentId),
        where("userId", "==", userId)
      );

      const likeSnapshot = await getDocs(likeQuery);
      return !likeSnapshot.empty;
    } catch (error) {
      console.error("❌ Error checking comment like state:", error);
      throw new Error(
        `Failed to check comment like state: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get likes for a comment (paginated)
   */
  async getCommentLikes(
    commentId: string,
    limitCount: number = 50,
    startAfterDoc?: QueryDocumentSnapshot<DocumentData>
  ): Promise<{
    likes: CommentLikeData[];
    lastDoc: QueryDocumentSnapshot<DocumentData> | null;
    hasMore: boolean;
  }> {
    try {
      const likesQuery = query(
        collection(this.firestore, "commentLikes"),
        where("commentId", "==", commentId),
        orderBy("createdAt", "desc"),
        ...(startAfterDoc ? [startAfter(startAfterDoc)] : []),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(likesQuery);
      const likes: CommentLikeData[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        likes.push({
          commentId: data.commentId,
          userId: data.userId,
          userDisplayName: data.userDisplayName || "Anonymous",
          userProfileColor: data.userProfileColor || "#9E9E9E",
          createdAt: data.createdAt,
        });
      });

      const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1] || null;
      const hasMore = querySnapshot.docs.length === limitCount;

      console.log(
        `✅ Fetched ${likes.length} comment likes for comment ${commentId}, hasMore: ${hasMore}`
      );
      return { likes, lastDoc, hasMore };
    } catch (error) {
      console.error("❌ Error fetching comment likes:", error);
      throw new Error(
        `Failed to fetch comment likes: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Real-time listener for comments on a whisper
   */
  subscribeToComments(
    whisperId: string,
    callback: (comments: Comment[]) => void
  ): () => void {
    try {
      const commentsQuery = query(
        collection(this.firestore, FIRESTORE_COLLECTIONS.REPLIES),
        where("whisperId", "==", whisperId),
        orderBy("createdAt", "desc")
      );
      const unsubscribe = onSnapshot(
        commentsQuery,
        (querySnapshot) => {
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
          callback(comments);
        },
        (error) => {
          console.error("❌ Real-time comments listener error:", error);
        }
      );
      return unsubscribe;
    } catch (error) {
      console.error("❌ Error setting up real-time comments listener:", error);
      throw error;
    }
  }

  /**
   * Real-time listener for likes on a whisper
   */
  subscribeToWhisperLikes(
    whisperId: string,
    callback: (likes: Like[]) => void
  ): () => void {
    try {
      const likesQuery = query(
        collection(this.firestore, FIRESTORE_COLLECTIONS.LIKES),
        where("whisperId", "==", whisperId),
        orderBy("createdAt", "desc")
      );
      const unsubscribe = onSnapshot(
        likesQuery,
        (querySnapshot) => {
          const likes: Like[] = [];
          querySnapshot.forEach((doc) => {
            const data = doc.data();
            likes.push({
              id: doc.id,
              whisperId: data.whisperId,
              userId: data.userId,
              userDisplayName: data.userDisplayName || "Anonymous",
              userProfileColor: data.userProfileColor || "#9E9E9E",
              createdAt: data.createdAt?.toDate() || new Date(),
            });
          });
          callback(likes);
        },
        (error) => {
          console.error("❌ Real-time whisper likes listener error:", error);
        }
      );
      return unsubscribe;
    } catch (error) {
      console.error(
        "❌ Error setting up real-time whisper likes listener:",
        error
      );
      throw error;
    }
  }

  /**
   * Real-time listener for likes on a comment
   */
  subscribeToCommentLikes(
    commentId: string,
    callback: (likes: CommentLikeData[]) => void
  ): () => void {
    try {
      const likesQuery = query(
        collection(this.firestore, "commentLikes"),
        where("commentId", "==", commentId),
        orderBy("createdAt", "desc")
      );
      const unsubscribe = onSnapshot(
        likesQuery,
        async (querySnapshot) => {
          const likes: CommentLikeData[] = [];
          for (const likeDoc of querySnapshot.docs) {
            const likeData = likeDoc.data();
            likes.push({
              commentId: likeData.commentId,
              userId: likeData.userId,
              userDisplayName: likeData.userDisplayName || "Anonymous",
              userProfileColor: likeData.userProfileColor || "#9E9E9E",
              createdAt: likeData.createdAt,
            });
          }
          callback(likes);
        },
        (error) => {
          console.error("Error in comment likes subscription:", error);
        }
      );
      return unsubscribe;
    } catch (error) {
      console.error("Error setting up comment likes subscription:", error);
      return () => {}; // Return empty function
    }
  }

  /**
   * Save user reputation to Firestore
   */
  async saveUserReputation(reputation: UserReputation): Promise<void> {
    try {
      const reputationRef = doc(
        this.firestore,
        "userReputations",
        reputation.userId
      );
      // Filter out undefined values before saving to Firestore
      const reputationData: Record<string, unknown> = {
        ...reputation,
        createdAt: reputation.createdAt.toISOString(),
        updatedAt: reputation.updatedAt.toISOString(),
        violationHistory: reputation.violationHistory.map((violation) => ({
          ...violation,
          timestamp: violation.timestamp.toISOString(),
        })),
      };

      // Only include lastViolation if it's defined
      if (reputation.lastViolation) {
        reputationData.lastViolation = reputation.lastViolation.toISOString();
      }

      await setDoc(reputationRef, reputationData);
      console.log(`✅ User reputation saved for ${reputation.userId}`);
    } catch (error) {
      console.error("❌ Error saving user reputation:", error);
      throw new Error(
        `Failed to save user reputation: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get user reputation from Firestore
   */
  async getUserReputation(userId: string): Promise<UserReputation | null> {
    try {
      const reputationRef = doc(this.firestore, "userReputations", userId);
      const reputationDoc = await getDoc(reputationRef);

      if (!reputationDoc.exists()) {
        return null;
      }

      const data = reputationDoc.data();
      return {
        ...data,
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt),
        lastViolation: data.lastViolation
          ? new Date(data.lastViolation)
          : undefined,
        violationHistory:
          data.violationHistory?.map((violation: ViolationRecord) => ({
            ...violation,
            timestamp:
              typeof violation.timestamp === "string"
                ? new Date(violation.timestamp)
                : violation.timestamp,
          })) || [],
      } as UserReputation;
    } catch (error) {
      console.error("❌ Error getting user reputation:", error);
      throw new Error(
        `Failed to get user reputation: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Update user reputation (partial update)
   */
  async updateUserReputation(
    userId: string,
    updates: Partial<UserReputation>
  ): Promise<void> {
    try {
      const reputationRef = doc(this.firestore, "userReputations", userId);
      const { lastViolation, ...otherUpdates } = updates;

      // Filter out undefined values
      const filteredUpdates = Object.fromEntries(
        Object.entries(otherUpdates).filter(([, value]) => value !== undefined)
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateData: Record<string, any> = {
        ...filteredUpdates,
        updatedAt: new Date().toISOString(),
      };

      // Handle date fields
      if (lastViolation) {
        updateData.lastViolation =
          lastViolation instanceof Date
            ? lastViolation.toISOString()
            : new Date(lastViolation).toISOString();
      }

      await updateDoc(reputationRef, updateData);
      console.log(`✅ User reputation updated for ${userId}`);
    } catch (error) {
      console.error("❌ Error updating user reputation:", error);
      throw new Error(
        `Failed to update user reputation: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Delete user reputation (for admin actions)
   */
  async deleteUserReputation(userId: string): Promise<void> {
    try {
      const reputationRef = doc(this.firestore, "userReputations", userId);
      await deleteDoc(reputationRef);
      console.log(`✅ User reputation deleted for ${userId}`);
    } catch (error) {
      console.error("❌ Error deleting user reputation:", error);
      throw new Error(
        `Failed to delete user reputation: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get reputation statistics for admin dashboard
   */
  async getReputationStats(): Promise<{
    totalUsers: number;
    trustedUsers: number;
    verifiedUsers: number;
    standardUsers: number;
    flaggedUsers: number;
    bannedUsers: number;
    averageScore: number;
  }> {
    try {
      const reputationRef = collection(this.firestore, "userReputations");
      const snapshot = await getDocs(reputationRef);

      let totalUsers = 0;
      let trustedUsers = 0;
      let verifiedUsers = 0;
      let standardUsers = 0;
      let flaggedUsers = 0;
      let bannedUsers = 0;
      let totalScore = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();
        totalUsers++;
        totalScore += data.score || 0;

        switch (data.level) {
          case "trusted":
            trustedUsers++;
            break;
          case "verified":
            verifiedUsers++;
            break;
          case "standard":
            standardUsers++;
            break;
          case "flagged":
            flaggedUsers++;
            break;
          case "banned":
            bannedUsers++;
            break;
        }
      });

      return {
        totalUsers,
        trustedUsers,
        verifiedUsers,
        standardUsers,
        flaggedUsers,
        bannedUsers,
        averageScore: totalUsers > 0 ? Math.round(totalScore / totalUsers) : 0,
      };
    } catch (error) {
      console.error("❌ Error getting reputation stats:", error);
      throw new Error(
        `Failed to get reputation stats: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get users by reputation level (for admin dashboard)
   */
  async getUsersByReputationLevel(
    level: UserReputation["level"],
    limitCount = 50
  ): Promise<UserReputation[]> {
    try {
      const reputationRef = collection(this.firestore, "userReputations");
      const q = query(
        reputationRef,
        where("level", "==", level),
        orderBy("updatedAt", "desc"),
        limit(limitCount)
      );

      const snapshot = await getDocs(q);
      const reputations: UserReputation[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        reputations.push({
          ...data,
          createdAt: new Date(data.createdAt),
          updatedAt: new Date(data.updatedAt),
          lastViolation: data.lastViolation
            ? new Date(data.lastViolation)
            : undefined,
          violationHistory:
            data.violationHistory?.map((violation: ViolationRecord) => ({
              ...violation,
              timestamp:
                typeof violation.timestamp === "string"
                  ? new Date(violation.timestamp)
                  : violation.timestamp,
            })) || [],
        } as UserReputation);
      });

      return reputations;
    } catch (error) {
      console.error("❌ Error getting users by reputation level:", error);
      throw new Error(
        `Failed to get users by reputation level: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get users with recent violations (for admin dashboard)
   */
  async getUsersWithRecentViolations(
    daysBack = 7,
    limitCount = 50
  ): Promise<UserReputation[]> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);

      const reputationRef = collection(this.firestore, "userReputations");
      const q = query(
        reputationRef,
        where("lastViolation", ">=", cutoffDate.toISOString()),
        orderBy("lastViolation", "desc"),
        limit(limitCount)
      );

      const snapshot = await getDocs(q);
      const reputations: UserReputation[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        reputations.push({
          ...data,
          createdAt: new Date(data.createdAt),
          updatedAt: new Date(data.updatedAt),
          lastViolation: data.lastViolation
            ? new Date(data.lastViolation)
            : undefined,
          violationHistory:
            data.violationHistory?.map((violation: ViolationRecord) => ({
              ...violation,
              timestamp:
                typeof violation.timestamp === "string"
                  ? new Date(violation.timestamp)
                  : violation.timestamp,
            })) || [],
        } as UserReputation);
      });

      return reputations;
    } catch (error) {
      console.error("❌ Error getting users with recent violations:", error);
      throw new Error(
        `Failed to get users with recent violations: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Admin: Reset user reputation to default
   */
  async resetUserReputation(userId: string): Promise<void> {
    try {
      const defaultReputation: UserReputation = {
        userId,
        score: 75, // Start with "verified" level
        level: "verified",
        totalWhispers: 0,
        approvedWhispers: 0,
        flaggedWhispers: 0,
        rejectedWhispers: 0,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.saveUserReputation(defaultReputation);
      console.log(`✅ User reputation reset for ${userId}`);
    } catch (error) {
      console.error("❌ Error resetting user reputation:", error);
      throw new Error(
        `Failed to reset user reputation: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Admin: Manually adjust user reputation score
   */
  async adjustUserReputationScore(
    userId: string,
    newScore: number,
    reason: string
  ): Promise<void> {
    try {
      const reputation = await this.getUserReputation(userId);
      if (!reputation) {
        throw new Error("User reputation not found");
      }

      const oldScore = reputation.score;
      const updatedReputation: UserReputation = {
        ...reputation,
        score: Math.max(0, Math.min(100, newScore)), // Clamp between 0-100
        level: this.getReputationLevel(newScore),
        updatedAt: new Date(),
        violationHistory: [
          ...reputation.violationHistory,
          {
            id: `admin-${Date.now()}`,
            whisperId: "admin-adjustment",
            violationType: "admin_adjustment" as ViolationType,
            severity: "medium",
            timestamp: new Date(),
            resolved: false,
            notes: `Admin adjustment: ${oldScore} → ${newScore}. Reason: ${reason}`,
          },
        ],
      };

      await this.saveUserReputation(updatedReputation);
      console.log(
        `✅ User reputation score adjusted for ${userId}: ${oldScore} → ${newScore}`
      );
    } catch (error) {
      console.error("❌ Error adjusting user reputation score:", error);
      throw new Error(
        `Failed to adjust user reputation score: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Helper: Get reputation level from score
   */
  private getReputationLevel(score: number): UserReputation["level"] {
    if (score >= 90) return "trusted";
    if (score >= 75) return "verified";
    if (score >= 50) return "standard";
    if (score >= 25) return "flagged";
    return "banned";
  }

  /**
   * Save a new report to Firestore
   */
  async saveReport(report: Report): Promise<void> {
    try {
      // Filter out undefined values before saving to Firestore
      const { evidence, ...reportWithoutEvidence } = report;
      const reportData: Record<string, unknown> = {
        ...reportWithoutEvidence,
        createdAt:
          report.createdAt instanceof Date
            ? report.createdAt.toISOString()
            : report.createdAt,
        updatedAt:
          report.updatedAt instanceof Date
            ? report.updatedAt.toISOString()
            : report.updatedAt,
      };

      // Only include optional fields if they're defined
      if (report.reviewedAt) {
        reportData.reviewedAt =
          report.reviewedAt instanceof Date
            ? report.reviewedAt.toISOString()
            : report.reviewedAt;
      }

      if (report.resolution) {
        reportData.resolution = {
          ...report.resolution,
          timestamp:
            report.resolution.timestamp instanceof Date
              ? report.resolution.timestamp.toISOString()
              : report.resolution.timestamp,
        };
      }

      if (evidence !== undefined) {
        reportData.evidence = evidence;
      }

      await setDoc(doc(this.firestore, "reports", report.id), reportData);

      console.log("✅ Report saved successfully:", report.id);
    } catch (error) {
      console.error("❌ Error saving report:", error);
      throw new Error(
        `Failed to save report: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get reports with filtering
   */
  async getReports(filters: ReportFilters = {}): Promise<Report[]> {
    try {
      let q = query(
        collection(this.firestore, "reports"),
        orderBy("createdAt", "desc")
      );

      // Apply filters
      if (filters.status) {
        q = query(q, where("status", "==", filters.status));
      }
      if (filters.category) {
        q = query(q, where("category", "==", filters.category));
      }
      if (filters.priority) {
        q = query(q, where("priority", "==", filters.priority));
      }
      if (filters.reporterId) {
        q = query(q, where("reporterId", "==", filters.reporterId));
      }
      if (filters.whisperId) {
        q = query(q, where("whisperId", "==", filters.whisperId));
      }

      const querySnapshot = await getDocs(q);
      const reports: Report[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        reports.push({
          id: doc.id,
          whisperId: data.whisperId,
          reporterId: data.reporterId,
          reporterDisplayName: data.reporterDisplayName,
          reporterReputation: data.reporterReputation,
          category: data.category,
          priority: data.priority,
          status: data.status,
          reason: data.reason,
          evidence: data.evidence,
          createdAt: new Date(data.createdAt),
          updatedAt: new Date(data.updatedAt),
          reviewedAt: data.reviewedAt ? new Date(data.reviewedAt) : undefined,
          reviewedBy: data.reviewedBy,
          resolution: data.resolution
            ? {
                ...data.resolution,
                timestamp: new Date(data.resolution.timestamp),
              }
            : undefined,
          reputationWeight: data.reputationWeight,
        });
      });

      // Apply date range filter in memory if specified
      if (filters.dateRange) {
        return reports.filter(
          (report) =>
            report.createdAt >= filters.dateRange!.start &&
            report.createdAt <= filters.dateRange!.end
        );
      }

      return reports;
    } catch (error) {
      console.error("❌ Error getting reports:", error);
      throw new Error(
        `Failed to get reports: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get a single report by ID
   */
  async getReport(reportId: string): Promise<Report | null> {
    try {
      const docRef = doc(this.firestore, "reports", reportId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      const data = docSnap.data();
      return {
        id: docSnap.id,
        whisperId: data.whisperId,
        reporterId: data.reporterId,
        reporterDisplayName: data.reporterDisplayName,
        reporterReputation: data.reporterReputation,
        category: data.category,
        priority: data.priority,
        status: data.status,
        reason: data.reason,
        evidence: data.evidence,
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt),
        reviewedAt: data.reviewedAt ? new Date(data.reviewedAt) : undefined,
        reviewedBy: data.reviewedBy,
        resolution: data.resolution
          ? {
              ...data.resolution,
              timestamp: new Date(data.resolution.timestamp),
            }
          : undefined,
        reputationWeight: data.reputationWeight,
      };
    } catch (error) {
      console.error("❌ Error getting report:", error);
      throw new Error(
        `Failed to get report: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Update a report
   */
  async updateReport(
    reportId: string,
    updates: Partial<Report>
  ): Promise<void> {
    try {
      // Filter out undefined values
      const filteredUpdates = Object.fromEntries(
        Object.entries(updates).filter(([, value]) => value !== undefined)
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateData: Record<string, any> = {
        ...filteredUpdates,
        updatedAt: new Date().toISOString(),
      };

      // Handle date fields
      if (updates.reviewedAt) {
        updateData.reviewedAt =
          updates.reviewedAt instanceof Date
            ? updates.reviewedAt.toISOString()
            : updates.reviewedAt;
      }

      if (updates.resolution) {
        updateData.resolution = {
          ...updates.resolution,
          timestamp:
            updates.resolution.timestamp instanceof Date
              ? updates.resolution.timestamp.toISOString()
              : updates.resolution.timestamp,
        };
      }

      await updateDoc(doc(this.firestore, "reports", reportId), updateData);

      console.log("✅ Report updated successfully:", reportId);
    } catch (error) {
      console.error("❌ Error updating report:", error);
      throw new Error(
        `Failed to update report: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get reporting statistics
   */
  async getReportStats(): Promise<ReportStats> {
    try {
      const allReports = await this.getReports();

      const reportsByCategory: Record<ReportCategory, number> = {
        [ReportCategory.HARASSMENT]: 0,
        [ReportCategory.HATE_SPEECH]: 0,
        [ReportCategory.VIOLENCE]: 0,
        [ReportCategory.SEXUAL_CONTENT]: 0,
        [ReportCategory.SPAM]: 0,
        [ReportCategory.SCAM]: 0,
        [ReportCategory.COPYRIGHT]: 0,
        [ReportCategory.PERSONAL_INFO]: 0,
        [ReportCategory.MINOR_SAFETY]: 0,
        [ReportCategory.OTHER]: 0,
      };

      const reportsByPriority: Record<ReportPriority, number> = {
        [ReportPriority.LOW]: 0,
        [ReportPriority.MEDIUM]: 0,
        [ReportPriority.HIGH]: 0,
        [ReportPriority.CRITICAL]: 0,
      };

      let totalResolutionTime = 0;
      let resolvedCount = 0;

      allReports.forEach((report) => {
        reportsByCategory[report.category]++;
        reportsByPriority[report.priority]++;

        if (report.status === ReportStatus.RESOLVED && report.reviewedAt) {
          const resolutionTime =
            report.reviewedAt.getTime() - report.createdAt.getTime();
          totalResolutionTime += resolutionTime;
          resolvedCount++;
        }
      });

      const averageResolutionTime =
        resolvedCount > 0
          ? totalResolutionTime / resolvedCount / (1000 * 60 * 60) // Convert to hours
          : 0;

      return {
        totalReports: allReports.length,
        pendingReports: allReports.filter(
          (r) => r.status === ReportStatus.PENDING
        ).length,
        criticalReports: allReports.filter(
          (r) => r.priority === ReportPriority.CRITICAL
        ).length,
        resolvedReports: allReports.filter(
          (r) => r.status === ReportStatus.RESOLVED
        ).length,
        averageResolutionTime,
        reportsByCategory,
        reportsByPriority,
      };
    } catch (error) {
      console.error("❌ Error getting report stats:", error);
      throw new Error(
        `Failed to get report stats: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // Appeal methods
  async saveAppeal(appeal: Appeal): Promise<void> {
    try {
      await setDoc(doc(this.firestore, "appeals", appeal.id), {
        ...appeal,
        submittedAt: Timestamp.fromDate(appeal.submittedAt),
        reviewedAt: appeal.reviewedAt
          ? Timestamp.fromDate(appeal.reviewedAt)
          : null,
        createdAt: Timestamp.fromDate(appeal.createdAt),
        updatedAt: Timestamp.fromDate(appeal.updatedAt),
      });
      console.log("✅ Appeal saved successfully:", appeal.id);
    } catch (error) {
      console.error("❌ Error saving appeal:", error);
      throw new Error(
        `Failed to save appeal: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getAppeal(appealId: string): Promise<Appeal | null> {
    try {
      const docRef = doc(this.firestore, "appeals", appealId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          ...data,
          submittedAt: data.submittedAt?.toDate() || new Date(),
          reviewedAt: data.reviewedAt?.toDate(),
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as Appeal;
      }

      return null;
    } catch (error) {
      console.error("❌ Error getting appeal:", error);
      return null;
    }
  }

  async getUserAppeals(userId: string): Promise<Appeal[]> {
    try {
      const q = query(
        collection(this.firestore, "appeals"),
        where("userId", "==", userId),
        orderBy("createdAt", "desc")
      );

      const querySnapshot = await getDocs(q);
      const appeals: Appeal[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        appeals.push({
          ...data,
          submittedAt: data.submittedAt?.toDate() || new Date(),
          reviewedAt: data.reviewedAt?.toDate(),
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as Appeal);
      });

      return appeals;
    } catch (error) {
      console.error("❌ Error getting user appeals:", error);
      return [];
    }
  }

  async getPendingAppeals(): Promise<Appeal[]> {
    try {
      const q = query(
        collection(this.firestore, "appeals"),
        where("status", "==", AppealStatus.PENDING),
        orderBy("submittedAt", "asc")
      );

      const querySnapshot = await getDocs(q);
      const appeals: Appeal[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        appeals.push({
          ...data,
          submittedAt: data.submittedAt?.toDate() || new Date(),
          reviewedAt: data.reviewedAt?.toDate(),
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as Appeal);
      });

      return appeals;
    } catch (error) {
      console.error("❌ Error getting pending appeals:", error);
      return [];
    }
  }

  async updateAppeal(
    appealId: string,
    updates: Partial<Appeal>
  ): Promise<void> {
    try {
      const updateData: UpdateData<Appeal> = {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date()),
      };

      if (updates.reviewedAt) {
        updateData.reviewedAt = Timestamp.fromDate(updates.reviewedAt);
      }

      await updateDoc(doc(this.firestore, "appeals", appealId), updateData);
      console.log("✅ Appeal updated successfully:", appealId);
    } catch (error) {
      console.error("❌ Error updating appeal:", error);
      throw new Error(
        `Failed to update appeal: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getAllAppeals(): Promise<Appeal[]> {
    try {
      const q = query(
        collection(this.firestore, "appeals"),
        orderBy("createdAt", "desc")
      );

      const querySnapshot = await getDocs(q);
      const appeals: Appeal[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        appeals.push({
          ...data,
          submittedAt: data.submittedAt?.toDate() || new Date(),
          reviewedAt: data.reviewedAt?.toDate(),
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as Appeal);
      });

      return appeals;
    } catch (error) {
      console.error("❌ Error getting all appeals:", error);
      return [];
    }
  }

  // Suspension methods
  async saveSuspension(suspension: Suspension): Promise<void> {
    try {
      await setDoc(doc(this.firestore, "suspensions", suspension.id), {
        ...suspension,
        startDate: Timestamp.fromDate(suspension.startDate),
        endDate: Timestamp.fromDate(suspension.endDate),
        createdAt: Timestamp.fromDate(suspension.createdAt),
        updatedAt: Timestamp.fromDate(suspension.updatedAt),
      });
      console.log("✅ Suspension saved successfully:", suspension.id);
    } catch (error) {
      console.error("❌ Error saving suspension:", error);
      throw new Error(
        `Failed to save suspension: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getSuspension(suspensionId: string): Promise<Suspension | null> {
    try {
      const docRef = doc(this.firestore, "suspensions", suspensionId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          ...data,
          startDate: data.startDate?.toDate() || new Date(),
          endDate: data.endDate?.toDate() || new Date(),
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as Suspension;
      }

      return null;
    } catch (error) {
      console.error("❌ Error getting suspension:", error);
      return null;
    }
  }

  async getUserSuspensions(userId: string): Promise<Suspension[]> {
    try {
      const q = query(
        collection(this.firestore, "suspensions"),
        where("userId", "==", userId),
        orderBy("createdAt", "desc")
      );

      const querySnapshot = await getDocs(q);
      const suspensions: Suspension[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        suspensions.push({
          ...data,
          startDate: data.startDate?.toDate() || new Date(),
          endDate: data.endDate?.toDate() || new Date(),
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as Suspension);
      });

      return suspensions;
    } catch (error) {
      console.error("❌ Error getting user suspensions:", error);
      return [];
    }
  }

  async updateSuspension(
    suspensionId: string,
    updates: Partial<Suspension>
  ): Promise<void> {
    try {
      const updateData: UpdateData<Suspension> = {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date()),
      };

      if (updates.endDate) {
        updateData.endDate = Timestamp.fromDate(updates.endDate);
      }

      await updateDoc(
        doc(this.firestore, "suspensions", suspensionId),
        updateData
      );
      console.log("✅ Suspension updated successfully:", suspensionId);
    } catch (error) {
      console.error("❌ Error updating suspension:", error);
      throw new Error(
        `Failed to update suspension: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getActiveSuspensions(): Promise<Suspension[]> {
    try {
      const q = query(
        collection(this.firestore, "suspensions"),
        where("isActive", "==", true),
        orderBy("createdAt", "desc")
      );

      const querySnapshot = await getDocs(q);
      const suspensions: Suspension[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        suspensions.push({
          ...data,
          startDate: data.startDate?.toDate() || new Date(),
          endDate: data.endDate?.toDate() || new Date(),
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as Suspension);
      });

      return suspensions;
    } catch (error) {
      console.error("❌ Error getting active suspensions:", error);
      return [];
    }
  }

  async getAllSuspensions(): Promise<Suspension[]> {
    try {
      const q = query(
        collection(this.firestore, "suspensions"),
        orderBy("createdAt", "desc")
      );

      const querySnapshot = await getDocs(q);
      const suspensions: Suspension[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        suspensions.push({
          ...data,
          startDate: data.startDate?.toDate() || new Date(),
          endDate: data.endDate?.toDate() || new Date(),
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as Suspension);
      });

      return suspensions;
    } catch (error) {
      console.error("❌ Error getting all suspensions:", error);
      return [];
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
