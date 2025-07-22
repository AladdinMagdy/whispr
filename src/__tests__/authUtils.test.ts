import {
  transformFirestoreUserData,
  createNewUserProfileData,
  createFirestoreUserData,
  generateAnonymousProfileData,
  validateUserProfileData,
  calculateNewCounterValue,
  validateCounterUpdate,
  createCounterUpdateData,
  handleAuthError,
  isRetryableAuthError,
  sanitizeDisplayName,
  createUserFriendlyMessage,
  validateFirebaseUser,
  isUserActive,
  calculateUserActivityScore,
  UserProfileData,
  AuthError,
} from "../utils/authUtils";
import { User as FirebaseUser } from "firebase/auth";

// ===== TEST DATA =====

const mockFirebaseUser: FirebaseUser = {
  uid: "test-user-123",
  isAnonymous: true,
  email: null,
  emailVerified: false,
  displayName: null,
  photoURL: null,
  phoneNumber: null,
  providerId: "firebase",
  tenantId: null,
  metadata: {} as any,
  providerData: [],
  refreshToken: "test-token",
  delete: jest.fn(),
  getIdToken: jest.fn(),
  getIdTokenResult: jest.fn(),
  reload: jest.fn(),
  toJSON: jest.fn(),
};

const mockFirestoreUserData = {
  displayName: "Test User",
  createdAt: { toDate: () => new Date("2023-01-01") },
  lastActiveAt: { toDate: () => new Date("2023-01-15") },
  whisperCount: 5,
  totalReactions: 10,
  profileColor: "#FF0000",
  age: 25,
  isMinor: false,
  contentPreferences: {
    allowAdultContent: true,
    strictFiltering: false,
  },
};

// ===== USER DATA TRANSFORMATION TESTS =====

describe("transformFirestoreUserData", () => {
  it("should transform Firestore data to AnonymousUser", () => {
    const result = transformFirestoreUserData(
      mockFirebaseUser,
      mockFirestoreUserData
    );

    expect(result).toEqual({
      uid: "test-user-123",
      displayName: "Test User",
      isAnonymous: true,
      createdAt: new Date("2023-01-01"),
      lastActiveAt: new Date("2023-01-15"),
      whisperCount: 5,
      totalReactions: 10,
      profileColor: "#FF0000",
      age: 25,
      isMinor: false,
      contentPreferences: {
        allowAdultContent: true,
        strictFiltering: false,
      },
    });
  });

  it("should handle missing optional fields", () => {
    const minimalData = {
      displayName: "Test User",
      createdAt: { toDate: () => new Date("2023-01-01") },
      lastActiveAt: { toDate: () => new Date("2023-01-15") },
      profileColor: "#FF0000",
    };

    const result = transformFirestoreUserData(mockFirebaseUser, minimalData);

    expect(result.whisperCount).toBe(0);
    expect(result.totalReactions).toBe(0);
    expect(result.age).toBeUndefined();
    expect(result.isMinor).toBeUndefined();
    expect(result.contentPreferences).toBeUndefined();
  });
});

describe("createNewUserProfileData", () => {
  it("should create new user profile data", () => {
    const result = createNewUserProfileData();

    expect(result.isAnonymous).toBe(true);
    expect(result.whisperCount).toBe(0);
    expect(result.totalReactions).toBe(0);
    expect(result.displayName).toBeDefined();
    expect(result.profileColor).toBeDefined();
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.lastActiveAt).toBeInstanceOf(Date);
  });

  it("should generate unique profile data on each call", () => {
    // Mock Math.random to return different values for each call
    const originalRandom = Math.random;
    let callCount = 0;
    Math.random = jest.fn(() => {
      callCount++;
      // Use different ranges to ensure different selections
      if (callCount <= 3) {
        return 0.1; // First profile: first adjective, first noun, first color
      } else {
        return 0.9; // Second profile: last adjective, last noun, last color
      }
    });

    try {
      const result1 = createNewUserProfileData();
      const result2 = createNewUserProfileData();

      expect(result1.displayName).not.toBe(result2.displayName);
      expect(result1.profileColor).not.toBe(result2.profileColor);
    } finally {
      // Restore original Math.random
      Math.random = originalRandom;
    }
  });
});

