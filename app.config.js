/* global process */
import 'dotenv/config';

export default {
  expo: {
    name: 'Whispr',
    slug: 'whispr',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff'
    },
    assetBundlePatterns: [
      '**/*'
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.aladdinmagdy.whispr',
      infoPlist: {
        NSMicrophoneUsageDescription: "Allow Whispr to access your microphone.",
        "UIBackgroundModes": [
          "audio"
        ]
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#FFFFFF'
      },
      package: 'com.aladdinmagdy.whispr'
    },
    web: {
      favicon: './assets/favicon.png'
    },
    plugins: [
      'expo-file-system'
    ],
    // Disable New Architecture for compatibility
    experiments: {
      newArchEnabled: false
    },
    extra: {
      // Environment variables
      EXPO_PUBLIC_FIREBASE_API_KEY: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      EXPO_PUBLIC_FIREBASE_PROJECT_ID: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      EXPO_PUBLIC_FIREBASE_APP_ID: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
      EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      EXPO_PUBLIC_OPENAI_API_KEY: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
      EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV || 'development',
      EXPO_PUBLIC_APP_VERSION: process.env.EXPO_PUBLIC_APP_VERSION || '1.0.0',
      EXPO_PUBLIC_ENABLE_TRANSCRIPTION: process.env.EXPO_PUBLIC_ENABLE_TRANSCRIPTION || 'true',
      EXPO_PUBLIC_ENABLE_VOLUME_DETECTION: process.env.EXPO_PUBLIC_ENABLE_VOLUME_DETECTION || 'true',
      EXPO_PUBLIC_MAX_AUDIO_DURATION: process.env.EXPO_PUBLIC_MAX_AUDIO_DURATION || '30',
      EXPO_PUBLIC_WHISPER_VOLUME_THRESHOLD: process.env.EXPO_PUBLIC_WHISPER_VOLUME_THRESHOLD || '0.4',
    },
  },
};