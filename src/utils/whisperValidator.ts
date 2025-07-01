/**
 * Whisper Validator Utility
 * Provides audio level analysis and whisper detection for the Whispr app
 */

export interface AudioLevelData {
  level: number; // 0-1 range
  isWhisper: boolean;
  timestamp: number;
}

export interface WhisperValidationResult {
  isValid: boolean;
  confidence: number; // 0-1 range
  averageLevel: number;
  whisperPercentage: number;
  reason?: string;
}

export class WhisperValidator {
  private static readonly WHISPER_THRESHOLD = 0.3; // 30% of max volume
  private static readonly MIN_WHISPER_PERCENTAGE = 0.7; // 70% of recording should be whisper
  private static readonly MIN_RECORDING_DURATION = 2; // Minimum 2 seconds
  private static readonly MAX_RECORDING_DURATION = 30; // Maximum 30 seconds

  private audioLevels: AudioLevelData[] = [];
  private startTime: number | null = null;

  /**
   * Start monitoring audio levels
   */
  startMonitoring(): void {
    this.audioLevels = [];
    this.startTime = Date.now();
  }

  /**
   * Add an audio level measurement
   */
  addAudioLevel(level: number): AudioLevelData {
    const audioData: AudioLevelData = {
      level,
      isWhisper: level <= WhisperValidator.WHISPER_THRESHOLD,
      timestamp: Date.now(),
    };

    this.audioLevels.push(audioData);
    return audioData;
  }

  /**
   * Get current whisper status
   */
  getCurrentStatus(): { isWhisper: boolean; level: number } {
    if (this.audioLevels.length === 0) {
      return { isWhisper: false, level: 0 };
    }

    const latest = this.audioLevels[this.audioLevels.length - 1];
    return {
      isWhisper: latest.isWhisper,
      level: latest.level,
    };
  }

  /**
   * Validate the complete recording
   */
  validateRecording(): WhisperValidationResult {
    if (this.audioLevels.length === 0) {
      return {
        isValid: false,
        confidence: 0,
        averageLevel: 0,
        whisperPercentage: 0,
        reason: "No audio data recorded",
      };
    }

    const duration = this.getDuration();
    if (duration < WhisperValidator.MIN_RECORDING_DURATION) {
      return {
        isValid: false,
        confidence: 0,
        averageLevel: this.getAverageLevel(),
        whisperPercentage: this.getWhisperPercentage(),
        reason: `Recording too short (${duration.toFixed(1)}s). Minimum ${
          WhisperValidator.MIN_RECORDING_DURATION
        }s required.`,
      };
    }

    if (duration > WhisperValidator.MAX_RECORDING_DURATION) {
      return {
        isValid: false,
        confidence: 0,
        averageLevel: this.getAverageLevel(),
        whisperPercentage: this.getWhisperPercentage(),
        reason: `Recording too long (${duration.toFixed(1)}s). Maximum ${
          WhisperValidator.MAX_RECORDING_DURATION
        }s allowed.`,
      };
    }

    const whisperPercentage = this.getWhisperPercentage();
    const averageLevel = this.getAverageLevel();
    const isValid =
      whisperPercentage >= WhisperValidator.MIN_WHISPER_PERCENTAGE;

    // Calculate confidence based on whisper percentage and consistency
    const confidence = this.calculateConfidence(
      whisperPercentage,
      averageLevel
    );

    return {
      isValid,
      confidence,
      averageLevel,
      whisperPercentage,
      reason: isValid
        ? undefined
        : `Too loud. Only ${(whisperPercentage * 100).toFixed(
            1
          )}% was whispered.`,
    };
  }

  /**
   * Get recording duration in seconds
   */
  private getDuration(): number {
    if (!this.startTime || this.audioLevels.length === 0) {
      return 0;
    }

    const endTime = this.audioLevels[this.audioLevels.length - 1].timestamp;
    return (endTime - this.startTime) / 1000;
  }

  /**
   * Get average audio level
   */
  private getAverageLevel(): number {
    if (this.audioLevels.length === 0) return 0;

    const sum = this.audioLevels.reduce((acc, data) => acc + data.level, 0);
    return sum / this.audioLevels.length;
  }

