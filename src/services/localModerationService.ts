/**
 * Local Moderation Service
 * Provides free keyword filtering and basic content analysis
 * This runs before paid APIs to reduce costs and improve response time
 */

import { LocalModerationResult } from "../types";
import {
  checkKeywordViolations,
  createLocalModerationResult,
  shouldRejectImmediately,
  getModerationSummary,
  validateTextInput,
} from "../utils/localModerationUtils";

export class LocalModerationService {
  /**
   * Check text for violations using local keyword filtering
   */
  static async checkKeywords(text: string): Promise<LocalModerationResult> {
    // Validate input
    const validation = validateTextInput(text);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    // Check for keyword violations
    const { violations, matchedKeywords } = checkKeywordViolations(text);

    // Create and return the moderation result
    return createLocalModerationResult(violations, matchedKeywords, text);
  }

  /**
   * Check if text should be rejected immediately (before API calls)
   */
  static async shouldRejectImmediately(text: string): Promise<boolean> {
    const result = await this.checkKeywords(text);
    return shouldRejectImmediately(result);
  }

  /**
   * Get moderation summary for logging
   */
  static getModerationSummary(result: LocalModerationResult): string {
    return getModerationSummary(result);
  }
}
