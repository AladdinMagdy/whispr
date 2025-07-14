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
  });
});
