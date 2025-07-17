/**
 * Appeal Service for Whispr
 * Handles user appeals for moderation actions and violations
 */

import {
  Appeal,
  AppealStatus,
  AppealResolution,
  ViolationRecord,
  UserReputation,
} from "../types";
import { getFirestoreService } from "./firestoreService";
import { getReputationService } from "./reputationService";
import { TIME_CONSTANTS, REPUTATION_CONSTANTS } from "../constants";
import { getErrorMessage } from "../utils/errorHelpers";

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

export class AppealService {
  private static instance: AppealService | null;
  private firestoreService = getFirestoreService();
  private reputationService = getReputationService();

  // Appeal time limits (in days)
  private static readonly APPEAL_TIME_LIMITS = {
    trusted: TIME_CONSTANTS.TRUSTED_APPEAL_TIME_LIMIT / TIME_CONSTANTS.ONE_DAY,
    verified:
      TIME_CONSTANTS.VERIFIED_APPEAL_TIME_LIMIT / TIME_CONSTANTS.ONE_DAY,
    standard:
      TIME_CONSTANTS.STANDARD_APPEAL_TIME_LIMIT / TIME_CONSTANTS.ONE_DAY,
    flagged: TIME_CONSTANTS.FLAGGED_APPEAL_TIME_LIMIT / TIME_CONSTANTS.ONE_DAY,
    banned: 0,
  };

  // Auto-approval thresholds for trusted users
  private static readonly AUTO_APPROVAL_THRESHOLDS = {
    trusted: 0.3, // Trusted users auto-approve low confidence violations
    verified: 0.5, // Verified users auto-approve medium confidence violations
    standard: 0.7, // Standard users auto-approve high confidence violations
    flagged: 0.9, // Flagged users rarely auto-approve
    banned: 1.0, // Banned users never auto-approve
  };

  private constructor() {}

  static getInstance(): AppealService {
    if (!AppealService.instance) {
      AppealService.instance = new AppealService();
    }
    return AppealService.instance;
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

      // Check if user can appeal
      if (reputation.level === "banned") {
        throw new Error("Banned users cannot submit appeals");
      }

      // Check if appeal time limit has passed
      const violation = await this.getViolation();
      if (!violation) {
        throw new Error("Violation not found");
      }

      const timeLimit = this.getAppealTimeLimit(reputation.level);
      const daysSinceViolation = this.getDaysSinceViolation(
        violation.timestamp
      );

      if (daysSinceViolation > timeLimit) {
        throw new Error(
          `Appeal time limit exceeded. You have ${timeLimit} days to appeal.`
        );
      }

      // Create appeal object
      const appeal: Appeal = {
        id: `appeal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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

      // Save to Firestore
      await this.firestoreService.saveAppeal(appeal);

      console.log(`📝 Appeal created: ${appeal.id}`);

      // Check for auto-approval for trusted users
      if (reputation.level === "trusted") {
        const autoApprovalThreshold =
          AppealService.AUTO_APPROVAL_THRESHOLDS.trusted;
        const violation = await this.getViolation();

        if (
          violation &&
          this.shouldAutoApprove(violation, autoApprovalThreshold)
        ) {
          await this.autoApproveAppeal(appeal.id, reputation);
        }
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

      if (appeal.status !== AppealStatus.PENDING) {
        throw new Error("Appeal has already been reviewed");
      }

      // Create resolution
      const resolution: AppealResolution = {
        action: data.action,
        reason: data.reason,
        moderatorId: data.moderatorId,
        reputationAdjustment: data.reputationAdjustment || 0,
      };

      // Update appeal status
      const updates: Partial<Appeal> = {
        status:
          data.action === "approve"
            ? AppealStatus.APPROVED
            : AppealStatus.REJECTED,
        resolution,
        reviewedAt: new Date(),
        reviewedBy: data.moderatorId,
        updatedAt: new Date(),
      };

      await this.firestoreService.updateAppeal(data.appealId, updates);

      // Apply reputation adjustment
      if (data.reputationAdjustment) {
        await this.firestoreService.adjustUserReputationScore(
          appeal.userId,
          data.reputationAdjustment || 0,
          `Appeal ${data.action}: ${data.reason}`
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
      const resolution: AppealResolution = {
        action: "approve",
        reason: "Auto-approved for trusted user",
        moderatorId: "system",
        reputationAdjustment: REPUTATION_CONSTANTS.APPEAL_APPROVED_BONUS, // Small reputation boost for successful appeal
      };

      const updates: Partial<Appeal> = {
        status: AppealStatus.APPROVED,
        resolution,
        reviewedAt: new Date(),
        reviewedBy: "system",
        updatedAt: new Date(),
      };

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
   * Check if violation should be auto-approved
   */
  private shouldAutoApprove(
    violation: ViolationRecord,
    threshold: number
  ): boolean {
    // This would need to be implemented based on violation confidence
    // For now, we'll use a simple heuristic
    return violation.severity === "low" && Math.random() < threshold;
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
    try {
      // This would need to be implemented in FirestoreService
      console.log(`📝 Updated violation ${violationId} resolution: ${action}`);
    } catch (error) {
      console.error("❌ Error updating violation resolution:", error);
    }
  }

  /**
   * Get appeal time limit based on reputation level
   */
  private getAppealTimeLimit(reputationLevel: string): number {
    return (
      AppealService.APPEAL_TIME_LIMITS[
        reputationLevel as keyof typeof AppealService.APPEAL_TIME_LIMITS
      ] || 7
    );
  }

  /**
   * Calculate days since violation
   */
  private getDaysSinceViolation(violationDate: Date): number {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - violationDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Check if appeal is expired
   */
  async checkAppealExpiration(): Promise<void> {
    try {
      const pendingAppeals = await this.getPendingAppeals();

      for (const appeal of pendingAppeals) {
        const reputation = await this.reputationService.getUserReputation(
          appeal.userId
        );
        const timeLimit = this.getAppealTimeLimit(reputation.level);
        const daysSinceSubmission = this.getDaysSinceViolation(
          appeal.submittedAt
        );

        if (daysSinceSubmission > timeLimit) {
          // Expire the appeal
          const updates: Partial<Appeal> = {
            status: AppealStatus.EXPIRED,
            updatedAt: new Date(),
          };

          await this.firestoreService.updateAppeal(appeal.id, updates);
          console.log(`⏰ Appeal ${appeal.id} expired`);
        }
      }
    } catch (error) {
      console.error("❌ Error checking appeal expiration:", error);
    }
  }

  /**
   * Get appeal statistics
   */
  async getAppealStats(): Promise<{
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    expired: number;
    approvalRate: number;
  }> {
    try {
      const appeals = await this.firestoreService.getAllAppeals();

      const stats = {
        total: appeals.length,
        pending: appeals.filter((a) => a.status === AppealStatus.PENDING)
          .length,
        approved: appeals.filter((a) => a.status === AppealStatus.APPROVED)
          .length,
        rejected: appeals.filter((a) => a.status === AppealStatus.REJECTED)
          .length,
        expired: appeals.filter((a) => a.status === AppealStatus.EXPIRED)
          .length,
        approvalRate: 0,
      };

      const resolved = stats.approved + stats.rejected;
      stats.approvalRate = resolved > 0 ? (stats.approved / resolved) * 100 : 0;

      return stats;
    } catch (error) {
      console.error("❌ Error getting appeal stats:", error);
      return {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        expired: 0,
        approvalRate: 0,
      };
    }
  }
}

export const getAppealService = () => AppealService.getInstance();
