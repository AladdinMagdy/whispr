/**
 * Appeal Utilities for Whispr
 * Utility functions for appeal management, validation, and calculations
 */

import {
  Appeal,
  AppealStatus,
  AppealResolution,
  ViolationRecord,
  UserReputation,
} from "../types";
import { TIME_CONSTANTS, REPUTATION_CONSTANTS } from "../constants";

// Types
export interface CreateAppealData {
  userId: string;
  whisperId: string;
  violationId: string;
  reason: string;
  evidence?: string;
}

export interface AppealReviewData {
  appealId: string;
  action: "approve" | "reject" | "partial_approve";
  reason: string;
  moderatorId: string;
  reputationAdjustment?: number;
}

export interface AppealStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  expired: number;
  approvalRate: number;
}

// Constants
export const APPEAL_TIME_LIMITS = {
  trusted: TIME_CONSTANTS.TRUSTED_APPEAL_TIME_LIMIT / TIME_CONSTANTS.ONE_DAY,
  verified: TIME_CONSTANTS.VERIFIED_APPEAL_TIME_LIMIT / TIME_CONSTANTS.ONE_DAY,
  standard: TIME_CONSTANTS.STANDARD_APPEAL_TIME_LIMIT / TIME_CONSTANTS.ONE_DAY,
  flagged: TIME_CONSTANTS.FLAGGED_APPEAL_TIME_LIMIT / TIME_CONSTANTS.ONE_DAY,
  banned: 0,
} as const;

export const AUTO_APPROVAL_THRESHOLDS = {
  trusted: 0.3, // Trusted users auto-approve low confidence violations
  verified: 0.5, // Verified users auto-approve medium confidence violations
  standard: 0.7, // Standard users auto-approve high confidence violations
  flagged: 0.9, // Flagged users rarely auto-approve
  banned: 1.0, // Banned users never auto-approve
} as const;

/**
 * Validate appeal data before creation
 */
export function validateAppealData(
  data: CreateAppealData,
  reputation: UserReputation,
  violation: ViolationRecord | null
): void {
  if (reputation.level === "banned") {
    throw new Error("Banned users cannot submit appeals");
  }

  if (!violation) {
    throw new Error("Violation not found");
  }

  const timeLimit = getAppealTimeLimit(reputation.level);
  const daysSinceViolation = getDaysSinceViolation(violation.timestamp);

  if (daysSinceViolation > timeLimit) {
    throw new Error(
      `Appeal time limit exceeded. You have ${timeLimit} days to appeal.`
    );
  }
}

/**
 * Generate unique appeal ID
 */
