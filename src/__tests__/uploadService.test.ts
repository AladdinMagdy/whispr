import {
  UploadService,
  WhisperUploadData,
  UploadUtils,
} from "../services/uploadService";
import { validateUploadData } from "../utils/fileUtils";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { collection, addDoc } from "firebase/firestore";
import { StorageService } from "../services/storageService";
import * as TranscriptionServiceModule from "../services/transcriptionService";
import * as ContentModerationServiceModule from "../services/contentModerationService";
import * as AgeVerificationServiceModule from "../services/ageVerificationService";

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
const mockAuthService = {
  getCurrentUser: jest.fn().mockResolvedValue({
    uid: "test-user-id",
    displayName: "Test User",
    profileColor: "#007AFF",
  }),
};

const mockFirestoreService = {
  createWhisper: jest.fn().mockResolvedValue("test-doc-id"),
  getWhisper: jest.fn().mockResolvedValue({
    userId: "test-user-id",
    audioUrl: "mock-audio-url",
  }),
  deleteWhisper: jest.fn().mockResolvedValue(undefined),
  updateTranscription: jest.fn().mockResolvedValue(undefined),
};

const mockStorageService = {
  uploadAudio: jest.fn().mockResolvedValue("mock-url"),
  deleteAudio: jest.fn().mockResolvedValue(undefined),
};

const mockTranscriptionService = {
  transcribeAudio: jest.fn().mockResolvedValue({
    text: "Hello world, this is a test whisper",
    language: "en",
  }),
};

const mockContentModerationService = {
  moderateWhisper: jest.fn().mockResolvedValue({
    status: "approved",
    contentRank: "G",
    isMinorSafe: true,
    violations: [],
    confidence: 0.9,
    moderationTime: 500,
    apiResults: {},
    reputationImpact: 0,
    appealable: false,
  }),
};

const mockAgeVerificationService = {
  verifyAge: jest.fn().mockResolvedValue({
    isVerified: true,
    age: 25,
    isMinor: false,
    verificationMethod: "date_of_birth",
    confidence: 0.7,
    requiresAdditionalVerification: false,
  }),
};

const mockReputationService = {
  recordSuccessfulWhisper: jest.fn().mockResolvedValue(undefined),
};

jest.mock("../services/authService", () => ({
  getAuthService: jest.fn(() => mockAuthService),
}));

jest.mock("../services/firestoreService", () => ({
  getFirestoreService: jest.fn(() => mockFirestoreService),
}));

jest.doMock("../services/transcriptionService", () => ({
  TranscriptionService: class {
    static transcribeAudio = jest.fn();
  },
}));
jest.doMock("../services/contentModerationService", () => ({
  ContentModerationService: class {
    static moderateWhisper = jest.fn();
  },
}));
jest.doMock("../services/ageVerificationService", () => ({
  AgeVerificationService: class {
    static verifyAge = jest.fn();
  },
}));

