/**
 * Tests for Suspension Utilities
 */

import {
  validateSuspensionData,
  calculateSuspensionEndDate,
  generateSuspensionId,
  createSuspensionObject,
  determineAutomaticSuspension,
  isSuspensionExpired,
  canUserAppeal,
  getBanTypeForSuspension,
  processReviewAction,
  calculateSuspensionStats,
  determineUserSuspensionStatus,
  formatAutomaticSuspensionReason,
  shouldAffectReputation,
  getReputationPenalty,
  getReputationRestorationBonus,
  createDeactivationUpdates,
  shouldRestoreReputationOnExpiry,
  DEFAULT_DURATIONS,
  SUSPENSION_THRESHOLDS,
} from "../utils/suspensionUtils";
import { SuspensionType, BanType } from "../types";
import { TIME_CONSTANTS, REPUTATION_CONSTANTS } from "../constants";

// Mock constants
jest.mock("../constants", () => ({
  TIME_CONSTANTS: {
    WARNING_DURATION: 0,
    TEMPORARY_SUSPENSION_DURATION: 24 * 60 * 60 * 1000, // 24 hours
    EXTENDED_SUSPENSION_DURATION: 7 * 24 * 60 * 60 * 1000, // 7 days
    PERMANENT_SUSPENSION_DURATION: 100 * 365 * 24 * 60 * 60 * 1000, // 100 years
  },
  REPUTATION_CONSTANTS: {
    SUSPENSION_PENALTY: -50,
    SUSPENSION_RESTORATION_BONUS: 10,
  },
}));

