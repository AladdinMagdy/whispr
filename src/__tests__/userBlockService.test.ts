import {
  UserBlockService,
  CreateBlockData,
} from "../services/userBlockService";
import { getBlockListCacheService } from "../services/blockListCacheService";
import { UserBlockRepository } from "../repositories/UserBlockRepository";
import { UserBlock } from "../types";
import {
  getUserBlockService,
  resetUserBlockService,
  destroyUserBlockService,
} from "../services/userBlockService";

jest.mock("../services/blockListCacheService");

const mockBlockListCacheService =
  getBlockListCacheService as jest.MockedFunction<
    typeof getBlockListCacheService
  >;

describe("UserBlockService", () => {
  let service: UserBlockService;
  let mockRepository: jest.Mocked<UserBlockRepository>;
  let mockBlockListCache: any;

  beforeEach(() => {
    jest.clearAllMocks();
    (UserBlockService as any).instance = undefined;
    mockRepository = {
      getAll: jest.fn(),
      getById: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getByUser: jest.fn(),
      getByBlockedUser: jest.fn(),
      getByUserAndBlockedUser: jest.fn(),
      isUserBlocked: jest.fn(),
    };
    mockBlockListCache = {
      invalidateCache: jest.fn(),
    };
    mockBlockListCacheService.mockReturnValue(mockBlockListCache);
    service = new UserBlockService(mockRepository);
  });

  describe("getInstance", () => {
    it("should return singleton instance", () => {
      const instance1 = UserBlockService.getInstance();
      const instance2 = UserBlockService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("should create new instance when none exists", () => {
      (UserBlockService as any).instance = undefined;
      const instance = UserBlockService.getInstance();
      expect(instance).toBeInstanceOf(UserBlockService);
    });

    it("should return existing instance when one exists", () => {
      const existingInstance = new UserBlockService();
      (UserBlockService as any).instance = existingInstance;
      const instance = UserBlockService.getInstance();
      expect(instance).toBe(existingInstance);
    });

    it("should handle null instance gracefully", () => {
      (UserBlockService as any).instance = null;
      const instance = UserBlockService.getInstance();
      expect(instance).toBeInstanceOf(UserBlockService);
    });
  });

  describe("getUsersWhoBlockedMe", () => {
    it("should return users who blocked me", async () => {
      const blocks: UserBlock[] = [
        {
          id: "block-1",
          userId: "u1",
          blockedUserId: "u2",
          blockedUserDisplayName: "U2",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "block-2",
          userId: "u3",
          blockedUserId: "u2",
          blockedUserDisplayName: "U2",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      mockRepository.getByBlockedUser.mockResolvedValue(blocks);
      await expect(service.getUsersWhoBlockedMe("u2")).resolves.toEqual(blocks);
    });

    it("should handle errors and throw with message", async () => {
      mockRepository.getByBlockedUser.mockRejectedValue(new Error("fail"));
      await expect(service.getUsersWhoBlockedMe("u2")).rejects.toThrow(
        "Failed to get users who blocked me"
      );
    });

    it("should return empty array when no users blocked me", async () => {
      mockRepository.getByBlockedUser.mockResolvedValue([]);
      await expect(service.getUsersWhoBlockedMe("u2")).resolves.toEqual([]);
    });

    it("should handle empty userId", async () => {
      mockRepository.getByBlockedUser.mockRejectedValue(new Error("fail"));
      await expect(service.getUsersWhoBlockedMe("")).rejects.toThrow(
        "Failed to get users who blocked me"
      );
    });

    it("should handle repository errors gracefully", async () => {
      mockRepository.getByBlockedUser.mockRejectedValue(new Error("db error"));
      await expect(service.getUsersWhoBlockedMe("u2")).rejects.toThrow(
        "Failed to get users who blocked me"
      );
    });
  });

  describe("blockUser", () => {
    const data: CreateBlockData = {
      userId: "user1",
      blockedUserId: "user2",
      blockedUserDisplayName: "User Two",
    };

    it("should block a user if not already blocked", async () => {
      mockRepository.getByUserAndBlockedUser.mockResolvedValue(null);
      mockRepository.save.mockResolvedValue(undefined);
      mockBlockListCache.invalidateCache.mockResolvedValue(undefined);

      const result = await service.blockUser(data);
      expect(result.userId).toBe(data.userId);
      expect(result.blockedUserId).toBe(data.blockedUserId);
      expect(mockRepository.save).toHaveBeenCalled();
      expect(mockBlockListCache.invalidateCache).toHaveBeenCalledWith(
        data.userId
      );
    });

    it("should throw if user is already blocked", async () => {
      mockRepository.getByUserAndBlockedUser.mockResolvedValue({
        id: "block-1",
      } as UserBlock);
      await expect(service.blockUser(data)).rejects.toThrow("already blocked");
    });

    it("should handle errors and throw with message", async () => {
      mockRepository.getByUserAndBlockedUser.mockResolvedValue(null);
      mockRepository.save.mockRejectedValue(new Error("fail"));
      await expect(service.blockUser(data)).rejects.toThrow(
        "Failed to block: fail"
      );
    });

    it("should handle validation errors for empty userId", async () => {
      const invalidData = {
        ...data,
        userId: "",
      };

      await expect(service.blockUser(invalidData)).rejects.toThrow(
        "Invalid userId provided"
      );
    });

    it("should handle validation errors for empty blockedUserId", async () => {
      const invalidData = {
        ...data,
        blockedUserId: "",
      };

      await expect(service.blockUser(invalidData)).rejects.toThrow(
        "Invalid targetUserId provided"
      );
    });

    it("should handle validation errors for empty display name", async () => {
      const invalidData = {
        ...data,
        blockedUserDisplayName: "",
      };

      await expect(service.blockUser(invalidData)).rejects.toThrow(
        "Invalid displayName provided"
      );
    });

    it("should handle self-block attempt", async () => {
      const selfBlockData = {
        ...data,
        blockedUserId: "user1",
      };

      await expect(service.blockUser(selfBlockData)).rejects.toThrow(
        "Cannot perform action on yourself"
      );
    });

    it("should handle repository errors during save", async () => {
      mockRepository.getByUserAndBlockedUser.mockResolvedValue(null);
      mockRepository.save.mockRejectedValue(new Error("db error"));

      await expect(service.blockUser(data)).rejects.toThrow(
        "Failed to block: db error"
      );
    });

    it("should handle cache invalidation errors", async () => {
      mockRepository.getByUserAndBlockedUser.mockResolvedValue(null);
      mockRepository.save.mockResolvedValue(undefined);
      mockBlockListCache.invalidateCache.mockRejectedValue(
        new Error("cache error")
      );

      await expect(service.blockUser(data)).rejects.toThrow(
        "Failed to block: cache error"
      );
    });

    it("should handle null values in block data", async () => {
      const invalidData = {
        userId: null as any,
        blockedUserId: "user2",
        blockedUserDisplayName: "User Two",
      };

      await expect(service.blockUser(invalidData)).rejects.toThrow(
        "Invalid userId provided"
      );
    });

    it("should handle undefined values in block data", async () => {
      const invalidData = {
        userId: "user1",
        blockedUserId: undefined as any,
        blockedUserDisplayName: "User Two",
      };

      await expect(service.blockUser(invalidData)).rejects.toThrow(
        "Invalid targetUserId provided"
      );
    });

    it("should handle repository errors during getByUserAndBlockedUser", async () => {
      mockRepository.getByUserAndBlockedUser.mockRejectedValue(
        new Error("db error")
      );
      mockRepository.save.mockResolvedValue(undefined);
      mockBlockListCache.invalidateCache.mockResolvedValue(undefined);

      const result = await service.blockUser(data);
      expect(result.userId).toBe(data.userId);
      expect(result.blockedUserId).toBe(data.blockedUserId);
    });

    it("should handle validation errors for empty values", async () => {
      const invalidData = {
        ...data,
        userId: "",
      };

      await expect(service.blockUser(invalidData)).rejects.toThrow(
        "Invalid userId provided"
      );
    });

    it("should handle validation errors for empty blockedUserId", async () => {
      const invalidData = {
        ...data,
        blockedUserId: "",
      };

      await expect(service.blockUser(invalidData)).rejects.toThrow(
        "Invalid targetUserId provided"
      );
    });

    it("should handle validation errors for empty display name", async () => {
      const invalidData = {
        ...data,
        blockedUserDisplayName: "",
      };

      await expect(service.blockUser(invalidData)).rejects.toThrow(
        "Invalid displayName provided"
      );
    });
  });

  describe("unblockUser", () => {
    const userId = "user1";
    const blockedUserId = "user2";

    it("should unblock a user if block exists", async () => {
      mockRepository.getByUserAndBlockedUser.mockResolvedValue({
        id: "block-1",
      } as UserBlock);
      mockRepository.delete.mockResolvedValue(undefined);
      mockBlockListCache.invalidateCache.mockResolvedValue(undefined);
      await expect(
        service.unblockUser(userId, blockedUserId)
      ).resolves.toBeUndefined();
      expect(mockRepository.delete).toHaveBeenCalledWith("block-1");
      expect(mockBlockListCache.invalidateCache).toHaveBeenCalledWith(userId);
    });

    it("should throw if user is not blocked", async () => {
      mockRepository.getByUserAndBlockedUser.mockResolvedValue(null);
      await expect(service.unblockUser(userId, blockedUserId)).rejects.toThrow(
        "not blocked"
      );
    });

    it("should handle errors and throw with message", async () => {
      mockRepository.getByUserAndBlockedUser.mockRejectedValue(
        new Error("fail")
      );
      await expect(service.unblockUser(userId, blockedUserId)).rejects.toThrow(
        "Failed to unblock: User is not blocked"
      );
    });

    it("should handle repository delete errors", async () => {
      mockRepository.getByUserAndBlockedUser.mockResolvedValue({
        id: "block-1",
      } as UserBlock);
      mockRepository.delete.mockRejectedValue(new Error("delete failed"));

      await expect(service.unblockUser(userId, blockedUserId)).rejects.toThrow(
        "Failed to unblock: delete failed"
      );
    });

    it("should handle cache invalidation errors", async () => {
      mockRepository.getByUserAndBlockedUser.mockResolvedValue({
        id: "block-1",
      } as UserBlock);
      mockRepository.delete.mockResolvedValue(undefined);
      mockBlockListCache.invalidateCache.mockRejectedValue(
        new Error("cache error")
      );

      await expect(service.unblockUser(userId, blockedUserId)).rejects.toThrow(
        "Failed to unblock: cache error"
      );
    });

    it("should handle repository getByUserAndBlockedUser errors", async () => {
      mockRepository.getByUserAndBlockedUser.mockRejectedValue(
        new Error("db error")
      );

      await expect(service.unblockUser(userId, blockedUserId)).rejects.toThrow(
        "Failed to unblock: User is not blocked"
      );
    });

    it("should handle empty userId", async () => {
      await expect(service.unblockUser("", blockedUserId)).rejects.toThrow(
        "Failed to unblock: User is not blocked"
      );
    });

    it("should handle empty blockedUserId", async () => {
      await expect(service.unblockUser(userId, "")).rejects.toThrow(
        "Failed to unblock: User is not blocked"
      );
    });
  });

  describe("getBlock", () => {
    it("should return block if found", async () => {
      const block: UserBlock = {
        id: "block-1",
        userId: "u1",
        blockedUserId: "u2",
        blockedUserDisplayName: "U2",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockRepository.getByUserAndBlockedUser.mockResolvedValue(block);
      await expect(service.getBlock("u1", "u2")).resolves.toEqual(block);
    });

    it("should return null and log error if error thrown", async () => {
      mockRepository.getByUserAndBlockedUser.mockRejectedValue(
        new Error("fail")
      );
      await expect(service.getBlock("u1", "u2")).resolves.toBeNull();
    });

    it("should return null for non-existent block", async () => {
      mockRepository.getByUserAndBlockedUser.mockResolvedValue(null);
      await expect(service.getBlock("u1", "u2")).resolves.toBeNull();
    });

    it("should handle empty userId", async () => {
      mockRepository.getByUserAndBlockedUser.mockRejectedValue(
        new Error("fail")
      );
      await expect(service.getBlock("", "u2")).resolves.toBeNull();
    });

    it("should handle empty blockedUserId", async () => {
      mockRepository.getByUserAndBlockedUser.mockRejectedValue(
        new Error("fail")
      );
      await expect(service.getBlock("u1", "")).resolves.toBeNull();
    });

    it("should handle repository errors gracefully", async () => {
      mockRepository.getByUserAndBlockedUser.mockRejectedValue(
        new Error("db error")
      );
      await expect(service.getBlock("u1", "u2")).resolves.toBeNull();
    });
  });

  describe("getBlockedUsers", () => {
    it("should return blocked users", async () => {
      const blocks: UserBlock[] = [
        {
          id: "block-1",
          userId: "u1",
          blockedUserId: "u2",
          blockedUserDisplayName: "U2",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      mockRepository.getByUser.mockResolvedValue(blocks);
      await expect(service.getBlockedUsers("u1")).resolves.toEqual(blocks);
    });

    it("should return [] and log error if error thrown", async () => {
      mockRepository.getByUser.mockRejectedValue(new Error("fail"));
      await expect(service.getBlockedUsers("u1")).resolves.toEqual([]);
    });

    it("should return empty array for user with no blocks", async () => {
      mockRepository.getByUser.mockResolvedValue([]);
      await expect(service.getBlockedUsers("u1")).resolves.toEqual([]);
    });

    it("should handle empty userId", async () => {
      mockRepository.getByUser.mockRejectedValue(new Error("fail"));
      await expect(service.getBlockedUsers("")).resolves.toEqual([]);
    });

    it("should handle repository errors gracefully", async () => {
      mockRepository.getByUser.mockRejectedValue(new Error("db error"));
      await expect(service.getBlockedUsers("u1")).resolves.toEqual([]);
    });
  });

  describe("isUserBlocked", () => {
    it("should return true if block exists", async () => {
      mockRepository.getByUserAndBlockedUser.mockResolvedValue({
        id: "block-1",
      } as UserBlock);
      await expect(service.isUserBlocked("u1", "u2")).resolves.toBe(true);
    });

    it("should return false if block does not exist", async () => {
      mockRepository.getByUserAndBlockedUser.mockResolvedValue(null);
      await expect(service.isUserBlocked("u1", "u2")).resolves.toBe(false);
    });

    it("should return false and log error if error thrown", async () => {
      mockRepository.getByUserAndBlockedUser.mockRejectedValue(
        new Error("fail")
      );
      await expect(service.isUserBlocked("u1", "u2")).resolves.toBe(false);
    });

    it("should handle empty userId", async () => {
      mockRepository.getByUserAndBlockedUser.mockRejectedValue(
        new Error("fail")
      );
      await expect(service.isUserBlocked("", "u2")).resolves.toBe(false);
    });

    it("should handle empty blockedUserId", async () => {
      mockRepository.getByUserAndBlockedUser.mockRejectedValue(
        new Error("fail")
      );
      await expect(service.isUserBlocked("u1", "")).resolves.toBe(false);
    });

    it("should handle repository errors gracefully", async () => {
      mockRepository.getByUserAndBlockedUser.mockRejectedValue(
        new Error("db error")
      );
      await expect(service.isUserBlocked("u1", "u2")).resolves.toBe(false);
    });
  });

  describe("getBlockStats", () => {
    it("should return correct stats", async () => {
      const now = new Date();
      const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
      const blocks: UserBlock[] = [
        {
          id: "b1",
          userId: "u1",
          blockedUserId: "u2",
          blockedUserDisplayName: "U2",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "b2",
          userId: "u1",
          blockedUserId: "u3",
          blockedUserDisplayName: "U3",
          createdAt: sixDaysAgo,
          updatedAt: now,
        },
        {
          id: "b3",
          userId: "u1",
          blockedUserId: "u4",
          blockedUserDisplayName: "U4",
          createdAt: tenDaysAgo,
          updatedAt: now,
        },
      ];
      mockRepository.getByUser.mockResolvedValue(blocks);
      const stats = await service.getBlockStats("u1");
      expect(stats.totalBlocked).toBe(3);
      expect(stats.recentlyBlocked).toBe(2);
    });

    it("should return 0s and log error if error thrown", async () => {
      mockRepository.getByUser.mockRejectedValue(new Error("fail"));
      const stats = await service.getBlockStats("u1");
      expect(stats).toEqual({ totalBlocked: 0, recentlyBlocked: 0 });
    });

    it("should return default stats for user with no blocks", async () => {
      mockRepository.getByUser.mockResolvedValue([]);
      const stats = await service.getBlockStats("u1");
      expect(stats).toEqual({ totalBlocked: 0, recentlyBlocked: 0 });
    });

    it("should handle empty userId", async () => {
      mockRepository.getByUser.mockRejectedValue(new Error("fail"));
      const stats = await service.getBlockStats("");
      expect(stats).toEqual({ totalBlocked: 0, recentlyBlocked: 0 });
    });

    it("should handle repository errors gracefully", async () => {
      mockRepository.getByUser.mockRejectedValue(new Error("db error"));
      const stats = await service.getBlockStats("u1");
      expect(stats).toEqual({ totalBlocked: 0, recentlyBlocked: 0 });
    });

    it("should handle stats with only old blocks", async () => {
      const now = new Date();
      const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
      const blocks: UserBlock[] = [
        {
          id: "b1",
          userId: "u1",
          blockedUserId: "u2",
          blockedUserDisplayName: "U2",
          createdAt: fifteenDaysAgo,
          updatedAt: now,
        },
      ];
      mockRepository.getByUser.mockResolvedValue(blocks);
      const stats = await service.getBlockStats("u1");
      expect(stats.totalBlocked).toBe(1);
      expect(stats.recentlyBlocked).toBe(0);
    });
  });

  describe("Singleton Pattern", () => {
    it("should maintain singleton instance across calls", () => {
      const instance1 = UserBlockService.getInstance();
      const instance2 = UserBlockService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("should create new instance after reset", () => {
      const instance1 = UserBlockService.getInstance();
      UserBlockService.resetInstance();
      const instance2 = UserBlockService.getInstance();
      expect(instance1).not.toBe(instance2);
    });

    it("should create new instance after destroy", () => {
      const instance1 = UserBlockService.getInstance();
      UserBlockService.destroyInstance();
      const instance2 = UserBlockService.getInstance();
      expect(instance1).not.toBe(instance2);
    });

    it("should handle resetInstance when instance is null", () => {
      (UserBlockService as any).instance = null;
      expect(() => UserBlockService.resetInstance()).not.toThrow();
    });

    it("should handle destroyInstance when instance is null", () => {
      (UserBlockService as any).instance = null;
      expect(() => UserBlockService.destroyInstance()).not.toThrow();
    });
  });

  describe("Factory Functions", () => {
    beforeEach(() => {
      UserBlockService.resetInstance();
    });

    it("should return singleton instance via getUserBlockService", () => {
      const instance1 = getUserBlockService();
      const instance2 = getUserBlockService();
      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(UserBlockService);
    });

    it("should reset instance via resetUserBlockService", () => {
      const instance1 = getUserBlockService();
      resetUserBlockService();
      const instance2 = getUserBlockService();
      expect(instance1).not.toBe(instance2);
    });

    it("should destroy instance via destroyUserBlockService", () => {
      const instance1 = getUserBlockService();
      destroyUserBlockService();
      const instance2 = getUserBlockService();
      expect(instance1).not.toBe(instance2);
    });

    it("should handle resetUserBlockService when instance is null", () => {
      (UserBlockService as any).instance = null;
      expect(() => resetUserBlockService()).not.toThrow();
    });

    it("should handle destroyUserBlockService when instance is null", () => {
      (UserBlockService as any).instance = null;
      expect(() => destroyUserBlockService()).not.toThrow();
    });
  });

  describe("Repository Integration", () => {
    it("should use default repository when none provided", () => {
      const serviceWithDefault = new UserBlockService();
      expect(serviceWithDefault).toBeInstanceOf(UserBlockService);
    });

    it("should use provided repository", () => {
      const customRepository = {} as UserBlockRepository;
      const serviceWithCustom = new UserBlockService(customRepository);
      expect(serviceWithCustom).toBeInstanceOf(UserBlockService);
    });

    it("should handle null repository gracefully", () => {
      const serviceWithNull = new UserBlockService(null as any);
      expect(serviceWithNull).toBeInstanceOf(UserBlockService);
    });
  });

  describe("Cache Integration", () => {
    it("should invalidate cache after blocking user", async () => {
      const data: CreateBlockData = {
        userId: "user1",
        blockedUserId: "user2",
        blockedUserDisplayName: "User Two",
      };

      mockRepository.getByUserAndBlockedUser.mockResolvedValue(null);
      mockRepository.save.mockResolvedValue(undefined);
      mockBlockListCache.invalidateCache.mockResolvedValue(undefined);

      await service.blockUser(data);

      expect(mockBlockListCache.invalidateCache).toHaveBeenCalledWith("user1");
    });

    it("should invalidate cache after unblocking user", async () => {
      mockRepository.getByUserAndBlockedUser.mockResolvedValue({
        id: "block-1",
      } as UserBlock);
      mockRepository.delete.mockResolvedValue(undefined);
      mockBlockListCache.invalidateCache.mockResolvedValue(undefined);

      await service.unblockUser("user1", "user2");

      expect(mockBlockListCache.invalidateCache).toHaveBeenCalledWith("user1");
    });

    it("should handle cache service initialization", () => {
      expect(mockBlockListCacheService).toHaveBeenCalled();
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle very long userId", async () => {
      const longUserId = "a".repeat(1000);
      mockRepository.getByUserAndBlockedUser.mockResolvedValue(null);
      mockRepository.save.mockResolvedValue(undefined);
      mockBlockListCache.invalidateCache.mockResolvedValue(undefined);

      const data: CreateBlockData = {
        userId: longUserId,
        blockedUserId: "user2",
        blockedUserDisplayName: "User Two",
      };

      const result = await service.blockUser(data);
      expect(result.userId).toBe(longUserId);
    });

    it("should handle very long blockedUserId", async () => {
      const longBlockedUserId = "b".repeat(1000);
      mockRepository.getByUserAndBlockedUser.mockResolvedValue(null);
      mockRepository.save.mockResolvedValue(undefined);
      mockBlockListCache.invalidateCache.mockResolvedValue(undefined);

      const data: CreateBlockData = {
        userId: "user1",
        blockedUserId: longBlockedUserId,
        blockedUserDisplayName: "User Two",
      };

      const result = await service.blockUser(data);
      expect(result.blockedUserId).toBe(longBlockedUserId);
    });

    it("should handle very long display name", async () => {
      const longDisplayName = "c".repeat(1000);
      mockRepository.getByUserAndBlockedUser.mockResolvedValue(null);
      mockRepository.save.mockResolvedValue(undefined);
      mockBlockListCache.invalidateCache.mockResolvedValue(undefined);

      const data: CreateBlockData = {
        userId: "user1",
        blockedUserId: "user2",
        blockedUserDisplayName: longDisplayName,
      };

      const result = await service.blockUser(data);
      expect(result.blockedUserDisplayName).toBe(longDisplayName);
    });

    it("should handle special characters in userId", async () => {
      const specialUserId = "user@#$%^&*()_+-=[]{}|;':\",./<>?";
      mockRepository.getByUserAndBlockedUser.mockResolvedValue(null);
      mockRepository.save.mockResolvedValue(undefined);
      mockBlockListCache.invalidateCache.mockResolvedValue(undefined);

      const data: CreateBlockData = {
        userId: specialUserId,
        blockedUserId: "user2",
        blockedUserDisplayName: "User Two",
      };

      const result = await service.blockUser(data);
      expect(result.userId).toBe(specialUserId);
    });

    it("should handle unicode characters in display name", async () => {
      const unicodeDisplayName = "用户👨‍👩‍👧‍👦🎉";
      mockRepository.getByUserAndBlockedUser.mockResolvedValue(null);
      mockRepository.save.mockResolvedValue(undefined);
      mockBlockListCache.invalidateCache.mockResolvedValue(undefined);

      const data: CreateBlockData = {
        userId: "user1",
        blockedUserId: "user2",
        blockedUserDisplayName: unicodeDisplayName,
      };

      const result = await service.blockUser(data);
      expect(result.blockedUserDisplayName).toBe(unicodeDisplayName);
    });

    it("should handle cache service errors gracefully", async () => {
      const data: CreateBlockData = {
        userId: "user1",
        blockedUserId: "user2",
        blockedUserDisplayName: "User Two",
      };

      mockRepository.getByUserAndBlockedUser.mockResolvedValue(null);
      mockRepository.save.mockResolvedValue(undefined);
      mockBlockListCache.invalidateCache.mockRejectedValue(
        new Error("cache error")
      );

      await expect(service.blockUser(data)).rejects.toThrow(
        "Failed to block: cache error"
      );
    });
  });
});
