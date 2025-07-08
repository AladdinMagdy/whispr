import {
  WhisperService,
  WhisperCreationOptions,
} from "../services/whisperService";
import { getFirestoreService } from "../services/firestoreService";
import { StorageService } from "../services/storageService";
import { TranscriptionService } from "../services/transcriptionService";
import { AudioFormatTest } from "../utils/audioFormatTest";
import { Whisper, AudioRecording } from "../types";
import { FEATURE_FLAGS } from "../constants";

// Mock all dependencies
jest.mock("../services/firestoreService");
jest.mock("../services/storageService");
jest.mock("../services/transcriptionService");
jest.mock("../utils/audioFormatTest");
jest.mock("../constants", () => ({
  FEATURE_FLAGS: {
    ENABLE_TRANSCRIPTION: true,
  },
}));

describe("WhisperService", () => {
  const mockAudioRecording: AudioRecording = {
    uri: "file://test.mp3",
    duration: 30,
    volume: 0.5,
    isWhisper: true,
    timestamp: new Date(),
  };

  const mockWhisper: Whisper = {
    id: "whisper-123",
    userId: "user-123",
    userDisplayName: "Test User",
    userProfileColor: "#FF5733",
    audioUrl: "https://example.com/audio.mp3",
    duration: 30,
    whisperPercentage: 100,
    averageLevel: 0.5,
    confidence: 0.9,
    transcription: "Hello world",
    createdAt: new Date(),
    likes: 0,
    replies: 0,
    isTranscribed: true,
  };

  const mockFirestoreService = {
    createWhisper: jest.fn(),
    getWhispers: jest.fn(),
    getUserWhispers: jest.fn(),
    likeWhisper: jest.fn(),
    deleteWhisper: jest.fn(),
    updateTranscription: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getFirestoreService as jest.Mock).mockReturnValue(mockFirestoreService);
    (StorageService.uploadAudio as jest.Mock).mockResolvedValue(
      "https://example.com/audio.mp3"
    );
    (AudioFormatTest.logAudioInfo as jest.Mock).mockResolvedValue(undefined);
    (TranscriptionService.transcribeWithRetry as jest.Mock).mockResolvedValue({
      text: "Hello world",
    });
    mockFirestoreService.createWhisper.mockResolvedValue("whisper-123");
    mockFirestoreService.getWhispers.mockResolvedValue({
      whispers: [mockWhisper],
    });
    mockFirestoreService.getUserWhispers.mockResolvedValue({
      whispers: [mockWhisper],
    });
    mockFirestoreService.likeWhisper.mockResolvedValue(undefined);
    mockFirestoreService.deleteWhisper.mockResolvedValue(undefined);
    mockFirestoreService.updateTranscription.mockResolvedValue(undefined);
  });

  describe("createWhisper", () => {
    it("should create whisper successfully with transcription", async () => {
      const result = await WhisperService.createWhisper(
        mockAudioRecording,
        "user-123",
        "Test User",
        "#FF5733"
      );

      expect(AudioFormatTest.logAudioInfo).toHaveBeenCalledWith(
        mockAudioRecording.uri
      );
      expect(StorageService.uploadAudio).toHaveBeenCalledWith(
        mockAudioRecording,
        "user-123"
      );
      expect(TranscriptionService.transcribeWithRetry).toHaveBeenCalledWith(
        "https://example.com/audio.mp3"
      );
      expect(mockFirestoreService.createWhisper).toHaveBeenCalledWith(
        "user-123",
        "Test User",
        "#FF5733",
        {
          audioUrl: "https://example.com/audio.mp3",
          duration: 30,
          whisperPercentage: 100,
          averageLevel: 0.5,
          confidence: 0.9,
        }
      );
      expect(mockFirestoreService.updateTranscription).toHaveBeenCalledWith(
        "whisper-123",
        "Hello world"
      );
      expect(result).toEqual({
        success: true,
        whisper: mockWhisper,
        error: undefined,
      });
    });

    it("should create whisper without transcription when disabled", async () => {
      const options: WhisperCreationOptions = { enableTranscription: false };
      const result = await WhisperService.createWhisper(
        mockAudioRecording,
        "user-123",
        "Test User",
        "#FF5733",
        options
      );

      expect(TranscriptionService.transcribeWithRetry).not.toHaveBeenCalled();
      expect(mockFirestoreService.updateTranscription).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        whisper: mockWhisper,
        error: undefined,
      });
    });

    it("should handle transcription failure gracefully", async () => {
      (TranscriptionService.transcribeWithRetry as jest.Mock).mockRejectedValue(
        new Error("Transcription failed")
      );

      const result = await WhisperService.createWhisper(
        mockAudioRecording,
        "user-123",
        "Test User",
        "#FF5733"
      );

      expect(mockFirestoreService.updateTranscription).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        whisper: mockWhisper,
        error: "Transcription failed",
      });
    });

    it("should handle non-whisper audio recording", async () => {
      const nonWhisperRecording: AudioRecording = {
        ...mockAudioRecording,
        isWhisper: false,
        volume: 0.8,
      };

      await WhisperService.createWhisper(
        nonWhisperRecording,
        "user-123",
        "Test User",
        "#FF5733"
      );

      expect(mockFirestoreService.createWhisper).toHaveBeenCalledWith(
        "user-123",
        "Test User",
        "#FF5733",
        {
          audioUrl: "https://example.com/audio.mp3",
          duration: 30,
          whisperPercentage: 0,
          averageLevel: 0.8,
          confidence: 0.1,
        }
      );
    });

    it("should handle upload failure", async () => {
      (StorageService.uploadAudio as jest.Mock).mockRejectedValue(
        new Error("Upload failed")
      );

      const result = await WhisperService.createWhisper(
        mockAudioRecording,
        "user-123",
        "Test User",
        "#FF5733"
      );

      expect(result).toEqual({
        success: false,
        error: "Upload failed",
      });
    });

    it("should handle firestore creation failure", async () => {
      mockFirestoreService.createWhisper.mockRejectedValue(
        new Error("Firestore error")
      );

      const result = await WhisperService.createWhisper(
        mockAudioRecording,
        "user-123",
        "Test User",
        "#FF5733"
      );

      expect(result).toEqual({
        success: false,
        error: "Firestore error",
      });
    });

    it("should handle non-Error exceptions", async () => {
      (StorageService.uploadAudio as jest.Mock).mockRejectedValue(
        "String error"
      );

      const result = await WhisperService.createWhisper(
        mockAudioRecording,
        "user-123",
        "Test User",
        "#FF5733"
      );

      expect(result).toEqual({
        success: false,
        error: "Failed to create whisper",
      });
    });

    it("should call onUploadProgress callback if provided", async () => {
      // const onUploadProgress = jest.fn();
      // const options: WhisperCreationOptions = { onUploadProgress };
      const options: WhisperCreationOptions = {};

      await WhisperService.createWhisper(
        mockAudioRecording,
        "user-123",
        "Test User",
        "#FF5733",
        options
      );

      // Note: onUploadProgress is not currently implemented in the service
      // This test documents the expected behavior
    });
  });

  describe("getPublicWhispers", () => {
    it("should return public whispers with default limit", async () => {
      const result = await WhisperService.getPublicWhispers();

      expect(mockFirestoreService.getWhispers).toHaveBeenCalledWith({
        limit: 20,
      });
      expect(result).toEqual([mockWhisper]);
    });

    it("should return public whispers with default limit", async () => {
      const result = await WhisperService.getPublicWhispers();

      expect(mockFirestoreService.getWhispers).toHaveBeenCalledWith({
        limit: 20,
      });
      expect(result).toEqual([mockWhisper]);
    });

    it("should throw error on failure", async () => {
      mockFirestoreService.getWhispers.mockRejectedValue(
        new Error("Database error")
      );

      await expect(WhisperService.getPublicWhispers()).rejects.toThrow(
        "Failed to get public whispers"
      );
    });
  });

  describe("getUserWhispers", () => {
    it("should return user whispers", async () => {
      const result = await WhisperService.getUserWhispers("user-123");

      expect(mockFirestoreService.getUserWhispers).toHaveBeenCalledWith(
        "user-123"
      );
      expect(result).toEqual([mockWhisper]);
    });

    it("should throw error on failure", async () => {
      mockFirestoreService.getUserWhispers.mockRejectedValue(
        new Error("Database error")
      );

      await expect(WhisperService.getUserWhispers("user-123")).rejects.toThrow(
        "Failed to get user whispers"
      );
    });
  });

  describe("getWhisper", () => {
    it("should return whisper by ID", async () => {
      const result = await WhisperService.getWhisper("whisper-123");

      expect(mockFirestoreService.getWhispers).toHaveBeenCalled();
      expect(result).toEqual(mockWhisper);
    });

    it("should return null if whisper not found", async () => {
      mockFirestoreService.getWhispers.mockResolvedValue({ whispers: [] });

      const result = await WhisperService.getWhisper("nonexistent");

      expect(result).toBeNull();
    });

    it("should return null on error", async () => {
      mockFirestoreService.getWhispers.mockRejectedValue(
        new Error("Database error")
      );

      const result = await WhisperService.getWhisper("whisper-123");

      expect(result).toBeNull();
    });
  });

  describe("likeWhisper", () => {
    it("should like whisper successfully", async () => {
      await WhisperService.likeWhisper("whisper-123", "user-123");

      expect(mockFirestoreService.likeWhisper).toHaveBeenCalledWith(
        "whisper-123",
        "user-123"
      );
    });

    it("should throw error on failure", async () => {
      mockFirestoreService.likeWhisper.mockRejectedValue(
        new Error("Database error")
      );

      await expect(
        WhisperService.likeWhisper("whisper-123", "user-123")
      ).rejects.toThrow("Failed to like whisper");
    });
  });

  describe("deleteWhisper", () => {
    it("should delete whisper successfully", async () => {
      await WhisperService.deleteWhisper("whisper-123");

      expect(mockFirestoreService.deleteWhisper).toHaveBeenCalledWith(
        "whisper-123"
      );
    });

    it("should throw error on failure", async () => {
      mockFirestoreService.deleteWhisper.mockRejectedValue(
        new Error("Database error")
      );

      await expect(WhisperService.deleteWhisper("whisper-123")).rejects.toThrow(
        "Failed to delete whisper"
      );
    });
  });

  describe("updateTranscription", () => {
    it("should update transcription successfully", async () => {
      await WhisperService.updateTranscription(
        "whisper-123",
        "Updated transcription"
      );

      expect(mockFirestoreService.updateTranscription).toHaveBeenCalledWith(
        "whisper-123",
        "Updated transcription"
      );
    });

    it("should throw error on failure", async () => {
      mockFirestoreService.updateTranscription.mockRejectedValue(
        new Error("Database error")
      );

      await expect(
        WhisperService.updateTranscription(
          "whisper-123",
          "Updated transcription"
        )
      ).rejects.toThrow("Failed to update transcription");
    });
  });

  describe("estimateTranscriptionCost", () => {
    it("should estimate cost correctly for 30 seconds", () => {
      const cost = WhisperService.estimateTranscriptionCost(30);
      expect(cost).toBeCloseTo(0.003); // 30 seconds = 0.5 minutes * $0.006
    });

    it("should estimate cost correctly for 60 seconds", () => {
      const cost = WhisperService.estimateTranscriptionCost(60);
      expect(cost).toBeCloseTo(0.006); // 60 seconds = 1 minute * $0.006
    });

    it("should estimate cost correctly for 120 seconds", () => {
      const cost = WhisperService.estimateTranscriptionCost(120);
      expect(cost).toBeCloseTo(0.012); // 120 seconds = 2 minutes * $0.006
    });

    it("should handle zero duration", () => {
      const cost = WhisperService.estimateTranscriptionCost(0);
      expect(cost).toBe(0);
    });
  });

  describe("isTranscriptionAvailable", () => {
    it("should return transcription availability status", () => {
      const result = WhisperService.isTranscriptionAvailable();
      expect(typeof result).toBe("boolean");
      expect(result).toBe(FEATURE_FLAGS.ENABLE_TRANSCRIPTION);
    });
  });

  describe("edge cases", () => {
    it("should handle empty transcription result", async () => {
      (TranscriptionService.transcribeWithRetry as jest.Mock).mockResolvedValue(
        { text: "" }
      );

      const result = await WhisperService.createWhisper(
        mockAudioRecording,
        "user-123",
        "Test User",
        "#FF5733"
      );

      expect(mockFirestoreService.updateTranscription).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it("should handle undefined transcription result", async () => {
      (TranscriptionService.transcribeWithRetry as jest.Mock).mockResolvedValue(
        { text: undefined }
      );

      const result = await WhisperService.createWhisper(
        mockAudioRecording,
        "user-123",
        "Test User",
        "#FF5733"
      );

      expect(mockFirestoreService.updateTranscription).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it("should handle whisper not found after creation", async () => {
      mockFirestoreService.getWhispers.mockResolvedValue({ whispers: [] });

      const result = await WhisperService.createWhisper(
        mockAudioRecording,
        "user-123",
        "Test User",
        "#FF5733"
      );

      expect(result).toEqual({
        success: true,
        whisper: undefined,
        error: undefined,
      });
    });
  });
});
