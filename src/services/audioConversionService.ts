import * as FileSystem from "expo-file-system";
import { extractFileExtension, formatFileSize } from "../utils/fileUtils";

export interface AudioConversionOptions {
  targetFormat?: "mp3" | "wav" | "m4a";
  quality?: "low" | "medium" | "high";
}

export class AudioConversionService {
  /**
   * Convert audio file to a format compatible with Whisper API
   */
  static async convertForTranscription(audioUri: string): Promise<string> {
    try {
      // For now, we'll implement a simple approach
      // In a production app, you might want to use a native audio conversion library

      // Check if the file is already in a compatible format
      if (await this.isCompatibleFormat(audioUri)) {
        console.log("Audio file is already in compatible format");
        return audioUri;
      }

      // For now, we'll return the original URI and let the transcription service handle it
      // In a real implementation, you would convert the audio here
      console.log(
        "Audio conversion not implemented yet, using original format"
      );
      return audioUri;
    } catch (error) {
      console.error("Error converting audio:", error);
      // Return original URI if conversion fails
      return audioUri;
    }
  }

  /**
   * Check if the audio file is in a format compatible with Whisper API
   */
  static async isCompatibleFormat(audioUri: string): Promise<boolean> {
    try {
      // Check file extension - handle URLs with query parameters
      const extension = extractFileExtension(audioUri);

      // Whisper API supported formats (from OpenAI docs)
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

      return supportedFormats.includes(extension || "");
    } catch (error) {
      console.error("Error checking audio format:", error);
      return false;
    }
  }

  /**
   * Get audio file metadata
   */
  static async getAudioMetadata(audioUri: string): Promise<{
    size: number;
    extension: string;
    duration?: number;
  }> {
    try {
      const extension = extractFileExtension(audioUri);

      // Check if it's a local file or HTTP/HTTPS URL
      if (audioUri.startsWith("http://") || audioUri.startsWith("https://")) {
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
      return {
        size: 0,
        extension: "",
        duration: undefined,
      };
    }
  }

  /**
   * Check if file is too large for transcription
   */
  private static isFileTooLarge(size: number, isHttpUrl: boolean): boolean {
    if (isHttpUrl) return false; // Can't check size for HTTP URLs
    return size > 25 * 1024 * 1024; // 25MB limit
  }

  /**
   * Get file size error message
   */
  private static getFileSizeErrorMessage(size: number): string {
    return `File too large: ${formatFileSize(size)} (max 25MB)`;
  }

  /**
   * Get format error message
   */
  private static getFormatErrorMessage(extension: string): string {
    return `Unsupported format: ${extension}`;
  }

  /**
   * Validate audio file for transcription
   */
  static async validateForTranscription(audioUrl: string): Promise<{
    isValid: boolean;
    error?: string;
    size: number;
    format: string;
  }> {
    try {
      const metadata = await this.getAudioMetadata(audioUrl);
      const isCompatible = await this.isCompatibleFormat(audioUrl);

      // For HTTP URLs, we can't check file size, so we'll assume it's valid
      const isHttpUrl =
        audioUrl.startsWith("http://") || audioUrl.startsWith("https://");

      // Check file size
      if (this.isFileTooLarge(metadata.size, isHttpUrl)) {
        return {
          isValid: false,
          error: this.getFileSizeErrorMessage(metadata.size),
          size: metadata.size,
          format: metadata.extension,
        };
      }

      // Check format compatibility
      if (!isCompatible) {
        return {
          isValid: false,
          error: this.getFormatErrorMessage(metadata.extension),
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
      return {
        isValid: false,
        error: error instanceof Error ? error.message : "Unknown error",
        size: 0,
        format: "",
      };
    }
  }
}

export default AudioConversionService;
