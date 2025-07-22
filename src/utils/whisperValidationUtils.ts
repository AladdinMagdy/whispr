import {
  Whisper,
  AudioRecording,
  ContentRank,
  ViolationType,
  ModerationResult,
  Violation,
} from "@/types";

// ===== INTERFACES =====

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface WhisperValidationOptions {
  checkAudioQuality?: boolean;
  checkContentSafety?: boolean;
  checkUserPermissions?: boolean;
  checkAgeRestrictions?: boolean;
  userAge?: number;
  isMinor?: boolean;
}

export interface AudioValidationOptions {
  minDuration: number;
  maxDuration: number;
  minWhisperPercentage: number;
  maxFileSize: number; // in bytes
  allowedFormats: string[];
}

export interface ContentSafetyOptions {
  maxViolationCount: number;
  blockedKeywords: string[];
  maxLength: number;
  minLength: number;
}

export interface UserPermissionOptions {
  maxWhispersPerDay: number;
  maxWhispersPerHour: number;
  requireVerification: boolean;
  minReputationScore: number;
}

// ===== WHISPER VALIDATION FUNCTIONS =====

/**
 * Validate whisper data
 */
export function validateWhisperData(
  data: Partial<Whisper>,
  options: WhisperValidationOptions = {}
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic required fields validation
  if (!data.id) {
    errors.push("Whisper ID is required");
  }

  if (!data.userId) {
    errors.push("User ID is required");
  }

  if (!data.userDisplayName) {
    errors.push("User display name is required");
  }

  if (!data.userProfileColor) {
    errors.push("User profile color is required");
  }

  if (!data.audioUrl) {
    errors.push("Audio URL is required");
  }

  // Duration validation
  if (data.duration !== undefined) {
    if (data.duration <= 0) {
      errors.push("Duration must be greater than 0");
    } else if (data.duration > 300) {
      // 5 minutes max
      errors.push("Duration cannot exceed 5 minutes");
    }
  }

  // Whisper percentage validation
  if (data.whisperPercentage !== undefined) {
    if (data.whisperPercentage < 0 || data.whisperPercentage > 100) {
      errors.push("Whisper percentage must be between 0 and 100");
    }
  }

  // Average level validation
  if (data.averageLevel !== undefined) {
    if (data.averageLevel < 0 || data.averageLevel > 1) {
      errors.push("Average level must be between 0 and 1");
    }
  }

  // Confidence validation
  if (data.confidence !== undefined) {
    if (data.confidence < 0 || data.confidence > 1) {
      errors.push("Confidence must be between 0 and 1");
    }
  }

  // Likes and replies validation
  if (data.likes !== undefined && data.likes < 0) {
    errors.push("Likes count cannot be negative");
  }

  if (data.replies !== undefined && data.replies < 0) {
    errors.push("Replies count cannot be negative");
  }

  // Content safety validation
  if (options.checkContentSafety && data.moderationResult) {
    const contentResult = validateContentSafety(data.moderationResult, options);
    errors.push(...contentResult.errors);
    warnings.push(...contentResult.warnings);
  }

  // User permissions validation
  if (options.checkUserPermissions) {
    const permissionResult = validateUserPermissions(data.userId || "");
    errors.push(...permissionResult.errors);
    warnings.push(...permissionResult.warnings);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : [],
  };
}

/**
 * Validate audio recording
 */
export function validateAudioRecording(
  recording: AudioRecording,
  options: AudioValidationOptions = {
    minDuration: 1,
    maxDuration: 300,
    minWhisperPercentage: 50,
    maxFileSize: 50 * 1024 * 1024, // 50MB
    allowedFormats: [".mp3", ".wav", ".m4a"],
  }
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Duration validation
  if (recording.duration < options.minDuration) {
    errors.push(
      `Audio duration must be at least ${options.minDuration} second(s)`
    );
  }

  if (recording.duration > options.maxDuration) {
    errors.push(`Audio duration cannot exceed ${options.maxDuration} seconds`);
  }

  // Volume validation
  if (recording.volume < 0 || recording.volume > 1) {
    errors.push("Volume must be between 0 and 1");
  }

  // Whisper validation
  if (!recording.isWhisper) {
    warnings.push("Audio does not meet whisper criteria");
  }

  // URI validation
  if (!recording.uri) {
    errors.push("Audio URI is required");
  } else {
    // Check file format
    const fileExtension = recording.uri.split(".").pop()?.toLowerCase();
    if (
      fileExtension &&
      !options.allowedFormats.includes(`.${fileExtension}`)
    ) {
      errors.push(`File format .${fileExtension} is not supported`);
    }
  }

  // Timestamp validation
  if (!recording.timestamp) {
    errors.push("Recording timestamp is required");
  } else if (recording.timestamp > new Date()) {
    errors.push("Recording timestamp cannot be in the future");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : [],
  };
}

/**
 * Validate user permissions
 */
