/**
 * Content Moderation Service
 * Main service that orchestrates all moderation APIs and provides unified interface
 */

import {
  ModerationResult,
  ContentRank,
  ViolationType,
  Violation,
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
import {
  deduplicateViolations,
  determineFinalStatus,
  calculateOverallConfidence,
  isAppealable,
  generateReason,
  createRejectionResult,
  createErrorResult,
} from "../utils/moderationUtils";

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
        return createRejectionResult(
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
          return createRejectionResult(
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
            return createRejectionResult(
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

      // Step 4: Advanced Spam/Scam Detection (DISABLED - requires post-save analysis)
      // Note: Full behavioral analysis requires complete whisper data
      // This will be implemented as a separate post-save service
      // TODO: Implement post-save behavioral analysis service

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
        status: determineFinalStatus(allViolations),
        contentRank,
        isMinorSafe,
        violations: allViolations,
        confidence: calculateOverallConfidence(allViolations),
        moderationTime: Date.now() - startTime,
        apiResults: {
          local: localResult,
          openai: openaiResult ?? undefined,
          perspective: perspectiveResult ?? undefined,
        },
        appealable: isAppealable(
          determineFinalStatus(allViolations),
          allViolations
        ),
        reason: generateReason(
          allViolations,
          determineFinalStatus(allViolations)
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
      return createErrorResult(error, startTime);
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
    // Check from most restrictive to least restrictive
    if (
      maxToxicity > this.CONTENT_RANKING.NC17.maxToxicity ||
      maxSexualContent > this.CONTENT_RANKING.NC17.maxSexualContent ||
      maxViolence > this.CONTENT_RANKING.NC17.maxViolence ||
      maxHateSpeech > this.CONTENT_RANKING.NC17.maxHateSpeech
    ) {
      return ContentRank.NC17;
    }

    if (
      maxToxicity > this.CONTENT_RANKING.R.maxToxicity ||
      maxSexualContent > this.CONTENT_RANKING.R.maxSexualContent ||
      maxViolence > this.CONTENT_RANKING.R.maxViolence ||
      maxHateSpeech > this.CONTENT_RANKING.R.maxHateSpeech
    ) {
      return ContentRank.R;
    }

    if (
      maxToxicity > this.CONTENT_RANKING.PG13.maxToxicity ||
      maxSexualContent > this.CONTENT_RANKING.PG13.maxSexualContent ||
      maxViolence > this.CONTENT_RANKING.PG13.maxViolence ||
      maxHateSpeech > this.CONTENT_RANKING.PG13.maxHateSpeech
    ) {
      return ContentRank.PG13;
    }

    if (
      maxToxicity > this.CONTENT_RANKING.PG.maxToxicity ||
      maxSexualContent > this.CONTENT_RANKING.PG.maxSexualContent ||
      maxViolence > this.CONTENT_RANKING.PG.maxViolence ||
      maxHateSpeech > this.CONTENT_RANKING.PG.maxHateSpeech
    ) {
      return ContentRank.PG;
    }

    return ContentRank.G;
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

    // Add spam/scam violations (disabled for now)
    // TODO: Implement post-save behavioral analysis

    // Remove duplicates and sort by severity
    return deduplicateViolations(violations);
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
