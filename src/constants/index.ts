// Audio recording constants
export const AUDIO_CONSTANTS = {
  MAX_DURATION: 30, // seconds
  MIN_DURATION: 1, // seconds
  SAMPLE_RATE: 44100,
  CHANNELS: 1,
  BIT_RATE: 128000,
} as const;

// Volume threshold constants for whisper detection (legacy - use WHISPER_VALIDATION instead)
export const VOLUME_THRESHOLDS = {
  WHISPER_MIN: 0.1, // Minimum volume to be considered a whisper
  WHISPER_MAX: 0.4, // Maximum volume to be considered a whisper
  NORMAL_MIN: 0.4, // Minimum volume for normal speech
  NORMAL_MAX: 1.0, // Maximum volume for normal speech
  SILENCE_THRESHOLD: 0.05, // Below this is considered silence
} as const;

// Re-export whisper validation constants
export {
  WHISPER_VALIDATION,
  WHISPER_COLORS,
  WHISPER_ERROR_MESSAGES,
  WHISPER_SUCCESS_MESSAGES,
} from "./whisperValidation";

// Firebase collection names
export const FIRESTORE_COLLECTIONS = {
  USERS: "users",
  WHISPERS: "whispers",
  LIKES: "likes",
  REPLIES: "replies",
  REPORTS: "reports",
  APPEALS: "appeals",
  SUSPENSIONS: "suspensions",
  REPUTATION: "reputation",
} as const;

// Storage paths
export const STORAGE_PATHS = {
  AUDIO: "audio/whispers",
  AVATARS: "avatars",
} as const;

// UI constants
export const UI_CONSTANTS = {
  BORDER_RADIUS: 12,
  PADDING: 16,
  MARGIN: 8,
  ICON_SIZE: 24,
  BUTTON_HEIGHT: 48,
  CARD_ELEVATION: 2,
} as const;

// Animation constants
export const ANIMATION_CONSTANTS = {
  DURATION: 300,
  SPRING_CONFIG: {
    tension: 100,
    friction: 8,
  },
} as const;

// Error messages
export const ERROR_MESSAGES = {
  RECORDING_FAILED: "Failed to start recording. Please try again.",
  UPLOAD_FAILED: "Failed to upload whisper. Please try again.",
  PERMISSION_DENIED: "Microphone permission is required to record whispers.",
  NETWORK_ERROR: "Network error. Please check your connection.",
  INVALID_AUDIO: "Audio recording is too short or invalid.",
  NOT_A_WHISPER:
    "This doesn't sound like a whisper. Please speak more quietly.",
} as const;

// Success messages
export const SUCCESS_MESSAGES = {
  WHISPER_POSTED: "Your whisper has been posted!",
  RECORDING_SAVED: "Recording saved successfully.",
} as const;

// Feature flags
export const FEATURE_FLAGS = {
  ENABLE_TRANSCRIPTION: true,
  ENABLE_VOLUME_DETECTION: true,
  ENABLE_ANONYMOUS_AUTH: true,
  ENABLE_LIKES: true,
  ENABLE_REPLIES: true,
} as const;

// API endpoints
export const API_ENDPOINTS = {
  TRANSCRIPTION: "https://api.openai.com/v1/audio/transcriptions",
} as const;

// App metadata
export const APP_METADATA = {
  NAME: "Whispr",
  VERSION: "1.0.0",
  DESCRIPTION: "A minimalist audio-based social app for anonymous whispers",
  AUTHOR: "AladdinMagdy",
  EMAIL: "aladdin.magdy9@gmail.com",
} as const;

// Age verification constants
export const AGE_VERIFICATION = {
  MINIMUM_AGE: 13, // COPPA compliance - minimum age to use the platform
  MINOR_AGE: 18, // Age below which users are considered minors
  VERIFICATION_REQUIRED: true, // Whether age verification is required
  STRICT_ENFORCEMENT: true, // Strict enforcement of age restrictions
} as const;

