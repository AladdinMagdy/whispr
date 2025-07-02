import {
  WHISPER_VALIDATION,
  WHISPER_COLORS,
  WHISPER_ERROR_MESSAGES,
} from "../constants/whisperValidation";

describe("Whisper Validation Constants", () => {
  describe("WHISPER_VALIDATION", () => {
    test("should have correct default whisper threshold", () => {
      expect(WHISPER_VALIDATION.DEFAULT_WHISPER_THRESHOLD).toBe(0.008);
    });

    test("should have strict validation thresholds", () => {
      expect(WHISPER_VALIDATION.MIN_WHISPER_PERCENTAGE).toBe(0.8);
      expect(WHISPER_VALIDATION.MAX_AVERAGE_LEVEL).toBe(0.015);
      expect(WHISPER_VALIDATION.MAX_LEVEL).toBe(0.025);
      expect(WHISPER_VALIDATION.MAX_LOUD_PERCENTAGE).toBe(0.02);
    });

    test("should have appropriate confidence threshold", () => {
      expect(WHISPER_VALIDATION.MIN_CONFIDENCE).toBe(0.3);
    });

    test("should have strict auto-calibration settings", () => {
      expect(WHISPER_VALIDATION.AUTO_CALIBRATION.MIN_THRESHOLD).toBe(0.005);
      expect(WHISPER_VALIDATION.AUTO_CALIBRATION.MAX_THRESHOLD).toBe(0.015);
      expect(WHISPER_VALIDATION.AUTO_CALIBRATION.CALIBRATION_FACTOR).toBe(0.6);
    });

    test("should have correct audio level ranges", () => {
      expect(WHISPER_VALIDATION.AUDIO_LEVELS.MIN_DB).toBe(-60);
      expect(WHISPER_VALIDATION.AUDIO_LEVELS.MAX_DB).toBe(0);
      expect(WHISPER_VALIDATION.AUDIO_LEVELS.MIN_LEVEL).toBe(0.001);
      expect(WHISPER_VALIDATION.AUDIO_LEVELS.MAX_LEVEL).toBe(1.0);
    });

    test("should have appropriate recording settings", () => {
      expect(WHISPER_VALIDATION.RECORDING.SUBSCRIPTION_DURATION).toBe(0.1);
      expect(WHISPER_VALIDATION.RECORDING.MIN_DURATION).toBe(2);
      expect(WHISPER_VALIDATION.RECORDING.MAX_DURATION).toBe(30);
      expect(WHISPER_VALIDATION.RECORDING.DURATION_TOLERANCE).toBe(0.1);
    });

    test("should have extremely strict threshold buttons", () => {
      expect(WHISPER_VALIDATION.THRESHOLD_BUTTONS.VERY_LOW).toBe(0.005);
      expect(WHISPER_VALIDATION.THRESHOLD_BUTTONS.LOW).toBe(0.008);
      expect(WHISPER_VALIDATION.THRESHOLD_BUTTONS.MEDIUM).toBe(0.012);
      expect(WHISPER_VALIDATION.THRESHOLD_BUTTONS.HIGH).toBe(0.015);
    });
  });

  describe("WHISPER_COLORS", () => {
    test("should have correct color values", () => {
      expect(WHISPER_COLORS.WHISPER).toBe("#4CAF50");
      expect(WHISPER_COLORS.LOUD).toBe("#F44336");
      expect(WHISPER_COLORS.NEUTRAL).toBe("#666");
      expect(WHISPER_COLORS.SUCCESS).toBe("#4CAF50");
      expect(WHISPER_COLORS.WARNING).toBe("#FF9800");
      expect(WHISPER_COLORS.PRIMARY).toBe("#007AFF");
    });
  });

  describe("WHISPER_ERROR_MESSAGES", () => {
    test("should generate correct insufficient whisper message", () => {
      const message = WHISPER_ERROR_MESSAGES.INSUFFICIENT_WHISPER(45.5);
      expect(message).toBe(
        "Only 45.5% was whispered. At least 50% must be whispered."
      );
    });

    test("should generate correct average level too high message", () => {
      const message = WHISPER_ERROR_MESSAGES.AVERAGE_LEVEL_TOO_HIGH(3.2);
      expect(message).toBe(
        "Average audio level (3.2%) is too high. Please whisper more quietly."
      );
    });

    test("should generate correct max level too high message", () => {
      const message = WHISPER_ERROR_MESSAGES.MAX_LEVEL_TOO_HIGH(4.8);
      expect(message).toBe(
        "Maximum audio level (4.8%) was too loud. Please avoid loud sounds."
      );
    });

    test("should generate correct too much loud content message", () => {
      const message = WHISPER_ERROR_MESSAGES.TOO_MUCH_LOUD_CONTENT(8.5);
      expect(message).toBe(
        "8.5% of the recording was too loud. Please whisper more quietly throughout."
      );
    });

    test("should have correct static error messages", () => {
      expect(WHISPER_ERROR_MESSAGES.CONFIDENCE_TOO_LOW).toBe(
        "Whisper confidence is too low"
      );
      expect(WHISPER_ERROR_MESSAGES.DURATION_TOO_SHORT).toBe(
        "Recording must be at least 2 seconds long"
      );
      expect(WHISPER_ERROR_MESSAGES.DURATION_TOO_LONG).toBe(
        "Recording must be no longer than 30 seconds"
      );
    });
  });
});

