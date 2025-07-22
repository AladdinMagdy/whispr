import { AudioRecording, Whisper, ModerationResult } from "@/types";

// ===== INTERFACES =====

export interface WhisperCreationOptions {
  enableTranscription?: boolean;
}

export interface WhisperUploadData {
  audioUrl: string;
  duration: number;
  whisperPercentage: number;
  averageLevel: number;
  confidence: number;
  transcription?: string;
  moderationResult?: ModerationResult;
}

export interface WhisperMetrics {
  whisperPercentage: number;
  confidence: number;
  averageLevel: number;
  duration: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface WhisperCreationData {
  audioRecording: AudioRecording;
  userId: string;
  userDisplayName: string;
  userProfileColor: string;
  transcription?: string;
  moderationResult?: ModerationResult;
}

// ===== VALIDATION FUNCTIONS =====

/**
 * Validate audio recording data
 */
export function validateAudioRecording(
  audioRecording: AudioRecording
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields validation
  if (!audioRecording.uri) {
    errors.push("Audio URI is required");
  }

  if (
    audioRecording.duration === undefined ||
    audioRecording.duration === null
  ) {
    errors.push("Audio duration is required");
  } else if (audioRecording.duration <= 0) {
    errors.push("Audio duration must be greater than 0");
  } else if (audioRecording.duration > 300) {
    // 5 minutes max
    errors.push("Audio duration cannot exceed 5 minutes");
  }

  if (audioRecording.volume === undefined || audioRecording.volume === null) {
    errors.push("Audio volume is required");
  } else if (audioRecording.volume < 0 || audioRecording.volume > 1) {
    errors.push("Audio volume must be between 0 and 1");
  }

  if (
    audioRecording.isWhisper === undefined ||
    audioRecording.isWhisper === null
  ) {
    errors.push("Whisper detection status is required");
  }

  if (!audioRecording.timestamp) {
    errors.push("Recording timestamp is required");
  }

  // Business logic validation
  if (audioRecording.duration && audioRecording.duration < 1) {
    warnings.push("Audio duration is very short (< 1 second)");
  }

  if (audioRecording.volume && audioRecording.volume > 0.9) {
    warnings.push("Audio volume is very high (> 90%)");
  }

  if (audioRecording.volume && audioRecording.volume < 0.1) {
    warnings.push("Audio volume is very low (< 10%)");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Validate whisper creation options
 */
export function validateWhisperCreationOptions(
  options: WhisperCreationOptions = {}
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate enableTranscription
  if (
    options.enableTranscription !== undefined &&
    typeof options.enableTranscription !== "boolean"
  ) {
    errors.push("enableTranscription must be a boolean");
  }

  // Business logic warnings
  if (options.enableTranscription === false) {
    warnings.push(
      "Transcription is disabled - content moderation may be limited"
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Validate user data for whisper creation
 */
export function validateUserData(
  userId: string,
  userDisplayName: string,
  userProfileColor: string
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields validation
  if (!userId || userId.trim() === "") {
    errors.push("User ID is required");
  }

  if (!userDisplayName || userDisplayName.trim() === "") {
    errors.push("User display name is required");
  }

  if (!userProfileColor || userProfileColor.trim() === "") {
    errors.push("User profile color is required");
  }

  // Business logic validation
  if (userDisplayName && userDisplayName.length > 50) {
    errors.push("User display name cannot exceed 50 characters");
  }

  if (userDisplayName && userDisplayName.length < 2) {
    warnings.push("User display name is very short (< 2 characters)");
  }

  // Validate hex color format
  if (userProfileColor && !/^#[0-9A-Fa-f]{6}$/.test(userProfileColor)) {
    errors.push("User profile color must be a valid hex color (e.g., #FF5733)");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

// ===== DATA TRANSFORMATION FUNCTIONS =====

/**
 * Calculate whisper metrics from audio recording
 */
export function calculateWhisperMetrics(
  audioRecording: AudioRecording
): WhisperMetrics {
  // Calculate whisper percentage based on isWhisper flag
  const whisperPercentage = audioRecording.isWhisper ? 100 : 0;

  // Calculate confidence based on whisper detection and volume
  let confidence = 0.5; // Base confidence

  if (audioRecording.isWhisper) {
    // Higher confidence for detected whispers
    confidence = 0.9;

    // Adjust confidence based on volume (lower volume = higher confidence for whispers)
    if (audioRecording.volume < 0.3) {
      confidence = 0.95;
    } else if (audioRecording.volume > 0.7) {
      confidence = 0.8; // Slightly lower confidence for louder "whispers"
    }
  } else {
    // Lower confidence for non-whispers
    confidence = 0.1;

    // Adjust confidence based on volume (higher volume = higher confidence for non-whispers)
    if (audioRecording.volume > 0.7) {
      confidence = 0.3;
    } else if (audioRecording.volume < 0.3) {
      confidence = 0.05; // Very low confidence for quiet non-whispers
    }
  }

  return {
    whisperPercentage,
    confidence: Math.round(confidence * 100) / 100, // Round to 2 decimal places
    averageLevel: audioRecording.volume,
    duration: audioRecording.duration,
  };
}

/**
 * Create whisper upload data from audio recording and optional transcription
 */
export function createWhisperUploadData(
  audioRecording: AudioRecording,
  audioUrl: string,
  transcription?: string,
  moderationResult?: ModerationResult
): WhisperUploadData {
  const metrics = calculateWhisperMetrics(audioRecording);

  return {
    audioUrl,
    duration: audioRecording.duration,
    whisperPercentage: metrics.whisperPercentage,
    averageLevel: metrics.averageLevel,
    confidence: metrics.confidence,
    transcription,
    moderationResult,
  };
}

/**
 * Create complete whisper creation data
 */
export function createWhisperCreationData(
  audioRecording: AudioRecording,
  userId: string,
  userDisplayName: string,
  userProfileColor: string,
  audioUrl: string,
  transcription?: string,
  moderationResult?: ModerationResult
): WhisperCreationData {
  return {
    audioRecording,
    userId,
    userDisplayName: userDisplayName.trim(), // Ensure trimmed display name
    userProfileColor,
    transcription,
    moderationResult,
  };
}

// ===== ERROR HANDLING FUNCTIONS =====

/**
 * Handle transcription errors and return user-friendly error messages
 */
export function handleTranscriptionError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Categorize errors for better user experience
    if (message.includes("network") || message.includes("timeout")) {
      return "Transcription failed due to network issues. Please try again.";
    }

    if (message.includes("audio") || message.includes("format")) {
      return "Audio format not supported for transcription.";
    }

    if (message.includes("quota") || message.includes("limit")) {
      return "Transcription service limit reached. Please try again later.";
    }

    if (message.includes("unauthorized") || message.includes("api key")) {
      return "Transcription service configuration error.";
    }

    // Default error message
    return `Transcription failed: ${error.message}`;
  }

  // Handle non-Error objects
  if (typeof error === "string") {
    return `Transcription failed: ${error}`;
  }

  return "Transcription failed due to an unknown error.";
}

/**
 * Handle audio upload errors and return user-friendly error messages
 */
export function handleAudioUploadError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes("network") || message.includes("timeout")) {
      return "Audio upload failed due to network issues. Please try again.";
    }

    if (message.includes("storage") || message.includes("quota")) {
      return "Storage limit reached. Please try again later.";
    }

    if (message.includes("unauthorized") || message.includes("permission")) {
      return "Upload permission denied. Please check your account.";
    }

    if (message.includes("file") || message.includes("format")) {
      return "Audio file format not supported.";
    }

    return `Audio upload failed: ${error.message}`;
  }

  if (typeof error === "string") {
    return `Audio upload failed: ${error}`;
  }

  return "Audio upload failed due to an unknown error.";
}

// ===== BUSINESS LOGIC FUNCTIONS =====

/**
 * Determine if transcription should be attempted based on audio characteristics
 */
export function shouldAttemptTranscription(
  audioRecording: AudioRecording
): boolean {
  // Don't transcribe if duration is too short
  if (audioRecording.duration < 0.5) {
    return false;
  }

  // Don't transcribe if volume is too low (likely silence)
  if (audioRecording.volume < 0.05) {
    return false;
  }

  // Don't transcribe if duration is too long (cost considerations)
  if (audioRecording.duration > 300) {
    return false;
  }

  return true;
}

/**
 * Calculate estimated transcription cost
 */
export function calculateTranscriptionCost(durationSeconds: number): number {
  const costPerMinute = 0.006; // $0.006 per minute
  const durationMinutes = durationSeconds / 60;
  return Math.round(durationMinutes * costPerMinute * 1000) / 1000; // Round to 3 decimal places
}

/**
 * Validate complete whisper creation request
 */
export function validateWhisperCreationRequest(
  audioRecording: AudioRecording,
  userId: string,
  userDisplayName: string,
  userProfileColor: string,
  options: WhisperCreationOptions = {}
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate audio recording
  const audioValidation = validateAudioRecording(audioRecording);
  if (!audioValidation.isValid) {
    errors.push(...audioValidation.errors);
  }
  if (audioValidation.warnings) {
    warnings.push(...audioValidation.warnings);
  }

  // Validate user data
  const userValidation = validateUserData(
    userId,
    userDisplayName,
    userProfileColor
  );
  if (!userValidation.isValid) {
    errors.push(...userValidation.errors);
  }
  if (userValidation.warnings) {
    warnings.push(...userValidation.warnings);
  }

  // Validate options
  const optionsValidation = validateWhisperCreationOptions(options);
  if (!optionsValidation.isValid) {
    errors.push(...optionsValidation.errors);
  }
  if (optionsValidation.warnings) {
    warnings.push(...optionsValidation.warnings);
  }

  // Business logic validation
  if (
    audioRecording.duration &&
    audioRecording.duration > 60 &&
    options.enableTranscription !== false
  ) {
    warnings.push(
      "Long audio (> 1 minute) may incur higher transcription costs"
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Sanitize whisper data for storage
 */
export function sanitizeWhisperData(data: Partial<Whisper>): Partial<Whisper> {
  const sanitized = { ...data };

  // Sanitize display name
  if (sanitized.userDisplayName) {
    sanitized.userDisplayName = sanitized.userDisplayName
      .trim()
      .substring(0, 50);
  }

  // Sanitize transcription
  if (sanitized.transcription) {
    sanitized.transcription = sanitized.transcription.trim().substring(0, 1000);
  }

  // Ensure numeric fields are valid
  if (sanitized.duration !== undefined) {
    sanitized.duration = Math.max(0, Math.min(300, sanitized.duration));
  }

  if (sanitized.whisperPercentage !== undefined) {
    sanitized.whisperPercentage = Math.max(
      0,
      Math.min(100, sanitized.whisperPercentage)
    );
  }

  if (sanitized.averageLevel !== undefined) {
    sanitized.averageLevel = Math.max(0, Math.min(1, sanitized.averageLevel));
  }

  if (sanitized.confidence !== undefined) {
    sanitized.confidence = Math.max(0, Math.min(1, sanitized.confidence));
  }

  return sanitized;
}
