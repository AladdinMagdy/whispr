/**
 * Advanced Spam/Scam Detection Service
 * Provides sophisticated behavioral analysis and pattern recognition
 * Goes beyond simple keyword matching to detect complex spam/scam patterns
 */

import { ViolationType, Violation, UserReputation, Whisper } from "../types";
import { getFirestoreService } from "./firestoreService";
import { getReputationService } from "./reputationService";

export interface SpamAnalysisResult {
  isSpam: boolean;
  isScam: boolean;
  confidence: number;
  spamScore: number;
  scamScore: number;
  behavioralFlags: BehavioralFlag[];
  contentFlags: ContentFlag[];
  userBehaviorFlags: UserBehaviorFlag[];
  suggestedAction: "warn" | "flag" | "reject" | "ban";
  reason: string;
}

export interface BehavioralFlag {
  type:
    | "repetitive_posting"
    | "rapid_posting"
    | "similar_content"
    | "bot_like_behavior"
    | "engagement_farming";
  severity: "low" | "medium" | "high" | "critical";
  confidence: number;
  description: string;
  evidence: Record<string, unknown>;
}

export interface ContentFlag {
  type:
    | "suspicious_patterns"
    | "clickbait"
    | "misleading_info"
    | "fake_urgency"
    | "phishing_attempt";
  severity: "low" | "medium" | "high" | "critical";
  confidence: number;
  description: string;
  evidence: Record<string, unknown>;
}

export interface UserBehaviorFlag {
  type:
    | "new_account"
    | "low_reputation"
    | "suspicious_timing"
    | "geographic_anomaly"
    | "device_pattern";
  severity: "low" | "medium" | "high" | "critical";
  confidence: number;
  description: string;
  evidence: Record<string, unknown>;
}

export class AdvancedSpamDetectionService {
  private static instance: AdvancedSpamDetectionService | null;
  private firestoreService = getFirestoreService();
  private reputationService = getReputationService();

  // Spam detection thresholds
  private static readonly SPAM_THRESHOLDS = {
    LOW: 0.3,
    MEDIUM: 0.5,
    HIGH: 0.7,
    CRITICAL: 0.9,
  };

  // Scam detection thresholds
  private static readonly SCAM_THRESHOLDS = {
    LOW: 0.4,
    MEDIUM: 0.6,
    HIGH: 0.8,
    CRITICAL: 0.95,
  };

  // Behavioral analysis weights
  private static readonly BEHAVIORAL_WEIGHTS = {
    repetitive_posting: 0.3,
    rapid_posting: 0.25,
    similar_content: 0.2,
    bot_like_behavior: 0.15,
    engagement_farming: 0.1,
  };

  // Content analysis weights
  private static readonly CONTENT_WEIGHTS = {
    suspicious_patterns: 0.25,
    clickbait: 0.2,
    misleading_info: 0.2,
    fake_urgency: 0.15,
    phishing_attempt: 0.2,
  };

  // User behavior weights
  private static readonly USER_BEHAVIOR_WEIGHTS = {
    new_account: 0.2,
    low_reputation: 0.3,
    suspicious_timing: 0.2,
    geographic_anomaly: 0.15,
    device_pattern: 0.15,
  };

