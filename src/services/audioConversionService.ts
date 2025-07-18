/**
 * Audio Conversion Service
 * Handles audio file conversion for transcription and playback
 */

import {
  isCompatibleFormat,
  getAudioMetadata,
  validateForTranscription,
} from "../utils/audioConversionUtils";

export class AudioConversionService {
  /**
   * Convert audio file to a format compatible with Whisper API
   */
  static async convertForTranscription(audioUri: string): Promise<string> {
    try {
      // For now, we'll implement a simple approach
      // In a production app, you might want to use a native audio conversion library

      // Check if the file is already in a compatible format
      if (isCompatibleFormat(audioUri)) {
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
    return isCompatibleFormat(audioUri);
  }

  /**
   * Get audio file metadata
   */
  static async getAudioMetadata(audioUri: string): Promise<{
    size: number;
    extension: string;
    duration?: number;
  }> {
    return getAudioMetadata(audioUri);
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
    return validateForTranscription(audioUrl);
  }
}

export default AudioConversionService;
