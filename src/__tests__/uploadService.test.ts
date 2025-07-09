import {
  UploadService,
  WhisperUploadData,
  UploadUtils,
} from "../services/uploadService";
import { validateUploadData } from "../utils/fileUtils";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { collection, addDoc } from "firebase/firestore";

// Declare global for TypeScript
declare const global: any;

// Mock Firebase modules
const mockAuth = {
  currentUser: { uid: "test-user-id" },
};

const mockFirestore = {
  collection: jest.fn(() => ({
    addDoc: jest.fn().mockResolvedValue({ id: "test-doc-id" }),
  })),
};

const mockStorage = {
  ref: jest.fn(() => ({
    put: jest.fn().mockResolvedValue({
      ref: { getDownloadURL: jest.fn().mockResolvedValue("mock-url") },
    }),
  })),
};

// Mock the Firebase config to use our local mocks
jest.mock("../config/firebase", () => ({
  getAuthInstance: jest.fn(() => mockAuth),
  getFirestoreInstance: jest.fn(() => mockFirestore),
  getStorageInstance: jest.fn(() => mockStorage),
}));

// Mock the services
jest.mock("../services/authService", () => ({
  getAuthService: jest.fn(() => ({
    getCurrentUser: jest.fn().mockResolvedValue({
      uid: "test-user-id",
      displayName: "Test User",
      profileColor: "#007AFF",
    }),
  })),
}));

jest.mock("../services/firestoreService", () => ({
  getFirestoreService: jest.fn(() => ({
    createWhisper: jest.fn().mockResolvedValue("test-doc-id"),
  })),
}));

