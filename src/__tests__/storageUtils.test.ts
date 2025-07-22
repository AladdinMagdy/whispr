import {
  generateStoragePath,
  generateUniqueFilename,
  createStoragePath,
  createStorageMetadata,
  parseStorageMetadata,
  validateStorageMetadata,
  parseStorageUrl,
  extractFilePathFromUrl,
  validateStorageUrl,
  validateAudioFileForStorage,
  validateFileSize,
  isFirebaseStorageUrl,
  generateDownloadUrl,
  extractBucketFromUrl,
  sanitizeFilename,
  isSupportedAudioExtension,
  getFileExtension,
  formatFileSize,
  isUrlExpired,
  createRefreshUrlParams,
  StorageMetadata,
} from "../utils/storageUtils";
import { AudioRecording } from "@/types";

// ===== TEST DATA =====

const mockAudioRecording: AudioRecording = {
  uri: "file://test-audio.m4a",
  duration: 30,
  volume: 0.8,
  isWhisper: true,
  timestamp: new Date("2023-01-01T12:00:00Z"),
};

const mockStorageMetadata: StorageMetadata = {
  userId: "test-user-123",
  duration: "30",
  volume: "0.8",
  isWhisper: "true",
  timestamp: "2023-01-01T12:00:00.000Z",
};

const mockFirebaseStorageUrl =
  "https://firebasestorage.googleapis.com/v0/b/test-bucket/o/audio%2Fwhispers%2Ftest-user%2F1234567890.m4a?alt=media&token=abc123";

// ===== FILE PATH GENERATION TESTS =====

describe("generateStoragePath", () => {
  it("should generate storage path with default timestamp", () => {
    const result = generateStoragePath("test-user-123");

    expect(result.userId).toBe("test-user-123");
    expect(result.filename).toMatch(/^\d+\.m4a$/);
    expect(result.fullPath).toMatch(/^whispers\/test-user-123\/\d+\.m4a$/);
    expect(result.storagePath).toMatch(
      /^audio\/whispers\/test-user-123\/\d+\.m4a$/
    );
  });

  it("should generate storage path with custom timestamp", () => {
    const timestamp = 1234567890;
    const result = generateStoragePath("test-user-123", timestamp);

    expect(result.timestamp).toBe(timestamp);
    expect(result.filename).toBe("1234567890.m4a");
    expect(result.fullPath).toBe("whispers/test-user-123/1234567890.m4a");
    expect(result.storagePath).toBe(
      "audio/whispers/test-user-123/1234567890.m4a"
    );
  });
});

describe("generateUniqueFilename", () => {
  it("should generate unique filename with default extension", () => {
    const result = generateUniqueFilename("test-user-123");

    expect(result).toMatch(/^test-user-123_\d+_[a-z0-9]{6}\.m4a$/);
  });

  it("should generate unique filename with custom extension", () => {
    const result = generateUniqueFilename("test-user-123", "mp3");

    expect(result).toMatch(/^test-user-123_\d+_[a-z0-9]{6}\.mp3$/);
  });

  it("should generate different filenames on each call", () => {
    const result1 = generateUniqueFilename("test-user-123");
    const result2 = generateUniqueFilename("test-user-123");

    expect(result1).not.toBe(result2);
  });
});

describe("createStoragePath", () => {
  it("should create storage path from components", () => {
    const result = createStoragePath("audio", "test-user-123", "test.m4a");

    expect(result).toBe("audio/test-user-123/test.m4a");
  });

  it("should handle nested paths", () => {
    const result = createStoragePath(
      "audio/whispers",
      "test-user-123",
      "test.m4a"
    );

    expect(result).toBe("audio/whispers/test-user-123/test.m4a");
  });
});

// ===== METADATA HANDLING TESTS =====

describe("createStorageMetadata", () => {
  it("should create storage metadata from audio recording", () => {
    const result = createStorageMetadata("test-user-123", mockAudioRecording);

    expect(result.userId).toBe("test-user-123");
    expect(result.duration).toBe("30");
    expect(result.volume).toBe("0.8");
    expect(result.isWhisper).toBe("true");
    expect(result.timestamp).toBe("2023-01-01T12:00:00.000Z");
  });
});

