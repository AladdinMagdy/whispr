import { AudioConversionService } from "./audioConversionService";
import { extractFileExtension } from "../utils/fileUtils";

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

export class TranscriptionService {
  private static apiKey: string | null = null;

  /**
   * Initialize the transcription service with API key
   */
  static initialize(): void {
    // Initialize with API key from environment
    this.apiKey = process.env.OPENAI_API_KEY || null;
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

      // Add optional parameters
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

      // Make the API request
      const response = await fetch(
        "https://api.openai.com/v1/audio/transcriptions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Transcription failed: ${response.status} ${
            response.statusText
          } - ${JSON.stringify(errorData)}`
        );
      }

      const result = await response.json();

      // Handle different response formats
      if (options.responseFormat === "verbose_json") {
        return {
          text: result.text,
          language: result.language,
        };
      } else {
        return {
          text: result.text || result,
        };
      }
    } catch (error) {
      console.error("Error transcribing audio:", error);
      throw error;
    }
  }

  /**
   * Get MIME type for file extension
   */
  private static getMimeTypeForExtension(extension: string): string {
    const mimeTypes: { [key: string]: string } = {
      mp3: "audio/mpeg",
      wav: "audio/wav",
      m4a: "audio/mp4",
      mp4: "audio/mp4",
      flac: "audio/flac",
      ogg: "audio/ogg",
      webm: "audio/webm",
    };

    return mimeTypes[extension.toLowerCase()] || "audio/mpeg";
  }

  /**
   * Get best file extension for Whisper API
   */
  private static getBestFileExtension(
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
    return !!(this.apiKey || process.env.OPENAI_API_KEY);
  }

  /**
   * Estimate cost for transcription (approximate)
   */
  static estimateCost(audioDurationSeconds: number): number {
    // Whisper API pricing: $0.006 per minute
    const costPerMinute = 0.006;
    const durationMinutes = audioDurationSeconds / 60;
    return durationMinutes * costPerMinute;
  }
}

export default TranscriptionService;