describe("createFirestoreUserData", () => {
  it("should create Firestore user data", () => {
    const result = createFirestoreUserData();

    expect(result.isAnonymous).toBe(true);
    expect(result.whisperCount).toBe(0);
    expect(result.totalReactions).toBe(0);
    expect(result.displayName).toBeDefined();
    expect(result.profileColor).toBeDefined();
  });
});

// ===== PROFILE MANAGEMENT TESTS =====

describe("generateAnonymousProfileData", () => {
  it("should generate anonymous profile data", () => {
    const result = generateAnonymousProfileData();

    expect(result.displayName).toBeDefined();
    expect(result.profileColor).toBeDefined();
    expect(typeof result.displayName).toBe("string");
    expect(typeof result.profileColor).toBe("string");
  });
});

describe("validateUserProfileData", () => {
  it("should validate correct user profile data", () => {
    const validData: Partial<UserProfileData> = {
      displayName: "Test User",
      whisperCount: 5,
      totalReactions: 10,
      profileColor: "#FF0000",
      age: 25,
    };

    const result = validateUserProfileData(validData);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should detect missing display name", () => {
    const invalidData: Partial<UserProfileData> = {
      displayName: "",
      whisperCount: 5,
    };

    const result = validateUserProfileData(invalidData);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Display name is required");
  });

  it("should detect display name too long", () => {
    const invalidData: Partial<UserProfileData> = {
      displayName: "A".repeat(51),
      whisperCount: 5,
    };

    const result = validateUserProfileData(invalidData);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      "Display name must be 50 characters or less"
    );
  });

  it("should detect negative whisper count", () => {
    const invalidData: Partial<UserProfileData> = {
      displayName: "Test User",
      whisperCount: -1,
    };

    const result = validateUserProfileData(invalidData);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Whisper count cannot be negative");
  });

  it("should detect negative reaction count", () => {
    const invalidData: Partial<UserProfileData> = {
      displayName: "Test User",
      totalReactions: -5,
    };

    const result = validateUserProfileData(invalidData);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Total reactions cannot be negative");
  });

  it("should detect invalid age", () => {
    const invalidData: Partial<UserProfileData> = {
      displayName: "Test User",
      age: 150,
    };

    const result = validateUserProfileData(invalidData);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Age must be between 0 and 120");
  });

  it("should detect invalid hex color", () => {
    const invalidData: Partial<UserProfileData> = {
      displayName: "Test User",
      profileColor: "invalid-color",
    };

    const result = validateUserProfileData(invalidData);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Profile color must be a valid hex color");
  });
});

// ===== COUNTER MANAGEMENT TESTS =====

describe("calculateNewCounterValue", () => {
  it("should calculate new counter value with positive increment", () => {
    const result = calculateNewCounterValue(5, 3);
    expect(result).toBe(8);
  });

  it("should handle zero increment", () => {
    const result = calculateNewCounterValue(5, 0);
    expect(result).toBe(5);
  });

  it("should prevent negative values", () => {
    const result = calculateNewCounterValue(5, -10);
    expect(result).toBe(0);
  });

  it("should handle negative current value", () => {
    const result = calculateNewCounterValue(-5, 3);
    expect(result).toBe(0);
  });
});

describe("validateCounterUpdate", () => {
  it("should validate correct counter update", () => {
    const result = validateCounterUpdate(5, 3);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.newValue).toBe(8);
  });

  it("should detect negative increment", () => {
    const result = validateCounterUpdate(5, -1);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Increment cannot be negative");
  });

  it("should detect negative current value", () => {
    const result = validateCounterUpdate(-5, 3);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Current value cannot be negative");
  });
});

