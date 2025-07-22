import { ModerationStatus, ViolationType, ContentRank } from "../types";
import {
  buildWhisperQueryConstraints,
  buildPrivacyFilterConstraints,
  buildAgeFilterConstraints,
  buildPaginationConstraints,
  buildUserFilterConstraints,
  filterWhispersByPrivacy,
  filterWhispersByAge,
  applyWhisperFilters,
  calculatePaginationMetadata,
  createPaginatedResult,
  optimizeQueryConstraints,
  validateQueryOptions,
  createDefaultQueryOptions,
  mergeQueryOptions,
  hasQueryConstraint,
  getQueryConstraint,
  removeQueryConstraint,
  cloneQueryConstraints,
  areQueryConstraintsEquivalent,
  type WhisperFeedOptions,
  type PrivacyFilterOptions,
  type AgeFilterOptions,
  type PaginationOptions,
} from "../utils/whisperQueryUtils";
import { orderBy, where, limit } from "firebase/firestore";

// ===== TEST DATA =====

const mockQuerySnapshot = {
  docs: [
    {
      id: "doc1",
      data: () => ({ id: "whisper1" }),
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
      data: () => ({ id: "whisper2" }),
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
      data: () => ({ id: "whisper3" }),
      metadata: {
        hasPendingWrites: false,
        fromCache: false,
        isEqual: () => false,
      },
      exists: () => true,
      get: () => undefined,
      ref: {} as any,
    } as any,
  ],
};

const mockLastDoc = { id: "doc3", data: () => ({ id: "whisper3" }) } as any;

const mockWhispers = [
  {
    id: "whisper1",
    userId: "user1",
    userDisplayName: "User 1",
    userProfileColor: "#FF0000",
    audioUrl: "https://example.com/audio1.mp3",
    duration: 30,
    whisperPercentage: 85,
    averageLevel: 0.7,
    confidence: 0.9,
    likes: 10,
    replies: 5,
    createdAt: new Date("2024-01-01"),
    transcription: "Hello world",
    isTranscribed: true,
    moderationResult: {
      status: ModerationStatus.APPROVED,
      contentRank: ContentRank.G,
      isMinorSafe: true,
      violations: [],
      confidence: 0.95,
      moderationTime: 100,
      apiResults: {},
      reputationImpact: 0,
      appealable: false,
    },
  },
  {
    id: "whisper2",
    userId: "user2",
    userDisplayName: "User 2",
    userProfileColor: "#00FF00",
    audioUrl: "https://example.com/audio2.mp3",
    duration: 45,
    whisperPercentage: 90,
    averageLevel: 0.8,
    confidence: 0.95,
    likes: 15,
    replies: 8,
    createdAt: new Date("2024-01-02"),
    transcription: "Adult content",
    isTranscribed: true,
    moderationResult: {
      status: ModerationStatus.APPROVED,
      contentRank: ContentRank.R,
      isMinorSafe: false,
      violations: [
        {
          type: ViolationType.SEXUAL_CONTENT,
          severity: "high" as const,
          confidence: 0.9,
          description: "Adult content detected",
          suggestedAction: "flag" as const,
        },
      ],
      confidence: 0.95,
      moderationTime: 100,
      apiResults: {},
      reputationImpact: -5,
      appealable: true,
    },
  },
  {
    id: "whisper3",
    userId: "user3",
    userDisplayName: "User 3",
    userProfileColor: "#0000FF",
    audioUrl: "https://example.com/audio3.mp3",
    duration: 60,
    whisperPercentage: 75,
    averageLevel: 0.6,
    confidence: 0.85,
    likes: 20,
    replies: 12,
    createdAt: new Date("2024-01-03"),
    transcription: "Questionable content",
    isTranscribed: true,
    moderationResult: {
      status: ModerationStatus.APPROVED,
      contentRank: ContentRank.PG13,
      isMinorSafe: false,
      violations: [
        {
          type: ViolationType.HARASSMENT,
          severity: "low" as const,
          confidence: 0.7,
          description: "Mild language detected",
          suggestedAction: "warn" as const,
        },
      ],
      confidence: 0.85,
      moderationTime: 80,
      apiResults: {},
      reputationImpact: -2,
      appealable: false,
    },
  },
];