  // Suspicious patterns and keywords
  private static readonly SUSPICIOUS_PATTERNS = {
    // Financial scams
    FINANCIAL_SCAMS: [
      "make money fast",
      "earn money online",
      "work from home",
      "get rich quick",
      "investment opportunity",
      "cryptocurrency investment",
      "bitcoin investment",
      "forex trading",
      "binary options",
      "pyramid scheme",
      "multi-level marketing",
      "mlm",
      "passive income",
      "financial freedom",
      "quit your job",
      "retire early",
    ],

    // Phishing attempts
    PHISHING: [
      "verify your account",
      "confirm your details",
      "update your information",
      "security check",
      "account suspended",
      "unusual activity",
      "login attempt",
      "password reset",
      "credit card verification",
      "bank account verification",
      "social security number",
      "ssn",
      "tax refund",
      "irs",
      "government grant",
      "free money",
      "claim your prize",
      "you've won",
      "congratulations you won",
    ],

    // Clickbait patterns
    CLICKBAIT: [
      "you won't believe",
      "shocking truth",
      "secret revealed",
      "doctors hate this",
      "one weird trick",
      "what happens next",
      "number 7 will shock you",
      "this will change everything",
      "amazing discovery",
      "incredible results",
      "miracle cure",
      "instant results",
      "overnight success",
      "guaranteed results",
    ],

    // Fake urgency
    FAKE_URGENCY: [
      "limited time",
      "act now",
      "don't wait",
      "expires soon",
      "last chance",
      "final offer",
      "while supplies last",
      "only today",
      "urgent action required",
      "immediate attention",
      "time sensitive",
      "deadline approaching",
    ],

    // Misleading information
    MISLEADING: [
      "100% guaranteed",
      "no risk",
      "free trial",
      "no obligation",
      "cancel anytime",
      "no hidden fees",
      "money back guarantee",
      "satisfaction guaranteed",
      "proven results",
      "scientifically proven",
      "doctor recommended",
      "expert approved",
    ],
  };

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
      const contentAnalysis = this.analyzeContentPatterns(transcription);

      // Calculate scores based on content only
      const spamScore = this.calculateSpamScore(contentAnalysis, [], []);
      const scamScore = this.calculateScamScore(contentAnalysis, [], []);

      // Determine if content is spam/scam
      const isSpam =
        spamScore > AdvancedSpamDetectionService.SPAM_THRESHOLDS.MEDIUM;
      const isScam =
        scamScore > AdvancedSpamDetectionService.SCAM_THRESHOLDS.MEDIUM;

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
      const reason = this.generateReason(
        contentAnalysis,
        [], // behavioralFlags
        [], // userBehaviorFlags
        isSpam,
        isScam
      );

      const result: SpamAnalysisResult = {
        isSpam,
        isScam,
        confidence,
        spamScore,
        scamScore,
        behavioralFlags: [], // No behavioral analysis in content-only mode
        contentFlags: contentAnalysis,
        userBehaviorFlags: [], // No user behavior analysis in content-only mode
        suggestedAction,
        reason,
      };

      console.log("🔍 Content-only analysis completed:", {
        isSpam,
        isScam,
        confidence: (confidence * 100).toFixed(1) + "%",
        suggestedAction,
      });

