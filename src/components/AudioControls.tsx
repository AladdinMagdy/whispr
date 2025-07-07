import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Whisper } from "../types";

interface AudioControlsProps {
  isPlaying: boolean;
  progress: number;
  duration: number;
  onPlayPause: () => void;
  onReplay: () => void;
  whisper: Whisper;
}

const AudioControls: React.FC<AudioControlsProps> = ({
  isPlaying,
  progress,
  duration,
  onPlayPause,
  onReplay,
  whisper,
}) => {
  const formatTime = (seconds: number = 0): string => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = Math.floor(seconds % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${s}`;
  };

  const progressPercentage = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <View style={styles.container}>
      {/* User info */}
      <View style={styles.userInfo}>
        <Text style={styles.userName}>
          {whisper.userDisplayName || "Anonymous"}
        </Text>
        <Text style={styles.whisperInfo}>
          {whisper.whisperPercentage?.toFixed(1) || "0"}% whisper •{" "}
          {formatTime(duration)}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[styles.progressFill, { width: `${progressPercentage}%` }]}
          />
        </View>
        <View style={styles.timeInfo}>
          <Text style={styles.timeText}>{formatTime(progress)}</Text>
          <Text style={styles.timeText}>{formatTime(duration)}</Text>
        </View>
      </View>

      {/* Control buttons */}
      <View style={styles.controlsContainer}>
        {/* Replay button */}
        <TouchableOpacity style={styles.replayButton} onPress={onReplay}>
          <Text style={styles.replayButtonText}>🔄</Text>
        </TouchableOpacity>

        {/* Play/Pause button */}
        <TouchableOpacity style={styles.playButton} onPress={onPlayPause}>
          <Text style={styles.playButtonText}>{isPlaying ? "⏸️" : "▶️"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

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
    marginBottom: 20,
  },
  progressBar: {
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#fff",
    borderRadius: 2,
  },
  timeInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  timeText: {
    fontSize: 12,
    color: "#fff",
    opacity: 0.8,
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
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
