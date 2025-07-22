import { WhisperService } from "../services/whisperService";
import { getFirestoreService } from "../services/firestoreService";
import { getPrivacyService } from "../services/privacyService";
import { StorageService } from "../services/storageService";
import { TranscriptionService } from "../services/transcriptionService";
import { AudioFormatTest } from "../utils/audioFormatTest";
import { Whisper } from "../types";
import { createWhisperUploadData } from "../utils/whisperCreationUtils";
import { buildWhisperQueryConstraints } from "../utils/whisperQueryUtils";

// Mock all dependencies
jest.mock("../services/firestoreService");
jest.mock("../services/privacyService");
jest.mock("../services/storageService");
jest.mock("../services/transcriptionService");
jest.mock("../utils/audioFormatTest");
jest.mock("../utils/whisperCreationUtils");
jest.mock("../utils/whisperQueryUtils");
jest.mock("../constants", () => ({
  FEATURE_FLAGS: {
    ENABLE_TRANSCRIPTION: true,
  },
  FIRESTORE_COLLECTIONS: {
    WHISPERS: "whispers",
  },
}));

// Mock Firebase Firestore
jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  addDoc: jest.fn(),
  serverTimestamp: jest.fn(() => new Date()),
  query: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  where: jest.fn(),
  startAfter: jest.fn(),
  getDocs: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  deleteDoc: jest.fn(),
  updateDoc: jest.fn(),
  onSnapshot: jest.fn(),
}));

// Mock Firebase config
jest.mock("../config/firebase", () => ({
  getFirestoreInstance: jest.fn(() => ({})),
}));