// Time constants (in milliseconds)
export const TIME_CONSTANTS = {
  // Common time periods
  ONE_SECOND: 1000,
  ONE_MINUTE: 60 * 1000,
  ONE_HOUR: 60 * 60 * 1000,
  ONE_DAY: 24 * 60 * 60 * 1000,
  ONE_WEEK: 7 * 24 * 60 * 60 * 1000,
  ONE_MONTH: 30 * 24 * 60 * 60 * 1000,
  ONE_YEAR: 365 * 24 * 60 * 60 * 1000,

  // Cache and timeout values
  CACHE_TTL: 5 * 60 * 1000, // 5 minutes
  DEBOUNCE_DELAY: 500, // 500ms
  SETTLEMENT_DELAY: 1000, // 1 second
  RETRY_DELAYS: [1000, 2000, 4000], // Exponential backoff

  // UI timeouts
  NEW_WHISPER_INDICATOR_TIMEOUT: 5000, // 5 seconds
  AUTO_HIDE_TIMEOUT: 5000, // 5 seconds

  // Suspension durations
  WARNING_DURATION: 0, // No suspension
  TEMPORARY_SUSPENSION_DURATION: 24 * 60 * 60 * 1000, // 24 hours
  EXTENDED_SUSPENSION_DURATION: 7 * 24 * 60 * 60 * 1000, // 7 days
  PERMANENT_SUSPENSION_DURATION: 100 * 365 * 24 * 60 * 60 * 1000, // 100 years (effectively permanent)

  // Appeal time limits
  TRUSTED_APPEAL_TIME_LIMIT: 0, // No time limit for trusted users
  VERIFIED_APPEAL_TIME_LIMIT: 7 * 24 * 60 * 60 * 1000, // 7 days
  STANDARD_APPEAL_TIME_LIMIT: 14 * 24 * 60 * 60 * 1000, // 14 days
  FLAGGED_APPEAL_TIME_LIMIT: 30 * 24 * 60 * 60 * 1000, // 30 days

  // Auto-resolve times
  WARNING_AUTO_RESOLVE_TIME: 24 * 60 * 60 * 1000, // 24 hours
} as const;

// Reputation system constants
export const REPUTATION_CONSTANTS = {
  // Score ranges
  MIN_SCORE: 0,
  MAX_SCORE: 100,

  // Thresholds for reputation levels
  TRUSTED_THRESHOLD: 80,
  VERIFIED_THRESHOLD: 70,
  STANDARD_THRESHOLD: 50,
  FLAGGED_THRESHOLD: 25,
  BANNED_THRESHOLD: 0,

  // Initial scores
  INITIAL_USER_SCORE: 50,
  TRUSTED_USER_INITIAL_SCORE: 75,

  // Score adjustments
  APPROVED_WHISPER_BONUS: 1,
  FLAGGED_WHISPER_PENALTY: -5,
  REJECTED_WHISPER_PENALTY: -10,
  VIOLATION_PENALTY: -15,
  CRITICAL_VIOLATION_PENALTY: -25,
  APPEAL_APPROVED_BONUS: 5,
  APPEAL_REJECTED_PENALTY: -5,
  SUSPENSION_PENALTY: -5,
  SUSPENSION_RESTORATION_BONUS: 5,

  // Auto-approval thresholds
  TRUSTED_AUTO_APPROVAL_CONFIDENCE: 0.5, // 50% confidence for trusted users
  VERIFIED_AUTO_APPROVAL_CONFIDENCE: 0.5, // 50% confidence for verified users
} as const;

// Reporting system constants
export const REPORTING_CONSTANTS = {
  // Priority thresholds based on reporter reputation
  PRIORITY_THRESHOLDS: {
    CRITICAL: 90, // Trusted users can trigger critical priority
    HIGH: 75, // Verified users can trigger high priority
    MEDIUM: 50, // Standard users trigger medium priority
    LOW: 25, // Flagged users trigger low priority
  },

  // Reputation weight multipliers
  REPUTATION_WEIGHTS: {
    trusted: 2.0, // Trusted users' reports carry double weight
    verified: 1.5, // Verified users' reports carry 1.5x weight
    standard: 1.0, // Standard users' reports carry normal weight
    flagged: 0.5, // Flagged users' reports carry half weight
    banned: 0.0, // Banned users cannot report
  },

  // Auto-escalation thresholds
  CRITICAL_PRIORITY_THRESHOLD: 90,
  HIGH_PRIORITY_THRESHOLD: 75,
  MEDIUM_PRIORITY_THRESHOLD: 50,
  LOW_PRIORITY_THRESHOLD: 25,
} as const;

