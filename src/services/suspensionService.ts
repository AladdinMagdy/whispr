/**
 * Suspension Service for Whispr
 * Handles user suspensions, temporary bans, and warning systems
 */

import { Suspension, SuspensionType } from "../types";
import { getFirestoreService } from "./firestoreService";
import { getReputationService } from "./reputationService";
import { TIME_CONSTANTS, REPUTATION_CONSTANTS } from "../constants";

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

export class SuspensionService {
  private static instance: SuspensionService | null;
  private firestoreService = getFirestoreService();
  private reputationService = getReputationService();

  // Default suspension durations (in milliseconds)
  private static readonly DEFAULT_DURATIONS = {
    [SuspensionType.WARNING]: TIME_CONSTANTS.WARNING_DURATION,
    [SuspensionType.TEMPORARY]: TIME_CONSTANTS.TEMPORARY_SUSPENSION_DURATION,
    [SuspensionType.PERMANENT]: 0, // No duration for permanent
  };

  // Suspension thresholds based on violation count
  private static readonly SUSPENSION_THRESHOLDS = {
    FIRST_VIOLATION: SuspensionType.WARNING,
    SECOND_VIOLATION: SuspensionType.TEMPORARY,
    THIRD_VIOLATION: SuspensionType.TEMPORARY,
    FOURTH_VIOLATION: SuspensionType.PERMANENT,
  };

  private constructor() {}

  static getInstance(): SuspensionService {
    if (!SuspensionService.instance) {
      SuspensionService.instance = new SuspensionService();
    }
    return SuspensionService.instance;
  }