describe("createCounterUpdateData", () => {
  it("should create counter update data for whisper count", () => {
    const result = createCounterUpdateData("whisperCount", 5, 3);

    expect(result).toEqual({ whisperCount: 8 });
  });

  it("should create counter update data for reaction count", () => {
    const result = createCounterUpdateData("totalReactions", 10, 5);

    expect(result).toEqual({ totalReactions: 15 });
  });

  it("should throw error for invalid counter update", () => {
    expect(() => createCounterUpdateData("whisperCount", 5, -1)).toThrow(
      "Invalid counter update: Increment cannot be negative"
    );
  });
});

// ===== ERROR HANDLING TESTS =====

describe("handleAuthError", () => {
  it("should handle network errors", () => {
    const error = new Error("Network error occurred");
    const result = handleAuthError(error);

    expect(result.code).toBe("NETWORK_ERROR");
    expect(result.userFriendly).toContain("Network error");
  });

  it("should handle quota exceeded errors", () => {
    const error = new Error("Quota exceeded");
    const result = handleAuthError(error);

    expect(result.code).toBe("QUOTA_EXCEEDED");
    expect(result.userFriendly).toContain("Service limit reached");
  });

  it("should handle permission denied errors", () => {
    const error = new Error("Permission denied");
    const result = handleAuthError(error);

    expect(result.code).toBe("PERMISSION_DENIED");
    expect(result.userFriendly).toContain("Permission denied");
  });

  it("should handle invalid data errors", () => {
    const error = new Error("Invalid data provided");
    const result = handleAuthError(error);

    expect(result.code).toBe("INVALID_DATA");
    expect(result.userFriendly).toContain("Invalid data provided");
  });

  it("should handle unknown errors", () => {
    const error = new Error("Some random error");
    const result = handleAuthError(error);

    expect(result.code).toBe("UNKNOWN_ERROR");
    expect(result.userFriendly).toContain("unexpected error");
  });

  it("should handle string errors", () => {
    const result = handleAuthError("String error");

    expect(result.code).toBe("STRING_ERROR");
    expect(result.userFriendly).toContain("An error occurred");
  });

  it("should handle non-Error objects", () => {
    const result = handleAuthError({ some: "object" });

    expect(result.code).toBe("UNKNOWN_ERROR");
    expect(result.userFriendly).toContain("unexpected error");
  });
});

describe("isRetryableAuthError", () => {
  it("should identify retryable errors", () => {
    const networkError: AuthError = {
      code: "NETWORK_ERROR",
      message: "Network error",
      userFriendly: "Network error",
    };

    const quotaError: AuthError = {
      code: "QUOTA_EXCEEDED",
      message: "Quota exceeded",
      userFriendly: "Service limit reached",
    };

    expect(isRetryableAuthError(networkError)).toBe(true);
    expect(isRetryableAuthError(quotaError)).toBe(true);
  });

  it("should identify non-retryable errors", () => {
    const permissionError: AuthError = {
      code: "PERMISSION_DENIED",
      message: "Permission denied",
      userFriendly: "Permission denied",
    };

    const unknownError: AuthError = {
      code: "UNKNOWN_ERROR",
      message: "Unknown error",
      userFriendly: "Unknown error",
    };

    expect(isRetryableAuthError(permissionError)).toBe(false);
    expect(isRetryableAuthError(unknownError)).toBe(false);
  });
});

// ===== UTILITY FUNCTION TESTS =====

describe("sanitizeDisplayName", () => {
  it("should trim whitespace", () => {
    const result = sanitizeDisplayName("  Test User  ");
    expect(result).toBe("Test User");
  });

  it("should truncate long names", () => {
    const longName = "A".repeat(60);
    const result = sanitizeDisplayName(longName);
    expect(result.length).toBe(50);
  });

  it("should handle empty string", () => {
    const result = sanitizeDisplayName("");
    expect(result).toBe("");
  });
});

