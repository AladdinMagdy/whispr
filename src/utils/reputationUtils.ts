/**
 * Reputation Utilities
 * Production-ready utility functions for reputation calculations and logic
 */

import {
  UserReputation,
  ViolationType,
  ModerationResult,
  Violation,
} from "../types";
import { REPUTATION_CONSTANTS } from "../constants";

// Reputation thresholds
export const REPUTATION_THRESHOLDS = {
  trusted: 90,
  verified: 75,
  standard: 50,
  flagged: 25,
  banned: 0,
} as const;

// Violation impact scores
export const VIOLATION_IMPACT_SCORES: Record<ViolationType, number> = {
  [ViolationType.HARASSMENT]: 15,
  [ViolationType.HATE_SPEECH]: 25,
  [ViolationType.VIOLENCE]: 30,
  [ViolationType.SEXUAL_CONTENT]: 20,
  [ViolationType.DRUGS]: 15,
  [ViolationType.SPAM]: 5,
  [ViolationType.SCAM]: 20,
  [ViolationType.COPYRIGHT]: 10,
  [ViolationType.PERSONAL_INFO]: 15,
  [ViolationType.MINOR_SAFETY]: 35, // Highest penalty for minor safety violations
};

// Reputation recovery rates (points per day)
export const RECOVERY_RATES = {
  trusted: 2, // Trusted users recover faster
  verified: 1.5, // Verified users recover moderately
  standard: 1, // Standard users recover normally
  flagged: 0.5, // Flagged users recover slowly
  banned: 0, // Banned users don't recover
} as const;

// Appeal time limits (in days)
export const APPEAL_TIME_LIMITS = {
  trusted: 30, // 30 days for trusted users
  verified: 14, // 14 days for verified users
  standard: 7, // 7 days for standard users
  flagged: 3, // 3 days for flagged users
  banned: 0, // No appeals for banned users
} as const;

// Penalty multipliers based on reputation level
export const PENALTY_MULTIPLIERS = {
  trusted: 0.5, // Trusted users get reduced penalties
  verified: 0.75, // Verified users get slightly reduced penalties
  standard: 1.0, // Standard users get normal penalties
  flagged: 1.5, // Flagged users get increased penalties
  banned: 2.0, // Banned users get maximum penalties
} as const;

// Auto-approval thresholds based on reputation level
export const AUTO_APPROVAL_THRESHOLDS = {
  trusted: 0.3, // Trusted users auto-appeal low confidence violations
  verified: 0.5, // Verified users auto-appeal medium confidence violations
  standard: 0.7, // Standard users auto-appeal high confidence violations
  flagged: 0.9, // Flagged users rarely auto-appeal
  banned: 1.0, // Banned users never auto-appeal
} as const;

// Severity multipliers for violation impact
export const SEVERITY_MULTIPLIERS = {
  low: 0.5,
  medium: 1.0,
  high: 1.5,
  critical: 2.0,
} as const;

// Type definitions
export type ReputationLevel = keyof typeof REPUTATION_THRESHOLDS;
export type Severity = keyof typeof SEVERITY_MULTIPLIERS;

/**
 * Get reputation level from score
 */
export function getReputationLevel(score: number): ReputationLevel {
  if (!Number.isFinite(score) || score < 0) {
    throw new Error(`Invalid reputation score: ${score}`);
  }

  if (score >= REPUTATION_THRESHOLDS.trusted) return "trusted";
  if (score >= REPUTATION_THRESHOLDS.verified) return "verified";
  if (score >= REPUTATION_THRESHOLDS.standard) return "standard";
  if (score >= REPUTATION_THRESHOLDS.flagged) return "flagged";
  return "banned";
}

/**
 * Calculate reputation impact for a moderation result
 */
export function calculateReputationImpact(
  moderationResult: ModerationResult,
  reputationLevel: ReputationLevel
): number {
  if (
    !moderationResult.violations ||
    moderationResult.violations.length === 0
  ) {
    return 0;
  }

  const baseImpact = moderationResult.violations.reduce((total, violation) => {
    const impact = VIOLATION_IMPACT_SCORES[violation.type] || 10;
    const severityMultiplier = SEVERITY_MULTIPLIERS[violation.severity] || 1.0;
    return total + impact * severityMultiplier;
  }, 0);

  // Apply reputation-based multiplier
  const multiplier = PENALTY_MULTIPLIERS[reputationLevel];
  return Math.round(baseImpact * multiplier);
}

