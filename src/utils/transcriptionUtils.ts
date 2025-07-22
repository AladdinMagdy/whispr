import { extractFileExtension } from "./fileUtils";

// ===== INTERFACES =====

export interface TranscriptionOptions {
  language?: string;
  prompt?: string;
  responseFormat?: "json" | "text" | "srt" | "verbose_json" | "vtt";
  temperature?: number;
}

export interface TranscriptionResponse {
  text: string;
  language?: string;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export interface CostEstimate {
  costPerMinute: number;
  totalCost: number;
  durationMinutes: number;
  currency: string;
}

export interface FileFormatInfo {
  extension: string;
  mimeType: string;
  isPreferred: boolean;
  maxSizeMB: number;
}

// ===== MIME TYPE MAPPING =====

/**
 * Get MIME type for file extension
 */
export function getMimeTypeForExtension(extension: string): string {
  const mimeTypes: { [key: string]: string } = {
    mp3: "audio/mpeg",
    wav: "audio/wav",
    m4a: "audio/mp4",
    mp4: "audio/mp4",
    flac: "audio/flac",
    ogg: "audio/ogg",
    webm: "audio/webm",
    aac: "audio/aac",
    wma: "audio/x-ms-wma",
  };

  return mimeTypes[extension.toLowerCase()] || "audio/mpeg";
}

/**
 * Get all supported MIME types
 */
export function getSupportedMimeTypes(): string[] {
  return [
    "audio/mpeg",
    "audio/wav",
    "audio/mp4",
    "audio/flac",
    "audio/ogg",
    "audio/webm",
    "audio/aac",
    "audio/x-ms-wma",
  ];
}

/**
 * Check if MIME type is supported
 */
export function isMimeTypeSupported(mimeType: string): boolean {
  return getSupportedMimeTypes().includes(mimeType);
}

// ===== FILE EXTENSION SELECTION =====

/**
 * Get best file extension for Whisper API
 */
export function getBestFileExtension(
  originalUrl: string,
  detectedFormat: string
): string {
  // Whisper API prefers certain formats
  const preferredFormats = ["mp3", "wav", "flac", "m4a"];

  // If the detected format is preferred, use it
  if (preferredFormats.includes(detectedFormat)) {
    return detectedFormat;
  }

  // Otherwise, try to detect from URL
  const urlExtension = extractFileExtension(originalUrl);
  if (preferredFormats.includes(urlExtension)) {
    return urlExtension;
  }

  // Fallback to mp4 if not supported
  return "mp4";
}

/**
 * Get file format information
 */
export function getFileFormatInfo(extension: string): FileFormatInfo {
  const extensionLower = extension.toLowerCase();

  const formatInfo: { [key: string]: FileFormatInfo } = {
    mp3: {
      extension: "mp3",
      mimeType: "audio/mpeg",
      isPreferred: true,
      maxSizeMB: 25,
    },
    wav: {
      extension: "wav",
      mimeType: "audio/wav",
      isPreferred: true,
      maxSizeMB: 25,
    },
    flac: {
      extension: "flac",
      mimeType: "audio/flac",
      isPreferred: true,
      maxSizeMB: 25,
    },
    m4a: {
      extension: "m4a",
      mimeType: "audio/mp4",
      isPreferred: true,
      maxSizeMB: 25,
    },
    mp4: {
      extension: "mp4",
      mimeType: "audio/mp4",
      isPreferred: false,
      maxSizeMB: 25,
    },
    ogg: {
      extension: "ogg",
      mimeType: "audio/ogg",
      isPreferred: false,
      maxSizeMB: 25,
    },
    webm: {
      extension: "webm",
      mimeType: "audio/webm",
      isPreferred: false,
      maxSizeMB: 25,
    },
  };

  return (
    formatInfo[extensionLower] || {
      extension: "mp4",
      mimeType: "audio/mp4",
      isPreferred: false,
      maxSizeMB: 25,
    }
  );
}

/**
 * Validate file format for transcription
 */
export function validateFileFormat(extension: string): {
  isValid: boolean;
  errors: string[];
  formatInfo: FileFormatInfo;
} {
  const errors: string[] = [];
  const formatInfo = getFileFormatInfo(extension);

  // Check if it's a supported format (not the default fallback)
  const supportedFormats = ["mp3", "wav", "flac", "m4a", "mp4", "ogg", "webm"];
  if (!supportedFormats.includes(extension.toLowerCase())) {
    errors.push(`Unsupported file format: ${extension}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    formatInfo,
  };
}

// ===== RETRY LOGIC =====

/**
 * Calculate delay for retry with exponential backoff
 */
export function calculateRetryDelay(
  attempt: number,
  config: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
  }
): number {
  const delay =
    config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
  return Math.min(delay, config.maxDelay);
}

/**
 * Check if retry should be attempted
 */
export function shouldRetry(
  attempt: number,
  error: Error,
  config: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
  }
): boolean {
  if (attempt >= config.maxRetries) {
    return false;
  }

  // Check if error is retryable
  const retryableErrors = [
    "network",
    "timeout",
    "rate limit",
    "quota exceeded",
    "server error",
    "temporary",
  ];

  const errorMessage = error.message.toLowerCase();
  return retryableErrors.some((retryableError) =>
    errorMessage.includes(retryableError)
  );
}

/**
 * Create retry configuration
 */
export function createRetryConfig(
  maxRetries: number = 3,
  baseDelay: number = 1000,
  maxDelay: number = 10000,
  backoffMultiplier: number = 2
): RetryConfig {
  return {
    maxRetries: Math.max(1, Math.min(maxRetries, 10)),
    baseDelay: Math.max(100, Math.min(baseDelay, 5000)),
    maxDelay: Math.max(baseDelay, Math.min(maxDelay, 30000)),
    backoffMultiplier: Math.max(1.1, Math.min(backoffMultiplier, 5)),
  };
}

// ===== COST ESTIMATION =====

/**
 * Estimate transcription cost
 */
export function estimateTranscriptionCost(
  audioDurationSeconds: number,
  costPerMinute: number = 0.006
): CostEstimate {
  const durationMinutes = audioDurationSeconds / 60;
  const totalCost = durationMinutes * costPerMinute;

  return {
    costPerMinute,
    totalCost: Math.round(totalCost * 1000000) / 1000000, // Round to 6 decimal places
    durationMinutes: Math.round(durationMinutes * 100) / 100, // Round to 2 decimal places
    currency: "USD",
  };
}

/**
 * Calculate cost for multiple files
 */
export function calculateBatchCost(
  durations: number[],
  costPerMinute: number = 0.006
): CostEstimate {
  const totalDurationSeconds = durations.reduce(
    (sum, duration) => sum + duration,
    0
  );
  return estimateTranscriptionCost(totalDurationSeconds, costPerMinute);
}

/**
 * Check if cost is within budget
 */
export function isWithinBudget(
  cost: CostEstimate,
  budget: number
): {
  isWithin: boolean;
  remaining: number;
  percentage: number;
} {
  const remaining = Math.max(0, budget - cost.totalCost);
  const percentage = budget > 0 ? (cost.totalCost / budget) * 100 : 0;

  return {
    isWithin: cost.totalCost <= budget,
    remaining,
    percentage: Math.round(percentage * 100) / 100,
  };
}

// ===== VALIDATION FUNCTIONS =====

/**
 * Validate transcription options
 */
export function validateTranscriptionOptions(options: TranscriptionOptions): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate language
  if (options.language && !isValidLanguageCode(options.language)) {
    errors.push(`Invalid language code: ${options.language}`);
  }

  // Validate temperature
  if (options.temperature !== undefined) {
    if (options.temperature < 0 || options.temperature > 1) {
      errors.push("Temperature must be between 0 and 1");
    }
  }

  // Validate response format
  if (
    options.responseFormat &&
    !isValidResponseFormat(options.responseFormat)
  ) {
    errors.push(`Invalid response format: ${options.responseFormat}`);
  }

  // Validate prompt length
  if (options.prompt && options.prompt.length > 244) {
    errors.push("Prompt must be 244 characters or less");
  }

  // Warnings
  if (options.temperature && options.temperature > 0.8) {
    warnings.push(
      "High temperature may result in less accurate transcriptions"
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate audio file for transcription
 */
export function validateAudioForTranscription(
  fileSize: number,
  duration: number,
  format: string
): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check file size (25MB limit for Whisper API)
  const maxSizeBytes = 25 * 1024 * 1024;
  if (fileSize > maxSizeBytes) {
    errors.push("File size exceeds 25MB limit");
  }

  // Check duration (25MB limit for Whisper API)
  const maxDurationMinutes = 25;
  const durationMinutes = duration / 60;
  if (durationMinutes > maxDurationMinutes) {
    errors.push("Audio duration exceeds 25 minutes limit");
  }

  // Check format
  const formatValidation = validateFileFormat(format);
  if (!formatValidation.isValid) {
    errors.push(...formatValidation.errors);
  }

  // Warnings
  if (durationMinutes > 10) {
    warnings.push("Long audio files may take longer to process");
  }

  if (fileSize > 10 * 1024 * 1024) {
    warnings.push("Large files may take longer to upload and process");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// ===== UTILITY FUNCTIONS =====

/**
 * Check if language code is valid
 */
function isValidLanguageCode(language: string): boolean {
  const validLanguages = [
    "af",
    "ar",
    "az",
    "be",
    "bg",
    "bn",
    "bs",
    "ca",
    "cs",
    "cy",
    "da",
    "de",
    "el",
    "en",
    "es",
    "et",
    "eu",
    "fa",
    "fi",
    "fr",
    "gl",
    "he",
    "hi",
    "hr",
    "ht",
    "hu",
    "hy",
    "id",
    "is",
    "it",
    "ja",
    "ka",
    "kk",
    "km",
    "ko",
    "ky",
    "la",
    "lb",
    "lt",
    "lv",
    "mk",
    "mn",
    "mr",
    "ms",
    "mt",
    "my",
    "ne",
    "nl",
    "no",
    "pl",
    "pt",
    "ro",
    "ru",
    "sk",
    "sl",
    "sn",
    "so",
    "sq",
    "sr",
    "sv",
    "sw",
    "ta",
    "th",
    "tr",
    "uk",
    "ur",
    "uz",
    "vi",
    "yi",
    "zh",
  ];
  return validLanguages.includes(language.toLowerCase());
}

/**
 * Check if response format is valid
 */
function isValidResponseFormat(format: string): boolean {
  const validFormats = ["json", "text", "srt", "verbose_json", "vtt"];
  return validFormats.includes(format);
}

/**
 * Get supported languages
 */
export function getSupportedLanguages(): string[] {
  return [
    "af",
    "ar",
    "az",
    "be",
    "bg",
    "bn",
    "bs",
    "ca",
    "cs",
    "cy",
    "da",
    "de",
    "el",
    "en",
    "es",
    "et",
    "eu",
    "fa",
    "fi",
    "fr",
    "gl",
    "he",
    "hi",
    "hr",
    "ht",
    "hu",
    "hy",
    "id",
    "is",
    "it",
    "ja",
    "ka",
    "kk",
    "km",
    "ko",
    "ky",
    "la",
    "lb",
    "lt",
    "lv",
    "mk",
    "mn",
    "mr",
    "ms",
    "mt",
    "my",
    "ne",
    "nl",
    "no",
    "pl",
    "pt",
    "ro",
    "ru",
    "sk",
    "sl",
    "sn",
    "so",
    "sq",
    "sr",
    "sv",
    "sw",
    "ta",
    "th",
    "tr",
    "uk",
    "ur",
    "uz",
    "vi",
    "yi",
    "zh",
  ];
}

/**
 * Format cost for display
 */
export function formatCost(cost: CostEstimate): string {
  return `$${cost.totalCost.toFixed(6)} (${cost.durationMinutes.toFixed(
    2
  )} minutes)`;
}

/**
 * Check if transcription service is available
 */
export function isTranscriptionAvailable(apiKey?: string): boolean {
  return !!(apiKey || process.env.OPENAI_API_KEY);
}

/**
 * Create simple delay utility
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sanitize transcription text
 */
export function sanitizeTranscriptionText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, " ") // Replace multiple spaces with single space
    .replace(/[^\w\s.,!?-]/g, "") // Remove special characters except basic punctuation
    .trim(); // Trim again to remove any trailing spaces
}

/**
 * Calculate transcription confidence score
 */
export function calculateConfidenceScore(
  text: string,
  duration: number,
  wordCount: number
): number {
  if (!text || duration === 0) return 0;

  const wordsPerMinute = (wordCount / duration) * 60;
  const textLength = text.length;

  // Simple heuristic: longer text with reasonable words per minute suggests good transcription
  const lengthScore = Math.min(textLength / 100, 1); // Cap at 1 for 100+ characters
  const paceScore = wordsPerMinute >= 60 && wordsPerMinute <= 200 ? 1 : 0.5;

  return Math.round((lengthScore * 0.7 + paceScore * 0.3) * 100) / 100;
}
