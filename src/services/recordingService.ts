/**
 * Recording Service using react-native-audio-recorder-player
 * Provides real audio recording with metering for whisper detection
 */

import AudioRecorderPlayer, {
  AudioSet,
  AVEncoderAudioQualityIOSType,
  AVEncodingOption,
  AudioSourceAndroidType,
  AudioEncoderAndroidType,
  AVModeIOSOption,
} from "react-native-audio-recorder-player";
import {
  WHISPER_VALIDATION,
  WHISPER_COLORS,
} from "../constants/whisperValidation";

export interface AudioLevelData {
  level: number; // 0-1 range (converted from metering)
  isWhisper: boolean;
  timestamp: number;
}

export interface RecordingEvent {
  currentMetering?: number;
  currentPosition?: number;
  [key: string]: unknown;
}

export interface RecordingState {
  isRecording: boolean;
  duration: number;
  audioLevel: number;
  isWhisper: boolean;
  recordingUri: string | null;
}

export interface AudioRecorderCallbacks {
  onAudioLevelChange?: (level: number, isWhisper: boolean) => void;
  onDurationChange?: (duration: number) => void;
  onRecordingComplete?: (uri: string) => void;
  onRecordingStopped?: (uri: string, wasAutoStop: boolean) => void;
  onError?: (error: string) => void;
}

export class RecordingService {
  private static instance: RecordingService;
  private audioRecorderPlayer: AudioRecorderPlayer;
  private isRecording: boolean = false;
  private recordingStartTime: number = 0;
  private callbacks: AudioRecorderCallbacks = {};
  private audioLevels: AudioLevelData[] = [];
  private whisperThreshold: number =
    WHISPER_VALIDATION.DEFAULT_WHISPER_THRESHOLD;
  private autoStopTriggered: boolean = false;
  private wasAutoStop: boolean = false;

  private constructor() {
    this.audioRecorderPlayer = new AudioRecorderPlayer();
    this.audioRecorderPlayer.setSubscriptionDuration(
      WHISPER_VALIDATION.RECORDING.SUBSCRIPTION_DURATION
    );
  }

  static getInstance(): RecordingService {
    if (!RecordingService.instance) {
      RecordingService.instance = new RecordingService();
    }
    return RecordingService.instance;
  }

  /**
   * Configure audio recording settings
   */
  private getAudioSet(): AudioSet {
    return {
      AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
      AudioSourceAndroid: AudioSourceAndroidType.MIC,
      AVModeIOS: AVModeIOSOption.measurement,
      AVEncoderAudioQualityKeyIOS: AVEncoderAudioQualityIOSType.high,
      AVNumberOfChannelsKeyIOS: 1, // Mono for better whisper detection
      AVFormatIDKeyIOS: AVEncodingOption.aac,
    };
  }

