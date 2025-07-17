/**
 * OpenAI Moderation Service Tests
 */

import { OpenAIModerationService } from "../services/openAIModerationService";
import { ViolationType } from "../types";
import * as errorHelpers from "../utils/errorHelpers";

describe("OpenAIModerationService", () => {
  describe("convertToViolations", () => {
    it("should convert flagged content to violations", () => {
      const mockResult = {
        flagged: true,
        categories: {
          harassment: true,
          harassment_threatening: false,
          hate: true,
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
          harassment: 0.85,
          harassment_threatening: 0.05,
          hate: 0.92,
          hate_threatening: 0.02,
          self_harm: 0.02,
          self_harm_instructions: 0.01,
          self_harm_intent: 0.01,
          sexual: 0.03,
          sexual_minors: 0.01,
          violence: 0.02,
          violence_graphic: 0.01,
        },
      };

      const violations =
        OpenAIModerationService.convertToViolations(mockResult);

      expect(violations).toHaveLength(2);
      expect(violations[0].type).toBe(ViolationType.HARASSMENT);
      expect(violations[0].confidence).toBe(0.85);
      expect(violations[1].type).toBe(ViolationType.HATE_SPEECH);
      expect(violations[1].confidence).toBe(0.92);
    });

    it("should not create violations for scores below threshold", () => {
      const mockResult = {
        flagged: false,
        categories: {
          harassment: false,
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
          harassment: 0.1,
          harassment_threatening: 0.05,
          hate: 0.05,
          hate_threatening: 0.02,
          self_harm: 0.02,
          self_harm_instructions: 0.01,
          self_harm_intent: 0.01,
          sexual: 0.03,
          sexual_minors: 0.01,
          violence: 0.02,
          violence_graphic: 0.01,
        },
      };

      const violations =
        OpenAIModerationService.convertToViolations(mockResult);

      expect(violations).toHaveLength(0);
    });
  });

  describe("shouldReject", () => {
    it("should reject content with critical violations", () => {
      const mockResult = {
        flagged: true,
        categories: {
          harassment: false,
          harassment_threatening: true,
          hate: false,
          hate_threatening: false,
          self_harm: false,
          self_harm_instructions: false,
          self_harm_intent: false,
          sexual: false,
          sexual_minors: false,
          violence: false,
          violence_graphic: true,
        },
        categoryScores: {
          harassment: 0.1,
          harassment_threatening: 0.95,
          hate: 0.05,
          hate_threatening: 0.02,
          self_harm: 0.02,
          self_harm_instructions: 0.01,
          self_harm_intent: 0.01,
          sexual: 0.03,
          sexual_minors: 0.01,
          violence: 0.02,
          violence_graphic: 0.92,
        },
      };

      const shouldReject = OpenAIModerationService.shouldReject(mockResult);

      expect(shouldReject).toBe(true);
    });

    it("should not reject content with low scores", () => {
      const mockResult = {
        flagged: false,
        categories: {
          harassment: false,
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
          harassment: 0.3,
          harassment_threatening: 0.1,
          hate: 0.2,
          hate_threatening: 0.05,
          self_harm: 0.02,
          self_harm_instructions: 0.01,
          self_harm_intent: 0.01,
          sexual: 0.03,
          sexual_minors: 0.01,
          violence: 0.02,
          violence_graphic: 0.01,
        },
      };

      const shouldReject = OpenAIModerationService.shouldReject(mockResult);

      expect(shouldReject).toBe(false);
    });
  });

  describe("getModerationSummary", () => {
    it("should generate summary for flagged content", () => {
      const mockResult = {
        flagged: true,
        categories: {
          harassment: true,
          harassment_threatening: false,
          hate: true,
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
          harassment: 0.85,
          harassment_threatening: 0.05,
          hate: 0.92,
          hate_threatening: 0.02,
          self_harm: 0.02,
          self_harm_instructions: 0.01,
          self_harm_intent: 0.01,
          sexual: 0.03,
          sexual_minors: 0.01,
          violence: 0.02,
          violence_graphic: 0.01,
        },
      };

      const summary = OpenAIModerationService.getModerationSummary(mockResult);

      expect(summary).toContain("OpenAI");
      expect(summary).toContain("harassment");
      expect(summary).toContain("hate");
    });

    it("should generate summary for clean content", () => {
      const mockResult = {
        flagged: false,
        categories: {
          harassment: false,
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
          harassment: 0.1,
          harassment_threatening: 0.05,
          hate: 0.05,
          hate_threatening: 0.02,
          self_harm: 0.02,
          self_harm_instructions: 0.01,
          self_harm_intent: 0.01,
          sexual: 0.03,
          sexual_minors: 0.01,
          violence: 0.02,
          violence_graphic: 0.01,
        },
      };

      const summary = OpenAIModerationService.getModerationSummary(mockResult);

      expect(summary).toContain("OpenAI");
      expect(summary).toContain("No violations");
    });
  });

  describe("estimateCost", () => {
    it("should estimate cost based on text length", () => {
      const shortText = "Hello world";
      const longText = "A".repeat(1000);

      const shortCost = OpenAIModerationService.estimateCost(shortText.length);
      const longCost = OpenAIModerationService.estimateCost(longText.length);

      expect(shortCost).toBeGreaterThan(0);
      expect(longCost).toBeGreaterThan(shortCost);
      expect(typeof shortCost).toBe("number");
    });

    it("should handle zero length text", () => {
      const cost = OpenAIModerationService.estimateCost(0);
      expect(cost).toBeGreaterThanOrEqual(0);
    });
  });

  describe("isWithinLimits", () => {
    it("should return true for text within limits", () => {
      const shortText = "Hello world";
      const result = OpenAIModerationService.isWithinLimits(shortText);
      expect(result).toBe(true);
    });

    it("should return false for text exceeding limits", () => {
      const longText = "A".repeat(100000); // Very long text
      const result = OpenAIModerationService.isWithinLimits(longText);
      expect(result).toBe(false);
    });

    it("should handle empty text", () => {
      const result = OpenAIModerationService.isWithinLimits("");
      expect(result).toBe(true);
    });
  });
});

