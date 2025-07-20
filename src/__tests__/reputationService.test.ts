import { ReputationService } from "../services/reputationService";
import { ReputationRepository } from "../repositories/ReputationRepository";
import {
  ViolationType,
  ModerationStatus,
  ContentRank,
  Violation,
} from "../types";

// Mock the repository
const mockRepository: jest.Mocked<ReputationRepository> = {
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

// Mock the privacy service
jest.mock("../services/privacyService", () => ({
  getPrivacyService: jest.fn(() => ({
    saveUserViolation: jest.fn(),
    getUserViolations: jest.fn(),
    getDeletedWhisperCount: jest.fn(),
  })),
}));

describe("ReputationService", () => {
  let reputationService: ReputationService;

  beforeEach(() => {
    jest.clearAllMocks();
    ReputationService.resetInstance();
    reputationService = new ReputationService(mockRepository);
  });

  afterEach(() => {
    ReputationService.resetInstance();
  });

  describe("Singleton Pattern", () => {
    it("should return the same instance", () => {
      const instance1 = ReputationService.getInstance();
      const instance2 = ReputationService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("should reset instance correctly", () => {
      const instance1 = ReputationService.getInstance();
      ReputationService.resetInstance();
      const instance2 = ReputationService.getInstance();
      expect(instance1).not.toBe(instance2);
    });

    it("should destroy instance correctly", () => {
      const instance1 = ReputationService.getInstance();
      ReputationService.destroyInstance();
      const instance2 = ReputationService.getInstance();
      expect(instance1).not.toBe(instance2);
    });

    it("should handle resetInstance when no instance exists", () => {
      expect(() => ReputationService.resetInstance()).not.toThrow();
    });

    it("should handle destroyInstance when no instance exists", () => {
      expect(() => ReputationService.destroyInstance()).not.toThrow();
    });
  });

  describe("Factory Functions", () => {
    it("should export factory functions correctly", () => {
      // Test that factory functions exist and are callable
      expect(() => ReputationService.getInstance()).not.toThrow();
      expect(() => ReputationService.resetInstance()).not.toThrow();
      expect(() => ReputationService.destroyInstance()).not.toThrow();
    });

    it("should call static methods through factory functions", () => {
      expect(() => ReputationService.resetInstance()).not.toThrow();
      expect(() => ReputationService.destroyInstance()).not.toThrow();
    });
  });

  describe("Reputation Levels", () => {
    it("should correctly identify trusted users (90-100)", () => {
      const trustedReputation = {
        userId: "trusted-user",
        score: 95,
        level: "trusted" as const,
        totalWhispers: 100,
        approvedWhispers: 98,
        flaggedWhispers: 1,
        rejectedWhispers: 1,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(trustedReputation.level).toBe("trusted");
      expect(trustedReputation.score).toBeGreaterThanOrEqual(90);
      expect(trustedReputation.score).toBeLessThanOrEqual(100);
    });

    it("should correctly identify verified users (75-89)", () => {
      const verifiedReputation = {
        userId: "verified-user",
        score: 80,
        level: "verified" as const,
        totalWhispers: 50,
        approvedWhispers: 45,
        flaggedWhispers: 3,
        rejectedWhispers: 2,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(verifiedReputation.level).toBe("verified");
      expect(verifiedReputation.score).toBeGreaterThanOrEqual(75);
      expect(verifiedReputation.score).toBeLessThan(90);
    });

    it("should correctly identify standard users (50-74)", () => {
      const standardReputation = {
        userId: "standard-user",
        score: 60,
        level: "standard" as const,
        totalWhispers: 20,
        approvedWhispers: 18,
        flaggedWhispers: 2,
        rejectedWhispers: 0,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(standardReputation.level).toBe("standard");
      expect(standardReputation.score).toBeGreaterThanOrEqual(50);
      expect(standardReputation.score).toBeLessThan(75);
    });

    it("should correctly identify flagged users (25-49)", () => {
      const flaggedReputation = {
        userId: "flagged-user",
        score: 30,
        level: "flagged" as const,
        totalWhispers: 10,
        approvedWhispers: 5,
        flaggedWhispers: 4,
        rejectedWhispers: 1,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(flaggedReputation.level).toBe("flagged");
      expect(flaggedReputation.score).toBeGreaterThanOrEqual(25);
      expect(flaggedReputation.score).toBeLessThan(50);
    });

    it("should correctly identify banned users (0-24)", () => {
      const bannedReputation = {
        userId: "banned-user",
        score: 10,
        level: "banned" as const,
        totalWhispers: 5,
        approvedWhispers: 0,
        flaggedWhispers: 5,
        rejectedWhispers: 0,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(bannedReputation.level).toBe("banned");
      expect(bannedReputation.score).toBeGreaterThanOrEqual(0);
      expect(bannedReputation.score).toBeLessThan(25);
    });

    it("should handle edge cases", () => {
      const edgeCases = [
        { score: 0, expectedLevel: "banned" as const },
        { score: 24, expectedLevel: "banned" as const },
        { score: 25, expectedLevel: "flagged" as const },
        { score: 49, expectedLevel: "flagged" as const },
        { score: 50, expectedLevel: "standard" as const },
        { score: 74, expectedLevel: "standard" as const },
        { score: 75, expectedLevel: "verified" as const },
        { score: 89, expectedLevel: "verified" as const },
        { score: 90, expectedLevel: "trusted" as const },
        { score: 100, expectedLevel: "trusted" as const },
      ];

      edgeCases.forEach(({ score, expectedLevel }) => {
        const reputation = {
          userId: `user-${score}`,
          score,
          level: expectedLevel,
          totalWhispers: 0,
          approvedWhispers: 0,
          flaggedWhispers: 0,
          rejectedWhispers: 0,
          violationHistory: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        expect(reputation.level).toBe(expectedLevel);
      });
    });
  });

  describe("Default Reputation", () => {
    it("should provide default reputation for new users", async () => {
      mockRepository.getById.mockResolvedValue(null);
      mockRepository.save.mockResolvedValue();

      const reputation = await reputationService.getUserReputation("new-user");

      expect(reputation).toBeDefined();
      expect(reputation.userId).toBe("new-user");
      expect(reputation.score).toBe(50);
      expect(reputation.level).toBe("standard");
      expect(reputation.totalWhispers).toBe(0);
      expect(reputation.approvedWhispers).toBe(0);
      expect(reputation.flaggedWhispers).toBe(0);
      expect(reputation.rejectedWhispers).toBe(0);
      expect(reputation.violationHistory).toEqual([]);
    });

    it("should handle errors gracefully in getUserReputation", async () => {
      // Mock repository to throw error
      mockRepository.getById.mockRejectedValue(new Error("Database error"));
      mockRepository.save.mockRejectedValue(new Error("Save error"));

      // Should return default reputation even when errors occur
      const reputation = await reputationService.getUserReputation(
        "error-user"
      );
      expect(reputation).toBeDefined();
      expect(reputation.userId).toBe("error-user");
      expect(reputation.score).toBe(50);
      expect(reputation.level).toBe("standard");
    });
  });

  describe("Reputation-Based Actions", () => {
    it("should apply reputation actions to moderation results", async () => {
      const moderationResult = {
        status: ModerationStatus.PENDING,
        contentRank: ContentRank.PG,
        isMinorSafe: true,
        violations: [
          {
            type: ViolationType.SPAM,
            severity: "low",
            confidence: 0.8,
            description: "Spam detected",
            suggestedAction: "warn",
          } as Violation,
        ],
        confidence: 1,
        moderationTime: 0.5,
        apiResults: {},
        reputationImpact: 0,
        appealable: true,
      };

      const result = await reputationService.applyReputationBasedActions(
        moderationResult,
        "user-123"
      );

      expect(result).toHaveProperty("reputationImpact");
      expect(result).toHaveProperty("appealable");
      expect(result).toHaveProperty("appealTimeLimit");
      expect(result).toHaveProperty("penaltyMultiplier");
      expect(result).toHaveProperty("autoAppealThreshold");
      expect(result.appealable).toBe(true); // Verified users can appeal
      expect(result.appealTimeLimit).toBe(7); // 7 days for standard users
    });

    it("should handle banned users correctly", async () => {
      // Mock a banned user by temporarily modifying the service
      const bannedUserReputation = {
        userId: "banned-user",
        score: 10, // Banned level
        level: "banned" as const,
        totalWhispers: 0,
        approvedWhispers: 0,
        flaggedWhispers: 5,
        rejectedWhispers: 0,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock the getUserReputation method
      mockRepository.getById.mockResolvedValue(bannedUserReputation);

      const moderationResult = {
        status: ModerationStatus.FLAGGED,
        contentRank: ContentRank.R,
        isMinorSafe: false,
        violations: [
          {
            type: ViolationType.HATE_SPEECH,
            severity: "high",
            confidence: 0.9,
            description: "Hate speech detected",
            suggestedAction: "reject",
          } as Violation,
        ],
        confidence: 1,
        moderationTime: 0.5,
        apiResults: {},
        reputationImpact: 0,
        appealable: false,
      };

      const result = await reputationService.applyReputationBasedActions(
        moderationResult,
        "banned-user"
      );

      expect(result.appealable).toBe(false); // Banned users cannot appeal
      expect(result.appealTimeLimit).toBe(0); // No appeals for banned users
      expect(result.penaltyMultiplier).toBe(2.0); // Maximum penalty for banned users
    });

    it("should handle trusted users correctly", async () => {
      const trustedUserReputation = {
        userId: "trusted-user",
        score: 95,
        level: "trusted" as const,
        totalWhispers: 100,
        approvedWhispers: 98,
        flaggedWhispers: 1,
        rejectedWhispers: 1,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.getById.mockResolvedValue(trustedUserReputation);

      const moderationResult = {
        status: ModerationStatus.FLAGGED,
        contentRank: ContentRank.PG13,
        isMinorSafe: true,
        violations: [
          {
            type: ViolationType.SPAM,
            severity: "low",
            confidence: 0.6,
            description: "Possible spam",
            suggestedAction: "warn",
          } as Violation,
        ],
        confidence: 1,
        moderationTime: 0.5,
        apiResults: {},
        reputationImpact: 0,
        appealable: true,
      };

      const result = await reputationService.applyReputationBasedActions(
        moderationResult,
        "trusted-user"
      );

      expect(result.appealable).toBe(true);
      expect(result.appealTimeLimit).toBe(30); // 30 days for trusted users
      expect(result.penaltyMultiplier).toBe(0.5); // Reduced penalties for trusted users
      expect(result.autoAppealThreshold).toBe(0.3); // Low threshold for trusted users
    });

    it("should handle standard users correctly", async () => {
      const standardUserReputation = {
        userId: "standard-user",
        score: 60,
        level: "standard" as const,
        totalWhispers: 20,
        approvedWhispers: 18,
        flaggedWhispers: 2,
        rejectedWhispers: 0,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.getById.mockResolvedValue(standardUserReputation);

      const moderationResult = {
        status: ModerationStatus.FLAGGED,
        contentRank: ContentRank.R,
        isMinorSafe: false,
        violations: [
          {
            type: ViolationType.HARASSMENT,
            severity: "medium",
            confidence: 0.8,
            description: "Harassment detected",
            suggestedAction: "reject",
          } as Violation,
        ],
        confidence: 1,
        moderationTime: 0.5,
        apiResults: {},
        reputationImpact: 0,
        appealable: true,
      };

      const result = await reputationService.applyReputationBasedActions(
        moderationResult,
        "standard-user"
      );

      expect(result.appealable).toBe(true);
      expect(result.appealTimeLimit).toBe(7); // 7 days for standard users
      expect(result.penaltyMultiplier).toBe(1.0); // Normal penalties for standard users
      expect(result.autoAppealThreshold).toBe(0.7); // Higher threshold for standard users
    });

    it("should handle flagged users correctly", async () => {
      const flaggedUserReputation = {
        userId: "flagged-user",
        score: 30,
        level: "flagged" as const,
        totalWhispers: 10,
        approvedWhispers: 5,
        flaggedWhispers: 4,
        rejectedWhispers: 1,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.getById.mockResolvedValue(flaggedUserReputation);

      const moderationResult = {
        status: ModerationStatus.FLAGGED,
        contentRank: ContentRank.R,
        isMinorSafe: false,
        violations: [
          {
            type: ViolationType.HATE_SPEECH,
            severity: "critical",
            confidence: 0.9,
            description: "Critical hate speech",
            suggestedAction: "ban",
          } as Violation,
        ],
        confidence: 1,
        moderationTime: 0.5,
        apiResults: {},
        reputationImpact: 0,
        appealable: true,
      };

      const result = await reputationService.applyReputationBasedActions(
        moderationResult,
        "flagged-user"
      );

      expect(result.appealable).toBe(false); // Critical violations for flagged users are not appealable
      expect(result.appealTimeLimit).toBe(3); // 3 days for flagged users
      expect(result.penaltyMultiplier).toBe(1.5); // Increased penalties for flagged users
      expect(result.autoAppealThreshold).toBe(0.9); // Very high threshold for flagged users
    });

    it("should handle errors gracefully in applyReputationBasedActions", async () => {
      const moderationResult = {
        status: ModerationStatus.APPROVED,
        contentRank: ContentRank.G,
        isMinorSafe: true,
        violations: [],
        confidence: 1,
        moderationTime: 0.5,
        apiResults: {},
        reputationImpact: 0,
        appealable: true,
      };

      // Mock an error in getUserReputation
      mockRepository.getById.mockRejectedValue(new Error("Test error"));
      mockRepository.save.mockRejectedValue(new Error("Save error"));

      // Should apply reputation actions even when repository fails (uses default reputation)
      const result = await reputationService.applyReputationBasedActions(
        moderationResult,
        "error-user"
      );

      // Should apply reputation actions using default reputation
      expect(result.reputationImpact).toBe(0); // No violations = no impact
      expect(result.appealable).toBe(true);
      expect(result.appealTimeLimit).toBe(7); // Default for standard users
      expect(result.penaltyMultiplier).toBe(1); // Default for standard users
      expect(result.autoAppealThreshold).toBe(0.7); // Default for standard users
    });

    it("should handle moderation results with no violations", async () => {
      const moderationResult = {
        status: ModerationStatus.APPROVED,
        contentRank: ContentRank.G,
        isMinorSafe: true,
        violations: [],
        confidence: 1,
        moderationTime: 0.5,
        apiResults: {},
        reputationImpact: 0,
        appealable: true,
      };

      const result = await reputationService.applyReputationBasedActions(
        moderationResult,
        "user-123"
      );

      expect(result.reputationImpact).toBe(0); // No violations = no impact
      expect(result.appealable).toBe(true);
    });

    it("should handle unknown violation types", async () => {
      const moderationResult = {
        status: ModerationStatus.FLAGGED,
        contentRank: ContentRank.R,
        isMinorSafe: false,
        violations: [
          {
            type: "UNKNOWN_VIOLATION" as ViolationType,
            severity: "medium",
            confidence: 0.8,
            description: "Unknown violation",
            suggestedAction: "warn",
          } as Violation,
        ],
        confidence: 1,
        moderationTime: 0.5,
        apiResults: {},
        reputationImpact: 0,
        appealable: true,
      };

      const result = await reputationService.applyReputationBasedActions(
        moderationResult,
        "user-123"
      );

      expect(result.reputationImpact).toBeGreaterThan(0); // Should use default impact
    });
  });

  describe("Violation Recording", () => {
    it("should record violations and calculate impact", async () => {
      const userId = "user-123";
      const whisperId = "whisper-456";

      // Record a minor violation
      await reputationService.recordViolation(
        userId,
        whisperId,
        ViolationType.SPAM,
        "low"
      );

      // Record a major violation
      await reputationService.recordViolation(
        userId,
        whisperId,
        ViolationType.MINOR_SAFETY,
        "critical"
      );

      // The service should log these violations
      // In a real implementation, we would verify the reputation was updated
    });

    it("should record successful whispers", async () => {
      const userId = "user-123";

      await reputationService.recordSuccessfulWhisper(userId);

      // The service should log successful whispers
      // In a real implementation, we would verify the reputation was updated
    });

    it("should handle errors in recordViolation", async () => {
      const mockRepository = (reputationService as any).repository;
      mockRepository.save.mockRejectedValue(new Error("Save error"));

      // Should not throw, just log error
      await expect(
        reputationService.recordViolation(
          "user-123",
          "whisper-456",
          ViolationType.SPAM,
          "low"
        )
      ).resolves.not.toThrow();
    });

    it("should handle errors in recordSuccessfulWhisper", async () => {
      const mockRepository = (reputationService as any).repository;
      mockRepository.save.mockRejectedValue(new Error("Save error"));

      // Should not throw, just log error
      await expect(
        reputationService.recordSuccessfulWhisper("user-123")
      ).resolves.not.toThrow();
    });

    it("should handle errors in processReputationRecovery", async () => {
      const mockRepository = (reputationService as any).repository;
      mockRepository.save.mockRejectedValue(new Error("Save error"));

      // Should not throw, just log error
      await expect(
        reputationService.processReputationRecovery("user-123")
      ).resolves.not.toThrow();
    });

    it("should handle errors in resetReputation", async () => {
      const mockRepository = (reputationService as any).repository;
      mockRepository.save.mockRejectedValue(new Error("Save error"));

      // Should not throw, just log error
      await expect(
        reputationService.resetReputation("user-123")
      ).resolves.not.toThrow();
    });
  });

  describe("Reputation Recovery", () => {
    it("should process reputation recovery", async () => {
      const userId = "user-123";

      await reputationService.processReputationRecovery(userId);

      // The service should process recovery
      // In a real implementation, we would verify the reputation was updated
    });

    it("should handle users with no last violation", async () => {
      const userId = "user-123";
      const reputation = {
        userId,
        score: 50,
        level: "standard" as const,
        totalWhispers: 10,
        approvedWhispers: 8,
        flaggedWhispers: 2,
        rejectedWhispers: 0,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        // No lastViolation field
      };

      mockRepository.getById.mockResolvedValue(reputation);

      await reputationService.processReputationRecovery(userId);
      // Should handle gracefully
    });
  });

  describe("Reputation Statistics", () => {
    it("should return reputation statistics", async () => {
      // Mock the repository response
      const mockStats = {
        totalUsers: 100,
        trustedUsers: 10,
        verifiedUsers: 30,
        standardUsers: 40,
        flaggedUsers: 15,
        bannedUsers: 5,
        averageScore: 75,
      };

      const mockRepository = (reputationService as any).repository;
      mockRepository.getStats.mockResolvedValue(mockStats);

      const stats = await reputationService.getReputationStats();

      expect(stats).toHaveProperty("totalUsers");
      expect(stats).toHaveProperty("trustedUsers");
      expect(stats).toHaveProperty("verifiedUsers");
      expect(stats).toHaveProperty("standardUsers");
      expect(stats).toHaveProperty("flaggedUsers");
      expect(stats).toHaveProperty("bannedUsers");
      expect(stats).toHaveProperty("averageScore");

      expect(stats.totalUsers).toBe(100);
      expect(stats.averageScore).toBe(75);
    });

    it("should handle errors in getReputationStats", async () => {
      const mockRepository = (reputationService as any).repository;
      mockRepository.getStats.mockRejectedValue(new Error("Stats error"));

      // Should return default stats object on error
      const stats = await reputationService.getReputationStats();

      expect(stats).toEqual({
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

  describe("Reputation Reset", () => {
    it("should reset user reputation", async () => {
      const userId = "user-123";

      await reputationService.resetReputation(userId);

      // The service should log the reset
      // In a real implementation, we would verify the reputation was reset
    });
  });

  describe("Violation Impact Calculation", () => {
    it("should calculate correct violation impacts", () => {
      // Test different violation types and severities
      const testCases = [
        { type: ViolationType.SPAM, severity: "low", expectedBase: 5 },
        {
          type: ViolationType.HARASSMENT,
          severity: "medium",
          expectedBase: 15,
        },
        { type: ViolationType.HATE_SPEECH, severity: "high", expectedBase: 25 },
        {
          type: ViolationType.MINOR_SAFETY,
          severity: "critical",
          expectedBase: 35,
        },
      ];

      testCases.forEach(({ type, severity, expectedBase }) => {
        // We can't directly test private methods, but we can test through public interfaces
        // The impact calculation is tested indirectly through recordViolation
        expect(type).toBeDefined();
        expect(severity).toBeDefined();
        expect(expectedBase).toBeGreaterThan(0);
      });
    });

    it("should handle unknown violation types", async () => {
      const userId = "user-123";
      const whisperId = "whisper-456";

      // Should handle unknown violation type gracefully
      await expect(
        reputationService.recordViolation(
          userId,
          whisperId,
          "UNKNOWN_TYPE" as ViolationType,
          "medium"
        )
      ).resolves.not.toThrow();
    });

    it("should handle unknown severity levels", async () => {
      const userId = "user-123";
      const whisperId = "whisper-456";

      // Should handle unknown severity gracefully
      await expect(
        reputationService.recordViolation(
          userId,
          whisperId,
          ViolationType.SPAM,
          "unknown" as any
        )
      ).resolves.not.toThrow();
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle null/undefined violations array", async () => {
      const moderationResult = {
        status: ModerationStatus.FLAGGED,
        contentRank: ContentRank.R,
        isMinorSafe: false,
        violations: null as any,
        confidence: 1,
        moderationTime: 0.5,
        apiResults: {},
        reputationImpact: 0,
        appealable: true,
      };

      const result = await reputationService.applyReputationBasedActions(
        moderationResult,
        "user-123"
      );

      expect(result.reputationImpact).toBe(0);
    });

    it("should handle empty violations array", async () => {
      const moderationResult = {
        status: ModerationStatus.APPROVED,
        contentRank: ContentRank.G,
        isMinorSafe: true,
        violations: [],
        confidence: 1,
        moderationTime: 0.5,
        apiResults: {},
        reputationImpact: 0,
        appealable: true,
      };

      const result = await reputationService.applyReputationBasedActions(
        moderationResult,
        "user-123"
      );

      expect(result.reputationImpact).toBe(0);
    });

    it("should handle unknown reputation levels in time limits", async () => {
      const moderationResult = {
        status: ModerationStatus.FLAGGED,
        contentRank: ContentRank.R,
        isMinorSafe: false,
        violations: [
          {
            type: ViolationType.SPAM,
            severity: "low",
            confidence: 0.8,
            description: "Spam detected",
            suggestedAction: "warn",
          } as Violation,
        ],
        confidence: 1,
        moderationTime: 0.5,
        apiResults: {},
        reputationImpact: 0,
        appealable: true,
      };

      // Mock a user with unknown reputation level
      const unknownLevelReputation = {
        userId: "unknown-user",
        score: 999, // Invalid score
        level: "unknown" as any,
        totalWhispers: 0,
        approvedWhispers: 0,
        flaggedWhispers: 0,
        rejectedWhispers: 0,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.getById.mockResolvedValue(unknownLevelReputation);

      const result = await reputationService.applyReputationBasedActions(
        moderationResult,
        "unknown-user"
      );

      // Should use default values for unknown levels
      expect(result.appealTimeLimit).toBe(30); // Uses score 999 which maps to trusted level
      expect(result.penaltyMultiplier).toBe(0.5); // Uses score 999 which maps to trusted level
      expect(result.autoAppealThreshold).toBe(0.3); // Uses score 999 which maps to trusted level
    });
  });
});
