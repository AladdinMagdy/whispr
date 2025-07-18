/**
 * Spam Detection Utilities for Whispr
 * Utility functions for advanced spam and scam detection
 */

import { ViolationType, Violation, UserReputation, Whisper } from "../types";

// Types
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

// Constants
export const SPAM_THRESHOLDS = {
  LOW: 0.3,
  MEDIUM: 0.5,
  HIGH: 0.7,
  CRITICAL: 0.9,
} as const;

export const SCAM_THRESHOLDS = {
  LOW: 0.4,
  MEDIUM: 0.6,
  HIGH: 0.8,
  CRITICAL: 0.95,
} as const;

export const BEHAVIORAL_WEIGHTS = {
  repetitive_posting: 0.3,
  rapid_posting: 0.25,
  similar_content: 0.2,
  bot_like_behavior: 0.15,
  engagement_farming: 0.1,
} as const;

export const CONTENT_WEIGHTS = {
  suspicious_patterns: 0.25,
  clickbait: 0.2,
  misleading_info: 0.2,
  fake_urgency: 0.15,
  phishing_attempt: 0.2,
} as const;

export const USER_BEHAVIOR_WEIGHTS = {
  new_account: 0.2,
  low_reputation: 0.3,
  suspicious_timing: 0.2,
  geographic_anomaly: 0.15,
  device_pattern: 0.15,
} as const;

export const SUSPICIOUS_PATTERNS = {
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
} as const;

/**
 * Detect suspicious patterns in text
 */
export function detectSuspiciousPatterns(text: string): string[] {
  const lowerText = text.toLowerCase();
  const detectedPatterns: string[] = [];

  // Check all pattern categories
  Object.entries(SUSPICIOUS_PATTERNS).forEach(([category, patterns]) => {
    patterns.forEach((pattern) => {
      if (lowerText.includes(pattern.toLowerCase())) {
        detectedPatterns.push(`${category}: ${pattern}`);
      }
    });
  });

  return detectedPatterns;
}

/**
 * Detect clickbait patterns in text
 */
export function detectClickbait(text: string): number {
  const lowerText = text.toLowerCase();
  let clickbaitScore = 0;

  SUSPICIOUS_PATTERNS.CLICKBAIT.forEach((pattern) => {
    if (lowerText.includes(pattern.toLowerCase())) {
      clickbaitScore += 0.3;
    }
  });

  // Additional clickbait indicators
  if (lowerText.includes("!")) {
    clickbaitScore += 0.1;
  }
  if (lowerText.includes("??")) {
    clickbaitScore += 0.1;
  }
  if (lowerText.includes("shocking") || lowerText.includes("amazing")) {
    clickbaitScore += 0.2;
  }

  return Math.min(clickbaitScore, 1.0);
}

/**
 * Detect misleading information in text
 */
export function detectMisleadingInfo(text: string): number {
  const lowerText = text.toLowerCase();
  let misleadingScore = 0;

  SUSPICIOUS_PATTERNS.MISLEADING.forEach((pattern) => {
    if (lowerText.includes(pattern.toLowerCase())) {
      misleadingScore += 0.4;
    }
  });

  // Additional misleading indicators
  if (lowerText.includes("100%")) {
    misleadingScore += 0.3;
  }
  if (lowerText.includes("guaranteed")) {
    misleadingScore += 0.2;
  }

  return Math.min(misleadingScore, 1.0);
}

/**
 * Detect fake urgency in text
 */
export function detectFakeUrgency(text: string): number {
  const lowerText = text.toLowerCase();
  let urgencyScore = 0;

  SUSPICIOUS_PATTERNS.FAKE_URGENCY.forEach((pattern) => {
    if (lowerText.includes(pattern.toLowerCase())) {
      urgencyScore += 0.3;
    }
  });

  // Additional urgency indicators
  if (lowerText.includes("now")) {
    urgencyScore += 0.1;
  }
  if (lowerText.includes("urgent")) {
    urgencyScore += 0.2;
  }

  return Math.min(urgencyScore, 1.0);
}

