import {
  UserRestrictService,
  CreateRestrictionData,
} from "../services/userRestrictService";
import { UserRestrictRepository } from "../repositories/UserRestrictRepository";
import { UserRestriction } from "../types";
import {
  getUserRestrictService,
  resetUserRestrictService,
  destroyUserRestrictService,
} from "../services/userRestrictService";

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

    it("should create new instance when none exists", () => {
      (UserRestrictService as any).instance = undefined;
      const instance = UserRestrictService.getInstance();
      expect(instance).toBeInstanceOf(UserRestrictService);
    });

    it("should return existing instance when one exists", () => {
      const existingInstance = new UserRestrictService();
      (UserRestrictService as any).instance = existingInstance;
      const instance = UserRestrictService.getInstance();
      expect(instance).toBe(existingInstance);
    });

    it("should handle null instance gracefully", () => {
      (UserRestrictService as any).instance = null;
      const instance = UserRestrictService.getInstance();
      expect(instance).toBeInstanceOf(UserRestrictService);
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

    it("should work with full restriction type", async () => {
      const fullData: CreateRestrictionData = {
        ...data,
        type: "full",
      };
      mockRepository.getByUserAndRestrictedUser.mockResolvedValue(null);
      mockRepository.save.mockResolvedValue(undefined);

      const result = await service.restrictUser(fullData);
      expect(result.type).toBe("full");
    });

    it("should handle validation errors for invalid restriction type", async () => {
      const invalidData = {
        ...data,
        type: "invalid" as any,
      };

      await expect(service.restrictUser(invalidData)).rejects.toThrow(
        "Invalid restriction type"
      );
    });

    it("should handle validation errors for empty userId", async () => {
      const invalidData = {
        ...data,
        userId: "",
      };

      await expect(service.restrictUser(invalidData)).rejects.toThrow(
        "Invalid userId provided"
      );
    });

    it("should handle validation errors for empty restrictedUserId", async () => {
      const invalidData = {
        ...data,
        restrictedUserId: "",
      };

      await expect(service.restrictUser(invalidData)).rejects.toThrow(
        "Invalid targetUserId provided"
      );
    });

    it("should handle validation errors for empty display name", async () => {
      const invalidData = {
        ...data,
        restrictedUserDisplayName: "",
      };

      await expect(service.restrictUser(invalidData)).rejects.toThrow(
        "Invalid displayName provided"
      );
    });

    it("should handle self-restriction attempt", async () => {
      const selfRestrictData = {
        ...data,
        restrictedUserId: "user1",
      };

      await expect(service.restrictUser(selfRestrictData)).rejects.toThrow(
        "Cannot perform action on yourself"
      );
    });

    it("should handle repository errors during save", async () => {
      mockRepository.getByUserAndRestrictedUser.mockResolvedValue(null);
      mockRepository.save.mockRejectedValue(new Error("db error"));

      await expect(service.restrictUser(data)).rejects.toThrow(
        "Failed to restrict: db error"
      );
    });

    it("should handle null values in restriction data", async () => {
      const invalidData = {
        userId: null as any,
        restrictedUserId: "user2",
        restrictedUserDisplayName: "User Two",
        type: "interaction" as const,
      };

      await expect(service.restrictUser(invalidData)).rejects.toThrow(
        "Invalid userId provided"
      );
    });

    it("should handle undefined values in restriction data", async () => {
      const invalidData = {
        userId: "user1",
        restrictedUserId: undefined as any,
        restrictedUserDisplayName: "User Two",
        type: "interaction" as const,
      };

      await expect(service.restrictUser(invalidData)).rejects.toThrow(
        "Invalid targetUserId provided"
      );
    });

    it("should handle repository errors during getByUserAndRestrictedUser", async () => {
      mockRepository.getByUserAndRestrictedUser.mockRejectedValue(
        new Error("db error")
      );
      mockRepository.save.mockResolvedValue(undefined);

      const result = await service.restrictUser(data);
      expect(result.userId).toBe(data.userId);
      expect(result.restrictedUserId).toBe(data.restrictedUserId);
      expect(result.type).toBe(data.type);
    });

    it("should handle validation errors for empty values", async () => {
      const invalidData = {
        ...data,
        userId: "",
      };

      await expect(service.restrictUser(invalidData)).rejects.toThrow(
        "Invalid userId provided"
      );
    });

    it("should handle validation errors for empty restrictedUserId", async () => {
      const invalidData = {
        ...data,
        restrictedUserId: "",
      };

      await expect(service.restrictUser(invalidData)).rejects.toThrow(
        "Invalid targetUserId provided"
      );
    });

    it("should handle validation errors for empty display name", async () => {
      const invalidData = {
        ...data,
        restrictedUserDisplayName: "",
      };

      await expect(service.restrictUser(invalidData)).rejects.toThrow(
        "Invalid displayName provided"
      );
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

    it("should handle repository delete errors", async () => {
      mockRepository.getByUserAndRestrictedUser.mockResolvedValue({
        id: "restrict-1",
      } as UserRestriction);
      mockRepository.delete.mockRejectedValue(new Error("delete failed"));

      await expect(
        service.unrestrictUser(userId, restrictedUserId)
      ).rejects.toThrow("Failed to unrestrict: delete failed");
    });

    it("should handle repository getByUserAndRestrictedUser errors", async () => {
      mockRepository.getByUserAndRestrictedUser.mockRejectedValue(
        new Error("db error")
      );

      await expect(
        service.unrestrictUser(userId, restrictedUserId)
      ).rejects.toThrow("Failed to unrestrict: User is not restricted");
    });

    it("should handle empty userId", async () => {
      await expect(
        service.unrestrictUser("", restrictedUserId)
      ).rejects.toThrow("Failed to unrestrict: User is not restricted");
    });

    it("should handle empty restrictedUserId", async () => {
      await expect(service.unrestrictUser(userId, "")).rejects.toThrow(
        "Failed to unrestrict: User is not restricted"
      );
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

    it("should return null for non-existent restriction", async () => {
      mockRepository.getByUserAndRestrictedUser.mockResolvedValue(null);
      await expect(service.getRestriction("u1", "u2")).resolves.toBeNull();
    });

    it("should handle empty userId", async () => {
      mockRepository.getByUserAndRestrictedUser.mockRejectedValue(
        new Error("fail")
      );
      await expect(service.getRestriction("", "u2")).resolves.toBeNull();
    });

    it("should handle empty restrictedUserId", async () => {
      mockRepository.getByUserAndRestrictedUser.mockRejectedValue(
        new Error("fail")
      );
      await expect(service.getRestriction("u1", "")).resolves.toBeNull();
    });

    it("should handle repository errors gracefully", async () => {
      mockRepository.getByUserAndRestrictedUser.mockRejectedValue(
        new Error("db error")
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

    it("should return empty array for user with no restrictions", async () => {
      mockRepository.getByUser.mockResolvedValue([]);
      await expect(service.getRestrictedUsers("u1")).resolves.toEqual([]);
    });

    it("should handle empty userId", async () => {
      mockRepository.getByUser.mockRejectedValue(new Error("fail"));
      await expect(service.getRestrictedUsers("")).resolves.toEqual([]);
    });

    it("should handle repository errors gracefully", async () => {
      mockRepository.getByUser.mockRejectedValue(new Error("db error"));
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

    it("should handle empty userId", async () => {
      mockRepository.getByUserAndRestrictedUser.mockRejectedValue(
        new Error("fail")
      );
      await expect(service.isUserRestricted("", "u2")).resolves.toBe(false);
    });

    it("should handle empty restrictedUserId", async () => {
      mockRepository.getByUserAndRestrictedUser.mockRejectedValue(
        new Error("fail")
      );
      await expect(service.isUserRestricted("u1", "")).resolves.toBe(false);
    });

    it("should handle repository errors gracefully", async () => {
      mockRepository.getByUserAndRestrictedUser.mockRejectedValue(
        new Error("db error")
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

    it("should handle stats with only one restriction type", async () => {
      const restrictions: UserRestriction[] = [
        {
          id: "r1",
          userId: "u1",
          restrictedUserId: "u2",
          restrictedUserDisplayName: "U2",
          type: "full",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      mockRepository.getByUser.mockResolvedValue(restrictions);
      const stats = await service.getRestrictionStats("u1");
      expect(stats.totalRestricted).toBe(1);
      expect(stats.byType).toEqual({
        interaction: 0,
        visibility: 0,
        full: 1,
      });
    });

    it("should handle empty userId", async () => {
      mockRepository.getByUser.mockRejectedValue(new Error("fail"));
      const stats = await service.getRestrictionStats("");
      expect(stats).toEqual({
        totalRestricted: 0,
        byType: { interaction: 0, visibility: 0, full: 0 },
      });
    });

    it("should handle repository errors gracefully", async () => {
      mockRepository.getByUser.mockRejectedValue(new Error("db error"));
      const stats = await service.getRestrictionStats("u1");
      expect(stats).toEqual({
        totalRestricted: 0,
        byType: { interaction: 0, visibility: 0, full: 0 },
      });
    });
  });

  describe("Singleton Pattern", () => {
    it("should maintain singleton instance across calls", () => {
      const instance1 = UserRestrictService.getInstance();
      const instance2 = UserRestrictService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("should create new instance after reset", () => {
      const instance1 = UserRestrictService.getInstance();
      UserRestrictService.resetInstance();
      const instance2 = UserRestrictService.getInstance();
      expect(instance1).not.toBe(instance2);
    });

    it("should create new instance after destroy", () => {
      const instance1 = UserRestrictService.getInstance();
      UserRestrictService.destroyInstance();
      const instance2 = UserRestrictService.getInstance();
      expect(instance1).not.toBe(instance2);
    });

    it("should handle resetInstance when instance is null", () => {
      (UserRestrictService as any).instance = null;
      expect(() => UserRestrictService.resetInstance()).not.toThrow();
    });

    it("should handle destroyInstance when instance is null", () => {
      (UserRestrictService as any).instance = null;
      expect(() => UserRestrictService.destroyInstance()).not.toThrow();
    });
  });

  describe("Factory Functions", () => {
    beforeEach(() => {
      UserRestrictService.resetInstance();
    });

    it("should return singleton instance via getUserRestrictService", () => {
      const instance1 = getUserRestrictService();
      const instance2 = getUserRestrictService();
      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(UserRestrictService);
    });

    it("should reset instance via resetUserRestrictService", () => {
      const instance1 = getUserRestrictService();
      resetUserRestrictService();
      const instance2 = getUserRestrictService();
      expect(instance1).not.toBe(instance2);
    });

    it("should destroy instance via destroyUserRestrictService", () => {
      const instance1 = getUserRestrictService();
      destroyUserRestrictService();
      const instance2 = getUserRestrictService();
      expect(instance1).not.toBe(instance2);
    });

    it("should handle resetUserRestrictService when instance is null", () => {
      (UserRestrictService as any).instance = null;
      expect(() => resetUserRestrictService()).not.toThrow();
    });

    it("should handle destroyUserRestrictService when instance is null", () => {
      (UserRestrictService as any).instance = null;
      expect(() => destroyUserRestrictService()).not.toThrow();
    });
  });

  describe("Repository Integration", () => {
    it("should use default repository when none provided", () => {
      const serviceWithDefault = new UserRestrictService();
      expect(serviceWithDefault).toBeInstanceOf(UserRestrictService);
    });

    it("should use provided repository", () => {
      const customRepository = {} as UserRestrictRepository;
      const serviceWithCustom = new UserRestrictService(customRepository);
      expect(serviceWithCustom).toBeInstanceOf(UserRestrictService);
    });

    it("should handle null repository gracefully", () => {
      const serviceWithNull = new UserRestrictService(null as any);
      expect(serviceWithNull).toBeInstanceOf(UserRestrictService);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle very long userId", async () => {
      const longUserId = "a".repeat(1000);
      mockRepository.getByUserAndRestrictedUser.mockResolvedValue(null);
      mockRepository.save.mockResolvedValue(undefined);

      const data: CreateRestrictionData = {
        userId: longUserId,
        restrictedUserId: "user2",
        restrictedUserDisplayName: "User Two",
        type: "interaction",
      };

      const result = await service.restrictUser(data);
      expect(result.userId).toBe(longUserId);
    });

    it("should handle very long restrictedUserId", async () => {
      const longRestrictedUserId = "b".repeat(1000);
      mockRepository.getByUserAndRestrictedUser.mockResolvedValue(null);
      mockRepository.save.mockResolvedValue(undefined);

      const data: CreateRestrictionData = {
        userId: "user1",
        restrictedUserId: longRestrictedUserId,
        restrictedUserDisplayName: "User Two",
        type: "interaction",
      };

      const result = await service.restrictUser(data);
      expect(result.restrictedUserId).toBe(longRestrictedUserId);
    });

    it("should handle very long display name", async () => {
      const longDisplayName = "c".repeat(1000);
      mockRepository.getByUserAndRestrictedUser.mockResolvedValue(null);
      mockRepository.save.mockResolvedValue(undefined);

      const data: CreateRestrictionData = {
        userId: "user1",
        restrictedUserId: "user2",
        restrictedUserDisplayName: longDisplayName,
        type: "interaction",
      };

      const result = await service.restrictUser(data);
      expect(result.restrictedUserDisplayName).toBe(longDisplayName);
    });

    it("should handle special characters in userId", async () => {
      const specialUserId = "user@#$%^&*()_+-=[]{}|;':\",./<>?";
      mockRepository.getByUserAndRestrictedUser.mockResolvedValue(null);
      mockRepository.save.mockResolvedValue(undefined);

      const data: CreateRestrictionData = {
        userId: specialUserId,
        restrictedUserId: "user2",
        restrictedUserDisplayName: "User Two",
        type: "interaction",
      };

      const result = await service.restrictUser(data);
      expect(result.userId).toBe(specialUserId);
    });

    it("should handle unicode characters in display name", async () => {
      const unicodeDisplayName = "用户👨‍👩‍👧‍👦🎉";
      mockRepository.getByUserAndRestrictedUser.mockResolvedValue(null);
      mockRepository.save.mockResolvedValue(undefined);

      const data: CreateRestrictionData = {
        userId: "user1",
        restrictedUserId: "user2",
        restrictedUserDisplayName: unicodeDisplayName,
        type: "interaction",
      };

      const result = await service.restrictUser(data);
      expect(result.restrictedUserDisplayName).toBe(unicodeDisplayName);
    });
  });
});
