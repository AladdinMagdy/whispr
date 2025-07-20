/**
 * Report Priority Service
 * Handles report priority calculation and escalation logic
 */

import { UserReputation, ReportCategory, ReportPriority } from "../types";
import { REPORTING_CONSTANTS } from "../constants";

export interface PriorityThresholds {
  CRITICAL: number;
  HIGH: number;
  MEDIUM: number;
  LOW: number;
}

export interface ReputationWeights {
  trusted: number;
  verified: number;
  standard: number;
  flagged: number;
  banned: number;
}

export interface CategoryPriorityMultipliers {
  harassment: number;
  hate_speech: number;
  violence: number;
  sexual_content: number;
  spam: number;
  scam: number;
  copyright: number;
  personal_info: number;
  minor_safety: number;
  other: number;
}

export class ReportPriorityService {
  private static instance: ReportPriorityService | null;

  // Priority thresholds based on reporter reputation
  private static readonly PRIORITY_THRESHOLDS: PriorityThresholds =
    REPORTING_CONSTANTS.PRIORITY_THRESHOLDS;

  // Reputation weight multipliers
  private static readonly REPUTATION_WEIGHTS: ReputationWeights =
    REPORTING_CONSTANTS.REPUTATION_WEIGHTS;

  // Category priority multipliers
  private static readonly CATEGORY_MULTIPLIERS: CategoryPriorityMultipliers = {
    harassment: 1.5,
    hate_speech: 1.8,
    violence: 2.0,
    sexual_content: 1.7,
    spam: 1.2,
    scam: 1.4,
    copyright: 1.1,
    personal_info: 1.3,
    minor_safety: 2.0,
    other: 1.0,
  };

  private constructor() {}

  static getInstance(): ReportPriorityService {
    if (!ReportPriorityService.instance) {
      ReportPriorityService.instance = new ReportPriorityService();
    }
    return ReportPriorityService.instance;
  }

  /**
   * Calculate report priority based on reporter reputation and category
   */
  calculatePriority(
    reporterReputation: UserReputation,
    category: ReportCategory
  ): ReportPriority {
    try {
      // Base priority from reputation level
      const basePriority =
        this.getBasePriorityFromReputation(reporterReputation);

      // Apply category multiplier
      const categoryMultiplier =
        ReportPriorityService.CATEGORY_MULTIPLIERS[category];
      const adjustedPriority = this.applyCategoryMultiplier(
        basePriority,
        categoryMultiplier
      );

      // Apply reputation score adjustment
      const finalPriority = this.applyReputationScoreAdjustment(
        adjustedPriority,
        reporterReputation.score
      );

      return finalPriority;
    } catch (error) {
      console.error("❌ Error calculating priority:", error);
      return ReportPriority.MEDIUM; // Default fallback
    }
  }

  /**
   * Calculate reputation weight multiplier
   */
  calculateReputationWeight(reporterReputation: UserReputation): number {
    try {
      const weight =
        ReportPriorityService.REPUTATION_WEIGHTS[reporterReputation.level];
      if (weight === undefined) {
        console.warn(`Unknown reputation level: ${reporterReputation.level}`);
        return ReportPriorityService.REPUTATION_WEIGHTS.standard;
      }
      return weight;
    } catch (error) {
      console.error("❌ Error calculating reputation weight:", error);
      return 1.0; // Default fallback
    }
  }

  /**
   * Escalate priority level
   */
  escalatePriority(currentPriority: ReportPriority): ReportPriority {
    switch (currentPriority) {
      case ReportPriority.LOW:
        return ReportPriority.MEDIUM;
      case ReportPriority.MEDIUM:
        return ReportPriority.HIGH;
      case ReportPriority.HIGH:
        return ReportPriority.CRITICAL;
      case ReportPriority.CRITICAL:
        return ReportPriority.CRITICAL; // Already at max
      default:
        return ReportPriority.MEDIUM;
    }
  }

  /**
   * Get priority thresholds
   */
  getPriorityThresholds(): PriorityThresholds {
    return { ...ReportPriorityService.PRIORITY_THRESHOLDS };
  }

  /**
   * Get reputation weights
   */
  getReputationWeights(): ReputationWeights {
    return { ...ReportPriorityService.REPUTATION_WEIGHTS };
  }