describe("WhisperService", () => {
  const mockWhisper: Whisper = {
    id: "whisper-123",
    userId: "user-123",
    userDisplayName: "Test User",
    userProfileColor: "#FF5733",
    audioUrl: "https://example.com/audio.mp3",
    duration: 30,
    whisperPercentage: 100,
    averageLevel: 0.5,
    confidence: 0.9,
    transcription: "Hello world",
    createdAt: new Date(),
    likes: 0,
    replies: 0,
    isTranscribed: true,
  };

  const mockFirestoreService = {
    createWhisper: jest.fn(),
    getWhispers: jest.fn(),
    getUserWhispers: jest.fn(),
    getWhisper: jest.fn(),
    likeWhisper: jest.fn(),
    deleteWhisper: jest.fn(),
    updateTranscription: jest.fn(),
    validateAndFixLikeCount: jest.fn(),
    getWhisperLikesWithPrivacy: jest.fn(),
    getDeletedWhisperCount: jest.fn(),
  };

  const mockPrivacyService = {
    filterWhispersForUser: jest.fn(),
    shouldShowWhisper: jest.fn(),
    getWhisperLikesWithPrivacy: jest.fn(),
    getDeletedWhisperCount: jest.fn(),
  };

  let whisperService: WhisperService;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create service instance first
    whisperService = WhisperService.getInstance();

    // Setup mocks
    (getFirestoreService as jest.Mock).mockReturnValue(mockFirestoreService);
    (getPrivacyService as jest.Mock).mockReturnValue(mockPrivacyService);

    const { getWhisperService: mockGetWhisperService } = jest.requireMock(
      "../services/whisperService"
    );
    mockGetWhisperService.mockReturnValue(whisperService);

    // Mock utility functions
    (buildWhisperQueryConstraints as jest.Mock).mockReturnValue({
      constraints: [jest.fn(), jest.fn()],
    });

    // Mock Firestore functions
    const {
      collection,
      addDoc,
      serverTimestamp,
      query,
      getDocs,
      doc,
      getDoc,
      deleteDoc,
      updateDoc,
      onSnapshot,
    } = jest.requireMock("firebase/firestore");

    collection.mockReturnValue({});
    addDoc.mockResolvedValue({ id: "whisper-123" });
    serverTimestamp.mockReturnValue(new Date());
    query.mockReturnValue({});
    getDocs.mockResolvedValue({
      docs: [
        {
          id: "whisper-1",
          data: () => mockWhisper,
        },
      ],
      empty: false,
      size: 1,
      forEach: (callback: any) =>
        callback({ id: "whisper-1", data: () => mockWhisper }),
    });
    doc.mockReturnValue({});
    getDoc.mockResolvedValue({
      exists: () => true,
      id: "whisper-123",
      data: () => mockWhisper,
    });
    deleteDoc.mockResolvedValue(undefined);
    updateDoc.mockResolvedValue(undefined);
    onSnapshot.mockReturnValue(() => {});

    // Mock other services
    (StorageService.uploadAudio as jest.Mock).mockResolvedValue(
      "https://example.com/audio.mp3"
    );
    (TranscriptionService.transcribeWithRetry as jest.Mock).mockResolvedValue(
      "Hello world"
    );
    (AudioFormatTest.logAudioInfo as jest.Mock).mockResolvedValue(undefined);
    (createWhisperUploadData as jest.Mock).mockReturnValue({
      audioUrl: "https://example.com/audio.mp3",
      duration: 30,
      whisperPercentage: 100,
      averageLevel: 0.5,
      confidence: 0.9,
      transcription: "Hello world",
    });

    // Mock FirestoreService methods
    mockFirestoreService.validateAndFixLikeCount.mockResolvedValue(10);

    // Mock PrivacyService methods
    mockPrivacyService.getWhisperLikesWithPrivacy.mockResolvedValue({
      likes: [],
      hasMore: false,
      lastDoc: null,
    });
    mockPrivacyService.getDeletedWhisperCount.mockResolvedValue(0);
  });

  describe("Singleton Pattern", () => {
    it("should return the same instance", () => {
      const instance1 = WhisperService.getInstance();
      const instance2 = WhisperService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("should reset instance correctly", () => {
      const instance1 = WhisperService.getInstance();
      WhisperService.resetInstance();
      const instance2 = WhisperService.getInstance();
      expect(instance1).not.toBe(instance2);
    });

    it("should destroy instance correctly", () => {
      const instance1 = WhisperService.getInstance();
      WhisperService.destroyInstance();
      const instance2 = WhisperService.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe("estimateTranscriptionCost", () => {
    it("should estimate cost correctly for 30 seconds", () => {
      const cost = WhisperService.estimateTranscriptionCost(30);
      expect(cost).toBe(0.003); // 0.5 minutes * $0.006
    });

    it("should estimate cost correctly for 60 seconds", () => {
      const cost = WhisperService.estimateTranscriptionCost(60);
      expect(cost).toBe(0.006); // 1 minute * $0.006
    });

    it("should estimate cost correctly for 120 seconds", () => {
      const cost = WhisperService.estimateTranscriptionCost(120);
      expect(cost).toBe(0.012); // 2 minutes * $0.006
    });

    it("should handle zero duration", () => {
      const cost = WhisperService.estimateTranscriptionCost(0);
      expect(cost).toBe(0);
    });

    it("should handle negative duration", () => {
      const cost = WhisperService.estimateTranscriptionCost(-10);
      expect(cost).toBe(-0.001); // -10/60 * 0.006
    });
  });

  describe("isTranscriptionAvailable", () => {
    it("should return transcription availability status", () => {
      const isAvailable = WhisperService.isTranscriptionAvailable();
      expect(typeof isAvailable).toBe("boolean");
    });
  });

  describe("Static likeWhisper", () => {
    it("should like whisper successfully", async () => {
      mockFirestoreService.likeWhisper.mockResolvedValue(undefined);

      await WhisperService.likeWhisper("whisper-123", "user-123");

      expect(mockFirestoreService.likeWhisper).toHaveBeenCalledWith(
        "whisper-123",
        "user-123"
      );
    });

    it("should throw error on failure", async () => {
      mockFirestoreService.likeWhisper.mockRejectedValue(
        new Error("Like failed")
      );

      await expect(
        WhisperService.likeWhisper("whisper-123", "user-123")
      ).rejects.toThrow("Failed to like whisper");
    });
  });

  describe("Instance validateAndFixLikeCount", () => {
    it("should validate and fix like count successfully", async () => {
      const count = await whisperService.validateAndFixLikeCount("whisper-123");

      expect(count).toBe(10);
      expect(mockFirestoreService.validateAndFixLikeCount).toHaveBeenCalledWith(
        "whisper-123"
      );
    });

    it("should handle validation failure", async () => {
      mockFirestoreService.validateAndFixLikeCount.mockRejectedValue(
        new Error("Validation failed")
      );

      await expect(
        whisperService.validateAndFixLikeCount("whisper-123")
      ).rejects.toThrow("Validation failed");
    });
  });

  describe("Instance getWhisperLikesWithPrivacy", () => {
    it("should get whisper likes with privacy successfully", async () => {
      const result = await whisperService.getWhisperLikesWithPrivacy(
        "whisper-123",
        "user-123"
      );

      expect(result.likes).toEqual([]);
      expect(result.hasMore).toBe(false);
      expect(result.lastDoc).toBeNull();
      expect(
        mockPrivacyService.getWhisperLikesWithPrivacy
      ).toHaveBeenCalledWith("whisper-123", "user-123", 50, undefined);
    });

    it("should get whisper likes with custom limit and lastDoc", async () => {
      const mockLastDoc = { id: "last-doc" } as any;
      const result = await whisperService.getWhisperLikesWithPrivacy(
        "whisper-123",
        "user-123",
        20,
        mockLastDoc
      );

      expect(result.likes).toEqual([]);
      expect(
        mockPrivacyService.getWhisperLikesWithPrivacy
      ).toHaveBeenCalledWith("whisper-123", "user-123", 20, mockLastDoc);
    });

    it("should handle get likes failure", async () => {
      mockPrivacyService.getWhisperLikesWithPrivacy.mockRejectedValue(
        new Error("Get likes failed")
      );

      await expect(
        whisperService.getWhisperLikesWithPrivacy("whisper-123", "user-123")
      ).rejects.toThrow("Get likes failed");
    });
  });

  describe("Instance getDeletedWhisperCount", () => {
    it("should get deleted whisper count with default days", async () => {
      const count = await whisperService.getDeletedWhisperCount("user-123");

      expect(count).toBe(0);
      expect(mockPrivacyService.getDeletedWhisperCount).toHaveBeenCalledWith(
        "user-123",
        90
      );
    });

    it("should get deleted whisper count with custom days", async () => {
      const count = await whisperService.getDeletedWhisperCount("user-123", 30);

      expect(count).toBe(0);
      expect(mockPrivacyService.getDeletedWhisperCount).toHaveBeenCalledWith(
        "user-123",
        30
      );
    });

    it("should handle get count failure", async () => {
      mockPrivacyService.getDeletedWhisperCount.mockRejectedValue(
        new Error("Get count failed")
      );

      await expect(
        whisperService.getDeletedWhisperCount("user-123")
      ).rejects.toThrow("Get count failed");
    });
  });

  describe("Factory Functions", () => {
    it("should get whisper service instance", () => {
      const { getWhisperService } = jest.requireMock(
        "../services/whisperService"
      );
      const instance = getWhisperService();
      expect(instance).toBeInstanceOf(WhisperService);
    });

    it("should reset whisper service", () => {
      const { resetWhisperService } = jest.requireMock(
        "../services/whisperService"
      );
      expect(() => resetWhisperService()).not.toThrow();
    });

    it("should destroy whisper service", () => {
      const { destroyWhisperService } = jest.requireMock(
        "../services/whisperService"
      );
      expect(() => destroyWhisperService()).not.toThrow();
    });
  });

  describe("Static methods that call instance methods", () => {
    it("should delegate getPublicWhispers to instance method", async () => {
      const mockWhispers = [mockWhisper];
      jest.spyOn(whisperService, "getWhispers").mockResolvedValue({
        whispers: mockWhispers,
        lastDoc: null,
        hasMore: false,
      });

      const result = await WhisperService.getPublicWhispers();

      expect(whisperService.getWhispers).toHaveBeenCalledWith({ limit: 20 });
      expect(result).toEqual(mockWhispers);
    });

    it("should delegate getUserWhispers to instance method", async () => {
      const mockWhispers = [mockWhisper];
      jest.spyOn(whisperService, "getUserWhispers").mockResolvedValue({
        whispers: mockWhispers,
        lastDoc: null,
        hasMore: false,
      });

      const result = await WhisperService.getUserWhispers("user-123");

      expect(whisperService.getUserWhispers).toHaveBeenCalledWith("user-123");
      expect(result).toEqual(mockWhispers);
    });

    it("should delegate getWhisper to instance method", async () => {
      jest.spyOn(whisperService, "getWhisper").mockResolvedValue(mockWhisper);

      const result = await WhisperService.getWhisper("whisper-123");

      expect(whisperService.getWhisper).toHaveBeenCalledWith("whisper-123");
      expect(result).toEqual(mockWhisper);
    });

    it("should delegate deleteWhisper to instance method", async () => {
      jest.spyOn(whisperService, "deleteWhisper").mockResolvedValue(undefined);

      await WhisperService.deleteWhisper("whisper-123");

      expect(whisperService.deleteWhisper).toHaveBeenCalledWith("whisper-123");
    });

    it("should delegate updateTranscription to instance method", async () => {
      jest
        .spyOn(whisperService, "updateTranscription")
        .mockResolvedValue(undefined);

      await WhisperService.updateTranscription("whisper-123", "New text");

      expect(whisperService.updateTranscription).toHaveBeenCalledWith(
        "whisper-123",
        "New text"
      );
    });
  });

  describe("Error handling in static methods", () => {
    it("should handle errors in getPublicWhispers", async () => {
      jest
        .spyOn(whisperService, "getWhispers")
        .mockRejectedValue(new Error("Test error"));

      await expect(WhisperService.getPublicWhispers()).rejects.toThrow(
        "Failed to get public whispers"
      );
    });

    it("should handle errors in getUserWhispers", async () => {
      jest
        .spyOn(whisperService, "getUserWhispers")
        .mockRejectedValue(new Error("Test error"));

      await expect(WhisperService.getUserWhispers("user-123")).rejects.toThrow(
        "Failed to get user whispers"
      );
    });

    it("should handle errors in getWhisper and return null", async () => {
      jest
        .spyOn(whisperService, "getWhisper")
        .mockRejectedValue(new Error("Test error"));

      const result = await WhisperService.getWhisper("whisper-123");
      expect(result).toBeNull();
    });

    it("should handle errors in deleteWhisper", async () => {
      jest
        .spyOn(whisperService, "deleteWhisper")
        .mockRejectedValue(new Error("Test error"));

      await expect(WhisperService.deleteWhisper("whisper-123")).rejects.toThrow(
        "Failed to delete whisper"
      );
    });

    it("should handle errors in updateTranscription", async () => {
      jest
        .spyOn(whisperService, "updateTranscription")
        .mockRejectedValue(new Error("Test error"));

      await expect(
        WhisperService.updateTranscription("whisper-123", "New text")
      ).rejects.toThrow("Failed to update transcription");
    });
  });

  describe("Static createWhisper", () => {
    const mockAudioRecording = {
      uri: "file://test-audio.mp3",
      duration: 30,
      volume: 0.5,
      isWhisper: true,
      timestamp: new Date(),
    };

    it("should create whisper successfully with transcription enabled", async () => {
      // Mock the instance methods that are called by the static method
      jest
        .spyOn(whisperService, "createWhisper")
        .mockResolvedValue("whisper-123");
      jest.spyOn(whisperService, "getWhisper").mockResolvedValue(mockWhisper);

      const result = await WhisperService.createWhisper(
        mockAudioRecording,
        "user-123",
        "Test User",
        "#FF5733",
        { enableTranscription: true }
      );

      expect(AudioFormatTest.logAudioInfo).toHaveBeenCalledWith(
        mockAudioRecording.uri
      );
      expect(StorageService.uploadAudio).toHaveBeenCalledWith(
        mockAudioRecording,
        "user-123"
      );
      expect(TranscriptionService.transcribeWithRetry).toHaveBeenCalledWith(
        "https://example.com/audio.mp3"
      );
      expect(createWhisperUploadData).toHaveBeenCalledWith(
        mockAudioRecording,
        "https://example.com/audio.mp3",
        undefined
      );
      expect(result.success).toBe(true);
      expect(result.whisper).toEqual(mockWhisper);
      expect(result.error).toBeUndefined();
    });

    it("should create whisper successfully with transcription disabled", async () => {
      // Mock the instance methods that are called by the static method
      jest
        .spyOn(whisperService, "createWhisper")
        .mockResolvedValue("whisper-123");
      jest.spyOn(whisperService, "getWhisper").mockResolvedValue(mockWhisper);

      const result = await WhisperService.createWhisper(
        mockAudioRecording,
        "user-123",
        "Test User",
        "#FF5733",
        { enableTranscription: false }
      );

      expect(AudioFormatTest.logAudioInfo).toHaveBeenCalledWith(
        mockAudioRecording.uri
      );
      expect(StorageService.uploadAudio).toHaveBeenCalledWith(
        mockAudioRecording,
        "user-123"
      );
      expect(TranscriptionService.transcribeWithRetry).not.toHaveBeenCalled();
      expect(createWhisperUploadData).toHaveBeenCalledWith(
        mockAudioRecording,
        "https://example.com/audio.mp3",
        undefined
      );
      expect(result.success).toBe(true);
      expect(result.whisper).toEqual(mockWhisper);
      expect(result.error).toBeUndefined();
    });

    it("should create whisper successfully with transcription failure", async () => {
      (TranscriptionService.transcribeWithRetry as jest.Mock).mockRejectedValue(
        new Error("Transcription failed")
      );

      // Mock the instance methods that are called by the static method
      jest
        .spyOn(whisperService, "createWhisper")
        .mockResolvedValue("whisper-123");
      jest.spyOn(whisperService, "getWhisper").mockResolvedValue(mockWhisper);

      const result = await WhisperService.createWhisper(
        mockAudioRecording,
        "user-123",
        "Test User",
        "#FF5733",
        { enableTranscription: true }
      );

      expect(result.success).toBe(true);
      expect(result.whisper).toEqual(mockWhisper);
      expect(result.error).toBe("Transcription failed");
    });

    it("should handle audio format test failure", async () => {
      (AudioFormatTest.logAudioInfo as jest.Mock).mockRejectedValue(
        new Error("Audio format test failed")
      );

      const result = await WhisperService.createWhisper(
        mockAudioRecording,
        "user-123",
        "Test User",
        "#FF5733"
      );

      expect(result.success).toBe(false);
      expect(result.whisper).toBeUndefined();
      expect(result.error).toBe("Audio format test failed");
    });

    it("should handle audio upload failure", async () => {
      (StorageService.uploadAudio as jest.Mock).mockRejectedValue(
        new Error("Upload failed")
      );

      const result = await WhisperService.createWhisper(
        mockAudioRecording,
        "user-123",
        "Test User",
        "#FF5733"
      );

      expect(result.success).toBe(false);
      expect(result.whisper).toBeUndefined();
      expect(result.error).toBe("Upload failed");
    });

    it("should handle whisper creation failure", async () => {
      const creationError = new Error("Whisper creation failed");
      jest
        .spyOn(whisperService, "createWhisper")
        .mockRejectedValue(creationError);

      const result = await WhisperService.createWhisper(
        mockAudioRecording,
        "user-123",
        "Test User",
        "#FF5733"
      );

      expect(result.success).toBe(false);
      expect(result.whisper).toBeUndefined();
      expect(result.error).toBe("Whisper creation failed");
    });

    it("should handle get whisper failure", async () => {
      // Mock the instance methods that are called by the static method
      jest
        .spyOn(whisperService, "createWhisper")
        .mockResolvedValue("whisper-123");
      jest.spyOn(whisperService, "getWhisper").mockResolvedValue(null);

      const result = await WhisperService.createWhisper(
        mockAudioRecording,
        "user-123",
        "Test User",
        "#FF5733"
      );

      expect(result.success).toBe(true);
      expect(result.whisper).toBeUndefined();
      expect(result.error).toBeUndefined();
    });

    it("should handle non-Error exceptions", async () => {
      (StorageService.uploadAudio as jest.Mock).mockRejectedValue(
        "String error"
      );

      const result = await WhisperService.createWhisper(
        mockAudioRecording,
        "user-123",
        "Test User",
        "#FF5733"
      );

      expect(result.success).toBe(false);
      expect(result.whisper).toBeUndefined();
      expect(result.error).toBe("Failed to create whisper");
    });

    it("should handle transcription error as string", async () => {
      (TranscriptionService.transcribeWithRetry as jest.Mock).mockRejectedValue(
        "Transcription failed"
      );

      // Mock the instance methods that are called by the static method
      jest
        .spyOn(whisperService, "createWhisper")
        .mockResolvedValue("whisper-123");
      jest.spyOn(whisperService, "getWhisper").mockResolvedValue(mockWhisper);

      const result = await WhisperService.createWhisper(
        mockAudioRecording,
        "user-123",
        "Test User",
        "#FF5733",
        { enableTranscription: true }
      );

      expect(result.success).toBe(true);
      expect(result.whisper).toEqual(mockWhisper);
      expect(result.error).toBe("Transcription failed");
    });
  });

  describe("Instance getWhispers", () => {
    beforeEach(() => {
      // Reset mocks for this describe block
      jest.clearAllMocks();

      // Re-setup mocks
      (getFirestoreService as jest.Mock).mockReturnValue(mockFirestoreService);
      (getPrivacyService as jest.Mock).mockReturnValue(mockPrivacyService);

      const {
        collection,
        addDoc,
        serverTimestamp,
        query,
        getDocs,
        doc,
        getDoc,
        deleteDoc,
        updateDoc,
        onSnapshot,
      } = jest.requireMock("firebase/firestore");

      collection.mockReturnValue({});
      addDoc.mockResolvedValue({ id: "whisper-123" });
      serverTimestamp.mockReturnValue(new Date());
      query.mockReturnValue({});
      getDocs.mockResolvedValue({
        docs: [
          {
            id: "whisper-1",
            data: () => mockWhisper,
          },
        ],
        empty: false,
        size: 1,
        forEach: (callback: any) =>
          callback({ id: "whisper-1", data: () => mockWhisper }),
      });
      doc.mockReturnValue({});
      getDoc.mockResolvedValue({
        exists: () => true,
        id: "whisper-123",
        data: () => mockWhisper,
      });
      deleteDoc.mockResolvedValue(undefined);
      updateDoc.mockResolvedValue(undefined);
      onSnapshot.mockReturnValue(() => {});

      (buildWhisperQueryConstraints as jest.Mock).mockReturnValue({
        constraints: [jest.fn(), jest.fn()],
      });

      // Reset the whisperService instance to avoid conflicts
      WhisperService.resetInstance();
      whisperService = WhisperService.getInstance();
    });

    it("should get whispers successfully with default options", async () => {
      const result = await whisperService.getWhispers();

      expect(buildWhisperQueryConstraints).toHaveBeenCalledWith({});
      expect(result.whispers).toHaveLength(1);
      expect(result.hasMore).toBe(false);
      expect(result.lastDoc).toBeDefined();
    });

    it("should get whispers with custom options", async () => {
      const options = {
        limit: 10,
        userId: "user-123",
        userAge: 25,
        isMinor: false,
        contentPreferences: {
          allowAdultContent: true,
          strictFiltering: false,
        },
        excludeBlockedUsers: true,
        excludeMutedUsers: true,
        currentUserId: "current-user-123",
      };

      const result = await whisperService.getWhispers(options);

      expect(buildWhisperQueryConstraints).toHaveBeenCalledWith(options);
      expect(result.whispers).toHaveLength(1);
    });

    it("should handle get whispers error", async () => {
      const { getDocs } = jest.requireMock("firebase/firestore");
      getDocs.mockRejectedValue(new Error("Firestore error"));

      await expect(whisperService.getWhispers()).rejects.toThrow(
        "Failed to get whispers: Firestore error"
      );
    });

    it("should handle empty query result", async () => {
      const { getDocs } = jest.requireMock("firebase/firestore");
      getDocs.mockResolvedValue({
        docs: [],
        empty: true,
        size: 0,
        forEach: () => {},
      });

      const result = await whisperService.getWhispers();

      expect(result.whispers).toHaveLength(0);
      expect(result.hasMore).toBe(false);
      expect(result.lastDoc).toBeNull();
    });

    it("should handle pagination with hasMore true", async () => {
      const { getDocs } = jest.requireMock("firebase/firestore");
      const mockDocs = Array.from({ length: 20 }, (_, i) => ({
        id: `whisper-${i}`,
        data: () => ({ ...mockWhisper, id: `whisper-${i}` }),
      }));

      getDocs.mockResolvedValue({
        docs: mockDocs,
        empty: false,
        size: 20,
        forEach: (callback: any) => mockDocs.forEach(callback),
      });

      const result = await whisperService.getWhispers({ limit: 20 });

      expect(result.whispers).toHaveLength(20);
      expect(result.hasMore).toBe(true);
      expect(result.lastDoc).toBeDefined();
    });

    it("should handle pagination with custom limit", async () => {
      const { getDocs } = jest.requireMock("firebase/firestore");
      const mockDocs = Array.from({ length: 15 }, (_, i) => ({
        id: `whisper-${i}`,
        data: () => ({ ...mockWhisper, id: `whisper-${i}` }),
      }));

      getDocs.mockResolvedValue({
        docs: mockDocs,
        empty: false,
        size: 15,
        forEach: (callback: any) => mockDocs.forEach(callback),
      });

      const result = await whisperService.getWhispers({ limit: 15 });

      expect(result.whispers).toHaveLength(15);
      expect(result.hasMore).toBe(true);
      expect(result.lastDoc).toBeDefined();
    });
  });

  describe("Instance getWhisper", () => {
    beforeEach(() => {
      // Reset mocks for this describe block
      jest.clearAllMocks();

      // Re-setup mocks
      (getFirestoreService as jest.Mock).mockReturnValue(mockFirestoreService);
      (getPrivacyService as jest.Mock).mockReturnValue(mockPrivacyService);

      const {
        collection,
        addDoc,
        serverTimestamp,
        query,
        getDocs,
        doc,
        getDoc,
        deleteDoc,
        updateDoc,
        onSnapshot,
      } = jest.requireMock("firebase/firestore");

      collection.mockReturnValue({});
      addDoc.mockResolvedValue({ id: "whisper-123" });
      serverTimestamp.mockReturnValue(new Date());
      query.mockReturnValue({});
      getDocs.mockResolvedValue({
        docs: [
          {
            id: "whisper-1",
            data: () => mockWhisper,
          },
        ],
        empty: false,
        size: 1,
        forEach: (callback: any) =>
          callback({ id: "whisper-1", data: () => mockWhisper }),
      });
      doc.mockReturnValue({});
      getDoc.mockResolvedValue({
        exists: () => true,
        id: "whisper-123",
        data: () => mockWhisper,
      });
      deleteDoc.mockResolvedValue(undefined);
      updateDoc.mockResolvedValue(undefined);
      onSnapshot.mockReturnValue(() => {});

      (buildWhisperQueryConstraints as jest.Mock).mockReturnValue({
        constraints: [jest.fn(), jest.fn()],
      });

      // Reset the whisperService instance to avoid conflicts
      WhisperService.resetInstance();
      whisperService = WhisperService.getInstance();
    });
    it("should get whisper successfully", async () => {
      const { getDoc } = jest.requireMock("firebase/firestore");
      getDoc.mockResolvedValue({
        exists: () => true,
        id: "whisper-123",
        data: () => mockWhisper,
      });

      const result = await whisperService.getWhisper("whisper-123");

      expect(result).toEqual(mockWhisper);
    });

    it("should return null when whisper does not exist", async () => {
      const { getDoc } = jest.requireMock("firebase/firestore");
      getDoc.mockResolvedValue({
        exists: () => false,
      });

      const result = await whisperService.getWhisper("non-existent");

      expect(result).toBeNull();
    });

    it("should handle get whisper error", async () => {
      const { getDoc } = jest.requireMock("firebase/firestore");
      getDoc.mockRejectedValue(new Error("Firestore error"));

      await expect(whisperService.getWhisper("whisper-123")).rejects.toThrow(
        "Failed to get whisper: Firestore error"
      );
    });
  });

  describe("Instance deleteWhisper", () => {
    beforeEach(() => {
      // Reset mocks for this describe block
      jest.clearAllMocks();

      // Re-setup mocks
      (getFirestoreService as jest.Mock).mockReturnValue(mockFirestoreService);
      (getPrivacyService as jest.Mock).mockReturnValue(mockPrivacyService);

      const {
        collection,
        addDoc,
        serverTimestamp,
        query,
        getDocs,
        doc,
        getDoc,
        deleteDoc,
        updateDoc,
        onSnapshot,
      } = jest.requireMock("firebase/firestore");

      collection.mockReturnValue({});
      addDoc.mockResolvedValue({ id: "whisper-123" });
      serverTimestamp.mockReturnValue(new Date());
      query.mockReturnValue({});
      getDocs.mockResolvedValue({
        docs: [
          {
            id: "whisper-1",
            data: () => mockWhisper,
          },
        ],
        empty: false,
        size: 1,
        forEach: (callback: any) =>
          callback({ id: "whisper-1", data: () => mockWhisper }),
      });
      doc.mockReturnValue({});
      getDoc.mockResolvedValue({
        exists: () => true,
        id: "whisper-123",
        data: () => mockWhisper,
      });
      deleteDoc.mockResolvedValue(undefined);
      updateDoc.mockResolvedValue(undefined);
      onSnapshot.mockReturnValue(() => {});

      (buildWhisperQueryConstraints as jest.Mock).mockReturnValue({
        constraints: [jest.fn(), jest.fn()],
      });

      // Reset the whisperService instance to avoid conflicts
      WhisperService.resetInstance();
      whisperService = WhisperService.getInstance();
    });
    it("should delete whisper successfully", async () => {
      const { deleteDoc } = jest.requireMock("firebase/firestore");
      await whisperService.deleteWhisper("whisper-123");

      expect(deleteDoc).toHaveBeenCalled();
    });

    it("should handle delete whisper error", async () => {
      const { deleteDoc } = jest.requireMock("firebase/firestore");
      deleteDoc.mockRejectedValue(new Error("Firestore error"));

      await expect(whisperService.deleteWhisper("whisper-123")).rejects.toThrow(
        "Failed to delete whisper: Firestore error"
      );
    });
  });

  describe("Instance updateTranscription", () => {
    beforeEach(() => {
      // Reset mocks for this describe block
      jest.clearAllMocks();

      // Re-setup mocks
      (getFirestoreService as jest.Mock).mockReturnValue(mockFirestoreService);
      (getPrivacyService as jest.Mock).mockReturnValue(mockPrivacyService);

      const {
        collection,
        addDoc,
        serverTimestamp,
        query,
        getDocs,
        doc,
        getDoc,
        deleteDoc,
        updateDoc,
        onSnapshot,
      } = jest.requireMock("firebase/firestore");

      collection.mockReturnValue({});
      addDoc.mockResolvedValue({ id: "whisper-123" });
      serverTimestamp.mockReturnValue(new Date());
      query.mockReturnValue({});
      getDocs.mockResolvedValue({
        docs: [
          {
            id: "whisper-1",
            data: () => mockWhisper,
          },
        ],
        empty: false,
        size: 1,
        forEach: (callback: any) =>
          callback({ id: "whisper-1", data: () => mockWhisper }),
      });
      doc.mockReturnValue({});
      getDoc.mockResolvedValue({
        exists: () => true,
        id: "whisper-123",
        data: () => mockWhisper,
      });
      deleteDoc.mockResolvedValue(undefined);
      updateDoc.mockResolvedValue(undefined);
      onSnapshot.mockReturnValue(() => {});

      (buildWhisperQueryConstraints as jest.Mock).mockReturnValue({
        constraints: [jest.fn(), jest.fn()],
      });

      // Reset the whisperService instance to avoid conflicts
      WhisperService.resetInstance();
      whisperService = WhisperService.getInstance();
    });
    it("should update transcription successfully", async () => {
      const { updateDoc } = jest.requireMock("firebase/firestore");
      await whisperService.updateTranscription(
        "whisper-123",
        "Updated transcription"
      );

      expect(updateDoc).toHaveBeenCalledWith(
        {},
        {
          transcription: "Updated transcription",
          isTranscribed: true,
        }
      );
    });

    it("should handle update transcription error", async () => {
      const { updateDoc } = jest.requireMock("firebase/firestore");
      updateDoc.mockRejectedValue(new Error("Firestore error"));

      await expect(
        whisperService.updateTranscription(
          "whisper-123",
          "Updated transcription"
        )
      ).rejects.toThrow("Failed to update transcription: Firestore error");
    });
  });

  describe("Instance getUserWhispers", () => {
    it("should get user whispers successfully", async () => {
      const result = await whisperService.getUserWhispers("user-123");

      expect(buildWhisperQueryConstraints).toHaveBeenCalledWith({
        userId: "user-123",
      });
      expect(result.whispers).toHaveLength(1);
    });
  });

  describe("Instance subscribeToWhispers", () => {
    it("should subscribe to whispers successfully", () => {
      const { onSnapshot } = jest.requireMock("firebase/firestore");
      const callback = jest.fn();
      const unsubscribe = whisperService.subscribeToWhispers(callback);

      expect(buildWhisperQueryConstraints).toHaveBeenCalledWith({});
      expect(onSnapshot).toHaveBeenCalled();
      expect(typeof unsubscribe).toBe("function");
    });

    it("should subscribe to whispers with custom options", () => {
      const { onSnapshot } = jest.requireMock("firebase/firestore");
      const callback = jest.fn();
      const options = {
        limit: 10,
        userId: "user-123",
      };

      whisperService.subscribeToWhispers(callback, options);

      expect(buildWhisperQueryConstraints).toHaveBeenCalledWith(options);
      expect(onSnapshot).toHaveBeenCalled();
    });

    it("should handle subscription error", () => {
      const { onSnapshot } = jest.requireMock("firebase/firestore");
      onSnapshot.mockImplementation(() => {
        throw new Error("Subscription error");
      });

      const callback = jest.fn();

      expect(() => whisperService.subscribeToWhispers(callback)).toThrow(
        "Failed to subscribe to whispers: Subscription error"
      );
    });

    it("should call callback with transformed whispers", () => {
      const callback = jest.fn();
      const { onSnapshot } = jest.requireMock("firebase/firestore");

      onSnapshot.mockImplementation((query: any, snapshotCallback: any) => {
        const mockSnapshot = {
          forEach: (docCallback: any) => {
            docCallback({ id: "whisper-1", data: () => mockWhisper });
          },
        };
        snapshotCallback(mockSnapshot);
        return () => {};
      });

      whisperService.subscribeToWhispers(callback);

      expect(callback).toHaveBeenCalledWith([
        {
          ...mockWhisper,
        },
      ]);
    });
  });

  describe("Instance subscribeToNewWhispers", () => {
    it("should subscribe to new whispers successfully", () => {
      const { onSnapshot } = jest.requireMock("firebase/firestore");
      const callback = jest.fn();
      const sinceTimestamp = new Date("2024-01-01");
      const unsubscribe = whisperService.subscribeToNewWhispers(
        callback,
        sinceTimestamp
      );

      expect(buildWhisperQueryConstraints).toHaveBeenCalledWith({});
      expect(onSnapshot).toHaveBeenCalled();
      expect(typeof unsubscribe).toBe("function");
    });

    it("should subscribe to new whispers without timestamp", () => {
      const { onSnapshot } = jest.requireMock("firebase/firestore");
      const callback = jest.fn();
      whisperService.subscribeToNewWhispers(callback);

      expect(buildWhisperQueryConstraints).toHaveBeenCalledWith({});
      expect(onSnapshot).toHaveBeenCalled();
    });

    it("should subscribe to new whispers with custom options", () => {
      const { onSnapshot } = jest.requireMock("firebase/firestore");
      const callback = jest.fn();
      const options = { limit: 10 };
      const sinceTimestamp = new Date("2024-01-01");

      whisperService.subscribeToNewWhispers(callback, sinceTimestamp, options);

      expect(buildWhisperQueryConstraints).toHaveBeenCalledWith(options);
      expect(onSnapshot).toHaveBeenCalled();
    });

    it("should handle subscription error", () => {
      const { onSnapshot } = jest.requireMock("firebase/firestore");
      onSnapshot.mockImplementation(() => {
        throw new Error("Subscription error");
      });

      const callback = jest.fn();

      expect(() => whisperService.subscribeToNewWhispers(callback)).toThrow(
        "Failed to subscribe to new whispers: Subscription error"
      );
    });

    it("should call callback only for added documents", () => {
      const callback = jest.fn();
      const { onSnapshot } = jest.requireMock("firebase/firestore");

      onSnapshot.mockImplementation((query: any, snapshotCallback: any) => {
        const mockSnapshot = {
          docChanges: () => [
            {
              type: "added",
              doc: { id: "whisper-1", data: () => mockWhisper },
            },
            {
              type: "modified",
              doc: { id: "whisper-2", data: () => mockWhisper },
            },
            {
              type: "removed",
              doc: { id: "whisper-3", data: () => mockWhisper },
            },
          ],
        };
        snapshotCallback(mockSnapshot);
        return () => {};
      });

      whisperService.subscribeToNewWhispers(callback);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({
        ...mockWhisper,
      });
    });

    it("should handle empty docChanges", () => {
      const callback = jest.fn();
      const { onSnapshot } = jest.requireMock("firebase/firestore");

      onSnapshot.mockImplementation((query: any, snapshotCallback: any) => {
        const mockSnapshot = {
          docChanges: () => [],
        };
        snapshotCallback(mockSnapshot);
        return () => {};
      });

      whisperService.subscribeToNewWhispers(callback);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("Instance createWhisper", () => {
    beforeEach(() => {
      // Reset mocks for this describe block
      jest.clearAllMocks();

      // Re-setup mocks
      (getFirestoreService as jest.Mock).mockReturnValue(mockFirestoreService);
      (getPrivacyService as jest.Mock).mockReturnValue(mockPrivacyService);

      const {
        collection,
        addDoc,
        serverTimestamp,
        query,
        getDocs,
        doc,
        getDoc,
        deleteDoc,
        updateDoc,
        onSnapshot,
      } = jest.requireMock("firebase/firestore");

      collection.mockReturnValue({});
      addDoc.mockResolvedValue({ id: "whisper-123" });
      serverTimestamp.mockReturnValue(new Date());
      query.mockReturnValue({});
      getDocs.mockResolvedValue({
        docs: [
          {
            id: "whisper-1",
            data: () => mockWhisper,
          },
        ],
        empty: false,
        size: 1,
        forEach: (callback: any) =>
          callback({ id: "whisper-1", data: () => mockWhisper }),
      });
      doc.mockReturnValue({});
      getDoc.mockResolvedValue({
        exists: () => true,
        id: "whisper-123",
        data: () => mockWhisper,
      });
      deleteDoc.mockResolvedValue(undefined);
      updateDoc.mockResolvedValue(undefined);
      onSnapshot.mockReturnValue(() => {});

      (buildWhisperQueryConstraints as jest.Mock).mockReturnValue({
        constraints: [jest.fn(), jest.fn()],
      });

      // Reset the whisperService instance to avoid conflicts
      WhisperService.resetInstance();
      whisperService = WhisperService.getInstance();
    });
    it("should create whisper successfully", async () => {
      const { addDoc } = jest.requireMock("firebase/firestore");
      const uploadData = {
        audioUrl: "https://example.com/audio.mp3",
        duration: 30,
        whisperPercentage: 100,
        averageLevel: 0.5,
        confidence: 0.9,
        transcription: "Hello world",
      };

      const result = await whisperService.createWhisper(
        "user-123",
        "Test User",
        "#FF5733",
        uploadData
      );

      expect(addDoc).toHaveBeenCalled();
      expect(result).toBe("whisper-123");
    });

    it("should create whisper without transcription", async () => {
      const { addDoc } = jest.requireMock("firebase/firestore");
      const uploadData = {
        audioUrl: "https://example.com/audio.mp3",
        duration: 30,
        whisperPercentage: 100,
        averageLevel: 0.5,
        confidence: 0.9,
      };

      const result = await whisperService.createWhisper(
        "user-123",
        "Test User",
        "#FF5733",
        uploadData
      );

      expect(addDoc).toHaveBeenCalled();
      expect(result).toBe("whisper-123");
    });

    it("should handle create whisper error", async () => {
      const { addDoc } = jest.requireMock("firebase/firestore");
      addDoc.mockRejectedValue(new Error("Firestore error"));

      const uploadData = {
        audioUrl: "https://example.com/audio.mp3",
        duration: 30,
        whisperPercentage: 100,
        averageLevel: 0.5,
        confidence: 0.9,
      };

      await expect(
        whisperService.createWhisper(
          "user-123",
          "Test User",
          "#FF5733",
          uploadData
        )
      ).rejects.toThrow("Failed to create whisper: Firestore error");
    });

    it("should trim user display name", async () => {
      const { addDoc } = jest.requireMock("firebase/firestore");
      const uploadData = {
        audioUrl: "https://example.com/audio.mp3",
        duration: 30,
        whisperPercentage: 100,
        averageLevel: 0.5,
        confidence: 0.9,
      };

      await whisperService.createWhisper(
        "user-123",
        "  Test User  ",
        "#FF5733",
        uploadData
      );

      expect(addDoc).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          userDisplayName: "Test User",
        })
      );
    });

    it("should handle non-Error exceptions in createWhisper", async () => {
      const { addDoc } = jest.requireMock("firebase/firestore");
      addDoc.mockRejectedValue("String error");

      const uploadData = {
        audioUrl: "https://example.com/audio.mp3",
        duration: 30,
        whisperPercentage: 100,
        averageLevel: 0.5,
        confidence: 0.9,
      };

      await expect(
        whisperService.createWhisper(
          "user-123",
          "Test User",
          "#FF5733",
          uploadData
        )
      ).rejects.toThrow("Failed to create whisper: Unknown error");
    });
  });

  describe("Additional Coverage Tests", () => {
    it("should handle resetInstance when instance exists", () => {
      const instance = WhisperService.getInstance();
      WhisperService.resetInstance();
      const newInstance = WhisperService.getInstance();
      expect(instance).not.toBe(newInstance);
    });

    it("should handle destroyInstance when instance exists", () => {
      const instance = WhisperService.getInstance();
      WhisperService.destroyInstance();
      const newInstance = WhisperService.getInstance();
      expect(instance).not.toBe(newInstance);
    });

    it("should handle resetInstance when instance is null", () => {
      WhisperService.destroyInstance();
      expect(() => WhisperService.resetInstance()).not.toThrow();
    });

    it("should handle destroyInstance when instance is null", () => {
      WhisperService.destroyInstance();
      expect(() => WhisperService.destroyInstance()).not.toThrow();
    });
  });
});
