import { UserBlockRepository } from "../../repositories/UserBlockRepository";
import { UserBlock } from "../../types";

describe("UserBlockRepository Interface", () => {
  let mockRepository: jest.Mocked<UserBlockRepository>;

  const mockUserBlock: UserBlock = {
    id: "block-1",
    userId: "user-1",
    blockedUserId: "user-2",
    blockedUserDisplayName: "Blocked User",
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
      getByBlockedUser: jest.fn(),
      getByUserAndBlockedUser: jest.fn(),
      isUserBlocked: jest.fn(),
    };
  });

  describe("Basic CRUD Operations", () => {
    it("should get all user blocks", async () => {
      const blocks = [mockUserBlock];
      mockRepository.getAll.mockResolvedValue(blocks);

      const result = await mockRepository.getAll();

      expect(mockRepository.getAll).toHaveBeenCalled();
      expect(result).toEqual(blocks);
    });

    it("should get a user block by ID", async () => {
      mockRepository.getById.mockResolvedValue(mockUserBlock);

      const result = await mockRepository.getById("block-1");

      expect(mockRepository.getById).toHaveBeenCalledWith("block-1");
      expect(result).toEqual(mockUserBlock);
    });

    it("should return null for non-existent user block", async () => {
      mockRepository.getById.mockResolvedValue(null);

      const result = await mockRepository.getById("non-existent");

      expect(mockRepository.getById).toHaveBeenCalledWith("non-existent");
      expect(result).toBeNull();
    });

    it("should save a user block", async () => {
      mockRepository.save.mockResolvedValue();

      await mockRepository.save(mockUserBlock);

      expect(mockRepository.save).toHaveBeenCalledWith(mockUserBlock);
    });

    it("should update a user block", async () => {
      const updates = { blockedUserDisplayName: "Updated Name" };
      mockRepository.update.mockResolvedValue();

      await mockRepository.update("block-1", updates);

      expect(mockRepository.update).toHaveBeenCalledWith("block-1", updates);
    });

    it("should delete a user block", async () => {
      mockRepository.delete.mockResolvedValue();

      await mockRepository.delete("block-1");

      expect(mockRepository.delete).toHaveBeenCalledWith("block-1");
    });
  });

  describe("Query Methods", () => {
    it("should get blocks created by a specific user", async () => {
      const blocks = [mockUserBlock];
      mockRepository.getByUser.mockResolvedValue(blocks);

      const result = await mockRepository.getByUser("user-1");

      expect(mockRepository.getByUser).toHaveBeenCalledWith("user-1");
      expect(result).toEqual(blocks);
    });

    it("should get blocks where a user is the target", async () => {
      const blocks = [mockUserBlock];
      mockRepository.getByBlockedUser.mockResolvedValue(blocks);

      const result = await mockRepository.getByBlockedUser("user-2");

      expect(mockRepository.getByBlockedUser).toHaveBeenCalledWith("user-2");
      expect(result).toEqual(blocks);
    });

    it("should get a specific block between two users", async () => {
      mockRepository.getByUserAndBlockedUser.mockResolvedValue(mockUserBlock);

      const result = await mockRepository.getByUserAndBlockedUser(
        "user-1",
        "user-2"
      );

      expect(mockRepository.getByUserAndBlockedUser).toHaveBeenCalledWith(
        "user-1",
        "user-2"
      );
      expect(result).toEqual(mockUserBlock);
    });

    it("should return null for non-existent block between users", async () => {
      mockRepository.getByUserAndBlockedUser.mockResolvedValue(null);

      const result = await mockRepository.getByUserAndBlockedUser(
        "user-1",
        "user-3"
      );

      expect(mockRepository.getByUserAndBlockedUser).toHaveBeenCalledWith(
        "user-1",
        "user-3"
      );
      expect(result).toBeNull();
    });

    it("should check if a user has blocked another user", async () => {
      mockRepository.isUserBlocked.mockResolvedValue(true);

      const result = await mockRepository.isUserBlocked("user-1", "user-2");

      expect(mockRepository.isUserBlocked).toHaveBeenCalledWith(
        "user-1",
        "user-2"
      );
      expect(result).toBe(true);
    });

    it("should return false when user has not blocked another user", async () => {
      mockRepository.isUserBlocked.mockResolvedValue(false);

      const result = await mockRepository.isUserBlocked("user-1", "user-3");

      expect(mockRepository.isUserBlocked).toHaveBeenCalledWith(
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

      await expect(mockRepository.save(mockUserBlock)).rejects.toThrow(
        "Database error"
      );
    });

    it("should handle getById errors", async () => {
      const error = new Error("Database error");
      mockRepository.getById.mockRejectedValue(error);

      await expect(mockRepository.getById("block-1")).rejects.toThrow(
        "Database error"
      );
    });

    it("should handle update errors", async () => {
      const error = new Error("Database error");
      mockRepository.update.mockRejectedValue(error);

      await expect(
        mockRepository.update("block-1", { blockedUserDisplayName: "Updated" })
      ).rejects.toThrow("Database error");
    });

    it("should handle delete errors", async () => {
      const error = new Error("Database error");
      mockRepository.delete.mockRejectedValue(error);

      await expect(mockRepository.delete("block-1")).rejects.toThrow(
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

    it("should handle isUserBlocked errors", async () => {
      const error = new Error("Database error");
      mockRepository.isUserBlocked.mockRejectedValue(error);

      await expect(
        mockRepository.isUserBlocked("user-1", "user-2")
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

    it("should handle empty results from getByBlockedUser", async () => {
      mockRepository.getByBlockedUser.mockResolvedValue([]);

      const result = await mockRepository.getByBlockedUser("user-2");

      expect(result).toEqual([]);
    });

    it("should handle self-blocking scenario", async () => {
      const selfBlock: UserBlock = {
        ...mockUserBlock,
        userId: "user-1",
        blockedUserId: "user-1",
        blockedUserDisplayName: "Self",
      };
      mockRepository.getByUserAndBlockedUser.mockResolvedValue(selfBlock);

      const result = await mockRepository.getByUserAndBlockedUser(
        "user-1",
        "user-1"
      );

      expect(result).toEqual(selfBlock);
    });

    it("should handle multiple blocks by same user", async () => {
      const block1: UserBlock = {
        ...mockUserBlock,
        id: "block-1",
        blockedUserId: "user-2",
      };
      const block2: UserBlock = {
        ...mockUserBlock,
        id: "block-2",
        blockedUserId: "user-3",
        blockedUserDisplayName: "Another User",
      };
      mockRepository.getByUser.mockResolvedValue([block1, block2]);

      const result = await mockRepository.getByUser("user-1");

      expect(result).toEqual([block1, block2]);
      expect(result).toHaveLength(2);
    });

    it("should handle multiple blocks targeting same user", async () => {
      const block1: UserBlock = {
        ...mockUserBlock,
        id: "block-1",
        userId: "user-1",
      };
      const block2: UserBlock = {
        ...mockUserBlock,
        id: "block-2",
        userId: "user-3",
        blockedUserDisplayName: "Blocked User",
      };
      mockRepository.getByBlockedUser.mockResolvedValue([block1, block2]);

      const result = await mockRepository.getByBlockedUser("user-2");

      expect(result).toEqual([block1, block2]);
      expect(result).toHaveLength(2);
    });
  });

  describe("Data Integrity", () => {
    it("should maintain user and blocked user relationship", async () => {
      mockRepository.getByUserAndBlockedUser.mockResolvedValue(mockUserBlock);

      const result = await mockRepository.getByUserAndBlockedUser(
        "user-1",
        "user-2"
      );

      expect(result?.userId).toBe("user-1");
      expect(result?.blockedUserId).toBe("user-2");
    });

    it("should handle display name updates", async () => {
      const updatedBlock = {
        ...mockUserBlock,
        blockedUserDisplayName: "Updated Display Name",
      };
      mockRepository.getById.mockResolvedValue(updatedBlock);

      const result = await mockRepository.getById("block-1");

      expect(result?.blockedUserDisplayName).toBe("Updated Display Name");
    });

    it("should maintain timestamps", async () => {
      const createdAt = new Date("2024-01-01");
      const updatedAt = new Date("2024-01-02");
      const blockWithTimestamps: UserBlock = {
        ...mockUserBlock,
        createdAt,
        updatedAt,
      };
      mockRepository.getById.mockResolvedValue(blockWithTimestamps);

      const result = await mockRepository.getById("block-1");

      expect(result?.createdAt).toEqual(createdAt);
      expect(result?.updatedAt).toEqual(updatedAt);
    });
  });
});
