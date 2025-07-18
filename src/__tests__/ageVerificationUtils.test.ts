/**
 * Tests for Age Verification Utilities
 */

import {
  calculateAge,
  validateDateOfBirth,
  isUnderMinimumAge,
  isMinor,
  meetsMinimumAge,
  determineVerificationMethod,
  calculateConfidence,
  requiresAdditionalVerification,
  createUnderageResult,
  createSelfDeclaredResult,
  createDateOfBirthResult,
  getVerificationRequirements,
  needsAdditionalVerification,
  getSuggestedVerificationMethods,
  validateUserInput,
  getMissingDateOfBirthError,
  getUnderageError,
  MINIMUM_AGE,
  MINOR_AGE,
  MAXIMUM_REASONABLE_AGE,
  STRICT_MODE_CONFIDENCE_THRESHOLD,
  SELF_DECLARATION_CONFIDENCE,
  DATE_OF_BIRTH_CONFIDENCE,
  CREDIT_CARD_CONFIDENCE,
  type AgeVerificationResult,
  type UserInput,
} from "../utils/ageVerificationUtils";

describe("Age Verification Utilities", () => {
  describe("Constants", () => {
    test("should have correct constants", () => {
      expect(MINIMUM_AGE).toBe(13);
      expect(MINOR_AGE).toBe(18);
      expect(MAXIMUM_REASONABLE_AGE).toBe(120);
      expect(STRICT_MODE_CONFIDENCE_THRESHOLD).toBe(0.8);
      expect(SELF_DECLARATION_CONFIDENCE).toBe(0.3);
      expect(DATE_OF_BIRTH_CONFIDENCE).toBe(0.7);
      expect(CREDIT_CARD_CONFIDENCE).toBe(0.9);
    });
  });

  describe("Age Calculation", () => {
    test("should calculate age correctly", () => {
      const today = new Date();
      const birthDate = new Date(
        today.getFullYear() - 25,
        today.getMonth(),
        today.getDate()
      );
      expect(calculateAge(birthDate)).toBe(25);
    });

    test("should calculate age correctly for birthday not yet passed this year", () => {
      const today = new Date();
      const birthDate = new Date(
        today.getFullYear() - 25,
        today.getMonth() + 1,
        today.getDate()
      );
      expect(calculateAge(birthDate)).toBe(24);
    });

    test("should calculate age correctly for birthday passed this year", () => {
      const today = new Date();
      const birthDate = new Date(
        today.getFullYear() - 25,
        today.getMonth() - 1,
        today.getDate()
      );
      expect(calculateAge(birthDate)).toBe(25);
    });

    test("should calculate age correctly for same month but different day", () => {
      const today = new Date();
      const birthDate = new Date(
        today.getFullYear() - 25,
        today.getMonth(),
        today.getDate() + 1
      );
      expect(calculateAge(birthDate)).toBe(24);
    });
  });

  describe("Date of Birth Validation", () => {
    test("should reject future dates", () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const result = validateDateOfBirth(futureDate);
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe("Date of birth cannot be in the future");
    });

    test("should reject underage users", () => {
      const today = new Date();
      const underageDate = new Date(
        today.getFullYear() - 12,
        today.getMonth(),
        today.getDate()
      );

      const result = validateDateOfBirth(underageDate);
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe("Age must be at least 13");
    });

    test("should reject unrealistic ages", () => {
      const today = new Date();
      const unrealisticDate = new Date(
        today.getFullYear() - 150,
        today.getMonth(),
        today.getDate()
      );

      const result = validateDateOfBirth(unrealisticDate);
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe("Age seems unrealistic");
    });

    test("should accept valid dates", () => {
      const today = new Date();
      const validDate = new Date(
        today.getFullYear() - 25,
        today.getMonth(),
        today.getDate()
      );

      const result = validateDateOfBirth(validDate);
      expect(result.isValid).toBe(true);
    });

    test("should accept minimum age", () => {
      const today = new Date();
      const minimumAgeDate = new Date(
        today.getFullYear() - 13,
        today.getMonth(),
        today.getDate()
      );

      const result = validateDateOfBirth(minimumAgeDate);
      expect(result.isValid).toBe(true);
    });
  });

  describe("Age Checks", () => {
    test("should check if user is under minimum age", () => {
      expect(isUnderMinimumAge(12)).toBe(true);
      expect(isUnderMinimumAge(13)).toBe(false);
      expect(isUnderMinimumAge(25)).toBe(false);
    });

    test("should check if user is a minor", () => {
      expect(isMinor(17)).toBe(true);
      expect(isMinor(18)).toBe(false);
      expect(isMinor(25)).toBe(false);
    });

    test("should check if user meets minimum age", () => {
      expect(meetsMinimumAge(12)).toBe(false);
      expect(meetsMinimumAge(13)).toBe(true);
      expect(meetsMinimumAge(25)).toBe(true);
    });
  });

  describe("Verification Method Determination", () => {
    test("should determine credit card verification method", () => {
      const userInput: UserInput = {
        dateOfBirth: new Date(),
        creditCardInfo: { cardNumber: "1234" },
      };

      const method = determineVerificationMethod(userInput, true);
      expect(method).toBe("credit_card");
    });

    test("should determine date of birth verification method", () => {
      const userInput: UserInput = {
        dateOfBirth: new Date(),
      };

      const method = determineVerificationMethod(userInput);
      expect(method).toBe("date_of_birth");
    });

    test("should determine self declaration verification method", () => {
      const userInput: UserInput = {
        age: 25,
      };

      const method = determineVerificationMethod(userInput);
      expect(method).toBe("self_declaration");
    });
  });

  describe("Confidence Calculation", () => {
    test("should calculate confidence for credit card", () => {
      expect(calculateConfidence("credit_card")).toBe(CREDIT_CARD_CONFIDENCE);
    });

    test("should calculate confidence for date of birth", () => {
      expect(calculateConfidence("date_of_birth")).toBe(
        DATE_OF_BIRTH_CONFIDENCE
      );
    });

    test("should calculate confidence for self declaration", () => {
      expect(calculateConfidence("self_declaration")).toBe(
        SELF_DECLARATION_CONFIDENCE
      );
    });

    test("should calculate confidence for third party", () => {
      expect(calculateConfidence("third_party")).toBe(0.8);
    });

    test("should return default confidence for unknown method", () => {
      expect(calculateConfidence("unknown" as any)).toBe(0.5);
    });
  });

  describe("Additional Verification Requirements", () => {
    test("should require additional verification in strict mode with low confidence", () => {
      expect(requiresAdditionalVerification(0.5, true)).toBe(true);
    });

    test("should not require additional verification in strict mode with high confidence", () => {
      expect(requiresAdditionalVerification(0.9, true)).toBe(false);
    });

    test("should not require additional verification in normal mode", () => {
      expect(requiresAdditionalVerification(0.5, false)).toBe(false);
    });
  });

  describe("Result Creation", () => {
    test("should create underage result", () => {
      const result = createUnderageResult(12, "date_of_birth");

      expect(result.isVerified).toBe(false);
      expect(result.age).toBe(12);
      expect(result.isMinor).toBe(true);
      expect(result.verificationMethod).toBe("date_of_birth");
      expect(result.requiresAdditionalVerification).toBe(false);
      expect(result.reason).toContain("below the minimum age of 13");
    });

    test("should create self declared result for underage user", () => {
      const result = createSelfDeclaredResult(12);

      expect(result.isVerified).toBe(false);
      expect(result.age).toBe(12);
      expect(result.isMinor).toBe(true);
      expect(result.verificationMethod).toBe("self_declaration");
      expect(result.confidence).toBe(0);
      expect(result.requiresAdditionalVerification).toBe(false);
      expect(result.reason).toContain("must be 13 or older");
    });

    test("should create self declared result for adult user", () => {
      const result = createSelfDeclaredResult(25);

      expect(result.isVerified).toBe(true);
      expect(result.age).toBe(25);
      expect(result.isMinor).toBe(false);
      expect(result.verificationMethod).toBe("self_declaration");
      expect(result.confidence).toBe(SELF_DECLARATION_CONFIDENCE);
      expect(result.requiresAdditionalVerification).toBe(false);
    });

    test("should create self declared result with strict mode", () => {
      const result = createSelfDeclaredResult(25, true);

      expect(result.isVerified).toBe(true);
      expect(result.requiresAdditionalVerification).toBe(true);
      expect(result.reason).toBe(
        "Additional verification required for strict mode"
      );
    });

    test("should create date of birth result", () => {
      const result = createDateOfBirthResult(25);

      expect(result.isVerified).toBe(true);
      expect(result.age).toBe(25);
      expect(result.isMinor).toBe(false);
      expect(result.verificationMethod).toBe("date_of_birth");
      expect(result.confidence).toBe(DATE_OF_BIRTH_CONFIDENCE);
      expect(result.requiresAdditionalVerification).toBe(false);
    });

    test("should create date of birth result with credit card", () => {
      const result = createDateOfBirthResult(25, false, true, true);

      expect(result.verificationMethod).toBe("credit_card");
      expect(result.confidence).toBe(CREDIT_CARD_CONFIDENCE);
    });
  });

  describe("Verification Requirements", () => {
    test("should get basic verification requirements", () => {
      const requirements = getVerificationRequirements(false);

      expect(requirements.required).toBe(true);
      expect(requirements.methods).toEqual(["date_of_birth"]);
      expect(requirements.description).toBe(
        "Date of birth is required for age verification"
      );
    });

    test("should get strict verification requirements", () => {
      const requirements = getVerificationRequirements(true);

      expect(requirements.required).toBe(true);
      expect(requirements.methods).toEqual([
        "date_of_birth",
        "third_party",
        "credit_card",
      ]);
      expect(requirements.description).toBe(
        "Strict mode requires stronger age verification"
      );
    });
  });

  describe("Additional Verification Check", () => {
    test("should not require additional verification for rejected users", () => {
      const result: AgeVerificationResult = {
        isVerified: false,
        age: 12,
        isMinor: true,
        verificationMethod: "date_of_birth",
        confidence: 0.9,
        requiresAdditionalVerification: false,
      };

      expect(needsAdditionalVerification(result, true)).toBe(false);
    });

    test("should require additional verification in strict mode with low confidence", () => {
      const result: AgeVerificationResult = {
        isVerified: true,
        age: 25,
        isMinor: false,
        verificationMethod: "self_declaration",
        confidence: 0.3,
        requiresAdditionalVerification: false,
      };

      expect(needsAdditionalVerification(result, true)).toBe(true);
    });

    test("should not require additional verification in strict mode with high confidence", () => {
      const result: AgeVerificationResult = {
        isVerified: true,
        age: 25,
        isMinor: false,
        verificationMethod: "credit_card",
        confidence: 0.9,
        requiresAdditionalVerification: false,
      };

      expect(needsAdditionalVerification(result, true)).toBe(false);
    });
  });

  describe("Suggested Verification Methods", () => {
    test("should suggest methods for self declaration", () => {
      const suggestions = getSuggestedVerificationMethods("self_declaration");
      expect(suggestions).toEqual(["date_of_birth", "third_party"]);
    });

    test("should suggest methods for date of birth", () => {
      const suggestions = getSuggestedVerificationMethods("date_of_birth");
      expect(suggestions).toEqual(["third_party", "credit_card"]);
    });

    test("should return empty array for other methods", () => {
      const suggestions = getSuggestedVerificationMethods("credit_card");
      expect(suggestions).toEqual([]);
    });
  });

  describe("User Input Validation", () => {
    test("should validate input with date of birth", () => {
      const today = new Date();
      const validDate = new Date(
        today.getFullYear() - 25,
        today.getMonth(),
        today.getDate()
      );

      const userInput: UserInput = {
        dateOfBirth: validDate,
      };

      const validation = validateUserInput(userInput);
      expect(validation.isValid).toBe(true);
    });

    test("should validate input with age when anonymous is allowed", () => {
      const userInput: UserInput = {
        age: 25,
      };

      const validation = validateUserInput(userInput, true);
      expect(validation.isValid).toBe(true);
    });

    test("should reject input without date of birth or age", () => {
      const userInput: UserInput = {};

      const validation = validateUserInput(userInput);
      expect(validation.isValid).toBe(false);
      expect(validation.reason).toBe(
        "Either date of birth or age must be provided"
      );
    });

    test("should reject input with age when anonymous is not allowed", () => {
      const userInput: UserInput = {
        age: 25,
      };

      const validation = validateUserInput(userInput, false);
      expect(validation.isValid).toBe(false);
      expect(validation.reason).toBe(
        "Date of birth is required when anonymous verification is not allowed"
      );
    });

    test("should reject input with negative age", () => {
      const userInput: UserInput = {
        age: -5,
      };

      const validation = validateUserInput(userInput, true);
      expect(validation.isValid).toBe(false);
      expect(validation.reason).toBe("Age cannot be negative");
    });

    test("should reject input with invalid date of birth", () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const userInput: UserInput = {
        dateOfBirth: futureDate,
      };

      const validation = validateUserInput(userInput);
      expect(validation.isValid).toBe(false);
      expect(validation.reason).toBe("Date of birth cannot be in the future");
    });
  });

  describe("Error Messages", () => {
    test("should get missing date of birth error", () => {
      const error = getMissingDateOfBirthError();
      expect(error).toBe("Date of birth is required for age verification.");
    });

    test("should get underage error", () => {
      const error = getUnderageError(12);
      expect(error).toBe(
        "Users must be 13 or older to use this platform. Current age: 12"
      );
    });
  });
});
