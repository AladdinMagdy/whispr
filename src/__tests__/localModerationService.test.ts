/**
 * Tests for Local Moderation Service
 */

import { LocalModerationService } from "../services/localModerationService";
import { ViolationType } from "../types";

// Mock the utils module
jest.mock("../utils/localModerationUtils", () => ({
  checkKeywordViolations: jest.fn(),
  createLocalModerationResult: jest.fn(),
  shouldRejectImmediately: jest.fn(),
  getModerationSummary: jest.fn(),
  validateTextInput: jest.fn(),
}));

import {
  checkKeywordViolations,
  createLocalModerationResult,
  shouldRejectImmediately,
  getModerationSummary,
  validateTextInput,
} from "../utils/localModerationUtils";

const mockCheckKeywordViolations =
  checkKeywordViolations as jest.MockedFunction<typeof checkKeywordViolations>;
const mockCreateLocalModerationResult =
  createLocalModerationResult as jest.MockedFunction<
    typeof createLocalModerationResult
  >;
const mockShouldRejectImmediately =
  shouldRejectImmediately as jest.MockedFunction<
    typeof shouldRejectImmediately
  >;
const mockGetModerationSummary = getModerationSummary as jest.MockedFunction<
  typeof getModerationSummary
>;
const mockValidateTextInput = validateTextInput as jest.MockedFunction<
  typeof validateTextInput
>;

