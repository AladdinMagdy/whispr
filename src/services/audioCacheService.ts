/**
 * Audio Cache Service for Whispr
 * Downloads and caches audio files locally for faster playback
 */

import * as FileSystem from "expo-file-system";
import { getFileExtension } from "../utils/fileUtils";

// Types
export interface AudioTrack {
  id: string;
  title: string;
  artist: string;
  artwork?: string;
  url: string;
}

interface CachedAudio {
  originalUrl: string;
  localPath: string;
  downloadTime: number;
  fileSize: number;
}

interface AudioCacheState {
  cachedFiles: Map<string, CachedAudio>;
  maxCacheSize: number; // 100MB default
  currentCacheSize: number;
  preloadQueue: string[];
  isPreloading: boolean;
}

interface FileInfo {
  exists: boolean;
  size?: number;
}

// Default file system for dependency injection
const DefaultFileSystem = FileSystem;

// Utility: Hash string for filename
export function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

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
      maxCacheSize: 100 * 1024 * 1024, // 100MB
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
      const dirInfo = await this.fileSystem.getInfoAsync(this.cacheDir);
      if (!dirInfo.exists) {
        await this.fileSystem.makeDirectoryAsync(this.cacheDir, {
          intermediates: true,
        });
        console.log("📁 Created audio cache directory");
      }

      // Load existing cache metadata
      await this.loadCacheMetadata();
      console.log("✅ Audio cache initialized");
    } catch (error) {
      console.error("❌ Error initializing audio cache:", error);
    }
  }

  /**
   * Load cache metadata from storage
   */
  private async loadCacheMetadata(): Promise<void> {
    try {
      const metadataPath = `${this.cacheDir}metadata.json`;
      const metadataInfo = await this.fileSystem.getInfoAsync(metadataPath);

      if (metadataInfo.exists) {
        const metadataContent = await this.fileSystem.readAsStringAsync(
          metadataPath
        );
        const metadata = JSON.parse(metadataContent);

        this.state.cachedFiles = new Map(metadata.cachedFiles);
        this.state.currentCacheSize = metadata.currentCacheSize || 0;

        console.log(
          `📊 Loaded ${this.state.cachedFiles.size} cached audio files`
        );
      }
    } catch (error) {
      console.error("❌ Error loading cache metadata:", error);
    }
  }

  /**
   * Save cache metadata to storage
   */
  private async saveCacheMetadata(): Promise<void> {
    try {
      const metadataPath = `${this.cacheDir}metadata.json`;
      const metadata = {
        cachedFiles: Array.from(this.state.cachedFiles.entries()),
        currentCacheSize: this.state.currentCacheSize,
        timestamp: Date.now(),
      };

      await this.fileSystem.writeAsStringAsync(
        metadataPath,
        JSON.stringify(metadata)
      );
    } catch (error) {
      console.error("❌ Error saving cache metadata:", error);
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
        try {
          const fileInfo = await this.fileSystem.getInfoAsync(cached.localPath);
          if (fileInfo.exists) {
            console.log(`✅ Using cached audio: ${originalUrl}`);
            return cached.localPath;
          } else {
            // File was deleted, remove from cache
            console.log(
              `🗑️ Cached file not found, removing from cache: ${originalUrl}`
            );
            this.state.cachedFiles.delete(originalUrl);
            this.state.currentCacheSize -= cached.fileSize;
            await this.saveCacheMetadata();
          }
        } catch (fileError) {
          console.warn(
            `⚠️ Error checking cached file ${originalUrl}:`,
            fileError
          );
          // Remove from cache if we can't access the file
          this.state.cachedFiles.delete(originalUrl);
          this.state.currentCacheSize -= cached.fileSize;
          await this.saveCacheMetadata();
        }
      }

      // Download and cache the file
      console.log(`🔍 About to call downloadAndCache for: ${originalUrl}`);
      const result = await this.downloadAndCache(originalUrl);
      console.log(`🔍 downloadAndCache returned: ${result}`);
      return result;
    } catch (error) {
      console.error(`❌ Error in getCachedAudioUrl for ${originalUrl}:`, error);
      // Return original URL as fallback
      return originalUrl;
    }
  }

  /**
   * Handle local file caching
   */
  private async handleLocalFileCache(
    originalUrl: string,
    localPath: string
  ): Promise<string> {
    // Local file, just copy it to cache if not already there
    if (originalUrl !== localPath) {
      await this.fileSystem.copyAsync({ from: originalUrl, to: localPath });
    }

    const fileInfo = (await this.fileSystem.getInfoAsync(localPath, {
      size: true,
    })) as FileInfo;

    const fileSize =
      fileInfo.exists && typeof fileInfo.size === "number" ? fileInfo.size : 0;

    // Return original URL if file size is 0 (invalid file)
    if (fileSize === 0) {
      console.warn(`⚠️ Skipping cache for zero-size file: ${originalUrl}`);
      console.log("DEBUG: fileInfo in handleLocalFileCache", fileInfo);
      console.log("DEBUG: fileSize in handleLocalFileCache", fileSize);
      return originalUrl;
    }

    await this.manageCacheSize(fileSize);

    const cachedAudio: CachedAudio = {
      originalUrl,
      localPath,
      downloadTime: Date.now(),
      fileSize,
    };

    this.state.cachedFiles.set(originalUrl, cachedAudio);
    this.state.currentCacheSize += fileSize;
    await this.saveCacheMetadata();

    console.log(
      `✅ Local audio cached: ${originalUrl} (${(
        fileSize /
        1024 /
        1024
      ).toFixed(2)}MB)`
    );

    return localPath;
  }

  /**
   * Handle remote file downloading
   */
  private async handleRemoteFileDownload(
    originalUrl: string,
    localPath: string
  ): Promise<string> {
    // Remote file, download
    const result = await this.fileSystem.downloadAsync(originalUrl, localPath);

    if (result.status !== 200) {
      console.error(`❌ Download failed with status: ${result.status}`);
      return originalUrl;
    }

    // Get file info for size calculation
    const fileInfo = (await this.fileSystem.getInfoAsync(localPath, {
      size: true,
    })) as FileInfo;

    if (!fileInfo.exists) {
      console.error("❌ Downloaded file not found");
      return originalUrl;
    }

    const fileSize = typeof fileInfo.size === "number" ? fileInfo.size : 0;

    // Return original URL if file size is 0 (invalid file)
    if (fileSize === 0) {
      console.warn(`⚠️ Skipping cache for zero-size file: ${originalUrl}`);
      return originalUrl;
    }

    // Manage cache size before adding new file
    await this.manageCacheSize(fileSize);

    // Add to cache
    const cachedAudio: CachedAudio = {
      originalUrl,
      localPath,
      downloadTime: Date.now(),
      fileSize,
    };

    this.state.cachedFiles.set(originalUrl, cachedAudio);
    this.state.currentCacheSize += fileSize;

    // Save metadata
    await this.saveCacheMetadata();

    console.log(
      `✅ Audio cached: ${originalUrl} (${(fileSize / 1024 / 1024).toFixed(
        2
      )}MB)`
    );

    return localPath;
  }

  /**
   * Download and cache audio file
   */
  private async downloadAndCache(originalUrl: string): Promise<string> {
    try {
      console.log(`📥 Downloading audio: ${originalUrl}`);

      // Generate unique filename
      const fileHash = hashString(originalUrl);
      const fileExtension = getFileExtension(originalUrl);
      const localPath = `${this.cacheDir}${fileHash}${fileExtension}`;

      console.log(`🔍 Generated path: ${localPath}`);
      console.log(`🔍 File extension: ${fileExtension}`);
      console.log(`🔍 Hash: ${fileHash}`);

      if (originalUrl.startsWith("file://")) {
        console.log(`📁 Handling local file: ${originalUrl}`);
        const result = await this.handleLocalFileCache(originalUrl, localPath);
        console.log(`📁 Local file result: ${result}`);
        return result;
      } else {
        console.log(`🌐 Handling remote file: ${originalUrl}`);
        const result = await this.handleRemoteFileDownload(
          originalUrl,
          localPath
        );
        console.log(`🌐 Remote file result: ${result}`);
        return result;
      }
    } catch (error) {
      console.error(`❌ Error downloading audio ${originalUrl}:`, error);
      return originalUrl;
    }
  }

  /**
   * Preload audio tracks for smooth playback
   */
  async preloadTracks(
    tracks: AudioTrack[],
    currentIndex: number,
    preloadCount: number = 5
  ): Promise<void> {
    if (this.state.isPreloading) {
      return; // Already preloading
    }

    this.state.isPreloading = true;

    try {
      const startIndex = Math.max(0, currentIndex);
      const endIndex = Math.min(tracks.length - 1, currentIndex + preloadCount);

      const preloadPromises: Promise<void>[] = [];

      for (let i = startIndex; i <= endIndex; i++) {
        const track = tracks[i];
        if (track && track.url) {
          preloadPromises.push(
            this.getCachedAudioUrl(track.url).then(() => {
              console.log(`📦 Preloaded track: ${track.id}`);
            })
          );
        }
      }

      await Promise.allSettled(preloadPromises);
    } catch (error) {
      console.error("❌ Error preloading tracks:", error);
    } finally {
      this.state.isPreloading = false;
    }
  }

  /**
   * Manage cache size by evicting old files if necessary
   */
  private async manageCacheSize(newFileSize: number): Promise<void> {
    if (this.state.currentCacheSize + newFileSize <= this.state.maxCacheSize) {
      return; // No need to evict
    }

    console.log("🧹 Managing cache size...");

    // Sort files by download time (oldest first)
    const sortedFiles = Array.from(this.state.cachedFiles.entries()).sort(
      ([, a], [, b]) => a.downloadTime - b.downloadTime
    );

    // Evict files until we have enough space
    for (const [url, cached] of sortedFiles) {
      try {
        await this.fileSystem.deleteAsync(cached.localPath);
        this.state.cachedFiles.delete(url);
        this.state.currentCacheSize -= cached.fileSize;

        console.log(`🗑️ Evicted cached file: ${url}`);

        if (
          this.state.currentCacheSize + newFileSize <=
          this.state.maxCacheSize
        ) {
          break;
        }
      } catch (error) {
        console.error(`❌ Error evicting file ${url}:`, error);
      }
    }

    await this.saveCacheMetadata();
  }

  /**
   * Clear all cached files
   */
  async clearCache(): Promise<void> {
    try {
      console.log("🧹 Clearing audio cache...");

      // Delete all cached files
      for (const [url, cached] of this.state.cachedFiles) {
        try {
          await this.fileSystem.deleteAsync(cached.localPath);
        } catch (error) {
          console.warn(`⚠️ Error deleting cached file ${url}:`, error);
        }
      }

      // Clear state
      this.state.cachedFiles.clear();
      this.state.currentCacheSize = 0;

      // Save empty metadata
      await this.saveCacheMetadata();

      console.log("✅ Audio cache cleared");
    } catch (error) {
      console.error("❌ Error clearing cache:", error);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    fileCount: number;
    totalSize: number;
    maxSize: number;
    usagePercentage: number;
  } {
    return {
      fileCount: this.state.cachedFiles.size,
      totalSize: this.state.currentCacheSize,
      maxSize: this.state.maxCacheSize,
      usagePercentage:
        (this.state.currentCacheSize / this.state.maxCacheSize) * 100,
    };
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