/**
 * Detect phishing attempts in text
 */
export function detectPhishingAttempt(text: string): number {
  const lowerText = text.toLowerCase();
  let phishingScore = 0;

  SUSPICIOUS_PATTERNS.PHISHING.forEach((pattern) => {
    if (lowerText.includes(pattern.toLowerCase())) {
      phishingScore += 0.4;
    }
  });

  // Additional phishing indicators
  if (lowerText.includes("verify") || lowerText.includes("confirm")) {
    phishingScore += 0.2;
  }
  if (lowerText.includes("account") && lowerText.includes("suspended")) {
    phishingScore += 0.3;
  }
  if (lowerText.includes("security") && lowerText.includes("check")) {
    phishingScore += 0.3;
  }

  return Math.min(phishingScore, 1.0);
}

/**
 * Calculate text similarity between two strings
 */
export function calculateTextSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;
  if (text1 === text2) return 1.0;

  const words1 = text1.toLowerCase().split(/\s+/);
  const words2 = text2.toLowerCase().split(/\s+/);
  const commonWords = words1.filter((word) => words2.includes(word));

  return commonWords.length / Math.max(words1.length, words2.length);
}

/**
 * Calculate variance of a number array
 */
export function calculateVariance(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  if (numbers.length === 1) return 0;

  const mean = numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
  const squaredDifferences = numbers.map((num) => Math.pow(num - mean, 2));
  const variance =
    squaredDifferences.reduce((sum, diff) => sum + diff, 0) / numbers.length;

  return variance;
}

/**
 * Detect repetitive posting behavior
 */
export function detectRepetitivePosting(
  recentWhispers: Whisper[],
  currentWhisper: Whisper
): number {
  if (recentWhispers.length === 0) return 0;

  let repetitiveScore = 0;
  const currentText = currentWhisper.transcription?.toLowerCase() || "";

  recentWhispers.forEach((whisper) => {
    const whisperText = whisper.transcription?.toLowerCase() || "";
    const similarity = calculateTextSimilarity(currentText, whisperText);
    if (similarity > 0.8) {
      repetitiveScore += 0.3;
    } else if (similarity > 0.6) {
      repetitiveScore += 0.2;
    }
  });

  return Math.min(repetitiveScore, 1.0);
}

/**
 * Detect rapid posting behavior
 */
export function detectRapidPosting(recentWhispers: Whisper[]): number {
  if (recentWhispers.length < 2) return 0;

  const timestamps = recentWhispers
    .map((w) => w.createdAt?.getTime() || 0)
    .sort((a, b) => b - a); // Sort descending

  const intervals: number[] = [];
  for (let i = 0; i < timestamps.length - 1; i++) {
    intervals.push(timestamps[i] - timestamps[i + 1]);
  }

  const avgInterval =
    intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
  const variance = calculateVariance(intervals);

  // Rapid posting: low average interval and low variance (consistent timing)
  if (avgInterval < 5 * 60 * 1000 && variance < 1000000) {
    return 0.8;
  } else if (avgInterval < 10 * 60 * 1000) {
    return 0.5;
  }

  return 0;
}

/**
 * Detect similar content patterns
 */
export function detectSimilarContent(
  recentWhispers: Whisper[],
  currentWhisper: Whisper
): number {
  if (recentWhispers.length === 0) return 0;

  let similarContentScore = 0;
  const currentText = currentWhisper.transcription?.toLowerCase() || "";

  recentWhispers.forEach((whisper) => {
    const whisperText = whisper.transcription?.toLowerCase() || "";
    const similarity = calculateTextSimilarity(currentText, whisperText);
    if (similarity > 0.7) {
      similarContentScore += 0.2;
    }
  });

  return Math.min(similarContentScore, 1.0);
}

/**
 * Detect bot-like behavior patterns
 */
