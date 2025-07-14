/**
 * Content Moderation Service
 * Main service that orchestrates all moderation APIs and provides unified interface
 */

import {
  ModerationResult,
  ModerationStatus,
  ContentRank,
  ViolationType,
  Violation,
  UserReputation,
  OpenAIModerationResult,
  PerspectiveAPIResult,
  LocalModerationResult,
  ModerationFeatureFlags,
} from "../types";
import { CONTENT_MODERATION } from "../constants";
import { LocalModerationService } from "./localModerationService";
import { OpenAIModerationService } from "./openAIModerationService";
import { PerspectiveAPIService } from "./perspectiveAPIService";
import { getReputationService } from "./reputationService";

export class ContentModerationService {
  private static readonly FEATURE_FLAGS: ModerationFeatureFlags =
    CONTENT_MODERATION.FEATURE_FLAGS;
  private static readonly CONTENT_RANKING = CONTENT_MODERATION.CONTENT_RANKING;
  private static readonly REPUTATION = CONTENT_MODERATION.REPUTATION;

  /**
   * Main moderation method - orchestrates all APIs
   */
  static async moderateWhisper(
    transcription: string,
    userId: string,
    userAge: number
  ): Promise<ModerationResult> {
    // Enforce 13+ age restriction
    if (userAge < 13) {
      throw new Error("Users must be 13 or older to use this platform");
    }
    const startTime = Date.now();

    try {
      console.log("🛡️ Starting content moderation for whisper...");

      // Step 1: Local keyword filtering (FREE)
      const localResult = await LocalModerationService.checkKeywords(
        transcription
      );
      console.log(LocalModerationService.getModerationSummary(localResult));

      // Check if we should reject immediately
      if (await LocalModerationService.shouldRejectImmediately(transcription)) {
        console.log("❌ Content rejected by local moderation");
        return this.createRejectionResult(
          "Content rejected by local keyword filtering",
          localResult,
          startTime
        );
      }

      // Step 2: OpenAI Moderation (PRIMARY)
      let openaiResult: OpenAIModerationResult | null = null;
      try {
        openaiResult = await OpenAIModerationService.moderateText(
          transcription
        );
        console.log(OpenAIModerationService.getModerationSummary(openaiResult));

        if (OpenAIModerationService.shouldReject(openaiResult)) {
          console.log("❌ Content rejected by OpenAI moderation");
          return this.createRejectionResult(
            "Content rejected by OpenAI moderation",
            localResult,
            startTime,
            openaiResult
          );
        }
      } catch (error) {
        console.warn(
          "⚠️ OpenAI moderation failed, continuing with other services:",
          error
        );
      }

      // Step 3: Google Perspective API (SECONDARY)
      let perspectiveResult: PerspectiveAPIResult | null = null;
      if (this.FEATURE_FLAGS.ENABLE_GOOGLE_PERSPECTIVE) {
        try {
          perspectiveResult = await PerspectiveAPIService.analyzeText(
            transcription
          );
          console.log(
            PerspectiveAPIService.getModerationSummary(perspectiveResult)
          );

          if (PerspectiveAPIService.shouldReject(perspectiveResult)) {
            console.log("❌ Content rejected by Perspective API");
            return this.createRejectionResult(
              "Content rejected by Perspective API",
              localResult,
              startTime,
              openaiResult,
              perspectiveResult
            );
          }
        } catch (error) {
          console.warn(
            "⚠️ Perspective API failed, continuing with other services:",
            error
          );
        }
      }

      // Step 4: Calculate content ranking and age safety
      const contentRank = this.calculateContentRank(
        openaiResult,
        perspectiveResult,
        localResult
      );
      const isMinorSafe = this.isContentMinorSafe(contentRank);

      // Step 5: Combine all violations
      const allViolations = this.combineViolations(
        localResult,
        openaiResult,
        perspectiveResult
      );

      // Step 6: Create base moderation result
      const baseResult = {
        status: this.determineFinalStatus(allViolations),
        contentRank,
        isMinorSafe,
        violations: allViolations,
        confidence: this.calculateOverallConfidence(allViolations),
        moderationTime: Date.now() - startTime,
        apiResults: {
          local: localResult,
          openai: openaiResult ?? undefined,
          perspective: perspectiveResult ?? undefined,
        },
        appealable: this.isAppealable(
          this.determineFinalStatus(allViolations),
          allViolations
        ),
        reason: this.generateReason(
          allViolations,
          this.determineFinalStatus(allViolations)
        ),
        reputationImpact: 0,
      };

      // Step 7: Apply reputation-based actions
      const reputationService = getReputationService();
      const finalResult = await reputationService.applyReputationBasedActions(
        baseResult,
        userId
      );

      console.log(
        `✅ Content moderation completed in ${finalResult.moderationTime}ms`
      );
      return finalResult;
    } catch (error) {
      console.error("❌ Content moderation failed:", error);
      return this.createErrorResult(error, startTime);
    }
  }

