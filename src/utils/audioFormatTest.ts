import { AudioConversionService } from "../services/audioConversionService";

/**
 * Test utility to debug audio format issues
 */
export class AudioFormatTest {
  /**
   * Test audio file format and provide detailed information
   */
  static async testAudioFormat(audioUri: string): Promise<{
    isValid: boolean;
    details: {
      uri: string;
      format: string;
      size: number;
      sizeInMB: string;
      extension: string;
      isCompatible: boolean;
    };
    recommendations: string[];
  }> {
    try {
      console.log("🔍 Testing audio format:", audioUri);

      // Get metadata
      const metadata = await AudioConversionService.getAudioMetadata(audioUri);
      const isCompatible = await AudioConversionService.isCompatibleFormat(
        audioUri
      );
      const validation = await AudioConversionService.validateForTranscription(
        audioUri
      );

      const details = {
        uri: audioUri,
        format: metadata.extension,
        size: metadata.size,
        sizeInMB: (metadata.size / (1024 * 1024)).toFixed(2),
        extension: metadata.extension,
        isCompatible,
      };

      const recommendations: string[] = [];

      if (!isCompatible) {
        recommendations.push("❌ Format not compatible with Whisper API");
        recommendations.push("💡 Try recording with a different audio format");
      }

      if (metadata.size > 25 * 1024 * 1024) {
        recommendations.push("❌ File too large (max 25MB)");
        recommendations.push("💡 Try recording a shorter audio clip");
      }

      if (metadata.extension === "m4a") {
        recommendations.push(
          "⚠️ M4A format can be problematic with Whisper API"
        );
        recommendations.push("💡 The app will try to convert it to MP4");
      }

      if (recommendations.length === 0) {
        recommendations.push("✅ Audio format looks good!");
      }

      console.log("📊 Audio format test results:", {
        details,
        isValid: validation.isValid,
        recommendations,
      });

      return {
        isValid: validation.isValid,
        details,
        recommendations,
      };
    } catch (error) {
      console.error("❌ Error testing audio format:", error);
      return {
        isValid: false,
        details: {
          uri: audioUri,
          format: "unknown",
          size: 0,
          sizeInMB: "0",
          extension: "unknown",
          isCompatible: false,
        },
        recommendations: ["❌ Error analyzing audio file"],
      };
    }
  }

  /**
   * Log detailed information about an audio file
   */
  static async logAudioInfo(audioUri: string): Promise<void> {
    const result = await this.testAudioFormat(audioUri);

    console.log("🎵 Audio File Analysis:");
    console.log("  URI:", result.details.uri);
    console.log("  Format:", result.details.format);
    console.log("  Size:", result.details.sizeInMB, "MB");
    console.log("  Compatible:", result.details.isCompatible ? "✅" : "❌");
    console.log("  Valid for transcription:", result.isValid ? "✅" : "❌");

    if (result.recommendations.length > 0) {
      console.log("  Recommendations:");
      result.recommendations.forEach((rec) => console.log("    ", rec));
    }
  }
}

export default AudioFormatTest;
