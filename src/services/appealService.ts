/**
 * Appeal Service for Whispr
 * Handles user appeals for moderation actions and violations
 */

import { Appeal, ViolationRecord, UserReputation } from "../types";
import { getFirestoreService } from "./firestoreService";
import { getReputationService } from "./reputationService";
import { REPUTATION_CONSTANTS } from "../constants";
import { getErrorMessage } from "../utils/errorHelpers";
import {
  CreateAppealData,
  AppealReviewData,
  AppealStats,
  validateAppealData,
  generateAppealId,
  createAppealObject,
  getAppealTimeLimit,
  shouldAutoApproveForUser,
  isAppealExpired,
  createExpirationUpdates,
  processReviewAction,
  createAutoApprovalUpdates,
  calculateAppealStats,
  getDefaultAppealStats,
  canReviewAppeal,
  getReputationAdjustment,
  formatReputationReason,
} from "../utils/appealUtils";

export class AppealService {
  private static instance: AppealService | null;
  private firestoreService = getFirestoreService();
  private reputationService = getReputationService();

  private constructor() {}

  static getInstance(): AppealService {
    if (!AppealService.instance) {
      AppealService.instance = new AppealService();
    }
    return AppealService.instance;
  }

  /**
   * Get all appeals (extracted from FirestoreService)
   */
  async getAllAppeals(): Promise<Appeal[]> {
    try {
      return await this.firestoreService.getAllAppeals();
    } catch (error) {
      console.error("Error getting all appeals:", error);
      throw new Error("Failed to get all appeals");
    }
  }

  /**
   * Create a new appeal
   */
  async createAppeal(data: CreateAppealData): Promise<Appeal> {
    try {
      // Get user reputation to check if they can appeal
      const reputation = await this.reputationService.getUserReputation(
        data.userId
      );

      // Get violation to validate appeal
      const violation = await this.getViolation();

      // Validate appeal data
      validateAppealData(data, reputation, violation);

      // Create appeal object
      const appealData = createAppealObject(data);
      const appeal: Appeal = {
        id: generateAppealId(),
        ...appealData,
      };

      // Save to Firestore
      await this.firestoreService.saveAppeal(appeal);

      console.log(`📝 Appeal created: ${appeal.id}`);

      // Check for auto-approval for trusted users
      if (violation && shouldAutoApproveForUser(reputation, violation)) {
        await this.autoApproveAppeal(appeal.id, reputation);
      }

      return appeal;
    } catch (error) {
      console.error("❌ Error creating appeal:", error);
      throw new Error(getErrorMessage(error));
    }
  }

  /**
   * Get appeal by ID
   */
  async getAppeal(appealId: string): Promise<Appeal | null> {
    try {
      return await this.firestoreService.getAppeal(appealId);
    } catch (error) {
      console.error("❌ Error getting appeal:", error);
      return null;
    }
  }

  /**
   * Get appeals by user ID
   */
  async getUserAppeals(userId: string): Promise<Appeal[]> {
    try {
      return await this.firestoreService.getUserAppeals(userId);
    } catch (error) {
      console.error("❌ Error getting user appeals:", error);
      return [];
    }
  }

  /**
   * Get pending appeals for moderation
   */
  async getPendingAppeals(): Promise<Appeal[]> {
    try {
      return await this.firestoreService.getPendingAppeals();
    } catch (error) {
      console.error("❌ Error getting pending appeals:", error);
      return [];
    }
  }

  /**
   * Review and resolve an appeal
   */
  async reviewAppeal(data: AppealReviewData): Promise<void> {
    try {
      const appeal = await this.getAppeal(data.appealId);
      if (!appeal) {
        throw new Error("Appeal not found");
      }

      if (!canReviewAppeal(appeal)) {
        throw new Error("Appeal has already been reviewed");
      }

      // Process review action
      const updates = processReviewAction(data);

      await this.firestoreService.updateAppeal(data.appealId, updates);

      // Apply reputation adjustment
      const reputationAdjustment = getReputationAdjustment(
        data.action,
        data.reputationAdjustment
      );

      if (reputationAdjustment !== 0) {
        await this.firestoreService.adjustUserReputationScore(
          appeal.userId,
          reputationAdjustment,
          formatReputationReason(data.action, data.reason)
        );
      }

      // Update violation record
      await this.updateViolationResolution(appeal.violationId, data.action);

      console.log(`✅ Appeal ${data.appealId} reviewed: ${data.action}`);
    } catch (error) {
      console.error("❌ Error reviewing appeal:", error);
      throw new Error(getErrorMessage(error));
    }
  }

  /**
   * Auto-approve appeal for trusted users
   */
  private async autoApproveAppeal(
    appealId: string,
    reputation: UserReputation
  ): Promise<void> {
    try {
      const updates = createAutoApprovalUpdates();

      await this.firestoreService.updateAppeal(appealId, updates);

      // Apply reputation adjustment
      await this.firestoreService.adjustUserReputationScore(
        reputation.userId,
        REPUTATION_CONSTANTS.APPEAL_APPROVED_BONUS,
        "Appeal auto-approved"
      );

      console.log(`✅ Appeal ${appealId} auto-approved for trusted user`);
    } catch (error) {
      console.error("❌ Error auto-approving appeal:", error);
    }
  }

  /**
   * Get violation by ID
   */
  private async getViolation(): Promise<ViolationRecord | null> {
    // This would need to be implemented in FirestoreService
    return null;
  }

  /**
   * Update violation resolution
   */
  private async updateViolationResolution(
    violationId: string,
    action: string
  ): Promise<void> {
    // This would need to be implemented in FirestoreService
    console.log(`Updating violation ${violationId} with action: ${action}`);
  }

  /**
   * Check for expired appeals and mark them as expired
   */
  async checkAppealExpiration(): Promise<void> {
    try {
      const pendingAppeals = await this.getPendingAppeals();

      for (const appeal of pendingAppeals) {
        const reputation = await this.reputationService.getUserReputation(
          appeal.userId
        );
        const timeLimit = getAppealTimeLimit(reputation.level);

        if (isAppealExpired(appeal, timeLimit)) {
          const updates = createExpirationUpdates();
          await this.firestoreService.updateAppeal(appeal.id, updates);
          console.log(`⏰ Appeal ${appeal.id} marked as expired`);
        }
      }
    } catch (error) {
      console.error("❌ Error checking appeal expiration:", error);
    }
  }

  /**
   * Get appeal statistics
   */
  async getAppealStats(): Promise<AppealStats> {
    try {
      const allAppeals = await this.getAllAppeals();
      return calculateAppealStats(allAppeals);
    } catch (error) {
      console.error("❌ Error getting appeal stats:", error);
      return getDefaultAppealStats();
    }
  }

  // ===== STATIC METHODS FOR RESET/DESTROY =====

  static resetInstance(): void {
    AppealService.instance = null;
  }

  static destroyInstance(): void {
    AppealService.instance = null;
  }
}

/**
 * Factory function to get AppealService instance
 */
export const getAppealService = (): AppealService => {
  return AppealService.getInstance();
};

/**
 * Reset the AppealService singleton instance
 */
export const resetAppealService = (): void => {
  AppealService.resetInstance();
};

/**
 * Destroy the AppealService singleton instance
 */
export const destroyAppealService = (): void => {
  AppealService.destroyInstance();
};