  /**
   * Calculate content ranking based on all API results
   */
  private static calculateContentRank(
    openaiResult: OpenAIModerationResult | null,
    perspectiveResult: PerspectiveAPIResult | null,
    localResult: LocalModerationResult
  ): ContentRank {
    // Get maximum scores from each API
    const maxToxicity = Math.max(
      localResult.toxicityScore,
      perspectiveResult?.toxicity || 0,
      openaiResult?.categoryScores.harassment || 0
    );

    const maxSexualContent = Math.max(
      openaiResult?.categoryScores.sexual || 0,
      openaiResult?.categoryScores.sexual_minors || 0,
      perspectiveResult?.sexuallyExplicit || 0
    );

    const maxViolence = Math.max(
      openaiResult?.categoryScores.violence || 0,
      openaiResult?.categoryScores.violence_graphic || 0,
      perspectiveResult?.threat || 0
    );

    const maxHateSpeech = Math.max(
      openaiResult?.categoryScores.hate || 0,
      openaiResult?.categoryScores.hate_threatening || 0,
      perspectiveResult?.identityAttack || 0
    );

    // Determine content rank based on thresholds
    if (
      maxToxicity <= this.CONTENT_RANKING.G.maxToxicity &&
      maxSexualContent <= this.CONTENT_RANKING.G.maxSexualContent &&
      maxViolence <= this.CONTENT_RANKING.G.maxViolence &&
      maxHateSpeech <= this.CONTENT_RANKING.G.maxHateSpeech
    ) {
      return ContentRank.G;
    }

    if (
      maxToxicity <= this.CONTENT_RANKING.PG.maxToxicity &&
      maxSexualContent <= this.CONTENT_RANKING.PG.maxSexualContent &&
      maxViolence <= this.CONTENT_RANKING.PG.maxViolence &&
      maxHateSpeech <= this.CONTENT_RANKING.PG.maxHateSpeech
    ) {
      return ContentRank.PG;
    }

    if (
      maxToxicity <= this.CONTENT_RANKING.PG13.maxToxicity &&
      maxSexualContent <= this.CONTENT_RANKING.PG13.maxSexualContent &&
      maxViolence <= this.CONTENT_RANKING.PG13.maxViolence &&
      maxHateSpeech <= this.CONTENT_RANKING.PG13.maxHateSpeech
    ) {
      return ContentRank.PG13;
    }

    if (
      maxToxicity <= this.CONTENT_RANKING.R.maxToxicity &&
      maxSexualContent <= this.CONTENT_RANKING.R.maxSexualContent &&
      maxViolence <= this.CONTENT_RANKING.R.maxViolence &&
      maxHateSpeech <= this.CONTENT_RANKING.R.maxHateSpeech
    ) {
      return ContentRank.R;
    }

    return ContentRank.NC17;
  }

  /**
   * Check if content is safe for minors
   */
  private static isContentMinorSafe(contentRank: ContentRank): boolean {
    return contentRank === ContentRank.G || contentRank === ContentRank.PG;
  }

