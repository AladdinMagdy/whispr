import { getFirestoreService } from "./firestoreService";
import { UserRestriction } from "../types";
import {
  CreateRestrictionData,
  RestrictionStats,
  createUserRestriction,
  validateUserActionData,
  checkExistingAction,
  checkActionDoesNotExist,
  calculateRestrictionStats,
  handleUserActionError,
  logUserActionSuccess,
  getDefaultRestrictionStats,
  validateRestrictionType,
} from "../utils/userActionUtils";

export type {
  CreateRestrictionData,
  RestrictionStats,
} from "../utils/userActionUtils";

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
      // Validate input data
      validateUserActionData(
        data.userId,
        data.restrictedUserId,
        data.restrictedUserDisplayName
      );

      // Validate restriction type
      if (!validateRestrictionType(data.type)) {
        throw new Error("Invalid restriction type");
      }

      // Check if already restricted
      const existingRestriction = await this.getRestriction(
        data.userId,
        data.restrictedUserId
      );
      checkExistingAction(existingRestriction, "restrict");

      // Create restriction object
      const restriction = createUserRestriction(data);

      // Save to database
      await this.firestoreService.saveUserRestriction(restriction);

      // Log success
      logUserActionSuccess(
        "restrict",
        "create",
        data.userId,
        data.restrictedUserId
      );

      return restriction;
    } catch (error) {
      handleUserActionError(error, "restrict", "create");
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
      checkActionDoesNotExist(restriction, "restrict");

      await this.firestoreService.deleteUserRestriction(restriction!.id);

      logUserActionSuccess("restrict", "delete", userId, restrictedUserId);
    } catch (error) {
      handleUserActionError(error, "restrict", "delete");
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
  async getRestrictionStats(userId: string): Promise<RestrictionStats> {
    try {
      const restrictedUsers = await this.getRestrictedUsers(userId);
      return calculateRestrictionStats(restrictedUsers);
    } catch (error) {
      console.error("❌ Error getting restriction stats:", error);
      return getDefaultRestrictionStats();
    }
  }
}

// Singleton export
export const getUserRestrictService = () => UserRestrictService.getInstance();
