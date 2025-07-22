import { User as FirebaseUser } from "firebase/auth";
import { DocumentData } from "firebase/firestore";
import { generateAnonymousProfile } from "./profileGenerationUtils";
import { AnonymousUser } from "../services/authService";

// ===== INTERFACES =====

export interface UserProfileData {
  displayName: string;
  isAnonymous: boolean;
  createdAt: Date;
  lastActiveAt: Date;
  whisperCount: number;
  totalReactions: number;
  profileColor: string;
  age?: number;
  isMinor?: boolean;
  contentPreferences?: {
    allowAdultContent: boolean;
    strictFiltering: boolean;
  };
}

export interface AnonymousProfile {
  displayName: string;
  profileColor: string;
}

export interface CounterUpdate {
  field: "whisperCount" | "totalReactions";
  increment: number;
}

export interface AuthError {
  code: string;
  message: string;
  userFriendly: string;
}

// ===== USER DATA TRANSFORMATION =====

/**
 * Transform Firestore document data to AnonymousUser
 */
export function transformFirestoreUserData(
  firebaseUser: FirebaseUser,
  userData: DocumentData
): AnonymousUser {
  return {
    uid: firebaseUser.uid,
    displayName: userData.displayName,
    isAnonymous: firebaseUser.isAnonymous,
    createdAt: userData.createdAt.toDate(),
    lastActiveAt: userData.lastActiveAt.toDate(),
    whisperCount: userData.whisperCount || 0,
    totalReactions: userData.totalReactions || 0,
    profileColor: userData.profileColor,
    age: userData.age,
    isMinor: userData.isMinor,
    contentPreferences: userData.contentPreferences,
  };
}

/**
 * Create new user profile data for anonymous user
 */
export function createNewUserProfileData(): UserProfileData {
  const anonymousProfile = generateAnonymousProfile();

  return {
    displayName: anonymousProfile.displayName,
    isAnonymous: true,
    createdAt: new Date(),
    lastActiveAt: new Date(),
    whisperCount: 0,
    totalReactions: 0,
    profileColor: anonymousProfile.profileColor,
  };
}

/**
 * Create Firestore user document data
 */
export function createFirestoreUserData(): {
  displayName: string;
  isAnonymous: boolean;
  whisperCount: number;
  totalReactions: number;
  profileColor: string;
} {
  const anonymousProfile = generateAnonymousProfile();

  return {
    displayName: anonymousProfile.displayName,
    isAnonymous: true,
    whisperCount: 0,
    totalReactions: 0,
    profileColor: anonymousProfile.profileColor,
  };
}

// ===== PROFILE MANAGEMENT =====

/**
 * Generate anonymous profile with random name and color
 */
export function generateAnonymousProfileData(): AnonymousProfile {
  return generateAnonymousProfile();
}

/**
 * Validate user profile data
 */
