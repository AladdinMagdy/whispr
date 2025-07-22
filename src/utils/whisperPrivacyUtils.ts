import {
  Whisper,
  UserViolation,
  UserReputation,
  ContentRank,
  ViolationType,
} from "@/types";

// ===== INTERFACES =====

export interface PrivacyData {
  blockedUsers: Set<string>;
  blockedByUsers: Set<string>;
  mutedUsers: Set<string>;
  currentUserId?: string;
  userReputation?: UserReputation;
  userViolations?: UserViolation[];
}

export interface PrivacyFilterResult {
  shouldExclude: boolean;
  reason?: string;
  privacyScore: number;
}

export interface PrivacyStats {
  totalBlockedUsers: number;
  totalMutedUsers: number;
  totalBlockedByUsers: number;
  privacyScore: number;
  violationCount: number;
}

export interface ContentVisibilityOptions {
  isMinor: boolean;
  allowAdultContent: boolean;
  strictFiltering: boolean;
  userAge?: number;
}

// ===== PRIVACY FILTERING FUNCTIONS =====

/**
 * Check if a user should be excluded based on privacy settings
 */
export function shouldExcludeBlockedUser(
  userId: string,
  blockedUsers: Set<string>
): boolean {
  return blockedUsers.has(userId);
}

/**
 * Check if a user should be excluded because they blocked the current user
 */
export function shouldExcludeBlockedByUser(
  userId: string,
  blockedByUsers: Set<string>
): boolean {
  return blockedByUsers.has(userId);
}

/**
 * Check if a user should be excluded based on mute settings
 */
export function shouldExcludeMutedUser(
  userId: string,
  mutedUsers: Set<string>
): boolean {
  return mutedUsers.has(userId);
}

/**
 * Check if content should be excluded based on privacy data
 */
export function shouldExcludeContent(
  whisper: Whisper,
  privacyData: PrivacyData
): PrivacyFilterResult {
  const whisperUserId = whisper.userId;
  let shouldExclude = false;
  let reason: string | undefined;
  let privacyScore = 100;

  // Check if user is blocked
  if (shouldExcludeBlockedUser(whisperUserId, privacyData.blockedUsers)) {
    shouldExclude = true;
    reason = "User is blocked";
    privacyScore = 0;
  }

  // Check if user blocked the current user
  if (shouldExcludeBlockedByUser(whisperUserId, privacyData.blockedByUsers)) {
    shouldExclude = true;
    reason = "User has blocked you";
    privacyScore = 0;
  }

  // Check if user is muted
  if (shouldExcludeMutedUser(whisperUserId, privacyData.mutedUsers)) {
    shouldExclude = true;
    reason = "User is muted";
    privacyScore = 10;
  }

  // Check user reputation if available
  if (
    privacyData.userReputation &&
    whisperUserId === privacyData.currentUserId
  ) {
    const reputationScore = calculateReputationPrivacyScore(
      privacyData.userReputation
    );
    privacyScore = Math.min(privacyScore, reputationScore);
  }

  // Check user violations if available
  if (
    privacyData.userViolations &&
    whisperUserId === privacyData.currentUserId
  ) {
    const violationScore = calculateViolationPrivacyScore(
      privacyData.userViolations
    );
    privacyScore = Math.min(privacyScore, violationScore);
  }

  return {
    shouldExclude,
    reason,
    privacyScore,
  };
}

/**
 * Filter whispers by privacy settings
 */
export function filterWhispersByPrivacy(
  whispers: Whisper[],
  privacyData: PrivacyData
): Whisper[] {
  return whispers.filter((whisper) => {
    const privacyResult = shouldExcludeContent(whisper, privacyData);
    return !privacyResult.shouldExclude;
  });
}

/**
 * Calculate privacy score for a user
 */
export function calculatePrivacyScore(
  userId: string,
  privacyData: PrivacyData
): number {
  let privacyScore = 100;

  // Reduce score for being blocked
  if (privacyData.blockedUsers.has(userId)) {
    privacyScore = 0;
  }

  // Reduce score for being blocked by others
  if (privacyData.blockedByUsers.has(userId)) {
    privacyScore = 0;
  }

  // Reduce score for being muted
  if (privacyData.mutedUsers.has(userId)) {
    privacyScore = Math.min(privacyScore, 10);
  }

  // Apply reputation-based adjustments
  if (privacyData.userReputation && userId === privacyData.currentUserId) {
    const reputationScore = calculateReputationPrivacyScore(
      privacyData.userReputation
    );
    privacyScore = Math.min(privacyScore, reputationScore);
  }

  // Apply violation-based adjustments
  if (privacyData.userViolations && userId === privacyData.currentUserId) {
    const violationScore = calculateViolationPrivacyScore(
      privacyData.userViolations
    );
    privacyScore = Math.min(privacyScore, violationScore);
  }

  return Math.max(0, privacyScore);
}

// ===== REPUTATION-BASED PRIVACY FUNCTIONS =====

/**
 * Calculate privacy score based on user reputation
 */
