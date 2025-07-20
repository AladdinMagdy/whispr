/**
 * ReportPriorityService Tests
 */

import { ReportPriorityService } from "../services/reportPriorityService";
import { UserReputation, ReportCategory, ReportPriority } from "../types";

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
  });
});
