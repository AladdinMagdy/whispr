import {
  validateAudioRecording,
  validateWhisperCreationOptions,
  validateUserData,
  calculateWhisperMetrics,
  createWhisperUploadData,
  createWhisperCreationData,
  handleTranscriptionError,
  handleAudioUploadError,
  shouldAttemptTranscription,
  calculateTranscriptionCost,
  validateWhisperCreationRequest,
  sanitizeWhisperData,
} from "../utils/whisperCreationUtils";
import { AudioRecording } from "../types";

// ===== TEST DATA =====

const validAudioRecording: AudioRecording = {
  uri: "file://test.mp3",
  duration: 30,
  volume: 0.5,
  isWhisper: true,
  timestamp: new Date(),
};

const invalidAudioRecording: AudioRecording = {
  uri: "",
  duration: -1,
  volume: 1.5,
  isWhisper: null as any,
  timestamp: null as any,
};

// ===== VALIDATION TESTS =====

describe("validateAudioRecording", () => {
  it("should validate correct audio recording", () => {
    const result = validateAudioRecording(validAudioRecording);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toBeUndefined();
  });

  it("should reject audio recording with missing URI", () => {
    const recording = { ...validAudioRecording, uri: "" };
    const result = validateAudioRecording(recording);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Audio URI is required");
  });

  it("should reject audio recording with invalid duration", () => {
    const recording = { ...validAudioRecording, duration: -1 };
    const result = validateAudioRecording(recording);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Audio duration must be greater than 0");
  });

  it("should reject audio recording with duration exceeding 5 minutes", () => {
    const recording = { ...validAudioRecording, duration: 301 };
    const result = validateAudioRecording(recording);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Audio duration cannot exceed 5 minutes");
  });

  it("should reject audio recording with invalid volume", () => {
    const recording = { ...validAudioRecording, volume: 1.5 };
    const result = validateAudioRecording(recording);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Audio volume must be between 0 and 1");
  });

  it("should reject audio recording with missing whisper detection status", () => {
    const recording = { ...validAudioRecording, isWhisper: null as any };
    const result = validateAudioRecording(recording);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Whisper detection status is required");
  });

  it("should reject audio recording with missing timestamp", () => {
    const recording = { ...validAudioRecording, timestamp: null as any };
    const result = validateAudioRecording(recording);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Recording timestamp is required");
  });

  it("should warn for very short audio duration", () => {
    const recording = { ...validAudioRecording, duration: 0.5 };
    const result = validateAudioRecording(recording);

    expect(result.isValid).toBe(true);
    expect(result.warnings).toContain(
      "Audio duration is very short (< 1 second)"
    );
  });

  it("should warn for very high volume", () => {
    const recording = { ...validAudioRecording, volume: 0.95 };
    const result = validateAudioRecording(recording);

    expect(result.isValid).toBe(true);
    expect(result.warnings).toContain("Audio volume is very high (> 90%)");
  });

  it("should warn for very low volume", () => {
    const recording = { ...validAudioRecording, volume: 0.05 };
    const result = validateAudioRecording(recording);

    expect(result.isValid).toBe(true);
    expect(result.warnings).toContain("Audio volume is very low (< 10%)");
  });

  it("should handle multiple validation errors", () => {
    const result = validateAudioRecording(invalidAudioRecording);

    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
    expect(result.errors).toContain("Audio URI is required");
    expect(result.errors).toContain("Audio duration must be greater than 0");
  });
});

describe("validateWhisperCreationOptions", () => {
  it("should validate empty options", () => {
    const result = validateWhisperCreationOptions();

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should validate options with transcription enabled", () => {
    const result = validateWhisperCreationOptions({
      enableTranscription: true,
    });

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should validate options with transcription disabled", () => {
    const result = validateWhisperCreationOptions({
      enableTranscription: false,
    });

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toContain(
      "Transcription is disabled - content moderation may be limited"
    );
  });

  it("should reject invalid enableTranscription type", () => {
    const result = validateWhisperCreationOptions({
      enableTranscription: "true" as any,
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("enableTranscription must be a boolean");
  });
});

describe("validateUserData", () => {
  it("should validate correct user data", () => {
    const result = validateUserData("user-123", "Test User", "#FF5733");

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should reject missing user ID", () => {
    const result = validateUserData("", "Test User", "#FF5733");

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("User ID is required");
  });

  it("should reject missing display name", () => {
    const result = validateUserData("user-123", "", "#FF5733");

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("User display name is required");
  });

  it("should reject missing profile color", () => {
    const result = validateUserData("user-123", "Test User", "");

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("User profile color is required");
  });

  it("should reject display name exceeding 50 characters", () => {
    const longName = "A".repeat(51);
    const result = validateUserData("user-123", longName, "#FF5733");

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      "User display name cannot exceed 50 characters"
    );
  });

  it("should warn for very short display name", () => {
    const result = validateUserData("user-123", "A", "#FF5733");

    expect(result.isValid).toBe(true);
    expect(result.warnings).toContain(
      "User display name is very short (< 2 characters)"
    );
  });

  it("should reject invalid hex color format", () => {
    const result = validateUserData("user-123", "Test User", "invalid-color");

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      "User profile color must be a valid hex color (e.g., #FF5733)"
    );
  });

  it("should accept valid hex colors", () => {
    const validColors = ["#FF5733", "#00FF00", "#000000", "#FFFFFF"];

    validColors.forEach((color) => {
      const result = validateUserData("user-123", "Test User", color);
      expect(result.isValid).toBe(true);
    });
  });
});

