import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestoreService } from "./firestoreService";

interface BlockListCache {
  blockedUsers: Set<string>;
  blockedByUsers: Set<string>;
  mutedUsers: Set<string>;
  lastUpdated: number;
  userId: string;
}

export class BlockListCacheService {
  private static instance: BlockListCacheService;
  private cache: Map<string, BlockListCache> = new Map();
  private cacheExpiryMs = 5 * 60 * 1000; // 5 minutes
  private firestoreService = getFirestoreService();

  private constructor() {}

  static getInstance(): BlockListCacheService {
    if (!BlockListCacheService.instance) {
      BlockListCacheService.instance = new BlockListCacheService();
    }
    return BlockListCacheService.instance;
  }

  async getBlockLists(userId: string): Promise<{
    blockedUsers: Set<string>;
    blockedByUsers: Set<string>;
    mutedUsers: Set<string>;
  }> {
    const cacheKey = `blocklist_${userId}`;
    // Memory cache
    const memoryCache = this.cache.get(cacheKey);
    if (memoryCache && this.isCacheValid(memoryCache.lastUpdated)) {
      return {
        blockedUsers: memoryCache.blockedUsers,
        blockedByUsers: memoryCache.blockedByUsers,
        mutedUsers: memoryCache.mutedUsers,
      };
    }
    // AsyncStorage cache
    const storageCache = await this.getStorageCache(cacheKey);
    if (storageCache && this.isCacheValid(storageCache.lastUpdated)) {
      this.cache.set(cacheKey, storageCache);
      return {
        blockedUsers: storageCache.blockedUsers,
        blockedByUsers: storageCache.blockedByUsers,
        mutedUsers: storageCache.mutedUsers,
      };
    }
    // Fetch from Firestore
    const [blocked, blockedBy, muted] = await Promise.all([
      this.firestoreService.getUserBlocks(userId),
      this.firestoreService.getUsersWhoBlockedMe(userId),
      this.firestoreService.getUserMutes(userId),
    ]);
    const blockLists = {
      blockedUsers: new Set<string>(
        blocked.map((b: { blockedUserId: string }) => b.blockedUserId)
      ),
      blockedByUsers: new Set<string>(
        blockedBy.map((b: { userId: string }) => b.userId)
      ),
      mutedUsers: new Set<string>(
        muted.map((m: { mutedUserId: string }) => m.mutedUserId)
      ),
    };
    await this.cacheBlockLists(cacheKey, blockLists, userId);
    return blockLists;
  }

  async isUserBlocked(userId: string, targetUserId: string): Promise<boolean> {
    const blockLists = await this.getBlockLists(userId);
    return (
      blockLists.blockedUsers.has(targetUserId) ||
      blockLists.blockedByUsers.has(targetUserId)
    );
  }

  async isUserMuted(userId: string, targetUserId: string): Promise<boolean> {
    const blockLists = await this.getBlockLists(userId);
    return blockLists.mutedUsers.has(targetUserId);
  }

  async invalidateCache(userId: string): Promise<void> {
    const cacheKey = `blocklist_${userId}`;
    this.cache.delete(cacheKey);
    try {
      await AsyncStorage.removeItem(cacheKey);
    } catch {
      // Swallow errors to ensure graceful handling
    }
  }

  private async cacheBlockLists(
    cacheKey: string,
    blockLists: {
      blockedUsers: Set<string>;
      blockedByUsers: Set<string>;
      mutedUsers: Set<string>;
    },
    userId: string
  ): Promise<void> {
    const cacheData: BlockListCache = {
      ...blockLists,
      lastUpdated: Date.now(),
      userId,
    };
    this.cache.set(cacheKey, cacheData);
    try {
      const storageData = {
        ...cacheData,
        blockedUsers: Array.from(cacheData.blockedUsers),
        blockedByUsers: Array.from(cacheData.blockedByUsers),
        mutedUsers: Array.from(cacheData.mutedUsers),
      };
      await AsyncStorage.setItem(cacheKey, JSON.stringify(storageData));
    } catch {
      // Ignore
    }
  }

  private async getStorageCache(
    cacheKey: string
  ): Promise<BlockListCache | null> {
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (!cached) return null;
      const parsed = JSON.parse(cached);
      return {
        ...parsed,
        blockedUsers: new Set(parsed.blockedUsers),
        blockedByUsers: new Set(parsed.blockedByUsers),
        mutedUsers: new Set(parsed.mutedUsers),
      };
    } catch {
      return null;
    }
  }

  private isCacheValid(lastUpdated: number): boolean {
    return Date.now() - lastUpdated < this.cacheExpiryMs;
  }
}

export const getBlockListCacheService = (): BlockListCacheService => {
  return BlockListCacheService.getInstance();
};
