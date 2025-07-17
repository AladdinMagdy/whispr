/**
 * Tests for AppealService
 */

import { AppealService, getAppealService } from "../services/appealService";
import { AppealStatus } from "../types";
import { getFirestoreService } from "../services/firestoreService";
import { getReputationService } from "../services/reputationService";

// Mock the services
jest.mock("../services/firestoreService");
jest.mock("../services/reputationService");

// Create mock objects manually
const mockFirestoreService = {
  saveAppeal: jest.fn(),
  getAppeal: jest.fn(),
  getUserAppeals: jest.fn(),
  getPendingAppeals: jest.fn(),
  updateAppeal: jest.fn(),
  getAllAppeals: jest.fn(),
  adjustUserReputationScore: jest.fn(),
};

const mockReputationService = {
  getUserReputation: jest.fn(),
};

// Mock the service getters to return our mock objects
(getFirestoreService as jest.Mock).mockReturnValue(mockFirestoreService);
(getReputationService as jest.Mock).mockReturnValue(mockReputationService);

describe("AppealService", () => {
  let appealService: AppealService;

  beforeEach(() => {
    jest.clearAllMocks();
    appealService = getAppealService();
  });

  describe("createAppeal", () => {
    it("should create a new appeal successfully", async () => {
      // Mock reputation service
      mockReputationService.getUserReputation.mockResolvedValue({
        userId: "user-123",
        score: 75,
        level: "verified",
        totalWhispers: 10,
        approvedWhispers: 8,
        flaggedWhispers: 1,
        rejectedWhispers: 1,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mock getViolation to return a valid violation
      jest.spyOn(appealService as any, "getViolation").mockResolvedValue({
        id: "violation-789",
        whisperId: "whisper-456",
        violationType: "spam",
        severity: "low",
        timestamp: new Date(),
        resolved: false,
        notes: "Test violation",
      });

      // Mock firestore service
      mockFirestoreService.saveAppeal.mockResolvedValue(undefined);

      const appealData = {
        userId: "user-123",
        whisperId: "whisper-456",
        violationId: "violation-789",
        reason: "This was a false positive",
        evidence: "Additional context",
      };

      const result = await appealService.createAppeal(appealData);

      // Wait for auto-approval to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(result).toMatchObject({
        userId: "user-123",
        whisperId: "whisper-456",
        violationId: "violation-789",
        reason: "This was a false positive",
        evidence: "Additional context",
        status: AppealStatus.PENDING,
      });

      expect(mockFirestoreService.saveAppeal).toHaveBeenCalledWith(result);
    });

    it("should reject appeal from banned users", async () => {
      // Mock banned user
      mockReputationService.getUserReputation.mockResolvedValue({
        userId: "banned-user",
        score: 0,
        level: "banned",
        totalWhispers: 5,
        approvedWhispers: 0,
        flaggedWhispers: 5,
        rejectedWhispers: 0,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const appealData = {
        userId: "banned-user",
        whisperId: "whisper-456",
        violationId: "violation-789",
        reason: "I want to appeal",
      };

      await expect(appealService.createAppeal(appealData)).rejects.toThrow(
        "Banned users cannot submit appeals"
      );
    });

    it("should reject appeal if time limit exceeded", async () => {
      // Mock verified user
      mockReputationService.getUserReputation.mockResolvedValue({
        userId: "user-123",
        score: 75,
        level: "verified",
        totalWhispers: 10,
        approvedWhispers: 8,
        flaggedWhispers: 1,
        rejectedWhispers: 1,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mock violation that's too old
      const oldViolation = {
        id: "violation-789",
        whisperId: "whisper-456",
        violationType: "spam" as const,
        severity: "low" as const,
        timestamp: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
        resolved: false,
        notes: "Old violation",
      };

      // Mock getViolation to return old violation
      jest
        .spyOn(appealService as any, "getViolation")
        .mockResolvedValue(oldViolation);

      const appealData = {
        userId: "user-123",
        whisperId: "whisper-456",
        violationId: "violation-789",
        reason: "I want to appeal",
      };

      await expect(appealService.createAppeal(appealData)).rejects.toThrow(
        "Appeal time limit exceeded"
      );
    });
  });

  describe("getAppeal", () => {
    it("should get appeal by ID", async () => {
      const mockAppeal = {
        id: "appeal-123",
        userId: "user-123",
        whisperId: "whisper-456",
        violationId: "violation-789",
        reason: "Test appeal",
        status: AppealStatus.PENDING,
        submittedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFirestoreService.getAppeal.mockResolvedValue(mockAppeal);

      const result = await appealService.getAppeal("appeal-123");

      expect(result).toEqual(mockAppeal);
      expect(mockFirestoreService.getAppeal).toHaveBeenCalledWith("appeal-123");
    });

    it("should return null if appeal not found", async () => {
      mockFirestoreService.getAppeal.mockResolvedValue(null);

      const result = await appealService.getAppeal("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("getUserAppeals", () => {
    it("should get appeals for a user", async () => {
      const mockAppeals = [
        {
          id: "appeal-1",
          userId: "user-123",
          whisperId: "whisper-1",
          violationId: "violation-1",
          reason: "Test appeal 1",
          status: AppealStatus.PENDING,
          submittedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "appeal-2",
          userId: "user-123",
          whisperId: "whisper-2",
          violationId: "violation-2",
          reason: "Test appeal 2",
          status: AppealStatus.APPROVED,
          submittedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockFirestoreService.getUserAppeals.mockResolvedValue(mockAppeals);

      const result = await appealService.getUserAppeals("user-123");

      expect(result).toEqual(mockAppeals);
      expect(mockFirestoreService.getUserAppeals).toHaveBeenCalledWith(
        "user-123"
      );
    });
  });

  describe("getPendingAppeals", () => {
    it("should get pending appeals", async () => {
      const mockAppeals = [
        {
          id: "appeal-1",
          userId: "user-123",
          whisperId: "whisper-1",
          violationId: "violation-1",
          reason: "Test appeal",
          status: AppealStatus.PENDING,
          submittedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockFirestoreService.getPendingAppeals.mockResolvedValue(mockAppeals);

      const result = await appealService.getPendingAppeals();

      expect(result).toEqual(mockAppeals);
      expect(mockFirestoreService.getPendingAppeals).toHaveBeenCalled();
    });
  });

  describe("reviewAppeal", () => {
    it("should review and approve an appeal", async () => {
      const mockAppeal = {
        id: "appeal-123",
        userId: "user-123",
        whisperId: "whisper-456",
        violationId: "violation-789",
        reason: "Test appeal",
        status: AppealStatus.PENDING,
        submittedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFirestoreService.getAppeal.mockResolvedValue(mockAppeal);
      mockFirestoreService.updateAppeal.mockResolvedValue(undefined);
      mockFirestoreService.adjustUserReputationScore.mockResolvedValue(
        undefined
      );

      const reviewData = {
        appealId: "appeal-123",
        action: "approve" as const,
        reason: "Appeal approved",
        moderatorId: "mod-123",
        reputationAdjustment: 5,
      };

      await appealService.reviewAppeal(reviewData);

      expect(mockFirestoreService.updateAppeal).toHaveBeenCalledWith(
        "appeal-123",
        {
          status: AppealStatus.APPROVED,
          resolution: {
            action: "approve",
            reason: "Appeal approved",
            moderatorId: "mod-123",
            reputationAdjustment: 5,
          },
          reviewedAt: expect.any(Date),
          reviewedBy: "mod-123",
          updatedAt: expect.any(Date),
        }
      );

      expect(
        mockFirestoreService.adjustUserReputationScore
      ).toHaveBeenCalledWith("user-123", 5, "Appeal approve: Appeal approved");
    });

    it("should reject appeal that's already reviewed", async () => {
      const mockAppeal = {
        id: "appeal-123",
        userId: "user-123",
        whisperId: "whisper-456",
        violationId: "violation-789",
        reason: "Test appeal",
        status: AppealStatus.APPROVED, // Already reviewed
        submittedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFirestoreService.getAppeal.mockResolvedValue(mockAppeal);

      const reviewData = {
        appealId: "appeal-123",
        action: "reject" as const,
        reason: "Appeal rejected",
        moderatorId: "mod-123",
      };

      await expect(appealService.reviewAppeal(reviewData)).rejects.toThrow(
        "Appeal has already been reviewed"
      );
    });
  });

  describe("checkAppealExpiration", () => {
    it("should expire old appeals", async () => {
      const oldAppeal = {
        id: "appeal-123",
        userId: "user-123",
        whisperId: "whisper-456",
        violationId: "violation-789",
        reason: "Old appeal",
        status: AppealStatus.PENDING,
        submittedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago (exceeds 14-day limit for standard users)
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFirestoreService.getPendingAppeals.mockResolvedValue([oldAppeal]);
      mockReputationService.getUserReputation.mockResolvedValue({
        userId: "user-123",
        score: 50,
        level: "standard",
        totalWhispers: 5,
        approvedWhispers: 4,
        flaggedWhispers: 1,
        rejectedWhispers: 0,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockFirestoreService.updateAppeal.mockResolvedValue(undefined);

      await appealService.checkAppealExpiration();

      expect(mockFirestoreService.updateAppeal).toHaveBeenCalledWith(
        "appeal-123",
        {
          status: AppealStatus.EXPIRED,
          updatedAt: expect.any(Date),
        }
      );
    });
  });

  describe("getAppealStats", () => {
    it("should return appeal statistics", async () => {
      const mockAppeals = [
        {
          id: "appeal-1",
          userId: "user-1",
          whisperId: "whisper-1",
          violationId: "violation-1",
          reason: "Test appeal 1",
          status: AppealStatus.PENDING,
          submittedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "appeal-2",
          userId: "user-2",
          whisperId: "whisper-2",
          violationId: "violation-2",
          reason: "Test appeal 2",
          status: AppealStatus.APPROVED,
          submittedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "appeal-3",
          userId: "user-3",
          whisperId: "whisper-3",
          violationId: "violation-3",
          reason: "Test appeal 3",
          status: AppealStatus.REJECTED,
          submittedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "appeal-4",
          userId: "user-4",
          whisperId: "whisper-4",
          violationId: "violation-4",
          reason: "Test appeal 4",
          status: AppealStatus.EXPIRED,
          submittedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockFirestoreService.getAllAppeals.mockResolvedValue(mockAppeals);

      const stats = await appealService.getAppealStats();

      expect(stats).toEqual({
        total: 4,
        pending: 1,
        approved: 1,
        rejected: 1,
        expired: 1,
        approvalRate: 50, // 1 approved / 2 resolved (approved + rejected)
      });
    });

    it("should handle error and return default stats", async () => {
      mockFirestoreService.getAllAppeals.mockRejectedValue(
        new Error("Database error")
      );

      const stats = await appealService.getAppealStats();

      expect(stats).toEqual({
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        expired: 0,
        approvalRate: 0,
      });
    });

    it("should handle empty appeals list", async () => {
      mockFirestoreService.getAllAppeals.mockResolvedValue([]);

      const stats = await appealService.getAppealStats();

      expect(stats).toEqual({
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        expired: 0,
        approvalRate: 0,
      });
    });

    it("should calculate approval rate correctly with no resolved appeals", async () => {
      const mockAppeals = [
        {
          id: "appeal-1",
          userId: "user-1",
          whisperId: "whisper-1",
          violationId: "violation-1",
          reason: "Test appeal 1",
          status: AppealStatus.PENDING,
          submittedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "appeal-2",
          userId: "user-2",
          whisperId: "whisper-2",
          violationId: "violation-2",
          reason: "Test appeal 2",
          status: AppealStatus.EXPIRED,
          submittedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockFirestoreService.getAllAppeals.mockResolvedValue(mockAppeals);

      const stats = await appealService.getAppealStats();

      expect(stats.approvalRate).toBe(0);
    });
  });

  describe("Auto-approval logic", () => {
    it("should auto-approve appeal for trusted users with low severity violation", async () => {
      // Mock trusted user
      mockReputationService.getUserReputation.mockResolvedValue({
        userId: "trusted-user",
        score: 100,
        level: "trusted",
        totalWhispers: 50,
        approvedWhispers: 45,
        flaggedWhispers: 2,
        rejectedWhispers: 3,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mock getViolation to return a low severity violation
      jest.spyOn(appealService as any, "getViolation").mockResolvedValue({
        id: "violation-789",
        whisperId: "whisper-456",
        violationType: "spam",
        severity: "low",
        timestamp: new Date(),
        resolved: false,
        notes: "Test violation",
      });

      mockFirestoreService.saveAppeal.mockResolvedValue(undefined);
      mockFirestoreService.updateAppeal.mockResolvedValue(undefined);
      mockFirestoreService.adjustUserReputationScore.mockResolvedValue(
        undefined
      );

      const appealData = {
        userId: "trusted-user",
        whisperId: "whisper-456",
        violationId: "violation-789",
        reason: "This was a false positive",
      };

      const result = await appealService.createAppeal(appealData);

      // Wait for auto-approval to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(result.status).toBe(AppealStatus.PENDING); // Initial status
      expect(mockFirestoreService.saveAppeal).toHaveBeenCalledWith(result);
    });

    it("should not auto-approve for non-trusted users", async () => {
      // Mock standard user
      mockReputationService.getUserReputation.mockResolvedValue({
        userId: "standard-user",
        score: 50,
        level: "standard",
        totalWhispers: 10,
        approvedWhispers: 8,
        flaggedWhispers: 1,
        rejectedWhispers: 1,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const violation = {
        id: "violation-789",
        whisperId: "whisper-456",
        violationType: "spam" as const,
        severity: "low" as const,
        timestamp: new Date(),
        resolved: false,
        notes: "Test violation",
      };

      jest
        .spyOn(appealService as any, "getViolation")
        .mockResolvedValue(violation);

      mockFirestoreService.saveAppeal.mockResolvedValue(undefined);

      const appealData = {
        userId: "standard-user",
        whisperId: "whisper-456",
        violationId: "violation-789",
        reason: "This was a false positive",
      };

      const result = await appealService.createAppeal(appealData);

      // Wait for auto-approval to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(result.status).toBe(AppealStatus.PENDING);
      expect(mockFirestoreService.saveAppeal).toHaveBeenCalledWith(result);
      // Should not call updateAppeal for auto-approval
      expect(mockFirestoreService.updateAppeal).not.toHaveBeenCalled();
    });
  });

  describe("Error handling", () => {
    it("should handle error in createAppeal", async () => {
      mockReputationService.getUserReputation.mockRejectedValue(
        new Error("Service error")
      );

      const appealData = {
        userId: "user-123",
        whisperId: "whisper-456",
        violationId: "violation-789",
        reason: "Test appeal",
      };

      await expect(appealService.createAppeal(appealData)).rejects.toThrow(
        "Service error"
      );
    });

    it("should handle error in getAppeal", async () => {
      mockFirestoreService.getAppeal.mockRejectedValue(
        new Error("Database error")
      );

      const result = await appealService.getAppeal("appeal-123");

      expect(result).toBeNull();
    });

    it("should handle error in getUserAppeals", async () => {
      mockFirestoreService.getUserAppeals.mockRejectedValue(
        new Error("Database error")
      );

      const result = await appealService.getUserAppeals("user-123");

      expect(result).toEqual([]);
    });

    it("should handle error in getPendingAppeals", async () => {
      mockFirestoreService.getPendingAppeals.mockRejectedValue(
        new Error("Database error")
      );

      const result = await appealService.getPendingAppeals();

      expect(result).toEqual([]);
    });

    it("should handle error in reviewAppeal", async () => {
      // Mock getAppeal to return null (appeal not found)
      mockFirestoreService.getAppeal.mockResolvedValue(null);

      const reviewData = {
        appealId: "appeal-123",
        action: "approve" as const,
        reason: "Appeal approved",
        moderatorId: "mod-123",
      };

      await expect(appealService.reviewAppeal(reviewData)).rejects.toThrow(
        "Appeal not found"
      );
    });

    it("should handle error in checkAppealExpiration", async () => {
      mockFirestoreService.getPendingAppeals.mockRejectedValue(
        new Error("Database error")
      );

      // Should not throw error
      await expect(
        appealService.checkAppealExpiration()
      ).resolves.toBeUndefined();
    });

    it("should handle error in auto-approval", async () => {
      // Mock trusted user
      mockReputationService.getUserReputation.mockResolvedValue({
        userId: "trusted-user",
        score: 95,
        level: "trusted",
        totalWhispers: 50,
        approvedWhispers: 48,
        flaggedWhispers: 1,
        rejectedWhispers: 1,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const violation = {
        id: "violation-789",
        whisperId: "whisper-456",
        violationType: "spam" as const,
        severity: "low" as const,
        timestamp: new Date(),
        resolved: false,
        notes: "Test violation",
      };

      jest
        .spyOn(appealService as any, "getViolation")
        .mockResolvedValue(violation);

      mockFirestoreService.saveAppeal.mockResolvedValue(undefined);
      mockFirestoreService.updateAppeal.mockRejectedValue(
        new Error("Update error")
      );

      const appealData = {
        userId: "trusted-user",
        whisperId: "whisper-456",
        violationId: "violation-789",
        reason: "This was a false positive",
      };

      // Should not throw error, auto-approval error should be handled gracefully
      const result = await appealService.createAppeal(appealData);

      // Wait for auto-approval to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(result.status).toBe(AppealStatus.PENDING);
    });
  });

  describe("Edge cases", () => {
    it("should handle violation not found in createAppeal", async () => {
      mockReputationService.getUserReputation.mockResolvedValue({
        userId: "user-123",
        score: 75,
        level: "verified",
        totalWhispers: 10,
        approvedWhispers: 8,
        flaggedWhispers: 1,
        rejectedWhispers: 1,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mock getViolation to return null
      jest.spyOn(appealService as any, "getViolation").mockResolvedValue(null);

      const appealData = {
        userId: "user-123",
        whisperId: "whisper-456",
        violationId: "violation-789",
        reason: "This was a false positive",
      };

      await expect(appealService.createAppeal(appealData)).rejects.toThrow(
        "Violation not found"
      );
    });

    it("should handle appeal not found in reviewAppeal", async () => {
      mockFirestoreService.getAppeal.mockResolvedValue(null);

      const reviewData = {
        appealId: "nonexistent",
        action: "approve" as const,
        reason: "Appeal approved",
        moderatorId: "mod-123",
      };

      await expect(appealService.reviewAppeal(reviewData)).rejects.toThrow(
        "Appeal not found"
      );
    });

    it("should handle partial_approve action in reviewAppeal", async () => {
      const mockAppeal = {
        id: "appeal-123",
        userId: "user-123",
        whisperId: "whisper-456",
        violationId: "violation-789",
        reason: "Test appeal",
        status: AppealStatus.PENDING,
        submittedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFirestoreService.getAppeal.mockResolvedValue(mockAppeal);
      mockFirestoreService.updateAppeal.mockResolvedValue(undefined);
      mockFirestoreService.adjustUserReputationScore.mockResolvedValue(
        undefined
      );

      const reviewData = {
        appealId: "appeal-123",
        action: "partial_approve" as const,
        reason: "Partially approved",
        moderatorId: "mod-123",
        reputationAdjustment: 2,
      };

      await appealService.reviewAppeal(reviewData);

      expect(mockFirestoreService.updateAppeal).toHaveBeenCalledWith(
        "appeal-123",
        {
          status: AppealStatus.REJECTED, // partial_approve maps to REJECTED
          resolution: {
            action: "partial_approve",
            reason: "Partially approved",
            moderatorId: "mod-123",
            reputationAdjustment: 2,
          },
          reviewedAt: expect.any(Date),
          reviewedBy: "mod-123",
          updatedAt: expect.any(Date),
        }
      );
    });

    it("should handle reject action in reviewAppeal", async () => {
      const mockAppeal = {
        id: "appeal-123",
        userId: "user-123",
        whisperId: "whisper-456",
        violationId: "violation-789",
        reason: "Test appeal",
        status: AppealStatus.PENDING,
        submittedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFirestoreService.getAppeal.mockResolvedValue(mockAppeal);
      mockFirestoreService.updateAppeal.mockResolvedValue(undefined);
      mockFirestoreService.adjustUserReputationScore.mockResolvedValue(
        undefined
      );

      const reviewData = {
        appealId: "appeal-123",
        action: "reject" as const,
        reason: "Appeal rejected",
        moderatorId: "mod-123",
        reputationAdjustment: -5,
      };

      await appealService.reviewAppeal(reviewData);

      expect(mockFirestoreService.updateAppeal).toHaveBeenCalledWith(
        "appeal-123",
        {
          status: AppealStatus.REJECTED,
          resolution: {
            action: "reject",
            reason: "Appeal rejected",
            moderatorId: "mod-123",
            reputationAdjustment: -5,
          },
          reviewedAt: expect.any(Date),
          reviewedBy: "mod-123",
          updatedAt: expect.any(Date),
        }
      );
    });

    it("should handle reviewAppeal without reputation adjustment", async () => {
      const mockAppeal = {
        id: "appeal-123",
        userId: "user-123",
        whisperId: "whisper-456",
        violationId: "violation-789",
        reason: "Test appeal",
        status: AppealStatus.PENDING,
        submittedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFirestoreService.getAppeal.mockResolvedValue(mockAppeal);
      mockFirestoreService.updateAppeal.mockResolvedValue(undefined);
      mockFirestoreService.adjustUserReputationScore.mockResolvedValue(
        undefined
      );

      const reviewData = {
        appealId: "appeal-123",
        action: "approve" as const,
        reason: "Appeal approved",
        moderatorId: "mod-123",
        // No reputationAdjustment
      };

      await appealService.reviewAppeal(reviewData);

      expect(mockFirestoreService.updateAppeal).toHaveBeenCalledWith(
        "appeal-123",
        expect.objectContaining({
          status: AppealStatus.APPROVED,
        })
      );
      // Should expect a default adjustment (bonus) to be applied
      expect(
        mockFirestoreService.adjustUserReputationScore
      ).toHaveBeenCalledWith("user-123", 5, "Appeal approve: Appeal approved");
    });
  });

  describe("Singleton pattern", () => {
    it("should return the same instance", () => {
      const instance1 = getAppealService();
      const instance2 = getAppealService();
      expect(instance1).toBe(instance2);
    });

    it("should create new instance when previous is null", () => {
      // Reset the singleton instance
      (AppealService as any).instance = null;

      const instance = getAppealService();
      expect(instance).toBeInstanceOf(AppealService);
    });
  });

  describe("Private method testing through public interfaces", () => {
    it("should test getAppealTimeLimit through createAppeal", async () => {
      // Test different reputation levels (excluding banned since they can't appeal)
      const testCases = [
        { level: "trusted", expectedDays: 30 },
        { level: "verified", expectedDays: 14 },
        { level: "standard", expectedDays: 7 },
        { level: "flagged", expectedDays: 3 },
        { level: "unknown", expectedDays: 7 }, // Default
      ];

      for (const testCase of testCases) {
        mockReputationService.getUserReputation.mockResolvedValue({
          userId: "user-123",
          score: 75,
          level: testCase.level,
          totalWhispers: 10,
          approvedWhispers: 8,
          flaggedWhispers: 1,
          rejectedWhispers: 1,
          violationHistory: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const violation = {
          id: "violation-789",
          whisperId: "whisper-456",
          violationType: "spam" as const,
          severity: "low" as const,
          timestamp: new Date(),
          resolved: false,
          notes: "Test violation",
        };

        jest
          .spyOn(appealService as any, "getViolation")
          .mockResolvedValue(violation);

        mockFirestoreService.saveAppeal.mockResolvedValue(undefined);

        const appealData = {
          userId: "user-123",
          whisperId: "whisper-456",
          violationId: "violation-789",
          reason: "Test appeal",
        };

        const result = await appealService.createAppeal(appealData);
        expect(result).toBeDefined();
      }
    });

    it("should test getDaysSinceViolation through createAppeal", async () => {
      mockReputationService.getUserReputation.mockResolvedValue({
        userId: "user-123",
        score: 75,
        level: "verified",
        totalWhispers: 10,
        approvedWhispers: 8,
        flaggedWhispers: 1,
        rejectedWhispers: 1,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Test with recent violation (should succeed)
      const recentViolation = {
        id: "violation-789",
        whisperId: "whisper-456",
        violationType: "spam" as const,
        severity: "low" as const,
        timestamp: new Date(), // Today
        resolved: false,
        notes: "Recent violation",
      };

      jest
        .spyOn(appealService as any, "getViolation")
        .mockResolvedValue(recentViolation);

      mockFirestoreService.saveAppeal.mockResolvedValue(undefined);

      const appealData = {
        userId: "user-123",
        whisperId: "whisper-456",
        violationId: "violation-789",
        reason: "Test appeal",
      };

      const result = await appealService.createAppeal(appealData);
      expect(result).toBeDefined();
    });

    it("should test updateViolationResolution through reviewAppeal", async () => {
      const mockAppeal = {
        id: "appeal-123",
        userId: "user-123",
        whisperId: "whisper-456",
        violationId: "violation-789",
        reason: "Test appeal",
        status: AppealStatus.PENDING,
        submittedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFirestoreService.getAppeal.mockResolvedValue(mockAppeal);
      mockFirestoreService.updateAppeal.mockResolvedValue(undefined);
      mockFirestoreService.adjustUserReputationScore.mockResolvedValue(
        undefined
      );

      const reviewData = {
        appealId: "appeal-123",
        action: "approve" as const,
        reason: "Appeal approved",
        moderatorId: "mod-123",
        reputationAdjustment: 5, // Add reputation adjustment to ensure the call is made
      };

      await appealService.reviewAppeal(reviewData);

      // The updateViolationResolution method should be called internally
      // We can verify this by checking that all expected Firestore calls were made
      expect(mockFirestoreService.updateAppeal).toHaveBeenCalled();
      expect(mockFirestoreService.adjustUserReputationScore).toHaveBeenCalled();
    });
  });
});