// ===== DATA TRANSFORMATION TESTS =====

describe("calculateWhisperMetrics", () => {
  it("should calculate metrics for whisper audio", () => {
    const recording = { ...validAudioRecording, isWhisper: true, volume: 0.3 };
    const metrics = calculateWhisperMetrics(recording);

    expect(metrics.whisperPercentage).toBe(100);
    expect(metrics.confidence).toBe(0.9); // Volume 0.3 is not < 0.3, so it uses base confidence
    expect(metrics.averageLevel).toBe(0.3);
    expect(metrics.duration).toBe(30);
  });

  it("should calculate metrics for non-whisper audio", () => {
    const recording = { ...validAudioRecording, isWhisper: false, volume: 0.8 };
    const metrics = calculateWhisperMetrics(recording);

    expect(metrics.whisperPercentage).toBe(0);
    expect(metrics.confidence).toBe(0.3);
    expect(metrics.averageLevel).toBe(0.8);
    expect(metrics.duration).toBe(30);
  });

  it("should adjust confidence for loud whispers", () => {
    const recording = { ...validAudioRecording, isWhisper: true, volume: 0.8 };
    const metrics = calculateWhisperMetrics(recording);

    expect(metrics.whisperPercentage).toBe(100);
    expect(metrics.confidence).toBe(0.8);
  });

  it("should adjust confidence for quiet non-whispers", () => {
    const recording = { ...validAudioRecording, isWhisper: false, volume: 0.2 };
    const metrics = calculateWhisperMetrics(recording);

    expect(metrics.whisperPercentage).toBe(0);
    expect(metrics.confidence).toBe(0.05);
  });

  it("should round confidence to 2 decimal places", () => {
    const recording = {
      ...validAudioRecording,
      isWhisper: true,
      volume: 0.333333,
    };
    const metrics = calculateWhisperMetrics(recording);

    expect(metrics.confidence).toBe(0.9);
  });
});

describe("createWhisperUploadData", () => {
  it("should create upload data with transcription", () => {
    const uploadData = createWhisperUploadData(
      validAudioRecording,
      "https://example.com/audio.mp3",
      "Hello world",
      { status: "approved" } as any
    );

    expect(uploadData.audioUrl).toBe("https://example.com/audio.mp3");
    expect(uploadData.duration).toBe(30);
    expect(uploadData.whisperPercentage).toBe(100);
    expect(uploadData.averageLevel).toBe(0.5);
    expect(uploadData.confidence).toBe(0.9);
    expect(uploadData.transcription).toBe("Hello world");
    expect(uploadData.moderationResult).toEqual({ status: "approved" });
  });

  it("should create upload data without transcription", () => {
    const uploadData = createWhisperUploadData(
      validAudioRecording,
      "https://example.com/audio.mp3"
    );

    expect(uploadData.transcription).toBeUndefined();
    expect(uploadData.moderationResult).toBeUndefined();
  });

  it("should use calculated metrics from audio recording", () => {
    const recording = { ...validAudioRecording, isWhisper: false, volume: 0.8 };
    const uploadData = createWhisperUploadData(
      recording,
      "https://example.com/audio.mp3"
    );

    expect(uploadData.whisperPercentage).toBe(0);
    expect(uploadData.confidence).toBe(0.3);
    expect(uploadData.averageLevel).toBe(0.8);
  });
});

describe("createWhisperCreationData", () => {
  it("should create whisper creation data with trimmed display name", () => {
    const creationData = createWhisperCreationData(
      validAudioRecording,
      "user-123",
      "  Test User  ",
      "#FF5733",
      "https://example.com/audio.mp3",
      "Hello world"
    );

    expect(creationData.userId).toBe("user-123");
    expect(creationData.userDisplayName).toBe("Test User");
    expect(creationData.userProfileColor).toBe("#FF5733");
    expect(creationData.transcription).toBe("Hello world");
  });

  it("should create whisper creation data without optional fields", () => {
    const creationData = createWhisperCreationData(
      validAudioRecording,
      "user-123",
      "Test User",
      "#FF5733",
      "https://example.com/audio.mp3"
    );

    expect(creationData.transcription).toBeUndefined();
    expect(creationData.moderationResult).toBeUndefined();
  });
});