jest.mock("../services/reputationService", () => ({
  getReputationService: jest.fn(() => mockReputationService),
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

    // Patch static methods on StorageService
    jest
      .spyOn(StorageService, "uploadAudio")
      .mockImplementation(mockStorageService.uploadAudio);
    jest
      .spyOn(StorageService, "deleteAudio")
      .mockImplementation(mockStorageService.deleteAudio);

    // Reset all mocks to default behavior
    mockAuthService.getCurrentUser.mockResolvedValue({
      uid: "test-user-id",
      displayName: "Test User",
      profileColor: "#007AFF",
    });
    mockFirestoreService.createWhisper.mockResolvedValue("test-doc-id");
    mockFirestoreService.getWhisper.mockResolvedValue({
      userId: "test-user-id",
      audioUrl: "mock-audio-url",
    });
    mockFirestoreService.deleteWhisper.mockResolvedValue(undefined);
    mockFirestoreService.updateTranscription.mockResolvedValue(undefined);
    mockStorageService.uploadAudio.mockResolvedValue("mock-url");
    mockStorageService.deleteAudio.mockResolvedValue(undefined);
    mockTranscriptionService.transcribeAudio.mockResolvedValue({
      text: "Hello world, this is a test whisper",
      language: "en",
    });
    mockContentModerationService.moderateWhisper.mockResolvedValue({
      status: "approved",
      contentRank: "G",
      isMinorSafe: true,
      violations: [],
      confidence: 0.9,
      moderationTime: 500,
      apiResults: {},
      reputationImpact: 0,
      appealable: false,
    });
    mockAgeVerificationService.verifyAge.mockResolvedValue({
      isVerified: true,
      age: 25,
      isMinor: false,
      verificationMethod: "date_of_birth",
      confidence: 0.7,
      requiresAdditionalVerification: false,
    });
    mockReputationService.recordSuccessfulWhisper.mockResolvedValue(undefined);

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

    jest
      .spyOn(TranscriptionServiceModule.TranscriptionService, "transcribeAudio")
      .mockImplementation(mockTranscriptionService.transcribeAudio);
    jest
      .spyOn(
        ContentModerationServiceModule.ContentModerationService,
        "moderateWhisper"
      )
      .mockImplementation(mockContentModerationService.moderateWhisper);
    jest
      .spyOn(AgeVerificationServiceModule.AgeVerificationService, "verifyAge")
      .mockImplementation(mockAgeVerificationService.verifyAge);
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

  describe("uploadWhisper", () => {
    test("should upload whisper and return whisper ID", async () => {
      const mockUploadData: WhisperUploadData = {
        audioUri: "file://mock-audio.m4a",
        duration: 10,
        whisperPercentage: 0.9,
        averageLevel: 0.01,
        confidence: 0.8,
        userAge: 25, // Required for age verification
      };
      global.fetch = jest.fn().mockResolvedValue({
        blob: jest.fn().mockResolvedValue(new Blob(["mock audio data"])),
      });
      const result = await uploadService.uploadWhisper(mockUploadData);
      expect(typeof result).toBe("string");
      expect(result).toBe("test-doc-id");
    });

    test("should throw error when user is not authenticated", async () => {
      mockAuthService.getCurrentUser.mockResolvedValue(null);
      const mockUploadData: WhisperUploadData = {
        audioUri: "file://mock-audio.m4a",
        duration: 10,
        whisperPercentage: 0.9,
        averageLevel: 0.01,
        confidence: 0.8,
        userAge: 25,
      };
      await expect(uploadService.uploadWhisper(mockUploadData)).rejects.toThrow(
        "User not authenticated"
      );
    });

    test("should throw error for invalid audio format", async () => {
      const mockUploadData: WhisperUploadData = {
        audioUri: "file://mock-audio.txt", // Invalid format
        duration: 10,
        whisperPercentage: 0.9,
        averageLevel: 0.01,
        confidence: 0.8,
        userAge: 25,
      };
      await expect(uploadService.uploadWhisper(mockUploadData)).rejects.toThrow(
        "Invalid audio file format"
      );
    });

    test("should throw error when age verification fails", async () => {
      mockAgeVerificationService.verifyAge.mockResolvedValue({
        isVerified: false,
        age: 13,
        isMinor: true,
        verificationMethod: "date_of_birth",
        confidence: 0.7,
        requiresAdditionalVerification: false,
        reason: "User is under 13 years old",
      });
      const mockUploadData: WhisperUploadData = {
        audioUri: "file://mock-audio.m4a",
        duration: 10,
        whisperPercentage: 0.9,
        averageLevel: 0.01,
        confidence: 0.8,
        userAge: 13,
      };
      await expect(uploadService.uploadWhisper(mockUploadData)).rejects.toThrow(
        "Age verification failed: User is under 13 years old"
      );
    });

    test("should throw error when content moderation rejects", async () => {
      mockContentModerationService.moderateWhisper.mockResolvedValue({
        status: "rejected",
        contentRank: "R",
        isMinorSafe: false,
        violations: ["hate_speech"],
        confidence: 0.9,
        moderationTime: 500,
        apiResults: {},
        reputationImpact: -10,
        appealable: true,
        reason: "Content violates community guidelines",
      });
      const mockUploadData: WhisperUploadData = {
        audioUri: "file://mock-audio.m4a",
        duration: 10,
        whisperPercentage: 0.9,
        averageLevel: 0.01,
        confidence: 0.8,
        userAge: 25,
      };
      await expect(uploadService.uploadWhisper(mockUploadData)).rejects.toThrow(
        "Content rejected: Content violates community guidelines"
      );
    });

    test("should handle storage service errors", async () => {
      mockStorageService.uploadAudio.mockRejectedValue(
        new Error("Storage upload failed")
      );
      const mockUploadData: WhisperUploadData = {
        audioUri: "file://mock-audio.m4a",
        duration: 10,
        whisperPercentage: 0.9,
        averageLevel: 0.01,
        confidence: 0.8,
        userAge: 25,
      };
      await expect(uploadService.uploadWhisper(mockUploadData)).rejects.toThrow(
        "Storage upload failed"
      );
    });

    test("should handle transcription service errors", async () => {
      mockTranscriptionService.transcribeAudio.mockRejectedValue(
        new Error("Transcription failed")
      );
      const mockUploadData: WhisperUploadData = {
        audioUri: "file://mock-audio.m4a",
        duration: 10,
        whisperPercentage: 0.9,
        averageLevel: 0.01,
        confidence: 0.8,
        userAge: 25,
      };
      await expect(uploadService.uploadWhisper(mockUploadData)).rejects.toThrow(
        "Transcription failed"
      );
    });

    test("should handle firestore service errors", async () => {
      mockFirestoreService.createWhisper.mockRejectedValue(
        new Error("Firestore creation failed")
      );
      const mockUploadData: WhisperUploadData = {
        audioUri: "file://mock-audio.m4a",
        duration: 10,
        whisperPercentage: 0.9,
        averageLevel: 0.01,
        confidence: 0.8,
        userAge: 25,
      };
      await expect(uploadService.uploadWhisper(mockUploadData)).rejects.toThrow(
        "Firestore creation failed"
      );
    });

    test("should handle reputation service errors gracefully", async () => {
      mockReputationService.recordSuccessfulWhisper.mockRejectedValue(
        new Error("Reputation update failed")
      );
      const mockUploadData: WhisperUploadData = {
        audioUri: "file://mock-audio.m4a",
        duration: 10,
        whisperPercentage: 0.9,
        averageLevel: 0.01,
        confidence: 0.8,
        userAge: 25,
      };
      // Should still succeed even if reputation update fails
      const result = await uploadService.uploadWhisper(mockUploadData);
      expect(result).toBe("test-doc-id");
    });

    test("should call all services in correct order", async () => {
      const mockUploadData: WhisperUploadData = {
        audioUri: "file://mock-audio.m4a",
        duration: 10,
        whisperPercentage: 0.9,
        averageLevel: 0.01,
        confidence: 0.8,
        userAge: 25,
      };
      global.fetch = jest.fn().mockResolvedValue({
        blob: jest.fn().mockResolvedValue(new Blob(["mock audio data"])),
      });
      await uploadService.uploadWhisper(mockUploadData);
      expect(mockAuthService.getCurrentUser).toHaveBeenCalled();
      expect(mockStorageService.uploadAudio).toHaveBeenCalled();
      expect(mockTranscriptionService.transcribeAudio).toHaveBeenCalled();
      expect(mockAgeVerificationService.verifyAge).toHaveBeenCalled();
      expect(mockContentModerationService.moderateWhisper).toHaveBeenCalled();
      expect(mockFirestoreService.createWhisper).toHaveBeenCalled();
      expect(mockReputationService.recordSuccessfulWhisper).toHaveBeenCalled();
    });
  });

  describe("deleteWhisper", () => {
    test("should delete whisper successfully", async () => {
      await uploadService.deleteWhisper("test-whisper-id");
      expect(mockAuthService.getCurrentUser).toHaveBeenCalled();
      expect(mockFirestoreService.getWhisper).toHaveBeenCalledWith(
        "test-whisper-id"
      );
      expect(mockFirestoreService.deleteWhisper).toHaveBeenCalledWith(
        "test-whisper-id"
      );
      expect(mockStorageService.deleteAudio).toHaveBeenCalledWith(
        "mock-audio-url"
      );
    });

    test("should throw error when user is not authenticated", async () => {
      mockAuthService.getCurrentUser.mockResolvedValue(null);
      await expect(
        uploadService.deleteWhisper("test-whisper-id")
      ).rejects.toThrow("User not authenticated");
    });

    test("should throw error when whisper not found", async () => {
      mockFirestoreService.getWhisper.mockResolvedValue(null);
      await expect(
        uploadService.deleteWhisper("test-whisper-id")
      ).rejects.toThrow("Whisper not found");
    });

    test("should throw error when user is not authorized", async () => {
      mockFirestoreService.getWhisper.mockResolvedValue({
        userId: "different-user-id",
        audioUrl: "mock-audio-url",
      });
      await expect(
        uploadService.deleteWhisper("test-whisper-id")
      ).rejects.toThrow("Not authorized to delete this whisper");
    });

    test("should handle whisper without audio URL", async () => {
      mockFirestoreService.getWhisper.mockResolvedValue({
        userId: "test-user-id",
        audioUrl: null,
      });
      await uploadService.deleteWhisper("test-whisper-id");
      expect(mockFirestoreService.deleteWhisper).toHaveBeenCalled();
      expect(mockStorageService.deleteAudio).not.toHaveBeenCalled();
    });

    test("should handle storage deletion errors", async () => {
      mockStorageService.deleteAudio.mockRejectedValue(
        new Error("Storage deletion failed")
      );
      await expect(
        uploadService.deleteWhisper("test-whisper-id")
      ).rejects.toThrow("Storage deletion failed");
    });

    test("should handle firestore deletion errors", async () => {
      mockFirestoreService.deleteWhisper.mockRejectedValue(
        new Error("Firestore deletion failed")
      );
      await expect(
        uploadService.deleteWhisper("test-whisper-id")
      ).rejects.toThrow("Firestore deletion failed");
    });
  });

  describe("updateTranscription", () => {
    test("should update transcription successfully", async () => {
      await uploadService.updateTranscription(
        "test-whisper-id",
        "Updated transcription text"
      );
      expect(mockFirestoreService.updateTranscription).toHaveBeenCalledWith(
        "test-whisper-id",
        "Updated transcription text"
      );
    });

    test("should handle firestore update errors", async () => {
      mockFirestoreService.updateTranscription.mockRejectedValue(
        new Error("Firestore update failed")
      );
      await expect(
        uploadService.updateTranscription(
          "test-whisper-id",
          "Updated transcription text"
        )
      ).rejects.toThrow("Firestore update failed");
    });

    test("should handle empty transcription", async () => {
      await uploadService.updateTranscription("test-whisper-id", "");
      expect(mockFirestoreService.updateTranscription).toHaveBeenCalledWith(
        "test-whisper-id",
        ""
      );
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
