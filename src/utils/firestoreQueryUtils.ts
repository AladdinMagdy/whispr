/**
 * Firestore Query Utilities
 * Extracted from FirestoreService for better testability
 */

import {
  QueryConstraint,
  where,
  orderBy,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
} from "firebase/firestore";
import { WhisperFeedOptions } from "../services/firestoreService";

export interface QueryConstraints {
  constraints: QueryConstraint[];
  description: string;
}

export interface SubscriptionQueryOptions {
  userId?: string;
  userAge?: number;
  isMinor?: boolean;
  contentPreferences?: {
    allowAdultContent: boolean;
    strictFiltering: boolean;
  };
  sinceTimestamp?: Date;
  limit?: number;
}

export interface CommentQueryOptions {
  whisperId: string;
  limit?: number;
  lastDoc?: QueryDocumentSnapshot<DocumentData>;
}

export interface LikeQueryOptions {
  contentId: string; // whisperId or commentId
  contentType: "whisper" | "comment";
  limit?: number;
  lastDoc?: QueryDocumentSnapshot<DocumentData>;
}

/**
 * Build query constraints for whisper feed based on options
 */
export function buildWhisperQueryConstraints(
  options: WhisperFeedOptions = {}
): QueryConstraints {
  const {
    limit: limitCount = 20,
    lastWhisper,
    userId,
    startAfter: startAfterDoc,
    userAge,
    isMinor,
    contentPreferences,
  } = options;

  const constraints: QueryConstraint[] = [];
  const descriptions: string[] = [];

  // Always order by creation date (newest first)
  constraints.push(orderBy("createdAt", "desc"));
  descriptions.push("ordered by createdAt desc");

  // Add user filter if specified
  if (userId) {
    constraints.push(where("userId", "==", userId));
    descriptions.push(`filtered by userId: ${userId}`);
  }

  // Add age-based filtering
  if (userAge !== undefined && isMinor !== undefined) {
    if (isMinor) {
      // For minors, only show content marked as minor-safe
      constraints.push(where("moderationResult.isMinorSafe", "==", true));
      descriptions.push("filtered for minors (isMinorSafe: true)");
    } else if (contentPreferences?.strictFiltering) {
      // For adults with strict filtering, exclude adult content
      constraints.push(
        where("moderationResult.contentRank", "in", ["G", "PG", "PG13"])
      );
      descriptions.push("filtered for strict content (G, PG, PG13 only)");
    }
  }

  // Add pagination
  if (startAfterDoc) {
    constraints.push(startAfter(startAfterDoc));
    descriptions.push("pagination: startAfter document");
  } else if (lastWhisper) {
    constraints.push(startAfter(lastWhisper));
    descriptions.push("pagination: startAfter last whisper");
  }

  // Add limit
  constraints.push(limit(limitCount));
  descriptions.push(`limited to ${limitCount} results`);

  return {
    constraints,
    description: descriptions.join(", "),
  };
}

/**
 * Validate whisper feed options
 */