// ===== QUERY BUILDING TESTS =====

describe("buildWhisperQueryConstraints", () => {
  it("should build basic query constraints", () => {
    const result = buildWhisperQueryConstraints();

    expect(result.constraints).toHaveLength(2);
    expect(result.constraints[0].type).toBe("orderBy");
    expect(result.constraints[1].type).toBe("limit");
    expect(result.options.limit).toBe(20);
    expect(result.options.hasPagination).toBe(false);
    expect(result.options.hasUserFilter).toBe(false);
    expect(result.options.hasAgeFilter).toBe(false);
  });

  it("should build query constraints with user filter", () => {
    const result = buildWhisperQueryConstraints({ userId: "user123" });

    expect(result.constraints).toHaveLength(3);
    expect(result.constraints[0].type).toBe("orderBy");
    expect(result.constraints[1].type).toBe("where");
    expect(result.constraints[2].type).toBe("limit");
    expect(result.options.hasUserFilter).toBe(true);
  });

  it("should build query constraints with pagination", () => {
    const result = buildWhisperQueryConstraints({ startAfter: mockLastDoc });

    expect(result.constraints).toHaveLength(3);
    expect(result.constraints[0].type).toBe("orderBy");
    expect(result.constraints[1].type).toBe("startAfter");
    expect(result.constraints[2].type).toBe("limit");
    expect(result.options.hasPagination).toBe(true);
  });

  it("should build query constraints with custom limit", () => {
    const result = buildWhisperQueryConstraints({ limit: 50 });

    expect(result.options.limit).toBe(50);
  });

  it("should cap limit at maximum value", () => {
    const result = buildWhisperQueryConstraints({ limit: 150 });

    expect(result.options.limit).toBe(100);
  });

  it("should handle both startAfter and lastWhisper", () => {
    const result = buildWhisperQueryConstraints({
      startAfter: mockLastDoc,
      lastWhisper: mockLastDoc,
    });

    expect(result.options.hasPagination).toBe(true);
    expect(
      result.constraints.filter((c) => c.type === "startAfter")
    ).toHaveLength(1);
  });
});

describe("buildPrivacyFilterConstraints", () => {
  it("should build privacy filter constraints", () => {
    const privacyOptions: PrivacyFilterOptions = {
      blockedUsers: new Set(["user1"]),
      mutedUsers: new Set(["user2"]),
    };

    const result = buildPrivacyFilterConstraints(privacyOptions);

    expect(result.constraints).toHaveLength(2);
    expect(result.constraints[0].type).toBe("orderBy");
    expect(result.constraints[1].type).toBe("limit");
    expect(result.options.hasUserFilter).toBe(false);
  });

  it("should build privacy filter constraints with user filter", () => {
    const privacyOptions: PrivacyFilterOptions = {
      blockedUsers: new Set(["user1"]),
      mutedUsers: new Set(["user2"]),
      userId: "user123",
    };

    const result = buildPrivacyFilterConstraints(privacyOptions);

    expect(result.constraints).toHaveLength(3);
    expect(result.constraints[1].type).toBe("where");
    expect(result.options.hasUserFilter).toBe(true);
  });
});

describe("buildAgeFilterConstraints", () => {
  it("should build age filter constraints", () => {
    const result = buildAgeFilterConstraints();

    expect(result.constraints).toHaveLength(2);
    expect(result.constraints[0].type).toBe("orderBy");
    expect(result.constraints[1].type).toBe("limit");
    expect(result.options.hasAgeFilter).toBe(true);
  });
});

