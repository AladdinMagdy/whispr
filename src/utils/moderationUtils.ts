/**
 * Moderation Utilities
 * Utility functions for content moderation logic
 */

import {
  Violation,
  ModerationStatus,
  UserReputation,
  ContentRank,
  LocalModerationResult,
  OpenAIModerationResult,
  PerspectiveAPIResult,
  ModerationResult,
} from "../types";
import { CONTENT_MODERATION } from "../constants";

/**
 * Remove duplicate violations and sort by severity
 */
export function deduplicateViolations(violations: Violation[]): Violation[] {
  const seen = new Set<string>();
  const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };

  return violations
    .filter((violation) => {
      const key = `${violation.type}-${violation.severity}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity]);
}

/**
 * Apply reputation-based actions to violations
 */
export function applyReputationBasedActions(
  violations: Violation[],
  userReputation?: UserReputation,
  featureFlags = CONTENT_MODERATION.FEATURE_FLAGS,
  reputationConfig = CONTENT_MODERATION.REPUTATION
): Violation[] {
  if (!userReputation || !featureFlags.ENABLE_REPUTATION_SYSTEM) {
    return violations;
  }

  const reputationLevel = getReputationLevel(
    userReputation.score,
    reputationConfig
  );
  const reputationActions =
    reputationConfig.REPUTATION_ACTIONS[reputationLevel];

  // Apply reputation-based adjustments
  return violations.map((violation) => {
    let adjustedViolation = { ...violation };

    // Trusted users get reduced penalties
    if (reputationActions.reducedPenalties) {
      if (violation.severity === "critical")
        adjustedViolation.severity = "high";
      if (violation.severity === "high") adjustedViolation.severity = "medium";
      if (violation.severity === "medium") adjustedViolation.severity = "low";
    }

    // Trusted users get more lenient suggested actions
    if (reputationActions.reducedPenalties) {
      if (violation.suggestedAction === "ban")
        adjustedViolation.suggestedAction = "reject";
      if (violation.suggestedAction === "reject")
        adjustedViolation.suggestedAction = "flag";
      if (violation.suggestedAction === "flag")
        adjustedViolation.suggestedAction = "warn";
    }

    return adjustedViolation;
  });
}

/**
 * Determine final moderation status based on violations
 */
export function determineFinalStatus(
  violations: Violation[]
): ModerationStatus {
  if (violations.length === 0) {
    return ModerationStatus.APPROVED;
  }

  // Check for critical violations
  const criticalViolations = violations.filter(
    (v) => v.severity === "critical"
  );
  if (criticalViolations.length > 0) {
    return ModerationStatus.REJECTED;
  }

  // Check for high severity violations
  const highViolations = violations.filter((v) => v.severity === "high");
  if (highViolations.length > 0) {
    return ModerationStatus.REJECTED;
  }

  // Check for medium severity violations
  const mediumViolations = violations.filter((v) => v.severity === "medium");
  if (mediumViolations.length > 0) {
    return ModerationStatus.FLAGGED;
  }

  // Low severity violations
  return ModerationStatus.APPROVED;
}

/**
 * Calculate overall confidence from violations
 */
export function calculateOverallConfidence(violations: Violation[]): number {
  if (violations.length === 0) return 1.0;

  const totalConfidence = violations.reduce((sum, v) => sum + v.confidence, 0);
  return totalConfidence / violations.length;
}

/**
 * Calculate reputation impact from violations
 */
export function calculateReputationImpact(
  violations: Violation[],
  userReputation?: UserReputation,
  reputationConfig = CONTENT_MODERATION.REPUTATION
): number {
  if (!userReputation || violations.length === 0) return 0;

  let totalImpact = 0;
  violations.forEach((violation) => {
    switch (violation.severity) {
      case "critical":
        totalImpact += reputationConfig.SCORE_ADJUSTMENTS.CRITICAL_VIOLATION;
        break;
      case "high":
        totalImpact += reputationConfig.SCORE_ADJUSTMENTS.VIOLATION;
        break;
      case "medium":
        totalImpact += reputationConfig.SCORE_ADJUSTMENTS.FLAGGED_WHISPER;
        break;
      case "low":
        totalImpact += reputationConfig.SCORE_ADJUSTMENTS.APPROVED_WHISPER;
        break;
    }
  });

  return totalImpact;
}

/**
 * Check if content is appealable
 */
export function isAppealable(
  status: ModerationStatus,
  violations: Violation[]
): boolean {
  if (status === ModerationStatus.APPROVED) return false;

  // Critical violations are not appealable
  const hasCriticalViolations = violations.some(
    (v) => v.severity === "critical"
  );
  if (hasCriticalViolations) return false;

  return true;
}

/**
 * Generate reason for moderation decision
 */
export function generateReason(
  violations: Violation[],
  status: ModerationStatus
): string {
  if (violations.length === 0) {
    return "Content approved";
  }

  const violationTypes = violations.map((v) => v.type).join(", ");
  return `Content ${status} due to: ${violationTypes}`;
}

/**
 * Get reputation level from score
 */
export function getReputationLevel(
  score: number,
  reputationConfig = CONTENT_MODERATION.REPUTATION
): keyof typeof CONTENT_MODERATION.REPUTATION.REPUTATION_ACTIONS {
  if (score >= reputationConfig.TRUSTED_THRESHOLD) return "TRUSTED";
  if (score >= reputationConfig.VERIFIED_THRESHOLD) return "VERIFIED";
  if (score >= reputationConfig.STANDARD_THRESHOLD) return "STANDARD";
  if (score >= reputationConfig.FLAGGED_THRESHOLD) return "FLAGGED";
  return "BANNED";
}

/**
 * Create rejection result
 */
export function createRejectionResult(
  reason: string,
  localResult: LocalModerationResult,
  startTime: number,
  openaiResult?: OpenAIModerationResult | null,
  perspectiveResult?: PerspectiveAPIResult | null
): ModerationResult {
  return {
    status: ModerationStatus.REJECTED,
    contentRank: ContentRank.NC17,
    isMinorSafe: false,
    violations: [],
    confidence: 1.0,
    moderationTime: Date.now() - startTime,
    apiResults: {
      local: localResult,
      openai: openaiResult,
      perspective: perspectiveResult,
    },
    reputationImpact: -15,
    appealable: false,
    reason,
  };
}

/**
 * Create error result
 */
export function createErrorResult(
  error: unknown,
  startTime: number
): ModerationResult {
  return {
    status: ModerationStatus.UNDER_REVIEW,
    contentRank: ContentRank.PG13, // Default to conservative ranking
    isMinorSafe: false,
    violations: [],
    confidence: 0.0,
    moderationTime: Date.now() - startTime,
    apiResults: {},
    reputationImpact: 0,
    appealable: true,
    reason: getErrorMessage(error),
  };
}

/**
 * Get error message from unknown error
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "Unknown error occurred during moderation";
}
