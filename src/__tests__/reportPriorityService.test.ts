/**
 * ReportPriorityService Tests
 */

import { ReportPriorityService } from "../services/reportPriorityService";
import { UserReputation, ReportCategory, ReportPriority } from "../types";
import {
  getReportPriorityService,
  resetReportPriorityService,
  destroyReportPriorityService,
} from "../services/reportPriorityService";

describe("ReportPriorityService", () => {
  let service: ReportPriorityService;

  beforeEach(() => {
    ReportPriorityService.resetInstance();
    service = ReportPriorityService.getInstance();
  });

  afterEach(() => {
    ReportPriorityService.destroyInstance();
  });

  describe("Singleton Pattern", () => {
    it("should return the same instance", () => {
      const instance1 = ReportPriorityService.getInstance();
      const instance2 = ReportPriorityService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("should reset instance correctly", () => {
      const instance1 = ReportPriorityService.getInstance();
      ReportPriorityService.resetInstance();
      const instance2 = ReportPriorityService.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe("calculatePriority", () => {
    it("should calculate high priority for trusted users", () => {
      const reputation: UserReputation = {
        userId: "user1",
        score: 95,
        level: "trusted",
        totalWhispers: 100,
        approvedWhispers: 95,
        flaggedWhispers: 2,
        rejectedWhispers: 3,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const priority = service.calculatePriority(
        reputation,
        ReportCategory.HARASSMENT
      );
      expect(priority).toBe(ReportPriority.CRITICAL); // Harassment (1.5x) + trusted user = critical
    });

    it("should calculate critical priority for violence reports from trusted users", () => {
      const reputation: UserReputation = {
        userId: "user1",
        score: 95,
        level: "trusted",
        totalWhispers: 100,
        approvedWhispers: 95,
        flaggedWhispers: 2,
        rejectedWhispers: 3,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const priority = service.calculatePriority(
        reputation,
        ReportCategory.VIOLENCE
      );
      expect(priority).toBe(ReportPriority.CRITICAL);
    });

    it("should calculate low priority for flagged users", () => {
      const reputation: UserReputation = {
        userId: "user1",
        score: 30,
        level: "flagged",
        totalWhispers: 50,
        approvedWhispers: 30,
        flaggedWhispers: 15,
        rejectedWhispers: 5,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const priority = service.calculatePriority(
        reputation,
        ReportCategory.SPAM
      );
      expect(priority).toBe(ReportPriority.LOW);
    });

    it("should handle unknown reputation levels gracefully", () => {
      const reputation: UserReputation = {
        userId: "user1",
        score: 50,
        level: "standard" as any, // Force unknown level
        totalWhispers: 50,
        approvedWhispers: 40,
        flaggedWhispers: 5,
        rejectedWhispers: 5,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const priority = service.calculatePriority(
        reputation,
        ReportCategory.OTHER
      );
      expect(priority).toBe(ReportPriority.MEDIUM); // Default fallback
    });
  });

  describe("calculateReputationWeight", () => {
    it("should return correct weight for trusted users", () => {
      const reputation: UserReputation = {
        userId: "user1",
        score: 95,
        level: "trusted",
        totalWhispers: 100,
        approvedWhispers: 95,
        flaggedWhispers: 2,
        rejectedWhispers: 3,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const weight = service.calculateReputationWeight(reputation);
      expect(weight).toBe(2.0);
    });

    it("should return correct weight for verified users", () => {
      const reputation: UserReputation = {
        userId: "user1",
        score: 80,
        level: "verified",
        totalWhispers: 80,
        approvedWhispers: 75,
        flaggedWhispers: 3,
        rejectedWhispers: 2,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const weight = service.calculateReputationWeight(reputation);
      expect(weight).toBe(1.5);
    });

    it("should return correct weight for standard users", () => {
      const reputation: UserReputation = {
        userId: "user1",
        score: 60,
        level: "standard",
        totalWhispers: 60,
        approvedWhispers: 55,
        flaggedWhispers: 3,
        rejectedWhispers: 2,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const weight = service.calculateReputationWeight(reputation);
      expect(weight).toBe(1.0);
    });

    it("should return correct weight for flagged users", () => {
      const reputation: UserReputation = {
        userId: "user1",
        score: 30,
        level: "flagged",
        totalWhispers: 50,
        approvedWhispers: 30,
        flaggedWhispers: 15,
        rejectedWhispers: 5,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const weight = service.calculateReputationWeight(reputation);
      expect(weight).toBe(0.5);
    });

    it("should handle unknown reputation levels gracefully", () => {
      const reputation: UserReputation = {
        userId: "user1",
        score: 50,
        level: "unknown" as any,
        totalWhispers: 50,
        approvedWhispers: 40,
        flaggedWhispers: 5,
        rejectedWhispers: 5,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const weight = service.calculateReputationWeight(reputation);
      expect(weight).toBe(1.0); // Default to standard weight
    });
  });

  describe("escalatePriority", () => {
    it("should escalate low to medium", () => {
      const escalated = service.escalatePriority(ReportPriority.LOW);
      expect(escalated).toBe(ReportPriority.MEDIUM);
    });

    it("should escalate medium to high", () => {
      const escalated = service.escalatePriority(ReportPriority.MEDIUM);
      expect(escalated).toBe(ReportPriority.HIGH);
    });

    it("should escalate high to critical", () => {
      const escalated = service.escalatePriority(ReportPriority.HIGH);
      expect(escalated).toBe(ReportPriority.CRITICAL);
    });

    it("should not escalate critical", () => {
      const escalated = service.escalatePriority(ReportPriority.CRITICAL);
      expect(escalated).toBe(ReportPriority.CRITICAL);
    });
  });

  describe("shouldEscalate", () => {
    it("should always escalate critical priority", () => {
      const shouldEscalate = service.shouldEscalate(ReportPriority.CRITICAL, 1);
      expect(shouldEscalate).toBe(true);
    });

    it("should escalate high priority with 3+ reports", () => {
      const shouldEscalate = service.shouldEscalate(ReportPriority.HIGH, 3);
      expect(shouldEscalate).toBe(true);
    });

    it("should not escalate high priority with fewer reports", () => {
      const shouldEscalate = service.shouldEscalate(ReportPriority.HIGH, 2);
      expect(shouldEscalate).toBe(false);
    });

    it("should escalate medium priority with 5+ reports", () => {
      const shouldEscalate = service.shouldEscalate(ReportPriority.MEDIUM, 5);
      expect(shouldEscalate).toBe(true);
    });

    it("should not escalate medium priority with fewer reports", () => {
      const shouldEscalate = service.shouldEscalate(ReportPriority.MEDIUM, 4);
      expect(shouldEscalate).toBe(false);
    });

    it("should escalate low priority with 10+ reports", () => {
      const shouldEscalate = service.shouldEscalate(ReportPriority.LOW, 10);
      expect(shouldEscalate).toBe(true);
    });

    it("should not escalate low priority with fewer reports", () => {
      const shouldEscalate = service.shouldEscalate(ReportPriority.LOW, 9);
      expect(shouldEscalate).toBe(false);
    });
  });

  describe("getPriorityDescription", () => {
    it("should return correct description for critical", () => {
      const description = service.getPriorityDescription(
        ReportPriority.CRITICAL
      );
      expect(description).toBe("Critical - Requires immediate attention");
    });

    it("should return correct description for high", () => {
      const description = service.getPriorityDescription(ReportPriority.HIGH);
      expect(description).toBe("High - Requires prompt review");
    });

    it("should return correct description for medium", () => {
      const description = service.getPriorityDescription(ReportPriority.MEDIUM);
      expect(description).toBe("Medium - Standard review timeline");
    });

    it("should return correct description for low", () => {
      const description = service.getPriorityDescription(ReportPriority.LOW);
      expect(description).toBe("Low - Low priority review");
    });
  });

  describe("Configuration Getters", () => {
    it("should return priority thresholds", () => {
      const thresholds = service.getPriorityThresholds();
      expect(thresholds).toEqual({
        CRITICAL: 90,
        HIGH: 75,
        MEDIUM: 50,
        LOW: 25,
      });
    });

    it("should return reputation weights", () => {
      const weights = service.getReputationWeights();
      expect(weights).toEqual({
        trusted: 2.0,
        verified: 1.5,
        standard: 1.0,
        flagged: 0.5,
        banned: 0.0,
      });
    });

    it("should return category multipliers", () => {
      const multipliers = service.getCategoryMultipliers();
      expect(multipliers).toEqual({
        harassment: 1.5,
        hate_speech: 1.8,
        violence: 2.0,
        sexual_content: 1.7,
        spam: 1.2,
        scam: 1.4,
        copyright: 1.1,
        personal_info: 1.3,
        minor_safety: 2.0,
        other: 1.0,
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle errors in calculatePriority gracefully", () => {
      const invalidReputation = null as any;
      const priority = service.calculatePriority(
        invalidReputation,
        ReportCategory.OTHER
      );
      expect(priority).toBe(ReportPriority.MEDIUM); // Default fallback
    });

    it("should handle errors in calculateReputationWeight gracefully", () => {
      const invalidReputation = null as any;
      const weight = service.calculateReputationWeight(invalidReputation);
      expect(weight).toBe(1.0); // Default fallback
    });

    it("should handle errors in calculatePriority with invalid reputation level", () => {
      const reputation: UserReputation = {
        userId: "user1",
        score: 50,
        level: "invalid_level" as any,
        totalWhispers: 50,
        approvedWhispers: 40,
        flaggedWhispers: 5,
        rejectedWhispers: 5,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const priority = service.calculatePriority(
        reputation,
        ReportCategory.OTHER
      );
      expect(priority).toBe(ReportPriority.MEDIUM); // Default fallback
    });
  });

  describe("calculatePriority - Edge Cases", () => {
    it("should handle high reputation score (90+) boosting priority", () => {
      const reputation: UserReputation = {
        userId: "user1",
        score: 95,
        level: "standard",
        totalWhispers: 100,
        approvedWhispers: 95,
        flaggedWhispers: 2,
        rejectedWhispers: 3,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const priority = service.calculatePriority(
        reputation,
        ReportCategory.OTHER
      );
      // Standard (MEDIUM) + high score boost = HIGH
      expect(priority).toBe(ReportPriority.HIGH);
    });

    it("should handle very low reputation score (20-) reducing priority", () => {
      const reputation: UserReputation = {
        userId: "user1",
        score: 15,
        level: "standard",
        totalWhispers: 50,
        approvedWhispers: 30,
        flaggedWhispers: 15,
        rejectedWhispers: 5,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const priority = service.calculatePriority(
        reputation,
        ReportCategory.OTHER
      );
      // Standard (MEDIUM) + low score reduction = LOW
      expect(priority).toBe(ReportPriority.LOW);
    });

    it("should handle medium reputation score (21-89) not changing priority", () => {
      const reputation: UserReputation = {
        userId: "user1",
        score: 50,
        level: "standard",
        totalWhispers: 50,
        approvedWhispers: 40,
        flaggedWhispers: 5,
        rejectedWhispers: 5,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const priority = service.calculatePriority(
        reputation,
        ReportCategory.OTHER
      );
      // Standard (MEDIUM) + medium score = MEDIUM (no change)
      expect(priority).toBe(ReportPriority.MEDIUM);
    });

    it("should handle category multipliers correctly", () => {
      const reputation: UserReputation = {
        userId: "user1",
        score: 50,
        level: "standard",
        totalWhispers: 50,
        approvedWhispers: 40,
        flaggedWhispers: 5,
        rejectedWhispers: 5,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Test different categories with multipliers
      const violencePriority = service.calculatePriority(
        reputation,
        ReportCategory.VIOLENCE
      );
      expect(violencePriority).toBe(ReportPriority.CRITICAL); // MEDIUM * 2.0 = CRITICAL

      const harassmentPriority = service.calculatePriority(
        reputation,
        ReportCategory.HARASSMENT
      );
      expect(harassmentPriority).toBe(ReportPriority.HIGH); // MEDIUM * 1.5 = HIGH

      const spamPriority = service.calculatePriority(
        reputation,
        ReportCategory.SPAM
      );
      expect(spamPriority).toBe(ReportPriority.MEDIUM); // MEDIUM * 1.2 = MEDIUM (rounded)
    });

    it("should handle banned users with low priority", () => {
      const reputation: UserReputation = {
        userId: "user1",
        score: 10,
        level: "banned",
        totalWhispers: 50,
        approvedWhispers: 20,
        flaggedWhispers: 20,
        rejectedWhispers: 10,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const priority = service.calculatePriority(
        reputation,
        ReportCategory.OTHER
      );
      expect(priority).toBe(ReportPriority.LOW); // Banned users get LOW priority
    });

    it("should handle verified users with medium priority", () => {
      const reputation: UserReputation = {
        userId: "user1",
        score: 80,
        level: "verified",
        totalWhispers: 80,
        approvedWhispers: 75,
        flaggedWhispers: 3,
        rejectedWhispers: 2,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const priority = service.calculatePriority(
        reputation,
        ReportCategory.OTHER
      );
      expect(priority).toBe(ReportPriority.MEDIUM); // Verified users get MEDIUM priority
    });
  });

  describe("escalatePriority - Edge Cases", () => {
    it("should handle unknown priority level gracefully", () => {
      const escalated = service.escalatePriority("unknown" as any);
      expect(escalated).toBe(ReportPriority.MEDIUM); // Default fallback
    });
  });

  describe("deescalatePriority - Edge Cases", () => {
    it("should handle deescalation from critical to high", () => {
      // Test through calculatePriority with low reputation score
      const reputation: UserReputation = {
        userId: "user1",
        score: 15,
        level: "trusted", // HIGH base priority
        totalWhispers: 100,
        approvedWhispers: 95,
        flaggedWhispers: 2,
        rejectedWhispers: 3,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const priority = service.calculatePriority(
        reputation,
        ReportCategory.OTHER
      );
      // Trusted (HIGH) + low score reduction = MEDIUM
      expect(priority).toBe(ReportPriority.MEDIUM);
    });

    it("should handle deescalation from high to medium", () => {
      const reputation: UserReputation = {
        userId: "user1",
        score: 15,
        level: "verified", // MEDIUM base priority, but with high score boost then low score reduction
        totalWhispers: 80,
        approvedWhispers: 75,
        flaggedWhispers: 3,
        rejectedWhispers: 2,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const priority = service.calculatePriority(
        reputation,
        ReportCategory.OTHER
      );
      // Verified (MEDIUM) + low score reduction = LOW
      expect(priority).toBe(ReportPriority.LOW);
    });
  });

  describe("getPriorityDescription - Edge Cases", () => {
    it("should handle unknown priority level", () => {
      const description = service.getPriorityDescription("unknown" as any);
      expect(description).toBe("Unknown priority level");
    });
  });

  describe("Factory Functions", () => {
    it("should return singleton instance via getReportPriorityService", () => {
      const instance1 = getReportPriorityService();
      const instance2 = getReportPriorityService();
      expect(instance1).toBe(instance2);
    });

    it("should reset instance via resetReportPriorityService", () => {
      const instance1 = getReportPriorityService();
      resetReportPriorityService();
      const instance2 = getReportPriorityService();
      expect(instance1).not.toBe(instance2);
    });

    it("should destroy instance via destroyReportPriorityService", () => {
      const instance1 = getReportPriorityService();
      destroyReportPriorityService();
      const instance2 = getReportPriorityService();
      expect(instance1).not.toBe(instance2);
    });

    it("should handle resetReportPriorityService when instance is null", () => {
      ReportPriorityService.destroyInstance();
      expect(() => resetReportPriorityService()).not.toThrow();
    });

    it("should handle destroyReportPriorityService when instance is null", () => {
      ReportPriorityService.destroyInstance();
      expect(() => destroyReportPriorityService()).not.toThrow();
    });
  });

  describe("Singleton Pattern - Edge Cases", () => {
    it("should create new instance when none exists", () => {
      ReportPriorityService.destroyInstance();
      const instance = ReportPriorityService.getInstance();
      expect(instance).toBeInstanceOf(ReportPriorityService);
    });

    it("should return existing instance when one exists", () => {
      const instance1 = ReportPriorityService.getInstance();
      const instance2 = ReportPriorityService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("should handle resetInstance when instance is null", () => {
      ReportPriorityService.destroyInstance();
      expect(() => ReportPriorityService.resetInstance()).not.toThrow();
    });

    it("should handle destroyInstance when instance is null", () => {
      ReportPriorityService.destroyInstance();
      expect(() => ReportPriorityService.destroyInstance()).not.toThrow();
    });
  });

  describe("Category Multipliers - All Categories", () => {
    it("should handle all category multipliers correctly", () => {
      const reputation: UserReputation = {
        userId: "user1",
        score: 50,
        level: "standard",
        totalWhispers: 50,
        approvedWhispers: 40,
        flaggedWhispers: 5,
        rejectedWhispers: 5,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Test all categories
      const categories = [
        ReportCategory.HARASSMENT,
        ReportCategory.HATE_SPEECH,
        ReportCategory.VIOLENCE,
        ReportCategory.SEXUAL_CONTENT,
        ReportCategory.SPAM,
        ReportCategory.SCAM,
        ReportCategory.COPYRIGHT,
        ReportCategory.PERSONAL_INFO,
        ReportCategory.MINOR_SAFETY,
        ReportCategory.OTHER,
      ];

      categories.forEach((category) => {
        const priority = service.calculatePriority(reputation, category);
        expect(priority).toBeDefined();
        expect([
          ReportPriority.LOW,
          ReportPriority.MEDIUM,
          ReportPriority.HIGH,
          ReportPriority.CRITICAL,
        ]).toContain(priority);
      });
    });
  });

  describe("Reputation Levels - All Levels", () => {
    it("should handle all reputation levels correctly", () => {
      const categories = [
        ReportCategory.OTHER,
        ReportCategory.SPAM,
        ReportCategory.HARASSMENT,
      ];

      const levels = [
        "trusted",
        "verified",
        "standard",
        "flagged",
        "banned",
      ] as const;

      levels.forEach((level) => {
        const reputation: UserReputation = {
          userId: "user1",
          score: 50,
          level,
          totalWhispers: 50,
          approvedWhispers: 40,
          flaggedWhispers: 5,
          rejectedWhispers: 5,
          violationHistory: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        categories.forEach((category) => {
          const priority = service.calculatePriority(reputation, category);
          expect(priority).toBeDefined();
          expect([
            ReportPriority.LOW,
            ReportPriority.MEDIUM,
            ReportPriority.HIGH,
            ReportPriority.CRITICAL,
          ]).toContain(priority);
        });
      });
    });
  });
});
