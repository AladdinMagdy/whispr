/**
 * Advanced Spam/Scam Detection Service
 * Provides sophisticated behavioral analysis and pattern recognition
 * Goes beyond simple keyword matching to detect complex spam/scam patterns
 */

import { Violation, UserReputation, Whisper } from "../types";
import { getFirestoreService } from "./firestoreService";
import { getReputationService } from "./reputationService";
import {
  SpamAnalysisResult,
  BehavioralFlag,
  UserBehaviorFlag,
  analyzeContentPatterns,
  analyzeTimingPatterns,
  analyzeGeographicPatterns,
  analyzeDevicePatterns,
  detectRepetitivePosting,
  detectRapidPosting,
  detectSimilarContent,
  detectBotLikeBehavior,
  detectEngagementFarming,
  calculateSpamScore,
  calculateScamScore,
  determineSuggestedAction,
  generateReason,
  convertToViolations,
  SPAM_THRESHOLDS,
  SCAM_THRESHOLDS,
} from "../utils/spamDetectionUtils";

export class AdvancedSpamDetectionService {
  private static instance: AdvancedSpamDetectionService | null;
  private firestoreService = getFirestoreService();
  private reputationService = getReputationService();

  private constructor() {}

  static getInstance(): AdvancedSpamDetectionService {
    if (!AdvancedSpamDetectionService.instance) {
      AdvancedSpamDetectionService.instance =
        new AdvancedSpamDetectionService();
    }
    return AdvancedSpamDetectionService.instance;
  }

  /**
   * Content-only spam/scam analysis (for pre-save moderation)
   */
  analyzeContentPatternsOnly(transcription: string): SpamAnalysisResult {
    try {
      console.log("🔍 Starting content-only spam/scam analysis...");

      // Analyze content patterns only
      const contentAnalysis = analyzeContentPatterns(transcription);

      // Calculate scores based on content only
      const spamScore = calculateSpamScore(contentAnalysis, [], []);
      const scamScore = calculateScamScore(contentAnalysis, [], []);

      // Determine if content is spam/scam
      const isSpam = spamScore > SPAM_THRESHOLDS.MEDIUM;
      const isScam = scamScore > SCAM_THRESHOLDS.MEDIUM;

      // Calculate overall confidence
      const confidence = Math.max(spamScore, scamScore);

      // Determine suggested action (default to warn for content-only analysis)
      const suggestedAction: "warn" | "flag" | "reject" | "ban" =
        isScam && confidence > 0.8
          ? "reject"
          : isSpam && confidence > 0.7
          ? "flag"
          : "warn";

      // Generate reason
      const reason = generateReason(contentAnalysis, [], [], isSpam, isScam);

      return {
        isSpam,
        isScam,
        confidence,
        spamScore,
        scamScore,
        behavioralFlags: [],
        contentFlags: contentAnalysis,
        userBehaviorFlags: [],
        suggestedAction,
        reason,
      };
    } catch (error) {
      console.error("❌ Error in content-only spam analysis:", error);
      return {
        isSpam: false,
        isScam: false,
        confidence: 0,
        spamScore: 0,
        scamScore: 0,
        behavioralFlags: [],
        contentFlags: [],
        userBehaviorFlags: [],
        suggestedAction: "warn",
        reason: "Analysis failed",
      };
    }
  }

  /**
   * Comprehensive spam/scam analysis with behavioral and user analysis
   */
  async analyzeForSpamScam(
    whisper: Whisper,
    userId: string,
    userReputation: UserReputation
  ): Promise<SpamAnalysisResult> {
    try {
      console.log("🔍 Starting comprehensive spam/scam analysis...");

      // Analyze content patterns
      const contentAnalysis = analyzeContentPatterns(
        whisper.transcription || ""
      );

      // Analyze behavioral patterns
      const behavioralAnalysis = await this.analyzeBehavioralPatterns(
        userId,
        whisper
      );

      // Analyze user behavior
      const userBehaviorAnalysis = await this.analyzeUserBehavior(
        userId,
        userReputation
      );

      // Calculate scores
      const spamScore = calculateSpamScore(
        contentAnalysis,
        behavioralAnalysis,
        userBehaviorAnalysis
      );
      const scamScore = calculateScamScore(
        contentAnalysis,
        behavioralAnalysis,
        userBehaviorAnalysis
      );

      // Determine if content is spam/scam
      const isSpam = spamScore > SPAM_THRESHOLDS.MEDIUM;
      const isScam = scamScore > SCAM_THRESHOLDS.MEDIUM;

      // Calculate overall confidence
      const confidence = Math.max(spamScore, scamScore);

      // Determine suggested action
      const suggestedAction = determineSuggestedAction(
        spamScore,
        scamScore,
        userReputation
      );

      // Generate reason
      const reason = generateReason(
        contentAnalysis,
        behavioralAnalysis,
        userBehaviorAnalysis,
        isSpam,
        isScam
      );

      return {
        isSpam,
        isScam,
        confidence,
        spamScore,
        scamScore,
        behavioralFlags: behavioralAnalysis,
        contentFlags: contentAnalysis,
        userBehaviorFlags: userBehaviorAnalysis,
        suggestedAction,
        reason,
      };
    } catch (error) {
      console.error("❌ Error in comprehensive spam analysis:", error);
      return {
        isSpam: false,
        isScam: false,
        confidence: 0,
        spamScore: 0,
        scamScore: 0,
        behavioralFlags: [],
        contentFlags: [],
        userBehaviorFlags: [],
        suggestedAction: "warn",
        reason: "Analysis failed",
      };
    }
  }