describe("SuspensionUtils", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Constants", () => {
    it("should export default durations", () => {
      expect(DEFAULT_DURATIONS).toEqual({
        warning: 0,
        temporary: 24 * 60 * 60 * 1000,
        permanent: 0,
      });
    });

    it("should export suspension thresholds", () => {
      expect(SUSPENSION_THRESHOLDS).toEqual({
        FIRST_VIOLATION: SuspensionType.WARNING,
        SECOND_VIOLATION: SuspensionType.TEMPORARY,
        THIRD_VIOLATION: SuspensionType.TEMPORARY,
        FOURTH_VIOLATION: SuspensionType.PERMANENT,
      });
    });
  });

  describe("validateSuspensionData", () => {
    it("should validate valid suspension data", () => {
      const validData = {
        userId: "user123",
        reason: "Test violation",
        type: SuspensionType.TEMPORARY,
        duration: 24 * 60 * 60 * 1000,
      };

      expect(() => validateSuspensionData(validData)).not.toThrow();
    });

    it("should throw error for temporary suspension without duration", () => {
      const invalidData = {
        userId: "user123",
        reason: "Test violation",
        type: SuspensionType.TEMPORARY,
      };

      expect(() => validateSuspensionData(invalidData)).toThrow(
        "Temporary suspensions require a duration"
      );
    });

    it("should throw error for permanent suspension with duration", () => {
      const invalidData = {
        userId: "user123",
        reason: "Test violation",
        type: SuspensionType.PERMANENT,
        duration: 24 * 60 * 60 * 1000,
      };

      expect(() => validateSuspensionData(invalidData)).toThrow(
        "Permanent suspensions cannot have a duration"
      );
    });

    it("should validate warning without duration", () => {
      const validData = {
        userId: "user123",
        reason: "Test warning",
        type: SuspensionType.WARNING,
      };

      expect(() => validateSuspensionData(validData)).not.toThrow();
    });
  });

  describe("calculateSuspensionEndDate", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2023-01-01T00:00:00Z"));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should calculate end date for temporary suspension", () => {
      const endDate = calculateSuspensionEndDate(
        SuspensionType.TEMPORARY,
        24 * 60 * 60 * 1000
      );

      expect(endDate).toEqual(new Date("2023-01-02T00:00:00Z"));
    });

    it("should calculate end date for permanent suspension", () => {
      const endDate = calculateSuspensionEndDate(SuspensionType.PERMANENT);

      expect(endDate).toEqual(
        new Date(Date.now() + TIME_CONSTANTS.PERMANENT_SUSPENSION_DURATION)
      );
    });

    it("should use default duration for warning", () => {
      const endDate = calculateSuspensionEndDate(SuspensionType.WARNING);

      expect(endDate).toEqual(new Date("2023-01-01T00:00:00Z"));
    });

    it("should use default duration for temporary suspension", () => {
      const endDate = calculateSuspensionEndDate(SuspensionType.TEMPORARY);

      expect(endDate).toEqual(new Date("2023-01-02T00:00:00Z"));
    });
  });

  describe("generateSuspensionId", () => {
    it("should generate unique suspension IDs", () => {
      const id1 = generateSuspensionId();
      const id2 = generateSuspensionId();

      expect(id1).toMatch(/^suspension-\d+-\w{9}$/);
      expect(id2).toMatch(/^suspension-\d+-\w{9}$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe("createSuspensionObject", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2023-01-01T00:00:00Z"));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should create suspension object with all fields", () => {
      const data = {
        userId: "user123",
        reason: "Test violation",
        type: SuspensionType.TEMPORARY,
        duration: 24 * 60 * 60 * 1000,
        moderatorId: "mod123",
      };

      const result = createSuspensionObject(data);

      expect(result).toEqual({
        userId: "user123",
        reason: "Test violation",
        type: SuspensionType.TEMPORARY,
        banType: BanType.CONTENT_VISIBLE,
        moderatorId: "mod123",
        startDate: new Date("2023-01-01T00:00:00Z"),
        endDate: new Date("2023-01-02T00:00:00Z"),
        isActive: true,
        createdAt: new Date("2023-01-01T00:00:00Z"),
        updatedAt: new Date("2023-01-01T00:00:00Z"),
      });
    });

    it("should use system as default moderator", () => {
      const data = {
        userId: "user123",
        reason: "Test violation",
        type: SuspensionType.WARNING,
      };

      const result = createSuspensionObject(data);

      expect(result.moderatorId).toBe("system");
    });
  });

  describe("determineAutomaticSuspension", () => {
    it("should return warning for first violation", () => {
      const result = determineAutomaticSuspension(1);

      expect(result).toEqual({
        type: SuspensionType.WARNING,
      });
    });

    it("should return temporary suspension for second violation", () => {
      const result = determineAutomaticSuspension(2);

      expect(result).toEqual({
        type: SuspensionType.TEMPORARY,
        duration: TIME_CONSTANTS.TEMPORARY_SUSPENSION_DURATION,
      });
    });

    it("should return extended temporary suspension for third violation", () => {
      const result = determineAutomaticSuspension(3);

      expect(result).toEqual({
        type: SuspensionType.TEMPORARY,
        duration: TIME_CONSTANTS.EXTENDED_SUSPENSION_DURATION,
      });
    });

    it("should return permanent suspension for fourth violation", () => {
      const result = determineAutomaticSuspension(4);

      expect(result).toEqual({
        type: SuspensionType.PERMANENT,
      });
    });

    it("should return permanent suspension for higher violation counts", () => {
      const result = determineAutomaticSuspension(10);

      expect(result).toEqual({
        type: SuspensionType.PERMANENT,
      });
    });
  });

  describe("isSuspensionExpired", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2023-01-02T00:00:00Z"));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should return true for expired suspension", () => {
      const suspension = {
        id: "test",
        userId: "user123",
        reason: "Test",
        type: SuspensionType.TEMPORARY,
        banType: BanType.NONE,
        moderatorId: "system",
        startDate: new Date("2023-01-01T00:00:00Z"),
        endDate: new Date("2023-01-01T12:00:00Z"),
        isActive: true,
        createdAt: new Date("2023-01-01T00:00:00Z"),
        updatedAt: new Date("2023-01-01T00:00:00Z"),
      };

      expect(isSuspensionExpired(suspension)).toBe(true);
    });

    it("should return false for active suspension", () => {
      const suspension = {
        id: "test",
        userId: "user123",
        reason: "Test",
        type: SuspensionType.TEMPORARY,
        banType: BanType.NONE,
        moderatorId: "system",
        startDate: new Date("2023-01-01T00:00:00Z"),
        endDate: new Date("2023-01-03T00:00:00Z"),
        isActive: true,
        createdAt: new Date("2023-01-01T00:00:00Z"),
        updatedAt: new Date("2023-01-01T00:00:00Z"),
      };

      expect(isSuspensionExpired(suspension)).toBe(false);
    });

    it("should return false for inactive suspension", () => {
      const suspension = {
        id: "test",
        userId: "user123",
        reason: "Test",
        type: SuspensionType.TEMPORARY,
        banType: BanType.NONE,
        moderatorId: "system",
        startDate: new Date("2023-01-01T00:00:00Z"),
        endDate: new Date("2023-01-01T12:00:00Z"),
        isActive: false,
        createdAt: new Date("2023-01-01T00:00:00Z"),
        updatedAt: new Date("2023-01-01T00:00:00Z"),
      };

      expect(isSuspensionExpired(suspension)).toBe(false);
    });

    it("should return false for suspension without end date", () => {
      const suspension = {
        id: "test",
        userId: "user123",
        reason: "Test",
        type: SuspensionType.TEMPORARY,
        banType: BanType.NONE,
        moderatorId: "system",
        startDate: new Date("2023-01-01T00:00:00Z"),
        endDate: undefined,
        isActive: true,
        createdAt: new Date("2023-01-01T00:00:00Z"),
        updatedAt: new Date("2023-01-01T00:00:00Z"),
      };

      expect(isSuspensionExpired(suspension)).toBe(false);
    });
  });

  describe("canUserAppeal", () => {
    it("should return true if user has non-permanent suspensions", () => {
      const suspensions = [
        {
          id: "1",
          type: SuspensionType.TEMPORARY,
        } as any,
        {
          id: "2",
          type: SuspensionType.WARNING,
        } as any,
      ];

      expect(canUserAppeal(suspensions)).toBe(true);
    });

    it("should return false if user only has permanent suspensions", () => {
      const suspensions = [
        {
          id: "1",
          type: SuspensionType.PERMANENT,
        } as any,
      ];

      expect(canUserAppeal(suspensions)).toBe(false);
    });

    it("should return false for empty suspensions", () => {
      expect(canUserAppeal([])).toBe(false);
    });
  });

  describe("getBanTypeForSuspension", () => {
    it("should return NONE for warning", () => {
      expect(getBanTypeForSuspension(SuspensionType.WARNING)).toBe(
        BanType.NONE
      );
    });

    it("should return CONTENT_VISIBLE for temporary suspension", () => {
      expect(getBanTypeForSuspension(SuspensionType.TEMPORARY)).toBe(
        BanType.CONTENT_VISIBLE
      );
    });

    it("should return CONTENT_HIDDEN for permanent suspension", () => {
      expect(getBanTypeForSuspension(SuspensionType.PERMANENT)).toBe(
        BanType.CONTENT_HIDDEN
      );
    });
  });

  describe("processReviewAction", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2023-01-02T00:00:00Z"));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    const mockSuspension = {
      id: "test",
      userId: "user123",
      reason: "Test",
      type: SuspensionType.TEMPORARY,
      banType: BanType.NONE,
      moderatorId: "system",
      startDate: new Date("2023-01-01T00:00:00Z"),
      endDate: new Date("2023-01-03T00:00:00Z"),
      isActive: true,
      createdAt: new Date("2023-01-01T00:00:00Z"),
      updatedAt: new Date("2023-01-01T00:00:00Z"),
    };

    it("should extend temporary suspension", () => {
      const updates = processReviewAction(
        mockSuspension,
        "extend",
        24 * 60 * 60 * 1000
      );

      expect(updates).toEqual({
        updatedAt: new Date("2023-01-02T00:00:00Z"),
        endDate: new Date("2023-01-04T00:00:00Z"),
      });
    });

    it("should reduce temporary suspension", () => {
      const updates = processReviewAction(
        mockSuspension,
        "reduce",
        12 * 60 * 60 * 1000
      );

      expect(updates).toEqual({
        updatedAt: new Date("2023-01-02T00:00:00Z"),
        endDate: new Date("2023-01-02T12:00:00Z"),
      });
    });

    it("should remove suspension", () => {
      const updates = processReviewAction(mockSuspension, "remove");

      expect(updates).toEqual({
        updatedAt: new Date("2023-01-02T00:00:00Z"),
        isActive: false,
      });
    });

    it("should make suspension permanent", () => {
      const updates = processReviewAction(mockSuspension, "make_permanent");

      expect(updates).toEqual({
        updatedAt: new Date("2023-01-02T00:00:00Z"),
        type: SuspensionType.PERMANENT,
        endDate: new Date(
          Date.now() + TIME_CONSTANTS.PERMANENT_SUSPENSION_DURATION
        ),
      });
    });

    it("should throw error when extending permanent suspension", () => {
      const permanentSuspension = {
        ...mockSuspension,
        type: SuspensionType.PERMANENT,
      };

      expect(() =>
        processReviewAction(permanentSuspension, "extend", 1000)
      ).toThrow("Cannot extend permanent suspension");
    });

    it("should throw error when reducing permanent suspension", () => {
      const permanentSuspension = {
        ...mockSuspension,
        type: SuspensionType.PERMANENT,
      };

      expect(() =>
        processReviewAction(permanentSuspension, "reduce", 1000)
      ).toThrow("Cannot reduce permanent suspension");
    });
  });

  describe("calculateSuspensionStats", () => {
    it("should calculate correct statistics", () => {
      const suspensions = [
        { isActive: true, type: SuspensionType.WARNING },
        { isActive: true, type: SuspensionType.TEMPORARY },
        { isActive: true, type: SuspensionType.PERMANENT },
        { isActive: false, type: SuspensionType.TEMPORARY },
        { isActive: false, type: SuspensionType.WARNING },
      ] as any[];

      const stats = calculateSuspensionStats(suspensions);

      expect(stats).toEqual({
        total: 5,
        active: 3,
        warnings: 2,
        temporary: 2,
        permanent: 1,
        expired: 2,
      });
    });

    it("should return zero stats for empty list", () => {
      const stats = calculateSuspensionStats([]);

      expect(stats).toEqual({
        total: 0,
        active: 0,
        warnings: 0,
        temporary: 0,
        permanent: 0,
        expired: 0,
      });
    });
  });

  describe("determineUserSuspensionStatus", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2023-01-02T00:00:00Z"));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should return suspended status for active suspensions", () => {
      const suspensions = [
        {
          id: "1",
          isActive: true,
          endDate: new Date("2023-01-03T00:00:00Z"),
          type: SuspensionType.TEMPORARY,
        },
        {
          id: "2",
          isActive: true,
          endDate: new Date("2023-01-04T00:00:00Z"),
          type: SuspensionType.WARNING,
        },
      ] as any[];

      const status = determineUserSuspensionStatus(suspensions);

      expect(status).toEqual({
        suspended: true,
        suspensions: suspensions,
        canAppeal: true,
      });
    });

    it("should return not suspended for expired suspensions", () => {
      const suspensions = [
        {
          id: "1",
          isActive: true,
          endDate: new Date("2023-01-01T00:00:00Z"),
          type: SuspensionType.TEMPORARY,
        },
      ] as any[];

      const status = determineUserSuspensionStatus(suspensions);

      expect(status).toEqual({
        suspended: false,
        suspensions: [],
        canAppeal: false,
      });
    });

    it("should return not suspended for inactive suspensions", () => {
      const suspensions = [
        {
          id: "1",
          isActive: false,
          endDate: new Date("2023-01-03T00:00:00Z"),
          type: SuspensionType.TEMPORARY,
        },
      ] as any[];

      const status = determineUserSuspensionStatus(suspensions);

      expect(status).toEqual({
        suspended: false,
        suspensions: [],
        canAppeal: false,
      });
    });

    it("should return canAppeal false for permanent suspensions only", () => {
      const suspensions = [
        {
          id: "1",
          isActive: true,
          endDate: new Date("2023-01-03T00:00:00Z"),
          type: SuspensionType.PERMANENT,
        },
      ] as any[];

      const status = determineUserSuspensionStatus(suspensions);

      expect(status).toEqual({
        suspended: true,
        suspensions: suspensions,
        canAppeal: false,
      });
    });
  });

  describe("formatAutomaticSuspensionReason", () => {
    it("should format reason with violation count", () => {
      const result = formatAutomaticSuspensionReason("Spam", 3);

      expect(result).toBe("Automatic suspension: Spam (violation #3)");
    });
  });

  describe("shouldAffectReputation", () => {
    it("should return false for warning", () => {
      expect(shouldAffectReputation(SuspensionType.WARNING)).toBe(false);
    });

    it("should return true for temporary suspension", () => {
      expect(shouldAffectReputation(SuspensionType.TEMPORARY)).toBe(true);
    });

    it("should return true for permanent suspension", () => {
      expect(shouldAffectReputation(SuspensionType.PERMANENT)).toBe(true);
    });
  });

  describe("getReputationPenalty", () => {
    it("should return 0 for warning", () => {
      expect(getReputationPenalty(SuspensionType.WARNING)).toBe(0);
    });

    it("should return penalty for temporary suspension", () => {
      expect(getReputationPenalty(SuspensionType.TEMPORARY)).toBe(
        REPUTATION_CONSTANTS.SUSPENSION_PENALTY
      );
    });

    it("should return penalty for permanent suspension", () => {
      expect(getReputationPenalty(SuspensionType.PERMANENT)).toBe(
        REPUTATION_CONSTANTS.SUSPENSION_PENALTY
      );
    });
  });

  describe("getReputationRestorationBonus", () => {
    it("should return restoration bonus", () => {
      expect(getReputationRestorationBonus()).toBe(
        REPUTATION_CONSTANTS.SUSPENSION_RESTORATION_BONUS
      );
    });
  });

  describe("createDeactivationUpdates", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2023-01-02T00:00:00Z"));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should create deactivation updates", () => {
      const updates = createDeactivationUpdates();

      expect(updates).toEqual({
        isActive: false,
        updatedAt: new Date("2023-01-02T00:00:00Z"),
      });
    });
  });

  describe("shouldRestoreReputationOnExpiry", () => {
    it("should return true for temporary suspension", () => {
      expect(shouldRestoreReputationOnExpiry(SuspensionType.TEMPORARY)).toBe(
        true
      );
    });

    it("should return false for warning", () => {
      expect(shouldRestoreReputationOnExpiry(SuspensionType.WARNING)).toBe(
        false
      );
    });

    it("should return false for permanent suspension", () => {
      expect(shouldRestoreReputationOnExpiry(SuspensionType.PERMANENT)).toBe(
        false
      );
    });
  });
});
