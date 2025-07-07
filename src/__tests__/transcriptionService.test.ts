import {
  TranscriptionService,
  TranscriptionOptions,
} from "../services/transcriptionService";
import { AudioConversionService } from "../services/audioConversionService";
import { env } from "../config/environment";
import { API_ENDPOINTS } from "../constants";

jest.mock("../services/audioConversionService", () => ({
  AudioConversionService: {
    validateForTranscription: jest.fn(),
  },
}));

global.fetch = jest.fn();

describe("TranscriptionService", () => {
  const mockApiKey = "test-api-key";
  const mockAudioUrl = "https://example.com/audio.m4a";
  const mockBlob = new Blob(["audio data"], { type: "audio/m4a" });
  const mockTranscriptionResponse = {
    text: "hello world",
    confidence: 0.95,
    language: "en",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (env as any).openai = { apiKey: mockApiKey };
    (
      AudioConversionService.validateForTranscription as jest.Mock
    ).mockResolvedValue({
      isValid: true,
      format: "m4a",
      size: 1024 * 100,
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      blob: jest.fn().mockResolvedValue(mockBlob),
      json: jest.fn().mockResolvedValue({ ...mockTranscriptionResponse }),
      status: 200,
      statusText: "OK",
    });
    // Reset static apiKey
    (TranscriptionService as any).apiKey = null;
  });

  describe("initialize", () => {
    it("should set apiKey from env", () => {
      TranscriptionService.initialize();
      expect((TranscriptionService as any).apiKey).toBe(mockApiKey);
    });
  });

  describe("transcribeAudio", () => {
    it("should throw if not initialized and no apiKey", async () => {
      (env as any).openai.apiKey = null;
      (TranscriptionService as any).apiKey = null;
      await expect(
        TranscriptionService.transcribeAudio(mockAudioUrl)
      ).rejects.toThrow(
        "Transcription service not initialized. Please provide OpenAI API key."
      );
    });

    it("should validate audio and call Whisper API", async () => {
      const result = await TranscriptionService.transcribeAudio(mockAudioUrl);
      expect(
        AudioConversionService.validateForTranscription
      ).toHaveBeenCalledWith(mockAudioUrl);
      expect(global.fetch).toHaveBeenCalledWith(
        API_ENDPOINTS.TRANSCRIPTION,
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockApiKey}`,
          }),
        })
      );
      expect(result).toEqual(mockTranscriptionResponse);
    });

    it("should throw if audio validation fails", async () => {
      (
        AudioConversionService.validateForTranscription as jest.Mock
      ).mockResolvedValue({
        isValid: false,
        error: "Invalid audio",
      });
      await expect(
        TranscriptionService.transcribeAudio(mockAudioUrl)
      ).rejects.toThrow("Failed to transcribe audio");
    });

    it("should throw if Whisper API returns error", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: jest
          .fn()
          .mockResolvedValue({ error: { message: "Invalid file format" } }),
        status: 400,
        statusText: "Bad Request",
      });
      await expect(
        TranscriptionService.transcribeAudio(mockAudioUrl)
      ).rejects.toThrow("Failed to transcribe audio");
    });

    it("should throw generic error if Whisper API fails", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: jest
          .fn()
          .mockResolvedValue({ error: { message: "Other error" } }),
        status: 500,
        statusText: "Internal Server Error",
      });
      await expect(
        TranscriptionService.transcribeAudio(mockAudioUrl)
      ).rejects.toThrow("Failed to transcribe audio");
    });

    it("should handle fetch and blob errors", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));
      await expect(
        TranscriptionService.transcribeAudio(mockAudioUrl)
      ).rejects.toThrow("Failed to transcribe audio");
    });
  });

  describe("transcribeWithRetry", () => {
    it("should retry on failure and eventually succeed", async () => {
      const failOnce = jest
        .fn()
        .mockRejectedValueOnce(new Error("fail"))
        .mockResolvedValueOnce(mockTranscriptionResponse);
      TranscriptionService.transcribeAudio = failOnce;
      const result = await TranscriptionService.transcribeWithRetry(
        mockAudioUrl
      );
      expect(result).toEqual(mockTranscriptionResponse);
      expect(failOnce).toHaveBeenCalledTimes(2);
    });

    it("should throw last error after max retries", async () => {
      const alwaysFail = jest.fn().mockRejectedValue(new Error("fail always"));
      TranscriptionService.transcribeAudio = alwaysFail;
      await expect(
        TranscriptionService.transcribeWithRetry(mockAudioUrl, {}, 2)
      ).rejects.toThrow("fail always");
      expect(alwaysFail).toHaveBeenCalledTimes(2);
    });
  });

  describe("getMimeTypeForExtension", () => {
    it("should return correct MIME types", () => {
      expect((TranscriptionService as any).getMimeTypeForExtension("mp3")).toBe(
        "audio/mpeg"
      );
      expect((TranscriptionService as any).getMimeTypeForExtension("m4a")).toBe(
        "audio/mp4"
      );
      expect((TranscriptionService as any).getMimeTypeForExtension("wav")).toBe(
        "audio/wav"
      );
      expect((TranscriptionService as any).getMimeTypeForExtension("ogg")).toBe(
        "audio/ogg"
      );
      expect(
        (TranscriptionService as any).getMimeTypeForExtension("unknown")
      ).toBe("audio/mpeg");
    });
  });

  describe("getBestFileExtension", () => {
    it("should use detected format if supported", () => {
      expect(
        (TranscriptionService as any).getBestFileExtension("file.mp3", "mp3")
      ).toBe("mp3");
      expect(
        (TranscriptionService as any).getBestFileExtension("file.m4a", "m4a")
      ).toBe("m4a");
    });
    it("should fallback to mp4 if not supported", () => {
      expect(
        (TranscriptionService as any).getBestFileExtension("file.xyz", "xyz")
      ).toBe("mp4");
    });
    it("should extract extension from URL if detectedFormat is empty", () => {
      expect(
        (TranscriptionService as any).getBestFileExtension("file.wav", "")
      ).toBe("wav");
    });
  });

  describe("extractFileExtension", () => {
    it("should extract extension from URL", () => {
      expect(
        (TranscriptionService as any).extractFileExtension("file.mp3")
      ).toBe("mp3");
      expect(
        (TranscriptionService as any).extractFileExtension("file.m4a?token=abc")
      ).toBe("m4a");
      expect((TranscriptionService as any).extractFileExtension("file")).toBe(
        "file"
      );
    });
    it("should return empty string on error", () => {
      expect((TranscriptionService as any).extractFileExtension(null)).toBe("");
    });
  });

  describe("downloadAudioFile", () => {
    it("should download and return blob", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        blob: jest.fn().mockResolvedValue(mockBlob),
      });
      const result = await (TranscriptionService as any).downloadAudioFile(
        mockAudioUrl
      );
      expect(result).toBe(mockBlob);
    });
    it("should throw if fetch fails", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("fail"));
      await expect(
        (TranscriptionService as any).downloadAudioFile(mockAudioUrl)
      ).rejects.toThrow("Failed to download audio file");
    });
    it("should throw if response not ok", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        statusText: "Not Found",
      });
      await expect(
        (TranscriptionService as any).downloadAudioFile(mockAudioUrl)
      ).rejects.toThrow("Failed to download audio file");
    });
  });

  describe("delay", () => {
    it("should resolve after given ms", async () => {
      const start = Date.now();
      await (TranscriptionService as any).delay(10);
      expect(Date.now() - start).toBeGreaterThanOrEqual(5);
    });
  });

  describe("validateAudioForTranscription", () => {
    it("should return true if valid", async () => {
      (
        AudioConversionService.validateForTranscription as jest.Mock
      ).mockResolvedValue({ isValid: true });
      const result = await TranscriptionService.validateAudioForTranscription(
        mockAudioUrl
      );
      expect(result).toBe(true);
    });
    it("should return false if not valid", async () => {
      (
        AudioConversionService.validateForTranscription as jest.Mock
      ).mockResolvedValue({ isValid: false });
      const result = await TranscriptionService.validateAudioForTranscription(
        mockAudioUrl
      );
      expect(result).toBe(false);
    });
  });

  describe("getSupportedLanguages", () => {
    it("should return array of languages", () => {
      const langs = TranscriptionService.getSupportedLanguages();
      expect(Array.isArray(langs)).toBe(true);
      expect(langs).toContain("en");
      expect(langs.length).toBeGreaterThan(10);
    });
  });

  describe("detectLanguage", () => {
    it("should return language from transcription", async () => {
      TranscriptionService.transcribeAudio = jest
        .fn()
        .mockResolvedValue({ ...mockTranscriptionResponse, language: "es" });
      const lang = await TranscriptionService.detectLanguage(mockAudioUrl);
      expect(lang).toBe("es");
    });
    it("should return en on error", async () => {
      TranscriptionService.transcribeAudio = jest
        .fn()
        .mockRejectedValue(new Error("fail"));
      const lang = await TranscriptionService.detectLanguage(mockAudioUrl);
      expect(lang).toBe("en");
    });
  });

  describe("isAvailable", () => {
    it("should return true if apiKey is set", () => {
      (TranscriptionService as any).apiKey = "abc";
      expect(TranscriptionService.isAvailable()).toBe(true);
    });
    it("should return true if env apiKey is set", () => {
      (TranscriptionService as any).apiKey = null;
      (env as any).openai.apiKey = "def";
      expect(TranscriptionService.isAvailable()).toBe(true);
    });
    it("should return false if no apiKey", () => {
      (TranscriptionService as any).apiKey = null;
      (env as any).openai.apiKey = null;
      expect(TranscriptionService.isAvailable()).toBe(false);
    });
  });

  describe("estimateCost", () => {
    it("should estimate cost correctly", () => {
      expect(TranscriptionService.estimateCost(60)).toBeCloseTo(0.006);
      expect(TranscriptionService.estimateCost(120)).toBeCloseTo(0.012);
    });
  });
});
