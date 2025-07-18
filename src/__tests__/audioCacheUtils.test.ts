/**
 * Tests for audioCacheUtils
 */

import * as FileSystem from "expo-file-system";
import {
  hashString,
  initializeCacheDirectory,
  loadCacheMetadata,
  saveCacheMetadata,
  generateLocalPath,
  handleLocalFileCache,
  handleRemoteFileDownload,
  downloadAndCache,
  manageCacheSize,
  clearCache,
  getCacheStats,
  validateCachedFile,
  preloadTracks,
  DEFAULT_MAX_CACHE_SIZE,
  DEFAULT_PRELOAD_COUNT,
  type CachedAudio,
  type AudioTrack,
} from "../utils/audioCacheUtils";

// Mock expo-file-system
jest.mock("expo-file-system");

// Mock fileUtils
jest.mock("../utils/fileUtils", () => ({
  getFileExtension: jest.fn((url: string) => {
    if (url.includes(".mp3")) return ".mp3";
    if (url.includes(".wav")) return ".wav";
    return ".mp3";
  }),
}));

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

describe("audioCacheUtils", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (FileSystem as any).default = mockFileSystem;
  });

  describe("hashString", () => {
    it("should generate consistent hash for same string", () => {
      const hash1 = hashString("test-url.mp3");
      const hash2 = hashString("test-url.mp3");
      expect(hash1).toBe(hash2);
    });

    it("should generate different hashes for different strings", () => {
      const hash1 = hashString("test-url1.mp3");
      const hash2 = hashString("test-url2.mp3");
      expect(hash1).not.toBe(hash2);
    });

    it("should handle empty string", () => {
      const hash = hashString("");
      expect(typeof hash).toBe("string");
      expect(hash.length).toBeGreaterThan(0);
    });
  });

  describe("initializeCacheDirectory", () => {
    it("should create directory if it doesn't exist", async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: false });
      mockFileSystem.makeDirectoryAsync.mockResolvedValue(undefined);

      await initializeCacheDirectory("/test/cache/", mockFileSystem as any);

      expect(mockFileSystem.getInfoAsync).toHaveBeenCalledWith("/test/cache/");
      expect(mockFileSystem.makeDirectoryAsync).toHaveBeenCalledWith(
        "/test/cache/",
        { intermediates: true }
      );
    });

    it("should not create directory if it already exists", async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: true });

      await initializeCacheDirectory("/test/cache/", mockFileSystem as any);

      expect(mockFileSystem.getInfoAsync).toHaveBeenCalledWith("/test/cache/");
      expect(mockFileSystem.makeDirectoryAsync).not.toHaveBeenCalled();
    });

    it("should throw error if directory creation fails", async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: false });
      mockFileSystem.makeDirectoryAsync.mockRejectedValue(
        new Error("Permission denied")
      );

      await expect(
        initializeCacheDirectory("/test/cache/", mockFileSystem as any)
      ).rejects.toThrow("Permission denied");
    });
  });

  describe("loadCacheMetadata", () => {
    it("should load existing metadata", async () => {
      const mockMetadata = {
        cachedFiles: [
          [
            "url1",
            {
              originalUrl: "url1",
              localPath: "/path1",
              downloadTime: 1000,
              fileSize: 1024,
            },
          ],
          [
            "url2",
            {
              originalUrl: "url2",
              localPath: "/path2",
              downloadTime: 2000,
              fileSize: 2048,
            },
          ],
        ],
        currentCacheSize: 3072,
      };

      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: true });
      mockFileSystem.readAsStringAsync.mockResolvedValue(
        JSON.stringify(mockMetadata)
      );

      const result = await loadCacheMetadata(
        "/test/cache/",
        mockFileSystem as any
      );

      expect(result.cachedFiles.size).toBe(2);
      expect(result.currentCacheSize).toBe(3072);
      expect(mockFileSystem.getInfoAsync).toHaveBeenCalledWith(
        "/test/cache/metadata.json"
      );
    });

    it("should return empty state if metadata doesn't exist", async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: false });

      const result = await loadCacheMetadata(
        "/test/cache/",
        mockFileSystem as any
      );

      expect(result.cachedFiles.size).toBe(0);
      expect(result.currentCacheSize).toBe(0);
    });

    it("should handle JSON parse errors gracefully", async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: true });
      mockFileSystem.readAsStringAsync.mockResolvedValue("invalid json");

      const result = await loadCacheMetadata(
        "/test/cache/",
        mockFileSystem as any
      );

      expect(result.cachedFiles.size).toBe(0);
      expect(result.currentCacheSize).toBe(0);
    });
  });

  describe("saveCacheMetadata", () => {
    it("should save metadata successfully", async () => {
      const cachedFiles = new Map<string, CachedAudio>();
      cachedFiles.set("url1", {
        originalUrl: "url1",
        localPath: "/path1",
        downloadTime: 1000,
        fileSize: 1024,
      });

      mockFileSystem.writeAsStringAsync.mockResolvedValue(undefined);

      await saveCacheMetadata(
        "/test/cache/",
        cachedFiles,
        1024,
        mockFileSystem as any
      );

      expect(mockFileSystem.writeAsStringAsync).toHaveBeenCalledWith(
        "/test/cache/metadata.json",
        expect.stringContaining("url1")
      );
    });

    it("should throw error if save fails", async () => {
      mockFileSystem.writeAsStringAsync.mockRejectedValue(
        new Error("Write failed")
      );

      await expect(
        saveCacheMetadata("/test/cache/", new Map(), 0, mockFileSystem as any)
      ).rejects.toThrow("Write failed");
    });
  });

  describe("generateLocalPath", () => {
    it("should generate path with hash and extension", () => {
      const path = generateLocalPath(
        "https://example.com/audio.mp3",
        "/cache/"
      );
      expect(path).toMatch(/^\/cache\/[a-z0-9]+\.mp3$/);
    });

    it("should handle different file extensions", () => {
      const path = generateLocalPath(
        "https://example.com/audio.wav",
        "/cache/"
      );
      expect(path).toMatch(/^\/cache\/[a-z0-9]+\.wav$/);
    });
  });

  describe("handleLocalFileCache", () => {
    it("should copy local file and add to cache", async () => {
      const cachedFiles = new Map<string, CachedAudio>();
      mockFileSystem.copyAsync.mockResolvedValue(undefined);
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: true,
        size: 1024,
      });

      const result = await handleLocalFileCache(
        "file:///local/audio.mp3",
        "/cache/hash.mp3",
        cachedFiles,
        0,
        DEFAULT_MAX_CACHE_SIZE,
        mockFileSystem as any
      );

      expect(result.localPath).toBe("/cache/hash.mp3");
      expect(result.cachedFiles.size).toBe(1);
      expect(result.currentCacheSize).toBe(1024);
      expect(mockFileSystem.copyAsync).toHaveBeenCalledWith({
        from: "file:///local/audio.mp3",
        to: "/cache/hash.mp3",
      });
    });

    it("should skip caching for zero-size files", async () => {
      const cachedFiles = new Map<string, CachedAudio>();
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: true,
        size: 0,
      });

      const result = await handleLocalFileCache(
        "file:///local/audio.mp3",
        "/cache/hash.mp3",
        cachedFiles,
        0,
        DEFAULT_MAX_CACHE_SIZE,
        mockFileSystem as any
      );

      expect(result.localPath).toBe("file:///local/audio.mp3");
      expect(result.cachedFiles.size).toBe(0);
      expect(result.currentCacheSize).toBe(0);
    });
  });

  describe("handleRemoteFileDownload", () => {
    it("should download remote file and add to cache", async () => {
      const cachedFiles = new Map<string, CachedAudio>();
      mockFileSystem.downloadAsync.mockResolvedValue({ status: 200 });
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: true,
        size: 2048,
      });

      const result = await handleRemoteFileDownload(
        "https://example.com/audio.mp3",
        "/cache/hash.mp3",
        cachedFiles,
        0,
        DEFAULT_MAX_CACHE_SIZE,
        mockFileSystem as any
      );

      expect(result.localPath).toBe("/cache/hash.mp3");
      expect(result.cachedFiles.size).toBe(1);
      expect(result.currentCacheSize).toBe(2048);
      expect(mockFileSystem.downloadAsync).toHaveBeenCalledWith(
        "https://example.com/audio.mp3",
        "/cache/hash.mp3"
      );
    });

    it("should return original URL if download fails", async () => {
      const cachedFiles = new Map<string, CachedAudio>();
      mockFileSystem.downloadAsync.mockResolvedValue({ status: 404 });

      const result = await handleRemoteFileDownload(
        "https://example.com/audio.mp3",
        "/cache/hash.mp3",
        cachedFiles,
        0,
        DEFAULT_MAX_CACHE_SIZE,
        mockFileSystem as any
      );

      expect(result.localPath).toBe("https://example.com/audio.mp3");
      expect(result.cachedFiles.size).toBe(0);
      expect(result.currentCacheSize).toBe(0);
    });
  });

  describe("downloadAndCache", () => {
    it("should handle local files", async () => {
      const cachedFiles = new Map<string, CachedAudio>();
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: true,
        size: 1024,
      });

      const result = await downloadAndCache(
        "file:///local/audio.mp3",
        "/cache/",
        cachedFiles,
        0,
        DEFAULT_MAX_CACHE_SIZE,
        mockFileSystem as any
      );

      expect(result.localPath).toMatch(/^\/cache\/[a-z0-9]+\.mp3$/);
      expect(result.cachedFiles.size).toBe(1);
    });

    it("should handle remote files", async () => {
      const cachedFiles = new Map<string, CachedAudio>();
      mockFileSystem.downloadAsync.mockResolvedValue({ status: 200 });
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: true,
        size: 2048,
      });

      const result = await downloadAndCache(
        "https://example.com/audio.mp3",
        "/cache/",
        cachedFiles,
        0,
        DEFAULT_MAX_CACHE_SIZE,
        mockFileSystem as any
      );

      expect(result.localPath).toMatch(/^\/cache\/[a-z0-9]+\.mp3$/);
      expect(result.cachedFiles.size).toBe(1);
    });

    it("should return original URL on error", async () => {
      const cachedFiles = new Map<string, CachedAudio>();
      mockFileSystem.downloadAsync.mockRejectedValue(
        new Error("Network error")
      );

      const result = await downloadAndCache(
        "https://example.com/audio.mp3",
        "/cache/",
        cachedFiles,
        0,
        DEFAULT_MAX_CACHE_SIZE,
        mockFileSystem as any
      );

      expect(result.localPath).toBe("https://example.com/audio.mp3");
      expect(result.cachedFiles.size).toBe(0);
    });
  });

  describe("manageCacheSize", () => {
    it("should not evict files if there's enough space", async () => {
      const cachedFiles = new Map<string, CachedAudio>();
      cachedFiles.set("url1", {
        originalUrl: "url1",
        localPath: "/path1",
        downloadTime: 1000,
        fileSize: 1024,
      });

      const result = await manageCacheSize(
        512,
        cachedFiles,
        1024,
        DEFAULT_MAX_CACHE_SIZE,
        mockFileSystem as any
      );

      expect(result.cachedFiles.size).toBe(1);
      expect(result.currentCacheSize).toBe(1024);
    });

    it("should evict old files when cache is full", async () => {
      const cachedFiles = new Map<string, CachedAudio>();
      cachedFiles.set("url1", {
        originalUrl: "url1",
        localPath: "/path1",
        downloadTime: 1000,
        fileSize: 1024,
      });
      cachedFiles.set("url2", {
        originalUrl: "url2",
        localPath: "/path2",
        downloadTime: 2000,
        fileSize: 1024,
      });

      mockFileSystem.deleteAsync.mockResolvedValue(undefined);

      const result = await manageCacheSize(
        DEFAULT_MAX_CACHE_SIZE,
        cachedFiles,
        2048, // current cache size
        DEFAULT_MAX_CACHE_SIZE,
        mockFileSystem as any
      );

      expect(result.cachedFiles.size).toBe(0);
      expect(result.currentCacheSize).toBe(0);
      expect(mockFileSystem.deleteAsync).toHaveBeenCalledTimes(2);
    });
  });

  describe("clearCache", () => {
    it("should delete all cached files", async () => {
      const cachedFiles = new Map<string, CachedAudio>();
      cachedFiles.set("url1", {
        originalUrl: "url1",
        localPath: "/path1",
        downloadTime: 1000,
        fileSize: 1024,
      });
      cachedFiles.set("url2", {
        originalUrl: "url2",
        localPath: "/path2",
        downloadTime: 2000,
        fileSize: 2048,
      });

      mockFileSystem.deleteAsync.mockResolvedValue(undefined);

      await clearCache(cachedFiles, mockFileSystem as any);

      expect(mockFileSystem.deleteAsync).toHaveBeenCalledTimes(2);
      expect(mockFileSystem.deleteAsync).toHaveBeenCalledWith("/path1");
      expect(mockFileSystem.deleteAsync).toHaveBeenCalledWith("/path2");
    });

    it("should handle deletion errors gracefully", async () => {
      const cachedFiles = new Map<string, CachedAudio>();
      cachedFiles.set("url1", {
        originalUrl: "url1",
        localPath: "/path1",
        downloadTime: 1000,
        fileSize: 1024,
      });

      mockFileSystem.deleteAsync.mockRejectedValue(new Error("File not found"));

      // clearCache should not throw for individual file errors
      await clearCache(cachedFiles, mockFileSystem as any);

      expect(mockFileSystem.deleteAsync).toHaveBeenCalledWith("/path1");
    });
  });

  describe("getCacheStats", () => {
    it("should return correct statistics", () => {
      const cachedFiles = new Map<string, CachedAudio>();
      cachedFiles.set("url1", {
        originalUrl: "url1",
        localPath: "/path1",
        downloadTime: 1000,
        fileSize: 1024,
      });
      cachedFiles.set("url2", {
        originalUrl: "url2",
        localPath: "/path2",
        downloadTime: 2000,
        fileSize: 2048,
      });

      const stats = getCacheStats(cachedFiles, 3072, DEFAULT_MAX_CACHE_SIZE);

      expect(stats.fileCount).toBe(2);
      expect(stats.totalSize).toBe(3072);
      expect(stats.maxSize).toBe(DEFAULT_MAX_CACHE_SIZE);
      expect(stats.usagePercentage).toBe((3072 / DEFAULT_MAX_CACHE_SIZE) * 100);
    });
  });

  describe("validateCachedFile", () => {
    it("should return true for existing file", async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: true });

      const cached: CachedAudio = {
        originalUrl: "url1",
        localPath: "/path1",
        downloadTime: 1000,
        fileSize: 1024,
      };

      const isValid = await validateCachedFile(cached, mockFileSystem as any);

      expect(isValid).toBe(true);
      expect(mockFileSystem.getInfoAsync).toHaveBeenCalledWith("/path1");
    });

    it("should return false for non-existing file", async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: false });

      const cached: CachedAudio = {
        originalUrl: "url1",
        localPath: "/path1",
        downloadTime: 1000,
        fileSize: 1024,
      };

      const isValid = await validateCachedFile(cached, mockFileSystem as any);

      expect(isValid).toBe(false);
    });

    it("should return false on error", async () => {
      mockFileSystem.getInfoAsync.mockRejectedValue(new Error("Access denied"));

      const cached: CachedAudio = {
        originalUrl: "url1",
        localPath: "/path1",
        downloadTime: 1000,
        fileSize: 1024,
      };

      const isValid = await validateCachedFile(cached, mockFileSystem as any);

      expect(isValid).toBe(false);
    });
  });

  describe("preloadTracks", () => {
    it("should preload tracks successfully", async () => {
      const tracks: AudioTrack[] = [
        { id: "1", title: "Track 1", artist: "Artist 1", url: "url1" },
        { id: "2", title: "Track 2", artist: "Artist 2", url: "url2" },
        { id: "3", title: "Track 3", artist: "Artist 3", url: "url3" },
      ];

      const mockGetCachedAudioUrl = jest.fn().mockResolvedValue("cached-url");

      await preloadTracks(tracks, 0, 2, mockGetCachedAudioUrl);

      expect(mockGetCachedAudioUrl).toHaveBeenCalledTimes(3);
      expect(mockGetCachedAudioUrl).toHaveBeenCalledWith("url1");
      expect(mockGetCachedAudioUrl).toHaveBeenCalledWith("url2");
      expect(mockGetCachedAudioUrl).toHaveBeenCalledWith("url3");
    });

    it("should handle empty tracks array", async () => {
      const tracks: AudioTrack[] = [];
      const mockGetCachedAudioUrl = jest.fn();

      await preloadTracks(tracks, 0, 5, mockGetCachedAudioUrl);

      expect(mockGetCachedAudioUrl).not.toHaveBeenCalled();
    });

    it("should handle tracks without URLs", async () => {
      const tracks: AudioTrack[] = [
        { id: "1", title: "Track 1", artist: "Artist 1", url: "" },
        { id: "2", title: "Track 2", artist: "Artist 2", url: "url2" },
      ];

      const mockGetCachedAudioUrl = jest.fn().mockResolvedValue("cached-url");

      await preloadTracks(tracks, 0, 2, mockGetCachedAudioUrl);

      expect(mockGetCachedAudioUrl).toHaveBeenCalledTimes(1);
      expect(mockGetCachedAudioUrl).toHaveBeenCalledWith("url2");
    });
  });

  describe("constants", () => {
    it("should export correct default values", () => {
      expect(DEFAULT_MAX_CACHE_SIZE).toBe(100 * 1024 * 1024); // 100MB
      expect(DEFAULT_PRELOAD_COUNT).toBe(5);
    });
  });
});
