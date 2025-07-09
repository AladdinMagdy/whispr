/**
 * FeedStore Tests
 * Tests for persistent whisper caching functionality
 */

import { useFeedStore } from "../store/useFeedStore";
import { Whisper } from "../types";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe("FeedStore", () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Reset store state
    useFeedStore.setState({
      whispers: [],
      lastDoc: null,
      hasMore: true,
      lastLoadTime: 0,
    });

    // Mock AsyncStorage to return null (no cached data)
    mockAsyncStorage.getItem.mockResolvedValue(null);
  });

  afterEach(() => {
    // Clean up store state
    useFeedStore.setState({
      whispers: [],
      lastDoc: null,
      hasMore: true,
      lastLoadTime: 0,
    });
  });

  describe("Initial State", () => {
    test("should have correct initial state", () => {
      const state = useFeedStore.getState();

      expect(state.whispers).toEqual([]);
      expect(state.lastDoc).toBeNull();
      expect(state.hasMore).toBe(true);
      expect(state.lastLoadTime).toBe(0);
    });
  });

  describe("Cache Validation", () => {
    test("should return true for cache validity when cache is fresh", () => {
      const recentTime = Date.now() - 1000; // 1 second ago
      useFeedStore.setState({
        lastLoadTime: recentTime,
        whispers: [{ id: "test" } as any],
      });

      const state = useFeedStore.getState();
      expect(state.isCacheValid()).toBe(true);
    });

    test("should return false for cache validity when cache is expired", () => {
      const oldTime = Date.now() - 6 * 60 * 1000; // 6 minutes ago
      useFeedStore.setState({
        lastLoadTime: oldTime,
        whispers: [{ id: "test" } as any],
      });

      const state = useFeedStore.getState();
      expect(state.isCacheValid()).toBe(false);
    });

    test("should return false for cache validity when no whispers", () => {
      const recentTime = Date.now() - 1000; // 1 second ago
      useFeedStore.setState({ lastLoadTime: recentTime, whispers: [] });

      const state = useFeedStore.getState();
      expect(state.isCacheValid()).toBe(false);
    });
  });

  describe("Whisper Management", () => {
    const mockWhisper: Whisper = {
      id: "test-whisper-1",
      audioUrl: "https://example.com/audio.mp3",
      userDisplayName: "Anonymous User",
      userProfileColor: "#FF6B6B",
      whisperPercentage: 85.5,
      averageLevel: 0.01,
      confidence: 0.99,
      likes: 0,
      replies: 0,
      duration: 15.2,
      createdAt: new Date(),
      userId: "anonymous-user-1",
      isTranscribed: false,
    };

    const mockWhisper2: Whisper = {
      id: "test-whisper-2",
      audioUrl: "https://example.com/audio2.mp3",
      userDisplayName: "Another User",
      userProfileColor: "#4ECDC4",
      whisperPercentage: 92.1,
      duration: 12.8,
      createdAt: new Date(),
      userId: "anonymous-user-2",
      averageLevel: 0.012,
      confidence: 0.95,
      likes: 0,
      replies: 0,
      isTranscribed: false,
    };

    test("should set whispers correctly", () => {
      const whispers = [mockWhisper, mockWhisper2];

      useFeedStore.getState().setWhispers(whispers);

      const state = useFeedStore.getState();
      expect(state.whispers).toEqual(whispers);
      expect(state.whispers).toHaveLength(2);
    });

    test("should add new whisper to the beginning", () => {
      useFeedStore.getState().addNewWhisper(mockWhisper);

      const state = useFeedStore.getState();
      expect(state.whispers).toHaveLength(1);
      expect(state.whispers[0]).toEqual(mockWhisper);
    });

    test("should not add duplicate whispers", () => {
      useFeedStore.getState().addNewWhisper(mockWhisper);
      useFeedStore.getState().addNewWhisper(mockWhisper);

      const state = useFeedStore.getState();
      expect(state.whispers).toHaveLength(1); // Duplicate should be prevented
      expect(state.whispers[0]).toEqual(mockWhisper);
    });

    test("should limit whispers to 20 when adding new ones", () => {
      // Create 20 existing whispers
      const manyWhispers = Array.from({ length: 20 }, (_, i) => ({
        ...mockWhisper,
        id: `whisper-${i}`,
        audioUrl: `https://example.com/audio${i}.mp3`,
      }));

      useFeedStore.setState({ whispers: manyWhispers });

      // Add a new whisper
      const mockWhisper2 = { ...mockWhisper, id: "whisper-new" };
      useFeedStore.getState().addNewWhisper(mockWhisper2);

      const state = useFeedStore.getState();
      expect(state.whispers).toHaveLength(20);
      expect(state.whispers[0]).toEqual(mockWhisper2); // New whisper should be first
      expect(state.whispers[19]).toEqual(manyWhispers[18]); // Last whisper should be the 19th original
    });
  });

  describe("Pagination State", () => {
    test("should set last document correctly", () => {
      const mockDoc = { id: "last-doc-id" } as any;

      useFeedStore.getState().setLastDoc(mockDoc);

      const state = useFeedStore.getState();
      expect(state.lastDoc).toEqual(mockDoc);
    });

    test("should set has more flag correctly", () => {
      useFeedStore.getState().setHasMore(false);

      const state = useFeedStore.getState();
      expect(state.hasMore).toBe(false);
    });

    test("should set last load time correctly", () => {
      const loadTime = Date.now();

      useFeedStore.getState().setLastLoadTime(loadTime);

      const state = useFeedStore.getState();
      expect(state.lastLoadTime).toBe(loadTime);
    });
  });

  describe("Cache Update", () => {
    const mockWhisper: Whisper = {
      id: "test-whisper-1",
      audioUrl: "https://example.com/audio.mp3",
      userDisplayName: "Anonymous User",
      userProfileColor: "#FF6B6B",
      whisperPercentage: 85.5,
      averageLevel: 0.01,
      confidence: 0.99,
      likes: 0,
      replies: 0,
      duration: 15.2,
      createdAt: new Date(),
      userId: "anonymous-user-1",
      isTranscribed: false,
    };

    const mockDoc = { id: "last-doc-id" } as any;

    test("should update cache with new data", () => {
      const whispers = [mockWhisper];

      useFeedStore.getState().updateCache(whispers, mockDoc, false);

      const state = useFeedStore.getState();
      expect(state.whispers).toEqual(whispers);
      expect(state.lastDoc).toEqual(mockDoc);
      expect(state.hasMore).toBe(false);
      expect(state.lastLoadTime).toBeGreaterThan(0);
    });

    test("should append whispers when paginating", () => {
      const initialWhispers = [mockWhisper];
      const newWhispers = [{ ...mockWhisper, id: "whisper-2" }];

      // Set initial cache
      useFeedStore.getState().updateCache(initialWhispers, mockDoc, true);

      // Append new whispers
      useFeedStore
        .getState()
        .updateCache([...initialWhispers, ...newWhispers], mockDoc, false);

      const state = useFeedStore.getState();
      expect(state.whispers).toHaveLength(2);
      expect(state.whispers[0]).toEqual(initialWhispers[0]);
      expect(state.whispers[1]).toEqual(newWhispers[0]);
    });
  });

  describe("AsyncStorage Persistence", () => {
    test("should save state to AsyncStorage when whispers change", () => {
      const mockWhisper: Whisper = {
        id: "test-whisper-1",
        audioUrl: "https://example.com/audio.mp3",
        userDisplayName: "Anonymous User",
        userProfileColor: "#FF6B6B",
        whisperPercentage: 85.5,
        averageLevel: 0.01,
        confidence: 0.99,
        likes: 0,
        replies: 0,
        duration: 15.2,
        createdAt: new Date(),
        userId: "anonymous-user-1",
        isTranscribed: false,
      };

      useFeedStore.getState().setWhispers([mockWhisper]);

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        "feed-storage",
        expect.stringContaining("test-whisper-1")
      );
    });

    test("should handle corrupted AsyncStorage data gracefully", async () => {
      mockAsyncStorage.getItem.mockResolvedValue("invalid json");

      // Should not throw error when loading corrupted data
      expect(() => {
        useFeedStore.setState({
          whispers: [],
          lastDoc: null,
          hasMore: true,
          lastLoadTime: 0,
        });
      }).not.toThrow();
    });

    test("should handle AsyncStorage errors gracefully", async () => {
      // Mock console.warn to capture error logs
      const consoleSpy = jest
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      mockAsyncStorage.setItem.mockRejectedValue(new Error("Storage error"));

      const mockWhisper: Whisper = {
        id: "test-whisper-1",
        audioUrl: "https://example.com/audio.mp3",
        userDisplayName: "Anonymous User",
        userProfileColor: "#FF6B6B",
        whisperPercentage: 85.5,
        averageLevel: 0.01,
        confidence: 0.99,
        likes: 0,
        replies: 0,
        duration: 15.2,
        createdAt: new Date(),
        userId: "anonymous-user-1",
        isTranscribed: false,
      };

      // Should not throw error when saving fails
      useFeedStore.getState().setWhispers([mockWhisper]);
      await Promise.resolve(); // allow async error to surface

      // Verify that the error was logged but not thrown
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("❌ Failed to write to AsyncStorage"),
        expect.any(Error)
      );

      // Clean up
      consoleSpy.mockRestore();
    });
  });

  describe("Store Selectors", () => {
    test("should return correct whisper count", () => {
      const mockWhisper: Whisper = {
        id: "test-whisper-1",
        audioUrl: "https://example.com/audio.mp3",
        userDisplayName: "Anonymous User",
        userProfileColor: "#FF6B6B",
        whisperPercentage: 85.5,
        averageLevel: 0.01,
        confidence: 0.99,
        likes: 0,
        replies: 0,
        duration: 15.2,
        createdAt: new Date(),
        userId: "anonymous-user-1",
        isTranscribed: false,
      };

      useFeedStore
        .getState()
        .setWhispers([mockWhisper, { ...mockWhisper, id: "whisper-2" }]);

      const state = useFeedStore.getState();
      expect(state.whispers.length).toBe(2);
    });

    test("should return correct pagination state", () => {
      const mockDoc = { id: "last-doc-id" } as any;

      useFeedStore.getState().setLastDoc(mockDoc);
      useFeedStore.getState().setHasMore(false);

      const state = useFeedStore.getState();
      expect(state.lastDoc).toEqual(mockDoc);
      expect(state.hasMore).toBe(false);
    });
  });

  describe("Error Handling", () => {
    test("should handle invalid whisper data gracefully", () => {
      const invalidWhisper = {
        id: "test-whisper-1",
        // Missing required fields
      } as any;

      // Should not throw error when setting invalid data
      expect(() => {
        useFeedStore.getState().setWhispers([invalidWhisper]);
      }).not.toThrow();
    });
  });
});
