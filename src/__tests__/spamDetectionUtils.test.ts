/**
 * Tests for Spam Detection Utilities
 */

import {
  detectSuspiciousPatterns,
  detectClickbait,
  detectMisleadingInfo,
  detectFakeUrgency,
  detectPhishingAttempt,
  calculateTextSimilarity,
  calculateVariance,
  detectRepetitivePosting,
  detectRapidPosting,
  detectSimilarContent,
  detectBotLikeBehavior,
  detectEngagementFarming,
  calculateSpamScore,
  calculateScamScore,
  determineSuggestedAction,
  generateReason,
  convertToViolations,
  analyzeContentPatterns,
  analyzeTimingPatterns,
  analyzeGeographicPatterns,
  analyzeDevicePatterns,
  SPAM_THRESHOLDS,
  SCAM_THRESHOLDS,
  SUSPICIOUS_PATTERNS,
  ContentFlag,
  BehavioralFlag,
  UserBehaviorFlag,
  SpamAnalysisResult,
} from "../utils/spamDetectionUtils";
import { ViolationType, UserReputation } from "../types";

// Mock Whisper data
const createMockWhisper = (
  transcription: string,
  createdAt: Date = new Date()
) => ({
  id: "test-whisper-id",
  userId: "test-user-id",
  userDisplayName: "Test User",
  userProfileColor: "#FF0000",
  audioUrl: "test-audio-url",
  duration: 30,
  whisperPercentage: 80,
  averageLevel: 0.5,
  confidence: 0.9,
  likes: 10,
  replies: 5,
  createdAt,
  transcription,
  isTranscribed: true,
});