describe("OpenAIModerationService - uncovered branches and errors", () => {
  // Mock API key
  beforeEach(() => {
    process.env.EXPO_PUBLIC_OPENAI_API_KEY = "test-key";
  });

  it("should throw if API returns malformed data (no results)", async () => {
    (globalThis as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ results: [] }),
    });
    await expect(
      OpenAIModerationService.moderateText("test")
    ).rejects.toThrow();
  });

  it("should call getErrorMessage and rethrow in catch block", async () => {
    const error = new Error("network fail");
    (globalThis as any).fetch = jest.fn().mockRejectedValue(error);
    const spy = jest.spyOn(errorHelpers, "getErrorMessage");
    spy.mockReturnValue("custom error");
    await expect(OpenAIModerationService.moderateText("test")).rejects.toThrow(
      "custom error"
    );
    spy.mockRestore();
  });

  it("should use default threshold for unknown category", () => {
    const threshold = (OpenAIModerationService as any).getThresholdForCategory(
      "unknown_cat"
    );
    expect(threshold).toBe(0.7);
  });

  it("should use default suggested action for unknown type", () => {
    const action = (OpenAIModerationService as any).getSuggestedAction(
      "unknown_type",
      0.95
    );
    expect(action).toBe("reject");
    // For confidence 0.5
    const action2 = (OpenAIModerationService as any).getSuggestedAction(
      "unknown_type",
      0.5
    );
    expect(action2).toBe("warn");
  });

  it("should cover all branches in determineSeverity", () => {
    const fn = (OpenAIModerationService as any).determineSeverity;
    expect(fn("hate_threatening", 0.95)).toBe("critical");
    expect(fn("hate_threatening", 0.8)).toBe("high");
    expect(fn("hate_threatening", 0.71)).toBe("high");
    expect(fn("hate_threatening", 0.69)).toBe("medium");
    expect(fn("hate", 0.85)).toBe("high");
    expect(fn("hate", 0.7)).toBe("medium");
    expect(fn("hate", 0.5)).toBe("low");
    expect(fn("sexual", 0.8)).toBe("medium");
    expect(fn("sexual", 0.6)).toBe("low");
    expect(fn("other", 0.95)).toBe("critical");
    expect(fn("other", 0.85)).toBe("high");
    expect(fn("other", 0.65)).toBe("medium");
    expect(fn("other", 0.5)).toBe("low");
  });

  it("should handle edge cases for estimateCost and isWithinLimits", () => {
    (OpenAIModerationService as any).API_LIMITS = {
      costPerRequest: 0.01,
      maxTokens: 10,
    };
    expect(OpenAIModerationService.estimateCost(0)).toBe(0);
    expect(OpenAIModerationService.estimateCost(40)).toBe(0.1);
    expect(OpenAIModerationService.isWithinLimits("A".repeat(40))).toBe(true);
    expect(OpenAIModerationService.isWithinLimits("A".repeat(41))).toBe(false);
  });
});
