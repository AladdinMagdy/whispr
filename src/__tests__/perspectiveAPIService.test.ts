/**
 * Google Perspective API Service Tests
 */

import { PerspectiveAPIService } from "../services/perspectiveAPIService";
import { ViolationType } from "../types";

describe("PerspectiveAPIService", () => {
  describe("convertToViolations", () => {
    it("should convert toxic content to violations", () => {
      const mockResult = {
        toxicity: 0.85,
        severeToxicity: 0.1,
        identityAttack: 0.92,
        insult: 0.75,
        profanity: 0.6,
        threat: 0.3,
        sexuallyExplicit: 0.2,
        flirtation: 0.1,
        attackOnAuthor: 0.1,
        attackOnCommenter: 0.1,
        incoherent: 0.1,
        inflammatory: 0.1,
        likelyToReject: 0.1,
        obscene: 0.1,
        spam: 0.1,
        unsubstantial: 0.1,
      };

      const violations = PerspectiveAPIService.convertToViolations(mockResult);

      expect(violations).toHaveLength(3); // toxicity, identityAttack, insult (profanity below threshold)
      expect(violations[0].type).toBe(ViolationType.HARASSMENT); // toxicity
      expect(violations[0].confidence).toBe(0.85);
      expect(violations[1].type).toBe(ViolationType.HATE_SPEECH); // identityAttack
      expect(violations[1].confidence).toBe(0.92);
      expect(violations[2].type).toBe(ViolationType.HARASSMENT); // insult
      expect(violations[2].confidence).toBe(0.75);
    });

    it("should not create violations for scores below threshold", () => {
      const mockResult = {
        toxicity: 0.1,
        severeToxicity: 0.05,
        identityAttack: 0.05,
        insult: 0.1,
        profanity: 0.1,
        threat: 0.05,
        sexuallyExplicit: 0.1,
        flirtation: 0.1,
        attackOnAuthor: 0.1,
        attackOnCommenter: 0.1,
        incoherent: 0.1,
        inflammatory: 0.1,
        likelyToReject: 0.1,
        obscene: 0.1,
        spam: 0.1,
        unsubstantial: 0.1,
      };

      const violations = PerspectiveAPIService.convertToViolations(mockResult);

      expect(violations).toHaveLength(0);
    });

    it("should handle threat violations", () => {
      const mockResult = {
        toxicity: 0.1,
        severeToxicity: 0.05,
        identityAttack: 0.05,
        insult: 0.1,
        profanity: 0.1,
        threat: 0.85, // Above threshold
        sexuallyExplicit: 0.1,
        flirtation: 0.1,
        attackOnAuthor: 0.1,
        attackOnCommenter: 0.1,
        incoherent: 0.1,
        inflammatory: 0.1,
        likelyToReject: 0.1,
        obscene: 0.1,
        spam: 0.1,
        unsubstantial: 0.1,
      };

      const violations = PerspectiveAPIService.convertToViolations(mockResult);

      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe(ViolationType.VIOLENCE);
      expect(violations[0].confidence).toBe(0.85);
    });

    it("should handle sexually explicit content", () => {
      const mockResult = {
        toxicity: 0.1,
        severeToxicity: 0.05,
        identityAttack: 0.05,
        insult: 0.1,
        profanity: 0.1,
        threat: 0.05,
        sexuallyExplicit: 0.85, // Above threshold
        flirtation: 0.1,
        attackOnAuthor: 0.1,
        attackOnCommenter: 0.1,
        incoherent: 0.1,
        inflammatory: 0.1,
        likelyToReject: 0.1,
        obscene: 0.1,
        spam: 0.1,
        unsubstantial: 0.1,
      };

      const violations = PerspectiveAPIService.convertToViolations(mockResult);

      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe(ViolationType.SEXUAL_CONTENT);
      expect(violations[0].confidence).toBe(0.85);
    });

    it("should handle spam content", () => {
      const mockResult = {
        toxicity: 0.1,
        severeToxicity: 0.05,
        identityAttack: 0.05,
        insult: 0.1,
        profanity: 0.1,
        threat: 0.05,
        sexuallyExplicit: 0.1,
        flirtation: 0.1,
        attackOnAuthor: 0.1,
        attackOnCommenter: 0.1,
        incoherent: 0.1,
        inflammatory: 0.1,
        likelyToReject: 0.1,
        obscene: 0.1,
        spam: 0.85, // Above threshold
        unsubstantial: 0.1,
      };

      const violations = PerspectiveAPIService.convertToViolations(mockResult);

      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe(ViolationType.SPAM);
      expect(violations[0].confidence).toBe(0.85);
    });
  });

  describe("shouldReject", () => {
    it("should reject content with high toxicity", () => {
      const mockResult = {
        toxicity: 0.95,
        severeToxicity: 0.1,
        identityAttack: 0.1,
        insult: 0.1,
        profanity: 0.1,
        threat: 0.1,
        sexuallyExplicit: 0.1,
        flirtation: 0.1,
        attackOnAuthor: 0.1,
        attackOnCommenter: 0.1,
        incoherent: 0.1,
        inflammatory: 0.1,
        likelyToReject: 0.1,
        obscene: 0.1,
        spam: 0.1,
        unsubstantial: 0.1,
      };

      const shouldReject = PerspectiveAPIService.shouldReject(mockResult);

      expect(shouldReject).toBe(true);
    });

    it("should reject content with high severe toxicity", () => {
      const mockResult = {
        toxicity: 0.1,
        severeToxicity: 0.95,
        identityAttack: 0.1,
        insult: 0.1,
        profanity: 0.1,
        threat: 0.1,
        sexuallyExplicit: 0.1,
        flirtation: 0.1,
        attackOnAuthor: 0.1,
        attackOnCommenter: 0.1,
        incoherent: 0.1,
        inflammatory: 0.1,
        likelyToReject: 0.1,
        obscene: 0.1,
        spam: 0.1,
        unsubstantial: 0.1,
      };

      const shouldReject = PerspectiveAPIService.shouldReject(mockResult);

      expect(shouldReject).toBe(true);
    });

    it("should reject content with high threat", () => {
      const mockResult = {
        toxicity: 0.1,
        severeToxicity: 0.1,
        identityAttack: 0.1,
        insult: 0.1,
        profanity: 0.1,
        threat: 0.95,
        sexuallyExplicit: 0.1,
        flirtation: 0.1,
        attackOnAuthor: 0.1,
        attackOnCommenter: 0.1,
        incoherent: 0.1,
        inflammatory: 0.1,
        likelyToReject: 0.1,
        obscene: 0.1,
        spam: 0.1,
        unsubstantial: 0.1,
      };

      const shouldReject = PerspectiveAPIService.shouldReject(mockResult);

      expect(shouldReject).toBe(true);
    });

    it("should not reject content with low scores", () => {
      const mockResult = {
        toxicity: 0.3,
        severeToxicity: 0.1,
        identityAttack: 0.1,
        insult: 0.2,
        profanity: 0.1,
        threat: 0.05,
        sexuallyExplicit: 0.1,
        flirtation: 0.1,
        attackOnAuthor: 0.1,
        attackOnCommenter: 0.1,
        incoherent: 0.1,
        inflammatory: 0.1,
        likelyToReject: 0.1,
        obscene: 0.1,
        spam: 0.1,
        unsubstantial: 0.1,
      };

      const shouldReject = PerspectiveAPIService.shouldReject(mockResult);

      expect(shouldReject).toBe(false);
    });
  });

  describe("getModerationSummary", () => {
    it("should generate summary for toxic content", () => {
      const mockResult = {
        toxicity: 0.85,
        severeToxicity: 0.1,
        identityAttack: 0.92,
        insult: 0.75,
        profanity: 0.6,
        threat: 0.3,
        sexuallyExplicit: 0.2,
        flirtation: 0.1,
        attackOnAuthor: 0.1,
        attackOnCommenter: 0.1,
        incoherent: 0.1,
        inflammatory: 0.1,
        likelyToReject: 0.1,
        obscene: 0.1,
        spam: 0.1,
        unsubstantial: 0.1,
      };

      const summary = PerspectiveAPIService.getModerationSummary(mockResult);

      expect(summary).toContain("Perspective");
      expect(summary).toContain("toxicity");
      expect(summary).toContain("identityAttack");
    });

    it("should generate summary for clean content", () => {
      const mockResult = {
        toxicity: 0.1,
        severeToxicity: 0.05,
        identityAttack: 0.05,
        insult: 0.1,
        profanity: 0.1,
        threat: 0.05,
        sexuallyExplicit: 0.1,
        flirtation: 0.1,
        attackOnAuthor: 0.1,
        attackOnCommenter: 0.1,
        incoherent: 0.1,
        inflammatory: 0.1,
        likelyToReject: 0.1,
        obscene: 0.1,
        spam: 0.1,
        unsubstantial: 0.1,
      };

      const summary = PerspectiveAPIService.getModerationSummary(mockResult);

      expect(summary).toContain("Perspective");
      expect(summary).toContain("No violations");
    });
  });

  describe("estimateCost", () => {
    it("should estimate cost correctly", () => {
      const cost = PerspectiveAPIService.estimateCost();
      expect(cost).toBeGreaterThan(0);
      expect(typeof cost).toBe("number");
    });
  });

  describe("isWithinLimits", () => {
    it("should return true for text within limits", () => {
      const shortText = "Hello world";
      const result = PerspectiveAPIService.isWithinLimits(shortText);
      expect(result).toBe(true);
    });

    it("should return false for text exceeding limits", () => {
      const longText = "A".repeat(100000); // Very long text
      const result = PerspectiveAPIService.isWithinLimits(longText);
      expect(result).toBe(false);
    });

    it("should handle empty text", () => {
      const result = PerspectiveAPIService.isWithinLimits("");
      expect(result).toBe(true);
    });
  });

  describe("getOverallToxicity", () => {
    it("should calculate overall toxicity correctly", () => {
      const mockResult = {
        toxicity: 0.8,
        severeToxicity: 0.9,
        identityAttack: 0.7,
        insult: 0.6,
        profanity: 0.5,
        threat: 0.4,
        sexuallyExplicit: 0.3,
        flirtation: 0.2,
        attackOnAuthor: 0.1,
        attackOnCommenter: 0.1,
        incoherent: 0.1,
        inflammatory: 0.1,
        likelyToReject: 0.1,
        obscene: 0.1,
        spam: 0.1,
        unsubstantial: 0.1,
      };

      const overallToxicity =
        PerspectiveAPIService.getOverallToxicity(mockResult);

      expect(overallToxicity).toBeGreaterThan(0);
      expect(overallToxicity).toBeLessThanOrEqual(1);
      expect(typeof overallToxicity).toBe("number");
    });

    it("should handle all zero scores", () => {
      const mockResult = {
        toxicity: 0,
        severeToxicity: 0,
        identityAttack: 0,
        insult: 0,
        profanity: 0,
        threat: 0,
        sexuallyExplicit: 0,
        flirtation: 0,
        attackOnAuthor: 0,
        attackOnCommenter: 0,
        incoherent: 0,
        inflammatory: 0,
        likelyToReject: 0,
        obscene: 0,
        spam: 0,
        unsubstantial: 0,
      };

      const overallToxicity =
        PerspectiveAPIService.getOverallToxicity(mockResult);

      expect(overallToxicity).toBe(0);
    });
  });

  describe("severity determination", () => {
    it("should determine critical severity for severe toxicity", () => {
      const mockResult = {
        toxicity: 0.1,
        severeToxicity: 0.95,
        identityAttack: 0.1,
        insult: 0.1,
        profanity: 0.1,
        threat: 0.1,
        sexuallyExplicit: 0.1,
        flirtation: 0.1,
        attackOnAuthor: 0.1,
        attackOnCommenter: 0.1,
        incoherent: 0.1,
        inflammatory: 0.1,
        likelyToReject: 0.1,
        obscene: 0.1,
        spam: 0.1,
        unsubstantial: 0.1,
      };

      const violations = PerspectiveAPIService.convertToViolations(mockResult);

      expect(violations.some((v) => v.severity === "critical")).toBe(true);
    });

    it("should determine appropriate severity based on scores", () => {
      const mockResult = {
        toxicity: 0.95, // Should be high
        severeToxicity: 0.1,
        identityAttack: 0.75, // Should be high
        insult: 0.72, // Should be medium (above threshold)
        profanity: 0.1,
        threat: 0.1,
        sexuallyExplicit: 0.1,
        flirtation: 0.1,
        attackOnAuthor: 0.1,
        attackOnCommenter: 0.1,
        incoherent: 0.1,
        inflammatory: 0.1,
        likelyToReject: 0.1,
        obscene: 0.1,
        spam: 0.1,
        unsubstantial: 0.1,
      };

      const violations = PerspectiveAPIService.convertToViolations(mockResult);

      const highSeverity = violations.find((v) => v.confidence === 0.95);
      const mediumSeverity = violations.find((v) => v.confidence === 0.75);
      const lowSeverity = violations.find((v) => v.confidence === 0.72);

      expect(highSeverity?.severity).toBe("high");
      expect(mediumSeverity?.severity).toBe("high"); // identityAttack with 0.75 is high severity
      expect(lowSeverity?.severity).toBe("medium"); // insult with 0.72 is medium severity
    });
  });
});
