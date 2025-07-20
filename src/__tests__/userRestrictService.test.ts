import {
  UserRestrictService,
  CreateRestrictionData,
} from "../services/userRestrictService";
import { UserRestrictRepository } from "../repositories/UserRestrictRepository";
import { UserRestriction } from "../types";

describe("UserRestrictService", () => {
  let service: UserRestrictService;
  let mockRepository: jest.Mocked<UserRestrictRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    (UserRestrictService as any).instance = undefined;
    mockRepository = {
      getAll: jest.fn(),
      getById: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getByUser: jest.fn(),
      getByRestrictedUser: jest.fn(),
      getByUserAndRestrictedUser: jest.fn(),
      isUserRestricted: jest.fn(),
    };
    service = new UserRestrictService(mockRepository);
  });

  describe("getInstance", () => {
    it("should return singleton instance", () => {
      const instance1 = UserRestrictService.getInstance();
      const instance2 = UserRestrictService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe("restrictUser", () => {
    const data: CreateRestrictionData = {
      userId: "user1",
      restrictedUserId: "user2",
      restrictedUserDisplayName: "User Two",
      type: "interaction",
    };

    it("should restrict a user if not already restricted", async () => {
      mockRepository.getByUserAndRestrictedUser.mockResolvedValue(null);
      mockRepository.save.mockResolvedValue(undefined);

      const result = await service.restrictUser(data);
      expect(result.userId).toBe(data.userId);
      expect(result.restrictedUserId).toBe(data.restrictedUserId);
      expect(result.type).toBe(data.type);
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it("should throw if user is already restricted", async () => {
      mockRepository.getByUserAndRestrictedUser.mockResolvedValue({
        id: "restrict-1",
      } as UserRestriction);
      await expect(service.restrictUser(data)).rejects.toThrow(
        "already restricted"
      );
    });

    it("should handle errors and throw with message", async () => {
      mockRepository.getByUserAndRestrictedUser.mockResolvedValue(null);
      mockRepository.save.mockRejectedValue(new Error("fail"));
      await expect(service.restrictUser(data)).rejects.toThrow(
        "Failed to restrict: fail"
      );
    });

    it("should work with different restriction types", async () => {
      const visibilityData: CreateRestrictionData = {
        ...data,
        type: "visibility",
      };
      mockRepository.getByUserAndRestrictedUser.mockResolvedValue(null);
      mockRepository.save.mockResolvedValue(undefined);

      const result = await service.restrictUser(visibilityData);
      expect(result.type).toBe("visibility");
    });
  });

  describe("unrestrictUser", () => {
    const userId = "user1";
    const restrictedUserId = "user2";
    it("should unrestrict a user if restriction exists", async () => {
      mockRepository.getByUserAndRestrictedUser.mockResolvedValue({
        id: "restrict-1",
      } as UserRestriction);
      mockRepository.delete.mockResolvedValue(undefined);
      await expect(
        service.unrestrictUser(userId, restrictedUserId)
      ).resolves.toBeUndefined();
      expect(mockRepository.delete).toHaveBeenCalledWith("restrict-1");
    });
    it("should throw if user is not restricted", async () => {
      mockRepository.getByUserAndRestrictedUser.mockResolvedValue(null);
      await expect(
        service.unrestrictUser(userId, restrictedUserId)
      ).rejects.toThrow("not restricted");
    });
    it("should handle errors and throw with message", async () => {
      mockRepository.getByUserAndRestrictedUser.mockRejectedValue(
        new Error("fail")
      );
      await expect(
        service.unrestrictUser(userId, restrictedUserId)
      ).rejects.toThrow("Failed to unrestrict: User is not restricted");
    });
  });

  describe("getRestriction", () => {
    it("should return restriction if found", async () => {
      const restriction: UserRestriction = {
        id: "restrict-1",
        userId: "u1",
        restrictedUserId: "u2",
        restrictedUserDisplayName: "U2",
        type: "interaction",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockRepository.getByUserAndRestrictedUser.mockResolvedValue(restriction);
      await expect(service.getRestriction("u1", "u2")).resolves.toEqual(
        restriction
      );
    });
    it("should return null and log error if error thrown", async () => {
      mockRepository.getByUserAndRestrictedUser.mockRejectedValue(
        new Error("fail")
      );
      await expect(service.getRestriction("u1", "u2")).resolves.toBeNull();
    });
  });

  describe("getRestrictedUsers", () => {
    it("should return restricted users", async () => {
      const restrictions: UserRestriction[] = [
        {
          id: "restrict-1",
          userId: "u1",
          restrictedUserId: "u2",
          restrictedUserDisplayName: "U2",
          type: "interaction",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      mockRepository.getByUser.mockResolvedValue(restrictions);
      await expect(service.getRestrictedUsers("u1")).resolves.toEqual(
        restrictions
      );
    });
    it("should return [] and log error if error thrown", async () => {
      mockRepository.getByUser.mockRejectedValue(new Error("fail"));
      await expect(service.getRestrictedUsers("u1")).resolves.toEqual([]);
    });
  });

  describe("isUserRestricted", () => {
    it("should return true if restriction exists", async () => {
      mockRepository.getByUserAndRestrictedUser.mockResolvedValue({
        id: "restrict-1",
      } as UserRestriction);
      await expect(service.isUserRestricted("u1", "u2")).resolves.toBe(true);
    });
    it("should return false if restriction does not exist", async () => {
      mockRepository.getByUserAndRestrictedUser.mockResolvedValue(null);
      await expect(service.isUserRestricted("u1", "u2")).resolves.toBe(false);
    });
    it("should return false and log error if error thrown", async () => {
      mockRepository.getByUserAndRestrictedUser.mockRejectedValue(
        new Error("fail")
      );
      await expect(service.isUserRestricted("u1", "u2")).resolves.toBe(false);
    });
  });

  describe("getRestrictionStats", () => {
    it("should return correct stats with all types", async () => {
      const restrictions: UserRestriction[] = [
        {
          id: "r1",
          userId: "u1",
          restrictedUserId: "u2",
          restrictedUserDisplayName: "U2",
          type: "interaction",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "r2",
          userId: "u1",
          restrictedUserId: "u3",
          restrictedUserDisplayName: "U3",
          type: "visibility",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "r3",
          userId: "u1",
          restrictedUserId: "u4",
          restrictedUserDisplayName: "U4",
          type: "full",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "r4",
          userId: "u1",
          restrictedUserId: "u5",
          restrictedUserDisplayName: "U5",
          type: "interaction",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      mockRepository.getByUser.mockResolvedValue(restrictions);
      const stats = await service.getRestrictionStats("u1");
      expect(stats.totalRestricted).toBe(4);
      expect(stats.byType).toEqual({
        interaction: 2,
        visibility: 1,
        full: 1,
      });
    });

    it("should return correct stats with empty restrictions", async () => {
      mockRepository.getByUser.mockResolvedValue([]);
      const stats = await service.getRestrictionStats("u1");
      expect(stats.totalRestricted).toBe(0);
      expect(stats.byType).toEqual({
        interaction: 0,
        visibility: 0,
        full: 0,
      });
    });

    it("should return 0s and log error if error thrown", async () => {
      mockRepository.getByUser.mockRejectedValue(new Error("fail"));
      const stats = await service.getRestrictionStats("u1");
      expect(stats).toEqual({
        totalRestricted: 0,
        byType: { interaction: 0, visibility: 0, full: 0 },
      });
    });
  });
});
