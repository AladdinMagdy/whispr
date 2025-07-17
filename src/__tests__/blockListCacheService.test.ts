import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  BlockListCacheService,
  getBlockListCacheService,
} from "../services/blockListCacheService";
import { getFirestoreService } from "../services/firestoreService";

// Mock dependencies
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));
jest.mock("../services/firestoreService");

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockFirestoreService = getFirestoreService as jest.MockedFunction<
  typeof getFirestoreService
>;

describe("BlockListCacheService", () => {
  let service: BlockListCacheService;
  let mockFirestore: any;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset singleton instance and cache
    (BlockListCacheService as any).instance = undefined;
    // Setup mock Firestore service
    mockFirestore = {
      getUserBlocks: jest.fn(),
      getUsersWhoBlockedMe: jest.fn(),
      getUserMutes: jest.fn(),
    };
    mockFirestoreService.mockReturnValue(mockFirestore);
    service = getBlockListCacheService();
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
      expect(mockFirestore.getUserBlocks).not.toHaveBeenCalled();
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
      expect(mockFirestore.getUserBlocks).not.toHaveBeenCalled();
    });

    it("should fetch from Firestore when cache is invalid", async () => {
      // Ensure cache is clear and AsyncStorage returns null
      (service as any).cache.clear();
      mockAsyncStorage.getItem.mockResolvedValue(null);
      const mockBlocks = [
        { blockedUserId: "blocked1" },
        { blockedUserId: "blocked2" },
      ];
      const mockBlockedBy = [{ userId: "blocker1" }];
      const mockMutes = [{ mutedUserId: "muted1" }];
      mockFirestore.getUserBlocks.mockResolvedValue(mockBlocks);
      mockFirestore.getUsersWhoBlockedMe.mockResolvedValue(mockBlockedBy);
      mockFirestore.getUserMutes.mockResolvedValue(mockMutes);
      mockAsyncStorage.setItem.mockResolvedValue();
      const result = await service.getBlockLists(userId);
      expect(result).toEqual({
        blockedUsers: new Set(["blocked1", "blocked2"]),
        blockedByUsers: new Set(["blocker1"]),
        mutedUsers: new Set(["muted1"]),
      });
      expect(mockFirestore.getUserBlocks).toHaveBeenCalledWith(userId);
      expect(mockFirestore.getUsersWhoBlockedMe).toHaveBeenCalledWith(userId);
      expect(mockFirestore.getUserMutes).toHaveBeenCalledWith(userId);
    });

    it("should handle empty results from Firestore", async () => {
      // Ensure cache is clear and AsyncStorage returns null
      (service as any).cache.clear();
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockFirestore.getUserBlocks.mockResolvedValue([]);
      mockFirestore.getUsersWhoBlockedMe.mockResolvedValue([]);
      mockFirestore.getUserMutes.mockResolvedValue([]);
      mockAsyncStorage.setItem.mockResolvedValue();
      const result = await service.getBlockLists(userId);
      expect(result).toEqual({
        blockedUsers: new Set(),
        blockedByUsers: new Set(),
        mutedUsers: new Set(),
      });
      expect(mockFirestore.getUserBlocks).toHaveBeenCalledWith(userId);
      expect(mockFirestore.getUsersWhoBlockedMe).toHaveBeenCalledWith(userId);
      expect(mockFirestore.getUserMutes).toHaveBeenCalledWith(userId);
    });

    it("should handle AsyncStorage errors gracefully", async () => {
      mockAsyncStorage.getItem.mockRejectedValue(new Error("Storage error"));
      mockFirestore.getUserBlocks.mockResolvedValue([]);
      mockFirestore.getUsersWhoBlockedMe.mockResolvedValue([]);
      mockFirestore.getUserMutes.mockResolvedValue([]);

      const result = await service.getBlockLists(userId);

      expect(result).toEqual({
        blockedUsers: new Set(),
        blockedByUsers: new Set(),
        mutedUsers: new Set(),
      });
    });

    it("should handle AsyncStorage setItem errors gracefully", async () => {
      mockFirestore.getUserBlocks.mockResolvedValue([]);
      mockFirestore.getUsersWhoBlockedMe.mockResolvedValue([]);
      mockFirestore.getUserMutes.mockResolvedValue([]);
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
        blockedUsers: new Set<string>(["other1"]),
        blockedByUsers: new Set<string>(["other2"]),
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
        mutedUsers: new Set<string>(["other1"]),
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
      // Setup memory cache
      const mockCache = {
        blockedUsers: new Set(["blocked1"]),
        blockedByUsers: new Set(),
        mutedUsers: new Set(),
        lastUpdated: Date.now(),
        userId,
      };
      (service as any).cache.set(cacheKey, mockCache);

      mockAsyncStorage.removeItem.mockResolvedValue();

      await service.invalidateCache(userId);

      expect((service as any).cache.has(cacheKey)).toBe(false);
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(cacheKey);
    });

    it("should handle AsyncStorage removeItem errors gracefully", async () => {
      mockAsyncStorage.removeItem.mockRejectedValue(new Error("Storage error"));
      await expect(service.invalidateCache(userId)).resolves.toBeUndefined();
    });
  });

  describe("cache validation", () => {
    it("should consider cache valid within expiry time", () => {
      const lastUpdated = Date.now() - 2 * 60 * 1000; // 2 minutes ago
      const isValid = (service as any).isCacheValid(lastUpdated);
      expect(isValid).toBe(true);
    });

    it("should consider cache invalid after expiry time", () => {
      const lastUpdated = Date.now() - 10 * 60 * 1000; // 10 minutes ago
      const isValid = (service as any).isCacheValid(lastUpdated);
      expect(isValid).toBe(false);
    });
  });

  describe("getStorageCache", () => {
    it("should return null for non-existent cache", async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const result = await (service as any).getStorageCache("nonexistent");

      expect(result).toBeNull();
    });

    it("should return null for invalid JSON", async () => {
      mockAsyncStorage.getItem.mockResolvedValue("invalid json");

      const result = await (service as any).getStorageCache("invalid");

      expect(result).toBeNull();
    });

    it("should return parsed cache data", async () => {
      const mockData = {
        blockedUsers: ["user1", "user2"],
        blockedByUsers: ["user3"],
        mutedUsers: ["user4"],
        lastUpdated: Date.now(),
        userId: "user123",
      };

      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(mockData));

      const result = await (service as any).getStorageCache("valid");

      expect(result).toEqual({
        ...mockData,
        blockedUsers: new Set(["user1", "user2"]),
        blockedByUsers: new Set(["user3"]),
        mutedUsers: new Set(["user4"]),
      });
    });

    it("should handle AsyncStorage errors", async () => {
      mockAsyncStorage.getItem.mockRejectedValue(new Error("Storage error"));

      const result = await (service as any).getStorageCache("error");

      expect(result).toBeNull();
    });
  });

  describe("cacheBlockLists", () => {
    it("should cache data in memory and AsyncStorage", async () => {
      const cacheKey = "test_key";
      const blockLists = {
        blockedUsers: new Set(["user1"]),
        blockedByUsers: new Set(["user2"]),
        mutedUsers: new Set(["user3"]),
      };
      const userId = "user123";

      mockAsyncStorage.setItem.mockResolvedValue();

      await (service as any).cacheBlockLists(cacheKey, blockLists, userId);

      // Check memory cache
      const memoryCache = (service as any).cache.get(cacheKey);
      expect(memoryCache).toBeDefined();
      expect(memoryCache.blockedUsers).toEqual(new Set(["user1"]));
      expect(memoryCache.blockedByUsers).toEqual(new Set(["user2"]));
      expect(memoryCache.mutedUsers).toEqual(new Set(["user3"]));
      expect(memoryCache.userId).toBe(userId);
      expect(memoryCache.lastUpdated).toBeGreaterThan(0);

      // Check AsyncStorage call
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        cacheKey,
        expect.stringContaining('"blockedUsers":["user1"]')
      );
    });

    it("should handle AsyncStorage setItem errors gracefully", async () => {
      const cacheKey = "test_key";
      const blockLists = {
        blockedUsers: new Set(["user1"]),
        blockedByUsers: new Set(),
        mutedUsers: new Set(),
      };
      const userId = "user123";

      mockAsyncStorage.setItem.mockRejectedValue(new Error("Storage error"));

      await expect(
        (service as any).cacheBlockLists(cacheKey, blockLists, userId)
      ).resolves.not.toThrow();

      // Memory cache should still be set
      const memoryCache = (service as any).cache.get(cacheKey);
      expect(memoryCache).toBeDefined();
    });
  });
});