describe("parseStorageMetadata", () => {
  it("should parse valid metadata", () => {
    const result = parseStorageMetadata(mockStorageMetadata);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.data).toEqual(mockStorageMetadata);
  });

  it("should detect missing userId", () => {
    const invalidMetadata = {
      ...mockStorageMetadata,
      userId: undefined as any,
    };

    const result = parseStorageMetadata(invalidMetadata);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Missing userId in metadata");
  });

  it("should detect missing duration", () => {
    const invalidMetadata = {
      ...mockStorageMetadata,
      duration: undefined as any,
    };

    const result = parseStorageMetadata(invalidMetadata);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Missing duration in metadata");
  });

  it("should detect missing volume", () => {
    const invalidMetadata = {
      ...mockStorageMetadata,
      volume: undefined as any,
    };

    const result = parseStorageMetadata(invalidMetadata);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Missing volume in metadata");
  });

  it("should detect missing isWhisper", () => {
    const invalidMetadata = {
      ...mockStorageMetadata,
      isWhisper: undefined as any,
    };

    const result = parseStorageMetadata(invalidMetadata);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Missing isWhisper in metadata");
  });

  it("should detect missing timestamp", () => {
    const invalidMetadata = {
      ...mockStorageMetadata,
      timestamp: undefined as any,
    };

    const result = parseStorageMetadata(invalidMetadata);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Missing timestamp in metadata");
  });
});

describe("validateStorageMetadata", () => {
  it("should validate correct metadata", () => {
    const result = validateStorageMetadata(mockStorageMetadata);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should detect missing userId", () => {
    const invalidMetadata = { ...mockStorageMetadata, userId: "" };
    const result = validateStorageMetadata(invalidMetadata);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("UserId is required");
  });

  it("should detect invalid duration", () => {
    const invalidMetadata = { ...mockStorageMetadata, duration: "invalid" };
    const result = validateStorageMetadata(invalidMetadata);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Duration must be a valid number");
  });

  it("should detect invalid volume", () => {
    const invalidMetadata = { ...mockStorageMetadata, volume: "invalid" };
    const result = validateStorageMetadata(invalidMetadata);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Volume must be a valid number");
  });

  it("should detect missing isWhisper", () => {
    const invalidMetadata = {
      ...mockStorageMetadata,
      isWhisper: undefined as any,
    };
    const result = validateStorageMetadata(invalidMetadata);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("IsWhisper flag is required");
  });

  it("should detect invalid timestamp", () => {
    const invalidMetadata = {
      ...mockStorageMetadata,
      timestamp: "invalid-date",
    };
    const result = validateStorageMetadata(invalidMetadata);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      "Timestamp must be a valid ISO date string"
    );
  });
});

// ===== URL PARSING TESTS =====

describe("parseStorageUrl", () => {
  it("should parse valid Firebase Storage URL", () => {
    const result = parseStorageUrl(mockFirebaseStorageUrl);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.path).toBe("audio/whispers/test-user/1234567890.m4a");
  });

  it("should handle invalid URL format", () => {
    const result = parseStorageUrl("invalid-url");

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Invalid URL format");
  });

  it("should handle non-Firebase Storage URL", () => {
    const result = parseStorageUrl("https://example.com/file.m4a");

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Invalid Firebase Storage URL format");
  });

  it("should handle URL without path", () => {
    const result = parseStorageUrl(
      "https://firebasestorage.googleapis.com/v0/b/bucket/o/"
    );

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Could not extract path from URL");
  });
});

describe("extractFilePathFromUrl", () => {
  it("should extract file path from valid URL", () => {
    const result = extractFilePathFromUrl(mockFirebaseStorageUrl);

    expect(result).toBe("audio/whispers/test-user/1234567890.m4a");
  });

  it("should throw error for invalid URL", () => {
    expect(() => extractFilePathFromUrl("invalid-url")).toThrow(
      "Invalid audio URL: Invalid URL format"
    );
  });
});

describe("validateStorageUrl", () => {
  it("should validate correct Firebase Storage URL", () => {
    const result = validateStorageUrl(mockFirebaseStorageUrl);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should detect invalid URL", () => {
    const result = validateStorageUrl("invalid-url");

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Invalid URL format");
  });
});

// ===== FILE VALIDATION TESTS =====

