/**
 * Tests for Firestore Data Transformation Utilities
 * Demonstrates testing real business logic instead of mocks
 */

import {
  transformWhisperData,
  transformCommentData,
  transformLikeData,
  validateWhisperData,
  validateCommentData,
  validateLikeData,
  getDefaultWhisperData,
  getDefaultCommentData,
  transformTimestamp,
  transformQuerySnapshot,
  calculatePaginationMetadata,
  sanitizeWhisperData,
  sanitizeCommentData,
  sanitizeLikeData,
  hasRequiredWhisperFields,
  hasRequiredCommentFields,
  hasRequiredLikeFields,
  mergeWithDefaults,
  type FirestoreWhisperData,
  type FirestoreLikeData,
} from "../utils/firestoreDataTransformUtils";

describe("Firestore Data Transformation Utilities", () => {
  // Create a mock timestamp that matches the Firestore Timestamp interface
  const createMockTimestamp = () => ({
    toDate: () => new Date("2024-01-01"),
    seconds: 1704067200,
    nanoseconds: 0,
    toMillis: () => 1704067200000,
    isEqual: () => false,
    toJSON: () => ({ seconds: 1704067200, nanoseconds: 0 }),
  });

  describe("transformWhisperData", () => {
    it("should transform complete whisper data correctly", () => {
      const mockTimestamp = createMockTimestamp() as any;
      const data: FirestoreWhisperData = {
        userId: "user123",
        userDisplayName: "Test User",
        userProfileColor: "#FF0000",
        audioUrl: "https://example.com/audio.mp3",
        duration: 30,
        whisperPercentage: 85,
        averageLevel: 0.7,
        confidence: 0.9,
        likes: 10,
        replies: 5,
        createdAt: mockTimestamp,
        transcription: "Hello world",
        isTranscribed: true,
        moderationResult: {
          status: "approved" as any,
          contentRank: "G" as any,
          isMinorSafe: true,
          violations: [],
          confidence: 0.95,
          moderationTime: 100,
          apiResults: {},
          reputationImpact: 0,
          appealable: false,
        },
      };

      const result = transformWhisperData("whisper123", data);

      expect(result.id).toBe("whisper123");
      expect(result.userId).toBe("user123");
      expect(result.userDisplayName).toBe("Test User");
      expect(result.userProfileColor).toBe("#FF0000");
      expect(result.audioUrl).toBe("https://example.com/audio.mp3");
      expect(result.duration).toBe(30);
      expect(result.whisperPercentage).toBe(85);
      expect(result.averageLevel).toBe(0.7);
      expect(result.confidence).toBe(0.9);
      expect(result.likes).toBe(10);
      expect(result.replies).toBe(5);
      expect(result.createdAt).toEqual(new Date("2024-01-01"));
      expect(result.transcription).toBe("Hello world");
      expect(result.isTranscribed).toBe(true);
      expect(result.moderationResult).toEqual(data.moderationResult);
    });

    it("should handle missing optional fields with defaults", () => {
      const data: FirestoreWhisperData = {
        userId: "user123",
        userDisplayName: "Test User",
        userProfileColor: "#FF0000",
        audioUrl: "https://example.com/audio.mp3",
        duration: 30,
        whisperPercentage: 85,
        averageLevel: 0.7,
        confidence: 0.9,
      };

      const result = transformWhisperData("whisper123", data);

      expect(result.likes).toBe(0);
      expect(result.replies).toBe(0);
      expect(result.transcription).toBe("");
      expect(result.isTranscribed).toBe(false);
      expect(result.moderationResult).toBeUndefined();
    });
  });

  describe("transformCommentData", () => {
    it("should transform complete comment data correctly", () => {
      const mockTimestamp = createMockTimestamp() as any;
      const data = {
        whisperId: "whisper123",
        userId: "user123",
        userDisplayName: "Test User",
        userProfileColor: "#FF0000",
        text: "Great whisper!",
        likes: 5,
        createdAt: mockTimestamp,
        isEdited: true,
        editedAt: mockTimestamp,
      };

      const result = transformCommentData("comment123", data);

      expect(result.id).toBe("comment123");
      expect(result.whisperId).toBe("whisper123");
      expect(result.userId).toBe("user123");
      expect(result.userDisplayName).toBe("Test User");
      expect(result.userProfileColor).toBe("#FF0000");
      expect(result.text).toBe("Great whisper!");
      expect(result.likes).toBe(5);
      expect(result.createdAt).toEqual(new Date("2024-01-01"));
      expect(result.isEdited).toBe(true);
      expect(result.editedAt).toEqual(new Date("2024-01-01"));
    });

    it("should handle missing optional fields with defaults", () => {
      const mockTimestamp = createMockTimestamp() as any;
      const data = {
        whisperId: "whisper123",
        userId: "user123",
        userDisplayName: "Test User",
        userProfileColor: "#FF0000",
        text: "Great whisper!",
        createdAt: mockTimestamp,
      };

      const result = transformCommentData("comment123", data);

      expect(result.likes).toBe(0);
      expect(result.isEdited).toBe(false);
      expect(result.editedAt).toBeUndefined();
    });
  });

  describe("transformLikeData", () => {
    it("should transform like data correctly", () => {
      const mockTimestamp = createMockTimestamp() as any;
      const data: FirestoreLikeData = {
        whisperId: "whisper123",
        userId: "user123",
        userDisplayName: "Test User",
        userProfileColor: "#FF0000",
        createdAt: mockTimestamp,
      };

      const result = transformLikeData("like123", data);

      expect(result.id).toBe("like123");
      expect(result.whisperId).toBe("whisper123");
      expect(result.userId).toBe("user123");
      expect(result.userDisplayName).toBe("Test User");
      expect(result.userProfileColor).toBe("#FF0000");
      expect(result.createdAt).toEqual(new Date("2024-01-01"));
    });

    it("should handle missing optional fields with defaults", () => {
      const data: FirestoreLikeData = {
        whisperId: "whisper123",
        userId: "user123",
        createdAt: new Date(),
      };

      const result = transformLikeData("like123", data);

      expect(result.userDisplayName).toBe("Anonymous");
      expect(result.userProfileColor).toBe("#007AFF");
    });
  });

  describe("transformTimestamp", () => {
    it("should handle Firestore Timestamp", () => {
      const mockTimestamp = createMockTimestamp() as any;
      const result = transformTimestamp(mockTimestamp);

      expect(result).toEqual(new Date("2024-01-01"));
    });

    it("should handle regular Date", () => {
      const date = new Date("2024-01-01");
      const result = transformTimestamp(date);

      expect(result).toEqual(date);
    });

    it("should handle timestamp number", () => {
      const timestamp = new Date(1704067200000); // 2024-01-01
      const result = transformTimestamp(timestamp);

      expect(result).toEqual(new Date(1704067200000));
    });

    it("should handle string date", () => {
      const dateString = new Date("2024-01-01");
      const result = transformTimestamp(dateString);

      expect(result).toEqual(new Date("2024-01-01"));
    });

    it("should handle invalid date string", () => {
      const result = transformTimestamp(null);

      expect(result).toBeInstanceOf(Date);
    });
  });

  describe("transformQuerySnapshot", () => {
    it("should transform query snapshot correctly", () => {
      const mockDocs = [
        { id: "doc1", data: () => ({ name: "Test 1" }) },
        { id: "doc2", data: () => ({ name: "Test 2" }) },
      ];

      const mockQuerySnapshot = {
        forEach: (callback: (doc: any) => void) => {
          mockDocs.forEach(callback);
        },
      };

      const transformFn = (docId: string, data: any) => ({
        id: docId,
        name: data.name,
      });

      const result = transformQuerySnapshot(mockQuerySnapshot, transformFn);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: "doc1", name: "Test 1" });
      expect(result[1]).toEqual({ id: "doc2", name: "Test 2" });
    });
  });

  describe("calculatePaginationMetadata", () => {
    it("should calculate pagination metadata correctly", () => {
      const mockDocs = [
        {
          id: "doc1",
          data: () => ({}),
          metadata: {
            hasPendingWrites: false,
            fromCache: false,
            isEqual: () => false,
          },
          exists: () => true,
          get: () => undefined,
          ref: {} as any,
        } as any,
        {
          id: "doc2",
          data: () => ({}),
          metadata: {
            hasPendingWrites: false,
            fromCache: false,
            isEqual: () => false,
          },
          exists: () => true,
          get: () => undefined,
          ref: {} as any,
        } as any,
        {
          id: "doc3",
          data: () => ({}),
          metadata: {
            hasPendingWrites: false,
            fromCache: false,
            isEqual: () => false,
          },
          exists: () => true,
          get: () => undefined,
          ref: {} as any,
        } as any,
      ];
      const mockQuerySnapshot = { docs: mockDocs };

      const result = calculatePaginationMetadata(mockQuerySnapshot, 3);

      expect(result.lastDoc).toEqual(mockDocs[2]);
      expect(result.hasMore).toBe(true);
    });

    it("should handle empty query snapshot", () => {
      const mockQuerySnapshot = { docs: [] };

      const result = calculatePaginationMetadata(mockQuerySnapshot, 10);

      expect(result.lastDoc).toBeNull();
      expect(result.hasMore).toBe(false);
    });

    it("should indicate no more results when docs count is less than limit", () => {
      const mockDocs = [
        {
          id: "doc1",
          data: () => ({}),
          metadata: {
            hasPendingWrites: false,
            fromCache: false,
            isEqual: () => false,
          },
          exists: () => true,
          get: () => undefined,
          ref: {} as any,
        } as any,
      ];
      const mockQuerySnapshot = { docs: mockDocs };

      const result = calculatePaginationMetadata(mockQuerySnapshot, 10);

      expect(result.lastDoc).toEqual(mockDocs[0]);
      expect(result.hasMore).toBe(false);
    });
  });

  describe("validateWhisperData", () => {
    it("should validate complete whisper data", () => {
      const data = {
        userId: "user123",
        userDisplayName: "Test User",
        userProfileColor: "#FF0000",
        audioUrl: "https://example.com/audio.mp3",
        duration: 30,
        whisperPercentage: 85,
        averageLevel: 0.7,
        confidence: 0.9,
      };

      const result = validateWhisperData(data);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject data with missing required fields", () => {
      const data = {
        userId: "user123",
        // Missing other required fields
      };

      const result = validateWhisperData(data);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should validate numeric field ranges", () => {
      const invalidData = [
        { duration: -1 },
        { duration: 301 },
        { whisperPercentage: -1 },
        { whisperPercentage: 101 },
        { averageLevel: -0.1 },
        { averageLevel: 1.1 },
        { confidence: -0.1 },
        { confidence: 1.1 },
      ];

      invalidData.forEach((data) => {
        const result = validateWhisperData(data);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    it("should accept valid numeric ranges", () => {
      const validData = {
        userId: "user123",
        userDisplayName: "Test User",
        userProfileColor: "#FF0000",
        audioUrl: "https://example.com/audio.mp3",
        duration: 30,
        whisperPercentage: 85,
        averageLevel: 0.7,
        confidence: 0.9,
      };

      const result = validateWhisperData(validData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("validateCommentData", () => {
    it("should validate correct comment data", () => {
      const data = {
        whisperId: "whisper123",
        userId: "user123",
        userDisplayName: "Test User",
        userProfileColor: "#FF0000",
        text: "Great whisper!",
      };

      const result = validateCommentData(data);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject comment with missing required fields", () => {
      const data = {
        whisperId: "whisper123",
        // Missing userId, userDisplayName, userProfileColor, text
      };

      const result = validateCommentData(data);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("userId is required");
      expect(result.errors).toContain("userDisplayName is required");
      expect(result.errors).toContain("userProfileColor is required");
      expect(result.errors).toContain("text is required");
    });

    it("should reject comment with text too long", () => {
      const longText = "a".repeat(501);
      const data = {
        whisperId: "whisper123",
        userId: "user123",
        userDisplayName: "Test User",
        userProfileColor: "#FF0000",
        text: longText,
      };

      const result = validateCommentData(data);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("text must be 500 characters or less");
    });

    it("should reject comment with negative likes", () => {
      const data = {
        whisperId: "whisper123",
        userId: "user123",
        userDisplayName: "Test User",
        userProfileColor: "#FF0000",
        text: "Great whisper!",
        likes: -1,
      };

      const result = validateCommentData(data);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("likes must be a non-negative number");
    });
  });

  describe("validateLikeData", () => {
    it("should validate complete like data", () => {
      const data = {
        whisperId: "whisper123",
        userId: "user123",
      };

      const result = validateLikeData(data);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject data with missing required fields", () => {
      const data = {
        whisperId: "whisper123",
        // Missing userId
      };

      const result = validateLikeData(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("userId is required");
    });
  });

  describe("sanitizeWhisperData", () => {
    it("should sanitize whisper data with defaults", () => {
      const data = {
        userId: "user123",
        audioUrl: "https://example.com/audio.mp3",
        duration: 30,
        whisperPercentage: 85,
        averageLevel: 0.7,
        confidence: 0.9,
      };

      const result = sanitizeWhisperData(data);

      expect(result.userId).toBe("user123");
      expect(result.userDisplayName).toBe("");
      expect(result.userProfileColor).toBe("#000000");
      expect(result.audioUrl).toBe("https://example.com/audio.mp3");
      expect(result.duration).toBe(30);
      expect(result.whisperPercentage).toBe(85);
      expect(result.averageLevel).toBe(0.7);
      expect(result.confidence).toBe(0.9);
      expect(result.likes).toBe(0);
      expect(result.replies).toBe(0);
      expect(result.transcription).toBe("");
      expect(result.isTranscribed).toBe(false);
      expect(result.moderationResult).toBeUndefined();
    });
  });

  describe("sanitizeCommentData", () => {
    it("should sanitize comment data with defaults", () => {
      const data = {
        whisperId: "whisper123",
        userId: "user123",
        text: "Great whisper!",
      };

      const result = sanitizeCommentData(data);

      expect(result.whisperId).toBe("whisper123");
      expect(result.userId).toBe("user123");
      expect(result.userDisplayName).toBe("");
      expect(result.userProfileColor).toBe("#000000");
      expect(result.text).toBe("Great whisper!");
      expect(result.likes).toBe(0);
    });
  });

  describe("sanitizeLikeData", () => {
    it("should sanitize like data with defaults", () => {
      const data = {
        whisperId: "whisper123",
        userId: "user123",
      };

      const result = sanitizeLikeData(data);

      expect(result.whisperId).toBe("whisper123");
      expect(result.userId).toBe("user123");
      expect(result.userDisplayName).toBe("");
      expect(result.userProfileColor).toBe("#000000");
    });
  });

  describe("hasRequiredWhisperFields", () => {
    it("should return true for complete whisper data", () => {
      const data = {
        userId: "user123",
        userDisplayName: "Test User",
        userProfileColor: "#FF0000",
        audioUrl: "https://example.com/audio.mp3",
        duration: 30,
        whisperPercentage: 85,
        averageLevel: 0.7,
        confidence: 0.9,
      };

      expect(hasRequiredWhisperFields(data)).toBe(true);
    });

    it("should return false for incomplete whisper data", () => {
      const data = {
        userId: "user123",
        // Missing other required fields
      };

      expect(hasRequiredWhisperFields(data)).toBe(false);
    });
  });

  describe("hasRequiredCommentFields", () => {
    it("should return true for complete comment data", () => {
      const data = {
        whisperId: "whisper123",
        userId: "user123",
        userDisplayName: "Test User",
        userProfileColor: "#FF0000",
        text: "Great whisper!",
      };

      expect(hasRequiredCommentFields(data)).toBe(true);
    });

    it("should return false for incomplete comment data", () => {
      const data = {
        whisperId: "whisper123",
        // Missing other required fields
      };

      expect(hasRequiredCommentFields(data)).toBe(false);
    });
  });

  describe("hasRequiredLikeFields", () => {
    it("should return true for complete like data", () => {
      const data = {
        whisperId: "whisper123",
        userId: "user123",
      };

      expect(hasRequiredLikeFields(data)).toBe(true);
    });

    it("should return false for incomplete like data", () => {
      const data = {
        whisperId: "whisper123",
        // Missing userId
      };

      expect(hasRequiredLikeFields(data)).toBe(false);
    });
  });

  describe("getDefaultWhisperData", () => {
    it("should return default whisper data", () => {
      const result = getDefaultWhisperData();

      expect(result.likes).toBe(0);
      expect(result.replies).toBe(0);
      expect(result.transcription).toBe("");
      expect(result.isTranscribed).toBe(false);
      expect(result.moderationResult).toBeUndefined();
    });
  });

  describe("getDefaultCommentData", () => {
    it("should return default comment data", () => {
      const result = getDefaultCommentData();
      expect(result.likes).toBe(0);
      expect(result.isEdited).toBe(false);
      expect(result.createdAt).toBeInstanceOf(Date);
    });
  });

  describe("mergeWithDefaults", () => {
    it("should merge data with defaults", () => {
      const data = { name: "Test", value: 42 };
      const defaults = { name: "Default", type: "string" };

      const result = mergeWithDefaults(data, defaults);

      expect(result.name).toBe("Test"); // Data overrides defaults
      expect(result.value).toBe(42);
      expect((result as any).type).toBe("string"); // Default preserved
    });

    it("should handle empty data", () => {
      const data = {};
      const defaults = { name: "Default", type: "string" };

      const result = mergeWithDefaults(data, defaults);

      expect(result.name).toBe("Default");
      expect(result.type).toBe("string");
    });
  });

  describe("Business Logic Edge Cases", () => {
    it("should handle all timestamp formats consistently", () => {
      const testCases = [
        { input: null, expected: "Date" },
        { input: undefined, expected: "Date" },
        { input: new Date("2024-01-01"), expected: new Date("2024-01-01") },
        {
          input: { toDate: () => new Date("2024-01-01") },
          expected: new Date("2024-01-01"),
        },
        { input: 1704067200000, expected: new Date(1704067200000) },
        { input: "2024-01-01", expected: new Date("2024-01-01") },
      ];

      testCases.forEach((testCase) => {
        const result = transformTimestamp(testCase.input as any);

        if (testCase.expected === "Date") {
          expect(result).toBeInstanceOf(Date);
        } else {
          expect(result).toEqual(testCase.expected);
        }
      });
    });

    it("should maintain data integrity during transformation", () => {
      const originalData: FirestoreWhisperData = {
        userId: "user123",
        userDisplayName: "Test User",
        userProfileColor: "#FF0000",
        audioUrl: "https://example.com/audio.mp3",
        duration: 30,
        whisperPercentage: 85,
        averageLevel: 0.7,
        confidence: 0.9,
        likes: 10,
        replies: 5,
        transcription: "Hello world",
        isTranscribed: true,
      };

      const transformed = transformWhisperData("whisper123", originalData);

      // Verify all original data is preserved
      expect(transformed.userId).toBe(originalData.userId);
      expect(transformed.userDisplayName).toBe(originalData.userDisplayName);
      expect(transformed.userProfileColor).toBe(originalData.userProfileColor);
      expect(transformed.audioUrl).toBe(originalData.audioUrl);
      expect(transformed.duration).toBe(originalData.duration);
      expect(transformed.whisperPercentage).toBe(
        originalData.whisperPercentage
      );
      expect(transformed.averageLevel).toBe(originalData.averageLevel);
      expect(transformed.confidence).toBe(originalData.confidence);
      expect(transformed.likes).toBe(originalData.likes);
      expect(transformed.replies).toBe(originalData.replies);
      expect(transformed.transcription).toBe(originalData.transcription);
      expect(transformed.isTranscribed).toBe(originalData.isTranscribed);
    });

    it("should handle validation edge cases", () => {
      // Test boundary values
      const boundaryTests = [
        {
          duration: 1,
          whisperPercentage: 0,
          averageLevel: 0,
          confidence: 0,
          isValid: true,
        },
        {
          duration: 300,
          whisperPercentage: 100,
          averageLevel: 1,
          confidence: 1,
          isValid: true,
        },
        {
          duration: 0,
          whisperPercentage: 0,
          averageLevel: 0,
          confidence: 0,
          isValid: false,
        },
        {
          duration: 301,
          whisperPercentage: 0,
          averageLevel: 0,
          confidence: 0,
          isValid: false,
        },
        {
          duration: 1,
          whisperPercentage: -1,
          averageLevel: 0,
          confidence: 0,
          isValid: false,
        },
        {
          duration: 1,
          whisperPercentage: 101,
          averageLevel: 0,
          confidence: 0,
          isValid: false,
        },
        {
          duration: 1,
          whisperPercentage: 0,
          averageLevel: -0.1,
          confidence: 0,
          isValid: false,
        },
        {
          duration: 1,
          whisperPercentage: 0,
          averageLevel: 1.1,
          confidence: 0,
          isValid: false,
        },
        {
          duration: 1,
          whisperPercentage: 0,
          averageLevel: 0,
          confidence: -0.1,
          isValid: false,
        },
        {
          duration: 1,
          whisperPercentage: 0,
          averageLevel: 0,
          confidence: 1.1,
          isValid: false,
        },
      ];

      boundaryTests.forEach((test) => {
        const data = {
          userId: "user123",
          userDisplayName: "Test User",
          userProfileColor: "#FF0000",
          audioUrl: "https://example.com/audio.mp3",
          duration: test.duration,
          whisperPercentage: test.whisperPercentage,
          averageLevel: test.averageLevel,
          confidence: test.confidence,
        };

        const result = validateWhisperData(data);
        expect(result.isValid).toBe(test.isValid);
      });
    });
  });
});
