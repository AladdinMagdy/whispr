import { ReputationService } from "../services/reputationService";
import { ReputationRepository } from "../repositories/ReputationRepository";
import {
  UserReputation,
  ViolationType,
  ModerationResult,
  ModerationStatus,
  ContentRank,
  UserViolation,
} from "../types";

// Mock all dependencies before importing the service
jest.mock("../services/privacyService", () => ({
  getPrivacyService: jest.fn(),
}));

jest.mock("../utils/reputationUtils", () => ({
  getReputationLevel: jest.fn(),
  calculateReputationImpact: jest.fn(),
  calculateViolationImpact: jest.fn(),
  isAppealable: jest.fn(),
  getAppealTimeLimit: jest.fn(),
  getPenaltyMultiplier: jest.fn(),
  getAutoAppealThreshold: jest.fn(),
  getRecoveryRate: jest.fn(),
  getDaysSinceLastViolation: jest.fn(),
  getDefaultReputation: jest.fn(),
  calculateNewScoreAfterViolation: jest.fn(),
  calculateNewScoreAfterRecovery: jest.fn(),
  calculateRecoveryPoints: jest.fn(),
}));

describe("ReputationService", () => {
  let reputationService: ReputationService;
  let mockRepository: jest.Mocked<ReputationRepository>;
  let mockPrivacyService: any;

  // Mock utility functions
  const {
    getReputationLevel,
    calculateReputationImpact,
    calculateViolationImpact,
    isAppealable,
    getAppealTimeLimit,
    getPenaltyMultiplier,
    getAutoAppealThreshold,
    getRecoveryRate,
    getDaysSinceLastViolation,
    getDefaultReputation,
    calculateNewScoreAfterViolation,
    calculateNewScoreAfterRecovery,
    calculateRecoveryPoints,
  } = jest.requireMock("../utils/reputationUtils");

  const { getPrivacyService } = jest.requireMock("../services/privacyService");

  const mockUserReputation: UserReputation = {
    userId: "user123",
    score: 85,
    level: "verified",
    totalWhispers: 50,
    approvedWhispers: 45,
    flaggedWhispers: 3,
    rejectedWhispers: 2,
    lastViolation: new Date("2024-01-01"),
    violationHistory: [],
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  };

  const mockDefaultReputation: UserReputation = {
    userId: "newuser",
    score: 100,
    level: "trusted",
    totalWhispers: 0,
    approvedWhispers: 0,
    flaggedWhispers: 0,
    rejectedWhispers: 0,
    violationHistory: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockModerationResult: ModerationResult = {
    status: ModerationStatus.APPROVED,
    contentRank: ContentRank.G,
    isMinorSafe: true,
    violations: [],
    confidence: 0.9,
    moderationTime: 100,
    apiResults: {},
    reputationImpact: 0,
    appealable: false,
  };

  const mockUserViolation: UserViolation = {
    id: "violation123",
    userId: "user123",
    whisperId: "whisper123",
    violationType: "whisper_deleted",
    reason: "Test violation",
    createdAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock repository
    mockRepository = {
      save: jest.fn(),
      getById: jest.fn(),
      getAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getByLevel: jest.fn(),
      getByScoreRange: jest.fn(),
      getWithRecentViolations: jest.fn(),
      getByViolationCount: jest.fn(),
      getStats: jest.fn(),
      saveViolation: jest.fn(),
      getViolations: jest.fn(),
      getDeletedWhisperCount: jest.fn(),
    };

    // Setup mock privacy service
    mockPrivacyService = {
      // Add any privacy service methods that might be called
    };
    getPrivacyService.mockReturnValue(mockPrivacyService);

    // Setup default mock implementations
    getDefaultReputation.mockReturnValue(mockDefaultReputation);
    getReputationLevel.mockReturnValue("verified");
    calculateReputationImpact.mockReturnValue(5);
    calculateViolationImpact.mockReturnValue(10);
    isAppealable.mockReturnValue(true);
    getAppealTimeLimit.mockReturnValue(14);
    getPenaltyMultiplier.mockReturnValue(1.0);
    getAutoAppealThreshold.mockReturnValue(0.5);
    getRecoveryRate.mockReturnValue(1.5);
    getDaysSinceLastViolation.mockReturnValue(30);
    calculateNewScoreAfterViolation.mockReturnValue(75);
    calculateNewScoreAfterRecovery.mockReturnValue(80);
    calculateRecoveryPoints.mockReturnValue(5);

    // Create service instance with mock repository
    reputationService = new ReputationService(mockRepository);
  });

  afterEach(() => {
    ReputationService.resetInstance();
  });

  describe("Singleton Pattern", () => {
    it("should return the same instance when getInstance is called multiple times", () => {
      const instance1 = ReputationService.getInstance();
      const instance2 = ReputationService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("should reset instance when resetInstance is called", () => {
      const instance1 = ReputationService.getInstance();
      ReputationService.resetInstance();
      const instance2 = ReputationService.getInstance();
      expect(instance1).not.toBe(instance2);
    });

    it("should destroy instance when destroyInstance is called", () => {
      const instance1 = ReputationService.getInstance();
      ReputationService.destroyInstance();
      const instance2 = ReputationService.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe("Factory Functions", () => {
    it("should return service instance via getReputationService", () => {
      const service = ReputationService.getInstance();
      expect(service).toBeInstanceOf(ReputationService);
    });

    it("should reset service via resetReputationService", () => {
      const instance1 = ReputationService.getInstance();
      ReputationService.resetInstance();
      const instance2 = ReputationService.getInstance();
      expect(instance1).not.toBe(instance2);
    });

    it("should destroy service via destroyReputationService", () => {
      const instance1 = ReputationService.getInstance();
      ReputationService.destroyInstance();
      const instance2 = ReputationService.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe("saveUserReputation", () => {
    it("should save user reputation successfully", async () => {
      mockRepository.save.mockResolvedValue();

      await reputationService.saveUserReputation(mockUserReputation);

      expect(mockRepository.save).toHaveBeenCalledWith(mockUserReputation);
    });

    it("should handle repository save errors", async () => {
      mockRepository.save.mockRejectedValue(new Error("Database error"));

      await expect(
        reputationService.saveUserReputation(mockUserReputation)
      ).rejects.toThrow("Failed to save user reputation");
    });
  });

  describe("updateUserReputation", () => {
    it("should update user reputation successfully", async () => {
      const updates = { score: 90, level: "trusted" as const };
      mockRepository.update.mockResolvedValue();

      await reputationService.updateUserReputation("user123", updates);

      expect(mockRepository.update).toHaveBeenCalledWith("user123", updates);
    });

    it("should handle repository update errors", async () => {
      mockRepository.update.mockRejectedValue(new Error("Database error"));

      await expect(
        reputationService.updateUserReputation("user123", { score: 90 })
      ).rejects.toThrow("Failed to update user reputation");
    });
  });

  describe("deleteUserReputation", () => {
    it("should delete user reputation successfully", async () => {
      mockRepository.delete.mockResolvedValue();

      await reputationService.deleteUserReputation("user123");

      expect(mockRepository.delete).toHaveBeenCalledWith("user123");
    });

    it("should handle repository delete errors", async () => {
      mockRepository.delete.mockRejectedValue(new Error("Database error"));

      await expect(
        reputationService.deleteUserReputation("user123")
      ).rejects.toThrow("Failed to delete user reputation");
    });
  });

  describe("getUsersByReputationLevel", () => {
    it("should get users by reputation level successfully", async () => {
      const mockUsers = [mockUserReputation];
      mockRepository.getByLevel.mockResolvedValue(mockUsers);

      const result = await reputationService.getUsersByReputationLevel(
        "verified"
      );

      expect(mockRepository.getByLevel).toHaveBeenCalledWith("verified");
      expect(result).toEqual(mockUsers);
    });

    it("should handle repository getByLevel errors", async () => {
      mockRepository.getByLevel.mockRejectedValue(new Error("Database error"));

      await expect(
        reputationService.getUsersByReputationLevel("verified")
      ).rejects.toThrow("Failed to get users by reputation level");
    });
  });

  describe("getUsersWithRecentViolations", () => {
    it("should get users with recent violations successfully", async () => {
      const mockUsers = [mockUserReputation];
      mockRepository.getWithRecentViolations.mockResolvedValue(mockUsers);

      const result = await reputationService.getUsersWithRecentViolations(
        7,
        50
      );

      expect(mockRepository.getWithRecentViolations).toHaveBeenCalledWith(
        7,
        50
      );
      expect(result).toEqual(mockUsers);
    });

    it("should handle repository getWithRecentViolations errors", async () => {
      mockRepository.getWithRecentViolations.mockRejectedValue(
        new Error("Database error")
      );

      await expect(
        reputationService.getUsersWithRecentViolations(7, 50)
      ).rejects.toThrow("Failed to get users with recent violations");
    });
  });

  describe("resetUserReputation", () => {
    it("should reset user reputation successfully", async () => {
      mockRepository.save.mockResolvedValue();

      await reputationService.resetUserReputation("user123");

      expect(getDefaultReputation).toHaveBeenCalledWith("user123");
      expect(mockRepository.save).toHaveBeenCalledWith(mockDefaultReputation);
    });

    it("should handle repository save errors during reset", async () => {
      mockRepository.save.mockRejectedValue(new Error("Database error"));

      await expect(
        reputationService.resetUserReputation("user123")
      ).rejects.toThrow("Failed to reset user reputation");
    });
  });

  describe("adjustUserReputationScore", () => {
    it("should adjust user reputation score successfully", async () => {
      mockRepository.getById.mockResolvedValue(mockUserReputation);
      mockRepository.save.mockResolvedValue();

      await reputationService.adjustUserReputationScore(
        "user123",
        90,
        "Manual adjustment"
      );

      expect(mockRepository.getById).toHaveBeenCalledWith("user123");
      expect(getReputationLevel).toHaveBeenCalledWith(90);
      expect(mockRepository.save).toHaveBeenCalledWith({
        ...mockUserReputation,
        score: 90,
        level: "verified",
        updatedAt: expect.any(Date),
      });
    });

    it("should handle repository save errors", async () => {
      mockRepository.getById.mockResolvedValue(mockUserReputation);
      mockRepository.save.mockRejectedValue(new Error("Database error"));

      await expect(
        reputationService.adjustUserReputationScore("user123", 90)
      ).rejects.toThrow("Failed to adjust user reputation score");
    });

    it("should handle repository save errors", async () => {
      mockRepository.getById.mockResolvedValue(mockUserReputation);
      mockRepository.save.mockRejectedValue(new Error("Database error"));

      await expect(
        reputationService.adjustUserReputationScore("user123", 90)
      ).rejects.toThrow("Failed to adjust user reputation score");
    });
  });

  describe("saveUserViolation", () => {
    it("should save user violation successfully", async () => {
      mockRepository.saveViolation.mockResolvedValue();

      await reputationService.saveUserViolation(mockUserViolation);

      expect(mockRepository.saveViolation).toHaveBeenCalledWith(
        mockUserViolation
      );
    });

    it("should handle repository saveViolation errors", async () => {
      mockRepository.saveViolation.mockRejectedValue(
        new Error("Database error")
      );

      await expect(
        reputationService.saveUserViolation(mockUserViolation)
      ).rejects.toThrow("Failed to save user violation");
    });
  });

  describe("getUserViolations", () => {
    it("should get user violations successfully", async () => {
      const mockViolations = [mockUserViolation];
      mockRepository.getViolations.mockResolvedValue(mockViolations);

      const result = await reputationService.getUserViolations("user123", 90);

      expect(mockRepository.getViolations).toHaveBeenCalledWith("user123", 90);
      expect(result).toEqual(mockViolations);
    });

    it("should handle repository getViolations errors", async () => {
      mockRepository.getViolations.mockRejectedValue(
        new Error("Database error")
      );

      await expect(
        reputationService.getUserViolations("user123", 90)
      ).rejects.toThrow("Failed to get user violations");
    });
  });

  describe("getDeletedWhisperCount", () => {
    it("should get deleted whisper count successfully", async () => {
      mockRepository.getDeletedWhisperCount.mockResolvedValue(5);

      const result = await reputationService.getDeletedWhisperCount(
        "user123",
        90
      );

      expect(mockRepository.getDeletedWhisperCount).toHaveBeenCalledWith(
        "user123",
        90
      );
      expect(result).toBe(5);
    });

    it("should handle repository getDeletedWhisperCount errors", async () => {
      mockRepository.getDeletedWhisperCount.mockRejectedValue(
        new Error("Database error")
      );

      await expect(
        reputationService.getDeletedWhisperCount("user123", 90)
      ).rejects.toThrow("Failed to get deleted whisper count");
    });
  });

  describe("getUserReputation", () => {
    it("should return existing user reputation", async () => {
      mockRepository.getById.mockResolvedValue(mockUserReputation);

      const result = await reputationService.getUserReputation("user123");

      expect(mockRepository.getById).toHaveBeenCalledWith("user123");
      expect(result).toEqual(mockUserReputation);
    });

    it("should create and return default reputation for new user", async () => {
      mockRepository.getById.mockResolvedValue(null);
      mockRepository.save.mockResolvedValue();

      const result = await reputationService.getUserReputation("newuser");

      expect(mockRepository.getById).toHaveBeenCalledWith("newuser");
      expect(getDefaultReputation).toHaveBeenCalledWith("newuser");
      expect(mockRepository.save).toHaveBeenCalledWith(mockDefaultReputation);
      expect(result).toEqual(mockDefaultReputation);
    });

    it("should return default reputation on error", async () => {
      mockRepository.getById.mockRejectedValue(new Error("Database error"));

      const result = await reputationService.getUserReputation("user123");

      expect(result).toEqual(mockDefaultReputation);
    });
  });

  describe("applyReputationBasedActions", () => {
    it("should apply reputation-based actions successfully", async () => {
      mockRepository.getById.mockResolvedValue(mockUserReputation);

      const result = await reputationService.applyReputationBasedActions(
        mockModerationResult,
        "user123"
      );

      expect(mockRepository.getById).toHaveBeenCalledWith("user123");
      expect(getReputationLevel).toHaveBeenCalledWith(mockUserReputation.score);
      expect(calculateReputationImpact).toHaveBeenCalledWith(
        mockModerationResult,
        "verified"
      );
      expect(isAppealable).toHaveBeenCalledWith(
        mockModerationResult,
        "verified"
      );
      expect(getAppealTimeLimit).toHaveBeenCalledWith("verified");
      expect(getPenaltyMultiplier).toHaveBeenCalledWith("verified");
      expect(getAutoAppealThreshold).toHaveBeenCalledWith("verified");

      expect(result).toEqual({
        ...mockModerationResult,
        reputationImpact: 5,
        appealable: true,
        appealTimeLimit: 14,
        penaltyMultiplier: 1.0,
        autoAppealThreshold: 0.5,
      });
    });

    it("should return original result on error", async () => {
      // Mock getUserReputation to throw an error
      jest
        .spyOn(reputationService, "getUserReputation")
        .mockRejectedValue(new Error("Database error"));

      const result = await reputationService.applyReputationBasedActions(
        mockModerationResult,
        "user123"
      );

      expect(result).toEqual(mockModerationResult);
    });
  });

  describe("recordViolation", () => {
    it("should record violation successfully", async () => {
      mockRepository.getById.mockResolvedValue(mockUserReputation);
      mockRepository.save.mockResolvedValue();

      await reputationService.recordViolation(
        "user123",
        "whisper123",
        ViolationType.HARASSMENT,
        "medium"
      );

      expect(mockRepository.getById).toHaveBeenCalledWith("user123");
      expect(calculateViolationImpact).toHaveBeenCalledWith(
        ViolationType.HARASSMENT,
        "medium"
      );
      expect(calculateNewScoreAfterViolation).toHaveBeenCalledWith(
        mockUserReputation.score,
        10
      );
      expect(getReputationLevel).toHaveBeenCalledWith(75);
      expect(mockRepository.save).toHaveBeenCalledWith({
        ...mockUserReputation,
        score: 75,
        level: "verified",
        flaggedWhispers: mockUserReputation.flaggedWhispers + 1,
        lastViolation: expect.any(Date),
        violationHistory: expect.arrayContaining([
          expect.objectContaining({
            whisperId: "whisper123",
            violationType: ViolationType.HARASSMENT,
            severity: "medium",
            resolved: false,
          }),
        ]),
        updatedAt: expect.any(Date),
      });
    });

    it("should handle errors gracefully", async () => {
      mockRepository.getById.mockRejectedValue(new Error("Database error"));

      // Should not throw error
      await expect(
        reputationService.recordViolation(
          "user123",
          "whisper123",
          ViolationType.HARASSMENT,
          "medium"
        )
      ).resolves.toBeUndefined();
    });
  });

  describe("recordSuccessfulWhisper", () => {
    it("should record successful whisper successfully", async () => {
      mockRepository.getById.mockResolvedValue(mockUserReputation);
      mockRepository.save.mockResolvedValue();

      await reputationService.recordSuccessfulWhisper("user123");

      expect(mockRepository.getById).toHaveBeenCalledWith("user123");
      expect(getRecoveryRate).toHaveBeenCalledWith(mockUserReputation.score);
      expect(getReputationLevel).toHaveBeenCalledWith(86.5); // 85 + 1.5
      expect(mockRepository.save).toHaveBeenCalledWith({
        ...mockUserReputation,
        score: 86.5,
        level: "verified",
        approvedWhispers: mockUserReputation.approvedWhispers + 1,
        totalWhispers: mockUserReputation.totalWhispers + 1,
        updatedAt: expect.any(Date),
      });
    });

    it("should cap score at 100", async () => {
      const highScoreReputation = { ...mockUserReputation, score: 99 };
      mockRepository.getById.mockResolvedValue(highScoreReputation);
      mockRepository.save.mockResolvedValue();
      getRecoveryRate.mockReturnValue(5);

      await reputationService.recordSuccessfulWhisper("user123");

      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          score: 100, // Capped at 100
        })
      );
    });

    it("should handle errors gracefully", async () => {
      mockRepository.getById.mockRejectedValue(new Error("Database error"));

      await expect(
        reputationService.recordSuccessfulWhisper("user123")
      ).resolves.toBeUndefined();
    });
  });

  describe("processReputationRecovery", () => {
    it("should process reputation recovery when enough time has passed", async () => {
      mockRepository.getById.mockResolvedValue(mockUserReputation);
      mockRepository.save.mockResolvedValue();
      getDaysSinceLastViolation.mockReturnValue(35); // More than 30 days

      await reputationService.processReputationRecovery("user123");

      expect(mockRepository.getById).toHaveBeenCalledWith("user123");
      expect(getDaysSinceLastViolation).toHaveBeenCalledWith(
        mockUserReputation
      );
      expect(calculateRecoveryPoints).toHaveBeenCalledWith(
        mockUserReputation,
        35
      );
      expect(calculateNewScoreAfterRecovery).toHaveBeenCalledWith(
        mockUserReputation.score,
        5
      );
      expect(getReputationLevel).toHaveBeenCalledWith(80);
      expect(mockRepository.save).toHaveBeenCalledWith({
        ...mockUserReputation,
        score: 80,
        level: "verified",
        updatedAt: expect.any(Date),
      });
    });

    it("should not process recovery when not enough time has passed", async () => {
      mockRepository.getById.mockResolvedValue(mockUserReputation);
      getDaysSinceLastViolation.mockReturnValue(20); // Less than 30 days

      await reputationService.processReputationRecovery("user123");

      expect(mockRepository.getById).toHaveBeenCalledWith("user123");
      expect(getDaysSinceLastViolation).toHaveBeenCalledWith(
        mockUserReputation
      );
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it("should handle errors gracefully", async () => {
      mockRepository.getById.mockRejectedValue(new Error("Database error"));

      await expect(
        reputationService.processReputationRecovery("user123")
      ).resolves.toBeUndefined();
    });
  });

  describe("resetReputation", () => {
    it("should reset reputation successfully", async () => {
      mockRepository.save.mockResolvedValue();

      await reputationService.resetReputation("user123");

      expect(getDefaultReputation).toHaveBeenCalledWith("user123");
      expect(mockRepository.save).toHaveBeenCalledWith(mockDefaultReputation);
    });

    it("should handle errors gracefully", async () => {
      mockRepository.save.mockRejectedValue(new Error("Database error"));

      await expect(
        reputationService.resetReputation("user123")
      ).resolves.toBeUndefined();
    });
  });

  describe("getReputationStats", () => {
    it("should get reputation stats successfully", async () => {
      const mockStats = {
        totalUsers: 100,
        trustedUsers: 20,
        verifiedUsers: 30,
        standardUsers: 25,
        flaggedUsers: 15,
        bannedUsers: 10,
        averageScore: 75.5,
      };
      mockRepository.getStats.mockResolvedValue(mockStats);

      const result = await reputationService.getReputationStats();

      expect(mockRepository.getStats).toHaveBeenCalled();
      expect(result).toEqual(mockStats);
    });

    it("should return default stats on error", async () => {
      mockRepository.getStats.mockRejectedValue(new Error("Database error"));

      const result = await reputationService.getReputationStats();

      expect(result).toEqual({
        totalUsers: 0,
        trustedUsers: 0,
        verifiedUsers: 0,
        standardUsers: 0,
        flaggedUsers: 0,
        bannedUsers: 0,
        averageScore: 0,
      });
    });
  });
});