// ===== ERROR HANDLING TESTS =====

describe("handleTranscriptionError", () => {
  it("should handle network errors", () => {
    const error = new Error("Network timeout");
    const message = handleTranscriptionError(error);

    expect(message).toBe(
      "Transcription failed due to network issues. Please try again."
    );
  });

  it("should handle audio format errors", () => {
    const error = new Error("Audio format not supported");
    const message = handleTranscriptionError(error);

    expect(message).toBe("Audio format not supported for transcription.");
  });

  it("should handle quota errors", () => {
    const error = new Error("Quota exceeded");
    const message = handleTranscriptionError(error);

    expect(message).toBe(
      "Transcription service limit reached. Please try again later."
    );
  });

  it("should handle API key errors", () => {
    const error = new Error("Unauthorized API key");
    const message = handleTranscriptionError(error);

    expect(message).toBe("Transcription service configuration error.");
  });

  it("should handle generic errors", () => {
    const error = new Error("Something went wrong");
    const message = handleTranscriptionError(error);

    expect(message).toBe("Transcription failed: Something went wrong");
  });

  it("should handle string errors", () => {
    const message = handleTranscriptionError("String error");

    expect(message).toBe("Transcription failed: String error");
  });

  it("should handle unknown errors", () => {
    const message = handleTranscriptionError({ custom: "error" });

    expect(message).toBe("Transcription failed due to an unknown error.");
  });
});

describe("handleAudioUploadError", () => {
  it("should handle network errors", () => {
    const error = new Error("Network timeout");
    const message = handleAudioUploadError(error);

    expect(message).toBe(
      "Audio upload failed due to network issues. Please try again."
    );
  });

  it("should handle storage quota errors", () => {
    const error = new Error("Storage quota exceeded");
    const message = handleAudioUploadError(error);

    expect(message).toBe("Storage limit reached. Please try again later.");
  });

  it("should handle permission errors", () => {
    const error = new Error("Unauthorized access");
    const message = handleAudioUploadError(error);

    expect(message).toBe(
      "Upload permission denied. Please check your account."
    );
  });

  it("should handle file format errors", () => {
    const error = new Error("File format not supported");
    const message = handleAudioUploadError(error);

    expect(message).toBe("Audio file format not supported.");
  });

  it("should handle generic errors", () => {
    const error = new Error("Upload failed");
    const message = handleAudioUploadError(error);

    expect(message).toBe("Audio upload failed: Upload failed");
  });
});

// ===== BUSINESS LOGIC TESTS =====

describe("shouldAttemptTranscription", () => {
  it("should attempt transcription for valid audio", () => {
    const recording = { ...validAudioRecording, duration: 10, volume: 0.5 };
    const shouldAttempt = shouldAttemptTranscription(recording);

    expect(shouldAttempt).toBe(true);
  });

  it("should not attempt transcription for very short audio", () => {
    const recording = { ...validAudioRecording, duration: 0.3, volume: 0.5 };
    const shouldAttempt = shouldAttemptTranscription(recording);

    expect(shouldAttempt).toBe(false);
  });

  it("should not attempt transcription for very low volume", () => {
    const recording = { ...validAudioRecording, duration: 10, volume: 0.03 };
    const shouldAttempt = shouldAttemptTranscription(recording);

    expect(shouldAttempt).toBe(false);
  });

  it("should not attempt transcription for very long audio", () => {
    const recording = { ...validAudioRecording, duration: 301, volume: 0.5 };
    const shouldAttempt = shouldAttemptTranscription(recording);

    expect(shouldAttempt).toBe(false);
  });
});

describe("calculateTranscriptionCost", () => {
  it("should calculate cost for 30 seconds", () => {
    const cost = calculateTranscriptionCost(30);

    expect(cost).toBe(0.003); // 0.5 minutes * $0.006
  });

  it("should calculate cost for 60 seconds", () => {
    const cost = calculateTranscriptionCost(60);

    expect(cost).toBe(0.006); // 1 minute * $0.006
  });

  it("should calculate cost for 120 seconds", () => {
    const cost = calculateTranscriptionCost(120);

    expect(cost).toBe(0.012); // 2 minutes * $0.006
  });

  it("should handle zero duration", () => {
    const cost = calculateTranscriptionCost(0);

    expect(cost).toBe(0);
  });

  it("should round to 3 decimal places", () => {
    const cost = calculateTranscriptionCost(33.333);

    expect(cost).toBe(0.003); // 0.5555 minutes * $0.006 = 0.003333, rounded to 0.003
  });
});

