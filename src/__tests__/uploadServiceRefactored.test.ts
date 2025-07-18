/**
 * Tests for refactored UploadService
 */

import { UploadService, getUploadService } from "../services/uploadService";
import * as uploadUtils from "../utils/uploadUtils";
import { ModerationStatus, ContentRank } from "../types";
import { AnonymousUser } from "../services/authService";

// Mock uploadUtils
jest.mock("../utils/uploadUtils");

const mockUploadUtils = uploadUtils as jest.Mocked<typeof uploadUtils>;

describe("UploadService", () => {
  let uploadService: UploadService;

  const mockUser: AnonymousUser = {
    uid: "user123",
    displayName: "Test User",
    profileColor: "#FF0000",
    isAnonymous: true,
    createdAt: new Date(),
    lastActiveAt: new Date(),
    whisperCount: 0,
    totalReactions: 0,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();

    // Reset singleton
    UploadService["instance"] = undefined as any;
    uploadService = UploadService.getInstance();
  });

  afterEach(() => {
    // Clean up singleton
    UploadService["instance"] = undefined as any;
  });

  describe("getInstance", () => {
    it("should return singleton instance", () => {
      const instance1 = UploadService.getInstance();
      const instance2 = UploadService.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(UploadService);
    });
  });

  describe("uploadWhisper", () => {
    const mockUploadData = {
      audioUri: "test.mp3",
      duration: 10,
      whisperPercentage: 0.8,
      averageLevel: 0.5,
      confidence: 0.9,
      userAge: 25,
    };

    const mockTranscription = { text: "Hello world" };
    const mockAgeVerification = {
      isVerified: true,
      age: 25,
      isMinor: false,
      verificationMethod: "date_of_birth" as const,
      confidence: 0.7,
      requiresAdditionalVerification: false,
    };
    const mockModerationResult = {
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
    const mockAudioUrl = "https://storage.example.com/audio.mp3";
    const mockWhisperId = "whisper123";

    beforeEach(() => {
      // Setup mock implementations
      mockUploadUtils.validateUploadData.mockImplementation(() => {});
      mockUploadUtils.validateUserAuthentication.mockResolvedValue({
        user: mockUser,
        userId: "user123",
      });
      mockUploadUtils.logUploadProgress.mockImplementation(() => {});
      mockUploadUtils.validateAudioFormat.mockImplementation(() => {});
      mockUploadUtils.createAudioUploadData.mockReturnValue({
        uri: "test.mp3",
        duration: 10,
        volume: 0.5,
        isWhisper: true,
        timestamp: new Date(),
      });
      mockUploadUtils.uploadAudioToStorage.mockResolvedValue(mockAudioUrl);
      mockUploadUtils.transcribeAudio.mockResolvedValue(mockTranscription);
      mockUploadUtils.createAgeVerificationData.mockReturnValue({
        age: 25,
        dateOfBirth: undefined,
      });
      mockUploadUtils.verifyUserAge.mockResolvedValue(mockAgeVerification);
      mockUploadUtils.createModerationData.mockReturnValue({
        text: "Hello world",
        userId: "user123",
        age: 25,
      });
      mockUploadUtils.moderateContent.mockResolvedValue(mockModerationResult);
      mockUploadUtils.createWhisperData.mockReturnValue({
        audioUrl: mockAudioUrl,
        duration: 10,
        whisperPercentage: 0.8,
        averageLevel: 0.5,
        confidence: 0.9,
        transcription: "Hello world",
        moderationResult: mockModerationResult,
      });
      mockUploadUtils.createWhisperDocument.mockResolvedValue(mockWhisperId);
      mockUploadUtils.updateUserReputation.mockResolvedValue();
    });

    it("should upload whisper successfully", async () => {
      const result = await uploadService.uploadWhisper(mockUploadData);

      expect(result).toBe(mockWhisperId);

      // Verify all utility functions were called correctly
      expect(mockUploadUtils.validateUploadData).toHaveBeenCalledWith(
        mockUploadData
      );
      expect(mockUploadUtils.validateUserAuthentication).toHaveBeenCalledTimes(
        1
      );
      expect(mockUploadUtils.logUploadProgress).toHaveBeenCalledWith(
        "Starting whisper upload"
      );
      expect(mockUploadUtils.validateAudioFormat).toHaveBeenCalledWith(
        "test.mp3"
      );
      expect(mockUploadUtils.createAudioUploadData).toHaveBeenCalledWith(
        "test.mp3",
        10,
        0.5,
        0.8
      );
      expect(mockUploadUtils.uploadAudioToStorage).toHaveBeenCalledWith(
        expect.objectContaining({
          uri: "test.mp3",
          duration: 10,
          volume: 0.5,
          isWhisper: true,
        }),
        "user123"
      );
      expect(mockUploadUtils.transcribeAudio).toHaveBeenCalledWith(
        mockAudioUrl
      );
      expect(mockUploadUtils.createAgeVerificationData).toHaveBeenCalledWith(
        25,
        undefined
      );
      expect(mockUploadUtils.verifyUserAge).toHaveBeenCalledWith({
        age: 25,
        dateOfBirth: undefined,
      });
      expect(mockUploadUtils.createModerationData).toHaveBeenCalledWith(
        "Hello world",
        "user123",
        25
      );
      expect(mockUploadUtils.moderateContent).toHaveBeenCalledWith({
        text: "Hello world",
        userId: "user123",
        age: 25,
      });
      expect(mockUploadUtils.createWhisperData).toHaveBeenCalledWith(
        mockAudioUrl,
        10,
        0.8,
        0.5,
        0.9,
        "Hello world",
        mockModerationResult
      );
      expect(mockUploadUtils.createWhisperDocument).toHaveBeenCalledWith(
        "user123",
        "Test User",
        "#FF0000",
        expect.objectContaining({
          audioUrl: mockAudioUrl,
          duration: 10,
          whisperPercentage: 0.8,
          averageLevel: 0.5,
          confidence: 0.9,
          transcription: "Hello world",
          moderationResult: mockModerationResult,
        })
      );
      expect(mockUploadUtils.updateUserReputation).toHaveBeenCalledWith(
        "user123"
      );
    });

    it("should handle reputation update failure gracefully", async () => {
      mockUploadUtils.updateUserReputation.mockRejectedValue(
        new Error("Reputation update failed")
      );

      const result = await uploadService.uploadWhisper(mockUploadData);

      expect(result).toBe(mockWhisperId);
      expect(console.warn).toHaveBeenCalledWith(
        "⚠️ Reputation update failed, but upload completed:",
        expect.any(Error)
      );
    });

    it("should handle upload errors", async () => {
      const error = new Error("Upload failed");
      mockUploadUtils.validateUploadData.mockImplementation(() => {
        throw error;
      });

      await expect(uploadService.uploadWhisper(mockUploadData)).rejects.toThrow(
        "Upload failed"
      );
    });

    it("should handle validation errors", async () => {
      const validationError = new Error("Invalid data");
      mockUploadUtils.validateUploadData.mockImplementation(() => {
        throw validationError;
      });

      await expect(uploadService.uploadWhisper(mockUploadData)).rejects.toThrow(
        "Invalid data"
      );
    });

    it("should handle authentication errors", async () => {
      const authError = new Error("User not authenticated");
      mockUploadUtils.validateUserAuthentication.mockRejectedValue(authError);

      await expect(uploadService.uploadWhisper(mockUploadData)).rejects.toThrow(
        "User not authenticated"
      );
    });

    it("should handle audio format validation errors", async () => {
      const formatError = new Error("Invalid audio format");
      mockUploadUtils.validateAudioFormat.mockImplementation(() => {
        throw formatError;
      });

      await expect(uploadService.uploadWhisper(mockUploadData)).rejects.toThrow(
        "Invalid audio format"
      );
    });

    it("should handle storage upload errors", async () => {
      const storageError = new Error("Storage upload failed");
      mockUploadUtils.uploadAudioToStorage.mockRejectedValue(storageError);

      await expect(uploadService.uploadWhisper(mockUploadData)).rejects.toThrow(
        "Storage upload failed"
      );
    });

    it("should handle transcription errors", async () => {
      const transcriptionError = new Error("Transcription failed");
      mockUploadUtils.transcribeAudio.mockRejectedValue(transcriptionError);

      await expect(uploadService.uploadWhisper(mockUploadData)).rejects.toThrow(
        "Transcription failed"
      );
    });

    it("should handle age verification errors", async () => {
      const ageError = new Error("Age verification failed");
      mockUploadUtils.verifyUserAge.mockRejectedValue(ageError);

      await expect(uploadService.uploadWhisper(mockUploadData)).rejects.toThrow(
        "Age verification failed"
      );
    });

    it("should handle moderation errors", async () => {
      const moderationError = new Error("Content moderation failed");
      mockUploadUtils.moderateContent.mockRejectedValue(moderationError);

      await expect(uploadService.uploadWhisper(mockUploadData)).rejects.toThrow(
        "Content moderation failed"
      );
    });

    it("should handle document creation errors", async () => {
      const documentError = new Error("Document creation failed");
      mockUploadUtils.createWhisperDocument.mockRejectedValue(documentError);

      await expect(uploadService.uploadWhisper(mockUploadData)).rejects.toThrow(
        "Document creation failed"
      );
    });
  });

  describe("deleteWhisper", () => {
    const mockWhisperId = "whisper123";
    const mockWhisper = {
      userId: "user123",
      audioUrl: "https://storage.example.com/audio.mp3",
    };

    beforeEach(() => {
      mockUploadUtils.validateUserAuthentication.mockResolvedValue({
        user: mockUser,
        userId: "user123",
      });
      mockUploadUtils.getWhisperForDeletion.mockResolvedValue({
        whisper: mockWhisper,
        audioUrl: mockWhisper.audioUrl,
      });
      mockUploadUtils.validateWhisperOwnership.mockImplementation(() => {});
      mockUploadUtils.deleteWhisperFromFirestore.mockResolvedValue();
      mockUploadUtils.deleteAudioFromStorage.mockResolvedValue();
    });

    it("should delete whisper successfully", async () => {
      await uploadService.deleteWhisper(mockWhisperId);

      expect(mockUploadUtils.validateUserAuthentication).toHaveBeenCalledTimes(
        1
      );
      expect(mockUploadUtils.getWhisperForDeletion).toHaveBeenCalledWith(
        mockWhisperId
      );
      expect(mockUploadUtils.validateWhisperOwnership).toHaveBeenCalledWith(
        "user123",
        "user123"
      );
      expect(mockUploadUtils.deleteWhisperFromFirestore).toHaveBeenCalledWith(
        mockWhisperId
      );
      expect(mockUploadUtils.deleteAudioFromStorage).toHaveBeenCalledWith(
        mockWhisper.audioUrl
      );
      expect(console.log).toHaveBeenCalledWith(
        "✅ Whisper deleted successfully"
      );
    });

    it("should handle authentication errors", async () => {
      const authError = new Error("User not authenticated");
      mockUploadUtils.validateUserAuthentication.mockRejectedValue(authError);

      await expect(uploadService.deleteWhisper(mockWhisperId)).rejects.toThrow(
        "User not authenticated"
      );
    });

    it("should handle whisper not found errors", async () => {
      const notFoundError = new Error("Whisper not found");
      mockUploadUtils.getWhisperForDeletion.mockRejectedValue(notFoundError);

      await expect(uploadService.deleteWhisper(mockWhisperId)).rejects.toThrow(
        "Whisper not found"
      );
    });

    it("should handle ownership validation errors", async () => {
      const ownershipError = new Error("Not authorized");
      mockUploadUtils.validateWhisperOwnership.mockImplementation(() => {
        throw ownershipError;
      });

      await expect(uploadService.deleteWhisper(mockWhisperId)).rejects.toThrow(
        "Not authorized"
      );
    });

    it("should handle Firestore deletion errors", async () => {
      const firestoreError = new Error("Firestore deletion failed");
      mockUploadUtils.deleteWhisperFromFirestore.mockRejectedValue(
        firestoreError
      );

      await expect(uploadService.deleteWhisper(mockWhisperId)).rejects.toThrow(
        "Firestore deletion failed"
      );
    });

    it("should handle storage deletion errors", async () => {
      const storageError = new Error("Storage deletion failed");
      mockUploadUtils.deleteAudioFromStorage.mockRejectedValue(storageError);

      await expect(uploadService.deleteWhisper(mockWhisperId)).rejects.toThrow(
        "Storage deletion failed"
      );
    });
  });

  describe("updateTranscription", () => {
    const mockWhisperId = "whisper123";
    const mockTranscription = "Updated transcription";

    beforeEach(() => {
      mockUploadUtils.updateWhisperTranscription.mockResolvedValue();
    });

    it("should update transcription successfully", async () => {
      await uploadService.updateTranscription(mockWhisperId, mockTranscription);

      expect(mockUploadUtils.updateWhisperTranscription).toHaveBeenCalledWith(
        mockWhisperId,
        mockTranscription
      );
    });

    it("should handle transcription update errors", async () => {
      const updateError = new Error("Transcription update failed");
      mockUploadUtils.updateWhisperTranscription.mockRejectedValue(updateError);

      await expect(
        uploadService.updateTranscription(mockWhisperId, mockTranscription)
      ).rejects.toThrow("Transcription update failed");
    });
  });
});

describe("getUploadService", () => {
  it("should return UploadService instance", () => {
    const service = getUploadService();
    expect(service).toBeInstanceOf(UploadService);
  });

  it("should return the same instance on multiple calls", () => {
    const service1 = getUploadService();
    const service2 = getUploadService();
    expect(service1).toBe(service2);
  });
});
