/**
 * Feed Store for Whispr
 * Persistent caching of whispers and feed state
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Whisper } from "../types";
import { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";

// Custom storage wrapper that handles errors gracefully
const createSafeAsyncStorage = () => ({
  getItem: async (name: string): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(name);
    } catch (error) {
      console.warn(`❌ Failed to read from AsyncStorage (${name}):`, error);
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(name, value);
    } catch (error) {
      console.warn(`❌ Failed to write to AsyncStorage (${name}):`, error);
      // Don't throw - let the app continue without persistence
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await AsyncStorage.removeItem(name);
    } catch (error) {
      console.warn(`❌ Failed to remove from AsyncStorage (${name}):`, error);
    }
  },
});

export interface FeedState {
  whispers: Whisper[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
  lastLoadTime: number;
  cacheExpiryMs: number;
  reportedWhispers: Set<string>; // Track reported whispers that should remain blurred

  // Actions
  setWhispers: (whispers: Whisper[]) => void;
  setLastDoc: (doc: QueryDocumentSnapshot<DocumentData> | null) => void;
  setHasMore: (hasMore: boolean) => void;
  setLastLoadTime: (time: number) => void;

  // Cache management
  isCacheValid: () => boolean;
  clearCache: () => void;
  addNewWhisper: (whisper: Whisper) => void;
  updateWhisper: (updatedWhisper: Partial<Whisper> & { id: string }) => void;
  updateCache: (
    whispers: Whisper[],
    lastDoc: QueryDocumentSnapshot<DocumentData> | null,
    hasMore: boolean
  ) => void;

  // Reported whispers management
  markWhisperAsReported: (whisperId: string) => void;
  unmarkWhisperAsReported: (whisperId: string) => void;
  isWhisperReported: (whisperId: string) => boolean;

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
      reportedWhispers: new Set<string>(),

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

        // Check if whisper already exists to prevent duplicates
        const existingWhisper = whispers.find((w) => w.id === whisper.id);
        if (existingWhisper) {
          console.log(
            `⚠️ Whisper ${whisper.id} already exists in cache, skipping duplicate`
          );
          return;
        }

        const updatedWhispers = [whisper, ...whispers.slice(0, 19)]; // Keep only 20
        set({ whispers: updatedWhispers });
        console.log("➕ New whisper added to feed cache");
      },

      updateWhisper: (updatedWhisper) => {
        const { whispers } = get();
        const before = whispers.find((w) => w.id === updatedWhisper.id);
        const updatedWhispers = whispers.map((whisper) =>
          whisper.id === updatedWhisper.id
            ? { ...whisper, ...updatedWhisper } // Merge with existing whisper data
            : whisper
        );
        const after = updatedWhispers.find((w) => w.id === updatedWhisper.id);
        set({ whispers: updatedWhispers });
        console.log(
          "[FeedStore] updateWhisper: before=",
          before,
          "after=",
          after
        );
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

      // Reported whispers management
      markWhisperAsReported: (whisperId) => {
        const { reportedWhispers } = get();
        const newReportedWhispers = new Set(reportedWhispers);
        newReportedWhispers.add(whisperId);
        set({ reportedWhispers: newReportedWhispers });
        console.log(`🚨 Whisper ${whisperId} marked as reported`);
      },

      unmarkWhisperAsReported: (whisperId) => {
        const { reportedWhispers } = get();
        const newReportedWhispers = new Set(reportedWhispers);
        newReportedWhispers.delete(whisperId);
        set({ reportedWhispers: newReportedWhispers });
        console.log(`✅ Whisper ${whisperId} unmarked as reported`);
      },

      isWhisperReported: (whisperId) => {
        const { reportedWhispers } = get();
        return reportedWhispers.has(whisperId);
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
      storage: createJSONStorage(() => createSafeAsyncStorage()),
      // Only persist these fields
      partialize: (state) => ({
        whispers: state.whispers,
        lastDoc: state.lastDoc,
        hasMore: state.hasMore,
        lastLoadTime: state.lastLoadTime,
        reportedWhispers: Array.from(state.reportedWhispers), // Convert Set to Array for persistence
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Convert Array back to Set
          state.reportedWhispers = new Set(state.reportedWhispers || []);
        }
      },
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