  /**
   * Create a new suspension
   */
  async createSuspension(data: CreateSuspensionData): Promise<Suspension> {
    try {
      // Validate suspension data
      if (data.type === SuspensionType.TEMPORARY && !data.duration) {
        throw new Error("Temporary suspensions require a duration");
      }

      if (data.type === SuspensionType.PERMANENT && data.duration) {
        throw new Error("Permanent suspensions cannot have a duration");
      }

      // Calculate end date
      const startDate = new Date();
      const endDate =
        data.type === SuspensionType.PERMANENT
          ? new Date(Date.now() + TIME_CONSTANTS.PERMANENT_SUSPENSION_DURATION) // 100 years for "permanent"
          : new Date(
              startDate.getTime() +
                (data.duration ||
                  SuspensionService.DEFAULT_DURATIONS[data.type])
            );

      // Create suspension object
      const suspension: Suspension = {
        id: `suspension-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`,
        userId: data.userId,
        reason: data.reason,
        type: data.type,
        duration:
          data.duration || SuspensionService.DEFAULT_DURATIONS[data.type],
        startDate,
        endDate,
        isActive: true,
        moderatorId: data.moderatorId,
        appealable: data.appealable ?? data.type !== SuspensionType.PERMANENT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Save to Firestore
      await this.firestoreService.saveSuspension(suspension);

      // Update user reputation if this is a suspension (not just a warning)
      if (data.type !== SuspensionType.WARNING) {
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
      return await this.firestoreService.getSuspension(suspensionId);
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
      const suspensions = await this.firestoreService.getUserSuspensions(
        userId
      );
      return suspensions.filter((s) => s.isActive && s.endDate > new Date());
    } catch (error) {
      console.error("❌ Error getting user suspensions:", error);
      return [];
    }
  }

  /**
   * Check if user is currently suspended
   */
  async isUserSuspended(userId: string): Promise<{
    suspended: boolean;
    suspensions: Suspension[];
    canAppeal: boolean;
  }> {
    try {
      const activeSuspensions = await this.getUserActiveSuspensions(userId);
      const suspended = activeSuspensions.length > 0;
      const canAppeal = activeSuspensions.some((s) => s.appealable);

      return {
        suspended,
        suspensions: activeSuspensions,
        canAppeal,
      };
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

      let updates: Partial<Suspension> = {
        updatedAt: new Date(),
      };

      switch (data.action) {
        case "extend":
          if (suspension.type === SuspensionType.PERMANENT) {
            throw new Error("Cannot extend permanent suspension");
          }
          updates.endDate = new Date(
            suspension.endDate.getTime() + (data.newDuration || 0)
          );
          break;

        case "reduce":
          if (suspension.type === SuspensionType.PERMANENT) {
            throw new Error("Cannot reduce permanent suspension");
          }
          updates.endDate = new Date(
            suspension.endDate.getTime() - (data.newDuration || 0)
          );
          break;

        case "remove":
          updates.isActive = false;
          updates.endDate = new Date();
          break;

        case "make_permanent":
          updates.type = SuspensionType.PERMANENT;
          updates.duration = 0;
          updates.endDate = new Date(
            Date.now() + TIME_CONSTANTS.PERMANENT_SUSPENSION_DURATION
          );
          updates.appealable = false;
          break;
      }

      await this.firestoreService.updateSuspension(data.suspensionId, updates);

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
      let suspensionType: SuspensionType;
      let duration: number | undefined;

      if (violationCount === 1) {
        suspensionType =
          SuspensionService.SUSPENSION_THRESHOLDS.FIRST_VIOLATION;
      } else if (violationCount === 2) {
        suspensionType =
          SuspensionService.SUSPENSION_THRESHOLDS.SECOND_VIOLATION;
        duration = TIME_CONSTANTS.TEMPORARY_SUSPENSION_DURATION; // 24 hours
      } else if (violationCount === 3) {
        suspensionType =
          SuspensionService.SUSPENSION_THRESHOLDS.THIRD_VIOLATION;
        duration = TIME_CONSTANTS.EXTENDED_SUSPENSION_DURATION; // 7 days
      } else {
        suspensionType =
          SuspensionService.SUSPENSION_THRESHOLDS.FOURTH_VIOLATION;
      }

      // Don't create warnings (they're just recorded)
      if (suspensionType === SuspensionType.WARNING) {
        console.log(`⚠️ Warning recorded for user ${userId}: ${reason}`);
        return null;
      }

      return await this.createSuspension({
        userId,
        reason: `Automatic suspension: ${reason} (violation #${violationCount})`,
        type: suspensionType,
        duration,
        moderatorId: "system",
        appealable: suspensionType !== SuspensionType.PERMANENT,
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
      const activeSuspensions =
        await this.firestoreService.getActiveSuspensions();
      const now = new Date();

      for (const suspension of activeSuspensions) {
        if (suspension.endDate <= now && suspension.isActive) {
          // Deactivate expired suspension
          const updates: Partial<Suspension> = {
            isActive: false,
            updatedAt: new Date(),
          };

          await this.firestoreService.updateSuspension(suspension.id, updates);

          // Restore user reputation if it was a temporary suspension
          if (suspension.type === SuspensionType.TEMPORARY) {
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
      await this.firestoreService.adjustUserReputationScore(
        userId,
        REPUTATION_CONSTANTS.SUSPENSION_PENALTY,
        `Suspension: ${suspensionType}`
      );
    } catch (error) {
      console.error("❌ Error updating reputation for suspension:", error);
    }
  }

  /**
   * Restore user reputation after temporary suspension expires
   */
  private async restoreUserReputationAfterSuspension(
    userId: string
  ): Promise<void> {
    try {
      // Give a small reputation boost when suspension expires
      await this.firestoreService.adjustUserReputationScore(
        userId,
        REPUTATION_CONSTANTS.SUSPENSION_RESTORATION_BONUS,
        "Suspension expired - reputation restored"
      );
    } catch (error) {
      console.error("❌ Error restoring reputation after suspension:", error);
    }
  }

  /**
   * Get suspension statistics
   */
  async getSuspensionStats(): Promise<{
    total: number;
    active: number;
    warnings: number;
    temporary: number;
    permanent: number;
    expired: number;
  }> {
    try {
      const suspensions = await this.firestoreService.getAllSuspensions();

      return {
        total: suspensions.length,
        active: suspensions.filter((s) => s.isActive).length,
        warnings: suspensions.filter((s) => s.type === SuspensionType.WARNING)
          .length,
        temporary: suspensions.filter(
          (s) => s.type === SuspensionType.TEMPORARY
        ).length,
        permanent: suspensions.filter(
          (s) => s.type === SuspensionType.PERMANENT
        ).length,
        expired: suspensions.filter((s) => !s.isActive).length,
      };
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
}

export const getSuspensionService = () => SuspensionService.getInstance();
