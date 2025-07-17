import {
  UserMuteService,
  getUserMuteService,
  CreateMuteData,
} from "../services/userMuteService";
import { getFirestoreService } from "../services/firestoreService";
import { getBlockListCacheService } from "../services/blockListCacheService";
import { UserMute } from "../services/userMuteService";

jest.mock("../services/firestoreService");
jest.mock("../services/blockListCacheService");

const mockFirestoreService = getFirestoreService as jest.MockedFunction<
  typeof getFirestoreService
>;
const mockBlockListCacheService =
  getBlockListCacheService as jest.MockedFunction<
    typeof getBlockListCacheService
  >;

describe("UserMuteService", () => {
  let service: UserMuteService;
  let mockFirestore: any;
  let mockBlockListCache: any;

  beforeEach(() => {
    jest.clearAllMocks();
    (UserMuteService as any).instance = undefined;
    mockFirestore = {
      saveUserMute: jest.fn(),
      deleteUserMute: jest.fn(),
      getUserMute: jest.fn(),
      getUserMutes: jest.fn(),
    };
    mockBlockListCache = {
      invalidateCache: jest.fn(),
    };
    mockFirestoreService.mockReturnValue(mockFirestore);
    mockBlockListCacheService.mockReturnValue(mockBlockListCache);
    service = getUserMuteService();
  });

  describe("getInstance", () => {
    it("should return singleton instance", () => {
      const instance1 = UserMuteService.getInstance();
      const instance2 = UserMuteService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe("muteUser", () => {
    const data: CreateMuteData = {
      userId: "user1",
      mutedUserId: "user2",
      mutedUserDisplayName: "User Two",
    };

    it("should mute a user if not already muted", async () => {
      mockFirestore.getUserMute.mockResolvedValue(null);
      mockFirestore.saveUserMute.mockResolvedValue(undefined);
      mockBlockListCache.invalidateCache.mockResolvedValue(undefined);

      const result = await service.muteUser(data);
      expect(result.userId).toBe(data.userId);
      expect(result.mutedUserId).toBe(data.mutedUserId);
      expect(mockFirestore.saveUserMute).toHaveBeenCalled();
      expect(mockBlockListCache.invalidateCache).toHaveBeenCalledWith(
        data.userId
      );
    });

    it("should throw if user is already muted", async () => {
      mockFirestore.getUserMute.mockResolvedValue({ id: "mute-1" });
      await expect(service.muteUser(data)).rejects.toThrow("already muted");
    });

    it("should handle errors and throw with message", async () => {
      mockFirestore.getUserMute.mockResolvedValue(null);
      mockFirestore.saveUserMute.mockRejectedValue(new Error("fail"));
      await expect(service.muteUser(data)).rejects.toThrow(
        "Failed to mute user"
      );
    });
  });

  describe("unmuteUser", () => {
    const userId = "user1";
    const mutedUserId = "user2";
    it("should unmute a user if mute exists", async () => {
      mockFirestore.getUserMute.mockResolvedValue({ id: "mute-1" });
      mockFirestore.deleteUserMute.mockResolvedValue(undefined);
      mockBlockListCache.invalidateCache.mockResolvedValue(undefined);
      await expect(
        service.unmuteUser(userId, mutedUserId)
      ).resolves.toBeUndefined();
      expect(mockFirestore.deleteUserMute).toHaveBeenCalledWith("mute-1");
      expect(mockBlockListCache.invalidateCache).toHaveBeenCalledWith(userId);
    });
    it("should throw if user is not muted", async () => {
      mockFirestore.getUserMute.mockResolvedValue(null);
      await expect(service.unmuteUser(userId, mutedUserId)).rejects.toThrow(
        "not muted"
      );
    });
    it("should handle errors and throw with message", async () => {
      mockFirestore.getUserMute.mockRejectedValue(new Error("fail"));
      await expect(service.unmuteUser(userId, mutedUserId)).rejects.toThrow(
        "Failed to unmute user"
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
      mockFirestore.getUserMute.mockResolvedValue(mute);
      await expect(service.getMute("u1", "u2")).resolves.toEqual(mute);
    });
    it("should return null and log error if error thrown", async () => {
      mockFirestore.getUserMute.mockRejectedValue(new Error("fail"));
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
      mockFirestore.getUserMutes.mockResolvedValue(mutes);
      await expect(service.getMutedUsers("u1")).resolves.toEqual(mutes);
    });
    it("should return [] and log error if error thrown", async () => {
      mockFirestore.getUserMutes.mockRejectedValue(new Error("fail"));
      await expect(service.getMutedUsers("u1")).resolves.toEqual([]);
    });
  });

  describe("isUserMuted", () => {
    it("should return true if mute exists", async () => {
      mockFirestore.getUserMute.mockResolvedValue({ id: "mute-1" });
      await expect(service.isUserMuted("u1", "u2")).resolves.toBe(true);
    });
    it("should return false if mute does not exist", async () => {
      mockFirestore.getUserMute.mockResolvedValue(null);
      await expect(service.isUserMuted("u1", "u2")).resolves.toBe(false);
    });
    it("should return false and log error if error thrown", async () => {
      mockFirestore.getUserMute.mockRejectedValue(new Error("fail"));
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
      mockFirestore.getUserMutes.mockResolvedValue(mutes);
      const stats = await service.getMuteStats("u1");
      expect(stats.totalMuted).toBe(3);
      expect(stats.recentlyMuted).toBe(2);
    });
    it("should return 0s and log error if error thrown", async () => {
      mockFirestore.getUserMutes.mockRejectedValue(new Error("fail"));
      const stats = await service.getMuteStats("u1");
      expect(stats).toEqual({ totalMuted: 0, recentlyMuted: 0 });
    });
  });
});
