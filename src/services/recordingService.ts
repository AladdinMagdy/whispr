/**
 * Recording Service using react-native-audio-recorder-player
 * Provides real audio recording with metering for whisper detection
 */

import AudioRecorderPlayer, {
  AudioSet,
  AVEncoderAudioQualityIOSType,
  AVEncodingOption,
  AudioSourceAndroidType,
  OutputFormatAndroidType,
  AudioEncoderAndroidType,
  AVModeIOSOption,
} from "react-native-audio-recorder-player";
import { Platform } from "react-native";

export interface AudioLevelData {
  level: number; // 0-1 range (converted from metering)
  isWhisper: boolean;
  timestamp: number;
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
  onError?: (error: string) => void;
}

export class RecordingService {
  private static instance: RecordingService;
  private audioRecorderPlayer: AudioRecorderPlayer;
  private isRecording: boolean = false;
  private recordingStartTime: number = 0;
  private callbacks: AudioRecorderCallbacks = {};
  private audioLevels: AudioLevelData[] = [];
  private whisperThreshold: number = 0.4; // 40% of max volume

  private constructor() {
    this.audioRecorderPlayer = new AudioRecorderPlayer();
    this.audioRecorderPlayer.setSubscriptionDuration(0.1); // 100ms updates
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

      // Start recording with metering enabled
      const uri = await this.audioRecorderPlayer.startRecorder(
        undefined, // Use default path
        this.getAudioSet(),
        true // Enable metering
      );

      this.isRecording = true;

      // Add record back listener for real audio levels
      this.audioRecorderPlayer.addRecordBackListener((e: any) => {
        const currentTime = Date.now();
        const duration = (currentTime - this.recordingStartTime) / 1000;

        // Convert metering to 0-1 range (metering is typically 0-100)
        const audioLevel = Math.min(1, (e.currentMetering || 0) / 100);
        const isWhisper = audioLevel <= this.whisperThreshold;

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
        throw new Error("Not recording");
      }

      // Stop recording
      const uri = await this.audioRecorderPlayer.stopRecorder();

      // Remove listener
      this.audioRecorderPlayer.removeRecordBackListener();

      this.isRecording = false;

      // Call completion callback
      this.callbacks.onRecordingComplete?.(uri);

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
  } {
    if (this.audioLevels.length === 0) {
      return {
        totalSamples: 0,
        whisperSamples: 0,
        whisperPercentage: 0,
        averageLevel: 0,
        maxLevel: 0,
        minLevel: 0,
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
      whisperPercentage: whisperSamples / this.audioLevels.length,
      averageLevel,
      maxLevel,
      minLevel,
    };
  }

  /**
   * Reset recording service
   */
  reset(): void {
    this.audioLevels = [];
    this.isRecording = false;
    this.recordingStartTime = 0;
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
}

/**
 * Factory function to get RecordingService instance
 */
export const getRecordingService = (): RecordingService => {
  return RecordingService.getInstance();
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
    return isWhisper ? "#4CAF50" : "#F44336";
  },
};