export function validateUserProfileData(data: Partial<UserProfileData>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!data.displayName || data.displayName.trim().length === 0) {
    errors.push("Display name is required");
  }

  if (data.displayName && data.displayName.length > 50) {
    errors.push("Display name must be 50 characters or less");
  }

  if (data.whisperCount !== undefined && data.whisperCount < 0) {
    errors.push("Whisper count cannot be negative");
  }

  if (data.totalReactions !== undefined && data.totalReactions < 0) {
    errors.push("Total reactions cannot be negative");
  }

  if (data.age !== undefined && (data.age < 0 || data.age > 120)) {
    errors.push("Age must be between 0 and 120");
  }

  if (data.profileColor && !isValidHexColor(data.profileColor)) {
    errors.push("Profile color must be a valid hex color");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// ===== COUNTER MANAGEMENT =====

/**
 * Calculate new counter value
 */
export function calculateNewCounterValue(
  currentValue: number,
  increment: number = 1
): number {
  return Math.max(0, currentValue + increment);
}

/**
 * Validate counter update
 */
export function validateCounterUpdate(
  currentValue: number,
  increment: number
): {
  isValid: boolean;
  errors: string[];
  newValue: number;
} {
  const errors: string[] = [];

  if (increment < 0) {
    errors.push("Increment cannot be negative");
  }

  if (currentValue < 0) {
    errors.push("Current value cannot be negative");
  }

  const newValue = calculateNewCounterValue(currentValue, increment);

  return {
    isValid: errors.length === 0,
    errors,
    newValue,
  };
}

/**
 * Create counter update data
 */
export function createCounterUpdateData(
  field: "whisperCount" | "totalReactions",
  currentValue: number,
  increment: number = 1
): { [key: string]: number } {
  const validation = validateCounterUpdate(currentValue, increment);

  if (!validation.isValid) {
    throw new Error(`Invalid counter update: ${validation.errors.join(", ")}`);
  }

  return {
    [field]: validation.newValue,
  };
}

// ===== ERROR HANDLING =====

/**
 * Handle authentication errors and return user-friendly messages
 */
export function handleAuthError(error: unknown): AuthError {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Firebase Auth specific errors
    if (message.includes("network")) {
      return {
        code: "NETWORK_ERROR",
        message: error.message,
        userFriendly:
          "Network error. Please check your connection and try again.",
      };
    }

    if (message.includes("quota") || message.includes("limit")) {
      return {
        code: "QUOTA_EXCEEDED",
        message: error.message,
        userFriendly: "Service limit reached. Please try again later.",
      };
    }

    if (message.includes("permission") || message.includes("unauthorized")) {
      return {
        code: "PERMISSION_DENIED",
        message: error.message,
        userFriendly: "Permission denied. Please check your account status.",
      };
    }

    if (message.includes("invalid") || message.includes("malformed")) {
      return {
        code: "INVALID_DATA",
        message: error.message,
        userFriendly: "Invalid data provided. Please check your input.",
      };
    }

    // Default error
    return {
      code: "UNKNOWN_ERROR",
      message: error.message,
      userFriendly: "An unexpected error occurred. Please try again.",
    };
  }

  // Handle non-Error objects
  if (typeof error === "string") {
    return {
      code: "STRING_ERROR",
      message: error,
      userFriendly: "An error occurred. Please try again.",
    };
  }

  return {
    code: "UNKNOWN_ERROR",
    message: "Unknown error",
    userFriendly: "An unexpected error occurred. Please try again.",
  };
}

/**
 * Check if error is retryable
 */
export function isRetryableAuthError(error: AuthError): boolean {
  const retryableCodes = ["NETWORK_ERROR", "QUOTA_EXCEEDED"];
  return retryableCodes.includes(error.code);
}

// ===== UTILITY FUNCTIONS =====

/**
 * Check if hex color is valid
 */
function isValidHexColor(color: string): boolean {
  const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
  return hexColorRegex.test(color);
}

/**
 * Sanitize user display name
 */
export function sanitizeDisplayName(name: string): string {
  return name.trim().substring(0, 50);
}

/**
 * Create user-friendly error message
 */
export function createUserFriendlyMessage(error: unknown): string {
  const authError = handleAuthError(error);
  return authError.userFriendly;
}

/**
 * Validate Firebase user
 */
export function validateFirebaseUser(user: FirebaseUser | null): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!user) {
    errors.push("No user found");
    return { isValid: false, errors };
  }

  if (!user.uid) {
    errors.push("User ID is required");
  }

  if (user.uid.length < 3) {
    errors.push("User ID must be at least 3 characters");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Check if user is active (logged in within last 30 days)
 */
export function isUserActive(lastActiveAt: Date): boolean {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return lastActiveAt > thirtyDaysAgo;
}

/**
 * Calculate user activity score based on engagement
 */
export function calculateUserActivityScore(
  whisperCount: number,
  totalReactions: number,
  daysSinceCreation: number
): number {
  if (daysSinceCreation === 0) return 0;

  const engagementRate = (whisperCount + totalReactions) / daysSinceCreation;
  const maxScore = 100;

  return Math.min(maxScore, Math.round(engagementRate * 10));
}
