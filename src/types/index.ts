// Core app types
export interface User {
  id: string;
  anonymousId: string;
  createdAt: Date;
  lastActive: Date;
  // Age verification and content moderation fields
  age: number; // Required - must be 13+
  isMinor: boolean; // Computed from age (under 18)
  ageVerificationStatus: "unverified" | "verified" | "pending";
  contentPreferences?: {
    allowAdultContent: boolean;
    strictFiltering: boolean;
  };
  reputation?: UserReputation;
}

export interface Whisper {
  id: string;
  userId: string;
  userDisplayName: string;
  userProfileColor: string;
  audioUrl: string;
  duration: number;
  whisperPercentage: number;
  averageLevel: number;
  confidence: number;
  likes: number;
  replies: number;
  createdAt: Date;
  transcription?: string;
  isTranscribed: boolean;
  // Content moderation fields
  moderationResult?: ModerationResult;
}

// New types for comments/interactions
export interface Comment {
  id: string;
  whisperId: string;
  userId: string;
  userDisplayName: string;
  userProfileColor: string;
  text: string;
  likes: number;
  createdAt: Date;
  isEdited: boolean;
  editedAt?: Date;
}

export interface Like {
  id: string;
  whisperId: string;
  userId: string;
  userDisplayName: string;
  userProfileColor: string;
  createdAt: Date;
}

export interface CommentLike {
  id: string;
  commentId: string;
  userId: string;
  userDisplayName?: string;
  userProfileColor?: string;
  createdAt: Date;
}

export interface WhisperInteractions {
  isLiked: boolean;
  likeCount: number;
  commentCount: number;
  comments: Comment[];
}

export interface AudioRecording {
  uri: string;
  duration: number;
  volume: number;
  isWhisper: boolean;
  timestamp: Date;
}

// Navigation types
export type RootStackParamList = {
  Home: undefined;
  Record: undefined;
  Feed: undefined;
  Profile: undefined;
  WhisperDetail: { whisperId: string };
};

// Firebase types
export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

// Audio processing types
export interface VolumeThreshold {
  WHISPER_MIN: number;
  WHISPER_MAX: number;
  NORMAL_MIN: number;
  NORMAL_MAX: number;
  SILENCE_THRESHOLD: number;
}

export interface AudioValidationResult {
  isValid: boolean;
  isWhisper: boolean;
  volume: number;
  duration: number;
  error?: string;
}

// API response types
export interface TranscriptionResponse {
  text: string;
  confidence: number;
  language: string;
}

export interface UploadResponse {
  success: boolean;
  url?: string;
  error?: string;
}

// Component prop types
export interface AudioRecorderProps {
  onRecordingComplete: (recording: AudioRecording) => void;
  onRecordingStart?: () => void;
  onRecordingStop?: () => void;
  maxDuration?: number;
  volumeThreshold?: VolumeThreshold;
}

export interface WhisperCardProps {
  whisper: Whisper;
  onPress?: () => void;
  onLike?: () => void;
  onReply?: () => void;
}

// Store types (for Zustand)
export interface AppState {
  user: User | null;
  whispers: Whisper[];
  isLoading: boolean;
  error: string | null;
  currentRecording: AudioRecording | null;
}