export function validateUserPermissions(userId: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // User ID validation
  if (!userId) {
    errors.push("User ID is required");
  }

  if (userId.length < 3) {
    errors.push("User ID must be at least 3 characters long");
  }

  // Note: In a real implementation, you would check against actual user data
  // For now, we'll provide a framework for these validations

  // Daily limit check (would need user whisper count)
  // if (userWhisperCountToday >= options.maxWhispersPerDay) {
  //   errors.push(`Daily whisper limit of ${options.maxWhispersPerDay} exceeded`);
  // }

  // Hourly limit check (would need user whisper count)
  // if (userWhisperCountThisHour >= options.maxWhispersPerHour) {
  //   errors.push(`Hourly whisper limit of ${options.maxWhispersPerHour} exceeded`);
  // }

  // Verification requirement (would need user verification status)
  // if (options.requireVerification && !userIsVerified) {
  //   errors.push("User verification is required");
  // }

  // Reputation score check (would need user reputation)
  // if (userReputationScore < options.minReputationScore) {
  //   errors.push(`Minimum reputation score of ${options.minReputationScore} required`);
  // }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : [],
  };
}

/**
 * Validate content safety
 */
export function validateContentSafety(
  moderationResult: ModerationResult | null | undefined,
  options: WhisperValidationOptions = {}
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!moderationResult) {
    errors.push("Moderation result is required");
    return { isValid: false, errors, warnings: [] };
  }

  // Content rank validation
  if (moderationResult.contentRank) {
    if (options.isMinor && !moderationResult.isMinorSafe) {
      errors.push("Content is not safe for minors");
    }

    if (moderationResult.contentRank === ContentRank.NC17) {
      errors.push("Explicit content is not allowed");
    }
  }

  // Violations validation
  if (
    moderationResult.violations &&
    Array.isArray(moderationResult.violations)
  ) {
    const criticalViolations = moderationResult.violations.filter(
      (v: Violation) => v.severity === "critical"
    );
    const highViolations = moderationResult.violations.filter(
      (v: Violation) => v.severity === "high"
    );

    if (criticalViolations.length > 0) {
      errors.push("Critical content violations detected");
    }

    if (highViolations.length > 2) {
      errors.push("Too many high-severity violations");
    }

    // Check for specific violation types
    const sexualContentViolations = moderationResult.violations.filter(
      (v: Violation) => v.type === ViolationType.SEXUAL_CONTENT
    );
    if (sexualContentViolations.length > 0) {
      errors.push("Sexual content violations detected");
    }

    const hateSpeechViolations = moderationResult.violations.filter(
      (v: Violation) => v.type === ViolationType.HATE_SPEECH
    );
    if (hateSpeechViolations.length > 0) {
      errors.push("Hate speech violations detected");
    }

    const violenceViolations = moderationResult.violations.filter(
      (v: Violation) => v.type === ViolationType.VIOLENCE
    );
    if (violenceViolations.length > 0) {
      errors.push("Violence violations detected");
    }
  }

  // Confidence validation
  if (moderationResult.confidence !== undefined) {
    if (moderationResult.confidence < 0.5) {
      warnings.push("Low moderation confidence - manual review recommended");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : [],
  };
}

/**
 * Validate content safety with age restrictions
 */