export function calculateReputationPrivacyScore(
  reputation: UserReputation
): number {
  switch (reputation.level) {
    case "trusted":
      return 100;
    case "verified":
      return 90;
    case "standard":
      return 75;
    case "flagged":
      return 25;
    case "banned":
      return 0;
    default:
      return 50;
  }
}

/**
 * Calculate privacy score based on user violations
 */
export function calculateViolationPrivacyScore(
  violations: UserViolation[]
): number {
  if (violations.length === 0) {
    return 100;
  }

  let totalPenalty = 0;
  const recentViolations = violations.filter(
    (v) =>
      new Date().getTime() - v.createdAt.getTime() < 30 * 24 * 60 * 60 * 1000 // 30 days
  );

  // Calculate penalty based on violation type and recency
  recentViolations.forEach((violation) => {
    let penalty = 0;
    switch (violation.violationType) {
      case "extended_ban":
        penalty = 50;
        break;
      case "temporary_ban":
        penalty = 30;
        break;
      case "whisper_flagged":
        penalty = 20;
        break;
      case "whisper_deleted":
        penalty = 10;
        break;
      default:
        penalty = 15;
    }

    // Apply recency multiplier (more recent = higher penalty)
    const daysSinceViolation =
      (new Date().getTime() - violation.createdAt.getTime()) /
      (24 * 60 * 60 * 1000);
    const recencyMultiplier = Math.max(0.5, 1 - daysSinceViolation / 30);
    penalty *= recencyMultiplier;

    totalPenalty += penalty;
  });

  return Math.max(0, 100 - totalPenalty);
}

// ===== CONTENT VISIBILITY FUNCTIONS =====

/**
 * Check if content should be visible based on age and preferences
 */
export function shouldShowContent(
  whisper: Whisper,
  options: ContentVisibilityOptions
): boolean {
  // Check if user is a minor
  if (options.isMinor) {
    // Filter out adult content for minors
    if (
      whisper.moderationResult?.contentRank === ContentRank.R ||
      whisper.moderationResult?.contentRank === ContentRank.NC17
    ) {
      return false;
    }

    // Filter out content with adult violations
    const hasAdultViolations = whisper.moderationResult?.violations?.some(
      (violation) => violation.type === ViolationType.SEXUAL_CONTENT
    );
    if (hasAdultViolations) {
      return false;
    }
  }

  // Check content preferences
  if (!options.allowAdultContent) {
    if (
      whisper.moderationResult?.contentRank === ContentRank.R ||
      whisper.moderationResult?.contentRank === ContentRank.NC17
    ) {
      return false;
    }
  }

  // Check strict filtering
  if (options.strictFiltering) {
    if (whisper.moderationResult?.contentRank === ContentRank.PG13) {
      return false;
    }
  }

  return true;
}

/**
 * Filter whispers by content visibility
 */
export function filterWhispersByVisibility(
  whispers: Whisper[],
  options: ContentVisibilityOptions
): Whisper[] {
  return whispers.filter((whisper) => shouldShowContent(whisper, options));
}

// ===== PRIVACY STATISTICS FUNCTIONS =====

/**
 * Calculate privacy statistics for a user
 */
export function calculatePrivacyStats(privacyData: PrivacyData): PrivacyStats {
  const totalBlockedUsers = privacyData.blockedUsers.size;
  const totalMutedUsers = privacyData.mutedUsers.size;
  const totalBlockedByUsers = privacyData.blockedByUsers.size;
  const violationCount = privacyData.userViolations?.length || 0;

  let privacyScore = 100;

  // Calculate base privacy score
  if (privacyData.currentUserId) {
    privacyScore = calculatePrivacyScore(
      privacyData.currentUserId,
      privacyData
    );
  }

  return {
    totalBlockedUsers,
    totalMutedUsers,
    totalBlockedByUsers,
    privacyScore,
    violationCount,
  };
}

/**
 * Get privacy recommendations based on current state
 */
export function getPrivacyRecommendations(
  privacyStats: PrivacyStats
): string[] {
  const recommendations: string[] = [];

  if (privacyStats.privacyScore < 25) {
    recommendations.push(
      "Your privacy score is very low. Consider reviewing your content and behavior."
    );
  }

  if (privacyStats.violationCount > 5) {
    recommendations.push(
      "You have multiple violations. Consider taking a break to improve your standing."
    );
  }

  if (privacyStats.totalBlockedByUsers > 10) {
    recommendations.push(
      "Many users have blocked you. Consider reviewing your interaction style."
    );
  }

  if (privacyStats.totalMutedUsers > 20) {
    recommendations.push(
      "Many users have muted you. Consider reducing your posting frequency."
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "Your privacy standing is good. Keep up the positive behavior!"
    );
  }

  return recommendations;
}

// ===== UTILITY FUNCTIONS =====

/**
 * Check if a user has recent violations
 */
export function hasRecentViolations(
  violations: UserViolation[],
  daysBack: number = 30
): boolean {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);

  return violations.some((violation) => violation.createdAt > cutoffDate);
}

/**
 * Get violation count by type
 */