/**
 * Calculate violation impact for a specific violation
 */
export function calculateViolationImpact(
  violationType: ViolationType,
  severity: Severity
): number {
  const baseImpact = VIOLATION_IMPACT_SCORES[violationType] || 10;
  const severityMultiplier = SEVERITY_MULTIPLIERS[severity] || 1.0;
  return Math.round(baseImpact * severityMultiplier);
}

/**
 * Check if violation is appealable based on reputation
 */
export function isAppealable(
  moderationResult: ModerationResult,
  reputationLevel: ReputationLevel
): boolean {
  // Banned users cannot appeal
  if (reputationLevel === "banned") return false;

  // Critical violations are rarely appealable
  const hasCriticalViolation = moderationResult.violations?.some(
    (v) => v.severity === "critical"
  );

  if (hasCriticalViolation && reputationLevel === "flagged") return false;

  return true;
}

/**
 * Get appeal time limit based on reputation level
 */
export function getAppealTimeLimit(reputationLevel: ReputationLevel): number {
  return APPEAL_TIME_LIMITS[reputationLevel] ?? 7;
}

/**
 * Get penalty multiplier based on reputation level
 */
export function getPenaltyMultiplier(reputationLevel: ReputationLevel): number {
  return PENALTY_MULTIPLIERS[reputationLevel] || 1.0;
}

/**
 * Get auto-appeal threshold based on reputation level
 */
export function getAutoAppealThreshold(
  reputationLevel: ReputationLevel
): number {
  return AUTO_APPROVAL_THRESHOLDS[reputationLevel] || 0.7;
}

/**
 * Get recovery rate based on current score
 */
export function getRecoveryRate(score: number): number {
  if (!Number.isFinite(score) || score < 0) {
    throw new Error(`Invalid reputation score: ${score}`);
  }

  const level = getReputationLevel(score);
  return RECOVERY_RATES[level] || 0;
}

/**
 * Get days since last violation
 */
