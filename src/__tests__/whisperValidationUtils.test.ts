import {
  validateWhisperData,
  validateAudioRecording,
  validateUserPermissions,
  validateContentSafety,
  validateContentSafetyWithAge,
  meetsQualityStandards,
  calculateQualityScore,
  shouldFlagForReview,
  validateWhisperMetadata,
  validateWhisperForPublishing,
  getValidationSummary,
  createDefaultValidationOptions,
  createStrictValidationOptions,
  createMinorSafeValidationOptions,
  ValidationResult,
  AudioValidationOptions,
  ContentSafetyOptions,
} from "../utils/whisperValidationUtils";
import {
  Whisper,
  AudioRecording,
  ContentRank,
  ViolationType,
  ModerationStatus,
} from "@/types";

// ===== TEST DATA =====

const mockWhisper: Whisper = {
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
  transcription: "Hello world",
  moderationResult: {
    status: ModerationStatus.APPROVED,
    contentRank: ContentRank.G,
    isMinorSafe: true,
    violations: [],
    confidence: 0.9,
    moderationTime: 100,
    apiResults: {},
    reputationImpact: 0,
    appealable: false,
  },
};

const mockAudioRecording: AudioRecording = {
  uri: "file://audio1.mp3",
  duration: 10,
  volume: 0.5,
  isWhisper: true,
  timestamp: new Date(),
};

const mockModerationResult = {
  status: ModerationStatus.APPROVED,
  contentRank: ContentRank.G,
  isMinorSafe: true,
  violations: [],
  confidence: 0.9,
  moderationTime: 100,
  apiResults: {},
  reputationImpact: 0,
  appealable: false,
};

// ===== WHISPER VALIDATION TESTS =====

describe("validateWhisperData", () => {
  it("should validate correct whisper data", () => {
    const result = validateWhisperData(mockWhisper);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should detect missing required fields", () => {
    const invalidWhisper = { ...mockWhisper };
    delete (invalidWhisper as any).id;
    delete (invalidWhisper as any).userId;

    const result = validateWhisperData(invalidWhisper);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Whisper ID is required");
    expect(result.errors).toContain("User ID is required");
  });

  it("should validate duration constraints", () => {
    const invalidWhisper = { ...mockWhisper, duration: 0 };
    const result = validateWhisperData(invalidWhisper);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Duration must be greater than 0");

    const longWhisper = { ...mockWhisper, duration: 400 };
    const longResult = validateWhisperData(longWhisper);
    expect(longResult.isValid).toBe(false);
    expect(longResult.errors).toContain("Duration cannot exceed 5 minutes");
  });

  it("should validate whisper percentage", () => {
    const invalidWhisper = { ...mockWhisper, whisperPercentage: 150 };
    const result = validateWhisperData(invalidWhisper);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      "Whisper percentage must be between 0 and 100"
    );
  });

  it("should validate average level", () => {
    const invalidWhisper = { ...mockWhisper, averageLevel: 1.5 };
    const result = validateWhisperData(invalidWhisper);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Average level must be between 0 and 1");
  });

  it("should validate confidence", () => {
    const invalidWhisper = { ...mockWhisper, confidence: -0.1 };
    const result = validateWhisperData(invalidWhisper);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Confidence must be between 0 and 1");
  });

  it("should validate likes and replies", () => {
    const invalidWhisper = { ...mockWhisper, likes: -1, replies: -5 };
    const result = validateWhisperData(invalidWhisper);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Likes count cannot be negative");
    expect(result.errors).toContain("Replies count cannot be negative");
  });
});

// ===== AUDIO RECORDING VALIDATION TESTS =====

