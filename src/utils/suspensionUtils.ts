/**
 * Suspension Utilities for Whispr
 * Utility functions for suspension management, validation, and calculations
 */

import { Suspension, SuspensionType, BanType } from "../types";
import { TIME_CONSTANTS, REPUTATION_CONSTANTS } from "../constants";

// Types
export interface CreateSuspensionData {
  userId: string;
  reason: string;
  type: SuspensionType;
  duration?: number; // in milliseconds, required for temporary suspensions
  moderatorId?: string;
  appealable?: boolean;
}

export interface SuspensionReviewData {
  suspensionId: string;
  action: "extend" | "reduce" | "remove" | "make_permanent";
  reason: string;
  moderatorId: string;
  newDuration?: number;
}

export interface SuspensionStats {
  total: number;
  active: number;
  warnings: number;
  temporary: number;
  permanent: number;
  expired: number;
}

export interface UserSuspensionStatus {
  suspended: boolean;
  suspensions: Suspension[];
  canAppeal: boolean;
}

// Constants
export const DEFAULT_DURATIONS = {
  warning: TIME_CONSTANTS.WARNING_DURATION,
  temporary: TIME_CONSTANTS.TEMPORARY_SUSPENSION_DURATION,
  permanent: 0, // No duration for permanent
} as const;

export const SUSPENSION_THRESHOLDS = {
  FIRST_VIOLATION: SuspensionType.WARNING,
  SECOND_VIOLATION: SuspensionType.TEMPORARY,
  THIRD_VIOLATION: SuspensionType.TEMPORARY,
  FOURTH_VIOLATION: SuspensionType.PERMANENT,
} as const;

/**
 * Validate suspension data before creation
 */
export function validateSuspensionData(data: CreateSuspensionData): void {
  if (data.type === SuspensionType.TEMPORARY && !data.duration) {
    throw new Error("Temporary suspensions require a duration");
  }

  if (data.type === SuspensionType.PERMANENT && data.duration) {
    throw new Error("Permanent suspensions cannot have a duration");
  }
}

/**
 * Calculate suspension end date based on type and duration
 */
export function calculateSuspensionEndDate(
  type: SuspensionType,
  duration?: number
): Date {
  const startDate = new Date();

  if (type === SuspensionType.PERMANENT) {
    return new Date(Date.now() + TIME_CONSTANTS.PERMANENT_SUSPENSION_DURATION);
  }

  const effectiveDuration = duration || DEFAULT_DURATIONS[type];
  return new Date(startDate.getTime() + effectiveDuration);
}

/**
 * Generate unique suspension ID
 */