describe("Whisper Validation Logic", () => {
  describe("Threshold Validation", () => {
    test("should validate extremely low audio levels as whispers", () => {
      const veryLowLevel = 0.001; // 0.1%
      const lowLevel = 0.005; // 0.5%
      const mediumLevel = 0.008; // 0.8%

      expect(veryLowLevel <= WHISPER_VALIDATION.DEFAULT_WHISPER_THRESHOLD).toBe(
        true
      );
      expect(lowLevel <= WHISPER_VALIDATION.DEFAULT_WHISPER_THRESHOLD).toBe(
        true
      );
      expect(mediumLevel <= WHISPER_VALIDATION.DEFAULT_WHISPER_THRESHOLD).toBe(
        true
      );
    });

    test("should reject normal speech levels", () => {
      const normalSpeech = 0.03; // 3%
      const loudSpeech = 0.1; // 10%

      expect(normalSpeech <= WHISPER_VALIDATION.DEFAULT_WHISPER_THRESHOLD).toBe(
        false
      );
      expect(loudSpeech <= WHISPER_VALIDATION.DEFAULT_WHISPER_THRESHOLD).toBe(
        false
      );
    });

    test("should validate whisper percentage requirements", () => {
      const goodWhisperPercentage = 0.85; // 85%
      const borderlineWhisperPercentage = 0.8; // 80%
      const poorWhisperPercentage = 0.75; // 75%

      expect(
        goodWhisperPercentage >= WHISPER_VALIDATION.MIN_WHISPER_PERCENTAGE
      ).toBe(true);
      expect(
        borderlineWhisperPercentage >= WHISPER_VALIDATION.MIN_WHISPER_PERCENTAGE
      ).toBe(true);
      expect(
        poorWhisperPercentage >= WHISPER_VALIDATION.MIN_WHISPER_PERCENTAGE
      ).toBe(false);
    });

    test("should validate average level requirements", () => {
      const goodAverageLevel = 0.01; // 1%
      const borderlineAverageLevel = 0.015; // 1.5%
      const poorAverageLevel = 0.02; // 2%

      expect(goodAverageLevel <= WHISPER_VALIDATION.MAX_AVERAGE_LEVEL).toBe(
        true
      );
      expect(
        borderlineAverageLevel <= WHISPER_VALIDATION.MAX_AVERAGE_LEVEL
      ).toBe(true);
      expect(poorAverageLevel <= WHISPER_VALIDATION.MAX_AVERAGE_LEVEL).toBe(
        false
      );
    });

    test("should validate max level requirements", () => {
      const goodMaxLevel = 0.02; // 2%
      const borderlineMaxLevel = 0.025; // 2.5%
      const poorMaxLevel = 0.03; // 3%

      expect(goodMaxLevel <= WHISPER_VALIDATION.MAX_LEVEL).toBe(true);
      expect(borderlineMaxLevel <= WHISPER_VALIDATION.MAX_LEVEL).toBe(true);
      expect(poorMaxLevel <= WHISPER_VALIDATION.MAX_LEVEL).toBe(false);
    });

    test("should validate loud percentage requirements", () => {
      const goodLoudPercentage = 0.01; // 1%
      const borderlineLoudPercentage = 0.02; // 2%
      const poorLoudPercentage = 0.03; // 3%

      expect(goodLoudPercentage <= WHISPER_VALIDATION.MAX_LOUD_PERCENTAGE).toBe(
        true
      );
      expect(
        borderlineLoudPercentage <= WHISPER_VALIDATION.MAX_LOUD_PERCENTAGE
      ).toBe(true);
      expect(poorLoudPercentage <= WHISPER_VALIDATION.MAX_LOUD_PERCENTAGE).toBe(
        false
      );
    });
  });

  describe("Audio Level Conversion", () => {
    test("should convert decibel values correctly", () => {
      // Test decibel to linear conversion
      const minDb = WHISPER_VALIDATION.AUDIO_LEVELS.MIN_DB; // -60 dB
      const maxDb = WHISPER_VALIDATION.AUDIO_LEVELS.MAX_DB; // 0 dB

      // Convert using the same formula as in recordingService
      const minLinear = Math.pow(10, minDb / 20);
      const maxLinear = Math.pow(10, maxDb / 20);

      expect(minLinear).toBeCloseTo(0.001, 3); // Should be very close to 0.001
      expect(maxLinear).toBe(1); // Should be exactly 1
    });

    test("should handle edge cases in audio level conversion", () => {
      const silenceDb = -60; // Very quiet
      const whisperDb = -40; // Whisper level
      const normalDb = -20; // Normal speech

      const silenceLinear = Math.pow(10, silenceDb / 20);
      const whisperLinear = Math.pow(10, whisperDb / 20);
      const normalLinear = Math.pow(10, normalDb / 20);

      expect(silenceLinear).toBeCloseTo(0.001, 3);
      expect(whisperLinear).toBeCloseTo(0.01, 2);
      expect(normalLinear).toBeCloseTo(0.1, 1);
    });
  });

  describe("Threshold Button Validation", () => {
    test("should have appropriate threshold button ranges", () => {
      const { THRESHOLD_BUTTONS } = WHISPER_VALIDATION;

      // Verify buttons are in ascending order
      expect(THRESHOLD_BUTTONS.VERY_LOW).toBeLessThan(THRESHOLD_BUTTONS.LOW);
      expect(THRESHOLD_BUTTONS.LOW).toBeLessThan(THRESHOLD_BUTTONS.MEDIUM);
      expect(THRESHOLD_BUTTONS.MEDIUM).toBeLessThan(THRESHOLD_BUTTONS.HIGH);

      // Verify all buttons are within reasonable range
      expect(THRESHOLD_BUTTONS.VERY_LOW).toBeGreaterThan(0);
      expect(THRESHOLD_BUTTONS.HIGH).toBeLessThan(0.1); // Less than 10%
    });

    test("should validate threshold button values against default threshold", () => {
      const { DEFAULT_WHISPER_THRESHOLD, THRESHOLD_BUTTONS } =
        WHISPER_VALIDATION;

      // Default should be between LOW and MEDIUM
      expect(THRESHOLD_BUTTONS.LOW).toBeLessThanOrEqual(
        DEFAULT_WHISPER_THRESHOLD
      );
      expect(DEFAULT_WHISPER_THRESHOLD).toBeLessThanOrEqual(
        THRESHOLD_BUTTONS.MEDIUM
      );
    });
  });

  describe("Duration Validation with Tolerance", () => {
    test("should validate duration tolerance constant", () => {
      const { RECORDING } = WHISPER_VALIDATION;

      expect(RECORDING.DURATION_TOLERANCE).toBe(0.1);
      expect(RECORDING.DURATION_TOLERANCE).toBeGreaterThan(0);
      expect(RECORDING.DURATION_TOLERANCE).toBeLessThan(1); // Should be less than 1 second
    });

    test("should calculate max duration with tolerance correctly", () => {
      const { RECORDING } = WHISPER_VALIDATION;
      const maxWithTolerance =
        RECORDING.MAX_DURATION + RECORDING.DURATION_TOLERANCE;

      expect(maxWithTolerance).toBe(30.1);
      expect(maxWithTolerance).toBeGreaterThan(RECORDING.MAX_DURATION);
    });

    test("should validate acceptable duration ranges", () => {
      const { RECORDING } = WHISPER_VALIDATION;
      const maxWithTolerance =
        RECORDING.MAX_DURATION + RECORDING.DURATION_TOLERANCE;

      // Test minimum duration
      expect(2).toBeGreaterThanOrEqual(RECORDING.MIN_DURATION);
      expect(1.9).toBeLessThan(RECORDING.MIN_DURATION); // Should be rejected

      // Test maximum duration with tolerance
      expect(30).toBeLessThanOrEqual(maxWithTolerance); // Exactly 30s should be allowed
      expect(30.05).toBeLessThanOrEqual(maxWithTolerance); // Slightly over 30s should be allowed
      expect(30.1).toBeLessThanOrEqual(maxWithTolerance); // At tolerance limit should be allowed
      expect(30.2).toBeGreaterThan(maxWithTolerance); // Over tolerance should be rejected
    });

    test("should handle edge cases in duration validation", () => {
      const { RECORDING } = WHISPER_VALIDATION;
      const maxWithTolerance =
        RECORDING.MAX_DURATION + RECORDING.DURATION_TOLERANCE;

      // Edge cases around the tolerance boundary
      expect(29.9).toBeLessThan(maxWithTolerance); // Just under max
      expect(30.0).toBeLessThanOrEqual(maxWithTolerance); // Exactly at max
      expect(30.1).toBeLessThanOrEqual(maxWithTolerance); // Exactly at tolerance limit
      expect(30.11).toBeGreaterThan(maxWithTolerance); // Just over tolerance limit
    });

    test("should validate duration tolerance is reasonable", () => {
      const { RECORDING } = WHISPER_VALIDATION;

      // Tolerance should be small but not zero
      expect(RECORDING.DURATION_TOLERANCE).toBeGreaterThan(0);
      expect(RECORDING.DURATION_TOLERANCE).toBeLessThan(0.5); // Should be less than half a second

      // Tolerance should be a reasonable percentage of max duration
      const tolerancePercentage =
        RECORDING.DURATION_TOLERANCE / RECORDING.MAX_DURATION;
      expect(tolerancePercentage).toBeLessThan(0.01); // Less than 1% of max duration
    });
  });
});
