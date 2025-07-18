/**
 * Age Verification Utilities for Whispr
 * Shared utilities for age verification operations
 */

import { AGE_VERIFICATION } from "../constants";

// Types
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

export interface UserInput {
  age?: number;
  dateOfBirth?: Date;
  creditCardInfo?: unknown; // For future credit card verification
}

export interface DateOfBirthValidation {
  isValid: boolean;
  reason?: string;
}

export interface VerificationRequirements {
  required: boolean;
  methods: string[];
  description: string;
}

// Constants
export const MINIMUM_AGE = AGE_VERIFICATION.MINIMUM_AGE;
export const MINOR_AGE = AGE_VERIFICATION.MINOR_AGE;
export const MAXIMUM_REASONABLE_AGE = 120;
export const STRICT_MODE_CONFIDENCE_THRESHOLD = 0.8;
export const SELF_DECLARATION_CONFIDENCE = 0.3;
export const DATE_OF_BIRTH_CONFIDENCE = 0.7;
export const CREDIT_CARD_CONFIDENCE = 0.9;
export const CALCULATED_AGE_CONFIDENCE = 0.9;

/**
 * Calculate age from date of birth
 */
export function calculateAge(dateOfBirth: Date): number {
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
export function validateDateOfBirth(dateOfBirth: Date): DateOfBirthValidation {
  const today = new Date();
  const age = calculateAge(dateOfBirth);

  // Check if date is in the future
  if (dateOfBirth > today) {
    return {
      isValid: false,
      reason: "Date of birth cannot be in the future",
    };
  }

  // Check if age is reasonable (between minimum age and maximum reasonable age)
  if (age < MINIMUM_AGE) {
    return {
      isValid: false,
      reason: `Age must be at least ${MINIMUM_AGE}`,
    };
  }

  if (age > MAXIMUM_REASONABLE_AGE) {
    return { isValid: false, reason: "Age seems unrealistic" };
  }

  return { isValid: true };
}

/**
 * Check if user is under minimum age
 */
export function isUnderMinimumAge(age: number): boolean {
  return age < MINIMUM_AGE;
}

/**
 * Check if user is a minor
 */
export function isMinor(age: number): boolean {
  return age < MINOR_AGE;
}

/**
 * Check if user meets minimum age requirement
 */
export function meetsMinimumAge(age: number): boolean {
  return age >= MINIMUM_AGE;
}

/**
 * Determine verification method based on input and options
 */
export function determineVerificationMethod(
  userInput: UserInput,
  requirePayment: boolean = false
): AgeVerificationResult["verificationMethod"] {
  if (requirePayment && userInput.creditCardInfo) {
    return "credit_card";
  }

  if (userInput.dateOfBirth) {
    return "date_of_birth";
  }

  return "self_declaration";
}

/**
 * Calculate confidence level based on verification method
 */
export function calculateConfidence(
  verificationMethod: AgeVerificationResult["verificationMethod"]
): number {
  switch (verificationMethod) {
    case "credit_card":
      return CREDIT_CARD_CONFIDENCE;
    case "date_of_birth":
      return DATE_OF_BIRTH_CONFIDENCE;
    case "self_declaration":
      return SELF_DECLARATION_CONFIDENCE;
    case "third_party":
      return 0.8; // Third party verification is typically high confidence
    default:
      return 0.5; // Default confidence
  }
}

/**
 * Check if additional verification is required
 */
export function requiresAdditionalVerification(
  confidence: number,
  strictMode: boolean = false
): boolean {
  if (strictMode && confidence < STRICT_MODE_CONFIDENCE_THRESHOLD) {
    return true;
  }
  return false;
}

/**
 * Create age verification result for underage users
 */
export function createUnderageResult(
  age: number,
  verificationMethod: AgeVerificationResult["verificationMethod"] = "date_of_birth"
): AgeVerificationResult {
  return {
    isVerified: false,
    age,
    isMinor: true,
    verificationMethod,
    confidence:
      verificationMethod === "date_of_birth"
        ? CALCULATED_AGE_CONFIDENCE
        : SELF_DECLARATION_CONFIDENCE,
    requiresAdditionalVerification: false,
    reason: `Date of birth indicates age ${age}, which is below the minimum age of ${MINIMUM_AGE}`,
  };
}

/**
 * Create age verification result for self-declared age
 */
export function createSelfDeclaredResult(
  age: number,
  strictMode: boolean = false
): AgeVerificationResult {
  const isUnderage = isUnderMinimumAge(age);

  if (isUnderage) {
    return {
      isVerified: false,
      age,
      isMinor: true,
      verificationMethod: "self_declaration",
      confidence: 0,
      requiresAdditionalVerification: false,
      reason: `Users must be ${MINIMUM_AGE} or older to use this platform`,
    };
  }

  return {
    isVerified: true,
    age,
    isMinor: isMinor(age),
    verificationMethod: "self_declaration",
    confidence: SELF_DECLARATION_CONFIDENCE,
    requiresAdditionalVerification: strictMode,
    reason: strictMode
      ? "Additional verification required for strict mode"
      : undefined,
  };
}

/**
 * Create age verification result for date of birth verification
 */
export function createDateOfBirthResult(
  age: number,
  strictMode: boolean = false,
  requirePayment: boolean = false,
  hasCreditCard: boolean = false
): AgeVerificationResult {
  const userInput: UserInput = {
    dateOfBirth: new Date(),
    creditCardInfo: hasCreditCard ? { cardNumber: "1234" } : undefined,
  };

  const verificationMethod = determineVerificationMethod(
    userInput,
    requirePayment && hasCreditCard
  );

  const confidence = calculateConfidence(verificationMethod);
  const needsAdditionalVerification = requiresAdditionalVerification(
    confidence,
    strictMode
  );

  return {
    isVerified: meetsMinimumAge(age),
    age,
    isMinor: isMinor(age),
    verificationMethod,
    confidence,
    requiresAdditionalVerification: needsAdditionalVerification,
    reason: needsAdditionalVerification
      ? "Additional verification required for strict mode"
      : undefined,
  };
}

/**
 * Get age verification requirements based on app settings
 */
export function getVerificationRequirements(
  strictMode: boolean = false
): VerificationRequirements {
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
export function needsAdditionalVerification(
  verificationResult: AgeVerificationResult,
  strictMode: boolean = false
): boolean {
  if (!verificationResult.isVerified) {
    return false; // Already rejected
  }

  if (
    strictMode &&
    verificationResult.confidence < STRICT_MODE_CONFIDENCE_THRESHOLD
  ) {
    return true;
  }

  return verificationResult.requiresAdditionalVerification;
}

/**
 * Get suggested verification methods for additional verification
 */
export function getSuggestedVerificationMethods(
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

/**
 * Validate user input for age verification
 */
export function validateUserInput(
  userInput: UserInput,
  allowAnonymous: boolean = false
): {
  isValid: boolean;
  reason?: string;
} {
  if (!userInput.dateOfBirth && !userInput.age) {
    return {
      isValid: false,
      reason: "Either date of birth or age must be provided",
    };
  }

  if (!userInput.dateOfBirth && !allowAnonymous) {
    return {
      isValid: false,
      reason:
        "Date of birth is required when anonymous verification is not allowed",
    };
  }

  if (userInput.dateOfBirth) {
    const dobValidation = validateDateOfBirth(userInput.dateOfBirth);
    if (!dobValidation.isValid) {
      return dobValidation;
    }
  }

  if (userInput.age !== undefined) {
    if (userInput.age < 0) {
      return {
        isValid: false,
        reason: "Age cannot be negative",
      };
    }
  }

  return { isValid: true };
}

/**
 * Get error message for missing date of birth
 */
export function getMissingDateOfBirthError(): string {
  return "Date of birth is required for age verification.";
}

/**
 * Get error message for underage users
 */
export function getUnderageError(age: number): string {
  return `Users must be ${MINIMUM_AGE} or older to use this platform. Current age: ${age}`;
}
