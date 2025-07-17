/**
 * Google Perspective API Service
 * Integrates with Google's Perspective API for toxicity analysis
 */

import { PerspectiveAPIResult, ViolationType, Violation } from "../types";
import { CONTENT_MODERATION } from "../constants";
import { getErrorMessage } from "../utils/errorHelpers";

export class PerspectiveAPIService {
  private static readonly API_KEY =
    process.env.EXPO_PUBLIC_GOOGLE_PERSPECTIVE_API_KEY;
  private static readonly THRESHOLDS =
    CONTENT_MODERATION.THRESHOLDS.PERSPECTIVE;
  private static readonly API_LIMITS =
    CONTENT_MODERATION.API_LIMITS.PERSPECTIVE;

  /**
   * Analyze text using Google Perspective API
   */
  static async analyzeText(text: string): Promise<PerspectiveAPIResult> {
    if (!this.API_KEY) {
      throw new Error("Google Perspective API key not configured");
    }

    if (!this.isWithinLimits(text)) {
      throw new Error("Text exceeds API length limits");
    }

    try {
      const response = await fetch(
        `https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${this.API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            comment: {
              text: text,
            },
            requestedAttributes: {
              TOXICITY: {},
              SEVERE_TOXICITY: {},
              IDENTITY_ATTACK: {},
              INSULT: {},
              PROFANITY: {},
              THREAT: {},
              SEXUALLY_EXPLICIT: {},
              FLIRTATION: {},
              ATTACK_ON_AUTHOR: {},
              ATTACK_ON_COMMENTER: {},
              INCOHERENT: {},
              INFLAMMATORY: {},
              LIKELY_TO_REJECT: {},
              OBSCENE: {},
              SPAM: {},
              UNSUBSTANTIAL: {},
            },
            languages: ["en"],
            doNotStore: true, // Protect user privacy - don't store data with Google
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Perspective API error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      const attributeScores = data.attributeScores;

      return {
        toxicity: this.getScore(attributeScores.TOXICITY),
        severeToxicity: this.getScore(attributeScores.SEVERE_TOXICITY),
        identityAttack: this.getScore(attributeScores.IDENTITY_ATTACK),
        insult: this.getScore(attributeScores.INSULT),
        profanity: this.getScore(attributeScores.PROFANITY),
        threat: this.getScore(attributeScores.THREAT),
        sexuallyExplicit: this.getScore(attributeScores.SEXUALLY_EXPLICIT),
        flirtation: this.getScore(attributeScores.FLIRTATION),
        attackOnAuthor: this.getScore(attributeScores.ATTACK_ON_AUTHOR),
        attackOnCommenter: this.getScore(attributeScores.ATTACK_ON_COMMENTER),
        incoherent: this.getScore(attributeScores.INCOHERENT),
        inflammatory: this.getScore(attributeScores.INFLAMMATORY),
        likelyToReject: this.getScore(attributeScores.LIKELY_TO_REJECT),
        obscene: this.getScore(attributeScores.OBSCENE),
        spam: this.getScore(attributeScores.SPAM),
        unsubstantial: this.getScore(attributeScores.UNSUBSTANTIAL),
      };
    } catch (error) {
      console.error("Perspective API error:", error);
      throw new Error(getErrorMessage(error));
    }
  }

  /**
   * Extract score from Perspective API response
   */
  private static getScore(attribute: unknown): number {
    if (
      attribute &&
      typeof attribute === "object" &&
      "summaryScore" in attribute
    ) {
      const summaryScore = (attribute as { summaryScore?: { value?: number } })
        .summaryScore;
      return summaryScore?.value || 0;
    }
    return 0;
  }

  /**
   * Convert Perspective result to violations
   */
  static convertToViolations(result: PerspectiveAPIResult): Violation[] {
    const violations: Violation[] = [];

    // Map Perspective attributes to our violation types
    const attributeMapping = [
      {
        attribute: "toxicity",
        type: ViolationType.HARASSMENT,
        threshold: this.THRESHOLDS.TOXICITY,
      },
      {
        attribute: "severeToxicity",
        type: ViolationType.HARASSMENT,
        threshold: this.THRESHOLDS.SEVERE_TOXICITY,
      },
      {
        attribute: "identityAttack",
        type: ViolationType.HATE_SPEECH,
        threshold: this.THRESHOLDS.IDENTITY_ATTACK,
      },
      {
        attribute: "insult",
        type: ViolationType.HARASSMENT,
        threshold: this.THRESHOLDS.INSULT,
      },
      {
        attribute: "profanity",
        type: ViolationType.HARASSMENT,
        threshold: this.THRESHOLDS.PROFANITY,
      },
      {
        attribute: "threat",
        type: ViolationType.VIOLENCE,
        threshold: this.THRESHOLDS.THREAT,
      },
      {
        attribute: "sexuallyExplicit",
        type: ViolationType.SEXUAL_CONTENT,
        threshold: this.THRESHOLDS.SEXUALLY_EXPLICIT,
      },
      {
        attribute: "spam",
        type: ViolationType.SPAM,
        threshold: this.THRESHOLDS.SPAM,
      },
    ];

    attributeMapping.forEach(({ attribute, type, threshold }) => {
      const score = result[attribute as keyof PerspectiveAPIResult] as number;
      if (score > threshold) {
        violations.push({
          type,
          severity: this.determineSeverity(attribute, score),
          confidence: score,
          description: `Perspective detected ${attribute} with ${(
            score * 100
          ).toFixed(1)}% confidence`,
          suggestedAction: this.getSuggestedAction(type, score),
        });
      }
    });

    return violations;
  }

  /**
   * Determine severity based on attribute and score
   */
  private static determineSeverity(
    attribute: string,
    score: number
  ): "low" | "medium" | "high" | "critical" {
    // Critical attributes
    if (["severeToxicity", "threat", "identityAttack"].includes(attribute)) {
      return score > 0.9 ? "critical" : score > 0.7 ? "high" : "medium";
    }

    // High severity attributes
    if (["toxicity", "insult", "profanity"].includes(attribute)) {
      return score > 0.8 ? "high" : score > 0.6 ? "medium" : "low";
    }

    // Medium severity attributes
    if (["sexuallyExplicit", "spam"].includes(attribute)) {
      return score > 0.7 ? "medium" : "low";
    }

    // Default based on score
    if (score > 0.9) return "critical";
    if (score > 0.8) return "high";
    if (score > 0.6) return "medium";
    return "low";
  }

  /**
   * Get suggested action based on violation type and confidence
   */
  private static getSuggestedAction(
    type: ViolationType,
    confidence: number
  ): "warn" | "flag" | "reject" | "ban" {
    if (confidence > 0.9) {
      switch (type) {
        case ViolationType.HARASSMENT:
        case ViolationType.HATE_SPEECH:
        case ViolationType.VIOLENCE:
          return "ban";
        case ViolationType.SEXUAL_CONTENT:
          return "reject";
        case ViolationType.SPAM:
          return "flag";
        default:
          return "reject";
      }
    }

    if (confidence > 0.7) {
      switch (type) {
        case ViolationType.HARASSMENT:
        case ViolationType.HATE_SPEECH:
        case ViolationType.VIOLENCE:
          return "reject";
        case ViolationType.SEXUAL_CONTENT:
        case ViolationType.SPAM:
          return "flag";
        default:
          return "flag";
      }
    }

    return "warn";
  }

  /**
   * Check if content should be rejected based on Perspective results
   */
  static shouldReject(result: PerspectiveAPIResult): boolean {
    // Check for critical violations
    if (result.severeToxicity > 0.8) return true;
    if (result.threat > 0.8) return true;
    if (result.identityAttack > 0.8) return true;

    // Check for high toxicity
    if (result.toxicity > 0.9) return true;

    return false;
  }

  /**
   * Get moderation summary for logging
   */
  static getModerationSummary(result: PerspectiveAPIResult): string {
    const violations: string[] = [];

    // Check each attribute against thresholds
    Object.entries(result).forEach(([attribute, score]) => {
      const threshold = this.getThresholdForAttribute(attribute);
      if (score > threshold) {
        violations.push(`${attribute} (${(score * 100).toFixed(1)}%)`);
      }
    });

    if (violations.length === 0) {
      return "✅ Perspective API: No violations detected";
    }

    return `⚠️ Perspective API: ${violations.join(", ")}`;
  }

  /**
   * Get threshold for specific attribute
   */
  private static getThresholdForAttribute(attribute: string): number {
    switch (attribute) {
      case "toxicity":
        return this.THRESHOLDS.TOXICITY;
      case "severeToxicity":
        return this.THRESHOLDS.SEVERE_TOXICITY;
      case "identityAttack":
        return this.THRESHOLDS.IDENTITY_ATTACK;
      case "insult":
        return this.THRESHOLDS.INSULT;
      case "profanity":
        return this.THRESHOLDS.PROFANITY;
      case "threat":
        return this.THRESHOLDS.THREAT;
      case "sexuallyExplicit":
        return this.THRESHOLDS.SEXUALLY_EXPLICIT;
      case "spam":
        return this.THRESHOLDS.SPAM;
      default:
        return 0.5; // Default threshold
    }
  }

  /**
   * Estimate cost for analysis
   */
  static estimateCost(): number {
    // Perspective API charges per request, not per character
    return this.API_LIMITS.costPerRequest;
  }

  /**
   * Check if text is within API limits
   */
  static isWithinLimits(text: string): boolean {
    return text.length <= this.API_LIMITS.maxTextLength;
  }

  /**
   * Get overall toxicity score
   */
  static getOverallToxicity(result: PerspectiveAPIResult): number {
    // Weighted average of toxicity-related scores
    const weights = {
      toxicity: 0.3,
      severeToxicity: 0.4,
      identityAttack: 0.2,
      insult: 0.1,
    };

    return (
      result.toxicity * weights.toxicity +
      result.severeToxicity * weights.severeToxicity +
      result.identityAttack * weights.identityAttack +
      result.insult * weights.insult
    );
  }
}
