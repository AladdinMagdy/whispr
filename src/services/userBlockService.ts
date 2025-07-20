import { getBlockListCacheService } from "./blockListCacheService";
import { UserBlock } from "../types";
import { UserBlockRepository } from "../repositories/UserBlockRepository";
import { FirebaseUserBlockRepository } from "../repositories/FirebaseUserBlockRepository";
import {
  CreateBlockData,
  BlockStats,
  createUserBlock,
  validateUserActionData,
  checkExistingAction,
  checkActionDoesNotExist,
  calculateBlockStats,
  handleUserActionError,
  logUserActionSuccess,
  getDefaultBlockStats,
} from "../utils/userActionUtils";

export type { CreateBlockData, BlockStats } from "../utils/userActionUtils";

export class UserBlockService {
  private static instance: UserBlockService | null;
  private repository: UserBlockRepository;
  private blockListCache = getBlockListCacheService();

  constructor(repository?: UserBlockRepository) {
    this.repository = repository || new FirebaseUserBlockRepository();
  }

  static getInstance(): UserBlockService {
    if (!UserBlockService.instance) {
      UserBlockService.instance = new UserBlockService();
    }
    return UserBlockService.instance;
  }

  /**
   * Get users who have blocked the specified user
   */
  async getUsersWhoBlockedMe(userId: string): Promise<UserBlock[]> {
    try {
      return await this.repository.getByBlockedUser(userId);
    } catch (error) {
      console.error("Error getting users who blocked me:", error);
      throw new Error("Failed to get users who blocked me");
    }
  }

  /**
   * Block a user
   */
  async blockUser(data: CreateBlockData): Promise<UserBlock> {
    try {
      // Validate input data
      validateUserActionData(
        data.userId,
        data.blockedUserId,
        data.blockedUserDisplayName
      );

      // Check if already blocked
      const existingBlock = await this.getBlock(
        data.userId,
        data.blockedUserId
      );
      checkExistingAction(existingBlock, "block");

      // Create block object
      const block = createUserBlock(data);

      // Save to database
      await this.repository.save(block);
      await this.blockListCache.invalidateCache(data.userId);

      // Log success
      logUserActionSuccess("block", "create", data.userId, data.blockedUserId);

      return block;
    } catch (error) {
      handleUserActionError(error, "block", "create");
    }
  }

  /**
   * Unblock a user
   */
  async unblockUser(userId: string, blockedUserId: string): Promise<void> {
    try {
      const block = await this.getBlock(userId, blockedUserId);
      checkActionDoesNotExist(block, "block");

      await this.repository.delete(block!.id);
      await this.blockListCache.invalidateCache(userId);

      logUserActionSuccess("block", "delete", userId, blockedUserId);
    } catch (error) {
      handleUserActionError(error, "block", "delete");
    }
  }

  /**
   * Get a specific block
   */
  async getBlock(
    userId: string,
    blockedUserId: string
  ): Promise<UserBlock | null> {
    try {
      return await this.repository.getByUserAndBlockedUser(
        userId,
        blockedUserId
      );
    } catch (error) {
      console.error("❌ Error getting block:", error);
      return null;
    }
  }

  /**
   * Get all blocked users for a user
   */
  async getBlockedUsers(userId: string): Promise<UserBlock[]> {
    try {
      return await this.repository.getByUser(userId);
    } catch (error) {
      console.error("❌ Error getting blocked users:", error);
      return [];
    }
  }

  /**
   * Check if a user is blocked
   */
  async isUserBlocked(userId: string, blockedUserId: string): Promise<boolean> {
    try {
      const block = await this.getBlock(userId, blockedUserId);
      return block !== null;
    } catch (error) {
      console.error("❌ Error checking if user is blocked:", error);
      return false;
    }
  }

  /**
   * Get block statistics
   */
  async getBlockStats(userId: string): Promise<BlockStats> {
    try {
      const blockedUsers = await this.getBlockedUsers(userId);
      return calculateBlockStats(blockedUsers);
    } catch (error) {
      console.error("❌ Error getting block stats:", error);
      return getDefaultBlockStats();
    }
  }

  static resetInstance(): void {
    UserBlockService.instance = null;
  }

  static destroyInstance(): void {
    UserBlockService.instance = null;
  }
}

export const getUserBlockService = (): UserBlockService => {
  return UserBlockService.getInstance();
};

export const resetUserBlockService = (): void => {
  UserBlockService.resetInstance();
};

export const destroyUserBlockService = (): void => {
  UserBlockService.destroyInstance();
};