// Suspension system constants
export const SUSPENSION_CONSTANTS = {
  // Default suspension durations
  DEFAULT_DURATIONS: {
    WARNING: 0, // No suspension, just warning
    TEMPORARY: 24 * 60 * 60 * 1000, // 24 hours
    PERMANENT: 0, // No duration for permanent
  },

  // Suspension thresholds based on violation count
  SUSPENSION_THRESHOLDS: {
    FIRST_VIOLATION: "WARNING",
    SECOND_VIOLATION: "TEMPORARY",
    THIRD_VIOLATION: "TEMPORARY",
    FOURTH_VIOLATION: "PERMANENT",
  },

  // Violation counts for automatic suspension
  FIRST_VIOLATION_COUNT: 1,
  SECOND_VIOLATION_COUNT: 2,
  THIRD_VIOLATION_COUNT: 3,
  FOURTH_VIOLATION_COUNT: 4,
} as const;

// Audio and file constants
export const AUDIO_FILE_CONSTANTS = {
  // File size limits
  MAX_AUDIO_FILE_SIZE: 25 * 1024 * 1024, // 25MB
  MAX_CACHE_SIZE: 100 * 1024 * 1024, // 100MB

  // Audio processing
  MAX_AUDIO_DURATION: 30, // seconds
  MIN_AUDIO_DURATION: 1, // seconds
  WHISPER_PERCENTAGE_THRESHOLD: 0.5, // 50% to be considered a whisper

  // Audio levels
  MIN_AUDIO_LEVEL: 0,
  MAX_AUDIO_LEVEL: 100,
  NORMALIZED_AUDIO_LEVEL: 1000,

  // Preloading
  DEFAULT_PRELOAD_COUNT: 5,
  OPTIMAL_PRELOAD_COUNT: 3,
} as const;

// Database and pagination constants
export const DATABASE_CONSTANTS = {
  // Default limits
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 100,
  MIN_LIMIT: 10,

  // Cache settings
  CACHE_EXPIRY_MS: 5 * 60 * 1000, // 5 minutes

  // Pagination
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 50,
} as const;

// UI and interaction constants
export const INTERACTION_CONSTANTS = {
  // Debounce delays
  LIKE_DEBOUNCE_DELAY: 1000, // 1 second
  SCROLL_DEBOUNCE_DELAY: 500, // 500ms

  // Thresholds
  END_REACHED_THRESHOLD: 0.5,
  AUTO_SCROLL_THRESHOLD: 10,

  // Z-index values
  NEW_WHISPERS_INDICATOR_Z_INDEX: 1000,
  MODAL_Z_INDEX: 2000,
  TOAST_Z_INDEX: 3000,

  // Shadow values
  CARD_SHADOW_OPACITY: 0.25,
  CARD_SHADOW_RADIUS: 3.84,
  CARD_ELEVATION: 5,

  // Positioning
  NEW_WHISPERS_INDICATOR_TOP: 50,
} as const;

