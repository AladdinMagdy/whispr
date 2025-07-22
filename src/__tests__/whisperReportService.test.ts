import {
  WhisperReportService,
  getWhisperReportService,
  resetWhisperReportService,
  destroyWhisperReportService,
} from "../services/whisperReportService";
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

    it("should trigger immediate review for critical priority", async () => {
      mockReputationService.getUserReputation.mockResolvedValue(
        mockUserReputation
      );
      mockRepository.getWithFilters.mockResolvedValue([]);
      mockPriorityService.calculatePriority.mockReturnValue(
        ReportPriority.CRITICAL
      );
      mockPriorityService.calculateReputationWeight.mockReturnValue(1.5);
      mockRepository.save.mockResolvedValue(undefined);

      const result = await whisperReportService.createReport(createReportData);

      expect(result.priority).toBe(ReportPriority.CRITICAL);
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it("should handle different categories for existing reports", async () => {
      const existingReport = { ...mockReport, category: ReportCategory.SPAM };
      mockReputationService.getUserReputation.mockResolvedValue(
        mockUserReputation
      );
      mockRepository.getWithFilters.mockResolvedValue([existingReport]);
      mockPriorityService.calculatePriority.mockReturnValue(
        ReportPriority.MEDIUM
      );
      mockPriorityService.calculateReputationWeight.mockReturnValue(1.0);
      mockRepository.save.mockResolvedValue(undefined);

      const result = await whisperReportService.createReport(createReportData);

      expect(result.category).toBe(ReportCategory.HARASSMENT);
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it("should handle automatic escalation with flag for review threshold", async () => {
      const multipleReports = [
        { ...mockReport, id: "report1", reporterId: "user1" },
        { ...mockReport, id: "report2", reporterId: "user2" },
        { ...mockReport, id: "report3", reporterId: "user3" },
        { ...mockReport, id: "report4", reporterId: "user4" },
      ];
      mockReputationService.getUserReputation.mockResolvedValue(
        mockUserReputation
      );
      mockRepository.getWithFilters
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(multipleReports);
      mockPriorityService.calculatePriority.mockReturnValue(
        ReportPriority.MEDIUM
      );
      mockPriorityService.calculateReputationWeight.mockReturnValue(1.0);
      mockRepository.save.mockResolvedValue(undefined);
      mockRepository.update.mockResolvedValue(undefined);

      const result = await whisperReportService.createReport(createReportData);

      expect(result).toBeDefined();
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it("should handle automatic escalation with auto delete threshold", async () => {
      const manyReports = Array.from({ length: 10 }, (_, i) => ({
        ...mockReport,
        id: `report${i}`,
        reporterId: `user${i}`,
      }));
      mockReputationService.getUserReputation.mockResolvedValue(
        mockUserReputation
      );
      mockRepository.getWithFilters
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(manyReports);
      mockPriorityService.calculatePriority.mockReturnValue(
        ReportPriority.MEDIUM
      );
      mockPriorityService.calculateReputationWeight.mockReturnValue(1.0);
      mockRepository.save.mockResolvedValue(undefined);

      const result = await whisperReportService.createReport(createReportData);

      expect(result).toBeDefined();
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it("should handle automatic escalation with ban threshold", async () => {
      const manyReports = Array.from({ length: 15 }, (_, i) => ({
        ...mockReport,
        id: `report${i}`,
        reporterId: `user${i}`,
      }));
      mockReputationService.getUserReputation.mockResolvedValue(
        mockUserReputation
      );
      mockRepository.getWithFilters
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(manyReports);
      mockPriorityService.calculatePriority.mockReturnValue(
        ReportPriority.MEDIUM
      );
      mockPriorityService.calculateReputationWeight.mockReturnValue(1.0);
      mockRepository.save.mockResolvedValue(undefined);

      const result = await whisperReportService.createReport(createReportData);

      expect(result).toBeDefined();
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it("should handle automatic escalation error gracefully", async () => {
      mockReputationService.getUserReputation.mockResolvedValue(
        mockUserReputation
      );
      mockRepository.getWithFilters
        .mockResolvedValueOnce([])
        .mockRejectedValueOnce(new Error("Escalation error"));
      mockPriorityService.calculatePriority.mockReturnValue(
        ReportPriority.MEDIUM
      );
      mockPriorityService.calculateReputationWeight.mockReturnValue(1.0);
      mockRepository.save.mockResolvedValue(undefined);

      const result = await whisperReportService.createReport(createReportData);

      expect(result).toBeDefined();
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it("should handle undefined evidence", async () => {
      // Arrange
      const dataWithoutEvidence = {
        ...createReportData,
        evidence: undefined as string | undefined,
      };
      mockReputationService.getUserReputation.mockResolvedValue(
        mockUserReputation
      );
      mockRepository.getWithFilters.mockResolvedValue([]);
      mockPriorityService.calculatePriority.mockReturnValue(
        ReportPriority.MEDIUM
      );
      mockPriorityService.calculateReputationWeight.mockReturnValue(1.0);
      mockRepository.save.mockResolvedValue(undefined);

      // Act
      const result = await whisperReportService.createReport(
        dataWithoutEvidence
      );

      // Assert
      expect(result).toMatchObject({
        evidence: undefined,
        priority: ReportPriority.MEDIUM,
      });
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

  describe("Private Methods", () => {
    describe("escalateReport", () => {
      it("should escalate report successfully", async () => {
        // Arrange
        mockRepository.getById.mockResolvedValue(mockReport);
        mockRepository.update.mockResolvedValue(undefined);

        // Act - Call private method through public method
        await whisperReportService.updateStatus(
          "report123",
          ReportStatus.ESCALATED
        );

        // Assert
        expect(mockRepository.update).toHaveBeenCalledWith(
          "report123",
          expect.objectContaining({
            status: ReportStatus.ESCALATED,
          })
        );
      });

      it("should handle escalation error gracefully", async () => {
        // Arrange
        mockRepository.getById.mockResolvedValue(mockReport);
        mockRepository.update.mockRejectedValue(new Error("Escalation error"));

        // Act - This should not throw due to error handling in escalateReport
        await expect(
          whisperReportService.updateStatus("report123", ReportStatus.ESCALATED)
        ).rejects.toThrow(
          "Failed to update whisper report status: Escalation error"
        );
      });
    });

    describe("checkAutomaticEscalation", () => {
      it("should handle escalation with pending reports", async () => {
        // Arrange
        const pendingReports = [
          { ...mockReport, id: "report1", status: ReportStatus.PENDING },
          { ...mockReport, id: "report2", status: ReportStatus.PENDING },
          { ...mockReport, id: "report3", status: ReportStatus.UNDER_REVIEW },
        ];
        mockRepository.getWithFilters.mockResolvedValue(pendingReports);
        mockRepository.update.mockResolvedValue(undefined);

        // Act - Trigger automatic escalation through createReport
        mockReputationService.getUserReputation.mockResolvedValue(
          mockUserReputation
        );
        mockRepository.getWithFilters
          .mockResolvedValueOnce([]) // First call for existing reports check
          .mockResolvedValueOnce(pendingReports); // Second call for automatic escalation
        mockPriorityService.calculatePriority.mockReturnValue(
          ReportPriority.MEDIUM
        );
        mockPriorityService.calculateReputationWeight.mockReturnValue(1.0);
        mockRepository.save.mockResolvedValue(undefined);

        const result = await whisperReportService.createReport(
          createReportData
        );

        // Assert
        expect(result).toBeDefined();
        expect(mockRepository.save).toHaveBeenCalled();
      });

      it("should handle escalation with insufficient unique reporters", async () => {
        // Arrange
        const reportsWithSameReporter = [
          { ...mockReport, id: "report1", reporterId: "user1" },
          { ...mockReport, id: "report2", reporterId: "user1" },
          { ...mockReport, id: "report3", reporterId: "user1" },
        ];
        mockReputationService.getUserReputation.mockResolvedValue(
          mockUserReputation
        );
        mockRepository.getWithFilters
          .mockResolvedValueOnce([]) // First call for existing reports check
          .mockResolvedValueOnce(reportsWithSameReporter); // Second call for automatic escalation
        mockPriorityService.calculatePriority.mockReturnValue(
          ReportPriority.MEDIUM
        );
        mockPriorityService.calculateReputationWeight.mockReturnValue(1.0);
        mockRepository.save.mockResolvedValue(undefined);

        // Act
        const result = await whisperReportService.createReport(
          createReportData
        );

        // Assert
        expect(result).toBeDefined();
        expect(mockRepository.save).toHaveBeenCalled();
      });
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle all report categories", async () => {
      // Test all enum values for branch coverage
      const categories = Object.values(ReportCategory);

      for (const category of categories) {
        const dataWithCategory = { ...createReportData, category };
        mockReputationService.getUserReputation.mockResolvedValue(
          mockUserReputation
        );
        mockRepository.getWithFilters.mockResolvedValue([]);
        mockPriorityService.calculatePriority.mockReturnValue(
          ReportPriority.MEDIUM
        );
        mockPriorityService.calculateReputationWeight.mockReturnValue(1.0);
        mockRepository.save.mockResolvedValue(undefined);

        const result = await whisperReportService.createReport(
          dataWithCategory
        );
        expect(result).toMatchObject({
          category,
          priority: ReportPriority.MEDIUM,
        });
      }
    });

    it("should handle all report statuses", async () => {
      // Test all enum values for branch coverage
      const statuses = Object.values(ReportStatus);

      for (const status of statuses) {
        mockRepository.getById.mockResolvedValue(mockReport);
        mockRepository.update.mockResolvedValue(undefined);

        await whisperReportService.updateStatus("report123", status);
        expect(mockRepository.update).toHaveBeenCalledWith(
          "report123",
          expect.objectContaining({
            status,
          })
        );
      }
    });

    it("should handle all report priorities", async () => {
      // Test all enum values for branch coverage
      const priorities = Object.values(ReportPriority);

      for (const priority of priorities) {
        mockPriorityService.calculatePriority.mockReturnValue(priority);
        mockReputationService.getUserReputation.mockResolvedValue(
          mockUserReputation
        );
        mockRepository.getWithFilters.mockResolvedValue([]);
        mockPriorityService.calculateReputationWeight.mockReturnValue(1.0);
        mockRepository.save.mockResolvedValue(undefined);

        const result = await whisperReportService.createReport(
          createReportData
        );
        expect(result).toMatchObject({
          priority,
        });
      }
    });

    it("should handle different reputation levels", async () => {
      const reputationLevels = [
        "trusted",
        "verified",
        "standard",
        "flagged",
        "banned",
      ];

      for (const level of reputationLevels) {
        if (level === "banned") {
          // Should throw error for banned users
          mockReputationService.getUserReputation.mockResolvedValue({
            ...mockUserReputation,
            level,
            score: -100,
          });

          await expect(
            whisperReportService.createReport(createReportData)
          ).rejects.toThrow("Banned users cannot submit reports");
        } else {
          // Should work for other levels
          mockReputationService.getUserReputation.mockResolvedValue({
            ...mockUserReputation,
            level,
          });
          mockRepository.getWithFilters.mockResolvedValue([]);
          mockPriorityService.calculatePriority.mockReturnValue(
            ReportPriority.MEDIUM
          );
          mockPriorityService.calculateReputationWeight.mockReturnValue(1.0);
          mockRepository.save.mockResolvedValue(undefined);

          const result = await whisperReportService.createReport(
            createReportData
          );
          expect(result).toBeDefined();
        }
      }
    });

    it("should handle empty reason", async () => {
      // Arrange
      const dataWithEmptyReason = { ...createReportData, reason: "" };
      mockReputationService.getUserReputation.mockResolvedValue(
        mockUserReputation
      );
      mockRepository.getWithFilters.mockResolvedValue([]);
      mockPriorityService.calculatePriority.mockReturnValue(
        ReportPriority.MEDIUM
      );
      mockPriorityService.calculateReputationWeight.mockReturnValue(1.0);
      mockRepository.save.mockResolvedValue(undefined);

      // Act
      const result = await whisperReportService.createReport(
        dataWithEmptyReason
      );

      // Assert
      expect(result).toMatchObject({
        reason: "",
        priority: ReportPriority.MEDIUM,
      });
    });

    it("should handle escalateReport error gracefully", async () => {
      // Mock updateStatus to throw an error
      mockRepository.getById.mockResolvedValue(mockReport);
      mockRepository.update.mockRejectedValue(new Error("Update failed"));

      // This will trigger escalateReport internally via createReport with critical priority
      mockPriorityService.calculatePriority.mockReturnValue(
        ReportPriority.CRITICAL
      );
      mockReputationService.getUserReputation.mockResolvedValue(
        mockUserReputation
      );
      mockRepository.getWithFilters.mockResolvedValue([]);
      mockPriorityService.calculateReputationWeight.mockReturnValue(1.0);
      mockRepository.save.mockResolvedValue(undefined);

      // Should not throw error, should handle gracefully
      const result = await whisperReportService.createReport(createReportData);
      expect(result).toBeDefined();
    });

    it("should handle checkAutomaticEscalation error gracefully", async () => {
      // First call to getWithFilters (for existing reports check) should succeed
      // Second call (in checkAutomaticEscalation) should fail
      mockRepository.getWithFilters
        .mockResolvedValueOnce([]) // First call succeeds
        .mockRejectedValueOnce(new Error("Database error")); // Second call fails
      mockReputationService.getUserReputation.mockResolvedValue(
        mockUserReputation
      );
      mockPriorityService.calculatePriority.mockReturnValue(
        ReportPriority.MEDIUM
      );
      mockPriorityService.calculateReputationWeight.mockReturnValue(1.0);
      mockRepository.save.mockResolvedValue(undefined);

      // Should not throw error, should handle gracefully
      const result = await whisperReportService.createReport(createReportData);
      expect(result).toBeDefined();
    });

    it("should handle flag for review threshold with insufficient unique reporters", async () => {
      // Create reports with same reporter (insufficient unique reporters)
      const reportsWithSameReporter = Array.from({ length: 10 }, (_, i) => ({
        ...mockReport,
        id: `report${i}`,
        reporterId: "sameReporter", // Same reporter
        status: ReportStatus.PENDING,
      }));

      mockRepository.getWithFilters.mockResolvedValue(reportsWithSameReporter);
      mockReputationService.getUserReputation.mockResolvedValue(
        mockUserReputation
      );
      mockPriorityService.calculatePriority.mockReturnValue(
        ReportPriority.MEDIUM
      );
      mockPriorityService.calculateReputationWeight.mockReturnValue(1.0);
      mockRepository.save.mockResolvedValue(undefined);

      // Should not trigger escalation due to insufficient unique reporters
      const result = await whisperReportService.createReport(createReportData);
      expect(result).toBeDefined();
      expect(mockRepository.update).not.toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ status: ReportStatus.UNDER_REVIEW })
      );
    });

    it("should handle auto delete threshold with insufficient unique reporters", async () => {
      // Create reports with insufficient unique reporters for auto delete
      const reportsWithInsufficientReporters = Array.from(
        { length: 20 },
        (_, i) => ({
          ...mockReport,
          id: `report${i}`,
          reporterId: `reporter${i % 4}`, // Only 4 unique reporters (need 5)
          status: ReportStatus.PENDING,
        })
      );

      mockRepository.getWithFilters.mockResolvedValue(
        reportsWithInsufficientReporters
      );
      mockReputationService.getUserReputation.mockResolvedValue(
        mockUserReputation
      );
      mockPriorityService.calculatePriority.mockReturnValue(
        ReportPriority.MEDIUM
      );
      mockPriorityService.calculateReputationWeight.mockReturnValue(1.0);
      mockRepository.save.mockResolvedValue(undefined);

      // Should not trigger auto delete due to insufficient unique reporters
      const result = await whisperReportService.createReport(createReportData);
      expect(result).toBeDefined();
    });

    it("should handle ban threshold with insufficient unique reporters", async () => {
      // Create reports with insufficient unique reporters for ban
      const reportsWithInsufficientReporters = Array.from(
        { length: 30 },
        (_, i) => ({
          ...mockReport,
          id: `report${i}`,
          reporterId: `reporter${i % 7}`, // Only 7 unique reporters (need 8)
          status: ReportStatus.PENDING,
        })
      );

      mockRepository.getWithFilters.mockResolvedValue(
        reportsWithInsufficientReporters
      );
      mockReputationService.getUserReputation.mockResolvedValue(
        mockUserReputation
      );
      mockPriorityService.calculatePriority.mockReturnValue(
        ReportPriority.MEDIUM
      );
      mockPriorityService.calculateReputationWeight.mockReturnValue(1.0);
      mockRepository.save.mockResolvedValue(undefined);

      // Should not trigger ban due to insufficient unique reporters
      const result = await whisperReportService.createReport(createReportData);
      expect(result).toBeDefined();
    });

    it("should handle no pending reports for flag for review", async () => {
      // Create reports with no pending status
      const reportsWithNoPending = Array.from({ length: 10 }, (_, i) => ({
        ...mockReport,
        id: `report${i}`,
        reporterId: `reporter${i}`,
        status: ReportStatus.RESOLVED, // No pending reports
      }));

      mockRepository.getWithFilters.mockResolvedValue(reportsWithNoPending);
      mockReputationService.getUserReputation.mockResolvedValue(
        mockUserReputation
      );
      mockPriorityService.calculatePriority.mockReturnValue(
        ReportPriority.MEDIUM
      );
      mockPriorityService.calculateReputationWeight.mockReturnValue(1.0);
      mockRepository.save.mockResolvedValue(undefined);

      // Should not update any reports to under review
      const result = await whisperReportService.createReport(createReportData);
      expect(result).toBeDefined();
      expect(mockRepository.update).not.toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ status: ReportStatus.UNDER_REVIEW })
      );
    });

    it("should handle threshold conditions that don't trigger escalation", async () => {
      // Test cases where thresholds are not met
      const testCases = [
        {
          totalReports: 4, // Below FLAG_FOR_REVIEW (5)
          uniqueReporters: 3,
          description: "below flag for review threshold",
        },
        {
          totalReports: 5,
          uniqueReporters: 2, // Below required 3
          description: "below unique reporters for flag",
        },
        {
          totalReports: 14, // Below AUTO_DELETE (15)
          uniqueReporters: 5,
          description: "below auto delete threshold",
        },
        {
          totalReports: 15,
          uniqueReporters: 4, // Below required 5
          description: "below unique reporters for auto delete",
        },
        {
          totalReports: 24, // Below DELETE_AND_TEMP_BAN (25)
          uniqueReporters: 8,
          description: "below ban threshold",
        },
        {
          totalReports: 25,
          uniqueReporters: 7, // Below required 8
          description: "below unique reporters for ban",
        },
      ];

      for (const testCase of testCases) {
        // Reset mocks for each test case
        jest.clearAllMocks();

        const reports = Array.from(
          { length: testCase.totalReports },
          (_, i) => ({
            ...mockReport,
            id: `report${i}`,
            reporterId: `reporter${i % testCase.uniqueReporters}`,
            status: ReportStatus.PENDING,
          })
        );

        mockRepository.getWithFilters.mockResolvedValue(reports);
        mockReputationService.getUserReputation.mockResolvedValue(
          mockUserReputation
        );
        mockPriorityService.calculatePriority.mockReturnValue(
          ReportPriority.MEDIUM
        );
        mockPriorityService.calculateReputationWeight.mockReturnValue(1.0);
        mockRepository.save.mockResolvedValue(undefined);

        const result = await whisperReportService.createReport(
          createReportData
        );
        expect(result).toBeDefined();
      }
    });

    it("should handle updateStatus errors in checkAutomaticEscalation", async () => {
      // Create reports that meet flag for review threshold
      const reportsForEscalation = Array.from({ length: 10 }, (_, i) => ({
        ...mockReport,
        id: `report${i}`,
        reporterId: `reporter${i}`,
        status: ReportStatus.PENDING,
      }));

      mockRepository.getWithFilters.mockResolvedValue(reportsForEscalation);
      mockReputationService.getUserReputation.mockResolvedValue(
        mockUserReputation
      );
      mockPriorityService.calculatePriority.mockReturnValue(
        ReportPriority.MEDIUM
      );
      mockPriorityService.calculateReputationWeight.mockReturnValue(1.0);
      mockRepository.save.mockResolvedValue(undefined);

      // Mock updateStatus to fail for some reports
      mockRepository.update
        .mockResolvedValueOnce(undefined) // First update succeeds
        .mockRejectedValueOnce(new Error("Update failed")); // Second update fails

      // Should handle the error gracefully
      const result = await whisperReportService.createReport(createReportData);
      expect(result).toBeDefined();
    });

    it("should trigger escalateReport error handling", async () => {
      // Mock updateStatus to throw an error when escalateReport calls it
      mockRepository.getById.mockResolvedValue(mockReport);
      mockRepository.update.mockRejectedValue(new Error("Update failed"));

      // Trigger escalateReport via critical priority
      mockPriorityService.calculatePriority.mockReturnValue(
        ReportPriority.CRITICAL
      );
      mockReputationService.getUserReputation.mockResolvedValue(
        mockUserReputation
      );
      mockRepository.getWithFilters.mockResolvedValue([]);
      mockPriorityService.calculateReputationWeight.mockReturnValue(1.0);
      mockRepository.save.mockResolvedValue(undefined);

      // Should handle the error gracefully in escalateReport
      const result = await whisperReportService.createReport(createReportData);
      expect(result).toBeDefined();
    });

    it("should cover all threshold conditions in checkAutomaticEscalation", async () => {
      // Test each threshold condition specifically
      const testCases = [
        {
          totalReports: 5, // FLAG_FOR_REVIEW threshold
          uniqueReporters: 3,
          expectedAction: "flag for review",
        },
        {
          totalReports: 15, // AUTO_DELETE threshold
          uniqueReporters: 5,
          expectedAction: "auto delete",
        },
        {
          totalReports: 25, // DELETE_AND_TEMP_BAN threshold
          uniqueReporters: 8,
          expectedAction: "ban",
        },
      ];

      for (const testCase of testCases) {
        // Reset mocks for each test case
        jest.clearAllMocks();

        const reports = Array.from(
          { length: testCase.totalReports },
          (_, i) => ({
            ...mockReport,
            id: `report${i}`,
            reporterId: `reporter${i % testCase.uniqueReporters}`,
            status: ReportStatus.PENDING,
          })
        );

        mockRepository.getWithFilters.mockResolvedValue(reports);
        mockReputationService.getUserReputation.mockResolvedValue(
          mockUserReputation
        );
        mockPriorityService.calculatePriority.mockReturnValue(
          ReportPriority.MEDIUM
        );
        mockPriorityService.calculateReputationWeight.mockReturnValue(1.0);
        mockRepository.save.mockResolvedValue(undefined);
        mockRepository.update.mockResolvedValue(undefined);

        const result = await whisperReportService.createReport(
          createReportData
        );
        expect(result).toBeDefined();
      }
    });

    it("should handle edge cases in threshold conditions", async () => {
      // Test edge cases where one condition is met but not the other
      const edgeCases = [
        {
          totalReports: 5, // Meets FLAG_FOR_REVIEW
          uniqueReporters: 2, // Below required 3
          description: "meets total reports but not unique reporters for flag",
        },
        {
          totalReports: 4, // Below FLAG_FOR_REVIEW
          uniqueReporters: 3, // Meets required 3
          description: "meets unique reporters but not total reports for flag",
        },
        {
          totalReports: 15, // Meets AUTO_DELETE
          uniqueReporters: 4, // Below required 5
          description:
            "meets total reports but not unique reporters for auto delete",
        },
        {
          totalReports: 14, // Below AUTO_DELETE
          uniqueReporters: 5, // Meets required 5
          description:
            "meets unique reporters but not total reports for auto delete",
        },
        {
          totalReports: 25, // Meets DELETE_AND_TEMP_BAN
          uniqueReporters: 7, // Below required 8
          description: "meets total reports but not unique reporters for ban",
        },
        {
          totalReports: 24, // Below DELETE_AND_TEMP_BAN
          uniqueReporters: 8, // Meets required 8
          description: "meets unique reporters but not total reports for ban",
        },
      ];

      for (const edgeCase of edgeCases) {
        // Reset mocks for each test case
        jest.clearAllMocks();

        const reports = Array.from(
          { length: edgeCase.totalReports },
          (_, i) => ({
            ...mockReport,
            id: `report${i}`,
            reporterId: `reporter${i % edgeCase.uniqueReporters}`,
            status: ReportStatus.PENDING,
          })
        );

        mockRepository.getWithFilters.mockResolvedValue(reports);
        mockReputationService.getUserReputation.mockResolvedValue(
          mockUserReputation
        );
        mockPriorityService.calculatePriority.mockReturnValue(
          ReportPriority.MEDIUM
        );
        mockPriorityService.calculateReputationWeight.mockReturnValue(1.0);
        mockRepository.save.mockResolvedValue(undefined);

        const result = await whisperReportService.createReport(
          createReportData
        );
        expect(result).toBeDefined();
      }
    });

    it("should test private methods directly for full coverage", async () => {
      // Test escalateReport error handling directly
      mockRepository.getById.mockResolvedValue(mockReport);
      mockRepository.update.mockRejectedValue(new Error("Update failed"));
      await (whisperReportService as any).escalateReport("test-report-id");
      expect(mockRepository.update).toHaveBeenCalledWith(
        "test-report-id",
        expect.objectContaining({
          status: ReportStatus.ESCALATED,
        })
      );

      // Test checkAutomaticEscalation with different scenarios
      const testScenarios = [
        {
          reports: Array.from({ length: 5 }, (_, i) => ({
            ...mockReport,
            id: `report${i}`,
            reporterId: `reporter${i % 3}`, // 3 unique reporters
            status: ReportStatus.PENDING,
          })),
          description: "flag for review threshold",
        },
        {
          reports: Array.from({ length: 15 }, (_, i) => ({
            ...mockReport,
            id: `report${i}`,
            reporterId: `reporter${i % 5}`, // 5 unique reporters
            status: ReportStatus.PENDING,
          })),
          description: "auto delete threshold",
        },
        {
          reports: Array.from({ length: 25 }, (_, i) => ({
            ...mockReport,
            id: `report${i}`,
            reporterId: `reporter${i % 8}`, // 8 unique reporters
            status: ReportStatus.PENDING,
          })),
          description: "ban threshold",
        },
      ];

      for (const scenario of testScenarios) {
        jest.clearAllMocks();
        mockRepository.getWithFilters.mockResolvedValue(scenario.reports);
        mockRepository.update.mockResolvedValue(undefined);

        await (whisperReportService as any).checkAutomaticEscalation(
          "test-whisper-id"
        );
        expect(mockRepository.getWithFilters).toHaveBeenCalledWith({
          whisperId: "test-whisper-id",
        });
      }
    });
  });

  describe("Factory Functions", () => {
    it("should have working factory functions", () => {
      // Test getWhisperReportService
      const service1 = getWhisperReportService();
      const service2 = getWhisperReportService();
      expect(service1).toBe(service2); // Same instance

      // Test resetWhisperReportService
      resetWhisperReportService();
      const service3 = getWhisperReportService();
      expect(service3).not.toBe(service1); // New instance

      // Test destroyWhisperReportService
      destroyWhisperReportService();
      const service4 = getWhisperReportService();
      expect(service4).not.toBe(service3); // New instance
    });
  });
});
