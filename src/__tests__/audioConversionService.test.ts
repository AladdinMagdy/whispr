/**
 * Tests for Audio Conversion Service
 */

import { AudioConversionService } from "../services/audioConversionService";

// Mock the utils module
jest.mock("../utils/audioConversionUtils", () => ({
  isCompatibleFormat: jest.fn(),
  getAudioMetadata: jest.fn(),
  validateForTranscription: jest.fn(),
}));

import {
  isCompatibleFormat,
  getAudioMetadata,
  validateForTranscription,
} from "../utils/audioConversionUtils";

const mockIsCompatibleFormat = isCompatibleFormat as jest.MockedFunction<
  typeof isCompatibleFormat
>;
const mockGetAudioMetadata = getAudioMetadata as jest.MockedFunction<
  typeof getAudioMetadata
>;
const mockValidateForTranscription =
  validateForTranscription as jest.MockedFunction<
    typeof validateForTranscription
  >;

describe("AudioConversionService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("convertForTranscription", () => {
    test("should return original URI if already compatible", async () => {
      const audioUri = "file:///path/to/audio.mp3";
      mockIsCompatibleFormat.mockReturnValue(true);

      const result = await AudioConversionService.convertForTranscription(
        audioUri
      );

      expect(result).toBe(audioUri);
      expect(mockIsCompatibleFormat).toHaveBeenCalledWith(audioUri);
    });

    test("should return original URI if not compatible (conversion not implemented)", async () => {
      const audioUri = "file:///path/to/audio.xyz";
      mockIsCompatibleFormat.mockReturnValue(false);

      const result = await AudioConversionService.convertForTranscription(
        audioUri
      );

      expect(result).toBe(audioUri);
      expect(mockIsCompatibleFormat).toHaveBeenCalledWith(audioUri);
    });

    test("should handle errors and return original URI", async () => {
      const audioUri = "file:///path/to/audio.mp3";
      mockIsCompatibleFormat.mockImplementation(() => {
        throw new Error("Test error");
      });

      const result = await AudioConversionService.convertForTranscription(
        audioUri
      );

      expect(result).toBe(audioUri);
    });
  });

  describe("isCompatibleFormat", () => {
    test("should delegate to utility function", async () => {
      const audioUri = "file:///path/to/audio.mp3";
      mockIsCompatibleFormat.mockReturnValue(true);

      const result = await AudioConversionService.isCompatibleFormat(audioUri);

      expect(result).toBe(true);
      expect(mockIsCompatibleFormat).toHaveBeenCalledWith(audioUri);
    });

    test("should handle false result", async () => {
      const audioUri = "file:///path/to/audio.xyz";
      mockIsCompatibleFormat.mockReturnValue(false);

      const result = await AudioConversionService.isCompatibleFormat(audioUri);

      expect(result).toBe(false);
      expect(mockIsCompatibleFormat).toHaveBeenCalledWith(audioUri);
    });
  });

  describe("getAudioMetadata", () => {
    test("should delegate to utility function", async () => {
      const audioUri = "file:///path/to/audio.mp3";
      const mockMetadata = {
        size: 1024 * 1024,
        extension: "mp3",
        duration: undefined,
      };

      mockGetAudioMetadata.mockResolvedValue(mockMetadata);

      const result = await AudioConversionService.getAudioMetadata(audioUri);

      expect(result).toEqual(mockMetadata);
      expect(mockGetAudioMetadata).toHaveBeenCalledWith(audioUri);
    });

    test("should handle metadata with duration", async () => {
      const audioUri = "file:///path/to/audio.mp3";
      const mockMetadata = {
        size: 1024 * 1024,
        extension: "mp3",
        duration: 120, // 2 minutes
      };

      mockGetAudioMetadata.mockResolvedValue(mockMetadata);

      const result = await AudioConversionService.getAudioMetadata(audioUri);

      expect(result).toEqual(mockMetadata);
      expect(result.duration).toBe(120);
    });
  });

  describe("validateForTranscription", () => {
    test("should delegate to utility function for valid file", async () => {
      const audioUrl = "file:///path/to/audio.mp3";
      const mockResult = {
        isValid: true,
        size: 1024 * 1024,
        format: "mp3",
      };

      mockValidateForTranscription.mockResolvedValue(mockResult);

      const result = await AudioConversionService.validateForTranscription(
        audioUrl
      );

      expect(result).toEqual(mockResult);
      expect(mockValidateForTranscription).toHaveBeenCalledWith(audioUrl);
    });

    test("should handle invalid file with error", async () => {
      const audioUrl = "file:///path/to/audio.xyz";
      const mockResult = {
        isValid: false,
        error: "Unsupported format: xyz",
        size: 0,
        format: "xyz",
      };

      mockValidateForTranscription.mockResolvedValue(mockResult);

      const result = await AudioConversionService.validateForTranscription(
        audioUrl
      );

      expect(result).toEqual(mockResult);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Unsupported format");
    });

    test("should handle file that is too large", async () => {
      const audioUrl = "file:///path/to/audio.mp3";
      const mockResult = {
        isValid: false,
        error: "File too large: 30.0 MB (max 25MB)",
        size: 30 * 1024 * 1024,
        format: "mp3",
      };

      mockValidateForTranscription.mockResolvedValue(mockResult);

      const result = await AudioConversionService.validateForTranscription(
        audioUrl
      );

      expect(result).toEqual(mockResult);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("File too large");
    });
  });

  describe("integration tests", () => {
    test("should handle complete conversion flow for compatible file", async () => {
      const audioUri = "file:///path/to/audio.mp3";

      // Mock all utility functions
      mockIsCompatibleFormat.mockReturnValue(true);
      mockGetAudioMetadata.mockResolvedValue({
        size: 1024 * 1024,
        extension: "mp3",
        duration: undefined,
      });
      mockValidateForTranscription.mockResolvedValue({
        isValid: true,
        size: 1024 * 1024,
        format: "mp3",
      });

      // Test conversion
      const convertedUri = await AudioConversionService.convertForTranscription(
        audioUri
      );
      expect(convertedUri).toBe(audioUri);

      // Test compatibility check
      const isCompatible = await AudioConversionService.isCompatibleFormat(
        audioUri
      );
      expect(isCompatible).toBe(true);

      // Test metadata retrieval
      const metadata = await AudioConversionService.getAudioMetadata(audioUri);
      expect(metadata.size).toBe(1024 * 1024);
      expect(metadata.extension).toBe("mp3");

      // Test validation
      const validation = await AudioConversionService.validateForTranscription(
        audioUri
      );
      expect(validation.isValid).toBe(true);
      expect(validation.format).toBe("mp3");
    });

    test("should handle incompatible file gracefully", async () => {
      const audioUri = "file:///path/to/audio.xyz";

      // Mock utility functions for incompatible file
      mockIsCompatibleFormat.mockReturnValue(false);
      mockGetAudioMetadata.mockResolvedValue({
        size: 1024 * 1024,
        extension: "xyz",
        duration: undefined,
      });
      mockValidateForTranscription.mockResolvedValue({
        isValid: false,
        error: "Unsupported format: xyz",
        size: 1024 * 1024,
        format: "xyz",
      });

      // Test conversion (should return original URI)
      const convertedUri = await AudioConversionService.convertForTranscription(
        audioUri
      );
      expect(convertedUri).toBe(audioUri);

      // Test compatibility check
      const isCompatible = await AudioConversionService.isCompatibleFormat(
        audioUri
      );
      expect(isCompatible).toBe(false);

      // Test metadata retrieval
      const metadata = await AudioConversionService.getAudioMetadata(audioUri);
      expect(metadata.extension).toBe("xyz");

      // Test validation
      const validation = await AudioConversionService.validateForTranscription(
        audioUri
      );
      expect(validation.isValid).toBe(false);
      expect(validation.error).toContain("Unsupported format");
    });

    test("should handle HTTP URLs", async () => {
      const audioUrl = "https://example.com/audio.mp3";

      // Mock utility functions for HTTP URL
      mockIsCompatibleFormat.mockReturnValue(true);
      mockGetAudioMetadata.mockResolvedValue({
        size: 0, // Can't determine size for HTTP URLs
        extension: "mp3",
        duration: undefined,
      });
      mockValidateForTranscription.mockResolvedValue({
        isValid: true,
        size: 0,
        format: "mp3",
      });

      // Test all methods with HTTP URL
      const convertedUri = await AudioConversionService.convertForTranscription(
        audioUrl
      );
      expect(convertedUri).toBe(audioUrl);

      const isCompatible = await AudioConversionService.isCompatibleFormat(
        audioUrl
      );
      expect(isCompatible).toBe(true);

      const metadata = await AudioConversionService.getAudioMetadata(audioUrl);
      expect(metadata.size).toBe(0);
      expect(metadata.extension).toBe("mp3");

      const validation = await AudioConversionService.validateForTranscription(
        audioUrl
      );
      expect(validation.isValid).toBe(true);
      expect(validation.size).toBe(0);
    });

    test("should handle errors in utility functions", async () => {
      const audioUri = "file:///path/to/audio.mp3";

      // Mock utility functions to throw errors
      mockIsCompatibleFormat.mockImplementation(() => {
        throw new Error("Format check error");
      });
      mockGetAudioMetadata.mockRejectedValue(new Error("Metadata error"));
      mockValidateForTranscription.mockRejectedValue(
        new Error("Validation error")
      );

      // Test conversion with error
      const convertedUri = await AudioConversionService.convertForTranscription(
        audioUri
      );
      expect(convertedUri).toBe(audioUri); // Should return original URI on error

      // Test other methods should throw errors
      await expect(
        AudioConversionService.isCompatibleFormat(audioUri)
      ).rejects.toThrow("Format check error");
      await expect(
        AudioConversionService.getAudioMetadata(audioUri)
      ).rejects.toThrow("Metadata error");
      await expect(
        AudioConversionService.validateForTranscription(audioUri)
      ).rejects.toThrow("Validation error");
    });
  });
});
