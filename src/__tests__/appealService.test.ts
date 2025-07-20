/**
 * Tests for AppealService
 */

import { AppealService, getAppealService } from "../services/appealService";
import { AppealStatus } from "../types";
import { AppealRepository } from "../repositories/AppealRepository";
import { getReputationService } from "../services/reputationService";
import * as appealUtils from "../utils/appealUtils";

// Mock the services
jest.mock("../repositories/FirebaseAppealRepository");
jest.mock("../services/reputationService");
jest.mock("../utils/appealUtils", () => ({
  ...jest.requireActual("../utils/appealUtils"),
  shouldAutoApproveForUser: jest.fn(),
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

      // Mock repository
      mockRepository.save.mockResolvedValue(undefined);

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

      expect(mockRepository.save).toHaveBeenCalledWith(result);
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

      mockRepository.getById.mockResolvedValue(mockAppeal);

      const result = await appealService.getAppeal("appeal-123");

      expect(result).toEqual(mockAppeal);
      expect(mockRepository.getById).toHaveBeenCalledWith("appeal-123");
    });

    it("should return null if appeal not found", async () => {
      mockRepository.getById.mockResolvedValue(null);

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

      mockRepository.getByUser.mockResolvedValue(mockAppeals);

      const result = await appealService.getUserAppeals("user-123");

      expect(result).toEqual(mockAppeals);
      expect(mockRepository.getByUser).toHaveBeenCalledWith("user-123");
    });

    it("should return empty array if no appeals found", async () => {
      mockRepository.getByUser.mockResolvedValue([]);

      const result = await appealService.getUserAppeals("user-123");

      expect(result).toEqual([]);
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

      mockRepository.getPending.mockResolvedValue(mockAppeals);

      const result = await appealService.getPendingAppeals();

      expect(result).toEqual(mockAppeals);
      expect(mockRepository.getPending).toHaveBeenCalled();
    });

    it("should return empty array if no pending appeals", async () => {
      mockRepository.getPending.mockResolvedValue([]);

      const result = await appealService.getPendingAppeals();

      expect(result).toEqual([]);
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

      mockRepository.getById.mockResolvedValue(mockAppeal);
      mockRepository.update.mockResolvedValue(undefined);
      mockReputationService.adjustUserReputationScore.mockResolvedValue(
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

      expect(mockRepository.update).toHaveBeenCalledWith("appeal-123", {
        status: AppealStatus.APPROVED,
        reviewedAt: expect.any(Date),
        reviewedBy: "mod-123",
        resolution: {
          action: "approve",
          reason: "Appeal approved",
          moderatorId: "mod-123",
          reputationAdjustment: 5,
        },
        updatedAt: expect.any(Date),
      });

      expect(
        mockReputationService.adjustUserReputationScore
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
        reviewedAt: new Date(),
        reviewedBy: "mod-123",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.getById.mockResolvedValue(mockAppeal);

      const reviewData = {
        appealId: "appeal-123",
        action: "reject" as const,
        reason: "Appeal rejected",
        moderatorId: "mod-456",
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
        submittedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.getPending.mockResolvedValue([oldAppeal]);
      mockRepository.update.mockResolvedValue(undefined);
      mockReputationService.getUserReputation.mockResolvedValue({
        userId: "user-123",
        score: 50,
        level: "standard",
        totalWhispers: 5,
        approvedWhispers: 3,
        flaggedWhispers: 1,
        rejectedWhispers: 1,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await appealService.checkAppealExpiration();

      expect(mockRepository.update).toHaveBeenCalledWith("appeal-123", {
        status: AppealStatus.EXPIRED,
        updatedAt: expect.any(Date),
      });
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
          reason: "Test 1",
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
          reason: "Test 2",
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
          reason: "Test 3",
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
          reason: "Test 4",
          status: AppealStatus.EXPIRED,
          submittedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockRepository.getAll.mockResolvedValue(mockAppeals);

      const stats = await appealService.getAppealStats();

      expect(stats).toEqual({
        total: 4,
        pending: 1,
        approved: 1,
        rejected: 1,
        expired: 1,
        approvalRate: 50, // 1 approved out of 2 resolved (approved + rejected)
      });
    });

    it("should return default stats when no appeals exist", async () => {
      mockRepository.getAll.mockResolvedValue([]);

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
  });

  describe("Auto-approval logic", () => {
    it("should auto-approve appeal for trusted users with low severity violation", async () => {
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

      // Mock low severity violation
      jest.spyOn(appealService as any, "getViolation").mockResolvedValue({
        id: "violation-789",
        whisperId: "whisper-456",
        violationType: "spam",
        severity: "low",
        timestamp: new Date(),
        resolved: false,
        notes: "Low severity violation",
      });

      // Mock shouldAutoApproveForUser to return true
      (appealUtils.shouldAutoApproveForUser as jest.Mock).mockReturnValue(true);

      mockRepository.save.mockResolvedValue(undefined);
      mockRepository.update.mockResolvedValue(undefined);
      mockReputationService.adjustUserReputationScore.mockResolvedValue(
        undefined
      );

      const appealData = {
        userId: "trusted-user",
        whisperId: "whisper-456",
        violationId: "violation-789",
        reason: "False positive",
      };

      const result = await appealService.createAppeal(appealData);

      // Wait for auto-approval to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockRepository.update).toHaveBeenCalledWith(result.id, {
        status: AppealStatus.APPROVED,
        reviewedAt: expect.any(Date),
        reviewedBy: "system",
        resolution: {
          action: "approve",
          reason: "Auto-approved for trusted user",
          moderatorId: "system",
          reputationAdjustment: 5,
        },
        updatedAt: expect.any(Date),
      });

      expect(
        mockReputationService.adjustUserReputationScore
      ).toHaveBeenCalledWith("trusted-user", 5, "Appeal auto-approved");
    });

    it("should not auto-approve for non-trusted users", async () => {
      // Reset the mock to return false for non-trusted users
      (appealUtils.shouldAutoApproveForUser as jest.Mock).mockReturnValue(
        false
      );

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

      jest.spyOn(appealService as any, "getViolation").mockResolvedValue({
        id: "violation-789",
        whisperId: "whisper-456",
        violationType: "spam",
        severity: "low",
        timestamp: new Date(),
        resolved: false,
        notes: "Low severity violation",
      });

      mockRepository.save.mockResolvedValue(undefined);

      const appealData = {
        userId: "standard-user",
        whisperId: "whisper-456",
        violationId: "violation-789",
        reason: "False positive",
      };

      const result = await appealService.createAppeal(appealData);

      // Wait for auto-approval to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Should not have been auto-approved
      expect(result.status).toBe(AppealStatus.PENDING);
      expect(mockRepository.update).not.toHaveBeenCalled();
      expect(
        mockReputationService.adjustUserReputationScore
      ).not.toHaveBeenCalled();
    });
  });

  describe("Error handling", () => {
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

      jest.spyOn(appealService as any, "getViolation").mockResolvedValue({
        id: "violation-789",
        whisperId: "whisper-456",
        violationType: "spam",
        severity: "low",
        timestamp: new Date(),
        resolved: false,
        notes: "Low severity violation",
      });

      mockRepository.save.mockResolvedValue(undefined);
      mockRepository.update.mockRejectedValue(new Error("Update failed"));

      const appealData = {
        userId: "trusted-user",
        whisperId: "whisper-456",
        violationId: "violation-789",
        reason: "False positive",
      };

      // Should not throw error, just log it
      const result = await appealService.createAppeal(appealData);

      expect(result).toBeDefined();
      expect(result.status).toBe(AppealStatus.PENDING);
    });
  });

  describe("Edge cases", () => {
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

      mockRepository.getById.mockResolvedValue(mockAppeal);
      mockRepository.update.mockResolvedValue(undefined);
      mockReputationService.adjustUserReputationScore.mockResolvedValue(
        undefined
      );

      const reviewData = {
        appealId: "appeal-123",
        action: "partial_approve" as const,
        reason: "Partially approved",
        moderatorId: "mod-123",
        reputationAdjustment: 1,
      };

      await appealService.reviewAppeal(reviewData);

      expect(mockRepository.update).toHaveBeenCalledWith("appeal-123", {
        status: AppealStatus.REJECTED,
        reviewedAt: expect.any(Date),
        reviewedBy: "mod-123",
        resolution: {
          action: "partial_approve",
          reason: "Partially approved",
          moderatorId: "mod-123",
          reputationAdjustment: 1,
        },
        updatedAt: expect.any(Date),
      });
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

      mockRepository.getById.mockResolvedValue(mockAppeal);
      mockRepository.update.mockResolvedValue(undefined);
      mockReputationService.adjustUserReputationScore.mockResolvedValue(
        undefined
      );

      const reviewData = {
        appealId: "appeal-123",
        action: "reject" as const,
        reason: "Appeal rejected",
        moderatorId: "mod-123",
        reputationAdjustment: -2,
      };

      await appealService.reviewAppeal(reviewData);

      expect(mockRepository.update).toHaveBeenCalledWith("appeal-123", {
        status: AppealStatus.REJECTED,
        reviewedAt: expect.any(Date),
        reviewedBy: "mod-123",
        resolution: {
          action: "reject",
          reason: "Appeal rejected",
          moderatorId: "mod-123",
          reputationAdjustment: -2,
        },
        updatedAt: expect.any(Date),
      });
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

      mockRepository.getById.mockResolvedValue(mockAppeal);
      mockRepository.update.mockResolvedValue(undefined);

      const reviewData = {
        appealId: "appeal-123",
        action: "approve" as const,
        reason: "Appeal approved",
        moderatorId: "mod-123",
        reputationAdjustment: 0, // No adjustment
      };

      await appealService.reviewAppeal(reviewData);

      expect(mockRepository.update).toHaveBeenCalled();
      expect(
        mockReputationService.adjustUserReputationScore
      ).not.toHaveBeenCalled();
    });
  });

  describe("Private method testing through public interfaces", () => {
    it("should test getAppealTimeLimit through createAppeal", async () => {
      // This test verifies that the private getAppealTimeLimit method works correctly
      // by testing it through the public createAppeal interface
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

      jest.spyOn(appealService as any, "getViolation").mockResolvedValue({
        id: "violation-789",
        whisperId: "whisper-456",
        violationType: "spam",
        severity: "low",
        timestamp: new Date(),
        resolved: false,
        notes: "Test violation",
      });

      mockRepository.save.mockResolvedValue(undefined);

      const appealData = {
        userId: "user-123",
        whisperId: "whisper-456",
        violationId: "violation-789",
        reason: "Test appeal",
      };

      const result = await appealService.createAppeal(appealData);

      expect(result).toBeDefined();
      expect(result.status).toBe(AppealStatus.PENDING);
    });

    it("should test getDaysSinceViolation through createAppeal", async () => {
      // This test verifies that the private getDaysSinceViolation method works correctly
      // by testing it through the public createAppeal interface
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

      jest.spyOn(appealService as any, "getViolation").mockResolvedValue({
        id: "violation-789",
        whisperId: "whisper-456",
        violationType: "spam",
        severity: "low",
        timestamp: new Date(),
        resolved: false,
        notes: "Test violation",
      });

      mockRepository.save.mockResolvedValue(undefined);

      const appealData = {
        userId: "user-123",
        whisperId: "whisper-456",
        violationId: "violation-789",
        reason: "Test appeal",
      };

      const result = await appealService.createAppeal(appealData);

      expect(result).toBeDefined();
      expect(result.status).toBe(AppealStatus.PENDING);
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

      mockRepository.getById.mockResolvedValue(mockAppeal);
      mockRepository.update.mockResolvedValue(undefined);
      mockReputationService.adjustUserReputationScore.mockResolvedValue(
        undefined
      );

      const reviewData = {
        appealId: "appeal-123",
        action: "approve" as const,
        reason: "Appeal approved",
        moderatorId: "mod-123",
      };

      await appealService.reviewAppeal(reviewData);

      expect(mockRepository.update).toHaveBeenCalled();
      expect(
        mockReputationService.adjustUserReputationScore
      ).toHaveBeenCalled();
    });
  });
});
