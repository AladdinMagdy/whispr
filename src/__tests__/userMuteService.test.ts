import { UserMuteService, CreateMuteData } from "../services/userMuteService";
import { getBlockListCacheService } from "../services/blockListCacheService";
import { UserMuteRepository } from "../repositories/UserMuteRepository";
import { UserMute } from "../services/userMuteService";
import {
  getUserMuteService,
  resetUserMuteService,
  destroyUserMuteService,
} from "../services/userMuteService";

jest.mock("../services/blockListCacheService");

const mockBlockListCacheService =
  getBlockListCacheService as jest.MockedFunction<
    typeof getBlockListCacheService
  >;

describe("UserMuteService", () => {
  let service: UserMuteService;
  let mockRepository: jest.Mocked<UserMuteRepository>;
  let mockBlockListCache: any;

  beforeEach(() => {
    jest.clearAllMocks();
    (UserMuteService as any).instance = undefined;
    mockRepository = {
      getAll: jest.fn(),
      getById: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getByUser: jest.fn(),
      getByMutedUser: jest.fn(),
      getByUserAndMutedUser: jest.fn(),
      isUserMuted: jest.fn(),
    };
    mockBlockListCache = {
      invalidateCache: jest.fn(),
    };
    mockBlockListCacheService.mockReturnValue(mockBlockListCache);
    service = new UserMuteService(mockRepository);
  });

  describe("getInstance", () => {
    it("should return singleton instance", () => {
      const instance1 = UserMuteService.getInstance();
      const instance2 = UserMuteService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("should create new instance when none exists", () => {
      (UserMuteService as any).instance = undefined;
      const instance = UserMuteService.getInstance();
      expect(instance).toBeInstanceOf(UserMuteService);
    });

    it("should return existing instance when one exists", () => {
      const existingInstance = new UserMuteService();
      (UserMuteService as any).instance = existingInstance;
      const instance = UserMuteService.getInstance();
      expect(instance).toBe(existingInstance);
    });
  });

  describe("muteUser", () => {
    const data: CreateMuteData = {
      userId: "user1",
      mutedUserId: "user2",
      mutedUserDisplayName: "User Two",
    };

    it("should mute a user if not already muted", async () => {
      mockRepository.getByUserAndMutedUser.mockResolvedValue(null);
      mockRepository.save.mockResolvedValue(undefined);
      mockBlockListCache.invalidateCache.mockResolvedValue(undefined);

      const result = await service.muteUser(data);
      expect(result.userId).toBe(data.userId);
      expect(result.mutedUserId).toBe(data.mutedUserId);
      expect(mockRepository.save).toHaveBeenCalled();
      expect(mockBlockListCache.invalidateCache).toHaveBeenCalledWith(
        data.userId
      );
    });

    it("should throw if user is already muted", async () => {
      mockRepository.getByUserAndMutedUser.mockResolvedValue({
        id: "mute-1",
      } as UserMute);
      await expect(service.muteUser(data)).rejects.toThrow("already muted");
    });

    it("should handle errors and throw with message", async () => {
      mockRepository.getByUserAndMutedUser.mockResolvedValue(null);
      mockRepository.save.mockRejectedValue(new Error("fail"));
      await expect(service.muteUser(data)).rejects.toThrow(
        "Failed to mute: fail"
      );
    });

    it("should handle validation errors", async () => {
      const invalidData = {
        userId: "",
        mutedUserId: "user2",
        mutedUserDisplayName: "User Two",
      } as CreateMuteData;

      await expect(service.muteUser(invalidData)).rejects.toThrow(
        "Invalid userId provided"
      );
    });

    it("should handle self-mute attempt", async () => {
      const selfMuteData = {
        userId: "user1",
        mutedUserId: "user1",
        mutedUserDisplayName: "User One",
      };

      await expect(service.muteUser(selfMuteData)).rejects.toThrow(
        "Cannot perform action on yourself"
      );
    });

    it("should handle repository errors during save", async () => {
      mockRepository.getByUserAndMutedUser.mockResolvedValue(null);
      mockRepository.save.mockRejectedValue(new Error("db error"));

      await expect(service.muteUser(data)).rejects.toThrow(
        "Failed to mute: db error"
      );
    });
  });

  describe("unmuteUser", () => {
    const userId = "user1";
    const mutedUserId = "user2";

    it("should unmute a user if mute exists", async () => {
      mockRepository.getByUserAndMutedUser.mockResolvedValue({
        id: "mute-1",
      } as UserMute);
      mockRepository.delete.mockResolvedValue(undefined);
      mockBlockListCache.invalidateCache.mockResolvedValue(undefined);

      await expect(
        service.unmuteUser(userId, mutedUserId)
      ).resolves.toBeUndefined();
      expect(mockRepository.delete).toHaveBeenCalledWith("mute-1");
      expect(mockBlockListCache.invalidateCache).toHaveBeenCalledWith(userId);
    });

    it("should throw if user is not muted", async () => {
      mockRepository.getByUserAndMutedUser.mockResolvedValue(null);
      await expect(service.unmuteUser(userId, mutedUserId)).rejects.toThrow(
        "not muted"
      );
    });

    it("should handle errors and throw with message", async () => {
      mockRepository.getByUserAndMutedUser.mockRejectedValue(new Error("fail"));
      await expect(service.unmuteUser(userId, mutedUserId)).rejects.toThrow(
        "Failed to unmute: User is not muted"
      );
    });

    it("should handle repository delete errors", async () => {
      mockRepository.getByUserAndMutedUser.mockResolvedValue({
        id: "mute-1",
      } as UserMute);
      mockRepository.delete.mockRejectedValue(new Error("delete failed"));

      await expect(service.unmuteUser(userId, mutedUserId)).rejects.toThrow(
        "Failed to unmute: delete failed"
      );
    });

    it("should handle cache invalidation errors", async () => {
      mockRepository.getByUserAndMutedUser.mockResolvedValue({
        id: "mute-1",
      } as UserMute);
      mockRepository.delete.mockResolvedValue(undefined);
      mockBlockListCache.invalidateCache.mockRejectedValue(
        new Error("cache error")
      );

      await expect(service.unmuteUser(userId, mutedUserId)).rejects.toThrow(
        "Failed to unmute: cache error"
      );
    });
  });

  describe("getMute", () => {
    it("should return mute if found", async () => {
      const mute: UserMute = {
        id: "mute-1",
        userId: "u1",
        mutedUserId: "u2",
        mutedUserDisplayName: "U2",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockRepository.getByUserAndMutedUser.mockResolvedValue(mute);
      await expect(service.getMute("u1", "u2")).resolves.toEqual(mute);
    });

    it("should return null and log error if error thrown", async () => {
      mockRepository.getByUserAndMutedUser.mockRejectedValue(new Error("fail"));
      await expect(service.getMute("u1", "u2")).resolves.toBeNull();
    });

    it("should return null for non-existent mute", async () => {
      mockRepository.getByUserAndMutedUser.mockResolvedValue(null);
      await expect(service.getMute("u1", "u2")).resolves.toBeNull();
    });
  });

  describe("getMutedUsers", () => {
    it("should return muted users", async () => {
      const mutes: UserMute[] = [
        {
          id: "mute-1",
          userId: "u1",
          mutedUserId: "u2",
          mutedUserDisplayName: "U2",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      mockRepository.getByUser.mockResolvedValue(mutes);
      await expect(service.getMutedUsers("u1")).resolves.toEqual(mutes);
    });

    it("should return [] and log error if error thrown", async () => {
      mockRepository.getByUser.mockRejectedValue(new Error("fail"));
      await expect(service.getMutedUsers("u1")).resolves.toEqual([]);
    });

    it("should return empty array for user with no mutes", async () => {
      mockRepository.getByUser.mockResolvedValue([]);
      await expect(service.getMutedUsers("u1")).resolves.toEqual([]);
    });
  });

  describe("isUserMuted", () => {
    it("should return true if mute exists", async () => {
      mockRepository.getByUserAndMutedUser.mockResolvedValue({
        id: "mute-1",
      } as UserMute);
      await expect(service.isUserMuted("u1", "u2")).resolves.toBe(true);
    });

    it("should return false if mute does not exist", async () => {
      mockRepository.getByUserAndMutedUser.mockResolvedValue(null);
      await expect(service.isUserMuted("u1", "u2")).resolves.toBe(false);
    });

    it("should return false and log error if error thrown", async () => {
      mockRepository.getByUserAndMutedUser.mockRejectedValue(new Error("fail"));
      await expect(service.isUserMuted("u1", "u2")).resolves.toBe(false);
    });
  });

  describe("getMuteStats", () => {
    it("should return correct stats", async () => {
      const now = new Date();
      const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
      const mutes: UserMute[] = [
        {
          id: "m1",
          userId: "u1",
          mutedUserId: "u2",
          mutedUserDisplayName: "U2",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "m2",
          userId: "u1",
          mutedUserId: "u3",
          mutedUserDisplayName: "U3",
          createdAt: sixDaysAgo,
          updatedAt: now,
        },
        {
          id: "m3",
          userId: "u1",
          mutedUserId: "u4",
          mutedUserDisplayName: "U4",
          createdAt: tenDaysAgo,
          updatedAt: now,
        },
      ];
      mockRepository.getByUser.mockResolvedValue(mutes);
      const stats = await service.getMuteStats("u1");
      expect(stats.totalMuted).toBe(3);
      expect(stats.recentlyMuted).toBe(2);
    });

    it("should return 0s and log error if error thrown", async () => {
      mockRepository.getByUser.mockRejectedValue(new Error("fail"));
      const stats = await service.getMuteStats("u1");
      expect(stats).toEqual({ totalMuted: 0, recentlyMuted: 0 });
    });

    it("should return default stats for user with no mutes", async () => {
      mockRepository.getByUser.mockResolvedValue([]);
      const stats = await service.getMuteStats("u1");
      expect(stats).toEqual({ totalMuted: 0, recentlyMuted: 0 });
    });
  });

  describe("Singleton Pattern", () => {
    it("should maintain singleton instance across calls", () => {
      const instance1 = UserMuteService.getInstance();
      const instance2 = UserMuteService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("should create new instance after reset", () => {
      const instance1 = UserMuteService.getInstance();
      UserMuteService.resetInstance();
      const instance2 = UserMuteService.getInstance();
      expect(instance1).not.toBe(instance2);
    });

    it("should create new instance after destroy", () => {
      const instance1 = UserMuteService.getInstance();
      UserMuteService.destroyInstance();
      const instance2 = UserMuteService.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe("Factory Functions", () => {
    beforeEach(() => {
      UserMuteService.resetInstance();
    });

    it("should return singleton instance via getUserMuteService", () => {
      const instance1 = getUserMuteService();
      const instance2 = getUserMuteService();
      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(UserMuteService);
    });

    it("should reset instance via resetUserMuteService", () => {
      const instance1 = getUserMuteService();
      resetUserMuteService();
      const instance2 = getUserMuteService();
      expect(instance1).not.toBe(instance2);
    });

    it("should destroy instance via destroyUserMuteService", () => {
      const instance1 = getUserMuteService();
      destroyUserMuteService();
      const instance2 = getUserMuteService();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe("Error Handling Edge Cases", () => {
    it("should handle validation errors in muteUser", async () => {
      const invalidData = {
        userId: "user1",
        mutedUserId: "",
        mutedUserDisplayName: "User Two",
      } as CreateMuteData;

      await expect(service.muteUser(invalidData)).rejects.toThrow(
        "Invalid targetUserId provided"
      );
    });

    it("should handle empty display name in muteUser", async () => {
      const invalidData = {
        userId: "user1",
        mutedUserId: "user2",
        mutedUserDisplayName: "",
      } as CreateMuteData;

      await expect(service.muteUser(invalidData)).rejects.toThrow(
        "Invalid displayName provided"
      );
    });

    it("should handle null values in muteUser", async () => {
      const invalidData = {
        userId: null as any,
        mutedUserId: "user2",
        mutedUserDisplayName: "User Two",
      };

      await expect(service.muteUser(invalidData)).rejects.toThrow(
        "Invalid userId provided"
      );
    });

    it("should handle undefined values in muteUser", async () => {
      const invalidData = {
        userId: "user1",
        mutedUserId: undefined as any,
        mutedUserDisplayName: "User Two",
      };

      await expect(service.muteUser(invalidData)).rejects.toThrow(
        "Invalid targetUserId provided"
      );
    });
  });

  describe("Repository Integration", () => {
    it("should use default repository when none provided", () => {
      const serviceWithDefault = new UserMuteService();
      expect(serviceWithDefault).toBeInstanceOf(UserMuteService);
    });

    it("should use provided repository", () => {
      const customRepository = {} as UserMuteRepository;
      const serviceWithCustom = new UserMuteService(customRepository);
      expect(serviceWithCustom).toBeInstanceOf(UserMuteService);
    });
  });
});