export function validateWhisperFeedOptions(options: WhisperFeedOptions): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate limit
  if (options.limit !== undefined) {
    if (options.limit <= 0) {
      errors.push("Limit must be greater than 0");
    }
    if (options.limit > 100) {
      errors.push("Limit cannot exceed 100");
    }
  }

  // Validate user age and minor status consistency
  if (options.userAge !== undefined && options.isMinor === undefined) {
    errors.push("isMinor must be specified when userAge is provided");
  }

  if (options.isMinor !== undefined && options.userAge === undefined) {
    errors.push("userAge must be specified when isMinor is provided");
  }

  // Validate age range
  if (options.userAge !== undefined) {
    if (options.userAge < 0 || options.userAge > 120) {
      errors.push("User age must be between 0 and 120");
    }
  }

  // Validate content preferences
  if (options.contentPreferences) {
    if (typeof options.contentPreferences.allowAdultContent !== "boolean") {
      errors.push("allowAdultContent must be a boolean");
    }
    if (typeof options.contentPreferences.strictFiltering !== "boolean") {
      errors.push("strictFiltering must be a boolean");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Get default whisper feed options
 */
export function getDefaultWhisperFeedOptions(): WhisperFeedOptions {
  return {
    limit: 20,
  };
}

/**
 * Merge whisper feed options with defaults
 */
export function mergeWhisperFeedOptions(
  options: WhisperFeedOptions = {}
): WhisperFeedOptions {
  const defaults = getDefaultWhisperFeedOptions();

  return {
    ...defaults,
    ...options,
  };
}

/**
 * Check if query should include age-based filtering
 */
export function shouldIncludeAgeFiltering(
  userAge?: number,
  isMinor?: boolean
): boolean {
  return userAge !== undefined && isMinor !== undefined;
}

/**
 * Check if query should include strict content filtering
 */
export function shouldIncludeStrictFiltering(
  isMinor: boolean,
  contentPreferences?: { allowAdultContent: boolean; strictFiltering: boolean }
): boolean {
  return !isMinor && contentPreferences?.strictFiltering === true;
}

/**
 * Get content rank values for strict filtering
 */
export function getStrictContentRanks(): string[] {
  return ["G", "PG", "PG13"];
}

/**
 * Get content rank values for adult content
 */
export function getAdultContentRanks(): string[] {
  return ["R", "NC17"];
}

/**
 * Check if content rank is appropriate for minors
 */
export function isContentRankMinorSafe(contentRank: string): boolean {
  const minorSafeRanks = ["G", "PG", "PG13"];
  return minorSafeRanks.includes(contentRank);
}

/**
 * Check if content rank is adult content
 */
export function isContentRankAdult(contentRank: string): boolean {
  const adultRanks = getAdultContentRanks();
  return adultRanks.includes(contentRank);
}

/**
 * Build pagination constraints
 */
export function buildPaginationConstraints(
  lastWhisper?: QueryDocumentSnapshot<DocumentData>,
  startAfterDoc?: QueryDocumentSnapshot<DocumentData>
): QueryConstraint[] {
  const constraints: QueryConstraint[] = [];

  if (startAfterDoc) {
    constraints.push(startAfter(startAfterDoc));
  } else if (lastWhisper) {
    constraints.push(startAfter(lastWhisper));
  }

  return constraints;
}

/**
 * Build user filter constraints
 */
export function buildUserFilterConstraints(userId?: string): QueryConstraint[] {
  const constraints: QueryConstraint[] = [];

  if (userId) {
    constraints.push(where("userId", "==", userId));
  }

  return constraints;
}

/**
 * Build age-based filter constraints
 */
export function buildAgeFilterConstraints(
  userAge?: number,
  isMinor?: boolean,
  contentPreferences?: { allowAdultContent: boolean; strictFiltering: boolean }
): QueryConstraint[] {
  const constraints: QueryConstraint[] = [];

  if (userAge !== undefined && isMinor !== undefined) {
    if (isMinor) {
      constraints.push(where("moderationResult.isMinorSafe", "==", true));
    } else if (contentPreferences?.strictFiltering) {
      constraints.push(
        where("moderationResult.contentRank", "in", getStrictContentRanks())
      );
    }
  }

  return constraints;
}

/**
 * Build query constraints for real-time whisper subscriptions
 */
export function buildWhisperSubscriptionConstraints(
  options: SubscriptionQueryOptions = {}
): QueryConstraints {
  const {
    limit: limitCount = 20,
    userId,
    userAge,
    isMinor,
    contentPreferences,
    sinceTimestamp,
  } = options;

  const constraints: QueryConstraint[] = [];
  const descriptions: string[] = [];

  constraints.push(orderBy("createdAt", "desc"));
  descriptions.push("ordered by createdAt desc");

  if (sinceTimestamp) {
    constraints.push(where("createdAt", ">", sinceTimestamp));
    descriptions.push(`filtered since ${sinceTimestamp.toISOString()}`);
  }

  if (userId) {
    constraints.push(where("userId", "==", userId));
    descriptions.push(`filtered by userId: ${userId}`);
  }

  if (userAge !== undefined && isMinor !== undefined) {
    if (isMinor) {
      constraints.push(where("moderationResult.isMinorSafe", "==", true));
      descriptions.push("filtered for minors (isMinorSafe: true)");
    } else if (contentPreferences?.strictFiltering) {
      constraints.push(
        where("moderationResult.contentRank", "in", ["G", "PG", "PG13"])
      );
      descriptions.push("filtered for strict content (G, PG, PG13 only)");
    }
  }

  constraints.push(limit(limitCount));
  descriptions.push(`limited to ${limitCount} results`);

  return {
    constraints,
    description: descriptions.join(", "),
  };
}

/**
 * Build query constraints for comment queries
 */
export function buildCommentQueryConstraints(
  options: CommentQueryOptions
): QueryConstraints {
  const { whisperId, limit: limitCount = 50, lastDoc } = options;

  const constraints: QueryConstraint[] = [];
  const descriptions: string[] = [];

  constraints.push(where("whisperId", "==", whisperId));
  descriptions.push(`filtered by whisperId: ${whisperId}`);

  constraints.push(orderBy("createdAt", "desc"));
  descriptions.push("ordered by createdAt desc");

  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
    descriptions.push("pagination: startAfter document");
  }

  constraints.push(limit(limitCount));
  descriptions.push(`limited to ${limitCount} results`);

  return {
    constraints,
    description: descriptions.join(", "),
  };
}

/**
 * Build query constraints for like queries
 */
export function buildLikeQueryConstraints(
  options: LikeQueryOptions
): QueryConstraints {
  const { contentId, contentType, limit: limitCount = 50, lastDoc } = options;

  const constraints: QueryConstraint[] = [];
  const descriptions: string[] = [];

  // Use the appropriate field based on content type
  const fieldName = contentType === "whisper" ? "whisperId" : "commentId";
  constraints.push(where(fieldName, "==", contentId));
  descriptions.push(`filtered by ${fieldName}: ${contentId}`);

  constraints.push(orderBy("createdAt", "desc"));
  descriptions.push("ordered by createdAt desc");

  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
    descriptions.push("pagination: startAfter document");
  }

  constraints.push(limit(limitCount));
  descriptions.push(`limited to ${limitCount} results`);

  return {
    constraints,
    description: descriptions.join(", "),
  };
}
