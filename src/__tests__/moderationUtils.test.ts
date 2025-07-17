/**
 * Tests for moderation utilities
 */

import {
  deduplicateViolations,
  applyReputationBasedActions,
  determineFinalStatus,
  calculateOverallConfidence,
  calculateReputationImpact,
  isAppealable,
  generateReason,
  getReputationLevel,
  createRejectionResult,
  createErrorResult,
} from "../utils/moderationUtils";
import {
  Violation,
  ViolationType,
  ModerationStatus,
  ContentRank,
  LocalModerationResult,
  OpenAIModerationResult,
} from "../types";
import { CONTENT_MODERATION } from "../constants";

describe("ModerationUtils", () => {
  describe("deduplicateViolations", () => {
    it("should remove duplicate violations", () => {
      const violations: Violation[] = [
        {
          type: ViolationType.HARASSMENT,
          severity: "high",
          confidence: 0.8,
          description: "First harassment",
          suggestedAction: "reject",
        },
        {
          type: ViolationType.HARASSMENT,
          severity: "high",
          confidence: 0.9,
          description: "Second harassment",
          suggestedAction: "reject",
        },
        {
          type: ViolationType.HATE_SPEECH,
          severity: "medium",
          confidence: 0.6,
          description: "Hate speech",
          suggestedAction: "flag",
        },
      ];

      const result = deduplicateViolations(violations);
      expect(result).toHaveLength(2);
      expect(result[0].type).toBe(ViolationType.HARASSMENT);
      expect(result[1].type).toBe(ViolationType.HATE_SPEECH);
    });

    it("should sort violations by severity", () => {
      const violations: Violation[] = [
        {
          type: ViolationType.SPAM,
          severity: "low",
          confidence: 0.4,
          description: "Spam",
          suggestedAction: "warn",
        },
        {
          type: ViolationType.HARASSMENT,
          severity: "high",
          confidence: 0.8,
          description: "Harassment",
          suggestedAction: "reject",
        },
        {
          type: ViolationType.HATE_SPEECH,
          severity: "critical",
          confidence: 0.9,
          description: "Hate speech",
          suggestedAction: "ban",
        },
      ];

      const result = deduplicateViolations(violations);
      expect(result).toHaveLength(3);
      expect(result[0].severity).toBe("critical");
      expect(result[1].severity).toBe("high");
      expect(result[2].severity).toBe("low");
    });

    it("should handle empty violations array", () => {
      const result = deduplicateViolations([]);
      expect(result).toHaveLength(0);
    });

    it("should preserve unique violations", () => {
      const violations: Violation[] = [
        {
          type: ViolationType.HARASSMENT,
          severity: "high",
          confidence: 0.8,
          description: "Harassment",
          suggestedAction: "reject",
        },
        {
          type: ViolationType.HATE_SPEECH,
          severity: "high",
          confidence: 0.9,
          description: "Hate speech",
          suggestedAction: "ban",
        },
      ];

      const result = deduplicateViolations(violations);
      expect(result).toHaveLength(2);
    });
  });

  describe("applyReputationBasedActions", () => {
    const mockUserReputation = {
      userId: "user-123",
      score: 95,
      level: "trusted" as const,
      flaggedWhispers: 0,
      totalWhispers: 100,
      approvedWhispers: 95,
      rejectedWhispers: 5,
      lastViolation: undefined,
      violationHistory: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("should return violations unchanged when no user reputation", () => {
      const violations: Violation[] = [
        {
          type: ViolationType.HARASSMENT,
          severity: "high",
          confidence: 0.8,
          description: "Harassment",
          suggestedAction: "reject",
        },
      ];

      const result = applyReputationBasedActions(violations);
      expect(result).toEqual(violations);
    });

    it("should return violations unchanged when no user reputation provided", () => {
      const violations: Violation[] = [
        {
          type: ViolationType.HARASSMENT,
          severity: "high",
          confidence: 0.8,
          description: "Harassment",
          suggestedAction: "reject",
        },
      ];

      const result = applyReputationBasedActions(violations);
      expect(result).toEqual(violations);
    });

    it("should apply reduced penalties for trusted users", () => {
      const violations: Violation[] = [
        {
          type: ViolationType.HARASSMENT,
          severity: "critical",
          confidence: 0.9,
          description: "Critical harassment",
          suggestedAction: "ban",
        },
        {
          type: ViolationType.HATE_SPEECH,
          severity: "high",
          confidence: 0.8,
          description: "High hate speech",
          suggestedAction: "reject",
        },
      ];

      const result = applyReputationBasedActions(
        violations,
        mockUserReputation
      );
      expect(result[0].severity).toBe("high");
      expect(result[0].suggestedAction).toBe("reject");
      expect(result[1].severity).toBe("medium");
      expect(result[1].suggestedAction).toBe("flag");
    });

    it("should handle all severity levels", () => {
      const violations: Violation[] = [
        {
          type: ViolationType.HARASSMENT,
          severity: "critical",
          confidence: 0.9,
          description: "Critical",
          suggestedAction: "ban",
        },
        {
          type: ViolationType.HATE_SPEECH,
          severity: "high",
          confidence: 0.8,
          description: "High",
          suggestedAction: "reject",
        },
        {
          type: ViolationType.SPAM,
          severity: "medium",
          confidence: 0.6,
          description: "Medium",
          suggestedAction: "flag",
        },
        {
          type: ViolationType.SPAM,
          severity: "low",
          confidence: 0.4,
          description: "Low",
          suggestedAction: "warn",
        },
      ];

      const result = applyReputationBasedActions(
        violations,
        mockUserReputation
      );
      expect(result[0].severity).toBe("high");
      expect(result[1].severity).toBe("medium");
      expect(result[2].severity).toBe("low");
      expect(result[3].severity).toBe("low");
    });
  });

  describe("determineFinalStatus", () => {
    it("should return APPROVED for no violations", () => {
      const result = determineFinalStatus([]);
      expect(result).toBe(ModerationStatus.APPROVED);
    });

    it("should return REJECTED for critical violations", () => {
      const violations: Violation[] = [
        {
          type: ViolationType.HATE_SPEECH,
          severity: "critical",
          confidence: 0.9,
          description: "Critical violation",
          suggestedAction: "ban",
        },
      ];

      const result = determineFinalStatus(violations);
      expect(result).toBe(ModerationStatus.REJECTED);
    });

    it("should return REJECTED for high severity violations", () => {
      const violations: Violation[] = [
        {
          type: ViolationType.HARASSMENT,
          severity: "high",
          confidence: 0.8,
          description: "High violation",
          suggestedAction: "reject",
        },
      ];

      const result = determineFinalStatus(violations);
      expect(result).toBe(ModerationStatus.REJECTED);
    });

    it("should return FLAGGED for medium severity violations", () => {
      const violations: Violation[] = [
        {
          type: ViolationType.SPAM,
          severity: "medium",
          confidence: 0.6,
          description: "Medium violation",
          suggestedAction: "flag",
        },
      ];

      const result = determineFinalStatus(violations);
      expect(result).toBe(ModerationStatus.FLAGGED);
    });

    it("should return APPROVED for low severity violations", () => {
      const violations: Violation[] = [
        {
          type: ViolationType.SPAM,
          severity: "low",
          confidence: 0.4,
          description: "Low violation",
          suggestedAction: "warn",
        },
      ];

      const result = determineFinalStatus(violations);
      expect(result).toBe(ModerationStatus.APPROVED);
    });

    it("should prioritize critical over other violations", () => {
      const violations: Violation[] = [
        {
          type: ViolationType.SPAM,
          severity: "low",
          confidence: 0.4,
          description: "Low violation",
          suggestedAction: "warn",
        },
        {
          type: ViolationType.HATE_SPEECH,
          severity: "critical",
          confidence: 0.9,
          description: "Critical violation",
          suggestedAction: "ban",
        },
      ];

      const result = determineFinalStatus(violations);
      expect(result).toBe(ModerationStatus.REJECTED);
    });
  });

  describe("calculateOverallConfidence", () => {
    it("should return 1.0 for no violations", () => {
      const result = calculateOverallConfidence([]);
      expect(result).toBe(1.0);
    });

    it("should calculate average confidence for multiple violations", () => {
      const violations: Violation[] = [
        {
          type: ViolationType.HARASSMENT,
          severity: "high",
          confidence: 0.8,
          description: "Harassment",
          suggestedAction: "reject",
        },
        {
          type: ViolationType.HATE_SPEECH,
          severity: "medium",
          confidence: 0.6,
          description: "Hate speech",
          suggestedAction: "flag",
        },
      ];

      const result = calculateOverallConfidence(violations);
      expect(result).toBe(0.7);
    });

    it("should handle single violation", () => {
      const violations: Violation[] = [
        {
          type: ViolationType.HARASSMENT,
          severity: "high",
          confidence: 0.8,
          description: "Harassment",
          suggestedAction: "reject",
        },
      ];

      const result = calculateOverallConfidence(violations);
      expect(result).toBe(0.8);
    });
  });

  describe("calculateReputationImpact", () => {
    const mockUserReputation = {
      userId: "user-123",
      score: 75,
      level: "verified" as const,
      flaggedWhispers: 0,
      totalWhispers: 50,
      approvedWhispers: 45,
      rejectedWhispers: 5,
      lastViolation: undefined,
      violationHistory: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("should return 0 when no user reputation", () => {
      const violations: Violation[] = [
        {
          type: ViolationType.HARASSMENT,
          severity: "high",
          confidence: 0.8,
          description: "Harassment",
          suggestedAction: "reject",
        },
      ];

      const result = calculateReputationImpact(violations);
      expect(result).toBe(0);
    });

    it("should return 0 when no violations", () => {
      const result = calculateReputationImpact([], mockUserReputation);
      expect(result).toBe(0);
    });

    it("should calculate impact for critical violations", () => {
      const violations: Violation[] = [
        {
          type: ViolationType.HATE_SPEECH,
          severity: "critical",
          confidence: 0.9,
          description: "Critical violation",
          suggestedAction: "ban",
        },
      ];

      const result = calculateReputationImpact(violations, mockUserReputation);
      expect(result).toBe(
        CONTENT_MODERATION.REPUTATION.SCORE_ADJUSTMENTS.CRITICAL_VIOLATION
      );
    });

    it("should calculate impact for high severity violations", () => {
      const violations: Violation[] = [
        {
          type: ViolationType.HARASSMENT,
          severity: "high",
          confidence: 0.8,
          description: "High violation",
          suggestedAction: "reject",
        },
      ];

      const result = calculateReputationImpact(violations, mockUserReputation);
      expect(result).toBe(
        CONTENT_MODERATION.REPUTATION.SCORE_ADJUSTMENTS.VIOLATION
      );
    });

    it("should calculate impact for medium severity violations", () => {
      const violations: Violation[] = [
        {
          type: ViolationType.SPAM,
          severity: "medium",
          confidence: 0.6,
          description: "Medium violation",
          suggestedAction: "flag",
        },
      ];

      const result = calculateReputationImpact(violations, mockUserReputation);
      expect(result).toBe(
        CONTENT_MODERATION.REPUTATION.SCORE_ADJUSTMENTS.FLAGGED_WHISPER
      );
    });

    it("should calculate impact for low severity violations", () => {
      const violations: Violation[] = [
        {
          type: ViolationType.SPAM,
          severity: "low",
          confidence: 0.4,
          description: "Low violation",
          suggestedAction: "warn",
        },
      ];

      const result = calculateReputationImpact(violations, mockUserReputation);
      expect(result).toBe(
        CONTENT_MODERATION.REPUTATION.SCORE_ADJUSTMENTS.APPROVED_WHISPER
      );
    });

    it("should calculate total impact for multiple violations", () => {
      const violations: Violation[] = [
        {
          type: ViolationType.HATE_SPEECH,
          severity: "critical",
          confidence: 0.9,
          description: "Critical violation",
          suggestedAction: "ban",
        },
        {
          type: ViolationType.HARASSMENT,
          severity: "high",
          confidence: 0.8,
          description: "High violation",
          suggestedAction: "reject",
        },
      ];

      const result = calculateReputationImpact(violations, mockUserReputation);
      const expectedImpact =
        CONTENT_MODERATION.REPUTATION.SCORE_ADJUSTMENTS.CRITICAL_VIOLATION +
        CONTENT_MODERATION.REPUTATION.SCORE_ADJUSTMENTS.VIOLATION;
      expect(result).toBe(expectedImpact);
    });
  });

  describe("isAppealable", () => {
    it("should return false for approved content", () => {
      const violations: Violation[] = [];
      const result = isAppealable(ModerationStatus.APPROVED, violations);
      expect(result).toBe(false);
    });

    it("should return false for critical violations", () => {
      const violations: Violation[] = [
        {
          type: ViolationType.HATE_SPEECH,
          severity: "critical",
          confidence: 0.9,
          description: "Critical violation",
          suggestedAction: "ban",
        },
      ];

      const result = isAppealable(ModerationStatus.REJECTED, violations);
      expect(result).toBe(false);
    });

    it("should return true for non-critical violations", () => {
      const violations: Violation[] = [
        {
          type: ViolationType.HARASSMENT,
          severity: "high",
          confidence: 0.8,
          description: "High violation",
          suggestedAction: "reject",
        },
      ];

      const result = isAppealable(ModerationStatus.REJECTED, violations);
      expect(result).toBe(true);
    });

    it("should return true for flagged content", () => {
      const violations: Violation[] = [
        {
          type: ViolationType.SPAM,
          severity: "medium",
          confidence: 0.6,
          description: "Medium violation",
          suggestedAction: "flag",
        },
      ];

      const result = isAppealable(ModerationStatus.FLAGGED, violations);
      expect(result).toBe(true);
    });
  });

  describe("generateReason", () => {
    it("should generate reason for approved content", () => {
      const result = generateReason([], ModerationStatus.APPROVED);
      expect(result).toBe("Content approved");
    });

    it("should generate reason for rejected content", () => {
      const violations: Violation[] = [
        {
          type: ViolationType.HARASSMENT,
          severity: "high",
          confidence: 0.8,
          description: "Harassment",
          suggestedAction: "reject",
        },
      ];

      const result = generateReason(violations, ModerationStatus.REJECTED);
      expect(result).toBe("Content rejected due to: harassment");
    });

    it("should generate reason with multiple violation types", () => {
      const violations: Violation[] = [
        {
          type: ViolationType.HARASSMENT,
          severity: "high",
          confidence: 0.8,
          description: "Harassment",
          suggestedAction: "reject",
        },
        {
          type: ViolationType.HATE_SPEECH,
          severity: "critical",
          confidence: 0.9,
          description: "Hate speech",
          suggestedAction: "ban",
        },
      ];

      const result = generateReason(violations, ModerationStatus.REJECTED);
      expect(result).toBe("Content rejected due to: harassment, hate_speech");
    });
  });

  describe("getReputationLevel", () => {
    it("should return TRUSTED for high scores", () => {
      const result = getReputationLevel(95);
      expect(result).toBe("TRUSTED");
    });

    it("should return VERIFIED for verified threshold", () => {
      const result = getReputationLevel(75);
      expect(result).toBe("VERIFIED");
    });

    it("should return STANDARD for standard threshold", () => {
      const result = getReputationLevel(60);
      expect(result).toBe("STANDARD");
    });

    it("should return FLAGGED for flagged threshold", () => {
      const result = getReputationLevel(30);
      expect(result).toBe("FLAGGED");
    });

    it("should return BANNED for low scores", () => {
      const result = getReputationLevel(10);
      expect(result).toBe("BANNED");
    });

    it("should handle exact threshold values", () => {
      expect(getReputationLevel(90)).toBe("TRUSTED");
      expect(getReputationLevel(75)).toBe("VERIFIED");
      expect(getReputationLevel(50)).toBe("STANDARD");
      expect(getReputationLevel(25)).toBe("FLAGGED");
      expect(getReputationLevel(0)).toBe("BANNED");
    });
  });

  describe("createRejectionResult", () => {
    it("should create rejection result with all required fields", () => {
      const localResult: LocalModerationResult = {
        flagged: true,
        matchedKeywords: ["test"],
        toxicityScore: 0.8,
        spamScore: 0.1,
        personalInfoDetected: false,
      };

      const startTime = Date.now();
      const result = createRejectionResult(
        "Test reason",
        localResult,
        startTime
      );

      expect(result.status).toBe(ModerationStatus.REJECTED);
      expect(result.contentRank).toBe(ContentRank.NC17);
      expect(result.isMinorSafe).toBe(false);
      expect(result.violations).toHaveLength(0);
      expect(result.confidence).toBe(1.0);
      expect(result.reputationImpact).toBe(-15);
      expect(result.appealable).toBe(false);
      expect(result.reason).toBe("Test reason");
      expect(result.apiResults.local).toBe(localResult);
    });

    it("should include optional API results", () => {
      const localResult: LocalModerationResult = {
        flagged: false,
        matchedKeywords: [],
        toxicityScore: 0.1,
        spamScore: 0.1,
        personalInfoDetected: false,
      };

      const openaiResult: OpenAIModerationResult = {
        flagged: true,
        categories: {
          harassment: true,
          harassment_threatening: false,
          hate: false,
          hate_threatening: false,
          self_harm: false,
          self_harm_instructions: false,
          self_harm_intent: false,
          sexual: false,
          sexual_minors: false,
          violence: false,
          violence_graphic: false,
        },
        categoryScores: {
          harassment: 0.8,
          hate: 0.1,
          sexual: 0.1,
          sexual_minors: 0.1,
          violence: 0.1,
          violence_graphic: 0.1,
          self_harm: 0.1,
          self_harm_intent: 0.1,
          self_harm_instructions: 0.1,
          harassment_threatening: 0.1,
          hate_threatening: 0.1,
        },
      };

      const startTime = Date.now();
      const result = createRejectionResult(
        "Test reason",
        localResult,
        startTime,
        openaiResult
      );

      expect(result.apiResults.openai).toBe(openaiResult);
    });
  });

  describe("createErrorResult", () => {
    it("should create error result with Error object", () => {
      const startTime = Date.now();
      const error = new Error("Test error message");
      const result = createErrorResult(error, startTime);

      expect(result.status).toBe(ModerationStatus.UNDER_REVIEW);
      expect(result.contentRank).toBe(ContentRank.PG13);
      expect(result.isMinorSafe).toBe(false);
      expect(result.violations).toHaveLength(0);
      expect(result.confidence).toBe(0.0);
      expect(result.reputationImpact).toBe(0);
      expect(result.appealable).toBe(true);
      expect(result.reason).toBe("Test error message");
    });

    it("should create error result with string error", () => {
      const startTime = Date.now();
      const error = "String error message";
      const result = createErrorResult(error, startTime);

      expect(result.reason).toBe("String error message");
    });

    it("should create error result with unknown error", () => {
      const startTime = Date.now();
      const error = { custom: "error" };
      const result = createErrorResult(error, startTime);

      expect(result.reason).toBe("Unknown error occurred during moderation");
    });
  });
});
