/**
 * Feed Store for Whispr
 * Persistent caching of whispers and feed state
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Whisper } from "../types";
import { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";

interface FeedState {
  // Cached whispers
  whispers: Whisper[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;

  // Cache metadata
  lastLoadTime: number;
  cacheExpiryMs: number; // 5 minutes default

  // Actions
  setWhispers: (whispers: Whisper[]) => void;
  setLastDoc: (doc: QueryDocumentSnapshot<DocumentData> | null) => void;
  setHasMore: (hasMore: boolean) => void;
  setLastLoadTime: (time: number) => void;

  // Cache management
  isCacheValid: () => boolean;
  clearCache: () => void;
  addNewWhisper: (whisper: Whisper) => void;
  updateCache: (
    whispers: Whisper[],
    lastDoc: QueryDocumentSnapshot<DocumentData> | null,
    hasMore: boolean
  ) => void;

  // Singleton management
  resetInstance: () => void;
  destroyInstance: () => void;
}

export const useFeedStore = create<FeedState>()(
  persist(
    (set, get) => ({
      // Initial state
      whispers: [],
      lastDoc: null,
      hasMore: true,
      lastLoadTime: 0,
      cacheExpiryMs: 5 * 60 * 1000, // 5 minutes

      // State setters
      setWhispers: (whispers) => set({ whispers }),
      setLastDoc: (lastDoc) => set({ lastDoc }),
      setHasMore: (hasMore) => set({ hasMore }),
      setLastLoadTime: (time) => set({ lastLoadTime: time }),

      // Cache validation
      isCacheValid: () => {
        const { lastLoadTime, cacheExpiryMs, whispers } = get();
        const now = Date.now();
        return whispers.length > 0 && now - lastLoadTime < cacheExpiryMs;
      },

      // Cache management
      clearCache: () => {
        set({
          whispers: [],
          lastDoc: null,
          hasMore: true,
          lastLoadTime: 0,
        });
        console.log("🗑️ Feed cache cleared");
      },

      addNewWhisper: (whisper) => {
        const { whispers } = get();
        const updatedWhispers = [whisper, ...whispers.slice(0, 19)]; // Keep only 20
        set({ whispers: updatedWhispers });
        console.log("➕ New whisper added to feed cache");
      },

      updateCache: (whispers, lastDoc, hasMore) => {
        set({
          whispers,
          lastDoc,
          hasMore,
          lastLoadTime: Date.now(),
        });
        console.log("🔄 Feed cache updated:", whispers.length);
      },

      // Singleton management
      resetInstance: () => {
        set({
          whispers: [],
          lastDoc: null,
          hasMore: true,
          lastLoadTime: 0,
        });
        console.log("🔄 FeedStore singleton reset successfully");
      },

      destroyInstance: () => {
        set({
          whispers: [],
          lastDoc: null,
          hasMore: true,
          lastLoadTime: 0,
        });
        console.log("🗑️ FeedStore singleton destroyed");
      },
    }),
    {
      name: "feed-storage",
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist these fields
      partialize: (state) => ({
        whispers: state.whispers,
        lastDoc: state.lastDoc,
        hasMore: state.hasMore,
        lastLoadTime: state.lastLoadTime,
      }),
    }
  )
);

/**
 * Factory function to get FeedStore instance
 */
export const getFeedStore = (): FeedState => {
  return useFeedStore.getState();
};

/**
 * Reset the FeedStore singleton instance
 */
export const resetFeedStore = (): void => {
  useFeedStore.getState().resetInstance();
};

/**
 * Destroy the FeedStore singleton instance
 */
export const destroyFeedStore = (): void => {
  useFeedStore.getState().destroyInstance();
};
