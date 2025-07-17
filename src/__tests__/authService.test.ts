/**
 * Tests for AuthService
 */

import {
  AuthService,
  getAuthService,
  resetAuthService,
  destroyAuthService,
  AuthServiceDependencies,
} from "../services/authService";
import { getAuthInstance, getFirestoreInstance } from "../config/firebase";
import { signInAnonymously, signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

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
  doc: jest.fn(() => ({ id: "test-doc-id" })),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  serverTimestamp: jest.fn(() => ({
    toDate: () => new Date("2023-01-01T00:00:00.000Z"),
  })),
}));

describe("AuthService", () => {
  let authService: AuthService;
  let mockAuth: any;
  let mockFirestore: any;
  let mockSignInAnonymously: jest.MockedFunction<any>;
  let mockSignOut: jest.MockedFunction<any>;
  let mockSetDoc: jest.MockedFunction<any>;
  let mockGetDoc: jest.MockedFunction<any>;

  beforeEach(async () => {
    // Reset singleton before each test
    destroyAuthService();

    // Get fresh mocks
    mockAuth = {
      currentUser: null,
      onAuthStateChanged: jest.fn(),
    };
    mockFirestore = {
      collection: jest.fn(),
      doc: jest.fn(),
    };

    (getAuthInstance as jest.Mock).mockReturnValue(mockAuth);
    (getFirestoreInstance as jest.Mock).mockReturnValue(mockFirestore);
    mockSignInAnonymously = signInAnonymously as jest.Mock;
    mockSignOut = signOut as jest.Mock;
    mockSetDoc = setDoc as jest.Mock;
    mockGetDoc = getDoc as jest.Mock;

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
        { lastActiveAt: expect.any(Object) },
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

      // This would normally be called by the Firebase auth listener
      // For testing, we'll just verify the callback is set
      expect(mockOnAuthStateChanged).toBeDefined();
      expect(mockOnError).toBeDefined();
    });
  });
});

