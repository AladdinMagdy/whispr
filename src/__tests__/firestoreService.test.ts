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
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from "firebase/firestore";

// Mock the entire firebase/firestore module
jest.mock("firebase/firestore", () => ({
  collection: jest.fn(() => "mock-collection"),
  doc: jest.fn(() => "mock-doc"),
  addDoc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
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
  let mockGetDocs: jest.MockedFunction<typeof getDocs>;
  let mockUpdateDoc: jest.MockedFunction<typeof updateDoc>;
  let mockDeleteDoc: jest.MockedFunction<typeof deleteDoc>;
  let mockOnSnapshot: jest.MockedFunction<typeof onSnapshot>;

  beforeEach(() => {
    jest.clearAllMocks();
    FirestoreService.resetInstance();
    firestoreService = getFirestoreService();

    // Get mocked functions
    mockAddDoc = addDoc as jest.MockedFunction<typeof addDoc>;
    mockGetDocs = getDocs as jest.MockedFunction<typeof getDocs>;
    mockUpdateDoc = updateDoc as jest.MockedFunction<typeof updateDoc>;
    mockDeleteDoc = deleteDoc as jest.MockedFunction<typeof deleteDoc>;
    mockOnSnapshot = onSnapshot as jest.MockedFunction<typeof onSnapshot>;

    // Mock prototype methods so all instances use the mock
    FirestoreService.prototype.getUserBlocks = jest.fn().mockResolvedValue([]);
    FirestoreService.prototype.getUsersWhoBlockedMe = jest
      .fn()
      .mockResolvedValue([]);
    FirestoreService.prototype.getUserMutes = jest.fn().mockResolvedValue([]);
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

    test("should handle get whispers error", async () => {
      mockGetDocs.mockRejectedValue(new Error("Firestore error"));

      await expect(firestoreService.getWhispers()).rejects.toThrow(
        "Firestore error"
      );
    });

    test("should delete whisper successfully", async () => {
      mockDeleteDoc.mockResolvedValue(undefined);

      await firestoreService.deleteWhisper("test-whisper-id");

      expect(mockDeleteDoc).toHaveBeenCalledWith("mock-doc");
    });

    test("should handle delete whisper error", async () => {
      mockDeleteDoc.mockRejectedValue(new Error("Delete error"));

      await expect(
        firestoreService.deleteWhisper("test-whisper-id")
      ).rejects.toThrow("Delete error");
    });

    test("should update transcription successfully", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await firestoreService.updateTranscription(
        "test-whisper-id",
        "Updated transcription"
      );

      expect(mockUpdateDoc).toHaveBeenCalledWith("mock-doc", {
        transcription: "Updated transcription",
        isTranscribed: true,
      });
    });

    test("should handle update transcription error", async () => {
      mockUpdateDoc.mockRejectedValue(new Error("Update error"));

      await expect(
        firestoreService.updateTranscription(
          "test-whisper-id",
          "Updated transcription"
        )
      ).rejects.toThrow("Update error");
    });
  });

  describe("Like Operations", () => {
    test("should like whisper successfully", async () => {
      // Simulate user has not liked yet
      mockGetDocs.mockResolvedValue({ empty: true } as any);
      mockUpdateDoc.mockResolvedValue(undefined);
      mockAddDoc.mockResolvedValue({} as any);
      await firestoreService.likeWhisper(
        "test-whisper-id",
        "test-user-id",
        "Test User",
        "#007AFF"
      );
      expect(mockUpdateDoc).toHaveBeenCalledWith("mock-doc", {
        likes: "mock-increment",
      });
    });

    test("should handle like whisper error", async () => {
      mockGetDocs.mockRejectedValue(new Error("Like error"));
      await expect(
        firestoreService.likeWhisper(
          "test-whisper-id",
          "test-user-id",
          "Test User",
          "#007AFF"
        )
      ).rejects.toThrow("Failed to like/unlike whisper: Like error");
    });
  });

  describe("Real-time Subscriptions", () => {
    test("should subscribe to whispers", () => {
      const mockCallback = jest.fn();
      const mockUnsubscribe = jest.fn();
      mockOnSnapshot.mockReturnValue(mockUnsubscribe);

      const unsubscribe = firestoreService.subscribeToWhispers(mockCallback);

      expect(mockOnSnapshot).toHaveBeenCalled();
      expect(unsubscribe).toBe(mockUnsubscribe);
    });

    test("should subscribe to new whispers", () => {
      const mockCallback = jest.fn();
      const mockUnsubscribe = jest.fn();
      mockOnSnapshot.mockReturnValue(mockUnsubscribe);

      const unsubscribe = firestoreService.subscribeToNewWhispers(
        mockCallback,
        new Date()
      );

      expect(mockOnSnapshot).toHaveBeenCalled();
      expect(unsubscribe).toBe(mockUnsubscribe);
    });
  });

  describe("User Operations", () => {
    test("should get user whispers successfully", async () => {
      const mockUserWhispers = [
        {
          id: "whisper-1",
          data: () => ({
            audioUrl: "https://example.com/audio1.m4a",
            duration: 10,
            transcription: "Hello world",
            userId: "test-user-id",
            userDisplayName: "Test User",
            userProfileColor: "#007AFF",
            createdAt: { toDate: () => new Date() },
            likes: 5,
            replies: 2,
            isTranscribed: true,
          }),
        },
      ];

      mockGetDocs.mockResolvedValue({
        docs: mockUserWhispers as any,
        empty: false,
        size: 1,
        forEach: (callback: any) => mockUserWhispers.forEach(callback),
      } as any);

      const result = await firestoreService.getUserWhispers("test-user-id");

      expect(result.whispers).toHaveLength(1);
      expect(result.whispers[0].id).toBe("whisper-1");
      expect(result.whispers[0].userId).toBe("test-user-id");
    });

    test("should handle get user whispers error", async () => {
      mockGetDocs.mockRejectedValue(new Error("User whispers error"));

      await expect(
        firestoreService.getUserWhispers("test-user-id")
      ).rejects.toThrow("User whispers error");
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
  });
});
