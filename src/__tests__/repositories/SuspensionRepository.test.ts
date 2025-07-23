import { SuspensionRepository } from "../../repositories/SuspensionRepository";
import { Suspension, SuspensionType, BanType } from "../../types";

describe("SuspensionRepository Interface", () => {
  let mockRepository: jest.Mocked<SuspensionRepository>;

  const mockSuspension: Suspension = {
    id: "suspension-1",
    userId: "user-1",
    type: SuspensionType.TEMPORARY,
    banType: BanType.CONTENT_HIDDEN,
    reason: "Violation of community guidelines",
    moderatorId: "moderator-1",
    startDate: new Date("2024-01-01"),
    endDate: new Date("2024-02-01"),
    isActive: true,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  };

  beforeEach(() => {
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
  });

  describe("Basic CRUD Operations", () => {
    it("should save a suspension", async () => {
      mockRepository.save.mockResolvedValue();

      await mockRepository.save(mockSuspension);

      expect(mockRepository.save).toHaveBeenCalledWith(mockSuspension);
    });

    it("should get a suspension by ID", async () => {
      mockRepository.getById.mockResolvedValue(mockSuspension);

      const result = await mockRepository.getById("suspension-1");

      expect(mockRepository.getById).toHaveBeenCalledWith("suspension-1");
      expect(result).toEqual(mockSuspension);
    });

    it("should return null for non-existent suspension", async () => {
      mockRepository.getById.mockResolvedValue(null);

      const result = await mockRepository.getById("non-existent");

      expect(mockRepository.getById).toHaveBeenCalledWith("non-existent");
      expect(result).toBeNull();
    });

    it("should get all suspensions", async () => {
      const suspensions = [mockSuspension];
      mockRepository.getAll.mockResolvedValue(suspensions);

      const result = await mockRepository.getAll();

      expect(mockRepository.getAll).toHaveBeenCalled();
      expect(result).toEqual(suspensions);
    });

    it("should update a suspension", async () => {
      const updates = { isActive: false };
      mockRepository.update.mockResolvedValue();

      await mockRepository.update("suspension-1", updates);

      expect(mockRepository.update).toHaveBeenCalledWith(
        "suspension-1",
        updates
      );
    });

    it("should delete a suspension", async () => {
      mockRepository.delete.mockResolvedValue();

      await mockRepository.delete("suspension-1");

      expect(mockRepository.delete).toHaveBeenCalledWith("suspension-1");
    });
  });

  describe("Query Methods", () => {
    it("should get suspensions by user ID", async () => {
      const suspensions = [mockSuspension];
      mockRepository.getByUser.mockResolvedValue(suspensions);

      const result = await mockRepository.getByUser("user-1");

      expect(mockRepository.getByUser).toHaveBeenCalledWith("user-1");
      expect(result).toEqual(suspensions);
    });

    it("should get active suspensions", async () => {
      const suspensions = [mockSuspension];
      mockRepository.getActive.mockResolvedValue(suspensions);

      const result = await mockRepository.getActive();

      expect(mockRepository.getActive).toHaveBeenCalled();
      expect(result).toEqual(suspensions);
    });

    it("should get suspensions by moderator ID", async () => {
      const suspensions = [mockSuspension];
      mockRepository.getByModerator.mockResolvedValue(suspensions);

      const result = await mockRepository.getByModerator("moderator-1");

      expect(mockRepository.getByModerator).toHaveBeenCalledWith("moderator-1");
      expect(result).toEqual(suspensions);
    });

    it("should get suspensions by type", async () => {
      const suspensions = [mockSuspension];
      mockRepository.getByType.mockResolvedValue(suspensions);

      const result = await mockRepository.getByType(SuspensionType.TEMPORARY);

      expect(mockRepository.getByType).toHaveBeenCalledWith(
        SuspensionType.TEMPORARY
      );
      expect(result).toEqual(suspensions);
    });

    it("should get suspensions by date range", async () => {
      const suspensions = [mockSuspension];
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");
      mockRepository.getByDateRange.mockResolvedValue(suspensions);

      const result = await mockRepository.getByDateRange(startDate, endDate);

      expect(mockRepository.getByDateRange).toHaveBeenCalledWith(
        startDate,
        endDate
      );
      expect(result).toEqual(suspensions);
    });
  });

  describe("Error Handling", () => {
    it("should handle save errors", async () => {
      const error = new Error("Database error");
      mockRepository.save.mockRejectedValue(error);

      await expect(mockRepository.save(mockSuspension)).rejects.toThrow(
        "Database error"
      );
    });

    it("should handle getById errors", async () => {
      const error = new Error("Database error");
      mockRepository.getById.mockRejectedValue(error);

      await expect(mockRepository.getById("suspension-1")).rejects.toThrow(
        "Database error"
      );
    });

    it("should handle update errors", async () => {
      const error = new Error("Database error");
      mockRepository.update.mockRejectedValue(error);

      await expect(
        mockRepository.update("suspension-1", { isActive: false })
      ).rejects.toThrow("Database error");
    });

    it("should handle delete errors", async () => {
      const error = new Error("Database error");
      mockRepository.delete.mockRejectedValue(error);

      await expect(mockRepository.delete("suspension-1")).rejects.toThrow(
        "Database error"
      );
    });

    it("should handle getByUser errors", async () => {
      const error = new Error("Database error");
      mockRepository.getByUser.mockRejectedValue(error);

      await expect(mockRepository.getByUser("user-1")).rejects.toThrow(
        "Database error"
      );
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty results from getAll", async () => {
      mockRepository.getAll.mockResolvedValue([]);

      const result = await mockRepository.getAll();

      expect(result).toEqual([]);
    });

    it("should handle empty results from getByUser", async () => {
      mockRepository.getByUser.mockResolvedValue([]);

      const result = await mockRepository.getByUser("user-1");

      expect(result).toEqual([]);
    });

    it("should handle empty results from getActive", async () => {
      mockRepository.getActive.mockResolvedValue([]);

      const result = await mockRepository.getActive();

      expect(result).toEqual([]);
    });

    it("should handle suspension without end date", async () => {
      const permanentSuspension: Suspension = {
        ...mockSuspension,
        type: SuspensionType.PERMANENT,
        endDate: undefined,
      };
      mockRepository.getById.mockResolvedValue(permanentSuspension);

      const result = await mockRepository.getById("suspension-1");

      expect(result).toEqual(permanentSuspension);
      expect(result?.endDate).toBeUndefined();
    });

    it("should handle suspension without ban type", async () => {
      const warningSuspension: Suspension = {
        ...mockSuspension,
        type: SuspensionType.WARNING,
        banType: undefined,
      };
      mockRepository.getById.mockResolvedValue(warningSuspension);

      const result = await mockRepository.getById("suspension-1");

      expect(result).toEqual(warningSuspension);
      expect(result?.banType).toBeUndefined();
    });
  });

  describe("Suspension Types", () => {
    it("should handle warning suspensions", async () => {
      const warningSuspension: Suspension = {
        ...mockSuspension,
        type: SuspensionType.WARNING,
        banType: undefined,
      };
      mockRepository.getByType.mockResolvedValue([warningSuspension]);

      const result = await mockRepository.getByType(SuspensionType.WARNING);

      expect(result).toEqual([warningSuspension]);
    });

    it("should handle temporary suspensions", async () => {
      const temporarySuspension: Suspension = {
        ...mockSuspension,
        type: SuspensionType.TEMPORARY,
        banType: BanType.CONTENT_HIDDEN,
      };
      mockRepository.getByType.mockResolvedValue([temporarySuspension]);

      const result = await mockRepository.getByType(SuspensionType.TEMPORARY);

      expect(result).toEqual([temporarySuspension]);
    });

    it("should handle permanent suspensions", async () => {
      const permanentSuspension: Suspension = {
        ...mockSuspension,
        type: SuspensionType.PERMANENT,
        banType: BanType.CONTENT_VISIBLE,
        endDate: undefined,
      };
      mockRepository.getByType.mockResolvedValue([permanentSuspension]);

      const result = await mockRepository.getByType(SuspensionType.PERMANENT);

      expect(result).toEqual([permanentSuspension]);
    });
  });

  describe("Ban Types", () => {
    it("should handle content hidden bans", async () => {
      const contentHiddenSuspension: Suspension = {
        ...mockSuspension,
        banType: BanType.CONTENT_HIDDEN,
      };
      mockRepository.getById.mockResolvedValue(contentHiddenSuspension);

      const result = await mockRepository.getById("suspension-1");

      expect(result?.banType).toBe(BanType.CONTENT_HIDDEN);
    });

    it("should handle content visible bans", async () => {
      const contentVisibleSuspension: Suspension = {
        ...mockSuspension,
        banType: BanType.CONTENT_VISIBLE,
      };
      mockRepository.getById.mockResolvedValue(contentVisibleSuspension);

      const result = await mockRepository.getById("suspension-1");

      expect(result?.banType).toBe(BanType.CONTENT_VISIBLE);
    });

    it("should handle shadow bans", async () => {
      const shadowBanSuspension: Suspension = {
        ...mockSuspension,
        banType: BanType.SHADOW_BAN,
      };
      mockRepository.getById.mockResolvedValue(shadowBanSuspension);

      const result = await mockRepository.getById("suspension-1");

      expect(result?.banType).toBe(BanType.SHADOW_BAN);
    });
  });
});
