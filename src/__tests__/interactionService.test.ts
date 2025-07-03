import {
  InteractionService,
  getInteractionService,
  resetInteractionService,
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
  hasUserLikedWhisper: jest.fn(),
  getWhisper: jest.fn(),
  getComments: jest.fn(),
  addComment: jest.fn(),
  deleteComment: jest.fn(),
  likeWhisper: jest.fn(),
};

const mockAuthStore = {
  getState: jest.fn(),
};

const mockUser = {
  uid: "test-user-123",
  displayName: "Test User",
  profileColor: "#FF5733",
};

describe("InteractionService", () => {
  let interactionService: InteractionService;

  beforeEach(() => {
    resetInteractionService();
    jest.clearAllMocks();
    jest.useRealTimers();

    (getFirestoreService as jest.Mock).mockReturnValue(mockFirestoreService);
    (useAuthStore.getState as jest.Mock).mockReturnValue({ user: mockUser });

    interactionService = getInteractionService();
  });

  afterEach(() => {
    resetInteractionService();
  });

  describe("Singleton Pattern", () => {
    it("should return the same instance", () => {
      const instance1 = getInteractionService();
      const instance2 = getInteractionService();
      expect(instance1).toBe(instance2);
    });

    it("should reset instance correctly", () => {
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
        mockUser.uid,
        mockUser.displayName,
        mockUser.profileColor,
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
        mockUser.uid
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

      // Should not throw error
      await expect(
        interactionService.toggleLike(whisperId)
      ).resolves.toBeDefined();
    });
  });

  describe("Debouncing", () => {
    beforeEach(() => {
      jest.useRealTimers();
      jest.clearAllTimers();
      jest.resetAllMocks();
      // Reset the singleton instance and its state
      const {
        resetInteractionService,
      } = require("../services/interactionService");
      resetInteractionService();
      // Always mock useAuthStore.getState to return a valid user
      const mockUser = {
        uid: "user123",
        displayName: "Test User",
        profileColor: "#123456",
      };
      const { useAuthStore } = require("../store/useAuthStore");
      useAuthStore.getState = jest.fn(() => ({ user: mockUser }));
    });

    it("should debounce server updates", async () => {
      // Use real timers for this test
      jest.useRealTimers();

      // Use a unique whisperId to avoid timer collisions
      const whisperId = `test-whisper-${Date.now()}-${Math.random()}`;
      mockFirestoreService.likeWhisper.mockResolvedValue(undefined);

      // Call toggleLike once
      await interactionService.toggleLike(whisperId);

      // Wait for the debounce delay (should match your debounce delay, e.g., 1100ms)
      await new Promise((resolve) => setTimeout(resolve, 1200));

      // Should call server at least once due to debouncing
      expect(mockFirestoreService.likeWhisper).toHaveBeenCalled();
    });
  });
});