export function generateAppealId(): string {
  return `appeal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create appeal object with calculated fields
 */
export function createAppealObject(data: CreateAppealData): Omit<Appeal, "id"> {
  return {
    userId: data.userId,
    whisperId: data.whisperId,
    violationId: data.violationId,
    reason: data.reason,
    evidence: data.evidence,
    status: AppealStatus.PENDING,
    submittedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Get appeal time limit based on reputation level
 */
export function getAppealTimeLimit(reputationLevel: string): number {
  return (
    APPEAL_TIME_LIMITS[reputationLevel as keyof typeof APPEAL_TIME_LIMITS] || 7
  );
}

/**
 * Calculate days since violation
 */
export function getDaysSinceViolation(violationDate: Date): number {
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - violationDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calculate days since appeal submission
 */
export function getDaysSinceSubmission(submissionDate: Date): number {
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - submissionDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Check if violation should be auto-approved
 */
export function shouldAutoApprove(
  violation: ViolationRecord,
  threshold: number
): boolean {
  // This would need to be implemented based on violation confidence
  // For now, we'll use a simple heuristic
  return violation.severity === "low" && Math.random() < threshold;
}

/**
 * Get auto-approval threshold for reputation level
 */
export function getAutoApprovalThreshold(reputationLevel: string): number {
  return (
    AUTO_APPROVAL_THRESHOLDS[
      reputationLevel as keyof typeof AUTO_APPROVAL_THRESHOLDS
    ] || 1.0
  );
}

/**
 * Check if user can appeal based on reputation
 */
export function canUserAppeal(reputation: UserReputation): boolean {
  return reputation.level !== "banned";
}

/**
 * Check if appeal is expired
 */
export function isAppealExpired(appeal: Appeal, timeLimit: number): boolean {
  const daysSinceSubmission = getDaysSinceSubmission(appeal.submittedAt);
  return daysSinceSubmission > timeLimit;
}

/**
 * Create expiration updates for appeal
 */
export function createExpirationUpdates(): Partial<Appeal> {
  return {
    status: AppealStatus.EXPIRED,
    updatedAt: new Date(),
  };
}

/**
 * Process appeal review action and return updates
 */
export function processReviewAction(data: AppealReviewData): Partial<Appeal> {
  const resolution: AppealResolution = {
    action: data.action,
    reason: data.reason,
    moderatorId: data.moderatorId,
    reputationAdjustment: data.reputationAdjustment || 0,
  };

  return {
    status:
      data.action === "approve" ? AppealStatus.APPROVED : AppealStatus.REJECTED,
    resolution,
    reviewedAt: new Date(),
    reviewedBy: data.moderatorId,
    updatedAt: new Date(),
  };
}

/**
 * Create auto-approval resolution
 */
export function createAutoApprovalResolution(): AppealResolution {
  return {
    action: "approve",
    reason: "Auto-approved for trusted user",
    moderatorId: "system",
    reputationAdjustment: REPUTATION_CONSTANTS.APPEAL_APPROVED_BONUS,
  };
}

/**
 * Create auto-approval updates
 */
export function createAutoApprovalUpdates(): Partial<Appeal> {
  return {
    status: AppealStatus.APPROVED,
    resolution: createAutoApprovalResolution(),
    reviewedAt: new Date(),
    reviewedBy: "system",
    updatedAt: new Date(),
  };
}

/**
 * Calculate appeal statistics from appeal list
 */
export function calculateAppealStats(appeals: Appeal[]): AppealStats {
  const stats = {
    total: appeals.length,
    pending: appeals.filter((a) => a.status === AppealStatus.PENDING).length,
    approved: appeals.filter((a) => a.status === AppealStatus.APPROVED).length,
    rejected: appeals.filter((a) => a.status === AppealStatus.REJECTED).length,
    expired: appeals.filter((a) => a.status === AppealStatus.EXPIRED).length,
    approvalRate: 0,
  };

  const resolved = stats.approved + stats.rejected;
  stats.approvalRate = resolved > 0 ? (stats.approved / resolved) * 100 : 0;

  return stats;
}

/**
 * Get default appeal stats
 */
export function getDefaultAppealStats(): AppealStats {
  return {
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    expired: 0,
    approvalRate: 0,
  };
}

/**
 * Check if appeal can be reviewed
 */
export function canReviewAppeal(appeal: Appeal): boolean {
  return appeal.status === AppealStatus.PENDING;
}

/**
 * Get reputation adjustment for appeal action
 */
export function getReputationAdjustment(
  action: AppealReviewData["action"],
  customAdjustment?: number
): number {
  if (customAdjustment !== undefined) {
    return customAdjustment;
  }

  switch (action) {
    case "approve":
      return REPUTATION_CONSTANTS.APPEAL_APPROVED_BONUS;
    case "reject":
      return REPUTATION_CONSTANTS.APPEAL_REJECTED_PENALTY;
    case "partial_approve":
      return REPUTATION_CONSTANTS.APPEAL_APPROVED_BONUS / 2; // Half bonus for partial approval
    default:
      return 0;
  }
}

/**
 * Format appeal reputation adjustment reason
 */
export function formatReputationReason(
  action: AppealReviewData["action"],
  reason: string
): string {
  return `Appeal ${action}: ${reason}`;
}

/**
 * Check if appeal should be auto-approved for user
 */
export function shouldAutoApproveForUser(
  reputation: UserReputation,
  violation: ViolationRecord
): boolean {
  if (reputation.level !== "trusted") {
    return false;
  }

  const threshold = getAutoApprovalThreshold(reputation.level);
  return shouldAutoApprove(violation, threshold);
}

/**
 * Get appeal status display name
 */
export function getAppealStatusDisplay(status: AppealStatus): string {
  switch (status) {
    case AppealStatus.PENDING:
      return "Pending";
    case AppealStatus.APPROVED:
      return "Approved";
    case AppealStatus.REJECTED:
      return "Rejected";
    case AppealStatus.EXPIRED:
      return "Expired";
    default:
      return "Unknown";
  }
}

/**
 * Check if appeal is resolved (approved or rejected)
 */
export function isAppealResolved(appeal: Appeal): boolean {
  return (
    appeal.status === AppealStatus.APPROVED ||
    appeal.status === AppealStatus.REJECTED
  );
}

/**
 * Check if appeal is active (pending)
 */
export function isAppealActive(appeal: Appeal): boolean {
  return appeal.status === AppealStatus.PENDING;
}