  /**
   * Combine violations from all APIs
   */
  private static combineViolations(
    localResult: LocalModerationResult,
    openaiResult: OpenAIModerationResult | null,
    perspectiveResult: PerspectiveAPIResult | null
  ): Violation[] {
    const violations: Violation[] = [];

    // Add local violations
    if (localResult.flagged) {
      // Convert local result to violations
      if (localResult.toxicityScore > 0.5) {
        violations.push({
          type: ViolationType.HARASSMENT,
          severity: localResult.toxicityScore > 0.8 ? "high" : "medium",
          confidence: localResult.toxicityScore,
          description: "Local toxicity detection",
          suggestedAction: localResult.toxicityScore > 0.8 ? "reject" : "flag",
        });
      }

      if (localResult.personalInfoDetected) {
        violations.push({
          type: ViolationType.PERSONAL_INFO,
          severity: "high",
          confidence: 0.9,
          description: "Personal information detected",
          suggestedAction: "reject",
        });
      }

      if (localResult.spamScore > 0.5) {
        violations.push({
          type: ViolationType.SPAM,
          severity: "low",
          confidence: localResult.spamScore,
          description: "Spam detected",
          suggestedAction: "warn",
        });
      }
    }

    // Add OpenAI violations
    if (openaiResult) {
      violations.push(
        ...OpenAIModerationService.convertToViolations(openaiResult)
      );
    }

    // Add Perspective violations
    if (perspectiveResult) {
      violations.push(
        ...PerspectiveAPIService.convertToViolations(perspectiveResult)
      );
    }

    // Remove duplicates and sort by severity
    return this.deduplicateViolations(violations);
  }

  /**
   * Remove duplicate violations and sort by severity
   */
  private static deduplicateViolations(violations: Violation[]): Violation[] {
    const seen = new Set<string>();
    const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };

