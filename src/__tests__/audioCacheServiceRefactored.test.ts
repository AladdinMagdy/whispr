/**
 * Tests for AudioCacheService
 */

import * as FileSystem from "expo-file-system";
import {
  AudioCacheService,
  getAudioCacheService,
} from "../services/audioCacheService";
import * as audioCacheUtils from "../utils/audioCacheUtils";

// Mock expo-file-system
jest.mock("expo-file-system");

// Mock audioCacheUtils
jest.mock("../utils/audioCacheUtils");

const mockFileSystem = {
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  copyAsync: jest.fn(),
  downloadAsync: jest.fn(),
  deleteAsync: jest.fn(),
  cacheDirectory: "/test/cache/",
};

describe("AudioCacheService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (FileSystem as any).default = mockFileSystem;

    // Reset singleton instance
    AudioCacheService.destroyInstance();
  });

  afterEach(() => {
    AudioCacheService.destroyInstance();
  });

  describe("getInstance", () => {
    it("should return singleton instance", () => {
      const instance1 = AudioCacheService.getInstance();
      const instance2 = AudioCacheService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("should accept custom file system", () => {
      const customFileSystem = { ...mockFileSystem };
      const instance = AudioCacheService.getInstance(customFileSystem as any);
      expect(instance).toBeInstanceOf(AudioCacheService);
    });
  });

  describe("getCachedAudioUrl", () => {
    let service: AudioCacheService;

    beforeEach(() => {
      service = AudioCacheService.getInstance(mockFileSystem as any);

      // Mock utility functions
      (audioCacheUtils.validateCachedFile as jest.Mock).mockResolvedValue(true);
      (audioCacheUtils.downloadAndCache as jest.Mock).mockResolvedValue({
        localPath: "/cache/hash.mp3",
        cachedFiles: new Map(),
        currentCacheSize: 1024,
      });
      (audioCacheUtils.saveCacheMetadata as jest.Mock).mockResolvedValue(
        undefined
      );
    });

    it("should return cached URL if file exists and is valid", async () => {
      const cachedAudio = {
        originalUrl: "https://example.com/audio.mp3",
        localPath: "/cache/hash.mp3",
        downloadTime: Date.now(),
        fileSize: 1024,
      };

      // Mock service state
      (service as any).state.cachedFiles.set(
        "https://example.com/audio.mp3",
        cachedAudio
      );
      (service as any).state.currentCacheSize = 1024;

      const result = await service.getCachedAudioUrl(
        "https://example.com/audio.mp3"
      );

      expect(result).toBe("/cache/hash.mp3");
      expect(audioCacheUtils.validateCachedFile).toHaveBeenCalledWith(
        cachedAudio,
        mockFileSystem
      );
    });

    it("should remove invalid cached file and download again", async () => {
      const cachedAudio = {
        originalUrl: "https://example.com/audio.mp3",
        localPath: "/cache/hash.mp3",
        downloadTime: Date.now(),
        fileSize: 1024,
      };

      // Mock service state
      (service as any).state.cachedFiles.set(
        "https://example.com/audio.mp3",
        cachedAudio
      );
      (service as any).state.currentCacheSize = 1024;

      // Mock invalid file
      (audioCacheUtils.validateCachedFile as jest.Mock).mockResolvedValue(
        false
      );

      const result = await service.getCachedAudioUrl(
        "https://example.com/audio.mp3"
      );

      expect(result).toBe("/cache/hash.mp3");
      expect(audioCacheUtils.downloadAndCache).toHaveBeenCalledWith(
        "https://example.com/audio.mp3",
        expect.any(String),
        expect.any(Map),
        0, // currentCacheSize after removal
        expect.any(Number),
        mockFileSystem
      );
    });

    it("should download and cache new file", async () => {
      const result = await service.getCachedAudioUrl(
        "https://example.com/audio.mp3"
      );

      expect(result).toBe("/cache/hash.mp3");
      expect(audioCacheUtils.downloadAndCache).toHaveBeenCalledWith(
        "https://example.com/audio.mp3",
        expect.any(String),
        expect.any(Map),
        0,
        expect.any(Number),
        mockFileSystem
      );
    });

    it("should return original URL for invalid input", async () => {
      const result = await service.getCachedAudioUrl("");
      expect(result).toBe("");

      const result2 = await service.getCachedAudioUrl(null as any);
      expect(result2).toBe(null);
    });

    it("should return original URL on error", async () => {
      (audioCacheUtils.downloadAndCache as jest.Mock).mockRejectedValue(
        new Error("Network error")
      );

      const result = await service.getCachedAudioUrl(
        "https://example.com/audio.mp3"
      );

      expect(result).toBe("https://example.com/audio.mp3");
    });
  });

  describe("preloadTracks", () => {
    let service: AudioCacheService;

    beforeEach(() => {
      service = AudioCacheService.getInstance(mockFileSystem as any);
      (audioCacheUtils.preloadTracks as jest.Mock).mockResolvedValue(undefined);
    });

    it("should preload tracks successfully", async () => {
      const tracks = [
        { id: "1", title: "Track 1", artist: "Artist 1", url: "url1" },
        { id: "2", title: "Track 2", artist: "Artist 2", url: "url2" },
      ];

      await service.preloadTracks(tracks, 0, 2);

      expect(audioCacheUtils.preloadTracks).toHaveBeenCalledWith(
        tracks,
        0,
        2,
        expect.any(Function)
      );
    });

    it("should not preload if already preloading", async () => {
      const tracks = [
        { id: "1", title: "Track 1", artist: "Artist 1", url: "url1" },
      ];

      // Set preloading state
      (service as any).state.isPreloading = true;

      await service.preloadTracks(tracks, 0, 1);

      expect(audioCacheUtils.preloadTracks).not.toHaveBeenCalled();
    });

    it("should handle preload errors gracefully", async () => {
      const tracks = [
        { id: "1", title: "Track 1", artist: "Artist 1", url: "url1" },
      ];

      (audioCacheUtils.preloadTracks as jest.Mock).mockRejectedValue(
        new Error("Preload failed")
      );

      await service.preloadTracks(tracks, 0, 1);

      expect(audioCacheUtils.preloadTracks).toHaveBeenCalled();
    });
  });

  describe("clearCache", () => {
    let service: AudioCacheService;

    beforeEach(() => {
      service = AudioCacheService.getInstance(mockFileSystem as any);
      (audioCacheUtils.clearCache as jest.Mock).mockResolvedValue(undefined);
      (audioCacheUtils.saveCacheMetadata as jest.Mock).mockResolvedValue(
        undefined
      );
    });

    it("should clear cache successfully", async () => {
      // Mock service state
      (service as any).state.cachedFiles.set("url1", {
        originalUrl: "url1",
        localPath: "/path1",
        downloadTime: Date.now(),
        fileSize: 1024,
      });
      (service as any).state.currentCacheSize = 1024;

      await service.clearCache();

      expect(audioCacheUtils.clearCache).toHaveBeenCalledWith(
        expect.any(Map),
        mockFileSystem
      );
      expect(audioCacheUtils.saveCacheMetadata).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Map),
        0,
        mockFileSystem
      );
    });

    it("should handle clear cache errors", async () => {
      (audioCacheUtils.clearCache as jest.Mock).mockRejectedValue(
        new Error("Clear failed")
      );

      await service.clearCache();

      expect(audioCacheUtils.clearCache).toHaveBeenCalled();
    });
  });

  describe("getCacheStats", () => {
    let service: AudioCacheService;

    beforeEach(() => {
      service = AudioCacheService.getInstance(mockFileSystem as any);
      (audioCacheUtils.getCacheStats as jest.Mock).mockReturnValue({
        fileCount: 2,
        totalSize: 2048,
        maxSize: 104857600,
        usagePercentage: 0.002,
      });
    });

    it("should return cache statistics", () => {
      const stats = service.getCacheStats();

      expect(stats.fileCount).toBe(2);
      expect(stats.totalSize).toBe(2048);
      expect(stats.maxSize).toBe(104857600);
      expect(stats.usagePercentage).toBe(0.002);

      expect(audioCacheUtils.getCacheStats).toHaveBeenCalledWith(
        expect.any(Map),
        0,
        expect.any(Number)
      );
    });
  });

  describe("static methods", () => {
    it("should reset instance", () => {
      const instance1 = AudioCacheService.getInstance();
      AudioCacheService.resetInstance();
      const instance2 = AudioCacheService.getInstance();

      expect(instance1).not.toBe(instance2);
    });

    it("should destroy instance", () => {
      const instance1 = AudioCacheService.getInstance();
      AudioCacheService.destroyInstance();
      const instance2 = AudioCacheService.getInstance();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe("factory functions", () => {
    it("should get service instance", () => {
      const service = getAudioCacheService();
      expect(service).toBeInstanceOf(AudioCacheService);
    });

    it("should get service instance with custom file system", () => {
      const customFileSystem = { ...mockFileSystem };
      const service = getAudioCacheService(customFileSystem as any);
      expect(service).toBeInstanceOf(AudioCacheService);
    });
  });

  describe("initialization", () => {
    it("should initialize cache on construction", async () => {
      (audioCacheUtils.initializeCacheDirectory as jest.Mock).mockResolvedValue(
        undefined
      );
      (audioCacheUtils.loadCacheMetadata as jest.Mock).mockResolvedValue({
        cachedFiles: new Map(),
        currentCacheSize: 0,
      });

      AudioCacheService.getInstance();

      // Wait for initialization
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(audioCacheUtils.initializeCacheDirectory).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object)
      );
      expect(audioCacheUtils.loadCacheMetadata).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object)
      );
    });

    it("should handle initialization errors gracefully", async () => {
      (audioCacheUtils.initializeCacheDirectory as jest.Mock).mockRejectedValue(
        new Error("Init failed")
      );

      AudioCacheService.getInstance();

      // Wait for initialization
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(audioCacheUtils.initializeCacheDirectory).toHaveBeenCalled();
    });
  });
});
