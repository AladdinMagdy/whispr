import { getFirestoreService } from "./firestoreService";
import { getBlockListCacheService } from "./blockListCacheService";
import { UserBlock } from "../types";
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
  private static instance: UserBlockService;
  private firestoreService = getFirestoreService();
  private blockListCache = getBlockListCacheService();

  private constructor() {}

  static getInstance(): UserBlockService {
    if (!UserBlockService.instance) {
      UserBlockService.instance = new UserBlockService();
    }
    return UserBlockService.instance;
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
      await this.firestoreService.saveUserBlock(block);
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

      await this.firestoreService.deleteUserBlock(block!.id);
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
      return await this.firestoreService.getUserBlock(userId, blockedUserId);
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
      return await this.firestoreService.getUserBlocks(userId);
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
}

// Singleton export
export const getUserBlockService = () => UserBlockService.getInstance();
