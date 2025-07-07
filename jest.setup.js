/* global require, __dirname, process, jest, global */

const path = require('path');
const fs = require('fs');
const { configure } = require('@testing-library/react-native');
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

// Configure testing library
configure({
  testIdAttribute: 'testID',
});

// Mock expo-av
jest.mock('expo-av', () => ({
  Audio: {
    Sound: jest.fn().mockImplementation(() => ({
      loadAsync: jest.fn().mockResolvedValue({}),
      playAsync: jest.fn().mockResolvedValue({}),
      pauseAsync: jest.fn().mockResolvedValue({}),
      stopAsync: jest.fn().mockResolvedValue({}),
      unloadAsync: jest.fn().mockResolvedValue({}),
      setStatusAsync: jest.fn().mockResolvedValue({}),
      getStatusAsync: jest.fn().mockResolvedValue({}),
      setOnPlaybackStatusUpdate: jest.fn(),
    })),
  },
}));

// Mock expo-file-system
jest.mock('expo-file-system', () => ({
  documentDirectory: '/mock/document/directory/',
  cacheDirectory: '/mock/cache/directory/',
  getInfoAsync: jest.fn(),
  downloadAsync: jest.fn(),
  copyAsync: jest.fn(),
  deleteAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
}));

// Set up global TextEncoder/TextDecoder for tests
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;