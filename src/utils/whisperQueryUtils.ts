import {
  QueryConstraint,
  orderBy,
  where,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
} from "firebase/firestore";
import { Whisper } from "../types";

// ===== TYPE DEFINITIONS =====

export interface WhisperFeedOptions {
  limit?: number;
  lastWhisper?: QueryDocumentSnapshot<DocumentData>;
  userId?: string;
  startAfter?: QueryDocumentSnapshot<DocumentData>;
  userAge?: number;
  isMinor?: boolean;
  contentPreferences?: {
    allowAdultContent: boolean;
    strictFiltering: boolean;
  };
}

export interface PaginatedWhispersResult {
  whispers: Whisper[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

// ===== INTERFACES =====

export interface QueryConstraints {
  constraints: QueryConstraint[];
  options: {
    limit: number;
    hasPagination: boolean;
    hasUserFilter: boolean;
    hasAgeFilter: boolean;
  };
}

export interface PrivacyFilterOptions {
  blockedUsers: Set<string>;
  mutedUsers: Set<string>;
  userId?: string;
}

export interface AgeFilterOptions {
  userAge?: number;
  isMinor?: boolean;
  contentPreferences?: {
    allowAdultContent: boolean;
    strictFiltering: boolean;
  };
}

export interface PaginationOptions {
  lastWhisper?: QueryDocumentSnapshot<DocumentData>;
  startAfter?: QueryDocumentSnapshot<DocumentData>;
  limit?: number;
}

// ===== QUERY BUILDING FUNCTIONS =====

/**
 * Build whisper query constraints based on feed options
 */
export function buildWhisperQueryConstraints(
  options: WhisperFeedOptions = {}
): QueryConstraints {
  const constraints: QueryConstraint[] = [];
  const defaultLimit = 20;
  const maxLimit = 100;

  // Add ordering constraint (always order by creation date, newest first)
  constraints.push(orderBy("createdAt", "desc"));

  // Add user filter if specified
  if (options.userId) {
    constraints.push(where("userId", "==", options.userId));
  }

  // Add pagination constraints
  if (options.startAfter) {
    constraints.push(startAfter(options.startAfter));
  } else if (options.lastWhisper) {
    constraints.push(startAfter(options.lastWhisper));
  }

  // Add limit constraint
  const limitValue = Math.min(options.limit || defaultLimit, maxLimit);
  constraints.push(limit(limitValue));

  return {
    constraints,
    options: {
      limit: limitValue,
      hasPagination: !!(options.startAfter || options.lastWhisper),
      hasUserFilter: !!options.userId,
      hasAgeFilter: false, // Age filtering is handled post-query
    },
  };
}

/**
 * Build privacy filter constraints for user blocking/muting
 */
export function buildPrivacyFilterConstraints(
  privacyOptions: PrivacyFilterOptions
): QueryConstraints {
  const constraints: QueryConstraint[] = [];
  const defaultLimit = 20;

  // Add ordering constraint
  constraints.push(orderBy("createdAt", "desc"));

  // Add user filter if specified
  if (privacyOptions.userId) {
    constraints.push(where("userId", "==", privacyOptions.userId));
  }

  // Note: Privacy filtering (blocked/muted users) is handled post-query
  // because Firestore doesn't support "not in" queries efficiently

  constraints.push(limit(defaultLimit));

  return {
    constraints,
    options: {
      limit: defaultLimit,
      hasPagination: false,
      hasUserFilter: !!privacyOptions.userId,
      hasAgeFilter: false,
    },
  };
}

/**
 * Build age filter constraints for content preferences
 */
export function buildAgeFilterConstraints(): QueryConstraints {
  const constraints: QueryConstraint[] = [];
  const defaultLimit = 20;

  // Add ordering constraint
  constraints.push(orderBy("createdAt", "desc"));

  // Note: Age filtering is handled post-query for complex logic
  // This function prepares the base query

  constraints.push(limit(defaultLimit));

  return {
    constraints,
    options: {
      limit: defaultLimit,
      hasPagination: false,
      hasUserFilter: false,
      hasAgeFilter: true,
    },
  };
}

/**
 * Build pagination constraints
 */
export function buildPaginationConstraints(
  options: PaginationOptions
): QueryConstraints {
  const constraints: QueryConstraint[] = [];
  const defaultLimit = 20;
  const maxLimit = 100;

  // Add ordering constraint
  constraints.push(orderBy("createdAt", "desc"));

  // Add pagination constraints
  if (options.startAfter) {
    constraints.push(startAfter(options.startAfter));
  }

  // Add limit constraint
  const limitValue = Math.min(options.limit || defaultLimit, maxLimit);
  constraints.push(limit(limitValue));

  return {
    constraints,
    options: {
      limit: limitValue,
      hasPagination: !!options.startAfter,
      hasUserFilter: false,
      hasAgeFilter: false,
    },
  };
}

/**
 * Build user filter constraints
 */
export function buildUserFilterConstraints(
  userId: string,
  options: PaginationOptions = {}
): QueryConstraints {
  const constraints: QueryConstraint[] = [];
  const defaultLimit = 20;
  const maxLimit = 100;

  // Add ordering constraint
  constraints.push(orderBy("createdAt", "desc"));

  // Add user filter
  constraints.push(where("userId", "==", userId));

  // Add pagination constraints
  if (options.startAfter) {
    constraints.push(startAfter(options.startAfter));
  }

  // Add limit constraint
  const limitValue = Math.min(options.limit || defaultLimit, maxLimit);
  constraints.push(limit(limitValue));

  return {
    constraints,
    options: {
      limit: limitValue,
      hasPagination: !!options.startAfter,
      hasUserFilter: true,
      hasAgeFilter: false,
    },
  };
}

// ===== POST-QUERY FILTERING FUNCTIONS =====

/**
 * Filter whispers by privacy settings (blocked/muted users)
 */
export function filterWhispersByPrivacy(
  whispers: Whisper[],
  privacyOptions: PrivacyFilterOptions
): Whisper[] {
  if (!privacyOptions.blockedUsers.size && !privacyOptions.mutedUsers.size) {
    return whispers;
  }

  return whispers.filter((whisper) => {
    const whisperUserId = whisper.userId;

    // Skip if user is blocked
    if (privacyOptions.blockedUsers.has(whisperUserId)) {
      return false;
    }

    // Skip if user is muted
    if (privacyOptions.mutedUsers.has(whisperUserId)) {
      return false;
    }

    return true;
  });
}

/**
 * Filter whispers by age and content preferences
 */
export function filterWhispersByAge(
  whispers: Whisper[],
  ageOptions: AgeFilterOptions
): Whisper[] {
  // If no age filters and no content preferences, return all whispers
  if (
    !ageOptions.userAge &&
    !ageOptions.isMinor &&
    !ageOptions.contentPreferences
  ) {
    return whispers;
  }

  return whispers.filter((whisper) => {
    // If user is a minor, apply strict filtering
    if (ageOptions.isMinor) {
      // Check if content is marked as adult content (R or NC17)
      if (
        whisper.moderationResult?.contentRank === "R" ||
        whisper.moderationResult?.contentRank === "NC17"
      ) {
        return false;
      }

      // Check if content has adult content violations
      const hasAdultViolations = whisper.moderationResult?.violations?.some(
        (violation: { type: string; severity: string }) =>
          violation.type === "sexual_content"
      );
      if (hasAdultViolations) {
        return false;
      }
    }

    // If user doesn't allow adult content
    if (ageOptions.contentPreferences?.allowAdultContent === false) {
      if (
        whisper.moderationResult?.contentRank === "R" ||
        whisper.moderationResult?.contentRank === "NC17"
      ) {
        return false;
      }
    }

    // If user has strict filtering enabled
    if (ageOptions.contentPreferences?.strictFiltering) {
      // Apply stricter filtering rules (exclude PG13 and above)
      if (
        whisper.moderationResult?.contentRank === "PG13" ||
        whisper.moderationResult?.contentRank === "R" ||
        whisper.moderationResult?.contentRank === "NC17"
      ) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Apply all filters to whispers
 */
export function applyWhisperFilters(
  whispers: Whisper[],
  privacyOptions?: PrivacyFilterOptions,
  ageOptions?: AgeFilterOptions
): Whisper[] {
  let filteredWhispers = [...whispers];

  // Apply privacy filters
  if (privacyOptions) {
    filteredWhispers = filterWhispersByPrivacy(
      filteredWhispers,
      privacyOptions
    );
  }

  // Apply age filters
  if (ageOptions) {
    filteredWhispers = filterWhispersByAge(filteredWhispers, ageOptions);
  }

  return filteredWhispers;
}

// ===== PAGINATION UTILITIES =====

/**
 * Calculate pagination metadata from query snapshot
 */
export function calculatePaginationMetadata(
  querySnapshot: { docs: QueryDocumentSnapshot<DocumentData>[] },
  requestedLimit: number
): {
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
} {
  const docs = querySnapshot.docs || [];
  const lastDoc = docs.length > 0 ? docs[docs.length - 1] : null;
  const hasMore = docs.length === requestedLimit;

  return {
    lastDoc,
    hasMore,
  };
}

/**
 * Create paginated result from filtered whispers
 */
export function createPaginatedResult(
  whispers: Whisper[],
  lastDoc: QueryDocumentSnapshot<DocumentData> | null,
  hasMore: boolean
): PaginatedWhispersResult {
  return {
    whispers,
    lastDoc,
    hasMore,
  };
}

// ===== QUERY OPTIMIZATION FUNCTIONS =====

/**
 * Optimize query constraints for performance
 */
export function optimizeQueryConstraints(
  constraints: QueryConstraint[]
): QueryConstraint[] {
  // Remove duplicate constraints
  const uniqueConstraints = constraints.filter((constraint, index, array) => {
    return (
      array.findIndex(
        (c) =>
          c.type === constraint.type &&
          JSON.stringify(c) === JSON.stringify(constraint)
      ) === index
    );
  });

  // Ensure ordering is always first
  const orderingConstraints = uniqueConstraints.filter(
    (c) => c.type === "orderBy"
  );
  const otherConstraints = uniqueConstraints.filter(
    (c) => c.type !== "orderBy"
  );

  return [...orderingConstraints, ...otherConstraints];
}

/**
 * Validate query options
 */
export function validateQueryOptions(options: WhisperFeedOptions): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate limit
  if (options.limit !== undefined) {
    if (options.limit <= 0) {
      errors.push("Limit must be greater than 0");
    } else if (options.limit > 100) {
      errors.push("Limit cannot exceed 100");
    } else if (options.limit > 50) {
      warnings.push("Large limits may impact performance");
    }
  }

  // Validate user ID
  if (options.userId && typeof options.userId !== "string") {
    errors.push("User ID must be a string");
  }

  // Validate age options
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
    warnings: warnings.length > 0 ? warnings : [],
  };
}

/**
 * Create default query options
 */
export function createDefaultQueryOptions(): WhisperFeedOptions {
  return {
    limit: 20,
    userAge: undefined,
    isMinor: false,
    contentPreferences: {
      allowAdultContent: false,
      strictFiltering: true,
    },
  };
}

/**
 * Merge query options with defaults
 */
export function mergeQueryOptions(
  userOptions: WhisperFeedOptions = {},
  defaultOptions: WhisperFeedOptions = createDefaultQueryOptions()
): WhisperFeedOptions {
  return {
    ...defaultOptions,
    ...userOptions,
    contentPreferences: {
      ...defaultOptions.contentPreferences,
      ...userOptions.contentPreferences,
    } as {
      allowAdultContent: boolean;
      strictFiltering: boolean;
    },
  };
}

// ===== UTILITY FUNCTIONS =====

/**
 * Check if query has specific constraints
 */
export function hasQueryConstraint(
  constraints: QueryConstraint[],
  constraintType: string,
  field?: string
): boolean {
  return constraints.some((constraint) => {
    if (constraint.type !== constraintType) return false;
    if (field && (constraint as { field?: string }).field !== field)
      return false;
    return true;
  });
}

/**
 * Get constraint by type and field
 */
export function getQueryConstraint(
  constraints: QueryConstraint[],
  constraintType: string,
  field?: string
): QueryConstraint | undefined {
  return constraints.find((constraint) => {
    if (constraint.type !== constraintType) return false;
    if (field && (constraint as { field?: string }).field !== field)
      return false;
    return true;
  });
}

/**
 * Remove constraint by type and field
 */
export function removeQueryConstraint(
  constraints: QueryConstraint[],
  constraintType: string,
  field?: string
): QueryConstraint[] {
  return constraints.filter((constraint) => {
    if (constraint.type !== constraintType) return true;
    if (field && (constraint as { field?: string }).field !== field)
      return true;
    return false;
  });
}

/**
 * Create a copy of query constraints
 */
export function cloneQueryConstraints(
  constraints: QueryConstraint[]
): QueryConstraint[] {
  return constraints.map((constraint) => ({ ...constraint }));
}

/**
 * Check if two query constraint arrays are equivalent
 */
export function areQueryConstraintsEquivalent(
  constraints1: QueryConstraint[],
  constraints2: QueryConstraint[]
): boolean {
  if (constraints1.length !== constraints2.length) return false;

  const sorted1 = constraints1.sort((a, b) =>
    JSON.stringify(a).localeCompare(JSON.stringify(b))
  );
  const sorted2 = constraints2.sort((a, b) =>
    JSON.stringify(a).localeCompare(JSON.stringify(b))
  );

  return sorted1.every(
    (constraint, index) =>
      JSON.stringify(constraint) === JSON.stringify(sorted2[index])
  );
}