describe("validateAudioRecording", () => {
  it("should validate correct audio recording", () => {
    const result = validateAudioRecording(mockAudioRecording);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should validate duration constraints", () => {
    const shortRecording = { ...mockAudioRecording, duration: 0.5 };
    const result = validateAudioRecording(shortRecording);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      "Audio duration must be at least 1 second(s)"
    );

    const longRecording = { ...mockAudioRecording, duration: 400 };
    const longResult = validateAudioRecording(longRecording);
    expect(longResult.isValid).toBe(false);
    expect(longResult.errors).toContain(
      "Audio duration cannot exceed 300 seconds"
    );
  });

  it("should validate volume", () => {
    const invalidRecording = { ...mockAudioRecording, volume: 1.5 };
    const result = validateAudioRecording(invalidRecording);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Volume must be between 0 and 1");
  });

  it("should warn for non-whisper audio", () => {
    const nonWhisperRecording = { ...mockAudioRecording, isWhisper: false };
    const result = validateAudioRecording(nonWhisperRecording);
    expect(result.isValid).toBe(true);
    expect(result.warnings).toContain("Audio does not meet whisper criteria");
  });

  it("should validate file format", () => {
    const invalidFormatRecording = {
      ...mockAudioRecording,
      uri: "file://audio1.txt",
    };
    const result = validateAudioRecording(invalidFormatRecording);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("File format .txt is not supported");
  });

  it("should validate timestamp", () => {
    const futureRecording = {
      ...mockAudioRecording,
      timestamp: new Date(Date.now() + 86400000),
    };
    const result = validateAudioRecording(futureRecording);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      "Recording timestamp cannot be in the future"
    );
  });

  it("should validate custom options", () => {
    const customOptions: AudioValidationOptions = {
      minDuration: 5,
      maxDuration: 60,
      minWhisperPercentage: 70,
      maxFileSize: 10 * 1024 * 1024,
      allowedFormats: [".mp3"],
    };

    const shortRecording = { ...mockAudioRecording, duration: 3 };
    const result = validateAudioRecording(shortRecording, customOptions);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      "Audio duration must be at least 5 second(s)"
    );
  });
});

// ===== USER PERMISSIONS VALIDATION TESTS =====

describe("validateUserPermissions", () => {
  it("should validate correct user ID", () => {
    const result = validateUserPermissions("user123");
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should detect missing user ID", () => {
    const result = validateUserPermissions("");
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("User ID is required");
  });

  it("should validate user ID length", () => {
    const result = validateUserPermissions("ab");
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      "User ID must be at least 3 characters long"
    );
  });
});

// ===== CONTENT SAFETY VALIDATION TESTS =====

describe("validateContentSafety", () => {
  it("should validate safe content", () => {
    const result = validateContentSafety(mockModerationResult);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should detect missing moderation result", () => {
    const result = validateContentSafety(null as any);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Moderation result is required");
  });

  it("should detect explicit content", () => {
    const explicitResult = {
      ...mockModerationResult,
      contentRank: ContentRank.NC17,
    };
    const result = validateContentSafety(explicitResult);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Explicit content is not allowed");
  });

  it("should detect content unsafe for minors", () => {
    const unsafeResult = { ...mockModerationResult, isMinorSafe: false };
    const result = validateContentSafety(unsafeResult, { isMinor: true });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Content is not safe for minors");
  });

  it("should detect critical violations", () => {
    const violationResult = {
      ...mockModerationResult,
      violations: [
        {
          type: ViolationType.HATE_SPEECH,
          severity: "critical" as const,
          confidence: 0.9,
          description: "Hate speech",
          suggestedAction: "ban" as const,
        },
      ],
    };
    const result = validateContentSafety(violationResult);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Critical content violations detected");
  });

  it("should detect too many high-severity violations", () => {
    const violationResult = {
      ...mockModerationResult,
      violations: [
        {
          type: ViolationType.HARASSMENT,
          severity: "high" as const,
          confidence: 0.8,
          description: "Harassment",
          suggestedAction: "flag" as const,
        },
        {
          type: ViolationType.VIOLENCE,
          severity: "high" as const,
          confidence: 0.7,
          description: "Violence",
          suggestedAction: "flag" as const,
        },
        {
          type: ViolationType.SPAM,
          severity: "high" as const,
          confidence: 0.6,
          description: "Spam",
          suggestedAction: "flag" as const,
        },
      ],
    };
    const result = validateContentSafety(violationResult);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Too many high-severity violations");
  });

  it("should detect specific violation types", () => {
    const violationResult = {
      ...mockModerationResult,
      violations: [
        {
          type: ViolationType.SEXUAL_CONTENT,
          severity: "high" as const,
          confidence: 0.8,
          description: "Sexual content",
          suggestedAction: "flag" as const,
        },
        {
          type: ViolationType.HATE_SPEECH,
          severity: "medium" as const,
          confidence: 0.7,
          description: "Hate speech",
          suggestedAction: "flag" as const,
        },
        {
          type: ViolationType.VIOLENCE,
          severity: "low" as const,
          confidence: 0.6,
          description: "Violence",
          suggestedAction: "warn" as const,
        },
      ],
    };
    const result = validateContentSafety(violationResult);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Sexual content violations detected");
    expect(result.errors).toContain("Hate speech violations detected");
    expect(result.errors).toContain("Violence violations detected");
  });

  it("should warn for low confidence", () => {
    const lowConfidenceResult = { ...mockModerationResult, confidence: 0.3 };
    const result = validateContentSafety(lowConfidenceResult);
    expect(result.isValid).toBe(true);
    expect(result.warnings).toContain(
      "Low moderation confidence - manual review recommended"
    );
  });
});

