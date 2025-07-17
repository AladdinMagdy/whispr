import {
  UserRestrictService,
  getUserRestrictService,
  CreateRestrictionData,
} from "../services/userRestrictService";
import { getFirestoreService } from "../services/firestoreService";
import { UserRestriction } from "../types";

jest.mock("../services/firestoreService");

const mockFirestoreService = getFirestoreService as jest.MockedFunction<
  typeof getFirestoreService
>;

describe("UserRestrictService", () => {
  let service: UserRestrictService;
  let mockFirestore: any;

  beforeEach(() => {
    jest.clearAllMocks();
    (UserRestrictService as any).instance = undefined;
    mockFirestore = {
      saveUserRestriction: jest.fn(),
      deleteUserRestriction: jest.fn(),
      getUserRestriction: jest.fn(),
      getUserRestrictions: jest.fn(),
    };
    mockFirestoreService.mockReturnValue(mockFirestore);
    service = getUserRestrictService();
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
      mockFirestore.getUserRestriction.mockResolvedValue(null);
      mockFirestore.saveUserRestriction.mockResolvedValue(undefined);

      const result = await service.restrictUser(data);
      expect(result.userId).toBe(data.userId);
      expect(result.restrictedUserId).toBe(data.restrictedUserId);
      expect(result.type).toBe(data.type);
      expect(mockFirestore.saveUserRestriction).toHaveBeenCalled();
    });

    it("should throw if user is already restricted", async () => {
      mockFirestore.getUserRestriction.mockResolvedValue({ id: "restrict-1" });
      await expect(service.restrictUser(data)).rejects.toThrow(
        "already restricted"
      );
    });

    it("should handle errors and throw with message", async () => {
      mockFirestore.getUserRestriction.mockResolvedValue(null);
      mockFirestore.saveUserRestriction.mockRejectedValue(new Error("fail"));
      await expect(service.restrictUser(data)).rejects.toThrow(
        "Failed to restrict user"
      );
    });

    it("should work with different restriction types", async () => {
      const visibilityData: CreateRestrictionData = {
        ...data,
        type: "visibility",
      };
      mockFirestore.getUserRestriction.mockResolvedValue(null);
      mockFirestore.saveUserRestriction.mockResolvedValue(undefined);

      const result = await service.restrictUser(visibilityData);
      expect(result.type).toBe("visibility");
    });
  });

  describe("unrestrictUser", () => {
    const userId = "user1";
    const restrictedUserId = "user2";
    it("should unrestrict a user if restriction exists", async () => {
      mockFirestore.getUserRestriction.mockResolvedValue({ id: "restrict-1" });
      mockFirestore.deleteUserRestriction.mockResolvedValue(undefined);
      await expect(
        service.unrestrictUser(userId, restrictedUserId)
      ).resolves.toBeUndefined();
      expect(mockFirestore.deleteUserRestriction).toHaveBeenCalledWith(
        "restrict-1"
      );
    });
    it("should throw if user is not restricted", async () => {
      mockFirestore.getUserRestriction.mockResolvedValue(null);
      await expect(
        service.unrestrictUser(userId, restrictedUserId)
      ).rejects.toThrow("not restricted");
    });
    it("should handle errors and throw with message", async () => {
      mockFirestore.getUserRestriction.mockRejectedValue(new Error("fail"));
      await expect(
        service.unrestrictUser(userId, restrictedUserId)
      ).rejects.toThrow("Failed to unrestrict user");
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
      mockFirestore.getUserRestriction.mockResolvedValue(restriction);
      await expect(service.getRestriction("u1", "u2")).resolves.toEqual(
        restriction
      );
    });
    it("should return null and log error if error thrown", async () => {
      mockFirestore.getUserRestriction.mockRejectedValue(new Error("fail"));
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
      mockFirestore.getUserRestrictions.mockResolvedValue(restrictions);
      await expect(service.getRestrictedUsers("u1")).resolves.toEqual(
        restrictions
      );
    });
    it("should return [] and log error if error thrown", async () => {
      mockFirestore.getUserRestrictions.mockRejectedValue(new Error("fail"));
      await expect(service.getRestrictedUsers("u1")).resolves.toEqual([]);
    });
  });

  describe("isUserRestricted", () => {
    it("should return true if restriction exists", async () => {
      mockFirestore.getUserRestriction.mockResolvedValue({ id: "restrict-1" });
      await expect(service.isUserRestricted("u1", "u2")).resolves.toBe(true);
    });
    it("should return false if restriction does not exist", async () => {
      mockFirestore.getUserRestriction.mockResolvedValue(null);
      await expect(service.isUserRestricted("u1", "u2")).resolves.toBe(false);
    });
    it("should return false and log error if error thrown", async () => {
      mockFirestore.getUserRestriction.mockRejectedValue(new Error("fail"));
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
      mockFirestore.getUserRestrictions.mockResolvedValue(restrictions);
      const stats = await service.getRestrictionStats("u1");
      expect(stats.totalRestricted).toBe(4);
      expect(stats.byType).toEqual({
        interaction: 2,
        visibility: 1,
        full: 1,
      });
    });

    it("should return correct stats with empty restrictions", async () => {
      mockFirestore.getUserRestrictions.mockResolvedValue([]);
      const stats = await service.getRestrictionStats("u1");
      expect(stats.totalRestricted).toBe(0);
      expect(stats.byType).toEqual({
        interaction: 0,
        visibility: 0,
        full: 0,
      });
    });

    it("should return 0s and log error if error thrown", async () => {
      mockFirestore.getUserRestrictions.mockRejectedValue(new Error("fail"));
      const stats = await service.getRestrictionStats("u1");
      expect(stats).toEqual({
        totalRestricted: 0,
        byType: { interaction: 0, visibility: 0, full: 0 },
      });
    });
  });
});
