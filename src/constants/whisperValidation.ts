// Whisper Detection & Validation Constants
export const WHISPER_VALIDATION = {
  // Default whisper threshold (0.8% of max volume) - EXTREMELY STRICT for real whispers only
  DEFAULT_WHISPER_THRESHOLD: 0.008,

  // Validation thresholds - EXTREMELY STRICT for real whispers only
  MIN_WHISPER_PERCENTAGE: 0.8, // 80% of recording must be whispered (increased from 70%)
  MAX_AVERAGE_LEVEL: 0.015, // 1.5% average level threshold (much lower)
  MAX_LEVEL: 0.025, // 2.5% maximum level threshold (much lower)
  MAX_LOUD_PERCENTAGE: 0.02, // 2% of recording can be loud (much lower)

  // Confidence thresholds
  MIN_CONFIDENCE: 0.3, // 30% minimum confidence

  // Auto-calibration settings - EXTREMELY STRICT for real whispers only
  AUTO_CALIBRATION: {
    MIN_SAMPLES: 10, // Minimum samples before auto-calibration
    RECENT_SAMPLES: 20, // Number of recent samples to analyze
    CALIBRATION_FACTOR: 0.6, // 60% of max level for threshold
    MIN_THRESHOLD: 0.005, // Minimum threshold (0.5%) - extremely low
    MAX_THRESHOLD: 0.015, // Maximum threshold (1.5%) - extremely low
  },

  // Audio level conversion
  AUDIO_LEVELS: {
    MIN_DB: -60, // Minimum expected decibel level
    MAX_DB: 0, // Maximum expected decibel level
    MIN_LEVEL: 0.001, // Minimum audio level (0.1%)
    MAX_LEVEL: 1.0, // Maximum audio level (100%)
  },

  // Recording settings
  RECORDING: {
    SUBSCRIPTION_DURATION: 0.1, // 100ms update intervals
    MIN_DURATION: 2, // Minimum recording duration (seconds)
    MAX_DURATION: 30, // Maximum recording duration (seconds)
    DURATION_TOLERANCE: 0.1, // Tolerance for timing precision (seconds)
  },

  // Threshold adjustment buttons - EXTREMELY STRICT for real whispers only
  THRESHOLD_BUTTONS: {
    VERY_LOW: 0.005, // 0.5% - extremely strict
    LOW: 0.008, // 0.8% - very strict
    MEDIUM: 0.012, // 1.2% - strict
    HIGH: 0.015, // 1.5% - moderately strict
  },
} as const;

// Whisper detection status colors
export const WHISPER_COLORS = {
  WHISPER: "#4CAF50", // Green for whisper
  LOUD: "#F44336", // Red for loud
  NEUTRAL: "#666", // Gray for neutral
  SUCCESS: "#4CAF50", // Green for success
  WARNING: "#FF9800", // Orange for warning
  PRIMARY: "#007AFF", // Blue for primary actions
} as const;

// Whisper validation error messages
export const WHISPER_ERROR_MESSAGES = {
  INSUFFICIENT_WHISPER: (percentage: number) =>
    `Only ${percentage.toFixed(
      1
    )}% was whispered. At least 50% must be whispered.`,

  AVERAGE_LEVEL_TOO_HIGH: (level: number) =>
    `Average audio level (${level.toFixed(
      1
    )}%) is too high. Please whisper more quietly.`,

  MAX_LEVEL_TOO_HIGH: (level: number) =>
    `Maximum audio level (${level.toFixed(
      1
    )}%) was too loud. Please avoid loud sounds.`,

  TOO_MUCH_LOUD_CONTENT: (percentage: number) =>
    `${percentage.toFixed(
      1
    )}% of the recording was too loud. Please whisper more quietly throughout.`,

  CONFIDENCE_TOO_LOW: "Whisper confidence is too low",

  DURATION_TOO_SHORT: "Recording must be at least 2 seconds long",

  DURATION_TOO_LONG: "Recording must be no longer than 30 seconds",
} as const;

// Whisper success messages
export const WHISPER_SUCCESS_MESSAGES = {
  UPLOAD_SUCCESS: (stats: {
    duration: number;
    whisperPercentage: number;
    averageLevel: number;
    totalSamples: number;
  }) =>
    `Your whisper has been uploaded successfully!\n\nWhisper Stats:\n• Duration: ${
      stats.duration
    }s\n• Whisper Level: ${(stats.whisperPercentage * 100).toFixed(
      1
    )}%\n• Average Level: ${(stats.averageLevel * 100).toFixed(
      1
    )}%\n• Samples: ${stats.totalSamples}`,
} as const;