// ===== AGE-BASED CONTENT SAFETY TESTS =====

describe("validateContentSafetyWithAge", () => {
  it("should validate content for adults", () => {
    const result = validateContentSafetyWithAge(mockModerationResult, 25);
    expect(result.isValid).toBe(true);
  });

  it("should reject users under 13", () => {
    const result = validateContentSafetyWithAge(mockModerationResult, 12);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Users must be at least 13 years old");
  });

  it("should reject adult content for minors", () => {
    const adultResult = { ...mockModerationResult, contentRank: ContentRank.R };
    const result = validateContentSafetyWithAge(adultResult, 16);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      "Adult content is not allowed for users under 18"
    );
  });

  it("should reject multiple violations for minors", () => {
    const violationResult = {
      ...mockModerationResult,
      violations: [
        {
          type: ViolationType.SPAM,
          severity: "low" as const,
          confidence: 0.6,
          description: "Spam",
          suggestedAction: "warn" as const,
        },
        {
          type: ViolationType.HARASSMENT,
          severity: "medium" as const,
          confidence: 0.7,
          description: "Harassment",
          suggestedAction: "flag" as const,
        },
      ],
    };
    const result = validateContentSafetyWithAge(violationResult, 16);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      "Multiple violations not allowed for users under 18"
    );
  });

  it("should validate custom violation limits", () => {
    const violationResult = {
      ...mockModerationResult,
      violations: [
        {
          type: ViolationType.SPAM,
          severity: "low" as const,
          confidence: 0.6,
          description: "Spam",
          suggestedAction: "warn" as const,
        },
        {
          type: ViolationType.SPAM,
          severity: "low" as const,
          confidence: 0.6,
          description: "Spam",
          suggestedAction: "warn" as const,
        },
        {
          type: ViolationType.SPAM,
          severity: "low" as const,
          confidence: 0.6,
          description: "Spam",
          suggestedAction: "warn" as const,
        },
        {
          type: ViolationType.SPAM,
          severity: "low" as const,
          confidence: 0.6,
          description: "Spam",
          suggestedAction: "warn" as const,
        },
      ],
    };
    const customOptions: ContentSafetyOptions = {
      maxViolationCount: 3,
      blockedKeywords: [],
      maxLength: 1000,
      minLength: 1,
    };
    const result = validateContentSafetyWithAge(
      violationResult,
      25,
      customOptions
    );
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Too many violations (max: 3)");
  });
});

// ===== QUALITY STANDARDS TESTS =====

describe("meetsQualityStandards", () => {
  it("should return true for high-quality whisper", () => {
    const result = meetsQualityStandards(mockWhisper);
    expect(result).toBe(true);
  });

  it("should return false for low whisper percentage", () => {
    const lowQualityWhisper = { ...mockWhisper, whisperPercentage: 30 };
    const result = meetsQualityStandards(lowQualityWhisper);
    expect(result).toBe(false);
  });

  it("should return false for low confidence", () => {
    const lowConfidenceWhisper = { ...mockWhisper, confidence: 0.5 };
    const result = meetsQualityStandards(lowConfidenceWhisper);
    expect(result).toBe(false);
  });

  it("should return false for invalid duration", () => {
    const invalidDurationWhisper = { ...mockWhisper, duration: 0 };
    const result = meetsQualityStandards(invalidDurationWhisper);
    expect(result).toBe(false);
  });

  it("should return false for non-approved content", () => {
    const nonApprovedWhisper = {
      ...mockWhisper,
      moderationResult: {
        ...mockModerationResult,
        status: ModerationStatus.REJECTED,
      },
    };
    const result = meetsQualityStandards(nonApprovedWhisper);
    expect(result).toBe(false);
  });

  it("should return false for content with violations", () => {
    const violationWhisper = {
      ...mockWhisper,
      moderationResult: {
        ...mockModerationResult,
        violations: [
          {
            type: ViolationType.SPAM,
            severity: "low" as const,
            confidence: 0.6,
            description: "Spam",
            suggestedAction: "warn" as const,
          },
        ],
      },
    };
    const result = meetsQualityStandards(violationWhisper);
    expect(result).toBe(false);
  });
});

