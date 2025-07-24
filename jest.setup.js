/* global require, __dirname, process, jest, global */

const path = require('path');
const fs = require('fs');
const { TextEncoder, TextDecoder } = require('util');

// Load test environment variables
const testEnvPath = path.resolve(__dirname, '.env.test');
if (fs.existsSync(testEnvPath)) {
  const envContent = fs.readFileSync(testEnvPath, 'utf8');
  const envVars = envContent
    .split('\n')
    .filter(line => line.trim() && !line.startsWith('#'))
    .map(line => {
      const [key, ...valueParts] = line.split('=');
      return [key.trim(), valueParts.join('=').trim()];
    });

  envVars.forEach(([key, value]) => {
    if (key && value) {
      process.env[key] = value;
    }
  });
}

// Set default test environment variables if not already set
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.EXPO_PUBLIC_APP_ENV = process.env.EXPO_PUBLIC_APP_ENV || 'test';

// Testing library configuration moved to setup.ts

// Mock console methods to reduce noise in test output
global.console = {
  ...global.console,
  // Uncomment to suppress console.log during tests
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};

// Mock AsyncStorage for React Native
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock @react-native-community/datetimepicker
jest.mock('@react-native-community/datetimepicker', () => ({
  default: 'DateTimePicker',
}));

// Mock expo-blur
jest.mock('expo-blur', () => ({
  BlurView: 'BlurView',
}));

// Mock expo-font
jest.mock('expo-font', () => ({
  loadAsync: jest.fn().mockResolvedValue(true),
  isLoaded: jest.fn().mockReturnValue(true),
}));

// Mock expo-linear-gradient
jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');

  const LinearGradient = ({ children, style, ...props }) => {
    return React.createElement(View, { style, ...props }, children);
  };

  return { LinearGradient };
});

// Mock SVG files
jest.mock('*.svg', () => {
  const React = require('react');
  const { View } = require('react-native');

  const SvgMock = ({ width, height, style, ...props }) => {
    return React.createElement(View, {
      style: [{ width, height }, style],
      ...props
    });
  };

  return SvgMock;
}, { virtual: true });

// Mock expo-av for audio functionality
jest.mock('expo-av', () => ({
  Audio: {
    Recording: jest.fn(),
    Sound: jest.fn(),
  },
  InterruptionModeIOS: {
    DoNotMix: 1,
    DuckOthers: 2,
  },
  InterruptionModeAndroid: {
    DoNotMix: 1,
    DuckOthers: 2,
  },
}));

// Mock expo-file-system
jest.mock('expo-file-system', () => ({
  documentDirectory: '/mock/document/directory/',
  cacheDirectory: '/mock/cache/directory/',
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  deleteAsync: jest.fn(),
  moveAsync: jest.fn(),
  copyAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  readDirectoryAsync: jest.fn(),
  getInfoAsync: jest.fn(),
}));

// Mock expo-constants
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      firebaseApiKey: 'mock-api-key',
      firebaseProjectId: 'mock-project-id',
      firebaseAppId: 'mock-app-id',
    },
  },
}));

// Mock Math.random for deterministic tests that generate proper 9-character strings
let randomCounter = 0;
Math.random = jest.fn(() => {
  // Use a sequence that generates proper 9-character strings
  const values = [0.123456789, 0.987654321, 0.555555555, 0.111111111, 0.999999999];
  return values[randomCounter++ % values.length];
});

// Set up global TextEncoder/TextDecoder for tests
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;