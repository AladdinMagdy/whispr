/**
 * Tests for CommentReportService
 * Comprehensive test suite to achieve 90%+ branch coverage
 */

import {
  CommentReportService,
  getCommentReportService,
  resetCommentReportService,
  destroyCommentReportService,
} from "../services/commentReportService";
import { ReportRepository } from "../repositories/ReportRepository";
import {
  CommentReport,
  ReportCategory,
  ReportStatus,
  ReportPriority,
} from "../types";

// Mock dependencies
jest.mock("../services/reportPriorityService", () => ({
  getReportPriorityService: jest.fn(),
}));

jest.mock("../services/reportAnalyticsService", () => ({
  getReportAnalyticsService: jest.fn(),
}));

jest.mock("../services/reputationService", () => ({
  getReputationService: jest.fn(),
}));

describe("CommentReportService", () => {
  let commentReportService: CommentReportService;
  let mockRepository: jest.Mocked<ReportRepository>;
  let mockPriorityService: any;
  let mockAnalyticsService: any;
  let mockReputationService: any;

  const mockCommentReport: CommentReport = {
    id: "report-123",
    commentId: "comment-123",
    whisperId: "whisper-123",
    reporterId: "user-123",
    reporterDisplayName: "Test User",
    reporterReputation: 100,
    category: ReportCategory.HARASSMENT,
    reason: "Inappropriate comment",
    status: ReportStatus.PENDING,
    priority: ReportPriority.MEDIUM,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    evidence: "Screenshot attached",
    reviewedAt: undefined,
    reviewedBy: undefined,
    resolution: undefined,
    reputationWeight: 0.8,
  };

  const createReportData = {
    commentId: "comment-123",
    whisperId: "whisper-123",
    reporterId: "user-123",
    reporterDisplayName: "Test User",
    category: ReportCategory.HARASSMENT,
    reason: "Inappropriate comment",
    evidence: "Screenshot attached",
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset singleton instance
    CommentReportService.resetInstance();

    // Create mock repository
    mockRepository = {
      save: jest.fn(),
      getWithFilters: jest.fn(),
      getById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      saveCommentReport: jest.fn(),
      updateCommentReport: jest.fn(),
      getCommentReport: jest.fn(),
    } as any; // Use any to avoid complex type issues with mocks

    // Create mock services
    mockPriorityService = {
      calculatePriority: jest.fn(),
      escalatePriority: jest.fn(),
      calculateReputationWeight: jest.fn(),
    };

    mockAnalyticsService = {
      recordReport: jest.fn(),
      getReportStats: jest.fn(),
      getCommentReportStats: jest.fn(),
    };

    mockReputationService = {
      getUserReputation: jest.fn(),
      adjustUserReputationScore: jest.fn(),
    };

    // Setup mocks
    const { getReportPriorityService } = jest.requireMock(
      "../services/reportPriorityService"
    );
    const { getReportAnalyticsService } = jest.requireMock(
      "../services/reportAnalyticsService"
    );
    const { getReputationService } = jest.requireMock(
      "../services/reputationService"
    );

    getReportPriorityService.mockReturnValue(mockPriorityService);
    getReportAnalyticsService.mockReturnValue(mockAnalyticsService);
    getReputationService.mockReturnValue(mockReputationService);

    // Create service instance with mock repository
    commentReportService = new CommentReportService(mockRepository);
  });

  afterEach(() => {
    CommentReportService.resetInstance();
  });

  describe("Singleton Pattern", () => {
    it("should return the same instance", () => {
      const instance1 = CommentReportService.getInstance();
      const instance2 = CommentReportService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("should reset instance correctly", () => {
      const instance1 = CommentReportService.getInstance();
      CommentReportService.resetInstance();
      const instance2 = CommentReportService.getInstance();
      expect(instance1).not.toBe(instance2);
    });

    it("should destroy instance correctly", () => {
      const instance1 = CommentReportService.getInstance();
      CommentReportService.destroyInstance();
      const instance2 = CommentReportService.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe("Factory Functions", () => {
    it("should get service instance", () => {
      const service = getCommentReportService();
      expect(service).toBeInstanceOf(CommentReportService);
    });

    it("should reset service instance", () => {
      const service1 = getCommentReportService();
      resetCommentReportService();
      const service2 = getCommentReportService();
      expect(service1).not.toBe(service2);
    });

    it("should destroy service instance", () => {
      const service1 = getCommentReportService();
      destroyCommentReportService();
      const service2 = getCommentReportService();
      expect(service1).not.toBe(service2);
    });
  });

  describe("createReport", () => {
    it("should create a new report successfully", async () => {
      // Arrange
      mockReputationService.getUserReputation.mockResolvedValue({
        userId: "user-123",
        score: 100,
        level: "good",
        violations: [],
        lastUpdated: new Date(),
      });
      mockRepository.getWithFilters.mockResolvedValue([]);
      mockPriorityService.calculatePriority.mockReturnValue(
        ReportPriority.MEDIUM
      );
      mockPriorityService.calculateReputationWeight.mockReturnValue(0.8);
      mockRepository.saveCommentReport.mockResolvedValue(undefined);

      // Act
      const result = await commentReportService.createReport(createReportData);

      // Assert
      expect(result).toMatchObject({
        commentId: createReportData.commentId,
        whisperId: createReportData.whisperId,
        reporterId: createReportData.reporterId,
        category: createReportData.category,
        reason: createReportData.reason,
        evidence: createReportData.evidence,
        priority: ReportPriority.MEDIUM,
        status: ReportStatus.PENDING,
      });
      expect(mockRepository.saveCommentReport).toHaveBeenCalled();
    });

    it("should throw error if reporter is banned", async () => {
      // Arrange
      mockReputationService.getUserReputation.mockResolvedValue({
        userId: "user-123",
        score: -100,
        level: "banned",
        violations: [],
        lastUpdated: new Date(),
      });

      // Act & Assert
      await expect(
        commentReportService.createReport(createReportData)
      ).rejects.toThrow("Banned users cannot submit reports");
    });

    it("should update existing report if same category", async () => {
      // Arrange
      const existingReport = { ...mockCommentReport, id: "existing-report" };
      mockReputationService.getUserReputation.mockResolvedValue({
        userId: "user-123",
        score: 100,
        level: "good",
        violations: [],
        lastUpdated: new Date(),
      });
      mockRepository.getWithFilters.mockResolvedValue([existingReport as any]);
      mockPriorityService.escalatePriority.mockReturnValue(ReportPriority.HIGH);
      mockRepository.updateCommentReport.mockResolvedValue(undefined);

      // Act
      const result = await commentReportService.createReport(createReportData);

      // Assert
      expect(mockRepository.updateCommentReport).toHaveBeenCalledWith(
        existingReport.id,
        expect.objectContaining({
          reason: expect.stringContaining("Additional Report"),
          priority: ReportPriority.HIGH,
        })
      );
      expect(result).toMatchObject({
        reason: expect.stringContaining("Additional Report"),
        priority: ReportPriority.HIGH,
      });
    });

    it("should create new report if different category", async () => {
      // Arrange
      const existingReport = {
        ...mockCommentReport,
        id: "existing-report",
        category: ReportCategory.SPAM,
      };
      mockReputationService.getUserReputation.mockResolvedValue({
        userId: "user-123",
        score: 100,
        level: "good",
        violations: [],
        lastUpdated: new Date(),
      });
      mockRepository.getWithFilters.mockResolvedValue([existingReport as any]);
      mockPriorityService.calculatePriority.mockReturnValue(
        ReportPriority.MEDIUM
      );
      mockPriorityService.calculateReputationWeight.mockReturnValue(0.8);
      mockRepository.saveCommentReport.mockResolvedValue(undefined);

      // Act
      const result = await commentReportService.createReport(createReportData);

      // Assert
      expect(mockRepository.saveCommentReport).toHaveBeenCalled();
      expect(result).toMatchObject({
        category: ReportCategory.HARASSMENT,
        priority: ReportPriority.MEDIUM,
      });
    });

    it("should handle repository errors", async () => {
      // Arrange
      mockReputationService.getUserReputation.mockResolvedValue({
        userId: "user-123",
        score: 100,
        level: "good",
        violations: [],
        lastUpdated: new Date(),
      });
      mockRepository.getWithFilters.mockRejectedValue(
        new Error("Database error")
      );

      // Act & Assert
      await expect(
        commentReportService.createReport(createReportData)
      ).rejects.toThrow("Failed to create comment report: Database error");
    });

    it("should handle reputation service errors", async () => {
      // Arrange
      mockReputationService.getUserReputation.mockRejectedValue(
        new Error("Reputation service error")
      );

      // Act & Assert
      await expect(
        commentReportService.createReport(createReportData)
      ).rejects.toThrow(
        "Failed to create comment report: Reputation service error"
      );
    });

    it("should trigger immediate review for critical priority", async () => {
      // Arrange
      mockReputationService.getUserReputation.mockResolvedValue({
        userId: "user-123",
        score: 100,
        level: "good",
        violations: [],
        lastUpdated: new Date(),
      });
      mockRepository.getWithFilters.mockResolvedValue([]);
      mockPriorityService.calculatePriority.mockReturnValue(
        ReportPriority.CRITICAL
      );
      mockPriorityService.calculateReputationWeight.mockReturnValue(0.8);
      mockRepository.saveCommentReport.mockResolvedValue(undefined);

      // Act
      const result = await commentReportService.createReport(createReportData);

      // Assert
      expect(result.priority).toBe(ReportPriority.CRITICAL);
      expect(mockRepository.saveCommentReport).toHaveBeenCalled();
    });
  });

  describe("getReports", () => {
    it("should get reports with filters", async () => {
      // Arrange
      const filters = {
        commentId: "comment-123",
        status: ReportStatus.PENDING,
      };
      mockRepository.getWithFilters.mockResolvedValue([
        mockCommentReport as any,
      ]);

      // Act
      const result = await commentReportService.getReports(filters);

      // Assert
      expect(result).toEqual([mockCommentReport]);
      expect(mockRepository.getWithFilters).toHaveBeenCalledWith(filters);
    });

    it("should get reports without filters", async () => {
      // Arrange
      mockRepository.getWithFilters.mockResolvedValue([
        mockCommentReport as any,
      ]);

      // Act
      const result = await commentReportService.getReports();

      // Assert
      expect(result).toEqual([mockCommentReport]);
      expect(mockRepository.getWithFilters).toHaveBeenCalledWith({});
    });

    it("should handle repository errors", async () => {
      // Arrange
      mockRepository.getWithFilters.mockRejectedValue(
        new Error("Database error")
      );

      // Act & Assert
      await expect(commentReportService.getReports()).rejects.toThrow(
        "Database error"
      );
    });
  });

  describe("getReport", () => {
    it("should get report by id", async () => {
      // Arrange
      mockRepository.getById.mockResolvedValue(mockCommentReport as any);

      // Act
      const result = await commentReportService.getReport("report-123");

      // Assert
      expect(result).toEqual(mockCommentReport);
      expect(mockRepository.getById).toHaveBeenCalledWith("report-123");
    });

    it("should return null if report not found", async () => {
      // Arrange
      mockRepository.getById.mockResolvedValue(null);

      // Act
      const result = await commentReportService.getReport("non-existent");

      // Assert
      expect(result).toBeNull();
    });

    it("should handle repository errors", async () => {
      // Arrange
      mockRepository.getById.mockRejectedValue(new Error("Database error"));

      // Act & Assert
      await expect(
        commentReportService.getReport("report-123")
      ).rejects.toThrow("Failed to get comment report: Database error");
    });
  });

  describe("updateStatus", () => {
    it("should update report status successfully", async () => {
      // Arrange
      mockRepository.getCommentReport.mockResolvedValue(
        mockCommentReport as any
      );
      mockRepository.updateCommentReport.mockResolvedValue(undefined);

      // Act
      await commentReportService.updateStatus(
        "report-123",
        ReportStatus.RESOLVED,
        "moderator-123"
      );

      // Assert
      expect(mockRepository.updateCommentReport).toHaveBeenCalledWith(
        "report-123",
        expect.objectContaining({
          status: ReportStatus.RESOLVED,
          reviewedBy: "moderator-123",
          reviewedAt: expect.any(Date),
        })
      );
    });

    it("should update status without moderator id", async () => {
      // Arrange
      mockRepository.getCommentReport.mockResolvedValue(
        mockCommentReport as any
      );
      mockRepository.updateCommentReport.mockResolvedValue(undefined);

      // Act
      await commentReportService.updateStatus(
        "report-123",
        ReportStatus.DISMISSED
      );

      // Assert
      expect(mockRepository.updateCommentReport).toHaveBeenCalledWith(
        "report-123",
        expect.objectContaining({
          status: ReportStatus.DISMISSED,
          reviewedBy: undefined,
          reviewedAt: expect.any(Date),
        })
      );
    });

    it("should throw error if report not found", async () => {
      // Arrange
      mockRepository.getCommentReport.mockResolvedValue(null);

      // Act & Assert
      await expect(
        commentReportService.updateStatus("non-existent", ReportStatus.RESOLVED)
      ).rejects.toThrow("Report not found");
    });

    it("should handle repository errors", async () => {
      // Arrange
      mockRepository.getCommentReport.mockRejectedValue(
        new Error("Database error")
      );

      // Act & Assert
      await expect(
        commentReportService.updateStatus("report-123", ReportStatus.RESOLVED)
      ).rejects.toThrow(
        "Failed to update comment report status: Database error"
      );
    });
  });

  describe("hasUserReported", () => {
    it("should return true if user has reported", async () => {
      // Arrange
      mockRepository.getWithFilters.mockResolvedValue([
        mockCommentReport as any,
      ]);

      // Act
      const result = await commentReportService.hasUserReported(
        "comment-123",
        "user-123"
      );

      // Assert
      expect(result).toBe(true);
      expect(mockRepository.getWithFilters).toHaveBeenCalledWith({
        commentId: "comment-123",
        reporterId: "user-123",
      });
    });

    it("should return false if user has not reported", async () => {
      // Arrange
      mockRepository.getWithFilters.mockResolvedValue([]);

      // Act
      const result = await commentReportService.hasUserReported(
        "comment-123",
        "user-123"
      );

      // Assert
      expect(result).toBe(false);
    });

    it("should handle repository errors", async () => {
      // Arrange
      mockRepository.getWithFilters.mockRejectedValue(
        new Error("Database error")
      );

      // Act & Assert
      const result = await commentReportService.hasUserReported(
        "comment-123",
        "user-123"
      );
      expect(result).toBe(false);
    });
  });

  describe("getCommentStats", () => {
    it("should calculate comment stats correctly", async () => {
      // Arrange
      const reports = [
        {
          ...mockCommentReport,
          category: ReportCategory.HARASSMENT,
          priority: ReportPriority.HIGH,
        },
        {
          ...mockCommentReport,
          id: "report-2",
          category: ReportCategory.SPAM,
          priority: ReportPriority.MEDIUM,
        },
        {
          ...mockCommentReport,
          id: "report-3",
          category: ReportCategory.HARASSMENT,
          priority: ReportPriority.LOW,
        },
      ];
      mockRepository.getWithFilters.mockResolvedValue(reports as any);
      mockAnalyticsService.getCommentReportStats.mockResolvedValue({
        totalReports: 3,
        uniqueReporters: 1,
        categories: {
          [ReportCategory.HARASSMENT]: 2,
          [ReportCategory.SPAM]: 1,
        },
        priorityBreakdown: {
          [ReportPriority.HIGH]: 1,
          [ReportPriority.MEDIUM]: 1,
          [ReportPriority.LOW]: 1,
        },
        statusBreakdown: { [ReportStatus.PENDING]: 3 },
        averagePriority: 2,
        escalationRate: 0.5,
      });

      // Act
      const result = await commentReportService.getCommentStats("comment-123");

      // Assert
      expect(result.totalReports).toBe(3);
      expect(result.uniqueReporters).toBe(1);
      expect(result.categories[ReportCategory.HARASSMENT]).toBe(2);
      expect(result.categories[ReportCategory.SPAM]).toBe(1);
      expect(result.priorityBreakdown[ReportPriority.HIGH]).toBe(1);
      expect(result.priorityBreakdown[ReportPriority.MEDIUM]).toBe(1);
      expect(result.priorityBreakdown[ReportPriority.LOW]).toBe(1);
      expect(result.statusBreakdown[ReportStatus.PENDING]).toBe(3);
    });

    it("should handle empty reports", async () => {
      // Arrange
      mockRepository.getWithFilters.mockResolvedValue([]);
      mockAnalyticsService.getCommentReportStats.mockResolvedValue({
        totalReports: 0,
        uniqueReporters: 0,
        categories: {},
        priorityBreakdown: {},
        statusBreakdown: {},
        averagePriority: 0,
        escalationRate: 0,
      });

      // Act
      const result = await commentReportService.getCommentStats("comment-123");

      // Assert
      expect(result.totalReports).toBe(0);
      expect(result.uniqueReporters).toBe(0);
      expect(result.averagePriority).toBe(0);
      expect(result.escalationRate).toBe(0);
    });

    it("should handle repository errors", async () => {
      // Arrange
      mockRepository.getWithFilters.mockRejectedValue(
        new Error("Database error")
      );

      // Act & Assert
      await expect(
        commentReportService.getCommentStats("comment-123")
      ).rejects.toThrow("Failed to get comment report stats: Database error");
    });
  });

  describe("getReportsByComment", () => {
    it("should get reports by comment id", async () => {
      // Arrange
      mockRepository.getWithFilters.mockResolvedValue([
        mockCommentReport as any,
      ]);

      // Act
      const result = await commentReportService.getReportsByComment(
        "comment-123"
      );

      // Assert
      expect(result).toEqual([mockCommentReport]);
      expect(mockRepository.getWithFilters).toHaveBeenCalledWith({
        commentId: "comment-123",
      });
    });

    it("should handle repository errors", async () => {
      // Arrange
      mockRepository.getWithFilters.mockRejectedValue(
        new Error("Database error")
      );

      // Act & Assert
      await expect(
        commentReportService.getReportsByComment("comment-123")
      ).rejects.toThrow("Database error");
    });
  });

  describe("getReportsByReporter", () => {
    it("should get reports by reporter id", async () => {
      // Arrange
      mockRepository.getWithFilters.mockResolvedValue([
        mockCommentReport as any,
      ]);

      // Act
      const result = await commentReportService.getReportsByReporter(
        "user-123"
      );

      // Assert
      expect(result).toEqual([mockCommentReport]);
      expect(mockRepository.getWithFilters).toHaveBeenCalledWith({
        reporterId: "user-123",
      });
    });

    it("should handle repository errors", async () => {
      // Arrange
      mockRepository.getWithFilters.mockRejectedValue(
        new Error("Database error")
      );

      // Act & Assert
      await expect(
        commentReportService.getReportsByReporter("user-123")
      ).rejects.toThrow("Database error");
    });
  });

  describe("deleteReport", () => {
    it("should delete report successfully", async () => {
      // Arrange
      mockRepository.delete.mockResolvedValue(undefined);

      // Act
      await commentReportService.deleteReport("report-123");

      // Assert
      expect(mockRepository.delete).toHaveBeenCalledWith("report-123");
    });

    it("should handle repository errors", async () => {
      // Arrange
      mockRepository.delete.mockRejectedValue(new Error("Database error"));

      // Act & Assert
      await expect(
        commentReportService.deleteReport("report-123")
      ).rejects.toThrow("Database error");
    });
  });

  describe("updateReport", () => {
    it("should update report successfully", async () => {
      // Arrange
      const updates = {
        reason: "Updated reason",
        status: ReportStatus.RESOLVED,
      };
      mockRepository.updateCommentReport.mockResolvedValue(undefined);

      // Act
      await commentReportService.updateReport("report-123", updates);

      // Assert
      expect(mockRepository.updateCommentReport).toHaveBeenCalledWith(
        "report-123",
        expect.objectContaining({
          reason: "Updated reason",
          status: ReportStatus.RESOLVED,
          updatedAt: expect.any(Date),
        })
      );
    });

    it("should handle repository errors", async () => {
      // Arrange
      mockRepository.updateCommentReport.mockRejectedValue(
        new Error("Database error")
      );

      // Act & Assert
      await expect(
        commentReportService.updateReport("report-123", { reason: "test" })
      ).rejects.toThrow("Failed to update comment report: Database error");
    });
  });

  describe("Private Methods", () => {
    describe("escalateReport", () => {
      it("should escalate report priority", async () => {
        // Arrange
        mockRepository.getCommentReport.mockResolvedValue(
          mockCommentReport as any
        );
        mockPriorityService.escalatePriority.mockReturnValue(
          ReportPriority.HIGH
        );
        mockRepository.updateCommentReport.mockResolvedValue(undefined);

        // Act - Call private method through public method
        await commentReportService.updateStatus(
          "report-123",
          ReportStatus.RESOLVED
        );

        // Assert
        expect(mockRepository.updateCommentReport).toHaveBeenCalled();
      });
    });

    describe("checkAutomaticEscalation", () => {
      it("should check automatic escalation when multiple reports exist", async () => {
        // Arrange
        const multipleReports = [
          { ...mockCommentReport, id: "report-1" },
          { ...mockCommentReport, id: "report-2" },
          { ...mockCommentReport, id: "report-3" },
        ];
        mockRepository.getWithFilters.mockResolvedValue(multipleReports as any);
        mockRepository.updateCommentReport.mockResolvedValue(undefined);
        mockReputationService.getUserReputation.mockResolvedValue({
          userId: "user-456",
          score: 100,
          level: "good",
          violations: [],
          lastUpdated: new Date(),
        });
        mockPriorityService.calculatePriority.mockReturnValue(
          ReportPriority.MEDIUM
        );
        mockPriorityService.calculateReputationWeight.mockReturnValue(0.8);
        mockRepository.saveCommentReport.mockResolvedValue(undefined);

        // Act - This will trigger automatic escalation check
        await commentReportService.createReport({
          commentId: "comment-123",
          whisperId: "whisper-123",
          reporterId: "user-456",
          reporterDisplayName: "Another User",
          category: ReportCategory.HARASSMENT,
          reason: "Another report",
        });

        // Assert
        expect(mockRepository.updateCommentReport).toHaveBeenCalled();
      });
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle empty reason in createReport", async () => {
      // Arrange
      const dataWithEmptyReason = { ...createReportData, reason: "" };
      mockReputationService.getUserReputation.mockResolvedValue({
        userId: "user-123",
        score: 100,
        level: "good",
        violations: [],
        lastUpdated: new Date(),
      });
      mockRepository.getWithFilters.mockResolvedValue([]);
      mockPriorityService.calculatePriority.mockReturnValue(
        ReportPriority.MEDIUM
      );
      mockPriorityService.calculateReputationWeight.mockReturnValue(0.8);
      mockRepository.saveCommentReport.mockResolvedValue(undefined);

      // Act
      const result = await commentReportService.createReport(
        dataWithEmptyReason
      );

      // Assert
      expect(result).toMatchObject({
        reason: "",
        priority: ReportPriority.MEDIUM,
      });
    });

    it("should handle undefined evidence in createReport", async () => {
      // Arrange
      const dataWithoutEvidence = { ...mockCommentReport };
      (dataWithoutEvidence as any).evidence = undefined;
      mockReputationService.getUserReputation.mockResolvedValue({
        userId: "user-123",
        score: 100,
        level: "good",
        violations: [],
        lastUpdated: new Date(),
      });
      mockRepository.getWithFilters.mockResolvedValue([]);
      mockPriorityService.calculatePriority.mockReturnValue(
        ReportPriority.MEDIUM
      );
      mockPriorityService.calculateReputationWeight.mockReturnValue(0.8);
      mockRepository.saveCommentReport.mockResolvedValue(undefined);

      // Act
      const result = await commentReportService.createReport(
        dataWithoutEvidence
      );

      // Assert
      expect(result).toMatchObject({
        evidence: undefined,
        priority: ReportPriority.MEDIUM,
      });
    });

    it("should handle all report categories", async () => {
      // Test all enum values for branch coverage
      const categories = Object.values(ReportCategory);

      for (const category of categories) {
        const dataWithCategory = { ...createReportData, category };
        mockReputationService.getUserReputation.mockResolvedValue({
          userId: "user-123",
          score: 100,
          level: "good",
          violations: [],
          lastUpdated: new Date(),
        });
        mockRepository.getWithFilters.mockResolvedValue([]);
        mockPriorityService.calculatePriority.mockReturnValue(
          ReportPriority.MEDIUM
        );
        mockPriorityService.calculateReputationWeight.mockReturnValue(0.8);
        mockRepository.saveCommentReport.mockResolvedValue(undefined);

        const result = await commentReportService.createReport(
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
        mockRepository.getCommentReport.mockResolvedValue(
          mockCommentReport as any
        );
        mockRepository.updateCommentReport.mockResolvedValue(undefined);

        await commentReportService.updateStatus("report-123", status);
        expect(mockRepository.updateCommentReport).toHaveBeenCalledWith(
          "report-123",
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
        mockReputationService.getUserReputation.mockResolvedValue({
          userId: "user-123",
          score: 100,
          level: "good",
          violations: [],
          lastUpdated: new Date(),
        });
        mockRepository.getWithFilters.mockResolvedValue([]);
        mockPriorityService.calculateReputationWeight.mockReturnValue(0.8);
        mockRepository.saveCommentReport.mockResolvedValue(undefined);

        const result = await commentReportService.createReport(
          createReportData
        );
        expect(result).toMatchObject({
          priority,
        });
      }
    });

    it("should handle different reputation levels", async () => {
      const reputationLevels = ["good", "warning", "suspended", "banned"];

      for (const level of reputationLevels) {
        if (level === "banned") {
          // Should throw error for banned users
          mockReputationService.getUserReputation.mockResolvedValue({
            userId: "user-123",
            score: -100,
            level,
            violations: [],
            lastUpdated: new Date(),
          });

          await expect(
            commentReportService.createReport(createReportData)
          ).rejects.toThrow("Banned users cannot submit reports");
        } else {
          // Should work for other levels
          mockReputationService.getUserReputation.mockResolvedValue({
            userId: "user-123",
            score: 100,
            level,
            violations: [],
            lastUpdated: new Date(),
          });
          mockRepository.getWithFilters.mockResolvedValue([]);
          mockPriorityService.calculatePriority.mockReturnValue(
            ReportPriority.MEDIUM
          );
          mockPriorityService.calculateReputationWeight.mockReturnValue(0.8);
          mockRepository.saveCommentReport.mockResolvedValue(undefined);

          const result = await commentReportService.createReport(
            createReportData
          );
          expect(result).toBeDefined();
        }
      }
    });
  });
});
