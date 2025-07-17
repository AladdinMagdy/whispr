import { getFirestoreService } from "./firestoreService";
import { getBlockListCacheService } from "./blockListCacheService";

export interface UserMute {
  id: string;
  userId: string; // The user who is doing the muting
  mutedUserId: string; // The user being muted
  mutedUserDisplayName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMuteData {
  userId: string;
  mutedUserId: string;
  mutedUserDisplayName: string;
}

export class UserMuteService {
  private static instance: UserMuteService;
  private firestoreService = getFirestoreService();
  private blockListCache = getBlockListCacheService();

  private constructor() {}

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
      // Check if already muted
      const existingMute = await this.getMute(data.userId, data.mutedUserId);
      if (existingMute) {
        throw new Error("User is already muted");
      }

      const mute: UserMute = {
        id: `mute-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        userId: data.userId,
        mutedUserId: data.mutedUserId,
        mutedUserDisplayName: data.mutedUserDisplayName,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.firestoreService.saveUserMute(mute);
      await this.blockListCache.invalidateCache(data.userId);
      console.log(`🔇 User ${data.mutedUserId} muted by ${data.userId}`);

      return mute;
    } catch (error) {
      console.error("❌ Error muting user:", error);
      throw new Error(
        `Failed to mute user: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Unmute a user
   */
  async unmuteUser(userId: string, mutedUserId: string): Promise<void> {
    try {
      const mute = await this.getMute(userId, mutedUserId);
      if (!mute) {
        throw new Error("User is not muted");
      }

      await this.firestoreService.deleteUserMute(mute.id);
      await this.blockListCache.invalidateCache(userId);
      console.log(`🔊 User ${mutedUserId} unmuted by ${userId}`);
    } catch (error) {
      console.error("❌ Error unmuting user:", error);
      throw new Error(
        `Failed to unmute user: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get a specific mute
   */
  async getMute(userId: string, mutedUserId: string): Promise<UserMute | null> {
    try {
      return await this.firestoreService.getUserMute(userId, mutedUserId);
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
      return await this.firestoreService.getUserMutes(userId);
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
  async getMuteStats(userId: string): Promise<{
    totalMuted: number;
    recentlyMuted: number; // Last 7 days
  }> {
    try {
      const mutedUsers = await this.getMutedUsers(userId);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const recentlyMuted = mutedUsers.filter(
        (mute) => mute.createdAt > sevenDaysAgo
      ).length;

      return {
        totalMuted: mutedUsers.length,
        recentlyMuted,
      };
    } catch (error) {
      console.error("❌ Error getting mute stats:", error);
      return {
        totalMuted: 0,
        recentlyMuted: 0,
      };
    }
  }
}

// Singleton export
export const getUserMuteService = () => UserMuteService.getInstance();
