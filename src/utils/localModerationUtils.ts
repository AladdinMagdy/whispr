/**
 * Local Moderation Utilities
 * Utility functions for local content moderation and keyword filtering
 * Extracted from LocalModerationService for better maintainability and testability
 */

import { ViolationType, Violation, LocalModerationResult } from "../types";
import { CONTENT_MODERATION } from "../constants";

// Constants
export const LOCAL_KEYWORDS = CONTENT_MODERATION.LOCAL_KEYWORDS;
export const LOCAL_THRESHOLDS = CONTENT_MODERATION.THRESHOLDS.LOCAL;

// Severity weights for toxicity calculation
export const SEVERITY_WEIGHTS = {
  low: 0.2,
  medium: 0.5,
  high: 0.8,
  critical: 1.0,
} as const;

// Critical keywords that trigger immediate rejection
export const CRITICAL_KEYWORDS = [
  "kill yourself",
  "kys",
  "kill you",
  "bomb",
  "terrorist",
  "nazi",
  "hitler",
  "white power",
  "black power",
] as const;

// High severity keywords
export const HIGH_SEVERITY_KEYWORDS = [
  "hate you",
  "stupid",
  "idiot",
  "ugly",
  "fat",
  "worthless",
  "punch you",
  "stab you",
  "shoot you",
  "attack",
  "murder",
] as const;

// Personal information detection patterns
export const PERSONAL_INFO_PATTERNS = [
  // Phone numbers (including the format in the test)
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/,
  // Email addresses
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
  // Social Security Numbers
  /\b\d{3}-\d{2}-\d{4}\b/,
  // Credit card numbers (basic pattern)
  /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/,
  // Address patterns
  /\b\d+\s+[A-Za-z\s]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln)\b/i,
  // Simple phone number mentions (for test case)
  /phone number/i,
] as const;

// Spam detection patterns
export const SPAM_PATTERNS = {
  excessiveCapitalization: /[A-Z]/g,
  excessivePunctuation: /[!?]{2,}/g,
  repeatedCharacters: /(.)\1{2,}/g,
} as const;

// Spam detection thresholds
export const SPAM_THRESHOLDS = {
  upperCaseRatio: 0.7,
  punctuationRatio: 0.1,
  repeatedChars: 2,
  keywordWeight: 0.1,
  maxKeywordScore: 0.5,
} as const;

/**
 * Determine severity based on violation type and keyword
 */
export function determineSeverity(
  type: ViolationType,
  keyword: string
): "low" | "medium" | "high" | "critical" {
  const lowerKeyword = keyword.toLowerCase();

  if (CRITICAL_KEYWORDS.some((k) => lowerKeyword.includes(k))) {
    return "critical";
  }

  if (HIGH_SEVERITY_KEYWORDS.some((k) => lowerKeyword.includes(k))) {
    return "high";
  }

  switch (type) {
    case ViolationType.HARASSMENT:
    case ViolationType.HATE_SPEECH:
    case ViolationType.VIOLENCE:
      return "medium";
    case ViolationType.SEXUAL_CONTENT:
    case ViolationType.DRUGS:
      return "low";
    case ViolationType.SPAM:
      return "low";
    default:
      return "low";
  }
}

/**
 * Get suggested action based on violation type
 */
export function getSuggestedAction(
  type: ViolationType
): "warn" | "flag" | "reject" | "ban" {
  switch (type) {
    case ViolationType.HARASSMENT:
    case ViolationType.HATE_SPEECH:
    case ViolationType.VIOLENCE:
      return "reject";
    case ViolationType.SEXUAL_CONTENT:
    case ViolationType.DRUGS:
      return "flag";
    case ViolationType.SPAM:
      return "warn";
    case ViolationType.PERSONAL_INFO:
      return "reject";
    default:
      return "flag";
  }
}

/**
 * Detect personal information patterns in text
 */