export function getDaysSinceLastViolation(reputation: UserReputation): number {
  if (!reputation.lastViolation) return 365; // No violations = full recovery

  const now = new Date();
  const lastViolation = new Date(reputation.lastViolation);
  const diffTime = Math.abs(now.getTime() - lastViolation.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return Math.min(diffDays, 365); // Cap at 365 days
}

/**
 * Calculate reputation recovery points
 */
export function calculateRecoveryPoints(
  reputation: UserReputation,
  daysSinceViolation: number
): number {
  const recoveryRate = getRecoveryRate(reputation.score);
  return Math.min(
    daysSinceViolation * recoveryRate,
    100 - reputation.score // Don't exceed max score
  );
}

/**
 * Calculate new reputation score after violation
 */
export function calculateNewScoreAfterViolation(
  currentScore: number,
  violationImpact: number
): number {
  if (!Number.isFinite(currentScore) || currentScore < 0) {
    throw new Error(`Invalid current score: ${currentScore}`);
  }
  if (!Number.isFinite(violationImpact) || violationImpact < 0) {
    throw new Error(`Invalid violation impact: ${violationImpact}`);
  }

  return Math.max(0, Math.min(100, currentScore - violationImpact));
}

/**
 * Calculate new reputation score after recovery
 */
export function calculateNewScoreAfterRecovery(
  currentScore: number,
  recoveryPoints: number
): number {
  if (!Number.isFinite(currentScore) || currentScore < 0) {
    throw new Error(`Invalid current score: ${currentScore}`);
  }
  if (!Number.isFinite(recoveryPoints) || recoveryPoints < 0) {
    throw new Error(`Invalid recovery points: ${recoveryPoints}`);
  }

  return Math.max(0, Math.min(100, currentScore + recoveryPoints));
}

/**
 * Check if user can auto-appeal based on violation confidence
 */
export function canAutoAppeal(
  violation: Violation,
  reputationLevel: ReputationLevel
): boolean {
  const threshold = getAutoAppealThreshold(reputationLevel);
  return violation.confidence < threshold;
}

/**
 * Get default reputation for new users
 */
export function getDefaultReputation(userId: string): UserReputation {
  return {
    userId,
    score: REPUTATION_CONSTANTS.INITIAL_USER_SCORE,
    level: getReputationLevel(REPUTATION_CONSTANTS.INITIAL_USER_SCORE),
    flaggedWhispers: 0,
    totalWhispers: 0,
    approvedWhispers: 0,
    rejectedWhispers: 0,
    lastViolation: undefined,
    violationHistory: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Validate reputation data
 */
export function validateReputation(reputation: UserReputation): boolean {
  return (
    typeof reputation.userId === "string" &&
    reputation.userId.length > 0 &&
    Number.isFinite(reputation.score) &&
    reputation.score >= 0 &&
    reputation.score <= 100 &&
    typeof reputation.level === "string" &&
    Object.keys(REPUTATION_THRESHOLDS).includes(reputation.level) &&
    Number.isFinite(reputation.flaggedWhispers) &&
    reputation.flaggedWhispers >= 0 &&
    Number.isFinite(reputation.totalWhispers) &&
    reputation.totalWhispers >= 0 &&
    Number.isFinite(reputation.approvedWhispers) &&
    reputation.approvedWhispers >= 0 &&
    Number.isFinite(reputation.rejectedWhispers) &&
    reputation.rejectedWhispers >= 0 &&
    Array.isArray(reputation.violationHistory) &&
    reputation.createdAt instanceof Date &&
    reputation.updatedAt instanceof Date
  );
}

/**
 * Get reputation statistics from a list of reputations
 */
export function calculateReputationStats(reputations: UserReputation[]): {
  totalUsers: number;
  trustedUsers: number;
  verifiedUsers: number;
  standardUsers: number;
  flaggedUsers: number;
  bannedUsers: number;
  averageScore: number;
} {
  if (!Array.isArray(reputations) || reputations.length === 0) {
    return {
      totalUsers: 0,
      trustedUsers: 0,
      verifiedUsers: 0,
      standardUsers: 0,
      flaggedUsers: 0,
      bannedUsers: 0,
      averageScore: 0,
    };
  }

  const validReputations = reputations.filter(validateReputation);

  const stats = validReputations.reduce(
    (acc, reputation) => {
      acc.totalUsers++;
      acc[`${reputation.level}Users`]++;
      acc.totalScore += reputation.score;
      return acc;
    },
    {
      totalUsers: 0,
      trustedUsers: 0,
      verifiedUsers: 0,
      standardUsers: 0,
      flaggedUsers: 0,
      bannedUsers: 0,
      totalScore: 0,
    }
  );

  return {
    ...stats,
    averageScore:
      stats.totalUsers > 0 ? stats.totalScore / stats.totalUsers : 0,
  };
}

/**
 * Check if reputation needs recovery processing
 */
export function needsRecoveryProcessing(reputation: UserReputation): boolean {
  if (!reputation.lastViolation) return false;

  const daysSinceViolation = getDaysSinceLastViolation(reputation);
  const recoveryRate = getRecoveryRate(reputation.score);

  // Only process if there's potential for recovery
  return daysSinceViolation > 0 && recoveryRate > 0 && reputation.score < 100;
}

/**
 * Get reputation level description
 */
export function getReputationLevelDescription(level: ReputationLevel): string {
  const descriptions = {
    trusted: "Trusted user with fast appeals and reduced penalties",
    verified: "Verified user with standard appeals and normal penalties",
    standard: "Standard user with slower appeals and increased penalties",
    flagged: "Flagged user requiring manual review with heavy penalties",
    banned: "Banned user with no appeals and maximum penalties",
  };

  return descriptions[level] || "Unknown reputation level";
}

/**
 * Get reputation score description
 */
export function getReputationScoreDescription(score: number): string {
  if (score >= 90) return "Excellent reputation";
  if (score >= 75) return "Good reputation";
  if (score >= 50) return "Average reputation";
  if (score >= 25) return "Poor reputation";
  return "Very poor reputation";
}
