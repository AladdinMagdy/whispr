/**
 * Tests for Appeal Utilities
 */

import {
  validateAppealData,
  generateAppealId,
  createAppealObject,
  getAppealTimeLimit,
  getDaysSinceViolation,
  getDaysSinceSubmission,
  shouldAutoApprove,
  getAutoApprovalThreshold,
  canUserAppeal,
  isAppealExpired,
  createExpirationUpdates,
  processReviewAction,
  createAutoApprovalUpdates,
  calculateAppealStats,
  getDefaultAppealStats,
  canReviewAppeal,
  getReputationAdjustment,
  formatReputationReason,
  shouldAutoApproveForUser,
  getAppealStatusDisplay,
  isAppealResolved,
  isAppealActive,
  APPEAL_TIME_LIMITS,
  AUTO_APPROVAL_THRESHOLDS,
} from "../utils/appealUtils";
import { AppealStatus } from "../types";
import { REPUTATION_CONSTANTS } from "../constants";

// Mock constants
jest.mock("../constants", () => ({
  TIME_CONSTANTS: {
    TRUSTED_APPEAL_TIME_LIMIT: 0,
    VERIFIED_APPEAL_TIME_LIMIT: 7 * 24 * 60 * 60 * 1000, // 7 days
    STANDARD_APPEAL_TIME_LIMIT: 14 * 24 * 60 * 60 * 1000, // 14 days
    FLAGGED_APPEAL_TIME_LIMIT: 30 * 24 * 60 * 60 * 1000, // 30 days
    ONE_DAY: 24 * 60 * 60 * 1000,
  },
  REPUTATION_CONSTANTS: {
    APPEAL_APPROVED_BONUS: 5,
    APPEAL_REJECTED_PENALTY: -5,
  },
}));