  /**
   * Analyze user behavior patterns
   */
  private async analyzeUserBehavior(
    userId: string,
    userReputation: UserReputation
  ): Promise<UserBehaviorFlag[]> {
    const flags: UserBehaviorFlag[] = [];

    try {
      // Check if new account
      const accountAge = Date.now() - userReputation.createdAt.getTime();
      const isNewAccount = accountAge < 24 * 60 * 60 * 1000; // Less than 24 hours

      if (isNewAccount) {
        flags.push({
          type: "new_account",
          severity: "medium",
          confidence: 0.7,
          description: "New account detected",
          evidence: { accountAge },
        });
      }

      // Check reputation level
      if (
        userReputation.level === "flagged" ||
        userReputation.level === "banned"
      ) {
        flags.push({
          type: "low_reputation",
          severity: "high",
          confidence: 0.9,
          description: `User has ${userReputation.level} reputation level`,
          evidence: {
            level: userReputation.level,
            score: userReputation.score,
          },
        });
      } else if (userReputation.score < 50) {
        flags.push({
          type: "low_reputation",
          severity: "medium",
          confidence: 0.6,
          description: "User has low reputation score",
          evidence: { score: userReputation.score },
        });
      }

      // Get recent whispers for timing analysis
      const recentWhispersResult = await this.firestoreService.getUserWhispers(
        userId
      );
      const recentWhispers = recentWhispersResult.whispers.slice(0, 10);

      // Analyze timing patterns
      const timingFlags = analyzeTimingPatterns(recentWhispers);
      flags.push(...timingFlags);

      // Analyze geographic patterns (placeholder)
      const geographicFlags = analyzeGeographicPatterns();
      flags.push(...geographicFlags);

      // Analyze device patterns (placeholder)
      const deviceFlags = analyzeDevicePatterns();
      flags.push(...deviceFlags);
    } catch (error) {
      console.error("❌ Error analyzing user behavior:", error);
    }

    return flags;
  }

  /**
   * Analyze behavioral patterns
   */
  private async analyzeBehavioralPatterns(
    userId: string,
    currentWhisper: Whisper
  ): Promise<BehavioralFlag[]> {
    const flags: BehavioralFlag[] = [];

    try {
      // Get recent whispers for behavioral analysis
      const recentWhispersResult = await this.firestoreService.getUserWhispers(
        userId
      );
      const recentWhispers = recentWhispersResult.whispers.slice(0, 20);

      // Detect repetitive posting
      const repetitiveScore = detectRepetitivePosting(
        recentWhispers,
        currentWhisper
      );
      if (repetitiveScore > 0.3) {
        flags.push({
          type: "repetitive_posting",
          severity:
            repetitiveScore > 0.7
              ? "high"
              : repetitiveScore > 0.5
              ? "medium"
              : "low",
          confidence: repetitiveScore,
          description: "Repetitive posting behavior detected",
          evidence: { score: repetitiveScore },
        });
      }

      // Detect rapid posting
      const rapidScore = detectRapidPosting(recentWhispers);
      if (rapidScore > 0.3) {
        flags.push({
          type: "rapid_posting",
          severity:
            rapidScore > 0.7 ? "high" : rapidScore > 0.5 ? "medium" : "low",
          confidence: rapidScore,
          description: "Rapid posting behavior detected",
          evidence: { score: rapidScore },
        });
      }

      // Detect similar content
      const similarScore = detectSimilarContent(recentWhispers, currentWhisper);
      if (similarScore > 0.3) {
        flags.push({
          type: "similar_content",
          severity:
            similarScore > 0.7 ? "high" : similarScore > 0.5 ? "medium" : "low",
          confidence: similarScore,
          description: "Similar content patterns detected",
          evidence: { score: similarScore },
        });
      }

      // Detect bot-like behavior
      const botScore = detectBotLikeBehavior(recentWhispers);
      if (botScore > 0.3) {
        flags.push({
          type: "bot_like_behavior",
          severity: botScore > 0.7 ? "high" : botScore > 0.5 ? "medium" : "low",
          confidence: botScore,
          description: "Bot-like behavior patterns detected",
          evidence: { score: botScore },
        });
      }

      // Detect engagement farming
      const engagementScore = detectEngagementFarming(recentWhispers);
      if (engagementScore > 0.3) {
        flags.push({
          type: "engagement_farming",
          severity:
            engagementScore > 0.7
              ? "high"
              : engagementScore > 0.5
              ? "medium"
              : "low",
          confidence: engagementScore,
          description: "Engagement farming behavior detected",
          evidence: { score: engagementScore },
        });
      }
    } catch (error) {
      console.error("❌ Error analyzing behavioral patterns:", error);
    }

    return flags;
  }

  /**
   * Convert analysis result to violations
   */
  static convertToViolations(result: SpamAnalysisResult): Violation[] {
    return convertToViolations(result);
  }
}

/**
 * Factory function to get AdvancedSpamDetectionService instance
 */
export const getAdvancedSpamDetectionService = () =>
  AdvancedSpamDetectionService.getInstance();
