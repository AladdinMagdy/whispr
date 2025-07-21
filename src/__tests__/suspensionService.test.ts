/**
 * SuspensionService Test Suite
 * Comprehensive tests for user suspension management
 */

import { SuspensionService } from "../services/suspensionService";
import { SuspensionRepository } from "../repositories/SuspensionRepository";
import { Suspension, SuspensionType, BanType } from "../types";
import {
  CreateSuspensionData,
  SuspensionReviewData,
  SuspensionStats,
  UserSuspensionStatus,
} from "../utils/suspensionUtils";

// Mock dependencies
jest.mock("../services/reputationService", () => ({
  getReputationService: jest.fn(),
}));

jest.mock("../utils/suspensionUtils", () => ({
  validateSuspensionData: jest.fn(),
  generateSuspensionId: jest.fn(),
  createSuspensionObject: jest.fn(),
  determineAutomaticSuspension: jest.fn(),
  isSuspensionExpired: jest.fn(),
  determineUserSuspensionStatus: jest.fn(),
  processReviewAction: jest.fn(),
  calculateSuspensionStats: jest.fn(),
  formatAutomaticSuspensionReason: jest.fn(),
  shouldAffectReputation: jest.fn(),
  getReputationPenalty: jest.fn(),
  getReputationRestorationBonus: jest.fn(),
  createDeactivationUpdates: jest.fn(),
  shouldRestoreReputationOnExpiry: jest.fn(),
}));