describe("LocalModerationService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("checkKeywords", () => {
    test("should validate input and return moderation result", async () => {
      const text = "Hello world";
      const mockViolations = [
        {
          type: ViolationType.HARASSMENT,
          severity: "medium" as const,
          confidence: 0.8,
          description: "Test violation",
          suggestedAction: "reject" as const,
        },
      ];
      const mockMatchedKeywords = ["stupid"];
      const mockResult = {
        flagged: true,
        matchedKeywords: mockMatchedKeywords,
        toxicityScore: 0.6,
        spamScore: 0.2,
        personalInfoDetected: false,
      };

      mockValidateTextInput.mockReturnValue({ isValid: true });
      mockCheckKeywordViolations.mockReturnValue({
        violations: mockViolations,
        matchedKeywords: mockMatchedKeywords,
      });
      mockCreateLocalModerationResult.mockReturnValue(mockResult);

      const result = await LocalModerationService.checkKeywords(text);

      expect(mockValidateTextInput).toHaveBeenCalledWith(text);
      expect(mockCheckKeywordViolations).toHaveBeenCalledWith(text);
      expect(mockCreateLocalModerationResult).toHaveBeenCalledWith(
        mockViolations,
        mockMatchedKeywords,
        text
      );
      expect(result).toEqual(mockResult);
    });

    test("should throw error for invalid input", async () => {
      const text = "";
      const errorMessage = "Text cannot be empty or whitespace only";

      mockValidateTextInput.mockReturnValue({
        isValid: false,
        error: errorMessage,
      });

      await expect(LocalModerationService.checkKeywords(text)).rejects.toThrow(
        errorMessage
      );

      expect(mockValidateTextInput).toHaveBeenCalledWith(text);
      expect(mockCheckKeywordViolations).not.toHaveBeenCalled();
      expect(mockCreateLocalModerationResult).not.toHaveBeenCalled();
    });

    test("should handle null input", async () => {
      const text = null as any;
      const errorMessage = "Text must be a non-empty string";

      mockValidateTextInput.mockReturnValue({
        isValid: false,
        error: errorMessage,
      });

      await expect(LocalModerationService.checkKeywords(text)).rejects.toThrow(
        errorMessage
      );
    });

    test("should handle text that is too long", async () => {
      const text = "a".repeat(10001);
      const errorMessage = "Text is too long (maximum 10,000 characters)";

      mockValidateTextInput.mockReturnValue({
        isValid: false,
        error: errorMessage,
      });

      await expect(LocalModerationService.checkKeywords(text)).rejects.toThrow(
        errorMessage
      );
    });
  });

  describe("shouldRejectImmediately", () => {
    test("should return true for content that should be rejected", async () => {
      const text = "kill yourself";
      const mockResult = {
        flagged: true,
        matchedKeywords: ["kill yourself"],
        toxicityScore: 0.9,
        spamScore: 0.2,
        personalInfoDetected: false,
      };

      mockValidateTextInput.mockReturnValue({ isValid: true });
      mockCheckKeywordViolations.mockReturnValue({
        violations: [],
        matchedKeywords: ["kill yourself"],
      });
      mockCreateLocalModerationResult.mockReturnValue(mockResult);
      mockShouldRejectImmediately.mockReturnValue(true);

      const result = await LocalModerationService.shouldRejectImmediately(text);

      expect(result).toBe(true);
      expect(mockShouldRejectImmediately).toHaveBeenCalledWith(mockResult);
    });

    test("should return false for content that should not be rejected", async () => {
      const text = "Hello world";
      const mockResult = {
        flagged: false,
        matchedKeywords: [],
        toxicityScore: 0.1,
        spamScore: 0.1,
        personalInfoDetected: false,
      };

      mockValidateTextInput.mockReturnValue({ isValid: true });
      mockCheckKeywordViolations.mockReturnValue({
        violations: [],
        matchedKeywords: [],
      });
      mockCreateLocalModerationResult.mockReturnValue(mockResult);
      mockShouldRejectImmediately.mockReturnValue(false);

      const result = await LocalModerationService.shouldRejectImmediately(text);

      expect(result).toBe(false);
      expect(mockShouldRejectImmediately).toHaveBeenCalledWith(mockResult);
    });

    test("should throw error for invalid input", async () => {
      const text = "";
      const errorMessage = "Text cannot be empty or whitespace only";

      mockValidateTextInput.mockReturnValue({
        isValid: false,
        error: errorMessage,
      });

      await expect(
        LocalModerationService.shouldRejectImmediately(text)
      ).rejects.toThrow(errorMessage);
    });
  });

  describe("getModerationSummary", () => {
    test("should return moderation summary", () => {
      const mockResult = {
        flagged: true,
        matchedKeywords: ["stupid", "idiot"],
        toxicityScore: 0.7,
        spamScore: 0.3,
        personalInfoDetected: false,
      };
      const expectedSummary =
        "⚠️ Local moderation: 2 keyword violations, High toxicity (70.0%)";

      mockGetModerationSummary.mockReturnValue(expectedSummary);

      const summary = LocalModerationService.getModerationSummary(mockResult);

      expect(mockGetModerationSummary).toHaveBeenCalledWith(mockResult);
      expect(summary).toBe(expectedSummary);
    });

    test("should return success message for clean content", () => {
      const mockResult = {
        flagged: false,
        matchedKeywords: [],
        toxicityScore: 0.1,
        spamScore: 0.1,
        personalInfoDetected: false,
      };
      const expectedSummary = "✅ Local moderation: No violations detected";

      mockGetModerationSummary.mockReturnValue(expectedSummary);

      const summary = LocalModerationService.getModerationSummary(mockResult);

      expect(mockGetModerationSummary).toHaveBeenCalledWith(mockResult);
      expect(summary).toBe(expectedSummary);
    });
  });

  describe("integration tests", () => {
    test("should handle complete moderation flow", async () => {
      const text = "You are stupid and ugly";
      const mockViolations = [
        {
          type: ViolationType.HARASSMENT,
          severity: "medium" as const,
          confidence: 0.8,
          description: 'Contains HARASSMENT keyword: "stupid"',
          startIndex: 8,
          endIndex: 14,
          suggestedAction: "reject" as const,
        },
        {
          type: ViolationType.HARASSMENT,
          severity: "medium" as const,
          confidence: 0.8,
          description: 'Contains HARASSMENT keyword: "ugly"',
          startIndex: 19,
          endIndex: 23,
          suggestedAction: "reject" as const,
        },
      ];
      const mockMatchedKeywords = ["stupid", "ugly"];
      const mockResult = {
        flagged: true,
        matchedKeywords: mockMatchedKeywords,
        toxicityScore: 0.6,
        spamScore: 0.1,
        personalInfoDetected: false,
      };

      mockValidateTextInput.mockReturnValue({ isValid: true });
      mockCheckKeywordViolations.mockReturnValue({
        violations: mockViolations,
        matchedKeywords: mockMatchedKeywords,
      });
      mockCreateLocalModerationResult.mockReturnValue(mockResult);
      mockShouldRejectImmediately.mockReturnValue(false);
      mockGetModerationSummary.mockReturnValue(
        "⚠️ Local moderation: 2 keyword violations, High toxicity (60.0%)"
      );

      // Test checkKeywords
      const result = await LocalModerationService.checkKeywords(text);
      expect(result).toEqual(mockResult);

      // Test shouldRejectImmediately
      const shouldReject = await LocalModerationService.shouldRejectImmediately(
        text
      );
      expect(shouldReject).toBe(false);

      // Test getModerationSummary
      const summary = LocalModerationService.getModerationSummary(result);
      expect(summary).toContain("2 keyword violations");
      expect(summary).toContain("High toxicity (60.0%)");
    });

    test("should handle personal information detection", async () => {
      const text = "My phone number is 123-456-7890";
      const mockMatchedKeywords: string[] = [];
      const mockResult = {
        flagged: true,
        matchedKeywords: mockMatchedKeywords,
        toxicityScore: 0.9,
        spamScore: 0.1,
        personalInfoDetected: true,
      };

      mockValidateTextInput.mockReturnValue({ isValid: true });
      mockCheckKeywordViolations.mockReturnValue({
        violations: [],
        matchedKeywords: mockMatchedKeywords,
      });
      mockCreateLocalModerationResult.mockReturnValue(mockResult);
      mockShouldRejectImmediately.mockReturnValue(true);

      const result = await LocalModerationService.checkKeywords(text);
      expect(result.personalInfoDetected).toBe(true);
      expect(result.flagged).toBe(true);

      const shouldReject = await LocalModerationService.shouldRejectImmediately(
        text
      );
      expect(shouldReject).toBe(true);
    });

    test("should handle clean content", async () => {
      const text = "Hello world, this is a nice message";
      const mockViolations: any[] = [];
      const mockMatchedKeywords: string[] = [];
      const mockResult = {
        flagged: false,
        matchedKeywords: mockMatchedKeywords,
        toxicityScore: 0.0,
        spamScore: 0.0,
        personalInfoDetected: false,
      };

      mockValidateTextInput.mockReturnValue({ isValid: true });
      mockCheckKeywordViolations.mockReturnValue({
        violations: mockViolations,
        matchedKeywords: mockMatchedKeywords,
      });
      mockCreateLocalModerationResult.mockReturnValue(mockResult);
      mockShouldRejectImmediately.mockReturnValue(false);
      mockGetModerationSummary.mockReturnValue(
        "✅ Local moderation: No violations detected"
      );

      const result = await LocalModerationService.checkKeywords(text);
      expect(result.flagged).toBe(false);
      expect(result.toxicityScore).toBe(0.0);
      expect(result.spamScore).toBe(0.0);
      expect(result.personalInfoDetected).toBe(false);

      const shouldReject = await LocalModerationService.shouldRejectImmediately(
        text
      );
      expect(shouldReject).toBe(false);

      const summary = LocalModerationService.getModerationSummary(result);
      expect(summary).toContain("No violations detected");
    });
  });
});