describe("buildPaginationConstraints", () => {
  it("should build pagination constraints", () => {
    const paginationOptions: PaginationOptions = {
      startAfter: mockLastDoc,
      limit: 30,
    };

    const result = buildPaginationConstraints(paginationOptions);

    expect(result.constraints).toHaveLength(3);
    expect(result.constraints[1].type).toBe("startAfter");
    expect(result.constraints[2].type).toBe("limit");
    expect(result.options.limit).toBe(30);
    expect(result.options.hasPagination).toBe(true);
  });

  it("should build pagination constraints without startAfter", () => {
    const paginationOptions: PaginationOptions = {
      limit: 30,
    };

    const result = buildPaginationConstraints(paginationOptions);

    expect(result.constraints).toHaveLength(2);
    expect(result.options.hasPagination).toBe(false);
  });
});

describe("buildUserFilterConstraints", () => {
  it("should build user filter constraints", () => {
    const result = buildUserFilterConstraints("user123");

    expect(result.constraints).toHaveLength(3);
    expect(result.constraints[0].type).toBe("orderBy");
    expect(result.constraints[1].type).toBe("where");
    expect(result.constraints[2].type).toBe("limit");
    expect(result.options.hasUserFilter).toBe(true);
  });

  it("should build user filter constraints with pagination", () => {
    const paginationOptions: PaginationOptions = {
      startAfter: mockLastDoc,
      limit: 25,
    };

    const result = buildUserFilterConstraints("user123", paginationOptions);

    expect(result.constraints).toHaveLength(4);
    expect(result.options.limit).toBe(25);
    expect(result.options.hasPagination).toBe(true);
  });
});

// ===== POST-QUERY FILTERING TESTS =====

describe("filterWhispersByPrivacy", () => {
  it("should return all whispers when no privacy filters", () => {
    const privacyOptions: PrivacyFilterOptions = {
      blockedUsers: new Set(),
      mutedUsers: new Set(),
    };

    const result = filterWhispersByPrivacy(mockWhispers, privacyOptions);

    expect(result).toHaveLength(3);
    expect(result).toEqual(mockWhispers);
  });

  it("should filter out blocked users", () => {
    const privacyOptions: PrivacyFilterOptions = {
      blockedUsers: new Set(["user1"]),
      mutedUsers: new Set(),
    };

    const result = filterWhispersByPrivacy(mockWhispers, privacyOptions);

    expect(result).toHaveLength(2);
    expect(result[0].userId).toBe("user2");
    expect(result[1].userId).toBe("user3");
  });

  it("should filter out muted users", () => {
    const privacyOptions: PrivacyFilterOptions = {
      blockedUsers: new Set(),
      mutedUsers: new Set(["user2"]),
    };

    const result = filterWhispersByPrivacy(mockWhispers, privacyOptions);

    expect(result).toHaveLength(2);
    expect(result[0].userId).toBe("user1");
    expect(result[1].userId).toBe("user3");
  });

  it("should filter out both blocked and muted users", () => {
    const privacyOptions: PrivacyFilterOptions = {
      blockedUsers: new Set(["user1"]),
      mutedUsers: new Set(["user2"]),
    };

    const result = filterWhispersByPrivacy(mockWhispers, privacyOptions);

    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe("user3");
  });
});

