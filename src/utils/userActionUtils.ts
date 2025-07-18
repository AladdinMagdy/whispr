/**
 * User Action Utilities for Whispr
 * Shared utilities for user blocking, muting, and restriction operations
 */

import { UserBlock, UserRestriction } from "../types";

// Types
export interface UserMute {
  id: string;
  userId: string;
  mutedUserId: string;
  mutedUserDisplayName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBlockData {
  userId: string;
  blockedUserId: string;
  blockedUserDisplayName: string;
}

export interface CreateMuteData {
  userId: string;
  mutedUserId: string;
  mutedUserDisplayName: string;
}

export interface CreateRestrictionData {
  userId: string;
  restrictedUserId: string;
  restrictedUserDisplayName: string;
  type: "interaction" | "visibility" | "full";
}

export interface BlockStats {
  totalBlocked: number;
  recentlyBlocked: number;
}

export interface MuteStats {
  totalMuted: number;
  recentlyMuted: number;
}

export interface RestrictionStats {
  totalRestricted: number;
  byType: Record<string, number>;
}

export type UserActionType = "block" | "mute" | "restrict";

// Constants
export const RECENT_DAYS_THRESHOLD = 7;
export const RECENT_DAYS_MS = RECENT_DAYS_THRESHOLD * 24 * 60 * 60 * 1000;

/**
 * Generate a unique ID for user actions
 */
export function generateUserActionId(actionType: UserActionType): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substr(2, 9);
  return `${actionType}-${timestamp}-${randomSuffix}`;
}

/**
 * Validate user action data
 */
export function validateUserActionData(
  userId: string,
  targetUserId: string,
  displayName: string
): void {
  if (!userId || typeof userId !== "string") {
    throw new Error("Invalid userId provided");
  }
  if (!targetUserId || typeof targetUserId !== "string") {
    throw new Error("Invalid targetUserId provided");
  }
  if (!displayName || typeof displayName !== "string") {
    throw new Error("Invalid displayName provided");
  }
  if (userId === targetUserId) {
    throw new Error("Cannot perform action on yourself");
  }
}

/**
 * Check if user action already exists
 */
export function checkExistingAction<T extends { id: string }>(
  existingAction: T | null,
  actionType: UserActionType
): void {
  if (existingAction) {
    const actionName =
      actionType === "block"
        ? "blocked"
        : actionType === "mute"
        ? "muted"
        : "restricted";
    throw new Error(`User is already ${actionName}`);
  }
}

/**
 * Check if user action does not exist
 */
export function checkActionDoesNotExist<T extends { id: string }>(
  action: T | null,
  actionType: UserActionType
): void {
  if (!action) {
    const actionName =
      actionType === "block"
        ? "blocked"
        : actionType === "mute"
        ? "muted"
        : "restricted";
    throw new Error(`User is not ${actionName}`);
  }
}

/**
 * Create a user block object
 */
export function createUserBlock(data: CreateBlockData): UserBlock {
  return {
    id: generateUserActionId("block"),
    userId: data.userId,
    blockedUserId: data.blockedUserId,
    blockedUserDisplayName: data.blockedUserDisplayName,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Create a user mute object
 */
export function createUserMute(data: CreateMuteData): UserMute {
  return {
    id: generateUserActionId("mute"),
    userId: data.userId,
    mutedUserId: data.mutedUserId,
    mutedUserDisplayName: data.mutedUserDisplayName,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Create a user restriction object
 */
export function createUserRestriction(
  data: CreateRestrictionData
): UserRestriction {
  return {
    id: generateUserActionId("restrict"),
    userId: data.userId,
    restrictedUserId: data.restrictedUserId,
    restrictedUserDisplayName: data.restrictedUserDisplayName,
    type: data.type,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Calculate block statistics
 */
export function calculateBlockStats(blockedUsers: UserBlock[]): BlockStats {
  const sevenDaysAgo = new Date(Date.now() - RECENT_DAYS_MS);

  const recentlyBlocked = blockedUsers.filter(
    (block) => block.createdAt > sevenDaysAgo
  ).length;

  return {
    totalBlocked: blockedUsers.length,
    recentlyBlocked,
  };
}

/**
 * Calculate mute statistics
 */
export function calculateMuteStats(mutedUsers: UserMute[]): MuteStats {
  const sevenDaysAgo = new Date(Date.now() - RECENT_DAYS_MS);

  const recentlyMuted = mutedUsers.filter(
    (mute) => mute.createdAt > sevenDaysAgo
  ).length;

  return {
    totalMuted: mutedUsers.length,
    recentlyMuted,
  };
}

/**
 * Calculate restriction statistics
 */
export function calculateRestrictionStats(
  restrictedUsers: UserRestriction[]
): RestrictionStats {
  const byType: Record<string, number> = {
    interaction: 0,
    visibility: 0,
    full: 0,
  };

  restrictedUsers.forEach((restriction) => {
    byType[restriction.type]++;
  });

  return {
    totalRestricted: restrictedUsers.length,
    byType,
  };
}

/**
 * Check if a user action exists
 */
export function checkUserActionExists<T extends { id: string }>(
  action: T | null
): boolean {
  return action !== null;
}

/**
 * Handle user action errors
 */
export function handleUserActionError(
  error: unknown,
  actionType: UserActionType,
  operation: "create" | "delete" | "get" | "check"
): never {
  const actionName =
    actionType === "block"
      ? "block"
      : actionType === "mute"
      ? "mute"
      : "restrict";

  const operationName =
    operation === "create"
      ? actionName
      : operation === "delete"
      ? `un${actionName}`
      : operation === "get"
      ? `get ${actionName}`
      : `check ${actionName}`;

  const errorMessage = error instanceof Error ? error.message : "Unknown error";
  throw new Error(`Failed to ${operationName}: ${errorMessage}`);
}

/**
 * Log user action success
 */
export function logUserActionSuccess(
  actionType: UserActionType,
  operation: "create" | "delete",
  userId: string,
  targetUserId: string
): void {
  const actionName =
    actionType === "block"
      ? "blocked"
      : actionType === "mute"
      ? "muted"
      : "restricted";

  const operationName = operation === "create" ? actionName : `un${actionName}`;

  const emoji =
    actionType === "block" ? "🚫" : actionType === "mute" ? "🔇" : "🚫";

  console.log(`${emoji} User ${targetUserId} ${operationName} by ${userId}`);
}

/**
 * Get recent date threshold
 */
export function getRecentDateThreshold(): Date {
  return new Date(Date.now() - RECENT_DAYS_MS);
}

/**
 * Validate restriction type
 */
export function validateRestrictionType(
  type: string
): type is "interaction" | "visibility" | "full" {
  return ["interaction", "visibility", "full"].includes(type);
}

/**
 * Get default restriction stats
 */
export function getDefaultRestrictionStats(): RestrictionStats {
  return {
    totalRestricted: 0,
    byType: { interaction: 0, visibility: 0, full: 0 },
  };
}

/**
 * Get default block stats
 */
export function getDefaultBlockStats(): BlockStats {
  return {
    totalBlocked: 0,
    recentlyBlocked: 0,
  };
}

/**
 * Get default mute stats
 */
export function getDefaultMuteStats(): MuteStats {
  return {
    totalMuted: 0,
    recentlyMuted: 0,
  };
}
