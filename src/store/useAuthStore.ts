/**
 * Authentication Store using Zustand
 * Manages authentication state and user session
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AuthService,
  AnonymousUser,
  AuthState,
  getAuthService,
} from "../services/authService";

interface AuthStore extends AuthState {
  // Actions
  signInAnonymously: () => Promise<void>;
  signOut: () => Promise<void>;
  updateLastActive: () => Promise<void>;
  incrementWhisperCount: () => Promise<void>;
  incrementReactionCount: () => Promise<void>;
  setError: (error: string | null) => void;
  clearError: () => void;
  reset: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      isLoading: false,
      isAuthenticated: false,
      error: null,

      // Actions
      signInAnonymously: async () => {
        try {
          set({ isLoading: true, error: null });

          const authService = getAuthService();
          const user = await authService.signInAnonymously();

          set({
            user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });

          console.log("✅ Anonymous sign-in successful:", user.displayName);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Sign-in failed";
          set({
            isLoading: false,
            error: errorMessage,
            isAuthenticated: false,
          });
          console.error("❌ Anonymous sign-in failed:", errorMessage);
        }
      },

      signOut: async () => {
        try {
          set({ isLoading: true, error: null });

          const authService = getAuthService();
          await authService.signOut();

          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });

          console.log("✅ Sign out successful");
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Sign-out failed";
          set({
            isLoading: false,
            error: errorMessage,
          });
          console.error("❌ Sign out failed:", errorMessage);
        }
      },

      updateLastActive: async () => {
        try {
          const authService = getAuthService();
          await authService.updateLastActive();

          // Update local state if user exists
          const { user } = get();
          if (user) {
            set({
              user: {
                ...user,
                lastActiveAt: new Date(),
              },
            });
          }
        } catch (error) {
          console.error("Error updating last active:", error);
        }
      },

      incrementWhisperCount: async () => {
        try {
          const authService = getAuthService();
          await authService.incrementWhisperCount();

          // Update local state
          const { user } = get();
          if (user) {
            set({
              user: {
                ...user,
                whisperCount: user.whisperCount + 1,
              },
            });
          }
        } catch (error) {
          console.error("Error incrementing whisper count:", error);
        }
      },

      incrementReactionCount: async () => {
        try {
          const authService = getAuthService();
          await authService.incrementReactionCount();

          // Update local state
          const { user } = get();
          if (user) {
            set({
              user: {
                ...user,
                totalReactions: user.totalReactions + 1,
              },
            });
          }
        } catch (error) {
          console.error("Error incrementing reaction count:", error);
        }
      },

      setError: (error: string | null) => {
        set({ error });
      },

      clearError: () => {
        set({ error: null });
      },

      reset: () => {
        set({
          user: null,
          isLoading: false,
          isAuthenticated: false,
          error: null,
        });
      },
    }),
    {
      name: "whispr-auth-storage",
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist user data, not loading states or errors
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Export selectors for better performance
export const useAuthUser = () => useAuthStore((state) => state.user);
export const useAuthLoading = () => useAuthStore((state) => state.isLoading);
export const useAuthError = () => useAuthStore((state) => state.error);
export const useIsAuthenticated = () =>
  useAuthStore((state) => state.isAuthenticated);

/**
 * Call this after Firebase is initialized in App.tsx
 */
export const setupAuthServiceCallbacks = () => {
  const authService = getAuthService();
  authService.setCallbacks({
    onAuthStateChanged: (user: AnonymousUser | null) => {
      useAuthStore.setState({
        user,
        isAuthenticated: !!user,
        isLoading: false,
        error: null,
      });
    },
    onError: (error: string) => {
      useAuthStore.setState({
        error,
        isLoading: false,
      });
    },
  });
};
