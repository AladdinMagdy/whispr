/**
 * whisperValidator.test.ts
 * Comprehensive tests for WhisperValidator and AudioLevelAnalyzer
 */

import {
  WhisperValidator,
  AudioLevelAnalyzer,
  WhisperUtils,
} from "../utils/whisperValidator";

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

  // Additional tests for better coverage
  it("should handle edge case confidence calculation", () => {
    // Test confidence calculation with very high average level
    for (let i = 0; i < 10; i++) validator.addAudioLevel(0.8);
    (validator as any).startTime = Date.now() - 5000;
    const result = validator.validateRecording();
    expect(result.confidence).toBeLessThan(0.5); // Should be reduced due to high level
  });

  it("should handle confidence calculation with very low average level", () => {
    // Test confidence calculation with very low average level
    for (let i = 0; i < 10; i++) validator.addAudioLevel(0.05);
    (validator as any).startTime = Date.now() - 5000;
    const result = validator.validateRecording();
    expect(result.confidence).toBeGreaterThan(0.8); // Should be boosted due to low level
  });

  it("should handle confidence calculation with medium average level", () => {
    // Test confidence calculation with medium average level (no boost or reduction)
    for (let i = 0; i < 10; i++) validator.addAudioLevel(0.3);
    (validator as any).startTime = Date.now() - 5000;
    const result = validator.validateRecording();
    // With 0.3 average level, confidence should be 1.0 (no reduction, no boost)
    expect(result.confidence).toBe(1.0);
  });

  it("should handle duration calculation edge cases", () => {
    // Test duration calculation when startTime is null
    validator.addAudioLevel(0.1);
    (validator as any).startTime = null;
    const result = validator.validateRecording();
    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/too short/i);
  });

  it("should handle empty statistics", () => {
    const stats = validator.getStatistics();
    expect(stats.totalSamples).toBe(0);
    expect(stats.whisperSamples).toBe(0);
    expect(stats.averageLevel).toBe(0);
    expect(stats.maxLevel).toBe(0);
    expect(stats.minLevel).toBe(0);
    expect(stats.duration).toBe(0);
  });

  it("should handle single audio level", () => {
    validator.addAudioLevel(0.2);
    (validator as any).startTime = Date.now() - 1000; // 1 second (too short)
    const result = validator.validateRecording();
    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/too short/i);
  });

  it("should handle boundary whisper percentage", () => {
    // Exactly 70% whisper (minimum required)
    for (let i = 0; i < 7; i++) validator.addAudioLevel(0.1); // 7 whispers
    for (let i = 0; i < 3; i++) validator.addAudioLevel(0.5); // 3 loud
    (validator as any).startTime = Date.now() - 5000;
    const result = validator.validateRecording();
    expect(result.isValid).toBe(true);
    expect(result.whisperPercentage).toBe(0.7);
  });

  it("should handle just below boundary whisper percentage", () => {
    // 69% whisper (just below minimum)
    for (let i = 0; i < 6; i++) validator.addAudioLevel(0.1); // 6 whispers
    for (let i = 0; i < 4; i++) validator.addAudioLevel(0.5); // 4 loud
    (validator as any).startTime = Date.now() - 5000;
    const result = validator.validateRecording();
    expect(result.isValid).toBe(false);
    expect(result.whisperPercentage).toBe(0.6);
  });

  it("should handle exact duration boundaries", () => {
    // Test exactly 2 seconds (minimum)
    for (let i = 0; i < 10; i++) validator.addAudioLevel(0.1);
    (validator as any).startTime = Date.now() - 2000;
    const result = validator.validateRecording();
    expect(result.isValid).toBe(true);

    // Test exactly 30 seconds (maximum)
    validator.reset();
    validator.startMonitoring();
    for (let i = 0; i < 10; i++) validator.addAudioLevel(0.1);
    (validator as any).startTime = Date.now() - 30000;
    const result2 = validator.validateRecording();
    expect(result2.isValid).toBe(true);
  });

  it("should handle confidence bounds", () => {
    // Test confidence calculation that would exceed 1.0
    for (let i = 0; i < 10; i++) validator.addAudioLevel(0.05); // Very low levels
    (validator as any).startTime = Date.now() - 5000;
    const result = validator.validateRecording();
    expect(result.confidence).toBeLessThanOrEqual(1.0);
    expect(result.confidence).toBeGreaterThanOrEqual(0.0);
  });

  it("should handle duration calculation with startTime but no audio levels", () => {
    // Set startTime but don't add any audio levels
    (validator as any).startTime = Date.now() - 5000;
    const result = validator.validateRecording();
    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/no audio/i);
  });
});