export interface AppActions {
  setUser: (user: User | null) => void;
  addWhisper: (whisper: Whisper) => void;
  setWhispers: (whispers: Whisper[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setCurrentRecording: (recording: AudioRecording | null) => void;
  likeWhisper: (whisperId: string) => void;
}

// Content Moderation Types
export enum ContentRank {
  G = "G", // General - Safe for all ages
  PG = "PG", // Parental Guidance - Mild content
  PG13 = "PG13", // Teens and up - Moderate content
  R = "R", // Restricted - Adult content
  NC17 = "NC17", // Explicit - Not for minors
}

export enum ModerationStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
  FLAGGED = "flagged",
  UNDER_REVIEW = "under_review",
}

export enum ViolationType {
  HARASSMENT = "harassment",
  HATE_SPEECH = "hate_speech",
  VIOLENCE = "violence",
  SEXUAL_CONTENT = "sexual_content",
  DRUGS = "drugs",
  SPAM = "spam",
  SCAM = "scam",
  COPYRIGHT = "copyright",
  PERSONAL_INFO = "personal_info",
  MINOR_SAFETY = "minor_safety",
}

export interface ModerationResult {
  status: ModerationStatus;
  contentRank: ContentRank;
  isMinorSafe: boolean;
  violations: Violation[];
  confidence: number;
  moderationTime: number;
  apiResults: {
    openai?: OpenAIModerationResult | null;
    perspective?: PerspectiveAPIResult | null;
    azure?: AzureModerationResult | null;
    local?: LocalModerationResult | null;
  };
  reputationImpact: number;
  appealable: boolean;
  reason?: string;
  // Properties added by reputation service
  appealTimeLimit?: number;
  penaltyMultiplier?: number;
  autoAppealThreshold?: number;
}

export interface Violation {
  type: ViolationType;
  severity: "low" | "medium" | "high" | "critical";
  confidence: number;
  description: string;
  startIndex?: number;
  endIndex?: number;
  suggestedAction: "warn" | "flag" | "reject" | "ban";
}

export interface UserReputation {
  userId: string;
  score: number; // 0-100 (100 = perfect, 0 = banned)
  level: "trusted" | "verified" | "standard" | "flagged" | "banned";
  totalWhispers: number;
  approvedWhispers: number;
  flaggedWhispers: number;
  rejectedWhispers: number;
  lastViolation?: Date;
  violationHistory: ViolationRecord[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ViolationRecord {
  id: string;
  whisperId: string;
  violationType: ViolationType;
  severity: "low" | "medium" | "high" | "critical";
  timestamp: Date;
  resolved: boolean;
  notes?: string;
  resolution?: "warned" | "flagged" | "rejected" | "banned" | "appealed";
}

// API-specific moderation results
export interface OpenAIModerationResult {
  flagged: boolean;
  categories: {
    harassment: boolean;
    harassment_threatening: boolean;
    hate: boolean;
    hate_threatening: boolean;
    self_harm: boolean;
    self_harm_instructions: boolean;
    self_harm_intent: boolean;
    sexual: boolean;
    sexual_minors: boolean;
    violence: boolean;
    violence_graphic: boolean;
  };
  categoryScores: {
    harassment: number;
    harassment_threatening: number;
    hate: number;
    hate_threatening: number;
    self_harm: number;
    self_harm_instructions: number;
    self_harm_intent: number;
    sexual: number;
    sexual_minors: number;
    violence: number;
    violence_graphic: number;
  };
}

export interface PerspectiveAPIResult {
  toxicity: number;
  severeToxicity: number;
  identityAttack: number;
  insult: number;
  profanity: number;
  threat: number;
  sexuallyExplicit: number;
  flirtation: number;
  attackOnAuthor: number;
  attackOnCommenter: number;
  incoherent: number;
  inflammatory: number;
  likelyToReject: number;
  obscene: number;
  spam: number;
  unsubstantial: number;
}

export interface AzureModerationResult {
  classification: {
    reviewRecommended: boolean;
    category1: { score: number }; // Sexual content
    category2: { score: number }; // Violence
    category3: { score: number }; // Hate speech
  };
  language: string;
  terms: Array<{
    index: number;
    originalIndex: number;
    listId: number;
    term: string;
  }>;
  status: {
    code: number;
    description: string;
    exception: string;
  };
}

export interface LocalModerationResult {
  flagged: boolean;
  matchedKeywords: string[];
  toxicityScore: number;
  spamScore: number;
  personalInfoDetected: boolean;
}

// Real-time moderation types
export interface RealTimeModerationResult {
  isViolation: boolean;
  violationType?: ViolationType;
  severity?: "low" | "medium" | "high" | "critical";
  confidence: number;
  suggestedAction: "continue" | "warn" | "stop";
  reason?: string;
}

export interface AudioViolation {
  type:
    | "volume_spike"
    | "multiple_voices"
    | "background_noise"
    | "non_whisper_speech";
  severity: "low" | "medium" | "high";
  timestamp: number;
  description: string;
  suggestedAction: "warn" | "stop_recording";
}

// Feature flags for moderation
export interface ModerationFeatureFlags {
  ENABLE_GOOGLE_PERSPECTIVE: boolean;
  ENABLE_AZURE_MODERATION: boolean;
  ENABLE_MULTI_API_MODERATION: boolean;
  ENABLE_AGE_PROTECTION: boolean;
  ENABLE_REAL_TIME_MODERATION: boolean;
  ENABLE_REPUTATION_SYSTEM: boolean;
  ENABLE_REPORTING_SYSTEM: boolean;
  ENABLE_ADVANCED_SPAM_DETECTION: boolean;
}

// Reporting System Types
export enum ReportCategory {
  HARASSMENT = "harassment",
  HATE_SPEECH = "hate_speech",
  VIOLENCE = "violence",
  SEXUAL_CONTENT = "sexual_content",
  SPAM = "spam",
  SCAM = "scam",
  COPYRIGHT = "copyright",
  PERSONAL_INFO = "personal_info",
  MINOR_SAFETY = "minor_safety",
  OTHER = "other",
}

export enum ReportStatus {
  PENDING = "pending",
  UNDER_REVIEW = "under_review",
  RESOLVED = "resolved",
  DISMISSED = "dismissed",
  ESCALATED = "escalated",
}

export enum ReportPriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

export interface Report {
  id: string;
  whisperId: string;
  commentId?: string; // Optional - for comment reports
  reporterId: string;
  reporterDisplayName: string;
  reporterReputation: number; // Reputation score of reporter
  category: ReportCategory;
  priority: ReportPriority;
  status: ReportStatus;
  reason: string;
  evidence?: string; // Additional context or screenshots
  createdAt: Date;
  updatedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string; // Admin ID who reviewed
  resolution?: ReportResolution;
  reputationWeight: number; // Calculated weight based on reporter's reputation
}

export interface ReportResolution {
  action: "warn" | "flag" | "reject" | "ban" | "dismiss";
  reason: string;
  moderatorId: string;
  timestamp: Date;
  notes?: string;
}

export interface ReportStats {
  totalReports: number;
  pendingReports: number;
  criticalReports: number;
  resolvedReports: number;
  averageResolutionTime: number; // in hours
  reportsByCategory: Record<ReportCategory, number>;
  reportsByPriority: Record<ReportPriority, number>;
}

export interface ReportFilters {
  status?: ReportStatus;
  category?: ReportCategory;
  priority?: ReportPriority;
  dateRange?: {
    start: Date;
    end: Date;
  };
  reporterId?: string;
  whisperId?: string;
}

// New types for appeal system
export interface Appeal {
  id: string;
  userId: string;
  whisperId: string;
  violationId: string;
  reason: string;
  evidence?: string;
  status: AppealStatus;
  submittedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  resolution?: AppealResolution;
  resolutionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

// User violation tracking for escalation
export interface UserViolation {
  id: string;
  userId: string;
  whisperId: string;
  violationType:
    | "whisper_deleted"
    | "whisper_flagged"
    | "temporary_ban"
    | "extended_ban";
  reason: string;
  reportCount?: number; // Number of reports that triggered this violation
  moderatorId?: string; // "system" for automatic, actual ID for manual
  createdAt: Date;
  expiresAt?: Date; // For violations that expire (like temporary bans)
}

export enum AppealStatus {
  PENDING = "pending",
  UNDER_REVIEW = "under_review",
  APPROVED = "approved",
  REJECTED = "rejected",
  EXPIRED = "expired",
}

export interface AppealResolution {
  action: "approve" | "reject" | "partial_approve";
  reason: string;
  moderatorId: string;
  reputationAdjustment: number;
}

// New types for suspension management
export enum SuspensionType {
  WARNING = "warning",
  TEMPORARY = "temporary",
  PERMANENT = "permanent",
}

export enum BanType {
  NONE = "none",
  CONTENT_HIDDEN = "content_hidden", // Content becomes invisible to all users
  CONTENT_VISIBLE = "content_visible", // Content stays visible but user can't post
  SHADOW_BAN = "shadow_ban", // Content appears normal to user but hidden from others
}

export interface Suspension {
  id: string;
  userId: string;
  type: SuspensionType;
  banType?: BanType; // Optional for backward compatibility
  reason: string;
  moderatorId: string;
  startDate: Date;
  endDate?: Date; // Only for temporary suspensions
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserMute {
  id: string;
  userId: string; // The user who is doing the muting
  mutedUserId: string; // The user being muted
  mutedUserDisplayName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserRestriction {
  id: string;
  userId: string; // The user who is doing the restricting
  restrictedUserId: string; // The user being restricted
  restrictedUserDisplayName: string;
  type: "interaction" | "visibility" | "full";
  createdAt: Date;
  updatedAt: Date;
}

export interface UserBlock {
  id: string;
  userId: string; // The user who is doing the blocking
  blockedUserId: string; // The user being blocked
  blockedUserDisplayName: string;
  createdAt: Date;
  updatedAt: Date;
}

// New types for comment reporting
export interface CommentReport {
  id: string;
  commentId: string;
  whisperId: string;
  reporterId: string;
  reporterDisplayName: string;
  reporterReputation: number;
  category: ReportCategory;
  priority: ReportPriority;
  status: ReportStatus;
  reason: string;
  evidence?: string;
  createdAt: Date;
  updatedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  resolution?: CommentReportResolution;
  reputationWeight: number;
}

export interface CommentReportResolution {
  action: "hide" | "delete" | "dismiss";
  reason: string;
  moderatorId: string;
  timestamp: Date;
  notes?: string;
}