describe("filterWhispersByAge", () => {
  it("should return all whispers when no age filters", () => {
    const ageOptions: AgeFilterOptions = {};

    const result = filterWhispersByAge(mockWhispers, ageOptions);

    expect(result).toHaveLength(3);
    expect(result).toEqual(mockWhispers);
  });

  it("should filter adult content for minors", () => {
    const ageOptions: AgeFilterOptions = {
      isMinor: true,
    };

    const result = filterWhispersByAge(mockWhispers, ageOptions);

    expect(result).toHaveLength(2);
    expect(result[0].userId).toBe("user1");
    expect(result[1].userId).toBe("user3");
  });

  it("should filter adult content violations for minors", () => {
    const whispersWithViolations = [
      {
        id: "whisper1",
        userId: "user1",
        userDisplayName: "User 1",
        userProfileColor: "#FF0000",
        audioUrl: "https://example.com/audio1.mp3",
        duration: 30,
        whisperPercentage: 85,
        averageLevel: 0.7,
        confidence: 0.9,
        likes: 10,
        replies: 5,
        createdAt: new Date("2024-01-01"),
        transcription: "Safe content",
        isTranscribed: true,
        moderationResult: {
          status: ModerationStatus.APPROVED,
          contentRank: ContentRank.G,
          isMinorSafe: true,
          violations: [],
          confidence: 0.95,
          moderationTime: 100,
          apiResults: {},
          reputationImpact: 0,
          appealable: false,
        },
      },
      {
        id: "whisper2",
        userId: "user2",
        userDisplayName: "User 2",
        userProfileColor: "#00FF00",
        audioUrl: "https://example.com/audio2.mp3",
        duration: 45,
        whisperPercentage: 90,
        averageLevel: 0.8,
        confidence: 0.95,
        likes: 15,
        replies: 8,
        createdAt: new Date("2024-01-02"),
        transcription: "Adult content",
        isTranscribed: true,
        moderationResult: {
          status: ModerationStatus.APPROVED,
          contentRank: ContentRank.R,
          isMinorSafe: false,
          violations: [
            {
              type: ViolationType.SEXUAL_CONTENT,
              severity: "high" as const,
              confidence: 0.9,
              description: "Adult content detected",
              suggestedAction: "flag" as const,
            },
          ],
          confidence: 0.95,
          moderationTime: 100,
          apiResults: {},
          reputationImpact: -5,
          appealable: true,
        },
      },
    ];

    const ageOptions: AgeFilterOptions = {
      isMinor: true,
    };

    const result = filterWhispersByAge(whispersWithViolations, ageOptions);

    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe("user1");
  });

  it("should filter questionable content with strict filtering", () => {
    const ageOptions: AgeFilterOptions = {
      contentPreferences: {
        allowAdultContent: false,
        strictFiltering: true,
      },
    };

    const result = filterWhispersByAge(mockWhispers, ageOptions);

    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe("user1");
  });

  it("should filter adult content when not allowed", () => {
    const ageOptions: AgeFilterOptions = {
      contentPreferences: {
        allowAdultContent: false,
        strictFiltering: false,
      },
    };

    const result = filterWhispersByAge(mockWhispers, ageOptions);

    expect(result).toHaveLength(2);
    expect(result[0].userId).toBe("user1");
    expect(result[1].userId).toBe("user3");
  });
});

describe("applyWhisperFilters", () => {
  it("should apply privacy filters", () => {
    const privacyOptions: PrivacyFilterOptions = {
      blockedUsers: new Set(["user1"]),
      mutedUsers: new Set(),
    };

    const result = applyWhisperFilters(mockWhispers, privacyOptions);

    expect(result).toHaveLength(2);
    expect(result[0].userId).toBe("user2");
    expect(result[1].userId).toBe("user3");
  });

  it("should apply age filters", () => {
    const ageOptions: AgeFilterOptions = {
      isMinor: true,
    };

    const result = applyWhisperFilters(mockWhispers, undefined, ageOptions);

    expect(result).toHaveLength(2);
    expect(result[0].userId).toBe("user1");
    expect(result[1].userId).toBe("user3");
  });

  it("should apply both privacy and age filters", () => {
    const privacyOptions: PrivacyFilterOptions = {
      blockedUsers: new Set(["user1"]),
      mutedUsers: new Set(),
    };

    const ageOptions: AgeFilterOptions = {
      isMinor: true,
    };

    const result = applyWhisperFilters(
      mockWhispers,
      privacyOptions,
      ageOptions
    );

    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe("user3");
  });

  it("should return original whispers when no filters", () => {
    const result = applyWhisperFilters(mockWhispers);

    expect(result).toEqual(mockWhispers);
  });
});

// ===== PAGINATION UTILITIES TESTS =====