// ===== QUALITY SCORE TESTS =====

describe("calculateQualityScore", () => {
  it("should return high score for quality whisper", () => {
    const result = calculateQualityScore(mockWhisper);
    expect(result).toBeGreaterThan(80);
  });

  it("should reduce score for low whisper percentage", () => {
    const lowPercentageWhisper = { ...mockWhisper, whisperPercentage: 60 };
    const result = calculateQualityScore(lowPercentageWhisper);
    expect(result).toBeLessThan(100);
  });

  it("should reduce score for low confidence", () => {
    const lowConfidenceWhisper = { ...mockWhisper, confidence: 0.7 };
    const result = calculateQualityScore(lowConfidenceWhisper);
    expect(result).toBeLessThan(100);
  });

  it("should reduce score for violations", () => {
    const violationWhisper = {
      ...mockWhisper,
      moderationResult: {
        ...mockModerationResult,
        violations: [
          {
            type: ViolationType.SPAM,
            severity: "low" as const,
            confidence: 0.6,
            description: "Spam",
            suggestedAction: "warn" as const,
          },
          {
            type: ViolationType.HARASSMENT,
            severity: "medium" as const,
            confidence: 0.7,
            description: "Harassment",
            suggestedAction: "flag" as const,
          },
        ],
      },
    };
    const result = calculateQualityScore(violationWhisper);
    expect(result).toBeLessThan(100);
  });

  it("should reduce score for low engagement", () => {
    const lowEngagementWhisper = { ...mockWhisper, likes: 0 };
    const result = calculateQualityScore(lowEngagementWhisper);
    expect(result).toBeLessThan(100);
  });

  it("should return score between 0 and 100", () => {
    const result = calculateQualityScore(mockWhisper);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(100);
  });
});

// ===== REVIEW FLAGGING TESTS =====

describe("shouldFlagForReview", () => {
  it("should return false for high-quality whisper", () => {
    const result = shouldFlagForReview(mockWhisper);
    expect(result).toBe(false);
  });

  it("should flag for low confidence", () => {
    const lowConfidenceWhisper = { ...mockWhisper, confidence: 0.5 };
    const result = shouldFlagForReview(lowConfidenceWhisper);
    expect(result).toBe(true);
  });

  it("should flag for very low whisper percentage", () => {
    const lowPercentageWhisper = { ...mockWhisper, whisperPercentage: 20 };
    const result = shouldFlagForReview(lowPercentageWhisper);
    expect(result).toBe(true);
  });

  it("should flag for violations", () => {
    const violationWhisper = {
      ...mockWhisper,
      moderationResult: {
        ...mockModerationResult,
        violations: [
          {
            type: ViolationType.SPAM,
            severity: "low" as const,
            confidence: 0.6,
            description: "Spam",
            suggestedAction: "warn" as const,
          },
        ],
      },
    };
    const result = shouldFlagForReview(violationWhisper);
    expect(result).toBe(true);
  });

  it("should flag for questionable content", () => {
    const questionableWhisper = {
      ...mockWhisper,
      moderationResult: {
        ...mockModerationResult,
        contentRank: ContentRank.PG13,
      },
    };
    const result = shouldFlagForReview(questionableWhisper);
    expect(result).toBe(true);
  });
});

// ===== METADATA VALIDATION TESTS =====

