/**
 * Audio Conversion Utilities
 * Utility functions for audio file conversion, validation, and metadata handling
 * Extracted from AudioConversionService for better maintainability and testability
 */

import * as FileSystem from "expo-file-system";
import { extractFileExtension, formatFileSize } from "./fileUtils";

// Types
export interface AudioConversionOptions {
  targetFormat?: "mp3" | "wav" | "m4a";
  quality?: "low" | "medium" | "high";
}

export interface AudioMetadata {
  size: number;
  extension: string;
  duration?: number;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  size: number;
  format: string;
}

// Constants
export const WHISPER_SUPPORTED_FORMATS = [
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
] as const;

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB
export const MAX_FILE_SIZE_MB = 25;

// File size thresholds
export const FILE_SIZE_THRESHOLDS = {
  small: 1024 * 1024, // 1MB
  medium: 10 * 1024 * 1024, // 10MB
  large: MAX_FILE_SIZE_BYTES, // 25MB
} as const;

// Quality settings for different conversion targets
export const QUALITY_SETTINGS = {
  low: {
    bitrate: 64,
    sampleRate: 22050,
    channels: 1,
  },
  medium: {
    bitrate: 128,
    sampleRate: 44100,
    channels: 2,
  },
  high: {
    bitrate: 256,
    sampleRate: 48000,
    channels: 2,
  },
} as const;

// Format-specific settings
export const FORMAT_SETTINGS = {
  mp3: {
    mimeType: "audio/mpeg",
    extension: "mp3",
    supported: true,
  },
  wav: {
    mimeType: "audio/wav",
    extension: "wav",
    supported: true,
  },
  m4a: {
    mimeType: "audio/mp4",
    extension: "m4a",
    supported: true,
  },
  flac: {
    mimeType: "audio/flac",
    extension: "flac",
    supported: true,
  },
} as const;

/**
 * Check if the audio file is in a format compatible with Whisper API
 */
export function isCompatibleFormat(audioUri: string): boolean {
  try {
    // Check file extension - handle URLs with query parameters
    const extension = extractFileExtension(audioUri);
    return (
      WHISPER_SUPPORTED_FORMATS.includes(
        extension as (typeof WHISPER_SUPPORTED_FORMATS)[number]
      ) || false
    );
  } catch (error) {
    console.error("Error checking audio format:", error);
    return false;
  }
}

/**
 * Get audio file metadata
 */
export async function getAudioMetadata(
  audioUri: string
): Promise<AudioMetadata> {
  try {
    const extension = extractFileExtension(audioUri);

    // Check if it's a local file or HTTP/HTTPS URL
    if (isHttpUrl(audioUri)) {
      // For HTTP/HTTPS URLs, we can't get the file size easily
      // We'll return a default size and the extension
      return {
        size: 0, // Can't determine size for HTTP URLs without downloading
        extension,
        duration: undefined,
      };
    } else {
      // For local files, we can get the file info
      const fileInfo = await FileSystem.getInfoAsync(audioUri);

      return {
        size: fileInfo.exists && "size" in fileInfo ? fileInfo.size : 0,
        extension,
        duration: undefined, // Would need additional library to get duration
      };
    }
  } catch (error) {
    console.error("Error getting audio metadata:", error);
    // Try to extract extension even on error
    const extension = extractFileExtension(audioUri);
    return {
      size: 0,
      extension: extension || "",
      duration: undefined,
    };
  }
}

/**
 * Check if URL is HTTP/HTTPS
 */
export function isHttpUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

/**
 * Check if URL is a local file
 */
export function isLocalFile(url: string): boolean {
  return url.startsWith("file://") || !isHttpUrl(url);
}

/**
 * Check if file is too large for transcription
 */
export function isFileTooLarge(size: number, isHttpUrlFlag: boolean): boolean {
  if (isHttpUrlFlag) return false; // Can't check size for HTTP URLs
  return size > MAX_FILE_SIZE_BYTES;
}

