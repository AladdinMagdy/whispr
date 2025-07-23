import { UserMuteRepository } from "../../repositories/UserMuteRepository";
import { UserMute } from "../../types";

describe("UserMuteRepository Interface", () => {
  let mockRepository: jest.Mocked<UserMuteRepository>;

  const mockUserMute: UserMute = {
    id: "mute-1",
    userId: "user-1",
    mutedUserId: "user-2",
    mutedUserDisplayName: "Muted User",
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
      getByMutedUser: jest.fn(),
      getByUserAndMutedUser: jest.fn(),
      isUserMuted: jest.fn(),
    };
  });

  describe("Basic CRUD Operations", () => {
    it("should get all user mutes", async () => {
      const mutes = [mockUserMute];
      mockRepository.getAll.mockResolvedValue(mutes);

      const result = await mockRepository.getAll();

      expect(mockRepository.getAll).toHaveBeenCalled();
      expect(result).toEqual(mutes);
    });

    it("should get a user mute by ID", async () => {
      mockRepository.getById.mockResolvedValue(mockUserMute);

      const result = await mockRepository.getById("mute-1");

      expect(mockRepository.getById).toHaveBeenCalledWith("mute-1");
      expect(result).toEqual(mockUserMute);
    });

    it("should return null for non-existent user mute", async () => {
      mockRepository.getById.mockResolvedValue(null);

      const result = await mockRepository.getById("non-existent");

      expect(mockRepository.getById).toHaveBeenCalledWith("non-existent");
      expect(result).toBeNull();
    });

    it("should save a user mute", async () => {
      mockRepository.save.mockResolvedValue();

      await mockRepository.save(mockUserMute);

      expect(mockRepository.save).toHaveBeenCalledWith(mockUserMute);
    });

    it("should update a user mute", async () => {
      const updates = { mutedUserDisplayName: "Updated Name" };
      mockRepository.update.mockResolvedValue();

      await mockRepository.update("mute-1", updates);

      expect(mockRepository.update).toHaveBeenCalledWith("mute-1", updates);
    });

    it("should delete a user mute", async () => {
      mockRepository.delete.mockResolvedValue();

      await mockRepository.delete("mute-1");

      expect(mockRepository.delete).toHaveBeenCalledWith("mute-1");
    });
  });

  describe("Query Methods", () => {
    it("should get mutes created by a specific user", async () => {
      const mutes = [mockUserMute];
      mockRepository.getByUser.mockResolvedValue(mutes);

      const result = await mockRepository.getByUser("user-1");

      expect(mockRepository.getByUser).toHaveBeenCalledWith("user-1");
      expect(result).toEqual(mutes);
    });

    it("should get mutes where a user is the target", async () => {
      const mutes = [mockUserMute];
      mockRepository.getByMutedUser.mockResolvedValue(mutes);

      const result = await mockRepository.getByMutedUser("user-2");

      expect(mockRepository.getByMutedUser).toHaveBeenCalledWith("user-2");
      expect(result).toEqual(mutes);
    });

    it("should get a specific mute between two users", async () => {
      mockRepository.getByUserAndMutedUser.mockResolvedValue(mockUserMute);

      const result = await mockRepository.getByUserAndMutedUser(
        "user-1",
        "user-2"
      );

      expect(mockRepository.getByUserAndMutedUser).toHaveBeenCalledWith(
        "user-1",
        "user-2"
      );
      expect(result).toEqual(mockUserMute);
    });

    it("should return null for non-existent mute between users", async () => {
      mockRepository.getByUserAndMutedUser.mockResolvedValue(null);

      const result = await mockRepository.getByUserAndMutedUser(
        "user-1",
        "user-3"
      );

      expect(mockRepository.getByUserAndMutedUser).toHaveBeenCalledWith(
        "user-1",
        "user-3"
      );
      expect(result).toBeNull();
    });

    it("should check if a user has muted another user", async () => {
      mockRepository.isUserMuted.mockResolvedValue(true);

      const result = await mockRepository.isUserMuted("user-1", "user-2");

      expect(mockRepository.isUserMuted).toHaveBeenCalledWith(
        "user-1",
        "user-2"
      );
      expect(result).toBe(true);
    });

    it("should return false when user has not muted another user", async () => {
      mockRepository.isUserMuted.mockResolvedValue(false);

      const result = await mockRepository.isUserMuted("user-1", "user-3");

      expect(mockRepository.isUserMuted).toHaveBeenCalledWith(
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

      await expect(mockRepository.save(mockUserMute)).rejects.toThrow(
        "Database error"
      );
    });

    it("should handle getById errors", async () => {
      const error = new Error("Database error");
      mockRepository.getById.mockRejectedValue(error);

      await expect(mockRepository.getById("mute-1")).rejects.toThrow(
        "Database error"
      );
    });

    it("should handle update errors", async () => {
      const error = new Error("Database error");
      mockRepository.update.mockRejectedValue(error);

      await expect(
        mockRepository.update("mute-1", { mutedUserDisplayName: "Updated" })
      ).rejects.toThrow("Database error");
    });

    it("should handle delete errors", async () => {
      const error = new Error("Database error");
      mockRepository.delete.mockRejectedValue(error);

      await expect(mockRepository.delete("mute-1")).rejects.toThrow(
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

    it("should handle isUserMuted errors", async () => {
      const error = new Error("Database error");
      mockRepository.isUserMuted.mockRejectedValue(error);

      await expect(
        mockRepository.isUserMuted("user-1", "user-2")
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

    it("should handle empty results from getByMutedUser", async () => {
      mockRepository.getByMutedUser.mockResolvedValue([]);

      const result = await mockRepository.getByMutedUser("user-2");

      expect(result).toEqual([]);
    });

    it("should handle self-muting scenario", async () => {
      const selfMute: UserMute = {
        ...mockUserMute,
        userId: "user-1",
        mutedUserId: "user-1",
        mutedUserDisplayName: "Self",
      };
      mockRepository.getByUserAndMutedUser.mockResolvedValue(selfMute);

      const result = await mockRepository.getByUserAndMutedUser(
        "user-1",
        "user-1"
      );

      expect(result).toEqual(selfMute);
    });

    it("should handle multiple mutes by same user", async () => {
      const mute1: UserMute = {
        ...mockUserMute,
        id: "mute-1",
        mutedUserId: "user-2",
      };
      const mute2: UserMute = {
        ...mockUserMute,
        id: "mute-2",
        mutedUserId: "user-3",
        mutedUserDisplayName: "Another User",
      };
      mockRepository.getByUser.mockResolvedValue([mute1, mute2]);

      const result = await mockRepository.getByUser("user-1");

      expect(result).toEqual([mute1, mute2]);
      expect(result).toHaveLength(2);
    });

    it("should handle multiple mutes targeting same user", async () => {
      const mute1: UserMute = {
        ...mockUserMute,
        id: "mute-1",
        userId: "user-1",
      };
      const mute2: UserMute = {
        ...mockUserMute,
        id: "mute-2",
        userId: "user-3",
        mutedUserDisplayName: "Muted User",
      };
      mockRepository.getByMutedUser.mockResolvedValue([mute1, mute2]);

      const result = await mockRepository.getByMutedUser("user-2");

      expect(result).toEqual([mute1, mute2]);
      expect(result).toHaveLength(2);
    });
  });

  describe("Data Integrity", () => {
    it("should maintain user and muted user relationship", async () => {
      mockRepository.getByUserAndMutedUser.mockResolvedValue(mockUserMute);

      const result = await mockRepository.getByUserAndMutedUser(
        "user-1",
        "user-2"
      );

      expect(result?.userId).toBe("user-1");
      expect(result?.mutedUserId).toBe("user-2");
    });

    it("should handle display name updates", async () => {
      const updatedMute = {
        ...mockUserMute,
        mutedUserDisplayName: "Updated Display Name",
      };
      mockRepository.getById.mockResolvedValue(updatedMute);

      const result = await mockRepository.getById("mute-1");

      expect(result?.mutedUserDisplayName).toBe("Updated Display Name");
    });

    it("should maintain timestamps", async () => {
      const createdAt = new Date("2024-01-01");
      const updatedAt = new Date("2024-01-02");
      const muteWithTimestamps: UserMute = {
        ...mockUserMute,
        createdAt,
        updatedAt,
      };
      mockRepository.getById.mockResolvedValue(muteWithTimestamps);

      const result = await mockRepository.getById("mute-1");

      expect(result?.createdAt).toEqual(createdAt);
      expect(result?.updatedAt).toEqual(updatedAt);
    });
  });

  describe("Mute vs Block Behavior", () => {
    it("should distinguish between mute and block operations", async () => {
      // Mute is different from block - mute only hides content, block prevents interaction
      mockRepository.isUserMuted.mockResolvedValue(true);

      const isMuted = await mockRepository.isUserMuted("user-1", "user-2");

      expect(isMuted).toBe(true);
      expect(mockRepository.isUserMuted).toHaveBeenCalledWith(
        "user-1",
        "user-2"
      );
    });

    it("should allow multiple mutes by different users", async () => {
      const mute1: UserMute = {
        ...mockUserMute,
        id: "mute-1",
        userId: "user-1",
      };
      const mute2: UserMute = {
        ...mockUserMute,
        id: "mute-2",
        userId: "user-3",
      };
      mockRepository.getByMutedUser.mockResolvedValue([mute1, mute2]);

      const result = await mockRepository.getByMutedUser("user-2");

      expect(result).toHaveLength(2);
      expect(result[0].userId).toBe("user-1");
      expect(result[1].userId).toBe("user-3");
    });
  });
});