describe("validateWhisperMetadata", () => {
  it("should validate correct metadata", () => {
    const result = validateWhisperMetadata(mockWhisper);
    expect(result.isValid).toBe(true);
  });

  it("should warn for missing transcription", () => {
    const noTranscriptionWhisper = {
      ...mockWhisper,
      isTranscribed: true,
      transcription: undefined,
    };
    const result = validateWhisperMetadata(noTranscriptionWhisper);
    expect(result.isValid).toBe(true);
    expect(result.warnings).toContain(
      "Whisper marked as transcribed but no transcription found"
    );
  });

  it("should warn for very long transcription", () => {
    const longTranscriptionWhisper = {
      ...mockWhisper,
      transcription: "a".repeat(1500),
    };
    const result = validateWhisperMetadata(longTranscriptionWhisper);
    expect(result.isValid).toBe(true);
    expect(result.warnings).toContain("Transcription is very long");
  });

  it("should warn for empty transcription", () => {
    const emptyTranscriptionWhisper = { ...mockWhisper, transcription: "   " };
    const result = validateWhisperMetadata(emptyTranscriptionWhisper);
    expect(result.isValid).toBe(true);
    expect(result.warnings).toContain("Transcription is empty");
  });

  it("should warn for repeated characters", () => {
    const repeatedCharsWhisper = {
      ...mockWhisper,
      transcription: "Hello worlddddddd",
    };
    const result = validateWhisperMetadata(repeatedCharsWhisper);
    expect(result.isValid).toBe(true);
    expect(result.warnings).toContain(
      "Transcription contains suspicious repeated characters"
    );
  });

  it("should warn for all caps", () => {
    const allCapsWhisper = {
      ...mockWhisper,
      transcription: "HELLO WORLD THIS IS A TEST",
    };
    const result = validateWhisperMetadata(allCapsWhisper);
    expect(result.isValid).toBe(true);
    expect(result.warnings).toContain("Transcription is all caps");
  });
});

// ===== PUBLISHING VALIDATION TESTS =====

describe("validateWhisperForPublishing", () => {
  it("should validate publishable whisper", () => {
    const result = validateWhisperForPublishing(mockWhisper);
    expect(result.isValid).toBe(true);
  });

  it("should reject whisper that doesn't meet quality standards", () => {
    const lowQualityWhisper = {
      ...mockWhisper,
      whisperPercentage: 30,
      confidence: 0.5,
    };
    const result = validateWhisperForPublishing(lowQualityWhisper);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Whisper does not meet quality standards");
  });

  it("should include metadata validation results", () => {
    const noTranscriptionWhisper = {
      ...mockWhisper,
      isTranscribed: true,
      transcription: undefined,
    };
    const result = validateWhisperForPublishing(noTranscriptionWhisper);
    expect(result.isValid).toBe(false);
    expect(result.warnings).toContain(
      "Whisper marked as transcribed but no transcription found"
    );
  });

  it("should flag for review when needed", () => {
    const reviewWhisper = { ...mockWhisper, confidence: 0.5 };
    const result = validateWhisperForPublishing(reviewWhisper);
    expect(result.isValid).toBe(false);
    expect(result.warnings).toContain("Whisper flagged for manual review");
  });
});

// ===== VALIDATION SUMMARY TESTS =====

describe("getValidationSummary", () => {
  it("should return valid status for successful validation", () => {
    const validationResult: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };
    const result = getValidationSummary(validationResult);
    expect(result.status).toBe("valid");
    expect(result.message).toBe("Validation passed");
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(0);
  });

  it("should return warning status for validation with warnings", () => {
    const validationResult: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: ["Warning 1", "Warning 2"],
    };
    const result = getValidationSummary(validationResult);
    expect(result.status).toBe("warning");
    expect(result.message).toBe("Validation passed with 2 warning(s)");
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(2);
  });

  it("should return invalid status for failed validation", () => {
    const validationResult: ValidationResult = {
      isValid: false,
      errors: ["Error 1", "Error 2", "Error 3"],
      warnings: ["Warning 1"],
    };
    const result = getValidationSummary(validationResult);
    expect(result.status).toBe("invalid");
    expect(result.message).toBe("Validation failed with 3 error(s)");
    expect(result.errorCount).toBe(3);
    expect(result.warningCount).toBe(1);
  });
});

// ===== VALIDATION OPTIONS TESTS =====

describe("createDefaultValidationOptions", () => {
  it("should create default options", () => {
    const result = createDefaultValidationOptions();
    expect(result.checkAudioQuality).toBe(true);
    expect(result.checkContentSafety).toBe(true);
    expect(result.checkUserPermissions).toBe(true);
    expect(result.checkAgeRestrictions).toBe(true);
  });
});

