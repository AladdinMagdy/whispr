/**
 * Tests for uploadUtils
 */

import {
  validateUserAuthentication,
  validateAudioFormat,
  uploadAudioToStorage,
  transcribeAudio,
  verifyUserAge,
  moderateContent,
  createWhisperDocument,
  updateUserReputation,
  getWhisperForDeletion,
  validateWhisperOwnership,
  deleteWhisperFromFirestore,
  deleteAudioFromStorage,
  updateWhisperTranscription,
  formatUploadProgress,
  generateUniqueFilenameForUpload,
  validateAudioFileFormat,
  createAudioUploadData,
  createWhisperData,
  createAgeVerificationData,
  createModerationData,
  handleUploadError,
  logUploadProgress,
  validateUploadData,
  UPLOAD_ERROR_MESSAGES,
  UPLOAD_SUCCESS_MESSAGES,
} from "../utils/uploadUtils";
import { ModerationStatus, ContentRank } from "../types";

// Mock dependencies
jest.mock("../services/storageService");
jest.mock("../services/firestoreService");
jest.mock("../services/authService");
jest.mock("../services/contentModerationService");
jest.mock("../services/transcriptionService");
jest.mock("../services/ageVerificationService");
jest.mock("../services/reputationService");
jest.mock("../utils/fileUtils");

import { StorageService } from "../services/storageService";
import { getFirestoreService } from "../services/firestoreService";
import { getAuthService } from "../services/authService";
import { ContentModerationService } from "../services/contentModerationService";
import { TranscriptionService } from "../services/transcriptionService";
import { AgeVerificationService } from "../services/ageVerificationService";
import { getReputationService } from "../services/reputationService";
import {
  formatFileSize,
  generateUniqueFilename,
  isValidAudioFormat,
} from "../utils/fileUtils";

// Mock implementations
const mockStorageService = StorageService as jest.Mocked<typeof StorageService>;
const mockGetFirestoreService = getFirestoreService as jest.MockedFunction<
  typeof getFirestoreService
>;
const mockGetAuthService = getAuthService as jest.MockedFunction<
  typeof getAuthService
>;
const mockContentModerationService = ContentModerationService as jest.Mocked<
  typeof ContentModerationService
>;
const mockTranscriptionService = TranscriptionService as jest.Mocked<
  typeof TranscriptionService
>;
const mockAgeVerificationService = AgeVerificationService as jest.Mocked<
  typeof AgeVerificationService
>;
const mockGetReputationService = getReputationService as jest.MockedFunction<
  typeof getReputationService
>;
const mockFormatFileSize = formatFileSize as jest.MockedFunction<
  typeof formatFileSize
>;
const mockGenerateUniqueFilename =
  generateUniqueFilename as jest.MockedFunction<typeof generateUniqueFilename>;
const mockIsValidAudioFormat = isValidAudioFormat as jest.MockedFunction<
  typeof isValidAudioFormat
>;

