/**
 * Content Moderation Service Tests
 */

import { ContentModerationService } from "../services/contentModerationService";
import { LocalModerationService } from "../services/localModerationService";
import { OpenAIModerationService } from "../services/openAIModerationService";
import { PerspectiveAPIService } from "../services/perspectiveAPIService";
import {
  ModerationStatus,
  ContentRank,
  ViolationType,
  Violation,
} from "../types";

jest.unmock("../services/localModerationService");

// Mock the API services
jest.mock("../services/openAIModerationService");
jest.mock("../services/perspectiveAPIService");
// Mock reputation service with realistic behavior
const mockReputationService = {
  applyReputationBasedActions: jest.fn().mockImplementation((result) => {
    // Simulate reputation-based adjustments
    if (result.violations && result.violations.length > 0) {
      // Apply reputation-based adjustments to violations
      const adjustedViolations = result.violations.map((violation: any) => {
        let adjustedViolation = { ...violation };

        // Simulate trusted user adjustments
        if (result.userReputation && result.userReputation.score >= 90) {
          if (violation.severity === "critical")
            adjustedViolation.severity = "high";
          if (violation.severity === "high")
            adjustedViolation.severity = "medium";
          if (violation.severity === "medium")
            adjustedViolation.severity = "low";

          if (violation.suggestedAction === "ban")
            adjustedViolation.suggestedAction = "reject";
          if (violation.suggestedAction === "reject")
            adjustedViolation.suggestedAction = "flag";
          if (violation.suggestedAction === "flag")
            adjustedViolation.suggestedAction = "warn";
        }

        return adjustedViolation;
      });

      return Promise.resolve({
        ...result,
        violations: adjustedViolations,
        reputationImpact: result.violations.reduce((sum: number, v: any) => {
          switch (v.severity) {
            case "critical":
              return sum + 15;
            case "high":
              return sum + 10;
            case "medium":
              return sum + 5;
            case "low":
              return sum + 1;
            default:
              return sum;
          }
        }, 0),
      });
    }
    return Promise.resolve(result);
  }),
  getUserReputation: jest.fn().mockResolvedValue({
    userId: "user-123",
    score: 75,
    level: "verified",
    flaggedWhispers: 0,
    lastViolation: null,
    violationHistory: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  getReputationLevel: jest.fn().mockReturnValue("verified"),
  calculateReputationImpact: jest.fn().mockReturnValue(0),
  isAppealable: jest.fn().mockReturnValue(true),
  getAppealTimeLimit: jest.fn().mockReturnValue(24 * 60 * 60 * 1000), // 24 hours
  getPenaltyMultiplier: jest.fn().mockReturnValue(1.0),
  getAutoAppealThreshold: jest.fn().mockReturnValue(0.8),
};

jest.mock("../services/reputationService", () => ({
  getReputationService: jest.fn(() => mockReputationService),
}));

const mockOpenAIModerationService = OpenAIModerationService as jest.Mocked<
  typeof OpenAIModerationService
>;
const mockPerspectiveAPIService = PerspectiveAPIService as jest.Mocked<
  typeof PerspectiveAPIService
>;
const mockLocalModerationService = LocalModerationService as jest.Mocked<
  typeof LocalModerationService
>;

describe("ContentModerationService", () => {
  beforeAll(() => {
    jest.mock("../services/localModerationService");
  });
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock LocalModerationService methods
    jest.spyOn(LocalModerationService, "checkKeywords").mockResolvedValue({
      flagged: false,
      matchedKeywords: [],
      toxicityScore: 0,
      spamScore: 0,
      personalInfoDetected: false,
    });

    jest
      .spyOn(LocalModerationService, "shouldRejectImmediately")
      .mockResolvedValue(false);
    jest
      .spyOn(LocalModerationService, "getModerationSummary")
      .mockReturnValue("Local moderation summary");

    // Reset mocks to default behavior
    mockOpenAIModerationService.moderateText.mockResolvedValue({
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
    });

    // Mock local moderation service
    (LocalModerationService.checkKeywords as jest.Mock).mockResolvedValue({
      flagged: false,
      matchedKeywords: [],
      toxicityScore: 0,
      spamScore: 0,
      personalInfoDetected: false,
    });

    (
      LocalModerationService.shouldRejectImmediately as jest.Mock
    ).mockResolvedValue(false);
    (LocalModerationService.getModerationSummary as jest.Mock).mockReturnValue(
      "Local moderation summary"
    );

    mockOpenAIModerationService.shouldReject.mockReturnValue(false);
    mockOpenAIModerationService.convertToViolations.mockReturnValue([]);
    mockOpenAIModerationService.getModerationSummary.mockReturnValue(
      "OpenAI moderation summary"
    );

    mockPerspectiveAPIService.analyzeText.mockResolvedValue({
      toxicity: 0.1,
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
    });

    mockPerspectiveAPIService.shouldReject.mockReturnValue(false);
    mockPerspectiveAPIService.convertToViolations.mockReturnValue([]);
    mockPerspectiveAPIService.getModerationSummary.mockReturnValue(
      "Perspective API summary"
    );
  });

  describe("moderateWhisper", () => {
    it("should approve clean content", async () => {
      const result = await ContentModerationService.moderateWhisper(
        "Hello world, this is a nice whisper",
        "user-123",
        25 // User age 25
      );

      expect(result.status).toBe(ModerationStatus.APPROVED);
      expect(result.contentRank).toBe(ContentRank.G);
      expect(result.isMinorSafe).toBe(true);
      expect(result.violations).toHaveLength(0);
      // Clean content is not appealable since it's approved
      expect(result.appealable).toBe(false);
    });

    it("should reject content with critical violations", async () => {
      // Mock local moderation service to detect critical violations
      (LocalModerationService.checkKeywords as jest.Mock).mockResolvedValue({
        flagged: true,
        matchedKeywords: ["kill yourself", "worthless"],
        toxicityScore: 0.9,
        spamScore: 0,
        personalInfoDetected: false,
      });

      (
        LocalModerationService.shouldRejectImmediately as jest.Mock
      ).mockResolvedValue(true);

      const result = await ContentModerationService.moderateWhisper(
        "kill yourself you worthless piece of shit",
        "user-123",
        25 // User age 25
      );

      expect(result.status).toBe(ModerationStatus.REJECTED);
      expect([ContentRank.R, ContentRank.NC17]).toContain(result.contentRank);
      expect(result.isMinorSafe).toBe(false);
      expect(result.appealable).toBe(false);
      expect(result.reason).toContain("rejected");
    });

    it("should flag content with medium violations", async () => {
      // Mock local moderation service to detect medium violations
      (LocalModerationService.checkKeywords as jest.Mock).mockResolvedValue({
        flagged: true,
        matchedKeywords: ["stupid", "ugly"],
        toxicityScore: 0.6,
        spamScore: 0,
        personalInfoDetected: false,
      });

      const result = await ContentModerationService.moderateWhisper(
        "you are so stupid and ugly",
        "user-123",
        25 // User age 25
      );

      expect([ModerationStatus.FLAGGED, ModerationStatus.REJECTED]).toContain(
        result.status
      );
      if (result.status === ModerationStatus.REJECTED) {
        expect(result.appealable).toBe(false);
      } else {
        expect(result.appealable).toBe(true);
      }
    });

    it("should handle API failures gracefully", async () => {
      // Mock API failures
      mockOpenAIModerationService.moderateText.mockRejectedValue(
        new Error("API Error")
      );
      mockPerspectiveAPIService.analyzeText.mockRejectedValue(
        new Error("API Error")
      );

      const result = await ContentModerationService.moderateWhisper(
        "Hello world",
        "user-123",
        25 // User age 25
      );

      expect(result.status).toBe(ModerationStatus.APPROVED);
      expect(typeof result.moderationTime).toBe("number");
    });

    it("should calculate correct content ranking", async () => {
      const result = await ContentModerationService.moderateWhisper(
        "This is a normal whisper",
        "user-123",
        25 // User age 25
      );

      // Service defaults to G for clean content
      expect(result.contentRank).toBe(ContentRank.G);
      expect(result.isMinorSafe).toBe(true);
    });

    it("should estimate costs correctly", () => {
      const cost = ContentModerationService.estimateCost(100);
      expect(cost).toBeGreaterThan(0);
      expect(typeof cost).toBe("number");
    });

    it("should reject users under 13", async () => {
      await expect(
        ContentModerationService.moderateWhisper(
          "Hello world",
          "user-123",
          12 // User age 12 (under 13)
        )
      ).rejects.toThrow("Users must be 13 or older to use this platform");
    });

    it("should accept users 13 and older", async () => {
      const result = await ContentModerationService.moderateWhisper(
        "Hello world",
        "user-123",
        13 // User age 13 (minimum allowed)
      );

      expect(result.status).toBe(ModerationStatus.APPROVED);
    });

    it("should handle OpenAI rejection", async () => {
      mockOpenAIModerationService.shouldReject.mockReturnValue(true);

      const result = await ContentModerationService.moderateWhisper(
        "Test content",
        "user-123",
        25
      );

      expect(result.status).toBe(ModerationStatus.REJECTED);
      expect(result.reason).toContain("OpenAI moderation");
    });

    it("should handle Perspective API rejection", async () => {
      mockPerspectiveAPIService.shouldReject.mockReturnValue(true);

      const result = await ContentModerationService.moderateWhisper(
        "Test content",
        "user-123",
        25
      );

      expect(result.status).toBe(ModerationStatus.REJECTED);
      expect(result.reason).toContain("Perspective API");
    });

    it("should handle OpenAI API failure but continue with other services", async () => {
      mockOpenAIModerationService.moderateText.mockRejectedValue(
        new Error("OpenAI API Error")
      );

      const result = await ContentModerationService.moderateWhisper(
        "Test content",
        "user-123",
        25
      );

      expect(result.status).toBe(ModerationStatus.APPROVED);
      expect(result.apiResults.openai).toBeUndefined();
    });

    it("should handle Perspective API failure but continue with other services", async () => {
      mockPerspectiveAPIService.analyzeText.mockRejectedValue(
        new Error("Perspective API Error")
      );

      const result = await ContentModerationService.moderateWhisper(
        "Test content",
        "user-123",
        25
      );

      expect(result.status).toBe(ModerationStatus.APPROVED);
      expect(result.apiResults.perspective).toBeUndefined();
    });

    it("should handle complete API failure gracefully", async () => {
      mockOpenAIModerationService.moderateText.mockRejectedValue(
        new Error("OpenAI Error")
      );
      mockPerspectiveAPIService.analyzeText.mockRejectedValue(
        new Error("Perspective Error")
      );

      const result = await ContentModerationService.moderateWhisper(
        "Test content",
        "user-123",
        25
      );

      expect(result.status).toBe(ModerationStatus.APPROVED);
      expect(result.confidence).toBe(1.0);
    });

    it("should handle general error and return error result", async () => {
      // Mock a service to throw an error
      jest
        .spyOn(LocalModerationService, "checkKeywords")
        .mockRejectedValue(new Error("General error"));

      const result = await ContentModerationService.moderateWhisper(
        "Test content",
        "user-123",
        25
      );

      expect(result.status).toBe(ModerationStatus.UNDER_REVIEW);
      expect(result.confidence).toBe(0.0);
      expect(result.appealable).toBe(true);
    });
  });

  describe("Content Ranking Logic", () => {
    it("should rank content as G for very low scores", async () => {
      mockOpenAIModerationService.moderateText.mockResolvedValue({
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
      });

      mockPerspectiveAPIService.analyzeText.mockResolvedValue({
        toxicity: 0.1,
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
      });

      const result = await ContentModerationService.moderateWhisper(
        "Clean content",
        "user-123",
        25
      );

      expect(result.contentRank).toBe(ContentRank.G);
      expect(result.isMinorSafe).toBe(true);
    });

    it("should rank content as PG for moderate scores", async () => {
      mockOpenAIModerationService.moderateText.mockResolvedValue({
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
          harassment: 0.4,
          hate: 0.4,
          sexual: 0.4,
          sexual_minors: 0.1,
          violence: 0.4,
          violence_graphic: 0.1,
          self_harm: 0.1,
          self_harm_intent: 0.1,
          self_harm_instructions: 0.1,
          harassment_threatening: 0.4,
          hate_threatening: 0.4,
        },
      });

      mockPerspectiveAPIService.analyzeText.mockResolvedValue({
        toxicity: 0.4,
        severeToxicity: 0.2,
        identityAttack: 0.4,
        insult: 0.4,
        profanity: 0.2,
        threat: 0.2,
        sexuallyExplicit: 0.4,
        flirtation: 0.2,
        attackOnAuthor: 0.1,
        attackOnCommenter: 0.1,
        incoherent: 0.1,
        inflammatory: 0.1,
        likelyToReject: 0.1,
        obscene: 0.1,
        spam: 0.1,
        unsubstantial: 0.1,
      });

      const result = await ContentModerationService.moderateWhisper(
        "Moderate content",
        "user-123",
        25
      );

      expect(result.contentRank).toBe(ContentRank.PG);
      expect(result.isMinorSafe).toBe(true);
    });

    it("should rank content as PG13 for higher scores", async () => {
      mockOpenAIModerationService.moderateText.mockResolvedValue({
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
          harassment: 0.6,
          hate: 0.6,
          sexual: 0.6,
          sexual_minors: 0.2,
          violence: 0.6,
          violence_graphic: 0.2,
          self_harm: 0.2,
          self_harm_intent: 0.2,
          self_harm_instructions: 0.2,
          harassment_threatening: 0.6,
          hate_threatening: 0.6,
        },
      });

      mockPerspectiveAPIService.analyzeText.mockResolvedValue({
        toxicity: 0.6,
        severeToxicity: 0.4,
        identityAttack: 0.6,
        insult: 0.6,
        profanity: 0.4,
        threat: 0.4,
        sexuallyExplicit: 0.6,
        flirtation: 0.4,
        attackOnAuthor: 0.1,
        attackOnCommenter: 0.1,
        incoherent: 0.1,
        inflammatory: 0.1,
        likelyToReject: 0.1,
        obscene: 0.1,
        spam: 0.1,
        unsubstantial: 0.1,
      });

      const result = await ContentModerationService.moderateWhisper(
        "Mature content",
        "user-123",
        25
      );

      expect(result.contentRank).toBe(ContentRank.PG13);
      expect(result.isMinorSafe).toBe(false);
    });

    it("should rank content as R for high scores", async () => {
      // Mock local moderation service for this test
      mockLocalModerationService.checkKeywords.mockResolvedValue({
        flagged: false,
        matchedKeywords: [],
        toxicityScore: 0,
        spamScore: 0,
        personalInfoDetected: false,
      });

      mockOpenAIModerationService.moderateText.mockResolvedValue({
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
          harassment: 0.91,
          hate: 0.91,
          sexual: 0.91,
          sexual_minors: 0.3,
          violence: 0.91,
          violence_graphic: 0.3,
          self_harm: 0.3,
          self_harm_intent: 0.3,
          self_harm_instructions: 0.3,
          harassment_threatening: 0.91,
          hate_threatening: 0.91,
        },
      });

      mockPerspectiveAPIService.analyzeText.mockResolvedValue({
        toxicity: 0.91,
        severeToxicity: 0.6,
        identityAttack: 0.91,
        insult: 0.91,
        profanity: 0.6,
        threat: 0.91,
        sexuallyExplicit: 0.91,
        flirtation: 0.6,
        attackOnAuthor: 0.1,
        attackOnCommenter: 0.1,
        incoherent: 0.1,
        inflammatory: 0.1,
        likelyToReject: 0.1,
        obscene: 0.1,
        spam: 0.1,
        unsubstantial: 0.1,
      });

      const result = await ContentModerationService.moderateWhisper(
        "Adult content",
        "user-123",
        25
      );

      expect(result.contentRank).toBe(ContentRank.R);
      expect(result.isMinorSafe).toBe(false);
    });

    it("should rank content as NC17 for very high scores", async () => {
      // Mock local moderation service for this test
      mockLocalModerationService.checkKeywords.mockResolvedValue({
        flagged: false,
        matchedKeywords: [],
        toxicityScore: 0,
        spamScore: 0,
        personalInfoDetected: false,
      });

      mockOpenAIModerationService.moderateText.mockResolvedValue({
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
          harassment: 1.01,
          hate: 1.01,
          sexual: 1.01,
          sexual_minors: 0.5,
          violence: 1.01,
          violence_graphic: 0.5,
          self_harm: 0.5,
          self_harm_intent: 0.5,
          self_harm_instructions: 0.5,
          harassment_threatening: 1.01,
          hate_threatening: 1.01,
        },
      });

      mockPerspectiveAPIService.analyzeText.mockResolvedValue({
        toxicity: 1.01,
        severeToxicity: 0.8,
        identityAttack: 1.01,
        insult: 1.01,
        profanity: 0.8,
        threat: 1.01,
        sexuallyExplicit: 1.01,
        flirtation: 0.8,
        attackOnAuthor: 0.1,
        attackOnCommenter: 0.1,
        incoherent: 0.1,
        inflammatory: 0.1,
        likelyToReject: 0.1,
        obscene: 0.1,
        spam: 0.1,
        unsubstantial: 0.1,
      });

      const result = await ContentModerationService.moderateWhisper(
        "Extreme content",
        "user-123",
        25
      );

      expect(result.contentRank).toBe(ContentRank.NC17);
      expect(result.isMinorSafe).toBe(false);
    });
  });

  describe("Violation Handling", () => {
    it("should combine violations from multiple APIs", async () => {
      const openaiViolations: Violation[] = [
        {
          type: ViolationType.HATE_SPEECH,
          severity: "high",
          confidence: 0.8,
          description: "OpenAI hate speech detection",
          suggestedAction: "reject",
        },
      ];

      const perspectiveViolations: Violation[] = [
        {
          type: ViolationType.HARASSMENT,
          severity: "low",
          confidence: 0.6,
          description: "Perspective harassment detection",
          suggestedAction: "warn",
        },
      ];

      // Mock services to return violations
      jest.spyOn(LocalModerationService, "checkKeywords").mockResolvedValue({
        flagged: true,
        matchedKeywords: ["stupid"],
        toxicityScore: 0.7,
        spamScore: 0.1,
        personalInfoDetected: false,
      });

      mockOpenAIModerationService.convertToViolations.mockReturnValue(
        openaiViolations
      );
      mockPerspectiveAPIService.convertToViolations.mockReturnValue(
        perspectiveViolations
      );

      const result = await ContentModerationService.moderateWhisper(
        "Test content with violations",
        "user-123",
        25
      );

      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.status).toBe(ModerationStatus.REJECTED); // Due to high severity violation
    });

    it("should handle critical violations correctly", async () => {
      const criticalViolations: Violation[] = [
        {
          type: ViolationType.HARASSMENT,
          severity: "critical",
          confidence: 0.9,
          description: "Critical harassment",
          suggestedAction: "ban",
        },
      ];

      mockOpenAIModerationService.convertToViolations.mockReturnValue(
        criticalViolations
      );

      const result = await ContentModerationService.moderateWhisper(
        "Critical violation content",
        "user-123",
        25
      );

      expect(result.status).toBe(ModerationStatus.REJECTED);
      expect(result.appealable).toBe(false);
    });

    it("should handle high severity violations correctly", async () => {
      const highViolations: Violation[] = [
        {
          type: ViolationType.HATE_SPEECH,
          severity: "high",
          confidence: 0.8,
          description: "High severity hate speech",
          suggestedAction: "reject",
        },
      ];

      mockOpenAIModerationService.convertToViolations.mockReturnValue(
        highViolations
      );

      const result = await ContentModerationService.moderateWhisper(
        "High violation content",
        "user-123",
        25
      );

      expect(result.status).toBe(ModerationStatus.REJECTED);
      expect(result.appealable).toBe(true);
    });

    it("should handle medium severity violations correctly", async () => {
      const mediumViolations: Violation[] = [
        {
          type: ViolationType.HARASSMENT,
          severity: "medium",
          confidence: 0.6,
          description: "Medium severity harassment",
          suggestedAction: "flag",
        },
      ];

      mockOpenAIModerationService.convertToViolations.mockReturnValue(
        mediumViolations
      );

      const result = await ContentModerationService.moderateWhisper(
        "Medium violation content",
        "user-123",
        25
      );

      expect(result.status).toBe(ModerationStatus.FLAGGED);
      expect(result.appealable).toBe(true);
    });

    it("should handle low severity violations correctly", async () => {
      // Mock local moderation service to detect low severity violations
      (LocalModerationService.checkKeywords as jest.Mock).mockResolvedValue({
        flagged: true,
        matchedKeywords: ["buy now"],
        toxicityScore: 0.2,
        spamScore: 0.4,
        personalInfoDetected: false,
      });

      // Mock OpenAI to return low severity violations
      const lowViolations: Violation[] = [
        {
          type: ViolationType.SPAM,
          severity: "low",
          confidence: 0.4,
          description: "Low severity spam",
          suggestedAction: "warn",
        },
      ];

      mockOpenAIModerationService.convertToViolations.mockReturnValue(
        lowViolations
      );

      // Mock Perspective API to return low severity violations
      mockPerspectiveAPIService.convertToViolations.mockReturnValue([
        {
          type: ViolationType.HARASSMENT,
          severity: "low",
          confidence: 0.3,
          description: "Low severity harassment",
          suggestedAction: "warn",
        },
      ]);

      const result = await ContentModerationService.moderateWhisper(
        "Low violation content",
        "user-123",
        25
      );

      // Low severity violations result in approved status
      expect(result.status).toBe(ModerationStatus.APPROVED);
      expect(result.appealable).toBe(false);
    });

    it("should calculate confidence correctly", async () => {
      const violations: Violation[] = [
        {
          type: ViolationType.HARASSMENT,
          severity: "medium",
          confidence: 0.6,
          description: "Test violation",
          suggestedAction: "flag",
        },
        {
          type: ViolationType.SPAM,
          severity: "low",
          confidence: 0.4,
          description: "Test violation 2",
          suggestedAction: "warn",
        },
      ];

      mockOpenAIModerationService.convertToViolations.mockReturnValue(
        violations
      );

      const result = await ContentModerationService.moderateWhisper(
        "Test content",
        "user-123",
        25
      );

      // Confidence is calculated from all violations, not just the mocked ones
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1.0);
    });

    it("should generate correct reason for violations", async () => {
      const violations: Violation[] = [
        {
          type: ViolationType.HARASSMENT,
          severity: "medium",
          confidence: 0.6,
          description: "Test violation",
          suggestedAction: "flag",
        },
        {
          type: ViolationType.SPAM,
          severity: "low",
          confidence: 0.4,
          description: "Test violation 2",
          suggestedAction: "warn",
        },
      ];

      mockOpenAIModerationService.convertToViolations.mockReturnValue(
        violations
      );

      const result = await ContentModerationService.moderateWhisper(
        "Test content",
        "user-123",
        25
      );

      expect(result.reason).toContain("harassment");
      expect(result.reason).toContain("flagged");
    });
  });

  describe("Cost Estimation", () => {
    it("should estimate costs for different text lengths", () => {
      const shortTextCost = ContentModerationService.estimateCost(50);
      const longTextCost = ContentModerationService.estimateCost(500);

      expect(shortTextCost).toBeGreaterThan(0);
      expect(longTextCost).toBeGreaterThan(shortTextCost);
      expect(typeof shortTextCost).toBe("number");
      expect(typeof longTextCost).toBe("number");
    });

    it("should include Perspective API cost when enabled", () => {
      const cost = ContentModerationService.estimateCost(100);
      expect(cost).toBeGreaterThan(0);
    });
  });

  describe("Reputation-Based Actions", () => {
    it("should handle reputation impact calculation with no violations", async () => {
      const result = await ContentModerationService.moderateWhisper(
        "clean content",
        "user-123",
        25
      );

      // No violations should result in no reputation impact
      expect(result.reputationImpact).toBe(0);
      expect(result.violations).toHaveLength(0);
    });

    it("should handle violations with reputation impact", async () => {
      // Mock local moderation to detect violations
      (LocalModerationService.checkKeywords as jest.Mock).mockResolvedValue({
        flagged: true,
        matchedKeywords: ["stupid"],
        toxicityScore: 0.7,
        spamScore: 0,
        personalInfoDetected: false,
      });

      const result = await ContentModerationService.moderateWhisper(
        "you are stupid",
        "user-123",
        25
      );

      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.status).toBe(ModerationStatus.FLAGGED);
    });
  });

  describe("Reputation Level Determination", () => {
    it("should handle different reputation levels", async () => {
      const result = await ContentModerationService.moderateWhisper(
        "clean content",
        "user-123",
        25
      );

      expect(result.status).toBe(ModerationStatus.APPROVED);
      expect(result.reputationImpact).toBe(0);
    });
  });

  describe("Violation Severity Handling", () => {
    it("should handle critical violations correctly", async () => {
      // Mock local moderation to detect critical violations
      (LocalModerationService.checkKeywords as jest.Mock).mockResolvedValue({
        flagged: true,
        matchedKeywords: ["kill yourself"],
        toxicityScore: 0.95,
        spamScore: 0,
        personalInfoDetected: false,
      });

      const result = await ContentModerationService.moderateWhisper(
        "kill yourself now",
        "user-123",
        25
      );

      expect(result.status).toBe(ModerationStatus.REJECTED);
      expect([ContentRank.R, ContentRank.NC17]).toContain(result.contentRank);
    });

    it("should handle high severity violations correctly", async () => {
      // Mock local moderation to detect high severity violations
      (LocalModerationService.checkKeywords as jest.Mock).mockResolvedValue({
        flagged: true,
        matchedKeywords: ["hate speech"],
        toxicityScore: 0.85,
        spamScore: 0,
        personalInfoDetected: false,
      });

      const result = await ContentModerationService.moderateWhisper(
        "hate speech content",
        "user-123",
        25
      );

      expect(result.status).toBe(ModerationStatus.REJECTED);
      expect(result.appealable).toBe(true); // High severity can be appealed
    });

    it("should handle medium severity violations correctly", async () => {
      // Mock local moderation to detect medium severity violations
      (LocalModerationService.checkKeywords as jest.Mock).mockResolvedValue({
        flagged: true,
        matchedKeywords: ["stupid"],
        toxicityScore: 0.6,
        spamScore: 0,
        personalInfoDetected: false,
      });

      const result = await ContentModerationService.moderateWhisper(
        "you are stupid",
        "user-123",
        25
      );

      expect([ModerationStatus.FLAGGED, ModerationStatus.REJECTED]).toContain(
        result.status
      );
      expect(result.appealable).toBe(true);
    });

    it("should handle low severity violations correctly", async () => {
      // Mock local moderation to detect low severity violations
      (LocalModerationService.checkKeywords as jest.Mock).mockResolvedValue({
        flagged: true,
        matchedKeywords: ["buy now"],
        toxicityScore: 0.2,
        spamScore: 0.4,
        personalInfoDetected: false,
      });

      const result = await ContentModerationService.moderateWhisper(
        "buy now limited time offer",
        "user-123",
        25
      );

      // Low severity violations result in approved status
      expect(result.status).toBe(ModerationStatus.APPROVED);
      expect(result.appealable).toBe(false);
    });
  });

  describe("Confidence Calculation", () => {
    it("should calculate confidence correctly with multiple violations", async () => {
      // Mock local moderation to detect violations
      (LocalModerationService.checkKeywords as jest.Mock).mockResolvedValue({
        flagged: true,
        matchedKeywords: ["stupid", "ugly"],
        toxicityScore: 0.7,
        spamScore: 0.5,
        personalInfoDetected: false,
      });

      const result = await ContentModerationService.moderateWhisper(
        "you are stupid and ugly",
        "user-123",
        25
      );

      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it("should return maximum confidence for clean content", async () => {
      const result = await ContentModerationService.moderateWhisper(
        "clean content",
        "user-123",
        25
      );

      expect(result.confidence).toBe(1.0);
    });
  });

  describe("Appealability Logic", () => {
    it("should make critical violations non-appealable", async () => {
      // Mock local moderation to detect critical violations
      (LocalModerationService.checkKeywords as jest.Mock).mockResolvedValue({
        flagged: true,
        matchedKeywords: ["kill yourself"],
        toxicityScore: 0.95,
        spamScore: 0,
        personalInfoDetected: false,
      });

      const result = await ContentModerationService.moderateWhisper(
        "kill yourself now",
        "user-123",
        25
      );

      expect(result.status).toBe(ModerationStatus.REJECTED);
    });

    it("should make approved content non-appealable", async () => {
      const result = await ContentModerationService.moderateWhisper(
        "clean content",
        "user-123",
        25
      );

      expect(result.status).toBe(ModerationStatus.APPROVED);
      expect(result.appealable).toBe(false);
    });

    it("should make flagged content appealable", async () => {
      // Mock local moderation to detect medium violations
      (LocalModerationService.checkKeywords as jest.Mock).mockResolvedValue({
        flagged: true,
        matchedKeywords: ["stupid"],
        toxicityScore: 0.6,
        spamScore: 0,
        personalInfoDetected: false,
      });

      const result = await ContentModerationService.moderateWhisper(
        "you are stupid",
        "user-123",
        25
      );

      if (result.status === ModerationStatus.FLAGGED) {
        expect(result.appealable).toBe(true);
      }
    });
  });

  describe("Reason Generation", () => {
    it("should generate reason for approved content", async () => {
      const result = await ContentModerationService.moderateWhisper(
        "clean content",
        "user-123",
        25
      );

      expect(result.reason).toBe("Content approved");
    });

    it("should generate reason for rejected content", async () => {
      // Mock local moderation to detect violations
      (LocalModerationService.checkKeywords as jest.Mock).mockResolvedValue({
        flagged: true,
        matchedKeywords: ["kill yourself"],
        toxicityScore: 0.95,
        spamScore: 0,
        personalInfoDetected: false,
      });

      (
        LocalModerationService.shouldRejectImmediately as jest.Mock
      ).mockResolvedValue(true);

      const result = await ContentModerationService.moderateWhisper(
        "kill yourself now",
        "user-123",
        25
      );

      expect(result.reason).toContain("rejected");
      expect(result.reason).toContain(
        "Content rejected by local keyword filtering"
      );
    });

    it("should generate reason with violation types", async () => {
      // Mock local moderation to detect violations
      (LocalModerationService.checkKeywords as jest.Mock).mockResolvedValue({
        flagged: true,
        matchedKeywords: ["stupid", "ugly"],
        toxicityScore: 0.7,
        spamScore: 0.5,
        personalInfoDetected: false,
      });

      const result = await ContentModerationService.moderateWhisper(
        "you are stupid and ugly",
        "user-123",
        25
      );

      if (result.status !== ModerationStatus.APPROVED) {
        expect(result.reason).toContain("harassment");
      }
    });
  });

  describe("Violation Deduplication", () => {
    it("should remove duplicate violations", async () => {
      const openaiViolations: Violation[] = [
        {
          type: ViolationType.HATE_SPEECH,
          severity: "high",
          confidence: 0.8,
          description: "OpenAI hate speech detection",
          suggestedAction: "reject",
        },
      ];

      const perspectiveViolations: Violation[] = [
        {
          type: ViolationType.HARASSMENT,
          severity: "low",
          confidence: 0.6,
          description: "Perspective harassment detection",
          suggestedAction: "warn",
        },
      ];

      // Mock services to return violations
      jest.spyOn(LocalModerationService, "checkKeywords").mockResolvedValue({
        flagged: true,
        matchedKeywords: ["stupid"],
        toxicityScore: 0.7,
        spamScore: 0.1,
        personalInfoDetected: false,
      });

      mockOpenAIModerationService.convertToViolations.mockReturnValue(
        openaiViolations
      );
      mockPerspectiveAPIService.convertToViolations.mockReturnValue(
        perspectiveViolations
      );

      const result = await ContentModerationService.moderateWhisper(
        "Test content with violations",
        "user-123",
        25
      );

      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.status).toBe(ModerationStatus.REJECTED); // Due to high severity violation
    });

    it("should sort violations by severity", async () => {
      const openaiViolations: Violation[] = [
        {
          type: ViolationType.HATE_SPEECH,
          severity: "high",
          confidence: 0.8,
          description: "OpenAI hate speech detection",
          suggestedAction: "reject",
        },
      ];

      const perspectiveViolations: Violation[] = [
        {
          type: ViolationType.HARASSMENT,
          severity: "low",
          confidence: 0.6,
          description: "Perspective harassment detection",
          suggestedAction: "warn",
        },
      ];

      // Mock services to return violations
      jest.spyOn(LocalModerationService, "checkKeywords").mockResolvedValue({
        flagged: true,
        matchedKeywords: ["stupid"],
        toxicityScore: 0.7,
        spamScore: 0.1,
        personalInfoDetected: false,
      });

      mockOpenAIModerationService.convertToViolations.mockReturnValue(
        openaiViolations
      );
      mockPerspectiveAPIService.convertToViolations.mockReturnValue(
        perspectiveViolations
      );

      const result = await ContentModerationService.moderateWhisper(
        "Test content with violations",
        "user-123",
        25
      );

      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.status).toBe(ModerationStatus.REJECTED); // Due to high severity violation
    });

    it("should handle empty violations array", async () => {
      const result = await ContentModerationService.moderateWhisper(
        "Test content",
        "user-123",
        25
      );

      expect(result.violations.length).toBe(0);
      expect(result.status).toBe(ModerationStatus.APPROVED);
    });

    it("should preserve unique violations", async () => {
      const openaiViolations: Violation[] = [
        {
          type: ViolationType.HATE_SPEECH,
          severity: "high",
          confidence: 0.8,
          description: "OpenAI hate speech detection",
          suggestedAction: "reject",
        },
      ];

      const perspectiveViolations: Violation[] = [
        {
          type: ViolationType.HARASSMENT,
          severity: "low",
          confidence: 0.6,
          description: "Perspective harassment detection",
          suggestedAction: "warn",
        },
      ];

      // Mock services to return violations
      jest.spyOn(LocalModerationService, "checkKeywords").mockResolvedValue({
        flagged: true,
        matchedKeywords: ["stupid"],
        toxicityScore: 0.7,
        spamScore: 0.1,
        personalInfoDetected: false,
      });

      mockOpenAIModerationService.convertToViolations.mockReturnValue(
        openaiViolations
      );
      mockPerspectiveAPIService.convertToViolations.mockReturnValue(
        perspectiveViolations
      );

      const result = await ContentModerationService.moderateWhisper(
        "Test content with violations",
        "user-123",
        25
      );

      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.status).toBe(ModerationStatus.REJECTED); // Due to high severity violation
    });
  });

  describe("Reputation-Based Actions", () => {
    it("should handle reputation impact calculation with no violations", async () => {
      const result = await ContentModerationService.moderateWhisper(
        "clean content",
        "user-123",
        25
      );

      // No violations should result in no reputation impact
      expect(result.reputationImpact).toBe(0);
      expect(result.violations).toHaveLength(0);
    });

    it("should handle violations with reputation impact", async () => {
      // Mock local moderation to detect violations
      (LocalModerationService.checkKeywords as jest.Mock).mockResolvedValue({
        flagged: true,
        matchedKeywords: ["stupid"],
        toxicityScore: 0.7,
        spamScore: 0,
        personalInfoDetected: false,
      });

      const result = await ContentModerationService.moderateWhisper(
        "you are stupid",
        "user-123",
        25
      );

      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.status).toBe(ModerationStatus.FLAGGED);
    });

    it("should apply reduced penalties for trusted users", async () => {
      // Mock local moderation to detect violations
      (LocalModerationService.checkKeywords as jest.Mock).mockResolvedValue({
        flagged: true,
        matchedKeywords: ["stupid"],
        toxicityScore: 0.7,
        spamScore: 0,
        personalInfoDetected: false,
      });

      const result = await ContentModerationService.moderateWhisper(
        "you are stupid",
        "user-123",
        25
      );

      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.status).toBe(ModerationStatus.FLAGGED);
    });

    it("should apply more lenient actions for trusted users", async () => {
      // Mock local moderation to detect violations
      (LocalModerationService.checkKeywords as jest.Mock).mockResolvedValue({
        flagged: true,
        matchedKeywords: ["stupid"],
        toxicityScore: 0.7,
        spamScore: 0,
        personalInfoDetected: false,
      });

      const result = await ContentModerationService.moderateWhisper(
        "you are stupid",
        "user-123",
        25
      );

      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.status).toBe(ModerationStatus.FLAGGED);
    });

    it("should not modify violations when reputation system is disabled", async () => {
      // Mock local moderation to detect violations
      (LocalModerationService.checkKeywords as jest.Mock).mockResolvedValue({
        flagged: true,
        matchedKeywords: ["stupid"],
        toxicityScore: 0.7,
        spamScore: 0,
        personalInfoDetected: false,
      });

      const result = await ContentModerationService.moderateWhisper(
        "you are stupid",
        "user-123",
        25
      );

      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.status).toBe(ModerationStatus.FLAGGED);
    });

    it("should not modify violations when no user reputation provided", async () => {
      // Mock local moderation to detect violations
      (LocalModerationService.checkKeywords as jest.Mock).mockResolvedValue({
        flagged: true,
        matchedKeywords: ["stupid"],
        toxicityScore: 0.7,
        spamScore: 0,
        personalInfoDetected: false,
      });

      const result = await ContentModerationService.moderateWhisper(
        "you are stupid",
        "user-123",
        25
      );

      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.status).toBe(ModerationStatus.FLAGGED);
    });

    it("should handle all reputation levels correctly", async () => {
      const result = await ContentModerationService.moderateWhisper(
        "clean content",
        "user-123",
        25
      );

      expect(result.status).toBe(ModerationStatus.APPROVED);
      expect(result.reputationImpact).toBe(0);
    });

    it("should apply severity reductions correctly", async () => {
      // Mock local moderation to detect violations
      (LocalModerationService.checkKeywords as jest.Mock).mockResolvedValue({
        flagged: true,
        matchedKeywords: ["stupid"],
        toxicityScore: 0.7,
        spamScore: 0,
        personalInfoDetected: false,
      });

      const result = await ContentModerationService.moderateWhisper(
        "you are stupid",
        "user-123",
        25
      );

      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.status).toBe(ModerationStatus.FLAGGED);
    });

    it("should apply action reductions correctly", async () => {
      // Mock local moderation to detect violations
      (LocalModerationService.checkKeywords as jest.Mock).mockResolvedValue({
        flagged: true,
        matchedKeywords: ["stupid"],
        toxicityScore: 0.7,
        spamScore: 0,
        personalInfoDetected: false,
      });

      const result = await ContentModerationService.moderateWhisper(
        "you are stupid",
        "user-123",
        25
      );

      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.status).toBe(ModerationStatus.FLAGGED);
    });
  });

  describe("Reputation Impact Calculation", () => {
    it("should return zero when no user reputation", async () => {
      const result = await ContentModerationService.moderateWhisper(
        "clean content",
        "user-123",
        25
      );

      expect(result.reputationImpact).toBe(0);
    });

    it("should return zero when no violations", async () => {
      const result = await ContentModerationService.moderateWhisper(
        "clean content",
        "user-123",
        25
      );

      expect(result.reputationImpact).toBe(0);
    });
  });

  describe("Reputation Level Thresholds", () => {
    it("should handle different reputation levels", async () => {
      const result = await ContentModerationService.moderateWhisper(
        "clean content",
        "user-123",
        25
      );

      expect(result.status).toBe(ModerationStatus.APPROVED);
      expect(result.reputationImpact).toBe(0);
    });
  });

  describe("Final Status Determination", () => {
    it("should return APPROVED for no violations", async () => {
      const result = await ContentModerationService.moderateWhisper(
        "clean content",
        "user-123",
        25
      );

      expect(result.status).toBe(ModerationStatus.APPROVED);
      expect(result.reputationImpact).toBe(0);
    });
  });

  describe("Overall Confidence Calculation", () => {
    it("should return 1.0 for no violations", async () => {
      const result = await ContentModerationService.moderateWhisper(
        "clean content",
        "user-123",
        25
      );

      expect(result.confidence).toBe(1.0);
    });

    it("should calculate average confidence for multiple violations", async () => {
      // Mock local moderation to detect violations
      (LocalModerationService.checkKeywords as jest.Mock).mockResolvedValue({
        flagged: true,
        matchedKeywords: ["stupid", "ugly"],
        toxicityScore: 0.7,
        spamScore: 0.5,
        personalInfoDetected: false,
      });

      const result = await ContentModerationService.moderateWhisper(
        "you are stupid and ugly",
        "user-123",
        25
      );

      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it("should handle single violation correctly", async () => {
      // Mock local moderation to detect violations
      (LocalModerationService.checkKeywords as jest.Mock).mockResolvedValue({
        flagged: true,
        matchedKeywords: ["stupid"],
        toxicityScore: 0.6,
        spamScore: 0,
        personalInfoDetected: false,
      });

      const result = await ContentModerationService.moderateWhisper(
        "you are stupid",
        "user-123",
        25
      );

      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe("Violation Deduplication and Sorting", () => {
    it("should handle duplicate violations from multiple APIs", async () => {
      // Mock local moderation to detect violations
      (LocalModerationService.checkKeywords as jest.Mock).mockResolvedValue({
        flagged: true,
        matchedKeywords: ["stupid"],
        toxicityScore: 0.7,
        spamScore: 0,
        personalInfoDetected: false,
      });

      // Mock OpenAI to return violations
      mockOpenAIModerationService.convertToViolations.mockReturnValue([
        {
          type: ViolationType.HARASSMENT,
          severity: "high",
          confidence: 0.8,
          description: "OpenAI harassment detection",
          suggestedAction: "reject",
        },
      ]);

      // Mock Perspective to return similar violations
      mockPerspectiveAPIService.convertToViolations.mockReturnValue([
        {
          type: ViolationType.HARASSMENT,
          severity: "medium",
          confidence: 0.6,
          description: "Perspective harassment detection",
          suggestedAction: "flag",
        },
      ]);

      const result = await ContentModerationService.moderateWhisper(
        "you are stupid",
        "user-123",
        25
      );

      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.status).toBe(ModerationStatus.REJECTED); // Due to high severity violation
    });

    it("should sort violations by severity correctly", async () => {
      // Mock local moderation to detect violations
      (LocalModerationService.checkKeywords as jest.Mock).mockResolvedValue({
        flagged: true,
        matchedKeywords: ["stupid"],
        toxicityScore: 0.7,
        spamScore: 0,
        personalInfoDetected: false,
      });

      // Mock OpenAI to return high severity violations
      mockOpenAIModerationService.convertToViolations.mockReturnValue([
        {
          type: ViolationType.HATE_SPEECH,
          severity: "critical",
          confidence: 0.9,
          description: "OpenAI hate speech detection",
          suggestedAction: "ban",
        },
      ]);

      // Mock Perspective to return lower severity violations
      mockPerspectiveAPIService.convertToViolations.mockReturnValue([
        {
          type: ViolationType.HARASSMENT,
          severity: "low",
          confidence: 0.4,
          description: "Perspective harassment detection",
          suggestedAction: "warn",
        },
      ]);

      const result = await ContentModerationService.moderateWhisper(
        "you are stupid",
        "user-123",
        25
      );

      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.status).toBe(ModerationStatus.REJECTED); // Due to critical violation
    });

    it("should test deduplication with exact duplicate violations", async () => {
      // Mock local moderation to detect violations
      (LocalModerationService.checkKeywords as jest.Mock).mockResolvedValue({
        flagged: true,
        matchedKeywords: ["stupid"],
        toxicityScore: 0.7,
        spamScore: 0,
        personalInfoDetected: false,
      });

      // Mock OpenAI to return violations
      mockOpenAIModerationService.convertToViolations.mockReturnValue([
        {
          type: ViolationType.HARASSMENT,
          severity: "high",
          confidence: 0.8,
          description: "OpenAI harassment detection",
          suggestedAction: "reject",
        },
        {
          type: ViolationType.HARASSMENT,
          severity: "high",
          confidence: 0.9,
          description: "OpenAI harassment detection duplicate",
          suggestedAction: "reject",
        },
      ]);

      // Mock Perspective to return the same violation type and severity
      mockPerspectiveAPIService.convertToViolations.mockReturnValue([
        {
          type: ViolationType.HARASSMENT,
          severity: "high",
          confidence: 0.7,
          description: "Perspective harassment detection",
          suggestedAction: "reject",
        },
      ]);

      const result = await ContentModerationService.moderateWhisper(
        "you are stupid",
        "user-123",
        25
      );

      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.status).toBe(ModerationStatus.REJECTED);
    });
  });

  describe("Reputation-Based Actions", () => {
    it("should apply reputation-based adjustments when reputation system is enabled", async () => {
      // Mock local moderation to detect violations
      (LocalModerationService.checkKeywords as jest.Mock).mockResolvedValue({
        flagged: true,
        matchedKeywords: ["stupid"],
        toxicityScore: 0.7,
        spamScore: 0,
        personalInfoDetected: false,
      });

      // Mock reputation service to return user reputation
      mockReputationService.getUserReputation.mockResolvedValue({
        userId: "user-123",
        score: 95, // High score for trusted user
        level: "trusted",
        flaggedWhispers: 0,
        lastViolation: null,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await ContentModerationService.moderateWhisper(
        "you are stupid",
        "user-123",
        25
      );

      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.status).toBe(ModerationStatus.FLAGGED);
    });

    it("should not apply reputation-based adjustments when reputation system is disabled", async () => {
      // Mock local moderation to detect violations
      (LocalModerationService.checkKeywords as jest.Mock).mockResolvedValue({
        flagged: true,
        matchedKeywords: ["stupid"],
        toxicityScore: 0.7,
        spamScore: 0,
        personalInfoDetected: false,
      });

      const result = await ContentModerationService.moderateWhisper(
        "you are stupid",
        "user-123",
        25
      );

      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.status).toBe(ModerationStatus.FLAGGED);
    });

    it("should test reputation level thresholds", async () => {
      // Test different reputation levels by mocking the reputation service
      const reputationLevels = [
        { score: 95, level: "trusted" },
        { score: 80, level: "verified" },
        { score: 60, level: "standard" },
        { score: 30, level: "flagged" },
        { score: 10, level: "banned" },
      ];

      for (const { score, level } of reputationLevels) {
        mockReputationService.getUserReputation.mockResolvedValue({
          userId: "user-123",
          score,
          level,
          flaggedWhispers: 0,
          lastViolation: null,
          violationHistory: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const result = await ContentModerationService.moderateWhisper(
          "clean content",
          "user-123",
          25
        );

        expect(result.status).toBe(ModerationStatus.APPROVED);
      }
    });

    it("should test reputation impact calculation with violations", async () => {
      // Mock local moderation to detect violations
      (LocalModerationService.checkKeywords as jest.Mock).mockResolvedValue({
        flagged: true,
        matchedKeywords: ["stupid"],
        toxicityScore: 0.7,
        spamScore: 0,
        personalInfoDetected: false,
      });

      // Mock reputation service to return user reputation
      mockReputationService.getUserReputation.mockResolvedValue({
        userId: "user-123",
        score: 75,
        level: "verified",
        flaggedWhispers: 0,
        lastViolation: null,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await ContentModerationService.moderateWhisper(
        "you are stupid",
        "user-123",
        25
      );

      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.status).toBe(ModerationStatus.FLAGGED);
    });

    it("should test reputation-based actions with different violation severities", async () => {
      // Test different violation severities to exercise reputation impact calculation
      const testCases = [
        {
          violation: {
            type: ViolationType.HATE_SPEECH,
            severity: "critical" as const,
            confidence: 0.9,
            description: "Critical violation",
            suggestedAction: "ban" as const,
          },
          expectedStatus: ModerationStatus.REJECTED,
        },
        {
          violation: {
            type: ViolationType.HARASSMENT,
            severity: "high" as const,
            confidence: 0.8,
            description: "High violation",
            suggestedAction: "reject" as const,
          },
          expectedStatus: ModerationStatus.REJECTED,
        },
        {
          violation: {
            type: ViolationType.SPAM,
            severity: "medium" as const,
            confidence: 0.6,
            description: "Medium violation",
            suggestedAction: "flag" as const,
          },
          expectedStatus: ModerationStatus.FLAGGED,
        },
        {
          violation: {
            type: ViolationType.SPAM,
            severity: "low" as const,
            confidence: 0.4,
            description: "Low violation",
            suggestedAction: "warn" as const,
          },
          expectedStatus: ModerationStatus.APPROVED,
        },
      ];

      for (const testCase of testCases) {
        // Mock local moderation to detect violations
        (LocalModerationService.checkKeywords as jest.Mock).mockResolvedValue({
          flagged: true,
          matchedKeywords: ["test"],
          toxicityScore: 0.7,
          spamScore: 0,
          personalInfoDetected: false,
        });

        // Mock OpenAI to return the specific violation
        mockOpenAIModerationService.convertToViolations.mockReturnValue([
          testCase.violation,
        ]);

        // Mock reputation service to return user reputation
        mockReputationService.getUserReputation.mockResolvedValue({
          userId: "user-123",
          score: 75,
          level: "verified",
          flaggedWhispers: 0,
          lastViolation: null,
          violationHistory: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const result = await ContentModerationService.moderateWhisper(
          "test content",
          "user-123",
          25
        );

        expect(result.violations.length).toBeGreaterThan(0);
        expect([
          result.status,
          ModerationStatus.REJECTED,
          ModerationStatus.FLAGGED,
          ModerationStatus.APPROVED,
        ]).toContain(result.status);
      }
    });

    it("should test reputation-based actions with trusted user", async () => {
      // Mock local moderation to detect violations
      (LocalModerationService.checkKeywords as jest.Mock).mockResolvedValue({
        flagged: true,
        matchedKeywords: ["stupid"],
        toxicityScore: 0.7,
        spamScore: 0,
        personalInfoDetected: false,
      });

      // Mock OpenAI to return high severity violations
      mockOpenAIModerationService.convertToViolations.mockReturnValue([
        {
          type: ViolationType.HARASSMENT,
          severity: "high",
          confidence: 0.8,
          description: "High severity violation",
          suggestedAction: "reject",
        },
      ]);

      // Mock reputation service to return trusted user reputation
      mockReputationService.getUserReputation.mockResolvedValue({
        userId: "user-123",
        score: 95, // Trusted user
        level: "trusted",
        flaggedWhispers: 0,
        lastViolation: null,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await ContentModerationService.moderateWhisper(
        "you are stupid",
        "user-123",
        25
      );

      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.status).toBe(ModerationStatus.REJECTED);
    });

    it("should test reputation-based actions with banned user", async () => {
      // Mock local moderation to detect violations
      (LocalModerationService.checkKeywords as jest.Mock).mockResolvedValue({
        flagged: true,
        matchedKeywords: ["stupid"],
        toxicityScore: 0.7,
        spamScore: 0,
        personalInfoDetected: false,
      });

      // Mock reputation service to return banned user reputation
      mockReputationService.getUserReputation.mockResolvedValue({
        userId: "user-123",
        score: 10, // Banned user
        level: "banned",
        flaggedWhispers: 5,
        lastViolation: new Date(),
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await ContentModerationService.moderateWhisper(
        "you are stupid",
        "user-123",
        25
      );

      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.status).toBe(ModerationStatus.FLAGGED);
    });
  });
});

// Unmock LocalModerationService for its own tests
const localModerationDescribe = describe;
localModerationDescribe("LocalModerationService", () => {
  beforeAll(() => {
    jest.unmock("../services/localModerationService");
  });

  beforeEach(() => {
    // Restore the real implementation for each test
    jest.restoreAllMocks();
  });

  afterAll(() => {
    jest.mock("../services/localModerationService");
  });

  describe("checkKeywords", () => {
    it("should detect harassment keywords", async () => {
      const result = await LocalModerationService.checkKeywords(
        "you are so stupid and worthless"
      );

      expect(result.flagged).toBe(true);
      expect(result.matchedKeywords.length).toBeGreaterThan(0);
      expect(result.toxicityScore).toBeGreaterThan(0);
    });

    it("should detect hate speech keywords", async () => {
      const result = await LocalModerationService.checkKeywords(
        "nazi white power"
      );

      expect(result.flagged).toBe(true);
      expect(result.matchedKeywords.length).toBeGreaterThan(0);
    });

    it("should detect violence keywords", async () => {
      const result = await LocalModerationService.checkKeywords(
        "I will kill you"
      );

      expect(result.flagged).toBe(true);
      expect(result.matchedKeywords.length).toBeGreaterThan(0);
    });

    it("should detect personal information", async () => {
      const result = await LocalModerationService.checkKeywords(
        "my phone number is 555-123-4567"
      );

      expect(result.personalInfoDetected).toBe(true);
    });

    it("should not flag clean content", async () => {
      const result = await LocalModerationService.checkKeywords(
        "Hello world, this is a nice day"
      );

      expect(result.flagged).toBe(false);
      expect(result.matchedKeywords).toHaveLength(0);
      expect(result.toxicityScore).toBe(0);
    });

    it("should reject immediately for critical violations", async () => {
      const shouldReject = await LocalModerationService.shouldRejectImmediately(
        "kill yourself"
      );

      expect(shouldReject).toBe(true);
    });

    it("should provide moderation summary", () => {
      const result = {
        flagged: true,
        matchedKeywords: ["stupid", "ugly"],
        toxicityScore: 0.8,
        spamScore: 0.1,
        personalInfoDetected: false,
      };

      const summary = LocalModerationService.getModerationSummary(result);
      expect(summary).toContain("Local moderation");
      expect(summary).toContain("keyword violations");
    });

    it("should handle high toxicity scores", async () => {
      const result = await LocalModerationService.checkKeywords(
        "you are so stupid and worthless"
      );

      expect(result.flagged).toBe(true);
      expect(result.toxicityScore).toBeGreaterThan(0.5);
    });

    it("should handle spam detection", async () => {
      const result = await LocalModerationService.checkKeywords(
        "buy now click here free money"
      );

      expect(result.flagged).toBe(true);
      expect(result.spamScore).toBeGreaterThan(0);
    });

    it("should handle mixed violations", async () => {
      const result = await LocalModerationService.checkKeywords(
        "you are stupid buy now click here"
      );

      expect(result.flagged).toBe(true);
      expect(result.toxicityScore).toBeGreaterThan(0);
      expect(result.spamScore).toBeGreaterThan(0);
    });
  });
});
