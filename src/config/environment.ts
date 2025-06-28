import Constants from "expo-constants";

// Environment variable types
interface EnvironmentConfig {
  // Firebase
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    appId: string;
    messagingSenderId: string;
  };
  // OpenAI
  openai: {
    apiKey: string;
  };
  // App
  app: {
    env: "development" | "staging" | "production";
    version: string;
    enableTranscription: boolean;
    enableVolumeDetection: boolean;
    maxAudioDuration: number;
    whisperVolumeThreshold: number;
    enableEmulators: boolean;
  };
}

// Get environment variables with fallbacks
const getEnvVar = (key: string, fallback?: string): string => {
  const value = Constants.expoConfig?.extra?.[key] || process.env[key];
  if (!value && fallback === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value || fallback || "";
};

// Environment configuration
export const env: EnvironmentConfig = {
  firebase: {
    apiKey: getEnvVar("EXPO_PUBLIC_FIREBASE_API_KEY"),
    authDomain: getEnvVar("EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN"),
    projectId: getEnvVar("EXPO_PUBLIC_FIREBASE_PROJECT_ID"),
    storageBucket: getEnvVar("EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET"),
    appId: getEnvVar("EXPO_PUBLIC_FIREBASE_APP_ID"),
    messagingSenderId: getEnvVar("EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
  },
  openai: {
    apiKey: getEnvVar("EXPO_PUBLIC_OPENAI_API_KEY"),
  },
  app: {
    env: getEnvVar("EXPO_PUBLIC_APP_ENV", "development") as
      | "development"
      | "staging"
      | "production",
    version: getEnvVar("EXPO_PUBLIC_APP_VERSION", "1.0.0"),
    enableTranscription:
      getEnvVar("EXPO_PUBLIC_ENABLE_TRANSCRIPTION", "true") === "true",
    enableVolumeDetection:
      getEnvVar("EXPO_PUBLIC_ENABLE_VOLUME_DETECTION", "true") === "true",
    maxAudioDuration: parseInt(
      getEnvVar("EXPO_PUBLIC_MAX_AUDIO_DURATION", "30")
    ),
    whisperVolumeThreshold: parseFloat(
      getEnvVar("EXPO_PUBLIC_WHISPER_VOLUME_THRESHOLD", "0.4")
    ),
    enableEmulators:
      getEnvVar("EXPO_PUBLIC_ENABLE_EMULATORS", "false") === "true",
  },
};

// Validation function
export const validateEnvironment = (): void => {
  const requiredVars = [
    "EXPO_PUBLIC_FIREBASE_API_KEY",
    "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
    "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET",
    "EXPO_PUBLIC_FIREBASE_APP_ID",
    "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  ];

  const missingVars = requiredVars.filter((varName) => !getEnvVar(varName));

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(", ")}`
    );
  }
};

// Helper functions
export const isDevelopment = (): boolean => env.app.env === "development";
export const isProduction = (): boolean => env.app.env === "production";
export const isStaging = (): boolean => env.app.env === "staging";

export default env;