jest.mock("../services/storageService", () => ({
  StorageService: {
    uploadAudio: jest.fn().mockResolvedValue("mock-url"),
    deleteAudio: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock Firebase functions directly
jest.mock("firebase/storage", () => ({
  ref: jest.fn(),
  uploadBytesResumable: jest.fn(),
  getDownloadURL: jest.fn(),
}));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  addDoc: jest.fn(),
  serverTimestamp: jest.fn(() => new Date()),
}));

describe("UploadService", () => {
  let uploadService: UploadService;

  beforeEach(async () => {
    uploadService = UploadService.getInstance();
    jest.clearAllMocks();

    (ref as jest.Mock).mockImplementation(() => ({
      put: jest.fn().mockResolvedValue({
        ref: { getDownloadURL: jest.fn().mockResolvedValue("mock-url") },
      }),
    }));

    (uploadBytesResumable as jest.Mock).mockImplementation(() => ({
      on: jest.fn((event, next) => {
        if (event === "state_changed") {
          next({ bytesTransferred: 512, totalBytes: 1024 });
          next({ bytesTransferred: 1024, totalBytes: 1024 });
        }
        return Promise.resolve();
      }),
    }));

    (getDownloadURL as jest.Mock).mockResolvedValue("mock-url");
    (collection as jest.Mock).mockImplementation(() => ({
      addDoc: jest.fn().mockResolvedValue({ id: "test-doc-id" }),
    }));
    (addDoc as jest.Mock).mockResolvedValue({ id: "test-doc-id" });
  });

  describe("Singleton Pattern", () => {
    test("should return the same instance", () => {
      const instance1 = UploadService.getInstance();
      const instance2 = UploadService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe("Upload Data Validation", () => {
    test("should validate good whisper upload data", () => {
      const mockUploadData: WhisperUploadData = {
        audioUri: "file://mock-audio.m4a",
        duration: 10,
        whisperPercentage: 0.9,
        averageLevel: 0.01,
        confidence: 0.8,
      };
      const validation = validateUploadData(mockUploadData);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
    test("should reject upload data with insufficient whisper percentage", () => {
      const mockUploadData: WhisperUploadData = {
        audioUri: "file://mock-audio.m4a",
        duration: 10,
        whisperPercentage: 0.5,
        averageLevel: 0.01,
        confidence: 0.8,
      };
      const validation = validateUploadData(mockUploadData);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
    test("should reject upload data with average level too high", () => {
      const mockUploadData: WhisperUploadData = {
        audioUri: "file://mock-audio.m4a",
        duration: 10,
        whisperPercentage: 0.9,
        averageLevel: 0.02,
        confidence: 0.8,
      };
      const validation = validateUploadData(mockUploadData);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
    test("should reject upload data with low confidence", () => {
      const mockUploadData: WhisperUploadData = {
        audioUri: "file://mock-audio.m4a",
        duration: 10,
        whisperPercentage: 0.9,
        averageLevel: 0.01,
        confidence: 0.2,
      };
      const validation = validateUploadData(mockUploadData);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
    test("should reject upload data with invalid audio URI", () => {
      const mockUploadData: WhisperUploadData = {
        audioUri: "",
        duration: 10,
        whisperPercentage: 0.9,
        averageLevel: 0.01,
        confidence: 0.8,
      };
      const validation = validateUploadData(mockUploadData);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
    test("should reject upload data with duration too short", () => {
      const mockUploadData: WhisperUploadData = {
        audioUri: "file://mock-audio.m4a",
        duration: 1,
        whisperPercentage: 0.9,
        averageLevel: 0.01,
        confidence: 0.8,
      };
      const validation = validateUploadData(mockUploadData);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
    test("should reject upload data with duration too long (without tolerance)", () => {
      const mockUploadData: WhisperUploadData = {
        audioUri: "file://mock-audio.m4a",
        duration: 31,
        whisperPercentage: 0.9,
        averageLevel: 0.01,
        confidence: 0.8,
      };
      const validation = validateUploadData(mockUploadData);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
    test("should accept upload data with duration at tolerance limit", () => {
      const mockUploadData: WhisperUploadData = {
        audioUri: "file://mock-audio.m4a",
        duration: 30.1,
        whisperPercentage: 0.9,
        averageLevel: 0.01,
        confidence: 0.8,
      };
      const validation = validateUploadData(mockUploadData);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
    test("should accept upload data with duration slightly over 30 seconds", () => {
      const mockUploadData: WhisperUploadData = {
        audioUri: "file://mock-audio.m4a",
        duration: 30.05,
        whisperPercentage: 0.9,
        averageLevel: 0.01,
        confidence: 0.8,
      };
      const validation = validateUploadData(mockUploadData);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe("UploadWhisper", () => {
    test("should upload whisper and return whisper ID", async () => {
      const mockUploadData: WhisperUploadData = {
        audioUri: "file://mock-audio.m4a",
        duration: 10,
        whisperPercentage: 0.9,
        averageLevel: 0.01,
        confidence: 0.8,
      };
      global.fetch = jest.fn().mockResolvedValue({
        blob: jest.fn().mockResolvedValue(new Blob(["mock audio data"])),
      });
      const result = await uploadService.uploadWhisper(mockUploadData);
      expect(typeof result).toBe("string");
      expect(result).toBe("test-doc-id");
    });
  });

  describe("Utility Functions", () => {
    test("should format file size correctly", () => {
      const smallSize = UploadUtils.formatFileSize(1024);
      const largeSize = UploadUtils.formatFileSize(1048576);
      expect(smallSize).toBe("1 KB");
      expect(largeSize).toBe("1 MB");
    });
    test("should format progress correctly", () => {
      const progress = UploadUtils.formatProgress({
        progress: 50,
        bytesTransferred: 512,
        totalBytes: 1024,
      });
      expect(progress).toBe("50.0% (512 Bytes / 1 KB)");
    });
    test("should generate valid filename", () => {
      const filename = UploadUtils.generateFilename("test-user-id");
      expect(filename).toMatch(
        /^whispers\/test-user-id\/\d{13}_[a-zA-Z0-9]+\.m4a$/
      );
    });
    test("should validate audio format", () => {
      expect(UploadUtils.isValidAudioFormat("audio.m4a")).toBe(true);
      expect(UploadUtils.isValidAudioFormat("audio.mp3")).toBe(true);
      expect(UploadUtils.isValidAudioFormat("audio.txt")).toBe(false);
    });
  });
});