describe("uploadUtils", () => {
  let mockFirestoreService: any;
  let mockAuthService: any;
  let mockReputationService: any;

  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();

    // Setup mock services
    mockFirestoreService = {
      createWhisper: jest.fn(),
      getWhisper: jest.fn(),
      deleteWhisper: jest.fn(),
      updateTranscription: jest.fn(),
    };

    mockAuthService = {
      getCurrentUser: jest.fn(),
    };

    mockReputationService = {
      recordSuccessfulWhisper: jest.fn(),
    };

    mockGetFirestoreService.mockReturnValue(mockFirestoreService);
    mockGetAuthService.mockReturnValue(mockAuthService);
    mockGetReputationService.mockReturnValue(mockReputationService);
  });

  describe("validateUserAuthentication", () => {
    it("should return user and userId when user is authenticated", async () => {
      const mockUser = {
        uid: "user123",
        displayName: "Test User",
        profileColor: "#FF0000",
      };
      mockAuthService.getCurrentUser.mockResolvedValue(mockUser);

      const result = await validateUserAuthentication();

      expect(result).toEqual({
        user: mockUser,
        userId: "user123",
      });
      expect(mockAuthService.getCurrentUser).toHaveBeenCalledTimes(1);
    });

    it("should throw error when user is not authenticated", async () => {
      mockAuthService.getCurrentUser.mockResolvedValue(null);

      await expect(validateUserAuthentication()).rejects.toThrow(
        UPLOAD_ERROR_MESSAGES.USER_NOT_AUTHENTICATED
      );
    });
  });

  describe("validateAudioFormat", () => {
    it("should not throw when audio format is valid", () => {
      mockIsValidAudioFormat.mockReturnValue(true);

      expect(() => validateAudioFormat("test.mp3")).not.toThrow();
      expect(mockIsValidAudioFormat).toHaveBeenCalledWith("test.mp3");
    });

    it("should throw error when audio format is invalid", () => {
      mockIsValidAudioFormat.mockReturnValue(false);

      expect(() => validateAudioFormat("test.txt")).toThrow(
        UPLOAD_ERROR_MESSAGES.INVALID_AUDIO_FORMAT
      );
    });
  });

  describe("uploadAudioToStorage", () => {
    it("should upload audio successfully", async () => {
      const audioData = {
        uri: "test.mp3",
        duration: 10,
        volume: 0.5,
        isWhisper: true,
        timestamp: new Date(),
      };
      const userId = "user123";
      const expectedUrl = "https://storage.example.com/audio.mp3";

      mockStorageService.uploadAudio.mockResolvedValue(expectedUrl);

      const result = await uploadAudioToStorage(audioData, userId);

      expect(result).toBe(expectedUrl);
      expect(mockStorageService.uploadAudio).toHaveBeenCalledWith(
        audioData,
        userId
      );
      expect(console.log).toHaveBeenCalledWith(
        UPLOAD_SUCCESS_MESSAGES.AUDIO_UPLOADED
      );
    });

    it("should throw error when upload fails", async () => {
      const audioData = {
        uri: "test.mp3",
        duration: 10,
        volume: 0.5,
        isWhisper: true,
        timestamp: new Date(),
      };
      const userId = "user123";

      mockStorageService.uploadAudio.mockRejectedValue(
        new Error("Upload failed")
      );

      await expect(uploadAudioToStorage(audioData, userId)).rejects.toThrow(
        UPLOAD_ERROR_MESSAGES.STORAGE_UPLOAD_FAILED
      );
    });
  });

  describe("transcribeAudio", () => {
    it("should transcribe audio successfully", async () => {
      const audioUrl = "https://storage.example.com/audio.mp3";
      const expectedTranscription = { text: "Hello world" };

      mockTranscriptionService.transcribeAudio.mockResolvedValue(
        expectedTranscription
      );

      const result = await transcribeAudio(audioUrl);

      expect(result).toEqual(expectedTranscription);
      expect(mockTranscriptionService.transcribeAudio).toHaveBeenCalledWith(
        audioUrl
      );
    });

    it("should throw error when transcription fails", async () => {
      const audioUrl = "https://storage.example.com/audio.mp3";

      mockTranscriptionService.transcribeAudio.mockRejectedValue(
        new Error("Transcription failed")
      );

      await expect(transcribeAudio(audioUrl)).rejects.toThrow(
        UPLOAD_ERROR_MESSAGES.TRANSCRIPTION_FAILED
      );
    });
  });

  describe("verifyUserAge", () => {
    it("should verify age successfully", async () => {
      const ageData = { age: 25 };
      const expectedVerification = {
        isVerified: true,
        age: 25,
        isMinor: false,
        verificationMethod: "date_of_birth" as const,
        confidence: 0.7,
        requiresAdditionalVerification: false,
      };

      mockAgeVerificationService.verifyAge.mockResolvedValue(
        expectedVerification
      );

      const result = await verifyUserAge(ageData);

      expect(result).toEqual(expectedVerification);
      expect(mockAgeVerificationService.verifyAge).toHaveBeenCalledWith(
        ageData
      );
    });

    it("should throw error when age verification fails", async () => {
      const ageData = { age: 15 };
      const failedVerification = {
        isVerified: false,
        age: 15,
        isMinor: true,
        verificationMethod: "date_of_birth" as const,
        confidence: 0.7,
        requiresAdditionalVerification: false,
        reason: "Too young",
      };

      mockAgeVerificationService.verifyAge.mockResolvedValue(
        failedVerification
      );

      await expect(verifyUserAge(ageData)).rejects.toThrow(
        UPLOAD_ERROR_MESSAGES.AGE_VERIFICATION_FAILED
      );
    });
  });

  describe("moderateContent", () => {
    it("should moderate content successfully", async () => {
      const moderationData = {
        text: "Hello world",
        userId: "user123",
        age: 25,
      };
      const expectedResult = {
        status: ModerationStatus.APPROVED,
        contentRank: ContentRank.G,
        isMinorSafe: true,
        violations: [],
        confidence: 0.9,
        moderationTime: 100,
        apiResults: {},
        reputationImpact: 0,
        appealable: false,
      };

      mockContentModerationService.moderateWhisper.mockResolvedValue(
        expectedResult
      );

      const result = await moderateContent(moderationData);

      expect(result).toEqual(expectedResult);
      expect(mockContentModerationService.moderateWhisper).toHaveBeenCalledWith(
        moderationData.text,
        moderationData.userId,
        moderationData.age
      );
    });

    it("should throw error when content is rejected", async () => {
      const moderationData = {
        text: "Bad content",
        userId: "user123",
        age: 25,
      };
      const rejectedResult = {
        status: ModerationStatus.REJECTED,
        contentRank: ContentRank.NC17,
        isMinorSafe: false,
        violations: [],
        confidence: 0.9,
        moderationTime: 100,
        apiResults: {},
        reputationImpact: -10,
        appealable: true,
        reason: "Inappropriate content",
      };

      mockContentModerationService.moderateWhisper.mockResolvedValue(
        rejectedResult
      );

      await expect(moderateContent(moderationData)).rejects.toThrow(
        UPLOAD_ERROR_MESSAGES.MODERATION_FAILED
      );
    });
  });

  describe("createWhisperDocument", () => {
    it("should create whisper document successfully", async () => {
      const userId = "user123";
      const displayName = "Test User";
      const profileColor = "#FF0000";
      const whisperData = {
        audioUrl: "https://storage.example.com/audio.mp3",
        duration: 10,
        whisperPercentage: 0.8,
        averageLevel: 0.5,
        confidence: 0.9,
        transcription: "Hello world",
        moderationResult: {
          status: ModerationStatus.APPROVED,
          contentRank: ContentRank.G,
          isMinorSafe: true,
          violations: [],
          confidence: 0.9,
          moderationTime: 100,
          apiResults: {},
          reputationImpact: 0,
          appealable: false,
        },
      };
      const expectedWhisperId = "whisper123";

      mockFirestoreService.createWhisper.mockResolvedValue(expectedWhisperId);

      const result = await createWhisperDocument(
        userId,
        displayName,
        profileColor,
        whisperData
      );

      expect(result).toBe(expectedWhisperId);
      expect(mockFirestoreService.createWhisper).toHaveBeenCalledWith(
        userId,
        displayName,
        profileColor,
        whisperData
      );
    });

    it("should throw error when document creation fails", async () => {
      const userId = "user123";
      const displayName = "Test User";
      const profileColor = "#FF0000";
      const whisperData = {
        audioUrl: "https://storage.example.com/audio.mp3",
        duration: 10,
        whisperPercentage: 0.8,
        averageLevel: 0.5,
        confidence: 0.9,
        transcription: "Hello world",
        moderationResult: {
          status: ModerationStatus.APPROVED,
          contentRank: ContentRank.G,
          isMinorSafe: true,
          violations: [],
          confidence: 0.9,
          moderationTime: 100,
          apiResults: {},
          reputationImpact: 0,
          appealable: false,
        },
      };

      mockFirestoreService.createWhisper.mockRejectedValue(
        new Error("Creation failed")
      );

      await expect(
        createWhisperDocument(userId, displayName, profileColor, whisperData)
      ).rejects.toThrow(UPLOAD_ERROR_MESSAGES.FIRESTORE_CREATE_FAILED);
    });
  });

  describe("updateUserReputation", () => {
    it("should update reputation successfully", async () => {
      const userId = "user123";

      mockReputationService.recordSuccessfulWhisper.mockResolvedValue(
        undefined
      );

      await updateUserReputation(userId);

      expect(
        mockReputationService.recordSuccessfulWhisper
      ).toHaveBeenCalledWith(userId);
      expect(console.log).toHaveBeenCalledWith("✅ Reputation updated");
    });

    it("should throw error when reputation update fails", async () => {
      const userId = "user123";

      mockReputationService.recordSuccessfulWhisper.mockRejectedValue(
        new Error("Update failed")
      );

      await expect(updateUserReputation(userId)).rejects.toThrow(
        UPLOAD_ERROR_MESSAGES.REPUTATION_UPDATE_FAILED
      );
    });
  });

  describe("getWhisperForDeletion", () => {
    it("should return whisper data when found", async () => {
      const whisperId = "whisper123";
      const mockWhisper = {
        userId: "user123",
        audioUrl: "https://storage.example.com/audio.mp3",
      };

      mockFirestoreService.getWhisper.mockResolvedValue(mockWhisper);

      const result = await getWhisperForDeletion(whisperId);

      expect(result).toEqual({
        whisper: mockWhisper,
        audioUrl: mockWhisper.audioUrl,
      });
      expect(mockFirestoreService.getWhisper).toHaveBeenCalledWith(whisperId);
    });

    it("should throw error when whisper not found", async () => {
      const whisperId = "whisper123";

      mockFirestoreService.getWhisper.mockResolvedValue(null);

      await expect(getWhisperForDeletion(whisperId)).rejects.toThrow(
        UPLOAD_ERROR_MESSAGES.WHISPER_NOT_FOUND
      );
    });
  });

  describe("validateWhisperOwnership", () => {
    it("should not throw when user owns the whisper", () => {
      const whisperUserId = "user123";
      const currentUserId = "user123";

      expect(() =>
        validateWhisperOwnership(whisperUserId, currentUserId)
      ).not.toThrow();
    });

    it("should throw error when user does not own the whisper", () => {
      const whisperUserId = "user123";
      const currentUserId = "user456";

      expect(() =>
        validateWhisperOwnership(whisperUserId, currentUserId)
      ).toThrow(UPLOAD_ERROR_MESSAGES.NOT_AUTHORIZED);
    });
  });

  describe("deleteWhisperFromFirestore", () => {
    it("should delete whisper from Firestore", async () => {
      const whisperId = "whisper123";

      mockFirestoreService.deleteWhisper.mockResolvedValue(undefined);

      await deleteWhisperFromFirestore(whisperId);

      expect(mockFirestoreService.deleteWhisper).toHaveBeenCalledWith(
        whisperId
      );
    });
  });

  describe("deleteAudioFromStorage", () => {
    it("should delete audio from storage when URL exists", async () => {
      const audioUrl = "https://storage.example.com/audio.mp3";

      mockStorageService.deleteAudio.mockResolvedValue(undefined);

      await deleteAudioFromStorage(audioUrl);

      expect(mockStorageService.deleteAudio).toHaveBeenCalledWith(audioUrl);
    });

    it("should not delete when URL is empty", async () => {
      const audioUrl = "";

      await deleteAudioFromStorage(audioUrl);

      expect(mockStorageService.deleteAudio).not.toHaveBeenCalled();
    });
  });

  describe("updateWhisperTranscription", () => {
    it("should update transcription successfully", async () => {
      const whisperId = "whisper123";
      const transcription = "Updated transcription";

      mockFirestoreService.updateTranscription.mockResolvedValue(undefined);

      await updateWhisperTranscription(whisperId, transcription);

      expect(mockFirestoreService.updateTranscription).toHaveBeenCalledWith(
        whisperId,
        transcription
      );
      expect(console.log).toHaveBeenCalledWith(
        "✅ Transcription updated successfully"
      );
    });

    it("should throw error when update fails", async () => {
      const whisperId = "whisper123";
      const transcription = "Updated transcription";

      mockFirestoreService.updateTranscription.mockRejectedValue(
        new Error("Update failed")
      );

      await expect(
        updateWhisperTranscription(whisperId, transcription)
      ).rejects.toThrow("Update failed");
    });
  });

  describe("formatUploadProgress", () => {
    it("should format progress correctly", () => {
      const progress = {
        progress: 50.5,
        bytesTransferred: 1024,
        totalBytes: 2048,
      };

      mockFormatFileSize.mockReturnValue("1 KB");

      const result = formatUploadProgress(progress);

      expect(result).toBe("50.5% (1 KB / 1 KB)");
      expect(mockFormatFileSize).toHaveBeenCalledWith(1024);
      expect(mockFormatFileSize).toHaveBeenCalledWith(2048);
    });
  });

  describe("generateUniqueFilenameForUpload", () => {
    it("should generate unique filename", () => {
      const originalName = "test.mp3";
      const expectedName = "test_123.mp3";

      mockGenerateUniqueFilename.mockReturnValue(expectedName);

      const result = generateUniqueFilenameForUpload(originalName);

      expect(result).toBe(expectedName);
      expect(mockGenerateUniqueFilename).toHaveBeenCalledWith(originalName);
    });
  });

  describe("validateAudioFileFormat", () => {
    it("should validate audio format", () => {
      const audioUri = "test.mp3";

      mockIsValidAudioFormat.mockReturnValue(true);

      const result = validateAudioFileFormat(audioUri);

      expect(result).toBe(true);
      expect(mockIsValidAudioFormat).toHaveBeenCalledWith(audioUri);
    });
  });

  describe("createAudioUploadData", () => {
    it("should create audio upload data correctly", () => {
      const audioUri = "test.mp3";
      const duration = 10;
      const averageLevel = 0.5;
      const whisperPercentage = 0.8;

      const result = createAudioUploadData(
        audioUri,
        duration,
        averageLevel,
        whisperPercentage
      );

      expect(result).toEqual({
        uri: audioUri,
        duration,
        volume: averageLevel,
        isWhisper: true, // 0.8 > 0.5
        timestamp: expect.any(Date),
      });
    });

    it("should set isWhisper to false when percentage is low", () => {
      const audioUri = "test.mp3";
      const duration = 10;
      const averageLevel = 0.5;
      const whisperPercentage = 0.3;

      const result = createAudioUploadData(
        audioUri,
        duration,
        averageLevel,
        whisperPercentage
      );

      expect(result.isWhisper).toBe(false);
    });
  });

  describe("createWhisperData", () => {
    it("should create whisper data correctly", () => {
      const audioUrl = "https://storage.example.com/audio.mp3";
      const duration = 10;
      const whisperPercentage = 0.8;
      const averageLevel = 0.5;
      const confidence = 0.9;
      const transcription = "Hello world";
      const moderationResult = {
        status: ModerationStatus.APPROVED,
        contentRank: ContentRank.G,
        isMinorSafe: true,
        violations: [],
        confidence: 0.9,
        moderationTime: 100,
        apiResults: {},
        reputationImpact: 0,
        appealable: false,
      };

      const result = createWhisperData(
        audioUrl,
        duration,
        whisperPercentage,
        averageLevel,
        confidence,
        transcription,
        moderationResult
      );

      expect(result).toEqual({
        audioUrl,
        duration,
        whisperPercentage,
        averageLevel,
        confidence,
        transcription,
        moderationResult,
      });
    });
  });

  describe("createAgeVerificationData", () => {
    it("should create age verification data with age", () => {
      const userAge = 25;

      const result = createAgeVerificationData(userAge);

      expect(result).toEqual({
        age: userAge,
        dateOfBirth: undefined,
      });
    });

    it("should create age verification data with date of birth", () => {
      const dateOfBirth = new Date("1995-01-01");

      const result = createAgeVerificationData(undefined, dateOfBirth);

      expect(result).toEqual({
        age: undefined,
        dateOfBirth,
      });
    });
  });

  describe("createModerationData", () => {
    it("should create moderation data correctly", () => {
      const text = "Hello world";
      const userId = "user123";
      const age = 25;

      const result = createModerationData(text, userId, age);

      expect(result).toEqual({
        text,
        userId,
        age,
      });
    });
  });

  describe("handleUploadError", () => {
    it("should re-throw Error instances", () => {
      const error = new Error("Test error");
      const context = "test";

      expect(() => handleUploadError(error, context)).toThrow("Test error");
      expect(console.error).toHaveBeenCalledWith("❌ Error in test:", error);
    });

    it("should wrap non-Error objects", () => {
      const error = "String error";
      const context = "test";

      expect(() => handleUploadError(error, context)).toThrow(
        "Unknown error in test: String error"
      );
    });
  });

  describe("logUploadProgress", () => {
    it("should log progress with percentage", () => {
      const stage = "Uploading";
      const progress = 50.5;
      const additionalInfo = "test info";

      logUploadProgress(stage, progress, additionalInfo);

      expect(console.log).toHaveBeenCalledWith(
        "📊 Uploading (50.5%) - test info"
      );
    });

    it("should log progress without percentage", () => {
      const stage = "Starting";

      logUploadProgress(stage);

      expect(console.log).toHaveBeenCalledWith("📊 Starting");
    });
  });

  describe("validateUploadData", () => {
    it("should not throw for valid data", () => {
      const uploadData = {
        audioUri: "test.mp3",
        duration: 10,
        whisperPercentage: 0.8,
        averageLevel: 0.5,
        confidence: 0.9,
        userAge: 25,
      };

      expect(() => validateUploadData(uploadData)).not.toThrow();
    });

    it("should throw when audioUri is missing", () => {
      const uploadData = {
        audioUri: "",
        duration: 10,
        whisperPercentage: 0.8,
        averageLevel: 0.5,
        confidence: 0.9,
        userAge: 25,
      };

      expect(() => validateUploadData(uploadData)).toThrow(
        "Audio URI is required"
      );
    });

    it("should throw when duration is invalid", () => {
      const uploadData = {
        audioUri: "test.mp3",
        duration: 0,
        whisperPercentage: 0.8,
        averageLevel: 0.5,
        confidence: 0.9,
        userAge: 25,
      };

      expect(() => validateUploadData(uploadData)).toThrow(
        "Duration must be greater than 0"
      );
    });

    it("should throw when whisperPercentage is invalid", () => {
      const uploadData = {
        audioUri: "test.mp3",
        duration: 10,
        whisperPercentage: 1.5,
        averageLevel: 0.5,
        confidence: 0.9,
        userAge: 25,
      };

      expect(() => validateUploadData(uploadData)).toThrow(
        "Whisper percentage must be between 0 and 1"
      );
    });

    it("should throw when averageLevel is negative", () => {
      const uploadData = {
        audioUri: "test.mp3",
        duration: 10,
        whisperPercentage: 0.8,
        averageLevel: -0.5,
        confidence: 0.9,
        userAge: 25,
      };

      expect(() => validateUploadData(uploadData)).toThrow(
        "Average level must be non-negative"
      );
    });

    it("should throw when confidence is invalid", () => {
      const uploadData = {
        audioUri: "test.mp3",
        duration: 10,
        whisperPercentage: 0.8,
        averageLevel: 0.5,
        confidence: 1.5,
        userAge: 25,
      };

      expect(() => validateUploadData(uploadData)).toThrow(
        "Confidence must be between 0 and 1"
      );
    });

    it("should throw when neither userAge nor dateOfBirth is provided", () => {
      const uploadData = {
        audioUri: "test.mp3",
        duration: 10,
        whisperPercentage: 0.8,
        averageLevel: 0.5,
        confidence: 0.9,
      };

      expect(() => validateUploadData(uploadData)).toThrow(
        "Either userAge or dateOfBirth is required"
      );
    });
  });

  describe("Constants", () => {
    it("should export error messages", () => {
      expect(UPLOAD_ERROR_MESSAGES).toBeDefined();
      expect(UPLOAD_ERROR_MESSAGES.USER_NOT_AUTHENTICATED).toBe(
        "User not authenticated"
      );
      expect(UPLOAD_ERROR_MESSAGES.INVALID_AUDIO_FORMAT).toBe(
        "Invalid audio file format"
      );
    });

    it("should export success messages", () => {
      expect(UPLOAD_SUCCESS_MESSAGES).toBeDefined();
      expect(UPLOAD_SUCCESS_MESSAGES.AUDIO_UPLOADED).toBe(
        "Audio uploaded successfully"
      );
      expect(UPLOAD_SUCCESS_MESSAGES.WHISPER_CREATED).toBe(
        "Whisper created successfully"
      );
    });
  });
});