  /**
   * Set callbacks for audio events
   */
  setCallbacks(callbacks: AudioRecorderCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Set whisper detection threshold
   */
  setWhisperThreshold(threshold: number): void {
    this.whisperThreshold = Math.max(0, Math.min(1, threshold));
  }

  /**
   * Auto-calibrate threshold based on recent audio levels
   */
  autoCalibrateThreshold(): void {
    if (
      this.audioLevels.length < WHISPER_VALIDATION.AUTO_CALIBRATION.MIN_SAMPLES
    ) {
      console.log("Not enough audio samples for calibration");
      return;
    }

    const recentLevels = this.audioLevels.slice(
      -WHISPER_VALIDATION.AUTO_CALIBRATION.RECENT_SAMPLES
    );
    const maxLevel = Math.max(...recentLevels.map((data) => data.level));
    const avgLevel =
      recentLevels.reduce((sum, data) => sum + data.level, 0) /
      recentLevels.length;

    // Set threshold to 60% of the max level seen, but within bounds
    const newThreshold = Math.max(
      WHISPER_VALIDATION.AUTO_CALIBRATION.MIN_THRESHOLD,
      Math.min(
        WHISPER_VALIDATION.AUTO_CALIBRATION.MAX_THRESHOLD,
        maxLevel * WHISPER_VALIDATION.AUTO_CALIBRATION.CALIBRATION_FACTOR
      )
    );

    console.log("🎯 Auto-calibrating threshold:", {
      oldThreshold: this.whisperThreshold,
      newThreshold,
      maxLevel,
      avgLevel,
      samples: recentLevels.length,
    });

    this.whisperThreshold = newThreshold;
  }

  /**
   * Get current threshold
   */
  getWhisperThreshold(): number {
    return this.whisperThreshold;
  }

  /**
   * Start recording with real audio metering
   */
  async startRecording(): Promise<void> {
    try {
      if (this.isRecording) {
        throw new Error("Already recording");
      }

      // Reset audio levels
      this.audioLevels = [];
      this.recordingStartTime = Date.now();
      this.autoStopTriggered = false;
      this.wasAutoStop = false;

      // Start recording with metering enabled
      await this.audioRecorderPlayer.startRecorder(
        undefined, // Use default path
        this.getAudioSet(),
        true // Enable metering
      );

      this.isRecording = true;

      // Add record back listener for real audio levels
      this.audioRecorderPlayer.addRecordBackListener((e: RecordingEvent) => {
        const currentTime = Date.now();
        const duration = (currentTime - this.recordingStartTime) / 1000;

        // Debug: Log raw metering values
        console.log("🔊 Raw metering data:", {
          currentMetering: e.currentMetering,
          currentPosition: e.currentPosition,
          meteringType: typeof e.currentMetering,
          hasMetering: "currentMetering" in e,
        });

        // Convert metering to 0-1 range
        // The metering value can vary by platform and device
        let audioLevel = 0;

        if (e.currentMetering !== undefined && e.currentMetering !== null) {
          // Handle different metering formats
          if (e.currentMetering <= 1 && e.currentMetering >= 0) {
            // Already 0-1 range
            audioLevel = e.currentMetering;
          } else if (e.currentMetering <= 100 && e.currentMetering >= 0) {
            // 0-100 range
            audioLevel = e.currentMetering / 100;
          } else if (e.currentMetering < 0) {
            // Decibel format (negative values like -40, -60, etc.)
            // Convert from dB to linear scale (0-1)
            // Typical range: -60 dB (very quiet) to 0 dB (very loud)
            const dbValue = e.currentMetering;
            const minDb = WHISPER_VALIDATION.AUDIO_LEVELS.MIN_DB;
            const maxDb = WHISPER_VALIDATION.AUDIO_LEVELS.MAX_DB;

            // Convert dB to linear scale using the correct formula
            // dB = 20 * log10(amplitude)
            // amplitude = 10^(dB/20)
            const normalizedDb = Math.max(minDb, Math.min(maxDb, dbValue));
            audioLevel = Math.pow(10, normalizedDb / 20);

            // Ensure it's between 0 and 1
            audioLevel = Math.max(0, Math.min(1, audioLevel));
          } else {
            // Unknown range, try to normalize
            audioLevel = Math.min(1, e.currentMetering / 1000);
          }
        }

        // Ensure audio level is between min and max
        audioLevel = Math.max(
          WHISPER_VALIDATION.AUDIO_LEVELS.MIN_LEVEL,
          Math.min(WHISPER_VALIDATION.AUDIO_LEVELS.MAX_LEVEL, audioLevel)
        );

        const isWhisper = audioLevel <= this.whisperThreshold;

        // Debug: Log processed values
        console.log("🎤 Processed audio data:", {
          rawMetering: e.currentMetering,
          audioLevel,
          isWhisper,
          threshold: this.whisperThreshold,
          percentage: Math.round(audioLevel * 100),
        });

        // Store audio level data
        const audioData: AudioLevelData = {
          level: audioLevel,
          isWhisper,
          timestamp: currentTime,
        };
        this.audioLevels.push(audioData);

        // Call callbacks
        this.callbacks.onAudioLevelChange?.(audioLevel, isWhisper);
        this.callbacks.onDurationChange?.(duration);

        // Auto-stop if duration exceeds maximum
        if (
          duration >= WHISPER_VALIDATION.RECORDING.MAX_DURATION &&
          this.isRecording &&
          !this.autoStopTriggered
        ) {
          console.log("⏰ Auto-stopping recording at maximum duration");
          this.autoStopTriggered = true; // Prevent multiple auto-stop attempts
          this.wasAutoStop = true; // Mark as auto-stop
          // Use setTimeout to avoid calling stopRecording from within the callback
          setTimeout(() => {
            if (this.isRecording) {
              this.stopRecording().catch(console.error);
            }
          }, 0);
        }
      });

      console.log("Recording started with real audio metering");
    } catch (error) {
      console.error("Error starting recording:", error);
      this.callbacks.onError?.(
        error instanceof Error ? error.message : "Unknown error"
      );
      throw error;
    }
  }

  /**
   * Stop recording
   */
  async stopRecording(): Promise<string> {
    try {
      if (!this.isRecording) {
        // If auto-stop was triggered but recording state is inconsistent,
        // try to clean up gracefully
        if (this.autoStopTriggered) {
          console.log("🔄 Auto-stop cleanup: recording already stopped");
          this.audioRecorderPlayer.removeRecordBackListener();
          this.isRecording = false;
          return ""; // Return empty URI since recording was already stopped
        }
        throw new Error("Not recording");
      }

      // Stop recording
      const uri = await this.audioRecorderPlayer.stopRecorder();

      // Remove listener
      this.audioRecorderPlayer.removeRecordBackListener();

      this.isRecording = false;

      // Call completion callback
      this.callbacks.onRecordingComplete?.(uri);

      // Call stopped callback with auto-stop info
      this.callbacks.onRecordingStopped?.(uri, this.wasAutoStop);

      console.log("Recording stopped, URI:", uri);
      return uri;
    } catch (error) {
      console.error("Error stopping recording:", error);
      this.callbacks.onError?.(
        error instanceof Error ? error.message : "Unknown error"
      );
      throw error;
    }
  }

  /**
   * Pause recording
   */
  async pauseRecording(): Promise<string> {
    try {
      if (!this.isRecording) {
        throw new Error("Not recording");
      }

      const uri = await this.audioRecorderPlayer.pauseRecorder();
      console.log("Recording paused");
      return uri;
    } catch (error) {
      console.error("Error pausing recording:", error);
      this.callbacks.onError?.(
        error instanceof Error ? error.message : "Unknown error"
      );
      throw error;
    }
  }

  /**
   * Resume recording
   */
  async resumeRecording(): Promise<string> {
    try {
      if (this.isRecording) {
        throw new Error("Already recording");
      }

      const uri = await this.audioRecorderPlayer.resumeRecorder();
      this.isRecording = true;
      console.log("Recording resumed");
      return uri;
    } catch (error) {
      console.error("Error resuming recording:", error);
      this.callbacks.onError?.(
        error instanceof Error ? error.message : "Unknown error"
      );
      throw error;
    }
  }

  /**
   * Get current recording state
   */
  getRecordingState(): RecordingState {
    return {
      isRecording: this.isRecording,
      duration:
        this.audioLevels.length > 0
          ? (this.audioLevels[this.audioLevels.length - 1].timestamp -
              this.recordingStartTime) /
            1000
          : 0,
      audioLevel:
        this.audioLevels.length > 0
          ? this.audioLevels[this.audioLevels.length - 1].level
          : 0,
      isWhisper:
        this.audioLevels.length > 0
          ? this.audioLevels[this.audioLevels.length - 1].isWhisper
          : false,
      recordingUri: null,
    };
  }

  /**
   * Get all audio level data
   */
  getAudioLevels(): AudioLevelData[] {
    return [...this.audioLevels];
  }

  /**
   * Get whisper statistics
   */
  getWhisperStatistics(): {
    totalSamples: number;
    whisperSamples: number;
    whisperPercentage: number;
    averageLevel: number;
    maxLevel: number;
    minLevel: number;
    loudSamples: number;
    loudPercentage: number;
  } {
    if (this.audioLevels.length === 0) {
      return {
        totalSamples: 0,
        whisperSamples: 0,
        whisperPercentage: 0,
        averageLevel: 0,
        maxLevel: 0,
        minLevel: 0,
        loudSamples: 0,
        loudPercentage: 0,
      };
    }

    const whisperSamples = this.audioLevels.filter(
      (data) => data.isWhisper
    ).length;
    const loudSamples = this.audioLevels.filter(
      (data) => data.level > this.whisperThreshold
    ).length;
    const levels = this.audioLevels.map((data) => data.level);
    const averageLevel =
      levels.reduce((acc, level) => acc + level, 0) / levels.length;
    const maxLevel = Math.max(...levels);
    const minLevel = Math.min(...levels);

    return {
      totalSamples: this.audioLevels.length,
      whisperSamples,
      whisperPercentage: whisperSamples / this.audioLevels.length,
      averageLevel,
      maxLevel,
      minLevel,
      loudSamples,
      loudPercentage: loudSamples / this.audioLevels.length,
    };
  }

  /**
   * Reset recording service state
   */
  reset(): void {
    this.audioLevels = [];
    this.isRecording = false;
    this.recordingStartTime = 0;
    this.callbacks = {};
    this.whisperThreshold = WHISPER_VALIDATION.DEFAULT_WHISPER_THRESHOLD;
    this.autoStopTriggered = false;
    this.wasAutoStop = false;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.isRecording) {
      this.audioRecorderPlayer.removeRecordBackListener();
    }
    this.reset();
  }

