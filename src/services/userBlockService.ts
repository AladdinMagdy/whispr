import { getFirestoreService } from "./firestoreService";
import { getBlockListCacheService } from "./blockListCacheService";
import { UserBlock } from "../types";

export interface CreateBlockData {
  userId: string;
  blockedUserId: string;
  blockedUserDisplayName: string;
}

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
      // Check if already blocked
      const existingBlock = await this.getBlock(
        data.userId,
        data.blockedUserId
      );
      if (existingBlock) {
        throw new Error("User is already blocked");
      }

      const block: UserBlock = {
        id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        userId: data.userId,
        blockedUserId: data.blockedUserId,
        blockedUserDisplayName: data.blockedUserDisplayName,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.firestoreService.saveUserBlock(block);
      await this.blockListCache.invalidateCache(data.userId);
      console.log(`🚫 User ${data.blockedUserId} blocked by ${data.userId}`);

      return block;
    } catch (error) {
      console.error("❌ Error blocking user:", error);
      throw new Error(
        `Failed to block user: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Unblock a user
   */
  async unblockUser(userId: string, blockedUserId: string): Promise<void> {
    try {
      const block = await this.getBlock(userId, blockedUserId);
      if (!block) {
        throw new Error("User is not blocked");
      }

      await this.firestoreService.deleteUserBlock(block.id);
      await this.blockListCache.invalidateCache(userId);
      console.log(`✅ User ${blockedUserId} unblocked by ${userId}`);
    } catch (error) {
      console.error("❌ Error unblocking user:", error);
      throw new Error(
        `Failed to unblock user: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
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
  async getBlockStats(userId: string): Promise<{
    totalBlocked: number;
    recentlyBlocked: number; // Last 7 days
  }> {
    try {
      const blockedUsers = await this.getBlockedUsers(userId);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const recentlyBlocked = blockedUsers.filter(
        (block) => block.createdAt > sevenDaysAgo
      ).length;

      return {
        totalBlocked: blockedUsers.length,
        recentlyBlocked,
      };
    } catch (error) {
      console.error("❌ Error getting block stats:", error);
      return {
        totalBlocked: 0,
        recentlyBlocked: 0,
      };
    }
  }
}

// Singleton export
export const getUserBlockService = () => UserBlockService.getInstance();
