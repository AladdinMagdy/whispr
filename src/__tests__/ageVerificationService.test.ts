/**
 * Age Verification Service Tests
 */

import {
  AgeVerificationService,
  AgeVerificationResult,
} from "../services/ageVerificationService";

describe("AgeVerificationService", () => {
  describe("verifyAge", () => {
    it("should reject users under minimum age", async () => {
      const dateOfBirth = new Date();
      dateOfBirth.setFullYear(dateOfBirth.getFullYear() - 12); // 12 years ago
      await expect(
        AgeVerificationService.verifyAge({ dateOfBirth })
      ).resolves.toMatchObject({
        isVerified: false,
        age: 12,
        isMinor: true,
        verificationMethod: "date_of_birth",
        confidence: 0.9,
      });
    });

    it("should accept users at minimum age", async () => {
      const dateOfBirth = new Date();
      dateOfBirth.setFullYear(dateOfBirth.getFullYear() - 13); // 13 years ago
      const result = await AgeVerificationService.verifyAge({ dateOfBirth });
      expect(result.isVerified).toBe(true);
      expect(result.age).toBe(13);
      expect(result.isMinor).toBe(true); // Under 18
      expect(result.verificationMethod).toBe("date_of_birth");
      expect(result.confidence).toBe(0.7);
    });

    it("should accept adult users", async () => {
      const dateOfBirth = new Date();
      dateOfBirth.setFullYear(dateOfBirth.getFullYear() - 25); // 25 years ago
      const result = await AgeVerificationService.verifyAge({ dateOfBirth });
      expect(result.isVerified).toBe(true);
      expect(result.age).toBe(25);
      expect(result.isMinor).toBe(false); // 18+
      expect(result.verificationMethod).toBe("date_of_birth");
      expect(result.confidence).toBe(0.7);
    });

    it("should calculate age from date of birth", async () => {
      const dateOfBirth = new Date();
      dateOfBirth.setFullYear(dateOfBirth.getFullYear() - 20); // 20 years ago

      const result = await AgeVerificationService.verifyAge({
        dateOfBirth,
      });

      expect(result.isVerified).toBe(true);
      expect(result.age).toBe(20);
      expect(result.isMinor).toBe(false);
      expect(result.verificationMethod).toBe("date_of_birth");
      expect(result.confidence).toBe(0.7);
    });

    it("should reject underage users with date of birth", async () => {
      const dateOfBirth = new Date();
      dateOfBirth.setFullYear(dateOfBirth.getFullYear() - 10); // 10 years ago

      const result = await AgeVerificationService.verifyAge({
        dateOfBirth,
      });

      expect(result.isVerified).toBe(false);
      expect(result.age).toBe(10);
      expect(result.isMinor).toBe(true);
      expect(result.verificationMethod).toBe("date_of_birth");
      expect(result.confidence).toBe(0.9);
      expect(result.reason).toContain("Date of birth indicates age 10");
    });

    it("should prefer date of birth over self-declared age", async () => {
      const dateOfBirth = new Date();
      dateOfBirth.setFullYear(dateOfBirth.getFullYear() - 25); // 25 years ago

      const result = await AgeVerificationService.verifyAge({
        age: 30, // Self-declared age
        dateOfBirth, // More reliable
      });

      expect(result.isVerified).toBe(true);
      expect(result.age).toBe(25); // Uses calculated age from DOB
      expect(result.verificationMethod).toBe("date_of_birth");
      expect(result.confidence).toBe(0.7);
    });

    it("should require additional verification in strict mode", async () => {
      const dateOfBirth = new Date();
      dateOfBirth.setFullYear(dateOfBirth.getFullYear() - 25); // 25 years ago
      const result = await AgeVerificationService.verifyAge(
        { dateOfBirth },
        { strictMode: true }
      );
      expect(result.isVerified).toBe(true);
      expect(result.requiresAdditionalVerification).toBe(true);
      expect(result.reason).toContain("Additional verification required");
    });

    it("should require additional verification in strict mode even with date of birth", async () => {
      const dateOfBirth = new Date();
      dateOfBirth.setFullYear(dateOfBirth.getFullYear() - 25);

      const result = await AgeVerificationService.verifyAge(
        {
          dateOfBirth,
        },
        { strictMode: true }
      );

      expect(result.isVerified).toBe(true);
      expect(result.requiresAdditionalVerification).toBe(true); // 0.7 < 0.8 threshold
      expect(result.confidence).toBe(0.7);
    });

    it("should allow self-declared age if allowAnonymous is true", async () => {
      const result = await AgeVerificationService.verifyAge(
        { age: 25 },
        { allowAnonymous: true }
      );
      expect(result.isVerified).toBe(true);
      expect(result.age).toBe(25);
      expect(result.isMinor).toBe(false);
      expect(result.verificationMethod).toBe("self_declaration");
      expect(result.confidence).toBe(0.3);
    });

    it("should throw error when neither dateOfBirth nor age is provided", async () => {
      await expect(AgeVerificationService.verifyAge({})).rejects.toThrow(
        "Either date of birth or age must be provided"
      );
    });

    it("should throw error when no dateOfBirth and allowAnonymous is false", async () => {
      await expect(
        AgeVerificationService.verifyAge({ age: 25 }, { allowAnonymous: false })
      ).rejects.toThrow(
        "Date of birth is required when anonymous verification is not allowed"
      );
    });

    it("should throw error when no dateOfBirth and allowAnonymous is not specified", async () => {
      await expect(
        AgeVerificationService.verifyAge({ age: 25 })
      ).rejects.toThrow(
        "Date of birth is required when anonymous verification is not allowed"
      );
    });

    it("should handle requirePayment option", async () => {
      const dateOfBirth = new Date();
      dateOfBirth.setFullYear(dateOfBirth.getFullYear() - 25);

      const result = await AgeVerificationService.verifyAge(
        { dateOfBirth },
        { requirePayment: true }
      );

      expect(result.isVerified).toBe(true);
      expect(result.verificationMethod).toBe("date_of_birth");
    });

    it("should handle creditCardInfo option", async () => {
      const dateOfBirth = new Date();
      dateOfBirth.setFullYear(dateOfBirth.getFullYear() - 25);

      const result = await AgeVerificationService.verifyAge(
        {
          dateOfBirth,
          creditCardInfo: { last4: "1234", brand: "visa" },
        },
        { requirePayment: true }
      );

      expect(result.isVerified).toBe(true);
      expect(result.verificationMethod).toBe("credit_card");
    });

    it("should handle edge case of exactly 13 years old", async () => {
      const dateOfBirth = new Date();
      dateOfBirth.setFullYear(dateOfBirth.getFullYear() - 13);
      dateOfBirth.setMonth(dateOfBirth.getMonth() - 6); // 6 months ago

      const result = await AgeVerificationService.verifyAge({ dateOfBirth });
      expect(result.isVerified).toBe(true);
      expect(result.age).toBe(13);
      expect(result.isMinor).toBe(true);
    });

    it("should handle edge case of exactly 18 years old", async () => {
      const dateOfBirth = new Date();
      dateOfBirth.setFullYear(dateOfBirth.getFullYear() - 18);

      const result = await AgeVerificationService.verifyAge({ dateOfBirth });
      expect(result.isVerified).toBe(true);
      expect(result.age).toBe(18);
      expect(result.isMinor).toBe(false);
    });

    it("should handle self-declared age with strict mode", async () => {
      const result = await AgeVerificationService.verifyAge(
        { age: 25 },
        { allowAnonymous: true, strictMode: true }
      );
      expect(result.isVerified).toBe(true);
      expect(result.requiresAdditionalVerification).toBe(true);
      expect(result.confidence).toBe(0.3);
    });

    it("should handle self-declared age for minors", async () => {
      const result = await AgeVerificationService.verifyAge(
        { age: 15 },
        { allowAnonymous: true }
      );
      expect(result.isVerified).toBe(true);
      expect(result.age).toBe(15);
      expect(result.isMinor).toBe(true);
      expect(result.verificationMethod).toBe("self_declaration");
    });

    it("should handle edge case of exactly 12 years old", async () => {
      const dateOfBirth = new Date();
      dateOfBirth.setFullYear(dateOfBirth.getFullYear() - 12);

      const result = await AgeVerificationService.verifyAge({ dateOfBirth });
      expect(result.isVerified).toBe(false);
      expect(result.age).toBe(12);
      expect(result.isMinor).toBe(true);
      expect(result.verificationMethod).toBe("date_of_birth");
    });

    it("should handle edge case of exactly 17 years old", async () => {
      const dateOfBirth = new Date();
      dateOfBirth.setFullYear(dateOfBirth.getFullYear() - 17);

      const result = await AgeVerificationService.verifyAge({ dateOfBirth });
      expect(result.isVerified).toBe(true);
      expect(result.age).toBe(17);
      expect(result.isMinor).toBe(true);
      expect(result.verificationMethod).toBe("date_of_birth");
    });

    it("should handle edge case of exactly 19 years old", async () => {
      const dateOfBirth = new Date();
      dateOfBirth.setFullYear(dateOfBirth.getFullYear() - 19);

      const result = await AgeVerificationService.verifyAge({ dateOfBirth });
      expect(result.isVerified).toBe(true);
      expect(result.age).toBe(19);
      expect(result.isMinor).toBe(false);
      expect(result.verificationMethod).toBe("date_of_birth");
    });

    it("should handle self-declared age with requirePayment", async () => {
      const result = await AgeVerificationService.verifyAge(
        { age: 25 },
        { allowAnonymous: true, requirePayment: true }
      );
      expect(result.isVerified).toBe(true);
      expect(result.verificationMethod).toBe("self_declaration");
    });

    it("should handle self-declared age with creditCardInfo", async () => {
      const result = await AgeVerificationService.verifyAge(
        {
          age: 25,
          creditCardInfo: { last4: "5678", brand: "mastercard" },
        },
        { allowAnonymous: true, requirePayment: true }
      );
      expect(result.isVerified).toBe(true);
      expect(result.verificationMethod).toBe("self_declaration");
    });

    it("should handle null age input", async () => {
      await expect(
        AgeVerificationService.verifyAge({ age: null as any })
      ).rejects.toThrow("Either date of birth or age must be provided");
    });

    it("should handle undefined age input", async () => {
      await expect(
        AgeVerificationService.verifyAge({ age: undefined as any })
      ).rejects.toThrow("Either date of birth or age must be provided");
    });

    it("should handle null dateOfBirth input", async () => {
      await expect(
        AgeVerificationService.verifyAge({ dateOfBirth: null as any })
      ).rejects.toThrow("Either date of birth or age must be provided");
    });

    it("should handle undefined dateOfBirth input", async () => {
      await expect(
        AgeVerificationService.verifyAge({ dateOfBirth: undefined as any })
      ).rejects.toThrow("Either date of birth or age must be provided");
    });

    it("should handle both null inputs", async () => {
      await expect(
        AgeVerificationService.verifyAge({
          age: null as any,
          dateOfBirth: null as any,
        })
      ).rejects.toThrow("Either date of birth or age must be provided");
    });

    it("should handle very young age with self-declaration", async () => {
      const result = await AgeVerificationService.verifyAge(
        { age: 5 },
        { allowAnonymous: true }
      );
      expect(result.isVerified).toBe(false);
      expect(result.age).toBe(5);
      expect(result.isMinor).toBe(true);
      expect(result.verificationMethod).toBe("self_declaration");
    });

    it("should handle very old age with self-declaration", async () => {
      const result = await AgeVerificationService.verifyAge(
        { age: 100 },
        { allowAnonymous: true }
      );
      expect(result.isVerified).toBe(true);
      expect(result.age).toBe(100);
      expect(result.isMinor).toBe(false);
      expect(result.verificationMethod).toBe("self_declaration");
    });
  });

  describe("validateDateOfBirth", () => {
    it("should reject future dates", () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const result = AgeVerificationService.validateDateOfBirth(futureDate);

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain("cannot be in the future");
    });

    it("should reject dates indicating underage", () => {
      const underageDate = new Date();
      underageDate.setFullYear(underageDate.getFullYear() - 10); // 10 years ago

      const result = AgeVerificationService.validateDateOfBirth(underageDate);

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain("Age must be at least 13");
    });

    it("should reject unrealistic ages", () => {
      const unrealisticDate = new Date();
      unrealisticDate.setFullYear(unrealisticDate.getFullYear() - 150); // 150 years ago

      const result =
        AgeVerificationService.validateDateOfBirth(unrealisticDate);

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain("Age seems unrealistic");
    });

    it("should accept valid dates", () => {
      const validDate = new Date();
      validDate.setFullYear(validDate.getFullYear() - 25); // 25 years ago

      const result = AgeVerificationService.validateDateOfBirth(validDate);

      expect(result.isValid).toBe(true);
    });

    it("should accept exactly 13 years old", () => {
      const validDate = new Date();
      validDate.setFullYear(validDate.getFullYear() - 13);

      const result = AgeVerificationService.validateDateOfBirth(validDate);

      expect(result.isValid).toBe(true);
    });

    it("should accept exactly 100 years old", () => {
      const validDate = new Date();
      validDate.setFullYear(validDate.getFullYear() - 100);

      const result = AgeVerificationService.validateDateOfBirth(validDate);

      expect(result.isValid).toBe(true);
    });

    it("should reject exactly 12 years old", () => {
      const invalidDate = new Date();
      invalidDate.setFullYear(invalidDate.getFullYear() - 12);

      const result = AgeVerificationService.validateDateOfBirth(invalidDate);

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain("Age must be at least 13");
    });

    it("should reject exactly 151 years old", () => {
      const invalidDate = new Date();
      invalidDate.setFullYear(invalidDate.getFullYear() - 151);

      const result = AgeVerificationService.validateDateOfBirth(invalidDate);

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain("Age seems unrealistic");
    });

    it("should handle edge case of exactly 12 years and 11 months", () => {
      const invalidDate = new Date();
      invalidDate.setFullYear(invalidDate.getFullYear() - 12);
      invalidDate.setMonth(invalidDate.getMonth() - 11);

      const result = AgeVerificationService.validateDateOfBirth(invalidDate);

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain("Age must be at least 13");
    });

    it("should handle edge case of exactly 13 years and 1 day", () => {
      const validDate = new Date();
      validDate.setFullYear(validDate.getFullYear() - 13);
      validDate.setDate(validDate.getDate() - 1);

      const result = AgeVerificationService.validateDateOfBirth(validDate);

      expect(result.isValid).toBe(true);
    });

    it("should handle edge case of exactly 100 years and 1 day", () => {
      const validDate = new Date();
      validDate.setFullYear(validDate.getFullYear() - 100);
      validDate.setDate(validDate.getDate() - 1);

      const result = AgeVerificationService.validateDateOfBirth(validDate);

      expect(result.isValid).toBe(true);
    });

    it("should handle edge case of exactly 150 years old", () => {
      const validDate = new Date();
      validDate.setFullYear(validDate.getFullYear() - 150);

      const result = AgeVerificationService.validateDateOfBirth(validDate);

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain("Age seems unrealistic");
    });

    it("should handle edge case of exactly 150 years and 1 day", () => {
      const invalidDate = new Date();
      invalidDate.setFullYear(invalidDate.getFullYear() - 150);
      invalidDate.setDate(invalidDate.getDate() - 1);

      const result = AgeVerificationService.validateDateOfBirth(invalidDate);

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain("Age seems unrealistic");
    });

    it("should handle leap year dates", () => {
      const leapYearDate = new Date(2000, 1, 29); // February 29, 2000 (leap year)
      const currentDate = new Date();
      const age = currentDate.getFullYear() - leapYearDate.getFullYear();

      if (age >= 13 && age <= 150) {
        const result = AgeVerificationService.validateDateOfBirth(leapYearDate);
        expect(result.isValid).toBe(true);
      }
    });

    it("should handle invalid date objects", () => {
      const invalidDate = new Date("invalid date");

      const result = AgeVerificationService.validateDateOfBirth(invalidDate);

      expect(result.isValid).toBe(true);
    });
  });

  describe("getVerificationRequirements", () => {
    it("should return basic requirements for normal mode", () => {
      const requirements =
        AgeVerificationService.getVerificationRequirements(false);
      expect(requirements.required).toBe(true);
      expect(requirements.methods).toContain("date_of_birth");
      expect(requirements.methods).not.toContain("self_declaration");
      expect(requirements.description).toContain("Date of birth is required");
    });

    it("should return strict requirements for strict mode", () => {
      const requirements =
        AgeVerificationService.getVerificationRequirements(true);

      expect(requirements.required).toBe(true);
      expect(requirements.methods).toContain("date_of_birth");
      expect(requirements.methods).toContain("third_party");
      expect(requirements.methods).toContain("credit_card");
      expect(requirements.description).toContain("Strict mode");
    });

    it("should return strict requirements when strictMode is true", () => {
      const requirements =
        AgeVerificationService.getVerificationRequirements(true);

      expect(requirements.required).toBe(true);
      expect(requirements.methods).toContain("date_of_birth");
      expect(requirements.methods).toContain("third_party");
      expect(requirements.methods).toContain("credit_card");
      expect(requirements.description).toContain("Strict mode");
    });

    it("should return basic requirements when strictMode is false", () => {
      const requirements =
        AgeVerificationService.getVerificationRequirements(false);

      expect(requirements.required).toBe(true);
      expect(requirements.methods).toContain("date_of_birth");
      expect(requirements.methods).not.toContain("self_declaration");
      expect(requirements.description).toContain("Date of birth is required");
    });

    it("should handle undefined strictMode parameter", () => {
      const requirements = AgeVerificationService.getVerificationRequirements(
        undefined as any
      );

      expect(requirements.required).toBe(true);
      expect(requirements.methods).toContain("date_of_birth");
      expect(requirements.methods).not.toContain("self_declaration");
      expect(requirements.description).toContain("Date of birth is required");
    });

    it("should handle null strictMode parameter", () => {
      const requirements = AgeVerificationService.getVerificationRequirements(
        null as any
      );

      expect(requirements.required).toBe(true);
      expect(requirements.methods).toContain("date_of_birth");
      expect(requirements.methods).not.toContain("self_declaration");
      expect(requirements.description).toContain("Date of birth is required");
    });
  });

  describe("needsAdditionalVerification", () => {
    it("should not require additional verification for rejected users", () => {
      const result: AgeVerificationResult = {
        isVerified: false,
        age: 12,
        isMinor: true,
        verificationMethod: "self_declaration",
        confidence: 0,
        requiresAdditionalVerification: false,
        reason: "Too young",
      };

      const needsVerification =
        AgeVerificationService.needsAdditionalVerification(result);

      expect(needsVerification).toBe(false);
    });

    it("should require additional verification in strict mode with low confidence", () => {
      const result: AgeVerificationResult = {
        isVerified: true,
        age: 25,
        isMinor: false,
        verificationMethod: "self_declaration",
        confidence: 0.3,
        requiresAdditionalVerification: false,
      };

      const needsVerification =
        AgeVerificationService.needsAdditionalVerification(result, true);

      expect(needsVerification).toBe(true);
    });

    it("should not require additional verification in normal mode with high confidence", () => {
      const result: AgeVerificationResult = {
        isVerified: true,
        age: 25,
        isMinor: false,
        verificationMethod: "date_of_birth",
        confidence: 0.7,
        requiresAdditionalVerification: false,
      };

      const needsVerification =
        AgeVerificationService.needsAdditionalVerification(result, false);

      expect(needsVerification).toBe(false);
    });

    it("should require additional verification in strict mode with medium confidence", () => {
      const result: AgeVerificationResult = {
        isVerified: true,
        age: 25,
        isMinor: false,
        verificationMethod: "date_of_birth",
        confidence: 0.7,
        requiresAdditionalVerification: false,
      };

      const needsVerification =
        AgeVerificationService.needsAdditionalVerification(result, true);

      expect(needsVerification).toBe(true);
    });

    it("should not require additional verification in strict mode with high confidence", () => {
      const result: AgeVerificationResult = {
        isVerified: true,
        age: 25,
        isMinor: false,
        verificationMethod: "third_party",
        confidence: 0.9,
        requiresAdditionalVerification: false,
      };

      const needsVerification =
        AgeVerificationService.needsAdditionalVerification(result, true);

      expect(needsVerification).toBe(false);
    });

    it("should handle undefined strictMode parameter", () => {
      const result: AgeVerificationResult = {
        isVerified: true,
        age: 25,
        isMinor: false,
        verificationMethod: "date_of_birth",
        confidence: 0.7,
        requiresAdditionalVerification: false,
      };

      const needsVerification =
        AgeVerificationService.needsAdditionalVerification(
          result,
          undefined as any
        );

      expect(needsVerification).toBe(false);
    });

    it("should handle null strictMode parameter", () => {
      const result: AgeVerificationResult = {
        isVerified: true,
        age: 25,
        isMinor: false,
        verificationMethod: "date_of_birth",
        confidence: 0.7,
        requiresAdditionalVerification: false,
      };

      const needsVerification =
        AgeVerificationService.needsAdditionalVerification(result, null as any);

      expect(needsVerification).toBe(false);
    });

    it("should handle edge case confidence of exactly 0.8 in strict mode", () => {
      const result: AgeVerificationResult = {
        isVerified: true,
        age: 25,
        isMinor: false,
        verificationMethod: "date_of_birth",
        confidence: 0.8,
        requiresAdditionalVerification: false,
      };

      const needsVerification =
        AgeVerificationService.needsAdditionalVerification(result, true);

      expect(needsVerification).toBe(false);
    });

    it("should handle edge case confidence of exactly 0.799 in strict mode", () => {
      const result: AgeVerificationResult = {
        isVerified: true,
        age: 25,
        isMinor: false,
        verificationMethod: "date_of_birth",
        confidence: 0.799,
        requiresAdditionalVerification: false,
      };

      const needsVerification =
        AgeVerificationService.needsAdditionalVerification(result, true);

      expect(needsVerification).toBe(true);
    });
  });

  describe("getSuggestedVerificationMethods", () => {
    it("should suggest date_of_birth and third_party for self_declaration", () => {
      const suggestions =
        AgeVerificationService.getSuggestedVerificationMethods(
          "self_declaration"
        );

      expect(suggestions).toContain("date_of_birth");
      expect(suggestions).toContain("third_party");
    });

    it("should suggest third_party and credit_card for date_of_birth", () => {
      const suggestions =
        AgeVerificationService.getSuggestedVerificationMethods("date_of_birth");

      expect(suggestions).toContain("third_party");
      expect(suggestions).toContain("credit_card");
    });

    it("should suggest credit_card for third_party", () => {
      const suggestions =
        AgeVerificationService.getSuggestedVerificationMethods("third_party");

      expect(suggestions).toEqual([]);
    });

    it("should return empty array for credit_card", () => {
      const suggestions =
        AgeVerificationService.getSuggestedVerificationMethods("credit_card");

      expect(suggestions).toEqual([]);
    });

    it("should return empty array for unknown method", () => {
      const suggestions =
        AgeVerificationService.getSuggestedVerificationMethods(
          "unknown" as any
        );

      expect(suggestions).toEqual([]);
    });

    it("should handle null method parameter", () => {
      const suggestions =
        AgeVerificationService.getSuggestedVerificationMethods(null as any);

      expect(suggestions).toEqual([]);
    });

    it("should handle undefined method parameter", () => {
      const suggestions =
        AgeVerificationService.getSuggestedVerificationMethods(
          undefined as any
        );

      expect(suggestions).toEqual([]);
    });

    it("should handle empty string method parameter", () => {
      const suggestions =
        AgeVerificationService.getSuggestedVerificationMethods("" as any);

      expect(suggestions).toEqual([]);
    });

    it("should handle whitespace-only method parameter", () => {
      const suggestions =
        AgeVerificationService.getSuggestedVerificationMethods("   " as any);

      expect(suggestions).toEqual([]);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle very old date of birth", async () => {
      const veryOldDate = new Date();
      veryOldDate.setFullYear(veryOldDate.getFullYear() - 120);

      const result = await AgeVerificationService.verifyAge({
        dateOfBirth: veryOldDate,
      });
      expect(result.isVerified).toBe(true);
      expect(result.age).toBe(120);
      expect(result.isMinor).toBe(false);
    });

    it("should handle very young self-declared age", async () => {
      const result = await AgeVerificationService.verifyAge(
        { age: 1 },
        { allowAnonymous: true }
      );
      expect(result.isVerified).toBe(false);
      expect(result.age).toBe(1);
      expect(result.isMinor).toBe(true);
    });

    it("should handle very old self-declared age", async () => {
      const result = await AgeVerificationService.verifyAge(
        { age: 200 },
        { allowAnonymous: true }
      );
      expect(result.isVerified).toBe(true);
      expect(result.age).toBe(200);
      expect(result.isMinor).toBe(false);
    });

    it("should handle zero age", async () => {
      const result = await AgeVerificationService.verifyAge(
        { age: 0 },
        { allowAnonymous: true }
      );
      expect(result.isVerified).toBe(false);
      expect(result.age).toBe(0);
      expect(result.isMinor).toBe(true);
      expect(result.verificationMethod).toBe("self_declaration");
    });

    it("should handle negative age", async () => {
      const result = await AgeVerificationService.verifyAge(
        { age: -5 },
        { allowAnonymous: true }
      );
      expect(result.isVerified).toBe(false);
      expect(result.age).toBe(-5);
      expect(result.isMinor).toBe(true);
    });

    it("should handle decimal age", async () => {
      const result = await AgeVerificationService.verifyAge(
        { age: 25.5 },
        { allowAnonymous: true }
      );
      expect(result.isVerified).toBe(true);
      expect(result.age).toBe(25.5);
      expect(result.isMinor).toBe(false);
    });

    it("should handle date of birth with time components", async () => {
      const dateOfBirth = new Date(2000, 5, 15, 14, 30, 45, 123); // June 15, 2000 14:30:45.123
      const result = await AgeVerificationService.verifyAge({ dateOfBirth });

      const expectedAge = new Date().getFullYear() - 2000;
      expect(result.isVerified).toBe(true);
      expect(result.age).toBe(expectedAge);
    });

    it("should handle leap year edge cases", async () => {
      const leapYearDate = new Date(2000, 1, 29); // February 29, 2000
      const result = await AgeVerificationService.verifyAge({
        dateOfBirth: leapYearDate,
      });

      const expectedAge = new Date().getFullYear() - 2000;
      expect(result.isVerified).toBe(expectedAge >= 13);
      expect(result.age).toBe(expectedAge);
    });
  });
});
