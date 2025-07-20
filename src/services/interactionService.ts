import { getFirestoreService, CommentLikeData } from "./firestoreService";
import { getPrivacyService } from "./privacyService";
import { useAuthStore } from "../store/useAuthStore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Like, Comment, CommentLike } from "../types";
import { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";

// Cache keys
const LIKE_CACHE_PREFIX = "whispr_like_";
const COMMENT_CACHE_PREFIX = "whispr_comments_";
const COUNT_CACHE_PREFIX = "whispr_count_";

// Cache TTL (Time To Live) in milliseconds
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface LikeCache {
  [whisperId: string]: {
    isLiked: boolean;
    count: number;
    timestamp: number;
  };
}

interface CommentCache {
  comments: Comment[];
  count: number;
  timestamp: number;
  hasMore: boolean;
  lastDoc: unknown;
}

interface CountCache {
  likes: number;
  replies: number;
  timestamp: number;
}

interface LikeListCache {
  likes: Like[];
  hasMore: boolean;
  lastDoc: unknown;
  timestamp: number;
}

interface CommentLikeListCache {
  likes: CommentLike[];
  hasMore: boolean;
  lastDoc: unknown;
  timestamp: number;
}

export class InteractionService {
  private static instance: InteractionService;
  private firestoreService = getFirestoreService();
  private privacyService = getPrivacyService();
  private likeCache: LikeCache = {};
  private commentCache: { [whisperId: string]: CommentCache } = {};
  private countCache: { [whisperId: string]: CountCache } = {};
  private pendingLikes: Set<string> = new Set();
  private pendingComments: Set<string> = new Set();
  private debounceTimers: { [key: string]: ReturnType<typeof setTimeout> } = {};
  private likeListCache: {
    [key: string]: LikeListCache | CommentLikeListCache;
  } = {};

  private constructor() {}

  static getInstance(): InteractionService {
    if (!InteractionService.instance) {
      InteractionService.instance = new InteractionService();
    }
    return InteractionService.instance;
  }

  /**
   * Direct like method (extracted from FirestoreService)
   */
  async likeWhisper(
    whisperId: string,
    userId: string,
    userDisplayName?: string,
    userProfileColor?: string
  ): Promise<void> {
    try {
      await this.firestoreService.likeWhisper(
        whisperId,
        userId,
        userDisplayName,
        userProfileColor
      );

      // Update cache after successful like
      const cacheKey = `${whisperId}_${userId}`;
      const currentState = this.likeCache[cacheKey] || {
        isLiked: false,
        count: 0,
        timestamp: 0,
      };

      this.likeCache[cacheKey] = {
        isLiked: true,
        count: currentState.count + 1,
        timestamp: Date.now(),
      };

      // Update count cache
      this.countCache[whisperId] = {
        ...this.countCache[whisperId],
        likes: (this.countCache[whisperId]?.likes || 0) + 1,
        timestamp: Date.now(),
      };

      // Persist to AsyncStorage
      await this.persistLikeCache(cacheKey, this.likeCache[cacheKey]);
    } catch (error) {
      console.error("Error liking whisper:", error);
      throw new Error("Failed to like whisper");
    }
  }

  /**
   * Direct comment like method (extracted from FirestoreService)
   */
  async likeComment(
    commentId: string,
    userId: string,
    userDisplayName?: string,
    userProfileColor?: string
  ): Promise<void> {
    try {
      await this.firestoreService.likeComment(
        commentId,
        userId,
        userDisplayName,
        userProfileColor
      );
    } catch (error) {
      console.error("Error liking comment:", error);
      throw new Error("Failed to like comment");
    }
  }

  /**
   * Subscribe to comments for real-time updates (extracted from FirestoreService)
   */
  subscribeToComments(
    whisperId: string,
    callback: (comments: Comment[]) => void
  ): () => void {
    try {
      return this.firestoreService.subscribeToComments(whisperId, callback);
    } catch (error) {
      console.error("Error subscribing to comments:", error);
      throw new Error("Failed to subscribe to comments");
    }
  }

  /**
   * Subscribe to whisper likes for real-time updates (extracted from FirestoreService)
   */
  subscribeToWhisperLikes(
    whisperId: string,
    callback: (likes: Like[]) => void
  ): () => void {
    try {
      return this.firestoreService.subscribeToWhisperLikes(whisperId, callback);
    } catch (error) {
      console.error("Error subscribing to whisper likes:", error);
      throw new Error("Failed to subscribe to whisper likes");
    }
  }

  /**
   * Subscribe to comment likes for real-time updates (extracted from FirestoreService)
   */
  subscribeToCommentLikes(
    commentId: string,
    callback: (likes: CommentLikeData[]) => void
  ): () => void {
    try {
      return this.firestoreService.subscribeToCommentLikes(commentId, callback);
    } catch (error) {
      console.error("Error subscribing to comment likes:", error);
      throw new Error("Failed to subscribe to comment likes");
    }
  }

  /**
   * Optimized like/unlike with caching and optimistic updates
   */
  async toggleLike(
    whisperId: string
  ): Promise<{ isLiked: boolean; count: number }> {
    const { user } = useAuthStore.getState();
    if (!user) {
      throw new Error("User must be authenticated to like whispers");
    }

    const cacheKey = `${whisperId}_${user.uid}`;

    // Prevent rapid-fire likes
    if (this.pendingLikes.has(cacheKey)) {
      throw new Error("Like operation already in progress");
    }

    this.pendingLikes.add(cacheKey);

    try {
      // Get current state from cache
      const currentState = this.likeCache[cacheKey] || {
        isLiked: false,
        count: 0,
        timestamp: 0,
      };

      // Optimistic update
      const newIsLiked = !currentState.isLiked;
      const newCount = newIsLiked
        ? currentState.count + 1
        : currentState.count - 1;

      // Update cache immediately
      this.likeCache[cacheKey] = {
        isLiked: newIsLiked,
        count: newCount,
        timestamp: Date.now(),
      };

      // Update count cache
      this.countCache[whisperId] = {
        ...this.countCache[whisperId],
        likes: newCount,
        timestamp: Date.now(),
      };

      // Persist to AsyncStorage
      await this.persistLikeCache(cacheKey, this.likeCache[cacheKey]);

      // Immediate server update (no debouncing for accuracy)
      try {
        await this.updateLikeOnServer(whisperId, user.uid);

        // Validate server count after update
        const serverWhisper = await this.firestoreService.getWhisper(whisperId);
        const serverCount = serverWhisper?.likes || 0;

        // If server count differs from our optimistic count, update cache
        if (serverCount !== newCount) {
          console.log(
            `⚠️ Count mismatch: optimistic=${newCount}, server=${serverCount}`
          );
          this.countCache[whisperId] = {
            ...this.countCache[whisperId],
            likes: serverCount,
            timestamp: Date.now(),
          };
          return { isLiked: newIsLiked, count: serverCount };
        }
      } catch (error) {
        console.error(
          "Server update failed, reverting optimistic update:",
          error
        );
        // Revert optimistic update on server failure
        this.likeCache[cacheKey] = currentState;
        this.countCache[whisperId] = {
          ...this.countCache[whisperId],
          likes: currentState.count,
          timestamp: Date.now(),
        };
        throw error;
      }

      return { isLiked: newIsLiked, count: newCount };
    } finally {
      this.pendingLikes.delete(cacheKey);
    }
  }

  /**
   * Check if user has liked a whisper (cached)
   */
  async hasUserLiked(whisperId: string): Promise<boolean> {
    const { user } = useAuthStore.getState();
    if (!user) return false;

    const cacheKey = `${whisperId}_${user.uid}`;

    // Check memory cache first
    if (
      this.likeCache[cacheKey] &&
      Date.now() - this.likeCache[cacheKey].timestamp < CACHE_TTL
    ) {
      return this.likeCache[cacheKey].isLiked;
    }

    // Check AsyncStorage cache
    const cached = await this.getLikeCache(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      this.likeCache[cacheKey] = cached;
      return cached.isLiked;
    }

    // Fetch from server
    try {
      const isLiked = await this.firestoreService.hasUserLikedWhisper(
        whisperId,
        user.uid
      );

      // Update cache
      this.likeCache[cacheKey] = {
        isLiked,
        count: this.countCache[whisperId]?.likes || 0,
        timestamp: Date.now(),
      };

      await this.persistLikeCache(cacheKey, this.likeCache[cacheKey]);
      return isLiked;
    } catch (error) {
      console.error("Error checking like status:", error);
      return false;
    }
  }

  /**
   * Get like count with caching
   */
  async getLikeCount(whisperId: string): Promise<number> {
    // Check memory cache first
    if (
      this.countCache[whisperId] &&
      Date.now() - this.countCache[whisperId].timestamp < CACHE_TTL
    ) {
      return this.countCache[whisperId].likes;
    }

    // Check AsyncStorage cache
    const cached = await this.getCountCache(whisperId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      this.countCache[whisperId] = cached;
      return cached.likes;
    }

    // Fetch from server
    try {
      const whisper = await this.firestoreService.getWhisper(whisperId);
      const count = whisper?.likes || 0;

      // Update cache
      this.countCache[whisperId] = {
        likes: count,
        replies: whisper?.replies || 0,
        timestamp: Date.now(),
      };

      await this.persistCountCache(whisperId, this.countCache[whisperId]);
      return count;
    } catch (error) {
      console.error("Error fetching like count:", error);
      return 0;
    }
  }

  /**
   * Force sync like count with server (useful for fixing inconsistencies)
   */
  async syncLikeCount(whisperId: string): Promise<number> {
    try {
      const whisper = await this.firestoreService.getWhisper(whisperId);
      const count = whisper?.likes || 0;

      // Update cache with server data
      this.countCache[whisperId] = {
        likes: count,
        replies: whisper?.replies || 0,
        timestamp: Date.now(),
      };

      await this.persistCountCache(whisperId, this.countCache[whisperId]);

      console.log(`✅ Synced like count for whisper ${whisperId}: ${count}`);
      return count;
    } catch (error) {
      console.error("Error syncing like count:", error);
      return 0;
    }
  }

  /**
   * Get likes for a whisper (paginated, cached)
   */
  async getLikes(
    whisperId: string,
    limit: number = 50,
    lastDoc?: unknown
  ): Promise<{ likes: Like[]; hasMore: boolean; lastDoc: unknown }> {
    try {
      const cacheKey = `likes_${whisperId}`;
      const cached = this.likeListCache[cacheKey] as LikeListCache | undefined;

      if (cached && this.isCacheValid(cached.timestamp)) {
        return {
          likes: cached.likes,
          hasMore: cached.hasMore,
          lastDoc: cached.lastDoc,
        };
      }

      const result = await this.firestoreService.getWhisperLikes(
        whisperId,
        limit,
        lastDoc as QueryDocumentSnapshot<DocumentData>
      );

      // Cache the result
      this.likeListCache[cacheKey] = {
        likes: result.likes,
        hasMore: result.hasMore,
        lastDoc: result.lastDoc,
        timestamp: Date.now(),
      };

      return {
        likes: result.likes,
        hasMore: result.hasMore,
        lastDoc: result.lastDoc,
      };
    } catch (error) {
      console.error("❌ Error getting likes:", error);
      return { likes: [], hasMore: false, lastDoc: null };
    }
  }

  /**
   * Get comments with pagination and caching (updated for paginated Firestore)
   */
  async getComments(
    whisperId: string,
    limit: number = 20,
    lastDoc?: unknown
  ): Promise<{
    comments: Comment[];
    hasMore: boolean;
    lastDoc: unknown;
    count: number;
  }> {
    try {
      const cacheKey = `comments_${whisperId}`;
      const cached = this.commentCache[cacheKey];

      if (cached && this.isCacheValid(cached.timestamp)) {
        return {
          comments: cached.comments,
          hasMore: cached.hasMore,
          lastDoc: cached.lastDoc,
          count: cached.count,
        };
      }

      const result = await this.firestoreService.getWhisperComments(
        whisperId,
        limit,
        lastDoc as QueryDocumentSnapshot<DocumentData>
      );

      // Cache the result
      this.commentCache[cacheKey] = {
        comments: result.comments,
        count: result.comments.length,
        hasMore: result.hasMore,
        lastDoc: result.lastDoc,
        timestamp: Date.now(),
      };

      return {
        comments: result.comments,
        hasMore: result.hasMore,
        lastDoc: result.lastDoc,
        count: result.comments.length,
      };
    } catch (error) {
      console.error("❌ Error getting comments:", error);
      return { comments: [], hasMore: false, lastDoc: null, count: 0 };
    }
  }

  /**
   * Add comment with optimistic update
   */
  async addComment(
    whisperId: string,
    text: string
  ): Promise<{ commentId: string; count: number }> {
    const { user } = useAuthStore.getState();
    if (!user) {
      throw new Error("User must be authenticated to comment");
    }

    if (this.pendingComments.has(whisperId)) {
      throw new Error("Comment operation already in progress");
    }

    this.pendingComments.add(whisperId);

    try {
      // Optimistic update
      const currentCount = this.countCache[whisperId]?.replies || 0;
      const newCount = currentCount + 1;

      // Update count cache
      this.countCache[whisperId] = {
        ...this.countCache[whisperId],
        replies: newCount,
        timestamp: Date.now(),
      };

      // Clear comment cache for this whisper
      await this.clearCommentCache(whisperId);

      // Add to server
      const commentId = await this.firestoreService.addComment(
        whisperId,
        user.uid,
        user.displayName,
        user.profileColor,
        text
      );

      // Persist count cache
      await this.persistCountCache(whisperId, this.countCache[whisperId]);

      return { commentId, count: newCount };
    } finally {
      this.pendingComments.delete(whisperId);
    }
  }

  /**
   * Like/unlike a comment
   */
  async toggleCommentLike(
    commentId: string
  ): Promise<{ isLiked: boolean; count: number }> {
    const { user } = useAuthStore.getState();
    if (!user) {
      throw new Error("User must be authenticated to like comments");
    }

    const cacheKey = `comment_${commentId}_${user.uid}`;

    // Prevent rapid-fire likes
    if (this.pendingLikes.has(cacheKey)) {
      throw new Error("Comment like operation already in progress");
    }

    this.pendingLikes.add(cacheKey);

    try {
      // Get current state from cache
      const currentState = this.likeCache[cacheKey] || {
        isLiked: false,
        count: 0,
        timestamp: 0,
      };

      // Optimistic update
      const newIsLiked = !currentState.isLiked;
      const newCount = newIsLiked
        ? currentState.count + 1
        : currentState.count - 1;

      // Update cache immediately
      this.likeCache[cacheKey] = {
        isLiked: newIsLiked,
        count: newCount,
        timestamp: Date.now(),
      };

      // Persist to AsyncStorage
      await this.persistLikeCache(cacheKey, this.likeCache[cacheKey]);

      // Update on server
      try {
        await this.firestoreService.likeComment(
          commentId,
          user.uid,
          user.displayName,
          user.profileColor
        );

        // Get updated comment from server to validate count
        const updatedComment = await this.firestoreService.getComment(
          commentId
        );
        const serverCount = updatedComment?.likes || 0;

        // If server count differs from our optimistic count, update cache
        if (serverCount !== newCount) {
          console.log(
            `⚠️ Comment count mismatch: optimistic=${newCount}, server=${serverCount}`
          );
          this.likeCache[cacheKey] = {
            ...this.likeCache[cacheKey],
            count: serverCount,
            timestamp: Date.now(),
          };
          return { isLiked: newIsLiked, count: serverCount };
        }
      } catch (error) {
        console.error(
          "Server update failed, reverting optimistic update:",
          error
        );
        // Revert optimistic update on server failure
        this.likeCache[cacheKey] = currentState;
        throw error;
      }

      return { isLiked: newIsLiked, count: newCount };
    } finally {
      this.pendingLikes.delete(cacheKey);
    }
  }

  /**
   * Check if user has liked a comment (cached)
   */
  async hasUserLikedComment(commentId: string): Promise<boolean> {
    const { user } = useAuthStore.getState();
    if (!user) return false;

    const cacheKey = `comment_${commentId}_${user.uid}`;

    // Check memory cache first
    if (
      this.likeCache[cacheKey] &&
      Date.now() - this.likeCache[cacheKey].timestamp < CACHE_TTL
    ) {
      return this.likeCache[cacheKey].isLiked;
    }

    // Check AsyncStorage cache
    const cached = await this.getLikeCache(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      this.likeCache[cacheKey] = cached;
      return cached.isLiked;
    }

    // Fetch from server
    try {
      const isLiked = await this.firestoreService.hasUserLikedComment(
        commentId,
        user.uid
      );

      // Update cache
      this.likeCache[cacheKey] = {
        isLiked,
        count: 0, // We'll get this from the comment data
        timestamp: Date.now(),
      };

      await this.persistLikeCache(cacheKey, this.likeCache[cacheKey]);
      return isLiked;
    } catch (error) {
      console.error("Error checking comment like state:", error);
      return false;
    }
  }

  /**
   * Get comment likes with pagination
   */
  async getCommentLikes(
    commentId: string,
    limit: number = 50,
    lastDoc?: unknown
  ): Promise<{ likes: CommentLike[]; hasMore: boolean; lastDoc: unknown }> {
    try {
      const cacheKey = `commentLikes_${commentId}`;
      const cached = this.likeListCache[cacheKey] as
        | CommentLikeListCache
        | undefined;

      if (cached && this.isCacheValid(cached.timestamp)) {
        return {
          likes: cached.likes,
          hasMore: cached.hasMore,
          lastDoc: cached.lastDoc,
        };
      }

      const result = await this.firestoreService.getCommentLikes(
        commentId,
        limit,
        lastDoc as QueryDocumentSnapshot<DocumentData>
      );

      // Cache the result
      this.likeListCache[cacheKey] = {
        likes: result.likes as CommentLike[],
        hasMore: result.hasMore,
        lastDoc: result.lastDoc,
        timestamp: Date.now(),
      };

      return {
        likes: result.likes as CommentLike[],
        hasMore: result.hasMore,
        lastDoc: result.lastDoc,
      };
    } catch (error) {
      console.error("❌ Error getting comment likes:", error);
      return { likes: [], hasMore: false, lastDoc: null };
    }
  }

  /**
   * Delete comment with optimistic update
   */
  async deleteComment(
    commentId: string,
    whisperId: string
  ): Promise<{ count: number }> {
    const { user } = useAuthStore.getState();
    if (!user) {
      throw new Error("User must be authenticated to delete comments");
    }

    try {
      // Optimistic update
      const currentCount = this.countCache[whisperId]?.replies || 0;
      const newCount = Math.max(0, currentCount - 1);

      // Update count cache
      this.countCache[whisperId] = {
        ...this.countCache[whisperId],
        replies: newCount,
        timestamp: Date.now(),
      };

      // Clear comment cache for this whisper
      this.clearCommentCache(whisperId);

      // Delete from server
      await this.firestoreService.deleteComment(commentId, user.uid);

      // Persist count cache
      await this.persistCountCache(whisperId, this.countCache[whisperId]);

      return { count: newCount };
    } catch (error) {
      // Revert optimistic update on error
      const currentCount = this.countCache[whisperId]?.replies || 0;
      this.countCache[whisperId] = {
        ...this.countCache[whisperId],
        replies: currentCount + 1,
        timestamp: Date.now(),
      };
      throw error;
    }
  }

  /**
   * Clear all caches for a whisper (useful when whisper is updated)
   */
  async clearWhisperCache(whisperId: string): Promise<void> {
    // Clear memory caches
    Object.keys(this.likeCache).forEach((key) => {
      if (key.startsWith(whisperId)) {
        delete this.likeCache[key];
      }
    });

    delete this.commentCache[whisperId];
    delete this.countCache[whisperId];

    // Clear AsyncStorage caches
    const keys = await AsyncStorage.getAllKeys();
    const whisperKeys = keys.filter(
      (key) =>
        key.includes(whisperId) &&
        (key.startsWith(LIKE_CACHE_PREFIX) ||
          key.startsWith(COMMENT_CACHE_PREFIX) ||
          key.startsWith(COUNT_CACHE_PREFIX))
    );

    if (whisperKeys.length > 0) {
      await AsyncStorage.multiRemove(whisperKeys);
    }
  }

  /**
   * Clear all caches (useful for logout or app reset)
   */
  async clearAllCaches(): Promise<void> {
    this.likeCache = {};
    this.commentCache = {};
    this.countCache = {};

    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys =
      keys?.filter(
        (key) =>
          key.startsWith(LIKE_CACHE_PREFIX) ||
          key.startsWith(COMMENT_CACHE_PREFIX) ||
          key.startsWith(COUNT_CACHE_PREFIX)
      ) || [];

    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
    }
  }

  // Private helper methods

  private async persistLikeCache(
    key: string,
    data: LikeCache[keyof LikeCache]
  ): Promise<void> {
    try {
      await AsyncStorage.setItem(LIKE_CACHE_PREFIX + key, JSON.stringify(data));
    } catch (error) {
      console.error("Error persisting like cache:", error);
    }
  }

  private async getLikeCache(
    key: string
  ): Promise<LikeCache[keyof LikeCache] | null> {
    try {
      const data = await AsyncStorage.getItem(LIKE_CACHE_PREFIX + key);
      return data ? (JSON.parse(data) as LikeCache[keyof LikeCache]) : null;
    } catch (error) {
      console.error("Error getting like cache:", error);
      return null;
    }
  }

  private async persistCommentCache(
    key: string,
    data: CommentCache
  ): Promise<void> {
    try {
      await AsyncStorage.setItem(
        COMMENT_CACHE_PREFIX + key,
        JSON.stringify(data)
      );
    } catch (error) {
      console.error("Error persisting comment cache:", error);
    }
  }

  private async getCommentCache(key: string): Promise<CommentCache | null> {
    try {
      const data = await AsyncStorage.getItem(COMMENT_CACHE_PREFIX + key);
      return data ? (JSON.parse(data) as CommentCache) : null;
    } catch (error) {
      console.error("Error getting comment cache:", error);
      return null;
    }
  }

  private async persistCountCache(
    key: string,
    data: CountCache
  ): Promise<void> {
    try {
      await AsyncStorage.setItem(
        COUNT_CACHE_PREFIX + key,
        JSON.stringify(data)
      );
    } catch (error) {
      console.error("Error persisting count cache:", error);
    }
  }

  private async getCountCache(key: string): Promise<CountCache | null> {
    try {
      const data = await AsyncStorage.getItem(COUNT_CACHE_PREFIX + key);
      return data ? (JSON.parse(data) as CountCache) : null;
    } catch (error) {
      console.error("Error getting count cache:", error);
      return null;
    }
  }

  private async clearCommentCache(whisperId: string): Promise<void> {
    // Clear memory cache
    Object.keys(this.commentCache).forEach((key) => {
      if (key.startsWith(whisperId)) {
        delete this.commentCache[key];
      }
    });

    // Clear AsyncStorage cache for this whisper
    try {
      const keys = await AsyncStorage.getAllKeys();
      const commentKeys = keys.filter(
        (key) => key.startsWith(COMMENT_CACHE_PREFIX) && key.includes(whisperId)
      );

      if (commentKeys.length > 0) {
        await AsyncStorage.multiRemove(commentKeys);
        console.log(
          `🧹 Cleared ${commentKeys.length} comment cache entries for whisper ${whisperId}`
        );
      }
    } catch (error) {
      console.error("Error clearing comment cache from AsyncStorage:", error);
    }
  }

  private debounceServerUpdate(
    key: string,
    callback: () => Promise<void>
  ): void {
    // Clear existing timer
    if (this.debounceTimers[key]) {
      clearTimeout(this.debounceTimers[key]);
    }

    // Set new timer
    this.debounceTimers[key] = setTimeout(async () => {
      try {
        await callback();
      } catch (error) {
        console.error("Debounced server update failed:", error);
      } finally {
        delete this.debounceTimers[key];
      }
    }, 1000); // 1 second debounce
  }

  private async updateLikeOnServer(
    whisperId: string,
    userId: string
  ): Promise<void> {
    // Get user info for the like
    const { user } = useAuthStore.getState();
    const userDisplayName = user?.displayName;
    const userProfileColor = user?.profileColor;

    // This method handles the actual server update
    // The firestoreService.likeWhisper method already handles the toggle logic
    await this.firestoreService.likeWhisper(
      whisperId,
      userId,
      userDisplayName,
      userProfileColor
    );
  }

  /**
   * Get a single comment by ID
   */
  async getComment(commentId: string): Promise<Comment | null> {
    try {
      return await this.firestoreService.getComment(commentId);
    } catch (error) {
      console.error("Error getting comment:", error);
      throw error;
    }
  }

  /**
   * Get whisper likes with privacy filtering
   */
  async getWhisperLikesWithPrivacy(
    whisperId: string,
    limit: number = 50,
    lastDoc?: unknown
  ): Promise<{ likes: Like[]; hasMore: boolean; lastDoc: unknown }> {
    const { user } = useAuthStore.getState();
    if (!user) {
      throw new Error("User must be authenticated to view likes");
    }

    const cacheKey = `whisper_likes_privacy_${whisperId}_${user.uid}`;

    // Check cache for first page
    if (!lastDoc && this.likeListCache[cacheKey]) {
      const cached = this.likeListCache[cacheKey] as LikeListCache;
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        return cached;
      }
    }

    try {
      const result = await this.privacyService.getWhisperLikesWithPrivacy(
        whisperId,
        user.uid,
        limit,
        lastDoc as unknown as QueryDocumentSnapshot<DocumentData>
      );

      const cacheResult: LikeListCache = {
        likes: result.likes,
        hasMore: result.hasMore,
        lastDoc: result.lastDoc,
        timestamp: Date.now(),
      };

      if (!lastDoc) {
        this.likeListCache[cacheKey] = cacheResult;
      }

      return cacheResult;
    } catch (error) {
      console.error("Error getting whisper likes with privacy:", error);
      throw error;
    }
  }

  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < CACHE_TTL;
  }
}

// Singleton exports
export const getInteractionService = (): InteractionService => {
  return InteractionService.getInstance();
};

export const resetInteractionService = (): void => {
  // Reset the singleton instance
  (
    InteractionService as unknown as { instance?: InteractionService }
  ).instance = undefined;
};

export const destroyInteractionService = (): void => {
  const instance = (
    InteractionService as unknown as { instance?: InteractionService }
  ).instance;
  if (instance) {
    instance.clearAllCaches();
    (
      InteractionService as unknown as { instance?: InteractionService }
    ).instance = undefined;
  }
};
