/**
 * Tests for Reputation Utilities
 */

import {
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
  validateReputation,
  calculateReputationStats,
  needsRecoveryProcessing,
  canAutoAppeal,
  getReputationLevelDescription,
  getReputationScoreDescription,
  REPUTATION_THRESHOLDS,
  VIOLATION_IMPACT_SCORES,
  RECOVERY_RATES,
  APPEAL_TIME_LIMITS,
  PENALTY_MULTIPLIERS,
  AUTO_APPROVAL_THRESHOLDS,
  SEVERITY_MULTIPLIERS,
} from "../utils/reputationUtils";
import { ViolationType } from "../types";
import { REPUTATION_CONSTANTS } from "../constants";

// Mock constants
jest.mock("../constants", () => ({
  REPUTATION_CONSTANTS: {
    INITIAL_USER_SCORE: 75,
  },
}));

// Helper function to create ModerationResult objects
const createModerationResult = (overrides: Partial<any> = {}) => ({
  approved: true,
  violations: [],
  confidence: 0.9,
  status: "approved",
  contentRank: 1,
  isMinorSafe: false,
  moderationTime: new Date(),
  reputationImpact: 0,
  appealable: true,
  appealTimeLimit: 7,
  penaltyMultiplier: 1.0,
  autoAppealThreshold: 0.7,
  apiResults: {},
  ...overrides,
});

