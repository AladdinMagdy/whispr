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
  });
});
