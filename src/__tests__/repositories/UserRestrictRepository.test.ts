import { UserRestrictRepository } from "../../repositories/UserRestrictRepository";
import { UserRestriction } from "../../types";

describe("UserRestrictRepository Interface", () => {
  let mockRepository: jest.Mocked<UserRestrictRepository>;

  const mockUserRestriction: UserRestriction = {
    id: "restriction-1",
    userId: "user-1",
    restrictedUserId: "user-2",
    restrictedUserDisplayName: "Restricted User",
    type: "interaction",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  };

  beforeEach(() => {
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
  });

  describe("Basic CRUD Operations", () => {
    it("should get all user restrictions", async () => {
      const restrictions = [mockUserRestriction];
      mockRepository.getAll.mockResolvedValue(restrictions);

      const result = await mockRepository.getAll();

      expect(mockRepository.getAll).toHaveBeenCalled();
      expect(result).toEqual(restrictions);
    });

    it("should get a user restriction by ID", async () => {
      mockRepository.getById.mockResolvedValue(mockUserRestriction);

      const result = await mockRepository.getById("restriction-1");

      expect(mockRepository.getById).toHaveBeenCalledWith("restriction-1");
      expect(result).toEqual(mockUserRestriction);
    });

    it("should return null for non-existent user restriction", async () => {
      mockRepository.getById.mockResolvedValue(null);

      const result = await mockRepository.getById("non-existent");

      expect(mockRepository.getById).toHaveBeenCalledWith("non-existent");
      expect(result).toBeNull();
    });

    it("should save a user restriction", async () => {
      mockRepository.save.mockResolvedValue();

      await mockRepository.save(mockUserRestriction);

      expect(mockRepository.save).toHaveBeenCalledWith(mockUserRestriction);
    });

    it("should update a user restriction", async () => {
      const updates = { type: "visibility" as const };
      mockRepository.update.mockResolvedValue();

      await mockRepository.update("restriction-1", updates);

      expect(mockRepository.update).toHaveBeenCalledWith(
        "restriction-1",
        updates
      );
    });

    it("should delete a user restriction", async () => {
      mockRepository.delete.mockResolvedValue();

      await mockRepository.delete("restriction-1");

      expect(mockRepository.delete).toHaveBeenCalledWith("restriction-1");
    });
  });

  describe("Query Methods", () => {
    it("should get restrictions created by a specific user", async () => {
      const restrictions = [mockUserRestriction];
      mockRepository.getByUser.mockResolvedValue(restrictions);

      const result = await mockRepository.getByUser("user-1");

      expect(mockRepository.getByUser).toHaveBeenCalledWith("user-1");
      expect(result).toEqual(restrictions);
    });

    it("should get restrictions where a user is the target", async () => {
      const restrictions = [mockUserRestriction];
      mockRepository.getByRestrictedUser.mockResolvedValue(restrictions);

      const result = await mockRepository.getByRestrictedUser("user-2");

      expect(mockRepository.getByRestrictedUser).toHaveBeenCalledWith("user-2");
      expect(result).toEqual(restrictions);
    });

    it("should get a specific restriction between two users", async () => {
      mockRepository.getByUserAndRestrictedUser.mockResolvedValue(
        mockUserRestriction
      );

      const result = await mockRepository.getByUserAndRestrictedUser(
        "user-1",
        "user-2"
      );

      expect(mockRepository.getByUserAndRestrictedUser).toHaveBeenCalledWith(
        "user-1",
        "user-2"
      );
      expect(result).toEqual(mockUserRestriction);
    });

    it("should return null for non-existent restriction between users", async () => {
      mockRepository.getByUserAndRestrictedUser.mockResolvedValue(null);

      const result = await mockRepository.getByUserAndRestrictedUser(
        "user-1",
        "user-3"
      );

      expect(mockRepository.getByUserAndRestrictedUser).toHaveBeenCalledWith(
        "user-1",
        "user-3"
      );
      expect(result).toBeNull();
    });

    it("should check if a user has restricted another user", async () => {
      mockRepository.isUserRestricted.mockResolvedValue(true);

      const result = await mockRepository.isUserRestricted("user-1", "user-2");

      expect(mockRepository.isUserRestricted).toHaveBeenCalledWith(
        "user-1",
        "user-2"
      );
      expect(result).toBe(true);
    });

    it("should return false when user has not restricted another user", async () => {
      mockRepository.isUserRestricted.mockResolvedValue(false);

      const result = await mockRepository.isUserRestricted("user-1", "user-3");

      expect(mockRepository.isUserRestricted).toHaveBeenCalledWith(
        "user-1",
        "user-3"
      );
      expect(result).toBe(false);
    });
  });

  describe("Error Handling", () => {
    it("should handle save errors", async () => {
      const error = new Error("Database error");
      mockRepository.save.mockRejectedValue(error);

      await expect(mockRepository.save(mockUserRestriction)).rejects.toThrow(
        "Database error"
      );
    });

    it("should handle getById errors", async () => {
      const error = new Error("Database error");
      mockRepository.getById.mockRejectedValue(error);

      await expect(mockRepository.getById("restriction-1")).rejects.toThrow(
        "Database error"
      );
    });

    it("should handle update errors", async () => {
      const error = new Error("Database error");
      mockRepository.update.mockRejectedValue(error);

      await expect(
        mockRepository.update("restriction-1", { type: "visibility" })
      ).rejects.toThrow("Database error");
    });

    it("should handle delete errors", async () => {
      const error = new Error("Database error");
      mockRepository.delete.mockRejectedValue(error);

      await expect(mockRepository.delete("restriction-1")).rejects.toThrow(
        "Database error"
      );
    });

    it("should handle getByUser errors", async () => {
      const error = new Error("Database error");
      mockRepository.getByUser.mockRejectedValue(error);

      await expect(mockRepository.getByUser("user-1")).rejects.toThrow(
        "Database error"
      );
    });

    it("should handle isUserRestricted errors", async () => {
      const error = new Error("Database error");
      mockRepository.isUserRestricted.mockRejectedValue(error);

      await expect(
        mockRepository.isUserRestricted("user-1", "user-2")
      ).rejects.toThrow("Database error");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty results from getAll", async () => {
      mockRepository.getAll.mockResolvedValue([]);

      const result = await mockRepository.getAll();

      expect(result).toEqual([]);
    });

    it("should handle empty results from getByUser", async () => {
      mockRepository.getByUser.mockResolvedValue([]);

      const result = await mockRepository.getByUser("user-1");

      expect(result).toEqual([]);
    });

    it("should handle empty results from getByRestrictedUser", async () => {
      mockRepository.getByRestrictedUser.mockResolvedValue([]);

      const result = await mockRepository.getByRestrictedUser("user-2");

      expect(result).toEqual([]);
    });

    it("should handle self-restriction scenario", async () => {
      const selfRestriction: UserRestriction = {
        ...mockUserRestriction,
        userId: "user-1",
        restrictedUserId: "user-1",
        restrictedUserDisplayName: "Self",
      };
      mockRepository.getByUserAndRestrictedUser.mockResolvedValue(
        selfRestriction
      );

      const result = await mockRepository.getByUserAndRestrictedUser(
        "user-1",
        "user-1"
      );

      expect(result).toEqual(selfRestriction);
    });

    it("should handle multiple restrictions by same user", async () => {
      const restriction1: UserRestriction = {
        ...mockUserRestriction,
        id: "restriction-1",
        restrictedUserId: "user-2",
      };
      const restriction2: UserRestriction = {
        ...mockUserRestriction,
        id: "restriction-2",
        restrictedUserId: "user-3",
        restrictedUserDisplayName: "Another User",
      };
      mockRepository.getByUser.mockResolvedValue([restriction1, restriction2]);

      const result = await mockRepository.getByUser("user-1");

      expect(result).toEqual([restriction1, restriction2]);
      expect(result).toHaveLength(2);
    });

    it("should handle multiple restrictions targeting same user", async () => {
      const restriction1: UserRestriction = {
        ...mockUserRestriction,
        id: "restriction-1",
        userId: "user-1",
      };
      const restriction2: UserRestriction = {
        ...mockUserRestriction,
        id: "restriction-2",
        userId: "user-3",
        restrictedUserDisplayName: "Restricted User",
      };
      mockRepository.getByRestrictedUser.mockResolvedValue([
        restriction1,
        restriction2,
      ]);

      const result = await mockRepository.getByRestrictedUser("user-2");

      expect(result).toEqual([restriction1, restriction2]);
      expect(result).toHaveLength(2);
    });
  });

  describe("Restriction Types", () => {
    it("should handle interaction restrictions", async () => {
      const interactionRestriction: UserRestriction = {
        ...mockUserRestriction,
        type: "interaction",
      };
      mockRepository.getById.mockResolvedValue(interactionRestriction);

      const result = await mockRepository.getById("restriction-1");

      expect(result?.type).toBe("interaction");
    });

    it("should handle visibility restrictions", async () => {
      const visibilityRestriction: UserRestriction = {
        ...mockUserRestriction,
        type: "visibility",
      };
      mockRepository.getById.mockResolvedValue(visibilityRestriction);

      const result = await mockRepository.getById("restriction-1");

      expect(result?.type).toBe("visibility");
    });

    it("should handle full restrictions", async () => {
      const fullRestriction: UserRestriction = {
        ...mockUserRestriction,
        type: "full",
      };
      mockRepository.getById.mockResolvedValue(fullRestriction);

      const result = await mockRepository.getById("restriction-1");

      expect(result?.type).toBe("full");
    });

    it("should update restriction type", async () => {
      const updates = { type: "full" as const };
      mockRepository.update.mockResolvedValue();

      await mockRepository.update("restriction-1", updates);

      expect(mockRepository.update).toHaveBeenCalledWith(
        "restriction-1",
        updates
      );
    });
  });

  describe("Data Integrity", () => {
    it("should maintain user and restricted user relationship", async () => {
      mockRepository.getByUserAndRestrictedUser.mockResolvedValue(
        mockUserRestriction
      );

      const result = await mockRepository.getByUserAndRestrictedUser(
        "user-1",
        "user-2"
      );

      expect(result?.userId).toBe("user-1");
      expect(result?.restrictedUserId).toBe("user-2");
    });

    it("should handle display name updates", async () => {
      const updatedRestriction = {
        ...mockUserRestriction,
        restrictedUserDisplayName: "Updated Display Name",
      };
      mockRepository.getById.mockResolvedValue(updatedRestriction);

      const result = await mockRepository.getById("restriction-1");

      expect(result?.restrictedUserDisplayName).toBe("Updated Display Name");
    });

    it("should maintain timestamps", async () => {
      const createdAt = new Date("2024-01-01");
      const updatedAt = new Date("2024-01-02");
      const restrictionWithTimestamps: UserRestriction = {
        ...mockUserRestriction,
        createdAt,
        updatedAt,
      };
      mockRepository.getById.mockResolvedValue(restrictionWithTimestamps);

      const result = await mockRepository.getById("restriction-1");

      expect(result?.createdAt).toEqual(createdAt);
      expect(result?.updatedAt).toEqual(updatedAt);
    });
  });

  describe("Restriction vs Block vs Mute Behavior", () => {
    it("should distinguish between restriction, block, and mute operations", async () => {
      // Restriction is different from block and mute - it's a more granular control
      mockRepository.isUserRestricted.mockResolvedValue(true);

      const isRestricted = await mockRepository.isUserRestricted(
        "user-1",
        "user-2"
      );

      expect(isRestricted).toBe(true);
      expect(mockRepository.isUserRestricted).toHaveBeenCalledWith(
        "user-1",
        "user-2"
      );
    });

    it("should allow different restriction types for same user pair", async () => {
      const interactionRestriction: UserRestriction = {
        ...mockUserRestriction,
        id: "restriction-1",
        type: "interaction",
      };
      mockRepository.getByUserAndRestrictedUser.mockResolvedValue(
        interactionRestriction
      );

      const result = await mockRepository.getByUserAndRestrictedUser(
        "user-1",
        "user-2"
      );

      expect(result?.type).toBe("interaction");
    });
  });
});
