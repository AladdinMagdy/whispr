/**
 * whisperValidator.test.ts
 * Comprehensive tests for WhisperValidator and AudioLevelAnalyzer
 */

import { WhisperValidator } from "../utils/whisperValidator";

// --- WhisperValidator tests ---
describe("WhisperValidator", () => {
  let validator: WhisperValidator;
  beforeEach(() => {
    validator = new WhisperValidator();
    validator.startMonitoring();
  });

  it("should return not whisper for no data", () => {
    expect(validator.getCurrentStatus()).toEqual({
      isWhisper: false,
      level: 0,
    });
    const result = validator.validateRecording();
    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/no audio/i);
  });

  it("should detect silence as whisper", () => {
    validator.addAudioLevel(0);
    expect(validator.getCurrentStatus().isWhisper).toBe(true);
  });

  it("should detect loud as not whisper", () => {
    validator.addAudioLevel(1);
    expect(validator.getCurrentStatus().isWhisper).toBe(false);
  });

  it("should validate too short recording", () => {
    validator.addAudioLevel(0.1);
    const result = validator.validateRecording();
    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/too short/i);
  });

  it("should validate too long recording", () => {
    // Simulate long duration
    for (let i = 0; i < 100; i++) {
      validator.addAudioLevel(0.1);
    }
    // Manually set startTime to simulate long duration
    (validator as any).startTime = Date.now() - 31000;
    const result = validator.validateRecording();
    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/too long/i);
  });

  it("should validate a valid whisper recording", () => {
    // 80% whisper, 20% loud
    for (let i = 0; i < 8; i++) validator.addAudioLevel(0.1);
    for (let i = 0; i < 2; i++) validator.addAudioLevel(0.5);
    // Simulate duration
    (validator as any).startTime = Date.now() - 5000;
    const result = validator.validateRecording();
    expect(result.isValid).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.7);
    expect(result.whisperPercentage).toBeGreaterThanOrEqual(0.7);
    expect(result.reason).toBeUndefined();
  });

  it("should validate a too loud recording", () => {
    for (let i = 0; i < 10; i++) validator.addAudioLevel(0.6);
    (validator as any).startTime = Date.now() - 5000;
    const result = validator.validateRecording();
    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/too loud/i);
    expect(result.whisperPercentage).toBeLessThan(0.7);
  });

  it("should calculate confidence based on average level", () => {
    // Low average level boosts confidence
    for (let i = 0; i < 10; i++) validator.addAudioLevel(0.05);
    (validator as any).startTime = Date.now() - 5000;
    let result = validator.validateRecording();
    expect(result.confidence).toBeGreaterThan(0.8);
    // High average level reduces confidence
    validator.reset();
    validator.startMonitoring();
    for (let i = 0; i < 10; i++) validator.addAudioLevel(0.5);
    (validator as any).startTime = Date.now() - 5000;
    result = validator.validateRecording();
    expect(result.confidence).toBeLessThan(0.7);
  });

  it("should compute statistics correctly", () => {
    for (let i = 0; i < 5; i++) validator.addAudioLevel(0.1);
    for (let i = 0; i < 5; i++) validator.addAudioLevel(0.6);
    (validator as any).startTime = Date.now() - 10000;
    const stats = validator.getStatistics();
    expect(stats.totalSamples).toBe(10);
    expect(stats.whisperSamples).toBe(5);
    // Only check for properties that exist
    expect(stats.averageLevel).toBeGreaterThan(0);
    expect(stats.maxLevel).toBeCloseTo(0.6);
    expect(stats.minLevel).toBeCloseTo(0.1);
    expect(stats.duration).toBeGreaterThan(0);
  });

  it("should reset state", () => {
    validator.addAudioLevel(0.2);
    validator.reset();
    expect((validator as any).audioLevels.length).toBe(0);
    expect((validator as any).startTime).toBeNull();
  });
});

// --- AudioLevelAnalyzer tests (singleton, isWhisperLevel, etc.) ---
import { AudioLevelAnalyzer } from "../utils/whisperValidator";

describe("AudioLevelAnalyzer", () => {
  it("should return the same singleton instance", () => {
    const a = AudioLevelAnalyzer.getInstance();
    const b = AudioLevelAnalyzer.getInstance();
    expect(a).toBe(b);
  });
});

// --- AudioLevelAnalyzer/WhisperUtils tests (singleton, isWhisperLevel, etc.) ---
import { WhisperUtils } from "../utils/whisperValidator";

describe("WhisperUtils", () => {
  it("should detect whisper level correctly", () => {
    expect(WhisperUtils.isWhisperLevel(0.1)).toBe(true);
    expect(WhisperUtils.isWhisperLevel(0.5)).toBe(false);
    expect(WhisperUtils.isWhisperLevel(0.2, 0.15)).toBe(false);
  });

  it("should convert level to percentage", () => {
    expect(WhisperUtils.levelToPercentage(0)).toBe(0);
    expect(WhisperUtils.levelToPercentage(0.5)).toBe(50);
    expect(WhisperUtils.levelToPercentage(1)).toBe(100);
  });

  it("should return correct status description and color", () => {
    expect(typeof WhisperUtils.getWhisperStatusDescription(true, 0.1)).toBe(
      "string"
    );
    expect(typeof WhisperUtils.getWhisperStatusDescription(false, 0.5)).toBe(
      "string"
    );
    expect(typeof WhisperUtils.getWhisperStatusColor(true)).toBe("string");
    expect(typeof WhisperUtils.getWhisperStatusColor(false)).toBe("string");
  });
});
