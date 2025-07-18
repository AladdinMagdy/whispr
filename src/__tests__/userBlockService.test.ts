import {
  UserBlockService,
  getUserBlockService,
  CreateBlockData,
} from "../services/userBlockService";
import { getFirestoreService } from "../services/firestoreService";
import { getBlockListCacheService } from "../services/blockListCacheService";
import { UserBlock } from "../types";

jest.mock("../services/firestoreService");
jest.mock("../services/blockListCacheService");

const mockFirestoreService = getFirestoreService as jest.MockedFunction<
  typeof getFirestoreService
>;
const mockBlockListCacheService =
  getBlockListCacheService as jest.MockedFunction<
    typeof getBlockListCacheService
  >;

describe("UserBlockService", () => {
  let service: UserBlockService;
  let mockFirestore: any;
  let mockBlockListCache: any;

  beforeEach(() => {
    jest.clearAllMocks();
    (UserBlockService as any).instance = undefined;
    mockFirestore = {
      saveUserBlock: jest.fn(),
      deleteUserBlock: jest.fn(),
      getUserBlock: jest.fn(),
      getUserBlocks: jest.fn(),
    };
    mockBlockListCache = {
      invalidateCache: jest.fn(),
    };
    mockFirestoreService.mockReturnValue(mockFirestore);
    mockBlockListCacheService.mockReturnValue(mockBlockListCache);
    service = getUserBlockService();
  });

  describe("getInstance", () => {
    it("should return singleton instance", () => {
      const instance1 = UserBlockService.getInstance();
      const instance2 = UserBlockService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe("blockUser", () => {
    const data: CreateBlockData = {
      userId: "user1",
      blockedUserId: "user2",
      blockedUserDisplayName: "User Two",
    };

    it("should block a user if not already blocked", async () => {
      mockFirestore.getUserBlock.mockResolvedValue(null);
      mockFirestore.saveUserBlock.mockResolvedValue(undefined);
      mockBlockListCache.invalidateCache.mockResolvedValue(undefined);

      const result = await service.blockUser(data);
      expect(result.userId).toBe(data.userId);
      expect(result.blockedUserId).toBe(data.blockedUserId);
      expect(mockFirestore.saveUserBlock).toHaveBeenCalled();
      expect(mockBlockListCache.invalidateCache).toHaveBeenCalledWith(
        data.userId
      );
    });

    it("should throw if user is already blocked", async () => {
      mockFirestore.getUserBlock.mockResolvedValue({ id: "block-1" });
      await expect(service.blockUser(data)).rejects.toThrow("already blocked");
    });

    it("should handle errors and throw with message", async () => {
      mockFirestore.getUserBlock.mockResolvedValue(null);
      mockFirestore.saveUserBlock.mockRejectedValue(new Error("fail"));
      await expect(service.blockUser(data)).rejects.toThrow(
        "Failed to block: fail"
      );
    });
  });

  describe("unblockUser", () => {
    const userId = "user1";
    const blockedUserId = "user2";
    it("should unblock a user if block exists", async () => {
      mockFirestore.getUserBlock.mockResolvedValue({ id: "block-1" });
      mockFirestore.deleteUserBlock.mockResolvedValue(undefined);
      mockBlockListCache.invalidateCache.mockResolvedValue(undefined);
      await expect(
        service.unblockUser(userId, blockedUserId)
      ).resolves.toBeUndefined();
      expect(mockFirestore.deleteUserBlock).toHaveBeenCalledWith("block-1");
      expect(mockBlockListCache.invalidateCache).toHaveBeenCalledWith(userId);
    });
    it("should throw if user is not blocked", async () => {
      mockFirestore.getUserBlock.mockResolvedValue(null);
      await expect(service.unblockUser(userId, blockedUserId)).rejects.toThrow(
        "not blocked"
      );
    });
    it("should handle errors and throw with message", async () => {
      mockFirestore.getUserBlock.mockRejectedValue(new Error("fail"));
      await expect(service.unblockUser(userId, blockedUserId)).rejects.toThrow(
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
      mockFirestore.getUserBlock.mockResolvedValue(block);
      await expect(service.getBlock("u1", "u2")).resolves.toEqual(block);
    });
    it("should return null and log error if error thrown", async () => {
      mockFirestore.getUserBlock.mockRejectedValue(new Error("fail"));
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
      mockFirestore.getUserBlocks.mockResolvedValue(blocks);
      await expect(service.getBlockedUsers("u1")).resolves.toEqual(blocks);
    });
    it("should return [] and log error if error thrown", async () => {
      mockFirestore.getUserBlocks.mockRejectedValue(new Error("fail"));
      await expect(service.getBlockedUsers("u1")).resolves.toEqual([]);
    });
  });

  describe("isUserBlocked", () => {
    it("should return true if block exists", async () => {
      mockFirestore.getUserBlock.mockResolvedValue({ id: "block-1" });
      await expect(service.isUserBlocked("u1", "u2")).resolves.toBe(true);
    });
    it("should return false if block does not exist", async () => {
      mockFirestore.getUserBlock.mockResolvedValue(null);
      await expect(service.isUserBlocked("u1", "u2")).resolves.toBe(false);
    });
    it("should return false and log error if error thrown", async () => {
      mockFirestore.getUserBlock.mockRejectedValue(new Error("fail"));
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
      mockFirestore.getUserBlocks.mockResolvedValue(blocks);
      const stats = await service.getBlockStats("u1");
      expect(stats.totalBlocked).toBe(3);
      expect(stats.recentlyBlocked).toBe(2);
    });
    it("should return 0s and log error if error thrown", async () => {
      mockFirestore.getUserBlocks.mockRejectedValue(new Error("fail"));
      const stats = await service.getBlockStats("u1");
      expect(stats).toEqual({ totalBlocked: 0, recentlyBlocked: 0 });
    });
  });
});
