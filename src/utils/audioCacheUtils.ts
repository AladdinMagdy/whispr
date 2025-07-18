/**
 * Audio Cache Utilities for Whispr
 * Utility functions for audio caching operations
 */

import * as FileSystem from "expo-file-system";
import { getFileExtension } from "./fileUtils";

// Types
export interface AudioTrack {
  id: string;
  title: string;
  artist: string;
  artwork?: string;
  url: string;
}

export interface CachedAudio {
  originalUrl: string;
  localPath: string;
  downloadTime: number;
  fileSize: number;
}

export interface AudioCacheState {
  cachedFiles: Map<string, CachedAudio>;
  maxCacheSize: number; // 100MB default
  currentCacheSize: number;
  preloadQueue: string[];
  isPreloading: boolean;
}

export interface FileInfo {
  exists: boolean;
  size?: number;
}

export interface CacheStats {
  fileCount: number;
  totalSize: number;
  maxSize: number;
  usagePercentage: number;
}

// Constants
export const DEFAULT_MAX_CACHE_SIZE = 100 * 1024 * 1024; // 100MB
export const DEFAULT_PRELOAD_COUNT = 5;

// Default file system for dependency injection
const DefaultFileSystem = FileSystem;

/**
 * Hash string for filename generation
 */
export function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Initialize cache directory
 */
export async function initializeCacheDirectory(
  cacheDir: string,
  fileSystem: typeof DefaultFileSystem = DefaultFileSystem
): Promise<void> {
  try {
    // Create cache directory if it doesn't exist
    const dirInfo = await fileSystem.getInfoAsync(cacheDir);
    if (!dirInfo.exists) {
      await fileSystem.makeDirectoryAsync(cacheDir, {
        intermediates: true,
      });
      console.log("📁 Created audio cache directory");
    }
  } catch (error) {
    console.error("❌ Error creating cache directory:", error);
    throw error;
  }
}

/**
 * Load cache metadata from storage
 */
export async function loadCacheMetadata(
  cacheDir: string,
  fileSystem: typeof DefaultFileSystem = DefaultFileSystem
): Promise<{
  cachedFiles: Map<string, CachedAudio>;
  currentCacheSize: number;
}> {
  try {
    const metadataPath = `${cacheDir}metadata.json`;
    const metadataInfo = await fileSystem.getInfoAsync(metadataPath);

    if (metadataInfo.exists) {
      const metadataContent = await fileSystem.readAsStringAsync(metadataPath);
      const metadata = JSON.parse(metadataContent);

      const cachedFiles = new Map(
        metadata.cachedFiles as [string, CachedAudio][]
      );
      const currentCacheSize = metadata.currentCacheSize || 0;

      console.log(`📊 Loaded ${cachedFiles.size} cached audio files`);
      return { cachedFiles, currentCacheSize };
    }

    return { cachedFiles: new Map(), currentCacheSize: 0 };
  } catch (error) {
    console.error("❌ Error loading cache metadata:", error);
    return { cachedFiles: new Map(), currentCacheSize: 0 };
  }
}

/**
 * Save cache metadata to storage
 */
export async function saveCacheMetadata(
  cacheDir: string,
  cachedFiles: Map<string, CachedAudio>,
  currentCacheSize: number,
  fileSystem: typeof DefaultFileSystem = DefaultFileSystem
): Promise<void> {
  try {
    const metadataPath = `${cacheDir}metadata.json`;
    const metadata = {
      cachedFiles: Array.from(cachedFiles.entries()),
      currentCacheSize,
      timestamp: Date.now(),
    };

    await fileSystem.writeAsStringAsync(metadataPath, JSON.stringify(metadata));
  } catch (error) {
    console.error("❌ Error saving cache metadata:", error);
    throw error;
  }
}

/**
 * Generate local file path for caching
 */
export function generateLocalPath(
  originalUrl: string,
  cacheDir: string
): string {
  const fileHash = hashString(originalUrl);
  const fileExtension = getFileExtension(originalUrl);
  return `${cacheDir}${fileHash}${fileExtension}`;
}

/**
 * Handle local file caching
 */
