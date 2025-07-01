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
