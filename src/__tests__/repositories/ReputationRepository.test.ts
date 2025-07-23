import { ReputationRepository } from "../../repositories/ReputationRepository";
import { UserReputation, UserViolation } from "../../types";

describe("ReputationRepository Interface", () => {
  let mockRepository: jest.Mocked<ReputationRepository>;

  const mockUserReputation: UserReputation = {
    userId: "user-1",
    score: 85,
    level: "trusted",
    totalWhispers: 100,
    approvedWhispers: 95,
    flaggedWhispers: 3,
    rejectedWhispers: 2,
    lastViolation: new Date("2024-01-01"),
    violationHistory: [],
    createdAt: new Date("2023-01-01"),
    updatedAt: new Date("2024-01-01"),
  };

  const mockUserViolation: UserViolation = {
    id: "violation-1",
    userId: "user-1",
    whisperId: "whisper-1",
    violationType: "whisper_deleted",
    reason: "Violation of community guidelines",
    moderatorId: "moderator-1",
    createdAt: new Date("2024-01-01"),
    expiresAt: new Date("2024-02-01"),
  };

  const mockReputationStats = {
    totalUsers: 1000,
    trustedUsers: 200,
    verifiedUsers: 150,
    standardUsers: 600,
    flaggedUsers: 50,
    bannedUsers: 0,
    averageScore: 75.5,
  };

  beforeEach(() => {
    mockRepository = {
      // Basic CRUD operations
      save: jest.fn(),
      getById: jest.fn(),
      getAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),

      // Query methods
      getByLevel: jest.fn(),
      getByScoreRange: jest.fn(),
      getWithRecentViolations: jest.fn(),
      getByViolationCount: jest.fn(),

      // Statistics
      getStats: jest.fn(),

      // Violation methods
      saveViolation: jest.fn(),
      getViolations: jest.fn(),
      getDeletedWhisperCount: jest.fn(),
    };
  });

  describe("Basic CRUD Operations", () => {
    it("should save a user reputation", async () => {
      mockRepository.save.mockResolvedValue();

      await mockRepository.save(mockUserReputation);

      expect(mockRepository.save).toHaveBeenCalledWith(mockUserReputation);
    });

    it("should get a user reputation by ID", async () => {
      mockRepository.getById.mockResolvedValue(mockUserReputation);

      const result = await mockRepository.getById("user-1");

      expect(mockRepository.getById).toHaveBeenCalledWith("user-1");
      expect(result).toEqual(mockUserReputation);
    });

    it("should return null for non-existent user reputation", async () => {
      mockRepository.getById.mockResolvedValue(null);

      const result = await mockRepository.getById("non-existent");

      expect(mockRepository.getById).toHaveBeenCalledWith("non-existent");
      expect(result).toBeNull();
    });

    it("should get all user reputations", async () => {
      const reputations = [mockUserReputation];
      mockRepository.getAll.mockResolvedValue(reputations);

      const result = await mockRepository.getAll();

      expect(mockRepository.getAll).toHaveBeenCalled();
      expect(result).toEqual(reputations);
    });

    it("should update a user reputation", async () => {
      const updates = { score: 90 };
      mockRepository.update.mockResolvedValue();

      await mockRepository.update("user-1", updates);

      expect(mockRepository.update).toHaveBeenCalledWith("user-1", updates);
    });

    it("should delete a user reputation", async () => {
      mockRepository.delete.mockResolvedValue();

      await mockRepository.delete("user-1");

      expect(mockRepository.delete).toHaveBeenCalledWith("user-1");
    });
  });

  describe("Query Methods", () => {
    it("should get user reputations by level", async () => {
      const reputations = [mockUserReputation];
      mockRepository.getByLevel.mockResolvedValue(reputations);

      const result = await mockRepository.getByLevel("trusted");

      expect(mockRepository.getByLevel).toHaveBeenCalledWith("trusted");
      expect(result).toEqual(reputations);
    });

    it("should get user reputations by score range", async () => {
      const reputations = [mockUserReputation];
      mockRepository.getByScoreRange.mockResolvedValue(reputations);

      const result = await mockRepository.getByScoreRange(80, 90);

      expect(mockRepository.getByScoreRange).toHaveBeenCalledWith(80, 90);
      expect(result).toEqual(reputations);
    });

    it("should get users with recent violations", async () => {
      const reputations = [mockUserReputation];
      mockRepository.getWithRecentViolations.mockResolvedValue(reputations);

      const result = await mockRepository.getWithRecentViolations(30, 10);

      expect(mockRepository.getWithRecentViolations).toHaveBeenCalledWith(
        30,
        10
      );
      expect(result).toEqual(reputations);
    });

    it("should get users by violation count", async () => {
      const reputations = [mockUserReputation];
      mockRepository.getByViolationCount.mockResolvedValue(reputations);

      const result = await mockRepository.getByViolationCount(2);

      expect(mockRepository.getByViolationCount).toHaveBeenCalledWith(2);
      expect(result).toEqual(reputations);
    });
  });

  describe("Statistics", () => {
    it("should get reputation stats", async () => {
      mockRepository.getStats.mockResolvedValue(mockReputationStats);

      const result = await mockRepository.getStats();

      expect(mockRepository.getStats).toHaveBeenCalled();
      expect(result).toEqual(mockReputationStats);
    });
  });

  describe("Violation Methods", () => {
    it("should save a user violation", async () => {
      mockRepository.saveViolation.mockResolvedValue();

      await mockRepository.saveViolation(mockUserViolation);

      expect(mockRepository.saveViolation).toHaveBeenCalledWith(
        mockUserViolation
      );
    });

    it("should get user violations", async () => {
      const violations = [mockUserViolation];
      mockRepository.getViolations.mockResolvedValue(violations);

      const result = await mockRepository.getViolations("user-1", 30);

      expect(mockRepository.getViolations).toHaveBeenCalledWith("user-1", 30);
      expect(result).toEqual(violations);
    });

    it("should get deleted whisper count", async () => {
      mockRepository.getDeletedWhisperCount.mockResolvedValue(5);

      const result = await mockRepository.getDeletedWhisperCount("user-1", 30);

      expect(mockRepository.getDeletedWhisperCount).toHaveBeenCalledWith(
        "user-1",
        30
      );
      expect(result).toBe(5);
    });
  });

  describe("Error Handling", () => {
    it("should handle save errors", async () => {
      const error = new Error("Database error");
      mockRepository.save.mockRejectedValue(error);

      await expect(mockRepository.save(mockUserReputation)).rejects.toThrow(
        "Database error"
      );
    });

    it("should handle getById errors", async () => {
      const error = new Error("Database error");
      mockRepository.getById.mockRejectedValue(error);

      await expect(mockRepository.getById("user-1")).rejects.toThrow(
        "Database error"
      );
    });

    it("should handle update errors", async () => {
      const error = new Error("Database error");
      mockRepository.update.mockRejectedValue(error);

      await expect(
        mockRepository.update("user-1", { score: 90 })
      ).rejects.toThrow("Database error");
    });

    it("should handle delete errors", async () => {
      const error = new Error("Database error");
      mockRepository.delete.mockRejectedValue(error);

      await expect(mockRepository.delete("user-1")).rejects.toThrow(
        "Database error"
      );
    });

    it("should handle getStats errors", async () => {
      const error = new Error("Database error");
      mockRepository.getStats.mockRejectedValue(error);

      await expect(mockRepository.getStats()).rejects.toThrow("Database error");
    });

    it("should handle saveViolation errors", async () => {
      const error = new Error("Database error");
      mockRepository.saveViolation.mockRejectedValue(error);

      await expect(
        mockRepository.saveViolation(mockUserViolation)
      ).rejects.toThrow("Database error");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty results from getAll", async () => {
      mockRepository.getAll.mockResolvedValue([]);

      const result = await mockRepository.getAll();

      expect(result).toEqual([]);
    });

    it("should handle empty results from getByLevel", async () => {
      mockRepository.getByLevel.mockResolvedValue([]);

      const result = await mockRepository.getByLevel("trusted");

      expect(result).toEqual([]);
    });

    it("should handle zero deleted whisper count", async () => {
      mockRepository.getDeletedWhisperCount.mockResolvedValue(0);

      const result = await mockRepository.getDeletedWhisperCount("user-1", 30);

      expect(result).toBe(0);
    });

    it("should handle empty violations list", async () => {
      mockRepository.getViolations.mockResolvedValue([]);

      const result = await mockRepository.getViolations("user-1", 30);

      expect(result).toEqual([]);
    });
  });
});
