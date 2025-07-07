/**
 * AudioCacheService Tests
 * Tests for local audio file caching functionality
 */

// Mock expo-file-system BEFORE any imports
jest.mock("expo-file-system", () => ({
  cacheDirectory: "/mock/cache/",
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  downloadAsync: jest.fn(),
  copyAsync: jest.fn(),
  deleteAsync: jest.fn(),
}));

import {
  AudioCacheService,
  getAudioCacheService,
  resetAudioCacheService,
  hashString,
  getFileExtension,
} from "../services/audioCacheService";
import * as FileSystem from "expo-file-system";

const mockFileSystem = FileSystem as jest.Mocked<typeof FileSystem>;

describe("AudioCacheService", () => {
  let audioCacheService: AudioCacheService;

  beforeEach(async () => {
    // Reset singleton before each test
    resetAudioCacheService();

    // Reset all mocks
    jest.clearAllMocks();

    // Mock cache directory exists
    mockFileSystem.getInfoAsync.mockResolvedValue({
      exists: true,
      uri: "/mock/cache/whispr-audio/",
      size: 0,
      isDirectory: true,
      modificationTime: Date.now(),
    });

    // Mock metadata file doesn't exist initially
    mockFileSystem.readAsStringAsync.mockResolvedValue("");

    // Create service and wait for initialization
    audioCacheService = getAudioCacheService();

    // Wait a bit for async initialization to complete
    await new Promise((resolve) => setTimeout(resolve, 10));
  });

  afterEach(() => {
    resetAudioCacheService();
  });

  describe("Singleton Pattern", () => {
    test("should return the same instance", () => {
      const instance1 = getAudioCacheService();
      const instance2 = getAudioCacheService();
      expect(instance1).toBe(instance2);
    });

    test("should reset instance correctly", () => {
      const instance1 = getAudioCacheService();
      resetAudioCacheService();
      const instance2 = getAudioCacheService();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe("Initialization", () => {
    test("should create cache directory if it does not exist", async () => {
      // Mock that directory doesn't exist
      mockFileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: false,
        uri: "/mock/cache/whispr-audio/",
        isDirectory: false,
      });

      // Recreate service to trigger initialization
      resetAudioCacheService();
      const newService = getAudioCacheService();

      // Wait for async initialization
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockFileSystem.makeDirectoryAsync).toHaveBeenCalledWith(
        "/mock/cache/whispr-audio/",
        { intermediates: true }
      );
    });

    test("should load existing cache metadata", async () => {
      const mockMetadata = {
        cachedFiles: [
          [
            "https://example.com/audio1.mp3",
            {
              originalUrl: "https://example.com/audio1.mp3",
              localPath: "/mock/cache/whispr-audio/hash1.mp3",
              downloadTime: Date.now(),
              fileSize: 1024 * 1024,
            },
          ],
        ],
        currentCacheSize: 1024 * 1024,
      };

      // Mock that metadata file exists and has content
      mockFileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: true,
        uri: "/mock/cache/whispr-audio/metadata.json",
        size: 1024,
        isDirectory: false,
        modificationTime: Date.now(),
      });
      mockFileSystem.readAsStringAsync.mockResolvedValueOnce(
        JSON.stringify(mockMetadata)
      );

      // Recreate service to trigger initialization
      resetAudioCacheService();
      const newService = getAudioCacheService();

      // Wait for async initialization
      await new Promise((resolve) => setTimeout(resolve, 10));

      const stats = newService.getCacheStats();
      expect(stats.fileCount).toBe(1);
      expect(stats.totalSize).toBe(1024 * 1024);
    });
  });

  describe("getCachedAudioUrl", () => {
    test("should return cached URL if file exists", async () => {
      const originalUrl = "https://example.com/audio.mp3";
      const cachedPath = "/mock/cache/whispr-audio/hash.mp3";

      // Mock that metadata file exists with cached data
      mockFileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: true,
        uri: "/mock/cache/whispr-audio/metadata.json",
        size: 1024,
        isDirectory: false,
        modificationTime: Date.now(),
      });

      const mockMetadata = {
        cachedFiles: [
          [
            originalUrl,
            {
              originalUrl,
              localPath: cachedPath,
              downloadTime: Date.now(),
              fileSize: 1024 * 1024,
            },
          ],
        ],
        currentCacheSize: 1024 * 1024,
      };
      mockFileSystem.readAsStringAsync.mockResolvedValueOnce(
        JSON.stringify(mockMetadata)
      );

      // Mock that the cached file exists
      mockFileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: true,
        uri: cachedPath,
        size: 1024 * 1024,
        isDirectory: false,
        modificationTime: Date.now(),
      });

      // Recreate service with cached data
      resetAudioCacheService();
      const newService = getAudioCacheService();

      // Wait for async initialization
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = await newService.getCachedAudioUrl(originalUrl);
      expect(result).toBe(cachedPath);
    });

    test("should download and cache remote file if not cached", async () => {
      const originalUrl = "https://example.com/audio.mp3";
      const tempHash = hashString(originalUrl);
      const tempExt = getFileExtension(originalUrl);
      const cachedPath = `/mock/cache/whispr-audio/${tempHash}${tempExt}`;

      // Reset singleton and mocks before running
      resetAudioCacheService();
      jest.clearAllMocks();

      // 1. First getInfoAsync: cache miss
      mockFileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: false,
        uri: cachedPath,
        isDirectory: false,
      });

      // 2. downloadAsync: download success
      mockFileSystem.downloadAsync.mockResolvedValue({
        status: 200,
        headers: {},
        uri: cachedPath,
        mimeType: "audio/mpeg",
      });

      // 3. Second getInfoAsync: file exists after download
      mockFileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: true,
        uri: cachedPath,
        size: 1024 * 1024,
        isDirectory: false,
        modificationTime: Date.now(),
      });

      // Use a fresh instance after resetting
      const freshService = getAudioCacheService();
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = await freshService.getCachedAudioUrl(originalUrl);
      expect(result).toBe(cachedPath);
      expect(result).toContain(".mp3");
      expect(mockFileSystem.downloadAsync).toHaveBeenCalledWith(
        originalUrl,
        expect.stringContaining(".mp3")
      );
    });

    test("should copy local file to cache", async () => {
      const originalUrl = "file:///local/audio.mp3";

      // Mock that the file doesn't exist in cache (first call for getCachedAudioUrl)
      mockFileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: false,
        uri: "/mock/cache/whispr-audio/hash.mp3",
        isDirectory: false,
      });

      // Mock file info for local file (second call for getCachedAudioUrl)
      mockFileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: true,
        uri: originalUrl,
        size: 1024 * 1024,
        isDirectory: false,
        modificationTime: Date.now(),
      });

      const result = await audioCacheService.getCachedAudioUrl(originalUrl);
      expect(result).toContain("/mock/cache/whispr-audio/");
      expect(result).toContain(".mp3");
      expect(mockFileSystem.copyAsync).toHaveBeenCalledWith({
        from: originalUrl,
        to: expect.stringContaining(".mp3"),
      });
    });

    test("should return original URL as fallback on error", async () => {
      const originalUrl = "https://example.com/audio.mp3";

      // Mock that the file doesn't exist in cache (first call for getCachedAudioUrl)
      mockFileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: false,
        uri: "/mock/cache/whispr-audio/hash.mp3",
        isDirectory: false,
      });

      // Mock download failure
      mockFileSystem.downloadAsync.mockRejectedValue(
        new Error("Download failed")
      );

      const result = await audioCacheService.getCachedAudioUrl(originalUrl);
      expect(result).toBe(originalUrl);
    });
  });

  describe("preloadTracks", () => {
    test("should preload next tracks", async () => {
      const tracks = [
        {
          id: "1",
          title: "Track 1",
          artist: "Artist 1",
          url: "https://example.com/1.mp3",
        },
        {
          id: "2",
          title: "Track 2",
          artist: "Artist 2",
          url: "https://example.com/2.mp3",
        },
        {
          id: "3",
          title: "Track 3",
          artist: "Artist 3",
          url: "https://example.com/3.mp3",
        },
      ];

      // Mock that files don't exist in cache (for getCachedAudioUrl calls)
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: false,
        uri: "/mock/cache/whispr-audio/hash.mp3",
        isDirectory: false,
      });

      // Mock successful downloads
      mockFileSystem.downloadAsync.mockResolvedValue({
        status: 200,
        headers: {},
        uri: "/mock/cache/whispr-audio/hash.mp3",
        mimeType: "audio/mpeg",
      });

      // Mock file info for downloaded files
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: true,
        uri: "/mock/cache/whispr-audio/hash.mp3",
        size: 1024 * 1024,
        isDirectory: false,
        modificationTime: Date.now(),
      });

      await audioCacheService.preloadTracks(tracks, 0, 2);

      // Should have called downloadAsync for tracks 2 and 3 (next tracks from index 0)
      expect(mockFileSystem.downloadAsync).toHaveBeenCalledWith(
        "https://example.com/2.mp3",
        expect.stringContaining(".mp3")
      );
      expect(mockFileSystem.downloadAsync).toHaveBeenCalledWith(
        "https://example.com/3.mp3",
        expect.stringContaining(".mp3")
      );
      expect(mockFileSystem.downloadAsync).toHaveBeenCalledWith(
        "https://example.com/2.mp3",
        expect.stringContaining(".mp3")
      );
    });

    test("should not preload if already preloading", async () => {
      const tracks = [
        {
          id: "1",
          title: "Track 1",
          artist: "Artist 1",
          url: "https://example.com/1.mp3",
        },
      ];

      // Always force download
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: false,
        uri: "",
        isDirectory: false,
      });
      mockFileSystem.downloadAsync.mockResolvedValue({
        status: 200,
        headers: {},
        uri: "/mock/cache/whispr-audio/hash.mp3",
        mimeType: "audio/mpeg",
      });

      // Mock file info for downloaded file
      mockFileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: true,
        uri: "/mock/cache/whispr-audio/hash.mp3",
        size: 1024 * 1024,
        isDirectory: false,
        modificationTime: Date.now(),
      });

      // Spy on getCachedAudioUrl to track calls
      const getCachedSpy = jest.spyOn(audioCacheService, "getCachedAudioUrl");

      // Manually set isPreloading to true to simulate ongoing preload
      // @ts-ignore (accessing private state for test)
      audioCacheService.state.isPreloading = true;

      // Try to preload while already preloading (should return immediately)
      await audioCacheService.preloadTracks(tracks, 0, 1);

      // Should not have called getCachedAudioUrl because isPreloading was true
      expect(getCachedSpy).not.toHaveBeenCalled();

      // Reset the flag
      // @ts-ignore
      audioCacheService.state.isPreloading = false;
    });

    test("should manage cache size by evicting old files", async () => {
      const originalUrl = "https://example.com/large-audio.mp3";

      // Mock that metadata file exists with old cached files
      mockFileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: true,
        uri: "/mock/cache/whispr-audio/metadata.json",
        size: 1024,
        isDirectory: false,
        modificationTime: Date.now(),
      });

      // Mock existing cache with two files, total 90MB
      const mockMetadata = {
        cachedFiles: [
          [
            "https://example.com/old1.mp3",
            {
              originalUrl: "https://example.com/old1.mp3",
              localPath: "/mock/cache/whispr-audio/old1.mp3",
              downloadTime: Date.now() - 1000000, // Oldest file
              fileSize: 60 * 1024 * 1024, // 60MB
            },
          ],
          [
            "https://example.com/old2.mp3",
            {
              originalUrl: "https://example.com/old2.mp3",
              localPath: "/mock/cache/whispr-audio/old2.mp3",
              downloadTime: Date.now() - 500000, // Newer file
              fileSize: 30 * 1024 * 1024, // 30MB
            },
          ],
        ],
        currentCacheSize: 90 * 1024 * 1024, // 90MB
      };
      mockFileSystem.readAsStringAsync.mockResolvedValueOnce(
        JSON.stringify(mockMetadata)
      );

      // Mock that the new file doesn't exist in cache
      mockFileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: false,
        uri: "/mock/cache/whispr-audio/large.mp3",
        isDirectory: false,
      });

      // Mock large file download
      mockFileSystem.downloadAsync.mockResolvedValue({
        status: 200,
        headers: {},
        uri: "/mock/cache/whispr-audio/large.mp3",
        mimeType: "audio/mpeg",
      });

      // Mock file info for downloaded large file (40MB, triggers eviction: 90+40=130>100)
      mockFileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: true,
        uri: "/mock/cache/whispr-audio/large.mp3",
        size: 40 * 1024 * 1024,
        isDirectory: false,
        modificationTime: Date.now(),
      });

      // Recreate service with existing cache
      resetAudioCacheService();
      const newService = getAudioCacheService();
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Manually set the cache state to match the test's expectations
      // @ts-ignore (accessing private state for test)
      newService.state.cachedFiles = new Map([
        [
          "https://example.com/old1.mp3",
          {
            originalUrl: "https://example.com/old1.mp3",
            localPath: "/mock/cache/whispr-audio/old1.mp3",
            downloadTime: Date.now() - 1000000,
            fileSize: 60 * 1024 * 1024,
          },
        ],
        [
          "https://example.com/old2.mp3",
          {
            originalUrl: "https://example.com/old2.mp3",
            localPath: "/mock/cache/whispr-audio/old2.mp3",
            downloadTime: Date.now() - 500000,
            fileSize: 30 * 1024 * 1024,
          },
        ],
      ]);
      // @ts-ignore
      newService.state.currentCacheSize = 90 * 1024 * 1024;

      // Call getCachedAudioUrl to trigger eviction
      await newService.getCachedAudioUrl(originalUrl);

      // Should have deleted the oldest file to make space
      expect(mockFileSystem.deleteAsync).toHaveBeenCalledWith(
        "/mock/cache/whispr-audio/old1.mp3"
      );
    });
  });

  describe("Cache Management", () => {
    test("should clear cache completely", async () => {
      // Mock that metadata file exists with cached data
      mockFileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: true,
        uri: "/mock/cache/whispr-audio/metadata.json",
        size: 1024,
        isDirectory: false,
        modificationTime: Date.now(),
      });

      // Mock existing cache
      const mockMetadata = {
        cachedFiles: [
          [
            "https://example.com/audio.mp3",
            {
              originalUrl: "https://example.com/audio.mp3",
              localPath: "/mock/cache/whispr-audio/audio.mp3",
              downloadTime: Date.now(),
              fileSize: 1024 * 1024,
            },
          ],
        ],
        currentCacheSize: 1024 * 1024,
      };
      mockFileSystem.readAsStringAsync.mockResolvedValueOnce(
        JSON.stringify(mockMetadata)
      );

      // Recreate service with existing cache
      resetAudioCacheService();
      const newService = getAudioCacheService();

      // Wait for async initialization
      await new Promise((resolve) => setTimeout(resolve, 10));

      await newService.clearCache();

      expect(mockFileSystem.deleteAsync).toHaveBeenCalledWith(
        "/mock/cache/whispr-audio/audio.mp3"
      );

      const stats = newService.getCacheStats();
      expect(stats.fileCount).toBe(0);
      expect(stats.totalSize).toBe(0);
    });
  });

  describe("Cache Statistics", () => {
    test("should return correct cache statistics", () => {
      const stats = audioCacheService.getCacheStats();

      expect(stats).toHaveProperty("fileCount");
      expect(stats).toHaveProperty("totalSize");
      expect(stats).toHaveProperty("maxSize");
      expect(stats).toHaveProperty("usagePercentage");
      expect(stats.maxSize).toBe(100 * 1024 * 1024); // 100MB
    });

    test("should calculate usage percentage correctly", async () => {
      // Mock that metadata file exists with cached data
      mockFileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: true,
        uri: "/mock/cache/whispr-audio/metadata.json",
        size: 1024,
        isDirectory: false,
        modificationTime: Date.now(),
      });

      // Mock cache with some data
      const mockMetadata = {
        cachedFiles: [
          [
            "https://example.com/audio.mp3",
            {
              originalUrl: "https://example.com/audio.mp3",
              localPath: "/mock/cache/whispr-audio/audio.mp3",
              downloadTime: Date.now(),
              fileSize: 50 * 1024 * 1024, // 50MB
            },
          ],
        ],
        currentCacheSize: 50 * 1024 * 1024,
      };
      mockFileSystem.readAsStringAsync.mockResolvedValueOnce(
        JSON.stringify(mockMetadata)
      );

      // Recreate service with existing cache
      resetAudioCacheService();
      const newService = getAudioCacheService();

      // Wait for async initialization
      await new Promise((resolve) => setTimeout(resolve, 10));

      const stats = newService.getCacheStats();
      expect(stats.usagePercentage).toBe(50); // 50MB / 100MB = 50%
    });
  });

  describe("Error Handling", () => {
    test("should handle file system errors gracefully", async () => {
      mockFileSystem.getInfoAsync.mockRejectedValue(
        new Error("File system error")
      );

      // Should not throw error during initialization
      expect(() => {
        resetAudioCacheService();
        getAudioCacheService();
      }).not.toThrow();
    });

    test("should handle corrupted metadata gracefully", async () => {
      mockFileSystem.readAsStringAsync.mockResolvedValue("invalid json");

      // Should not throw error during initialization
      expect(() => {
        resetAudioCacheService();
        getAudioCacheService();
      }).not.toThrow();
    });
  });
});