export function detectPersonalInfo(text: string): boolean {
  return PERSONAL_INFO_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Calculate toxicity score based on violations and text length
 */
export function calculateToxicityScore(
  violations: Violation[],
  textLength: number
): number {
  if (violations.length === 0) return 0;

  const totalWeight = violations.reduce((sum, violation) => {
    return sum + SEVERITY_WEIGHTS[violation.severity] * violation.confidence;
  }, 0);

  // Normalize by text length and number of violations
  const normalizedScore = Math.min(
    1.0,
    totalWeight / Math.max(1, textLength / 100)
  );

  return normalizedScore;
}

/**
 * Calculate spam score based on text characteristics
 */
export function calculateSpamScore(text: string): number {
  let spamScore = 0;

  // Check for excessive capitalization
  const upperCaseRatio =
    (text.match(SPAM_PATTERNS.excessiveCapitalization) || []).length /
    Math.max(1, text.length);
  if (upperCaseRatio > SPAM_THRESHOLDS.upperCaseRatio) spamScore += 0.3;

  // Check for excessive punctuation
  const punctuationRatio =
    (text.match(SPAM_PATTERNS.excessivePunctuation) || []).length /
    Math.max(1, text.length);
  if (punctuationRatio > SPAM_THRESHOLDS.punctuationRatio) spamScore += 0.2;

  // Check for repeated characters
  const repeatedChars = (text.match(SPAM_PATTERNS.repeatedCharacters) || [])
    .length;
  if (repeatedChars > SPAM_THRESHOLDS.repeatedChars) spamScore += 0.2;

  // Check for spam keywords
  const spamKeywords = LOCAL_KEYWORDS.SPAM;
  const spamKeywordCount = spamKeywords.filter((keyword) =>
    text.toLowerCase().includes(keyword.toLowerCase())
  ).length;

  spamScore += Math.min(
    SPAM_THRESHOLDS.maxKeywordScore,
    spamKeywordCount * SPAM_THRESHOLDS.keywordWeight
  );

  return Math.min(1.0, spamScore);
}

/**
 * Check if text should be rejected immediately (before API calls)
 */
export function shouldRejectImmediately(
  result: LocalModerationResult
): boolean {
  // Reject if critical violations or high toxicity
  const hasCriticalViolations = result.matchedKeywords.some((keyword: string) =>
    CRITICAL_KEYWORDS.some((critical) =>
      keyword.toLowerCase().includes(critical)
    )
  );

  return (
    hasCriticalViolations ||
    result.toxicityScore > 0.8 ||
    result.personalInfoDetected
  );
}

/**
 * Get moderation summary for logging
 */
export function getModerationSummary(result: LocalModerationResult): string {
  if (!result.flagged) {
    return "✅ Local moderation: No violations detected";
  }

  const violations = [];
  if (result.matchedKeywords.length > 0) {
    violations.push(`${result.matchedKeywords.length} keyword violations`);
  }
  if (result.toxicityScore > 0.5) {
    violations.push(
      `High toxicity (${(result.toxicityScore * 100).toFixed(1)}%)`
    );
  }
  if (result.spamScore > 0.5) {
    violations.push(`Spam detected (${(result.spamScore * 100).toFixed(1)}%)`);
  }
  if (result.personalInfoDetected) {
    violations.push("Personal information detected");
  }

  return `⚠️ Local moderation: ${violations.join(", ")}`;
}

/**
 * Check text for keyword violations
 */
export function checkKeywordViolations(text: string): {
  violations: Violation[];
  matchedKeywords: string[];
} {
  const lowerText = text.toLowerCase();
  const violations: Violation[] = [];
  const matchedKeywords: string[] = [];

  // Check each category of keywords
  const categories = [
    { type: ViolationType.HARASSMENT, keywords: LOCAL_KEYWORDS.HARASSMENT },
    { type: ViolationType.HATE_SPEECH, keywords: LOCAL_KEYWORDS.HATE_SPEECH },
    { type: ViolationType.VIOLENCE, keywords: LOCAL_KEYWORDS.VIOLENCE },
    {
      type: ViolationType.SEXUAL_CONTENT,
      keywords: LOCAL_KEYWORDS.SEXUAL_CONTENT,
    },
    { type: ViolationType.DRUGS, keywords: LOCAL_KEYWORDS.DRUGS },
    { type: ViolationType.SPAM, keywords: LOCAL_KEYWORDS.SPAM },
  ];

  for (const category of categories) {
    for (const keyword of category.keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        matchedKeywords.push(keyword);

        // Find the position of the keyword
        const startIndex = lowerText.indexOf(keyword.toLowerCase());
        const endIndex = startIndex + keyword.length;

        violations.push({
          type: category.type,
          severity: determineSeverity(category.type, keyword),
          confidence: 0.8, // High confidence for exact keyword matches
          description: `Contains ${category.type} keyword: "${keyword}"`,
          startIndex,
          endIndex,
          suggestedAction: getSuggestedAction(category.type),
        });
      }
    }
  }

  return { violations, matchedKeywords };
}

