import React, { useMemo, useCallback, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Whisper } from "../types";
import { usePerformanceMonitor } from "../hooks/usePerformanceMonitor";

interface AudioControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onReplay: () => void;
  whisper: Whisper;
  progressRef?: React.MutableRefObject<number>;
  durationRef?: React.MutableRefObject<number>;
}

// Lightweight progress bar component that updates directly without re-renders
const ProgressBar: React.FC<{
  progressRef?: React.MutableRefObject<number>;
  durationRef?: React.MutableRefObject<number>;
}> = React.memo(({ progressRef, durationRef }) => {
  // Add performance monitoring
  usePerformanceMonitor("ProgressBar");

  const progressFillRef = useRef<View>(null);
  const progressTextRef = useRef<Text>(null);
  const durationTextRef = useRef<Text>(null);
  const lastProgressRef = useRef(0);
  const lastDurationRef = useRef(0);

  // Update progress directly without state changes
  useEffect(() => {
    const interval = setInterval(() => {
      if (!progressRef || !durationRef) return;

      const currentProgress = progressRef.current;
      const currentDuration = durationRef.current;

      // Only update if values actually changed
      if (
        currentProgress !== lastProgressRef.current ||
        currentDuration !== lastDurationRef.current
      ) {
        lastProgressRef.current = currentProgress;
        lastDurationRef.current = currentDuration;

        const formatTime = (seconds: number = 0): string => {
          const m = Math.floor(seconds / 60)
            .toString()
            .padStart(2, "0");
          const s = Math.floor(seconds % 60)
            .toString()
            .padStart(2, "0");
          return `${m}:${s}`;
        };

        const progressPercentage =
          currentDuration > 0 ? (currentProgress / currentDuration) * 100 : 0;

        // Update progress bar width directly
        if (progressFillRef.current) {
          progressFillRef.current.setNativeProps({
            style: { width: `${progressPercentage}%` },
          });
        }

        // Update time text directly
        if (progressTextRef.current) {
          progressTextRef.current.setNativeProps({
            text: formatTime(currentProgress),
          });
        }

        if (durationTextRef.current) {
          durationTextRef.current.setNativeProps({
            text: formatTime(currentDuration),
          });
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [progressRef, durationRef]);

  return (
    <View style={styles.progressContainer}>
      <View style={styles.progressBar}>
        <View
          ref={progressFillRef}
          style={[styles.progressFill, { width: "0%" }]}
        />
      </View>
      <View style={styles.timeInfo}>
        <Text ref={progressTextRef} style={styles.timeText}>
          0:00
        </Text>
        <Text ref={durationTextRef} style={styles.timeText}>
          0:00
        </Text>
      </View>
    </View>
  );
});

ProgressBar.displayName = "ProgressBar";

const AudioControls: React.FC<AudioControlsProps> = React.memo(
  ({ isPlaying, onPlayPause, onReplay, whisper, progressRef, durationRef }) => {
    // Add performance monitoring
    usePerformanceMonitor("AudioControls");

    // Memoize user info to prevent re-renders
    const userInfo = useMemo(
      () => ({
        userName: whisper.userDisplayName || "Mysterious Whisperer",
        whisperInfo: `${whisper.whisperPercentage?.toFixed(1) || "0"}% whisper`,
      }),
      [whisper.userDisplayName, whisper.whisperPercentage]
    );

    // Memoize callback functions
    const handlePlayPause = useCallback(() => {
      onPlayPause();
    }, [onPlayPause]);

    const handleReplay = useCallback(() => {
      onReplay();
    }, [onReplay]);

    return (
      <View style={styles.container}>
        {/* User info */}
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{userInfo.userName}</Text>
          <Text style={styles.whisperInfo}>{userInfo.whisperInfo}</Text>
        </View>

        {/* Progress bar - separate component for performance */}
        <ProgressBar progressRef={progressRef} durationRef={durationRef} />

        {/* Control buttons */}
        <View style={styles.controlsContainer}>
          {/* Replay button */}
          <TouchableOpacity style={styles.replayButton} onPress={handleReplay}>
            <Text style={styles.replayButtonText}>🔄</Text>
          </TouchableOpacity>

          {/* Play/Pause button */}
          <TouchableOpacity style={styles.playButton} onPress={handlePlayPause}>
            <Text style={styles.playButtonText}>{isPlaying ? "⏸️" : "▶️"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
);

AudioControls.displayName = "AudioControls";

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 200,
    left: 20,
    right: 20,
    zIndex: 10,
    alignItems: "center",
  },
  userInfo: {
    alignItems: "center",
    marginBottom: 20,
  },
  userName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  whisperInfo: {
    fontSize: 16,
    color: "#fff",
    opacity: 0.9,
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  progressContainer: {
    width: "100%",
    height: 40,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 20,
    marginBottom: 20,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    borderRadius: 20,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "rgba(255, 255, 255, 1)",
  },
  timeInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 10,
  },
  timeText: {
    fontSize: 16,
    color: "#fff",
    opacity: 0.9,
  },
  controlsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },
  replayButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  replayButtonText: {
    fontSize: 20,
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  playButtonText: {
    fontSize: 32,
  },
});

export default AudioControls;