describe("calculatePaginationMetadata", () => {
  it("should calculate pagination metadata with more results", () => {
    const result = calculatePaginationMetadata(mockQuerySnapshot, 3);

    expect(result.lastDoc).toBe(mockQuerySnapshot.docs[2]);
    expect(result.hasMore).toBe(true);
  });

  it("should calculate pagination metadata without more results", () => {
    const result = calculatePaginationMetadata(mockQuerySnapshot, 5);

    expect(result.lastDoc).toBe(mockQuerySnapshot.docs[2]);
    expect(result.hasMore).toBe(false);
  });

  it("should handle empty query snapshot", () => {
    const emptySnapshot = { docs: [] };
    const result = calculatePaginationMetadata(emptySnapshot, 10);

    expect(result.lastDoc).toBeNull();
    expect(result.hasMore).toBe(false);
  });
});

describe("createPaginatedResult", () => {
  it("should create paginated result", () => {
    const result = createPaginatedResult(mockWhispers, mockLastDoc, true);

    expect(result.whispers).toEqual(mockWhispers);
    expect(result.lastDoc).toBe(mockLastDoc);
    expect(result.hasMore).toBe(true);
  });

  it("should create paginated result without more results", () => {
    const result = createPaginatedResult(mockWhispers, null, false);

    expect(result.whispers).toEqual(mockWhispers);
    expect(result.lastDoc).toBeNull();
    expect(result.hasMore).toBe(false);
  });
});

// ===== QUERY OPTIMIZATION TESTS =====

describe("optimizeQueryConstraints", () => {
  it("should remove duplicate constraints", () => {
    const constraints = [
      orderBy("createdAt", "desc"),
      orderBy("createdAt", "desc"),
      limit(20),
      limit(20),
    ];

    const result = optimizeQueryConstraints(constraints);

    expect(result).toHaveLength(2);
    expect(result[0].type).toBe("orderBy");
    expect(result[1].type).toBe("limit");
  });

  it("should ensure ordering constraints come first", () => {
    const constraints = [
      limit(20),
      orderBy("createdAt", "desc"),
      where("userId", "==", "user123"),
    ];

    const result = optimizeQueryConstraints(constraints);

    expect(result[0].type).toBe("orderBy");
  });
});

describe("validateQueryOptions", () => {
  it("should validate correct query options", () => {
    const options: WhisperFeedOptions = {
      limit: 20,
      userId: "user123",
      userAge: 25,
      contentPreferences: {
        allowAdultContent: false,
        strictFiltering: true,
      },
    };

    const result = validateQueryOptions(options);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should reject invalid limit", () => {
    const options: WhisperFeedOptions = {
      limit: -1,
    };

    const result = validateQueryOptions(options);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Limit must be greater than 0");
  });

  it("should reject limit exceeding maximum", () => {
    const options: WhisperFeedOptions = {
      limit: 150,
    };

    const result = validateQueryOptions(options);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Limit cannot exceed 100");
  });

  it("should warn for large limits", () => {
    const options: WhisperFeedOptions = {
      limit: 75,
    };

    const result = validateQueryOptions(options);

    expect(result.isValid).toBe(true);
    expect(result.warnings).toContain("Large limits may impact performance");
  });

  it("should reject invalid user age", () => {
    const options: WhisperFeedOptions = {
      userAge: -5,
    };

    const result = validateQueryOptions(options);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("User age must be between 0 and 120");
  });

  it("should reject invalid content preferences", () => {
    const options: WhisperFeedOptions = {
      contentPreferences: {
        allowAdultContent: "invalid" as any,
        strictFiltering: true,
      },
    };

    const result = validateQueryOptions(options);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("allowAdultContent must be a boolean");
  });
});

describe("createDefaultQueryOptions", () => {
  it("should create default query options", () => {
    const result = createDefaultQueryOptions();

    expect(result.limit).toBe(20);
    expect(result.userAge).toBeUndefined();
    expect(result.isMinor).toBe(false);
    expect(result.contentPreferences).toEqual({
      allowAdultContent: false,
      strictFiltering: true,
    });
  });
});