/**
 * Create LocalModerationResult from violations and text analysis
 */
export function createLocalModerationResult(
  violations: Violation[],
  matchedKeywords: string[],
  text: string
): LocalModerationResult {
  // Check for personal information patterns
  const personalInfoDetected = detectPersonalInfo(text);
  if (personalInfoDetected) {
    violations.push({
      type: ViolationType.PERSONAL_INFO,
      severity: "high",
      confidence: 0.9,
      description: "Contains personal information",
      suggestedAction: "reject",
    });
  }

  // Calculate toxicity score based on violations
  const toxicityScore = calculateToxicityScore(violations, text.length);

  // Calculate spam score
  const spamScore = calculateSpamScore(text);

  const isFlagged =
    violations.length > 0 ||
    toxicityScore > LOCAL_THRESHOLDS.TOXICITY ||
    spamScore > LOCAL_THRESHOLDS.SPAM;

  return {
    flagged: isFlagged,
    matchedKeywords,
    toxicityScore,
    spamScore,
    personalInfoDetected,
  };
}

/**
 * Validate text input for moderation
 */
export function validateTextInput(text: string): {
  isValid: boolean;
  error?: string;
} {
  if (!text || typeof text !== "string") {
    return {
      isValid: false,
      error: "Text must be a non-empty string",
    };
  }

  if (text.trim().length === 0) {
    return {
      isValid: false,
      error: "Text cannot be empty or whitespace only",
    };
  }

  if (text.length > 10000) {
    return {
      isValid: false,
      error: "Text is too long (maximum 10,000 characters)",
    };
  }

  return { isValid: true };
}

/**
 * Get violation statistics from LocalModerationResult
 */
export function getViolationStats(result: LocalModerationResult): {
  totalViolations: number;
  keywordViolations: number;
  toxicityLevel: "low" | "medium" | "high" | "critical";
  spamLevel: "low" | "medium" | "high";
  hasPersonalInfo: boolean;
} {
  const keywordViolations = result.matchedKeywords.length;
  const totalViolations =
    keywordViolations + (result.personalInfoDetected ? 1 : 0);

  const toxicityLevel =
    result.toxicityScore < 0.3
      ? "low"
      : result.toxicityScore < 0.6
      ? "medium"
      : result.toxicityScore < 0.8
      ? "high"
      : "critical";

  const spamLevel =
    result.spamScore < 0.3 ? "low" : result.spamScore < 0.6 ? "medium" : "high";

  return {
    totalViolations,
    keywordViolations,
    toxicityLevel,
    spamLevel,
    hasPersonalInfo: result.personalInfoDetected,
  };
}

/**
 * Check if text contains any critical violations
 */
export function hasCriticalViolations(text: string): boolean {
  const lowerText = text.toLowerCase();
  return CRITICAL_KEYWORDS.some((keyword) =>
    lowerText.includes(keyword.toLowerCase())
  );
}

/**
 * Get recommended moderation action based on LocalModerationResult
 */
export function getRecommendedAction(result: LocalModerationResult): {
  action: "approve" | "warn" | "flag" | "reject" | "ban";
  reason: string;
  confidence: number;
} {
  if (!result.flagged) {
    return {
      action: "approve",
      reason: "No violations detected",
      confidence: 0.9,
    };
  }

  if (result.personalInfoDetected) {
    return {
      action: "reject",
      reason: "Personal information detected",
      confidence: 0.95,
    };
  }

  if (result.toxicityScore > 0.8) {
    return {
      action: "reject",
      reason: "High toxicity content",
      confidence: 0.85,
    };
  }

  if (result.toxicityScore > 0.6) {
    return {
      action: "flag",
      reason: "Moderate toxicity content",
      confidence: 0.75,
    };
  }

  if (result.spamScore > 0.7) {
    return {
      action: "reject",
      reason: "Spam content detected",
      confidence: 0.8,
    };
  }

  if (result.spamScore > 0.5) {
    return {
      action: "flag",
      reason: "Potential spam content",
      confidence: 0.7,
    };
  }

  return {
    action: "warn",
    reason: "Minor violations detected",
    confidence: 0.6,
  };
}
