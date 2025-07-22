import {
  getMimeTypeForExtension,
  getSupportedMimeTypes,
  isMimeTypeSupported,
  getBestFileExtension,
  getFileFormatInfo,
  validateFileFormat,
  calculateRetryDelay,
  shouldRetry,
  createRetryConfig,
  estimateTranscriptionCost,
  calculateBatchCost,
  isWithinBudget,
  validateTranscriptionOptions,
  validateAudioForTranscription,
  getSupportedLanguages,
  formatCost,
  isTranscriptionAvailable,
  delay,
  sanitizeTranscriptionText,
  calculateConfidenceScore,
  TranscriptionOptions,
  RetryConfig,
  CostEstimate,
} from "../utils/transcriptionUtils";

// ===== TEST DATA =====

const mockTranscriptionOptions: TranscriptionOptions = {
  language: "en",
  prompt: "This is a test prompt",
  responseFormat: "json",
  temperature: 0.5,
};

const mockRetryConfig: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
};

// ===== MIME TYPE MAPPING TESTS =====

describe("getMimeTypeForExtension", () => {
  it("should return correct MIME type for supported extensions", () => {
    expect(getMimeTypeForExtension("mp3")).toBe("audio/mpeg");
    expect(getMimeTypeForExtension("wav")).toBe("audio/wav");
    expect(getMimeTypeForExtension("m4a")).toBe("audio/mp4");
    expect(getMimeTypeForExtension("flac")).toBe("audio/flac");
    expect(getMimeTypeForExtension("ogg")).toBe("audio/ogg");
    expect(getMimeTypeForExtension("webm")).toBe("audio/webm");
  });

  it("should handle case insensitive extensions", () => {
    expect(getMimeTypeForExtension("MP3")).toBe("audio/mpeg");
    expect(getMimeTypeForExtension("Wav")).toBe("audio/wav");
    expect(getMimeTypeForExtension("M4A")).toBe("audio/mp4");
  });

  it("should return default MIME type for unsupported extensions", () => {
    expect(getMimeTypeForExtension("xyz")).toBe("audio/mpeg");
    expect(getMimeTypeForExtension("")).toBe("audio/mpeg");
  });
});

describe("getSupportedMimeTypes", () => {
  it("should return array of supported MIME types", () => {
    const mimeTypes = getSupportedMimeTypes();

    expect(Array.isArray(mimeTypes)).toBe(true);
    expect(mimeTypes).toContain("audio/mpeg");
    expect(mimeTypes).toContain("audio/wav");
    expect(mimeTypes).toContain("audio/mp4");
    expect(mimeTypes).toContain("audio/flac");
  });
});

describe("isMimeTypeSupported", () => {
  it("should return true for supported MIME types", () => {
    expect(isMimeTypeSupported("audio/mpeg")).toBe(true);
    expect(isMimeTypeSupported("audio/wav")).toBe(true);
    expect(isMimeTypeSupported("audio/mp4")).toBe(true);
  });

  it("should return false for unsupported MIME types", () => {
    expect(isMimeTypeSupported("audio/xyz")).toBe(false);
    expect(isMimeTypeSupported("video/mp4")).toBe(false);
    expect(isMimeTypeSupported("")).toBe(false);
  });
});

// ===== FILE EXTENSION SELECTION TESTS =====

describe("getBestFileExtension", () => {
  it("should return detected format if preferred", () => {
    expect(getBestFileExtension("test.mp3", "mp3")).toBe("mp3");
    expect(getBestFileExtension("test.wav", "wav")).toBe("wav");
    expect(getBestFileExtension("test.flac", "flac")).toBe("flac");
    expect(getBestFileExtension("test.m4a", "m4a")).toBe("m4a");
  });

  it("should return URL extension if preferred", () => {
    expect(getBestFileExtension("test.mp3", "xyz")).toBe("mp3");
    expect(getBestFileExtension("test.wav", "abc")).toBe("wav");
  });

  it("should fallback to mp4 for unsupported formats", () => {
    expect(getBestFileExtension("test.xyz", "xyz")).toBe("mp4");
    expect(getBestFileExtension("test", "abc")).toBe("mp4");
  });
});