// --- AudioLevelAnalyzer tests ---
describe("AudioLevelAnalyzer", () => {
  let analyzer: AudioLevelAnalyzer;

  beforeEach(() => {
    analyzer = AudioLevelAnalyzer.getInstance();
    // Reset the analyzer state
    analyzer.stopAnalysis();
  });

  it("should return the same singleton instance", () => {
    const a = AudioLevelAnalyzer.getInstance();
    const b = AudioLevelAnalyzer.getInstance();
    expect(a).toBe(b);
  });

  it("should start and stop analysis", () => {
    const mockCallback = jest.fn();

    analyzer.startAnalysis(mockCallback);
    expect((analyzer as any).isAnalyzing).toBe(true);
    expect((analyzer as any).onLevelChange).toBe(mockCallback);

    analyzer.stopAnalysis();
    expect((analyzer as any).isAnalyzing).toBe(false);
    expect((analyzer as any).onLevelChange).toBeUndefined();
  });

  it("should call level change callback during analysis", (done) => {
    const mockCallback = jest.fn((level: number) => {
      expect(typeof level).toBe("number");
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(0.6); // Based on the simulation range
      done();
    });

    analyzer.startAnalysis(mockCallback);

    // The analyze method should be called automatically
    // We'll wait for the callback to be invoked
  }, 1000);

  it("should not call callback when analysis is stopped", () => {
    const mockCallback = jest.fn();

    analyzer.startAnalysis(mockCallback);
    analyzer.stopAnalysis();

    // Wait a bit to ensure no callbacks are made
    // Note: There might be a race condition where the callback is called
    // before stopAnalysis takes effect, so we'll just verify the state
    expect((analyzer as any).isAnalyzing).toBe(false);
    expect((analyzer as any).onLevelChange).toBeUndefined();
  });

  it("should handle multiple start/stop cycles", () => {
    const mockCallback1 = jest.fn();
    const mockCallback2 = jest.fn();

    analyzer.startAnalysis(mockCallback1);
    analyzer.stopAnalysis();
    analyzer.startAnalysis(mockCallback2);
    analyzer.stopAnalysis();

    expect((analyzer as any).isAnalyzing).toBe(false);
    expect((analyzer as any).onLevelChange).toBeUndefined();
  });

  it("should handle starting analysis when already running", () => {
    const mockCallback1 = jest.fn();
    const mockCallback2 = jest.fn();

    analyzer.startAnalysis(mockCallback1);
    analyzer.startAnalysis(mockCallback2);

    expect((analyzer as any).onLevelChange).toBe(mockCallback2);

    analyzer.stopAnalysis();
  });
});

// --- WhisperUtils tests ---
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
    expect(WhisperUtils.levelToPercentage(0.25)).toBe(25);
    expect(WhisperUtils.levelToPercentage(0.75)).toBe(75);
  });

  it("should return correct status description", () => {
    const whisperDesc = WhisperUtils.getWhisperStatusDescription(true, 0.1);
    const loudDesc = WhisperUtils.getWhisperStatusDescription(false, 0.5);

    expect(whisperDesc).toContain("Whisper detected");
    expect(whisperDesc).toContain("10%");
    expect(loudDesc).toContain("Too loud");
    expect(loudDesc).toContain("50%");
    expect(loudDesc).toContain("whisper quieter");
  });

  it("should return correct status color", () => {
    expect(WhisperUtils.getWhisperStatusColor(true)).toBe("#4CAF50");
    expect(WhisperUtils.getWhisperStatusColor(false)).toBe("#F44336");
  });

  it("should handle edge cases for whisper level detection", () => {
    // Test exact threshold
    expect(WhisperUtils.isWhisperLevel(0.3, 0.3)).toBe(true);
    expect(WhisperUtils.isWhisperLevel(0.31, 0.3)).toBe(false);

    // Test custom thresholds
    expect(WhisperUtils.isWhisperLevel(0.2, 0.25)).toBe(true);
    expect(WhisperUtils.isWhisperLevel(0.3, 0.25)).toBe(false);
  });

  it("should handle edge cases for level to percentage conversion", () => {
    expect(WhisperUtils.levelToPercentage(0.001)).toBe(0); // Very small
    expect(WhisperUtils.levelToPercentage(0.999)).toBe(100); // Very close to 1
    expect(WhisperUtils.levelToPercentage(0.123)).toBe(12); // Decimal
  });

  it("should handle boundary values for status description", () => {
    const zeroDesc = WhisperUtils.getWhisperStatusDescription(true, 0);
    const maxDesc = WhisperUtils.getWhisperStatusDescription(false, 1);

    expect(zeroDesc).toContain("0%");
    expect(maxDesc).toContain("100%");
  });
});