  /**
   * Reset singleton instance - allows complete reinitialization
   * Use this when you need to completely reset the service state
   */
  static resetInstance(): void {
    if (RecordingService.instance) {
      RecordingService.instance.destroy();
      RecordingService.instance = new RecordingService();
      console.log("🔄 RecordingService singleton reset successfully");
    }
  }

  /**
   * Force destroy singleton instance
   * Use this when you need to completely clean up the service
   */
  static destroyInstance(): void {
    if (RecordingService.instance) {
      RecordingService.instance.destroy();
      RecordingService.instance = null as unknown as RecordingService;
      console.log("🗑️ RecordingService singleton destroyed");
    }
  }
}

/**
 * Factory function to get RecordingService instance
 */
export const getRecordingService = (): RecordingService => {
  return RecordingService.getInstance();
};

/**
 * Reset the RecordingService singleton instance
 * Use this when you need to completely reset the service state
 */
export const resetRecordingService = (): void => {
  RecordingService.resetInstance();
};

/**
 * Destroy the RecordingService singleton instance
 * Use this when you need to completely clean up the service
 */
export const destroyRecordingService = (): void => {
  RecordingService.destroyInstance();
};

/**
 * Utility functions for recording operations
 */
export const RecordingUtils = {
  /**
   * Convert seconds to MM:SS format
   */
  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
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
      return `Too loud (${RecordingUtils.levelToPercentage(
        level
      )}%) - whisper quieter`;
    }
    return `Whisper detected (${RecordingUtils.levelToPercentage(level)}%)`;
  },

  /**
   * Get color for whisper status
   */
  getWhisperStatusColor(isWhisper: boolean): string {
    return isWhisper ? WHISPER_COLORS.WHISPER : WHISPER_COLORS.LOUD;
  },
};