/**
 * Get file size error message
 */
export function getFileSizeErrorMessage(size: number): string {
  return `File too large: ${formatFileSize(size)} (max ${MAX_FILE_SIZE_MB}MB)`;
}

/**
 * Get format error message
 */
export function getFormatErrorMessage(extension: string): string {
  return `Unsupported format: ${extension}`;
}

/**
 * Validate audio file for transcription
 */
export async function validateForTranscription(
  audioUrl: string
): Promise<ValidationResult> {
  try {
    const metadata = await getAudioMetadata(audioUrl);
    const isCompatible = isCompatibleFormat(audioUrl);

    // For HTTP URLs, we can't check file size, so we'll assume it's valid
    const isHttpUrlFlag = isHttpUrl(audioUrl);

    // Check file size
    if (isFileTooLarge(metadata.size, isHttpUrlFlag)) {
      return {
        isValid: false,
        error: getFileSizeErrorMessage(metadata.size),
        size: metadata.size,
        format: metadata.extension,
      };
    }

    // Check format compatibility
    if (!isCompatible) {
      return {
        isValid: false,
        error: getFormatErrorMessage(metadata.extension),
        size: metadata.size,
        format: metadata.extension,
      };
    }

    return {
      isValid: true,
      size: metadata.size,
      format: metadata.extension,
    };
  } catch (error) {
    // Try to extract extension even on error
    const extension = extractFileExtension(audioUrl);
    return {
      isValid: false,
      error: error instanceof Error ? error.message : "Unknown error",
      size: 0,
      format: extension || "",
    };
  }
}

/**
 * Get file size category
 */
export function getFileSizeCategory(
  size: number
): "small" | "medium" | "large" | "too_large" {
  if (size <= FILE_SIZE_THRESHOLDS.small) return "small";
  if (size <= FILE_SIZE_THRESHOLDS.medium) return "medium";
  if (size <= FILE_SIZE_THRESHOLDS.large) return "large";
  return "too_large";
}

/**
 * Get recommended quality based on file size
 */
export function getRecommendedQuality(size: number): "low" | "medium" | "high" {
  const category = getFileSizeCategory(size);

  switch (category) {
    case "small":
      return "high";
    case "medium":
      return "medium";
    case "large":
      return "low";
    default:
      return "low";
  }
}

/**
 * Get format info for a given extension
 */
export function getFormatInfo(extension: string): {
  mimeType: string;
  supported: boolean;
  quality: "low" | "medium" | "high";
} | null {
  const format = FORMAT_SETTINGS[extension as keyof typeof FORMAT_SETTINGS];

  if (!format) {
    return null;
  }

  return {
    mimeType: format.mimeType,
    supported: format.supported,
    quality: "medium", // Default quality
  };
}

/**
 * Check if format is supported for conversion
 */
export function isFormatSupportedForConversion(format: string): boolean {
  return format in FORMAT_SETTINGS;
}

/**
 * Get conversion options for a target format
 */
export function getConversionOptions(
  targetFormat: "mp3" | "wav" | "m4a",
  quality: "low" | "medium" | "high" = "medium"
): AudioConversionOptions {
  return {
    targetFormat,
    quality,
  };
}

/**
 * Validate conversion options
 */
export function validateConversionOptions(options: AudioConversionOptions): {
  isValid: boolean;
  error?: string;
} {
  if (
    options.targetFormat &&
    !isFormatSupportedForConversion(options.targetFormat)
  ) {
    return {
      isValid: false,
      error: `Unsupported target format: ${options.targetFormat}`,
    };
  }

  if (options.quality && !["low", "medium", "high"].includes(options.quality)) {
    return {
      isValid: false,
      error: `Invalid quality setting: ${options.quality}`,
    };
  }

  return { isValid: true };
}

/**
 * Get estimated conversion time based on file size and quality
 */