      return result;
    } catch (error) {
      console.error("❌ Error in content-only analysis:", error);
      // Return safe default
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
        reason: "Analysis failed - defaulting to safe",
      };
    }
  }

  /**
   * Comprehensive spam/scam analysis (requires full whisper data)
   */
  async analyzeForSpamScam(
    whisper: Whisper,
    userId: string,
    userReputation: UserReputation
  ): Promise<SpamAnalysisResult> {
    try {
      console.log("🔍 Starting advanced spam/scam analysis...");

      // Get user's recent behavior
      const userBehavior = await this.analyzeUserBehavior(
        userId,
        userReputation
      );

      // Analyze content patterns
      const contentAnalysis = this.analyzeContentPatterns(
        whisper.transcription || ""
      );

      // Analyze behavioral patterns
      const behavioralAnalysis = await this.analyzeBehavioralPatterns(
        userId,
        whisper
      );

      // Calculate combined scores
      const spamScore = this.calculateSpamScore(
        contentAnalysis,
        behavioralAnalysis,
        userBehavior
      );
      const scamScore = this.calculateScamScore(
        contentAnalysis,
        behavioralAnalysis,
        userBehavior
      );

      // Determine if content is spam/scam
      const isSpam =
        spamScore > AdvancedSpamDetectionService.SPAM_THRESHOLDS.MEDIUM;
      const isScam =
        scamScore > AdvancedSpamDetectionService.SCAM_THRESHOLDS.MEDIUM;

      // Calculate overall confidence
      const confidence = Math.max(spamScore, scamScore);

      // Determine suggested action
      const suggestedAction = this.determineSuggestedAction(
        spamScore,
        scamScore,
        userReputation
      );

      // Generate reason
      const reason = this.generateReason(
        contentAnalysis,
        behavioralAnalysis,
        userBehavior,
        isSpam,
        isScam
      );

      const result: SpamAnalysisResult = {
        isSpam,
        isScam,
        confidence,
        spamScore,
        scamScore,
        behavioralFlags: behavioralAnalysis,
        contentFlags: contentAnalysis,
        userBehaviorFlags: userBehavior,
        suggestedAction,
        reason,
      };

      console.log("🔍 Spam/Scam analysis completed:", {
        isSpam,
        isScam,
        confidence: (confidence * 100).toFixed(1) + "%",
        suggestedAction,
      });

      return result;
    } catch (error) {
      console.error("❌ Error in spam/scam analysis:", error);
      // Return safe default
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
        reason: "Analysis failed - defaulting to safe",
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
      // Get user's recent whispers
      const recentWhispers = await this.firestoreService.getUserWhispers(
        userId
      );

      // Check for new account behavior
      if (userReputation.totalWhispers < 5) {
        flags.push({
          type: "new_account",
          severity: "medium",
          confidence: 0.8,
          description: "New account with limited history",
          evidence: { totalWhispers: userReputation.totalWhispers },
        });
      }

      // Check for low reputation
      if (userReputation.score < 30) {
        flags.push({
          type: "low_reputation",
          severity: "high",
          confidence: 0.9,
          description: "User has low reputation score",
          evidence: { reputationScore: userReputation.score },
        });
      }

      // Check for suspicious timing patterns
      const timingFlags = this.analyzeTimingPatterns(recentWhispers.whispers);
      flags.push(...timingFlags);

      // Check for geographic anomalies (if location data available)
      const geoFlags = this.analyzeGeographicPatterns(recentWhispers.whispers);
      flags.push(...geoFlags);

      // Check for device patterns (if device data available)
      const deviceFlags = this.analyzeDevicePatterns(recentWhispers.whispers);
      flags.push(...deviceFlags);
    } catch (error) {
      console.warn("⚠️ Error analyzing user behavior:", error);
    }

    return flags;
  }

  /**
   * Analyze content patterns for spam/scam indicators
   */
  private analyzeContentPatterns(transcription: string): ContentFlag[] {
    const flags: ContentFlag[] = [];
    const text = transcription.toLowerCase();

    // Check for suspicious patterns
    const suspiciousPatterns = this.detectSuspiciousPatterns(text);
    if (suspiciousPatterns.length > 0) {
      flags.push({
        type: "suspicious_patterns",
        severity: suspiciousPatterns.length > 3 ? "high" : "medium",
        confidence: Math.min(0.9, suspiciousPatterns.length * 0.2),
        description: `Detected ${suspiciousPatterns.length} suspicious patterns`,
        evidence: { patterns: suspiciousPatterns },
      });
    }

    // Check for clickbait patterns
    const clickbaitScore = this.detectClickbait(text);
    if (clickbaitScore > 0.3) {
      flags.push({
        type: "clickbait",
        severity: clickbaitScore > 0.7 ? "high" : "medium",
        confidence: clickbaitScore,
        description: "Content contains clickbait patterns",
        evidence: { clickbaitScore },
      });
    }

    // Check for misleading information
    const misleadingScore = this.detectMisleadingInfo(text);
    if (misleadingScore > 0.3) {
      flags.push({
        type: "misleading_info",
        severity: misleadingScore > 0.7 ? "high" : "medium",
        confidence: misleadingScore,
        description: "Content contains misleading information",
        evidence: { misleadingScore },
      });
    }

    // Check for fake urgency
    const urgencyScore = this.detectFakeUrgency(text);
    if (urgencyScore > 0.3) {
      flags.push({
        type: "fake_urgency",
        severity: urgencyScore > 0.7 ? "high" : "medium",
        confidence: urgencyScore,
        description: "Content creates fake urgency",
        evidence: { urgencyScore },
      });
    }

    // Check for phishing attempts
    const phishingScore = this.detectPhishingAttempt(text);
    if (phishingScore > 0.3) {
      flags.push({
        type: "phishing_attempt",
        severity: "critical",
        confidence: phishingScore,
        description: "Potential phishing attempt detected",
        evidence: { phishingScore },
      });
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
      // Get user's recent whispers
      const recentWhispers = await this.firestoreService.getUserWhispers(
        userId
      );

      // Check for repetitive posting
      const repetitiveScore = this.detectRepetitivePosting(
        recentWhispers.whispers,
        currentWhisper
      );
      if (repetitiveScore > 0.3) {
        flags.push({
          type: "repetitive_posting",
          severity: repetitiveScore > 0.7 ? "high" : "medium",
          confidence: repetitiveScore,
          description: "User posting repetitive content",
          evidence: { repetitiveScore },
        });
      }

      // Check for rapid posting
      const rapidPostingScore = this.detectRapidPosting(
        recentWhispers.whispers
      );
      if (rapidPostingScore > 0.3) {
        flags.push({
          type: "rapid_posting",
          severity: rapidPostingScore > 0.7 ? "high" : "medium",
          confidence: rapidPostingScore,
          description: "User posting too rapidly",
          evidence: { rapidPostingScore },
        });
      }

      // Check for similar content
      const similarContentScore = this.detectSimilarContent(
        recentWhispers.whispers,
        currentWhisper
      );
      if (similarContentScore > 0.3) {
        flags.push({
          type: "similar_content",
          severity: similarContentScore > 0.7 ? "high" : "medium",
          confidence: similarContentScore,
          description: "Content similar to previous posts",
          evidence: { similarContentScore },
        });
      }

      // Check for bot-like behavior
      const botScore = this.detectBotLikeBehavior(recentWhispers.whispers);
      if (botScore > 0.3) {
        flags.push({
          type: "bot_like_behavior",
          severity: botScore > 0.7 ? "high" : "medium",
          confidence: botScore,
          description: "Behavior patterns suggest bot activity",
          evidence: { botScore },
        });
      }

      // Check for engagement farming
      const engagementScore = this.detectEngagementFarming(
        recentWhispers.whispers
      );
      if (engagementScore > 0.3) {
        flags.push({
          type: "engagement_farming",
          severity: engagementScore > 0.7 ? "high" : "medium",
          confidence: engagementScore,
          description: "Content designed to farm engagement",
          evidence: { engagementScore },
        });
      }
    } catch (error) {
      console.warn("⚠️ Error analyzing behavioral patterns:", error);
    }

    return flags;
  }

  /**
   * Detect suspicious patterns in text
   */
  private detectSuspiciousPatterns(text: string): string[] {
    const detectedPatterns: string[] = [];

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const [category, patterns] of Object.entries(
      AdvancedSpamDetectionService.SUSPICIOUS_PATTERNS
    )) {
      for (const pattern of patterns) {
        if (text.includes(pattern.toLowerCase())) {
          detectedPatterns.push(pattern);
        }
      }
    }

    return detectedPatterns;
  }

  /**
   * Detect clickbait patterns
   */
  private detectClickbait(text: string): number {
    let score = 0;
    const clickbaitPatterns =
      AdvancedSpamDetectionService.SUSPICIOUS_PATTERNS.CLICKBAIT;

    for (const pattern of clickbaitPatterns) {
      if (text.includes(pattern.toLowerCase())) {
        score += 0.2;
      }
    }

    // Check for excessive punctuation
    const exclamationCount = (text.match(/!/g) || []).length;
    const questionCount = (text.match(/\?/g) || []).length;

    if (exclamationCount > 3) score += 0.1;
    if (questionCount > 2) score += 0.1;

    // Check for all caps
    const upperCaseRatio =
      (text.match(/[A-Z]/g) || []).length / Math.max(1, text.length);
    if (upperCaseRatio > 0.5) score += 0.1;

    return Math.min(1.0, score);
  }

  /**
   * Detect misleading information
   */
  private detectMisleadingInfo(text: string): number {
    let score = 0;
    const misleadingPatterns =
      AdvancedSpamDetectionService.SUSPICIOUS_PATTERNS.MISLEADING;

    for (const pattern of misleadingPatterns) {
      if (text.includes(pattern.toLowerCase())) {
        score += 0.15;
      }
    }

    return Math.min(1.0, score);
  }

  /**
   * Detect fake urgency
   */
  private detectFakeUrgency(text: string): number {
    let score = 0;
    const urgencyPatterns =
      AdvancedSpamDetectionService.SUSPICIOUS_PATTERNS.FAKE_URGENCY;

    for (const pattern of urgencyPatterns) {
      if (text.includes(pattern.toLowerCase())) {
        score += 0.2;
      }
    }

    return Math.min(1.0, score);
  }

  /**
   * Detect phishing attempts
   */
  private detectPhishingAttempt(text: string): number {
    let score = 0;
    const phishingPatterns =
      AdvancedSpamDetectionService.SUSPICIOUS_PATTERNS.PHISHING;

    for (const pattern of phishingPatterns) {
      if (text.includes(pattern.toLowerCase())) {
        score += 0.3; // Higher weight for phishing
      }
    }

    // Check for suspicious URLs or contact information
    const urlPattern = /https?:\/\/[^\s]+/g;
    const urls = text.match(urlPattern) || [];
    if (urls.length > 0) score += 0.2;

    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = text.match(emailPattern) || [];
    if (emails.length > 0) score += 0.2;

    return Math.min(1.0, score);
  }

  /**
   * Detect repetitive posting
   */
  private detectRepetitivePosting(
    recentWhispers: Whisper[],
    currentWhisper: Whisper
  ): number {
    if (recentWhispers.length < 3) return 0;

    const currentText = currentWhisper.transcription?.toLowerCase() || "";
    let similarCount = 0;

    for (const whisper of recentWhispers.slice(-5)) {
      const whisperText = whisper.transcription?.toLowerCase() || "";
      const similarity = this.calculateTextSimilarity(currentText, whisperText);
      if (similarity > 0.7) {
        similarCount++;
      }
    }

    return Math.min(1.0, similarCount / 5);
  }

  /**
   * Detect rapid posting
   */
  private detectRapidPosting(recentWhispers: Whisper[]): number {
    if (recentWhispers.length < 2) return 0;

    const now = new Date();
    let rapidPosts = 0;

    for (const whisper of recentWhispers.slice(-10)) {
      const timeDiff = now.getTime() - whisper.createdAt.getTime();
      const minutesDiff = timeDiff / (1000 * 60);

      // If posted within last 5 minutes
      if (minutesDiff < 5) {
        rapidPosts++;
      }
    }

    return Math.min(1.0, rapidPosts / 10);
  }

  /**
   * Detect similar content
   */
  private detectSimilarContent(
    recentWhispers: Whisper[],
    currentWhisper: Whisper
  ): number {
    if (recentWhispers.length === 0) return 0;

    const currentText = currentWhisper.transcription?.toLowerCase() || "";
    let maxSimilarity = 0;

    for (const whisper of recentWhispers.slice(-10)) {
      const whisperText = whisper.transcription?.toLowerCase() || "";
      const similarity = this.calculateTextSimilarity(currentText, whisperText);
      maxSimilarity = Math.max(maxSimilarity, similarity);
    }

    return maxSimilarity;
  }

  /**
   * Detect bot-like behavior
   */
  private detectBotLikeBehavior(recentWhispers: Whisper[]): number {
    if (recentWhispers.length < 5) return 0;

    let botScore = 0;

    // Check for consistent posting times (too regular)
    const postingTimes = recentWhispers.map((w) => w.createdAt.getHours());
    const timeVariance = this.calculateVariance(postingTimes);
    if (timeVariance < 2) botScore += 0.3; // Very regular posting times

    // Check for consistent content length
    const contentLengths = recentWhispers.map(
      (w) => w.transcription?.length || 0
    );
    const lengthVariance = this.calculateVariance(contentLengths);
    if (lengthVariance < 10) botScore += 0.2; // Very consistent content length

    // Check for lack of engagement variation
    const engagementRates = recentWhispers.map(
      (w) => (w.likes + w.replies) / Math.max(1, w.duration)
    );
    const engagementVariance = this.calculateVariance(engagementRates);
    if (engagementVariance < 0.1) botScore += 0.2; // Very consistent engagement

    return Math.min(1.0, botScore);
  }

  /**
   * Detect engagement farming
   */
  private detectEngagementFarming(recentWhispers: Whisper[]): number {
    if (recentWhispers.length < 3) return 0;

    let farmingScore = 0;

    // Check for questions that seem designed to get responses
    const questionCount = recentWhispers.filter(
      (w) =>
        w.transcription?.includes("?") ||
        w.transcription?.toLowerCase().includes("what do you think") ||
        w.transcription?.toLowerCase().includes("agree or disagree")
    ).length;

    if (questionCount > recentWhispers.length * 0.7) {
      farmingScore += 0.4;
    }

    // Check for controversial topics
    const controversialTopics = [
      "politics",
      "religion",
      "abortion",
      "vaccines",
      "climate change",
    ];
    const controversialCount = recentWhispers.filter((w) =>
      controversialTopics.some((topic) =>
        w.transcription?.toLowerCase().includes(topic)
      )
    ).length;

    if (controversialCount > recentWhispers.length * 0.5) {
      farmingScore += 0.3;
    }

    return Math.min(1.0, farmingScore);
  }

  /**
   * Analyze timing patterns
   */
  private analyzeTimingPatterns(recentWhispers: Whisper[]): UserBehaviorFlag[] {
    const flags: UserBehaviorFlag[] = [];

    if (recentWhispers.length < 3) return flags;

    const now = new Date();
    const recentWhispers24h = recentWhispers.filter(
      (w) => now.getTime() - w.createdAt.getTime() < 24 * 60 * 60 * 1000
    );

    // Check for suspicious posting frequency
    if (recentWhispers24h.length > 20) {
      flags.push({
        type: "suspicious_timing",
        severity: "high",
        confidence: 0.8,
        description: "Excessive posting frequency (20+ posts in 24h)",
        evidence: { posts24h: recentWhispers24h.length },
      });
    }

    // Check for posting at unusual hours
    const nightPosts = recentWhispers24h.filter((w) => {
      const hour = w.createdAt.getHours();
      return hour >= 2 && hour <= 6;
    }).length;

    if (nightPosts > recentWhispers24h.length * 0.7) {
      flags.push({
        type: "suspicious_timing",
        severity: "medium",
        confidence: 0.6,
        description: "High percentage of posts during unusual hours",
        evidence: { nightPosts, totalPosts: recentWhispers24h.length },
      });
    }

    return flags;
  }

  /**
   * Analyze geographic patterns (placeholder for future implementation)
   */
  private analyzeGeographicPatterns(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    recentWhispers: Whisper[]
  ): UserBehaviorFlag[] {
    // This would analyze location data if available
    // For now, return empty array
    return [];
  }

  /**
   * Analyze device patterns (placeholder for future implementation)
   */
  private analyzeDevicePatterns(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    recentWhispers: Whisper[]
  ): UserBehaviorFlag[] {
    // This would analyze device fingerprinting if available
    // For now, return empty array
    return [];
  }

  /**
   * Calculate text similarity using simple Jaccard similarity
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.split(/\s+/));
    const words2 = new Set(text2.split(/\s+/));

    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Calculate variance of an array of numbers
   */
  private calculateVariance(numbers: number[]): number {
    if (numbers.length === 0) return 0;

    const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
    const squaredDiffs = numbers.map((n) => Math.pow(n - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / numbers.length;

    return variance;
  }

  /**
   * Calculate spam score
   */
  private calculateSpamScore(
    contentFlags: ContentFlag[],
    behavioralFlags: BehavioralFlag[],
    userBehaviorFlags: UserBehaviorFlag[]
  ): number {
    let score = 0;

    // Weight content flags
    for (const flag of contentFlags) {
      const weight =
        AdvancedSpamDetectionService.CONTENT_WEIGHTS[flag.type] || 0.1;
      score += flag.confidence * weight;
    }

    // Weight behavioral flags
    for (const flag of behavioralFlags) {
      const weight =
        AdvancedSpamDetectionService.BEHAVIORAL_WEIGHTS[flag.type] || 0.1;
      score += flag.confidence * weight;
    }

    // Weight user behavior flags
    for (const flag of userBehaviorFlags) {
      const weight =
        AdvancedSpamDetectionService.USER_BEHAVIOR_WEIGHTS[flag.type] || 0.1;
      score += flag.confidence * weight;
    }

    return Math.min(1.0, score);
  }

  /**
   * Calculate scam score
   */
  private calculateScamScore(
    contentFlags: ContentFlag[],
    behavioralFlags: BehavioralFlag[],
    userBehaviorFlags: UserBehaviorFlag[]
  ): number {
    let score = 0;

    // Scam detection focuses more on content patterns
    for (const flag of contentFlags) {
      if (
        flag.type === "phishing_attempt" ||
        flag.type === "suspicious_patterns"
      ) {
        score += flag.confidence * 0.4; // Higher weight for scam indicators
      } else {
        score += flag.confidence * 0.2;
      }
    }

    // User behavior also important for scams
    for (const flag of userBehaviorFlags) {
      if (flag.type === "new_account" || flag.type === "low_reputation") {
        score += flag.confidence * 0.3;
      } else {
        score += flag.confidence * 0.1;
      }
    }

    return Math.min(1.0, score);
  }

  /**
   * Determine suggested action based on scores and user reputation
   */
  private determineSuggestedAction(
    spamScore: number,
    scamScore: number,
    userReputation: UserReputation
  ): "warn" | "flag" | "reject" | "ban" {
    const maxScore = Math.max(spamScore, scamScore);

    // Critical scores always result in rejection/ban
    if (
      maxScore > AdvancedSpamDetectionService.SPAM_THRESHOLDS.CRITICAL ||
      scamScore > AdvancedSpamDetectionService.SCAM_THRESHOLDS.CRITICAL
    ) {
      return userReputation.level === "trusted" ? "reject" : "ban";
    }

    // High scores
    if (
      maxScore > AdvancedSpamDetectionService.SPAM_THRESHOLDS.HIGH ||
      scamScore > AdvancedSpamDetectionService.SCAM_THRESHOLDS.HIGH
    ) {
      return userReputation.level === "trusted" ? "flag" : "reject";
    }

    // Medium scores
    if (
      maxScore > AdvancedSpamDetectionService.SPAM_THRESHOLDS.MEDIUM ||
      scamScore > AdvancedSpamDetectionService.SCAM_THRESHOLDS.MEDIUM
    ) {
      return userReputation.level === "trusted" ? "warn" : "flag";
    }

    // Low scores
    return "warn";
  }

  /**
   * Generate reason for the action
   */
  private generateReason(
    contentFlags: ContentFlag[],
    behavioralFlags: BehavioralFlag[],
    userBehaviorFlags: UserBehaviorFlag[],
    isSpam: boolean,
    isScam: boolean
  ): string {
    const reasons: string[] = [];

    if (isScam) {
      const scamFlags = contentFlags.filter(
        (f) => f.type === "phishing_attempt" || f.type === "suspicious_patterns"
      );
      if (scamFlags.length > 0) {
        reasons.push("Potential scam detected");
      }
    }

    if (isSpam) {
      const spamFlags = behavioralFlags.filter(
        (f) => f.type === "repetitive_posting" || f.type === "rapid_posting"
      );
      if (spamFlags.length > 0) {
        reasons.push("Spam behavior detected");
      }
    }

    if (userBehaviorFlags.some((f) => f.type === "new_account")) {
      reasons.push("New account behavior");
    }

    if (userBehaviorFlags.some((f) => f.type === "low_reputation")) {
      reasons.push("Low reputation user");
    }

    return reasons.length > 0
      ? reasons.join(", ")
      : "Suspicious content patterns detected";
  }

  /**
   * Convert analysis result to violations
   */
  static convertToViolations(result: SpamAnalysisResult): Violation[] {
    const violations: Violation[] = [];

    if (result.isScam) {
      violations.push({
        type: ViolationType.SCAM,
        severity:
          result.scamScore > 0.8
            ? "critical"
            : result.scamScore > 0.6
            ? "high"
            : "medium",
        confidence: result.scamScore,
        description: result.reason,
        suggestedAction: result.suggestedAction,
      });
    }

    if (result.isSpam) {
      violations.push({
        type: ViolationType.SPAM,
        severity:
          result.spamScore > 0.8
            ? "high"
            : result.spamScore > 0.6
            ? "medium"
            : "low",
        confidence: result.spamScore,
        description: result.reason,
        suggestedAction: result.suggestedAction,
      });
    }

    return violations;
  }
}

// Export singleton instance
export const getAdvancedSpamDetectionService = () =>
  AdvancedSpamDetectionService.getInstance();
