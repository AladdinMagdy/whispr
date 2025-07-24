import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";

interface RecordingScreenProps {
  onBack: () => void;
  onComplete: () => void;
  onSkip: () => void;
}

const RecordingScreen: React.FC<RecordingScreenProps> = ({
  onBack,
  onComplete,
  onSkip,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [hasRecorded, setHasRecorded] = useState(false);

  const handleRecord = () => {
    if (!hasRecorded) {
      setIsRecording(true);
      // Simulate recording for 3 seconds
      setTimeout(() => {
        setIsRecording(false);
        setHasRecorded(true);
      }, 3000);
    }
  };

  const handleDelete = () => {
    setHasRecorded(false);
    setIsRecording(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Back Button */}
      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Ionicons name="arrow-back" size={20} color="#fff" />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      {/* Main Content */}
      <View style={styles.content}>
        {/* Title */}
        <Text style={styles.title}>Make your first whisper.</Text>
        <Text style={styles.subtitle}>
          Say anything. A hello. A thought. A feeling. Your voice belongs here.
        </Text>

        {/* Audio Waveform */}
        <View style={styles.waveformContainer}>
          <View style={styles.waveform}>
            <View style={styles.waveformNode} />
            <View
              style={[
                styles.waveformLine,
                isRecording && styles.waveformLineActive,
              ]}
            />
            <View style={styles.waveformNode} />
          </View>
        </View>

        {/* Recording Controls */}
        <View style={styles.controlsContainer}>
          {hasRecorded ? (
            <>
              <TouchableOpacity style={styles.controlButton}>
                <Ionicons name="play" size={24} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.recordButton}
                onPress={handleRecord}
              >
                <Ionicons name="refresh" size={32} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.controlButton}
                onPress={handleDelete}
              >
                <Ionicons name="trash" size={24} color="#fff" />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.controlButton} />
              <TouchableOpacity
                style={[
                  styles.recordButton,
                  isRecording && styles.recordingButton,
                ]}
                onPress={handleRecord}
                disabled={isRecording}
              >
                <Ionicons name="mic" size={32} color="#fff" />
              </TouchableOpacity>
              <View style={styles.controlButton} />
            </>
          )}
        </View>

        {!hasRecorded && <Text style={styles.recordText}>Tap to record</Text>}
      </View>

      {/* Progress Dots */}
      <View style={styles.progressContainer}>
        <View style={styles.progressDots}>
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={[styles.dot, styles.activeDot]} />
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.nextButton, !hasRecorded && styles.disabledButton]}
          onPress={onComplete}
          disabled={!hasRecorded}
        >
          <Text style={styles.nextButtonText}>Next</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipButton} onPress={onSkip}>
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 20,
  },
  backText: {
    color: "#fff",
    fontSize: 16,
    marginLeft: 8,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: "#fff",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 60,
    opacity: 0.8,
  },
  waveformContainer: {
    marginBottom: 60,
  },
  waveform: {
    flexDirection: "row",
    alignItems: "center",
    width: 200,
  },
  waveformLine: {
    flex: 1,
    height: 2,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  waveformLineActive: {
    backgroundColor: "#31FF9C",
  },
  waveformNode: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#fff",
    marginHorizontal: 8,
  },
  controlsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: 200,
    marginBottom: 20,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#8B5CF6",
    justifyContent: "center",
    alignItems: "center",
  },
  recordingButton: {
    backgroundColor: "#EF4444",
  },
  recordText: {
    fontSize: 16,
    color: "#fff",
    textAlign: "center",
  },
  progressContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  progressDots: {
    flexDirection: "row",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  activeDot: {
    backgroundColor: "#fff",
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  nextButton: {
    backgroundColor: "#8B5CF6",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  disabledButton: {
    backgroundColor: "rgba(139, 92, 246, 0.5)",
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  skipButton: {
    alignItems: "center",
  },
  skipText: {
    color: "#fff",
    fontSize: 16,
  },
});

export default RecordingScreen;
