/**
 * Reputation Service for Whispr
 * Tracks user behavior and affects post-moderation actions
 * ALL users go through full moderation - reputation affects POST-moderation actions only
 */

import { UserReputation, ViolationType } from "../types";
import { getFirestoreService } from "./firestoreService";

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
  private static instance: ReputationService;
  private firestoreService = getFirestoreService();

  // Reputation thresholds
  private static readonly THRESHOLDS: ReputationThresholds = {
    trusted: 90,
    verified: 75,
    standard: 50,
    flagged: 25,
    banned: 0,
  };

  // Violation impact scores
  private static readonly VIOLATION_IMPACT: Record<string, number> = {
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
  private static readonly RECOVERY_RATES = {
    trusted: 2, // Trusted users recover faster
    verified: 1.5, // Verified users recover moderately
    standard: 1, // Standard users recover normally
    flagged: 0.5, // Flagged users recover slowly
    banned: 0, // Banned users don't recover
  };

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
      // TODO: Implement Firestore reputation fetching
      // For now, return default reputation
      return this.getDefaultReputation(userId);
    } catch (error) {
      console.error("❌ Error fetching user reputation:", error);
      return this.getDefaultReputation(userId);
    }
  }

  /**
   * Apply reputation-based actions to moderation results
   */
  async applyReputationBasedActions(
    moderationResult: any,
    userId: string
  ): Promise<any> {
    try {
      const reputation = await this.getUserReputation(userId);
      const reputationLevel = this.getReputationLevel(reputation.score);

      // Apply reputation-based modifications
      const modifiedResult = {
        ...moderationResult,
        reputationImpact: this.calculateReputationImpact(
          moderationResult,
          reputationLevel
        ),
        appealable: this.isAppealable(moderationResult, reputationLevel),
        appealTimeLimit: this.getAppealTimeLimit(reputationLevel),
        penaltyMultiplier: this.getPenaltyMultiplier(reputationLevel),
        autoAppealThreshold: this.getAutoAppealThreshold(reputationLevel),
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
      const impact = this.calculateViolationImpact(violationType, severity);

      // Update reputation score
      const newScore = Math.max(0, reputation.score - impact);

      // TODO: Save updated reputation to Firestore
      console.log(`📝 Recorded violation for user ${userId}:`, {
        type: violationType,
        severity,
        impact,
        newScore,
        level: this.getReputationLevel(newScore),
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
      const recovery = this.getRecoveryRate(reputation.score);

      // Small positive impact for successful whispers
      const newScore = Math.min(100, reputation.score + recovery);

      // TODO: Save updated reputation to Firestore
      console.log(`✅ Recorded successful whisper for user ${userId}:`, {
        recovery,
        newScore,
        level: this.getReputationLevel(newScore),
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
      const daysSinceLastViolation = this.getDaysSinceLastViolation(reputation);
      const recoveryRate = this.getRecoveryRate(reputation.score);

      // Apply time-based recovery
      const recoveryPoints = daysSinceLastViolation * recoveryRate;
      const newScore = Math.min(100, reputation.score + recoveryPoints);

      if (newScore > reputation.score) {
        // TODO: Save updated reputation to Firestore
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
   * Get reputation level from score
   */
  getReputationLevel(score: number): UserReputation["level"] {
    if (score >= ReputationService.THRESHOLDS.trusted) return "trusted";
    if (score >= ReputationService.THRESHOLDS.verified) return "verified";
    if (score >= ReputationService.THRESHOLDS.standard) return "standard";
    if (score >= ReputationService.THRESHOLDS.flagged) return "flagged";
    return "banned";
  }

  /**
   * Calculate reputation impact for a moderation result
   */
  private calculateReputationImpact(
    moderationResult: any,
    reputationLevel: string
  ): number {
    const baseImpact =
      moderationResult.violations?.reduce((total: number, violation: any) => {
        return (
          total + (ReputationService.VIOLATION_IMPACT[violation.type] || 10)
        );
      }, 0) || 0;

    // Apply reputation-based multiplier
    const multiplier = this.getPenaltyMultiplier(reputationLevel);
    return Math.round(baseImpact * multiplier);
  }

  /**
   * Calculate violation impact
   */
  private calculateViolationImpact(
    violationType: ViolationType,
    severity: string
  ): number {
    const baseImpact = ReputationService.VIOLATION_IMPACT[violationType] || 10;
    const severityMultiplier =
      {
        low: 0.5,
        medium: 1.0,
        high: 1.5,
        critical: 2.0,
      }[severity] || 1.0;

    return Math.round(baseImpact * severityMultiplier);
  }

  /**
   * Check if violation is appealable based on reputation
   */
  private isAppealable(
    moderationResult: any,
    reputationLevel: string
  ): boolean {
    // Banned users cannot appeal
    if (reputationLevel === "banned") return false;

    // Critical violations are rarely appealable
    const hasCriticalViolation = moderationResult.violations?.some(
      (v: any) => v.severity === "critical"
    );

    if (hasCriticalViolation && reputationLevel === "flagged") return false;

    return true;
  }

  /**
   * Get appeal time limit based on reputation level
   */
  private getAppealTimeLimit(reputationLevel: string): number {
    const timeLimits = {
      trusted: 30, // 30 days for trusted users
      verified: 14, // 14 days for verified users
      standard: 7, // 7 days for standard users
      flagged: 3, // 3 days for flagged users
      banned: 0, // No appeals for banned users
    };

    return timeLimits[reputationLevel as keyof typeof timeLimits] ?? 7;
  }

  /**
   * Get penalty multiplier based on reputation level
   */
  private getPenaltyMultiplier(reputationLevel: string): number {
    const multipliers = {
      trusted: 0.5, // Trusted users get reduced penalties
      verified: 0.75, // Verified users get slightly reduced penalties
      standard: 1.0, // Standard users get normal penalties
      flagged: 1.5, // Flagged users get increased penalties
      banned: 2.0, // Banned users get maximum penalties
    };

    return multipliers[reputationLevel as keyof typeof multipliers] || 1.0;
  }

  /**
   * Get auto-appeal threshold based on reputation level
   */
  private getAutoAppealThreshold(reputationLevel: string): number {
    const thresholds = {
      trusted: 0.3, // Trusted users auto-appeal low confidence violations
      verified: 0.5, // Verified users auto-appeal medium confidence violations
      standard: 0.7, // Standard users auto-appeal high confidence violations
      flagged: 0.9, // Flagged users rarely auto-appeal
      banned: 1.0, // Banned users never auto-appeal
    };

    return thresholds[reputationLevel as keyof typeof thresholds] || 0.7;
  }

  /**
   * Get recovery rate based on current score
   */
  private getRecoveryRate(score: number): number {
    const level = this.getReputationLevel(score);
    return ReputationService.RECOVERY_RATES[level] || 0;
  }

  /**
   * Get days since last violation
   */
  private getDaysSinceLastViolation(reputation: UserReputation): number {
    if (!reputation.lastViolation) return 365; // No violations = full recovery

    const now = new Date();
    const lastViolation = new Date(reputation.lastViolation);
    const diffTime = Math.abs(now.getTime() - lastViolation.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Get default reputation for new users
   */
  private getDefaultReputation(userId: string): UserReputation {
    return {
      userId,
      score: 75, // Start with "verified" level
      level: "verified",
      totalWhispers: 0,
      approvedWhispers: 0,
      flaggedWhispers: 0,
      rejectedWhispers: 0,
      violationHistory: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Reset reputation (for testing or admin actions)
   */
  async resetReputation(userId: string): Promise<void> {
    try {
      // TODO: Save default reputation to Firestore
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
    // TODO: Implement Firestore aggregation
    return {
      totalUsers: 0,
      trustedUsers: 0,
      verifiedUsers: 0,
      standardUsers: 0,
      flaggedUsers: 0,
      bannedUsers: 0,
      averageScore: 75,
    };
  }

  // Singleton management
  static resetInstance(): void {
    ReputationService.instance = new ReputationService();
  }

  static destroyInstance(): void {
    ReputationService.instance = null as any;
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
