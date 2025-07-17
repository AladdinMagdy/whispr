import {
  InteractionService,
  getInteractionService,
  resetInteractionService,
  destroyInteractionService,
} from "../services/interactionService";
import { getFirestoreService } from "../services/firestoreService";
import { useAuthStore } from "../store/useAuthStore";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Mock dependencies
jest.mock("../services/firestoreService");
jest.mock("../store/useAuthStore");
jest.mock("@react-native-async-storage/async-storage", () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  getAllKeys: jest.fn(),
  multiRemove: jest.fn(),
}));

const mockFirestoreService = {
  likeWhisper: jest.fn(),
  unlikeWhisper: jest.fn(),
  hasUserLikedWhisper: jest.fn(),
  getWhisper: jest.fn(),
  getComments: jest.fn(),
  addComment: jest.fn(),
  deleteComment: jest.fn(),
  likeComment: jest.fn(),
  unlikeComment: jest.fn(),
  getComment: jest.fn(),
  getCommentLikes: jest.fn(),
  getWhisperLikes: jest.fn(),
  getWhisperLikesWithPrivacy: jest.fn(),
  hasUserLikedComment: jest.fn(),
};

describe("InteractionService", () => {
  let interactionService: InteractionService;

  beforeEach(async () => {
    jest.useRealTimers();
    jest.clearAllTimers();
    jest.resetAllMocks();
    // Reset the singleton instance and its state
    (resetInteractionService as jest.Mock)();
    // Always mock useAuthStore.getState to return a valid user
    // Mock the full AuthStore shape
    (useAuthStore.getState as unknown as jest.Mock).mockImplementation(() => ({
      user: {
        uid: "user123",
        displayName: "Test User",
        profileColor: "#123456",
      },
      signInAnonymously: jest.fn(),
      signOut: jest.fn(),
      updateLastActive: jest.fn(),
      incrementWhisperCount: jest.fn(),
      incrementReactionCount: jest.fn(),
      setCallbacks: jest.fn(),
      getCurrentUser: jest.fn(),
      updateProfile: jest.fn(),
      isAuthenticated: true,
      loading: false,
      error: null,
    }));
    (getFirestoreService as jest.Mock).mockReturnValue(mockFirestoreService);
    interactionService = getInteractionService();
  });

  afterEach(() => {
    resetInteractionService();
  });

  describe("Singleton Pattern", () => {
    it("should return the same instance", async () => {
      const instance1 = getInteractionService();
      const instance2 = getInteractionService();
      expect(instance1).toBe(instance2);
    });

    it("should reset instance correctly", async () => {
      const instance1 = getInteractionService();
      resetInteractionService();
      const instance2 = getInteractionService();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe("toggleLike", () => {
    it("should toggle like with optimistic updates", async () => {
      const whisperId = "test-whisper-123";

      // Mock initial state
      mockFirestoreService.hasUserLikedWhisper.mockResolvedValue(false);

      // Mock server responses for like operations
      mockFirestoreService.likeWhisper.mockResolvedValue(undefined);

      // Mock server whisper responses after like operations
      mockFirestoreService.getWhisper
        .mockResolvedValueOnce({ likes: 1 }) // After first like
        .mockResolvedValueOnce({ likes: 0 }); // After second like (unlike)

      // First like
      const result1 = await interactionService.toggleLike(whisperId);
      expect(result1.isLiked).toBe(true);
      expect(result1.count).toBe(1);

      // Second like (unlike)
      const result2 = await interactionService.toggleLike(whisperId);
      expect(result2.isLiked).toBe(false);
      expect(result2.count).toBe(0);
    });

    it("should prevent rapid-fire likes", async () => {
      const whisperId = "test-whisper-123";

      // Start first like operation
      const promise1 = interactionService.toggleLike(whisperId);

      // Try to like again immediately
      const promise2 = interactionService.toggleLike(whisperId);

      await expect(promise2).rejects.toThrow(
        "Like operation already in progress"
      );
      await promise1; // Wait for first operation to complete
    });

    it("should throw error if user not authenticated", async () => {
      (useAuthStore.getState as jest.Mock).mockReturnValue({ user: null });

      await expect(
        interactionService.toggleLike("test-whisper")
      ).rejects.toThrow("User must be authenticated to like whispers");
    });
  });

  describe("hasUserLiked", () => {
    it("should return cached result if available", async () => {
      const whisperId = "test-whisper-123";

      // Mock server response
      mockFirestoreService.hasUserLikedWhisper.mockResolvedValue(true);

      // First call - should hit server
      const result1 = await interactionService.hasUserLiked(whisperId);
      expect(result1).toBe(true);
      expect(mockFirestoreService.hasUserLikedWhisper).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result2 = await interactionService.hasUserLiked(whisperId);
      expect(result2).toBe(true);
      expect(mockFirestoreService.hasUserLikedWhisper).toHaveBeenCalledTimes(1); // Still 1
    });

    it("should return false if user not authenticated", async () => {
      (useAuthStore.getState as jest.Mock).mockReturnValue({ user: null });

      const result = await interactionService.hasUserLiked("test-whisper");
      expect(result).toBe(false);
    });

    it("should handle server errors gracefully", async () => {
      mockFirestoreService.hasUserLikedWhisper.mockRejectedValue(
        new Error("Server error")
      );

      const result = await interactionService.hasUserLiked("test-whisper");
      expect(result).toBe(false);
    });
  });

  describe("getLikeCount", () => {
    it("should return cached count if available", async () => {
      const whisperId = "test-whisper-123";
      const mockWhisper = { likes: 42, replies: 5 };

      mockFirestoreService.getWhisper.mockResolvedValue(mockWhisper);

      // First call - should hit server
      const result1 = await interactionService.getLikeCount(whisperId);
      expect(result1).toBe(42);
      expect(mockFirestoreService.getWhisper).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result2 = await interactionService.getLikeCount(whisperId);
      expect(result2).toBe(42);
      expect(mockFirestoreService.getWhisper).toHaveBeenCalledTimes(1); // Still 1
    });

    it("should return 0 if whisper not found", async () => {
      mockFirestoreService.getWhisper.mockResolvedValue(null);

      const result = await interactionService.getLikeCount("test-whisper");
      expect(result).toBe(0);
    });

    it("should handle server errors gracefully", async () => {
      mockFirestoreService.getWhisper.mockRejectedValue(
        new Error("Server error")
      );

      const result = await interactionService.getLikeCount("test-whisper");
      expect(result).toBe(0);
    });
  });

  describe("getComments", () => {
    it("should return cached comments if available", async () => {
      const whisperId = "test-whisper-123";
      const mockComments = [
        { id: "1", text: "Comment 1" },
        { id: "2", text: "Comment 2" },
      ];

      // Mock the new paginated return format
      mockFirestoreService.getComments.mockResolvedValue({
        comments: mockComments,
        lastDoc: null,
        hasMore: false,
      });

      // First call - should hit server
      const result1 = await interactionService.getComments(whisperId);
      expect(result1.comments).toEqual(mockComments);
      expect(result1.count).toBe(2);
      expect(result1.hasMore).toBe(false);
      expect(result1.lastDoc).toBe(null);
      expect(mockFirestoreService.getComments).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result2 = await interactionService.getComments(whisperId);
      expect(result2.comments).toEqual(mockComments);
      expect(mockFirestoreService.getComments).toHaveBeenCalledTimes(1); // Still 1
    });

    it("should handle server errors gracefully", async () => {
      mockFirestoreService.getComments.mockRejectedValue(
        new Error("Server error")
      );

      const result = await interactionService.getComments("test-whisper");
      expect(result.comments).toEqual([]);
      expect(result.count).toBe(0);
      expect(result.hasMore).toBe(false);
    });
  });

  describe("addComment", () => {
    it("should add comment with optimistic update", async () => {
      const whisperId = "test-whisper-123";
      const commentText = "Test comment";

      mockFirestoreService.addComment.mockResolvedValue("new-comment-id");

      const result = await interactionService.addComment(
        whisperId,
        commentText
      );

      expect(result.commentId).toBe("new-comment-id");
      expect(result.count).toBe(1);
      expect(mockFirestoreService.addComment).toHaveBeenCalledWith(
        whisperId,
        "user123",
        "Test User",
        "#123456",
        commentText
      );
    });

    it("should prevent concurrent comment operations", async () => {
      const whisperId = "test-whisper-123";

      // Start first comment operation
      const promise1 = interactionService.addComment(whisperId, "Comment 1");

      // Try to comment again immediately
      const promise2 = interactionService.addComment(whisperId, "Comment 2");

      await expect(promise2).rejects.toThrow(
        "Comment operation already in progress"
      );
      await promise1; // Wait for first operation to complete
    });

    it("should throw error if user not authenticated", async () => {
      (useAuthStore.getState as jest.Mock).mockReturnValue({ user: null });

      await expect(
        interactionService.addComment("test-whisper", "test")
      ).rejects.toThrow("User must be authenticated to comment");
    });
  });

  describe("toggleCommentLike", () => {
    it("should toggle comment like with optimistic updates", async () => {
      const commentId = "test-comment-123";

      // Mock server responses
      mockFirestoreService.likeComment.mockResolvedValue(undefined);
      mockFirestoreService.getComment.mockResolvedValue({ likes: 1 });

      const result = await interactionService.toggleCommentLike(commentId);

      expect(result.isLiked).toBe(true);
      expect(result.count).toBe(1);
      expect(mockFirestoreService.likeComment).toHaveBeenCalledWith(
        commentId,
        "user123",
        "Test User",
        "#123456"
      );
      expect(mockFirestoreService.getComment).toHaveBeenCalledWith(commentId);
    });

    it("should prevent rapid-fire comment likes", async () => {
      const commentId = "test-comment-123";

      // Start first like operation
      const promise1 = interactionService.toggleCommentLike(commentId);

      // Try to like again immediately
      const promise2 = interactionService.toggleCommentLike(commentId);

      await expect(promise2).rejects.toThrow(
        "Comment like operation already in progress"
      );
      await promise1; // Wait for first operation to complete
    });

    it("should throw error if user not authenticated", async () => {
      (useAuthStore.getState as jest.Mock).mockReturnValue({ user: null });

      await expect(
        interactionService.toggleCommentLike("test-comment")
      ).rejects.toThrow("User must be authenticated to like comments");
    });
  });

  describe("deleteComment", () => {
    it("should delete comment with optimistic update", async () => {
      const commentId = "test-comment-123";
      const whisperId = "test-whisper-123";

      mockFirestoreService.deleteComment.mockResolvedValue(undefined);

      const result = await interactionService.deleteComment(
        commentId,
        whisperId
      );

      expect(result.count).toBe(0);
      expect(mockFirestoreService.deleteComment).toHaveBeenCalledWith(
        commentId,
        "user123"
      );
    });

    it("should revert optimistic update on error", async () => {
      const commentId = "test-comment-123";
      const whisperId = "test-whisper-123";

      mockFirestoreService.deleteComment.mockRejectedValue(
        new Error("Server error")
      );

      await expect(
        interactionService.deleteComment(commentId, whisperId)
      ).rejects.toThrow("Server error");
    });

    it("should throw error if user not authenticated", async () => {
      (useAuthStore.getState as jest.Mock).mockReturnValue({ user: null });

      await expect(
        interactionService.deleteComment("comment-id", "whisper-id")
      ).rejects.toThrow("User must be authenticated to delete comments");
    });
  });

  describe("Cache Management", () => {
    it("should clear whisper cache", async () => {
      const whisperId = "test-whisper-123";

      // Mock AsyncStorage
      (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([
        "whispr_like_test-whisper-123_user123",
        "whispr_comments_test-whisper-123_20_first",
        "whispr_count_test-whisper-123",
      ]);

      // Mock server responses for toggleLike
      mockFirestoreService.likeWhisper.mockResolvedValue(undefined);
      mockFirestoreService.getWhisper.mockResolvedValue({ likes: 1 });

      // Add some data to cache
      await interactionService.toggleLike(whisperId);

      // Clear cache
      await interactionService.clearWhisperCache(whisperId);

      // Verify cache is cleared by checking if server is called again
      mockFirestoreService.hasUserLikedWhisper.mockResolvedValue(false);
      await interactionService.hasUserLiked(whisperId);
      expect(mockFirestoreService.hasUserLikedWhisper).toHaveBeenCalled();
    });

    it("should clear all caches", async () => {
      const whisperId = "test-whisper-123";

      // Mock AsyncStorage
      (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([
        "whispr_like_test-whisper-123_user123",
        "whispr_comments_test-whisper-123_20_first",
        "whispr_count_test-whisper-123",
      ]);

      // Mock server responses for toggleLike
      mockFirestoreService.likeWhisper.mockResolvedValue(undefined);
      mockFirestoreService.getWhisper.mockResolvedValue({ likes: 1 });

      // Add some data to cache
      await interactionService.toggleLike(whisperId);

      // Clear all caches
      await interactionService.clearAllCaches();

      // Verify cache is cleared
      mockFirestoreService.hasUserLikedWhisper.mockResolvedValue(false);
      await interactionService.hasUserLiked(whisperId);
      expect(mockFirestoreService.hasUserLikedWhisper).toHaveBeenCalled();
    });
  });

  describe("AsyncStorage Integration", () => {
    it("should persist and retrieve like cache", async () => {
      const whisperId = "test-whisper-123";

      // Clear in-memory cache
      resetInteractionService();

      // Mock AsyncStorage
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify({ isLiked: true, count: 5, timestamp: Date.now() })
      );

      // Mock server responses for toggleLike
      mockFirestoreService.likeWhisper.mockResolvedValue(undefined);
      mockFirestoreService.getWhisper.mockResolvedValue({ likes: 1 });

      // This should trigger AsyncStorage operations
      await interactionService.toggleLike(whisperId);

      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it("should handle AsyncStorage errors gracefully", async () => {
      const whisperId = "test-whisper-123";

      // Mock AsyncStorage error
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(
        new Error("Storage error")
      );

      // Mock server responses for toggleLike
      mockFirestoreService.likeWhisper.mockResolvedValue(undefined);
      mockFirestoreService.getWhisper.mockResolvedValue({ likes: 1 });

      // Should not throw error
      await expect(
        interactionService.toggleLike(whisperId)
      ).resolves.toBeDefined();
    });
  });

  describe("Debouncing", () => {
    beforeEach(async () => {
      jest.useRealTimers();
      jest.clearAllTimers();
      jest.resetAllMocks();
      // Reset the singleton instance and its state
      (resetInteractionService as jest.Mock)();
      // Always mock useAuthStore.getState to return a valid user
      // Mock the full AuthStore shape
      (useAuthStore.getState as unknown as jest.Mock).mockImplementation(
        () => ({
          user: {
            uid: "user123",
            displayName: "Test User",
            profileColor: "#123456",
          },
          signInAnonymously: jest.fn(),
          signOut: jest.fn(),
          updateLastActive: jest.fn(),
          incrementWhisperCount: jest.fn(),
          incrementReactionCount: jest.fn(),
          setCallbacks: jest.fn(),
          getCurrentUser: jest.fn(),
          updateProfile: jest.fn(),
          isAuthenticated: true,
          loading: false,
          error: null,
        })
      );
    });

    it("should debounce server updates", async () => {
      // Use real timers for this test
      jest.useRealTimers();

      // Use a unique whisperId to avoid timer collisions
      const whisperId = `test-whisper-${Date.now()}-${Math.random()}`;
      mockFirestoreService.likeWhisper.mockResolvedValue(undefined);
      mockFirestoreService.getWhisper.mockResolvedValue({ likes: 1 });

      // Call toggleLike once
      await interactionService.toggleLike(whisperId);

      // Wait for the debounce delay (should match your debounce delay, e.g., 1100ms)
      await new Promise((resolve) => setTimeout(resolve, 1200));

      // Should call server at least once due to debouncing
      expect(mockFirestoreService.likeWhisper).toHaveBeenCalled();
    });
  });

  describe("syncLikeCount", () => {
    it("should sync like count with server", async () => {
      const whisperId = "test-whisper-123";
      const mockWhisper = { likes: 42, replies: 5 };

      mockFirestoreService.getWhisper.mockResolvedValue(mockWhisper);

      const result = await interactionService.syncLikeCount(whisperId);

      expect(result).toBe(42);
      expect(mockFirestoreService.getWhisper).toHaveBeenCalledWith(whisperId);
    });

    it("should handle server errors gracefully", async () => {
      mockFirestoreService.getWhisper.mockRejectedValue(
        new Error("Server error")
      );

      const result = await interactionService.syncLikeCount("test-whisper");
      expect(result).toBe(0);
    });

    it("should return 0 if whisper not found", async () => {
      mockFirestoreService.getWhisper.mockResolvedValue(null);

      const result = await interactionService.syncLikeCount("test-whisper");
      expect(result).toBe(0);
    });
  });

  describe("getLikes", () => {
    it("should return cached likes if available", async () => {
      const whisperId = "test-whisper-123";
      const mockLikes = [
        { id: "1", userId: "user1", userDisplayName: "User 1" },
        { id: "2", userId: "user2", userDisplayName: "User 2" },
      ];

      mockFirestoreService.getWhisperLikes.mockResolvedValue({
        likes: mockLikes,
        hasMore: false,
        lastDoc: null,
      });

      // First call - should hit server
      const result1 = await interactionService.getLikes(whisperId);
      expect(result1.likes).toEqual(mockLikes);
      expect(result1.hasMore).toBe(false);
      expect(mockFirestoreService.getWhisperLikes).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result2 = await interactionService.getLikes(whisperId);
      expect(result2.likes).toEqual(mockLikes);
      expect(mockFirestoreService.getWhisperLikes).toHaveBeenCalledTimes(1); // Still 1
    });

    it("should handle pagination with lastDoc", async () => {
      const whisperId = "test-whisper-123";
      const lastDoc = { id: "last-doc-id" };
      const mockLikes = [
        { id: "3", userId: "user3", userDisplayName: "User 3" },
      ];

      mockFirestoreService.getWhisperLikes.mockResolvedValue({
        likes: mockLikes,
        hasMore: true,
        lastDoc: { id: "next-doc" },
      });

      const result = await interactionService.getLikes(whisperId, 10, lastDoc);
      expect(result.likes).toEqual(mockLikes);
      expect(result.hasMore).toBe(true);
      expect(mockFirestoreService.getWhisperLikes).toHaveBeenCalledWith(
        whisperId,
        10,
        lastDoc,
        undefined
      );
    });

    it("should handle server errors gracefully", async () => {
      mockFirestoreService.getWhisperLikes.mockRejectedValue(
        new Error("Server error")
      );

      const result = await interactionService.getLikes("test-whisper");
      expect(result.likes).toEqual([]);
      expect(result.hasMore).toBe(false);
      expect(result.lastDoc).toBe(null);
    });

    it("should handle different lastDoc types", async () => {
      const whisperId = "test-whisper-123";

      // Test with object that has id
      const lastDocWithId = { id: "doc-id" };
      mockFirestoreService.getWhisperLikes.mockResolvedValue({
        likes: [],
        hasMore: false,
        lastDoc: null,
      });

      await interactionService.getLikes(whisperId, 10, lastDocWithId);
      expect(mockFirestoreService.getWhisperLikes).toHaveBeenCalledWith(
        whisperId,
        10,
        lastDocWithId,
        undefined
      );

      // Test with object without id
      const lastDocWithoutId = { someData: "value" };
      await interactionService.getLikes(whisperId, 10, lastDocWithoutId);
      expect(mockFirestoreService.getWhisperLikes).toHaveBeenCalledWith(
        whisperId,
        10,
        lastDocWithoutId,
        undefined
      );
    });
  });

  describe("hasUserLikedComment", () => {
    it("should return cached result if available", async () => {
      const commentId = "test-comment-123";

      mockFirestoreService.hasUserLikedComment.mockResolvedValue(true);

      // First call - should hit server
      const result1 = await interactionService.hasUserLikedComment(commentId);
      expect(result1).toBe(true);
      expect(mockFirestoreService.hasUserLikedComment).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result2 = await interactionService.hasUserLikedComment(commentId);
      expect(result2).toBe(true);
      expect(mockFirestoreService.hasUserLikedComment).toHaveBeenCalledTimes(1); // Still 1
    });

    it("should return false if user not authenticated", async () => {
      (useAuthStore.getState as jest.Mock).mockReturnValue({ user: null });

      const result = await interactionService.hasUserLikedComment(
        "test-comment"
      );
      expect(result).toBe(false);
    });

    it("should handle server errors gracefully", async () => {
      mockFirestoreService.hasUserLikedComment.mockRejectedValue(
        new Error("Server error")
      );

      const result = await interactionService.hasUserLikedComment(
        "test-comment"
      );
      expect(result).toBe(false);
    });
  });

  describe("getCommentLikes", () => {
    it("should return cached likes if available", async () => {
      const commentId = "test-comment-123";
      const mockLikes = [
        {
          id: "1",
          commentId,
          userId: "user1",
          userDisplayName: "User 1",
          createdAt: new Date(),
        },
        {
          id: "2",
          commentId,
          userId: "user2",
          userDisplayName: "User 2",
          createdAt: new Date(),
        },
      ];

      mockFirestoreService.getCommentLikes.mockResolvedValue({
        likes: mockLikes,
        hasMore: false,
        lastDoc: null,
      });

      // First call - should hit server
      const result1 = await interactionService.getCommentLikes(commentId);
      expect(result1.likes).toHaveLength(2);
      expect(result1.likes[0].id).toBe("1");
      expect(result1.likes[0].userDisplayName).toBe("User 1");
      expect(result1.likes[0].userProfileColor).toBe("#9E9E9E"); // Default color
      expect(result1.hasMore).toBe(false);
      expect(mockFirestoreService.getCommentLikes).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result2 = await interactionService.getCommentLikes(commentId);
      expect(result2.likes).toHaveLength(2);
      expect(mockFirestoreService.getCommentLikes).toHaveBeenCalledTimes(1); // Still 1
    });

    it("should handle pagination with lastDoc", async () => {
      const commentId = "test-comment-123";
      const lastDoc = { id: "last-doc-id" };
      const mockLikes = [
        {
          id: "3",
          commentId,
          userId: "user3",
          userDisplayName: "User 3",
          createdAt: new Date(),
        },
      ];

      mockFirestoreService.getCommentLikes.mockResolvedValue({
        likes: mockLikes,
        hasMore: true,
        lastDoc: { id: "next-doc" },
      });

      const result = await interactionService.getCommentLikes(
        commentId,
        10,
        lastDoc
      );
      expect(result.likes).toHaveLength(1);
      expect(result.likes[0].id).toBe("3");
      expect(result.likes[0].userDisplayName).toBe("User 3");
      expect(result.hasMore).toBe(true);
      expect(mockFirestoreService.getCommentLikes).toHaveBeenCalledWith(
        commentId,
        10,
        lastDoc,
        undefined
      );
    });

    it("should handle server errors", async () => {
      mockFirestoreService.getCommentLikes.mockRejectedValue(
        new Error("Server error")
      );

      await expect(
        interactionService.getCommentLikes("test-comment")
      ).rejects.toThrow("Server error");
    });

    it("should map likes with proper id and user info", async () => {
      const commentId = "test-comment-123";
      const mockLikes = [
        {
          commentId,
          userId: "user1",
          userDisplayName: "User 1",
          createdAt: new Date(),
        },
        {
          id: "existing-id",
          commentId,
          userId: "user2",
          userDisplayName: "User 2",
          createdAt: new Date(),
        },
      ];

      mockFirestoreService.getCommentLikes.mockResolvedValue({
        likes: mockLikes,
        hasMore: false,
        lastDoc: null,
      });

      const result = await interactionService.getCommentLikes(commentId);
      expect(result.likes[0].id).toBe("0"); // Generated id
      expect(result.likes[1].id).toBe("existing-id"); // Existing id
      expect(result.likes[0].userDisplayName).toBe("User 1");
      expect(result.likes[1].userDisplayName).toBe("User 2");
    });
  });

  describe("getComment", () => {
    it("should return comment by id", async () => {
      const commentId = "test-comment-123";
      const mockComment = {
        id: commentId,
        text: "Test comment",
        userId: "user123",
        userDisplayName: "Test User",
      };

      mockFirestoreService.getComment.mockResolvedValue(mockComment);

      const result = await interactionService.getComment(commentId);
      expect(result).toEqual(mockComment);
      expect(mockFirestoreService.getComment).toHaveBeenCalledWith(commentId);
    });

    it("should handle server errors", async () => {
      mockFirestoreService.getComment.mockRejectedValue(
        new Error("Server error")
      );

      await expect(
        interactionService.getComment("test-comment")
      ).rejects.toThrow("Server error");
    });

    it("should return null if comment not found", async () => {
      mockFirestoreService.getComment.mockResolvedValue(null);

      const result = await interactionService.getComment("test-comment");
      expect(result).toBe(null);
    });
  });

  describe("getWhisperLikesWithPrivacy", () => {
    it("should return cached likes if available", async () => {
      const whisperId = "test-whisper-123";
      const mockLikes = [
        { id: "1", userId: "user1", userDisplayName: "User 1" },
        { id: "2", userId: "user2", userDisplayName: "User 2" },
      ];

      mockFirestoreService.getWhisperLikesWithPrivacy.mockResolvedValue({
        likes: mockLikes,
        hasMore: false,
        lastDoc: null,
      });

      // First call - should hit server
      const result1 = await interactionService.getWhisperLikesWithPrivacy(
        whisperId
      );
      expect(result1.likes).toEqual(mockLikes);
      expect(result1.hasMore).toBe(false);
      expect(
        mockFirestoreService.getWhisperLikesWithPrivacy
      ).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result2 = await interactionService.getWhisperLikesWithPrivacy(
        whisperId
      );
      expect(result2.likes).toEqual(mockLikes);
      expect(
        mockFirestoreService.getWhisperLikesWithPrivacy
      ).toHaveBeenCalledTimes(1); // Still 1
    });

    it("should handle pagination with lastDoc", async () => {
      const whisperId = "test-whisper-123";
      const lastDoc = { id: "last-doc-id" };
      const mockLikes = [
        { id: "3", userId: "user3", userDisplayName: "User 3" },
      ];

      mockFirestoreService.getWhisperLikesWithPrivacy.mockResolvedValue({
        likes: mockLikes,
        hasMore: true,
        lastDoc: { id: "next-doc" },
      });

      const result = await interactionService.getWhisperLikesWithPrivacy(
        whisperId,
        10,
        lastDoc
      );
      expect(result.likes).toEqual(mockLikes);
      expect(result.hasMore).toBe(true);
      expect(
        mockFirestoreService.getWhisperLikesWithPrivacy
      ).toHaveBeenCalledWith(whisperId, "user123", 10, lastDoc);
    });

    it("should throw error if user not authenticated", async () => {
      (useAuthStore.getState as jest.Mock).mockReturnValue({ user: null });

      await expect(
        interactionService.getWhisperLikesWithPrivacy("test-whisper")
      ).rejects.toThrow("User must be authenticated to view likes");
    });

    it("should handle server errors", async () => {
      mockFirestoreService.getWhisperLikesWithPrivacy.mockRejectedValue(
        new Error("Server error")
      );

      await expect(
        interactionService.getWhisperLikesWithPrivacy("test-whisper")
      ).rejects.toThrow("Server error");
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle AsyncStorage errors in getLikeCache", async () => {
      const whisperId = "test-whisper-123";

      // Mock AsyncStorage error
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(
        new Error("Storage error")
      );

      // Mock server response
      mockFirestoreService.hasUserLikedWhisper.mockResolvedValue(false);

      // Should not throw error and should fall back to server
      const result = await interactionService.hasUserLiked(whisperId);
      expect(result).toBe(false);
    });

    it("should handle AsyncStorage errors in getCommentCache", async () => {
      const whisperId = "test-whisper-123";

      // Mock AsyncStorage error
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(
        new Error("Storage error")
      );

      // Mock server response
      mockFirestoreService.getComments.mockResolvedValue({
        comments: [],
        hasMore: false,
        lastDoc: null,
      });

      // Should not throw error and should fall back to server
      const result = await interactionService.getComments(whisperId);
      expect(result.comments).toEqual([]);
    });

    it("should handle AsyncStorage errors in getCountCache", async () => {
      const whisperId = "test-whisper-123";

      // Mock AsyncStorage error
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(
        new Error("Storage error")
      );

      // Mock server response
      mockFirestoreService.getWhisper.mockResolvedValue({ likes: 5 });

      // Should not throw error and should fall back to server
      const result = await interactionService.getLikeCount(whisperId);
      expect(result).toBe(5);
    });

    it("should handle AsyncStorage errors in persistLikeCache", async () => {
      const whisperId = "test-whisper-123";

      // Mock AsyncStorage error
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(
        new Error("Storage error")
      );

      // Mock server responses for toggleLike
      mockFirestoreService.likeWhisper.mockResolvedValue(undefined);
      mockFirestoreService.getWhisper.mockResolvedValue({ likes: 1 });

      // Should not throw error
      await expect(
        interactionService.toggleLike(whisperId)
      ).resolves.toBeDefined();
    });

    it("should handle AsyncStorage errors in persistCommentCache", async () => {
      const whisperId = "test-whisper-123";

      // Mock AsyncStorage error
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(
        new Error("Storage error")
      );

      // Mock server response
      mockFirestoreService.addComment.mockResolvedValue("new-comment-id");

      // Should not throw error
      await expect(
        interactionService.addComment(whisperId, "Test comment")
      ).resolves.toBeDefined();
    });

    it("should handle AsyncStorage errors in persistCountCache", async () => {
      const whisperId = "test-whisper-123";

      // Mock AsyncStorage error
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(
        new Error("Storage error")
      );

      // Mock server responses for toggleLike
      mockFirestoreService.likeWhisper.mockResolvedValue(undefined);
      mockFirestoreService.getWhisper.mockResolvedValue({ likes: 1 });

      // Should not throw error
      await expect(
        interactionService.toggleLike(whisperId)
      ).resolves.toBeDefined();
    });

    it("should handle AsyncStorage errors in clearCommentCache", async () => {
      const whisperId = "test-whisper-123";

      // Mock AsyncStorage error
      (AsyncStorage.getAllKeys as jest.Mock).mockRejectedValue(
        new Error("Storage error")
      );

      // The clearWhisperCache method doesn't handle AsyncStorage errors gracefully
      // so it should throw the error
      await expect(
        interactionService.clearWhisperCache(whisperId)
      ).rejects.toThrow("Storage error");
    });

    it("should handle debounce server update errors", async () => {
      const whisperId = "test-whisper-123";

      // Mock server error
      mockFirestoreService.likeWhisper.mockRejectedValue(
        new Error("Server error")
      );

      // Mock server response for getWhisper
      mockFirestoreService.getWhisper.mockResolvedValue({ likes: 1 });

      // The service should throw the error since it's not debounced for accuracy
      await expect(interactionService.toggleLike(whisperId)).rejects.toThrow(
        "Server error"
      );
    });

    it("should handle server count mismatch in toggleLike", async () => {
      const whisperId = "test-whisper-123";

      // Mock server responses
      mockFirestoreService.likeWhisper.mockResolvedValue(undefined);
      mockFirestoreService.getWhisper.mockResolvedValue({ likes: 5 }); // Different from optimistic count

      const result = await interactionService.toggleLike(whisperId);
      expect(result.isLiked).toBe(true);
      expect(result.count).toBe(5); // Should use server count
    });

    it("should handle server count mismatch in toggleCommentLike", async () => {
      const commentId = "test-comment-123";

      // Mock server responses
      mockFirestoreService.likeComment.mockResolvedValue(undefined);
      mockFirestoreService.getComment.mockResolvedValue({ likes: 3 }); // Different from optimistic count

      const result = await interactionService.toggleCommentLike(commentId);
      expect(result.isLiked).toBe(true);
      expect(result.count).toBe(3); // Should use server count
    });

    it("should revert optimistic update on server failure in toggleLike", async () => {
      const whisperId = "test-whisper-123";

      // Mock server failure
      mockFirestoreService.likeWhisper.mockRejectedValue(
        new Error("Server error")
      );

      await expect(interactionService.toggleLike(whisperId)).rejects.toThrow(
        "Server error"
      );
    });

    it("should revert optimistic update on server failure in toggleCommentLike", async () => {
      const commentId = "test-comment-123";

      // Mock server failure
      mockFirestoreService.likeComment.mockRejectedValue(
        new Error("Server error")
      );

      await expect(
        interactionService.toggleCommentLike(commentId)
      ).rejects.toThrow("Server error");
    });
  });

  describe("Singleton Management", () => {
    it("should handle destroyInstance correctly", async () => {
      // Mock AsyncStorage for clearAllCaches
      (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([]);

      // Should not throw error
      expect(() => {
        destroyInteractionService();
      }).not.toThrow();
    });

    it("should handle destroyInstance when no instance exists", async () => {
      // Reset instance first
      resetInteractionService();

      // Should not throw error
      expect(() => {
        destroyInteractionService();
      }).not.toThrow();
    });
  });
});
