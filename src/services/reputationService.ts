/**
 * Reputation Service for Whispr
 * Tracks user behavior and affects post-moderation actions
 * ALL users go through full moderation - reputation affects POST-moderation actions only
 */

import {
  UserReputation,
  ViolationType,
  ViolationRecord,
  ModerationResult,
} from "../types";
import { getFirestoreService } from "./firestoreService";
import {
  getReputationLevel,
  calculateReputationImpact,
  calculateViolationImpact,
  isAppealable,
  getAppealTimeLimit,
  getPenaltyMultiplier,
  getAutoAppealThreshold,
  getRecoveryRate,
  getDaysSinceLastViolation,
  getDefaultReputation,
  calculateNewScoreAfterViolation,
  calculateNewScoreAfterRecovery,
  calculateRecoveryPoints,
} from "../utils/reputationUtils";

export interface ReputationAction {
  type: "warn" | "flag" | "reject" | "ban" | "appeal" | "perk";
  severity: "low" | "medium" | "high" | "critical";
  reason: string;
  duration?: number; // For temporary actions
  appealable: boolean;
  reputationImpact: number;
}

export interface ReputationThresholds {
  trusted: number; // 90-100: Fast appeals, reduced penalties
  verified: number; // 75-89:  Standard appeals, normal penalties
  standard: number; // 50-74:  Slower appeals, increased penalties
  flagged: number; // 25-49:  Manual review, heavy penalties
  banned: number; // 0-24:   Banned, no appeals
}

export class ReputationService {
  private static instance: ReputationService | null;
  private firestoreService = getFirestoreService();

  private constructor() {}

  static getInstance(): ReputationService {
    if (!ReputationService.instance) {
      ReputationService.instance = new ReputationService();
    }
    return ReputationService.instance;
  }

  /**
   * Get or create user reputation
   */
  async getUserReputation(userId: string): Promise<UserReputation> {
    try {
      // Try to get existing reputation from Firestore
      const existingReputation = await this.firestoreService.getUserReputation(
        userId
      );

      if (existingReputation) {
        return existingReputation;
      }

      // Create default reputation for new users
      const defaultReputation = getDefaultReputation(userId);
      await this.firestoreService.saveUserReputation(defaultReputation);

      return defaultReputation;
    } catch (error) {
      console.error("❌ Error fetching user reputation:", error);
      return getDefaultReputation(userId);
    }
  }

  /**
   * Apply reputation-based actions to moderation results
   */
  async applyReputationBasedActions(
    moderationResult: ModerationResult,
    userId: string
  ): Promise<ModerationResult> {
    try {
      const reputation = await this.getUserReputation(userId);
      const reputationLevel = getReputationLevel(reputation.score);

      // Apply reputation-based modifications
      const modifiedResult = {
        ...moderationResult,
        reputationImpact: calculateReputationImpact(
          moderationResult,
          reputationLevel
        ),
        appealable: isAppealable(moderationResult, reputationLevel),
        appealTimeLimit: getAppealTimeLimit(reputationLevel),
        penaltyMultiplier: getPenaltyMultiplier(reputationLevel),
        autoAppealThreshold: getAutoAppealThreshold(reputationLevel),
      };

      console.log(
        `🔍 Applied reputation actions for user ${userId} (${reputationLevel}):`,
        {
          score: reputation.score,
          impact: modifiedResult.reputationImpact,
          appealable: modifiedResult.appealable,
          timeLimit: modifiedResult.appealTimeLimit,
        }
      );

      return modifiedResult;
    } catch (error) {
      console.error("❌ Error applying reputation actions:", error);
      return moderationResult; // Return original result if reputation fails
    }
  }

  /**
   * Record a violation and update reputation
   */
  async recordViolation(
    userId: string,
    whisperId: string,
    violationType: ViolationType,
    severity: "low" | "medium" | "high" | "critical"
  ): Promise<void> {
    try {
      const reputation = await this.getUserReputation(userId);
      const impact = calculateViolationImpact(violationType, severity);

      // Update reputation score
      const newScore = calculateNewScoreAfterViolation(
        reputation.score,
        impact
      );

      // Create violation record
      const violationRecord: ViolationRecord = {
        id: `${userId}-${Date.now()}`,
        whisperId,
        violationType,
        severity,
        timestamp: new Date(),
        resolved: false,
        notes: `Violation recorded: ${violationType} (${severity})`,
      };

      // Update reputation with new score and violation
      const updatedReputation: UserReputation = {
        ...reputation,
        score: newScore,
        level: getReputationLevel(newScore),
        flaggedWhispers: reputation.flaggedWhispers + 1,
        lastViolation: new Date(),
        violationHistory: [...reputation.violationHistory, violationRecord],
        updatedAt: new Date(),
      };

      // Save to Firestore
      await this.firestoreService.saveUserReputation(updatedReputation);

      console.log(`📝 Recorded violation for user ${userId}:`, {
        type: violationType,
        severity,
        impact,
        newScore,
        level: getReputationLevel(newScore),
      });
    } catch (error) {
      console.error("❌ Error recording violation:", error);
    }
  }

