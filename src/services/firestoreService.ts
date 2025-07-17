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
  ReportCategory,
  ReportStatus,
  ReportPriority,
  Appeal,
  AppealStatus,
  Suspension,
  UserMute,
  UserRestriction,
  UserBlock,
  UserViolation,
  CommentReport,
} from "../types";
import { FIRESTORE_COLLECTIONS } from "@/constants";
import type { ViolationRecord } from "@/types";
import { getErrorMessage } from "../utils/errorHelpers";

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
  excludeBlockedUsers?: boolean; // Whether to exclude blocked users
  excludeMutedUsers?: boolean; // Whether to exclude muted users
  currentUserId?: string; // Current user ID for blocking/muting checks
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
      // Check if user is suspended before allowing whisper creation
      const { getSuspensionService } = await import("./suspensionService");
      const suspensionService = getSuspensionService();
      const { suspended, suspensions } =
        await suspensionService.isUserSuspended(userId);

      if (suspended) {
        const suspensionType = suspensions[0]?.type || "unknown";
        throw new Error(
          `Cannot create whisper while suspended (${suspensionType}). Please check your suspension status.`
        );
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
        excludeBlockedUsers = false,
        excludeMutedUsers = false,
        currentUserId,
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
      let whispers: Whisper[] = [];

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

      // --- Backend filtering for permanently banned users (banType: CONTENT_HIDDEN) ---
      // This ensures content from these users is invisible to all
      const bannedUserIds = await this.getPermanentlyBannedUserIds();
      if (bannedUserIds.length > 0) {
        const originalCount = whispers.length;
        whispers = whispers.filter((w) => !bannedUserIds.includes(w.userId));
        console.log(
          `🚫 Filtered out ${
            originalCount - whispers.length
          } whispers from permanently banned users (banType: CONTENT_HIDDEN)`
        );
      }
      // --- End backend ban filtering ---

      // Apply client-side blocking filter if requested
      if (excludeBlockedUsers && currentUserId) {
        try {
          // Get users that the current user has blocked
          const blockedUsers = await this.getUserBlocks(currentUserId);
          const blockedUserIds = blockedUsers.map(
            (block) => block.blockedUserId
          );

          // Get users who have blocked the current user
          const usersWhoBlockedMe = await this.getUsersWhoBlockedMe(
            currentUserId
          );
          const usersWhoBlockedMeIds = usersWhoBlockedMe.map(
            (block) => block.userId
          );

          // Combine both lists - filter out content from users I blocked AND users who blocked me
          const allBlockedUserIds = [
            ...blockedUserIds,
            ...usersWhoBlockedMeIds,
          ];

          if (allBlockedUserIds.length > 0) {
            const originalCount = whispers.length;
            whispers = whispers.filter(
              (whisper) => !allBlockedUserIds.includes(whisper.userId)
            );
            console.log(
              `🚫 Filtered out ${
                originalCount - whispers.length
              } whispers from blocked users (I blocked: ${
                blockedUserIds.length
              }, blocked me: ${usersWhoBlockedMeIds.length})`
            );
          }
        } catch (error) {
          console.warn(
            "⚠️ Failed to filter blocked users, showing all whispers:",
            error
          );
        }
      }

      // Apply client-side mute filter if requested
      if (excludeMutedUsers && currentUserId) {
        try {
          const mutedUsers = await this.getUserMutes(currentUserId);
          const mutedUserIds = mutedUsers.map((mute) => mute.mutedUserId);

          if (mutedUserIds.length > 0) {
            const originalCount = whispers.length;
            whispers = whispers.filter(
              (whisper) => !mutedUserIds.includes(whisper.userId)
            );
            console.log(
              `🔇 Filtered out ${
                originalCount - whispers.length
              } whispers from muted users`
            );
          }
        } catch (error) {
          console.warn(
            "⚠️ Failed to filter muted users, showing all whispers:",
            error
          );
        }
      }

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
      throw new Error(`Failed to fetch whispers: ${getErrorMessage(error)}`);
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
        excludeBlockedUsers = false,
        excludeMutedUsers = false,
        currentUserId,
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
        async (querySnapshot) => {
          let whispers: Whisper[] = [];

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

          // Apply client-side blocking filter if requested
          if (excludeBlockedUsers && currentUserId) {
            try {
              // Get users that the current user has blocked
              const blockedUsers = await this.getUserBlocks(currentUserId);
              const blockedUserIds = blockedUsers.map(
                (block) => block.blockedUserId
              );

              // Get users who have blocked the current user
              const usersWhoBlockedMe = await this.getUsersWhoBlockedMe(
                currentUserId
              );
              const usersWhoBlockedMeIds = usersWhoBlockedMe.map(
                (block) => block.userId
              );

              // Combine both lists - filter out content from users I blocked AND users who blocked me
              const allBlockedUserIds = [
                ...blockedUserIds,
                ...usersWhoBlockedMeIds,
              ];

              if (allBlockedUserIds.length > 0) {
                const originalCount = whispers.length;
                whispers = whispers.filter(
                  (whisper) => !allBlockedUserIds.includes(whisper.userId)
                );
                console.log(
                  `🚫 Real-time filtered out ${
                    originalCount - whispers.length
                  } whispers from blocked users (I blocked: ${
                    blockedUserIds.length
                  }, blocked me: ${usersWhoBlockedMeIds.length})`
                );
              }
            } catch (error) {
              console.warn(
                "⚠️ Failed to filter blocked users in real-time, showing all whispers:",
                error
              );
            }
          }

          // Apply client-side mute filter if requested
          if (excludeMutedUsers && currentUserId) {
            try {
              const mutedUsers = await this.getUserMutes(currentUserId);
              const mutedUserIds = mutedUsers.map((mute) => mute.mutedUserId);

              if (mutedUserIds.length > 0) {
                const originalCount = whispers.length;
                whispers = whispers.filter(
                  (whisper) => !mutedUserIds.includes(whisper.userId)
                );
                console.log(
                  `🔇 Real-time filtered out ${
                    originalCount - whispers.length
                  } whispers from muted users`
                );
              }
            } catch (error) {
              console.warn(
                "⚠️ Failed to filter muted users in real-time, showing all whispers:",
                error
              );
            }
          }

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
        `Failed to set up real-time listener: ${getErrorMessage(error)}`
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
      const {
        isMinor,
        contentPreferences,
        excludeBlockedUsers = false,
        excludeMutedUsers = false,
        currentUserId,
      } = options;

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
        async (querySnapshot) => {
          querySnapshot.docChanges().forEach(async (change) => {
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

              // Check if the whisper is from a blocked user
              if (excludeBlockedUsers && currentUserId) {
                try {
                  // Check if I blocked this user
                  const isBlocked = await this.getUserBlock(
                    currentUserId,
                    newWhisper.userId
                  );

                  // Check if this user blocked me
                  const isBlockedByMe = await this.getUserBlock(
                    newWhisper.userId,
                    currentUserId
                  );

                  if (isBlocked || isBlockedByMe) {
                    console.log(
                      `🚫 Skipping new whisper from blocked user: ${newWhisper.id} (I blocked: ${isBlocked}, blocked me: ${isBlockedByMe})`
                    );
                    return; // Skip this whisper
                  }
                } catch (error) {
                  console.warn(
                    "⚠️ Failed to check if user is blocked, showing whisper:",
                    error
                  );
                }
              }

              // Check if the whisper is from a muted user
              if (excludeMutedUsers && currentUserId) {
                try {
                  const isMuted = await this.getUserMute(
                    currentUserId,
                    newWhisper.userId
                  );
                  if (isMuted) {
                    console.log(
                      `🔇 Skipping new whisper from muted user: ${newWhisper.id}`
                    );
                    return; // Skip this whisper
                  }
                } catch (error) {
                  console.warn(
                    "⚠️ Failed to check if user is muted, showing whisper:",
                    error
                  );
                }
              }

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
        `Failed to set up new whispers listener: ${getErrorMessage(error)}`
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
        `Failed to like/unlike whisper: ${getErrorMessage(error)}`
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
    startAfterDoc?: QueryDocumentSnapshot<DocumentData>,
    currentUserId?: string
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
      let likes: Like[] = [];

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

      // --- Backend filtering for permanently banned users (banType: CONTENT_HIDDEN) ---
      // Filter out likes from permanently banned users
      const bannedUserIds = await this.getPermanentlyBannedUserIds();
      if (bannedUserIds.length > 0) {
        const originalCount = likes.length;
        likes = likes.filter((like) => !bannedUserIds.includes(like.userId));
        console.log(
          `🚫 Filtered out ${
            originalCount - likes.length
          } likes from permanently banned users (banType: CONTENT_HIDDEN)`
        );
      }
      // --- End backend ban filtering ---

      // --- Privacy filtering for blocked users (if currentUserId provided) ---
      if (currentUserId) {
        // Get users that the current user has blocked
        const blockedUsers = await this.getUserBlocks(currentUserId);
        const blockedUserIds = blockedUsers.map((block) => block.blockedUserId);
        // Get users who have blocked the current user
        const usersWhoBlockedMe = await this.getUsersWhoBlockedMe(
          currentUserId
        );
        const usersWhoBlockedMeIds = usersWhoBlockedMe.map(
          (block) => block.userId
        );
        // Combine both lists
        const allBlockedUserIds = [...blockedUserIds, ...usersWhoBlockedMeIds];
        if (allBlockedUserIds.length > 0) {
          const originalCount = likes.length;
          likes = likes.filter(
            (like) => !allBlockedUserIds.includes(like.userId)
          );
          console.log(
            `🚫 Filtered out ${
              originalCount - likes.length
            } likes from blocked users (I blocked: ${
              blockedUserIds.length
            }, blocked me: ${usersWhoBlockedMeIds.length})`
          );
        }
      }
      // --- End privacy filtering ---

      const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1] || null;
      const hasMore = querySnapshot.docs.length === limitCount;

      console.log(
        `✅ Fetched ${likes.length} likes for whisper ${whisperId}, hasMore: ${hasMore}`
      );
      return { likes, lastDoc, hasMore };
    } catch (error) {
      console.error("❌ Error fetching whisper likes:", error);
      throw new Error(
        `Failed to fetch whisper likes: ${getErrorMessage(error)}`
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
        `Failed to validate like count: ${getErrorMessage(error)}`
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
      throw new Error(`Failed to add comment: ${getErrorMessage(error)}`);
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
    startAfterDoc?: QueryDocumentSnapshot<DocumentData>,
    currentUserId?: string
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
      let comments: Comment[] = [];

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

      // --- Backend filtering for permanently banned users (banType: CONTENT_HIDDEN) ---
      const bannedUserIds = await this.getPermanentlyBannedUserIds();
      if (bannedUserIds.length > 0) {
        const originalCount = comments.length;
        comments = comments.filter(
          (comment) => !bannedUserIds.includes(comment.userId)
        );
        console.log(
          `🚫 Filtered out ${
            originalCount - comments.length
          } comments from permanently banned users (banType: CONTENT_HIDDEN)`
        );
      }
      // --- End backend ban filtering ---

      // --- Privacy filtering for blocked users (if currentUserId provided) ---
      if (currentUserId) {
        // Get users that the current user has blocked
        const blockedUsers = await this.getUserBlocks(currentUserId);
        const blockedUserIds = blockedUsers.map((block) => block.blockedUserId);
        // Get users who have blocked the current user
        const usersWhoBlockedMe = await this.getUsersWhoBlockedMe(
          currentUserId
        );
        const usersWhoBlockedMeIds = usersWhoBlockedMe.map(
          (block) => block.userId
        );
        // Combine both lists
        const allBlockedUserIds = [...blockedUserIds, ...usersWhoBlockedMeIds];
        if (allBlockedUserIds.length > 0) {
          const originalCount = comments.length;
          comments = comments.filter(
            (comment) => !allBlockedUserIds.includes(comment.userId)
          );
          console.log(
            `🚫 Filtered out ${
              originalCount - comments.length
            } comments from blocked users (I blocked: ${
              blockedUserIds.length
            }, blocked me: ${usersWhoBlockedMeIds.length})`
          );
        }
      }
      // --- End privacy filtering ---

      const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1] || null;
      const hasMore = querySnapshot.docs.length === limitCount;

      console.log(
        `✅ Fetched ${comments.length} comments for whisper ${whisperId}, hasMore: ${hasMore}`
      );
      return { comments, lastDoc, hasMore };
    } catch (error) {
      console.error("❌ Error fetching comments:", error);
      throw new Error(`Failed to fetch comments: ${getErrorMessage(error)}`);
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
        `Failed to like/unlike comment: ${getErrorMessage(error)}`
      );
    }
  }

  /**
   * Delete a comment (only by the creator or whisper owner)
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

      // Get whisper to check if user is the whisper owner
      const whisperRef = doc(
        this.firestore,
        this.whispersCollection,
        commentData.whisperId
      );
      const whisperDoc = await getDoc(whisperRef);

      if (!whisperDoc.exists()) {
        throw new Error("Whisper not found");
      }

      const whisperData = whisperDoc.data();
      const isCommentOwner = commentData.userId === userId;
      const isWhisperOwner = whisperData.userId === userId;

      if (!isCommentOwner && !isWhisperOwner) {
        throw new Error(
          "You can only delete your own comments or comments on your whispers"
        );
      }

      // Delete the comment
      await deleteDoc(commentRef);

      // Decrement whisper reply count
      await updateDoc(whisperRef, {
        replies: increment(-1),
      });

      console.log("✅ Comment deleted successfully");
    } catch (error) {
      console.error("❌ Error deleting comment:", error);
      throw new Error(`Failed to delete comment: ${getErrorMessage(error)}`);
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
      throw new Error(`Failed to delete whisper: ${getErrorMessage(error)}`);
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
        `Failed to update transcription: ${getErrorMessage(error)}`
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
      throw new Error(`Failed to fetch comment: ${getErrorMessage(error)}`);
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
        `Failed to check comment like state: ${getErrorMessage(error)}`
      );
    }
  }

  /**
   * Get likes for a comment (paginated)
   */
  async getCommentLikes(
    commentId: string,
    limitCount: number = 50,
    startAfterDoc?: QueryDocumentSnapshot<DocumentData>,
    currentUserId?: string
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
      let likes: CommentLikeData[] = [];

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

      // --- Backend filtering for permanently banned users (banType: CONTENT_HIDDEN) ---
      // Filter out comment likes from permanently banned users
      const bannedUserIds = await this.getPermanentlyBannedUserIds();
      if (bannedUserIds.length > 0) {
        const originalCount = likes.length;
        likes = likes.filter((like) => !bannedUserIds.includes(like.userId));
        console.log(
          `🚫 Filtered out ${
            originalCount - likes.length
          } comment likes from permanently banned users (banType: CONTENT_HIDDEN)`
        );
      }
      // --- End backend ban filtering ---

      // --- Privacy filtering for blocked users (if currentUserId provided) ---
      if (currentUserId) {
        // Get users that the current user has blocked
        const blockedUsers = await this.getUserBlocks(currentUserId);
        const blockedUserIds = blockedUsers.map((block) => block.blockedUserId);
        // Get users who have blocked the current user
        const usersWhoBlockedMe = await this.getUsersWhoBlockedMe(
          currentUserId
        );
        const usersWhoBlockedMeIds = usersWhoBlockedMe.map(
          (block) => block.userId
        );
        // Combine both lists
        const allBlockedUserIds = [...blockedUserIds, ...usersWhoBlockedMeIds];
        if (allBlockedUserIds.length > 0) {
          const originalCount = likes.length;
          likes = likes.filter(
            (like) => !allBlockedUserIds.includes(like.userId)
          );
          console.log(
            `🚫 Filtered out ${
              originalCount - likes.length
            } comment likes from blocked users (I blocked: ${
              blockedUserIds.length
            }, blocked me: ${usersWhoBlockedMeIds.length})`
          );
        }
      }
      // --- End privacy filtering ---

      const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1] || null;
      const hasMore = querySnapshot.docs.length === limitCount;

      console.log(
        `✅ Fetched ${likes.length} comment likes for comment ${commentId}, hasMore: ${hasMore}`
      );
      return { likes, lastDoc, hasMore };
    } catch (error) {
      console.error("❌ Error fetching comment likes:", error);
      throw new Error(
        `Failed to fetch comment likes: ${getErrorMessage(error)}`
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
        `Failed to save user reputation: ${getErrorMessage(error)}`
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
        `Failed to get user reputation: ${getErrorMessage(error)}`
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
        `Failed to update user reputation: ${getErrorMessage(error)}`
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
        `Failed to delete user reputation: ${getErrorMessage(error)}`
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
        `Failed to get reputation stats: ${getErrorMessage(error)}`
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
        `Failed to get users by reputation level: ${getErrorMessage(error)}`
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
        `Failed to get users with recent violations: ${getErrorMessage(error)}`
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
        `Failed to reset user reputation: ${getErrorMessage(error)}`
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
        `Failed to adjust user reputation score: ${getErrorMessage(error)}`
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
      await setDoc(
        doc(this.firestore, FIRESTORE_COLLECTIONS.REPORTS, report.id),
        {
          ...report,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );
      console.log("✅ Report saved successfully:", report.id);
    } catch (error) {
      console.error("❌ Error saving report:", error);
      throw new Error(`Failed to save report: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Save a comment report to Firestore
   */
  async saveCommentReport(report: CommentReport): Promise<void> {
    try {
      await setDoc(
        doc(this.firestore, FIRESTORE_COLLECTIONS.COMMENT_REPORTS, report.id),
        {
          ...report,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );
      console.log("✅ Comment report saved successfully:", report.id);
    } catch (error) {
      console.error("❌ Error saving comment report:", error);
      throw new Error(
        `Failed to save comment report: ${getErrorMessage(error)}`
      );
    }
  }

  /**
   * Get reports with filtering
   */
  async getReports(filters: ReportFilters = {}): Promise<Report[]> {
    try {
      let reportsQuery: any = collection(
        this.firestore,
        FIRESTORE_COLLECTIONS.REPORTS
      );
      const constraints: any[] = [];

      if (filters.status) {
        constraints.push(where("status", "==", filters.status));
      }
      if (filters.category) {
        constraints.push(where("category", "==", filters.category));
      }
      if (filters.priority) {
        constraints.push(where("priority", "==", filters.priority));
      }
      if (filters.reporterId) {
        constraints.push(where("reporterId", "==", filters.reporterId));
      }
      if (filters.whisperId) {
        constraints.push(where("whisperId", "==", filters.whisperId));
      }

      if (constraints.length > 0) {
        reportsQuery = query(reportsQuery, ...constraints);
      }

      const querySnapshot = await getDocs(reportsQuery);
      const reports: Report[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data() as any;
        reports.push({
          id: doc.id,
          whisperId: data.whisperId,
          commentId: data.commentId,
          reporterId: data.reporterId,
          reporterDisplayName: data.reporterDisplayName,
          reporterReputation: data.reporterReputation,
          category: data.category,
          priority: data.priority,
          status: data.status,
          reason: data.reason,
          evidence: data.evidence,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          reviewedAt: data.reviewedAt?.toDate(),
          reviewedBy: data.reviewedBy,
          resolution: data.resolution,
          reputationWeight: data.reputationWeight,
        });
      });

      return reports;
    } catch (error) {
      console.error("❌ Error getting reports:", error);
      throw new Error(`Failed to get reports: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Get comment reports with filtering
   */
  async getCommentReports(
    filters: ReportFilters = {}
  ): Promise<CommentReport[]> {
    try {
      let reportsQuery: any = collection(
        this.firestore,
        FIRESTORE_COLLECTIONS.COMMENT_REPORTS
      );
      const constraints: any[] = [];

      if (filters.status) {
        constraints.push(where("status", "==", filters.status));
      }
      if (filters.category) {
        constraints.push(where("category", "==", filters.category));
      }
      if (filters.priority) {
        constraints.push(where("priority", "==", filters.priority));
      }
      if (filters.reporterId) {
        constraints.push(where("reporterId", "==", filters.reporterId));
      }
      if (filters.whisperId) {
        constraints.push(where("whisperId", "==", filters.whisperId));
      }

      if (constraints.length > 0) {
        reportsQuery = query(reportsQuery, ...constraints);
      }

      const querySnapshot = await getDocs(reportsQuery);
      const reports: CommentReport[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data() as any;
        reports.push({
          id: doc.id,
          commentId: data.commentId,
          whisperId: data.whisperId,
          reporterId: data.reporterId,
          reporterDisplayName: data.reporterDisplayName,
          reporterReputation: data.reporterReputation,
          category: data.category,
          priority: data.priority,
          status: data.status,
          reason: data.reason,
          evidence: data.evidence,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          reviewedAt: data.reviewedAt?.toDate(),
          reviewedBy: data.reviewedBy,
          resolution: data.resolution,
          reputationWeight: data.reputationWeight,
        });
      });

      return reports;
    } catch (error) {
      console.error("❌ Error getting comment reports:", error);
      throw new Error(
        `Failed to get comment reports: ${getErrorMessage(error)}`
      );
    }
  }

  /**
   * Get report by ID
   */
  async getReport(reportId: string): Promise<Report | null> {
    try {
      const reportDoc = await getDoc(
        doc(this.firestore, FIRESTORE_COLLECTIONS.REPORTS, reportId)
      );

      if (!reportDoc.exists()) {
        return null;
      }

      const data = reportDoc.data();
      return {
        id: reportDoc.id,
        whisperId: data.whisperId,
        commentId: data.commentId,
        reporterId: data.reporterId,
        reporterDisplayName: data.reporterDisplayName,
        reporterReputation: data.reporterReputation,
        category: data.category,
        priority: data.priority,
        status: data.status,
        reason: data.reason,
        evidence: data.evidence,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        reviewedAt: data.reviewedAt?.toDate(),
        reviewedBy: data.reviewedBy,
        resolution: data.resolution,
        reputationWeight: data.reputationWeight,
      };
    } catch (error) {
      console.error("❌ Error getting report:", error);
      throw new Error(`Failed to get report: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Get comment report by ID
   */
  async getCommentReport(reportId: string): Promise<CommentReport | null> {
    try {
      const reportDoc = await getDoc(
        doc(this.firestore, FIRESTORE_COLLECTIONS.COMMENT_REPORTS, reportId)
      );

      if (!reportDoc.exists()) {
        return null;
      }

      const data = reportDoc.data();
      return {
        id: reportDoc.id,
        commentId: data.commentId,
        whisperId: data.whisperId,
        reporterId: data.reporterId,
        reporterDisplayName: data.reporterDisplayName,
        reporterReputation: data.reporterReputation,
        category: data.category,
        priority: data.priority,
        status: data.status,
        reason: data.reason,
        evidence: data.evidence,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        reviewedAt: data.reviewedAt?.toDate(),
        reviewedBy: data.reviewedBy,
        resolution: data.resolution,
        reputationWeight: data.reputationWeight,
      };
    } catch (error) {
      console.error("❌ Error getting comment report:", error);
      throw new Error(
        `Failed to get comment report: ${getErrorMessage(error)}`
      );
    }
  }

  /**
   * Update report status
   */
  async updateReportStatus(
    reportId: string,
    status: ReportStatus,
    moderatorId?: string
  ): Promise<void> {
    try {
      const reportRef = doc(
        this.firestore,
        FIRESTORE_COLLECTIONS.REPORTS,
        reportId
      );
      const updateData: UpdateData<DocumentData> = {
        status,
        updatedAt: serverTimestamp(),
      };

      if (
        status === ReportStatus.RESOLVED ||
        status === ReportStatus.DISMISSED
      ) {
        updateData.reviewedAt = serverTimestamp();
        updateData.reviewedBy = moderatorId || "system";
      }

      await updateDoc(reportRef, updateData);
      console.log("✅ Report status updated:", reportId, status);
    } catch (error) {
      console.error("❌ Error updating report status:", error);
      throw new Error(
        `Failed to update report status: ${getErrorMessage(error)}`
      );
    }
  }

  /**
   * Update comment report status
   */
  async updateCommentReportStatus(
    reportId: string,
    status: ReportStatus,
    moderatorId?: string
  ): Promise<void> {
    try {
      const reportRef = doc(
        this.firestore,
        FIRESTORE_COLLECTIONS.COMMENT_REPORTS,
        reportId
      );
      const updateData: UpdateData<DocumentData> = {
        status,
        updatedAt: serverTimestamp(),
      };

      if (
        status === ReportStatus.RESOLVED ||
        status === ReportStatus.DISMISSED
      ) {
        updateData.reviewedAt = serverTimestamp();
        updateData.reviewedBy = moderatorId || "system";
      }

      await updateDoc(reportRef, updateData);
      console.log("✅ Comment report status updated:", reportId, status);
    } catch (error) {
      console.error("❌ Error updating comment report status:", error);
      throw new Error(
        `Failed to update comment report status: ${getErrorMessage(error)}`
      );
    }
  }

  /**
   * Update report with resolution
   */
  async updateReport(reportId: string, report: Partial<Report>): Promise<void> {
    try {
      const reportRef = doc(
        this.firestore,
        FIRESTORE_COLLECTIONS.REPORTS,
        reportId
      );
      await updateDoc(reportRef, {
        ...report,
        updatedAt: serverTimestamp(),
      });
      console.log("✅ Report updated successfully:", reportId);
    } catch (error) {
      console.error("❌ Error updating report:", error);
      throw new Error(`Failed to update report: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Update comment report with resolution
   */
  async updateCommentReport(
    reportId: string,
    report: Partial<CommentReport>
  ): Promise<void> {
    try {
      const reportRef = doc(
        this.firestore,
        FIRESTORE_COLLECTIONS.COMMENT_REPORTS,
        reportId
      );
      await updateDoc(reportRef, {
        ...report,
        updatedAt: serverTimestamp(),
      });
      console.log("✅ Comment report updated successfully:", reportId);
    } catch (error) {
      console.error("❌ Error updating comment report:", error);
      throw new Error(
        `Failed to update comment report: ${getErrorMessage(error)}`
      );
    }
  }

  /**
   * Check if user has reported a whisper
   */
  async hasUserReportedWhisper(
    whisperId: string,
    userId: string
  ): Promise<{ hasReported: boolean; existingReport?: Report }> {
    try {
      const reports = await this.getReports({
        whisperId,
        reporterId: userId,
      });

      return {
        hasReported: reports.length > 0,
        existingReport: reports[0],
      };
    } catch (error) {
      console.error("❌ Error checking whisper report status:", error);
      return { hasReported: false };
    }
  }

  /**
   * Check if user has reported a comment
   */
  async hasUserReportedComment(
    commentId: string,
    userId: string
  ): Promise<{ hasReported: boolean; existingReport?: CommentReport }> {
    try {
      const reports = await this.getCommentReports({
        reporterId: userId,
      });

      const commentReport = reports.find(
        (report) => report.commentId === commentId
      );

      return {
        hasReported: !!commentReport,
        existingReport: commentReport,
      };
    } catch (error) {
      console.error("❌ Error checking comment report status:", error);
      return { hasReported: false };
    }
  }

  /**
   * Get comment report stats for a specific comment
   */
  async getCommentReportStats(commentId: string): Promise<{
    totalReports: number;
    uniqueReporters: number;
    categories: Record<ReportCategory, number>;
    priorityBreakdown: Record<ReportPriority, number>;
  }> {
    try {
      const reports = await this.getCommentReports();
      const commentReports = reports.filter(
        (report) => report.commentId === commentId
      );

      const uniqueReporters = new Set(
        commentReports.map((report) => report.reporterId)
      ).size;
      const categories: Record<ReportCategory, number> = {} as Record<
        ReportCategory,
        number
      >;
      const priorityBreakdown: Record<ReportPriority, number> = {} as Record<
        ReportPriority,
        number
      >;

      // Initialize counters
      Object.values(ReportCategory).forEach((category) => {
        categories[category] = 0;
      });
      Object.values(ReportPriority).forEach((priority) => {
        priorityBreakdown[priority] = 0;
      });

      // Count reports
      commentReports.forEach((report) => {
        categories[report.category]++;
        priorityBreakdown[report.priority]++;
      });

      return {
        totalReports: commentReports.length,
        uniqueReporters,
        categories,
        priorityBreakdown,
      };
    } catch (error) {
      console.error("❌ Error getting comment report stats:", error);
      throw new Error(
        `Failed to get comment report stats: ${getErrorMessage(error)}`
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
      throw new Error(`Failed to save appeal: ${getErrorMessage(error)}`);
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
      throw new Error(`Failed to update appeal: ${getErrorMessage(error)}`);
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
      const suspensionData: Record<string, unknown> = {
        id: suspension.id,
        userId: suspension.userId,
        type: suspension.type,
        reason: suspension.reason,
        moderatorId: suspension.moderatorId,
        startDate: Timestamp.fromDate(suspension.startDate),
        isActive: suspension.isActive,
        createdAt: Timestamp.fromDate(suspension.createdAt),
        updatedAt: Timestamp.fromDate(suspension.updatedAt),
      };

      // Only include endDate if it exists
      if (suspension.endDate) {
        suspensionData.endDate = Timestamp.fromDate(suspension.endDate);
      }

      await setDoc(
        doc(this.firestore, "suspensions", suspension.id),
        suspensionData
      );
      console.log("✅ Suspension saved successfully:", suspension.id);
    } catch (error) {
      console.error("❌ Error saving suspension:", error);
      throw new Error(`Failed to save suspension: ${getErrorMessage(error)}`);
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
      throw new Error(`Failed to update suspension: ${getErrorMessage(error)}`);
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

  /**
   * Get report statistics for a specific whisper
   */
  async getWhisperReportStats(whisperId: string): Promise<{
    totalReports: number;
    uniqueReporters: number;
    categories: Record<ReportCategory, number>;
    priorityBreakdown: Record<ReportPriority, number>;
  }> {
    try {
      const reports = await this.getReports({
        whisperId,
      });

      const uniqueReporters = new Set(reports.map((r) => r.reporterId)).size;

      const categories: Record<ReportCategory, number> = {
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

      const priorityBreakdown: Record<ReportPriority, number> = {
        [ReportPriority.LOW]: 0,
        [ReportPriority.MEDIUM]: 0,
        [ReportPriority.HIGH]: 0,
        [ReportPriority.CRITICAL]: 0,
      };

      reports.forEach((report) => {
        categories[report.category]++;
        priorityBreakdown[report.priority]++;
      });

      return {
        totalReports: reports.length,
        uniqueReporters,
        categories,
        priorityBreakdown,
      };
    } catch (error) {
      console.error("❌ Error getting whisper report stats:", error);
      return {
        totalReports: 0,
        uniqueReporters: 0,
        categories: {} as Record<ReportCategory, number>,
        priorityBreakdown: {} as Record<ReportPriority, number>,
      };
    }
  }

  // User Mute Management
  /**
   * Save a user mute to Firestore
   */
  async saveUserMute(mute: UserMute): Promise<void> {
    try {
      const muteData = {
        ...mute,
        createdAt: mute.createdAt.toISOString(),
        updatedAt: mute.updatedAt.toISOString(),
      };

      await setDoc(doc(this.firestore, "userMutes", mute.id), muteData);
      console.log("✅ User mute saved successfully:", mute.id);
    } catch (error) {
      console.error("❌ Error saving user mute:", error);
      throw new Error(`Failed to save user mute: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Get a specific user mute
   */
  async getUserMute(
    userId: string,
    mutedUserId: string
  ): Promise<UserMute | null> {
    try {
      const q = query(
        collection(this.firestore, "userMutes"),
        where("userId", "==", userId),
        where("mutedUserId", "==", mutedUserId)
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return null;
      }

      const doc = querySnapshot.docs[0];
      const data = doc.data();

      return {
        id: doc.id,
        userId: data.userId,
        mutedUserId: data.mutedUserId,
        mutedUserDisplayName: data.mutedUserDisplayName,
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt),
      };
    } catch (error) {
      console.error("❌ Error getting user mute:", error);
      throw new Error(`Failed to get user mute: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Get all muted users for a user
   */
  async getUserMutes(userId: string): Promise<UserMute[]> {
    try {
      const q = query(
        collection(this.firestore, "userMutes"),
        where("userId", "==", userId),
        orderBy("createdAt", "desc")
      );

      const querySnapshot = await getDocs(q);
      const mutes: UserMute[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        mutes.push({
          id: doc.id,
          userId: data.userId,
          mutedUserId: data.mutedUserId,
          mutedUserDisplayName: data.mutedUserDisplayName,
          createdAt: new Date(data.createdAt),
          updatedAt: new Date(data.updatedAt),
        });
      });

      return mutes;
    } catch (error) {
      console.error("❌ Error getting user mutes:", error);
      throw new Error(`Failed to get user mutes: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Delete a user mute
   */
  async deleteUserMute(muteId: string): Promise<void> {
    try {
      await deleteDoc(doc(this.firestore, "userMutes", muteId));
      console.log("✅ User mute deleted successfully:", muteId);
    } catch (error) {
      console.error("❌ Error deleting user mute:", error);
      throw new Error(`Failed to delete user mute: ${getErrorMessage(error)}`);
    }
  }

  // User Restriction Management
  /**
   * Save a user restriction to Firestore
   */
  async saveUserRestriction(restriction: UserRestriction): Promise<void> {
    try {
      const restrictionData = {
        ...restriction,
        createdAt: restriction.createdAt.toISOString(),
        updatedAt: restriction.updatedAt.toISOString(),
      };

      await setDoc(
        doc(this.firestore, "userRestrictions", restriction.id),
        restrictionData
      );
      console.log("✅ User restriction saved successfully:", restriction.id);
    } catch (error) {
      console.error("❌ Error saving user restriction:", error);
      throw new Error(
        `Failed to save user restriction: ${getErrorMessage(error)}`
      );
    }
  }

  /**
   * Get a specific user restriction
   */
  async getUserRestriction(
    userId: string,
    restrictedUserId: string
  ): Promise<UserRestriction | null> {
    try {
      const q = query(
        collection(this.firestore, "userRestrictions"),
        where("userId", "==", userId),
        where("restrictedUserId", "==", restrictedUserId)
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return null;
      }

      const doc = querySnapshot.docs[0];
      const data = doc.data();

      return {
        id: doc.id,
        userId: data.userId,
        restrictedUserId: data.restrictedUserId,
        restrictedUserDisplayName: data.restrictedUserDisplayName,
        type: data.type,
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt),
      };
    } catch (error) {
      console.error("❌ Error getting user restriction:", error);
      throw new Error(
        `Failed to get user restriction: ${getErrorMessage(error)}`
      );
    }
  }

  /**
   * Get all restricted users for a user
   */
  async getUserRestrictions(userId: string): Promise<UserRestriction[]> {
    try {
      const q = query(
        collection(this.firestore, "userRestrictions"),
        where("userId", "==", userId),
        orderBy("createdAt", "desc")
      );

      const querySnapshot = await getDocs(q);
      const restrictions: UserRestriction[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        restrictions.push({
          id: doc.id,
          userId: data.userId,
          restrictedUserId: data.restrictedUserId,
          restrictedUserDisplayName: data.restrictedUserDisplayName,
          type: data.type,
          createdAt: new Date(data.createdAt),
          updatedAt: new Date(data.updatedAt),
        });
      });

      return restrictions;
    } catch (error) {
      console.error("❌ Error getting user restrictions:", error);
      throw new Error(
        `Failed to get user restrictions: ${getErrorMessage(error)}`
      );
    }
  }

  /**
   * Delete a user restriction
   */
  async deleteUserRestriction(restrictionId: string): Promise<void> {
    try {
      await deleteDoc(doc(this.firestore, "userRestrictions", restrictionId));
      console.log("✅ User restriction deleted successfully:", restrictionId);
    } catch (error) {
      console.error("❌ Error deleting user restriction:", error);
      throw new Error(
        `Failed to delete user restriction: ${getErrorMessage(error)}`
      );
    }
  }

  // User Block Management
  /**
   * Save a user block to Firestore
   */
  async saveUserBlock(block: UserBlock): Promise<void> {
    try {
      const blockData = {
        ...block,
        createdAt: block.createdAt.toISOString(),
        updatedAt: block.updatedAt.toISOString(),
      };

      await setDoc(doc(this.firestore, "userBlocks", block.id), blockData);
      console.log("✅ User block saved successfully:", block.id);
    } catch (error) {
      console.error("❌ Error saving user block:", error);
      throw new Error(`Failed to save user block: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Get a specific user block
   */
  async getUserBlock(
    userId: string,
    blockedUserId: string
  ): Promise<UserBlock | null> {
    try {
      const q = query(
        collection(this.firestore, "userBlocks"),
        where("userId", "==", userId),
        where("blockedUserId", "==", blockedUserId)
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return null;
      }

      const doc = querySnapshot.docs[0];
      const data = doc.data();

      return {
        id: doc.id,
        userId: data.userId,
        blockedUserId: data.blockedUserId,
        blockedUserDisplayName: data.blockedUserDisplayName,
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt),
      };
    } catch (error) {
      console.error("❌ Error getting user block:", error);
      throw new Error(`Failed to get user block: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Get all blocked users for a user
   */
  async getUserBlocks(userId: string): Promise<UserBlock[]> {
    try {
      const q = query(
        collection(this.firestore, "userBlocks"),
        where("userId", "==", userId),
        orderBy("createdAt", "desc")
      );

      const querySnapshot = await getDocs(q);
      const blocks: UserBlock[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        blocks.push({
          id: doc.id,
          userId: data.userId,
          blockedUserId: data.blockedUserId,
          blockedUserDisplayName: data.blockedUserDisplayName,
          createdAt: new Date(data.createdAt),
          updatedAt: new Date(data.updatedAt),
        });
      });

      return blocks;
    } catch (error) {
      console.error("❌ Error getting user blocks:", error);
      throw new Error(`Failed to get user blocks: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Get all users who have blocked a specific user
   */
  async getUsersWhoBlockedMe(userId: string): Promise<UserBlock[]> {
    try {
      const q = query(
        collection(this.firestore, "userBlocks"),
        where("blockedUserId", "==", userId),
        orderBy("createdAt", "desc")
      );

      const querySnapshot = await getDocs(q);
      const blocks: UserBlock[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        blocks.push({
          id: doc.id,
          userId: data.userId,
          blockedUserId: data.blockedUserId,
          blockedUserDisplayName: data.blockedUserDisplayName,
          createdAt: new Date(data.createdAt),
          updatedAt: new Date(data.updatedAt),
        });
      });

      return blocks;
    } catch (error) {
      console.error("❌ Error getting users who blocked me:", error);
      throw new Error(
        `Failed to get users who blocked me: ${getErrorMessage(error)}`
      );
    }
  }

  /**
   * Delete a user block
   */
  async deleteUserBlock(blockId: string): Promise<void> {
    try {
      await deleteDoc(doc(this.firestore, "userBlocks", blockId));
      console.log("✅ User block deleted successfully:", blockId);
    } catch (error) {
      console.error("❌ Error deleting user block:", error);
      throw new Error(`Failed to delete user block: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Get whisper likes with privacy filtering for blocked users
   */
  async getWhisperLikesWithPrivacy(
    whisperId: string,
    currentUserId: string,
    limit: number = 50,
    lastDoc?: QueryDocumentSnapshot<DocumentData>
  ): Promise<{
    likes: Like[];
    hasMore: boolean;
    lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  }> {
    try {
      // Get the likes
      const result = await this.getWhisperLikes(whisperId, limit, lastDoc);

      // Get block lists for privacy filtering
      const [blockedUsers, usersWhoBlockedMe] = await Promise.all([
        this.getUserBlocks(currentUserId),
        this.getUsersWhoBlockedMe(currentUserId),
      ]);

      const blockedSet = new Set([
        ...blockedUsers.map((b) => b.blockedUserId),
        ...usersWhoBlockedMe.map((b) => b.userId),
      ]);

      // Filter and anonymize blocked users' likes
      const filteredLikes = result.likes.map((like) => {
        if (blockedSet.has(like.userId)) {
          return {
            ...like,
            userDisplayName: "Anonymous",
            userProfileColor: "#9E9E9E", // Gray color for anonymous
          };
        }
        return like;
      });

      return {
        likes: filteredLikes,
        hasMore: result.hasMore,
        lastDoc: result.lastDoc,
      };
    } catch (error) {
      console.error("Error getting whisper likes with privacy:", error);
      throw error;
    }
  }

  /**
   * Get all userIds of users with active permanent bans (banType: CONTENT_HIDDEN)
   */
  async getPermanentlyBannedUserIds(): Promise<string[]> {
    try {
      const q = query(
        collection(this.firestore, "suspensions"),
        where("isActive", "==", true),
        where("type", "==", "permanent"),
        where("banType", "==", "content_hidden")
      );
      const querySnapshot = await getDocs(q);
      const userIds = new Set<string>();
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.userId) userIds.add(data.userId);
      });
      return Array.from(userIds);
    } catch (error) {
      console.error("❌ Error fetching permanently banned userIds:", error);
      return [];
    }
  }

  // User Violation methods for escalation tracking
  async saveUserViolation(violation: UserViolation): Promise<void> {
    try {
      const violationData: Record<string, unknown> = {
        id: violation.id,
        userId: violation.userId,
        whisperId: violation.whisperId,
        violationType: violation.violationType,
        reason: violation.reason,
        reportCount: violation.reportCount,
        moderatorId: violation.moderatorId || "system",
        createdAt: Timestamp.fromDate(violation.createdAt),
      };

      if (violation.expiresAt) {
        violationData.expiresAt = Timestamp.fromDate(violation.expiresAt);
      }

      await setDoc(
        doc(this.firestore, "userViolations", violation.id),
        violationData
      );
      console.log("✅ User violation saved successfully:", violation.id);
    } catch (error) {
      console.error("❌ Error saving user violation:", error);
      throw new Error(
        `Failed to save user violation: ${getErrorMessage(error)}`
      );
    }
  }

  async getUserViolations(
    userId: string,
    daysBack: number = 90
  ): Promise<UserViolation[]> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);

      const q = query(
        collection(this.firestore, "userViolations"),
        where("userId", "==", userId),
        where("createdAt", ">=", Timestamp.fromDate(cutoffDate)),
        orderBy("createdAt", "desc")
      );

      const querySnapshot = await getDocs(q);
      const violations: UserViolation[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        violations.push({
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          expiresAt: data.expiresAt?.toDate(),
        } as UserViolation);
      });

      return violations;
    } catch (error) {
      console.error("❌ Error getting user violations:", error);
      return [];
    }
  }

  async getDeletedWhisperCount(
    userId: string,
    daysBack: number = 90
  ): Promise<number> {
    try {
      const violations = await this.getUserViolations(userId, daysBack);
      return violations.filter((v) => v.violationType === "whisper_deleted")
        .length;
    } catch (error) {
      console.error("❌ Error getting deleted whisper count:", error);
      return 0;
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
