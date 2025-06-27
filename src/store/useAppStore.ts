import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { User, Whisper, AudioRecording, AppState, AppActions } from "@/types";

interface AppStore extends AppState, AppActions {
  // Additional actions
  clearError: () => void;
  resetStore: () => void;
  updateUser: (updates: Partial<User>) => void;
  removeWhisper: (whisperId: string) => void;
  updateWhisper: (whisperId: string, updates: Partial<Whisper>) => void;
}

const initialState: AppState = {
  user: null,
  whispers: [],
  isLoading: false,
  error: null,
  currentRecording: null,
};

export const useAppStore = create<AppStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // User actions
        setUser: (user) => set({ user }, false, "setUser"),
        updateUser: (updates) => {
          const currentUser = get().user;
          if (currentUser) {
            set({ user: { ...currentUser, ...updates } }, false, "updateUser");
          }
        },

        // Whisper actions
        addWhisper: (whisper) =>
          set(
            (state) => ({
              whispers: [whisper, ...state.whispers],
            }),
            false,
            "addWhisper"
          ),

        setWhispers: (whispers) => set({ whispers }, false, "setWhispers"),

        removeWhisper: (whisperId) =>
          set(
            (state) => ({
              whispers: state.whispers.filter((w) => w.id !== whisperId),
            }),
            false,
            "removeWhisper"
          ),

        updateWhisper: (whisperId, updates) =>
          set(
            (state) => ({
              whispers: state.whispers.map((w) =>
                w.id === whisperId ? { ...w, ...updates } : w
              ),
            }),
            false,
            "updateWhisper"
          ),

        likeWhisper: (whisperId) =>
          set(
            (state) => ({
              whispers: state.whispers.map((w) =>
                w.id === whisperId ? { ...w, likes: w.likes + 1 } : w
              ),
            }),
            false,
            "likeWhisper"
          ),

        // Audio recording actions
        setCurrentRecording: (recording) =>
          set({ currentRecording: recording }, false, "setCurrentRecording"),

        // UI actions
        setLoading: (isLoading) => set({ isLoading }, false, "setLoading"),
        setError: (error) => set({ error }, false, "setError"),
        clearError: () => set({ error: null }, false, "clearError"),

        // Utility actions
        resetStore: () => set(initialState, false, "resetStore"),
      }),
      {
        name: "whispr-store",
        partialize: (state) => ({
          user: state.user,
          whispers: state.whispers,
          // Don't persist currentRecording, isLoading, or error
        }),
      }
    ),
    {
      name: "whispr-store",
    }
  )
);

// Selector hooks for better performance
export const useUser = () => useAppStore((state) => state.user);
export const useWhispers = () => useAppStore((state) => state.whispers);
export const useCurrentRecording = () =>
  useAppStore((state) => state.currentRecording);
export const useIsLoading = () => useAppStore((state) => state.isLoading);
export const useError = () => useAppStore((state) => state.error);

// Action hooks
export const useAppActions = () =>
  useAppStore((state) => ({
    setUser: state.setUser,
    updateUser: state.updateUser,
    addWhisper: state.addWhisper,
    setWhispers: state.setWhispers,
    removeWhisper: state.removeWhisper,
    updateWhisper: state.updateWhisper,
    likeWhisper: state.likeWhisper,
    setCurrentRecording: state.setCurrentRecording,
    setLoading: state.setLoading,
    setError: state.setError,
    clearError: state.clearError,
    resetStore: state.resetStore,
  }));
