import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Alert,
  Dimensions,
  Animated,
  TouchableOpacity,
} from "react-native";
import { Button, Text, Card, ProgressBar } from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { useAppStore } from "../store/useAppStore";
import {
  getRecordingService,
  RecordingUtils,
} from "../services/recordingService";
import { getUploadService, UploadUtils } from "../services/uploadService";

const { width, height } = Dimensions.get("window");

type RootStackParamList = {
  Home: undefined;
  Record: undefined;
  Feed: undefined;
};

type RecordScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "Record"
>;

interface RecordingState {
  isRecording: boolean;
  duration: number;
  audioLevel: number;
  isWhisper: boolean;
  recordingUri: string | null;
  uploadProgress: number;
  isUploading: boolean;
}

export default function RecordScreen() {
  const navigation = useNavigation<RecordScreenNavigationProp>();
  const { setLoading, setError, isLoading } = useAppStore();

  // Initialize recording service
  const recordingService = useRef(getRecordingService()).current;
  const uploadService = useRef(getUploadService()).current;

  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    duration: 0,
    audioLevel: 0,
    isWhisper: false,
    recordingUri: null,
    uploadProgress: 0,
    isUploading: false,
  });

  const [debugMode, setDebugMode] = useState(false);
  const pulseAnimation = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Set up recording service callbacks
    recordingService.setCallbacks({
      onAudioLevelChange: (level: number, isWhisper: boolean) => {
        setRecordingState((prev) => ({
          ...prev,
          audioLevel: level,
          isWhisper,
        }));
      },
      onDurationChange: (duration: number) => {
        setRecordingState((prev) => ({
          ...prev,
          duration,
        }));
      },
      onRecordingComplete: (uri: string) => {
        setRecordingState((prev) => ({
          ...prev,
          recordingUri: uri,
        }));
      },
      onError: (error: string) => {
        setError(error);
      },
    });

    // Set whisper threshold
    recordingService.setWhisperThreshold(0.4); // 40% threshold

    return () => {
      // Cleanup
      recordingService.destroy();
    };
  }, []);

  const startRecording = async () => {
    try {
      setLoading(true);

      await recordingService.startRecording();

      setRecordingState((prev) => ({
        ...prev,
        isRecording: true,
        duration: 0,
        audioLevel: 0,
        isWhisper: false,
        recordingUri: null,
        uploadProgress: 0,
        isUploading: false,
      }));

      // Start pulse animation
      startPulseAnimation();

      setLoading(false);
    } catch (error) {
      console.error("Error starting recording:", error);
      setError("Failed to start recording");
      setLoading(false);
    }
  };

  const stopRecording = async () => {
    try {
      setLoading(true);

      const uri = await recordingService.stopRecording();

      setRecordingState((prev) => ({
        ...prev,
        isRecording: false,
        recordingUri: uri,
      }));

      setLoading(false);
    } catch (error) {
      console.error("Error stopping recording:", error);
      setError("Failed to stop recording");
      setLoading(false);
    }
  };

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const handleUpload = async () => {
    if (!recordingState.recordingUri) {
      Alert.alert("No Recording", "Please record a whisper first.");
      return;
    }

    // Get whisper statistics from recording service
    const stats = recordingService.getWhisperStatistics();

    if (stats.whisperPercentage < 0.5) {
      Alert.alert(
        "Invalid Whisper",
        `Only ${(stats.whisperPercentage * 100).toFixed(
          1
        )}% was whispered. At least 50% must be whispered.`
      );
      return;
    }

    try {
      setLoading(true);
      setRecordingState((prev) => ({ ...prev, isUploading: true }));

      // Prepare upload data
      const uploadData = {
        audioUri: recordingState.recordingUri,
        duration: recordingState.duration,
        whisperPercentage: stats.whisperPercentage,
        averageLevel: stats.averageLevel,
        confidence: stats.whisperPercentage, // Use whisper percentage as confidence
      };

      // Validate upload data
      const uploadValidation = uploadService.validateUploadData(uploadData);
      if (!uploadValidation.isValid) {
        Alert.alert(
          "Upload Validation Failed",
          uploadValidation.errors.join("\n")
        );
        return;
      }

      // Upload to Firebase
      const result = await uploadService.uploadWhisper(
        uploadData,
        (progress) => {
          setRecordingState((prev) => ({
            ...prev,
            uploadProgress: progress.progress,
          }));
        }
      );

      // Show success message
      Alert.alert(
        "Success!",
        `Your whisper has been uploaded successfully!\n\nWhisper Stats:\n• Duration: ${
          recordingState.duration
        }s\n• Whisper Level: ${(stats.whisperPercentage * 100).toFixed(
          1
        )}%\n• Average Level: ${RecordingUtils.levelToPercentage(
          stats.averageLevel
        )}%\n• Samples: ${stats.totalSamples}`,
        [
          {
            text: "OK",
            onPress: () => {
              // Reset recording state
              recordingService.reset();
              setRecordingState({
                isRecording: false,
                duration: 0,
                audioLevel: 0,
                isWhisper: false,
                recordingUri: null,
                uploadProgress: 0,
                isUploading: false,
              });
              navigation.navigate("Feed");
            },
          },
        ]
      );

      setLoading(false);
      setRecordingState((prev) => ({ ...prev, isUploading: false }));
    } catch (error) {
      console.error("Error uploading recording:", error);
      setError("Failed to upload recording");
      setLoading(false);
      setRecordingState((prev) => ({ ...prev, isUploading: false }));
    }
  };

  const formatTime = (seconds: number): string => {
    return RecordingUtils.formatTime(seconds);
  };

  const getWhisperStatusColor = (): string => {
    if (!recordingState.isRecording) return "#666";
    return recordingState.isWhisper ? "#4CAF50" : "#F44336";
  };

  const getWhisperStatusText = (): string => {
    if (!recordingState.isRecording) return "Ready to record";
    return RecordingUtils.getWhisperStatusDescription(
      recordingState.isWhisper,
      recordingState.audioLevel
    );
  };

  const getValidationStats = () => {
    if (!recordingState.isRecording) return null;
    return recordingService.getWhisperStatistics();
  };

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="headlineSmall" style={styles.title}>
            Record Your Whisper
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Speak quietly - whispers only!
          </Text>

          {/* Recording Status */}
          <View style={styles.statusContainer}>
            <Text
              variant="bodyMedium"
              style={[styles.statusText, { color: getWhisperStatusColor() }]}
            >
              {getWhisperStatusText()}
            </Text>

            {recordingState.isRecording && (
              <Text variant="headlineMedium" style={styles.timer}>
                {formatTime(recordingState.duration)}
              </Text>
            )}
          </View>

          {/* Audio Level Indicator */}
          {recordingState.isRecording && (
            <View style={styles.audioLevelContainer}>
              <ProgressBar
                progress={recordingState.audioLevel}
                color={recordingState.isWhisper ? "#4CAF50" : "#F44336"}
                style={styles.audioLevelBar}
              />
              <Text variant="bodySmall" style={styles.audioLevelText}>
                Audio Level:{" "}
                {RecordingUtils.levelToPercentage(recordingState.audioLevel)}%
              </Text>
            </View>
          )}

          {/* Whisper Statistics */}
          {recordingState.isRecording && getValidationStats() && (
            <View style={styles.statsContainer}>
              <Text variant="bodySmall" style={styles.statsText}>
                Whisper:{" "}
                {(getValidationStats()!.whisperPercentage * 100).toFixed(1)}% |
                Avg Level:{" "}
                {RecordingUtils.levelToPercentage(
                  getValidationStats()!.averageLevel
                )}
                % | Samples: {getValidationStats()!.totalSamples}
              </Text>
            </View>
          )}

          {/* Debug Information */}
          {debugMode && (
            <View style={styles.debugContainer}>
              <Text variant="bodySmall" style={styles.debugText}>
                Debug Info:
              </Text>
              <Text variant="bodySmall" style={styles.debugText}>
                Current Level:{" "}
                {RecordingUtils.levelToPercentage(recordingState.audioLevel)}%
              </Text>
              <Text variant="bodySmall" style={styles.debugText}>
                Is Whisper: {recordingState.isWhisper ? "Yes" : "No"}
              </Text>
              <Text variant="bodySmall" style={styles.debugText}>
                Threshold: 40%
              </Text>
              {getValidationStats() && (
                <>
                  <Text variant="bodySmall" style={styles.debugText}>
                    Whisper Samples: {getValidationStats()!.whisperSamples}/
                    {getValidationStats()!.totalSamples}
                  </Text>
                  <Text variant="bodySmall" style={styles.debugText}>
                    Whisper %:{" "}
                    {(getValidationStats()!.whisperPercentage * 100).toFixed(1)}
                    %
                  </Text>
                  <Text variant="bodySmall" style={styles.debugText}>
                    Max Level:{" "}
                    {RecordingUtils.levelToPercentage(
                      getValidationStats()!.maxLevel
                    )}
                    %
                  </Text>
                  <Text variant="bodySmall" style={styles.debugText}>
                    Min Level:{" "}
                    {RecordingUtils.levelToPercentage(
                      getValidationStats()!.minLevel
                    )}
                    %
                  </Text>
                </>
              )}
            </View>
          )}

          {/* Upload Progress */}
          {recordingState.isUploading && (
            <View style={styles.uploadContainer}>
              <ProgressBar
                progress={recordingState.uploadProgress / 100}
                color="#007AFF"
                style={styles.uploadProgressBar}
              />
              <Text variant="bodySmall" style={styles.uploadText}>
                Uploading: {recordingState.uploadProgress.toFixed(1)}%
              </Text>
            </View>
          )}
        </Card.Content>
      </Card>

      {/* Recording Button */}
      <View style={styles.buttonContainer}>
        {!recordingState.isRecording ? (
          <TouchableOpacity
            style={styles.recordButton}
            onPress={startRecording}
            disabled={isLoading || recordingState.isUploading}
          >
            <Text style={styles.recordButtonText}>🎤 Start Recording</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.recordButton, styles.stopButton]}
            onPress={stopRecording}
            disabled={isLoading}
          >
            <Animated.View
              style={[
                styles.pulseCircle,
                { transform: [{ scale: pulseAnimation }] },
              ]}
            />
            <Text style={styles.recordButtonText}>⏹ Stop Recording</Text>
          </TouchableOpacity>
        )}

        {/* Upload Button */}
        {recordingState.recordingUri && !recordingState.isRecording && (
          <Button
            mode="contained"
            onPress={handleUpload}
            style={styles.uploadButton}
            icon="cloud-upload"
            disabled={isLoading || recordingState.isUploading}
            loading={recordingState.isUploading}
          >
            {recordingState.isUploading ? "Uploading..." : "Upload Whisper"}
          </Button>
        )}

        {/* Back Button */}
        <Button
          mode="outlined"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          disabled={
            isLoading ||
            recordingState.isRecording ||
            recordingState.isUploading
          }
        >
          Back to Home
        </Button>

        {/* Debug Toggle Button */}
        <Button
          mode="text"
          onPress={() => setDebugMode(!debugMode)}
          style={styles.debugButton}
          disabled={
            isLoading ||
            recordingState.isRecording ||
            recordingState.isUploading
          }
        >
          {debugMode ? "Hide Debug" : "Show Debug"}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
    backgroundColor: "#f5f5f5",
  },
  card: {
    marginBottom: 30,
    elevation: 4,
  },
  title: {
    textAlign: "center",
    marginBottom: 10,
    color: "#333",
  },
  subtitle: {
    textAlign: "center",
    color: "#666",
    marginBottom: 20,
  },
  statusContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  statusText: {
    textAlign: "center",
    marginBottom: 10,
    fontWeight: "bold",
  },
  timer: {
    color: "#333",
    fontWeight: "bold",
  },
  audioLevelContainer: {
    marginTop: 15,
  },
  audioLevelBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 5,
  },
  audioLevelText: {
    textAlign: "center",
    color: "#666",
  },
  buttonContainer: {
    gap: 15,
    alignItems: "center",
  },
  recordButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 200,
    position: "relative",
  },
  stopButton: {
    backgroundColor: "#F44336",
  },
  pulseCircle: {
    position: "absolute",
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  recordButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  uploadButton: {
    marginTop: 10,
    backgroundColor: "#4CAF50",
  },
  backButton: {
    marginTop: 10,
  },
  statsContainer: {
    marginTop: 10,
    alignItems: "center",
  },
  statsText: {
    color: "#666",
  },
  uploadContainer: {
    marginTop: 10,
    alignItems: "center",
  },
  uploadProgressBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 5,
  },
  uploadText: {
    color: "#666",
  },
  debugContainer: {
    marginTop: 10,
    alignItems: "center",
  },
  debugText: {
    color: "#666",
  },
  debugButton: {
    marginTop: 10,
  },
});
