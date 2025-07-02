/**
 * Preload Service for Whispr
 * Caches whispers and audio tracks before navigation for faster loading
 */

import {
  getFirestoreService,
  PaginatedWhispersResult,
} from "./firestoreService";
import { Whisper } from "../types";
import { useAudioStore } from "../store/useAudioStore";

export interface PreloadResult {
  whispers: Whisper[];
  hasMore: boolean;
  lastDoc: any;
}

export class PreloadService {
  private static instance: PreloadService;
  private cachedWhispers: Whisper[] = [];
  private cachedHasMore: boolean = true;
  private cachedLastDoc: any = null;
  private isPreloading: boolean = false;
  private preloadPromise: Promise<PreloadResult> | null = null;

  private constructor() {}

  static getInstance(): PreloadService {
    if (!PreloadService.instance) {
      PreloadService.instance = new PreloadService();
    }
    return PreloadService.instance;
  }

  /**
   * Preload whispers in the background
   */
  async preloadWhispers(): Promise<PreloadResult> {
    // If already preloading, return the existing promise
    if (this.isPreloading && this.preloadPromise) {
      return this.preloadPromise;
    }

    // If we have cached data, return it immediately
    if (this.cachedWhispers.length > 0) {
      console.log("🚀 Returning cached whispers:", this.cachedWhispers.length);
      return {
        whispers: this.cachedWhispers,
        hasMore: this.cachedHasMore,
        lastDoc: this.cachedLastDoc,
      };
    }

    this.isPreloading = true;
    console.log("🚀 Starting whisper preload...");

    this.preloadPromise = this._loadWhispers();

    try {
      const result = await this.preloadPromise;
      this.cachedWhispers = result.whispers;
      this.cachedHasMore = result.hasMore;
      this.cachedLastDoc = result.lastDoc;
      console.log("✅ Whisper preload completed:", result.whispers.length);
      return result;
    } finally {
      this.isPreloading = false;
      this.preloadPromise = null;
    }
  }

  /**
   * Get cached whispers immediately (synchronous)
   */
  getCachedWhispers(): PreloadResult | null {
    if (this.cachedWhispers.length > 0) {
      return {
        whispers: this.cachedWhispers,
        hasMore: this.cachedHasMore,
        lastDoc: this.cachedLastDoc,
      };
    }
    return null;
  }

  /**
   * Clear cache (useful for refresh)
   */
  clearCache(): void {
    this.cachedWhispers = [];
    this.cachedHasMore = true;
    this.cachedLastDoc = null;
    console.log("🗑️ Preload cache cleared");
  }

  /**
   * Update cache with new whispers
   */
  updateCache(whispers: Whisper[], hasMore: boolean, lastDoc: any): void {
    this.cachedWhispers = whispers;
    this.cachedHasMore = hasMore;
    this.cachedLastDoc = lastDoc;
    console.log("🔄 Preload cache updated:", whispers.length);
  }

  /**
   * Add new whisper to cache
   */
  addNewWhisperToCache(newWhisper: Whisper): void {
    this.cachedWhispers = [newWhisper, ...this.cachedWhispers.slice(0, 19)];
    console.log("➕ New whisper added to cache");
  }

  /**
   * Internal method to load whispers
   */
  private async _loadWhispers(): Promise<PreloadResult> {
    try {
      const firestoreService = getFirestoreService();
      const result: PaginatedWhispersResult =
        await firestoreService.getWhispers({
          limit: 20,
        });

      // Pre-initialize audio player with the tracks
      await this._preloadAudioTracks(result.whispers);

      return {
        whispers: result.whispers,
        hasMore: result.hasMore,
        lastDoc: result.lastDoc,
      };
    } catch (error) {
      console.error("❌ Error preloading whispers:", error);
      throw error;
    }
  }

  /**
   * Pre-initialize audio tracks for faster playback
   */
  private async _preloadAudioTracks(whispers: Whisper[]): Promise<void> {
    try {
      const audioTracks = whispers.map((whisper) => ({
        id: whisper.id,
        title: whisper.userDisplayName,
        artist: `${whisper.whisperPercentage.toFixed(
          1
        )}% whisper • ${this._formatTime(whisper.duration)}`,
        artwork: `https://ui-avatars.com/api/?name=${encodeURIComponent(
          whisper.userDisplayName
        )}&background=${whisper.userProfileColor.replace(
          "#",
          ""
        )}&color=fff&size=200`,
        url: whisper.audioUrl,
      }));

      // Initialize audio player in background
      const audioStore = useAudioStore.getState();
      if (!audioStore.isInitialized) {
        console.log("🎵 Pre-initializing audio player...");
        await audioStore.initializePlayer(audioTracks);
      } else {
        console.log("🎵 Updating audio tracks...");
        await audioStore.initializePlayer(audioTracks);
      }
    } catch (error) {
      console.error("❌ Error preloading audio tracks:", error);
    }
  }

  /**
   * Format time helper
   */
  private _formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = Math.floor(seconds % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${s}`;
  }

  /**
   * Reset singleton instance
   */
  static resetInstance(): void {
    if (PreloadService.instance) {
      PreloadService.instance = new PreloadService();
      console.log("🔄 PreloadService singleton reset successfully");
    }
  }

  /**
   * Destroy singleton instance
   */
  static destroyInstance(): void {
    if (PreloadService.instance) {
      PreloadService.instance = null as any;
      console.log("🗑️ PreloadService singleton destroyed");
    }
  }
}

/**
 * Factory function to get PreloadService instance
 */
export const getPreloadService = (): PreloadService => {
  return PreloadService.getInstance();
};

/**
 * Reset the PreloadService singleton instance
 */
export const resetPreloadService = (): void => {
  PreloadService.resetInstance();
};

/**
 * Destroy the PreloadService singleton instance
 */
export const destroyPreloadService = (): void => {
  PreloadService.destroyInstance();
};
