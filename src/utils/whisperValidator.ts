import {
  AudioRecording,
  AudioValidationResult,
  VolumeThreshold,
} from "@/types";
import {
  AUDIO_CONSTANTS,
  VOLUME_THRESHOLDS,
  ERROR_MESSAGES,
} from "@/constants";

/**
 * Validates if an audio recording qualifies as a whisper
 * Uses volume-based threshold detection for MVP
 */
export class WhisperValidator {
  private volumeThreshold: VolumeThreshold;

  constructor(volumeThreshold: VolumeThreshold = VOLUME_THRESHOLDS) {
    this.volumeThreshold = volumeThreshold;
  }

  /**
   * Validates if the recording meets whisper criteria
   */
  validateWhisper(recording: AudioRecording): AudioValidationResult {
    const { duration, volume } = recording;

    // Check duration constraints
    if (duration < AUDIO_CONSTANTS.MIN_DURATION) {
      return {
        isValid: false,
        isWhisper: false,
        volume,
        duration,
        error: ERROR_MESSAGES.INVALID_AUDIO,
      };
    }

    if (duration > AUDIO_CONSTANTS.MAX_DURATION) {
      return {
        isValid: false,
        isWhisper: false,
        volume,
        duration,
        error: "Recording is too long. Please keep it under 30 seconds.",
      };
    }

    // Check if volume is in whisper range
    const isWhisperVolume = this.isWhisperVolume(volume);

    if (!isWhisperVolume) {
      return {
        isValid: false,
        isWhisper: false,
        volume,
        duration,
        error: ERROR_MESSAGES.NOT_A_WHISPER,
      };
    }

    return {
      isValid: true,
      isWhisper: true,
      volume,
      duration,
    };
  }

  /**
   * Checks if the volume level qualifies as a whisper
   */
  private isWhisperVolume(volume: number): boolean {
    return (
      volume >= this.volumeThreshold.WHISPER_MIN &&
      volume <= this.volumeThreshold.WHISPER_MAX &&
      volume > this.volumeThreshold.SILENCE_THRESHOLD
    );
  }

  /**
   * Analyzes volume patterns to detect whisper characteristics
   * Future enhancement: Could use ML model for more sophisticated detection
   */
  analyzeVolumePattern(volumeHistory: number[]): {
    averageVolume: number;
    volumeVariance: number;
    whisperConfidence: number;
  } {
    if (volumeHistory.length === 0) {
      return {
        averageVolume: 0,
        volumeVariance: 0,
        whisperConfidence: 0,
      };
    }

    const averageVolume =
      volumeHistory.reduce((sum, vol) => sum + vol, 0) / volumeHistory.length;

    const variance =
      volumeHistory.reduce((sum, vol) => {
        const diff = vol - averageVolume;
        return sum + diff * diff;
      }, 0) / volumeHistory.length;

    // Calculate whisper confidence based on volume characteristics
    let whisperConfidence = 0;

    if (this.isWhisperVolume(averageVolume)) {
      whisperConfidence += 0.6; // Base confidence for volume level

      // Lower variance (more consistent volume) increases confidence
      const normalizedVariance = Math.min(variance, 0.1) / 0.1;
      whisperConfidence += (1 - normalizedVariance) * 0.4;
    }

    return {
      averageVolume,
      volumeVariance: variance,
      whisperConfidence: Math.min(whisperConfidence, 1),
    };
  }

  /**
   * Provides feedback on how to improve the whisper
   */
  getWhisperFeedback(recording: AudioRecording): string[] {
    const feedback: string[] = [];
    const { volume, duration } = recording;

    if (volume < this.volumeThreshold.SILENCE_THRESHOLD) {
      feedback.push("Your recording is too quiet. Please speak a bit louder.");
    } else if (volume > this.volumeThreshold.WHISPER_MAX) {
      feedback.push(
        "Your recording is too loud for a whisper. Please speak more quietly."
      );
    }

    if (duration < AUDIO_CONSTANTS.MIN_DURATION) {
      feedback.push(
        "Your recording is too short. Please record for at least 1 second."
      );
    } else if (duration > AUDIO_CONSTANTS.MAX_DURATION) {
      feedback.push(
        "Your recording is too long. Please keep it under 30 seconds."
      );
    }

    if (feedback.length === 0) {
      feedback.push("Perfect whisper! Your recording meets all criteria.");
    }

    return feedback;
  }

  /**
   * Updates volume thresholds (useful for user calibration)
   */
  updateThresholds(newThresholds: Partial<VolumeThreshold>): void {
    this.volumeThreshold = { ...this.volumeThreshold, ...newThresholds };
  }

  /**
   * Gets current threshold values
   */
  getThresholds(): VolumeThreshold {
    return { ...this.volumeThreshold };
  }
}

/**
 * Factory function to create a WhisperValidator instance
 */
export const createWhisperValidator = (
  volumeThreshold?: VolumeThreshold
): WhisperValidator => {
  return new WhisperValidator(volumeThreshold);
};

/**
 * Default validator instance
 */
export const defaultWhisperValidator = createWhisperValidator();