describe("SuspensionService", () => {
  let suspensionService: SuspensionService;
  let mockRepository: jest.Mocked<SuspensionRepository>;
  let mockReputationService: any;
  let mockSuspensionUtils: any;

  const mockSuspension: Suspension = {
    id: "suspension-123",
    userId: "user-123",
    type: SuspensionType.TEMPORARY,
    banType: BanType.CONTENT_HIDDEN,
    reason: "Test violation",
    moderatorId: "moderator-123",
    startDate: new Date("2024-01-01"),
    endDate: new Date("2024-01-08"),
    isActive: true,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  };

  const mockCreateSuspensionData: CreateSuspensionData = {
    userId: "user-123",
    reason: "Test violation",
    type: SuspensionType.TEMPORARY,
    duration: 7 * 24 * 60 * 60 * 1000, // 7 days
    moderatorId: "moderator-123",
    appealable: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock repository
    mockRepository = {
      save: jest.fn(),
      getById: jest.fn(),
      getAll: jest.fn(),
      getByUser: jest.fn(),
      getActive: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getByModerator: jest.fn(),
      getByType: jest.fn(),
      getByDateRange: jest.fn(),
    };

    // Setup mock reputation service
    mockReputationService = {
      getUserReputation: jest.fn(),
      updateUserReputation: jest.fn(),
    };

    // Setup mock suspension utils
    mockSuspensionUtils = {
      validateSuspensionData: jest.requireMock("../utils/suspensionUtils")
        .validateSuspensionData,
      generateSuspensionId: jest.requireMock("../utils/suspensionUtils")
        .generateSuspensionId,
      createSuspensionObject: jest.requireMock("../utils/suspensionUtils")
        .createSuspensionObject,
      determineAutomaticSuspension: jest.requireMock("../utils/suspensionUtils")
        .determineAutomaticSuspension,
      isSuspensionExpired: jest.requireMock("../utils/suspensionUtils")
        .isSuspensionExpired,
      determineUserSuspensionStatus: jest.requireMock(
        "../utils/suspensionUtils"
      ).determineUserSuspensionStatus,
      processReviewAction: jest.requireMock("../utils/suspensionUtils")
        .processReviewAction,
      calculateSuspensionStats: jest.requireMock("../utils/suspensionUtils")
        .calculateSuspensionStats,
      formatAutomaticSuspensionReason: jest.requireMock(
        "../utils/suspensionUtils"
      ).formatAutomaticSuspensionReason,
      shouldAffectReputation: jest.requireMock("../utils/suspensionUtils")
        .shouldAffectReputation,
      getReputationPenalty: jest.requireMock("../utils/suspensionUtils")
        .getReputationPenalty,
      getReputationRestorationBonus: jest.requireMock(
        "../utils/suspensionUtils"
      ).getReputationRestorationBonus,
      createDeactivationUpdates: jest.requireMock("../utils/suspensionUtils")
        .createDeactivationUpdates,
      shouldRestoreReputationOnExpiry: jest.requireMock(
        "../utils/suspensionUtils"
      ).shouldRestoreReputationOnExpiry,
    };

    // Setup reputation service mock
    const { getReputationService } = jest.requireMock(
      "../services/reputationService"
    );
    getReputationService.mockReturnValue(mockReputationService);

    // Create service instance with mock repository
    suspensionService = new SuspensionService(mockRepository);
  });

  afterEach(() => {
    SuspensionService.resetInstance();
  });

  describe("Singleton Pattern", () => {
    it("should return the same instance when getInstance is called multiple times", () => {
      const instance1 = SuspensionService.getInstance();
      const instance2 = SuspensionService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("should reset instance when resetInstance is called", () => {
      const instance1 = SuspensionService.getInstance();
      SuspensionService.resetInstance();
      const instance2 = SuspensionService.getInstance();
      expect(instance1).not.toBe(instance2);
    });

    it("should destroy instance when destroyInstance is called", () => {
      const instance1 = SuspensionService.getInstance();
      SuspensionService.destroyInstance();
      const instance2 = SuspensionService.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe("Factory Functions", () => {
    it("should return service instance via getSuspensionService", () => {
      const service = SuspensionService.getInstance();
      expect(service).toBeInstanceOf(SuspensionService);
    });

    it("should reset service via resetSuspensionService", () => {
      const service1 = SuspensionService.getInstance();
      SuspensionService.resetInstance();
      const service2 = SuspensionService.getInstance();
      expect(service1).not.toBe(service2);
    });

    it("should destroy service via destroySuspensionService", () => {
      const service1 = SuspensionService.getInstance();
      SuspensionService.destroyInstance();
      const service2 = SuspensionService.getInstance();
      expect(service1).not.toBe(service2);
    });
  });

  describe("getAllSuspensions", () => {
    it("should return all suspensions successfully", async () => {
      const mockSuspensions = [mockSuspension];
      mockRepository.getAll.mockResolvedValue(mockSuspensions);

      const result = await suspensionService.getAllSuspensions();

      expect(result).toEqual(mockSuspensions);
      expect(mockRepository.getAll).toHaveBeenCalledTimes(1);
    });

    it("should throw error when repository fails", async () => {
      mockRepository.getAll.mockRejectedValue(new Error("Database error"));

      await expect(suspensionService.getAllSuspensions()).rejects.toThrow(
        "Failed to get all suspensions"
      );
      expect(mockRepository.getAll).toHaveBeenCalledTimes(1);
    });
  });

  describe("getActiveSuspensions", () => {
    it("should return active suspensions successfully", async () => {
      const mockSuspensions = [mockSuspension];
      mockRepository.getActive.mockResolvedValue(mockSuspensions);

      const result = await suspensionService.getActiveSuspensions();

      expect(result).toEqual(mockSuspensions);
      expect(mockRepository.getActive).toHaveBeenCalledTimes(1);
    });

    it("should throw error when repository fails", async () => {
      mockRepository.getActive.mockRejectedValue(new Error("Database error"));

      await expect(suspensionService.getActiveSuspensions()).rejects.toThrow(
        "Failed to get active suspensions"
      );
      expect(mockRepository.getActive).toHaveBeenCalledTimes(1);
    });
  });

  describe("getUserSuspensions", () => {
    it("should return user suspensions successfully", async () => {
      const mockSuspensions = [mockSuspension];
      mockRepository.getByUser.mockResolvedValue(mockSuspensions);

      const result = await suspensionService.getUserSuspensions("user-123");

      expect(result).toEqual(mockSuspensions);
      expect(mockRepository.getByUser).toHaveBeenCalledWith("user-123");
    });

    it("should throw error when repository fails", async () => {
      mockRepository.getByUser.mockRejectedValue(new Error("Database error"));

      await expect(
        suspensionService.getUserSuspensions("user-123")
      ).rejects.toThrow("Failed to get user suspensions");
      expect(mockRepository.getByUser).toHaveBeenCalledWith("user-123");
    });
  });

  describe("createSuspension", () => {
    beforeEach(() => {
      mockSuspensionUtils.validateSuspensionData.mockImplementation(() => {});
      mockSuspensionUtils.generateSuspensionId.mockReturnValue(
        "suspension-123"
      );
      mockSuspensionUtils.createSuspensionObject.mockReturnValue({
        userId: "user-123",
        type: SuspensionType.TEMPORARY,
        reason: "Test violation",
        moderatorId: "moderator-123",
        startDate: new Date(),
        endDate: new Date(),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockSuspensionUtils.shouldAffectReputation.mockReturnValue(true);
    });

    it("should create suspension successfully", async () => {
      mockRepository.save.mockResolvedValue();
      mockReputationService.getUserReputation.mockResolvedValue({ score: 50 });
      mockReputationService.updateUserReputation.mockResolvedValue();
      mockSuspensionUtils.getReputationPenalty.mockReturnValue(-10);

      const result = await suspensionService.createSuspension(
        mockCreateSuspensionData
      );

      expect(result).toBeDefined();
      expect(result.id).toBe("suspension-123");
      expect(mockSuspensionUtils.validateSuspensionData).toHaveBeenCalledWith(
        mockCreateSuspensionData
      );
      expect(mockSuspensionUtils.generateSuspensionId).toHaveBeenCalled();
      expect(mockSuspensionUtils.createSuspensionObject).toHaveBeenCalledWith(
        mockCreateSuspensionData
      );
      expect(mockRepository.save).toHaveBeenCalled();
      expect(mockSuspensionUtils.shouldAffectReputation).toHaveBeenCalledWith(
        SuspensionType.TEMPORARY
      );
      expect(mockReputationService.getUserReputation).toHaveBeenCalledWith(
        "user-123"
      );
      expect(mockReputationService.updateUserReputation).toHaveBeenCalled();
    });

    it("should create suspension without reputation update when not needed", async () => {
      mockRepository.save.mockResolvedValue();
      mockSuspensionUtils.shouldAffectReputation.mockReturnValue(false);

      const result = await suspensionService.createSuspension(
        mockCreateSuspensionData
      );

      expect(result).toBeDefined();
      expect(mockSuspensionUtils.shouldAffectReputation).toHaveBeenCalledWith(
        SuspensionType.TEMPORARY
      );
      expect(mockReputationService.getUserReputation).not.toHaveBeenCalled();
      expect(mockReputationService.updateUserReputation).not.toHaveBeenCalled();
    });

    it("should throw error when validation fails", async () => {
      mockSuspensionUtils.validateSuspensionData.mockImplementation(() => {
        throw new Error("Invalid suspension data");
      });

      await expect(
        suspensionService.createSuspension(mockCreateSuspensionData)
      ).rejects.toThrow("Failed to create suspension: Invalid suspension data");
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it("should throw error when repository save fails", async () => {
      mockRepository.save.mockRejectedValue(new Error("Save failed"));

      await expect(
        suspensionService.createSuspension(mockCreateSuspensionData)
      ).rejects.toThrow("Failed to create suspension: Save failed");
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it("should handle reputation update errors gracefully", async () => {
      mockRepository.save.mockResolvedValue();
      mockSuspensionUtils.shouldAffectReputation.mockReturnValue(true);
      mockReputationService.getUserReputation.mockRejectedValue(
        new Error("Reputation error")
      );

      const result = await suspensionService.createSuspension(
        mockCreateSuspensionData
      );

      expect(result).toBeDefined();
      expect(mockRepository.save).toHaveBeenCalled();
      // Should not throw error, just log it
    });
  });

  describe("getSuspension", () => {
    it("should return suspension by ID successfully", async () => {
      mockRepository.getById.mockResolvedValue(mockSuspension);

      const result = await suspensionService.getSuspension("suspension-123");

      expect(result).toEqual(mockSuspension);
      expect(mockRepository.getById).toHaveBeenCalledWith("suspension-123");
    });

    it("should return null when suspension not found", async () => {
      mockRepository.getById.mockResolvedValue(null);

      const result = await suspensionService.getSuspension("suspension-123");

      expect(result).toBeNull();
      expect(mockRepository.getById).toHaveBeenCalledWith("suspension-123");
    });

    it("should return null when repository fails", async () => {
      mockRepository.getById.mockRejectedValue(new Error("Database error"));

      const result = await suspensionService.getSuspension("suspension-123");

      expect(result).toBeNull();
      expect(mockRepository.getById).toHaveBeenCalledWith("suspension-123");
    });
  });

  describe("getUserActiveSuspensions", () => {
    it("should return active suspensions for user", async () => {
      const activeSuspension = {
        ...mockSuspension,
        isActive: true,
        endDate: new Date(Date.now() + 86400000),
      };
      const inactiveSuspension = { ...mockSuspension, isActive: false };
      const expiredSuspension = {
        ...mockSuspension,
        isActive: true,
        endDate: new Date(Date.now() - 86400000),
      };

      mockRepository.getByUser.mockResolvedValue([
        activeSuspension,
        inactiveSuspension,
        expiredSuspension,
      ]);

      const result = await suspensionService.getUserActiveSuspensions(
        "user-123"
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(activeSuspension);
      expect(mockRepository.getByUser).toHaveBeenCalledWith("user-123");
    });

    it("should return empty array when repository fails", async () => {
      mockRepository.getByUser.mockRejectedValue(new Error("Database error"));

      const result = await suspensionService.getUserActiveSuspensions(
        "user-123"
      );

      expect(result).toEqual([]);
      expect(mockRepository.getByUser).toHaveBeenCalledWith("user-123");
    });
  });

  describe("isUserSuspended", () => {
    it("should return user suspension status successfully", async () => {
      const mockStatus: UserSuspensionStatus = {
        suspended: true,
        suspensions: [mockSuspension],
        canAppeal: true,
      };

      mockRepository.getByUser.mockResolvedValue([mockSuspension]);
      mockSuspensionUtils.determineUserSuspensionStatus.mockReturnValue(
        mockStatus
      );

      const result = await suspensionService.isUserSuspended("user-123");

      expect(result).toEqual(mockStatus);
      expect(mockRepository.getByUser).toHaveBeenCalledWith("user-123");
      expect(
        mockSuspensionUtils.determineUserSuspensionStatus
      ).toHaveBeenCalledWith([mockSuspension]);
    });

    it("should return default status when repository fails", async () => {
      mockRepository.getByUser.mockRejectedValue(new Error("Database error"));

      const result = await suspensionService.isUserSuspended("user-123");

      expect(result).toEqual({
        suspended: false,
        suspensions: [],
        canAppeal: false,
      });
      expect(mockRepository.getByUser).toHaveBeenCalledWith("user-123");
    });
  });

  describe("reviewSuspension", () => {
    const mockReviewData: SuspensionReviewData = {
      suspensionId: "suspension-123",
      action: "extend",
      reason: "Additional violation",
      moderatorId: "moderator-123",
      newDuration: 14 * 24 * 60 * 60 * 1000, // 14 days
    };

    beforeEach(() => {
      mockSuspensionUtils.processReviewAction.mockReturnValue({
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
      });
    });

    it("should review suspension successfully", async () => {
      mockRepository.getById.mockResolvedValue(mockSuspension);
      mockRepository.update.mockResolvedValue();

      await suspensionService.reviewSuspension(mockReviewData);

      expect(mockRepository.getById).toHaveBeenCalledWith("suspension-123");
      expect(mockSuspensionUtils.processReviewAction).toHaveBeenCalledWith(
        mockSuspension,
        "extend",
        14 * 24 * 60 * 60 * 1000
      );
      expect(mockRepository.update).toHaveBeenCalledWith(
        "suspension-123",
        expect.any(Object)
      );
    });

    it("should throw error when suspension not found", async () => {
      mockRepository.getById.mockResolvedValue(null);

      await expect(
        suspensionService.reviewSuspension(mockReviewData)
      ).rejects.toThrow("Failed to review suspension: Suspension not found");
      expect(mockRepository.getById).toHaveBeenCalledWith("suspension-123");
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it("should throw error when suspension is inactive", async () => {
      const inactiveSuspension = { ...mockSuspension, isActive: false };
      mockRepository.getById.mockResolvedValue(inactiveSuspension);

      await expect(
        suspensionService.reviewSuspension(mockReviewData)
      ).rejects.toThrow(
        "Failed to review suspension: Cannot modify inactive suspension"
      );
      expect(mockRepository.getById).toHaveBeenCalledWith("suspension-123");
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it("should throw error when repository update fails", async () => {
      mockRepository.getById.mockResolvedValue(mockSuspension);
      mockRepository.update.mockRejectedValue(new Error("Update failed"));

      await expect(
        suspensionService.reviewSuspension(mockReviewData)
      ).rejects.toThrow("Failed to review suspension: Update failed");
      expect(mockRepository.update).toHaveBeenCalled();
    });
  });

  describe("createAutomaticSuspension", () => {
    beforeEach(() => {
      mockSuspensionUtils.determineAutomaticSuspension.mockReturnValue({
        type: SuspensionType.TEMPORARY,
        duration: 7 * 24 * 60 * 60 * 1000,
      });
      mockSuspensionUtils.formatAutomaticSuspensionReason.mockReturnValue(
        "Automatic suspension for 2 violations"
      );
    });

    it("should create automatic suspension successfully", async () => {
      mockRepository.save.mockResolvedValue();
      mockSuspensionUtils.shouldAffectReputation.mockReturnValue(true);
      mockReputationService.getUserReputation.mockResolvedValue({ score: 50 });
      mockReputationService.updateUserReputation.mockResolvedValue();
      mockSuspensionUtils.getReputationPenalty.mockReturnValue(-10);

      const result = await suspensionService.createAutomaticSuspension(
        "user-123",
        2,
        "Test violation"
      );

      expect(result).toBeDefined();
      expect(
        mockSuspensionUtils.determineAutomaticSuspension
      ).toHaveBeenCalledWith(2);
      expect(
        mockSuspensionUtils.formatAutomaticSuspensionReason
      ).toHaveBeenCalledWith("Test violation", 2);
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it("should return null for warning type", async () => {
      mockSuspensionUtils.determineAutomaticSuspension.mockReturnValue({
        type: SuspensionType.WARNING,
      });

      const result = await suspensionService.createAutomaticSuspension(
        "user-123",
        1,
        "Test violation"
      );

      expect(result).toBeNull();
      expect(
        mockSuspensionUtils.determineAutomaticSuspension
      ).toHaveBeenCalledWith(1);
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it("should return null when creation fails", async () => {
      mockRepository.save.mockRejectedValue(new Error("Save failed"));

      const result = await suspensionService.createAutomaticSuspension(
        "user-123",
        2,
        "Test violation"
      );

      expect(result).toBeNull();
      expect(mockRepository.save).toHaveBeenCalled();
    });
  });

  describe("checkSuspensionExpiration", () => {
    it("should deactivate expired suspensions successfully", async () => {
      const expiredSuspension = { ...mockSuspension, isActive: true };
      const activeSuspension = {
        ...mockSuspension,
        id: "suspension-456",
        isActive: true,
      };

      mockRepository.getActive.mockResolvedValue([
        expiredSuspension,
        activeSuspension,
      ]);
      mockSuspensionUtils.isSuspensionExpired.mockImplementation(
        (suspension: Suspension) => suspension.id === "suspension-123"
      );
      mockSuspensionUtils.createDeactivationUpdates.mockReturnValue({
        isActive: false,
        updatedAt: new Date(),
      });
      mockSuspensionUtils.shouldRestoreReputationOnExpiry.mockReturnValue(true);
      mockReputationService.getUserReputation.mockResolvedValue({ score: 50 });
      mockReputationService.updateUserReputation.mockResolvedValue();
      mockSuspensionUtils.getReputationRestorationBonus.mockReturnValue(5);
      mockRepository.update.mockResolvedValue();

      await suspensionService.checkSuspensionExpiration();

      expect(mockRepository.getActive).toHaveBeenCalled();
      expect(mockSuspensionUtils.isSuspensionExpired).toHaveBeenCalledWith(
        expiredSuspension
      );
      expect(mockSuspensionUtils.isSuspensionExpired).toHaveBeenCalledWith(
        activeSuspension
      );
      expect(mockSuspensionUtils.createDeactivationUpdates).toHaveBeenCalled();
      expect(mockRepository.update).toHaveBeenCalledWith(
        "suspension-123",
        expect.any(Object)
      );
      expect(
        mockSuspensionUtils.shouldRestoreReputationOnExpiry
      ).toHaveBeenCalledWith(SuspensionType.TEMPORARY);
      expect(mockReputationService.getUserReputation).toHaveBeenCalledWith(
        "user-123"
      );
      expect(mockReputationService.updateUserReputation).toHaveBeenCalled();
    });

    it("should not restore reputation when not needed", async () => {
      const expiredSuspension = { ...mockSuspension, isActive: true };

      mockRepository.getActive.mockResolvedValue([expiredSuspension]);
      mockSuspensionUtils.isSuspensionExpired.mockReturnValue(true);
      mockSuspensionUtils.createDeactivationUpdates.mockReturnValue({
        isActive: false,
        updatedAt: new Date(),
      });
      mockSuspensionUtils.shouldRestoreReputationOnExpiry.mockReturnValue(
        false
      );
      mockRepository.update.mockResolvedValue();

      await suspensionService.checkSuspensionExpiration();

      expect(
        mockSuspensionUtils.shouldRestoreReputationOnExpiry
      ).toHaveBeenCalledWith(SuspensionType.TEMPORARY);
      expect(mockReputationService.getUserReputation).not.toHaveBeenCalled();
      expect(mockReputationService.updateUserReputation).not.toHaveBeenCalled();
    });

    it("should handle repository errors gracefully", async () => {
      mockRepository.getActive.mockRejectedValue(new Error("Database error"));

      await expect(
        suspensionService.checkSuspensionExpiration()
      ).resolves.toBeUndefined();
      expect(mockRepository.getActive).toHaveBeenCalled();
    });

    it("should handle reputation update errors gracefully", async () => {
      const expiredSuspension = { ...mockSuspension, isActive: true };

      mockRepository.getActive.mockResolvedValue([expiredSuspension]);
      mockSuspensionUtils.isSuspensionExpired.mockReturnValue(true);
      mockSuspensionUtils.createDeactivationUpdates.mockReturnValue({
        isActive: false,
        updatedAt: new Date(),
      });
      mockSuspensionUtils.shouldRestoreReputationOnExpiry.mockReturnValue(true);
      mockReputationService.getUserReputation.mockRejectedValue(
        new Error("Reputation error")
      );
      mockRepository.update.mockResolvedValue();

      await expect(
        suspensionService.checkSuspensionExpiration()
      ).resolves.toBeUndefined();
      expect(mockRepository.update).toHaveBeenCalled();
      // Should not throw error, just log it
    });
  });

  describe("getSuspensionStats", () => {
    it("should return suspension statistics successfully", async () => {
      const mockStats: SuspensionStats = {
        total: 10,
        active: 5,
        warnings: 3,
        temporary: 4,
        permanent: 2,
        expired: 1,
      };

      const mockSuspensions = [mockSuspension];
      mockRepository.getAll.mockResolvedValue(mockSuspensions);
      mockSuspensionUtils.calculateSuspensionStats.mockReturnValue(mockStats);

      const result = await suspensionService.getSuspensionStats();

      expect(result).toEqual(mockStats);
      expect(mockRepository.getAll).toHaveBeenCalled();
      expect(mockSuspensionUtils.calculateSuspensionStats).toHaveBeenCalledWith(
        mockSuspensions
      );
    });

    it("should return default stats when repository fails", async () => {
      mockRepository.getAll.mockRejectedValue(new Error("Database error"));

      const result = await suspensionService.getSuspensionStats();

      expect(result).toEqual({
        total: 0,
        active: 0,
        warnings: 0,
        temporary: 0,
        permanent: 0,
        expired: 0,
      });
      expect(mockRepository.getAll).toHaveBeenCalled();
    });
  });

  describe("Private Methods", () => {
    describe("updateUserReputationForSuspension", () => {
      it("should update user reputation for suspension", async () => {
        mockReputationService.getUserReputation.mockResolvedValue({
          score: 50,
        });
        mockReputationService.updateUserReputation.mockResolvedValue();
        mockSuspensionUtils.getReputationPenalty.mockReturnValue(-10);

        // Access private method through public method
        await suspensionService.createSuspension(mockCreateSuspensionData);

        expect(mockSuspensionUtils.getReputationPenalty).toHaveBeenCalledWith(
          SuspensionType.TEMPORARY
        );
        expect(mockReputationService.getUserReputation).toHaveBeenCalledWith(
          "user-123"
        );
        expect(mockReputationService.updateUserReputation).toHaveBeenCalledWith(
          "user-123",
          {
            score: 40, // 50 - 10
            updatedAt: expect.any(Date),
          }
        );
      });

      it("should handle reputation update errors gracefully", async () => {
        mockRepository.save.mockResolvedValue();
        mockSuspensionUtils.shouldAffectReputation.mockReturnValue(true);
        mockReputationService.getUserReputation.mockRejectedValue(
          new Error("Reputation error")
        );

        await expect(
          suspensionService.createSuspension(mockCreateSuspensionData)
        ).resolves.toBeDefined();
        // Should not throw error, just log it
      });
    });

    describe("restoreUserReputationAfterSuspension", () => {
      it("should restore user reputation after suspension expires", async () => {
        const expiredSuspension = { ...mockSuspension, isActive: true };

        mockRepository.getActive.mockResolvedValue([expiredSuspension]);
        mockSuspensionUtils.isSuspensionExpired.mockReturnValue(true);
        mockSuspensionUtils.createDeactivationUpdates.mockReturnValue({
          isActive: false,
          updatedAt: new Date(),
        });
        mockSuspensionUtils.shouldRestoreReputationOnExpiry.mockReturnValue(
          true
        );
        mockReputationService.getUserReputation.mockResolvedValue({
          score: 40,
        });
        mockReputationService.updateUserReputation.mockResolvedValue();
        mockSuspensionUtils.getReputationRestorationBonus.mockReturnValue(5);
        mockRepository.update.mockResolvedValue();

        await suspensionService.checkSuspensionExpiration();

        expect(
          mockSuspensionUtils.getReputationRestorationBonus
        ).toHaveBeenCalled();
        expect(mockReputationService.getUserReputation).toHaveBeenCalledWith(
          "user-123"
        );
        expect(mockReputationService.updateUserReputation).toHaveBeenCalledWith(
          "user-123",
          {
            score: 45, // 40 + 5
            updatedAt: expect.any(Date),
          }
        );
      });

      it("should cap reputation at 100", async () => {
        const expiredSuspension = { ...mockSuspension, isActive: true };

        mockRepository.getActive.mockResolvedValue([expiredSuspension]);
        mockSuspensionUtils.isSuspensionExpired.mockReturnValue(true);
        mockSuspensionUtils.createDeactivationUpdates.mockReturnValue({
          isActive: false,
          updatedAt: new Date(),
        });
        mockSuspensionUtils.shouldRestoreReputationOnExpiry.mockReturnValue(
          true
        );
        mockReputationService.getUserReputation.mockResolvedValue({
          score: 98,
        });
        mockReputationService.updateUserReputation.mockResolvedValue();
        mockSuspensionUtils.getReputationRestorationBonus.mockReturnValue(5);
        mockRepository.update.mockResolvedValue();

        await suspensionService.checkSuspensionExpiration();

        expect(mockReputationService.updateUserReputation).toHaveBeenCalledWith(
          "user-123",
          {
            score: 100, // Capped at 100
            updatedAt: expect.any(Date),
          }
        );
      });

      it("should handle reputation restoration errors gracefully", async () => {
        const expiredSuspension = { ...mockSuspension, isActive: true };

        mockRepository.getActive.mockResolvedValue([expiredSuspension]);
        mockSuspensionUtils.isSuspensionExpired.mockReturnValue(true);
        mockSuspensionUtils.createDeactivationUpdates.mockReturnValue({
          isActive: false,
          updatedAt: new Date(),
        });
        mockSuspensionUtils.shouldRestoreReputationOnExpiry.mockReturnValue(
          true
        );
        mockReputationService.getUserReputation.mockRejectedValue(
          new Error("Reputation error")
        );
        mockRepository.update.mockResolvedValue();

        await expect(
          suspensionService.checkSuspensionExpiration()
        ).resolves.toBeUndefined();
        // Should not throw error, just log it
      });
    });
  });
});
