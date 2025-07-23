import { AudioFormatTest } from "../utils/audioFormatTest";
import { AudioConversionService } from "../services/audioConversionService";

// Mock the AudioConversionService
jest.mock("../services/audioConversionService");
const mockAudioConversionService = AudioConversionService as jest.Mocked<
  typeof AudioConversionService
>;

describe("AudioFormatTest", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("testAudioFormat", () => {
    it("should return valid format information for compatible audio", async () => {
      // Arrange
      const audioUri = "file://test-audio.mp3";
      const mockMetadata = {
        extension: "mp3",
        size: 1024 * 1024, // 1MB
      };

      mockAudioConversionService.getAudioMetadata.mockResolvedValue(
        mockMetadata
      );
      mockAudioConversionService.isCompatibleFormat.mockResolvedValue(true);
      mockAudioConversionService.validateForTranscription.mockResolvedValue({
        isValid: true,
        size: 1024 * 1024,
        format: "mp3",
      });

      // Act
      const result = await AudioFormatTest.testAudioFormat(audioUri);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.details).toEqual({
        uri: audioUri,
        format: "mp3",
        size: 1024 * 1024,
        sizeInMB: "1.00",
        extension: "mp3",
        isCompatible: true,
      });
      expect(result.recommendations).toContain("✅ Audio format looks good!");
      expect(mockAudioConversionService.getAudioMetadata).toHaveBeenCalledWith(
        audioUri
      );
      expect(
        mockAudioConversionService.isCompatibleFormat
      ).toHaveBeenCalledWith(audioUri);
      expect(
        mockAudioConversionService.validateForTranscription
      ).toHaveBeenCalledWith(audioUri);
    });

    it("should handle incompatible format", async () => {
      // Arrange
      const audioUri = "file://test-audio.wav";
      const mockMetadata = {
        extension: "wav",
        size: 1024 * 1024,
      };

      mockAudioConversionService.getAudioMetadata.mockResolvedValue(
        mockMetadata
      );
      mockAudioConversionService.isCompatibleFormat.mockResolvedValue(false);
      mockAudioConversionService.validateForTranscription.mockResolvedValue({
        isValid: false,
        error: "Incompatible format",
        size: 1024 * 1024,
        format: "wav",
      });

      // Act
      const result = await AudioFormatTest.testAudioFormat(audioUri);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.details.isCompatible).toBe(false);
      expect(result.recommendations).toContain(
        "❌ Format not compatible with Whisper API"
      );
      expect(result.recommendations).toContain(
        "💡 Try recording with a different audio format"
      );
    });

    it("should handle large file size", async () => {
      // Arrange
      const audioUri = "file://large-audio.mp3";
      const mockMetadata = {
        extension: "mp3",
        size: 30 * 1024 * 1024, // 30MB
      };

      mockAudioConversionService.getAudioMetadata.mockResolvedValue(
        mockMetadata
      );
      mockAudioConversionService.isCompatibleFormat.mockResolvedValue(true);
      mockAudioConversionService.validateForTranscription.mockResolvedValue({
        isValid: false,
        error: "File too large",
        size: 30 * 1024 * 1024,
        format: "mp3",
      });

      // Act
      const result = await AudioFormatTest.testAudioFormat(audioUri);

      // Assert
      expect(result.details.sizeInMB).toBe("30.00");
      expect(result.recommendations).toContain("❌ File too large (max 25MB)");
      expect(result.recommendations).toContain(
        "💡 Try recording a shorter audio clip"
      );
    });

    it("should handle M4A format with warnings", async () => {
      // Arrange
      const audioUri = "file://test-audio.m4a";
      const mockMetadata = {
        extension: "m4a",
        size: 1024 * 1024,
      };

      mockAudioConversionService.getAudioMetadata.mockResolvedValue(
        mockMetadata
      );
      mockAudioConversionService.isCompatibleFormat.mockResolvedValue(true);
      mockAudioConversionService.validateForTranscription.mockResolvedValue({
        isValid: true,
        size: 1024 * 1024,
        format: "m4a",
      });

      // Act
      const result = await AudioFormatTest.testAudioFormat(audioUri);

      // Assert
      expect(result.details.format).toBe("m4a");
      expect(result.recommendations).toContain(
        "⚠️ M4A format can be problematic with Whisper API"
      );
      expect(result.recommendations).toContain(
        "💡 The app will try to convert it to MP4"
      );
    });

    it("should handle service errors gracefully", async () => {
      // Arrange
      const audioUri = "file://invalid-audio.mp3";
      const error = new Error("Service unavailable");

      mockAudioConversionService.getAudioMetadata.mockRejectedValue(error);

      // Act
      const result = await AudioFormatTest.testAudioFormat(audioUri);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.details).toEqual({
        uri: audioUri,
        format: "unknown",
        size: 0,
        sizeInMB: "0",
        extension: "unknown",
        isCompatible: false,
      });
      expect(result.recommendations).toContain("❌ Error analyzing audio file");
      expect(console.error).toHaveBeenCalledWith(
        "❌ Error testing audio format:",
        error
      );
    });

    it("should handle validation errors", async () => {
      // Arrange
      const audioUri = "file://test-audio.mp3";
      const mockMetadata = {
        extension: "mp3",
        size: 1024 * 1024,
      };

      mockAudioConversionService.getAudioMetadata.mockResolvedValue(
        mockMetadata
      );
      mockAudioConversionService.isCompatibleFormat.mockResolvedValue(true);
      mockAudioConversionService.validateForTranscription.mockResolvedValue({
        isValid: false,
        error: "Invalid audio format",
        size: 1024 * 1024,
        format: "mp3",
      });

      // Act
      const result = await AudioFormatTest.testAudioFormat(audioUri);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.details.isCompatible).toBe(true);
    });

    it("should handle edge case with very small file", async () => {
      // Arrange
      const audioUri = "file://tiny-audio.mp3";
      const mockMetadata = {
        extension: "mp3",
        size: 100, // 100 bytes
      };

      mockAudioConversionService.getAudioMetadata.mockResolvedValue(
        mockMetadata
      );
      mockAudioConversionService.isCompatibleFormat.mockResolvedValue(true);
      mockAudioConversionService.validateForTranscription.mockResolvedValue({
        isValid: true,
        size: 100,
        format: "mp3",
      });

      // Act
      const result = await AudioFormatTest.testAudioFormat(audioUri);

      // Assert
      expect(result.details.sizeInMB).toBe("0.00");
      expect(result.recommendations).toContain("✅ Audio format looks good!");
    });

    it("should handle multiple issues simultaneously", async () => {
      // Arrange
      const audioUri = "file://problematic-audio.m4a";
      const mockMetadata = {
        extension: "m4a",
        size: 30 * 1024 * 1024, // 30MB
      };

      mockAudioConversionService.getAudioMetadata.mockResolvedValue(
        mockMetadata
      );
      mockAudioConversionService.isCompatibleFormat.mockResolvedValue(false);
      mockAudioConversionService.validateForTranscription.mockResolvedValue({
        isValid: false,
        error: "Multiple issues",
        size: 30 * 1024 * 1024,
        format: "m4a",
      });

      // Act
      const result = await AudioFormatTest.testAudioFormat(audioUri);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.details.isCompatible).toBe(false);
      expect(result.recommendations).toContain(
        "❌ Format not compatible with Whisper API"
      );
      expect(result.recommendations).toContain("❌ File too large (max 25MB)");
      expect(result.recommendations).toContain(
        "⚠️ M4A format can be problematic with Whisper API"
      );
    });
  });

  describe("logAudioInfo", () => {
    it("should log audio information correctly", async () => {
      // Arrange
      const audioUri = "file://test-audio.mp3";
      const mockMetadata = {
        extension: "mp3",
        size: 2048 * 1024, // 2MB
      };

      mockAudioConversionService.getAudioMetadata.mockResolvedValue(
        mockMetadata
      );
      mockAudioConversionService.isCompatibleFormat.mockResolvedValue(true);
      mockAudioConversionService.validateForTranscription.mockResolvedValue({
        isValid: true,
        size: 2048 * 1024,
        format: "mp3",
      });

      // Act
      await AudioFormatTest.logAudioInfo(audioUri);

      // Assert
      expect(console.log).toHaveBeenCalledWith("🎵 Audio File Analysis:");
      expect(console.log).toHaveBeenCalledWith("  URI:", audioUri);
      expect(console.log).toHaveBeenCalledWith("  Format:", "mp3");
      expect(console.log).toHaveBeenCalledWith("  Size:", "2.00", "MB");
      expect(console.log).toHaveBeenCalledWith("  Compatible:", "✅");
      expect(console.log).toHaveBeenCalledWith(
        "  Valid for transcription:",
        "✅"
      );
    });

    it("should log recommendations when issues are found", async () => {
      // Arrange
      const audioUri = "file://large-audio.m4a";
      const mockMetadata = {
        extension: "m4a",
        size: 30 * 1024 * 1024, // 30MB
      };

      mockAudioConversionService.getAudioMetadata.mockResolvedValue(
        mockMetadata
      );
      mockAudioConversionService.isCompatibleFormat.mockResolvedValue(false);
      mockAudioConversionService.validateForTranscription.mockResolvedValue({
        isValid: false,
        error: "File too large",
        size: 30 * 1024 * 1024,
        format: "m4a",
      });

      // Act
      await AudioFormatTest.logAudioInfo(audioUri);

      // Assert
      expect(console.log).toHaveBeenCalledWith("  Compatible:", "❌");
      expect(console.log).toHaveBeenCalledWith(
        "  Valid for transcription:",
        "❌"
      );
      expect(console.log).toHaveBeenCalledWith("  Recommendations:");
    });

    it("should handle errors in logAudioInfo", async () => {
      // Arrange
      const audioUri = "file://invalid-audio.mp3";
      const error = new Error("Service error");

      mockAudioConversionService.getAudioMetadata.mockRejectedValue(error);

      // Act
      await AudioFormatTest.logAudioInfo(audioUri);

      // Assert
      expect(console.log).toHaveBeenCalledWith("  Format:", "unknown");
      expect(console.log).toHaveBeenCalledWith("  Size:", "0", "MB");
      expect(console.log).toHaveBeenCalledWith("  Compatible:", "❌");
      expect(console.log).toHaveBeenCalledWith(
        "  Valid for transcription:",
        "❌"
      );
    });
  });
});
