import { AudioRecording } from "@/types";

// ===== INTERFACES =====

export interface StoragePathInfo {
  userId: string;
  timestamp: number;
  filename: string;
  fullPath: string;
  storagePath: string;
}

export interface StorageMetadata {
  userId: string;
  duration: string;
  volume: string;
  isWhisper: string;
  timestamp: string;
}

export interface UrlParseResult {
  isValid: boolean;
  path: string;
  errors: string[];
}

export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// ===== FILE PATH GENERATION =====

/**
 * Generate storage path for audio file
 */
export function generateStoragePath(
  userId: string,
  timestamp: number = Date.now()
): StoragePathInfo {
  const filename = `${timestamp}.m4a`;
  const fullPath = `whispers/${userId}/${filename}`;
  const storagePath = `audio/${fullPath}`;

  return {
    userId,
    timestamp,
    filename,
    fullPath,
    storagePath,
  };
}

/**
 * Generate unique filename for audio file
 */
export function generateUniqueFilename(
  userId: string,
  extension: string = "m4a"
): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `${userId}_${timestamp}_${randomSuffix}.${extension}`;
}

/**
 * Create storage path from components
 */
export function createStoragePath(
  basePath: string,
  userId: string,
  filename: string
): string {
  return `${basePath}/${userId}/${filename}`;
}

// ===== METADATA HANDLING =====

/**
 * Create storage metadata from audio recording
 */
export function createStorageMetadata(
  userId: string,
  audioRecording: AudioRecording
): StorageMetadata {
  return {
    userId,
    duration: audioRecording.duration.toString(),
    volume: audioRecording.volume.toString(),
    isWhisper: audioRecording.isWhisper.toString(),
    timestamp: audioRecording.timestamp.toISOString(),
  };
}

/**
 * Parse storage metadata
 */
export function parseStorageMetadata(metadata: {
  userId?: string;
  duration?: string | number;
  volume?: string | number;
  isWhisper?: string | boolean;
  timestamp?: string | number;
}): {
  isValid: boolean;
  data: Partial<StorageMetadata>;
  errors: string[];
} {
  const errors: string[] = [];
  const data: Partial<StorageMetadata> = {};

  if (metadata.userId) {
    data.userId = metadata.userId;
  } else {
    errors.push("Missing userId in metadata");
  }

  if (metadata.duration) {
    data.duration = String(metadata.duration);
  } else {
    errors.push("Missing duration in metadata");
  }

  if (metadata.volume) {
    data.volume = String(metadata.volume);
  } else {
    errors.push("Missing volume in metadata");
  }

  if (metadata.isWhisper !== undefined) {
    data.isWhisper = String(metadata.isWhisper);
  } else {
    errors.push("Missing isWhisper in metadata");
  }

  if (metadata.timestamp) {
    data.timestamp = String(metadata.timestamp);
  } else {
    errors.push("Missing timestamp in metadata");
  }

  return {
    isValid: errors.length === 0,
    data,
    errors,
  };
}

/**
 * Validate storage metadata
 */
