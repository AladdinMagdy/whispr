/**
 * Suspension Service for Whispr
 * Handles user suspensions, temporary bans, and warning systems
 */

import { Suspension, SuspensionType } from "../types";
import { SuspensionRepository } from "../repositories/SuspensionRepository";
import { FirebaseSuspensionRepository } from "../repositories/FirebaseSuspensionRepository";
import { getReputationService } from "./reputationService";
import {
  CreateSuspensionData,
  SuspensionReviewData,
  SuspensionStats,
  UserSuspensionStatus,
  validateSuspensionData,
  generateSuspensionId,
  createSuspensionObject,
  determineAutomaticSuspension,
  isSuspensionExpired,
  determineUserSuspensionStatus,
  processReviewAction,
  calculateSuspensionStats,
  formatAutomaticSuspensionReason,
  shouldAffectReputation,
  getReputationPenalty,
  getReputationRestorationBonus,
  createDeactivationUpdates,
  shouldRestoreReputationOnExpiry,
} from "../utils/suspensionUtils";

export class SuspensionService {
  private static instance: SuspensionService | null;
  private repository: SuspensionRepository;
  private reputationService = getReputationService();

  constructor(repository?: SuspensionRepository) {
    this.repository = repository || new FirebaseSuspensionRepository();
  }

  static getInstance(): SuspensionService {
    if (!SuspensionService.instance) {
      SuspensionService.instance = new SuspensionService();
    }
    return SuspensionService.instance;
  }

  /**
   * Get all suspensions
   */
  async getAllSuspensions(): Promise<Suspension[]> {
    try {
      return await this.repository.getAll();
    } catch (error) {
      console.error("Error getting all suspensions:", error);
      throw new Error("Failed to get all suspensions");
    }
  }

  /**
   * Get active suspensions
   */
  async getActiveSuspensions(): Promise<Suspension[]> {
    try {
      return await this.repository.getActive();
    } catch (error) {
      console.error("Error getting active suspensions:", error);
      throw new Error("Failed to get active suspensions");
    }
  }

  /**
   * Get user suspensions
   */
  async getUserSuspensions(userId: string): Promise<Suspension[]> {
    try {
      return await this.repository.getByUser(userId);
    } catch (error) {
      console.error("Error getting user suspensions:", error);
      throw new Error("Failed to get user suspensions");
    }
  }