describe("validateWhisperCreationRequest", () => {
  it("should validate complete valid request", () => {
    const result = validateWhisperCreationRequest(
      validAudioRecording,
      "user-123",
      "Test User",
      "#FF5733",
      { enableTranscription: true }
    );

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should collect all validation errors", () => {
    const result = validateWhisperCreationRequest(
      invalidAudioRecording,
      "",
      "",
      "invalid-color",
      { enableTranscription: "invalid" as any }
    );

    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });

  it("should collect all warnings", () => {
    const recording = { ...validAudioRecording, duration: 90, volume: 0.95 };
    const result = validateWhisperCreationRequest(
      recording,
      "user-123",
      "A",
      "#FF5733",
      { enableTranscription: true } // Changed to true to trigger the long audio warning
    );

    expect(result.isValid).toBe(true);
    expect(result.warnings?.length).toBeGreaterThan(1);
    expect(result.warnings).toContain(
      "Long audio (> 1 minute) may incur higher transcription costs"
    );
    expect(result.warnings).toContain("Audio volume is very high (> 90%)");
    expect(result.warnings).toContain(
      "User display name is very short (< 2 characters)"
    );
  });
});

describe("sanitizeWhisperData", () => {
  it("should sanitize display name", () => {
    const data = {
      userDisplayName: "  Long Display Name That Exceeds Fifty Characters  ",
    };
    const sanitized = sanitizeWhisperData(data);

    expect(sanitized.userDisplayName).toBe(
      "Long Display Name That Exceeds Fifty Characters"
    );
  });

  it("should sanitize transcription", () => {
    const longTranscription = "A".repeat(1001);
    const data = { transcription: `  ${longTranscription}  ` };
    const sanitized = sanitizeWhisperData(data);

    expect(sanitized.transcription).toBe("A".repeat(1000));
  });

  it("should clamp duration to valid range", () => {
    const data = { duration: 500 };
    const sanitized = sanitizeWhisperData(data);

    expect(sanitized.duration).toBe(300);
  });

  it("should clamp whisper percentage to valid range", () => {
    const data = { whisperPercentage: 150 };
    const sanitized = sanitizeWhisperData(data);

    expect(sanitized.whisperPercentage).toBe(100);
  });

  it("should clamp average level to valid range", () => {
    const data = { averageLevel: 1.5 };
    const sanitized = sanitizeWhisperData(data);

    expect(sanitized.averageLevel).toBe(1);
  });

  it("should clamp confidence to valid range", () => {
    const data = { confidence: -0.5 };
    const sanitized = sanitizeWhisperData(data);

    expect(sanitized.confidence).toBe(0);
  });

  it("should handle undefined fields", () => {
    const data = { userDisplayName: undefined, transcription: undefined };
    const sanitized = sanitizeWhisperData(data);

    expect(sanitized.userDisplayName).toBeUndefined();
    expect(sanitized.transcription).toBeUndefined();
  });
});

// ===== EDGE CASES AND BOUNDARY TESTS =====

describe("Edge Cases and Boundary Tests", () => {
  it("should handle boundary values for duration", () => {
    const minValid = { ...validAudioRecording, duration: 0.1 };
    const maxValid = { ...validAudioRecording, duration: 300 };

    expect(validateAudioRecording(minValid).isValid).toBe(true);
    expect(validateAudioRecording(maxValid).isValid).toBe(true);
  });

  it("should handle boundary values for volume", () => {
    const minValid = { ...validAudioRecording, volume: 0 };
    const maxValid = { ...validAudioRecording, volume: 1 };

    expect(validateAudioRecording(minValid).isValid).toBe(true);
    expect(validateAudioRecording(maxValid).isValid).toBe(true);
  });

  it("should handle exact boundary for display name length", () => {
    const exactLength = "A".repeat(50);
    const result = validateUserData("user-123", exactLength, "#FF5733");

    expect(result.isValid).toBe(true);
  });

  it("should handle all confidence calculation scenarios", () => {
    const scenarios = [
      { isWhisper: true, volume: 0.2, expectedConfidence: 0.95 },
      { isWhisper: true, volume: 0.5, expectedConfidence: 0.9 },
      { isWhisper: true, volume: 0.8, expectedConfidence: 0.8 },
      { isWhisper: false, volume: 0.2, expectedConfidence: 0.05 },
      { isWhisper: false, volume: 0.5, expectedConfidence: 0.1 },
      { isWhisper: false, volume: 0.8, expectedConfidence: 0.3 },
    ];

    scenarios.forEach(({ isWhisper, volume, expectedConfidence }) => {
      const recording = { ...validAudioRecording, isWhisper, volume };
      const metrics = calculateWhisperMetrics(recording);
      expect(metrics.confidence).toBe(expectedConfidence);
    });
  });
});