export function generateSuspensionId(): string {
  return `suspension-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create suspension object with calculated fields
 */
export function createSuspensionObject(
  data: CreateSuspensionData
): Omit<Suspension, "id"> {
  const startDate = new Date();
  const endDate = calculateSuspensionEndDate(data.type, data.duration);

  return {
    userId: data.userId,
    reason: data.reason,
    type: data.type,
    banType: getBanTypeForSuspension(data.type),
    moderatorId: data.moderatorId || "system",
    startDate,
    endDate,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Determine suspension type and duration based on violation count
 */
export function determineAutomaticSuspension(violationCount: number): {
  type: SuspensionType;
  duration?: number;
} {
  if (violationCount === 1) {
    return { type: SuspensionType.WARNING };
  } else if (violationCount === 2) {
    return {
      type: SuspensionType.TEMPORARY,
      duration: TIME_CONSTANTS.TEMPORARY_SUSPENSION_DURATION,
    };
  } else if (violationCount === 3) {
    return {
      type: SuspensionType.TEMPORARY,
      duration: TIME_CONSTANTS.EXTENDED_SUSPENSION_DURATION,
    };
  } else {
    return { type: SuspensionType.PERMANENT };
  }
}

/**
 * Check if suspension is expired
 */
export function isSuspensionExpired(suspension: Suspension): boolean {
  return (
    suspension.endDate !== null &&
    suspension.endDate !== undefined &&
    suspension.endDate <= new Date() &&
    suspension.isActive
  );
}

/**
 * Check if user can appeal their suspension
 */
export function canUserAppeal(suspensions: Suspension[]): boolean {
  return suspensions.some((s) => s.type !== SuspensionType.PERMANENT);
}

/**
 * Get appropriate ban type for suspension type
 */
export function getBanTypeForSuspension(
  suspensionType: SuspensionType
): BanType {
  switch (suspensionType) {
    case SuspensionType.WARNING:
      return BanType.NONE; // Warnings don't hide content
    case SuspensionType.TEMPORARY:
      return BanType.CONTENT_VISIBLE; // Content stays visible but user can't post
    case SuspensionType.PERMANENT:
      return BanType.CONTENT_HIDDEN; // Content becomes invisible to all
    default:
      return BanType.NONE;
  }
}

/**
 * Process suspension review action and return updates
 */
export function processReviewAction(
  suspension: Suspension,
  action: SuspensionReviewData["action"],
  newDuration?: number
): Partial<Suspension> {
  const updates: Partial<Suspension> = {
    updatedAt: new Date(),
  };

  switch (action) {
    case "extend":
      if (suspension.type === SuspensionType.PERMANENT) {
        throw new Error("Cannot extend permanent suspension");
      }
      if (suspension.endDate) {
        updates.endDate = new Date(
          suspension.endDate.getTime() + (newDuration || 0)
        );
      }
      break;

    case "reduce":
      if (suspension.type === SuspensionType.PERMANENT) {
        throw new Error("Cannot reduce permanent suspension");
      }
      if (suspension.endDate) {
        updates.endDate = new Date(
          suspension.endDate.getTime() - (newDuration || 0)
        );
      }
      break;

    case "remove":
      updates.isActive = false;
      break;

    case "make_permanent":
      updates.type = SuspensionType.PERMANENT;
      updates.endDate = new Date(
        Date.now() + TIME_CONSTANTS.PERMANENT_SUSPENSION_DURATION
      );
      break;
  }

  return updates;
}

/**
 * Calculate suspension statistics from suspension list
 */
export function calculateSuspensionStats(
  suspensions: Suspension[]
): SuspensionStats {
  return {
    total: suspensions.length,
    active: suspensions.filter((s) => s.isActive).length,
    warnings: suspensions.filter((s) => s.type === SuspensionType.WARNING)
      .length,
    temporary: suspensions.filter((s) => s.type === SuspensionType.TEMPORARY)
      .length,
    permanent: suspensions.filter((s) => s.type === SuspensionType.PERMANENT)
      .length,
    expired: suspensions.filter((s) => !s.isActive).length,
  };
}

/**
 * Determine user suspension status
 */
export function determineUserSuspensionStatus(
  suspensions: Suspension[]
): UserSuspensionStatus {
  const activeSuspensions = suspensions.filter(
    (s) => s.isActive && s.endDate && s.endDate > new Date()
  );

  return {
    suspended: activeSuspensions.length > 0,
    suspensions: activeSuspensions,
    canAppeal: canUserAppeal(activeSuspensions),
  };
}

/**
 * Format automatic suspension reason
 */
export function formatAutomaticSuspensionReason(
  reason: string,
  violationCount: number
): string {
  return `Automatic suspension: ${reason} (violation #${violationCount})`;
}

/**
 * Check if suspension should affect reputation
 */
export function shouldAffectReputation(
  suspensionType: SuspensionType
): boolean {
  return suspensionType !== SuspensionType.WARNING;
}

/**
 * Get reputation penalty for suspension type
 */
export function getReputationPenalty(suspensionType: SuspensionType): number {
  return shouldAffectReputation(suspensionType)
    ? REPUTATION_CONSTANTS.SUSPENSION_PENALTY
    : 0;
}

/**
 * Get reputation restoration bonus for expired suspension
 */
export function getReputationRestorationBonus(): number {
  return REPUTATION_CONSTANTS.SUSPENSION_RESTORATION_BONUS;
}

/**
 * Create deactivation updates for expired suspension
 */
export function createDeactivationUpdates(): Partial<Suspension> {
  return {
    isActive: false,
    updatedAt: new Date(),
  };
}

/**
 * Check if suspension should restore reputation when expired
 */
export function shouldRestoreReputationOnExpiry(
  suspensionType: SuspensionType
): boolean {
  return suspensionType === SuspensionType.TEMPORARY;
}