describe("mergeQueryOptions", () => {
  it("should merge user options with defaults", () => {
    const userOptions: WhisperFeedOptions = {
      limit: 50,
      userId: "user123",
    };

    const result = mergeQueryOptions(userOptions);

    expect(result.limit).toBe(50);
    expect(result.userId).toBe("user123");
    expect(result.contentPreferences).toEqual({
      allowAdultContent: false,
      strictFiltering: true,
    });
  });

  it("should merge content preferences", () => {
    const userOptions: WhisperFeedOptions = {
      contentPreferences: {
        allowAdultContent: true,
        strictFiltering: false,
      },
    };

    const result = mergeQueryOptions(userOptions);

    expect(result.contentPreferences).toEqual({
      allowAdultContent: true,
      strictFiltering: false,
    });
  });
});

// ===== UTILITY FUNCTION TESTS =====

describe("hasQueryConstraint", () => {
  it("should check for constraint type", () => {
    const constraints = [
      orderBy("createdAt", "desc"),
      where("userId", "==", "user123"),
      limit(20),
    ];

    expect(hasQueryConstraint(constraints, "orderBy")).toBe(true);
    expect(hasQueryConstraint(constraints, "where")).toBe(true);
    expect(hasQueryConstraint(constraints, "limit")).toBe(true);
    expect(hasQueryConstraint(constraints, "startAfter")).toBe(false);
  });

  it("should check for constraint type and field", () => {
    const constraints = [
      orderBy("createdAt", "desc"),
      where("userId", "==", "user123"),
      limit(20),
    ];

    expect(hasQueryConstraint(constraints, "where", "userId")).toBe(true);
    expect(hasQueryConstraint(constraints, "where", "createdAt")).toBe(false);
  });
});

describe("getQueryConstraint", () => {
  it("should get constraint by type", () => {
    const constraints = [
      orderBy("createdAt", "desc"),
      where("userId", "==", "user123"),
      limit(20),
    ];

    const result = getQueryConstraint(constraints, "where");

    expect(result).toBeDefined();
    expect(result?.type).toBe("where");
  });

  it("should get constraint by type and field", () => {
    const constraints = [
      orderBy("createdAt", "desc"),
      where("userId", "==", "user123"),
      limit(20),
    ];

    const result = getQueryConstraint(constraints, "where", "userId");

    expect(result).toBeDefined();
    expect(result?.type).toBe("where");
  });

  it("should return undefined for non-existent constraint", () => {
    const constraints = [orderBy("createdAt", "desc")];

    const result = getQueryConstraint(constraints, "where");

    expect(result).toBeUndefined();
  });
});

describe("removeQueryConstraint", () => {
  it("should remove constraint by type", () => {
    const constraints = [
      orderBy("createdAt", "desc"),
      where("userId", "==", "user123"),
      limit(20),
    ];

    const result = removeQueryConstraint(constraints, "where");

    expect(result).toHaveLength(2);
    expect(result[0].type).toBe("orderBy");
    expect(result[1].type).toBe("limit");
  });

  it("should remove constraint by type and field", () => {
    const constraints = [
      orderBy("createdAt", "desc"),
      where("userId", "==", "user123"),
      where("createdAt", ">", new Date()),
    ];

    const result = removeQueryConstraint(constraints, "where", "userId");

    expect(result).toHaveLength(2);
    expect(result[0].type).toBe("orderBy");
    expect(result[1].type).toBe("where");
  });
});

describe("cloneQueryConstraints", () => {
  it("should clone query constraints", () => {
    const constraints = [
      orderBy("createdAt", "desc"),
      where("userId", "==", "user123"),
      limit(20),
    ];

    const result = cloneQueryConstraints(constraints);

    expect(result).toHaveLength(3);
    expect(result).not.toBe(constraints);
    expect(result[0].type).toBe("orderBy");
    expect(result[1].type).toBe("where");
    expect(result[2].type).toBe("limit");
  });
});

