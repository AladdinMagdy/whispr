/**
 * Tests for Firestore Query Utilities
 * Demonstrates testing real business logic instead of mocks
 */

import {
  buildWhisperQueryConstraints,
  validateWhisperFeedOptions,
  getDefaultWhisperFeedOptions,
  mergeWhisperFeedOptions,
  shouldIncludeAgeFiltering,
  shouldIncludeStrictFiltering,
  getStrictContentRanks,
  getAdultContentRanks,
  isContentRankMinorSafe,
  isContentRankAdult,
  buildPaginationConstraints,
  buildUserFilterConstraints,
  buildAgeFilterConstraints,
  buildWhisperSubscriptionConstraints,
  buildCommentQueryConstraints,
  buildLikeQueryConstraints,
} from "../utils/firestoreQueryUtils";
import { WhisperFeedOptions } from "../services/firestoreService";

describe("Firestore Query Utilities", () => {
  describe("buildWhisperQueryConstraints", () => {
    it("should build basic query constraints with defaults", () => {
      const result = buildWhisperQueryConstraints();

      expect(result.constraints).toHaveLength(2); // orderBy + limit
      expect(result.description).toContain("ordered by createdAt desc");
      expect(result.description).toContain("limited to 20 results");
    });

    it("should include user filter when userId is provided", () => {
      const options: WhisperFeedOptions = { userId: "user123" };
      const result = buildWhisperQueryConstraints(options);

      expect(result.constraints).toHaveLength(3); // orderBy + where + limit
      expect(result.description).toContain("filtered by userId: user123");
    });

    it("should include minor filtering for minors", () => {
      const options: WhisperFeedOptions = {
        userAge: 16,
        isMinor: true,
      };
      const result = buildWhisperQueryConstraints(options);

      expect(result.constraints).toHaveLength(3); // orderBy + where + limit
      expect(result.description).toContain(
        "filtered for minors (isMinorSafe: true)"
      );
    });

    it("should include strict filtering for adults with strict preferences", () => {
      const options: WhisperFeedOptions = {
        userAge: 25,
        isMinor: false,
        contentPreferences: {
          allowAdultContent: false,
          strictFiltering: true,
        },
      };
      const result = buildWhisperQueryConstraints(options);

      expect(result.constraints).toHaveLength(3); // orderBy + where + limit
      expect(result.description).toContain(
        "filtered for strict content (G, PG, PG13 only)"
      );
    });

    it("should include pagination with startAfter document", () => {
      const mockDoc = { id: "doc123" } as any;
      const options: WhisperFeedOptions = {
        startAfter: mockDoc,
      };
      const result = buildWhisperQueryConstraints(options);

      expect(result.constraints).toHaveLength(3); // orderBy + startAfter + limit
      expect(result.description).toContain("pagination: startAfter document");
    });

    it("should include pagination with last whisper", () => {
      const mockWhisper = { id: "whisper123" } as any;
      const options: WhisperFeedOptions = {
        lastWhisper: mockWhisper,
      };
      const result = buildWhisperQueryConstraints(options);

      expect(result.constraints).toHaveLength(3); // orderBy + startAfter + limit
      expect(result.description).toContain(
        "pagination: startAfter last whisper"
      );
    });

    it("should use custom limit when provided", () => {
      const options: WhisperFeedOptions = { limit: 50 };
      const result = buildWhisperQueryConstraints(options);

      expect(result.description).toContain("limited to 50 results");
    });

    it("should build complex query with multiple filters", () => {
      const mockDoc = { id: "doc123" } as any;
      const options: WhisperFeedOptions = {
        userId: "user123",
        userAge: 16,
        isMinor: true,
        startAfter: mockDoc,
        limit: 10,
      };
      const result = buildWhisperQueryConstraints(options);

      expect(result.constraints).toHaveLength(5); // orderBy + userId + minor + startAfter + limit
      expect(result.description).toContain("filtered by userId: user123");
      expect(result.description).toContain(
        "filtered for minors (isMinorSafe: true)"
      );
      expect(result.description).toContain("pagination: startAfter document");
      expect(result.description).toContain("limited to 10 results");
    });
  });

  describe("validateWhisperFeedOptions", () => {
    it("should validate empty options", () => {
      const result = validateWhisperFeedOptions({});

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject invalid limit values", () => {
      const invalidLimits = [0, -1, 101, 1000];

      invalidLimits.forEach((limitValue) => {
        const result = validateWhisperFeedOptions({ limit: limitValue });

        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    it("should accept valid limit values", () => {
      const validLimits = [1, 20, 50, 100];

      validLimits.forEach((limitValue) => {
        const result = validateWhisperFeedOptions({ limit: limitValue });

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it("should require isMinor when userAge is provided", () => {
      const result = validateWhisperFeedOptions({ userAge: 16 });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "isMinor must be specified when userAge is provided"
      );
    });

    it("should require userAge when isMinor is provided", () => {
      const result = validateWhisperFeedOptions({ isMinor: true });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "userAge must be specified when isMinor is provided"
      );
    });

    it("should reject invalid age values", () => {
      const invalidAges = [-1, 121, 200];

      invalidAges.forEach((age) => {
        const result = validateWhisperFeedOptions({
          userAge: age,
          isMinor: false,
        });

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("User age must be between 0 and 120");
      });
    });

    it("should accept valid age values", () => {
      const validAges = [0, 13, 18, 25, 120];

      validAges.forEach((age) => {
        const result = validateWhisperFeedOptions({
          userAge: age,
          isMinor: age < 18,
        });

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it("should validate content preferences", () => {
      const invalidPreferences = [
        { allowAdultContent: "true" as any, strictFiltering: true },
        { allowAdultContent: true, strictFiltering: "false" as any },
        { allowAdultContent: null as any, strictFiltering: true },
      ];

      invalidPreferences.forEach((prefs) => {
        const result = validateWhisperFeedOptions({
          contentPreferences: prefs,
        });

        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    it("should accept valid content preferences", () => {
      const validPreferences = [
        { allowAdultContent: true, strictFiltering: false },
        { allowAdultContent: false, strictFiltering: true },
        { allowAdultContent: true, strictFiltering: true },
      ];

      validPreferences.forEach((prefs) => {
        const result = validateWhisperFeedOptions({
          contentPreferences: prefs,
        });

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it("should collect multiple validation errors", () => {
      const result = validateWhisperFeedOptions({
        limit: -1,
        userAge: 200,
        contentPreferences: {
          allowAdultContent: "invalid" as any,
          strictFiltering: true,
        },
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe("getDefaultWhisperFeedOptions", () => {
    it("should return default options", () => {
      const result = getDefaultWhisperFeedOptions();

      expect(result).toEqual({ limit: 20 });
    });
  });

  describe("mergeWhisperFeedOptions", () => {
    it("should merge options with defaults", () => {
      const customOptions: WhisperFeedOptions = {
        userId: "user123",
        limit: 50,
      };
      const result = mergeWhisperFeedOptions(customOptions);

      expect(result.limit).toBe(50);
      expect(result.userId).toBe("user123");
    });

    it("should use defaults when no options provided", () => {
      const result = mergeWhisperFeedOptions();

      expect(result.limit).toBe(20);
    });

    it("should override defaults with provided options", () => {
      const result = mergeWhisperFeedOptions({ limit: 10 });

      expect(result.limit).toBe(10);
    });
  });

  describe("shouldIncludeAgeFiltering", () => {
    it("should return true when both userAge and isMinor are provided", () => {
      expect(shouldIncludeAgeFiltering(16, true)).toBe(true);
      expect(shouldIncludeAgeFiltering(25, false)).toBe(true);
    });

    it("should return false when userAge is missing", () => {
      expect(shouldIncludeAgeFiltering(undefined, true)).toBe(false);
      expect(shouldIncludeAgeFiltering(undefined, false)).toBe(false);
    });

    it("should return false when isMinor is missing", () => {
      expect(shouldIncludeAgeFiltering(16, undefined)).toBe(false);
      expect(shouldIncludeAgeFiltering(25, undefined)).toBe(false);
    });

    it("should return false when both are missing", () => {
      expect(shouldIncludeAgeFiltering()).toBe(false);
    });
  });

  describe("shouldIncludeStrictFiltering", () => {
    it("should return true for adults with strict filtering", () => {
      const result = shouldIncludeStrictFiltering(false, {
        allowAdultContent: false,
        strictFiltering: true,
      });

      expect(result).toBe(true);
    });

    it("should return false for minors", () => {
      const result = shouldIncludeStrictFiltering(true, {
        allowAdultContent: false,
        strictFiltering: true,
      });

      expect(result).toBe(false);
    });

    it("should return false when strict filtering is disabled", () => {
      const result = shouldIncludeStrictFiltering(false, {
        allowAdultContent: true,
        strictFiltering: false,
      });

      expect(result).toBe(false);
    });

    it("should return false when content preferences are not provided", () => {
      const result = shouldIncludeStrictFiltering(false);

      expect(result).toBe(false);
    });
  });

  describe("getStrictContentRanks", () => {
    it("should return minor-safe content ranks", () => {
      const result = getStrictContentRanks();

      expect(result).toEqual(["G", "PG", "PG13"]);
    });
  });

  describe("getAdultContentRanks", () => {
    it("should return adult content ranks", () => {
      const result = getAdultContentRanks();

      expect(result).toEqual(["R", "NC17"]);
    });
  });

  describe("isContentRankMinorSafe", () => {
    it("should return true for minor-safe content ranks", () => {
      const minorSafeRanks = ["G", "PG", "PG13"];

      minorSafeRanks.forEach((rank) => {
        expect(isContentRankMinorSafe(rank)).toBe(true);
      });
    });

    it("should return false for adult content ranks", () => {
      const adultRanks = ["R", "NC17"];

      adultRanks.forEach((rank) => {
        expect(isContentRankMinorSafe(rank)).toBe(false);
      });
    });

    it("should return false for invalid content ranks", () => {
      const invalidRanks = ["", "X", "invalid", "PG14"];

      invalidRanks.forEach((rank) => {
        expect(isContentRankMinorSafe(rank)).toBe(false);
      });
    });
  });

  describe("isContentRankAdult", () => {
    it("should return true for adult content ranks", () => {
      const adultRanks = ["R", "NC17"];

      adultRanks.forEach((rank) => {
        expect(isContentRankAdult(rank)).toBe(true);
      });
    });

    it("should return false for minor-safe content ranks", () => {
      const minorSafeRanks = ["G", "PG", "PG13"];

      minorSafeRanks.forEach((rank) => {
        expect(isContentRankAdult(rank)).toBe(false);
      });
    });

    it("should return false for invalid content ranks", () => {
      const invalidRanks = ["", "X", "invalid", "PG14"];

      invalidRanks.forEach((rank) => {
        expect(isContentRankAdult(rank)).toBe(false);
      });
    });
  });

  describe("buildPaginationConstraints", () => {
    it("should return empty array when no pagination options provided", () => {
      const result = buildPaginationConstraints();

      expect(result).toEqual([]);
    });

    it("should include startAfter constraint when startAfterDoc provided", () => {
      const mockDoc = { id: "doc123" } as any;
      const result = buildPaginationConstraints(undefined, mockDoc);

      expect(result).toHaveLength(1);
    });

    it("should include startAfter constraint when lastWhisper provided", () => {
      const mockWhisper = { id: "whisper123" } as any;
      const result = buildPaginationConstraints(mockWhisper);

      expect(result).toHaveLength(1);
    });

    it("should prioritize startAfterDoc over lastWhisper", () => {
      const mockDoc = { id: "doc123" } as any;
      const mockWhisper = { id: "whisper123" } as any;
      const result = buildPaginationConstraints(mockWhisper, mockDoc);

      expect(result).toHaveLength(1);
    });
  });

  describe("buildUserFilterConstraints", () => {
    it("should return empty array when no userId provided", () => {
      const result = buildUserFilterConstraints();

      expect(result).toEqual([]);
    });

    it("should include where constraint when userId provided", () => {
      const result = buildUserFilterConstraints("user123");

      expect(result).toHaveLength(1);
    });
  });

  describe("buildAgeFilterConstraints", () => {
    it("should return empty array when age filtering not applicable", () => {
      const result = buildAgeFilterConstraints();

      expect(result).toEqual([]);
    });

    it("should include minor-safe constraint for minors", () => {
      const result = buildAgeFilterConstraints(16, true);

      expect(result).toHaveLength(1);
    });

    it("should include strict content constraint for adults with strict filtering", () => {
      const result = buildAgeFilterConstraints(25, false, {
        allowAdultContent: false,
        strictFiltering: true,
      });

      expect(result).toHaveLength(1);
    });

    it("should return empty array for adults without strict filtering", () => {
      const result = buildAgeFilterConstraints(25, false, {
        allowAdultContent: true,
        strictFiltering: false,
      });

      expect(result).toEqual([]);
    });
  });

  describe("Business Logic Edge Cases", () => {
    it("should handle all content rank combinations", () => {
      const allRanks = ["G", "PG", "PG13", "R", "NC17", "X", ""];

      allRanks.forEach((rank) => {
        const isMinorSafe = isContentRankMinorSafe(rank);
        const isAdult = isContentRankAdult(rank);

        // A rank cannot be both minor-safe and adult
        expect(isMinorSafe && isAdult).toBe(false);
      });
    });

    it("should maintain consistency between filtering functions", () => {
      const testCases = [
        { userAge: 16, isMinor: true, strictFiltering: true },
        { userAge: 25, isMinor: false, strictFiltering: false },
        { userAge: 30, isMinor: false, strictFiltering: true },
      ];

      testCases.forEach((testCase) => {
        const shouldAgeFilter = shouldIncludeAgeFiltering(
          testCase.userAge,
          testCase.isMinor
        );
        const shouldStrictFilter = shouldIncludeStrictFiltering(
          testCase.isMinor,
          {
            allowAdultContent: false,
            strictFiltering: testCase.strictFiltering,
          }
        );

        // If strict filtering is enabled, age filtering should also be enabled
        if (shouldStrictFilter) {
          expect(shouldAgeFilter).toBe(true);
        }
      });
    });

    it("should handle boundary values correctly", () => {
      // Test age boundaries
      expect(
        validateWhisperFeedOptions({ userAge: 0, isMinor: true }).isValid
      ).toBe(true);
      expect(
        validateWhisperFeedOptions({ userAge: 120, isMinor: false }).isValid
      ).toBe(true);
      expect(
        validateWhisperFeedOptions({ userAge: -1, isMinor: true }).isValid
      ).toBe(false);
      expect(
        validateWhisperFeedOptions({ userAge: 121, isMinor: false }).isValid
      ).toBe(false);

      // Test limit boundaries
      expect(validateWhisperFeedOptions({ limit: 1 }).isValid).toBe(true);
      expect(validateWhisperFeedOptions({ limit: 100 }).isValid).toBe(true);
      expect(validateWhisperFeedOptions({ limit: 0 }).isValid).toBe(false);
      expect(validateWhisperFeedOptions({ limit: 101 }).isValid).toBe(false);
    });
  });

  describe("buildWhisperSubscriptionConstraints", () => {
    it("should build basic subscription constraints with defaults", () => {
      const result = buildWhisperSubscriptionConstraints();
      expect(result.constraints).toHaveLength(2);
      expect(result.description).toContain("ordered by createdAt desc");
      expect(result.description).toContain("limited to 20 results");
    });

    it("should include timestamp filter when provided", () => {
      const sinceTimestamp = new Date("2024-01-01");
      const result = buildWhisperSubscriptionConstraints({ sinceTimestamp });

      expect(result.constraints).toHaveLength(3);
      expect(result.description).toContain("filtered since 2024-01-01");
    });

    it("should include user filter when provided", () => {
      const result = buildWhisperSubscriptionConstraints({ userId: "user123" });

      expect(result.constraints).toHaveLength(3);
      expect(result.description).toContain("filtered by userId: user123");
    });

    it("should include age-based filtering for minors", () => {
      const result = buildWhisperSubscriptionConstraints({
        userAge: 15,
        isMinor: true,
      });

      expect(result.constraints).toHaveLength(3);
      expect(result.description).toContain("filtered for minors");
    });

    it("should include age-based filtering for adults with strict preferences", () => {
      const result = buildWhisperSubscriptionConstraints({
        userAge: 25,
        isMinor: false,
        contentPreferences: { allowAdultContent: false, strictFiltering: true },
      });

      expect(result.constraints).toHaveLength(3);
      expect(result.description).toContain("filtered for strict content");
    });

    it("should respect custom limit", () => {
      const result = buildWhisperSubscriptionConstraints({ limit: 50 });
      expect(result.description).toContain("limited to 50 results");
    });
  });

  describe("buildCommentQueryConstraints", () => {
    it("should build basic comment query constraints", () => {
      const result = buildCommentQueryConstraints({ whisperId: "whisper123" });

      expect(result.constraints).toHaveLength(3);
      expect(result.description).toContain("filtered by whisperId: whisper123");
      expect(result.description).toContain("ordered by createdAt desc");
      expect(result.description).toContain("limited to 50 results");
    });

    it("should include pagination when lastDoc provided", () => {
      const mockLastDoc = { id: "comment123" } as any;
      const result = buildCommentQueryConstraints({
        whisperId: "whisper123",
        lastDoc: mockLastDoc,
      });

      expect(result.constraints).toHaveLength(4);
      expect(result.description).toContain("pagination: startAfter document");
    });

    it("should respect custom limit", () => {
      const result = buildCommentQueryConstraints({
        whisperId: "whisper123",
        limit: 25,
      });

      expect(result.description).toContain("limited to 25 results");
    });
  });

  describe("buildLikeQueryConstraints", () => {
    it("should build whisper like query constraints", () => {
      const result = buildLikeQueryConstraints({
        contentId: "whisper123",
        contentType: "whisper",
      });

      expect(result.constraints).toHaveLength(3);
      expect(result.description).toContain("filtered by whisperId: whisper123");
      expect(result.description).toContain("ordered by createdAt desc");
    });

    it("should build comment like query constraints", () => {
      const result = buildLikeQueryConstraints({
        contentId: "comment123",
        contentType: "comment",
      });

      expect(result.constraints).toHaveLength(3);
      expect(result.description).toContain("filtered by commentId: comment123");
      expect(result.description).toContain("ordered by createdAt desc");
    });

    it("should include pagination when lastDoc provided", () => {
      const mockLastDoc = { id: "like123" } as any;
      const result = buildLikeQueryConstraints({
        contentId: "whisper123",
        contentType: "whisper",
        lastDoc: mockLastDoc,
      });

      expect(result.constraints).toHaveLength(4);
      expect(result.description).toContain("pagination: startAfter document");
    });

    it("should respect custom limit", () => {
      const result = buildLikeQueryConstraints({
        contentId: "whisper123",
        contentType: "whisper",
        limit: 25,
      });

      expect(result.description).toContain("limited to 25 results");
    });
  });
});
