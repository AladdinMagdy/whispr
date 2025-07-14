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
