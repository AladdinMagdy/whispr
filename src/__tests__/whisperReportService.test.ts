import { WhisperReportService } from "../services/whisperReportService";
import { ReportRepository } from "../repositories/ReportRepository";
import {
  Report,
  ReportCategory,
  ReportPriority,
  ReportStatus,
  UserReputation,
} from "../types";

// Mock all dependencies before importing the service
jest.mock("../services/reportPriorityService", () => ({
  getReportPriorityService: jest.fn(),
}));

jest.mock("../services/reportAnalyticsService", () => ({
  getReportAnalyticsService: jest.fn(),
}));

jest.mock("../services/reputationService", () => ({
  getReputationService: jest.fn(),
}));

jest.mock("../services/privacyService", () => ({
  getPrivacyService: jest.fn(),
}));

describe("WhisperReportService", () => {
  let whisperReportService: WhisperReportService;
  let mockRepository: jest.Mocked<ReportRepository>;
  let mockPriorityService: any;
  let mockAnalyticsService: any;
  let mockReputationService: any;
  let mockPrivacyService: any;

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

  const mockReport: Report = {
    id: "report123",
    whisperId: "whisper123",
    reporterId: "reporter123",
    reporterDisplayName: "Test Reporter",
    reporterReputation: 75,
    category: ReportCategory.HARASSMENT,
    priority: ReportPriority.HIGH,
    status: ReportStatus.PENDING,
    reason: "Test report reason",
    createdAt: new Date(),
    updatedAt: new Date(),
    reputationWeight: 1.2,
  };

  const createReportData = {
    whisperId: "whisper123",
    reporterId: "reporter123",
    reporterDisplayName: "Test Reporter",
    category: ReportCategory.HARASSMENT,
    reason: "Test report reason",
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock repository
    mockRepository = {
      save: jest.fn(),
      getWithFilters: jest.fn(),
      getById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getByWhisper: jest.fn(),
      getByReporter: jest.fn(),
      getAll: jest.fn(),
      getByStatus: jest.fn(),
      getByCategory: jest.fn(),
      getByPriority: jest.fn(),
      getByDateRange: jest.fn(),
      getPending: jest.fn(),
      getCritical: jest.fn(),
      getStats: jest.fn(),
      getWhisperStats: jest.fn(),
      saveCommentReport: jest.fn(),
      getCommentReport: jest.fn(),
      getCommentReports: jest.fn(),
      updateCommentReport: jest.fn(),
      updateCommentReportStatus: jest.fn(),
      hasUserReportedComment: jest.fn(),
      getCommentReportStats: jest.fn(),
    };

    // Create mock services
    mockPriorityService = {
      calculatePriority: jest.fn().mockReturnValue(ReportPriority.HIGH),
      calculateReputationWeight: jest.fn().mockReturnValue(1.2),
      escalatePriority: jest.fn().mockReturnValue(ReportPriority.CRITICAL),
    };

    mockAnalyticsService = {
      getWhisperReportStats: jest.fn().mockResolvedValue({
        totalReports: 1,
        uniqueReporters: 1,
        categories: { [ReportCategory.HARASSMENT]: 1 },
        priorityBreakdown: { [ReportPriority.HIGH]: 1 },
        statusBreakdown: { [ReportStatus.PENDING]: 1 },
        averagePriority: 3,
        escalationRate: 0,
      }),
    };

    mockReputationService = {
      getUserReputation: jest.fn().mockResolvedValue(mockUserReputation),
    };

    mockPrivacyService = {
      isUserPermanentlyBanned: jest.fn().mockResolvedValue(false),
    };

    // Mock the service getters
    const { getReportPriorityService } = jest.requireMock(
      "../services/reportPriorityService"
    );
    const { getReportAnalyticsService } = jest.requireMock(
      "../services/reportAnalyticsService"
    );
    const { getReputationService } = jest.requireMock(
      "../services/reputationService"
    );
    const { getPrivacyService } = jest.requireMock(
      "../services/privacyService"
    );

    getReportPriorityService.mockReturnValue(mockPriorityService);
    getReportAnalyticsService.mockReturnValue(mockAnalyticsService);
    getReputationService.mockReturnValue(mockReputationService);
    getPrivacyService.mockReturnValue(mockPrivacyService);

    // Create service instance with mock repository
    whisperReportService = new WhisperReportService(mockRepository);
  });

  afterEach(() => {
    WhisperReportService.resetInstance();
  });

  describe("Singleton Pattern", () => {
    it("should return the same instance", () => {
      const instance1 = WhisperReportService.getInstance();
      const instance2 = WhisperReportService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("should reset instance correctly", () => {
      const instance1 = WhisperReportService.getInstance();
      WhisperReportService.resetInstance();
      const instance2 = WhisperReportService.getInstance();
      expect(instance1).not.toBe(instance2);
    });

    it("should destroy instance correctly", () => {
      const instance = WhisperReportService.getInstance();
      WhisperReportService.destroyInstance();
      const newInstance = WhisperReportService.getInstance();
      expect(instance).not.toBe(newInstance);
    });
  });

  describe("createReport", () => {
    it("should create a report successfully", async () => {
      mockRepository.getWithFilters.mockResolvedValue([]);
      mockRepository.save.mockResolvedValue(undefined);

      const result = await whisperReportService.createReport(createReportData);

      expect(result).toBeDefined();
      expect(result.whisperId).toBe(createReportData.whisperId);
      expect(result.reporterId).toBe(createReportData.reporterId);
      expect(result.category).toBe(createReportData.category);
      expect(result.reason).toBe(createReportData.reason);
      expect(mockRepository.save).toHaveBeenCalled();
      expect(mockPriorityService.calculatePriority).toHaveBeenCalled();
      expect(mockPriorityService.calculateReputationWeight).toHaveBeenCalled();
    });

    it("should handle existing report and update it", async () => {
      const existingReport = { ...mockReport, reason: "Original report" };
      mockRepository.getWithFilters.mockResolvedValue([existingReport]);
      mockRepository.update.mockResolvedValue(undefined);

      const result = await whisperReportService.createReport(createReportData);

      expect(result).toBeDefined();
      expect(result.reason).toContain("Original report");
      expect(result.reason).toContain("Test report reason");
      expect(mockRepository.update).toHaveBeenCalled();
    });

    it("should handle banned users", async () => {
      const bannedReputation = { ...mockUserReputation, level: "banned" };
      mockReputationService.getUserReputation.mockResolvedValue(
        bannedReputation
      );

      await expect(
        whisperReportService.createReport(createReportData)
      ).rejects.toThrow("Banned users cannot submit reports");
    });

    it("should handle repository errors", async () => {
      mockRepository.getWithFilters.mockRejectedValue(
        new Error("Database error")
      );

      await expect(
        whisperReportService.createReport(createReportData)
      ).rejects.toThrow("Failed to create whisper report: Database error");
    });
  });

  describe("getReports", () => {
    it("should get reports with filters", async () => {
      const mockReports = [mockReport];
      mockRepository.getWithFilters.mockResolvedValue(mockReports);

      const filters = {
        whisperId: "whisper123",
        category: ReportCategory.HARASSMENT,
      };

      const result = await whisperReportService.getReports(filters);

      expect(result).toEqual(mockReports);
      expect(mockRepository.getWithFilters).toHaveBeenCalledWith(filters);
    });

    it("should handle empty filters", async () => {
      const mockReports = [mockReport];
      mockRepository.getWithFilters.mockResolvedValue(mockReports);

      const result = await whisperReportService.getReports();

      expect(result).toEqual(mockReports);
      expect(mockRepository.getWithFilters).toHaveBeenCalledWith({});
    });

    it("should handle repository errors", async () => {
      mockRepository.getWithFilters.mockRejectedValue(
        new Error("Database error")
      );

      await expect(whisperReportService.getReports()).rejects.toThrow(
        "Failed to get whisper reports: Database error"
      );
    });
  });

  describe("getReport", () => {
    it("should get a report by ID", async () => {
      mockRepository.getById.mockResolvedValue(mockReport);

      const result = await whisperReportService.getReport("report123");

      expect(result).toEqual(mockReport);
      expect(mockRepository.getById).toHaveBeenCalledWith("report123");
    });

    it("should return null for non-existent report", async () => {
      mockRepository.getById.mockResolvedValue(null);

      const result = await whisperReportService.getReport("nonexistent");

      expect(result).toBeNull();
    });

    it("should handle repository errors", async () => {
      mockRepository.getById.mockRejectedValue(new Error("Database error"));

      await expect(whisperReportService.getReport("report123")).rejects.toThrow(
        "Failed to get whisper report: Database error"
      );
    });
  });

  describe("updateStatus", () => {
    it("should update report status", async () => {
      mockRepository.getById.mockResolvedValue(mockReport);
      mockRepository.update.mockResolvedValue(undefined);

      await whisperReportService.updateStatus(
        "report123",
        ReportStatus.RESOLVED,
        "moderator123"
      );

      expect(mockRepository.update).toHaveBeenCalledWith("report123", {
        ...mockReport,
        status: ReportStatus.RESOLVED,
        updatedAt: expect.any(Date),
        reviewedAt: expect.any(Date),
        reviewedBy: "moderator123",
      });
    });

    it("should handle non-existent report", async () => {
      mockRepository.getById.mockResolvedValue(null);

      await expect(
        whisperReportService.updateStatus("nonexistent", ReportStatus.RESOLVED)
      ).rejects.toThrow("Report not found");
    });

    it("should handle repository errors", async () => {
      mockRepository.getById.mockResolvedValue(mockReport);
      mockRepository.update.mockRejectedValue(new Error("Database error"));

      await expect(
        whisperReportService.updateStatus("report123", ReportStatus.RESOLVED)
      ).rejects.toThrow(
        "Failed to update whisper report status: Database error"
      );
    });
  });

  describe("hasUserReported", () => {
    it("should return true if user has reported", async () => {
      mockRepository.getWithFilters.mockResolvedValue([mockReport]);

      const result = await whisperReportService.hasUserReported(
        "whisper123",
        "reporter123"
      );

      expect(result).toBe(true);
    });

    it("should return false if user has not reported", async () => {
      mockRepository.getWithFilters.mockResolvedValue([]);

      const result = await whisperReportService.hasUserReported(
        "whisper123",
        "reporter123"
      );

      expect(result).toBe(false);
    });

    it("should handle repository errors gracefully", async () => {
      mockRepository.getWithFilters.mockRejectedValue(
        new Error("Database error")
      );

      const result = await whisperReportService.hasUserReported(
        "whisper123",
        "reporter123"
      );

      expect(result).toBe(false);
    });
  });

  describe("getWhisperStats", () => {
    it("should get whisper statistics", async () => {
      const mockReports = [mockReport];
      const mockStats = {
        totalReports: 1,
        uniqueReporters: 1,
        categories: { [ReportCategory.HARASSMENT]: 1 },
        priorityBreakdown: { [ReportPriority.HIGH]: 1 },
        statusBreakdown: { [ReportStatus.PENDING]: 1 },
        averagePriority: 3,
        escalationRate: 0,
      };

      mockRepository.getWithFilters.mockResolvedValue(mockReports);
      mockAnalyticsService.getWhisperReportStats.mockResolvedValue(mockStats);

      const result = await whisperReportService.getWhisperStats("whisper123");

      expect(result).toEqual(mockStats);
      expect(mockRepository.getWithFilters).toHaveBeenCalledWith({
        whisperId: "whisper123",
      });
      expect(mockAnalyticsService.getWhisperReportStats).toHaveBeenCalledWith(
        mockReports,
        "whisper123"
      );
    });

    it("should handle empty reports", async () => {
      const emptyStats = {
        totalReports: 0,
        uniqueReporters: 0,
        categories: {},
        priorityBreakdown: {},
        statusBreakdown: {},
        averagePriority: 0,
        escalationRate: 0,
      };

      mockRepository.getWithFilters.mockResolvedValue([]);
      mockAnalyticsService.getWhisperReportStats.mockResolvedValue(emptyStats);

      const result = await whisperReportService.getWhisperStats("whisper123");

      expect(result.totalReports).toBe(0);
      expect(result.uniqueReporters).toBe(0);
    });

    it("should handle repository errors", async () => {
      mockRepository.getWithFilters.mockRejectedValue(
        new Error("Database error")
      );

      await expect(
        whisperReportService.getWhisperStats("whisper123")
      ).rejects.toThrow("Failed to get whisper report stats: Database error");
    });
  });

  describe("getReportsByWhisper", () => {
    it("should get reports by whisper ID", async () => {
      const mockReports = [mockReport];
      mockRepository.getWithFilters.mockResolvedValue(mockReports);

      const result = await whisperReportService.getReportsByWhisper(
        "whisper123"
      );

      expect(result).toEqual(mockReports);
      expect(mockRepository.getWithFilters).toHaveBeenCalledWith({
        whisperId: "whisper123",
      });
    });

    it("should handle repository errors", async () => {
      mockRepository.getWithFilters.mockRejectedValue(
        new Error("Database error")
      );

      await expect(
        whisperReportService.getReportsByWhisper("whisper123")
      ).rejects.toThrow("Failed to get reports by whisper: Database error");
    });
  });

  describe("getReportsByReporter", () => {
    it("should get reports by reporter ID", async () => {
      const mockReports = [mockReport];
      mockRepository.getWithFilters.mockResolvedValue(mockReports);

      const result = await whisperReportService.getReportsByReporter(
        "reporter123"
      );

      expect(result).toEqual(mockReports);
      expect(mockRepository.getWithFilters).toHaveBeenCalledWith({
        reporterId: "reporter123",
      });
    });

    it("should handle repository errors", async () => {
      mockRepository.getWithFilters.mockRejectedValue(
        new Error("Database error")
      );

      await expect(
        whisperReportService.getReportsByReporter("reporter123")
      ).rejects.toThrow("Failed to get reports by reporter: Database error");
    });
  });

  describe("deleteReport", () => {
    it("should delete a report", async () => {
      mockRepository.delete.mockResolvedValue(undefined);

      await whisperReportService.deleteReport("report123");

      expect(mockRepository.delete).toHaveBeenCalledWith("report123");
    });

    it("should handle repository errors", async () => {
      mockRepository.delete.mockRejectedValue(new Error("Database error"));

      await expect(
        whisperReportService.deleteReport("report123")
      ).rejects.toThrow("Failed to delete whisper report: Database error");
    });
  });

  describe("updateReport", () => {
    it("should update a report", async () => {
      mockRepository.update.mockResolvedValue(undefined);

      const updates = {
        category: ReportCategory.SPAM,
        reason: "Updated reason",
      };

      await whisperReportService.updateReport("report123", updates);

      expect(mockRepository.update).toHaveBeenCalledWith("report123", {
        ...updates,
        updatedAt: expect.any(Date),
      });
    });

    it("should handle repository errors", async () => {
      mockRepository.update.mockRejectedValue(new Error("Database error"));

      await expect(
        whisperReportService.updateReport("report123", {})
      ).rejects.toThrow("Failed to update whisper report: Database error");
    });
  });

  describe("Factory Functions", () => {
    it("should have factory functions", () => {
      const { getWhisperReportService } = jest.requireMock(
        "../services/whisperReportService"
      );
      const { resetWhisperReportService } = jest.requireMock(
        "../services/whisperReportService"
      );
      const { destroyWhisperReportService } = jest.requireMock(
        "../services/whisperReportService"
      );

      expect(typeof getWhisperReportService).toBe("function");
      expect(typeof resetWhisperReportService).toBe("function");
      expect(typeof destroyWhisperReportService).toBe("function");
    });
  });
});