describe("Reputation Utils", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Constants", () => {
    test("should export all required constants", () => {
      expect(REPUTATION_THRESHOLDS).toBeDefined();
      expect(VIOLATION_IMPACT_SCORES).toBeDefined();
      expect(RECOVERY_RATES).toBeDefined();
      expect(APPEAL_TIME_LIMITS).toBeDefined();
      expect(PENALTY_MULTIPLIERS).toBeDefined();
      expect(AUTO_APPROVAL_THRESHOLDS).toBeDefined();
      expect(SEVERITY_MULTIPLIERS).toBeDefined();
    });

    test("should have correct threshold values", () => {
      expect(REPUTATION_THRESHOLDS.trusted).toBe(90);
      expect(REPUTATION_THRESHOLDS.verified).toBe(75);
      expect(REPUTATION_THRESHOLDS.standard).toBe(50);
      expect(REPUTATION_THRESHOLDS.flagged).toBe(25);
      expect(REPUTATION_THRESHOLDS.banned).toBe(0);
    });

    test("should have correct violation impact scores", () => {
      expect(VIOLATION_IMPACT_SCORES[ViolationType.HARASSMENT]).toBe(15);
      expect(VIOLATION_IMPACT_SCORES[ViolationType.HATE_SPEECH]).toBe(25);
      expect(VIOLATION_IMPACT_SCORES[ViolationType.VIOLENCE]).toBe(30);
      expect(VIOLATION_IMPACT_SCORES[ViolationType.MINOR_SAFETY]).toBe(35);
    });
  });

  describe("getReputationLevel", () => {
    test("should return trusted for scores >= 90", () => {
      expect(getReputationLevel(100)).toBe("trusted");
      expect(getReputationLevel(90)).toBe("trusted");
      expect(getReputationLevel(95)).toBe("trusted");
    });

    test("should return verified for scores 75-89", () => {
      expect(getReputationLevel(89)).toBe("verified");
      expect(getReputationLevel(75)).toBe("verified");
      expect(getReputationLevel(80)).toBe("verified");
    });

    test("should return standard for scores 50-74", () => {
      expect(getReputationLevel(74)).toBe("standard");
      expect(getReputationLevel(50)).toBe("standard");
      expect(getReputationLevel(60)).toBe("standard");
    });

    test("should return flagged for scores 25-49", () => {
      expect(getReputationLevel(49)).toBe("flagged");
      expect(getReputationLevel(25)).toBe("flagged");
      expect(getReputationLevel(30)).toBe("flagged");
    });

    test("should return banned for scores < 25", () => {
      expect(getReputationLevel(24)).toBe("banned");
      expect(getReputationLevel(0)).toBe("banned");
      expect(getReputationLevel(10)).toBe("banned");
    });

    test("should throw error for invalid scores", () => {
      expect(() => getReputationLevel(-1)).toThrow(
        "Invalid reputation score: -1"
      );
      expect(() => getReputationLevel(NaN)).toThrow(
        "Invalid reputation score: NaN"
      );
      expect(() => getReputationLevel(Infinity)).toThrow(
        "Invalid reputation score: Infinity"
      );
    });
  });

  describe("calculateViolationImpact", () => {
    test("should calculate correct impact for different violation types", () => {
      expect(calculateViolationImpact(ViolationType.HARASSMENT, "medium")).toBe(
        15
      );
      expect(calculateViolationImpact(ViolationType.HATE_SPEECH, "high")).toBe(
        38
      );
      expect(calculateViolationImpact(ViolationType.VIOLENCE, "critical")).toBe(
        60
      );
      expect(calculateViolationImpact(ViolationType.SPAM, "low")).toBe(3);
    });

    test("should apply severity multipliers correctly", () => {
      expect(calculateViolationImpact(ViolationType.HARASSMENT, "low")).toBe(8);
      expect(calculateViolationImpact(ViolationType.HARASSMENT, "medium")).toBe(
        15
      );
      expect(calculateViolationImpact(ViolationType.HARASSMENT, "high")).toBe(
        23
      );
      expect(
        calculateViolationImpact(ViolationType.HARASSMENT, "critical")
      ).toBe(30);
    });

    test("should handle unknown violation types", () => {
      expect(
        calculateViolationImpact("UNKNOWN" as ViolationType, "medium")
      ).toBe(10);
    });
  });

  describe("calculateReputationImpact", () => {
    test("should return 0 for moderation results without violations", () => {
      const moderationResult = createModerationResult();
      expect(calculateReputationImpact(moderationResult, "standard")).toBe(0);
    });

    test("should calculate impact for single violation", () => {
      const moderationResult = {
        approved: false,
        violations: [
          {
            type: ViolationType.HARASSMENT,
            severity: "medium",
            confidence: 0.8,
          },
        ],
        confidence: 0.8,
      };
      expect(calculateReputationImpact(moderationResult, "standard")).toBe(15);
    });

    test("should calculate impact for multiple violations", () => {
      const moderationResult = {
        approved: false,
        violations: [
          {
            type: ViolationType.HARASSMENT,
            severity: "medium",
            confidence: 0.8,
          },
          {
            type: ViolationType.SPAM,
            severity: "low",
            confidence: 0.6,
          },
        ],
        confidence: 0.7,
      };
      expect(calculateReputationImpact(moderationResult, "standard")).toBe(18);
    });

    test("should apply reputation-based multipliers", () => {
      const moderationResult = {
        approved: false,
        violations: [
          {
            type: ViolationType.HARASSMENT,
            severity: "medium",
            confidence: 0.8,
          },
        ],
        confidence: 0.8,
      };
      expect(calculateReputationImpact(moderationResult, "trusted")).toBe(8);
      expect(calculateReputationImpact(moderationResult, "flagged")).toBe(23);
      expect(calculateReputationImpact(moderationResult, "banned")).toBe(30);
    });
  });

  describe("isAppealable", () => {
    test("should return false for banned users", () => {
      const moderationResult = {
        approved: false,
        violations: [],
        confidence: 0.8,
      };
      expect(isAppealable(moderationResult, "banned")).toBe(false);
    });

    test("should return false for flagged users with critical violations", () => {
      const moderationResult = {
        approved: false,
        violations: [
          {
            type: ViolationType.VIOLENCE,
            severity: "critical",
            confidence: 0.9,
          },
        ],
        confidence: 0.9,
      };
      expect(isAppealable(moderationResult, "flagged")).toBe(false);
    });

    test("should return true for other cases", () => {
      const moderationResult = {
        approved: false,
        violations: [
          {
            type: ViolationType.HARASSMENT,
            severity: "medium",
            confidence: 0.8,
          },
        ],
        confidence: 0.8,
      };
      expect(isAppealable(moderationResult, "trusted")).toBe(true);
      expect(isAppealable(moderationResult, "verified")).toBe(true);
      expect(isAppealable(moderationResult, "standard")).toBe(true);
    });
  });

  describe("getAppealTimeLimit", () => {
    test("should return correct time limits for each level", () => {
      expect(getAppealTimeLimit("trusted")).toBe(30);
      expect(getAppealTimeLimit("verified")).toBe(14);
      expect(getAppealTimeLimit("standard")).toBe(7);
      expect(getAppealTimeLimit("flagged")).toBe(3);
      expect(getAppealTimeLimit("banned")).toBe(0);
    });

    test("should return default for unknown levels", () => {
      expect(getAppealTimeLimit("unknown" as any)).toBe(7);
    });
  });

  describe("getPenaltyMultiplier", () => {
    test("should return correct multipliers for each level", () => {
      expect(getPenaltyMultiplier("trusted")).toBe(0.5);
      expect(getPenaltyMultiplier("verified")).toBe(0.75);
      expect(getPenaltyMultiplier("standard")).toBe(1.0);
      expect(getPenaltyMultiplier("flagged")).toBe(1.5);
      expect(getPenaltyMultiplier("banned")).toBe(2.0);
    });

    test("should return default for unknown levels", () => {
      expect(getPenaltyMultiplier("unknown" as any)).toBe(1.0);
    });
  });

  describe("getAutoAppealThreshold", () => {
    test("should return correct thresholds for each level", () => {
      expect(getAutoAppealThreshold("trusted")).toBe(0.3);
      expect(getAutoAppealThreshold("verified")).toBe(0.5);
      expect(getAutoAppealThreshold("standard")).toBe(0.7);
      expect(getAutoAppealThreshold("flagged")).toBe(0.9);
      expect(getAutoAppealThreshold("banned")).toBe(1.0);
    });

    test("should return default for unknown levels", () => {
      expect(getAutoAppealThreshold("unknown" as any)).toBe(0.7);
    });
  });

  describe("getRecoveryRate", () => {
    test("should return correct recovery rates for each level", () => {
      expect(getRecoveryRate(95)).toBe(2); // trusted
      expect(getRecoveryRate(80)).toBe(1.5); // verified
      expect(getRecoveryRate(60)).toBe(1); // standard
      expect(getRecoveryRate(30)).toBe(0.5); // flagged
      expect(getRecoveryRate(10)).toBe(0); // banned
    });

    test("should throw error for invalid scores", () => {
      expect(() => getRecoveryRate(-1)).toThrow("Invalid reputation score: -1");
      expect(() => getRecoveryRate(NaN)).toThrow(
        "Invalid reputation score: NaN"
      );
    });
  });

  describe("getDaysSinceLastViolation", () => {
    test("should return 365 for users without violations", () => {
      const reputation = {
        userId: "test",
        score: 75,
        level: "verified",
        flaggedWhispers: 0,
        totalWhispers: 0,
        approvedWhispers: 0,
        rejectedWhispers: 0,
        lastViolation: undefined,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(getDaysSinceLastViolation(reputation)).toBe(365);
    });

    test("should calculate days since last violation", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const reputation = {
        userId: "test",
        score: 75,
        level: "verified",
        flaggedWhispers: 1,
        totalWhispers: 10,
        approvedWhispers: 9,
        rejectedWhispers: 1,
        lastViolation: yesterday,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(getDaysSinceLastViolation(reputation)).toBe(2);
    });

    test("should cap at 365 days", () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 400);

      const reputation = {
        userId: "test",
        score: 75,
        level: "verified",
        flaggedWhispers: 1,
        totalWhispers: 10,
        approvedWhispers: 9,
        rejectedWhispers: 1,
        lastViolation: oldDate,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(getDaysSinceLastViolation(reputation)).toBe(365);
    });
  });

  describe("calculateRecoveryPoints", () => {
    test("should calculate recovery points correctly", () => {
      const reputation = {
        userId: "test",
        score: 60,
        level: "standard",
        flaggedWhispers: 1,
        totalWhispers: 10,
        approvedWhispers: 9,
        rejectedWhispers: 1,
        lastViolation: new Date(),
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(calculateRecoveryPoints(reputation, 10)).toBe(10);
    });

    test("should not exceed max score", () => {
      const reputation = {
        userId: "test",
        score: 95,
        level: "trusted",
        flaggedWhispers: 0,
        totalWhispers: 10,
        approvedWhispers: 10,
        rejectedWhispers: 0,
        lastViolation: new Date(),
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(calculateRecoveryPoints(reputation, 10)).toBe(5);
    });
  });

  describe("calculateNewScoreAfterViolation", () => {
    test("should calculate new score correctly", () => {
      expect(calculateNewScoreAfterViolation(75, 10)).toBe(65);
      expect(calculateNewScoreAfterViolation(50, 20)).toBe(30);
    });

    test("should not go below 0", () => {
      expect(calculateNewScoreAfterViolation(5, 10)).toBe(0);
      expect(calculateNewScoreAfterViolation(0, 5)).toBe(0);
    });

    test("should not exceed 100", () => {
      expect(calculateNewScoreAfterViolation(95, 0)).toBe(95);
    });

    test("should throw error for invalid inputs", () => {
      expect(() => calculateNewScoreAfterViolation(-1, 10)).toThrow(
        "Invalid current score: -1"
      );
      expect(() => calculateNewScoreAfterViolation(50, -5)).toThrow(
        "Invalid violation impact: -5"
      );
    });
  });

  describe("calculateNewScoreAfterRecovery", () => {
    test("should calculate new score correctly", () => {
      expect(calculateNewScoreAfterRecovery(65, 10)).toBe(75);
      expect(calculateNewScoreAfterRecovery(30, 20)).toBe(50);
    });

    test("should not exceed 100", () => {
      expect(calculateNewScoreAfterRecovery(95, 10)).toBe(100);
      expect(calculateNewScoreAfterRecovery(100, 5)).toBe(100);
    });

    test("should not go below 0", () => {
      expect(calculateNewScoreAfterRecovery(0, 0)).toBe(0);
    });

    test("should throw error for invalid inputs", () => {
      expect(() => calculateNewScoreAfterRecovery(-1, 10)).toThrow(
        "Invalid current score: -1"
      );
      expect(() => calculateNewScoreAfterRecovery(50, -5)).toThrow(
        "Invalid recovery points: -5"
      );
    });
  });

  describe("canAutoAppeal", () => {
    test("should return true when confidence is below threshold", () => {
      const violation = {
        type: ViolationType.HARASSMENT,
        severity: "medium",
        confidence: 0.2,
      };
      expect(canAutoAppeal(violation, "trusted")).toBe(true);
    });

    test("should return false when confidence is above threshold", () => {
      const violation = {
        type: ViolationType.HARASSMENT,
        severity: "medium",
        confidence: 0.8,
      };
      expect(canAutoAppeal(violation, "trusted")).toBe(false);
    });
  });

  describe("getDefaultReputation", () => {
    test("should create default reputation with correct values", () => {
      const defaultRep = getDefaultReputation("test-user");
      expect(defaultRep.userId).toBe("test-user");
      expect(defaultRep.score).toBe(75);
      expect(defaultRep.level).toBe("verified");
      expect(defaultRep.flaggedWhispers).toBe(0);
      expect(defaultRep.totalWhispers).toBe(0);
      expect(defaultRep.approvedWhispers).toBe(0);
      expect(defaultRep.rejectedWhispers).toBe(0);
      expect(defaultRep.violationHistory).toEqual([]);
      expect(defaultRep.createdAt).toBeInstanceOf(Date);
      expect(defaultRep.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe("validateReputation", () => {
    test("should return true for valid reputation", () => {
      const validReputation = {
        userId: "test",
        score: 75,
        level: "verified",
        flaggedWhispers: 0,
        totalWhispers: 10,
        approvedWhispers: 10,
        rejectedWhispers: 0,
        lastViolation: undefined,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(validateReputation(validReputation)).toBe(true);
    });

    test("should return false for invalid reputation", () => {
      const invalidReputation = {
        userId: "",
        score: -1,
        level: "invalid",
        flaggedWhispers: -1,
        totalWhispers: -1,
        approvedWhispers: -1,
        rejectedWhispers: -1,
        lastViolation: undefined,
        violationHistory: "not an array",
        createdAt: "not a date",
        updatedAt: "not a date",
      } as any;
      expect(validateReputation(invalidReputation)).toBe(false);
    });
  });

  describe("calculateReputationStats", () => {
    test("should return empty stats for empty array", () => {
      const stats = calculateReputationStats([]);
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

    test("should calculate stats correctly", () => {
      const reputations = [
        {
          userId: "user1",
          score: 95,
          level: "trusted",
          flaggedWhispers: 0,
          totalWhispers: 10,
          approvedWhispers: 10,
          rejectedWhispers: 0,
          lastViolation: undefined,
          violationHistory: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          userId: "user2",
          score: 80,
          level: "verified",
          flaggedWhispers: 1,
          totalWhispers: 10,
          approvedWhispers: 9,
          rejectedWhispers: 1,
          lastViolation: new Date(),
          violationHistory: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      const stats = calculateReputationStats(reputations);
      expect(stats.totalUsers).toBe(2);
      expect(stats.trustedUsers).toBe(1);
      expect(stats.verifiedUsers).toBe(1);
      expect(stats.averageScore).toBe(87.5);
    });
  });

  describe("needsRecoveryProcessing", () => {
    test("should return false for users without violations", () => {
      const reputation = {
        userId: "test",
        score: 75,
        level: "verified",
        flaggedWhispers: 0,
        totalWhispers: 10,
        approvedWhispers: 10,
        rejectedWhispers: 0,
        lastViolation: undefined,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(needsRecoveryProcessing(reputation)).toBe(false);
    });

    test("should return false for banned users", () => {
      const reputation = {
        userId: "test",
        score: 10,
        level: "banned",
        flaggedWhispers: 5,
        totalWhispers: 10,
        approvedWhispers: 5,
        rejectedWhispers: 5,
        lastViolation: new Date(),
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(needsRecoveryProcessing(reputation)).toBe(false);
    });

    test("should return false for users at max score", () => {
      const reputation = {
        userId: "test",
        score: 100,
        level: "trusted",
        flaggedWhispers: 0,
        totalWhispers: 10,
        approvedWhispers: 10,
        rejectedWhispers: 0,
        lastViolation: new Date(),
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(needsRecoveryProcessing(reputation)).toBe(false);
    });

    test("should return true for users needing recovery", () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10); // 10 days ago

      const reputation = {
        userId: "test",
        score: 60,
        level: "standard",
        flaggedWhispers: 1,
        totalWhispers: 10,
        approvedWhispers: 9,
        rejectedWhispers: 1,
        lastViolation: oldDate,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(needsRecoveryProcessing(reputation)).toBe(true);
    });
  });

  describe("getReputationLevelDescription", () => {
    test("should return correct descriptions for each level", () => {
      expect(getReputationLevelDescription("trusted")).toContain(
        "Trusted user"
      );
      expect(getReputationLevelDescription("verified")).toContain(
        "Verified user"
      );
      expect(getReputationLevelDescription("standard")).toContain(
        "Standard user"
      );
      expect(getReputationLevelDescription("flagged")).toContain(
        "Flagged user"
      );
      expect(getReputationLevelDescription("banned")).toContain("Banned user");
    });

    test("should return default for unknown levels", () => {
      expect(getReputationLevelDescription("unknown" as any)).toBe(
        "Unknown reputation level"
      );
    });
  });

  describe("getReputationScoreDescription", () => {
    test("should return correct descriptions for different scores", () => {
      expect(getReputationScoreDescription(95)).toBe("Excellent reputation");
      expect(getReputationScoreDescription(80)).toBe("Good reputation");
      expect(getReputationScoreDescription(60)).toBe("Average reputation");
      expect(getReputationScoreDescription(30)).toBe("Poor reputation");
      expect(getReputationScoreDescription(10)).toBe("Very poor reputation");
    });
  });
});