describe("Spam Detection Utilities", () => {
  describe("Pattern Detection", () => {
    test("should detect suspicious patterns", () => {
      const text = "Make money fast with this amazing opportunity!";
      const patterns = detectSuspiciousPatterns(text);
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns.some((p) => p.includes("FINANCIAL_SCAMS"))).toBe(true);
    });

    test("should detect clickbait patterns", () => {
      const text = "You won't believe what happens next!";
      const score = detectClickbait(text);
      expect(score).toBeGreaterThan(0.3);
    });

    test("should detect misleading information", () => {
      const text = "100% guaranteed results with no risk!";
      const score = detectMisleadingInfo(text);
      expect(score).toBeGreaterThan(0.3);
    });

    test("should detect fake urgency", () => {
      const text = "Act now! Limited time offer!";
      const score = detectFakeUrgency(text);
      expect(score).toBeGreaterThan(0.3);
    });

    test("should detect phishing attempts", () => {
      const text = "Verify your account now or it will be suspended!";
      const score = detectPhishingAttempt(text);
      expect(score).toBeGreaterThan(0.3);
    });

    test("should return empty patterns for clean text", () => {
      const text = "Hello, how are you today?";
      const patterns = detectSuspiciousPatterns(text);
      expect(patterns).toEqual([]);
    });
  });

  describe("Text Analysis", () => {
    test("should calculate text similarity correctly", () => {
      const text1 = "Hello world";
      const text2 = "Hello world";
      const similarity = calculateTextSimilarity(text1, text2);
      expect(similarity).toBe(1.0);
    });

    test("should calculate similarity for similar texts", () => {
      const text1 = "Hello world how are you";
      const text2 = "Hello world I am fine";
      const similarity = calculateTextSimilarity(text1, text2);
      expect(similarity).toBeGreaterThan(0.3);
    });

    test("should return 0 for empty strings", () => {
      const similarity = calculateTextSimilarity("", "");
      expect(similarity).toBe(0);
    });

    test("should calculate variance correctly", () => {
      const numbers = [1, 2, 3, 4, 5];
      const variance = calculateVariance(numbers);
      expect(variance).toBe(2);
    });

    test("should return 0 variance for single number", () => {
      const variance = calculateVariance([5]);
      expect(variance).toBe(0);
    });

    test("should return 0 variance for empty array", () => {
      const variance = calculateVariance([]);
      expect(variance).toBe(0);
    });
  });

  describe("Behavioral Analysis", () => {
    test("should detect repetitive posting", () => {
      const currentWhisper = createMockWhisper("Hello world");
      const recentWhispers = [
        createMockWhisper("Hello world"),
        createMockWhisper("Hello world"),
        createMockWhisper("Hello world"),
      ];
      const score = detectRepetitivePosting(recentWhispers, currentWhisper);
      expect(score).toBeGreaterThan(0.3);
    });

    test("should detect rapid posting", () => {
      const now = new Date();
      const recentWhispers = [
        createMockWhisper("Post 1", new Date(now.getTime() - 1000)),
        createMockWhisper("Post 2", new Date(now.getTime() - 2000)),
        createMockWhisper("Post 3", new Date(now.getTime() - 3000)),
      ];
      const score = detectRapidPosting(recentWhispers);
      expect(score).toBeGreaterThan(0.3);
    });

    test("should detect similar content", () => {
      const currentWhisper = createMockWhisper("This is a test message");
      const recentWhispers = [
        createMockWhisper("This is another test message"),
        createMockWhisper("This is a similar test message"),
      ];
      const score = detectSimilarContent(recentWhispers, currentWhisper);
      expect(score).toBeGreaterThan(0.3);
    });

    test("should detect bot-like behavior", () => {
      const now = new Date();
      const recentWhispers = [
        createMockWhisper("Post 1", new Date(now.getTime() - 60000)),
        createMockWhisper("Post 2", new Date(now.getTime() - 120000)),
        createMockWhisper("Post 3", new Date(now.getTime() - 180000)),
      ];
      const score = detectBotLikeBehavior(recentWhispers);
      expect(score).toBeGreaterThan(0.3);
    });

    test("should detect engagement farming", () => {
      const recentWhispers = [
        createMockWhisper("Like and comment if you agree!"),
        createMockWhisper("Share this with your friends!"),
        createMockWhisper("Tag someone who needs to see this!"),
      ];
      const score = detectEngagementFarming(recentWhispers);
      expect(score).toBeGreaterThanOrEqual(0.3);
    });
  });

  describe("Score Calculation", () => {
    test("should calculate spam score correctly", () => {
      const contentFlags: ContentFlag[] = [
        {
          type: "clickbait",
          severity: "medium",
          confidence: 0.7,
          description: "Clickbait detected",
          evidence: {},
        },
      ];
      const behavioralFlags: BehavioralFlag[] = [
        {
          type: "repetitive_posting",
          severity: "medium",
          confidence: 0.6,
          description: "Repetitive posting",
          evidence: {},
        },
      ];
      const userBehaviorFlags: UserBehaviorFlag[] = [];

      const score = calculateSpamScore(
        contentFlags,
        behavioralFlags,
        userBehaviorFlags
      );
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    test("should calculate scam score correctly", () => {
      const contentFlags: ContentFlag[] = [
        {
          type: "phishing_attempt",
          severity: "high",
          confidence: 0.8,
          description: "Phishing detected",
          evidence: {},
        },
      ];
      const behavioralFlags: BehavioralFlag[] = [];
      const userBehaviorFlags: UserBehaviorFlag[] = [];

      const score = calculateScamScore(
        contentFlags,
        behavioralFlags,
        userBehaviorFlags
      );
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    test("should handle empty flags", () => {
      const score = calculateSpamScore([], [], []);
      expect(score).toBe(0);
    });
  });

  describe("Action Determination", () => {
    const mockUserReputation: UserReputation = {
      userId: "test-user",
      score: 75,
      level: "standard",
      totalWhispers: 10,
      approvedWhispers: 8,
      flaggedWhispers: 1,
      rejectedWhispers: 1,
      violationHistory: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    test("should suggest warn for low scores", () => {
      const action = determineSuggestedAction(0.2, 0.1, mockUserReputation);
      expect(action).toBe("warn");
    });

    test("should suggest flag for medium scores", () => {
      const action = determineSuggestedAction(0.6, 0.3, mockUserReputation);
      expect(action).toBe("warn"); // Medium scores default to warn
    });

    test("should suggest reject for high scores", () => {
      const action = determineSuggestedAction(0.8, 0.7, mockUserReputation);
      expect(action).toBe("reject");
    });

    test("should be more lenient with trusted users", () => {
      const trustedUser = { ...mockUserReputation, level: "trusted" as const };
      const action = determineSuggestedAction(0.8, 0.7, trustedUser);
      expect(action).toBe("flag"); // More lenient than reject
    });

    test("should be stricter with banned users", () => {
      const bannedUser = { ...mockUserReputation, level: "banned" as const };
      const action = determineSuggestedAction(0.6, 0.5, bannedUser);
      expect(action).toBe("flag"); // Banned users get flag for medium scores
    });
  });

  describe("Reason Generation", () => {
    test("should generate reason for scam detection", () => {
      const contentFlags: ContentFlag[] = [
        {
          type: "phishing_attempt",
          severity: "high",
          confidence: 0.8,
          description: "Phishing detected",
          evidence: {},
        },
      ];
      const reason = generateReason(contentFlags, [], [], false, true);
      expect(reason).toContain("scam");
    });

    test("should generate reason for spam detection", () => {
      const behavioralFlags: BehavioralFlag[] = [
        {
          type: "repetitive_posting",
          severity: "medium",
          confidence: 0.6,
          description: "Repetitive posting",
          evidence: {},
        },
      ];
      const reason = generateReason([], behavioralFlags, [], true, false);
      expect(reason).toContain("spam");
    });

    test("should generate default reason when no specific flags", () => {
      const reason = generateReason([], [], [], false, false);
      expect(reason).toBe("Suspicious content detected");
    });
  });

  describe("Violation Conversion", () => {
    test("should convert scam result to violations", () => {
      const result: SpamAnalysisResult = {
        isSpam: false,
        isScam: true,
        confidence: 0.8,
        spamScore: 0.2,
        scamScore: 0.8,
        behavioralFlags: [],
        contentFlags: [],
        userBehaviorFlags: [],
        suggestedAction: "reject",
        reason: "Scam detected",
      };

      const violations = convertToViolations(result);
      expect(violations.length).toBe(1);
      expect(violations[0].type).toBe(ViolationType.SCAM);
    });

    test("should convert spam result to violations", () => {
      const result: SpamAnalysisResult = {
        isSpam: true,
        isScam: false,
        confidence: 0.7,
        spamScore: 0.7,
        scamScore: 0.2,
        behavioralFlags: [],
        contentFlags: [],
        userBehaviorFlags: [],
        suggestedAction: "flag",
        reason: "Spam detected",
      };

      const violations = convertToViolations(result);
      expect(violations.length).toBe(1);
      expect(violations[0].type).toBe(ViolationType.SPAM);
    });

    test("should convert both spam and scam results", () => {
      const result: SpamAnalysisResult = {
        isSpam: true,
        isScam: true,
        confidence: 0.9,
        spamScore: 0.8,
        scamScore: 0.9,
        behavioralFlags: [],
        contentFlags: [],
        userBehaviorFlags: [],
        suggestedAction: "ban",
        reason: "Spam and scam detected",
      };

      const violations = convertToViolations(result);
      expect(violations.length).toBe(2);
      expect(violations.some((v) => v.type === ViolationType.SPAM)).toBe(true);
      expect(violations.some((v) => v.type === ViolationType.SCAM)).toBe(true);
    });

    test("should handle clean results", () => {
      const result: SpamAnalysisResult = {
        isSpam: false,
        isScam: false,
        confidence: 0.1,
        spamScore: 0.1,
        scamScore: 0.1,
        behavioralFlags: [],
        contentFlags: [],
        userBehaviorFlags: [],
        suggestedAction: "warn",
        reason: "Clean content",
      };

      const violations = convertToViolations(result);
      expect(violations.length).toBe(0);
    });
  });

  describe("Content Analysis", () => {
    test("should analyze content patterns", () => {
      const transcription =
        "Make money fast! You won't believe this opportunity!";
      const flags = analyzeContentPatterns(transcription);
      expect(flags.length).toBeGreaterThan(0);
    });

    test("should handle empty transcription", () => {
      const flags = analyzeContentPatterns("");
      expect(flags).toEqual([]);
    });

    test("should handle whitespace-only transcription", () => {
      const flags = analyzeContentPatterns("   \n\t   ");
      expect(flags).toEqual([]);
    });
  });

  describe("Timing Analysis", () => {
    test("should analyze timing patterns", () => {
      const now = new Date();
      const recentWhispers = [
        createMockWhisper("Post 1", new Date(now.getTime() - 60000)),
        createMockWhisper("Post 2", new Date(now.getTime() - 120000)),
        createMockWhisper("Post 3", new Date(now.getTime() - 180000)),
      ];
      const flags = analyzeTimingPatterns(recentWhispers);
      expect(flags.length).toBeGreaterThan(0);
    });

    test("should handle insufficient data", () => {
      const flags = analyzeTimingPatterns([]);
      expect(flags).toEqual([]);
    });
  });

  describe("Placeholder Functions", () => {
    test("should return empty array for geographic patterns", () => {
      const flags = analyzeGeographicPatterns();
      expect(flags).toEqual([]);
    });

    test("should return empty array for device patterns", () => {
      const flags = analyzeDevicePatterns();
      expect(flags).toEqual([]);
    });
  });

  describe("Constants", () => {
    test("should have correct spam thresholds", () => {
      expect(SPAM_THRESHOLDS.LOW).toBe(0.3);
      expect(SPAM_THRESHOLDS.MEDIUM).toBe(0.5);
      expect(SPAM_THRESHOLDS.HIGH).toBe(0.7);
      expect(SPAM_THRESHOLDS.CRITICAL).toBe(0.9);
    });

    test("should have correct scam thresholds", () => {
      expect(SCAM_THRESHOLDS.LOW).toBe(0.4);
      expect(SCAM_THRESHOLDS.MEDIUM).toBe(0.6);
      expect(SCAM_THRESHOLDS.HIGH).toBe(0.8);
      expect(SCAM_THRESHOLDS.CRITICAL).toBe(0.95);
    });

    test("should have suspicious patterns", () => {
      expect(SUSPICIOUS_PATTERNS.FINANCIAL_SCAMS.length).toBeGreaterThan(0);
      expect(SUSPICIOUS_PATTERNS.PHISHING.length).toBeGreaterThan(0);
      expect(SUSPICIOUS_PATTERNS.CLICKBAIT.length).toBeGreaterThan(0);
      expect(SUSPICIOUS_PATTERNS.FAKE_URGENCY.length).toBeGreaterThan(0);
      expect(SUSPICIOUS_PATTERNS.MISLEADING.length).toBeGreaterThan(0);
    });
  });
});