describe("getFileFormatInfo", () => {
  it("should return correct format info for supported extensions", () => {
    const mp3Info = getFileFormatInfo("mp3");
    expect(mp3Info.extension).toBe("mp3");
    expect(mp3Info.mimeType).toBe("audio/mpeg");
    expect(mp3Info.isPreferred).toBe(true);
    expect(mp3Info.maxSizeMB).toBe(25);

    const wavInfo = getFileFormatInfo("wav");
    expect(wavInfo.extension).toBe("wav");
    expect(wavInfo.mimeType).toBe("audio/wav");
    expect(wavInfo.isPreferred).toBe(true);
  });

  it("should handle case insensitive extensions", () => {
    const mp3Info = getFileFormatInfo("MP3");
    expect(mp3Info.extension).toBe("mp3");
    expect(mp3Info.mimeType).toBe("audio/mpeg");
  });

  it("should return default format info for unsupported extensions", () => {
    const defaultInfo = getFileFormatInfo("xyz");
    expect(defaultInfo.extension).toBe("mp4");
    expect(defaultInfo.mimeType).toBe("audio/mp4");
    expect(defaultInfo.isPreferred).toBe(false);
  });
});

describe("validateFileFormat", () => {
  it("should validate supported formats", () => {
    const result = validateFileFormat("mp3");

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.formatInfo.extension).toBe("mp3");
  });

  it("should handle unsupported formats", () => {
    const result = validateFileFormat("xyz");

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Unsupported file format: xyz");
  });
});

// ===== RETRY LOGIC TESTS =====

describe("calculateRetryDelay", () => {
  it("should calculate exponential backoff delay", () => {
    const config = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
    };

    expect(calculateRetryDelay(1, config)).toBe(1000);
    expect(calculateRetryDelay(2, config)).toBe(2000);
    expect(calculateRetryDelay(3, config)).toBe(4000);
  });

  it("should respect max delay limit", () => {
    const config = {
      maxRetries: 5,
      baseDelay: 1000,
      maxDelay: 2000,
      backoffMultiplier: 2,
    };

    expect(calculateRetryDelay(1, config)).toBe(1000);
    expect(calculateRetryDelay(2, config)).toBe(2000);
    expect(calculateRetryDelay(3, config)).toBe(2000); // Capped at maxDelay
  });

  it("should use default config when not provided", () => {
    expect(calculateRetryDelay(1)).toBe(1000);
    expect(calculateRetryDelay(2)).toBe(2000);
  });
});

describe("shouldRetry", () => {
  it("should return true for retryable errors", () => {
    const retryableErrors = [
      new Error("Network error"),
      new Error("Timeout occurred"),
      new Error("Rate limit exceeded"),
      new Error("Quota exceeded"),
      new Error("Server error 500"),
      new Error("Temporary failure"),
    ];

    retryableErrors.forEach((error) => {
      expect(shouldRetry(1, error)).toBe(true);
    });
  });

  it("should return false for non-retryable errors", () => {
    const nonRetryableErrors = [
      new Error("Invalid API key"),
      new Error("File not found"),
      new Error("Permission denied"),
    ];

    nonRetryableErrors.forEach((error) => {
      expect(shouldRetry(1, error)).toBe(false);
    });
  });

  it("should return false when max retries reached", () => {
    const error = new Error("Network error");
    expect(shouldRetry(3, error)).toBe(false);
  });
});

describe("createRetryConfig", () => {
  it("should create valid retry configuration", () => {
    const config = createRetryConfig(5, 2000, 15000, 3);

    expect(config.maxRetries).toBe(5);
    expect(config.baseDelay).toBe(2000);
    expect(config.maxDelay).toBe(15000);
    expect(config.backoffMultiplier).toBe(3);
  });

  it("should clamp values to valid ranges", () => {
    const config = createRetryConfig(15, 50, 50000, 10);

    expect(config.maxRetries).toBe(10); // Clamped to max 10
    expect(config.baseDelay).toBe(100); // Clamped to min 100
    expect(config.maxDelay).toBe(30000); // Clamped to max 30000
    expect(config.backoffMultiplier).toBe(5); // Clamped to max 5
  });
});

// ===== COST ESTIMATION TESTS =====

describe("estimateTranscriptionCost", () => {
  it("should calculate cost correctly", () => {
    const cost = estimateTranscriptionCost(60, 0.006); // 1 minute

    expect(cost.costPerMinute).toBe(0.006);
    expect(cost.totalCost).toBe(0.006);
    expect(cost.durationMinutes).toBe(1);
    expect(cost.currency).toBe("USD");
  });

  it("should handle fractional minutes", () => {
    const cost = estimateTranscriptionCost(30, 0.006); // 0.5 minutes

    expect(cost.totalCost).toBe(0.003);
    expect(cost.durationMinutes).toBe(0.5);
  });

  it("should round to 6 decimal places", () => {
    const cost = estimateTranscriptionCost(10, 0.006); // 0.167 minutes

    expect(cost.totalCost).toBe(0.001);
    expect(cost.durationMinutes).toBe(0.17);
  });
});