export function detectBotLikeBehavior(recentWhispers: Whisper[]): number {
  if (recentWhispers.length < 3) return 0;

  const timestamps = recentWhispers
    .map((w) => w.createdAt?.getTime() || 0)
    .sort((a, b) => a - b);

  const intervals: number[] = [];
  for (let i = 1; i < timestamps.length; i++) {
    intervals.push(timestamps[i] - timestamps[i - 1]);
  }

  const avgInterval =
    intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
  const variance = calculateVariance(intervals);

  // Bot-like behavior: very consistent timing with low variance
  if (variance < 100000 && avgInterval < 30 * 60 * 1000) {
    return 0.9;
  } else if (variance < 1000000 && avgInterval < 60 * 60 * 1000) {
    return 0.6;
  }

  return 0;
}

/**
 * Detect engagement farming behavior
 */
export function detectEngagementFarming(recentWhispers: Whisper[]): number {
  if (recentWhispers.length === 0) return 0;

  let engagementFarmingScore = 0;

  recentWhispers.forEach((whisper) => {
    const text = whisper.transcription?.toLowerCase() || "";

    // Engagement farming indicators
    if (text.includes("like") && text.includes("comment")) {
      engagementFarmingScore += 0.3;
    }
    if (text.includes("share") && text.includes("follow")) {
      engagementFarmingScore += 0.3;
    }
    if (text.includes("tag") && text.includes("friend")) {
      engagementFarmingScore += 0.2;
    }
    if (text.includes("vote") || text.includes("poll")) {
      engagementFarmingScore += 0.2;
    }
    if (text.includes("challenge") || text.includes("trending")) {
      engagementFarmingScore += 0.2;
    }
  });

  return Math.min(engagementFarmingScore, 1.0);
}

/**
 * Calculate spam score from flags
 */
export function calculateSpamScore(
  contentFlags: ContentFlag[],
  behavioralFlags: BehavioralFlag[],
  userBehaviorFlags: UserBehaviorFlag[]
): number {
  let totalScore = 0;
  let totalWeight = 0;

  // Content flags
  contentFlags.forEach((flag) => {
    const weight =
      CONTENT_WEIGHTS[flag.type as keyof typeof CONTENT_WEIGHTS] || 0.1;
    totalScore += flag.confidence * weight;
    totalWeight += weight;
  });

  // Behavioral flags
  behavioralFlags.forEach((flag) => {
    const weight =
      BEHAVIORAL_WEIGHTS[flag.type as keyof typeof BEHAVIORAL_WEIGHTS] || 0.1;
    totalScore += flag.confidence * weight;
    totalWeight += weight;
  });

  // User behavior flags
  userBehaviorFlags.forEach((flag) => {
    const weight =
      USER_BEHAVIOR_WEIGHTS[flag.type as keyof typeof USER_BEHAVIOR_WEIGHTS] ||
      0.1;
    totalScore += flag.confidence * weight;
    totalWeight += weight;
  });

  return totalWeight > 0 ? totalScore / totalWeight : 0;
}

/**
 * Calculate scam score from flags
 */
export function calculateScamScore(
  contentFlags: ContentFlag[],
  behavioralFlags: BehavioralFlag[],
  userBehaviorFlags: UserBehaviorFlag[]
): number {
  let totalScore = 0;
  let totalWeight = 0;

  // Content flags (scam detection focuses more on content)
  contentFlags.forEach((flag) => {
    let weight =
      CONTENT_WEIGHTS[flag.type as keyof typeof CONTENT_WEIGHTS] || 0.1;

    // Increase weight for scam-related content flags
    if (
      flag.type === "phishing_attempt" ||
      flag.type === "suspicious_patterns"
    ) {
      weight *= 1.5;
    }

    totalScore += flag.confidence * weight;
    totalWeight += weight;
  });

  // Behavioral flags (reduced weight for scams)
  behavioralFlags.forEach((flag) => {
    const weight =
      (BEHAVIORAL_WEIGHTS[flag.type as keyof typeof BEHAVIORAL_WEIGHTS] ||
        0.1) * 0.5;
    totalScore += flag.confidence * weight;
    totalWeight += weight;
  });

  // User behavior flags
  userBehaviorFlags.forEach((flag) => {
    const weight =
      USER_BEHAVIOR_WEIGHTS[flag.type as keyof typeof USER_BEHAVIOR_WEIGHTS] ||
      0.1;
    totalScore += flag.confidence * weight;
    totalWeight += weight;
  });

  return totalWeight > 0 ? totalScore / totalWeight : 0;
}

