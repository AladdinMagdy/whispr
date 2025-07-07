/**
 * Audio Cache Service for Whispr
 * Downloads and caches audio files locally for faster playback
 */

import * as FileSystem from "expo-file-system";

// Local type definition for audio tracks
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

export class AudioCacheService {
  private static instance: AudioCacheService;
  private state: AudioCacheState;
  private cacheDir: string;

  private constructor() {
    this.state = {
      cachedFiles: new Map(),
      maxCacheSize: 100 * 1024 * 1024, // 100MB
      currentCacheSize: 0,
      preloadQueue: [],
      isPreloading: false,
    };
    this.cacheDir = `${FileSystem.cacheDirectory}whispr-audio/`;
    this.initializeCache();
  }

  static getInstance(): AudioCacheService {
    if (!AudioCacheService.instance) {
      AudioCacheService.instance = new AudioCacheService();
    }
    return AudioCacheService.instance;
  }

  /**
   * Initialize cache directory and load existing cache
   */
  private async initializeCache(): Promise<void> {
    try {
      // Create cache directory if it doesn't exist
      const dirInfo = await FileSystem.getInfoAsync(this.cacheDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.cacheDir, {
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
      const metadataInfo = await FileSystem.getInfoAsync(metadataPath);

      if (metadataInfo.exists) {
        const metadataContent = await FileSystem.readAsStringAsync(
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

      await FileSystem.writeAsStringAsync(
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
      const cached = this.state.cachedFiles.get(originalUrl);

      if (cached) {
        // Check if file still exists
        try {
          const fileInfo = await FileSystem.getInfoAsync(cached.localPath);
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
      return await this.downloadAndCache(originalUrl);
    } catch (error) {
      console.error(`❌ Error in getCachedAudioUrl for ${originalUrl}:`, error);
      return originalUrl;
    }
  }

  /**
   * Download and cache an audio file
   */
  private async downloadAndCache(originalUrl: string): Promise<string> {
    try {
      // Validate URL before attempting download
      if (!originalUrl || typeof originalUrl !== "string") {
        console.warn(
          "❌ Invalid URL provided to downloadAndCache:",
          originalUrl
        );
        return originalUrl;
      }

      // Check if URL is properly formatted
      try {
        new URL(originalUrl);
      } catch (error) {
        console.warn("❌ Malformed URL:", originalUrl);
        return originalUrl;
      }

      console.log(`⬇️ Downloading audio: ${originalUrl}`);

      // Generate unique filename
      const urlHash = this.hashString(originalUrl);
      const fileExtension = this.getFileExtension(originalUrl);
      const localPath = `${this.cacheDir}${urlHash}${fileExtension}`;

      if (originalUrl.startsWith("file://")) {
        // Local file, just copy it to cache if not already there
        if (originalUrl !== localPath) {
          await FileSystem.copyAsync({ from: originalUrl, to: localPath });
        }
        const fileInfo = await FileSystem.getInfoAsync(localPath, {
          size: true,
        });
        const fileSize = (fileInfo as any).size || 0;
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
      } else {
        // Remote file, download with better error handling
        try {
          const downloadResult = await FileSystem.downloadAsync(
            originalUrl,
            localPath
          );

          if (downloadResult.status === 200) {
            // Get file size
            const fileInfo = await FileSystem.getInfoAsync(localPath, {
              size: true,
            });
            const fileSize = (fileInfo as any).size || 0;

            // Check cache size and evict if necessary
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
              `✅ Audio cached: ${originalUrl} (${(
                fileSize /
                1024 /
                1024
              ).toFixed(2)}MB)`
            );
            return localPath;
          } else {
            console.warn(
              `❌ Download failed with status ${downloadResult.status} for ${originalUrl}`
            );
            return originalUrl;
          }
        } catch (downloadError) {
          console.error(`❌ Download error for ${originalUrl}:`, downloadError);
          return originalUrl;
        }
      }
    } catch (error) {
      console.error(`❌ Error caching audio ${originalUrl}:`, error);
      // Return original URL as fallback
      return originalUrl;
    }
  }

  /**
   * Preload next N tracks intelligently
   */
  async preloadTracks(
    tracks: AudioTrack[],
    currentIndex: number,
    preloadCount: number = 5
  ): Promise<void> {
    if (this.state.isPreloading) {
      console.log("⏳ Already preloading, skipping...");
      return;
    }

    // Validate inputs
    if (!tracks || !Array.isArray(tracks) || tracks.length === 0) {
      console.warn("❌ Invalid tracks array provided to preloadTracks");
      return;
    }

    if (typeof currentIndex !== "number" || currentIndex < 0) {
      console.warn(
        "❌ Invalid currentIndex provided to preloadTracks:",
        currentIndex
      );
      return;
    }

    this.state.isPreloading = true;
    console.log(
      `🚀 Starting preload of ${preloadCount} tracks from index ${currentIndex}`
    );

    try {
      const preloadPromises: Promise<void>[] = [];

      // Preload next N tracks
      for (let i = 1; i <= preloadCount; i++) {
        const trackIndex = currentIndex + i;
        if (trackIndex < tracks.length) {
          const track = tracks[trackIndex];
          if (track && track.url) {
            preloadPromises.push(
              this.getCachedAudioUrl(track.url)
                .then(() => {
                  console.log(
                    `✅ Preloaded track ${trackIndex}: ${track.title}`
                  );
                })
                .catch((error) => {
                  console.warn(
                    `⚠️ Failed to preload track ${trackIndex}:`,
                    error
                  );
                })
            );
          }
        }
      }

      // Also preload first N tracks if we're at the beginning
      if (currentIndex < preloadCount) {
        for (let i = 0; i < preloadCount && i < tracks.length; i++) {
          if (i !== currentIndex) {
            const track = tracks[i];
            if (track && track.url) {
              preloadPromises.push(
                this.getCachedAudioUrl(track.url)
                  .then(() => {
                    console.log(`✅ Preloaded track ${i}: ${track.title}`);
                  })
                  .catch((error) => {
                    console.warn(`⚠️ Failed to preload track ${i}:`, error);
                  })
              );
            }
          }
        }
      }

      await Promise.allSettled(preloadPromises);
      console.log("🎉 Preload completed");
    } catch (error) {
      console.error("❌ Error during preload:", error);
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
        await FileSystem.deleteAsync(cached.localPath);
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
      console.log("🗑️ Clearing audio cache...");

      // Delete all cached files
      for (const [url, cached] of this.state.cachedFiles) {
        try {
          await FileSystem.deleteAsync(cached.localPath);
        } catch (error) {
          console.error(`❌ Error deleting ${url}:`, error);
        }
      }

      // Reset state
      this.state.cachedFiles.clear();
      this.state.currentCacheSize = 0;
      this.state.preloadQueue = [];
      this.state.isPreloading = false;

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
    const usagePercentage =
      (this.state.currentCacheSize / this.state.maxCacheSize) * 100;

    return {
      fileCount: this.state.cachedFiles.size,
      totalSize: this.state.currentCacheSize,
      maxSize: this.state.maxCacheSize,
      usagePercentage,
    };
  }

  /**
   * Utility: Hash string for filename
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Utility: Get file extension from URL
   */
  private getFileExtension(url: string): string {
    const match = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    return match ? `.${match[1]}` : ".mp3";
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
      AudioCacheService.instance = null as any;
      console.log("🗑️ AudioCacheService singleton destroyed");
    }
  }
}

/**
 * Factory function to get AudioCacheService instance
 */
export const getAudioCacheService = (): AudioCacheService => {
  return AudioCacheService.getInstance();
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