  /**
   * Record a successful whisper (positive reputation)
   */
  async recordSuccessfulWhisper(userId: string): Promise<void> {
    try {
      const reputation = await this.getUserReputation(userId);
      const recovery = getRecoveryRate(reputation.score);

      // Small positive impact for successful whispers
      const newScore = Math.min(100, reputation.score + recovery);

      // Update reputation with positive impact
      const updatedReputation: UserReputation = {
        ...reputation,
        score: newScore,
        level: getReputationLevel(newScore),
        approvedWhispers: reputation.approvedWhispers + 1,
        totalWhispers: reputation.totalWhispers + 1,
        updatedAt: new Date(),
      };

      // Save to Firestore
      await this.firestoreService.saveUserReputation(updatedReputation);

      console.log(`✅ Recorded successful whisper for user ${userId}:`, {
        recovery,
        newScore,
        level: getReputationLevel(newScore),
      });
    } catch (error) {
      console.error("❌ Error recording successful whisper:", error);
    }
  }

  /**
   * Process reputation recovery (called periodically)
   */
  async processReputationRecovery(userId: string): Promise<void> {
    try {
      const reputation = await this.getUserReputation(userId);
      const daysSinceLastViolation = getDaysSinceLastViolation(reputation);
      const recoveryRate = getRecoveryRate(reputation.score);

      // Apply time-based recovery
      const recoveryPoints = calculateRecoveryPoints(
        reputation,
        daysSinceLastViolation
      );
      const newScore = calculateNewScoreAfterRecovery(
        reputation.score,
        recoveryPoints
      );

      if (newScore > reputation.score) {
        // Update reputation with recovery
        const updatedReputation: UserReputation = {
          ...reputation,
          score: newScore,
          level: getReputationLevel(newScore),
          updatedAt: new Date(),
        };

        // Save to Firestore
        await this.firestoreService.saveUserReputation(updatedReputation);

        console.log(`🔄 Processed reputation recovery for user ${userId}:`, {
          daysSinceViolation: daysSinceLastViolation,
          recoveryRate,
          recoveryPoints,
          newScore,
        });
      }
    } catch (error) {
      console.error("❌ Error processing reputation recovery:", error);
    }
  }

  /**
   * Reset reputation (for testing or admin actions)
   */
  async resetReputation(userId: string): Promise<void> {
    try {
      const defaultReputation = getDefaultReputation(userId);
      await this.firestoreService.saveUserReputation(defaultReputation);
      console.log(`🔄 Reset reputation for user ${userId}`);
    } catch (error) {
      console.error("❌ Error resetting reputation:", error);
    }
  }

  /**
   * Get reputation statistics
   */
  async getReputationStats(): Promise<{
    totalUsers: number;
    trustedUsers: number;
    verifiedUsers: number;
    standardUsers: number;
    flaggedUsers: number;
    bannedUsers: number;
    averageScore: number;
  }> {
    try {
      return await this.firestoreService.getReputationStats();
    } catch (error) {
      console.error("❌ Error getting reputation stats:", error);
      throw error;
    }
  }

  // Singleton management
  static resetInstance(): void {
    ReputationService.instance = new ReputationService();
  }

  static destroyInstance(): void {
    ReputationService.instance = null;
  }
}

/**
 * Factory function to get ReputationService instance
 */
export const getReputationService = (): ReputationService => {
  return ReputationService.getInstance();
};

/**
 * Reset the ReputationService singleton instance
 */
export const resetReputationService = (): void => {
  ReputationService.resetInstance();
};

/**
 * Destroy the ReputationService singleton instance
 */
export const destroyReputationService = (): void => {
  ReputationService.destroyInstance();
};
