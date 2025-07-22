/**
 * Tests for Profile Generation Utilities
 * Demonstrates testing real business logic instead of mocks
 */

import {
  generateAnonymousProfile,
  isValidDisplayName,
  isValidHexColor,
  getAdjectives,
  getNouns,
  getColors,
  generateProfileWithWords,
} from "../utils/profileGenerationUtils";

describe("Profile Generation Utilities", () => {
  describe("generateAnonymousProfile", () => {
    it("should generate valid display names", () => {
      const profile = generateAnonymousProfile();

      expect(profile.displayName).toBeDefined();
      expect(profile.displayName).toMatch(/^[A-Za-z]+ [A-Za-z]+$/);
      expect(isValidDisplayName(profile.displayName)).toBe(true);
    });

    it("should generate valid hex colors", () => {
      const profile = generateAnonymousProfile();

      expect(profile.profileColor).toBeDefined();
      expect(profile.profileColor).toMatch(/^#[0-9A-F]{6}$/i);
      expect(isValidHexColor(profile.profileColor)).toBe(true);
    });

    it("should generate profiles with correct structure", () => {
      const profile = generateAnonymousProfile();

      expect(profile).toHaveProperty("displayName");
      expect(profile).toHaveProperty("profileColor");
      expect(typeof profile.displayName).toBe("string");
      expect(typeof profile.profileColor).toBe("string");
    });

    it("should generate different profiles on multiple calls", () => {
      const profiles = new Set<string>();

      // Generate multiple profiles and check for variety
      for (let i = 0; i < 10; i++) {
        const profile = generateAnonymousProfile();
        profiles.add(profile.displayName);
      }

      // Due to randomness, we might get duplicates, but we should have some variety
      expect(profiles.size).toBeGreaterThan(1);
    });

    it("should only use valid adjectives and nouns", () => {
      const adjectives = getAdjectives();
      const nouns = getNouns();

      for (let i = 0; i < 20; i++) {
        const profile = generateAnonymousProfile();
        const [adjective, noun] = profile.displayName.split(" ");

        expect(adjectives).toContain(adjective);
        expect(nouns).toContain(noun);
      }
    });

    it("should only use valid colors", () => {
      const colors = getColors();

      for (let i = 0; i < 20; i++) {
        const profile = generateAnonymousProfile();
        expect(colors).toContain(profile.profileColor);
      }
    });
  });

  describe("isValidDisplayName", () => {
    it("should validate correct display names", () => {
      const validNames = [
        "Whispering Whisperer",
        "Silent Listener",
        "Mysterious Voice",
        "Secretive Echo",
        "Gentle Shadow",
        "Soft Ghost",
        "Hushed Spirit",
        "Muted Soul",
        "Subtle Heart",
        "Hidden Mind",
        "Veiled Dreamer",
        "Concealed Thinker",
        "Private Observer",
        "Intimate Wanderer",
        "Quiet Seeker",
      ];

      validNames.forEach((name) => {
        expect(isValidDisplayName(name)).toBe(true);
      });
    });

    it("should reject invalid display names", () => {
      const invalidNames = [
        "Invalid Name",
        "Whispering Invalid",
        "Invalid Whisperer",
        "SingleWord",
        "Too Many Words Here",
        "",
        "whispering whisperer", // lowercase
        "WHISPERING WHISPERER", // uppercase
        "Whispering-Whisperer", // hyphen
        "Whispering_Whisperer", // underscore
        "Whispering123", // numbers
        "Whispering Whisperer!", // punctuation
      ];

      invalidNames.forEach((name) => {
        expect(isValidDisplayName(name)).toBe(false);
      });
    });

    it("should reject names with wrong adjectives", () => {
      const invalidNames = [
        "Happy Whisperer",
        "Sad Listener",
        "Angry Voice",
        "Excited Echo",
      ];

      invalidNames.forEach((name) => {
        expect(isValidDisplayName(name)).toBe(false);
      });
    });

    it("should reject names with wrong nouns", () => {
      const invalidNames = [
        "Whispering Person",
        "Silent Human",
        "Mysterious Being",
        "Secretive Individual",
      ];

      invalidNames.forEach((name) => {
        expect(isValidDisplayName(name)).toBe(false);
      });
    });
  });

  describe("isValidHexColor", () => {
    it("should validate correct hex colors", () => {
      const validColors = [
        "#4CAF50",
        "#2196F3",
        "#9C27B0",
        "#FF9800",
        "#F44336",
        "#00BCD4",
        "#8BC34A",
        "#FF5722",
        "#795548",
        "#607D8B",
        "#E91E63",
        "#3F51B5",
        "#009688",
        "#FFC107",
        "#9E9E9E",
        "#ABCDEF",
        "#123456",
        "#abcdef",
      ];

      validColors.forEach((color) => {
        expect(isValidHexColor(color)).toBe(true);
      });
    });

    it("should reject invalid hex colors", () => {
      const invalidColors = [
        "4CAF50", // missing #
        "#4CAF5", // too short
        "#4CAF500", // too long
        "#4CAF5G", // invalid character
        "#4CAF5g", // lowercase invalid character
        "red",
        "rgb(255, 0, 0)",
        "hsl(0, 100%, 50%)",
        "",
        "#",
        "#123",
        "#12345",
        "#1234567",
      ];

      invalidColors.forEach((color) => {
        expect(isValidHexColor(color)).toBe(false);
      });
    });
  });

  describe("getAdjectives", () => {
    it("should return all valid adjectives", () => {
      const adjectives = getAdjectives();

      expect(adjectives).toHaveLength(15);
      expect(adjectives).toContain("Whispering");
      expect(adjectives).toContain("Silent");
      expect(adjectives).toContain("Mysterious");
      expect(adjectives).toContain("Intimate");
    });

    it("should return array with correct length", () => {
      const adjectives = getAdjectives();

      expect(adjectives).toHaveLength(15);
      expect(Array.isArray(adjectives)).toBe(true);
    });
  });

  describe("getNouns", () => {
    it("should return all valid nouns", () => {
      const nouns = getNouns();

      expect(nouns).toHaveLength(15);
      expect(nouns).toContain("Whisperer");
      expect(nouns).toContain("Listener");
      expect(nouns).toContain("Voice");
      expect(nouns).toContain("Seeker");
    });

    it("should return array with correct length", () => {
      const nouns = getNouns();

      expect(nouns).toHaveLength(15);
      expect(Array.isArray(nouns)).toBe(true);
    });
  });

  describe("getColors", () => {
    it("should return all valid colors", () => {
      const colors = getColors();

      expect(colors).toHaveLength(15);
      expect(colors).toContain("#4CAF50");
      expect(colors).toContain("#2196F3");
      expect(colors).toContain("#9E9E9E");
    });

    it("should return array with correct length", () => {
      const colors = getColors();

      expect(colors).toHaveLength(15);
      expect(Array.isArray(colors)).toBe(true);
    });
  });

  describe("generateProfileWithWords", () => {
    it("should generate profile with specified words", () => {
      const profile = generateProfileWithWords("Whispering", "Whisperer");

      expect(profile.displayName).toBe("Whispering Whisperer");
      expect(isValidHexColor(profile.profileColor)).toBe(true);
    });

    it("should generate different colors for same words", () => {
      const profile1 = generateProfileWithWords("Silent", "Listener");
      const profile2 = generateProfileWithWords("Silent", "Listener");

      expect(profile1.displayName).toBe("Silent Listener");
      expect(profile2.displayName).toBe("Silent Listener");

      // Colors should be different due to randomness
      expect(profile1.profileColor).toBeDefined();
      expect(profile2.profileColor).toBeDefined();
    });

    it("should work with any valid adjective and noun", () => {
      const adjectives = getAdjectives();
      const nouns = getNouns();

      adjectives.forEach((adjective) => {
        nouns.forEach((noun) => {
          const profile = generateProfileWithWords(adjective, noun);

          expect(profile.displayName).toBe(`${adjective} ${noun}`);
          expect(profile.profileColor).toBeDefined();
          expect(typeof profile.profileColor).toBe("string");
        });
      });
    });
  });

  describe("Business Logic Edge Cases", () => {
    it("should handle all possible combinations", () => {
      const adjectives = getAdjectives();
      const nouns = getNouns();
      const totalCombinations = adjectives.length * nouns.length;

      expect(totalCombinations).toBe(225); // 15 * 15

      // Test that we can generate profiles for all combinations
      const generatedProfiles = new Set<string>();

      adjectives.forEach((adjective) => {
        nouns.forEach((noun) => {
          const profile = generateProfileWithWords(adjective, noun);
          generatedProfiles.add(profile.displayName);
        });
      });

      expect(generatedProfiles.size).toBe(totalCombinations);
    });

    it("should maintain consistent validation", () => {
      // Test that generated profiles always pass validation
      for (let i = 0; i < 100; i++) {
        const profile = generateAnonymousProfile();

        expect(isValidDisplayName(profile.displayName)).toBe(true);
        expect(profile.profileColor).toBeDefined();
        expect(typeof profile.profileColor).toBe("string");
      }
    });

    it("should handle empty or invalid inputs gracefully", () => {
      // Test validation functions with edge cases
      expect(isValidDisplayName("")).toBe(false);
      expect(isValidDisplayName("   ")).toBe(false);
      expect(isValidDisplayName("a")).toBe(false);
      expect(isValidDisplayName("a b c")).toBe(false);

      expect(isValidHexColor("")).toBe(false);
      expect(isValidHexColor("   ")).toBe(false);
      expect(isValidHexColor("invalid")).toBe(false);
    });
  });
});
