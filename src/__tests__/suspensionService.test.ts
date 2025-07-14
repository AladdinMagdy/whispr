/**
 * Tests for SuspensionService
 */

import {
  SuspensionService,
  getSuspensionService,
} from "../services/suspensionService";
import { SuspensionType } from "../types";
import { getFirestoreService } from "../services/firestoreService";

// Mock the services
jest.mock("../services/firestoreService");

// Create mock objects manually
const mockFirestoreService = {
  saveSuspension: jest.fn(),
  getSuspension: jest.fn(),
  getUserSuspensions: jest.fn(),
  updateSuspension: jest.fn(),
  getActiveSuspensions: jest.fn(),
  getAllSuspensions: jest.fn(),
  adjustUserReputationScore: jest.fn(),
};

// Mock the service getter to return our mock object
(getFirestoreService as jest.Mock).mockReturnValue(mockFirestoreService);

describe("SuspensionService", () => {
  let suspensionService: SuspensionService;

  beforeEach(() => {
    jest.clearAllMocks();
    suspensionService = getSuspensionService();
  });

  describe("createSuspension", () => {
    it("should create a temporary suspension successfully", async () => {
      // Mock firestore service
      mockFirestoreService.saveSuspension.mockResolvedValue(undefined);
      mockFirestoreService.adjustUserReputationScore.mockResolvedValue(
        undefined
      );

      const suspensionData = {
        userId: "user-123",
        reason: "Violation of community guidelines",
        type: SuspensionType.TEMPORARY,
        duration: 24 * 60 * 60 * 1000, // 24 hours
        moderatorId: "mod-123",
        appealable: true,
      };

      const result = await suspensionService.createSuspension(suspensionData);

      expect(result).toMatchObject({
        userId: "user-123",
        reason: "Violation of community guidelines",
        type: SuspensionType.TEMPORARY,
        duration: 24 * 60 * 60 * 1000,
        isActive: true,
        appealable: true,
      });

      expect(mockFirestoreService.saveSuspension).toHaveBeenCalledWith(result);
      expect(
        mockFirestoreService.adjustUserReputationScore
      ).toHaveBeenCalledWith("user-123", -5, "Suspension: temporary");
    });

    it("should create a permanent suspension", async () => {
      mockFirestoreService.saveSuspension.mockResolvedValue(undefined);
      mockFirestoreService.adjustUserReputationScore.mockResolvedValue(
        undefined
      );

      const suspensionData = {
        userId: "user-123",
        reason: "Severe violation",
        type: SuspensionType.PERMANENT,
        moderatorId: "mod-123",
      };

      const result = await suspensionService.createSuspension(suspensionData);

      expect(result.type).toBe(SuspensionType.PERMANENT);
      expect(result.appealable).toBe(false);
      expect(
        mockFirestoreService.adjustUserReputationScore
      ).toHaveBeenCalledWith("user-123", -5, "Suspension: permanent");
    });

    it("should reject temporary suspension without duration", async () => {
      const suspensionData = {
        userId: "user-123",
        reason: "Violation",
        type: SuspensionType.TEMPORARY,
        // Missing duration
      };

      await expect(
        suspensionService.createSuspension(suspensionData)
      ).rejects.toThrow("Temporary suspensions require a duration");
    });

    it("should reject permanent suspension with duration", async () => {
      const suspensionData = {
        userId: "user-123",
        reason: "Violation",
        type: SuspensionType.PERMANENT,
        duration: 24 * 60 * 60 * 1000, // Should not have duration
      };

      await expect(
        suspensionService.createSuspension(suspensionData)
      ).rejects.toThrow("Permanent suspensions cannot have a duration");
    });
  });

  describe("getSuspension", () => {
    it("should get suspension by ID", async () => {
      const mockSuspension = {
        id: "suspension-123",
        userId: "user-123",
        reason: "Test suspension",
        type: SuspensionType.TEMPORARY,
        duration: 24 * 60 * 60 * 1000,
        startDate: new Date(),
        endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        isActive: true,
        appealable: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFirestoreService.getSuspension.mockResolvedValue(mockSuspension);

      const result = await suspensionService.getSuspension("suspension-123");

      expect(result).toEqual(mockSuspension);
      expect(mockFirestoreService.getSuspension).toHaveBeenCalledWith(
        "suspension-123"
      );
    });

    it("should return null if suspension not found", async () => {
      mockFirestoreService.getSuspension.mockResolvedValue(null);

      const result = await suspensionService.getSuspension("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("isUserSuspended", () => {
    it("should return suspended status for active suspension", async () => {
      const mockSuspensions = [
        {
          id: "suspension-123",
          userId: "user-123",
          reason: "Test suspension",
          type: SuspensionType.TEMPORARY,
          duration: 24 * 60 * 60 * 1000,
          startDate: new Date(),
          endDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Future date
          isActive: true,
          appealable: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockFirestoreService.getUserSuspensions.mockResolvedValue(
        mockSuspensions
      );

      const result = await suspensionService.isUserSuspended("user-123");

      expect(result).toEqual({
        suspended: true,
        suspensions: mockSuspensions,
        canAppeal: true,
      });
    });

    it("should return not suspended for expired suspension", async () => {
      const mockSuspensions = [
        {
          id: "suspension-123",
          userId: "user-123",
          reason: "Test suspension",
          type: SuspensionType.TEMPORARY,
          duration: 24 * 60 * 60 * 1000,
          startDate: new Date(),
          endDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Past date
          isActive: true,
          appealable: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockFirestoreService.getUserSuspensions.mockResolvedValue(
        mockSuspensions
      );

      const result = await suspensionService.isUserSuspended("user-123");

      expect(result).toEqual({
        suspended: false,
        suspensions: [],
        canAppeal: false,
      });
    });
  });

  describe("reviewSuspension", () => {
    it("should extend a temporary suspension", async () => {
      const mockSuspension = {
        id: "suspension-123",
        userId: "user-123",
        reason: "Test suspension",
        type: SuspensionType.TEMPORARY,
        duration: 24 * 60 * 60 * 1000,
        startDate: new Date(),
        endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        isActive: true,
        appealable: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFirestoreService.getSuspension.mockResolvedValue(mockSuspension);
      mockFirestoreService.updateSuspension.mockResolvedValue(undefined);

      const reviewData = {
        suspensionId: "suspension-123",
        action: "extend" as const,
        reason: "Additional violation",
        moderatorId: "mod-123",
        newDuration: 24 * 60 * 60 * 1000, // 24 hours
      };

      await suspensionService.reviewSuspension(reviewData);

      expect(mockFirestoreService.updateSuspension).toHaveBeenCalledWith(
        "suspension-123",
        {
          endDate: expect.any(Date),
          updatedAt: expect.any(Date),
        }
      );
    });

    it("should remove a suspension", async () => {
      const mockSuspension = {
        id: "suspension-123",
        userId: "user-123",
        reason: "Test suspension",
        type: SuspensionType.TEMPORARY,
        duration: 24 * 60 * 60 * 1000,
        startDate: new Date(),
        endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        isActive: true,
        appealable: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFirestoreService.getSuspension.mockResolvedValue(mockSuspension);
      mockFirestoreService.updateSuspension.mockResolvedValue(undefined);

      const reviewData = {
        suspensionId: "suspension-123",
        action: "remove" as const,
        reason: "Suspension lifted",
        moderatorId: "mod-123",
      };

      await suspensionService.reviewSuspension(reviewData);

      expect(mockFirestoreService.updateSuspension).toHaveBeenCalledWith(
        "suspension-123",
        {
          isActive: false,
          endDate: expect.any(Date),
          updatedAt: expect.any(Date),
        }
      );
    });

    it("should reject modification of inactive suspension", async () => {
      const mockSuspension = {
        id: "suspension-123",
        userId: "user-123",
        reason: "Test suspension",
        type: SuspensionType.TEMPORARY,
        duration: 24 * 60 * 60 * 1000,
        startDate: new Date(),
        endDate: new Date(),
        isActive: false, // Inactive
        appealable: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFirestoreService.getSuspension.mockResolvedValue(mockSuspension);

      const reviewData = {
        suspensionId: "suspension-123",
        action: "extend" as const,
        reason: "Test",
        moderatorId: "mod-123",
        newDuration: 24 * 60 * 60 * 1000,
      };

      await expect(
        suspensionService.reviewSuspension(reviewData)
      ).rejects.toThrow("Cannot modify inactive suspension");
    });
  });

  describe("createAutomaticSuspension", () => {
    it("should create warning for first violation", async () => {
      const result = await suspensionService.createAutomaticSuspension(
        "user-123",
        1,
        "First violation"
      );

      expect(result).toBeNull(); // Warnings are just recorded, not created as suspensions
    });

    it("should create temporary suspension for second violation", async () => {
      mockFirestoreService.saveSuspension.mockResolvedValue(undefined);
      mockFirestoreService.adjustUserReputationScore.mockResolvedValue(
        undefined
      );

      const result = await suspensionService.createAutomaticSuspension(
        "user-123",
        2,
        "Second violation"
      );

      expect(result?.type).toBe(SuspensionType.TEMPORARY);
      expect(result?.duration).toBe(24 * 60 * 60 * 1000); // 24 hours
    });

    it("should create permanent suspension for fourth violation", async () => {
      mockFirestoreService.saveSuspension.mockResolvedValue(undefined);
      mockFirestoreService.adjustUserReputationScore.mockResolvedValue(
        undefined
      );

      const result = await suspensionService.createAutomaticSuspension(
        "user-123",
        4,
        "Fourth violation"
      );

      expect(result?.type).toBe(SuspensionType.PERMANENT);
      expect(result?.appealable).toBe(false);
    });
  });

  describe("checkSuspensionExpiration", () => {
    it("should deactivate expired suspensions", async () => {
      const expiredSuspension = {
        id: "suspension-123",
        userId: "user-123",
        reason: "Test suspension",
        type: SuspensionType.TEMPORARY,
        duration: 24 * 60 * 60 * 1000,
        startDate: new Date(),
        endDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired
        isActive: true,
        appealable: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFirestoreService.getActiveSuspensions.mockResolvedValue([
        expiredSuspension,
      ]);
      mockFirestoreService.updateSuspension.mockResolvedValue(undefined);
      mockFirestoreService.adjustUserReputationScore.mockResolvedValue(
        undefined
      );

      await suspensionService.checkSuspensionExpiration();

      expect(mockFirestoreService.updateSuspension).toHaveBeenCalledWith(
        "suspension-123",
        {
          isActive: false,
          updatedAt: expect.any(Date),
        }
      );

      // Should restore reputation for temporary suspensions
      expect(
        mockFirestoreService.adjustUserReputationScore
      ).toHaveBeenCalledWith(
        "user-123",
        5,
        "Suspension expired - reputation restored"
      );
    });
  });

  describe("getSuspensionStats", () => {
    it("should return suspension statistics", async () => {
      const mockSuspensions = [
        {
          id: "suspension-1",
          userId: "user-1",
          reason: "Test warning",
          type: SuspensionType.WARNING,
          duration: 0,
          startDate: new Date(),
          endDate: new Date(),
          isActive: false,
          appealable: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "suspension-2",
          userId: "user-2",
          reason: "Test temporary active",
          type: SuspensionType.TEMPORARY,
          duration: 24 * 60 * 60 * 1000,
          startDate: new Date(),
          endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          isActive: true,
          appealable: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "suspension-3",
          userId: "user-3",
          reason: "Test temporary inactive",
          type: SuspensionType.TEMPORARY,
          duration: 24 * 60 * 60 * 1000,
          startDate: new Date(),
          endDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
          isActive: false,
          appealable: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "suspension-4",
          userId: "user-4",
          reason: "Test permanent",
          type: SuspensionType.PERMANENT,
          duration: 0,
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          isActive: true,
          appealable: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockFirestoreService.getAllSuspensions.mockResolvedValue(mockSuspensions);

      const stats = await suspensionService.getSuspensionStats();

      expect(stats).toEqual({
        total: 4,
        active: 2,
        warnings: 1,
        temporary: 2,
        permanent: 1,
        expired: 2,
      });
    });
  });
});