/**
 * Determine suggested action based on scores and user reputation
 */
export function determineSuggestedAction(
  spamScore: number,
  scamScore: number,
  userReputation: UserReputation
): "warn" | "flag" | "reject" | "ban" {
  const maxScore = Math.max(spamScore, scamScore);

  // Adjust thresholds based on user reputation
  let adjustedThresholds: Record<keyof typeof SPAM_THRESHOLDS, number> = {
    ...SPAM_THRESHOLDS,
  };
  if (userReputation.level === "trusted") {
    adjustedThresholds = {
      LOW: 0.4,
      MEDIUM: 0.6,
      HIGH: 0.8,
      CRITICAL: 0.95,
    };
  } else if (userReputation.level === "banned") {
    adjustedThresholds = {
      LOW: 0.2,
      MEDIUM: 0.4,
      HIGH: 0.6,
      CRITICAL: 0.8,
    };
  }

  if (scamScore >= adjustedThresholds.CRITICAL) {
    return userReputation.level === "trusted" ? "reject" : "ban";
  }
  if (spamScore >= adjustedThresholds.CRITICAL) {
    return userReputation.level === "trusted" ? "flag" : "reject";
  }
  if (scamScore >= adjustedThresholds.HIGH) {
    return userReputation.level === "trusted" ? "flag" : "reject";
  }
  if (spamScore >= adjustedThresholds.HIGH) {
    return "flag";
  }
  if (maxScore >= adjustedThresholds.MEDIUM) {
    return "warn";
  }

  return "warn";
}

/**
 * Generate reason for spam/scam detection
 */
export function generateReason(
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
      reasons.push(`Detected ${scamFlags.length} scam indicators`);
    } else {
      reasons.push("Suspicious scam-like patterns detected");
    }
  }

  if (isSpam) {
    const spamFlags = behavioralFlags.filter(
      (f) => f.type === "repetitive_posting" || f.type === "rapid_posting"
    );
    if (spamFlags.length > 0) {
      reasons.push(`Detected ${spamFlags.length} spam behavior indicators`);
    } else {
      reasons.push("Suspicious spam-like behavior detected");
    }
  }

  // Add user behavior reasons
  const newAccountFlags = userBehaviorFlags.filter(
    (f) => f.type === "new_account"
  );
  const lowRepFlags = userBehaviorFlags.filter(
    (f) => f.type === "low_reputation"
  );

  if (newAccountFlags.length > 0) {
    reasons.push("New account behavior detected");
  }
  if (lowRepFlags.length > 0) {
    reasons.push("Low reputation user behavior");
  }

  return reasons.length > 0
    ? reasons.join("; ")
    : "Suspicious content detected";
}

/**
 * Convert spam analysis result to violations
 */
export function convertToViolations(result: SpamAnalysisResult): Violation[] {
  const violations: Violation[] = [];

  if (result.isScam) {
    violations.push({
      type: ViolationType.SCAM,
      severity:
        result.confidence > 0.8
          ? "high"
          : result.confidence > 0.6
          ? "medium"
          : "low",
      confidence: result.confidence,
      description: result.reason,
      suggestedAction: result.suggestedAction,
    });
  }

  if (result.isSpam) {
    violations.push({
      type: ViolationType.SPAM,
      severity:
        result.confidence > 0.8
          ? "high"
          : result.confidence > 0.6
          ? "medium"
          : "low",
      confidence: result.confidence,
      description: result.reason,
      suggestedAction: result.suggestedAction,
    });
  }

  return violations;
}

/**
 * Analyze content patterns in transcription
 */
