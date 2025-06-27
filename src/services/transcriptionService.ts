import { TranscriptionResponse } from "@/types";
import { API_ENDPOINTS } from "@/constants";

export interface TranscriptionOptions {
  language?: string;
  prompt?: string;
  responseFormat?: "json" | "text" | "srt" | "verbose_json" | "vtt";
  temperature?: number;
}

export class TranscriptionService {
  private static apiKey: string | null = null;

  /**
   * Initialize the transcription service with API key
   */
  static initialize(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /**
   * Transcribe audio file using OpenAI Whisper API
   */
  static async transcribeAudio(
    audioUrl: string,
    options: TranscriptionOptions = {}
  ): Promise<TranscriptionResponse> {
    if (!this.apiKey) {
      throw new Error(
        "Transcription service not initialized. Please provide OpenAI API key."
      );
    }

    try {
      // Download the audio file
      const audioBlob = await this.downloadAudioFile(audioUrl);

      // Create form data
      const formData = new FormData();
      formData.append("file", audioBlob, "audio.m4a");
      formData.append("model", "whisper-1");

      if (options.language) {
        formData.append("language", options.language);
      }

      if (options.prompt) {
        formData.append("prompt", options.prompt);
      }

      if (options.responseFormat) {
        formData.append("response_format", options.responseFormat);
      }

      if (options.temperature !== undefined) {
        formData.append("temperature", options.temperature.toString());
      }

      // Make API request
      const response = await fetch(API_ENDPOINTS.TRANSCRIPTION, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Transcription failed: ${
            errorData.error?.message || response.statusText
          }`
        );
      }

      const result = await response.json();

      return {
        text: result.text || "",
        confidence: result.confidence || 0,
        language: result.language || "en",
      };
    } catch (error) {
      console.error("Transcription error:", error);
      throw new Error("Failed to transcribe audio");
    }
  }

  /**
   * Transcribe with retry logic
   */
  static async transcribeWithRetry(
    audioUrl: string,
    options: TranscriptionOptions = {},
    maxRetries: number = 3
  ): Promise<TranscriptionResponse> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.transcribeAudio(audioUrl, options);
      } catch (error) {
        lastError = error as Error;
        console.warn(`Transcription attempt ${attempt} failed:`, error);

        if (attempt < maxRetries) {
          // Wait before retrying (exponential backoff)
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }
    }

    throw lastError!;
  }

  /**
   * Download audio file from URL and convert to blob
   */
  private static async downloadAudioFile(audioUrl: string): Promise<Blob> {
    try {
      const response = await fetch(audioUrl);

      if (!response.ok) {
        throw new Error(`Failed to download audio: ${response.statusText}`);
      }

      return await response.blob();
    } catch (error) {
      console.error("Error downloading audio file:", error);
      throw new Error("Failed to download audio file");
    }
  }

  /**
   * Simple delay utility
   */
  private static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Validate audio file before transcription
   */
  static validateAudioForTranscription(audioUrl: string): Promise<boolean> {
    return new Promise((resolve) => {
      fetch(audioUrl, { method: "HEAD" })
        .then((response) => {
          const contentLength = response.headers.get("content-length");
          if (contentLength) {
            const fileSizeMB = parseInt(contentLength) / (1024 * 1024);
            // Whisper API has a 25MB limit
            resolve(fileSizeMB <= 25);
          } else {
            resolve(true);
          }
        })
        .catch(() => {
          resolve(false);
        });
    });
  }

  /**
   * Get supported languages for Whisper
   */
  static getSupportedLanguages(): string[] {
    return [
      "en",
      "zh",
      "de",
      "es",
      "ru",
      "ko",
      "fr",
      "ja",
      "pt",
      "tr",
      "pl",
      "ca",
      "nl",
      "ar",
      "sv",
      "it",
      "id",
      "hi",
      "fi",
      "vi",
      "he",
      "uk",
      "el",
      "ms",
      "cs",
      "ro",
      "da",
      "hu",
      "ta",
      "no",
      "th",
      "ur",
      "hr",
      "bg",
      "lt",
      "la",
      "mi",
      "ml",
      "cy",
      "sk",
      "te",
      "fa",
      "lv",
      "bn",
      "sr",
      "az",
      "sl",
      "kn",
      "et",
      "mk",
      "br",
      "eu",
      "is",
      "hy",
      "ne",
      "mn",
      "bs",
      "kk",
      "sq",
      "sw",
      "gl",
      "mr",
      "pa",
      "si",
      "km",
      "sn",
      "yo",
      "so",
      "af",
      "oc",
      "ka",
      "be",
      "tg",
      "sd",
      "gu",
      "am",
      "yi",
      "lo",
      "uz",
      "fo",
      "ht",
      "ps",
      "tk",
      "nn",
      "mt",
      "sa",
      "lb",
      "my",
      "bo",
      "tl",
      "mg",
      "as",
      "tt",
      "haw",
      "ln",
      "ha",
      "ba",
      "jw",
      "su",
    ];
  }

  /**
   * Detect language from audio (if not specified)
   */
  static async detectLanguage(audioUrl: string): Promise<string> {
    try {
      const result = await this.transcribeAudio(audioUrl, {
        responseFormat: "verbose_json",
      });

      return result.language || "en";
    } catch (error) {
      console.error("Error detecting language:", error);
      return "en"; // Default to English
    }
  }

  /**
   * Check if transcription service is available
   */
  static isAvailable(): boolean {
    return this.apiKey !== null;
  }

  /**
   * Get transcription cost estimate (approximate)
   */
  static estimateCost(audioDurationSeconds: number): number {
    // Whisper API pricing: $0.006 per minute
    const costPerMinute = 0.006;
    const durationMinutes = audioDurationSeconds / 60;
    return durationMinutes * costPerMinute;
  }
}

export default TranscriptionService;
