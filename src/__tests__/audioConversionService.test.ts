import { AudioConversionService } from "../services/audioConversionService";
import * as fileUtils from "../utils/fileUtils";
import * as FileSystem from "expo-file-system";

// Mock expo-file-system
jest.mock("expo-file-system", () => ({
  getInfoAsync: jest.fn(),
}));

describe("AudioConversionService", () => {
  const mockFileInfo = {
    exists: true,
    size: 1024 * 100, // 100KB
    uri: "file://test.mp3",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue(mockFileInfo);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("convertForTranscription", () => {
    it("should return original URI if already compatible format", async () => {
      const audioUri = "file://test.mp3";
      const result = await AudioConversionService.convertForTranscription(
        audioUri
      );
      expect(result).toBe(audioUri);
    });

    it("should return original URI for incompatible format (not implemented yet)", async () => {
      const audioUri = "file://test.xyz";
      const result = await AudioConversionService.convertForTranscription(
        audioUri
      );
      expect(result).toBe(audioUri);
    });

    it("should handle conversion options", async () => {
      const audioUri = "file://test.wav";
      const result = await AudioConversionService.convertForTranscription(
        audioUri
      );
      expect(result).toBe(audioUri);
    });

    it("should return original URI on error", async () => {
      const audioUri = "file://test.mp3";
      // Mock isCompatibleFormat to throw
      const spy = jest.spyOn(AudioConversionService, "isCompatibleFormat");
      spy.mockRejectedValue(new Error("Test error"));

      const result = await AudioConversionService.convertForTranscription(
        audioUri
      );
      expect(result).toBe(audioUri);

      spy.mockRestore();
    });
  });

  describe("isCompatibleFormat", () => {
    const supportedFormats = [
      "flac",
      "m4a",
      "mp3",
      "mp4",
      "mpeg",
      "mpga",
      "oga",
      "ogg",
      "wav",
      "webm",
    ];

    it.each(supportedFormats)(
      "should return true for supported format: %s",
      async (format) => {
        const audioUri = `file://test.${format}`;
        const result = await AudioConversionService.isCompatibleFormat(
          audioUri
        );
        expect(result).toBe(true);
      }
    );

    it("should return false for unsupported format", async () => {
      const audioUri = "file://test.xyz";
      const result = await AudioConversionService.isCompatibleFormat(audioUri);
      expect(result).toBe(false);
    });

    it("should handle URLs with query parameters", async () => {
      const audioUri = "https://example.com/audio.mp3?token=abc123";
      const result = await AudioConversionService.isCompatibleFormat(audioUri);
      expect(result).toBe(true);
    });

    it("should handle URLs without extension", async () => {
      const audioUri = "https://example.com/audio";
      const result = await AudioConversionService.isCompatibleFormat(audioUri);
      expect(result).toBe(false);
    });

    it("should handle case insensitive extensions", async () => {
      const audioUri = "file://test.MP3";
      const result = await AudioConversionService.isCompatibleFormat(audioUri);
      expect(result).toBe(true);
    });

    it("should return false on error", async () => {
      // Mock extractFileExtension to throw
      const spy = jest.spyOn(fileUtils, "extractFileExtension");
      spy.mockImplementation(() => {
        throw new Error("Test error");
      });

      const audioUri = "file://test.mp3";
      const result = await AudioConversionService.isCompatibleFormat(audioUri);
      expect(result).toBe(false);
      spy.mockRestore();
    });
  });

  describe("extractFileExtension", () => {
    it("should extract extension from simple URL", () => {
      const result = fileUtils.extractFileExtension("file://test.mp3");
      expect(result).toBe("mp3");
    });

    it("should handle URLs with query parameters", () => {
      const result = fileUtils.extractFileExtension(
        "https://example.com/audio.mp3?token=abc"
      );
      expect(result).toBe("mp3");
    });

    it("should handle URLs with multiple dots", () => {
      const result = fileUtils.extractFileExtension("file://my.audio.file.mp3");
      expect(result).toBe("mp3");
    });

    it("should return empty string for URLs without extension", () => {
      const result = fileUtils.extractFileExtension(
        "https://example.com/audio"
      );
      expect(result).toBe("");
    });

    it("should return empty string for URLs ending with dot", () => {
      const result = fileUtils.extractFileExtension("file://test.");
      expect(result).toBe("");
    });

    it("should handle case and return lowercase", () => {
      const result = fileUtils.extractFileExtension("file://test.MP3");
      expect(result).toBe("mp3");
    });

    it("should return empty string on error", () => {
      const result = fileUtils.extractFileExtension(null as any);
      expect(result).toBe("");
    });
  });

  describe("getAudioMetadata", () => {
    it("should get metadata for local file", async () => {
      const audioUri = "file://test.mp3";
      const result = await AudioConversionService.getAudioMetadata(audioUri);

      expect(FileSystem.getInfoAsync).toHaveBeenCalledWith(audioUri);
      expect(result).toEqual({
        size: 1024 * 100,
        extension: "mp3",
        duration: undefined,
      });
    });

    it("should handle HTTP URLs", async () => {
      const audioUri = "https://example.com/audio.mp3";
      const result = await AudioConversionService.getAudioMetadata(audioUri);

      expect(FileSystem.getInfoAsync).not.toHaveBeenCalled();
      expect(result).toEqual({
        size: 0,
        extension: "mp3",
        duration: undefined,
      });
    });

    it("should handle HTTPS URLs", async () => {
      const audioUri = "https://example.com/audio.wav";
      const result = await AudioConversionService.getAudioMetadata(audioUri);

      expect(result).toEqual({
        size: 0,
        extension: "wav",
        duration: undefined,
      });
    });

    it("should handle non-existent local file", async () => {
      const audioUri = "file://nonexistent.mp3";
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: false,
      });

      const result = await AudioConversionService.getAudioMetadata(audioUri);
      expect(result).toEqual({
        size: 0,
        extension: "mp3",
        duration: undefined,
      });
    });

    it("should handle file info without size property", async () => {
      const audioUri = "file://test.mp3";
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
        uri: "file://test.mp3",
      });

      const result = await AudioConversionService.getAudioMetadata(audioUri);
      expect(result).toEqual({
        size: 0,
        extension: "mp3",
        duration: undefined,
      });
    });

    it("should return default values on error", async () => {
      const audioUri = "file://test.mp3";
      (FileSystem.getInfoAsync as jest.Mock).mockRejectedValue(
        new Error("Test error")
      );

      const result = await AudioConversionService.getAudioMetadata(audioUri);
      expect(result).toEqual({
        size: 0,
        extension: "",
        duration: undefined,
      });
    });
  });

  describe("validateForTranscription", () => {
    it("should validate compatible local file", async () => {
      const audioUri = "file://test.mp3";
      const result = await AudioConversionService.validateForTranscription(
        audioUri
      );

      expect(result).toEqual({
        isValid: true,
        size: 1024 * 100,
        format: "mp3",
      });
    });

    it("should validate HTTP URL", async () => {
      const audioUri = "https://example.com/audio.mp3";
      const result = await AudioConversionService.validateForTranscription(
        audioUri
      );

      expect(result).toEqual({
        isValid: true,
        size: 0,
        format: "mp3",
      });
    });

    it("should reject file too large", async () => {
      const audioUri = "file://large.mp3";
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
        size: 30 * 1024 * 1024, // 30MB
      });

      const result = await AudioConversionService.validateForTranscription(
        audioUri
      );
      expect(result).toEqual({
        isValid: false,
        error: "File too large: 30 MB (max 25MB)",
        size: 30 * 1024 * 1024,
        format: "mp3",
      });
    });

    it("should reject unsupported format", async () => {
      const audioUri = "file://test.xyz";
      const result = await AudioConversionService.validateForTranscription(
        audioUri
      );

      expect(result).toEqual({
        isValid: false,
        error: "Unsupported format: xyz",
        size: 1024 * 100,
        format: "xyz",
      });
    });

    it("should handle validation error", async () => {
      const audioUri = "file://test.mp3";
      // Mock getAudioMetadata to throw
      const spy = jest.spyOn(AudioConversionService, "getAudioMetadata");
      spy.mockRejectedValue(new Error("Test error"));

      const result = await AudioConversionService.validateForTranscription(
        audioUri
      );
      expect(result).toEqual({
        isValid: false,
        error: "Test error",
        size: 0,
        format: "",
      });

      spy.mockRestore();
    });

    it("should handle non-Error exceptions", async () => {
      const audioUri = "file://test.mp3";
      // Mock getAudioMetadata to throw non-Error
      const spy = jest.spyOn(AudioConversionService, "getAudioMetadata");
      spy.mockRejectedValue("String error");

      const result = await AudioConversionService.validateForTranscription(
        audioUri
      );
      expect(result).toEqual({
        isValid: false,
        error: "Unknown error",
        size: 0,
        format: "",
      });

      spy.mockRestore();
    });
  });

  describe("edge cases", () => {
    it("should handle empty string URL", async () => {
      const result = await AudioConversionService.isCompatibleFormat("");
      expect(result).toBe(false);
    });

    it("should handle null URL", async () => {
      const result = await AudioConversionService.isCompatibleFormat(
        null as any
      );
      expect(result).toBe(false);
    });

    it("should handle URLs with only query parameters", () => {
      const result = fileUtils.extractFileExtension(
        "https://example.com/?param=value"
      );
      expect(result).toBe("");
    });

    it("should handle URLs with multiple query parameters", () => {
      const result = fileUtils.extractFileExtension(
        "https://example.com/audio.mp3?param1=value1&param2=value2"
      );
      expect(result).toBe("mp3");
    });
  });
});