// Content Moderation Constants
export const CONTENT_MODERATION = {
  // Feature flags
  FEATURE_FLAGS: {
    ENABLE_GOOGLE_PERSPECTIVE: true, // Google Perspective enabled by default
    ENABLE_AZURE_MODERATION: false, // Azure feature flagged off initially
    ENABLE_MULTI_API_MODERATION: false, // Multi-API feature flagged off initially
    ENABLE_AGE_PROTECTION: true, // Age protection enabled
    ENABLE_REAL_TIME_MODERATION: true, // Real-time moderation enabled
    ENABLE_REPUTATION_SYSTEM: true, // Reputation system enabled
    ENABLE_REPORTING_SYSTEM: true, // Reporting system enabled
    ENABLE_ADVANCED_SPAM_DETECTION: true, // Advanced spam/scam detection enabled
  },

  // API thresholds
  THRESHOLDS: {
    OPENAI: {
      HARASSMENT: 0.7,
      HATE_SPEECH: 0.7,
      VIOLENCE: 0.7,
      SEXUAL_CONTENT: 0.7,
      SELF_HARM: 0.7,
    },
    PERSPECTIVE: {
      TOXICITY: 0.7,
      SEVERE_TOXICITY: 0.8,
      IDENTITY_ATTACK: 0.7,
      INSULT: 0.7,
      PROFANITY: 0.7,
      THREAT: 0.7,
      SEXUALLY_EXPLICIT: 0.7,
      SPAM: 0.7,
    },
    AZURE: {
      SEXUAL_CONTENT: 0.7,
      VIOLENCE: 0.7,
      HATE_SPEECH: 0.7,
    },
    LOCAL: {
      TOXICITY: 0.6,
      SPAM: 0.6,
    },
  },

  // Content ranking thresholds
  CONTENT_RANKING: {
    G: {
      maxToxicity: 0.3,
      maxSexualContent: 0.1,
      maxViolence: 0.1,
      maxHateSpeech: 0.1,
    },
    PG: {
      maxToxicity: 0.5,
      maxSexualContent: 0.3,
      maxViolence: 0.3,
      maxHateSpeech: 0.3,
    },
    PG13: {
      maxToxicity: 0.7,
      maxSexualContent: 0.5,
      maxViolence: 0.5,
      maxHateSpeech: 0.5,
    },
    R: {
      maxToxicity: 0.9,
      maxSexualContent: 0.8,
      maxViolence: 0.8,
      maxHateSpeech: 0.8,
    },
    NC17: {
      maxToxicity: 1.0,
      maxSexualContent: 1.0,
      maxViolence: 1.0,
      maxHateSpeech: 1.0,
    },
  },

  // Reputation system
  REPUTATION: {
    INITIAL_SCORE: 50,
    TRUSTED_THRESHOLD: 80,
    VERIFIED_THRESHOLD: 70,
    STANDARD_THRESHOLD: 40,
    FLAGGED_THRESHOLD: 20,
    BANNED_THRESHOLD: 0,

    // Score adjustments
    SCORE_ADJUSTMENTS: {
      APPROVED_WHISPER: 1,
      FLAGGED_WHISPER: -5,
      REJECTED_WHISPER: -10,
      VIOLATION: -15,
      CRITICAL_VIOLATION: -25,
      APPEAL_APPROVED: 5,
      APPEAL_REJECTED: -5,
    },

    // Reputation-based actions
    REPUTATION_ACTIONS: {
      TRUSTED: {
        autoAppeal: true,
        reducedPenalties: true,
        prioritySupport: true,
        fasterModeration: true,
      },
      VERIFIED: {
        autoAppeal: false,
        reducedPenalties: true,
        prioritySupport: false,
        fasterModeration: true,
      },
      STANDARD: {
        autoAppeal: false,
        reducedPenalties: false,
        prioritySupport: false,
        fasterModeration: false,
      },
      FLAGGED: {
        autoAppeal: false,
        reducedPenalties: false,
        prioritySupport: false,
        fasterModeration: false,
        manualReview: true,
      },
      BANNED: {
        autoAppeal: false,
        reducedPenalties: false,
        prioritySupport: false,
        fasterModeration: false,
        manualReview: true,
        accountSuspended: true,
      },
    },
  },

  // Age protection
  AGE_PROTECTION: {
    MINOR_AGE_THRESHOLD: 18,
    STRICT_FILTERING_THRESHOLD: 13,

    // Content restrictions by age
    AGE_RESTRICTIONS: {
      MINOR: {
        allowedRanks: ["G", "PG"],
        maxToxicity: 0.3,
        maxSexualContent: 0.1,
        maxViolence: 0.1,
        maxHateSpeech: 0.1,
      },
      TEEN: {
        allowedRanks: ["G", "PG", "PG13"],
        maxToxicity: 0.5,
        maxSexualContent: 0.3,
        maxViolence: 0.3,
        maxHateSpeech: 0.3,
      },
      ADULT: {
        allowedRanks: ["G", "PG", "PG13", "R"],
        maxToxicity: 0.9,
        maxSexualContent: 0.8,
        maxViolence: 0.8,
        maxHateSpeech: 0.8,
      },
    },
  },

  // Real-time moderation
  REAL_TIME: {
    AUDIO_ANALYSIS: {
      VOLUME_SPIKE_THRESHOLD: 0.8,
      MULTIPLE_VOICES_CONFIDENCE: 0.7,
      BACKGROUND_NOISE_THRESHOLD: 0.6,
      NON_WHISPER_SPEECH_THRESHOLD: 0.5,
    },
    CONTENT_FILTERING: {
      KEYWORD_MATCH_THRESHOLD: 0.8,
      SENTIMENT_ANALYSIS_THRESHOLD: 0.7,
      RESPONSE_TIME_MS: 2000,
    },
  },

  // Moderation actions
  ACTIONS: {
    WARN: {
      reputationImpact: -5,
      appealable: true,
      autoResolve: true,
      autoResolveTime: 24 * 60 * 60 * 1000, // 24 hours
    },
    FLAG: {
      reputationImpact: -10,
      appealable: true,
      autoResolve: false,
      requiresReview: true,
    },
    REJECT: {
      reputationImpact: -15,
      appealable: true,
      autoResolve: false,
      requiresReview: true,
    },
    BAN: {
      reputationImpact: -25,
      appealable: true,
      autoResolve: false,
      requiresReview: true,
      accountSuspended: true,
    },
  },

  // Local keyword filtering
  LOCAL_KEYWORDS: {
    HARASSMENT: [
      "kill yourself",
      "kys",
      "die",
      "hate you",
      "stupid",
      "idiot",
      "moron",
      "ugly",
      "fat",
      "worthless",
      "nobody likes you",
      "you're nothing",
    ],
    HATE_SPEECH: [
      "nazi",
      "hitler",
      "white power",
      "black power",
      "racial slur",
      "homophobic slur",
      "transphobic slur",
      "religious slur",
    ],
    VIOLENCE: [
      "kill you",
      "beat you",
      "punch you",
      "stab you",
      "shoot you",
      "bomb",
      "terrorist",
      "attack",
      "murder",
      "assault",
    ],
    SEXUAL_CONTENT: [
      "porn",
      "sex",
      "sexual",
      "nude",
      "naked",
      "penis",
      "vagina",
      "fuck",
      "dick",
      "pussy",
      "cock",
      "ass",
      "tits",
    ],
    DRUGS: [
      "cocaine",
      "heroin",
      "meth",
      "weed",
      "marijuana",
      "drugs",
      "high",
      "stoned",
      "drunk",
      "alcohol",
      "beer",
      "wine",
    ],
    SPAM: [
      "buy now",
      "click here",
      "free money",
      "make money fast",
      "earn money",
      "work from home",
      "get rich quick",
    ],
    PERSONAL_INFO: [
      "phone number",
      "email",
      "address",
      "social security",
      "credit card",
      "bank account",
      "password",
    ],
  },

  // API rate limits and costs
  API_LIMITS: {
    OPENAI: {
      requestsPerMinute: 60,
      costPerRequest: 0.0001, // $0.0001 per request
      maxTokens: 1000,
    },
    PERSPECTIVE: {
      requestsPerMinute: 100,
      costPerRequest: 0.0002, // $0.0002 per request
      maxTextLength: 10000,
    },
    AZURE: {
      requestsPerMinute: 50,
      costPerRequest: 0.0005, // $0.0005 per request
      maxTextLength: 10000,
    },
  },
} as const;

// User profile colors
export const USER_PROFILE_COLORS = [
  "#4CAF50", // Green
  "#2196F3", // Blue
  "#FF5722", // Red
  "#795548", // Brown
  "#9C27B0", // Purple
  "#3F51B5", // Indigo
  "#FFC107", // Amber
  "#00BCD4", // Cyan
  "#FF9800", // Orange
  "#E91E63", // Pink
] as const;

// Export all constants as a single object for easy access
export const CONSTANTS = {
  AUDIO_CONSTANTS,
  VOLUME_THRESHOLDS,
  FIRESTORE_COLLECTIONS,
  STORAGE_PATHS,
  UI_CONSTANTS,
  ANIMATION_CONSTANTS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  FEATURE_FLAGS,
  API_ENDPOINTS,
  APP_METADATA,
  AGE_VERIFICATION,
  TIME_CONSTANTS,
  REPUTATION_CONSTANTS,
  REPORTING_CONSTANTS,
  SUSPENSION_CONSTANTS,
  AUDIO_FILE_CONSTANTS,
  DATABASE_CONSTANTS,
  INTERACTION_CONSTANTS,
  CONTENT_MODERATION,
  USER_PROFILE_COLORS,
} as const;