describe("calculateBatchCost", () => {
  it("should calculate total cost for multiple files", () => {
    const durations = [60, 120, 30]; // 1, 2, 0.5 minutes
    const cost = calculateBatchCost(durations, 0.006);

    expect(cost.totalCost).toBe(0.021); // 3.5 minutes * 0.006
    expect(cost.durationMinutes).toBe(3.5);
  });

  it("should handle empty array", () => {
    const cost = calculateBatchCost([], 0.006);

    expect(cost.totalCost).toBe(0);
    expect(cost.durationMinutes).toBe(0);
  });
});

describe("isWithinBudget", () => {
  it("should check if cost is within budget", () => {
    const cost: CostEstimate = {
      costPerMinute: 0.006,
      totalCost: 0.01,
      durationMinutes: 1.67,
      currency: "USD",
    };

    const result = isWithinBudget(cost, 0.02);

    expect(result.isWithin).toBe(true);
    expect(result.remaining).toBe(0.01);
    expect(result.percentage).toBe(50);
  });

  it("should handle cost exceeding budget", () => {
    const cost: CostEstimate = {
      costPerMinute: 0.006,
      totalCost: 0.05,
      durationMinutes: 8.33,
      currency: "USD",
    };

    const result = isWithinBudget(cost, 0.02);

    expect(result.isWithin).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.percentage).toBe(250);
  });

  it("should handle zero budget", () => {
    const cost: CostEstimate = {
      costPerMinute: 0.006,
      totalCost: 0.01,
      durationMinutes: 1.67,
      currency: "USD",
    };

    const result = isWithinBudget(cost, 0);

    expect(result.isWithin).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.percentage).toBe(0);
  });
});

// ===== VALIDATION FUNCTIONS TESTS =====

describe("validateTranscriptionOptions", () => {
  it("should validate correct options", () => {
    const result = validateTranscriptionOptions(mockTranscriptionOptions);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should detect invalid language code", () => {
    const invalidOptions = { ...mockTranscriptionOptions, language: "xyz" };
    const result = validateTranscriptionOptions(invalidOptions);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Invalid language code: xyz");
  });

  it("should detect invalid temperature", () => {
    const invalidOptions = { ...mockTranscriptionOptions, temperature: 1.5 };
    const result = validateTranscriptionOptions(invalidOptions);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Temperature must be between 0 and 1");
  });

  it("should detect invalid response format", () => {
    const invalidOptions = {
      ...mockTranscriptionOptions,
      responseFormat: "invalid" as any,
    };
    const result = validateTranscriptionOptions(invalidOptions);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Invalid response format: invalid");
  });

  it("should detect prompt too long", () => {
    const longPrompt = "A".repeat(245);
    const invalidOptions = { ...mockTranscriptionOptions, prompt: longPrompt };
    const result = validateTranscriptionOptions(invalidOptions);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Prompt must be 244 characters or less");
  });

  it("should warn about high temperature", () => {
    const highTempOptions = { ...mockTranscriptionOptions, temperature: 0.9 };
    const result = validateTranscriptionOptions(highTempOptions);

    expect(result.isValid).toBe(true);
    expect(result.warnings).toContain(
      "High temperature may result in less accurate transcriptions"
    );
  });
});

describe("validateAudioForTranscription", () => {
  it("should validate correct audio file", () => {
    const result = validateAudioForTranscription(1024 * 1024, 60, "mp3"); // 1MB, 1 minute

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should detect file size too large", () => {
    const largeFileSize = 30 * 1024 * 1024; // 30MB
    const result = validateAudioForTranscription(largeFileSize, 60, "mp3");

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("File size exceeds 25MB limit");
  });

  it("should detect duration too long", () => {
    const longDuration = 30 * 60; // 30 minutes
    const result = validateAudioForTranscription(
      1024 * 1024,
      longDuration,
      "mp3"
    );

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Audio duration exceeds 25 minutes limit");
  });

  it("should detect unsupported format", () => {
    const result = validateAudioForTranscription(1024 * 1024, 60, "xyz");

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Unsupported file format: xyz");
  });

  it("should warn about long audio files", () => {
    const longDuration = 15 * 60; // 15 minutes
    const result = validateAudioForTranscription(
      1024 * 1024,
      longDuration,
      "mp3"
    );

    expect(result.isValid).toBe(true);
    expect(result.warnings).toContain(
      "Long audio files may take longer to process"
    );
  });

  it("should warn about large files", () => {
    const largeFileSize = 15 * 1024 * 1024; // 15MB
    const result = validateAudioForTranscription(largeFileSize, 60, "mp3");

    expect(result.isValid).toBe(true);
    expect(result.warnings).toContain(
      "Large files may take longer to upload and process"
    );
  });
});

// ===== UTILITY FUNCTION TESTS =====

describe("getSupportedLanguages", () => {
  it("should return array of supported languages", () => {
    const languages = getSupportedLanguages();

    expect(Array.isArray(languages)).toBe(true);
    expect(languages).toContain("en");
    expect(languages).toContain("es");
    expect(languages).toContain("fr");
    expect(languages).toContain("de");
    expect(languages).toContain("ja");
    expect(languages).toContain("zh");
  });
});

