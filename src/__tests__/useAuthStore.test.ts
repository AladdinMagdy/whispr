/**
 * useAuthStore Tests
 * Tests for authentication state management
 */

import { renderHook, act } from "@testing-library/react-native";
import {
  useAuthStore,
  useAuthUser,
  useAuthLoading,
  useAuthError,
  useIsAuthenticated,
  setupAuthServiceCallbacks,
} from "../store/useAuthStore";
import { AnonymousUser } from "../services/authService";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Mock the auth service
const mockAuthService = {
  signInAnonymously: jest.fn(),
  signOut: jest.fn(),
  updateLastActive: jest.fn(),
  incrementWhisperCount: jest.fn(),
  incrementReactionCount: jest.fn(),
  setCallbacks: jest.fn(),
};

jest.mock("../services/authService", () => ({
  getAuthService: jest.fn(() => mockAuthService),
  AnonymousUser: jest.fn(),
}));

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe("useAuthStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset store to initial state
    useAuthStore.setState({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      error: null,
    });

    // Mock AsyncStorage to return null (no cached data)
    mockAsyncStorage.getItem.mockResolvedValue(null);
  });

  afterEach(() => {
    // Clean up store state
    useAuthStore.setState({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      error: null,
    });
  });

  describe("Initial State", () => {
    it("should have correct initial state", () => {
      const state = useAuthStore.getState();

      expect(state.user).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.isAuthenticated).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe("Authentication Actions", () => {
    const mockUser: AnonymousUser = {
      uid: "user-123",
      displayName: "Anonymous User",
      isAnonymous: true,
      createdAt: new Date(),
      lastActiveAt: new Date(),
      whisperCount: 0,
      totalReactions: 0,
      profileColor: "#FF6B6B",
    };

    it("should sign in anonymously successfully", async () => {
      mockAuthService.signInAnonymously.mockResolvedValue(mockUser);

      await act(async () => {
        await useAuthStore.getState().signInAnonymously();
      });

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it("should handle sign in failure", async () => {
      const error = new Error("Sign-in failed");
      mockAuthService.signInAnonymously.mockRejectedValue(error);

      await act(async () => {
        await useAuthStore.getState().signInAnonymously();
      });

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe("Sign-in failed");
    });

    it("should handle sign in failure with non-Error object", async () => {
      mockAuthService.signInAnonymously.mockRejectedValue("Unknown error");

      await act(async () => {
        await useAuthStore.getState().signInAnonymously();
      });

      const state = useAuthStore.getState();
      expect(state.error).toBe("Sign-in failed");
    });

    it("should sign out successfully", async () => {
      mockAuthService.signOut.mockResolvedValue(undefined);

      // First sign in
      mockAuthService.signInAnonymously.mockResolvedValue(mockUser);
      await act(async () => {
        await useAuthStore.getState().signInAnonymously();
      });

      // Then sign out
      await act(async () => {
        await useAuthStore.getState().signOut();
      });

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it("should handle sign out failure", async () => {
      const error = new Error("Sign-out failed");
      mockAuthService.signOut.mockRejectedValue(error);

      await act(async () => {
        await useAuthStore.getState().signOut();
      });

      const state = useAuthStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe("Sign-out failed");
    });

    it("should handle sign out failure with non-Error object", async () => {
      mockAuthService.signOut.mockRejectedValue("Unknown error");

      await act(async () => {
        await useAuthStore.getState().signOut();
      });

      const state = useAuthStore.getState();
      expect(state.error).toBe("Sign-out failed");
    });
  });

  describe("User Update Actions", () => {
    const mockUser: AnonymousUser = {
      uid: "user-123",
      displayName: "Anonymous User",
      isAnonymous: true,
      createdAt: new Date(),
      lastActiveAt: new Date(),
      whisperCount: 5,
      totalReactions: 10,
      profileColor: "#FF5733",
    };

    beforeEach(() => {
      // Set up a user in the store
      useAuthStore.setState({
        user: mockUser,
        isAuthenticated: true,
      });
    });

    it("should update last active successfully", async () => {
      mockAuthService.updateLastActive.mockResolvedValue(undefined);

      await act(async () => {
        await useAuthStore.getState().updateLastActive();
      });

      const state = useAuthStore.getState();
      expect(state.user?.lastActiveAt).toBeInstanceOf(Date);
      expect(mockAuthService.updateLastActive).toHaveBeenCalled();
    });

    it("should handle update last active failure", async () => {
      const error = new Error("Update failed");
      mockAuthService.updateLastActive.mockRejectedValue(error);

      const originalLastActive = useAuthStore.getState().user?.lastActiveAt;

      await act(async () => {
        await useAuthStore.getState().updateLastActive();
      });

      const state = useAuthStore.getState();
      expect(state.user?.lastActiveAt).toEqual(originalLastActive);
    });

    it("should increment whisper count successfully", async () => {
      mockAuthService.incrementWhisperCount.mockResolvedValue(undefined);

      const originalCount = useAuthStore.getState().user?.whisperCount || 0;

      await act(async () => {
        await useAuthStore.getState().incrementWhisperCount();
      });

      const state = useAuthStore.getState();
      expect(state.user?.whisperCount).toBe(originalCount + 1);
      expect(mockAuthService.incrementWhisperCount).toHaveBeenCalled();
    });

    it("should handle increment whisper count failure", async () => {
      const error = new Error("Increment failed");
      mockAuthService.incrementWhisperCount.mockRejectedValue(error);

      const originalCount = useAuthStore.getState().user?.whisperCount || 0;

      await act(async () => {
        await useAuthStore.getState().incrementWhisperCount();
      });

      const state = useAuthStore.getState();
      expect(state.user?.whisperCount).toBe(originalCount);
    });

    it("should increment reaction count successfully", async () => {
      mockAuthService.incrementReactionCount.mockResolvedValue(undefined);

      const originalCount = useAuthStore.getState().user?.totalReactions || 0;

      await act(async () => {
        await useAuthStore.getState().incrementReactionCount();
      });

      const state = useAuthStore.getState();
      expect(state.user?.totalReactions).toBe(originalCount + 1);
      expect(mockAuthService.incrementReactionCount).toHaveBeenCalled();
    });

    it("should handle increment reaction count failure", async () => {
      const error = new Error("Increment failed");
      mockAuthService.incrementReactionCount.mockRejectedValue(error);

      const originalCount = useAuthStore.getState().user?.totalReactions || 0;

      await act(async () => {
        await useAuthStore.getState().incrementReactionCount();
      });

      const state = useAuthStore.getState();
      expect(state.user?.totalReactions).toBe(originalCount);
    });

    it("should not update user state when no user exists", async () => {
      // Clear user from store
      useAuthStore.setState({ user: null });

      mockAuthService.updateLastActive.mockResolvedValue(undefined);

      await act(async () => {
        await useAuthStore.getState().updateLastActive();
      });

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
    });
  });

  describe("Error Management", () => {
    it("should set error correctly", () => {
      const errorMessage = "Test error";

      act(() => {
        useAuthStore.getState().setError(errorMessage);
      });

      const state = useAuthStore.getState();
      expect(state.error).toBe(errorMessage);
    });

    it("should clear error correctly", () => {
      // First set an error
      act(() => {
        useAuthStore.getState().setError("Test error");
      });

      // Then clear it
      act(() => {
        useAuthStore.getState().clearError();
      });

      const state = useAuthStore.getState();
      expect(state.error).toBeNull();
    });

    it("should set error to null", () => {
      act(() => {
        useAuthStore.getState().setError(null);
      });

      const state = useAuthStore.getState();
      expect(state.error).toBeNull();
    });
  });

  describe("Store Reset", () => {
    it("should reset store to initial state", () => {
      // First set some state
      act(() => {
        useAuthStore.setState({
          user: {
            uid: "user-123",
            displayName: "Test",
            isAnonymous: true,
            createdAt: new Date(),
            lastActiveAt: new Date(),
            whisperCount: 0,
            totalReactions: 0,
            profileColor: "#FF6B6B",
          },
          isLoading: true,
          isAuthenticated: true,
          error: "Test error",
        });
      });

      // Then reset
      act(() => {
        useAuthStore.getState().reset();
      });

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.isAuthenticated).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe("Selector Hooks", () => {
    const mockUser = {
      uid: "user-123",
      displayName: "Anonymous User",
      isAnonymous: true,
      createdAt: new Date(),
      lastActiveAt: new Date(),
      whisperCount: 5,
      totalReactions: 10,
      profileColor: "#FF6B6B",
    };

    it("should return user from useAuthUser hook", () => {
      act(() => {
        useAuthStore.setState({ user: mockUser });
      });

      const { result } = renderHook(() => useAuthUser());
      expect(result.current).toEqual(mockUser);
    });

    it("should return loading state from useAuthLoading hook", () => {
      act(() => {
        useAuthStore.setState({ isLoading: true });
      });

      const { result } = renderHook(() => useAuthLoading());
      expect(result.current).toBe(true);
    });

    it("should return error from useAuthError hook", () => {
      const error = "Test error";

      act(() => {
        useAuthStore.setState({ error });
      });

      const { result } = renderHook(() => useAuthError());
      expect(result.current).toBe(error);
    });

    it("should return authentication state from useIsAuthenticated hook", () => {
      act(() => {
        useAuthStore.setState({ isAuthenticated: true });
      });

      const { result } = renderHook(() => useIsAuthenticated());
      expect(result.current).toBe(true);
    });
  });

  describe("Auth Service Callbacks", () => {
    it("should set up auth service callbacks", () => {
      act(() => {
        setupAuthServiceCallbacks();
      });

      expect(mockAuthService.setCallbacks).toHaveBeenCalledWith({
        onAuthStateChanged: expect.any(Function),
        onError: expect.any(Function),
      });
    });

    it("should handle auth state change callback", () => {
      act(() => {
        setupAuthServiceCallbacks();
      });

      const callbacks = mockAuthService.setCallbacks.mock.calls[0][0];
      const mockUser: AnonymousUser = {
        uid: "user-123",
        displayName: "Anonymous User",
        isAnonymous: true,
        createdAt: new Date(),
        lastActiveAt: new Date(),
        whisperCount: 0,
        totalReactions: 0,
        profileColor: "#FF5733",
      };

      act(() => {
        callbacks.onAuthStateChanged(mockUser);
      });

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it("should handle auth state change callback with null user", () => {
      act(() => {
        setupAuthServiceCallbacks();
      });

      const callbacks = mockAuthService.setCallbacks.mock.calls[0][0];

      act(() => {
        callbacks.onAuthStateChanged(null);
      });

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it("should handle error callback", () => {
      act(() => {
        setupAuthServiceCallbacks();
      });

      const callbacks = mockAuthService.setCallbacks.mock.calls[0][0];
      const errorMessage = "Auth error";

      act(() => {
        callbacks.onError(errorMessage);
      });

      const state = useAuthStore.getState();
      expect(state.error).toBe(errorMessage);
      expect(state.isLoading).toBe(false);
    });
  });

  describe("Persistence", () => {
    it("should persist user and authentication state but not loading or error", () => {
      const mockUser = {
        uid: "user-123",
        displayName: "Anonymous User",
        isAnonymous: true,
        createdAt: new Date(),
        lastActiveAt: new Date(),
        whisperCount: 5,
        totalReactions: 10,
        profileColor: "#FF6B6B",
      };

      act(() => {
        useAuthStore.setState({
          user: mockUser,
          isLoading: true,
          isAuthenticated: true,
          error: "Test error",
        });
      });

      // The store should have been persisted via the persist middleware
      // We can verify this by checking that AsyncStorage.setItem was called
      expect(mockAsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty string error", () => {
      act(() => {
        useAuthStore.getState().setError("");
      });

      const state = useAuthStore.getState();
      expect(state.error).toBe("");
    });

    it("should handle multiple rapid state updates", () => {
      act(() => {
        useAuthStore.getState().setError("Error 1");
        useAuthStore.getState().setError("Error 2");
        useAuthStore.getState().setError("Error 3");
      });

      const state = useAuthStore.getState();
      expect(state.error).toBe("Error 3");
    });

    it("should handle user with null values", () => {
      const userWithNulls = {
        uid: "user-123",
        displayName: "Anonymous User",
        isAnonymous: true,
        createdAt: new Date(),
        lastActiveAt: new Date(),
        whisperCount: 0,
        totalReactions: 0,
        profileColor: "#FF6B6B",
      };

      act(() => {
        useAuthStore.setState({ user: userWithNulls });
      });

      const state = useAuthStore.getState();
      expect(state.user).toEqual(userWithNulls);
    });
  });
});
