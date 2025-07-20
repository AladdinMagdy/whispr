import { getBlockListCacheService } from "./blockListCacheService";
import { UserMuteRepository } from "../repositories/UserMuteRepository";
import { FirebaseUserMuteRepository } from "../repositories/FirebaseUserMuteRepository";
import {
  UserMute,
  CreateMuteData,
  MuteStats,
  createUserMute,
  validateUserActionData,
  checkExistingAction,
  checkActionDoesNotExist,
  calculateMuteStats,
  handleUserActionError,
  logUserActionSuccess,
  getDefaultMuteStats,
} from "../utils/userActionUtils";

export type {
  UserMute,
  CreateMuteData,
  MuteStats,
} from "../utils/userActionUtils";

export class UserMuteService {
  private static instance: UserMuteService | null;
  private repository: UserMuteRepository;
  private blockListCache = getBlockListCacheService();

  constructor(repository?: UserMuteRepository) {
    this.repository = repository || new FirebaseUserMuteRepository();
  }

  static getInstance(): UserMuteService {
    if (!UserMuteService.instance) {
      UserMuteService.instance = new UserMuteService();
    }
    return UserMuteService.instance;
  }

  /**
   * Mute a user
   */
  async muteUser(data: CreateMuteData): Promise<UserMute> {
    try {
      // Validate input data
      validateUserActionData(
        data.userId,
        data.mutedUserId,
        data.mutedUserDisplayName
      );

      // Check if already muted
      const existingMute = await this.getMute(data.userId, data.mutedUserId);
      checkExistingAction(existingMute, "mute");

      // Create mute object
      const mute = createUserMute(data);

      // Save to database
      await this.repository.save(mute);
      await this.blockListCache.invalidateCache(data.userId);

      // Log success
      logUserActionSuccess("mute", "create", data.userId, data.mutedUserId);

      return mute;
    } catch (error) {
      handleUserActionError(error, "mute", "create");
    }
  }

  /**
   * Unmute a user
   */
  async unmuteUser(userId: string, mutedUserId: string): Promise<void> {
    try {
      const mute = await this.getMute(userId, mutedUserId);
      checkActionDoesNotExist(mute, "mute");

      await this.repository.delete(mute!.id);
      await this.blockListCache.invalidateCache(userId);

      logUserActionSuccess("mute", "delete", userId, mutedUserId);
    } catch (error) {
      handleUserActionError(error, "mute", "delete");
    }
  }

  /**
   * Get a specific mute
   */
  async getMute(userId: string, mutedUserId: string): Promise<UserMute | null> {
    try {
      return await this.repository.getByUserAndMutedUser(userId, mutedUserId);
    } catch (error) {
      console.error("❌ Error getting mute:", error);
      return null;
    }
  }

  /**
   * Get all muted users for a user
   */
  async getMutedUsers(userId: string): Promise<UserMute[]> {
    try {
      return await this.repository.getByUser(userId);
    } catch (error) {
      console.error("❌ Error getting muted users:", error);
      return [];
    }
  }

  /**
   * Check if a user is muted
   */
  async isUserMuted(userId: string, mutedUserId: string): Promise<boolean> {
    try {
      const mute = await this.getMute(userId, mutedUserId);
      return mute !== null;
    } catch (error) {
      console.error("❌ Error checking if user is muted:", error);
      return false;
    }
  }

  /**
   * Get mute statistics
   */
  async getMuteStats(userId: string): Promise<MuteStats> {
    try {
      const mutedUsers = await this.getMutedUsers(userId);
      return calculateMuteStats(mutedUsers);
    } catch (error) {
      console.error("❌ Error getting mute stats:", error);
      return getDefaultMuteStats();
    }
  }

  // ===== STATIC METHODS FOR RESET/DESTROY =====

  static resetInstance(): void {
    UserMuteService.instance = null;
  }

  static destroyInstance(): void {
    UserMuteService.instance = null;
  }
}

/**
 * Factory function to get UserMuteService instance
 */
export const getUserMuteService = (): UserMuteService => {
  return UserMuteService.getInstance();
};

/**
 * Reset the UserMuteService singleton instance
 */
export const resetUserMuteService = (): void => {
  UserMuteService.resetInstance();
};

/**
 * Destroy the UserMuteService singleton instance
 */
export const destroyUserMuteService = (): void => {
  UserMuteService.destroyInstance();
};