  /**
   * Get percentage of recording that was whispered
   */
  private getWhisperPercentage(): number {
    if (this.audioLevels.length === 0) return 0;

    const whisperCount = this.audioLevels.filter(
      (data) => data.isWhisper
    ).length;
    return whisperCount / this.audioLevels.length;
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(
    whisperPercentage: number,
    averageLevel: number
  ): number {
    // Base confidence on whisper percentage
    let confidence = whisperPercentage;

    // Boost confidence if average level is very low (good whisper)
    if (averageLevel < 0.2) {
      confidence += 0.1;
    }

    // Reduce confidence if average level is high (poor whisper)
    if (averageLevel > 0.4) {
      confidence -= 0.2;
    }

    // Ensure confidence is between 0 and 1
    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Reset the validator
   */
  reset(): void {
    this.audioLevels = [];
    this.startTime = null;
  }

  /**
   * Get audio level statistics
   */
  getStatistics(): {
    totalSamples: number;
    whisperSamples: number;
    averageLevel: number;
    maxLevel: number;
    minLevel: number;
    duration: number;
  } {
    if (this.audioLevels.length === 0) {
      return {
        totalSamples: 0,
        whisperSamples: 0,
        averageLevel: 0,
        maxLevel: 0,
        minLevel: 0,
        duration: 0,
      };
    }

    const whisperSamples = this.audioLevels.filter(
      (data) => data.isWhisper
    ).length;
    const levels = this.audioLevels.map((data) => data.level);
    const averageLevel =
      levels.reduce((acc, level) => acc + level, 0) / levels.length;
    const maxLevel = Math.max(...levels);
    const minLevel = Math.min(...levels);

    return {
      totalSamples: this.audioLevels.length,
      whisperSamples,
      averageLevel,
      maxLevel,
      minLevel,
      duration: this.getDuration(),
    };
  }
}

/**
 * Real-time audio level analyzer
 * Simulates audio level detection (in real implementation, this would analyze actual audio data)
 */
export class AudioLevelAnalyzer {
  private static instance: AudioLevelAnalyzer;
  private isAnalyzing = false;
  private onLevelChange?: (level: number) => void;

  static getInstance(): AudioLevelAnalyzer {
    if (!AudioLevelAnalyzer.instance) {
      AudioLevelAnalyzer.instance = new AudioLevelAnalyzer();
    }
    return AudioLevelAnalyzer.instance;
  }

  /**
   * Start analyzing audio levels
   */
  startAnalysis(onLevelChange: (level: number) => void): void {
    this.onLevelChange = onLevelChange;
    this.isAnalyzing = true;
    this.analyze();
  }

  /**
   * Stop analyzing audio levels
   */
  stopAnalysis(): void {
    this.isAnalyzing = false;
    this.onLevelChange = undefined;
  }

  /**
   * Simulate audio level analysis
   * In a real implementation, this would analyze actual audio data from the microphone
   */
  private analyze(): void {
    if (!this.isAnalyzing || !this.onLevelChange) return;

    // Simulate audio level (0-1 range)
    // In reality, this would come from actual audio analysis
    const simulatedLevel = Math.random() * 0.6; // 0-60% range for more realistic simulation

    this.onLevelChange(simulatedLevel);

    // Continue analysis
    setTimeout(() => this.analyze(), 100); // 10 FPS
  }
}

/**
 * Utility functions for whisper validation
 */
export const WhisperUtils = {
  /**
   * Check if a single audio level qualifies as a whisper
   */
  isWhisperLevel(level: number, threshold: number = 0.3): boolean {
    return level <= threshold;
  },

  /**
   * Convert audio level to percentage
   */
  levelToPercentage(level: number): number {
    return Math.round(level * 100);
  },

  /**
   * Get whisper status description
   */
  getWhisperStatusDescription(isWhisper: boolean, level: number): string {
    if (!isWhisper) {
      return `Too loud (${WhisperUtils.levelToPercentage(
        level
      )}%) - whisper quieter`;
    }
    return `Whisper detected (${WhisperUtils.levelToPercentage(level)}%)`;
  },

  /**
   * Get color for whisper status
   */
  getWhisperStatusColor(isWhisper: boolean): string {
    return isWhisper ? "#4CAF50" : "#F44336";
  },
};