describe("createUserFriendlyMessage", () => {
  it("should create user-friendly message from error", () => {
    const error = new Error("Network error");
    const result = createUserFriendlyMessage(error);

    expect(result).toContain("Network error");
    expect(result).toContain("check your connection");
  });
});

describe("validateFirebaseUser", () => {
  it("should validate correct Firebase user", () => {
    const result = validateFirebaseUser(mockFirebaseUser);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should detect null user", () => {
    const result = validateFirebaseUser(null);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("No user found");
  });

  it("should detect missing user ID", () => {
    const invalidUser = { ...mockFirebaseUser, uid: "" };
    const result = validateFirebaseUser(invalidUser as FirebaseUser);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("User ID is required");
  });

  it("should detect short user ID", () => {
    const invalidUser = { ...mockFirebaseUser, uid: "ab" };
    const result = validateFirebaseUser(invalidUser as FirebaseUser);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("User ID must be at least 3 characters");
  });
});

describe("isUserActive", () => {
  it("should identify active user", () => {
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 5); // 5 days ago

    const result = isUserActive(recentDate);
    expect(result).toBe(true);
  });

  it("should identify inactive user", () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 35); // 35 days ago

    const result = isUserActive(oldDate);
    expect(result).toBe(false);
  });

  it("should handle edge case (exactly 30 days)", () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = isUserActive(thirtyDaysAgo);
    expect(result).toBe(false);
  });
});

describe("calculateUserActivityScore", () => {
  it("should calculate activity score correctly", () => {
    const result = calculateUserActivityScore(10, 20, 5); // 10 whispers, 20 reactions, 5 days

    expect(result).toBe(60); // (10 + 20) / 5 * 10 = 60
  });

  it("should cap score at 100", () => {
    const result = calculateUserActivityScore(50, 50, 1); // 100 total, 1 day

    expect(result).toBe(100); // Capped at 100
  });

  it("should handle zero days", () => {
    const result = calculateUserActivityScore(10, 20, 0);

    expect(result).toBe(0);
  });

  it("should handle zero engagement", () => {
    const result = calculateUserActivityScore(0, 0, 10);

    expect(result).toBe(0);
  });

  it("should round score to nearest integer", () => {
    const result = calculateUserActivityScore(3, 2, 1); // 5 total, 1 day

    expect(result).toBe(50); // 5 / 1 * 10 = 50
  });
});

// ===== EDGE CASES AND BOUNDARY TESTS =====

describe("Edge Cases and Boundary Tests", () => {
  it("should handle boundary values in counter calculations", () => {
    expect(calculateNewCounterValue(0, 0)).toBe(0);
    expect(calculateNewCounterValue(0, 1)).toBe(1);
    expect(calculateNewCounterValue(1, -1)).toBe(0);
  });

  it("should handle boundary values in activity score", () => {
    expect(calculateUserActivityScore(0, 0, 1)).toBe(0);
    expect(calculateUserActivityScore(1, 0, 1)).toBe(10);
    expect(calculateUserActivityScore(0, 1, 1)).toBe(10);
  });

  it("should handle boundary values in display name validation", () => {
    const result1 = validateUserProfileData({ displayName: "A".repeat(50) });
    expect(result1.isValid).toBe(true);

    const result2 = validateUserProfileData({ displayName: "A".repeat(51) });
    expect(result2.isValid).toBe(false);
  });

  it("should handle boundary values in age validation", () => {
    const result1 = validateUserProfileData({ displayName: "Test", age: 0 });
    expect(result1.isValid).toBe(true);

    const result2 = validateUserProfileData({ displayName: "Test", age: 120 });
    expect(result2.isValid).toBe(true);

    const result3 = validateUserProfileData({ displayName: "Test", age: -1 });
    expect(result3.isValid).toBe(false);

    const result4 = validateUserProfileData({ displayName: "Test", age: 121 });
    expect(result4.isValid).toBe(false);
  });
});
