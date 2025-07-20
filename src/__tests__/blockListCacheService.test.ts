import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  BlockListCacheService,
  getBlockListCacheService,
} from "../services/blockListCacheService";

// Mock dependencies
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe("BlockListCacheService", () => {
  let service: BlockListCacheService;
  let mockUserBlockService: any;
  let mockUserMuteService: any;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset singleton instance and cache
    (BlockListCacheService as any).instance = undefined;

    // Setup mock services
    mockUserBlockService = {
      getBlockedUsers: jest.fn(),
      getUsersWhoBlockedMe: jest.fn(),
    };

    mockUserMuteService = {
      getMutedUsers: jest.fn(),
    };

    service = getBlockListCacheService();

    // Inject mock services
    service.setUserBlockService(mockUserBlockService);
    service.setUserMuteService(mockUserMuteService);

    // Clear cache for each test
    (service as any).cache.clear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getInstance", () => {
    it("should return singleton instance", () => {
      const instance1 = BlockListCacheService.getInstance();
      const instance2 = BlockListCacheService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe("getBlockLists", () => {
    const userId = "user123";
    const cacheKey = `blocklist_${userId}`;

    it("should return cached data from memory if valid", async () => {
      const mockCache = {
        blockedUsers: new Set(["blocked1", "blocked2"]),
        blockedByUsers: new Set(["blocker1"]),
        mutedUsers: new Set(["muted1"]),
        lastUpdated: Date.now(),
        userId,
      };

      // Mock memory cache
      (service as any).cache.set(cacheKey, mockCache);

      const result = await service.getBlockLists(userId);

      expect(result).toEqual({
        blockedUsers: new Set(["blocked1", "blocked2"]),
        blockedByUsers: new Set(["blocker1"]),
        mutedUsers: new Set(["muted1"]),
      });
      expect(mockUserBlockService.getBlockedUsers).not.toHaveBeenCalled();
    });

    it("should return cached data from AsyncStorage if valid", async () => {
      const mockStorageData = {
        blockedUsers: ["blocked1", "blocked2"],
        blockedByUsers: ["blocker1"],
        mutedUsers: ["muted1"],
        lastUpdated: Date.now(),
        userId,
      };

      mockAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify(mockStorageData)
      );

      const result = await service.getBlockLists(userId);

      expect(result).toEqual({
        blockedUsers: new Set(["blocked1", "blocked2"]),
        blockedByUsers: new Set(["blocker1"]),
        mutedUsers: new Set(["muted1"]),
      });
      expect(mockUserBlockService.getBlockedUsers).not.toHaveBeenCalled();
    });

    it("should fetch from repositories when cache is invalid", async () => {
      // Ensure cache is clear and AsyncStorage returns null
      (service as any).cache.clear();
      mockAsyncStorage.getItem.mockResolvedValue(null);
      const mockBlocks = [
        { blockedUserId: "blocked1" },
        { blockedUserId: "blocked2" },
      ];
      const mockBlockedBy = [{ userId: "blocker1" }];
      const mockMutes = [{ mutedUserId: "muted1" }];
      mockUserBlockService.getBlockedUsers.mockResolvedValue(mockBlocks);
      mockUserBlockService.getUsersWhoBlockedMe.mockResolvedValue(
        mockBlockedBy
      );
      mockUserMuteService.getMutedUsers.mockResolvedValue(mockMutes);
      mockAsyncStorage.setItem.mockResolvedValue();

      const result = await service.getBlockLists(userId);

      expect(result).toEqual({
        blockedUsers: new Set(["blocked1", "blocked2"]),
        blockedByUsers: new Set(["blocker1"]),
        mutedUsers: new Set(["muted1"]),
      });
      expect(mockUserBlockService.getBlockedUsers).toHaveBeenCalledWith(userId);
      expect(mockUserBlockService.getUsersWhoBlockedMe).toHaveBeenCalledWith(
        userId
      );
      expect(mockUserMuteService.getMutedUsers).toHaveBeenCalledWith(userId);
    });

    it("should handle empty results from repositories", async () => {
      // Ensure cache is clear and AsyncStorage returns null
      (service as any).cache.clear();
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockUserBlockService.getBlockedUsers.mockResolvedValue([]);
      mockUserBlockService.getUsersWhoBlockedMe.mockResolvedValue([]);
      mockUserMuteService.getMutedUsers.mockResolvedValue([]);
      mockAsyncStorage.setItem.mockResolvedValue();

      const result = await service.getBlockLists(userId);

      expect(result).toEqual({
        blockedUsers: new Set(),
        blockedByUsers: new Set(),
        mutedUsers: new Set(),
      });
      expect(mockUserBlockService.getBlockedUsers).toHaveBeenCalledWith(userId);
      expect(mockUserBlockService.getUsersWhoBlockedMe).toHaveBeenCalledWith(
        userId
      );
      expect(mockUserMuteService.getMutedUsers).toHaveBeenCalledWith(userId);
    });

    it("should handle AsyncStorage errors gracefully", async () => {
      mockAsyncStorage.getItem.mockRejectedValue(new Error("Storage error"));
      mockUserBlockService.getBlockedUsers.mockResolvedValue([]);
      mockUserBlockService.getUsersWhoBlockedMe.mockResolvedValue([]);
      mockUserMuteService.getMutedUsers.mockResolvedValue([]);

      const result = await service.getBlockLists(userId);

      expect(result).toEqual({
        blockedUsers: new Set(),
        blockedByUsers: new Set(),
        mutedUsers: new Set(),
      });
    });

    it("should handle AsyncStorage setItem errors gracefully", async () => {
      mockUserBlockService.getBlockedUsers.mockResolvedValue([]);
      mockUserBlockService.getUsersWhoBlockedMe.mockResolvedValue([]);
      mockUserMuteService.getMutedUsers.mockResolvedValue([]);
      mockAsyncStorage.setItem.mockRejectedValue(new Error("Storage error"));

      const result = await service.getBlockLists(userId);

      expect(result).toEqual({
        blockedUsers: new Set(),
        blockedByUsers: new Set(),
        mutedUsers: new Set(),
      });
    });
  });

  describe("isUserBlocked", () => {
    const userId = "user123";
    const targetUserId = "target456";

    it("should return true if user is blocked", async () => {
      const mockBlockLists = {
        blockedUsers: new Set<string>([targetUserId]),
        blockedByUsers: new Set<string>(),
        mutedUsers: new Set<string>(),
      };

      jest.spyOn(service, "getBlockLists").mockResolvedValue(mockBlockLists);

      const result = await service.isUserBlocked(userId, targetUserId);

      expect(result).toBe(true);
    });

    it("should return true if user is blocked by target", async () => {
      const mockBlockLists = {
        blockedUsers: new Set<string>(),
        blockedByUsers: new Set<string>([targetUserId]),
        mutedUsers: new Set<string>(),
      };

      jest.spyOn(service, "getBlockLists").mockResolvedValue(mockBlockLists);

      const result = await service.isUserBlocked(userId, targetUserId);

      expect(result).toBe(true);
    });

    it("should return false if user is not blocked", async () => {
      const mockBlockLists = {
        blockedUsers: new Set<string>(),
        blockedByUsers: new Set<string>(),
        mutedUsers: new Set<string>(),
      };

      jest.spyOn(service, "getBlockLists").mockResolvedValue(mockBlockLists);

      const result = await service.isUserBlocked(userId, targetUserId);

      expect(result).toBe(false);
    });
  });

  describe("isUserMuted", () => {
    const userId = "user123";
    const targetUserId = "target456";

    it("should return true if user is muted", async () => {
      const mockBlockLists = {
        blockedUsers: new Set<string>(),
        blockedByUsers: new Set<string>(),
        mutedUsers: new Set<string>([targetUserId]),
      };

      jest.spyOn(service, "getBlockLists").mockResolvedValue(mockBlockLists);

      const result = await service.isUserMuted(userId, targetUserId);

      expect(result).toBe(true);
    });

    it("should return false if user is not muted", async () => {
      const mockBlockLists = {
        blockedUsers: new Set<string>(),
        blockedByUsers: new Set<string>(),
        mutedUsers: new Set<string>(),
      };

      jest.spyOn(service, "getBlockLists").mockResolvedValue(mockBlockLists);

      const result = await service.isUserMuted(userId, targetUserId);

      expect(result).toBe(false);
    });
  });

  describe("invalidateCache", () => {
    const userId = "user123";
    const cacheKey = `blocklist_${userId}`;

    it("should clear memory cache and AsyncStorage", async () => {
      const mockCache = {
        blockedUsers: new Set(["blocked1"]),
        blockedByUsers: new Set(),
        mutedUsers: new Set(),
        lastUpdated: Date.now(),
        userId,
      };

      // Set up memory cache
      (service as any).cache.set(cacheKey, mockCache);
      mockAsyncStorage.removeItem.mockResolvedValue();

      await service.invalidateCache(userId);

      expect((service as any).cache.has(cacheKey)).toBe(false);
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(cacheKey);
    });

    it("should handle AsyncStorage errors gracefully", async () => {
      mockAsyncStorage.removeItem.mockRejectedValue(new Error("Storage error"));

      await expect(service.invalidateCache(userId)).resolves.not.toThrow();
    });
  });

  describe("cache expiration", () => {
    const userId = "user123";
    const cacheKey = `blocklist_${userId}`;

    it("should consider cache invalid after expiry time", async () => {
      const expiredCache = {
        blockedUsers: new Set(["blocked1"]),
        blockedByUsers: new Set(),
        mutedUsers: new Set(),
        lastUpdated: Date.now() - 6 * 60 * 1000, // 6 minutes ago
        userId,
      };

      (service as any).cache.set(cacheKey, expiredCache);
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockUserBlockService.getBlockedUsers.mockResolvedValue([]);
      mockUserBlockService.getUsersWhoBlockedMe.mockResolvedValue([]);
      mockUserMuteService.getMutedUsers.mockResolvedValue([]);

      await service.getBlockLists(userId);

      expect(mockUserBlockService.getBlockedUsers).toHaveBeenCalledWith(userId);
    });

    it("should consider cache valid within expiry time", async () => {
      const validCache = {
        blockedUsers: new Set(["blocked1"]),
        blockedByUsers: new Set(),
        mutedUsers: new Set(),
        lastUpdated: Date.now() - 2 * 60 * 1000, // 2 minutes ago
        userId,
      };

      (service as any).cache.set(cacheKey, validCache);

      const result = await service.getBlockLists(userId);

      expect(result.blockedUsers).toEqual(new Set(["blocked1"]));
      expect(mockUserBlockService.getBlockedUsers).not.toHaveBeenCalled();
    });
  });
});