export function getEstimatedConversionTime(
  size: number,
  quality: "low" | "medium" | "high"
): number {
  const baseTime = size / (1024 * 1024); // Base time in seconds per MB

  const qualityMultiplier = {
    low: 0.5,
    medium: 1.0,
    high: 2.0,
  };

  return Math.max(1, Math.ceil(baseTime * qualityMultiplier[quality]));
}

/**
 * Get conversion progress message
 */
export function getConversionProgressMessage(
  progress: number,
  estimatedTime: number
): string {
  const percentage = Math.round(progress * 100);
  const remainingTime = Math.round(estimatedTime * (1 - progress));

  if (progress === 0) {
    return "Starting conversion...";
  } else if (progress === 1) {
    return "Conversion complete!";
  } else {
    return `Converting... ${percentage}% (${remainingTime}s remaining)`;
  }
}

/**
 * Check if audio file needs conversion
 */
export function needsConversion(
  sourceFormat: string,
  targetFormat: string,
  currentQuality: "low" | "medium" | "high",
  targetQuality: "low" | "medium" | "high"
): boolean {
  // Check if format conversion is needed
  if (sourceFormat !== targetFormat) {
    return true;
  }

  // Check if quality improvement is needed
  const qualityLevels = { low: 1, medium: 2, high: 3 };
  return qualityLevels[targetQuality] > qualityLevels[currentQuality];
}

/**
 * Get conversion priority based on file characteristics
 */
export function getConversionPriority(
  size: number,
  format: string,
  isUrgent: boolean = false
): "low" | "medium" | "high" {
  if (isUrgent) return "high";

  const sizeCategory = getFileSizeCategory(size);
  const isCompatible = isCompatibleFormat(`file.${format}`);

  if (sizeCategory === "too_large") return "high";
  if (!isCompatible) return "high";
  if (sizeCategory === "large") return "medium";

  return "low";
}

/**
 * Format duration in seconds to human readable string
 */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "0:00";

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

/**
 * Get audio file statistics
 */
export function getAudioFileStats(metadata: AudioMetadata): {
  sizeCategory: "small" | "medium" | "large" | "too_large";
  isCompatible: boolean;
  needsConversion: boolean;
  estimatedConversionTime: number;
} {
  const sizeCategory = getFileSizeCategory(metadata.size);
  const isCompatible = isCompatibleFormat(`file.${metadata.extension}`);
  const needsConversion = !isCompatible;
  const estimatedConversionTime = getEstimatedConversionTime(
    metadata.size,
    "medium"
  );

  return {
    sizeCategory,
    isCompatible,
    needsConversion,
    estimatedConversionTime,
  };
}

/**
 * Create a unique filename for converted audio
 */
export function createConvertedFilename(
  originalFilename: string,
  targetFormat: string,
  quality: "low" | "medium" | "high"
): string {
  const baseName = originalFilename.replace(/\.[^/.]+$/, ""); // Remove extension
  const timestamp = Date.now();
  const qualitySuffix = quality !== "medium" ? `_${quality}` : "";

  return `${baseName}_converted_${timestamp}${qualitySuffix}.${targetFormat}`;
}

/**
 * Validate audio URL format
 */
export function validateAudioUrl(url: string): {
  isValid: boolean;
  error?: string;
  type: "local" | "http" | "invalid";
} {
  if (!url || typeof url !== "string") {
    return {
      isValid: false,
      error: "URL must be a non-empty string",
      type: "invalid",
    };
  }

  if (isHttpUrl(url)) {
    return {
      isValid: true,
      type: "http",
    };
  }

  if (isLocalFile(url)) {
    return {
      isValid: true,
      type: "local",
    };
  }

  // Check if it's a valid file path (must contain path separators and be a reasonable path)
  if ((url.includes("/") || url.includes("\\")) && url.length > 5) {
    return {
      isValid: true,
      type: "local",
    };
  }

  return {
    isValid: false,
    error: "Invalid URL format",
    type: "invalid",
  };
}
