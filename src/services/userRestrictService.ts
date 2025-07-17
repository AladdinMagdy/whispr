import { getFirestoreService } from "./firestoreService";
import { UserRestriction } from "../types";

export interface CreateRestrictionData {
  userId: string;
  restrictedUserId: string;
  restrictedUserDisplayName: string;
  type: "interaction" | "visibility" | "full";
}

export class UserRestrictService {
  private static instance: UserRestrictService;
  private firestoreService = getFirestoreService();

  private constructor() {}

  static getInstance(): UserRestrictService {
    if (!UserRestrictService.instance) {
      UserRestrictService.instance = new UserRestrictService();
    }
    return UserRestrictService.instance;
  }

  /**
   * Restrict a user
   */
  async restrictUser(data: CreateRestrictionData): Promise<UserRestriction> {
    try {
      // Check if already restricted
      const existingRestriction = await this.getRestriction(
        data.userId,
        data.restrictedUserId
      );
      if (existingRestriction) {
        throw new Error("User is already restricted");
      }

      const restriction: UserRestriction = {
        id: `restrict-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        userId: data.userId,
        restrictedUserId: data.restrictedUserId,
        restrictedUserDisplayName: data.restrictedUserDisplayName,
        type: data.type,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.firestoreService.saveUserRestriction(restriction);
      console.log(
        `🚫 User ${data.restrictedUserId} restricted by ${data.userId}`
      );

      return restriction;
    } catch (error) {
      console.error("❌ Error restricting user:", error);
      throw new Error(
        `Failed to restrict user: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Remove restriction from a user
   */
  async unrestrictUser(
    userId: string,
    restrictedUserId: string
  ): Promise<void> {
    try {
      const restriction = await this.getRestriction(userId, restrictedUserId);
      if (!restriction) {
        throw new Error("User is not restricted");
      }

      await this.firestoreService.deleteUserRestriction(restriction.id);
      console.log(`✅ User ${restrictedUserId} unrestricted by ${userId}`);
    } catch (error) {
      console.error("❌ Error unrestricting user:", error);
      throw new Error(
        `Failed to unrestrict user: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get a specific restriction
   */
  async getRestriction(
    userId: string,
    restrictedUserId: string
  ): Promise<UserRestriction | null> {
    try {
      return await this.firestoreService.getUserRestriction(
        userId,
        restrictedUserId
      );
    } catch (error) {
      console.error("❌ Error getting restriction:", error);
      return null;
    }
  }

  /**
   * Get all restricted users for a user
   */
  async getRestrictedUsers(userId: string): Promise<UserRestriction[]> {
    try {
      return await this.firestoreService.getUserRestrictions(userId);
    } catch (error) {
      console.error("❌ Error getting restricted users:", error);
      return [];
    }
  }

  /**
   * Check if a user is restricted
   */
  async isUserRestricted(
    userId: string,
    restrictedUserId: string
  ): Promise<boolean> {
    try {
      const restriction = await this.getRestriction(userId, restrictedUserId);
      return restriction !== null;
    } catch (error) {
      console.error("❌ Error checking if user is restricted:", error);
      return false;
    }
  }

  /**
   * Get restriction statistics
   */
  async getRestrictionStats(userId: string): Promise<{
    totalRestricted: number;
    byType: Record<string, number>;
  }> {
    try {
      const restrictedUsers = await this.getRestrictedUsers(userId);
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
    } catch (error) {
      console.error("❌ Error getting restriction stats:", error);
      return {
        totalRestricted: 0,
        byType: { interaction: 0, visibility: 0, full: 0 },
      };
    }
  }
}

// Singleton export
export const getUserRestrictService = () => UserRestrictService.getInstance();
