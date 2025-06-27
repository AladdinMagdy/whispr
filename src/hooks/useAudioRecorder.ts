import { useState, useRef, useCallback } from "react";
import { Audio } from "expo-av";
import {
  AudioRecording,
  VolumeThreshold,
  AudioValidationResult,
} from "@/types";
import {
  AUDIO_CONSTANTS,
  VOLUME_THRESHOLDS,
  ERROR_MESSAGES,
} from "@/constants";

interface UseAudioRecorderOptions {
  maxDuration?: number;
  volumeThreshold?: VolumeThreshold;
  onVolumeChange?: (volume: number) => void;
  onRecordingStart?: () => void;
  onRecordingStop?: () => void;
}

interface UseAudioRecorderReturn {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  volume: number;
  currentTime: number;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<AudioRecording | null>;
  pauseRecording: () => Promise<void>;
  resumeRecording: () => Promise<void>;
  resetRecording: () => void;
  validateWhisper: (recording: AudioRecording) => AudioValidationResult;
}

export const useAudioRecorder = (
  options: UseAudioRecorderOptions = {}
): UseAudioRecorderReturn => {
  const {
    maxDuration = AUDIO_CONSTANTS.MAX_DURATION,
    volumeThreshold = VOLUME_THRESHOLDS,
    onVolumeChange,
    onRecordingStart,
    onRecordingStop,
  } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const volumeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Request microphone permissions
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      return status === "granted";
    } catch (error) {
      console.error("Error requesting permissions:", error);
      return false;
    }
  }, []);

  // Configure audio mode
  const configureAudio = useCallback(async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    } catch (error) {
      console.error("Error configuring audio:", error);
    }
  }, []);

  // Start volume monitoring
  const startVolumeMonitoring = useCallback(() => {
    volumeIntervalRef.current = setInterval(async () => {
      if (recordingRef.current) {
        try {
          const status = await recordingRef.current.getStatusAsync();
          if (status.isRecording) {
            // Calculate volume from metering (if available)
            const currentVolume = status.metering || 0;
            setVolume(currentVolume);
            onVolumeChange?.(currentVolume);
          }
        } catch (error) {
          console.error("Error getting recording status:", error);
        }
      }
    }, 100); // Update every 100ms
  }, [onVolumeChange]);

  // Start duration monitoring
  const startDurationMonitoring = useCallback(() => {
    const startTime = Date.now();
    durationIntervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      setCurrentTime(elapsed);
      setDuration(elapsed);

      // Stop recording if max duration reached
      if (elapsed >= maxDuration) {
        stopRecording();
      }
    }, 100);
  }, [maxDuration]);

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    if (volumeIntervalRef.current) {
      clearInterval(volumeIntervalRef.current);
      volumeIntervalRef.current = null;
    }
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  // Start recording
  const startRecording = useCallback(async (): Promise<void> => {
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) {
        throw new Error(ERROR_MESSAGES.PERMISSION_DENIED);
      }

      await configureAudio();

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
        (status) => {
          // Real-time status updates
          if (status.isRecording) {
            setVolume(status.metering || 0);
            onVolumeChange?.(status.metering || 0);
          }
        },
        100 // Update interval
      );

      recordingRef.current = recording;
      setIsRecording(true);
      setIsPaused(false);
      setDuration(0);
      setCurrentTime(0);
      setVolume(0);

      startVolumeMonitoring();
      startDurationMonitoring();
      onRecordingStart?.();
    } catch (error) {
      console.error("Error starting recording:", error);
      throw new Error(ERROR_MESSAGES.RECORDING_FAILED);
    }
  }, [
    requestPermissions,
    configureAudio,
    startVolumeMonitoring,
    startDurationMonitoring,
    onRecordingStart,
    onVolumeChange,
  ]);

  // Stop recording
  const stopRecording =
    useCallback(async (): Promise<AudioRecording | null> => {
      try {
        if (!recordingRef.current) {
          return null;
        }

        await recordingRef.current.stopAndUnloadAsync();
        const uri = recordingRef.current.getURI();

        if (!uri) {
          throw new Error("No recording URI available");
        }

        stopMonitoring();
        setIsRecording(false);
        setIsPaused(false);
        onRecordingStop?.();

        const recording: AudioRecording = {
          uri,
          duration,
          volume: volume, // Average volume during recording
          isWhisper: volume <= volumeThreshold.WHISPER_MAX,
          timestamp: new Date(),
        };

        recordingRef.current = null;
        return recording;
      } catch (error) {
        console.error("Error stopping recording:", error);
        stopMonitoring();
        setIsRecording(false);
        setIsPaused(false);
        return null;
      }
    }, [
      duration,
      volume,
      volumeThreshold.WHISPER_MAX,
      stopMonitoring,
      onRecordingStop,
    ]);

  // Pause recording
  const pauseRecording = useCallback(async (): Promise<void> => {
    try {
      if (recordingRef.current && isRecording && !isPaused) {
        await recordingRef.current.pauseAsync();
        setIsPaused(true);
        stopMonitoring();
      }
    } catch (error) {
      console.error("Error pausing recording:", error);
    }
  }, [isRecording, isPaused, stopMonitoring]);

  // Resume recording
  const resumeRecording = useCallback(async (): Promise<void> => {
    try {
      if (recordingRef.current && isRecording && isPaused) {
        await recordingRef.current.startAsync();
        setIsPaused(false);
        startVolumeMonitoring();
        startDurationMonitoring();
      }
    } catch (error) {
      console.error("Error resuming recording:", error);
    }
  }, [isRecording, isPaused, startVolumeMonitoring, startDurationMonitoring]);

  // Reset recording
  const resetRecording = useCallback(() => {
    if (recordingRef.current) {
      recordingRef.current.stopAndUnloadAsync();
      recordingRef.current = null;
    }
    stopMonitoring();
    setIsRecording(false);
    setIsPaused(false);
    setDuration(0);
    setCurrentTime(0);
    setVolume(0);
  }, [stopMonitoring]);

  // Validate if recording is a whisper
  const validateWhisper = useCallback(
    (recording: AudioRecording): AudioValidationResult => {
      const { duration: recDuration, volume: recVolume } = recording;

      // Check duration
      if (recDuration < AUDIO_CONSTANTS.MIN_DURATION) {
        return {
          isValid: false,
          isWhisper: false,
          volume: recVolume,
          duration: recDuration,
          error: ERROR_MESSAGES.INVALID_AUDIO,
        };
      }

      if (recDuration > AUDIO_CONSTANTS.MAX_DURATION) {
        return {
          isValid: false,
          isWhisper: false,
          volume: recVolume,
          duration: recDuration,
          error: "Recording is too long. Please keep it under 30 seconds.",
        };
      }

      // Check if it's a whisper based on volume
      const isWhisper =
        recVolume <= volumeThreshold.WHISPER_MAX &&
        recVolume > volumeThreshold.SILENCE_THRESHOLD;

      if (!isWhisper) {
        return {
          isValid: false,
          isWhisper: false,
          volume: recVolume,
          duration: recDuration,
          error: ERROR_MESSAGES.NOT_A_WHISPER,
        };
      }

      return {
        isValid: true,
        isWhisper: true,
        volume: recVolume,
        duration: recDuration,
      };
    },
    [volumeThreshold]
  );

  return {
    isRecording,
    isPaused,
    duration,
    volume,
    currentTime,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
    validateWhisper,
  };
};