describe("validateAudioFileForStorage", () => {
  it("should validate correct audio file", () => {
    const result = validateAudioFileForStorage(
      mockAudioRecording,
      "test-user-123"
    );

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should detect missing user ID", () => {
    const result = validateAudioFileForStorage(mockAudioRecording, "");

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("User ID is required");
  });

  it("should detect short user ID", () => {
    const result = validateAudioFileForStorage(mockAudioRecording, "ab");

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("User ID must be at least 3 characters");
  });

  it("should detect missing audio URI", () => {
    const invalidRecording = { ...mockAudioRecording, uri: "" };
    const result = validateAudioFileForStorage(
      invalidRecording,
      "test-user-123"
    );

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Audio URI is required");
  });

  it("should detect invalid duration", () => {
    const invalidRecording = { ...mockAudioRecording, duration: 0 };
    const result = validateAudioFileForStorage(
      invalidRecording,
      "test-user-123"
    );

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Audio duration must be greater than 0");
  });

  it("should detect duration too long", () => {
    const invalidRecording = { ...mockAudioRecording, duration: 400 };
    const result = validateAudioFileForStorage(
      invalidRecording,
      "test-user-123"
    );

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Audio duration cannot exceed 5 minutes");
  });

  it("should detect invalid volume", () => {
    const invalidRecording = { ...mockAudioRecording, volume: 1.5 };
    const result = validateAudioFileForStorage(
      invalidRecording,
      "test-user-123"
    );

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Audio volume must be between 0 and 1");
  });

  it("should detect future timestamp", () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 1);
    const invalidRecording = { ...mockAudioRecording, timestamp: futureDate };
    const result = validateAudioFileForStorage(
      invalidRecording,
      "test-user-123"
    );

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Audio timestamp cannot be in the future");
  });

  it("should warn about long audio files", () => {
    const longRecording = { ...mockAudioRecording, duration: 90 };
    const result = validateAudioFileForStorage(longRecording, "test-user-123");

    expect(result.isValid).toBe(true);
    expect(result.warnings).toContain(
      "Long audio files may take longer to upload"
    );
  });

  it("should warn about low volume", () => {
    const lowVolumeRecording = { ...mockAudioRecording, volume: 0.05 };
    const result = validateAudioFileForStorage(
      lowVolumeRecording,
      "test-user-123"
    );

    expect(result.isValid).toBe(true);
    expect(result.warnings).toContain(
      "Very low volume audio may be difficult to hear"
    );
  });
});

describe("validateFileSize", () => {
  it("should validate correct file size", () => {
    const result = validateFileSize(1024 * 1024); // 1MB

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should detect zero file size", () => {
    const result = validateFileSize(0);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("File size must be greater than 0");
  });

  it("should detect file size too large", () => {
    const largeSize = 30 * 1024 * 1024; // 30MB
    const result = validateFileSize(largeSize);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("File size exceeds 25MB limit");
  });

  it("should warn about large file size", () => {
    const largeSize = 20 * 1024 * 1024; // 20MB (80% of 25MB)
    const result = validateFileSize(largeSize);

    expect(result.isValid).toBe(true);
    expect(result.warnings).toContain("File size is close to 25MB limit");
  });

  it("should handle custom max size", () => {
    const result = validateFileSize(15 * 1024 * 1024, 10); // 15MB with 10MB limit

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("File size exceeds 10MB limit");
  });
});

// ===== UTILITY FUNCTION TESTS =====

describe("isFirebaseStorageUrl", () => {
  it("should identify Firebase Storage URL", () => {
    expect(isFirebaseStorageUrl(mockFirebaseStorageUrl)).toBe(true);
  });

  it("should reject non-Firebase Storage URL", () => {
    expect(isFirebaseStorageUrl("https://example.com/file.m4a")).toBe(false);
  });

  it("should handle invalid URL", () => {
    expect(isFirebaseStorageUrl("invalid-url")).toBe(false);
  });
});

describe("generateDownloadUrl", () => {
  it("should generate download URL with default bucket", () => {
    const result = generateDownloadUrl("audio/test.m4a");

    expect(result).toContain("firebasestorage.googleapis.com");
    expect(result).toContain("audio%2Ftest.m4a");
    expect(result).toContain("alt=media");
  });

  it("should generate download URL with custom bucket", () => {
    const result = generateDownloadUrl("audio/test.m4a", "custom-bucket");

    expect(result).toContain("custom-bucket");
  });
});

describe("extractBucketFromUrl", () => {
  it("should extract bucket from Firebase Storage URL", () => {
    const result = extractBucketFromUrl(mockFirebaseStorageUrl);

    expect(result).toBe("test-bucket");
  });

  it("should return null for invalid URL", () => {
    const result = extractBucketFromUrl("invalid-url");

    expect(result).toBeNull();
  });
});

describe("sanitizeFilename", () => {
  it("should sanitize filename with invalid characters", () => {
    const result = sanitizeFilename("test@file#name.m4a");

    expect(result).toBe("test_file_name.m4a");
  });

  it("should replace multiple underscores", () => {
    const result = sanitizeFilename("test__file___name.m4a");

    expect(result).toBe("test_file_name.m4a");
  });

  it("should remove leading/trailing underscores", () => {
    const result = sanitizeFilename("_test_file_name_.m4a");

    expect(result).toBe("test_file_name.m4a");
  });

  it("should limit filename length", () => {
    const longName = "a".repeat(300) + ".m4a";
    const result = sanitizeFilename(longName);

    expect(result.length).toBeLessThanOrEqual(255);
  });
});

