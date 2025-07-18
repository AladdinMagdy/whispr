/**
 * Audio Cache Service for Whispr
 * Downloads and caches audio files locally for faster playback
 */

import * as FileSystem from "expo-file-system";
import {
  AudioTrack,
  AudioCacheState,
  CacheStats,
  DEFAULT_MAX_CACHE_SIZE,
  DEFAULT_PRELOAD_COUNT,
  initializeCacheDirectory,
  loadCacheMetadata,
  saveCacheMetadata,
  downloadAndCache,
  clearCache as clearCacheUtil,
  getCacheStats as getCacheStatsUtil,
  validateCachedFile,
  preloadTracks as preloadTracksUtil,
} from "../utils/audioCacheUtils";

// Default file system for dependency injection
const DefaultFileSystem = FileSystem;

export class AudioCacheService {
  private static instance: AudioCacheService;
  private state: AudioCacheState;
  private cacheDir: string;
  private fileSystem: typeof DefaultFileSystem;

  private constructor(
    fileSystem: typeof DefaultFileSystem = DefaultFileSystem
  ) {
    this.state = {
      cachedFiles: new Map(),
      maxCacheSize: DEFAULT_MAX_CACHE_SIZE,
      currentCacheSize: 0,
      preloadQueue: [],
      isPreloading: false,
    };
    this.cacheDir = `${fileSystem.cacheDirectory}whispr-audio/`;
    this.fileSystem = fileSystem;
    this.initializeCache();
  }

  static getInstance(fileSystem?: typeof DefaultFileSystem): AudioCacheService {
    if (!AudioCacheService.instance) {
      AudioCacheService.instance = new AudioCacheService(fileSystem);
    }
    return AudioCacheService.instance;
  }

  /**
   * Initialize cache directory and load existing cache
   */
  private async initializeCache(): Promise<void> {
    try {
      // Create cache directory if it doesn't exist
      await initializeCacheDirectory(this.cacheDir, this.fileSystem);

      // Load existing cache metadata
      const { cachedFiles, currentCacheSize } = await loadCacheMetadata(
        this.cacheDir,
        this.fileSystem
      );
      this.state.cachedFiles = cachedFiles;
      this.state.currentCacheSize = currentCacheSize;

      console.log("✅ Audio cache initialized");
    } catch (error) {
      console.error("❌ Error initializing audio cache:", error);
    }
  }

  /**
   * Get cached audio URL or download if not cached
   */
  async getCachedAudioUrl(originalUrl: string): Promise<string> {
    // Validate input
    if (!originalUrl || typeof originalUrl !== "string") {
      console.warn(
        "❌ Invalid URL provided to getCachedAudioUrl:",
        originalUrl
      );
      return originalUrl;
    }

    try {
      console.log(`🔍 Cache state: ${this.state.cachedFiles.size} files`);
      console.log(`🔍 Looking for: ${originalUrl}`);
      const cached = this.state.cachedFiles.get(originalUrl);
      console.log(`🔍 Found in cache: ${cached ? "yes" : "no"}`);

      if (cached) {
        // Check if file still exists
        const isValid = await validateCachedFile(cached, this.fileSystem);
        if (isValid) {
          console.log(`✅ Using cached audio: ${originalUrl}`);
          return cached.localPath;
        } else {
          // File was deleted, remove from cache
          console.log(
            `🗑️ Cached file not found, removing from cache: ${originalUrl}`
          );
          this.state.cachedFiles.delete(originalUrl);
          this.state.currentCacheSize -= cached.fileSize;
          await saveCacheMetadata(
            this.cacheDir,
            this.state.cachedFiles,
            this.state.currentCacheSize,
            this.fileSystem
          );
        }
      }

      // Download and cache the file
      console.log(`🔍 About to call downloadAndCache for: ${originalUrl}`);
      const result = await downloadAndCache(
        originalUrl,
        this.cacheDir,
        this.state.cachedFiles,
        this.state.currentCacheSize,
        this.state.maxCacheSize,
        this.fileSystem
      );
      console.log(`🔍 downloadAndCache returned: ${result.localPath}`);

      // Update state with results
      this.state.cachedFiles = result.cachedFiles;
      this.state.currentCacheSize = result.currentCacheSize;

      // Save metadata
      await saveCacheMetadata(
        this.cacheDir,
        this.state.cachedFiles,
        this.state.currentCacheSize,
        this.fileSystem
      );

      return result.localPath;
    } catch (error) {
      console.error(`❌ Error in getCachedAudioUrl for ${originalUrl}:`, error);
      // Return original URL as fallback
      return originalUrl;
    }
  }

  /**
   * Preload audio tracks for smooth playback
   */
  async preloadTracks(
    tracks: AudioTrack[],
    currentIndex: number,
    preloadCount: number = DEFAULT_PRELOAD_COUNT
  ): Promise<void> {
    if (this.state.isPreloading) {
      return; // Already preloading
    }

    this.state.isPreloading = true;

    try {
      await preloadTracksUtil(
        tracks,
        currentIndex,
        preloadCount,
        (url: string) => this.getCachedAudioUrl(url)
      );
    } catch (error) {
      console.error("❌ Error preloading tracks:", error);
    } finally {
      this.state.isPreloading = false;
    }
  }

  /**
   * Clear all cached files
   */
  async clearCache(): Promise<void> {
    try {
      await clearCacheUtil(this.state.cachedFiles, this.fileSystem);

      // Clear state
      this.state.cachedFiles.clear();
      this.state.currentCacheSize = 0;

      // Save empty metadata
      await saveCacheMetadata(
        this.cacheDir,
        this.state.cachedFiles,
        this.state.currentCacheSize,
        this.fileSystem
      );
    } catch (error) {
      console.error("❌ Error clearing cache:", error);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    return getCacheStatsUtil(
      this.state.cachedFiles,
      this.state.currentCacheSize,
      this.state.maxCacheSize
    );
  }

  /**
   * Reset singleton instance
   */
  static resetInstance(): void {
    if (AudioCacheService.instance) {
      AudioCacheService.instance = new AudioCacheService();
      console.log("🔄 AudioCacheService singleton reset successfully");
    }
  }

  /**
   * Destroy singleton instance
   */
  static destroyInstance(): void {
    if (AudioCacheService.instance) {
      AudioCacheService.instance = null as unknown as AudioCacheService;
      console.log("🗑️ AudioCacheService singleton destroyed");
    }
  }
}

/**
 * Factory function to get AudioCacheService instance
 */
export const getAudioCacheService = (
  fileSystem?: typeof DefaultFileSystem
): AudioCacheService => {
  return AudioCacheService.getInstance(fileSystem);
};

/**
 * Reset the AudioCacheService singleton instance
 */
export const resetAudioCacheService = (): void => {
  AudioCacheService.resetInstance();
};

/**
 * Destroy the AudioCacheService singleton instance
 */
export const destroyAudioCacheService = (): void => {
  AudioCacheService.destroyInstance();
};