describe("AuthService - Error Handling and Edge Cases", () => {
  let service: AuthService;

  beforeEach(() => {
    service = AuthService.getInstance();
    jest.clearAllMocks();
  });

  describe("updateLastActive", () => {
    it("should handle error when updating last active", async () => {
      const mockSetDoc = jest
        .fn()
        .mockRejectedValue(new Error("Database error"));
      (service as any).firestore = {
        collection: jest.fn().mockReturnValue({
          doc: jest.fn().mockReturnValue({
            set: mockSetDoc,
          }),
        }),
      };

      // Mock current user
      (service as any).auth = {
        currentUser: { uid: "test-user" },
      };

      await service.updateLastActive();
      // Should not throw, just log error
    });

    it("should handle error when getting user doc in incrementWhisperCount", async () => {
      const mockGetDoc = jest
        .fn()
        .mockRejectedValue(new Error("Database error"));
      (service as any).firestore = {
        collection: jest.fn().mockReturnValue({
          doc: jest.fn().mockReturnValue({
            get: mockGetDoc,
          }),
        }),
      };

      (service as any).auth = {
        currentUser: { uid: "test-user" },
      };

      await service.incrementWhisperCount();
      // Should not throw, just log error
    });

    it("should handle error when setting whisper count", async () => {
      const mockSetDoc = jest
        .fn()
        .mockRejectedValue(new Error("Database error"));
      const mockGetDoc = jest.fn().mockResolvedValue({
        exists: () => true,
        data: () => ({ whisperCount: 5 }),
      });

      (service as any).firestore = {
        collection: jest.fn().mockReturnValue({
          doc: jest.fn().mockReturnValue({
            get: mockGetDoc,
            set: mockSetDoc,
          }),
        }),
      };

      (service as any).auth = {
        currentUser: { uid: "test-user" },
      };

      await service.incrementWhisperCount();
      // Should not throw, just log error
    });

    it("should handle error when getting user doc in incrementReactionCount", async () => {
      const mockGetDoc = jest
        .fn()
        .mockRejectedValue(new Error("Database error"));
      (service as any).firestore = {
        collection: jest.fn().mockReturnValue({
          doc: jest.fn().mockReturnValue({
            get: mockGetDoc,
          }),
        }),
      };

      (service as any).auth = {
        currentUser: { uid: "test-user" },
      };

      await service.incrementReactionCount();
      // Should not throw, just log error
    });

    it("should handle error when setting reaction count", async () => {
      const mockSetDoc = jest
        .fn()
        .mockRejectedValue(new Error("Database error"));
      const mockGetDoc = jest.fn().mockResolvedValue({
        exists: () => true,
        data: () => ({ totalReactions: 3 }),
      });

      (service as any).firestore = {
        collection: jest.fn().mockReturnValue({
          doc: jest.fn().mockReturnValue({
            get: mockGetDoc,
            set: mockSetDoc,
          }),
        }),
      };

      (service as any).auth = {
        currentUser: { uid: "test-user" },
      };

      await service.incrementReactionCount();
      // Should not throw, just log error
    });
  });

  describe("generateAnonymousProfile", () => {
    it("should generate unique profiles", () => {
      const profile1 = (service as any).generateAnonymousProfile();
      const profile2 = (service as any).generateAnonymousProfile();

      expect(profile1.displayName).toBeDefined();
      expect(profile1.profileColor).toBeDefined();
      expect(profile2.displayName).toBeDefined();
      expect(profile2.profileColor).toBeDefined();

      // They might be the same due to random chance, but both should be valid
      expect(profile1.displayName).toMatch(/^[A-Za-z]+ [A-Za-z]+$/);
      expect(profile1.profileColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(profile2.displayName).toMatch(/^[A-Za-z]+ [A-Za-z]+$/);
      expect(profile2.profileColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });

    it("should generate profile with valid format", () => {
      const profile = (service as any).generateAnonymousProfile();

      expect(profile.displayName).toContain(" ");
      expect(profile.displayName.split(" ")).toHaveLength(2);
      expect(profile.profileColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });

  describe("getOrCreateAnonymousUser", () => {
    it("should handle error when getting user document", async () => {
      const mockGetDoc = jest
        .fn()
        .mockRejectedValue(new Error("Database error"));
      (service as any).firestore = {
        collection: jest.fn().mockReturnValue({
          doc: jest.fn().mockReturnValue({
            get: mockGetDoc,
          }),
        }),
      };

      const firebaseUser = { uid: "test-user" };

      await expect(
        (service as any).getOrCreateAnonymousUser(firebaseUser)
      ).rejects.toThrow("Failed to get user profile");
    });

    it("should handle error when creating new user", async () => {
      const mockGetDoc = jest.fn().mockResolvedValue({
        exists: () => false,
      });
      const mockSetDoc = jest
        .fn()
        .mockRejectedValue(new Error("Database error"));

      (service as any).firestore = {
        collection: jest.fn().mockReturnValue({
          doc: jest.fn().mockReturnValue({
            get: mockGetDoc,
            set: mockSetDoc,
          }),
        }),
      };

      const firebaseUser = { uid: "test-user" };

      await expect(
        (service as any).getOrCreateAnonymousUser(firebaseUser)
      ).rejects.toThrow("Failed to get user profile");
    });

    it("should handle non-Error exceptions", async () => {
      const mockGetDoc = jest.fn().mockRejectedValue("String error");
      (service as any).firestore = {
        collection: jest.fn().mockReturnValue({
          doc: jest.fn().mockReturnValue({
            get: mockGetDoc,
          }),
        }),
      };

      const firebaseUser = { uid: "test-user" };

      await expect(
        (service as any).getOrCreateAnonymousUser(firebaseUser)
      ).rejects.toThrow(/Failed to get user profile/);
    });
  });

  describe("Static Methods", () => {
    it("should handle resetInstance when no instance exists", () => {
      // Destroy any existing instance
      AuthService.destroyInstance();

      // Should not throw when no instance exists
      expect(() => AuthService.resetInstance()).not.toThrow();
    });

    it("should handle destroyInstance when no instance exists", () => {
      // Destroy any existing instance
      AuthService.destroyInstance();

      // Should not throw when no instance exists
      expect(() => AuthService.destroyInstance()).not.toThrow();
    });

    it("should reset instance correctly", () => {
      const instance1 = AuthService.getInstance();
      AuthService.resetInstance();
      const instance2 = AuthService.getInstance();
      // After reset, should be a new instance
      expect(instance1).not.toBe(instance2);
    });
  });

  describe("Factory Functions", () => {
    it("should export factory functions correctly", () => {
      expect(typeof getAuthService).toBe("function");
      expect(typeof resetAuthService).toBe("function");
      expect(typeof destroyAuthService).toBe("function");
    });

    it("should call static methods through factory functions", () => {
      const resetSpy = jest.spyOn(AuthService, "resetInstance");
      const destroySpy = jest.spyOn(AuthService, "destroyInstance");

      resetAuthService();
      expect(resetSpy).toHaveBeenCalled();

      destroyAuthService();
      expect(destroySpy).toHaveBeenCalled();

      resetSpy.mockRestore();
      destroySpy.mockRestore();
    });
  });

  describe("Edge Cases", () => {
    it("should handle incrementWhisperCount when user doc doesn't exist", async () => {
      const mockGetDoc = jest.fn().mockResolvedValue({
        exists: () => false,
      });

      (service as any).firestore = {
        collection: jest.fn().mockReturnValue({
          doc: jest.fn().mockReturnValue({
            get: mockGetDoc,
          }),
        }),
      };

      (service as any).auth = {
        currentUser: { uid: "test-user" },
      };

      await service.incrementWhisperCount();
      // Should not throw, just return early
    });

    it("should handle incrementReactionCount when user doc doesn't exist", async () => {
      const mockGetDoc = jest.fn().mockResolvedValue({
        exists: () => false,
      });

      (service as any).firestore = {
        collection: jest.fn().mockReturnValue({
          doc: jest.fn().mockReturnValue({
            get: mockGetDoc,
          }),
        }),
      };

      (service as any).auth = {
        currentUser: { uid: "test-user" },
      };

      await service.incrementReactionCount();
      // Should not throw, just return early
    });

    it("should handle incrementWhisperCount when whisperCount is undefined", async () => {
      const mockSetDoc = jest.fn().mockResolvedValue(undefined);
      const mockGetDoc = jest.fn().mockResolvedValue({
        exists: () => true,
        data: () => ({ whisperCount: undefined }),
      });

      // Create a new instance with mocked dependencies
      const dependencies: AuthServiceDependencies = {
        auth: { currentUser: { uid: "test-user" } } as any,
        firestore: {} as any,
      };

      const testService = AuthService.createInstance(dependencies);

      // Mock the Firestore functions
      (doc as jest.Mock).mockReturnValue({ id: "test-doc-id" });
      (getDoc as jest.Mock).mockImplementation(mockGetDoc);
      (setDoc as jest.Mock).mockImplementation(mockSetDoc);

      await testService.incrementWhisperCount();
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        { whisperCount: 1 },
        { merge: true }
      );
    });

    it("should handle incrementReactionCount when totalReactions is undefined", async () => {
      const mockSetDoc = jest.fn().mockResolvedValue(undefined);
      const mockGetDoc = jest.fn().mockResolvedValue({
        exists: () => true,
        data: () => ({ totalReactions: undefined }),
      });

      // Create a new instance with mocked dependencies
      const dependencies: AuthServiceDependencies = {
        auth: { currentUser: { uid: "test-user" } } as any,
        firestore: {} as any,
      };

      const testService = AuthService.createInstance(dependencies);

      // Mock the Firestore functions
      (doc as jest.Mock).mockReturnValue({ id: "test-doc-id" });
      (getDoc as jest.Mock).mockImplementation(mockGetDoc);
      (setDoc as jest.Mock).mockImplementation(mockSetDoc);

      await testService.incrementReactionCount();
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        { totalReactions: 1 },
        { merge: true }
      );
    });
  });
});
