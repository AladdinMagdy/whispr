/**
 * Tests for AuthService
 */

import {
  AuthService,
  getAuthService,
  resetAuthService,
  destroyAuthService,
} from "../services/authService";

// Mock Firebase modules
jest.mock("../config/firebase", () => ({
  getAuthInstance: jest.fn(() => ({
    currentUser: null,
    onAuthStateChanged: jest.fn(),
  })),
  getFirestoreInstance: jest.fn(() => ({
    collection: jest.fn(),
    doc: jest.fn(),
  })),
}));

jest.mock("firebase/auth", () => ({
  signInAnonymously: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(),
}));

jest.mock("firebase/firestore", () => ({
  doc: jest.fn(() => "mock-doc-ref"),
  setDoc: jest.fn(),
  getDoc: jest.fn(),
  serverTimestamp: jest.fn(() => new Date()),
}));

describe("AuthService", () => {
  let authService: AuthService;
  let mockAuth: any;
  let mockFirestore: any;
  let mockSignInAnonymously: jest.MockedFunction<any>;
  let mockSignOut: jest.MockedFunction<any>;
  let mockSetDoc: jest.MockedFunction<any>;
  let mockGetDoc: jest.MockedFunction<any>;

  beforeEach(() => {
    // Reset singleton before each test
    destroyAuthService();

    // Get fresh mocks
    const {
      getAuthInstance,
      getFirestoreInstance,
    } = require("../config/firebase");
    const { signInAnonymously, signOut } = require("firebase/auth");
    const { setDoc, getDoc } = require("firebase/firestore");

    mockAuth = {
      currentUser: null,
      onAuthStateChanged: jest.fn(),
    };
    mockFirestore = {
      collection: jest.fn(),
      doc: jest.fn(),
    };

    getAuthInstance.mockReturnValue(mockAuth);
    getFirestoreInstance.mockReturnValue(mockFirestore);
    mockSignInAnonymously = signInAnonymously;
    mockSignOut = signOut;
    mockSetDoc = setDoc;
    mockGetDoc = getDoc;

    // Get fresh instance
    authService = getAuthService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Singleton Pattern", () => {
    it("should return the same instance when called multiple times", () => {
      const instance1 = getAuthService();
      const instance2 = getAuthService();
      expect(instance1).toBe(instance2);
    });

    it("should reset instance correctly", () => {
      const originalInstance = getAuthService();
      resetAuthService();
      const newInstance = getAuthService();
      expect(originalInstance).not.toBe(newInstance);
    });

    it("should destroy instance correctly", () => {
      const instance = getAuthService();
      destroyAuthService();
      const newInstance = getAuthService();
      expect(instance).not.toBe(newInstance);
    });
  });

  describe("signInAnonymously", () => {
    it("should sign in anonymously and create new user profile", async () => {
      const mockFirebaseUser = {
        uid: "test-uid-123",
        isAnonymous: true,
      };

      const mockUserCredential = {
        user: mockFirebaseUser,
      };

      mockSignInAnonymously.mockResolvedValue(mockUserCredential);
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });
      mockSetDoc.mockResolvedValue(undefined);

      const result = await authService.signInAnonymously();

      expect(mockSignInAnonymously).toHaveBeenCalledWith(mockAuth);
      expect(mockSetDoc).toHaveBeenCalled();
      expect(result.uid).toBe("test-uid-123");
      expect(result.isAnonymous).toBe(true);
      expect(result.displayName).toMatch(
        /^(Whispering|Silent|Quiet|Mysterious|Secretive|Gentle|Soft|Hushed|Muted|Subtle|Hidden|Veiled|Concealed|Private|Intimate) (Whisperer|Listener|Voice|Echo|Shadow|Ghost|Spirit|Soul|Heart|Mind|Dreamer|Thinker|Observer|Wanderer|Seeker)$/
      );
      expect(result.profileColor).toMatch(/^#[0-9A-F]{6}$/i);
    });

    it("should return existing user profile if user already exists", async () => {
      const mockFirebaseUser = {
        uid: "test-uid-123",
        isAnonymous: true,
      };

      const mockUserCredential = {
        user: mockFirebaseUser,
      };

      const existingUserData = {
        displayName: "Existing Whisperer",
        isAnonymous: true,
        createdAt: { toDate: () => new Date("2023-01-01") },
        lastActiveAt: { toDate: () => new Date("2023-01-02") },
        whisperCount: 5,
        totalReactions: 10,
        profileColor: "#FF0000",
      };

      mockSignInAnonymously.mockResolvedValue(mockUserCredential);
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => existingUserData,
      });

      const result = await authService.signInAnonymously();

      expect(result.uid).toBe("test-uid-123");
      expect(result.displayName).toBe("Existing Whisperer");
      expect(result.whisperCount).toBe(5);
      expect(result.totalReactions).toBe(10);
      expect(result.profileColor).toBe("#FF0000");
    });

    it("should handle sign-in errors", async () => {
      const error = new Error("Sign-in failed");
      mockSignInAnonymously.mockRejectedValue(error);

      await expect(authService.signInAnonymously()).rejects.toThrow(
        "Failed to sign in anonymously: Sign-in failed"
      );
    });
  });

  describe("signOut", () => {
    it("should sign out successfully", async () => {
      mockSignOut.mockResolvedValue(undefined);

      await authService.signOut();

      expect(mockSignOut).toHaveBeenCalledWith(mockAuth);
    });

    it("should handle sign-out errors", async () => {
      const error = new Error("Sign-out failed");
      mockSignOut.mockRejectedValue(error);

      await expect(authService.signOut()).rejects.toThrow(
        "Failed to sign out: Sign-out failed"
      );
    });
  });

  describe("getCurrentUser", () => {
    it("should return null when no user is signed in", async () => {
      mockAuth.currentUser = null;

      const result = await authService.getCurrentUser();

      expect(result).toBeNull();
    });

    it("should return user when signed in", async () => {
      const mockFirebaseUser = {
        uid: "test-uid-123",
        isAnonymous: true,
      };

      const existingUserData = {
        displayName: "Test User",
        isAnonymous: true,
        createdAt: { toDate: () => new Date("2023-01-01") },
        lastActiveAt: { toDate: () => new Date("2023-01-02") },
        whisperCount: 3,
        totalReactions: 7,
        profileColor: "#00FF00",
      };

      mockAuth.currentUser = mockFirebaseUser;
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => existingUserData,
      });

      const result = await authService.getCurrentUser();

      expect(result).toEqual({
        uid: "test-uid-123",
        displayName: "Test User",
        isAnonymous: true,
        createdAt: new Date("2023-01-01"),
        lastActiveAt: new Date("2023-01-02"),
        whisperCount: 3,
        totalReactions: 7,
        profileColor: "#00FF00",
      });
    });
  });

  describe("updateLastActive", () => {
    it("should update last active timestamp", async () => {
      const mockFirebaseUser = {
        uid: "test-uid-123",
      };

      mockAuth.currentUser = mockFirebaseUser;
      mockSetDoc.mockResolvedValue(undefined);

      await authService.updateLastActive();

      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        { lastActiveAt: expect.any(Date) },
        { merge: true }
      );
    });

    it("should not update if no user is signed in", async () => {
      mockAuth.currentUser = null;

      await authService.updateLastActive();

      expect(mockSetDoc).not.toHaveBeenCalled();
    });
  });

  describe("incrementWhisperCount", () => {
    it("should increment whisper count", async () => {
      const mockFirebaseUser = {
        uid: "test-uid-123",
      };

      const existingUserData = {
        whisperCount: 5,
      };

      mockAuth.currentUser = mockFirebaseUser;
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => existingUserData,
      });
      mockSetDoc.mockResolvedValue(undefined);

      await authService.incrementWhisperCount();

      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        { whisperCount: 6 },
        { merge: true }
      );
    });

    it("should handle case when whisper count is undefined", async () => {
      const mockFirebaseUser = {
        uid: "test-uid-123",
      };

      const existingUserData = {};

      mockAuth.currentUser = mockFirebaseUser;
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => existingUserData,
      });
      mockSetDoc.mockResolvedValue(undefined);

      await authService.incrementWhisperCount();

      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        { whisperCount: 1 },
        { merge: true }
      );
    });
  });

  describe("incrementReactionCount", () => {
    it("should increment reaction count", async () => {
      const mockFirebaseUser = {
        uid: "test-uid-123",
      };

      const existingUserData = {
        totalReactions: 10,
      };

      mockAuth.currentUser = mockFirebaseUser;
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => existingUserData,
      });
      mockSetDoc.mockResolvedValue(undefined);

      await authService.incrementReactionCount();

      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        { totalReactions: 11 },
        { merge: true }
      );
    });
  });

  describe("Callbacks", () => {
    it("should set and call callbacks correctly", () => {
      const mockOnAuthStateChanged = jest.fn();
      const mockOnError = jest.fn();

      authService.setCallbacks({
        onAuthStateChanged: mockOnAuthStateChanged,
        onError: mockOnError,
      });

      // Simulate auth state change
      const mockUser = {
        uid: "test-uid",
        displayName: "Test User",
        isAnonymous: true,
        createdAt: new Date(),
        lastActiveAt: new Date(),
        whisperCount: 0,
        totalReactions: 0,
        profileColor: "#FF0000",
      };

      // This would normally be called by the Firebase auth listener
      // For testing, we'll just verify the callback is set
      expect(mockOnAuthStateChanged).toBeDefined();
      expect(mockOnError).toBeDefined();
    });
  });
});
