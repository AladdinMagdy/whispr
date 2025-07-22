/**
 * Firestore Service for Whispers
 * Handles core whisper data operations and real-time listeners
 * Domain-specific operations have been moved to dedicated repositories
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
  Query,
  QueryConstraint,
} from "firebase/firestore";
import { getFirestoreInstance } from "@/config/firebase";
import { Whisper, Comment, Like, ModerationResult } from "../types";
import { getErrorMessage } from "../utils/errorHelpers";
import {
  buildWhisperQueryConstraints,
  buildWhisperSubscriptionConstraints,
  buildCommentQueryConstraints,
  buildLikeQueryConstraints,
} from "../utils/firestoreQueryUtils";
import {
  transformQuerySnapshot,
  calculatePaginationMetadata,
  transformCommentData,
  transformLikeData,
  validateCommentData,
  validateLikeData,
  sanitizeCommentText,
  sanitizeUserDisplayName,
  type FirestoreLikeData,
  type FirestoreCommentData,
} from "../utils/firestoreDataTransformUtils";

// ===== INTERFACES =====

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

// ===== FIRESTORE SERVICE =====

export class FirestoreService {
  private static instance: FirestoreService | null = null;
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

  // ===== WHISPER OPERATIONS =====

  /**
   * Create a new whisper
   */
  async createWhisper(
    userId: string,
    userDisplayName: string,
    userProfileColor: string,
    uploadData: WhisperUploadData,
    suspensionServiceOverride?: {
      isUserSuspended: (userId: string) => Promise<{
        suspended: boolean;
        suspensions: Array<{ type: string }>;
      }>;
    } // Optional for testability
  ): Promise<string> {
    try {
      // Check if user is suspended
      const suspensionService = suspensionServiceOverride || {
        isUserSuspended: async () => ({ suspended: false, suspensions: [] }),
      };

      const suspensionStatus = await suspensionService.isUserSuspended(userId);
      if (suspensionStatus.suspended) {
        throw new Error("User is suspended and cannot create whispers");
      }

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
        transcription: uploadData.transcription || "",
        isTranscribed: !!uploadData.transcription,
        moderationResult: uploadData.moderationResult || null,
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
      // Build query constraints using utility function
      const { constraints } = buildWhisperQueryConstraints(options);

      // Create and execute query
      let whispersQuery: Query<DocumentData> = collection(
        this.firestore,
        this.whispersCollection
      );
      whispersQuery = query(whispersQuery, ...constraints);
      const querySnapshot = await getDocs(whispersQuery);

      // Transform query snapshot to whispers using utility function
      const whispers = transformQuerySnapshot(querySnapshot, (docId, data) => ({
        id: docId,
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
        transcription: data.transcription || "",
        isTranscribed: data.isTranscribed || false,
        moderationResult: data.moderationResult || undefined,
      }));

      // Calculate pagination metadata using utility function
      const { lastDoc, hasMore } = calculatePaginationMetadata(
        querySnapshot,
        options.limit || 20
      );

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

  // ===== REAL-TIME SUBSCRIPTIONS =====

  /**
   * Subscribe to whispers in real-time
   */
  subscribeToWhispers(
    callback: (whispers: Whisper[]) => void,
    options: WhisperFeedOptions = {}
  ): () => void {
    try {
      // Build query constraints using utility function
      const { constraints } = buildWhisperSubscriptionConstraints(options);

      // Create and execute query
      let whispersQuery: Query<DocumentData> = collection(
        this.firestore,
        this.whispersCollection
      );
      whispersQuery = query(whispersQuery, ...constraints);

      const unsubscribe = onSnapshot(whispersQuery, (querySnapshot) => {
        // Transform query snapshot to whispers using utility function
        const whispers = transformQuerySnapshot(
          querySnapshot,
          (docId, data) => ({
            id: docId,
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
            transcription: data.transcription || "",
            isTranscribed: data.isTranscribed || false,
            moderationResult: data.moderationResult || undefined,
          })
        );

        callback(whispers);
      });

      return unsubscribe;
    } catch (error) {
      console.error("❌ Error subscribing to whispers:", error);
      throw new Error(
        `Failed to subscribe to whispers: ${getErrorMessage(error)}`
      );
    }
  }

  /**
   * Subscribe to new whispers only
   */
  subscribeToNewWhispers(
    callback: (newWhisper: Whisper) => void,
    sinceTimestamp?: Date,
    options: WhisperFeedOptions = {}
  ): () => void {
    try {
      // Build query constraints using utility function
      const { constraints } = buildWhisperSubscriptionConstraints({
        ...options,
        sinceTimestamp,
        limit: 1,
      });

      // Create and execute query
      let whispersQuery: Query<DocumentData> = collection(
        this.firestore,
        this.whispersCollection
      );
      whispersQuery = query(whispersQuery, ...constraints);

      const unsubscribe = onSnapshot(whispersQuery, (querySnapshot) => {
        querySnapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            // Transform document to whisper using utility function
            const whisper = transformQuerySnapshot(
              {
                forEach: (
                  callback: (doc: {
                    id: string;
                    data: () => DocumentData;
                  }) => void
                ) => callback(change.doc),
              },
              (docId, data) => ({
                id: docId,
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
                transcription: data.transcription || "",
                isTranscribed: data.isTranscribed || false,
                moderationResult: data.moderationResult || undefined,
              })
            )[0];

            callback(whisper);
          }
        });
      });

      return unsubscribe;
    } catch (error) {
      console.error("❌ Error subscribing to new whispers:", error);
      throw new Error(
        `Failed to subscribe to new whispers: ${getErrorMessage(error)}`
      );
    }
  }

  // ===== LIKE OPERATIONS =====

  /**
   * Like or unlike a whisper
   */
  async likeWhisper(
    whisperId: string,
    userId: string,
    userDisplayName?: string,
    userProfileColor?: string
  ): Promise<void> {
    try {
      // Check if user already liked this whisper
      const likeDocRef = doc(this.firestore, "likes", `${whisperId}_${userId}`);
      const likeDoc = await getDoc(likeDocRef);

      if (likeDoc.exists()) {
        // Unlike: remove the like document and decrement count
        await deleteDoc(likeDocRef);
        await updateDoc(
          doc(this.firestore, this.whispersCollection, whisperId),
          {
            likes: increment(-1),
          }
        );
        console.log("👎 Whisper unliked successfully");
      } else {
        // Sanitize input data
        const sanitizedDisplayName = userDisplayName
          ? sanitizeUserDisplayName(userDisplayName)
          : "Anonymous";

        // Validate like data using utility function
        const likeData = {
          whisperId,
          userId,
          userDisplayName: sanitizedDisplayName,
          userProfileColor: userProfileColor || "#007AFF",
        };

        const validation = validateLikeData(likeData);
        if (!validation.isValid) {
          throw new Error(`Invalid like data: ${validation.errors.join(", ")}`);
        }

        const finalLikeData = {
          ...likeData,
          createdAt: serverTimestamp(),
        };

        await setDoc(likeDocRef, finalLikeData);
        await updateDoc(
          doc(this.firestore, this.whispersCollection, whisperId),
          {
            likes: increment(1),
          }
        );
        console.log("👍 Whisper liked successfully");
      }
    } catch (error) {
      console.error("❌ Error liking whisper:", error);
      throw new Error(`Failed to like whisper: ${getErrorMessage(error)}`);
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
      const likeDocRef = doc(this.firestore, "likes", `${whisperId}_${userId}`);
      const likeDoc = await getDoc(likeDocRef);
      return likeDoc.exists();
    } catch (error) {
      console.error("❌ Error checking if user liked whisper:", error);
      return false;
    }
  }

  /**
   * Get likes for a specific whisper with privacy filtering
   */
  async getWhisperLikes(
    whisperId: string,
    limitCount: number = 50,
    lastDoc?: QueryDocumentSnapshot<DocumentData>
  ): Promise<{
    likes: Like[];
    hasMore: boolean;
    lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  }> {
    try {
      // Build query constraints using utility function
      const { constraints } = buildLikeQueryConstraints({
        contentId: whisperId,
        contentType: "whisper",
        limit: limitCount,
        lastDoc,
      });

      // Create and execute query
      const likesRef = collection(this.firestore, "likes");
      const q = query(likesRef, ...constraints);
      const querySnapshot = await getDocs(q);

      // Transform query snapshot to likes using utility function
      const likes = transformQuerySnapshot(querySnapshot, (docId, data) =>
        transformLikeData(docId, data as FirestoreLikeData)
      );

      // Calculate pagination metadata using utility function
      const { lastDoc: lastVisibleDoc, hasMore } = calculatePaginationMetadata(
        querySnapshot,
        limitCount
      );

      return {
        likes,
        hasMore,
        lastDoc: lastVisibleDoc,
      };
    } catch (error) {
      console.error("❌ Error getting whisper likes:", error);
      throw new Error(`Failed to get whisper likes: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Validate and fix like count for a whisper
   */
  async validateAndFixLikeCount(whisperId: string): Promise<number> {
    try {
      const likesRef = collection(this.firestore, "likes");
      const q = query(likesRef, where("whisperId", "==", whisperId));
      const querySnapshot = await getDocs(q);
      const actualCount = querySnapshot.size;

      // Update the whisper document with the correct count
      await updateDoc(doc(this.firestore, this.whispersCollection, whisperId), {
        likes: actualCount,
      });

      console.log(
        `✅ Like count validated and fixed for whisper ${whisperId}: ${actualCount}`
      );
      return actualCount;
    } catch (error) {
      console.error("❌ Error validating like count:", error);
      throw new Error(
        `Failed to validate like count: ${getErrorMessage(error)}`
      );
    }
  }

  // ===== COMMENT OPERATIONS =====

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
      // Sanitize input data
      const sanitizedText = sanitizeCommentText(text);
      const sanitizedDisplayName = sanitizeUserDisplayName(userDisplayName);

      // Validate comment data using utility function
      const commentData = {
        whisperId,
        userId,
        userDisplayName: sanitizedDisplayName,
        userProfileColor,
        text: sanitizedText,
      };

      const validation = validateCommentData(commentData);
      if (!validation.isValid) {
        throw new Error(
          `Invalid comment data: ${validation.errors.join(", ")}`
        );
      }

      const finalCommentData = {
        ...commentData,
        likes: 0,
        createdAt: serverTimestamp(),
        isEdited: false,
      };

      const docRef = await addDoc(
        collection(this.firestore, "comments"),
        finalCommentData
      );

      // Increment reply count on the whisper
      await updateDoc(doc(this.firestore, this.whispersCollection, whisperId), {
        replies: increment(1),
      });

      console.log("💬 Comment added successfully:", docRef.id);
      return docRef.id;
    } catch (error) {
      console.error("❌ Error adding comment:", error);
      throw new Error(`Failed to add comment: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Get a specific whisper by ID
   */
  async getWhisper(whisperId: string): Promise<Whisper | null> {
    try {
      const docRef = doc(this.firestore, this.whispersCollection, whisperId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      const data = docSnap.data();
      return {
        id: docSnap.id,
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
        transcription: data.transcription || "",
        isTranscribed: data.isTranscribed || false,
        moderationResult: data.moderationResult || null,
      };
    } catch (error) {
      console.error("❌ Error getting whisper:", error);
      return null;
    }
  }

  /**
   * Get comments for a specific whisper
   */
  async getWhisperComments(
    whisperId: string,
    limitCount: number = 50,
    lastDoc?: QueryDocumentSnapshot<DocumentData>
  ): Promise<{
    comments: Comment[];
    hasMore: boolean;
    lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  }> {
    try {
      // Build query constraints using utility function
      const { constraints } = buildCommentQueryConstraints({
        whisperId,
        limit: limitCount,
        lastDoc,
      });

      // Create and execute query
      const commentsRef = collection(this.firestore, "comments");
      const q = query(commentsRef, ...constraints);
      const querySnapshot = await getDocs(q);

      // Transform query snapshot to comments using utility function
      const comments = transformQuerySnapshot(querySnapshot, (docId, data) =>
        transformCommentData(docId, data as FirestoreCommentData)
      );

      // Calculate pagination metadata using utility function
      const { lastDoc: lastVisibleDoc, hasMore } = calculatePaginationMetadata(
        querySnapshot,
        limitCount
      );

      return {
        comments,
        hasMore,
        lastDoc: lastVisibleDoc,
      };
    } catch (error) {
      console.error("❌ Error getting whisper comments:", error);
      throw new Error(
        `Failed to get whisper comments: ${getErrorMessage(error)}`
      );
    }
  }

  /**
   * Like or unlike a comment
   */
  async likeComment(
    commentId: string,
    userId: string,
    userDisplayName?: string,
    userProfileColor?: string
  ): Promise<void> {
    try {
      // Check if user already liked this comment
      const likeDocRef = doc(
        this.firestore,
        "commentLikes",
        `${commentId}_${userId}`
      );
      const likeDoc = await getDoc(likeDocRef);

      if (likeDoc.exists()) {
        // Unlike: remove the like document and decrement count
        await deleteDoc(likeDocRef);
        await updateDoc(doc(this.firestore, "comments", commentId), {
          likes: increment(-1),
        });
        console.log("👎 Comment unliked successfully");
      } else {
        // Like: create the like document and increment count
        const likeData = {
          commentId,
          userId,
          userDisplayName: userDisplayName || "Anonymous",
          userProfileColor: userProfileColor || "#007AFF",
          createdAt: serverTimestamp(),
        };

        await setDoc(likeDocRef, likeData);
        await updateDoc(doc(this.firestore, "comments", commentId), {
          likes: increment(1),
        });
        console.log("👍 Comment liked successfully");
      }
    } catch (error) {
      console.error("❌ Error liking comment:", error);
      throw new Error(`Failed to like comment: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Delete a comment
   */
  async deleteComment(commentId: string, userId: string): Promise<void> {
    try {
      // Get the comment to check ownership and get whisperId
      const commentDoc = await getDoc(
        doc(this.firestore, "comments", commentId)
      );
      if (!commentDoc.exists()) {
        throw new Error("Comment not found");
      }

      const commentData = commentDoc.data();
      if (commentData.userId !== userId) {
        throw new Error("User can only delete their own comments");
      }

      // Delete the comment
      await deleteDoc(doc(this.firestore, "comments", commentId));

      // Decrement reply count on the whisper
      await updateDoc(
        doc(this.firestore, this.whispersCollection, commentData.whisperId),
        {
          replies: increment(-1),
        }
      );

      console.log("🗑️ Comment deleted successfully");
    } catch (error) {
      console.error("❌ Error deleting comment:", error);
      throw new Error(`Failed to delete comment: ${getErrorMessage(error)}`);
    }
  }

  // ===== WHISPER MANAGEMENT =====

  /**
   * Delete a whisper
   */
  async deleteWhisper(whisperId: string): Promise<void> {
    try {
      await deleteDoc(doc(this.firestore, this.whispersCollection, whisperId));
      console.log("🗑️ Whisper deleted successfully");
    } catch (error) {
      console.error("❌ Error deleting whisper:", error);
      throw new Error(`Failed to delete whisper: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Update transcription for a whisper
   */
  async updateTranscription(
    whisperId: string,
    transcription: string
  ): Promise<void> {
    try {
      await updateDoc(doc(this.firestore, this.whispersCollection, whisperId), {
        transcription,
        isTranscribed: true,
      });
      console.log("📝 Transcription updated successfully");
    } catch (error) {
      console.error("❌ Error updating transcription:", error);
      throw new Error(
        `Failed to update transcription: ${getErrorMessage(error)}`
      );
    }
  }

  // ===== USER OPERATIONS =====

  /**
   * Get whispers by user ID
   */
  async getUserWhispers(userId: string): Promise<PaginatedWhispersResult> {
    return this.getWhispers({ userId });
  }

  /**
   * Get a specific comment by ID
   */
  async getComment(commentId: string): Promise<Comment | null> {
    try {
      const commentDoc = await getDoc(
        doc(this.firestore, "comments", commentId)
      );
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
      console.error("❌ Error getting comment:", error);
      return null;
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
      const likeDocRef = doc(
        this.firestore,
        "commentLikes",
        `${commentId}_${userId}`
      );
      const likeDoc = await getDoc(likeDocRef);
      return likeDoc.exists();
    } catch (error) {
      console.error("❌ Error checking if user liked comment:", error);
      return false;
    }
  }

  /**
   * Get comment likes with privacy filtering
   */
  async getCommentLikes(
    commentId: string,
    limitCount: number = 50,
    lastDoc?: QueryDocumentSnapshot<DocumentData>
  ): Promise<{
    likes: CommentLikeData[];
    hasMore: boolean;
    lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  }> {
    try {
      const likesRef = collection(this.firestore, "commentLikes");
      const constraints: QueryConstraint[] = [
        where("commentId", "==", commentId),
        orderBy("createdAt", "desc"),
        limit(limitCount),
      ];

      if (lastDoc) {
        constraints.push(startAfter(lastDoc));
      }

      const q = query(likesRef, ...constraints);
      const querySnapshot = await getDocs(q);

      const likes: CommentLikeData[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        likes.push({
          commentId,
          userId: data.userId,
          userDisplayName: data.userDisplayName,
          userProfileColor: data.userProfileColor,
          createdAt: data.createdAt,
        });
      });

      // Privacy filtering would be implemented here if needed
      // For now, return all likes
      const filteredLikes = likes;

      const lastVisibleDoc =
        querySnapshot.docs[querySnapshot.docs.length - 1] || null;
      const hasMore = querySnapshot.docs.length === limitCount;

      return {
        likes: filteredLikes,
        hasMore,
        lastDoc: lastVisibleDoc,
      };
    } catch (error) {
      console.error("❌ Error getting comment likes:", error);
      throw new Error(`Failed to get comment likes: ${getErrorMessage(error)}`);
    }
  }

  // ===== REAL-TIME SUBSCRIPTIONS FOR COMMENTS =====

  /**
   * Subscribe to comments for a whisper
   */
  subscribeToComments(
    whisperId: string,
    callback: (comments: Comment[]) => void
  ): () => void {
    try {
      const commentsRef = collection(this.firestore, "comments");
      const q = query(
        commentsRef,
        where("whisperId", "==", whisperId),
        orderBy("createdAt", "desc")
      );

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
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
      });

      return unsubscribe;
    } catch (error) {
      console.error("❌ Error subscribing to comments:", error);
      throw new Error(
        `Failed to subscribe to comments: ${getErrorMessage(error)}`
      );
    }
  }

  /**
   * Subscribe to likes for a whisper
   */
  subscribeToWhisperLikes(
    whisperId: string,
    callback: (likes: Like[]) => void
  ): () => void {
    try {
      const likesRef = collection(this.firestore, "likes");
      const q = query(
        likesRef,
        where("whisperId", "==", whisperId),
        orderBy("createdAt", "desc")
      );

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const likes: Like[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          likes.push({
            id: doc.id,
            whisperId: data.whisperId,
            userId: data.userId,
            userDisplayName: data.userDisplayName,
            userProfileColor: data.userProfileColor,
            createdAt: data.createdAt?.toDate() || new Date(),
          });
        });
        callback(likes);
      });

      return unsubscribe;
    } catch (error) {
      console.error("❌ Error subscribing to whisper likes:", error);
      throw new Error(
        `Failed to subscribe to whisper likes: ${getErrorMessage(error)}`
      );
    }
  }

  /**
   * Subscribe to likes for a comment
   */
  subscribeToCommentLikes(
    commentId: string,
    callback: (likes: CommentLikeData[]) => void
  ): () => void {
    try {
      const likesRef = collection(this.firestore, "commentLikes");
      const q = query(
        likesRef,
        where("commentId", "==", commentId),
        orderBy("createdAt", "desc")
      );

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const likes: CommentLikeData[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          likes.push({
            commentId,
            userId: data.userId,
            userDisplayName: data.userDisplayName,
            userProfileColor: data.userProfileColor,
            createdAt: data.createdAt,
          });
        });
        callback(likes);
      });

      return unsubscribe;
    } catch (error) {
      console.error("❌ Error subscribing to comment likes:", error);
      throw new Error(
        `Failed to subscribe to comment likes: ${getErrorMessage(error)}`
      );
    }
  }

  /**
   * Get comments for a specific whisper (alternative method)
   */
  async getComments(
    whisperId: string,
    limitCount: number = 50,
    lastDoc?: QueryDocumentSnapshot<DocumentData>
  ): Promise<{
    comments: Comment[];
    hasMore: boolean;
    lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  }> {
    try {
      const commentsRef = collection(this.firestore, "comments");
      const constraints: QueryConstraint[] = [
        where("whisperId", "==", whisperId),
        orderBy("createdAt", "desc"),
        limit(limitCount),
      ];

      if (lastDoc) {
        constraints.push(startAfter(lastDoc));
      }

      const q = query(commentsRef, ...constraints);
      const querySnapshot = await getDocs(q);

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

      const lastVisibleDoc =
        querySnapshot.docs[querySnapshot.docs.length - 1] || null;
      const hasMore = querySnapshot.docs.length === limitCount;

      return {
        comments,
        hasMore,
        lastDoc: lastVisibleDoc,
      };
    } catch (error) {
      console.error("❌ Error getting comments:", error);
      throw new Error(`Failed to get comments: ${getErrorMessage(error)}`);
    }
  }

  // ===== STATIC METHODS FOR RESET/DESTROY =====

  static resetInstance(): void {
    FirestoreService.instance = null;
  }

  static destroyInstance(): void {
    if (FirestoreService.instance) {
      FirestoreService.instance = null;
    }
  }
}

// Factory functions for dependency injection
export const getFirestoreService = (): FirestoreService => {
  return FirestoreService.getInstance();
};

export const resetFirestoreService = (): void => {
  FirestoreService.resetInstance();
};

export const destroyFirestoreService = (): void => {
  FirestoreService.destroyInstance();
};