export function getViolationCountByType(
  violations: UserViolation[]
): Record<string, number> {
  const counts: Record<string, number> = {
    whisper_deleted: 0,
    whisper_flagged: 0,
    temporary_ban: 0,
    extended_ban: 0,
  };

  violations.forEach((violation) => {
    counts[violation.violationType] =
      (counts[violation.violationType] || 0) + 1;
  });

  return counts;
}

/**
 * Check if user should be automatically restricted
 */
export function shouldAutoRestrictUser(
  violations: UserViolation[],
  reputation: UserReputation
): boolean {
  const recentViolations = violations.filter(
    (v) =>
      new Date().getTime() - v.createdAt.getTime() < 7 * 24 * 60 * 60 * 1000 // 7 days
  );

  const criticalViolations = recentViolations.filter(
    (v) => v.violationType === "extended_ban"
  );
  const highViolations = recentViolations.filter(
    (v) => v.violationType === "temporary_ban"
  );

  // Auto-restrict if multiple critical violations or many high violations
  if (criticalViolations.length >= 2 || highViolations.length >= 5) {
    return true;
  }

  // Auto-restrict if reputation is very low
  if (reputation.level === "banned" || reputation.score < 10) {
    return true;
  }

  return false;
}

/**
 * Calculate recommended restriction duration
 */
export function calculateRestrictionDuration(
  violations: UserViolation[],
  reputation: UserReputation
): number {
  const recentViolations = violations.filter(
    (v) =>
      new Date().getTime() - v.createdAt.getTime() < 30 * 24 * 60 * 60 * 1000 // 30 days
  );

  let baseDuration = 0;

  // Calculate base duration based on violations
  recentViolations.forEach((violation) => {
    switch (violation.violationType) {
      case "extended_ban":
        baseDuration += 7; // 7 days
        break;
      case "temporary_ban":
        baseDuration += 3; // 3 days
        break;
      case "whisper_flagged":
        baseDuration += 1; // 1 day
        break;
      case "whisper_deleted":
        baseDuration += 0.5; // 12 hours
        break;
    }
  });

  // Adjust based on reputation
  const reputationMultiplier =
    reputation.level === "trusted"
      ? 0.5
      : reputation.level === "verified"
      ? 0.75
      : reputation.level === "standard"
      ? 1
      : reputation.level === "flagged"
      ? 1.5
      : 2;

  return Math.round(baseDuration * reputationMultiplier);
}

/**
 * Validate privacy data
 */
export function validatePrivacyData(privacyData: PrivacyData): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate blocked users
  if (!(privacyData.blockedUsers instanceof Set)) {
    errors.push("blockedUsers must be a Set");
  }

  // Validate muted users
  if (!(privacyData.mutedUsers instanceof Set)) {
    errors.push("mutedUsers must be a Set");
  }

  // Validate blocked by users
  if (!(privacyData.blockedByUsers instanceof Set)) {
    errors.push("blockedByUsers must be a Set");
  }

  // Validate current user ID
  if (
    privacyData.currentUserId &&
    typeof privacyData.currentUserId !== "string"
  ) {
    errors.push("currentUserId must be a string");
  }

  // Validate user reputation
  if (privacyData.userReputation) {
    if (
      !privacyData.userReputation.level ||
      !privacyData.userReputation.score
    ) {
      errors.push("userReputation must have level and score properties");
    }
  }

  // Validate user violations
  if (privacyData.userViolations) {
    if (!Array.isArray(privacyData.userViolations)) {
      errors.push("userViolations must be an array");
    } else {
      privacyData.userViolations.forEach((violation, index) => {
        if (!violation.violationType || !violation.createdAt) {
          errors.push(
            `userViolations[${index}] must have violationType and createdAt properties`
          );
        }
      });
    }
  }

  // Warnings
  if (privacyData.blockedUsers.size > 100) {
    warnings.push("Large number of blocked users may impact performance");
  }

  if (privacyData.mutedUsers.size > 200) {
    warnings.push("Large number of muted users may impact performance");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : [],
  };
}

/**
 * Create default privacy data
 */
export function createDefaultPrivacyData(): PrivacyData {
  return {
    blockedUsers: new Set(),
    blockedByUsers: new Set(),
    mutedUsers: new Set(),
  };
}

/**
 * Merge privacy data
 */
export function mergePrivacyData(
  baseData: PrivacyData,
  additionalData: Partial<PrivacyData>
): PrivacyData {
  return {
    blockedUsers: new Set([
      ...baseData.blockedUsers,
      ...(additionalData.blockedUsers || []),
    ]),
    blockedByUsers: new Set([
      ...baseData.blockedByUsers,
      ...(additionalData.blockedByUsers || []),
    ]),
    mutedUsers: new Set([
      ...baseData.mutedUsers,
      ...(additionalData.mutedUsers || []),
    ]),
    currentUserId: additionalData.currentUserId || baseData.currentUserId,
    userReputation: additionalData.userReputation || baseData.userReputation,
    userViolations: additionalData.userViolations || baseData.userViolations,
  };
}