export function validateContentSafetyWithAge(
  moderationResult: ModerationResult | null | undefined,
  userAge: number,
  options: ContentSafetyOptions = {
    maxViolationCount: 3,
    blockedKeywords: [],
    maxLength: 1000,
    minLength: 1,
  }
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const baseResult = validateContentSafety(moderationResult, {
    isMinor: userAge < 18,
  });
  errors.push(...baseResult.errors);
  warnings.push(...baseResult.warnings);

  // Age-specific validations
  if (userAge < 13) {
    errors.push("Users must be at least 13 years old");
  }

  if (userAge < 18) {
    // Additional restrictions for minors
    if (
      moderationResult &&
      (moderationResult.contentRank === ContentRank.R ||
        moderationResult.contentRank === ContentRank.NC17)
    ) {
      errors.push("Adult content is not allowed for users under 18");
    }

    if (
      moderationResult?.violations &&
      moderationResult.violations.length > 1
    ) {
      errors.push("Multiple violations not allowed for users under 18");
    }
  }

  // Violation count validation
  if (
    moderationResult?.violations &&
    moderationResult.violations.length > options.maxViolationCount
  ) {
    errors.push(`Too many violations (max: ${options.maxViolationCount})`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : [],
  };
}

// ===== UTILITY FUNCTIONS =====

/**
 * Check if whisper meets quality standards
 */
export function meetsQualityStandards(whisper: Whisper): boolean {
  // Check whisper percentage
  if (whisper.whisperPercentage < 50) {
    return false;
  }

  // Check confidence
  if (whisper.confidence < 0.7) {
    return false;
  }

  // Check duration
  if (whisper.duration < 1 || whisper.duration > 300) {
    return false;
  }

  // Check moderation result
  if (whisper.moderationResult) {
    if (whisper.moderationResult.status !== "approved") {
      return false;
    }

    if (
      whisper.moderationResult.violations &&
      whisper.moderationResult.violations.length > 0
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Get whisper quality score
 */
export function calculateQualityScore(whisper: Whisper): number {
  let score = 100;

  // Reduce score for low whisper percentage
  if (whisper.whisperPercentage < 80) {
    score -= (80 - whisper.whisperPercentage) * 2;
  }

  // Reduce score for low confidence
  if (whisper.confidence < 0.9) {
    score -= (0.9 - whisper.confidence) * 50;
  }

  // Reduce score for violations
  if (whisper.moderationResult?.violations) {
    score -= whisper.moderationResult.violations.length * 10;
  }

  // Reduce score for low engagement
  if (whisper.likes < 1) {
    score -= 5;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Check if whisper should be flagged for review
 */
export function shouldFlagForReview(whisper: Whisper): boolean {
  // Flag if confidence is low
  if (whisper.confidence < 0.6) {
    return true;
  }

  // Flag if whisper percentage is very low
  if (whisper.whisperPercentage < 30) {
    return true;
  }

  // Flag if there are violations
  if (
    whisper.moderationResult?.violations &&
    whisper.moderationResult.violations.length > 0
  ) {
    return true;
  }

  // Flag if content rank is questionable
  if (whisper.moderationResult?.contentRank === ContentRank.PG13) {
    return true;
  }

  return false;
}

/**
 * Validate whisper metadata
 */
export function validateWhisperMetadata(whisper: Whisper): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for missing transcription
  if (whisper.isTranscribed && !whisper.transcription) {
    warnings.push("Whisper marked as transcribed but no transcription found");
  }

  // Check for excessive length
  if (whisper.transcription && whisper.transcription.length > 1000) {
    warnings.push("Transcription is very long");
  }

  // Check for empty transcription
  if (whisper.transcription && whisper.transcription.trim().length === 0) {
    warnings.push("Transcription is empty");
  }

  // Check for suspicious patterns
  if (whisper.transcription) {
    const repeatedChars = /(.)\1{4,}/; // 5 or more repeated characters
    if (repeatedChars.test(whisper.transcription)) {
      warnings.push("Transcription contains suspicious repeated characters");
    }

    const allCaps = /^[A-Z\s]+$/;
    if (
      allCaps.test(whisper.transcription) &&
      whisper.transcription.length > 10
    ) {
      warnings.push("Transcription is all caps");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : [],
  };
}

/**
 * Validate whisper for publishing
 */
export function validateWhisperForPublishing(
  whisper: Whisper,
  options: WhisperValidationOptions = {}
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic whisper validation
  const whisperValidation = validateWhisperData(whisper, options);
  errors.push(...whisperValidation.errors);
  warnings.push(...whisperValidation.warnings);

  // Quality standards check
  if (!meetsQualityStandards(whisper)) {
    errors.push("Whisper does not meet quality standards");
  }

  // Metadata validation
  const metadataValidation = validateWhisperMetadata(whisper);
  errors.push(...metadataValidation.errors);
  warnings.push(...metadataValidation.warnings);

  // Additional publishing-specific validation
  if (whisper.isTranscribed && !whisper.transcription) {
    errors.push("Whisper marked as transcribed but no transcription found");
  }

  // Review flagging
  if (shouldFlagForReview(whisper)) {
    warnings.push("Whisper flagged for manual review");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : [],
  };
}

/**
 * Get validation summary
 */
export function getValidationSummary(validationResult: ValidationResult): {
  status: "valid" | "invalid" | "warning";
  message: string;
  errorCount: number;
  warningCount: number;
} {
  const errorCount = validationResult.errors.length;
  const warningCount = validationResult.warnings.length;

  if (errorCount > 0) {
    return {
      status: "invalid",
      message: `Validation failed with ${errorCount} error(s)`,
      errorCount,
      warningCount,
    };
  }

  if (warningCount > 0) {
    return {
      status: "warning",
      message: `Validation passed with ${warningCount} warning(s)`,
      errorCount,
      warningCount,
    };
  }

  return {
    status: "valid",
    message: "Validation passed",
    errorCount,
    warningCount,
  };
}

/**
 * Create default validation options
 */
export function createDefaultValidationOptions(): WhisperValidationOptions {
  return {
    checkAudioQuality: true,
    checkContentSafety: true,
    checkUserPermissions: true,
    checkAgeRestrictions: true,
  };
}

/**
 * Create strict validation options
 */
export function createStrictValidationOptions(): WhisperValidationOptions {
  return {
    checkAudioQuality: true,
    checkContentSafety: true,
    checkUserPermissions: true,
    checkAgeRestrictions: true,
    isMinor: false,
  };
}

/**
 * Create minor-safe validation options
 */
export function createMinorSafeValidationOptions(): WhisperValidationOptions {
  return {
    checkAudioQuality: true,
    checkContentSafety: true,
    checkUserPermissions: true,
    checkAgeRestrictions: true,
    isMinor: true,
  };
}
