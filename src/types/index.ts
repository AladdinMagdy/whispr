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
  resolution?: "warned" | "flagged" | "rejected" | "banned" | "appealed";
  moderatorId?: string;
  notes?: string;
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
}
