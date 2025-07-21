/**
 * Tests for AppealService
 */

import { AppealService } from "../services/appealService";
import { AppealRepository } from "../repositories/AppealRepository";
import { getReputationService } from "../services/reputationService";
import {
  Appeal,
  AppealStatus,
  UserReputation,
  ViolationRecord,
  ViolationType,
} from "../types";

// Mock the services
jest.mock("../repositories/FirebaseAppealRepository");
jest.mock("../services/reputationService");
jest.mock("../utils/appealUtils", () => ({
  ...jest.requireActual("../utils/appealUtils"),
  validateAppealData: jest.fn(),
  createAppealObject: jest.fn(() => ({
    userId: "user123",
    whisperId: "whisper123",
    violationId: "violation123",
    reason: "This was a misunderstanding",
    evidence: "Additional context",
    status: "pending",
    submittedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  })),
  generateAppealId: jest.fn(() => "appeal123"),
  shouldAutoApproveForUser: jest.fn(),
  createAutoApprovalUpdates: jest.fn(() => ({
    status: "approved",
    reviewedAt: new Date(),
    reviewedBy: "system",
    resolution: {
      action: "approve",
      reason: "Auto-approved for trusted user",
      moderatorId: "system",
      reputationAdjustment: 5,
    },
    updatedAt: new Date(),
  })),
  processReviewAction: jest.fn(() => ({
    status: "approved",
    reviewedAt: new Date(),
    reviewedBy: "moderator123",
    resolution: {
      action: "approve",
      reason: "Appeal approved after review",
      moderatorId: "moderator123",
      reputationAdjustment: 5,
    },
    resolutionReason: "Appeal approved after review",
    updatedAt: new Date(),
  })),
  canReviewAppeal: jest.fn(() => true),
  getReputationAdjustment: jest.fn(() => 5),
  formatReputationReason: jest.fn(
    () => "Appeal approve: Appeal approved after review"
  ),
  getAppealTimeLimit: jest.fn(() => 7),
  isAppealExpired: jest.fn(() => true),
  createExpirationUpdates: jest.fn(() => ({
    status: "expired",
    updatedAt: new Date(),
  })),
  calculateAppealStats: jest.fn(() => ({
    total: 3,
    pending: 1,
    approved: 1,
    rejected: 1,
    expired: 0,
    approvalRate: 50,
  })),
  getDefaultAppealStats: jest.fn(() => ({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    expired: 0,
    approvalRate: 0,
  })),
}));

// Create mock repository
const mockRepository: jest.Mocked<AppealRepository> = {
  getAll: jest.fn(),
  getById: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  getByUser: jest.fn(),
  getPending: jest.fn(),
  getByViolation: jest.fn(),
};

const mockReputationService = {
  getUserReputation: jest.fn(),
  adjustUserReputationScore: jest.fn(),
};

// Mock the service getters to return our mock objects
jest.mocked(getReputationService).mockReturnValue(mockReputationService as any);

// Mock the FirebaseAppealRepository constructor
jest.mock("../repositories/FirebaseAppealRepository", () => ({
  FirebaseAppealRepository: jest.fn().mockImplementation(() => mockRepository),
}));