describe("AppealUtils", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Constants", () => {
    it("should export appeal time limits", () => {
      expect(APPEAL_TIME_LIMITS).toEqual({
        trusted: 0,
        verified: 7,
        standard: 14,
        flagged: 30,
        banned: 0,
      });
    });

    it("should export auto-approval thresholds", () => {
      expect(AUTO_APPROVAL_THRESHOLDS).toEqual({
        trusted: 0.3,
        verified: 0.5,
        standard: 0.7,
        flagged: 0.9,
        banned: 1.0,
      });
    });
  });

  describe("validateAppealData", () => {
    const mockViolation = {
      id: "violation-123",
      userId: "user-123",
      whisperId: "whisper-123",
      type: "spam",
      severity: "low",
      timestamp: new Date("2023-01-01T00:00:00Z"),
      reason: "Test violation",
    } as any;

    const mockData = {
      userId: "user-123",
      whisperId: "whisper-123",
      violationId: "violation-123",
      reason: "Test appeal",
    };

    it("should validate valid appeal data", () => {
      const reputation = { userId: "user-123", level: "verified" } as any;
      const violation = {
        ...mockViolation,
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      };
      expect(() =>
        validateAppealData(mockData, reputation, violation)
      ).not.toThrow();
    });

    it("should throw error for banned users", () => {
      const reputation = { userId: "user-123", level: "banned" } as any;

      expect(() =>
        validateAppealData(mockData, reputation, mockViolation)
      ).toThrow("Banned users cannot submit appeals");
    });

    it("should throw error for missing violation", () => {
      const reputation = { userId: "user-123", level: "standard" } as any;

      expect(() => validateAppealData(mockData, reputation, null)).toThrow(
        "Violation not found"
      );
    });

    it("should throw error for expired time limit", () => {
      const reputation = { userId: "user-123", level: "standard" } as any;
      const oldViolation = {
        ...mockViolation,
        timestamp: new Date("2022-01-01T00:00:00Z"),
      };

      expect(() =>
        validateAppealData(mockData, reputation, oldViolation)
      ).toThrow("Appeal time limit exceeded");
    });
  });

  describe("generateAppealId", () => {
    it("should generate unique appeal IDs", () => {
      const id1 = generateAppealId();
      const id2 = generateAppealId();

      expect(id1).toMatch(/^appeal-\d+-\w{9}$/);
      expect(id2).toMatch(/^appeal-\d+-\w{9}$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe("createAppealObject", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2023-01-01T00:00:00Z"));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should create appeal object with all fields", () => {
      const data = {
        userId: "user-123",
        whisperId: "whisper-123",
        violationId: "violation-123",
        reason: "Test appeal",
        evidence: "Test evidence",
      };

      const result = createAppealObject(data);

      expect(result).toEqual({
        userId: "user-123",
        whisperId: "whisper-123",
        violationId: "violation-123",
        reason: "Test appeal",
        evidence: "Test evidence",
        status: AppealStatus.PENDING,
        submittedAt: new Date("2023-01-01T00:00:00Z"),
        createdAt: new Date("2023-01-01T00:00:00Z"),
        updatedAt: new Date("2023-01-01T00:00:00Z"),
      });
    });

    it("should handle optional evidence field", () => {
      const data = {
        userId: "user-123",
        whisperId: "whisper-123",
        violationId: "violation-123",
        reason: "Test appeal",
      };

      const result = createAppealObject(data);

      expect(result.evidence).toBeUndefined();
    });
  });

  describe("getAppealTimeLimit", () => {
    it("should return correct time limits for different reputation levels", () => {
      expect(getAppealTimeLimit("trusted")).toBe(7);
      expect(getAppealTimeLimit("verified")).toBe(7);
      expect(getAppealTimeLimit("standard")).toBe(14);
      expect(getAppealTimeLimit("flagged")).toBe(30);
      expect(getAppealTimeLimit("banned")).toBe(7);
    });

    it("should return default for unknown reputation level", () => {
      expect(getAppealTimeLimit("unknown")).toBe(7);
    });
  });

  describe("getDaysSinceViolation", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2023-01-03T00:00:00Z"));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should calculate days since violation", () => {
      const violationDate = new Date("2023-01-01T00:00:00Z");
      const result = getDaysSinceViolation(violationDate);

      expect(result).toBe(2);
    });

    it("should handle future violation dates", () => {
      const violationDate = new Date("2023-01-05T00:00:00Z");
      const result = getDaysSinceViolation(violationDate);

      expect(result).toBe(2);
    });
  });

  describe("getDaysSinceSubmission", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2023-01-03T00:00:00Z"));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should calculate days since submission", () => {
      const submissionDate = new Date("2023-01-01T00:00:00Z");
      const result = getDaysSinceSubmission(submissionDate);

      expect(result).toBe(2);
    });
  });

  describe("shouldAutoApprove", () => {
    it("should return true for low severity violations within threshold", () => {
      const violation = { severity: "low" } as any;
      const threshold = 0.5;

      // Mock Math.random to return a value below threshold
      jest.spyOn(Math, "random").mockReturnValue(0.3);

      expect(shouldAutoApprove(violation, threshold)).toBe(true);
    });

    it("should return false for high severity violations", () => {
      const violation = { severity: "high" } as any;
      const threshold = 0.5;

      expect(shouldAutoApprove(violation, threshold)).toBe(false);
    });

    it("should return false when random value exceeds threshold", () => {
      const violation = { severity: "low" } as any;
      const threshold = 0.5;

      // Mock Math.random to return a value above threshold
      jest.spyOn(Math, "random").mockReturnValue(0.7);

      expect(shouldAutoApprove(violation, threshold)).toBe(false);
    });
  });

  describe("getAutoApprovalThreshold", () => {
    it("should return correct thresholds for different reputation levels", () => {
      expect(getAutoApprovalThreshold("trusted")).toBe(0.3);
      expect(getAutoApprovalThreshold("verified")).toBe(0.5);
      expect(getAutoApprovalThreshold("standard")).toBe(0.7);
      expect(getAutoApprovalThreshold("flagged")).toBe(0.9);
      expect(getAutoApprovalThreshold("banned")).toBe(1.0);
    });

    it("should return default for unknown reputation level", () => {
      expect(getAutoApprovalThreshold("unknown")).toBe(1.0);
    });
  });

  describe("canUserAppeal", () => {
    it("should return true for non-banned users", () => {
      const reputation = { level: "standard" } as any;
      expect(canUserAppeal(reputation)).toBe(true);
    });

    it("should return false for banned users", () => {
      const reputation = { level: "banned" } as any;
      expect(canUserAppeal(reputation)).toBe(false);
    });
  });

  describe("isAppealExpired", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2023-01-10T00:00:00Z"));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should return true for expired appeal", () => {
      const appeal = {
        submittedAt: new Date("2023-01-01T00:00:00Z"),
      } as any;
      const timeLimit = 7;

      expect(isAppealExpired(appeal, timeLimit)).toBe(true);
    });

    it("should return false for active appeal", () => {
      const appeal = {
        submittedAt: new Date("2023-01-05T00:00:00Z"),
      } as any;
      const timeLimit = 7;

      expect(isAppealExpired(appeal, timeLimit)).toBe(false);
    });
  });

  describe("createExpirationUpdates", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2023-01-01T00:00:00Z"));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should create expiration updates", () => {
      const updates = createExpirationUpdates();

      expect(updates).toEqual({
        status: AppealStatus.EXPIRED,
        updatedAt: new Date("2023-01-01T00:00:00Z"),
      });
    });
  });

  describe("processReviewAction", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2023-01-01T00:00:00Z"));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should process approve action", () => {
      const data = {
        appealId: "appeal-123",
        action: "approve" as const,
        reason: "Valid appeal",
        moderatorId: "mod-123",
        reputationAdjustment: 5,
      };

      const result = processReviewAction(data);

      expect(result).toEqual({
        status: AppealStatus.APPROVED,
        resolution: {
          action: "approve",
          reason: "Valid appeal",
          moderatorId: "mod-123",
          reputationAdjustment: 5,
        },
        reviewedAt: new Date("2023-01-01T00:00:00Z"),
        reviewedBy: "mod-123",
        updatedAt: new Date("2023-01-01T00:00:00Z"),
      });
    });

    it("should process reject action", () => {
      const data = {
        appealId: "appeal-123",
        action: "reject" as const,
        reason: "Invalid appeal",
        moderatorId: "mod-123",
      };

      const result = processReviewAction(data);

      expect(result).toEqual({
        status: AppealStatus.REJECTED,
        resolution: {
          action: "reject",
          reason: "Invalid appeal",
          moderatorId: "mod-123",
          reputationAdjustment: 0,
        },
        reviewedAt: new Date("2023-01-01T00:00:00Z"),
        reviewedBy: "mod-123",
        updatedAt: new Date("2023-01-01T00:00:00Z"),
      });
    });
  });

  describe("createAutoApprovalUpdates", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2023-01-01T00:00:00Z"));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should create auto-approval updates", () => {
      const updates = createAutoApprovalUpdates();

      expect(updates).toEqual({
        status: AppealStatus.APPROVED,
        resolution: {
          action: "approve",
          reason: "Auto-approved for trusted user",
          moderatorId: "system",
          reputationAdjustment: REPUTATION_CONSTANTS.APPEAL_APPROVED_BONUS,
        },
        reviewedAt: new Date("2023-01-01T00:00:00Z"),
        reviewedBy: "system",
        updatedAt: new Date("2023-01-01T00:00:00Z"),
      });
    });
  });

  describe("calculateAppealStats", () => {
    it("should calculate correct statistics", () => {
      const appeals = [
        { status: AppealStatus.PENDING },
        { status: AppealStatus.APPROVED },
        { status: AppealStatus.REJECTED },
        { status: AppealStatus.EXPIRED },
        { status: AppealStatus.APPROVED },
      ] as any[];

      const stats = calculateAppealStats(appeals);

      expect(stats).toEqual({
        total: 5,
        pending: 1,
        approved: 2,
        rejected: 1,
        expired: 1,
        approvalRate: 66.66666666666666, // 2 approved / 3 resolved
      });
    });

    it("should handle empty appeals list", () => {
      const stats = calculateAppealStats([]);

      expect(stats).toEqual({
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        expired: 0,
        approvalRate: 0,
      });
    });

    it("should handle no resolved appeals", () => {
      const appeals = [
        { status: AppealStatus.PENDING },
        { status: AppealStatus.EXPIRED },
      ] as any[];

      const stats = calculateAppealStats(appeals);

      expect(stats.approvalRate).toBe(0);
    });
  });

  describe("getDefaultAppealStats", () => {
    it("should return default appeal stats", () => {
      const stats = getDefaultAppealStats();

      expect(stats).toEqual({
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        expired: 0,
        approvalRate: 0,
      });
    });
  });

  describe("canReviewAppeal", () => {
    it("should return true for pending appeals", () => {
      const appeal = { status: AppealStatus.PENDING } as any;
      expect(canReviewAppeal(appeal)).toBe(true);
    });

    it("should return false for non-pending appeals", () => {
      const appeal = { status: AppealStatus.APPROVED } as any;
      expect(canReviewAppeal(appeal)).toBe(false);
    });
  });

  describe("getReputationAdjustment", () => {
    it("should return custom adjustment when provided", () => {
      const result = getReputationAdjustment("approve", 10);
      expect(result).toBe(10);
    });

    it("should return default adjustment for approve action", () => {
      const result = getReputationAdjustment("approve");
      expect(result).toBe(REPUTATION_CONSTANTS.APPEAL_APPROVED_BONUS);
    });

    it("should return default adjustment for reject action", () => {
      const result = getReputationAdjustment("reject");
      expect(result).toBe(REPUTATION_CONSTANTS.APPEAL_REJECTED_PENALTY);
    });

    it("should return half bonus for partial_approve action", () => {
      const result = getReputationAdjustment("partial_approve");
      expect(result).toBe(REPUTATION_CONSTANTS.APPEAL_APPROVED_BONUS / 2);
    });
  });

  describe("formatReputationReason", () => {
    it("should format reputation reason correctly", () => {
      const result = formatReputationReason("approve", "Valid appeal");
      expect(result).toBe("Appeal approve: Valid appeal");
    });
  });

  describe("shouldAutoApproveForUser", () => {
    it("should return true for trusted users with low severity violation", () => {
      const reputation = { level: "trusted" } as any;
      const violation = { severity: "low" } as any;

      jest.spyOn(Math, "random").mockReturnValue(0.2);

      expect(shouldAutoApproveForUser(reputation, violation)).toBe(true);
    });

    it("should return false for non-trusted users", () => {
      const reputation = { level: "standard" } as any;
      const violation = { severity: "low" } as any;

      expect(shouldAutoApproveForUser(reputation, violation)).toBe(false);
    });

    it("should return false for high severity violations", () => {
      const reputation = { level: "trusted" } as any;
      const violation = { severity: "high" } as any;

      expect(shouldAutoApproveForUser(reputation, violation)).toBe(false);
    });
  });

  describe("getAppealStatusDisplay", () => {
    it("should return correct display names", () => {
      expect(getAppealStatusDisplay(AppealStatus.PENDING)).toBe("Pending");
      expect(getAppealStatusDisplay(AppealStatus.APPROVED)).toBe("Approved");
      expect(getAppealStatusDisplay(AppealStatus.REJECTED)).toBe("Rejected");
      expect(getAppealStatusDisplay(AppealStatus.EXPIRED)).toBe("Expired");
    });
  });

  describe("isAppealResolved", () => {
    it("should return true for approved appeals", () => {
      const appeal = { status: AppealStatus.APPROVED } as any;
      expect(isAppealResolved(appeal)).toBe(true);
    });

    it("should return true for rejected appeals", () => {
      const appeal = { status: AppealStatus.REJECTED } as any;
      expect(isAppealResolved(appeal)).toBe(true);
    });

    it("should return false for pending appeals", () => {
      const appeal = { status: AppealStatus.PENDING } as any;
      expect(isAppealResolved(appeal)).toBe(false);
    });

    it("should return false for expired appeals", () => {
      const appeal = { status: AppealStatus.EXPIRED } as any;
      expect(isAppealResolved(appeal)).toBe(false);
    });
  });

  describe("isAppealActive", () => {
    it("should return true for pending appeals", () => {
      const appeal = { status: AppealStatus.PENDING } as any;
      expect(isAppealActive(appeal)).toBe(true);
    });

    it("should return false for non-pending appeals", () => {
      const appeal = { status: AppealStatus.APPROVED } as any;
      expect(isAppealActive(appeal)).toBe(false);
    });
  });
});
