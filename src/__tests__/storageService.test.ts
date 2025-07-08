import { StorageService } from "../services/storageService";
import { getStorageInstance } from "../config/firebase";
import { AudioRecording } from "../types";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";

// Declare global for TypeScript
declare const global: any;

// Mock Firebase Storage
jest.mock("../config/firebase", () => ({
  getStorageInstance: jest.fn(),
}));

// Mock Firebase Storage functions
jest.mock("firebase/storage", () => ({
  ref: jest.fn(),
  uploadBytes: jest.fn(),
  getDownloadURL: jest.fn(),
  deleteObject: jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn();

describe("StorageService", () => {
  let mockStorage: any;
  let mockStorageRef: any;
  let mockUploadResult: any;

  const sampleAudioRecording: AudioRecording = {
    uri: "file://test-audio.m4a",
    duration: 30.5,
    volume: 0.85,
    isWhisper: true,
    timestamp: new Date("2023-01-01T12:00:00Z"),
  };

  const sampleUserId = "test-user-123";
  const sampleDownloadURL =
    "https://firebasestorage.googleapis.com/v0/b/test-bucket/o/audio%2Fwhispers%2Ftest-user-123%2F1672574400000.m4a?alt=media&token=abc123";

  beforeEach(() => {
    jest.clearAllMocks();

    mockStorage = {};
    mockStorageRef = {
      bucket: "test-bucket",
      fullPath: "audio/whispers/test-user-123/1672574400000.m4a",
    };
    mockUploadResult = {
      ref: mockStorageRef,
      metadata: {
        bucket: "test-bucket",
        fullPath: "audio/whispers/test-user-123/1672574400000.m4a",
      },
    };

    (getStorageInstance as jest.Mock).mockReturnValue(mockStorage);
    (ref as jest.Mock).mockReturnValue(mockStorageRef);
    (uploadBytes as jest.Mock).mockResolvedValue(mockUploadResult);
    (getDownloadURL as jest.Mock).mockResolvedValue(sampleDownloadURL);
    (deleteObject as jest.Mock).mockResolvedValue(undefined);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      blob: jest
        .fn()
        .mockResolvedValue(new Blob(["audio data"], { type: "audio/m4a" })),
    });
  });

  describe("uploadAudio", () => {
    it("should upload audio file successfully", async () => {
      const result = await StorageService.uploadAudio(
        sampleAudioRecording,
        sampleUserId
      );

      expect(getStorageInstance).toHaveBeenCalled();
      expect(ref).toHaveBeenCalledWith(
        mockStorage,
        expect.stringContaining("audio/whispers/test-user-123/")
      );
      expect(uploadBytes).toHaveBeenCalledWith(
        mockStorageRef,
        expect.any(Blob),
        {
          contentType: "audio/m4a",
          customMetadata: {
            userId: sampleUserId,
            duration: "30.5",
            volume: "0.85",
            isWhisper: "true",
            timestamp: sampleAudioRecording.timestamp.toISOString(),
          },
        }
      );
      expect(getDownloadURL).toHaveBeenCalledWith(mockStorageRef);
      expect(result).toBe(sampleDownloadURL);
    });

    it("should create unique filename with timestamp", async () => {
      const timestamp = Date.now();
      jest.spyOn(Date, "now").mockReturnValue(timestamp);

      await StorageService.uploadAudio(sampleAudioRecording, sampleUserId);

      expect(ref).toHaveBeenCalledWith(
        mockStorage,
        `audio/whispers/${sampleUserId}/${timestamp}.m4a`
      );
    });

    it("should handle fetch blob conversion", async () => {
      const mockBlob = new Blob(["audio data"], { type: "audio/m4a" });
      (global.fetch as jest.Mock).mockResolvedValue({
        blob: jest.fn().mockResolvedValue(mockBlob),
      });

      await StorageService.uploadAudio(sampleAudioRecording, sampleUserId);

      expect(global.fetch).toHaveBeenCalledWith(sampleAudioRecording.uri);
      expect(uploadBytes).toHaveBeenCalledWith(
        mockStorageRef,
        mockBlob,
        expect.any(Object)
      );
    });

    it("should handle upload errors", async () => {
      const error = new Error("Upload failed");
      (uploadBytes as jest.Mock).mockRejectedValue(error);

      await expect(
        StorageService.uploadAudio(sampleAudioRecording, sampleUserId)
      ).rejects.toThrow("Failed to upload audio file");
    });

    it("should handle fetch errors", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

      await expect(
        StorageService.uploadAudio(sampleAudioRecording, sampleUserId)
      ).rejects.toThrow("Failed to upload audio file");
    });

    it("should handle getDownloadURL errors", async () => {
      (getDownloadURL as jest.Mock).mockRejectedValue(
        new Error("URL generation failed")
      );

      await expect(
        StorageService.uploadAudio(sampleAudioRecording, sampleUserId)
      ).rejects.toThrow("Failed to upload audio file");
    });
  });

  describe("deleteAudio", () => {
    it("should delete audio file successfully", async () => {
      await StorageService.deleteAudio(sampleDownloadURL);

      expect(getStorageInstance).toHaveBeenCalled();
      expect(ref).toHaveBeenCalledWith(
        mockStorage,
        "audio/whispers/test-user-123/1672574400000.m4a"
      );
      expect(deleteObject).toHaveBeenCalledWith(mockStorageRef);
    });

    it("should extract path from Firebase Storage URL", async () => {
      const firebaseURL =
        "https://firebasestorage.googleapis.com/v0/b/test-bucket/o/audio%2Fwhispers%2Ftest-user-123%2F1672574400000.m4a?alt=media&token=abc123";

      await StorageService.deleteAudio(firebaseURL);

      expect(ref).toHaveBeenCalledWith(
        mockStorage,
        "audio/whispers/test-user-123/1672574400000.m4a"
      );
    });

    it("should handle invalid audio URL", async () => {
      const invalidURL = "https://example.com/invalid-url";

      await expect(StorageService.deleteAudio(invalidURL)).rejects.toThrow(
        "Failed to delete audio file"
      );
    });

    it("should handle malformed URL", async () => {
      const malformedURL = "not-a-url";

      await expect(StorageService.deleteAudio(malformedURL)).rejects.toThrow(
        "Failed to delete audio file"
      );
    });

    it("should handle delete errors", async () => {
      const error = new Error("Delete failed");
      (deleteObject as jest.Mock).mockRejectedValue(error);

      await expect(
        StorageService.deleteAudio(sampleDownloadURL)
      ).rejects.toThrow("Failed to delete audio file");
    });

    it("should handle URL with special characters", async () => {
      const urlWithSpecialChars =
        "https://firebasestorage.googleapis.com/v0/b/test-bucket/o/audio%2Fwhispers%2Ftest%20user%2Ffile%20with%20spaces.m4a?alt=media&token=abc123";

      await StorageService.deleteAudio(urlWithSpecialChars);

      expect(ref).toHaveBeenCalledWith(
        mockStorage,
        "audio/whispers/test user/file with spaces.m4a"
      );
    });
  });

  describe("getAudioDownloadURL", () => {
    it("should get download URL successfully", async () => {
      const storagePath = "audio/whispers/test-user-123/1672574400000.m4a";

      const result = await StorageService.getAudioDownloadURL(storagePath);

      expect(getStorageInstance).toHaveBeenCalled();
      expect(ref).toHaveBeenCalledWith(mockStorage, storagePath);
      expect(getDownloadURL).toHaveBeenCalledWith(mockStorageRef);
      expect(result).toBe(sampleDownloadURL);
    });

    it("should handle getDownloadURL errors", async () => {
      const error = new Error("URL generation failed");
      (getDownloadURL as jest.Mock).mockRejectedValue(error);

      await expect(
        StorageService.getAudioDownloadURL("test-path")
      ).rejects.toThrow("Failed to get download URL");
    });
  });

  describe("refreshAudioDownloadURL", () => {
    it("should refresh download URL successfully", async () => {
      const result = await StorageService.refreshAudioDownloadURL(
        sampleDownloadURL
      );

      expect(getStorageInstance).toHaveBeenCalled();
      expect(ref).toHaveBeenCalledWith(
        mockStorage,
        "audio/whispers/test-user-123/1672574400000.m4a"
      );
      expect(getDownloadURL).toHaveBeenCalledWith(mockStorageRef);
      expect(result).toBe(sampleDownloadURL);
    });

    it("should handle invalid audio URL", async () => {
      const invalidURL = "https://example.com/invalid-url";

      await expect(
        StorageService.refreshAudioDownloadURL(invalidURL)
      ).rejects.toThrow("Failed to refresh download URL");
    });

    it("should handle malformed URL", async () => {
      const malformedURL = "not-a-url";

      await expect(
        StorageService.refreshAudioDownloadURL(malformedURL)
      ).rejects.toThrow("Failed to refresh download URL");
    });

    it("should handle refresh errors", async () => {
      const error = new Error("Refresh failed");
      (getDownloadURL as jest.Mock).mockRejectedValue(error);

      await expect(
        StorageService.refreshAudioDownloadURL(sampleDownloadURL)
      ).rejects.toThrow("Failed to refresh download URL");
    });

    it("should handle URL with query parameters", async () => {
      const urlWithParams =
        "https://firebasestorage.googleapis.com/v0/b/test-bucket/o/audio%2Fwhispers%2Ftest-user-123%2F1672574400000.m4a?alt=media&token=abc123&other=param";

      await StorageService.refreshAudioDownloadURL(urlWithParams);

      expect(ref).toHaveBeenCalledWith(
        mockStorage,
        "audio/whispers/test-user-123/1672574400000.m4a"
      );
    });
  });

  describe("isAudioUrlValid", () => {
    it("should return true for valid URL", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
      });

      const result = await StorageService.isAudioUrlValid(sampleDownloadURL);

      expect(global.fetch).toHaveBeenCalledWith(sampleDownloadURL, {
        method: "HEAD",
      });
      expect(result).toBe(true);
    });

    it("should return false for invalid URL", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
      });

      const result = await StorageService.isAudioUrlValid(sampleDownloadURL);

      expect(result).toBe(false);
    });

    it("should return false for network errors", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

      const result = await StorageService.isAudioUrlValid(sampleDownloadURL);

      expect(result).toBe(false);
    });

    it("should return false for fetch errors", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Fetch failed"));

      const result = await StorageService.isAudioUrlValid(sampleDownloadURL);

      expect(result).toBe(false);
    });

    it("should handle 404 responses", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await StorageService.isAudioUrlValid(sampleDownloadURL);

      expect(result).toBe(false);
    });

    it("should handle 403 responses", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 403,
      });

      const result = await StorageService.isAudioUrlValid(sampleDownloadURL);

      expect(result).toBe(false);
    });
  });

  describe("URL Path Extraction", () => {
    it("should handle various Firebase Storage URL formats", async () => {
      const testCases = [
        {
          url: "https://firebasestorage.googleapis.com/v0/b/test-bucket/o/audio%2Fwhispers%2Ftest.m4a?alt=media&token=abc123",
          expectedPath: "audio/whispers/test.m4a",
        },
        {
          url: "https://firebasestorage.googleapis.com/v0/b/test-bucket/o/audio%2Fwhispers%2Ftest%20file.m4a?alt=media",
          expectedPath: "audio/whispers/test file.m4a",
        },
        {
          url: "https://firebasestorage.googleapis.com/v0/b/test-bucket/o/audio%2Fwhispers%2Ftest-file.m4a",
          expectedPath: "audio/whispers/test-file.m4a",
        },
      ];

      for (const { url, expectedPath } of testCases) {
        jest.clearAllMocks();

        await StorageService.deleteAudio(url);

        expect(ref).toHaveBeenCalledWith(mockStorage, expectedPath);
      }
    });

    it("should handle URL encoding correctly", async () => {
      const encodedURL =
        "https://firebasestorage.googleapis.com/v0/b/test-bucket/o/audio%2Fwhispers%2Ftest%20user%2Ffile%20with%20spaces%20and%20%26%20symbols.m4a?alt=media&token=abc123";

      await StorageService.deleteAudio(encodedURL);

      expect(ref).toHaveBeenCalledWith(
        mockStorage,
        "audio/whispers/test user/file with spaces and & symbols.m4a"
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle storage instance errors", async () => {
      (getStorageInstance as jest.Mock).mockImplementation(() => {
        throw new Error("Storage not initialized");
      });

      await expect(
        StorageService.uploadAudio(sampleAudioRecording, sampleUserId)
      ).rejects.toThrow("Failed to upload audio file");
    });

    it("should handle ref creation errors", async () => {
      (ref as jest.Mock).mockImplementation(() => {
        throw new Error("Invalid reference");
      });

      await expect(
        StorageService.uploadAudio(sampleAudioRecording, sampleUserId)
      ).rejects.toThrow("Failed to upload audio file");
    });

    it("should handle blob creation errors", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        blob: jest.fn().mockRejectedValue(new Error("Blob creation failed")),
      });

      await expect(
        StorageService.uploadAudio(sampleAudioRecording, sampleUserId)
      ).rejects.toThrow("Failed to upload audio file");
    });
  });

  describe("Metadata Handling", () => {
    it("should include all required metadata in upload", async () => {
      await StorageService.uploadAudio(sampleAudioRecording, sampleUserId);

      expect(uploadBytes).toHaveBeenCalledWith(
        mockStorageRef,
        expect.any(Blob),
        {
          contentType: "audio/m4a",
          customMetadata: {
            userId: sampleUserId,
            duration: sampleAudioRecording.duration.toString(),
            volume: sampleAudioRecording.volume.toString(),
            isWhisper: sampleAudioRecording.isWhisper.toString(),
            timestamp: sampleAudioRecording.timestamp.toISOString(),
          },
        }
      );
    });

    it("should handle different audio recording properties", async () => {
      const customRecording: AudioRecording = {
        uri: "file://custom-audio.m4a",
        duration: 45.2,
        volume: 0.3,
        isWhisper: false,
        timestamp: new Date("2023-06-15T10:30:00Z"),
      };

      await StorageService.uploadAudio(customRecording, sampleUserId);

      expect(uploadBytes).toHaveBeenCalledWith(
        mockStorageRef,
        expect.any(Blob),
        {
          contentType: "audio/m4a",
          customMetadata: {
            userId: sampleUserId,
            duration: "45.2",
            volume: "0.3",
            isWhisper: "false",
            timestamp: customRecording.timestamp.toISOString(),
          },
        }
      );
    });
  });
});
