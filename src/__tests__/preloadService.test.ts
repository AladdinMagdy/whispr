import {
  PreloadService,
  getPreloadService,
  resetPreloadService,
  destroyPreloadService,
  PreloadResult,
} from "../services/preloadService";
import {
  getFirestoreService,
  PaginatedWhispersResult,
} from "../services/firestoreService";
import { useAudioStore } from "../store/useAudioStore";
import { Whisper } from "../types";

// Mock firestoreService
jest.mock("../services/firestoreService", () => ({
  getFirestoreService: jest.fn(() => ({
    getWhispers: jest.fn(),
  })),
}));

// Mock useAudioStore
jest.mock("../store/useAudioStore", () => ({
  useAudioStore: {
    getState: jest.fn(() => ({
      isInitialized: false,
      initializePlayer: jest.fn(),
    })),
  },
}));

describe("PreloadService", () => {
  let mockFirestoreService: any;
  let mockAudioStore: any;
  let preloadService: PreloadService;

  const sampleWhispers: Whisper[] = [
    {
      id: "1",
      userDisplayName: "User 1",
      userProfileColor: "#FF5733",
      whisperPercentage: 85.5,
      duration: 30,
      audioUrl: "https://example.com/audio1.mp3",
      createdAt: new Date(),
      userId: "user1",
    },
    {
      id: "2",
      userDisplayName: "User 2",
      userProfileColor: "#33FF57",
      whisperPercentage: 92.1,
      duration: 25,
      audioUrl: "https://example.com/audio2.mp3",
      createdAt: new Date(),
      userId: "user2",
    },
  ];

  const samplePaginatedResult: PaginatedWhispersResult = {
    whispers: sampleWhispers,
    hasMore: true,
    lastDoc: { id: "2" },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset singleton before each test
    PreloadService.resetInstance();
    preloadService = PreloadService.getInstance();

    mockFirestoreService = {
      getWhispers: jest.fn().mockResolvedValue(samplePaginatedResult),
    };
    (getFirestoreService as jest.Mock).mockReturnValue(mockFirestoreService);

    mockAudioStore = {
      isInitialized: false,
      initializePlayer: jest.fn().mockResolvedValue(undefined),
    };
    (useAudioStore.getState as jest.Mock).mockReturnValue(mockAudioStore);
  });

  afterEach(() => {
    PreloadService.resetInstance();
  });

  describe("Singleton Pattern", () => {
    it("should return the same instance", () => {
      const instance1 = PreloadService.getInstance();
      const instance2 = PreloadService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("should reset instance correctly", () => {
      const instance1 = PreloadService.getInstance();
      PreloadService.resetInstance();
      const instance2 = PreloadService.getInstance();
      expect(instance1).not.toBe(instance2);
    });

    it("should destroy instance correctly", () => {
      const instance1 = PreloadService.getInstance();
      PreloadService.destroyInstance();
      const instance2 = PreloadService.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe("Factory Functions", () => {
    it("should get preload service instance", () => {
      const service = getPreloadService();
      expect(service).toBeInstanceOf(PreloadService);
    });

    it("should reset preload service", () => {
      const instance1 = getPreloadService();
      resetPreloadService();
      const instance2 = getPreloadService();
      expect(instance1).not.toBe(instance2);
    });

    it("should destroy preload service", () => {
      const instance1 = getPreloadService();
      destroyPreloadService();
      const instance2 = getPreloadService();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe("preloadWhispers", () => {
    it("should preload whispers successfully", async () => {
      const result = await preloadService.preloadWhispers();

      expect(mockFirestoreService.getWhispers).toHaveBeenCalledWith({
        limit: 20,
      });
      expect(result).toEqual({
        whispers: sampleWhispers,
        hasMore: true,
        lastDoc: { id: "2" },
      });
    });

    it("should return cached whispers if available", async () => {
      // First call to populate cache
      await preloadService.preloadWhispers();

      // Second call should return cached data
      const result = await preloadService.preloadWhispers();

      expect(mockFirestoreService.getWhispers).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        whispers: sampleWhispers,
        hasMore: true,
        lastDoc: { id: "2" },
      });
    });

    it("should handle concurrent preload requests", async () => {
      // Start two concurrent preload requests
      const promise1 = preloadService.preloadWhispers();
      const promise2 = preloadService.preloadWhispers();

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Should only call getWhispers once
      expect(mockFirestoreService.getWhispers).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(result2);
    });

    it("should handle preload errors", async () => {
      const error = new Error("Firestore error");
      mockFirestoreService.getWhispers.mockRejectedValue(error);

      await expect(preloadService.preloadWhispers()).rejects.toThrow(
        "Firestore error"
      );
    });

    it("should preload audio tracks when loading whispers", async () => {
      await preloadService.preloadWhispers();

      expect(useAudioStore.getState).toHaveBeenCalled();
      expect(mockAudioStore.initializePlayer).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: "1",
            title: "User 1",
            artist: expect.stringContaining("85.5% whisper"),
            url: "https://example.com/audio1.mp3",
          }),
          expect.objectContaining({
            id: "2",
            title: "User 2",
            artist: expect.stringContaining("92.1% whisper"),
            url: "https://example.com/audio2.mp3",
          }),
        ])
      );
    });

    it("should handle audio track preload errors gracefully", async () => {
      mockAudioStore.initializePlayer.mockRejectedValue(
        new Error("Audio error")
      );

      // Should not throw error, just log it
      await expect(preloadService.preloadWhispers()).resolves.toEqual({
        whispers: sampleWhispers,
        hasMore: true,
        lastDoc: { id: "2" },
      });
    });
  });

  describe("getCachedWhispers", () => {
    it("should return null when no cache", () => {
      const result = preloadService.getCachedWhispers();
      expect(result).toBeNull();
    });

    it("should return cached whispers when available", async () => {
      await preloadService.preloadWhispers();

      const result = preloadService.getCachedWhispers();
      expect(result).toEqual({
        whispers: sampleWhispers,
        hasMore: true,
        lastDoc: { id: "2" },
      });
    });
  });

  describe("clearCache", () => {
    it("should clear cache correctly", async () => {
      await preloadService.preloadWhispers();

      preloadService.clearCache();

      const result = preloadService.getCachedWhispers();
      expect(result).toBeNull();
    });
  });

  describe("updateCache", () => {
    it("should update cache with new data", () => {
      const newWhispers = [sampleWhispers[0]];
      const newHasMore = false;
      const newLastDoc = { id: "1" };

      preloadService.updateCache(newWhispers, newHasMore, newLastDoc);

      const result = preloadService.getCachedWhispers();
      expect(result).toEqual({
        whispers: newWhispers,
        hasMore: newHasMore,
        lastDoc: newLastDoc,
      });
    });
  });

  describe("addNewWhisperToCache", () => {
    it("should add new whisper to beginning of cache", async () => {
      await preloadService.preloadWhispers();

      const newWhisper: Whisper = {
        id: "3",
        userDisplayName: "User 3",
        userProfileColor: "#3357FF",
        whisperPercentage: 78.9,
        duration: 35,
        audioUrl: "https://example.com/audio3.mp3",
        createdAt: new Date(),
        userId: "user3",
      };

      preloadService.addNewWhisperToCache(newWhisper);

      const result = preloadService.getCachedWhispers();
      expect(result?.whispers[0]).toEqual(newWhisper);
      expect(result?.whispers).toHaveLength(3);
    });

    it("should limit cache to 20 items", async () => {
      // Add 25 whispers to exceed limit
      for (let i = 0; i < 25; i++) {
        const whisper: Whisper = {
          id: `whisper-${i}`,
          userDisplayName: `User ${i}`,
          userProfileColor: "#FF5733",
          whisperPercentage: 80,
          duration: 30,
          audioUrl: `https://example.com/audio${i}.mp3`,
          createdAt: new Date(),
          userId: `user${i}`,
        };
        preloadService.addNewWhisperToCache(whisper);
      }

      const result = preloadService.getCachedWhispers();
      expect(result?.whispers).toHaveLength(20);
    });
  });

  describe("_formatTime", () => {
    it("should format time correctly", () => {
      // Test with different time values
      const testCases = [
        { seconds: 0, expected: "00:00" },
        { seconds: 30, expected: "00:30" },
        { seconds: 60, expected: "01:00" },
        { seconds: 90, expected: "01:30" },
        { seconds: 125, expected: "02:05" },
        { seconds: 3600, expected: "60:00" },
      ];

      testCases.forEach(({ seconds, expected }) => {
        // Access private method through preloadService instance
        const result = (preloadService as any)._formatTime(seconds);
        expect(result).toBe(expected);
      });
    });
  });

  describe("Audio Store Integration", () => {
    it("should initialize audio player when not initialized", async () => {
      mockAudioStore.isInitialized = false;

      await preloadService.preloadWhispers();

      expect(mockAudioStore.initializePlayer).toHaveBeenCalled();
    });

    it("should update audio tracks when already initialized", async () => {
      mockAudioStore.isInitialized = true;

      await preloadService.preloadWhispers();

      expect(mockAudioStore.initializePlayer).toHaveBeenCalled();
    });

    it("should create correct audio track format", async () => {
      await preloadService.preloadWhispers();

      const expectedTracks = [
        {
          id: "1",
          title: "User 1",
          artist: "85.5% whisper • 00:30",
          artwork:
            "https://ui-avatars.com/api/?name=User%201&background=FF5733&color=fff&size=200",
          url: "https://example.com/audio1.mp3",
        },
        {
          id: "2",
          title: "User 2",
          artist: "92.1% whisper • 00:25",
          artwork:
            "https://ui-avatars.com/api/?name=User%202&background=33FF57&color=fff&size=200",
          url: "https://example.com/audio2.mp3",
        },
      ];

      expect(mockAudioStore.initializePlayer).toHaveBeenCalledWith(
        expectedTracks
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle firestore service errors", async () => {
      const error = new Error("Network error");
      mockFirestoreService.getWhispers.mockRejectedValue(error);

      await expect(preloadService.preloadWhispers()).rejects.toThrow(
        "Network error"
      );
    });

    it("should handle audio store errors gracefully", async () => {
      mockAudioStore.initializePlayer.mockRejectedValue(
        new Error("Audio initialization failed")
      );

      // Should still return whispers even if audio preload fails
      const result = await preloadService.preloadWhispers();
      expect(result).toEqual({
        whispers: sampleWhispers,
        hasMore: true,
        lastDoc: { id: "2" },
      });
    });

    it("should handle empty whispers array", async () => {
      mockFirestoreService.getWhispers.mockResolvedValue({
        whispers: [],
        hasMore: false,
        lastDoc: null,
      });

      const result = await preloadService.preloadWhispers();
      expect(result).toEqual({
        whispers: [],
        hasMore: false,
        lastDoc: null,
      });
    });
  });

  describe("State Management", () => {
    it("should track preloading state correctly", async () => {
      // Start preloading
      const preloadPromise = preloadService.preloadWhispers();

      // Should be preloading
      expect((preloadService as any).isPreloading).toBe(true);

      await preloadPromise;

      // Should not be preloading after completion
      expect((preloadService as any).isPreloading).toBe(false);
    });

    it("should handle multiple rapid preload requests", async () => {
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(preloadService.preloadWhispers());
      }

      const results = await Promise.all(promises);

      // Should only call firestore once
      expect(mockFirestoreService.getWhispers).toHaveBeenCalledTimes(1);

      // All results should be the same
      results.forEach((result) => {
        expect(result).toEqual({
          whispers: sampleWhispers,
          hasMore: true,
          lastDoc: { id: "2" },
        });
      });
    });
  });
});