    return violations
      .filter((violation) => {
        const key = `${violation.type}-${violation.severity}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity]);
  }

  /**
   * Apply reputation-based actions
   */
  private static applyReputationBasedActions(
    violations: Violation[],
    userReputation?: UserReputation
  ): Violation[] {
    if (!userReputation || !this.FEATURE_FLAGS.ENABLE_REPUTATION_SYSTEM) {
      return violations;
    }

    const reputationLevel = this.getReputationLevel(userReputation.score);
    const reputationActions =
      this.REPUTATION.REPUTATION_ACTIONS[reputationLevel];

    // Apply reputation-based adjustments
    return violations.map((violation) => {
      let adjustedViolation = { ...violation };

      // Trusted users get reduced penalties
      if (reputationActions.reducedPenalties) {
        if (violation.severity === "critical")
          adjustedViolation.severity = "high";
        if (violation.severity === "high")
          adjustedViolation.severity = "medium";
        if (violation.severity === "medium") adjustedViolation.severity = "low";
      }

      // Trusted users get more lenient suggested actions
      if (reputationActions.reducedPenalties) {
        if (violation.suggestedAction === "ban")
          adjustedViolation.suggestedAction = "reject";
        if (violation.suggestedAction === "reject")
          adjustedViolation.suggestedAction = "flag";
        if (violation.suggestedAction === "flag")
          adjustedViolation.suggestedAction = "warn";
      }

      return adjustedViolation;
    });
  }

  /**
   * Determine final moderation status
   */
  private static determineFinalStatus(
    violations: Violation[]
  ): ModerationStatus {
    if (violations.length === 0) {
      return ModerationStatus.APPROVED;
    }

    // Check for critical violations
    const criticalViolations = violations.filter(
      (v) => v.severity === "critical"
    );
    if (criticalViolations.length > 0) {
      return ModerationStatus.REJECTED;
    }

    // Check for high severity violations
    const highViolations = violations.filter((v) => v.severity === "high");
    if (highViolations.length > 0) {
      return ModerationStatus.REJECTED;
    }

    // Check for medium severity violations
    const mediumViolations = violations.filter((v) => v.severity === "medium");
    if (mediumViolations.length > 0) {
      return ModerationStatus.FLAGGED;
    }

    // Low severity violations
    return ModerationStatus.APPROVED;
  }

  /**
   * Calculate overall confidence
   */
  private static calculateOverallConfidence(violations: Violation[]): number {
    if (violations.length === 0) return 1.0;

    const totalConfidence = violations.reduce(
      (sum, v) => sum + v.confidence,
      0
    );
    return totalConfidence / violations.length;
  }

  /**
   * Calculate reputation impact
   */
  private static calculateReputationImpact(
    violations: Violation[],
    userReputation?: UserReputation
  ): number {
    if (!userReputation || violations.length === 0) return 0;

    let totalImpact = 0;
    violations.forEach((violation) => {
      switch (violation.severity) {
        case "critical":
          totalImpact += this.REPUTATION.SCORE_ADJUSTMENTS.CRITICAL_VIOLATION;
          break;
        case "high":
          totalImpact += this.REPUTATION.SCORE_ADJUSTMENTS.VIOLATION;
          break;
        case "medium":
          totalImpact += this.REPUTATION.SCORE_ADJUSTMENTS.FLAGGED_WHISPER;
          break;
        case "low":
          totalImpact += this.REPUTATION.SCORE_ADJUSTMENTS.APPROVED_WHISPER;
          break;
      }
    });

    return totalImpact;
  }

  /**
   * Check if content is appealable
   */
  private static isAppealable(
    status: ModerationStatus,
    violations: Violation[]
  ): boolean {
    if (status === ModerationStatus.APPROVED) return false;

    // Critical violations are not appealable
    const hasCriticalViolations = violations.some(
      (v) => v.severity === "critical"
    );
    if (hasCriticalViolations) return false;

    return true;
  }

  /**
   * Generate reason for moderation decision
   */
  private static generateReason(
    violations: Violation[],
    status: ModerationStatus
  ): string {
    if (violations.length === 0) {
      return "Content approved";
    }

    const violationTypes = violations.map((v) => v.type).join(", ");
    return `Content ${status} due to: ${violationTypes}`;
  }

  /**
   * Get reputation level from score
   */
  private static getReputationLevel(
    score: number
  ): keyof typeof CONTENT_MODERATION.REPUTATION.REPUTATION_ACTIONS {
    if (score >= this.REPUTATION.TRUSTED_THRESHOLD) return "TRUSTED";
    if (score >= this.REPUTATION.VERIFIED_THRESHOLD) return "VERIFIED";
    if (score >= this.REPUTATION.STANDARD_THRESHOLD) return "STANDARD";
    if (score >= this.REPUTATION.FLAGGED_THRESHOLD) return "FLAGGED";
    return "BANNED";
  }

  /**
   * Create rejection result
   */
  private static createRejectionResult(
    reason: string,
    localResult: LocalModerationResult,
    startTime: number,
    openaiResult?: OpenAIModerationResult | null,
    perspectiveResult?: PerspectiveAPIResult | null
  ): ModerationResult {
    return {
      status: ModerationStatus.REJECTED,
      contentRank: ContentRank.NC17,
      isMinorSafe: false,
      violations: [],
      confidence: 1.0,
      moderationTime: Date.now() - startTime,
      apiResults: {
        local: localResult,
        openai: openaiResult,
        perspective: perspectiveResult,
      },
      reputationImpact: -15,
      appealable: false,
      reason,
    };
  }

  /**
   * Create error result
   */
  private static createErrorResult(
    error: unknown,
    startTime: number
  ): ModerationResult {
    return {
      status: ModerationStatus.UNDER_REVIEW,
      contentRank: ContentRank.PG13, // Default to conservative ranking
      isMinorSafe: false,
      violations: [],
      confidence: 0.0,
      moderationTime: Date.now() - startTime,
      apiResults: {},
      reputationImpact: 0,
      appealable: true,
      reason: `Moderation error: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }

  /**
   * Estimate total moderation cost
   */
  static estimateCost(textLength: number): number {
    let totalCost = 0;

    // Local moderation is free
    totalCost += 0;

    // OpenAI cost (estimate based on tokens)
    const estimatedTokens = Math.ceil(textLength / 4);
    totalCost += estimatedTokens * 0.0001; // $0.0001 per token

    // Perspective API cost (if enabled)
    if (this.FEATURE_FLAGS.ENABLE_GOOGLE_PERSPECTIVE) {
      totalCost += 0.0002; // $0.0002 per request
    }

    return totalCost;
  }
}
