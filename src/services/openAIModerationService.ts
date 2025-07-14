/**
 * OpenAI Moderation Service
 * Integrates with OpenAI's moderation API for comprehensive content analysis
 */

import { OpenAIModerationResult, ViolationType, Violation } from "../types";
import { CONTENT_MODERATION } from "../constants";

export class OpenAIModerationService {
  private static readonly API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  private static readonly THRESHOLDS = CONTENT_MODERATION.THRESHOLDS.OPENAI;
  private static readonly API_LIMITS = CONTENT_MODERATION.API_LIMITS.OPENAI;

  /**
   * Moderate text using OpenAI's moderation API
   */
  static async moderateText(text: string): Promise<OpenAIModerationResult> {
    if (!this.API_KEY) {
      throw new Error("OpenAI API key not configured");
    }

    try {
      const response = await fetch("https://api.openai.com/v1/moderations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.API_KEY}`,
        },
        body: JSON.stringify({
          input: text,
          model: "text-moderation-latest",
        }),
      });

      if (!response.ok) {
        throw new Error(
          `OpenAI API error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      const result = data.results[0];

      return {
        flagged: result.flagged,
        categories: result.categories,
        categoryScores: result.category_scores,
      };
    } catch (error) {
      console.error("OpenAI moderation error:", error);
      throw new Error(
        `OpenAI moderation failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Convert OpenAI result to violations
   */
  static convertToViolations(result: OpenAIModerationResult): Violation[] {
    const violations: Violation[] = [];

    // Map OpenAI categories to our violation types
    const categoryMapping = {
      harassment: ViolationType.HARASSMENT,
      harassment_threatening: ViolationType.HARASSMENT,
      hate: ViolationType.HATE_SPEECH,
      hate_threatening: ViolationType.HATE_SPEECH,
      self_harm: ViolationType.VIOLENCE,
      self_harm_instructions: ViolationType.VIOLENCE,
      self_harm_intent: ViolationType.VIOLENCE,
      sexual: ViolationType.SEXUAL_CONTENT,
      sexual_minors: ViolationType.SEXUAL_CONTENT,
      violence: ViolationType.VIOLENCE,
      violence_graphic: ViolationType.VIOLENCE,
    };

    // Check each category against thresholds
    Object.entries(result.categoryScores).forEach(([category, score]) => {
      const threshold = this.getThresholdForCategory(category);
      if (score > threshold) {
        const violationType =
          categoryMapping[category as keyof typeof categoryMapping];
        if (violationType) {
          violations.push({
            type: violationType,
            severity: this.determineSeverity(category, score),
            confidence: score,
            description: `OpenAI detected ${category} with ${(
              score * 100
            ).toFixed(1)}% confidence`,
            suggestedAction: this.getSuggestedAction(violationType, score),
          });
        }
      }
    });

    return violations;
  }

  /**
   * Get threshold for specific category
   */
  private static getThresholdForCategory(category: string): number {
    switch (category) {
      case "harassment":
      case "harassment_threatening":
        return this.THRESHOLDS.HARASSMENT;
      case "hate":
      case "hate_threatening":
        return this.THRESHOLDS.HATE_SPEECH;
      case "violence":
      case "violence_graphic":
        return this.THRESHOLDS.VIOLENCE;
      case "sexual":
      case "sexual_minors":
        return this.THRESHOLDS.SEXUAL_CONTENT;
      case "self_harm":
      case "self_harm_instructions":
      case "self_harm_intent":
        return this.THRESHOLDS.SELF_HARM;
      default:
        return 0.7; // Default threshold
    }
  }

  /**
   * Determine severity based on category and score
   */
  private static determineSeverity(
    category: string,
    score: number
  ): "low" | "medium" | "high" | "critical" {
    // Critical categories
    if (
      [
        "hate_threatening",
        "harassment_threatening",
        "violence_graphic",
        "sexual_minors",
      ].includes(category)
    ) {
      return score > 0.9 ? "critical" : score > 0.7 ? "high" : "medium";
    }

    // High severity categories
    if (
      ["hate", "harassment", "violence", "self_harm_instructions"].includes(
        category
      )
    ) {
      return score > 0.8 ? "high" : score > 0.6 ? "medium" : "low";
    }

    // Medium severity categories
    if (["sexual", "self_harm", "self_harm_intent"].includes(category)) {
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
          return "flag";
        default:
          return "flag";
      }
    }

    return "warn";
  }

  /**
   * Check if content should be rejected based on OpenAI results
   */
  static shouldReject(result: OpenAIModerationResult): boolean {
    // Reject if flagged by OpenAI
    if (result.flagged) return true;

    // Check for critical violations
    const criticalCategories = [
      "hate_threatening",
      "harassment_threatening",
      "violence_graphic",
      "sexual_minors",
    ];

    return criticalCategories.some(
      (category) =>
        result.categoryScores[category as keyof typeof result.categoryScores] >
        0.8
    );
  }

  /**
   * Get moderation summary for logging
   */
  static getModerationSummary(result: OpenAIModerationResult): string {
    if (!result.flagged) {
      return "✅ OpenAI moderation: No violations detected";
    }

    const violations: string[] = [];
    Object.entries(result.categoryScores).forEach(([category, score]) => {
      if (score > 0.5) {
        violations.push(`${category} (${(score * 100).toFixed(1)}%)`);
      }
    });

    return `⚠️ OpenAI moderation: ${violations.join(", ")}`;
  }

  /**
   * Estimate cost for moderation
   */
  static estimateCost(textLength: number): number {
    // OpenAI charges per token, roughly 4 characters per token
    const estimatedTokens = Math.ceil(textLength / 4);
    return estimatedTokens * this.API_LIMITS.costPerRequest;
  }

  /**
   * Check if text is within API limits
   */
  static isWithinLimits(text: string): boolean {
    return text.length <= this.API_LIMITS.maxTokens * 4; // Rough character limit
  }
}