  /**
   * Get category multipliers
   */
  getCategoryMultipliers(): CategoryPriorityMultipliers {
    return { ...ReportPriorityService.CATEGORY_MULTIPLIERS };
  }

  /**
   * Check if content should be escalated based on priority and report count
   */
  shouldEscalate(priority: ReportPriority, reportCount: number): boolean {
    // Critical priority always escalates
    if (priority === ReportPriority.CRITICAL) {
      return true;
    }

    // High priority with multiple reports
    if (priority === ReportPriority.HIGH && reportCount >= 3) {
      return true;
    }

    // Medium priority with many reports
    if (priority === ReportPriority.MEDIUM && reportCount >= 5) {
      return true;
    }

    // Low priority with very many reports
    if (priority === ReportPriority.LOW && reportCount >= 10) {
      return true;
    }

    return false;
  }

  /**
   * Get priority description
   */
  getPriorityDescription(priority: ReportPriority): string {
    switch (priority) {
      case ReportPriority.CRITICAL:
        return "Critical - Requires immediate attention";
      case ReportPriority.HIGH:
        return "High - Requires prompt review";
      case ReportPriority.MEDIUM:
        return "Medium - Standard review timeline";
      case ReportPriority.LOW:
        return "Low - Low priority review";
      default:
        return "Unknown priority level";
    }
  }

  /**
   * Get base priority from reputation level
   */
  private getBasePriorityFromReputation(
    reputation: UserReputation
  ): ReportPriority {
    switch (reputation.level) {
      case "trusted":
        return ReportPriority.HIGH;
      case "verified":
        return ReportPriority.MEDIUM;
      case "standard":
        return ReportPriority.MEDIUM;
      case "flagged":
        return ReportPriority.LOW;
      case "banned":
        return ReportPriority.LOW; // Banned users can still report but with low priority
      default:
        return ReportPriority.MEDIUM;
    }
  }

  /**
   * Apply category multiplier to priority
   */
  private applyCategoryMultiplier(
    basePriority: ReportPriority,
    multiplier: number
  ): ReportPriority {
    // Convert priority to numeric value for calculation
    const priorityValues = {
      [ReportPriority.LOW]: 1,
      [ReportPriority.MEDIUM]: 2,
      [ReportPriority.HIGH]: 3,
      [ReportPriority.CRITICAL]: 4,
    };

    const baseValue = priorityValues[basePriority] || 2;
    const adjustedValue = Math.round(baseValue * multiplier);

    // Convert back to priority level
    if (adjustedValue >= 4) return ReportPriority.CRITICAL;
    if (adjustedValue >= 3) return ReportPriority.HIGH;
    if (adjustedValue >= 2) return ReportPriority.MEDIUM;
    return ReportPriority.LOW;
  }

  /**
   * Apply reputation score adjustment
   */
  private applyReputationScoreAdjustment(
    priority: ReportPriority,
    reputationScore: number
  ): ReportPriority {
    // High reputation scores can boost priority slightly
    if (reputationScore >= 90) {
      return this.escalatePriority(priority);
    }

    // Very low reputation scores can reduce priority
    if (reputationScore <= 20) {
      return this.deescalatePriority(priority);
    }

    return priority;
  }

  /**
   * Deescalate priority level
   */
  private deescalatePriority(currentPriority: ReportPriority): ReportPriority {
    switch (currentPriority) {
      case ReportPriority.CRITICAL:
        return ReportPriority.HIGH;
      case ReportPriority.HIGH:
        return ReportPriority.MEDIUM;
      case ReportPriority.MEDIUM:
        return ReportPriority.LOW;
      case ReportPriority.LOW:
        return ReportPriority.LOW; // Already at min
      default:
        return ReportPriority.MEDIUM;
    }
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    ReportPriorityService.instance = null;
  }

  /**
   * Destroy singleton instance
   */
  static destroyInstance(): void {
    ReportPriorityService.instance = null;
  }
}

/**
 * Factory function to get ReportPriorityService instance
 */
export const getReportPriorityService = (): ReportPriorityService =>
  ReportPriorityService.getInstance();

/**
 * Factory function to reset ReportPriorityService instance
 */
export const resetReportPriorityService = (): void =>
  ReportPriorityService.resetInstance();

/**
 * Factory function to destroy ReportPriorityService instance
 */
export const destroyReportPriorityService = (): void =>
  ReportPriorityService.destroyInstance();
