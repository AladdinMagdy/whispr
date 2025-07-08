import "react-native-gesture-handler/jestSetup";

// Declare global for TypeScript
declare const global: any;

// jest-expo handles most Expo SDK mocking automatically
// We only need to mock our specific dependencies

// Mock react-native-audio-recorder-player as a class
jest.mock("react-native-audio-recorder-player", () => {
  return {
    __esModule: true,
    default: class AudioRecorderPlayer {
      startRecorder = jest.fn().mockResolvedValue("mock-audio-uri");
      stopRecorder = jest.fn().mockResolvedValue("mock-audio-uri");
      addRecordBackListener = jest.fn();
      removeRecordBackListener = jest.fn();
      setSubscriptionDuration = jest.fn();
    },
  };
});

// Mock Firebase
jest.mock("../config/firebase", () => ({
  getAuthInstance: jest.fn(() => ({
    currentUser: { uid: "test-user-id" },
  })),
  getFirestoreInstance: jest.fn(() => ({
    collection: jest.fn(() => ({
      addDoc: jest.fn().mockResolvedValue({ id: "test-doc-id" }),
    })),
  })),
  getStorageInstance: jest.fn(() => ({
    ref: jest.fn(() => ({
      put: jest.fn().mockResolvedValue({
        ref: { getDownloadURL: jest.fn().mockResolvedValue("mock-url") },
      }),
    })),
  })),
}));

// Firebase mocks are now handled by moduleNameMapper in jest.config.js

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.fn(() => ({
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  }))
);

// Mock console methods to reduce noise in tests
(global as any).console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