export function validateStorageMetadata(metadata: StorageMetadata): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!metadata.userId || metadata.userId.trim().length === 0) {
    errors.push("UserId is required");
  }

  if (!metadata.duration || isNaN(Number(metadata.duration))) {
    errors.push("Duration must be a valid number");
  }

  if (!metadata.volume || isNaN(Number(metadata.volume))) {
    errors.push("Volume must be a valid number");
  }

  if (metadata.isWhisper === undefined || metadata.isWhisper === null) {
    errors.push("IsWhisper flag is required");
  }

  if (!metadata.timestamp || isNaN(Date.parse(metadata.timestamp))) {
    errors.push("Timestamp must be a valid ISO date string");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// ===== URL PARSING =====

/**
 * Parse Firebase Storage URL to extract path
 */
export function parseStorageUrl(audioUrl: string): UrlParseResult {
  const errors: string[] = [];

  try {
    const url = new URL(audioUrl);

    if (!url.pathname.includes("/o/")) {
      errors.push("Invalid Firebase Storage URL format");
      return {
        isValid: false,
        path: "",
        errors,
      };
    }

    const path = decodeURIComponent(
      url.pathname.split("/o/")[1]?.split("?")[0] || ""
    );

    if (!path) {
      errors.push("Could not extract path from URL");
      return {
        isValid: false,
        path: "",
        errors,
      };
    }

    return {
      isValid: true,
      path,
      errors: [],
    };
  } catch {
    errors.push("Invalid URL format");
    return {
      isValid: false,
      path: "",
      errors,
    };
  }
}

/**
 * Extract file path from Firebase Storage URL
 */
export function extractFilePathFromUrl(audioUrl: string): string {
  const parseResult = parseStorageUrl(audioUrl);

  if (!parseResult.isValid) {
    throw new Error(`Invalid audio URL: ${parseResult.errors.join(", ")}`);
  }

  return parseResult.path;
}

/**
 * Validate Firebase Storage URL
 */
export function validateStorageUrl(audioUrl: string): {
  isValid: boolean;
  errors: string[];
} {
  const parseResult = parseStorageUrl(audioUrl);

  return {
    isValid: parseResult.isValid,
    errors: parseResult.errors,
  };
}

// ===== FILE VALIDATION =====

/**
 * Validate audio file for storage
 */
export function validateAudioFileForStorage(
  audioRecording: AudioRecording,
  userId: string
): FileValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate user ID
  if (!userId || userId.trim().length === 0) {
    errors.push("User ID is required");
  }

  if (userId && userId.length < 3) {
    errors.push("User ID must be at least 3 characters");
  }

  // Validate audio recording
  if (!audioRecording.uri) {
    errors.push("Audio URI is required");
  }

  if (audioRecording.duration <= 0) {
    errors.push("Audio duration must be greater than 0");
  }

  if (audioRecording.duration > 300) {
    // 5 minutes
    errors.push("Audio duration cannot exceed 5 minutes");
  }

  if (audioRecording.volume < 0 || audioRecording.volume > 1) {
    errors.push("Audio volume must be between 0 and 1");
  }

  if (audioRecording.timestamp > new Date()) {
    errors.push("Audio timestamp cannot be in the future");
  }

  // Warnings
  if (audioRecording.duration > 60) {
    // 1 minute
    warnings.push("Long audio files may take longer to upload");
  }

  if (audioRecording.volume < 0.1) {
    warnings.push("Very low volume audio may be difficult to hear");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate file size for storage
 */
export function validateFileSize(
  fileSize: number,
  maxSizeMB: number = 25
): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  if (fileSize <= 0) {
    errors.push("File size must be greater than 0");
  }

  if (fileSize > maxSizeBytes) {
    errors.push(`File size exceeds ${maxSizeMB}MB limit`);
  }

  // Warnings
  if (fileSize >= maxSizeBytes * 0.8) {
    // 80% of max size
    warnings.push(`File size is close to ${maxSizeMB}MB limit`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// ===== UTILITY FUNCTIONS =====

/**
 * Check if URL is a Firebase Storage URL
 */
export function isFirebaseStorageUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname.includes("firebasestorage.googleapis.com");
  } catch {
    return false;
  }
}

/**
 * Generate download URL from storage path
 */
export function generateDownloadUrl(
  storagePath: string,
  bucket: string = "default"
): string {
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(
    storagePath
  )}?alt=media`;
}

/**
 * Extract bucket name from Firebase Storage URL
 */
export function extractBucketFromUrl(audioUrl: string): string | null {
  try {
    const url = new URL(audioUrl);
    const pathParts = url.pathname.split("/");
    const bucketIndex = pathParts.findIndex((part) => part === "b") + 1;

    if (bucketIndex > 0 && bucketIndex < pathParts.length) {
      return pathParts[bucketIndex];
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Sanitize filename for storage
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, "_") // Replace invalid characters with underscore
    .replace(/_{2,}/g, "_") // Replace multiple underscores with single
    .replace(/^_+|_+$/g, "") // Remove leading/trailing underscores
    .replace(/\._+\./g, ".") // Remove underscores around dots
    .replace(/\._+$/g, ".") // Remove underscores before file extension
    .replace(/_+\./g, ".") // Remove underscores before any dot
    .substring(0, 255); // Limit length
}

/**
 * Check if file extension is supported
 */
export function isSupportedAudioExtension(extension: string): boolean {
  const supportedExtensions = ["m4a", "mp3", "wav", "flac", "ogg", "webm"];
  return supportedExtensions.includes(extension.toLowerCase());
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

/**
 * Calculate file size in human readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Check if URL is expired (Firebase Storage URLs can expire)
 */
export function isUrlExpired(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    const expiresParam = parsedUrl.searchParams.get("expires");

    if (!expiresParam) {
      return false; // No expiration set
    }

    const expirationTime = parseInt(expiresParam) * 1000; // Convert to milliseconds
    return Date.now() > expirationTime;
  } catch {
    return false; // Invalid URL, assume not expired
  }
}

/**
 * Create refresh URL parameters
 */
export function createRefreshUrlParams(): Record<string, string> {
  return {
    alt: "media",
    t: (Date.now() + Math.random()).toString(), // Add timestamp + random to force refresh
  };
}