describe("createStrictValidationOptions", () => {
  it("should create strict options", () => {
    const result = createStrictValidationOptions();
    expect(result.checkAudioQuality).toBe(true);
    expect(result.checkContentSafety).toBe(true);
    expect(result.checkUserPermissions).toBe(true);
    expect(result.checkAgeRestrictions).toBe(true);
    expect(result.isMinor).toBe(false);
  });
});

describe("createMinorSafeValidationOptions", () => {
  it("should create minor-safe options", () => {
    const result = createMinorSafeValidationOptions();
    expect(result.checkAudioQuality).toBe(true);
    expect(result.checkContentSafety).toBe(true);
    expect(result.checkUserPermissions).toBe(true);
    expect(result.checkAgeRestrictions).toBe(true);
    expect(result.isMinor).toBe(true);
  });
});

// ===== EDGE CASES AND BOUNDARY TESTS =====

describe("Edge Cases and Boundary Tests", () => {
  it("should handle boundary values in duration validation", () => {
    const boundaryWhisper = { ...mockWhisper, duration: 300 };
    const result = validateWhisperData(boundaryWhisper);
    expect(result.isValid).toBe(true);

    const overLimitWhisper = { ...mockWhisper, duration: 301 };
    const overResult = validateWhisperData(overLimitWhisper);
    expect(overResult.isValid).toBe(false);
  });

  it("should handle boundary values in percentage validation", () => {
    const boundaryWhisper = { ...mockWhisper, whisperPercentage: 100 };
    const result = validateWhisperData(boundaryWhisper);
    expect(result.isValid).toBe(true);

    const overLimitWhisper = { ...mockWhisper, whisperPercentage: 101 };
    const overResult = validateWhisperData(overLimitWhisper);
    expect(overResult.isValid).toBe(false);
  });

  it("should handle boundary values in level validation", () => {
    const boundaryWhisper = { ...mockWhisper, averageLevel: 1 };
    const result = validateWhisperData(boundaryWhisper);
    expect(result.isValid).toBe(true);

    const overLimitWhisper = { ...mockWhisper, averageLevel: 1.1 };
    const overResult = validateWhisperData(overLimitWhisper);
    expect(overResult.isValid).toBe(false);
  });

  it("should handle empty strings in validation", () => {
    const emptyStringWhisper = { ...mockWhisper, userDisplayName: "" };
    const result = validateWhisperData(emptyStringWhisper);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("User display name is required");
  });

  it("should handle null/undefined values", () => {
    const nullWhisper = { ...mockWhisper, userProfileColor: null as any };
    const result = validateWhisperData(nullWhisper);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("User profile color is required");
  });

  it("should handle zero values correctly", () => {
    const zeroWhisper = { ...mockWhisper, likes: 0, replies: 0 };
    const result = validateWhisperData(zeroWhisper);
    expect(result.isValid).toBe(true);
  });

  it("should handle maximum quality score", () => {
    const perfectWhisper = {
      ...mockWhisper,
      whisperPercentage: 100,
      confidence: 1.0,
      likes: 100,
      moderationResult: { ...mockModerationResult, violations: [] },
    };
    const result = calculateQualityScore(perfectWhisper);
    expect(result).toBe(100);
  });

  it("should handle minimum quality score", () => {
    const terribleWhisper = {
      ...mockWhisper,
      whisperPercentage: 0,
      confidence: 0.0,
      likes: 0,
      moderationResult: {
        ...mockModerationResult,
        violations: [
          {
            type: ViolationType.HATE_SPEECH,
            severity: "critical" as const,
            confidence: 0.9,
            description: "Hate speech",
            suggestedAction: "ban" as const,
          },
          {
            type: ViolationType.VIOLENCE,
            severity: "critical" as const,
            confidence: 0.9,
            description: "Violence",
            suggestedAction: "ban" as const,
          },
          {
            type: ViolationType.SEXUAL_CONTENT,
            severity: "critical" as const,
            confidence: 0.9,
            description: "Sexual content",
            suggestedAction: "ban" as const,
          },
        ],
      },
    };
    const result = calculateQualityScore(terribleWhisper);
    expect(result).toBe(0);
  });
});
