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
import { useAuth } from "../providers/AuthProvider";
import {
  getRecordingService,
  RecordingUtils,
} from "../services/recordingService";
import { getUploadService, UploadUtils } from "../services/uploadService";
import {
  WHISPER_VALIDATION,
  WHISPER_COLORS,
  WHISPER_ERROR_MESSAGES,
  WHISPER_SUCCESS_MESSAGES,
} from "../constants/whisperValidation";

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
  const { user, incrementWhisperCount } = useAuth();

  // Initialize recording service
  const recordingService = useRef(getRecordingService()).current;
  const uploadService = useRef(getUploadService()).current;

  // Local state for loading and errors
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          isRecording: false,
          recordingUri: uri,
        }));
      },
      onRecordingStopped: (uri: string, wasAutoStop: boolean) => {
        setRecordingState((prev) => ({
          ...prev,
          isRecording: false,
          recordingUri: uri,
        }));

        if (wasAutoStop) {
          console.log("🎯 Recording auto-stopped at maximum duration");
          // Optionally show a message to the user
          setError("Recording stopped automatically at 30 seconds");
        }
      },
      onError: (error: string) => {
        setError(error);
      },
    });

    // Set whisper threshold
    recordingService.setWhisperThreshold(
      WHISPER_VALIDATION.DEFAULT_WHISPER_THRESHOLD
    );

    return () => {
      // Cleanup
      recordingService.destroy();
    };
  }, []);

  const startRecording = async () => {
    try {
      setIsLoading(true);

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

      setIsLoading(false);
    } catch (error) {
      console.error("Error starting recording:", error);
      setError("Failed to start recording");
      setIsLoading(false);
    }
  };

  const stopRecording = async () => {
    try {
      setIsLoading(true);

      const uri = await recordingService.stopRecording();

      // Only update state if we got a valid URI (recording was actually stopped)
      if (uri) {
        setRecordingState((prev) => ({
          ...prev,
          isRecording: false,
          recordingUri: uri,
        }));
      } else {
        // Recording was already stopped (likely by auto-stop)
        setRecordingState((prev) => ({
          ...prev,
          isRecording: false,
        }));
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Error stopping recording:", error);
      setError("Failed to stop recording");
      setIsLoading(false);
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

    // Debug: Log the actual statistics
    console.log("🔍 Upload validation stats:", {
      whisperPercentage: (stats.whisperPercentage * 100).toFixed(1) + "%",
      averageLevel: (stats.averageLevel * 100).toFixed(1) + "%",
      maxLevel: (stats.maxLevel * 100).toFixed(1) + "%",
      loudPercentage: (stats.loudPercentage * 100).toFixed(1) + "%",
      totalSamples: stats.totalSamples,
      whisperSamples: stats.whisperSamples,
      loudSamples: stats.loudSamples,
    });

    // Comprehensive whisper validation
    const validationErrors: string[] = [];

    // Check duration first (with small tolerance for timing precision)
    if (recordingState.duration < WHISPER_VALIDATION.RECORDING.MIN_DURATION) {
      validationErrors.push(WHISPER_ERROR_MESSAGES.DURATION_TOO_SHORT);
    }

    if (
      recordingState.duration >
      WHISPER_VALIDATION.RECORDING.MAX_DURATION +
        WHISPER_VALIDATION.RECORDING.DURATION_TOLERANCE
    ) {
      validationErrors.push(WHISPER_ERROR_MESSAGES.DURATION_TOO_LONG);
    }

    if (stats.whisperPercentage < WHISPER_VALIDATION.MIN_WHISPER_PERCENTAGE) {
      validationErrors.push(
        WHISPER_ERROR_MESSAGES.INSUFFICIENT_WHISPER(
          stats.whisperPercentage * 100
        )
      );
    }

    if (stats.averageLevel > WHISPER_VALIDATION.MAX_AVERAGE_LEVEL) {
      validationErrors.push(
        WHISPER_ERROR_MESSAGES.AVERAGE_LEVEL_TOO_HIGH(
          RecordingUtils.levelToPercentage(stats.averageLevel)
        )
      );
    }

    if (stats.maxLevel > WHISPER_VALIDATION.MAX_LEVEL) {
      validationErrors.push(
        WHISPER_ERROR_MESSAGES.MAX_LEVEL_TOO_HIGH(
          RecordingUtils.levelToPercentage(stats.maxLevel)
        )
      );
    }

    if (stats.loudPercentage > WHISPER_VALIDATION.MAX_LOUD_PERCENTAGE) {
      validationErrors.push(
        WHISPER_ERROR_MESSAGES.TOO_MUCH_LOUD_CONTENT(stats.loudPercentage * 100)
      );
    }

    if (validationErrors.length > 0) {
      Alert.alert("Invalid Whisper", validationErrors.join("\n\n"), [
        {
          text: "OK",
          style: "default",
          onPress: () => {
            // Reset recording state on validation failure
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
          },
        },
      ]);
      return;
    }

    try {
      setIsLoading(true);
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

      // Increment user's whisper count
      await incrementWhisperCount();

      // Show success message
      Alert.alert(
        "Success!",
        `Your whisper has been uploaded successfully!\n\nIt will appear in the feed shortly.\n\nWhisper Stats:\n• Duration: ${
          recordingState.duration
        }s\n• Whisper Level: ${(stats.whisperPercentage * 100).toFixed(
          1
        )}%\n• Average Level: ${RecordingUtils.levelToPercentage(
          stats.averageLevel
        )}%\n• Samples: ${stats.totalSamples}`,
        [
          {
            text: "View Feed",
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

      setIsLoading(false);
      setRecordingState((prev) => ({ ...prev, isUploading: false }));
    } catch (error) {
      console.error("Error uploading recording:", error);
      setError("Failed to upload recording");
      setIsLoading(false);
      setRecordingState((prev) => ({ ...prev, isUploading: false }));

      // Reset recording state on upload error
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
    }
  };

  const formatTime = (seconds: number): string => {
    return RecordingUtils.formatTime(seconds);
  };

  const getWhisperStatusColor = (): string => {
    if (!recordingState.isRecording) return WHISPER_COLORS.NEUTRAL;
    return recordingState.isWhisper
      ? WHISPER_COLORS.WHISPER
      : WHISPER_COLORS.LOUD;
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

  const isRecordingUploadable = () => {
    if (!recordingState.recordingUri || recordingState.isRecording)
      return false;

    // Debug: Log duration for troubleshooting
    console.log("🔍 Duration check:", {
      duration: recordingState.duration,
      minDuration: WHISPER_VALIDATION.RECORDING.MIN_DURATION,
      maxDuration: WHISPER_VALIDATION.RECORDING.MAX_DURATION,
      tolerance: WHISPER_VALIDATION.RECORDING.DURATION_TOLERANCE,
      maxWithTolerance:
        WHISPER_VALIDATION.RECORDING.MAX_DURATION +
        WHISPER_VALIDATION.RECORDING.DURATION_TOLERANCE,
      isTooShort:
        recordingState.duration < WHISPER_VALIDATION.RECORDING.MIN_DURATION,
      isTooLong:
        recordingState.duration >
        WHISPER_VALIDATION.RECORDING.MAX_DURATION +
          WHISPER_VALIDATION.RECORDING.DURATION_TOLERANCE,
    });

    // Check duration first (with small tolerance for timing precision)
    if (
      recordingState.duration < WHISPER_VALIDATION.RECORDING.MIN_DURATION ||
      recordingState.duration >
        WHISPER_VALIDATION.RECORDING.MAX_DURATION +
          WHISPER_VALIDATION.RECORDING.DURATION_TOLERANCE
    ) {
      return false;
    }

    const stats = recordingService.getWhisperStatistics();
    return (
      stats.whisperPercentage >= WHISPER_VALIDATION.MIN_WHISPER_PERCENTAGE &&
      stats.averageLevel <= WHISPER_VALIDATION.MAX_AVERAGE_LEVEL &&
      stats.maxLevel <= WHISPER_VALIDATION.MAX_LEVEL &&
      stats.loudPercentage <= WHISPER_VALIDATION.MAX_LOUD_PERCENTAGE
    );
  };

  const getUploadButtonStyle = () => {
    if (!recordingState.recordingUri || recordingState.isRecording)
      return styles.uploadButton;

    if (isRecordingUploadable()) {
      return [styles.uploadButton, { backgroundColor: WHISPER_COLORS.SUCCESS }];
    } else {
      return [styles.uploadButton, { backgroundColor: WHISPER_COLORS.WARNING }];
    }
  };

  const getUploadButtonText = () => {
    if (recordingState.isUploading) return "Uploading...";
    if (!recordingState.recordingUri || recordingState.isRecording)
      return "Upload Whisper";

    // Check duration first (with small tolerance for timing precision)
    if (recordingState.duration < WHISPER_VALIDATION.RECORDING.MIN_DURATION) {
      return "Recording Too Short";
    }
    if (
      recordingState.duration >
      WHISPER_VALIDATION.RECORDING.MAX_DURATION +
        WHISPER_VALIDATION.RECORDING.DURATION_TOLERANCE
    ) {
      return "Recording Too Long";
    }

    if (isRecordingUploadable()) {
      return "Upload Whisper";
    } else {
      return "Recording Too Loud";
    }
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
                color={
                  recordingState.isWhisper
                    ? WHISPER_COLORS.WHISPER
                    : WHISPER_COLORS.LOUD
                }
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
              {!recordingState.isRecording && recordingState.recordingUri && (
                <Text
                  variant="bodySmall"
                  style={[
                    styles.statsText,
                    {
                      color: isRecordingUploadable()
                        ? WHISPER_COLORS.SUCCESS
                        : WHISPER_COLORS.LOUD,
                      fontWeight: "bold",
                      marginTop: 5,
                    },
                  ]}
                >
                  {isRecordingUploadable()
                    ? "✅ Ready to Upload"
                    : "❌ Too Loud to Upload"}
                </Text>
              )}
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
                Threshold:{" "}
                {Math.round(recordingService.getWhisperThreshold() * 100)}%
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
                  <Text variant="bodySmall" style={styles.debugText}>
                    Avg Level:{" "}
                    {RecordingUtils.levelToPercentage(
                      getValidationStats()!.averageLevel
                    )}
                    %
                  </Text>
                </>
              )}

              {/* Calibration Button */}
              {recordingState.isRecording && (
                <TouchableOpacity
                  style={[styles.calibrateButton, { marginTop: 10 }]}
                  onPress={() => {
                    recordingService.autoCalibrateThreshold();
                    console.log("Manual calibration triggered");
                  }}
                >
                  <Text style={styles.calibrateButtonText}>
                    Auto-Calibrate Threshold
                  </Text>
                </TouchableOpacity>
              )}

              {/* Manual Threshold Adjustment */}
              {recordingState.isRecording && (
                <View style={styles.thresholdContainer}>
                  <Text variant="bodySmall" style={styles.debugText}>
                    Manual Threshold:{" "}
                    {Math.round(recordingService.getWhisperThreshold() * 100)}%
                  </Text>
                  <View style={styles.thresholdButtons}>
                    <TouchableOpacity
                      style={styles.thresholdButton}
                      onPress={() =>
                        recordingService.setWhisperThreshold(
                          WHISPER_VALIDATION.THRESHOLD_BUTTONS.VERY_LOW
                        )
                      }
                    >
                      <Text style={styles.thresholdButtonText}>0.5%</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.thresholdButton}
                      onPress={() =>
                        recordingService.setWhisperThreshold(
                          WHISPER_VALIDATION.THRESHOLD_BUTTONS.LOW
                        )
                      }
                    >
                      <Text style={styles.thresholdButtonText}>0.8%</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.thresholdButton}
                      onPress={() =>
                        recordingService.setWhisperThreshold(
                          WHISPER_VALIDATION.THRESHOLD_BUTTONS.MEDIUM
                        )
                      }
                    >
                      <Text style={styles.thresholdButtonText}>1.2%</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.thresholdButton}
                      onPress={() =>
                        recordingService.setWhisperThreshold(
                          WHISPER_VALIDATION.THRESHOLD_BUTTONS.HIGH
                        )
                      }
                    >
                      <Text style={styles.thresholdButtonText}>1.5%</Text>
                    </TouchableOpacity>
                  </View>
                </View>
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
            style={getUploadButtonStyle()}
            icon="cloud-upload"
            disabled={
              isLoading ||
              recordingState.isUploading ||
              !isRecordingUploadable()
            }
            loading={recordingState.isUploading}
          >
            {getUploadButtonText()}
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
  calibrateButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  calibrateButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  thresholdContainer: {
    marginTop: 10,
    alignItems: "center",
  },
  thresholdButtons: {
    flexDirection: "row",
    gap: 10,
  },
  thresholdButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  thresholdButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
});