export function analyzeContentPatterns(transcription: string): ContentFlag[] {
  const flags: ContentFlag[] = [];

  if (!transcription || transcription.trim().length === 0) {
    return flags;
  }

  // Detect suspicious patterns
  const suspiciousPatterns = detectSuspiciousPatterns(transcription);
  if (suspiciousPatterns.length > 0) {
    flags.push({
      type: "suspicious_patterns",
      severity:
        suspiciousPatterns.length > 3
          ? "high"
          : suspiciousPatterns.length > 1
          ? "medium"
          : "low",
      confidence: Math.min(suspiciousPatterns.length * 0.3, 1.0),
      description: `Detected ${suspiciousPatterns.length} suspicious patterns`,
      evidence: { patterns: suspiciousPatterns },
    });
  }

  // Detect clickbait
  const clickbaitScore = detectClickbait(transcription);
  if (clickbaitScore > 0.3) {
    flags.push({
      type: "clickbait",
      severity:
        clickbaitScore > 0.7 ? "high" : clickbaitScore > 0.5 ? "medium" : "low",
      confidence: clickbaitScore,
      description: "Clickbait patterns detected",
      evidence: { score: clickbaitScore },
    });
  }

  // Detect misleading information
  const misleadingScore = detectMisleadingInfo(transcription);
  if (misleadingScore > 0.3) {
    flags.push({
      type: "misleading_info",
      severity:
        misleadingScore > 0.7
          ? "high"
          : misleadingScore > 0.5
          ? "medium"
          : "low",
      confidence: misleadingScore,
      description: "Misleading information detected",
      evidence: { score: misleadingScore },
    });
  }

  // Detect fake urgency
  const urgencyScore = detectFakeUrgency(transcription);
  if (urgencyScore > 0.3) {
    flags.push({
      type: "fake_urgency",
      severity:
        urgencyScore > 0.7 ? "high" : urgencyScore > 0.5 ? "medium" : "low",
      confidence: urgencyScore,
      description: "Fake urgency detected",
      evidence: { score: urgencyScore },
    });
  }

  // Detect phishing attempts
  const phishingScore = detectPhishingAttempt(transcription);
  if (phishingScore > 0.3) {
    flags.push({
      type: "phishing_attempt",
      severity:
        phishingScore > 0.7 ? "high" : phishingScore > 0.5 ? "medium" : "low",
      confidence: phishingScore,
      description: "Phishing attempt detected",
      evidence: { score: phishingScore },
    });
  }

  return flags;
}

/**
 * Analyze timing patterns for user behavior
 */
export function analyzeTimingPatterns(
  recentWhispers: Whisper[]
): UserBehaviorFlag[] {
  const flags: UserBehaviorFlag[] = [];

  if (recentWhispers.length < 2) return flags;

  const timestamps = recentWhispers
    .map((w) => w.createdAt?.getTime() || 0)
    .sort((a, b) => b - a);

  const intervals: number[] = [];
  for (let i = 0; i < timestamps.length - 1; i++) {
    intervals.push(timestamps[i] - timestamps[i + 1]);
  }

  const avgInterval =
    intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
  const variance = calculateVariance(intervals);

  // Suspicious timing: very regular intervals (bot-like)
  if (variance < 100000 && avgInterval < 30 * 60 * 1000) {
    flags.push({
      type: "suspicious_timing",
      severity: "high",
      confidence: 0.8,
      description: "Very regular posting intervals detected",
      evidence: { avgInterval, variance },
    });
  } else if (variance < 1000000 && avgInterval < 60 * 60 * 1000) {
    flags.push({
      type: "suspicious_timing",
      severity: "medium",
      confidence: 0.6,
      description: "Regular posting intervals detected",
      evidence: { avgInterval, variance },
    });
  }

  return flags;
}

/**
 * Analyze geographic patterns (placeholder)
 */
export function analyzeGeographicPatterns(): UserBehaviorFlag[] {
  // This would be implemented with actual geographic data
  // For now, return empty array
  return [];
}

/**
 * Analyze device patterns (placeholder)
 */
export function analyzeDevicePatterns(): UserBehaviorFlag[] {
  // This would be implemented with actual device data
  // For now, return empty array
  return [];
}
