/**
 * Age Verification Service
 * Implements hybrid age verification for anonymous apps
 */

import {
  AgeVerificationResult,
  AgeVerificationOptions,
  UserInput,
  calculateAge as calculateAgeUtil,
  validateDateOfBirth,
  createUnderageResult,
  createSelfDeclaredResult,
  createDateOfBirthResult,
  getVerificationRequirements,
  needsAdditionalVerification,
  getSuggestedVerificationMethods,
  getMissingDateOfBirthError,
} from "../utils/ageVerificationUtils";

export type {
  AgeVerificationResult,
  AgeVerificationOptions,
  UserInput,
} from "../utils/ageVerificationUtils";

export class AgeVerificationService {
  /**
   * Verify user age using date of birth by default
   */
  static async verifyAge(
    userInput: UserInput,
    options: AgeVerificationOptions = {}
  ): Promise<AgeVerificationResult> {
    const {
      strictMode = false,
      allowAnonymous = false,
      requirePayment = false,
    } = options;

    // Validate user input (but don't throw for underage - let the verification process handle that)
    if (!userInput.dateOfBirth && !userInput.age) {
      throw new Error("Either date of birth or age must be provided");
    }

    if (!userInput.dateOfBirth && !allowAnonymous) {
      throw new Error(
        "Date of birth is required when anonymous verification is not allowed"
      );
    }

    // Step 1: Require date of birth by default
    if (!userInput.dateOfBirth) {
      if (allowAnonymous && userInput.age !== undefined) {
        // Fallback: allow self-declared age ONLY if explicitly allowed
        return createSelfDeclaredResult(userInput.age, strictMode);
      } else {
        // No date of birth and not allowed to fallback
        throw new Error(getMissingDateOfBirthError());
      }
    }

    // Step 2: Calculate age from date of birth
    const calculatedAge = calculateAgeUtil(userInput.dateOfBirth);
    if (calculatedAge < 13) {
      // Using hardcoded value for now, could be made configurable
      return createUnderageResult(calculatedAge, "date_of_birth");
    }

    // Step 3: Create result for date of birth verification
    return createDateOfBirthResult(
      calculatedAge,
      strictMode,
      requirePayment,
      !!userInput.creditCardInfo
    );
  }

  /**
   * Calculate age from date of birth
   */
  private static calculateAge(dateOfBirth: Date): number {
    return calculateAgeUtil(dateOfBirth);
  }

  /**
   * Validate date of birth format and reasonableness
   */
  static validateDateOfBirth(dateOfBirth: Date): {
    isValid: boolean;
    reason?: string;
  } {
    return validateDateOfBirth(dateOfBirth);
  }

  /**
   * Get age verification requirements based on app settings
   */
  static getVerificationRequirements(strictMode: boolean = false): {
    required: boolean;
    methods: string[];
    description: string;
  } {
    return getVerificationRequirements(strictMode);
  }

  /**
   * Check if user needs additional verification
   */
  static needsAdditionalVerification(
    verificationResult: AgeVerificationResult,
    strictMode: boolean = false
  ): boolean {
    return needsAdditionalVerification(verificationResult, strictMode);
  }

  /**
   * Get suggested verification methods for additional verification
   */
  static getSuggestedVerificationMethods(
    currentMethod: AgeVerificationResult["verificationMethod"]
  ): string[] {
    return getSuggestedVerificationMethods(currentMethod);
  }
}
