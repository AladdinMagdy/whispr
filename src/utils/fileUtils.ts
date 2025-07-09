/**
 * File utility functions to consolidate duplicate code across services
 */

/**
 * Extract file extension from URL, handling query parameters
 * Consolidates duplicate implementations from multiple services
 */
export function extractFileExtension(url: string): string {
  try {
    // Remove query parameters first
    const urlWithoutQuery = url.split("?")[0];

    // Get the file extension
    const parts = urlWithoutQuery.split(".");
    const extension = parts.length > 1 ? parts.pop()?.toLowerCase() : undefined;

    // Only return extension if it's actually a file extension (not a domain part)
    if (
      extension &&
      extension.length <= 4 &&
      /^[a-zA-Z0-9]+$/.test(extension)
    ) {
      return extension;
    }

    return "";
  } catch (error) {
    console.error("Error extracting file extension:", error);
    return "";
  }
}

/**
 * Get file extension from URL with dot prefix (for compatibility)
 */
export function getFileExtension(url: string): string {
  const extension = extractFileExtension(url);
  return extension ? `.${extension}` : ".mp3";
}

/**
 * Format file size for display
 * Consolidates duplicate implementations from multiple services
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Validate audio file format
 */
export function isValidAudioFormat(filename: string): boolean {
  const validExtensions = [".m4a", ".mp3", ".wav", ".aac"];
  const extension = filename.toLowerCase().substring(filename.lastIndexOf("."));
  return validExtensions.includes(extension);
}

/**
 * Generate unique filename for uploads
 */
export function generateUniqueFilename(
  userId: string,
  extension: string = "m4a"
): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `whispers/${userId}/${timestamp}_${random}.${extension}`;
}

/**
 * Validate WhisperUploadData for upload
 */
export interface WhisperUploadData {
  audioUri: string;
  duration: number;
  whisperPercentage: number;
  averageLevel: number;
  confidence: number;
}

export function validateUploadData(uploadData: WhisperUploadData): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (!uploadData.audioUri) {
    errors.push("Audio URI is required");
  }
  if (uploadData.duration < 2) {
    errors.push("Recording must be at least 2 seconds long");
  }
  if (uploadData.duration > 30.1) {
    errors.push("Recording must be no longer than 30 seconds");
  }
  if (uploadData.whisperPercentage < 0.8) {
    errors.push(
      `Only ${(uploadData.whisperPercentage * 100).toFixed(
        1
      )}% was whispered. At least 80% must be whispered.`
    );
  }
  if (uploadData.averageLevel > 0.015) {
    errors.push(
      "Average audio level (1.5%) is too high. Please whisper more quietly."
    );
  }
  if (uploadData.confidence < 0.3) {
    errors.push("Whisper confidence is too low");
  }
  return { isValid: errors.length === 0, errors };
}
