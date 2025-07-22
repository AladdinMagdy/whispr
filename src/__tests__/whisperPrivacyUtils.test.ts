import {
  shouldExcludeBlockedUser,
  shouldExcludeBlockedByUser,
  shouldExcludeMutedUser,
  shouldExcludeContent,
  filterWhispersByPrivacy,
  calculatePrivacyScore,
  calculateReputationPrivacyScore,
  calculateViolationPrivacyScore,
  shouldShowContent,
  filterWhispersByVisibility,
  calculatePrivacyStats,
  getPrivacyRecommendations,
  hasRecentViolations,
  getViolationCountByType,
  shouldAutoRestrictUser,
  calculateRestrictionDuration,
  validatePrivacyData,
  createDefaultPrivacyData,
  mergePrivacyData,
  PrivacyData,
  PrivacyStats,
  ContentVisibilityOptions,
} from "../utils/whisperPrivacyUtils";
import {
  Whisper,
  UserReputation,
  UserViolation,
  ContentRank,
  ViolationType,
} from "@/types";

// ===== TEST DATA =====

const mockWhispers: Whisper[] = [
  {
    id: "whisper1",
    userId: "user1",
    userDisplayName: "User 1",
    userProfileColor: "#FF0000",
    audioUrl: "audio1.mp3",
    duration: 10,
    whisperPercentage: 80,
    averageLevel: 0.5,
    confidence: 0.9,
    likes: 5,
    replies: 2,
    createdAt: new Date(),
    isTranscribed: true,
    moderationResult: {
      status: "approved" as any,
      contentRank: ContentRank.G,
      isMinorSafe: true,
      violations: [],
      confidence: 0.9,
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
    audioUrl: "audio2.mp3",
    duration: 15,
    whisperPercentage: 70,
    averageLevel: 0.6,
    confidence: 0.8,
    likes: 10,
    replies: 5,
    createdAt: new Date(),
    isTranscribed: true,
    moderationResult: {
      status: "approved" as any,
      contentRank: ContentRank.R,
      isMinorSafe: false,
      violations: [
        {
          type: ViolationType.SEXUAL_CONTENT,
          severity: "high",
          confidence: 0.8,
          description: "Adult content",
          suggestedAction: "flag",
        },
      ],
      confidence: 0.8,
      moderationTime: 150,
      apiResults: {},
      reputationImpact: -10,
      appealable: true,
    },
  },
  {
    id: "whisper3",
    userId: "user3",
    userDisplayName: "User 3",
    userProfileColor: "#0000FF",
    audioUrl: "audio3.mp3",
    duration: 8,
    whisperPercentage: 90,
    averageLevel: 0.4,
    confidence: 0.95,
    likes: 3,
    replies: 1,
    createdAt: new Date(),
    isTranscribed: true,
    moderationResult: {
      status: "approved" as any,
      contentRank: ContentRank.PG13,
      isMinorSafe: true,
      violations: [],
      confidence: 0.95,
      moderationTime: 80,
      apiResults: {},
      reputationImpact: 0,
      appealable: false,
    },
  },
];

const mockUserReputation: UserReputation = {
  userId: "user1",
  score: 85,
  level: "verified",
  totalWhispers: 50,
  approvedWhispers: 48,
  flaggedWhispers: 2,
  rejectedWhispers: 0,
  violationHistory: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockUserViolations: UserViolation[] = [
  {
    id: "violation1",
    userId: "user1",
    whisperId: "whisper1",
    violationType: "whisper_flagged",
    reason: "Inappropriate content",
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
  },
  {
    id: "violation2",
    userId: "user1",
    whisperId: "whisper2",
    violationType: "temporary_ban",
    reason: "Multiple violations",
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
  },
];

// ===== PRIVACY FILTERING TESTS =====

describe("shouldExcludeBlockedUser", () => {
  it("should return true when user is blocked", () => {
    const blockedUsers = new Set(["user1", "user2"]);
    const result = shouldExcludeBlockedUser("user1", blockedUsers);
    expect(result).toBe(true);
  });

  it("should return false when user is not blocked", () => {
    const blockedUsers = new Set(["user2", "user3"]);
    const result = shouldExcludeBlockedUser("user1", blockedUsers);
    expect(result).toBe(false);
  });

  it("should return false when blocked users set is empty", () => {
    const blockedUsers = new Set<string>();
    const result = shouldExcludeBlockedUser("user1", blockedUsers);
    expect(result).toBe(false);
  });
});

describe("shouldExcludeBlockedByUser", () => {
  it("should return true when user has blocked current user", () => {
    const blockedByUsers = new Set(["user1", "user2"]);
    const result = shouldExcludeBlockedByUser("user1", blockedByUsers);
    expect(result).toBe(true);
  });

  it("should return false when user has not blocked current user", () => {
    const blockedByUsers = new Set(["user2", "user3"]);
    const result = shouldExcludeBlockedByUser("user1", blockedByUsers);
    expect(result).toBe(false);
  });
});

describe("shouldExcludeMutedUser", () => {
  it("should return true when user is muted", () => {
    const mutedUsers = new Set(["user1", "user2"]);
    const result = shouldExcludeMutedUser("user1", mutedUsers);
    expect(result).toBe(true);
  });

  it("should return false when user is not muted", () => {
    const mutedUsers = new Set(["user2", "user3"]);
    const result = shouldExcludeMutedUser("user1", mutedUsers);
    expect(result).toBe(false);
  });
});

describe("shouldExcludeContent", () => {
  it("should exclude content from blocked user", () => {
    const privacyData: PrivacyData = {
      blockedUsers: new Set(["user1"]),
      blockedByUsers: new Set(),
      mutedUsers: new Set(),
    };

    const result = shouldExcludeContent(mockWhispers[0], privacyData);
    expect(result.shouldExclude).toBe(true);
    expect(result.reason).toBe("User is blocked");
    expect(result.privacyScore).toBe(0);
  });

  it("should exclude content from user who blocked current user", () => {
    const privacyData: PrivacyData = {
      blockedUsers: new Set(),
      blockedByUsers: new Set(["user2"]),
      mutedUsers: new Set(),
    };

    const result = shouldExcludeContent(mockWhispers[1], privacyData);
    expect(result.shouldExclude).toBe(true);
    expect(result.reason).toBe("User has blocked you");
    expect(result.privacyScore).toBe(0);
  });

  it("should exclude content from muted user", () => {
    const privacyData: PrivacyData = {
      blockedUsers: new Set(),
      blockedByUsers: new Set(),
      mutedUsers: new Set(["user3"]),
    };

    const result = shouldExcludeContent(mockWhispers[2], privacyData);
    expect(result.shouldExclude).toBe(true);
    expect(result.reason).toBe("User is muted");
    expect(result.privacyScore).toBe(10);
  });

  it("should not exclude content when no privacy issues", () => {
    const privacyData: PrivacyData = {
      blockedUsers: new Set(),
      blockedByUsers: new Set(),
      mutedUsers: new Set(),
    };

    const result = shouldExcludeContent(mockWhispers[0], privacyData);
    expect(result.shouldExclude).toBe(false);
    expect(result.privacyScore).toBe(100);
  });

  it("should calculate privacy score based on reputation", () => {
    const privacyData: PrivacyData = {
      blockedUsers: new Set(),
      blockedByUsers: new Set(),
      mutedUsers: new Set(),
      currentUserId: "user1",
      userReputation: mockUserReputation,
    };

    const result = shouldExcludeContent(mockWhispers[0], privacyData);
    expect(result.shouldExclude).toBe(false);
    expect(result.privacyScore).toBe(90); // Based on verified reputation
  });
});

describe("filterWhispersByPrivacy", () => {
  it("should filter out blocked users", () => {
    const privacyData: PrivacyData = {
      blockedUsers: new Set(["user1"]),
      blockedByUsers: new Set(),
      mutedUsers: new Set(),
    };

    const result = filterWhispersByPrivacy(mockWhispers, privacyData);
    expect(result).toHaveLength(2);
    expect(result[0].userId).toBe("user2");
    expect(result[1].userId).toBe("user3");
  });

  it("should filter out muted users", () => {
    const privacyData: PrivacyData = {
      blockedUsers: new Set(),
      blockedByUsers: new Set(),
      mutedUsers: new Set(["user2"]),
    };

    const result = filterWhispersByPrivacy(mockWhispers, privacyData);
    expect(result).toHaveLength(2);
    expect(result[0].userId).toBe("user1");
    expect(result[1].userId).toBe("user3");
  });

  it("should return all whispers when no privacy filters", () => {
    const privacyData: PrivacyData = {
      blockedUsers: new Set(),
      blockedByUsers: new Set(),
      mutedUsers: new Set(),
    };

    const result = filterWhispersByPrivacy(mockWhispers, privacyData);
    expect(result).toHaveLength(3);
  });
});

// ===== PRIVACY SCORE TESTS =====

describe("calculatePrivacyScore", () => {
  it("should return 100 for user with no privacy issues", () => {
    const privacyData: PrivacyData = {
      blockedUsers: new Set(),
      blockedByUsers: new Set(),
      mutedUsers: new Set(),
    };

    const result = calculatePrivacyScore("user1", privacyData);
    expect(result).toBe(100);
  });

  it("should return 0 for blocked user", () => {
    const privacyData: PrivacyData = {
      blockedUsers: new Set(["user1"]),
      blockedByUsers: new Set(),
      mutedUsers: new Set(),
    };

    const result = calculatePrivacyScore("user1", privacyData);
    expect(result).toBe(0);
  });

  it("should return 10 for muted user", () => {
    const privacyData: PrivacyData = {
      blockedUsers: new Set(),
      blockedByUsers: new Set(),
      mutedUsers: new Set(["user1"]),
    };

    const result = calculatePrivacyScore("user1", privacyData);
    expect(result).toBe(10);
  });

  it("should apply reputation-based adjustments", () => {
    const privacyData: PrivacyData = {
      blockedUsers: new Set(),
      blockedByUsers: new Set(),
      mutedUsers: new Set(),
      currentUserId: "user1",
      userReputation: mockUserReputation,
    };

    const result = calculatePrivacyScore("user1", privacyData);
    expect(result).toBe(90); // Based on verified reputation
  });
});

describe("calculateReputationPrivacyScore", () => {
  it("should return 100 for trusted user", () => {
    const reputation: UserReputation = {
      ...mockUserReputation,
      level: "trusted",
    };
    const result = calculateReputationPrivacyScore(reputation);
    expect(result).toBe(100);
  });

  it("should return 90 for verified user", () => {
    const reputation: UserReputation = {
      ...mockUserReputation,
      level: "verified",
    };
    const result = calculateReputationPrivacyScore(reputation);
    expect(result).toBe(90);
  });

  it("should return 75 for standard user", () => {
    const reputation: UserReputation = {
      ...mockUserReputation,
      level: "standard",
    };
    const result = calculateReputationPrivacyScore(reputation);
    expect(result).toBe(75);
  });

  it("should return 25 for flagged user", () => {
    const reputation: UserReputation = {
      ...mockUserReputation,
      level: "flagged",
    };
    const result = calculateReputationPrivacyScore(reputation);
    expect(result).toBe(25);
  });

  it("should return 0 for banned user", () => {
    const reputation: UserReputation = {
      ...mockUserReputation,
      level: "banned",
    };
    const result = calculateReputationPrivacyScore(reputation);
    expect(result).toBe(0);
  });
});

describe("calculateViolationPrivacyScore", () => {
  it("should return 100 for user with no violations", () => {
    const result = calculateViolationPrivacyScore([]);
    expect(result).toBe(100);
  });

  it("should reduce score for recent violations", () => {
    const recentViolations: UserViolation[] = [
      {
        id: "violation1",
        userId: "user1",
        whisperId: "whisper1",
        violationType: "whisper_flagged",
        reason: "Test violation",
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      },
    ];

    const result = calculateViolationPrivacyScore(recentViolations);
    expect(result).toBeLessThan(100);
    expect(result).toBeGreaterThan(0);
  });

  it("should apply higher penalty for more severe violations", () => {
    const violations: UserViolation[] = [
      {
        id: "violation1",
        userId: "user1",
        whisperId: "whisper1",
        violationType: "extended_ban",
        reason: "Severe violation",
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
    ];

    const result = calculateViolationPrivacyScore(violations);
    expect(result).toBeLessThan(60); // Should be significantly reduced
  });
});

// ===== CONTENT VISIBILITY TESTS =====

describe("shouldShowContent", () => {
  it("should show safe content to minors", () => {
    const options: ContentVisibilityOptions = {
      isMinor: true,
      allowAdultContent: false,
      strictFiltering: false,
    };

    const result = shouldShowContent(mockWhispers[0], options);
    expect(result).toBe(true);
  });

  it("should hide adult content from minors", () => {
    const options: ContentVisibilityOptions = {
      isMinor: true,
      allowAdultContent: false,
      strictFiltering: false,
    };

    const result = shouldShowContent(mockWhispers[1], options);
    expect(result).toBe(false);
  });

  it("should hide adult content when not allowed", () => {
    const options: ContentVisibilityOptions = {
      isMinor: false,
      allowAdultContent: false,
      strictFiltering: false,
    };

    const result = shouldShowContent(mockWhispers[1], options);
    expect(result).toBe(false);
  });

  it("should show adult content when allowed", () => {
    const options: ContentVisibilityOptions = {
      isMinor: false,
      allowAdultContent: true,
      strictFiltering: false,
    };

    const result = shouldShowContent(mockWhispers[1], options);
    expect(result).toBe(true);
  });

  it("should hide questionable content with strict filtering", () => {
    const options: ContentVisibilityOptions = {
      isMinor: false,
      allowAdultContent: true,
      strictFiltering: true,
    };

    const result = shouldShowContent(mockWhispers[2], options);
    expect(result).toBe(false);
  });
});

describe("filterWhispersByVisibility", () => {
  it("should filter adult content for minors", () => {
    const options: ContentVisibilityOptions = {
      isMinor: true,
      allowAdultContent: false,
      strictFiltering: false,
    };

    const result = filterWhispersByVisibility(mockWhispers, options);
    expect(result).toHaveLength(2);
    expect(result[0].userId).toBe("user1");
    expect(result[1].userId).toBe("user3");
  });

  it("should return all content when no restrictions", () => {
    const options: ContentVisibilityOptions = {
      isMinor: false,
      allowAdultContent: true,
      strictFiltering: false,
    };

    const result = filterWhispersByVisibility(mockWhispers, options);
    expect(result).toHaveLength(3);
  });
});

// ===== PRIVACY STATISTICS TESTS =====

describe("calculatePrivacyStats", () => {
  it("should calculate basic privacy statistics", () => {
    const privacyData: PrivacyData = {
      blockedUsers: new Set(["user1", "user2"]),
      blockedByUsers: new Set(["user3"]),
      mutedUsers: new Set(["user4", "user5", "user6"]),
      currentUserId: "user1",
      userReputation: mockUserReputation,
      userViolations: mockUserViolations,
    };

    const result = calculatePrivacyStats(privacyData);
    expect(result.totalBlockedUsers).toBe(2);
    expect(result.totalMutedUsers).toBe(3);
    expect(result.totalBlockedByUsers).toBe(1);
    expect(result.violationCount).toBe(2);
    expect(result.privacyScore).toBe(0); // User is blocked, so score should be 0
  });
});

describe("getPrivacyRecommendations", () => {
  it("should provide recommendations for low privacy score", () => {
    const stats: PrivacyStats = {
      totalBlockedUsers: 0,
      totalMutedUsers: 0,
      totalBlockedByUsers: 0,
      privacyScore: 20,
      violationCount: 0,
    };

    const result = getPrivacyRecommendations(stats);
    expect(result).toContain(
      "Your privacy score is very low. Consider reviewing your content and behavior."
    );
  });

  it("should provide recommendations for high violation count", () => {
    const stats: PrivacyStats = {
      totalBlockedUsers: 0,
      totalMutedUsers: 0,
      totalBlockedByUsers: 0,
      privacyScore: 100,
      violationCount: 10,
    };

    const result = getPrivacyRecommendations(stats);
    expect(result).toContain(
      "You have multiple violations. Consider taking a break to improve your standing."
    );
  });

  it("should provide positive feedback for good standing", () => {
    const stats: PrivacyStats = {
      totalBlockedUsers: 0,
      totalMutedUsers: 0,
      totalBlockedByUsers: 0,
      privacyScore: 100,
      violationCount: 0,
    };

    const result = getPrivacyRecommendations(stats);
    expect(result).toContain(
      "Your privacy standing is good. Keep up the positive behavior!"
    );
  });
});

// ===== UTILITY FUNCTION TESTS =====

describe("hasRecentViolations", () => {
  it("should return true for recent violations", () => {
    const recentViolations: UserViolation[] = [
      {
        id: "violation1",
        userId: "user1",
        whisperId: "whisper1",
        violationType: "whisper_flagged",
        reason: "Recent violation",
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      },
    ];

    const result = hasRecentViolations(recentViolations, 30);
    expect(result).toBe(true);
  });

  it("should return false for old violations", () => {
    const oldViolations: UserViolation[] = [
      {
        id: "violation1",
        userId: "user1",
        whisperId: "whisper1",
        violationType: "whisper_flagged",
        reason: "Old violation",
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
      },
    ];

    const result = hasRecentViolations(oldViolations, 30);
    expect(result).toBe(false);
  });
});

describe("getViolationCountByType", () => {
  it("should count violations by type", () => {
    const violations: UserViolation[] = [
      {
        id: "1",
        userId: "user1",
        whisperId: "w1",
        violationType: "whisper_flagged",
        reason: "Test",
        createdAt: new Date(),
      },
      {
        id: "2",
        userId: "user1",
        whisperId: "w2",
        violationType: "whisper_flagged",
        reason: "Test",
        createdAt: new Date(),
      },
      {
        id: "3",
        userId: "user1",
        whisperId: "w3",
        violationType: "temporary_ban",
        reason: "Test",
        createdAt: new Date(),
      },
    ];

    const result = getViolationCountByType(violations);
    expect(result.whisper_flagged).toBe(2);
    expect(result.temporary_ban).toBe(1);
    expect(result.whisper_deleted).toBe(0);
    expect(result.extended_ban).toBe(0);
  });
});

describe("shouldAutoRestrictUser", () => {
  it("should return true for multiple critical violations", () => {
    const violations: UserViolation[] = [
      {
        id: "1",
        userId: "user1",
        whisperId: "w1",
        violationType: "extended_ban",
        reason: "Test",
        createdAt: new Date(),
      },
      {
        id: "2",
        userId: "user1",
        whisperId: "w2",
        violationType: "extended_ban",
        reason: "Test",
        createdAt: new Date(),
      },
    ];

    const result = shouldAutoRestrictUser(violations, mockUserReputation);
    expect(result).toBe(true);
  });

  it("should return true for low reputation", () => {
    const lowReputation: UserReputation = {
      ...mockUserReputation,
      level: "banned",
      score: 5,
    };
    const result = shouldAutoRestrictUser([], lowReputation);
    expect(result).toBe(true);
  });

  it("should return false for good standing", () => {
    const result = shouldAutoRestrictUser([], mockUserReputation);
    expect(result).toBe(false);
  });
});

describe("calculateRestrictionDuration", () => {
  it("should calculate duration based on violations", () => {
    const violations: UserViolation[] = [
      {
        id: "1",
        userId: "user1",
        whisperId: "w1",
        violationType: "extended_ban",
        reason: "Test",
        createdAt: new Date(),
      },
      {
        id: "2",
        userId: "user1",
        whisperId: "w2",
        violationType: "temporary_ban",
        reason: "Test",
        createdAt: new Date(),
      },
    ];

    const result = calculateRestrictionDuration(violations, mockUserReputation);
    expect(result).toBeGreaterThan(0);
  });

  it("should apply reputation multiplier", () => {
    const violations: UserViolation[] = [
      {
        id: "1",
        userId: "user1",
        whisperId: "w1",
        violationType: "whisper_flagged",
        reason: "Test",
        createdAt: new Date(),
      },
    ];

    const trustedReputation: UserReputation = {
      ...mockUserReputation,
      level: "trusted",
    };
    const result = calculateRestrictionDuration(violations, trustedReputation);
    expect(result).toBeLessThanOrEqual(1); // Should be reduced by 0.5 multiplier
  });
});

// ===== VALIDATION TESTS =====

describe("validatePrivacyData", () => {
  it("should validate correct privacy data", () => {
    const privacyData: PrivacyData = {
      blockedUsers: new Set(),
      blockedByUsers: new Set(),
      mutedUsers: new Set(),
      currentUserId: "user1",
      userReputation: mockUserReputation,
      userViolations: mockUserViolations,
    };

    const result = validatePrivacyData(privacyData);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should detect invalid blocked users", () => {
    const privacyData = {
      blockedUsers: "not a set",
      blockedByUsers: new Set(),
      mutedUsers: new Set(),
    } as any;

    const result = validatePrivacyData(privacyData);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("blockedUsers must be a Set");
  });

  it("should detect invalid user violations", () => {
    const privacyData: PrivacyData = {
      blockedUsers: new Set(),
      blockedByUsers: new Set(),
      mutedUsers: new Set(),
      userViolations: [
        {
          id: "1",
          userId: "user1",
          whisperId: "w1",
          reason: "Test",
          createdAt: new Date(),
        } as any, // Missing violationType
      ],
    };

    const result = validatePrivacyData(privacyData);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      "userViolations[0] must have violationType and createdAt properties"
    );
  });
});

describe("createDefaultPrivacyData", () => {
  it("should create default privacy data", () => {
    const result = createDefaultPrivacyData();
    expect(result.blockedUsers).toBeInstanceOf(Set);
    expect(result.blockedByUsers).toBeInstanceOf(Set);
    expect(result.mutedUsers).toBeInstanceOf(Set);
    expect(result.blockedUsers.size).toBe(0);
    expect(result.blockedByUsers.size).toBe(0);
    expect(result.mutedUsers.size).toBe(0);
  });
});

describe("mergePrivacyData", () => {
  it("should merge privacy data correctly", () => {
    const baseData: PrivacyData = {
      blockedUsers: new Set(["user1"]),
      blockedByUsers: new Set(["user2"]),
      mutedUsers: new Set(["user3"]),
    };

    const additionalData: Partial<PrivacyData> = {
      blockedUsers: new Set(["user4"]),
      currentUserId: "user1",
    };

    const result = mergePrivacyData(baseData, additionalData);
    expect(result.blockedUsers.has("user1")).toBe(true);
    expect(result.blockedUsers.has("user4")).toBe(true);
    expect(result.currentUserId).toBe("user1");
  });
});

// ===== EDGE CASES AND BOUNDARY TESTS =====

describe("Edge Cases and Boundary Tests", () => {
  it("should handle empty sets in privacy data", () => {
    const privacyData: PrivacyData = {
      blockedUsers: new Set(),
      blockedByUsers: new Set(),
      mutedUsers: new Set(),
    };

    const result = filterWhispersByPrivacy(mockWhispers, privacyData);
    expect(result).toHaveLength(3);
  });

  it("should handle null/undefined values in filtering", () => {
    const privacyData: PrivacyData = {
      blockedUsers: new Set(),
      blockedByUsers: new Set(),
      mutedUsers: new Set(),
    };

    const whispersWithNull = [
      { ...mockWhispers[0], userId: null as any },
      mockWhispers[1],
    ];

    const result = filterWhispersByPrivacy(whispersWithNull, privacyData);
    expect(result).toHaveLength(2);
  });

  it("should handle empty arrays in filtering", () => {
    const privacyData: PrivacyData = {
      blockedUsers: new Set(),
      blockedByUsers: new Set(),
      mutedUsers: new Set(),
    };

    const result = filterWhispersByPrivacy([], privacyData);
    expect(result).toHaveLength(0);
  });

  it("should handle boundary values in privacy score calculation", () => {
    const privacyData: PrivacyData = {
      blockedUsers: new Set(),
      blockedByUsers: new Set(),
      mutedUsers: new Set(),
      currentUserId: "user1",
      userReputation: { ...mockUserReputation, score: 0, level: "banned" },
    };

    const result = calculatePrivacyScore("user1", privacyData);
    expect(result).toBe(0);
  });

  it("should handle maximum privacy score", () => {
    const privacyData: PrivacyData = {
      blockedUsers: new Set(),
      blockedByUsers: new Set(),
      mutedUsers: new Set(),
      currentUserId: "user1",
      userReputation: { ...mockUserReputation, score: 100, level: "trusted" },
    };

    const result = calculatePrivacyScore("user1", privacyData);
    expect(result).toBe(100);
  });
});