  /**
   * Create a new suspension
   */
  async createSuspension(data: CreateSuspensionData): Promise<Suspension> {
    try {
      // Validate suspension data
      validateSuspensionData(data);

      // Create suspension object
      const suspensionData = createSuspensionObject(data);
      const suspension: Suspension = {
        id: generateSuspensionId(),
        ...suspensionData,
      };

      // Save to repository
      await this.repository.save(suspension);

      // Update user reputation if this is a suspension (not just a warning)
      if (shouldAffectReputation(data.type)) {
        await this.updateUserReputationForSuspension(data.userId, data.type);
      }

      console.log(`🚫 Suspension created: ${suspension.id} (${data.type})`);

      return suspension;
    } catch (error) {
      console.error("❌ Error creating suspension:", error);
      throw new Error(
        `Failed to create suspension: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get suspension by ID
   */
  async getSuspension(suspensionId: string): Promise<Suspension | null> {
    try {
      return await this.repository.getById(suspensionId);
    } catch (error) {
      console.error("❌ Error getting suspension:", error);
      return null;
    }
  }

  /**
   * Get active suspensions for a user
   */
  async getUserActiveSuspensions(userId: string): Promise<Suspension[]> {
    try {
      const suspensions = await this.getUserSuspensions(userId);
      return suspensions.filter(
        (s) => s.isActive && s.endDate && s.endDate > new Date()
      );
    } catch (error) {
      console.error("❌ Error getting user suspensions:", error);
      return [];
    }
  }

  /**
   * Check if user is currently suspended
   */
  async isUserSuspended(userId: string): Promise<UserSuspensionStatus> {
    try {
      const suspensions = await this.getUserSuspensions(userId);
      return determineUserSuspensionStatus(suspensions);
    } catch (error) {
      console.error("❌ Error checking user suspension status:", error);
      return {
        suspended: false,
        suspensions: [],
        canAppeal: false,
      };
    }
  }

  /**
   * Review and modify a suspension
   */
  async reviewSuspension(data: SuspensionReviewData): Promise<void> {
    try {
      const suspension = await this.getSuspension(data.suspensionId);
      if (!suspension) {
        throw new Error("Suspension not found");
      }

      if (!suspension.isActive) {
        throw new Error("Cannot modify inactive suspension");
      }

      const updates = processReviewAction(
        suspension,
        data.action,
        data.newDuration
      );

      await this.repository.update(data.suspensionId, updates);

      console.log(
        `✅ Suspension ${data.suspensionId} reviewed: ${data.action}`
      );
    } catch (error) {
      console.error("❌ Error reviewing suspension:", error);
      throw new Error(
        `Failed to review suspension: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Automatically create suspension based on violation count
   */
  async createAutomaticSuspension(
    userId: string,
    violationCount: number,
    reason: string
  ): Promise<Suspension | null> {
    try {
      const { type, duration } = determineAutomaticSuspension(violationCount);

      // Don't create warnings (they're just recorded)
      if (type === SuspensionType.WARNING) {
        console.log(`⚠️ Warning recorded for user ${userId}: ${reason}`);
        return null;
      }

      return await this.createSuspension({
        userId,
        reason: formatAutomaticSuspensionReason(reason, violationCount),
        type,
        duration,
        moderatorId: "system",
      });
    } catch (error) {
      console.error("❌ Error creating automatic suspension:", error);
      return null;
    }
  }

  /**
   * Check for expired suspensions and deactivate them
   */
  async checkSuspensionExpiration(): Promise<void> {
    try {
      const activeSuspensions = await this.getActiveSuspensions();

      for (const suspension of activeSuspensions) {
        if (isSuspensionExpired(suspension)) {
          const updates = createDeactivationUpdates();

          await this.repository.update(suspension.id, updates);

          // Restore reputation if needed
          if (shouldRestoreReputationOnExpiry(suspension.type)) {
            await this.restoreUserReputationAfterSuspension(suspension.userId);
          }

          console.log(`⏰ Suspension ${suspension.id} expired and deactivated`);
        }
      }
    } catch (error) {
      console.error("❌ Error checking suspension expiration:", error);
    }
  }

  /**
   * Update user reputation for suspension
   */
  private async updateUserReputationForSuspension(
    userId: string,
    suspensionType: SuspensionType
  ): Promise<void> {
    try {
      const penalty = getReputationPenalty(suspensionType);
      const reputation = await this.reputationService.getUserReputation(userId);

      const newScore = Math.max(0, reputation.score + penalty);

      await this.reputationService.updateUserReputation(userId, {
        score: newScore,
        updatedAt: new Date(),
      });

      console.log(
        `📉 Reputation penalty applied for ${suspensionType}: -${penalty} points`
      );
    } catch (error) {
      console.error("❌ Error updating reputation for suspension:", error);
    }
  }

  /**
   * Restore user reputation after suspension expires
   */
  private async restoreUserReputationAfterSuspension(
    userId: string
  ): Promise<void> {
    try {
      const bonus = getReputationRestorationBonus();
      const reputation = await this.reputationService.getUserReputation(userId);

      const newScore = Math.min(100, reputation.score + bonus);

      await this.reputationService.updateUserReputation(userId, {
        score: newScore,
        updatedAt: new Date(),
      });

      console.log(`📈 Reputation restored after suspension: +${bonus} points`);
    } catch (error) {
      console.error("❌ Error restoring reputation after suspension:", error);
    }
  }

  /**
   * Get suspension statistics
   */
  async getSuspensionStats(): Promise<SuspensionStats> {
    try {
      const allSuspensions = await this.getAllSuspensions();
      return calculateSuspensionStats(allSuspensions);
    } catch (error) {
      console.error("❌ Error getting suspension stats:", error);
      return {
        total: 0,
        active: 0,
        warnings: 0,
        temporary: 0,
        permanent: 0,
        expired: 0,
      };
    }
  }

  static resetInstance(): void {
    SuspensionService.instance = null;
  }

  static destroyInstance(): void {
    SuspensionService.instance = null;
  }
}

export const getSuspensionService = (): SuspensionService => {
  return SuspensionService.getInstance();
};

export const resetSuspensionService = (): void => {
  SuspensionService.resetInstance();
};

export const destroySuspensionService = (): void => {
  SuspensionService.destroyInstance();
};
