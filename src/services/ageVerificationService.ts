/**
 * Age Verification Service
 * Implements hybrid age verification for anonymous apps
 */

import { AGE_VERIFICATION } from "../constants";

export interface AgeVerificationResult {
  isVerified: boolean;
  age: number;
  isMinor: boolean;
  verificationMethod:
    | "self_declaration"
    | "date_of_birth"
    | "third_party"
    | "credit_card";
  confidence: number; // 0-1, how confident we are in the age
  requiresAdditionalVerification: boolean;
  reason?: string;
}

export interface AgeVerificationOptions {
  strictMode?: boolean; // If true, requires stronger verification
  allowAnonymous?: boolean; // If true, allows self-declaration (default: false)
  requirePayment?: boolean; // If true, requires credit card verification
}

export class AgeVerificationService {
  private static readonly MINIMUM_AGE = AGE_VERIFICATION.MINIMUM_AGE;
  private static readonly MINOR_AGE = AGE_VERIFICATION.MINOR_AGE;

  /**
   * Verify user age using date of birth by default
   */
  static async verifyAge(
    userInput: {
      age?: number;
      dateOfBirth?: Date;
      creditCardInfo?: unknown; // For future credit card verification
    },
    options: AgeVerificationOptions = {}
  ): Promise<AgeVerificationResult> {
    const {
      strictMode = false,
      allowAnonymous = false,
      requirePayment = false,
    } = options;

    // Step 1: Require date of birth by default
    if (!userInput.dateOfBirth) {
      if (allowAnonymous && userInput.age !== undefined) {
        // Fallback: allow self-declared age ONLY if explicitly allowed
        if (userInput.age < this.MINIMUM_AGE) {
          return {
            isVerified: false,
            age: userInput.age,
            isMinor: true,
            verificationMethod: "self_declaration",
            confidence: 0,
            requiresAdditionalVerification: false,
            reason: `Users must be ${this.MINIMUM_AGE} or older to use this platform`,
          };
        }
        return {
          isVerified: userInput.age >= this.MINIMUM_AGE,
          age: userInput.age,
          isMinor: userInput.age < this.MINOR_AGE,
          verificationMethod: "self_declaration",
          confidence: 0.3,
          requiresAdditionalVerification: strictMode,
          reason: strictMode
            ? "Additional verification required for strict mode"
            : undefined,
        };
      } else {
        // No date of birth and not allowed to fallback
        throw new Error("Date of birth is required for age verification.");
      }
    }

    // Step 2: Calculate age from date of birth
    const calculatedAge = this.calculateAge(userInput.dateOfBirth);
    if (calculatedAge < this.MINIMUM_AGE) {
      return {
        isVerified: false,
        age: calculatedAge,
        isMinor: true,
        verificationMethod: "date_of_birth",
        confidence: 0.9, // High confidence since it's calculated
        requiresAdditionalVerification: false,
        reason: `Date of birth indicates age ${calculatedAge}, which is below the minimum age of ${this.MINIMUM_AGE}`,
      };
    }

    // Step 3: Determine verification method and confidence
    let verificationMethod: AgeVerificationResult["verificationMethod"] =
      "date_of_birth";
    let confidence = 0.7; // Higher confidence with DOB
    let requiresAdditionalVerification = false;

    if (requirePayment && userInput.creditCardInfo) {
      // Future: Implement credit card verification
      verificationMethod = "credit_card";
      confidence = 0.9;
    }

    if (strictMode && confidence < 0.8) {
      requiresAdditionalVerification = true;
    }

    // Step 4: Determine final age and minor status
    const finalAge = calculatedAge;
    const isMinor = finalAge < this.MINOR_AGE;

    return {
      isVerified: finalAge >= this.MINIMUM_AGE,
      age: finalAge,
      isMinor,
      verificationMethod,
      confidence,
      requiresAdditionalVerification,
      reason: requiresAdditionalVerification
        ? "Additional verification required for strict mode"
        : undefined,
    };
  }

  /**
   * Calculate age from date of birth
   */
  private static calculateAge(dateOfBirth: Date): number {
    const today = new Date();
    let age = today.getFullYear() - dateOfBirth.getFullYear();
    const monthDiff = today.getMonth() - dateOfBirth.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())
    ) {
      age--;
    }

    return age;
  }

  /**
   * Validate date of birth format and reasonableness
   */
  static validateDateOfBirth(dateOfBirth: Date): {
    isValid: boolean;
    reason?: string;
  } {
    const today = new Date();
    const age = this.calculateAge(dateOfBirth);

    // Check if date is in the future
    if (dateOfBirth > today) {
      return {
        isValid: false,
        reason: "Date of birth cannot be in the future",
      };
    }

    // Check if age is reasonable (between 13 and 120)
    if (age < this.MINIMUM_AGE) {
      return {
        isValid: false,
        reason: `Age must be at least ${this.MINIMUM_AGE}`,
      };
    }

    if (age > 120) {
      return { isValid: false, reason: "Age seems unrealistic" };
    }

    return { isValid: true };
  }

  /**
   * Get age verification requirements based on app settings
   */
  static getVerificationRequirements(strictMode: boolean = false): {
    required: boolean;
    methods: string[];
    description: string;
  } {
    if (strictMode) {
      return {
        required: true,
        methods: ["date_of_birth", "third_party", "credit_card"],
        description: "Strict mode requires stronger age verification",
      };
    }

    return {
      required: true,
      methods: ["date_of_birth"],
      description: "Date of birth is required for age verification",
    };
  }

  /**
   * Check if user needs additional verification
   */
  static needsAdditionalVerification(
    verificationResult: AgeVerificationResult,
    strictMode: boolean = false
  ): boolean {
    if (!verificationResult.isVerified) {
      return false; // Already rejected
    }

    if (strictMode && verificationResult.confidence < 0.8) {
      return true;
    }

    return verificationResult.requiresAdditionalVerification;
  }

  /**
   * Get suggested verification methods for additional verification
   */
  static getSuggestedVerificationMethods(
    currentMethod: AgeVerificationResult["verificationMethod"]
  ): string[] {
    const suggestions: string[] = [];

    if (currentMethod === "self_declaration") {
      suggestions.push("date_of_birth", "third_party");
    }

    if (currentMethod === "date_of_birth") {
      suggestions.push("third_party", "credit_card");
    }

    return suggestions;
  }
}