describe("AppealService", () => {
  let appealService: AppealService;
  let mockRepository: jest.Mocked<AppealRepository>;
  let mockReputationService: any;

  const mockUserReputation: UserReputation = {
    userId: "user123",
    score: 75,
    level: "verified",
    totalWhispers: 50,
    approvedWhispers: 45,
    flaggedWhispers: 3,
    rejectedWhispers: 2,
    violationHistory: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockViolationRecord: ViolationRecord = {
    id: "violation123",
    whisperId: "whisper123",
    violationType: ViolationType.HARASSMENT,
    severity: "medium",
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    resolved: false,
  };

  const mockAppeal: Appeal = {
    id: "appeal123",
    userId: "user123",
    whisperId: "whisper123",
    violationId: "violation123",
    reason: "This was a misunderstanding",
    evidence: "Additional context",
    status: AppealStatus.PENDING,
    submittedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const createAppealData = {
    userId: "user123",
    whisperId: "whisper123",
    violationId: "violation123",
    reason: "This was a misunderstanding",
    evidence: "Additional context",
  };

  const appealReviewData = {
    appealId: "appeal123",
    action: "approve" as const,
    reason: "Appeal approved after review",
    moderatorId: "moderator123",
    reputationAdjustment: 5,
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock repository
    mockRepository = {
      getAll: jest.fn(),
      getById: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      getByUser: jest.fn(),
      getPending: jest.fn(),
      getByViolation: jest.fn(),
    };

    // Create mock reputation service
    mockReputationService = {
      getUserReputation: jest.fn().mockResolvedValue(mockUserReputation),
      adjustUserReputationScore: jest.fn().mockResolvedValue(undefined),
    };

    // Mock the service getter
    const { getReputationService } = jest.requireMock(
      "../services/reputationService"
    );
    getReputationService.mockReturnValue(mockReputationService);

    // Create service instance using singleton pattern
    appealService = AppealService.getInstance();

    // Mock the private repository property
    (appealService as any).repository = mockRepository;

    // Mock the private getViolation method
    jest
      .spyOn(appealService as any, "getViolation")
      .mockResolvedValue(mockViolationRecord);

    // Mock appealUtils functions
    const appealUtils = jest.requireMock("../utils/appealUtils");
    appealUtils.shouldAutoApproveForUser.mockReturnValue(false);
  });

  afterEach(() => {
    AppealService.resetInstance();
  });

  describe("Singleton Pattern", () => {
    it("should return the same instance", () => {
      const instance1 = AppealService.getInstance();
      const instance2 = AppealService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("should reset instance correctly", () => {
      const instance1 = AppealService.getInstance();
      AppealService.resetInstance();
      const instance2 = AppealService.getInstance();
      expect(instance1).not.toBe(instance2);
    });

    it("should destroy instance correctly", () => {
      const instance = AppealService.getInstance();
      AppealService.destroyInstance();
      const newInstance = AppealService.getInstance();
      expect(instance).not.toBe(newInstance);
    });
  });

  describe("getAllAppeals", () => {
    it("should get all appeals", async () => {
      const mockAppeals = [mockAppeal];
      mockRepository.getAll.mockResolvedValue(mockAppeals);

      const result = await appealService.getAllAppeals();

      expect(result).toEqual(mockAppeals);
      expect(mockRepository.getAll).toHaveBeenCalled();
    });

    it("should handle repository errors", async () => {
      mockRepository.getAll.mockRejectedValue(new Error("Database error"));

      await expect(appealService.getAllAppeals()).rejects.toThrow(
        "Failed to get all appeals"
      );
    });
  });

  describe("createAppeal", () => {
    it("should create an appeal successfully", async () => {
      mockRepository.save.mockResolvedValue(undefined);

      const result = await appealService.createAppeal(createAppealData);

      expect(result).toBeDefined();
      expect(result.userId).toBe(createAppealData.userId);
      expect(result.whisperId).toBe(createAppealData.whisperId);
      expect(result.violationId).toBe(createAppealData.violationId);
      expect(result.reason).toBe(createAppealData.reason);
      expect(result.status).toBe(AppealStatus.PENDING);
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it("should handle banned users", async () => {
      const bannedReputation = { ...mockUserReputation, level: "banned" };
      mockReputationService.getUserReputation.mockResolvedValue(
        bannedReputation
      );

      // Mock validateAppealData to throw error for banned users
      const appealUtils = jest.requireMock("../utils/appealUtils");
      appealUtils.validateAppealData.mockImplementation(() => {
        throw new Error("Banned users cannot submit appeals");
      });

      await expect(
        appealService.createAppeal(createAppealData)
      ).rejects.toThrow("Banned users cannot submit appeals");
    });

    it("should handle missing violation", async () => {
      // Mock the private getViolation method to return null
      jest.spyOn(appealService as any, "getViolation").mockResolvedValue(null);

      // Mock validateAppealData to throw error for missing violation
      const appealUtils = jest.requireMock("../utils/appealUtils");
      appealUtils.validateAppealData.mockImplementation(() => {
        throw new Error("Violation not found");
      });

      await expect(
        appealService.createAppeal(createAppealData)
      ).rejects.toThrow("Violation not found");
    });

    it("should handle expired appeal time limit", async () => {
      const oldViolation = {
        ...mockViolationRecord,
        timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      };
      jest
        .spyOn(appealService as any, "getViolation")
        .mockResolvedValue(oldViolation);

      // Mock validateAppealData to throw error for expired time limit
      const appealUtils = jest.requireMock("../utils/appealUtils");
      appealUtils.validateAppealData.mockImplementation(() => {
        throw new Error(
          "Appeal time limit exceeded. You have 7 days to appeal."
        );
      });

      await expect(
        appealService.createAppeal(createAppealData)
      ).rejects.toThrow("Appeal time limit exceeded");
    });

    it("should handle repository errors", async () => {
      mockRepository.save.mockRejectedValue(new Error("Database error"));

      // Reset validateAppealData to not throw
      const appealUtils = jest.requireMock("../utils/appealUtils");
      appealUtils.validateAppealData.mockImplementation(() => {});

      await expect(
        appealService.createAppeal(createAppealData)
      ).rejects.toThrow("Database error");
    });
  });

  describe("getAppeal", () => {
    it("should get an appeal by ID", async () => {
      mockRepository.getById.mockResolvedValue(mockAppeal);

      const result = await appealService.getAppeal("appeal123");

      expect(result).toEqual(mockAppeal);
      expect(mockRepository.getById).toHaveBeenCalledWith("appeal123");
    });

    it("should return null for non-existent appeal", async () => {
      mockRepository.getById.mockResolvedValue(null);

      const result = await appealService.getAppeal("nonexistent");

      expect(result).toBeNull();
    });

    it("should handle repository errors", async () => {
      mockRepository.getById.mockRejectedValue(new Error("Database error"));

      const result = await appealService.getAppeal("appeal123");
      expect(result).toBeNull();
    });
  });

  describe("getUserAppeals", () => {
    it("should get appeals by user ID", async () => {
      const mockAppeals = [mockAppeal];
      mockRepository.getByUser.mockResolvedValue(mockAppeals);

      const result = await appealService.getUserAppeals("user123");

      expect(result).toEqual(mockAppeals);
      expect(mockRepository.getByUser).toHaveBeenCalledWith("user123");
    });

    it("should handle repository errors", async () => {
      mockRepository.getByUser.mockRejectedValue(new Error("Database error"));

      const result = await appealService.getUserAppeals("user123");
      expect(result).toEqual([]);
    });
  });

  describe("getPendingAppeals", () => {
    it("should get pending appeals", async () => {
      const mockAppeals = [mockAppeal];
      mockRepository.getPending.mockResolvedValue(mockAppeals);

      const result = await appealService.getPendingAppeals();

      expect(result).toEqual(mockAppeals);
      expect(mockRepository.getPending).toHaveBeenCalled();
    });

    it("should handle repository errors", async () => {
      mockRepository.getPending.mockRejectedValue(new Error("Database error"));

      const result = await appealService.getPendingAppeals();
      expect(result).toEqual([]);
    });
  });

  describe("reviewAppeal", () => {
    it("should review an appeal successfully", async () => {
      mockRepository.getById.mockResolvedValue(mockAppeal);
      mockRepository.update.mockResolvedValue(undefined);

      await appealService.reviewAppeal(appealReviewData);

      expect(mockRepository.update).toHaveBeenCalledWith("appeal123", {
        status: AppealStatus.APPROVED,
        reviewedAt: expect.any(Date),
        reviewedBy: "moderator123",
        resolution: {
          action: "approve",
          reason: "Appeal approved after review",
          moderatorId: "moderator123",
          reputationAdjustment: 5,
        },
        resolutionReason: "Appeal approved after review",
        updatedAt: expect.any(Date),
      });
    });

    it("should handle non-existent appeal", async () => {
      mockRepository.getById.mockResolvedValue(null);

      await expect(
        appealService.reviewAppeal(appealReviewData)
      ).rejects.toThrow("Appeal not found");
    });

    it("should handle already reviewed appeal", async () => {
      const reviewedAppeal = {
        ...mockAppeal,
        status: AppealStatus.APPROVED,
        reviewedAt: new Date(),
      };
      mockRepository.getById.mockResolvedValue(reviewedAppeal);

      // Mock canReviewAppeal to return false for already reviewed appeals
      const appealUtils = jest.requireMock("../utils/appealUtils");
      appealUtils.canReviewAppeal.mockReturnValue(false);

      await expect(
        appealService.reviewAppeal(appealReviewData)
      ).rejects.toThrow("Appeal has already been reviewed");
    });

    it("should handle repository errors", async () => {
      mockRepository.getById.mockResolvedValue(mockAppeal);
      mockRepository.update.mockRejectedValue(new Error("Database error"));

      // Reset canReviewAppeal to return true
      const appealUtils = jest.requireMock("../utils/appealUtils");
      appealUtils.canReviewAppeal.mockReturnValue(true);

      await expect(
        appealService.reviewAppeal(appealReviewData)
      ).rejects.toThrow("Database error");
    });
  });

  describe("checkAppealExpiration", () => {
    it("should check and update expired appeals", async () => {
      const expiredAppeal = {
        ...mockAppeal,
        submittedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      };
      const mockAppeals = [expiredAppeal];
      mockRepository.getPending.mockResolvedValue(mockAppeals);
      mockRepository.update.mockResolvedValue(undefined);

      await appealService.checkAppealExpiration();

      expect(mockRepository.update).toHaveBeenCalledWith("appeal123", {
        status: AppealStatus.EXPIRED,
        updatedAt: expect.any(Date),
      });
    });

    it("should handle repository errors", async () => {
      mockRepository.getPending.mockRejectedValue(new Error("Database error"));

      // Should not throw error, just log it
      await expect(
        appealService.checkAppealExpiration()
      ).resolves.toBeUndefined();
    });
  });

  describe("getAppealStats", () => {
    it("should get appeal statistics", async () => {
      const mockAppeals = [
        { ...mockAppeal, status: AppealStatus.PENDING },
        { ...mockAppeal, id: "appeal2", status: AppealStatus.APPROVED },
        { ...mockAppeal, id: "appeal3", status: AppealStatus.REJECTED },
      ];
      mockRepository.getAll.mockResolvedValue(mockAppeals);

      const result = await appealService.getAppealStats();

      expect(result).toBeDefined();
      expect(result.total).toBe(3);
      expect(result.pending).toBe(1);
      expect(result.approved).toBe(1);
      expect(result.rejected).toBe(1);
      expect(result.approvalRate).toBeGreaterThan(0);
    });

    it("should handle empty appeals", async () => {
      mockRepository.getAll.mockResolvedValue([]);

      // Mock calculateAppealStats to return default stats for empty array
      const appealUtils = jest.requireMock("../utils/appealUtils");
      appealUtils.calculateAppealStats.mockReturnValue({
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        expired: 0,
        approvalRate: 0,
      });

      const result = await appealService.getAppealStats();

      expect(result.total).toBe(0);
      expect(result.pending).toBe(0);
      expect(result.approved).toBe(0);
      expect(result.rejected).toBe(0);
      expect(result.approvalRate).toBe(0);
    });

    it("should handle repository errors", async () => {
      mockRepository.getAll.mockRejectedValue(new Error("Database error"));

      const result = await appealService.getAppealStats();
      expect(result).toEqual({
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        expired: 0,
        approvalRate: 0,
      });
    });
  });

  describe("getAllAppealsForAdmin", () => {
    it("should get all appeals for admin", async () => {
      const mockAppeals = [mockAppeal];
      mockRepository.getAll.mockResolvedValue(mockAppeals);

      const result = await appealService.getAllAppealsForAdmin();

      expect(result).toEqual(mockAppeals);
      expect(mockRepository.getAll).toHaveBeenCalled();
    });

    it("should handle repository errors", async () => {
      mockRepository.getAll.mockRejectedValue(new Error("Database error"));

      const result = await appealService.getAllAppealsForAdmin();
      expect(result).toEqual([]);
    });
  });

  describe("getAppealsByViolation", () => {
    it("should get appeals by violation ID", async () => {
      const mockAppeals = [mockAppeal];
      mockRepository.getByViolation.mockResolvedValue(mockAppeals);

      const result = await appealService.getAppealsByViolation("violation123");

      expect(result).toEqual(mockAppeals);
      expect(mockRepository.getByViolation).toHaveBeenCalledWith(
        "violation123"
      );
    });

    it("should handle repository errors", async () => {
      mockRepository.getByViolation.mockRejectedValue(
        new Error("Database error")
      );

      const result = await appealService.getAppealsByViolation("violation123");
      expect(result).toEqual([]);
    });
  });

  describe("updateAppeal", () => {
    it("should update an appeal", async () => {
      mockRepository.getById.mockResolvedValue(mockAppeal);
      mockRepository.update.mockResolvedValue(undefined);

      const updates = {
        reason: "Updated reason",
        evidence: "Updated evidence",
      };

      await appealService.updateAppeal("appeal123", updates);

      expect(mockRepository.update).toHaveBeenCalledWith("appeal123", updates);
    });

    it("should handle non-existent appeal", async () => {
      mockRepository.update.mockRejectedValue(new Error("Appeal not found"));

      await expect(
        appealService.updateAppeal("nonexistent", {})
      ).rejects.toThrow("Failed to update appeal");
    });

    it("should handle repository errors", async () => {
      mockRepository.getById.mockResolvedValue(mockAppeal);
      mockRepository.update.mockRejectedValue(new Error("Database error"));

      await expect(appealService.updateAppeal("appeal123", {})).rejects.toThrow(
        "Failed to update appeal"
      );
    });
  });

  describe("Private Methods (via public methods)", () => {
    it("should auto-approve appeal for trusted users", async () => {
      const trustedReputation = { ...mockUserReputation, level: "trusted" };
      mockReputationService.getUserReputation.mockResolvedValue(
        trustedReputation
      );
      mockRepository.save.mockResolvedValue(undefined);
      mockRepository.update.mockResolvedValue(undefined);

      // Reset validateAppealData to not throw
      const appealUtils = jest.requireMock("../utils/appealUtils");
      appealUtils.validateAppealData.mockImplementation(() => {});
      appealUtils.shouldAutoApproveForUser.mockReturnValue(true);

      const result = await appealService.createAppeal(createAppealData);

      expect(result).toBeDefined();
      // Auto-approval should be triggered for trusted users
      expect(mockRepository.update).toHaveBeenCalled();
    });

    it("should not auto-approve appeal for flagged users", async () => {
      const flaggedReputation = { ...mockUserReputation, level: "flagged" };
      mockReputationService.getUserReputation.mockResolvedValue(
        flaggedReputation
      );
      mockRepository.save.mockResolvedValue(undefined);

      // Reset validateAppealData to not throw
      const appealUtils = jest.requireMock("../utils/appealUtils");
      appealUtils.validateAppealData.mockImplementation(() => {});
      appealUtils.shouldAutoApproveForUser.mockReturnValue(false);

      const result = await appealService.createAppeal(createAppealData);

      expect(result).toBeDefined();
      // Auto-approval should not be triggered for flagged users
      expect(mockRepository.update).not.toHaveBeenCalled();
    });
  });

  describe("Factory Functions", () => {
    it("should have factory functions", () => {
      const { getAppealService } = jest.requireMock(
        "../services/appealService"
      );
      const { resetAppealService } = jest.requireMock(
        "../services/appealService"
      );
      const { destroyAppealService } = jest.requireMock(
        "../services/appealService"
      );

      expect(typeof getAppealService).toBe("function");
      expect(typeof resetAppealService).toBe("function");
      expect(typeof destroyAppealService).toBe("function");
    });
  });
});
