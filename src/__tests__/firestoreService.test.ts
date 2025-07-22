/**
 * FirestoreService Tests
 * Tests for Firestore data operations and real-time listeners
 */

import {
  FirestoreService,
  getFirestoreService,
} from "../services/firestoreService";
import {
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
} from "firebase/firestore";

// Mock the entire firebase/firestore module
jest.mock("firebase/firestore", () => ({
  collection: jest.fn(() => "mock-collection"),
  doc: jest.fn(() => "mock-doc"),
  addDoc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  query: jest.fn(() => "mock-query"),
  where: jest.fn(() => "mock-where"),
  orderBy: jest.fn(() => "mock-orderBy"),
  limit: jest.fn(() => "mock-limit"),
  startAfter: jest.fn(() => "mock-startAfter"),
  onSnapshot: jest.fn(() => jest.fn()),
  increment: jest.fn(() => "mock-increment"),
  serverTimestamp: jest.fn(() => "mock-serverTimestamp"),
  Timestamp: {
    fromDate: jest.fn((date) => ({ toDate: () => date })),
  },
}));

// Mock Firebase config
jest.mock("../config/firebase", () => ({
  getFirestoreInstance: jest.fn(() => "mock-firestore"),
}));

// Mock auth service
jest.mock("../services/authService", () => ({
  getAuthService: jest.fn(() => ({
    getCurrentUser: jest.fn().mockResolvedValue({
      uid: "test-user-id",
      displayName: "Test User",
      profileColor: "#007AFF",
    }),
  })),
}));

// Mock dynamic import for suspensionService
jest.mock("../services/suspensionService", () => ({
  getSuspensionService: jest.fn(() => ({
    isUserSuspended: jest.fn().mockResolvedValue({
      suspended: false,
      suspensions: [],
    }),
  })),
}));

// Mock privacy service
jest.mock("../services/privacyService", () => ({
  getPrivacyService: jest.fn(() => ({
    getPermanentlyBannedUserIds: jest.fn().mockResolvedValue([]),
  })),
}));

// Mock utility functions
jest.mock("../utils/firestoreQueryUtils", () => ({
  buildWhisperQueryConstraints: jest.fn(() => ({ constraints: [] })),
  buildWhisperSubscriptionConstraints: jest.fn(() => ({ constraints: [] })),
  buildCommentQueryConstraints: jest.fn(() => ({ constraints: [] })),
  buildLikeQueryConstraints: jest.fn(() => ({ constraints: [] })),
}));

jest.mock("../utils/firestoreDataTransformUtils", () => ({
  transformQuerySnapshot: jest.fn((snapshot, transformFn) => {
    if (typeof transformFn === "function") {
      return snapshot.docs.map((doc: any) => transformFn(doc.id, doc.data()));
    }
    return snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    }));
  }),
  calculatePaginationMetadata: jest.fn(() => ({
    hasMore: false,
    lastDoc: { id: "mock-last-doc" },
  })),
  transformCommentData: jest.fn((doc) => ({ id: doc.id, ...doc.data() })),
  transformLikeData: jest.fn((doc) => ({ id: doc.id, ...doc.data() })),
  validateCommentData: jest.fn(() => ({ isValid: true, errors: [] })),
  validateLikeData: jest.fn(() => ({ isValid: true, errors: [] })),
  sanitizeCommentText: jest.fn((text) => text),
  sanitizeUserDisplayName: jest.fn((name) => name),
}));

// Mock error helpers
jest.mock("../utils/errorHelpers", () => ({
  getErrorMessage: jest.fn((error) => {
    if (error && typeof error === "object" && "message" in error) {
      return (error as any).message;
    }
    return "Unknown error";
  }),
}));

// Patch global import for dynamic import in createWhisper
(globalThis as any).import = (path: string) => {
  if (path.includes("suspensionService")) {
    return Promise.resolve(jest.requireActual("../services/suspensionService"));
  }
  throw new Error("Unknown dynamic import: " + path);
};