export async function handleLocalFileCache(
  originalUrl: string,
  localPath: string,
  cachedFiles: Map<string, CachedAudio>,
  currentCacheSize: number,
  maxCacheSize: number,
  fileSystem: typeof DefaultFileSystem = DefaultFileSystem
): Promise<{
  localPath: string;
  cachedFiles: Map<string, CachedAudio>;
  currentCacheSize: number;
}> {
  // Local file, just copy it to cache if not already there
  if (originalUrl !== localPath) {
    await fileSystem.copyAsync({ from: originalUrl, to: localPath });
  }

  const fileInfo = (await fileSystem.getInfoAsync(localPath, {
    size: true,
  })) as FileInfo;

  const fileSize =
    fileInfo.exists && typeof fileInfo.size === "number" ? fileInfo.size : 0;

  // Return original URL if file size is 0 (invalid file)
  if (fileSize === 0) {
    console.warn(`⚠️ Skipping cache for zero-size file: ${originalUrl}`);
    return { localPath: originalUrl, cachedFiles, currentCacheSize };
  }

  // Manage cache size before adding new file
  const { cachedFiles: updatedFiles, currentCacheSize: updatedSize } =
    await manageCacheSize(
      fileSize,
      cachedFiles,
      currentCacheSize,
      maxCacheSize,
      fileSystem
    );

  const cachedAudio: CachedAudio = {
    originalUrl,
    localPath,
    downloadTime: Date.now(),
    fileSize,
  };

  updatedFiles.set(originalUrl, cachedAudio);
  const newCacheSize = updatedSize + fileSize;

  console.log(
    `✅ Local audio cached: ${originalUrl} (${(fileSize / 1024 / 1024).toFixed(
      2
    )}MB)`
  );

  return {
    localPath,
    cachedFiles: updatedFiles,
    currentCacheSize: newCacheSize,
  };
}

/**
 * Handle remote file downloading
 */
export async function handleRemoteFileDownload(
  originalUrl: string,
  localPath: string,
  cachedFiles: Map<string, CachedAudio>,
  currentCacheSize: number,
  maxCacheSize: number,
  fileSystem: typeof DefaultFileSystem = DefaultFileSystem
): Promise<{
  localPath: string;
  cachedFiles: Map<string, CachedAudio>;
  currentCacheSize: number;
}> {
  // Remote file, download
  const result = await fileSystem.downloadAsync(originalUrl, localPath);

  if (result.status !== 200) {
    console.error(`❌ Download failed with status: ${result.status}`);
    return { localPath: originalUrl, cachedFiles, currentCacheSize };
  }

  // Get file info for size calculation
  const fileInfo = (await fileSystem.getInfoAsync(localPath, {
    size: true,
  })) as FileInfo;

  if (!fileInfo.exists) {
    console.error("❌ Downloaded file not found");
    return { localPath: originalUrl, cachedFiles, currentCacheSize };
  }

  const fileSize = typeof fileInfo.size === "number" ? fileInfo.size : 0;

  // Return original URL if file size is 0 (invalid file)
  if (fileSize === 0) {
    console.warn(`⚠️ Skipping cache for zero-size file: ${originalUrl}`);
    return { localPath: originalUrl, cachedFiles, currentCacheSize };
  }

  // Manage cache size before adding new file
  const { cachedFiles: updatedFiles, currentCacheSize: updatedSize } =
    await manageCacheSize(
      fileSize,
      cachedFiles,
      currentCacheSize,
      maxCacheSize,
      fileSystem
    );

  // Add to cache
  const cachedAudio: CachedAudio = {
    originalUrl,
    localPath,
    downloadTime: Date.now(),
    fileSize,
  };

  updatedFiles.set(originalUrl, cachedAudio);
  const newCacheSize = updatedSize + fileSize;

  console.log(
    `✅ Audio cached: ${originalUrl} (${(fileSize / 1024 / 1024).toFixed(2)}MB)`
  );

  return {
    localPath,
    cachedFiles: updatedFiles,
    currentCacheSize: newCacheSize,
  };
}

/**
 * Download and cache audio file
 */
export async function downloadAndCache(
  originalUrl: string,
  cacheDir: string,
  cachedFiles: Map<string, CachedAudio>,
  currentCacheSize: number,
  maxCacheSize: number,
  fileSystem: typeof DefaultFileSystem = DefaultFileSystem
): Promise<{
  localPath: string;
  cachedFiles: Map<string, CachedAudio>;
  currentCacheSize: number;
}> {
  try {
    console.log(`📥 Downloading audio: ${originalUrl}`);

    // Generate unique filename
    const localPath = generateLocalPath(originalUrl, cacheDir);

    console.log(`🔍 Generated path: ${localPath}`);

    if (originalUrl.startsWith("file://")) {
      console.log(`📁 Handling local file: ${originalUrl}`);
      return await handleLocalFileCache(
        originalUrl,
        localPath,
        cachedFiles,
        currentCacheSize,
        maxCacheSize,
        fileSystem
      );
    } else {
      console.log(`🌐 Handling remote file: ${originalUrl}`);
      return await handleRemoteFileDownload(
        originalUrl,
        localPath,
        cachedFiles,
        currentCacheSize,
        maxCacheSize,
        fileSystem
      );
    }
  } catch (error) {
    console.error(`❌ Error downloading audio ${originalUrl}:`, error);
    return {
      localPath: originalUrl,
      cachedFiles,
      currentCacheSize,
    };
  }
}

