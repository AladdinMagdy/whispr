/**
 * Local Moderation Service
 * Provides free keyword filtering and basic content analysis
 * This runs before paid APIs to reduce costs and improve response time
 */

import { LocalModerationResult, ViolationType, Violation } from "../types";
import { CONTENT_MODERATION } from "../constants";

export class LocalModerationService {
  private static readonly KEYWORDS = CONTENT_MODERATION.LOCAL_KEYWORDS;
  private static readonly THRESHOLDS = CONTENT_MODERATION.THRESHOLDS.LOCAL;

  /**
   * Check text for violations using local keyword filtering
   */
  static async checkKeywords(text: string): Promise<LocalModerationResult> {
    const lowerText = text.toLowerCase();

    const violations: Violation[] = [];
    const matchedKeywords: string[] = [];

    // Check each category of keywords
    const categories = [
      { type: ViolationType.HARASSMENT, keywords: this.KEYWORDS.HARASSMENT },
      { type: ViolationType.HATE_SPEECH, keywords: this.KEYWORDS.HATE_SPEECH },
      { type: ViolationType.VIOLENCE, keywords: this.KEYWORDS.VIOLENCE },
      {
        type: ViolationType.SEXUAL_CONTENT,
        keywords: this.KEYWORDS.SEXUAL_CONTENT,
      },
      { type: ViolationType.DRUGS, keywords: this.KEYWORDS.DRUGS },
      { type: ViolationType.SPAM, keywords: this.KEYWORDS.SPAM },
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
            severity: this.determineSeverity(category.type, keyword),
            confidence: 0.8, // High confidence for exact keyword matches
            description: `Contains ${category.type} keyword: "${keyword}"`,
            startIndex,
            endIndex,
            suggestedAction: this.getSuggestedAction(category.type),
          });
        }
      }
    }

    // Check for personal information patterns
    const personalInfoDetected = this.detectPersonalInfo(text);
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
    const toxicityScore = this.calculateToxicityScore(violations, text.length);

    // Calculate spam score
    const spamScore = this.calculateSpamScore(text);

    const isFlagged =
      violations.length > 0 ||
      toxicityScore > this.THRESHOLDS.TOXICITY ||
      spamScore > this.THRESHOLDS.SPAM;

    return {
      flagged: isFlagged,
      matchedKeywords,
      toxicityScore,
      spamScore,
      personalInfoDetected,
    };
  }

  /**
   * Determine severity based on violation type and keyword
   */
  private static determineSeverity(
    type: ViolationType,
    keyword: string
  ): "low" | "medium" | "high" | "critical" {
    const criticalKeywords = [
      "kill yourself",
      "kys",
      "kill you",
      "bomb",
      "terrorist",
      "nazi",
      "hitler",
      "white power",
      "black power",
    ];

    const highKeywords = [
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
    ];

    if (criticalKeywords.some((k) => keyword.toLowerCase().includes(k))) {
      return "critical";
    }

    if (highKeywords.some((k) => keyword.toLowerCase().includes(k))) {
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
  private static getSuggestedAction(
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
   * Detect personal information patterns
   */
  private static detectPersonalInfo(text: string): boolean {
    const patterns = [
      // Phone numbers
      /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/,
      // Email addresses
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
      // Social Security Numbers
      /\b\d{3}-\d{2}-\d{4}\b/,
      // Credit card numbers (basic pattern)
      /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/,
      // Address patterns
      /\b\d+\s+[A-Za-z\s]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln)\b/i,
    ];

    return patterns.some((pattern) => pattern.test(text));
  }

  /**
   * Calculate toxicity score based on violations and text length
   */
  private static calculateToxicityScore(
    violations: Violation[],
    textLength: number
  ): number {
    if (violations.length === 0) return 0;

    const severityWeights = {
      low: 0.2,
      medium: 0.5,
      high: 0.8,
      critical: 1.0,
    };

    const totalWeight = violations.reduce((sum, violation) => {
      return sum + severityWeights[violation.severity] * violation.confidence;
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
  private static calculateSpamScore(text: string): number {
    let spamScore = 0;

    // Check for excessive capitalization
    const upperCaseRatio =
      (text.match(/[A-Z]/g) || []).length / Math.max(1, text.length);
    if (upperCaseRatio > 0.7) spamScore += 0.3;

    // Check for excessive punctuation
    const punctuationRatio =
      (text.match(/[!?]{2,}/g) || []).length / Math.max(1, text.length);
    if (punctuationRatio > 0.1) spamScore += 0.2;

    // Check for repeated characters
    const repeatedChars = (text.match(/(.)\1{2,}/g) || []).length;
    if (repeatedChars > 2) spamScore += 0.2;

    // Check for spam keywords
    const spamKeywords = CONTENT_MODERATION.LOCAL_KEYWORDS.SPAM;
    const spamKeywordCount = spamKeywords.filter((keyword) =>
      text.toLowerCase().includes(keyword.toLowerCase())
    ).length;

    spamScore += Math.min(0.5, spamKeywordCount * 0.1);

    return Math.min(1.0, spamScore);
  }

  /**
   * Check if text should be rejected immediately (before API calls)
   */
  static async shouldRejectImmediately(text: string): Promise<boolean> {
    const result = await this.checkKeywords(text);

    // Reject if critical violations or high toxicity
    const hasCriticalViolations = result.matchedKeywords.some(
      (keyword: string) =>
        ["kill yourself", "kys", "kill you", "bomb", "terrorist"].some(
          (critical) => keyword.toLowerCase().includes(critical)
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
  static getModerationSummary(result: LocalModerationResult): string {
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
      violations.push(
        `Spam detected (${(result.spamScore * 100).toFixed(1)}%)`
      );
    }
    if (result.personalInfoDetected) {
      violations.push("Personal information detected");
    }

    return `⚠️ Local moderation: ${violations.join(", ")}`;
  }
}
