import { TranscriptionResponse } from "@/types";
import { API_ENDPOINTS } from "@/constants";
import { env } from "@/config/environment";
import { AudioConversionService } from "./audioConversionService";

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
  static initialize(): void {
    this.apiKey = env.openai.apiKey;
  }

  /**
   * Transcribe audio file using OpenAI Whisper API
   */
  static async transcribeAudio(
    audioUrl: string,
    options: TranscriptionOptions = {}
  ): Promise<TranscriptionResponse> {
    if (!this.apiKey) {
      this.initialize(); // Try to initialize if not already done
    }

    if (!this.apiKey) {
      throw new Error(
        "Transcription service not initialized. Please provide OpenAI API key."
      );
    }

    try {
      // Validate audio file first
      const validation = await AudioConversionService.validateForTranscription(
        audioUrl
      );
      if (!validation.isValid) {
        throw new Error(validation.error || "Invalid audio file");
      }

      const isHttpUrl =
        audioUrl.startsWith("http://") || audioUrl.startsWith("https://");
      const sizeInfo = isHttpUrl
        ? "unknown (HTTP URL)"
        : `${(validation.size / 1024).toFixed(2)}KB`;

      console.log(
        `Transcribing audio: ${validation.format} format, ${sizeInfo}`
      );

      // Download the audio file
      const audioBlob = await this.downloadAudioFile(audioUrl);

      // Log blob details for debugging
      console.log("Audio blob details:", {
        size: audioBlob.size,
        type: audioBlob.type,
      });

      // Determine the best file extension for the Whisper API
      const fileExtension = this.getBestFileExtension(
        audioUrl,
        validation.format
      );
      console.log(`Using file extension: ${fileExtension} for Whisper API`);

      // Create form data with proper MIME type
      const formData = new FormData();

      // Try to set the correct MIME type based on the extension
      const mimeType = this.getMimeTypeForExtension(fileExtension);
      console.log(`Using MIME type: ${mimeType}`);

      // Create a new blob with the correct MIME type
      const audioBlobWithMimeType = new Blob([audioBlob], { type: mimeType });

      formData.append("file", audioBlobWithMimeType, `audio.${fileExtension}`);
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

      console.log("Sending request to Whisper API...");

      // Make API request
      const response = await fetch(API_ENDPOINTS.TRANSCRIPTION, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: formData,
      });

      console.log("response", response);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || response.statusText;

        console.error("Whisper API error:", {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        });

        // Handle specific format errors
        if (errorMessage.includes("Invalid file format")) {
          console.warn(
            `Audio format ${fileExtension} not supported by Whisper API`
          );
          throw new Error(
            `Audio format not supported. Please try recording again with a different format.`
          );
        }

        throw new Error(`Transcription failed: ${errorMessage}`);
      }

      const result = await response.json();
      console.log("Whisper API response:", result);

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
   * Get MIME type for file extension
   */
  private static getMimeTypeForExtension(extension: string): string {
    const mimeTypes: Record<string, string> = {
      mp3: "audio/mpeg",
      m4a: "audio/mp4",
      wav: "audio/wav",
      mp4: "audio/mp4",
      webm: "audio/webm",
      flac: "audio/flac",
      ogg: "audio/ogg",
      oga: "audio/ogg",
    };

    return mimeTypes[extension] || "audio/mpeg";
  }

  /**
   * Get the best file extension for Whisper API based on the original format
   */
  private static getBestFileExtension(
    originalUrl: string,
    detectedFormat: string
  ): string {
    // Use the detected format directly - Whisper API supports m4a
    const format =
      detectedFormat || this.extractFileExtension(originalUrl) || "mp4";

    // Whisper API supported formats: ['flac', 'm4a', 'mp3', 'mp4', 'mpeg', 'mpga', 'oga', 'ogg', 'wav', 'webm']
    const supportedFormats = [
      "flac",
      "m4a",
      "mp3",
      "mp4",
      "mpeg",
      "mpga",
      "oga",
      "ogg",
      "wav",
      "webm",
    ];

    // If the detected format is supported, use it directly
    if (supportedFormats.includes(format)) {
      return format;
    }

    // Fallback to mp4 for unsupported formats
    return "mp4";
  }

  /**
   * Extract file extension from URL, handling query parameters
   */
  private static extractFileExtension(url: string): string {
    try {
      // Remove query parameters first
      const urlWithoutQuery = url.split("?")[0];

      // Get the file extension
      const extension = urlWithoutQuery.split(".").pop()?.toLowerCase();

      return extension || "";
    } catch (error) {
      console.error("Error extracting file extension:", error);
      return "";
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
    return AudioConversionService.validateForTranscription(audioUrl).then(
      (result) => result.isValid
    );
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
   * Detect language of audio file
   */
  static async detectLanguage(audioUrl: string): Promise<string> {
    try {
      const result = await this.transcribeAudio(audioUrl, {
        responseFormat: "verbose_json",
      });
      return result.language;
    } catch (error) {
      console.error("Error detecting language:", error);
      return "en"; // Default to English
    }
  }

  /**
   * Check if transcription service is available
   */
  static isAvailable(): boolean {
    return !!this.apiKey || !!env.openai.apiKey;
  }

  /**
   * Estimate transcription cost
   */
  static estimateCost(audioDurationSeconds: number): number {
    // Whisper API pricing: $0.006 per minute
    const costPerMinute = 0.006;
    const durationMinutes = audioDurationSeconds / 60;
    return durationMinutes * costPerMinute;
  }
}

export default TranscriptionService;