/**
 * Manage cache size by evicting old files if necessary
 */
export async function manageCacheSize(
  newFileSize: number,
  cachedFiles: Map<string, CachedAudio>,
  currentCacheSize: number,
  maxCacheSize: number,
  fileSystem: typeof DefaultFileSystem = DefaultFileSystem
): Promise<{
  cachedFiles: Map<string, CachedAudio>;
  currentCacheSize: number;
}> {
  if (currentCacheSize + newFileSize <= maxCacheSize) {
    return { cachedFiles, currentCacheSize }; // No need to evict
  }

  console.log("🧹 Managing cache size...");

  const updatedFiles = new Map(cachedFiles);
  let updatedSize = currentCacheSize;

  // Sort files by download time (oldest first)
  const sortedFiles = Array.from(updatedFiles.entries()).sort(
    ([, a], [, b]) => a.downloadTime - b.downloadTime
  );

  // Evict files until we have enough space
  for (const [url, cached] of sortedFiles) {
    try {
      await fileSystem.deleteAsync(cached.localPath);
      updatedFiles.delete(url);
      updatedSize -= cached.fileSize;

      console.log(`🗑️ Evicted cached file: ${url}`);

      if (updatedSize + newFileSize <= maxCacheSize) {
        break;
      }
    } catch (error) {
      console.error(`❌ Error evicting file ${url}:`, error);
    }
  }

  return { cachedFiles: updatedFiles, currentCacheSize: updatedSize };
}

/**
 * Clear all cached files
 */
export async function clearCache(
  cachedFiles: Map<string, CachedAudio>,
  fileSystem: typeof DefaultFileSystem = DefaultFileSystem
): Promise<void> {
  try {
    console.log("🧹 Clearing audio cache...");

    // Delete all cached files
    for (const [url, cached] of cachedFiles) {
      try {
        await fileSystem.deleteAsync(cached.localPath);
      } catch (error) {
        console.warn(`⚠️ Error deleting cached file ${url}:`, error);
      }
    }

    console.log("✅ Audio cache cleared");
  } catch (error) {
    console.error("❌ Error clearing cache:", error);
    throw error;
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats(
  cachedFiles: Map<string, CachedAudio>,
  currentCacheSize: number,
  maxCacheSize: number
): CacheStats {
  return {
    fileCount: cachedFiles.size,
    totalSize: currentCacheSize,
    maxSize: maxCacheSize,
    usagePercentage: (currentCacheSize / maxCacheSize) * 100,
  };
}

/**
 * Check if cached file exists and is valid
 */
export async function validateCachedFile(
  cached: CachedAudio,
  fileSystem: typeof DefaultFileSystem = DefaultFileSystem
): Promise<boolean> {
  try {
    const fileInfo = await fileSystem.getInfoAsync(cached.localPath);
    return fileInfo.exists;
  } catch (error) {
    console.warn(`⚠️ Error checking cached file:`, error);
    return false;
  }
}

/**
 * Preload audio tracks for smooth playback
 */
export async function preloadTracks(
  tracks: AudioTrack[],
  currentIndex: number,
  preloadCount: number = DEFAULT_PRELOAD_COUNT,
  getCachedAudioUrl: (url: string) => Promise<string>
): Promise<void> {
  const startIndex = Math.max(0, currentIndex);
  const endIndex = Math.min(tracks.length - 1, currentIndex + preloadCount);

  const preloadPromises: Promise<void>[] = [];

  for (let i = startIndex; i <= endIndex; i++) {
    const track = tracks[i];
    if (track && track.url) {
      preloadPromises.push(
        getCachedAudioUrl(track.url).then(() => {
          console.log(`📦 Preloaded track: ${track.id}`);
        })
      );
    }
  }

  await Promise.allSettled(preloadPromises);
}