describe("areQueryConstraintsEquivalent", () => {
  it("should return true for equivalent constraints", () => {
    const constraints1 = [
      orderBy("createdAt", "desc"),
      where("userId", "==", "user123"),
      limit(20),
    ];

    const constraints2 = [
      orderBy("createdAt", "desc"),
      where("userId", "==", "user123"),
      limit(20),
    ];

    const result = areQueryConstraintsEquivalent(constraints1, constraints2);

    expect(result).toBe(true);
  });

  it("should return false for different constraints", () => {
    const constraints1 = [
      orderBy("createdAt", "desc"),
      where("userId", "==", "user123"),
      limit(20),
    ];

    const constraints2 = [
      orderBy("createdAt", "desc"),
      where("userId", "==", "user456"),
      limit(20),
    ];

    const result = areQueryConstraintsEquivalent(constraints1, constraints2);

    expect(result).toBe(false);
  });

  it("should return false for different lengths", () => {
    const constraints1 = [orderBy("createdAt", "desc")];
    const constraints2 = [orderBy("createdAt", "desc"), limit(20)];

    const result = areQueryConstraintsEquivalent(constraints1, constraints2);

    expect(result).toBe(false);
  });
});

// ===== EDGE CASES AND BOUNDARY TESTS =====

describe("Edge Cases and Boundary Tests", () => {
  it("should handle empty constraints array", () => {
    const result = optimizeQueryConstraints([]);
    expect(result).toHaveLength(0);
  });

  it("should handle single constraint", () => {
    const constraints = [orderBy("createdAt", "desc")];
    const result = optimizeQueryConstraints(constraints);
    expect(result).toEqual(constraints);
  });

  it("should handle null/undefined values in filtering", () => {
    const whispersWithNulls = [
      {
        id: "whisper1",
        userId: "user1",
        userDisplayName: "User 1",
        userProfileColor: "#FF0000",
        audioUrl: "https://example.com/audio1.mp3",
        duration: 30,
        whisperPercentage: 85,
        averageLevel: 0.7,
        confidence: 0.9,
        likes: 10,
        replies: 5,
        createdAt: new Date("2024-01-01"),
        transcription: "Content 1",
        isTranscribed: true,
        moderationResult: undefined,
      },
      {
        id: "whisper2",
        userId: "user2",
        userDisplayName: "User 2",
        userProfileColor: "#00FF00",
        audioUrl: "https://example.com/audio2.mp3",
        duration: 45,
        whisperPercentage: 90,
        averageLevel: 0.8,
        confidence: 0.95,
        likes: 15,
        replies: 8,
        createdAt: new Date("2024-01-02"),
        transcription: "Content 2",
        isTranscribed: true,
        moderationResult: undefined,
      },
    ];

    const ageOptions: AgeFilterOptions = { isMinor: true };
    const result = filterWhispersByAge(whispersWithNulls, ageOptions);

    expect(result).toHaveLength(2);
  });

  it("should handle empty arrays in filtering", () => {
    const privacyOptions: PrivacyFilterOptions = {
      blockedUsers: new Set(["user1"]),
      mutedUsers: new Set(),
    };

    const result = filterWhispersByPrivacy([], privacyOptions);
    expect(result).toHaveLength(0);
  });

  it("should handle boundary values in validation", () => {
    const options: WhisperFeedOptions = {
      limit: 100, // Maximum allowed
      userAge: 0, // Minimum allowed
    };

    const result = validateQueryOptions(options);
    expect(result.isValid).toBe(true);
  });

  it("should handle boundary values in validation - edge cases", () => {
    const options: WhisperFeedOptions = {
      limit: 101, // Exceeds maximum
      userAge: 121, // Exceeds maximum
    };

    const result = validateQueryOptions(options);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Limit cannot exceed 100");
    expect(result.errors).toContain("User age must be between 0 and 120");
  });
});