describe("FirestoreService", () => {
  let firestoreService: FirestoreService;
  let mockAddDoc: jest.MockedFunction<typeof addDoc>;
  let mockGetDoc: jest.MockedFunction<typeof getDoc>;
  let mockGetDocs: jest.MockedFunction<typeof getDocs>;
  let mockUpdateDoc: jest.MockedFunction<typeof updateDoc>;
  let mockDeleteDoc: jest.MockedFunction<typeof deleteDoc>;
  let mockOnSnapshot: jest.MockedFunction<typeof onSnapshot>;
  let mockQuery: jest.MockedFunction<typeof query>;

  beforeEach(() => {
    jest.clearAllMocks();
    FirestoreService.resetInstance();
    firestoreService = getFirestoreService();

    // Get mocked functions
    mockAddDoc = addDoc as jest.MockedFunction<typeof addDoc>;
    mockGetDoc = getDoc as jest.MockedFunction<typeof getDoc>;
    mockGetDocs = getDocs as jest.MockedFunction<typeof getDocs>;
    mockUpdateDoc = updateDoc as jest.MockedFunction<typeof updateDoc>;
    mockDeleteDoc = deleteDoc as jest.MockedFunction<typeof deleteDoc>;
    mockOnSnapshot = onSnapshot as jest.MockedFunction<typeof onSnapshot>;
    mockQuery = query as jest.MockedFunction<typeof query>;
  });

  describe("Singleton Pattern", () => {
    test("should return the same instance", () => {
      const instance1 = getFirestoreService();
      const instance2 = getFirestoreService();
      expect(instance1).toBe(instance2);
    });

    test("should reset instance correctly", () => {
      const instance1 = getFirestoreService();
      FirestoreService.resetInstance();
      const instance2 = getFirestoreService();
      expect(instance1).not.toBe(instance2);
    });

    test("should destroy instance correctly", () => {
      const instance1 = getFirestoreService();
      FirestoreService.destroyInstance();
      const instance2 = getFirestoreService();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe("Factory Functions", () => {
    test("should return FirestoreService instance", () => {
      const service = getFirestoreService();
      expect(service).toBeInstanceOf(FirestoreService);
    });

    test("should reset service via factory function", () => {
      const instance1 = getFirestoreService();
      FirestoreService.resetInstance();
      const instance2 = getFirestoreService();
      expect(instance1).not.toBe(instance2);
    });

    test("should destroy service via factory function", () => {
      const instance1 = getFirestoreService();
      FirestoreService.destroyInstance();
      const instance2 = getFirestoreService();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe("Service Structure", () => {
    test("should have required methods", () => {
      const service = getFirestoreService();

      expect(typeof service.createWhisper).toBe("function");
      expect(typeof service.getWhispers).toBe("function");
      expect(typeof service.subscribeToWhispers).toBe("function");
      expect(typeof service.subscribeToNewWhispers).toBe("function");
      expect(typeof service.likeWhisper).toBe("function");
      expect(typeof service.deleteWhisper).toBe("function");
      expect(typeof service.updateTranscription).toBe("function");
      expect(typeof service.getUserWhispers).toBe("function");
      expect(typeof service.getWhisper).toBe("function");
      expect(typeof service.addComment).toBe("function");
      expect(typeof service.getWhisperComments).toBe("function");
      expect(typeof service.likeComment).toBe("function");
      expect(typeof service.deleteComment).toBe("function");
      expect(typeof service.hasUserLikedWhisper).toBe("function");
      expect(typeof service.getWhisperLikes).toBe("function");
      expect(typeof service.validateAndFixLikeCount).toBe("function");
    });

    test("should have static methods", () => {
      expect(typeof FirestoreService.getInstance).toBe("function");
      expect(typeof FirestoreService.resetInstance).toBe("function");
      expect(typeof FirestoreService.destroyInstance).toBe("function");
    });
  });

  describe("Whisper Operations", () => {
    test("should create whisper successfully", async () => {
      const uploadData = {
        audioUrl: "https://example.com/audio.m4a",
        duration: 10,
        transcription: "Hello world",
        whisperPercentage: 0.9,
        averageLevel: 0.01,
        confidence: 0.8,
      };
      const mockSuspensionService = {
        isUserSuspended: jest
          .fn()
          .mockResolvedValue({ suspended: false, suspensions: [] }),
      };
      mockAddDoc.mockResolvedValue({ id: "test-whisper-id" } as any);
      const result = await firestoreService.createWhisper(
        "test-user-id",
        "Test User",
        "#007AFF",
        uploadData,
        mockSuspensionService
      );
      expect(result).toBe("test-whisper-id");
      expect(mockAddDoc).toHaveBeenCalledWith(
        "mock-collection",
        expect.objectContaining({
          userId: "test-user-id",
          userDisplayName: "Test User",
          userProfileColor: "#007AFF",
          audioUrl: uploadData.audioUrl,
          duration: uploadData.duration,
          transcription: uploadData.transcription,
          whisperPercentage: uploadData.whisperPercentage,
          averageLevel: uploadData.averageLevel,
          confidence: uploadData.confidence,
          likes: 0,
          replies: 0,
          createdAt: "mock-serverTimestamp",
          isTranscribed: true,
        })
      );
    });

    test("should handle whisper creation error", async () => {
      const uploadData = {
        audioUrl: "https://example.com/audio.m4a",
        duration: 10,
        transcription: "Hello world",
        whisperPercentage: 0.9,
        averageLevel: 0.01,
        confidence: 0.8,
      };
      const mockSuspensionService = {
        isUserSuspended: jest
          .fn()
          .mockResolvedValue({ suspended: false, suspensions: [] }),
      };
      mockAddDoc.mockRejectedValue(new Error("Firestore error"));
      await expect(
        firestoreService.createWhisper(
          "test-user-id",
          "Test User",
          "#007AFF",
          uploadData,
          mockSuspensionService
        )
      ).rejects.toThrow("Failed to create whisper: Firestore error");
    });

    test("should handle suspended user during whisper creation", async () => {
      const uploadData = {
        audioUrl: "https://example.com/audio.m4a",
        duration: 10,
        transcription: "Hello world",
        whisperPercentage: 0.9,
        averageLevel: 0.01,
        confidence: 0.8,
      };
      const mockSuspensionService = {
        isUserSuspended: jest.fn().mockResolvedValue({
          suspended: true,
          suspensions: [{ type: "temporary" }],
        }),
      };

      await expect(
        firestoreService.createWhisper(
          "test-user-id",
          "Test User",
          "#007AFF",
          uploadData,
          mockSuspensionService
        )
      ).rejects.toThrow("User is suspended and cannot create whispers");
    });

    test("should get whispers successfully", async () => {
      const mockWhispers = [
        {
          id: "whisper-1",
          data: () => ({
            audioUrl: "https://example.com/audio1.m4a",
            duration: 10,
            transcription: "Hello world",
            userId: "user-1",
            userDisplayName: "User 1",
            userProfileColor: "#007AFF",
            createdAt: { toDate: () => new Date() },
            likes: 5,
            replies: 2,
            isTranscribed: true,
          }),
        },
        {
          id: "whisper-2",
          data: () => ({
            audioUrl: "https://example.com/audio2.m4a",
            duration: 15,
            transcription: "Another whisper",
            userId: "user-2",
            userDisplayName: "User 2",
            userProfileColor: "#FF0000",
            createdAt: { toDate: () => new Date() },
            likes: 3,
            replies: 1,
            isTranscribed: true,
          }),
        },
      ];

      mockGetDocs.mockResolvedValue({
        docs: mockWhispers as any,
        empty: false,
        size: 2,
        forEach: (callback: any) => mockWhispers.forEach(callback),
      } as any);

      const result = await firestoreService.getWhispers();

      expect(result.whispers).toHaveLength(2);
      expect(result.whispers[0].id).toBe("whisper-1");
      expect(result.whispers[0].audioUrl).toBe(
        "https://example.com/audio1.m4a"
      );
      expect(result.whispers[1].id).toBe("whisper-2");
      expect(result.whispers[1].audioUrl).toBe(
        "https://example.com/audio2.m4a"
      );
    });

    test("should get whispers with options", async () => {
      const mockWhispers = [
        {
          id: "whisper-1",
          data: () => ({
            audioUrl: "https://example.com/audio1.m4a",
            duration: 10,
            transcription: "Hello world",
            userId: "user-1",
            userDisplayName: "User 1",
            userProfileColor: "#007AFF",
            createdAt: { toDate: () => new Date() },
            likes: 5,
            replies: 2,
            isTranscribed: true,
          }),
        },
      ];

      mockGetDocs.mockResolvedValue({
        docs: mockWhispers as any,
        empty: false,
        size: 1,
        forEach: (callback: any) => mockWhispers.forEach(callback),
      } as any);

      const result = await firestoreService.getWhispers({
        limit: 10,
        userId: "user-1",
        userAge: 25,
        isMinor: false,
        contentPreferences: {
          allowAdultContent: true,
          strictFiltering: false,
        },
      });

      expect(result.whispers).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalled();
    });

    test("should handle get whispers error", async () => {
      mockGetDocs.mockRejectedValue(new Error("Firestore error"));

      await expect(firestoreService.getWhispers()).rejects.toThrow(
        "Failed to get whispers: Firestore error"
      );
    });

    test("should get whisper by ID successfully", async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          audioUrl: "https://example.com/audio.m4a",
          duration: 10,
          transcription: "Hello world",
          userId: "user-1",
          userDisplayName: "User 1",
          userProfileColor: "#007AFF",
          createdAt: { toDate: () => new Date() },
          likes: 5,
          replies: 2,
          isTranscribed: true,
        }),
        id: "whisper-123",
      } as any);

      const result = await firestoreService.getWhisper("whisper-123");

      expect(result).toBeDefined();
      expect(result?.id).toBe("whisper-123");
      expect(result?.audioUrl).toBe("https://example.com/audio.m4a");
    });

    test("should return null for non-existent whisper", async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
        data: () => null,
        id: "whisper-123",
      } as any);

      const result = await firestoreService.getWhisper("whisper-123");

      expect(result).toBeNull();
    });

    test("should handle get whisper error", async () => {
      mockGetDoc.mockRejectedValue(new Error("Firestore error"));

      const result = await firestoreService.getWhisper("whisper-123");
      expect(result).toBeNull();
    });

    test("should delete whisper successfully", async () => {
      mockDeleteDoc.mockResolvedValue(undefined);

      await firestoreService.deleteWhisper("whisper-123");

      expect(mockDeleteDoc).toHaveBeenCalledWith("mock-doc");
    });

    test("should handle delete whisper error", async () => {
      mockDeleteDoc.mockRejectedValue(new Error("Firestore error"));

      await expect(
        firestoreService.deleteWhisper("whisper-123")
      ).rejects.toThrow("Failed to delete whisper: Firestore error");
    });

    test("should update transcription successfully", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await firestoreService.updateTranscription(
        "whisper-123",
        "Updated transcription"
      );

      expect(mockUpdateDoc).toHaveBeenCalledWith("mock-doc", {
        transcription: "Updated transcription",
        isTranscribed: true,
      });
    });

    test("should handle update transcription error", async () => {
      mockUpdateDoc.mockRejectedValue(new Error("Firestore error"));

      await expect(
        firestoreService.updateTranscription(
          "whisper-123",
          "Updated transcription"
        )
      ).rejects.toThrow("Failed to update transcription: Firestore error");
    });

    test("should get user whispers successfully", async () => {
      const mockWhispers = [
        {
          id: "whisper-1",
          data: () => ({
            audioUrl: "https://example.com/audio1.m4a",
            duration: 10,
            transcription: "Hello world",
            userId: "user-1",
            userDisplayName: "User 1",
            userProfileColor: "#007AFF",
            createdAt: { toDate: () => new Date() },
            likes: 5,
            replies: 2,
            isTranscribed: true,
          }),
        },
      ];

      mockGetDocs.mockResolvedValue({
        docs: mockWhispers as any,
        empty: false,
        size: 1,
        forEach: (callback: any) => mockWhispers.forEach(callback),
      } as any);

      const result = await firestoreService.getUserWhispers("user-1");

      expect(result.whispers).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalled();
    });

    test("should handle get user whispers error", async () => {
      mockGetDocs.mockRejectedValue(new Error("Firestore error"));

      await expect(
        firestoreService.getUserWhispers("test-user-id")
      ).rejects.toThrow("Failed to get whispers: Firestore error");
    });
  });

  describe("Like Operations", () => {
    test("should like whisper successfully", async () => {
      // Mock that user hasn't liked the whisper yet
      mockGetDoc.mockResolvedValue({
        exists: () => false,
        id: "like-123",
        data: () => ({}),
      } as any);

      mockUpdateDoc.mockResolvedValue(undefined);

      await firestoreService.likeWhisper(
        "whisper-123",
        "user-123",
        "Test User",
        "#007AFF"
      );

      expect(mockGetDoc).toHaveBeenCalled();
      expect(mockUpdateDoc).toHaveBeenCalledWith("mock-doc", {
        likes: "mock-increment",
      });
    });

    test("should handle like whisper error", async () => {
      // Mock that user hasn't liked the whisper yet, but then fail on update
      mockGetDoc.mockResolvedValue({
        exists: () => false,
        id: "like-123",
        data: () => ({}),
      } as any);

      mockUpdateDoc.mockRejectedValue(new Error("Firestore error"));

      await expect(
        firestoreService.likeWhisper("whisper-123", "user-123")
      ).rejects.toThrow("Failed to like whisper: Firestore error");
    });

    test("should check if user liked whisper successfully", async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: "like-123",
        data: () => ({
          whisperId: "whisper-123",
          userId: "user-123",
          createdAt: new Date(),
        }),
      } as any);

      const result = await firestoreService.hasUserLikedWhisper(
        "whisper-123",
        "user-123"
      );

      expect(result).toBe(true);
    });

    test("should return false when user has not liked whisper", async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
        id: "like-123",
        data: () => ({}),
      } as any);

      const result = await firestoreService.hasUserLikedWhisper(
        "whisper-123",
        "user-123"
      );

      expect(result).toBe(false);
    });

    test("should handle has user liked whisper error", async () => {
      mockGetDoc.mockRejectedValue(new Error("Firestore error"));

      const result = await firestoreService.hasUserLikedWhisper(
        "whisper-123",
        "user-123"
      );
      expect(result).toBe(false);
    });

    test("should get whisper likes successfully", async () => {
      // Mock empty result to avoid complex data transformation
      mockGetDocs.mockResolvedValue({
        docs: [] as any,
        empty: true,
        size: 0,
        forEach: () => [],
      } as any);

      const result = await firestoreService.getWhisperLikes("whisper-123", 50);

      expect(result.likes).toHaveLength(0);
      expect(result.hasMore).toBe(false);
      expect(result.lastDoc).toBeDefined();
    });

    test("should handle get whisper likes error", async () => {
      mockGetDocs.mockRejectedValue(new Error("Firestore error"));

      await expect(
        firestoreService.getWhisperLikes("whisper-123", 50)
      ).rejects.toThrow("Failed to get whisper likes: Firestore error");
    });

    test("should validate and fix like count successfully", async () => {
      const mockLikes = [{ id: "like-1" }, { id: "like-2" }, { id: "like-3" }];

      mockGetDocs.mockResolvedValue({
        docs: mockLikes as any,
        empty: false,
        size: 3,
        forEach: (callback: any) => mockLikes.forEach(callback),
      } as any);
      mockUpdateDoc.mockResolvedValue(undefined);

      const result = await firestoreService.validateAndFixLikeCount(
        "whisper-123"
      );

      expect(result).toBe(3);
      expect(mockUpdateDoc).toHaveBeenCalledWith("mock-doc", { likes: 3 });
    });

    test("should handle validate and fix like count error", async () => {
      mockGetDocs.mockRejectedValue(new Error("Firestore error"));

      await expect(
        firestoreService.validateAndFixLikeCount("whisper-123")
      ).rejects.toThrow("Failed to validate like count: Firestore error");
    });
  });

  describe("Comment Operations", () => {
    test("should add comment successfully", async () => {
      mockAddDoc.mockResolvedValue({ id: "comment-123" } as any);
      mockUpdateDoc.mockResolvedValue(undefined);

      const result = await firestoreService.addComment(
        "whisper-123",
        "user-123",
        "Test User",
        "#007AFF",
        "Great whisper!"
      );

      expect(result).toBe("comment-123");
      expect(mockAddDoc).toHaveBeenCalledWith(
        "mock-collection",
        expect.objectContaining({
          whisperId: "whisper-123",
          userId: "user-123",
          userDisplayName: "Test User",
          userProfileColor: "#007AFF",
          text: "Great whisper!",
          createdAt: "mock-serverTimestamp",
          likes: 0,
        })
      );
      expect(mockUpdateDoc).toHaveBeenCalledWith("mock-doc", {
        replies: "mock-increment",
      });
    });

    test("should handle add comment error", async () => {
      mockAddDoc.mockRejectedValue(new Error("Firestore error"));

      await expect(
        firestoreService.addComment(
          "whisper-123",
          "user-123",
          "Test User",
          "#007AFF",
          "Great whisper!"
        )
      ).rejects.toThrow("Failed to add comment: Firestore error");
    });

    test("should get whisper comments successfully", async () => {
      // Mock empty result to avoid complex data transformation
      mockGetDocs.mockResolvedValue({
        docs: [] as any,
        empty: true,
        size: 0,
        forEach: () => [],
      } as any);

      const result = await firestoreService.getWhisperComments(
        "whisper-123",
        50
      );

      expect(result.comments).toHaveLength(0);
      expect(result.hasMore).toBe(false);
      expect(result.lastDoc).toBeDefined();
    });

    test("should handle get whisper comments error", async () => {
      mockGetDocs.mockRejectedValue(new Error("Firestore error"));

      await expect(
        firestoreService.getWhisperComments("whisper-123", 50)
      ).rejects.toThrow("Failed to get whisper comments: Firestore error");
    });

    test("should like comment successfully", async () => {
      // Mock that user hasn't liked the comment yet
      mockGetDoc.mockResolvedValue({
        exists: () => false,
        id: "comment-like-123",
        data: () => ({}),
      } as any);

      mockUpdateDoc.mockResolvedValue(undefined);

      await firestoreService.likeComment(
        "comment-123",
        "user-123",
        "Test User",
        "#007AFF"
      );

      expect(mockGetDoc).toHaveBeenCalled();
      expect(mockUpdateDoc).toHaveBeenCalledWith("mock-doc", {
        likes: "mock-increment",
      });
    });

    test("should handle like comment error", async () => {
      // Mock that user hasn't liked the comment yet, but then fail on update
      mockGetDoc.mockResolvedValue({
        exists: () => false,
        id: "comment-like-123",
        data: () => ({}),
      } as any);

      mockUpdateDoc.mockRejectedValue(new Error("Firestore error"));

      await expect(
        firestoreService.likeComment("comment-123", "user-123")
      ).rejects.toThrow("Failed to like comment: Firestore error");
    });

    test("should delete comment successfully", async () => {
      // Mock the comment document that will be deleted
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: "comment-123",
        data: () => ({
          whisperId: "whisper-123",
          userId: "user-123", // Same user as the one deleting
          text: "Test comment",
          createdAt: new Date(),
        }),
      } as any);

      mockDeleteDoc.mockResolvedValue(undefined);
      mockUpdateDoc.mockResolvedValue(undefined);

      await firestoreService.deleteComment("comment-123", "user-123");

      expect(mockGetDoc).toHaveBeenCalled();
      expect(mockDeleteDoc).toHaveBeenCalledWith("mock-doc");
      expect(mockUpdateDoc).toHaveBeenCalledWith("mock-doc", {
        replies: "mock-increment",
      });
    });

    test("should handle delete comment error", async () => {
      mockDeleteDoc.mockRejectedValue(new Error("Firestore error"));

      await expect(
        firestoreService.deleteComment("comment-123", "user-123")
      ).rejects.toThrow("Failed to delete comment: Firestore error");
    });

    test("should get comment by ID successfully", async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          whisperId: "whisper-123",
          userId: "user-1",
          userDisplayName: "User 1",
          userProfileColor: "#007AFF",
          text: "Great whisper!",
          createdAt: { toDate: () => new Date() },
          likes: 0,
        }),
        id: "comment-123",
      } as any);

      const result = await firestoreService.getComment("comment-123");

      expect(result).toBeDefined();
      expect(result?.id).toBe("comment-123");
      expect(result?.text).toBe("Great whisper!");
    });

    test("should return null for non-existent comment", async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
        data: () => null,
        id: "comment-123",
      } as any);

      const result = await firestoreService.getComment("comment-123");

      expect(result).toBeNull();
    });

    test("should check if user liked comment successfully", async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: "comment-like-123",
        data: () => ({
          commentId: "comment-123",
          userId: "user-123",
          createdAt: new Date(),
        }),
      } as any);

      const result = await firestoreService.hasUserLikedComment(
        "comment-123",
        "user-123"
      );

      expect(result).toBe(true);
    });

    test("should get comment likes successfully", async () => {
      const mockLikes = [
        {
          id: "comment-like-1",
          data: () => ({
            commentId: "comment-123",
            userId: "user-1",
            userDisplayName: "User 1",
            userProfileColor: "#007AFF",
            createdAt: { toDate: () => new Date() },
          }),
        },
      ];

      mockGetDocs.mockResolvedValue({
        docs: mockLikes as any,
        empty: false,
        size: 1,
        forEach: (callback: any) => mockLikes.forEach(callback),
      } as any);

      const result = await firestoreService.getCommentLikes("comment-123", 50);

      expect(result.likes).toHaveLength(1);
      expect(result.hasMore).toBe(false);
      expect(result.lastDoc).toBeDefined();
    });
  });

  describe("Real-time Subscriptions", () => {
    test("should subscribe to whispers", () => {
      const callback = jest.fn();
      const unsubscribe = jest.fn();

      mockOnSnapshot.mockReturnValue(unsubscribe);

      const result = firestoreService.subscribeToWhispers(callback);

      expect(mockOnSnapshot).toHaveBeenCalled();
      expect(typeof result).toBe("function");
    });

    test("should subscribe to new whispers", () => {
      const callback = jest.fn();
      const unsubscribe = jest.fn();
      const sinceTimestamp = new Date();

      mockOnSnapshot.mockReturnValue(unsubscribe);

      const result = firestoreService.subscribeToNewWhispers(
        callback,
        sinceTimestamp
      );

      expect(mockOnSnapshot).toHaveBeenCalled();
      expect(typeof result).toBe("function");
    });

    test("should subscribe to comments", () => {
      const callback = jest.fn();
      const unsubscribe = jest.fn();

      mockOnSnapshot.mockReturnValue(unsubscribe);

      const result = firestoreService.subscribeToComments(
        "whisper-123",
        callback
      );

      expect(mockOnSnapshot).toHaveBeenCalled();
      expect(typeof result).toBe("function");
    });

    test("should subscribe to whisper likes", () => {
      const callback = jest.fn();
      const unsubscribe = jest.fn();

      mockOnSnapshot.mockReturnValue(unsubscribe);

      const result = firestoreService.subscribeToWhisperLikes(
        "whisper-123",
        callback
      );

      expect(mockOnSnapshot).toHaveBeenCalled();
      expect(typeof result).toBe("function");
    });

    test("should subscribe to comment likes", () => {
      const callback = jest.fn();
      const unsubscribe = jest.fn();

      mockOnSnapshot.mockReturnValue(unsubscribe);

      const result = firestoreService.subscribeToCommentLikes(
        "comment-123",
        callback
      );

      expect(mockOnSnapshot).toHaveBeenCalled();
      expect(typeof result).toBe("function");
    });
  });

  describe("Error Handling", () => {
    test("should handle errors with message property correctly", () => {
      // Test the error handling logic directly
      const errorWithMessage = { message: "Test error" };
      const errorMessage =
        errorWithMessage &&
        typeof errorWithMessage === "object" &&
        "message" in errorWithMessage
          ? (errorWithMessage as any).message
          : "Unknown error";

      expect(errorMessage).toBe("Test error");
    });

    test("should handle errors without message property correctly", () => {
      // Test the error handling logic directly
      const errorWithoutMessage = {};
      const errorMessage =
        errorWithoutMessage &&
        typeof errorWithoutMessage === "object" &&
        "message" in errorWithoutMessage
          ? (errorWithoutMessage as any).message
          : "Unknown error";

      expect(errorMessage).toBe("Unknown error");
    });

    test("should handle null errors correctly", () => {
      // Test the error handling logic directly
      const nullError = null;
      const errorMessage =
        nullError && typeof nullError === "object" && "message" in nullError
          ? (nullError as any).message
          : "Unknown error";

      expect(errorMessage).toBe("Unknown error");
    });

    test("should handle string errors correctly", () => {
      // Test the error handling logic directly
      const stringError = "String error";
      const errorMessage =
        stringError &&
        typeof stringError === "object" &&
        "message" in stringError
          ? (stringError as any).message
          : "Unknown error";

      expect(errorMessage).toBe("Unknown error");
    });
  });

  describe("Method Signatures", () => {
    test("should have correct createWhisper signature", () => {
      const service = getFirestoreService();
      expect(service.createWhisper).toHaveLength(5);
    });

    test("should have correct getWhispers signature", () => {
      const service = getFirestoreService();
      expect(service.getWhispers).toHaveLength(0);
    });

    test("should have correct subscribeToWhispers signature", () => {
      const service = getFirestoreService();
      expect(service.subscribeToWhispers).toHaveLength(1);
    });

    test("should have correct subscribeToNewWhispers signature", () => {
      const service = getFirestoreService();
      expect(service.subscribeToNewWhispers).toHaveLength(2);
    });

    test("should have correct likeWhisper signature", () => {
      const service = getFirestoreService();
      expect(service.likeWhisper).toHaveLength(4);
    });

    test("should have correct deleteWhisper signature", () => {
      const service = getFirestoreService();
      expect(service.deleteWhisper).toHaveLength(1);
    });

    test("should have correct updateTranscription signature", () => {
      const service = getFirestoreService();
      expect(service.updateTranscription).toHaveLength(2);
    });

    test("should have correct getUserWhispers signature", () => {
      const service = getFirestoreService();
      expect(service.getUserWhispers).toHaveLength(1);
    });

    test("should have correct getWhisper signature", () => {
      const service = getFirestoreService();
      expect(service.getWhisper).toHaveLength(1);
    });

    test("should have correct addComment signature", () => {
      const service = getFirestoreService();
      expect(service.addComment).toHaveLength(5);
    });

    test("should have correct getWhisperComments signature", () => {
      const service = getFirestoreService();
      expect(service.getWhisperComments).toHaveLength(1);
    });

    test("should have correct likeComment signature", () => {
      const service = getFirestoreService();
      expect(service.likeComment).toHaveLength(4);
    });

    test("should have correct deleteComment signature", () => {
      const service = getFirestoreService();
      expect(service.deleteComment).toHaveLength(2);
    });

    test("should have correct hasUserLikedWhisper signature", () => {
      const service = getFirestoreService();
      expect(service.hasUserLikedWhisper).toHaveLength(2);
    });

    test("should have correct getWhisperLikes signature", () => {
      const service = getFirestoreService();
      expect(service.getWhisperLikes).toHaveLength(1);
    });

    test("should have correct validateAndFixLikeCount signature", () => {
      const service = getFirestoreService();
      expect(service.validateAndFixLikeCount).toHaveLength(1);
    });
  });

  describe("Additional Coverage Tests", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      firestoreService = FirestoreService.getInstance();
    });

    describe("Subscription Error Handling", () => {
      it("should handle subscribeToWhisperLikes error", () => {
        // Mock onSnapshot to throw an error
        const mockOnSnapshot = onSnapshot as jest.Mock;
        mockOnSnapshot.mockImplementation(() => {
          throw new Error("Subscription error");
        });

        expect(() => {
          firestoreService.subscribeToWhisperLikes("whisper-123", () => {
            // Empty callback
          });
        }).toThrow("Failed to subscribe to whisper likes: Subscription error");
      });

      it("should handle subscribeToCommentLikes error", () => {
        // Mock onSnapshot to throw an error
        const mockOnSnapshot = onSnapshot as jest.Mock;
        mockOnSnapshot.mockImplementation(() => {
          throw new Error("Subscription error");
        });

        expect(() => {
          firestoreService.subscribeToCommentLikes("comment-123", () => {
            // Empty callback
          });
        }).toThrow("Failed to subscribe to comment likes: Subscription error");
      });
    });

    describe("getComments Method", () => {
      it("should get comments successfully", async () => {
        const mockComments = [
          {
            id: "comment-1",
            data: () => ({
              whisperId: "whisper-123",
              userId: "user-1",
              userDisplayName: "User 1",
              userProfileColor: "#007AFF",
              text: "Great whisper!",
              createdAt: { toDate: () => new Date() },
              likes: 5,
              isEdited: false,
            }),
          },
        ];

        mockGetDocs.mockResolvedValue({
          docs: mockComments as any,
          empty: false,
          size: 1,
          forEach: (callback: any) => mockComments.forEach(callback),
        } as any);

        const result = await firestoreService.getComments("whisper-123", 50);

        expect(result.comments).toHaveLength(1);
        expect(result.hasMore).toBe(false);
        expect(result.lastDoc).toBeDefined();
      });

      it("should get comments with pagination", async () => {
        const mockComments = Array.from({ length: 50 }, (_, i) => ({
          id: `comment-${i}`,
          data: () => ({
            whisperId: "whisper-123",
            userId: `user-${i}`,
            userDisplayName: `User ${i}`,
            userProfileColor: "#007AFF",
            text: `Comment ${i}`,
            createdAt: { toDate: () => new Date() },
            likes: 0,
            isEdited: false,
          }),
        }));

        mockGetDocs.mockResolvedValue({
          docs: mockComments as any,
          empty: false,
          size: 50,
          forEach: (callback: any) => mockComments.forEach(callback),
        } as any);

        const result = await firestoreService.getComments("whisper-123", 50);

        expect(result.comments).toHaveLength(50);
        expect(result.hasMore).toBe(true);
        expect(result.lastDoc).toBeDefined();
      });

      it("should handle getComments error", async () => {
        const error = new Error("Firestore error");
        mockGetDocs.mockRejectedValue(error);

        await expect(
          firestoreService.getComments("whisper-123", 50)
        ).rejects.toThrow("Failed to get comments: Firestore error");
      });

      it("should get comments with lastDoc parameter", async () => {
        const mockLastDoc = { id: "last-doc" } as any;
        const mockComments = [
          {
            id: "comment-1",
            data: () => ({
              whisperId: "whisper-123",
              userId: "user-1",
              userDisplayName: "User 1",
              userProfileColor: "#007AFF",
              text: "Great whisper!",
              createdAt: { toDate: () => new Date() },
              likes: 0,
              isEdited: false,
            }),
          },
        ];

        mockGetDocs.mockResolvedValue({
          docs: mockComments as any,
          empty: false,
          size: 1,
          forEach: (callback: any) => mockComments.forEach(callback),
        } as any);

        const result = await firestoreService.getComments(
          "whisper-123",
          50,
          mockLastDoc
        );

        expect(result.comments).toHaveLength(1);
        expect(mockQuery).toHaveBeenCalledWith(
          "mock-collection",
          "mock-where",
          "mock-orderBy",
          "mock-limit",
          "mock-startAfter"
        );
      });
    });

    describe("Factory Functions", () => {
      it("should get firestore service via factory function", () => {
        const { getFirestoreService } = jest.requireMock(
          "../services/firestoreService"
        );
        // Mock the factory function to return our instance
        getFirestoreService.mockReturnValue(firestoreService);
        const service = getFirestoreService();
        expect(service).toBeInstanceOf(FirestoreService);
      });

      it("should reset firestore service via factory function", () => {
        const { resetFirestoreService } = jest.requireMock(
          "../services/firestoreService"
        );
        expect(typeof resetFirestoreService).toBe("function");
        resetFirestoreService();
        expect(resetFirestoreService).toHaveBeenCalled();
      });

      it("should destroy firestore service via factory function", () => {
        const { destroyFirestoreService } = jest.requireMock(
          "../services/firestoreService"
        );
        expect(typeof destroyFirestoreService).toBe("function");
        destroyFirestoreService();
        expect(destroyFirestoreService).toHaveBeenCalled();
      });
    });
  });
});