describe("formatCost", () => {
  it("should format cost correctly", () => {
    const cost: CostEstimate = {
      costPerMinute: 0.006,
      totalCost: 0.012,
      durationMinutes: 2,
      currency: "USD",
    };

    const formatted = formatCost(cost);
    expect(formatted).toBe("$0.012000 (2.00 minutes)");
  });
});

describe("isTranscriptionAvailable", () => {
  it("should return true when API key is available", () => {
    const originalEnv = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "test-key";

    expect(isTranscriptionAvailable()).toBe(true);
    expect(isTranscriptionAvailable("custom-key")).toBe(true);

    process.env.OPENAI_API_KEY = originalEnv;
  });

  it("should return false when no API key is available", () => {
    const originalEnv = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    expect(isTranscriptionAvailable()).toBe(false);
    expect(isTranscriptionAvailable(undefined)).toBe(false);

    process.env.OPENAI_API_KEY = originalEnv;
  });
});

describe("delay", () => {
  it("should create a delay promise", async () => {
    const start = Date.now();
    await delay(100);
    const end = Date.now();

    expect(end - start).toBeGreaterThanOrEqual(100);
  });
});

describe("sanitizeTranscriptionText", () => {
  it("should sanitize transcription text", () => {
    const input = "  Hello   world!  @#$%^&*()  ";
    const result = sanitizeTranscriptionText(input);

    expect(result).toBe("Hello world!");
  });

  it("should preserve basic punctuation", () => {
    const input = "Hello, world! How are you?";
    const result = sanitizeTranscriptionText(input);

    expect(result).toBe("Hello, world! How are you?");
  });

  it("should handle empty string", () => {
    const result = sanitizeTranscriptionText("");
    expect(result).toBe("");
  });
});

describe("calculateConfidenceScore", () => {
  it("should calculate confidence score correctly", () => {
    const text = "Hello world this is a test";
    const duration = 10; // 10 seconds
    const wordCount = 6;

    const score = calculateConfidenceScore(text, duration, wordCount);

    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("should return 0 for empty text", () => {
    const score = calculateConfidenceScore("", 10, 0);
    expect(score).toBe(0);
  });

  it("should return 0 for zero duration", () => {
    const score = calculateConfidenceScore("Hello world", 0, 2);
    expect(score).toBe(0);
  });

  it("should handle reasonable words per minute", () => {
    const text = "A".repeat(100); // 100 characters
    const duration = 60; // 1 minute
    const wordCount = 20; // 20 words per minute

    const score = calculateConfidenceScore(text, duration, wordCount);

    expect(score).toBeGreaterThan(0.5); // Should be high due to good length and reasonable pace
  });
});

// ===== EDGE CASES AND BOUNDARY TESTS =====

describe("Edge Cases and Boundary Tests", () => {
  it("should handle boundary values in retry delay calculation", () => {
    expect(calculateRetryDelay(1, mockRetryConfig)).toBe(1000);
    expect(calculateRetryDelay(10, mockRetryConfig)).toBe(10000); // Capped at maxDelay
  });

  it("should handle boundary values in cost calculation", () => {
    expect(estimateTranscriptionCost(0, 0.006).totalCost).toBe(0);
    expect(estimateTranscriptionCost(1, 0).totalCost).toBe(0);
  });

  it("should handle boundary values in file validation", () => {
    const maxSize = 25 * 1024 * 1024;
    const maxDuration = 25 * 60;

    const result1 = validateAudioForTranscription(maxSize, 60, "mp3");
    expect(result1.isValid).toBe(true);

    const result2 = validateAudioForTranscription(maxSize + 1, 60, "mp3");
    expect(result2.isValid).toBe(false);

    const result3 = validateAudioForTranscription(
      1024 * 1024,
      maxDuration,
      "mp3"
    );
    expect(result3.isValid).toBe(true);

    const result4 = validateAudioForTranscription(
      1024 * 1024,
      maxDuration + 1,
      "mp3"
    );
    expect(result4.isValid).toBe(false);
  });

  it("should handle boundary values in temperature validation", () => {
    const result1 = validateTranscriptionOptions({ temperature: 0 });
    expect(result1.isValid).toBe(true);

    const result2 = validateTranscriptionOptions({ temperature: 1 });
    expect(result2.isValid).toBe(true);

    const result3 = validateTranscriptionOptions({ temperature: -0.1 });
    expect(result3.isValid).toBe(false);

    const result4 = validateTranscriptionOptions({ temperature: 1.1 });
    expect(result4.isValid).toBe(false);
  });
});