describe("isSupportedAudioExtension", () => {
  it("should identify supported extensions", () => {
    expect(isSupportedAudioExtension("m4a")).toBe(true);
    expect(isSupportedAudioExtension("mp3")).toBe(true);
    expect(isSupportedAudioExtension("wav")).toBe(true);
    expect(isSupportedAudioExtension("flac")).toBe(true);
  });

  it("should handle case insensitive extensions", () => {
    expect(isSupportedAudioExtension("M4A")).toBe(true);
    expect(isSupportedAudioExtension("MP3")).toBe(true);
  });

  it("should reject unsupported extensions", () => {
    expect(isSupportedAudioExtension("xyz")).toBe(false);
    expect(isSupportedAudioExtension("")).toBe(false);
  });
});

describe("getFileExtension", () => {
  it("should extract file extension", () => {
    expect(getFileExtension("test.m4a")).toBe("m4a");
    expect(getFileExtension("test.mp3")).toBe("mp3");
    expect(getFileExtension("test.wav")).toBe("wav");
  });

  it("should handle case insensitive extensions", () => {
    expect(getFileExtension("test.M4A")).toBe("m4a");
    expect(getFileExtension("test.MP3")).toBe("mp3");
  });

  it("should handle files without extension", () => {
    expect(getFileExtension("test")).toBe("");
    expect(getFileExtension("")).toBe("");
  });
});

describe("formatFileSize", () => {
  it("should format file sizes correctly", () => {
    expect(formatFileSize(0)).toBe("0 Bytes");
    expect(formatFileSize(1024)).toBe("1 KB");
    expect(formatFileSize(1024 * 1024)).toBe("1 MB");
    expect(formatFileSize(1024 * 1024 * 1024)).toBe("1 GB");
  });

  it("should handle fractional sizes", () => {
    expect(formatFileSize(1536)).toBe("1.5 KB");
    expect(formatFileSize(1536 * 1024)).toBe("1.5 MB");
  });
});

describe("isUrlExpired", () => {
  it("should detect expired URL", () => {
    const expiredUrl = "https://example.com/file.m4a?expires=1234567890";
    expect(isUrlExpired(expiredUrl)).toBe(true);
  });

  it("should detect non-expired URL", () => {
    const futureTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    const validUrl = `https://example.com/file.m4a?expires=${futureTime}`;
    expect(isUrlExpired(validUrl)).toBe(false);
  });

  it("should handle URL without expiration", () => {
    const urlWithoutExpiry = "https://example.com/file.m4a";
    expect(isUrlExpired(urlWithoutExpiry)).toBe(false);
  });

  it("should handle invalid URL", () => {
    expect(isUrlExpired("invalid-url")).toBe(false);
  });
});

describe("createRefreshUrlParams", () => {
  it("should create refresh URL parameters", () => {
    const result = createRefreshUrlParams();

    expect(result.alt).toBe("media");
    expect(result.t).toBeDefined();
    expect(typeof result.t).toBe("string");
  });

  it("should include timestamp for cache busting", () => {
    const result1 = createRefreshUrlParams();
    const result2 = createRefreshUrlParams();

    expect(result1.t).not.toBe(result2.t);
  });
});

// ===== EDGE CASES AND BOUNDARY TESTS =====

describe("Edge Cases and Boundary Tests", () => {
  it("should handle boundary values in file size validation", () => {
    const maxSize = 25 * 1024 * 1024;

    const result1 = validateFileSize(maxSize);
    expect(result1.isValid).toBe(true);

    const result2 = validateFileSize(maxSize + 1);
    expect(result2.isValid).toBe(false);
  });

  it("should handle boundary values in audio duration validation", () => {
    const result1 = validateAudioFileForStorage(
      { ...mockAudioRecording, duration: 300 },
      "test-user-123"
    );
    expect(result1.isValid).toBe(true);

    const result2 = validateAudioFileForStorage(
      { ...mockAudioRecording, duration: 301 },
      "test-user-123"
    );
    expect(result2.isValid).toBe(false);
  });

  it("should handle boundary values in volume validation", () => {
    const result1 = validateAudioFileForStorage(
      { ...mockAudioRecording, volume: 0 },
      "test-user-123"
    );
    expect(result1.isValid).toBe(true);

    const result2 = validateAudioFileForStorage(
      { ...mockAudioRecording, volume: 1 },
      "test-user-123"
    );
    expect(result2.isValid).toBe(true);

    const result3 = validateAudioFileForStorage(
      { ...mockAudioRecording, volume: -0.1 },
      "test-user-123"
    );
    expect(result3.isValid).toBe(false);

    const result4 = validateAudioFileForStorage(
      { ...mockAudioRecording, volume: 1.1 },
      "test-user-123"
    );
    expect(result4.isValid).toBe(false);
  });
});
