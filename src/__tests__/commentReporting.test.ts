import { CommentReportService } from "../services/commentReportService";
import { getReputationService } from "../services/reputationService";
import { getSuspensionService } from "../services/suspensionService";
import { getFirestoreService } from "../services/firestoreService";
import { getReportPriorityService } from "../services/reportPriorityService";
import { getReportAnalyticsService } from "../services/reportAnalyticsService";
import {
  ReportCategory,
  ReportStatus,
  ReportPriority,
  CommentReport,
} from "../types";
import { ReportRepository } from "../repositories/ReportRepository";

// Mock the services
jest.mock("../services/reputationService");
jest.mock("../services/suspensionService");
jest.mock("../services/firestoreService");
jest.mock("../services/reportPriorityService");
jest.mock("../services/reportAnalyticsService");

const mockReputationService = {
  getUserReputation: jest.fn(),
  adjustUserReputationScore: jest.fn(),
};

const mockSuspensionService = {
  createSuspension: jest.fn(),
  getUserActiveSuspensions: jest.fn(),
};

const mockFirestoreService = {
  getWhisper: jest.fn(),
  deleteWhisper: jest.fn(),
  getComment: jest.fn(),
  deleteComment: jest.fn(),
};

const mockPriorityService = {
  calculatePriority: jest.fn(),
  calculateReputationWeight: jest.fn(),
  escalatePriority: jest.fn(),
};

const mockAnalyticsService = {
  getCommentReportStats: jest.fn(),
};

const mockRepository: jest.Mocked<ReportRepository> = {
  save: jest.fn(),
  getById: jest.fn(),
  getAll: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  getByWhisper: jest.fn(),
  getByReporter: jest.fn(),
  getByStatus: jest.fn(),
  getByCategory: jest.fn(),
  getByPriority: jest.fn(),
  getByDateRange: jest.fn(),
  getWithFilters: jest.fn(),
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

(getReputationService as jest.Mock).mockReturnValue(mockReputationService);
(getSuspensionService as jest.Mock).mockReturnValue(mockSuspensionService);
(getFirestoreService as jest.Mock).mockReturnValue(mockFirestoreService);
(getReportPriorityService as jest.Mock).mockReturnValue(mockPriorityService);
(getReportAnalyticsService as jest.Mock).mockReturnValue(mockAnalyticsService);

describe("CommentReportService", () => {
  let commentReportService: CommentReportService;

  const mockUserReputation = {
    userId: "user123",
    score: 75,
    level: "verified" as const,
    totalWhispers: 10,
    approvedWhispers: 8,
    flaggedWhispers: 1,
    rejectedWhispers: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    violationHistory: [],
  };

  const mockCommentReport: CommentReport = {
    id: "report123",
    commentId: "comment123",
    whisperId: "whisper123",
    reporterId: "user123",
    reporterDisplayName: "Test User",
    reporterReputation: 75,
    category: ReportCategory.HARASSMENT,
    priority: ReportPriority.HIGH,
    status: ReportStatus.PENDING,
    reason: "This comment is harassing",
    createdAt: new Date(),
    updatedAt: new Date(),
    reputationWeight: 1.2,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    CommentReportService.resetInstance();

    // Create service with mocked repository
    commentReportService = new CommentReportService(mockRepository);

    // Set default mocks
    mockRepository.getCommentReports.mockResolvedValue([]);
    mockRepository.saveCommentReport.mockResolvedValue();
    mockRepository.updateCommentReport.mockResolvedValue();
    mockRepository.hasUserReportedComment.mockResolvedValue(false);
    mockRepository.getById.mockResolvedValue(null);
    mockRepository.getWithFilters.mockResolvedValue([]);
    mockFirestoreService.getComment.mockResolvedValue(null);
    mockFirestoreService.deleteComment.mockResolvedValue(undefined);
    mockReputationService.getUserReputation.mockResolvedValue(
      mockUserReputation
    );
    mockPriorityService.calculatePriority.mockReturnValue(ReportPriority.HIGH);
    mockPriorityService.calculateReputationWeight.mockReturnValue(1.2);
    mockPriorityService.escalatePriority.mockReturnValue(
      ReportPriority.CRITICAL
    );
    mockAnalyticsService.getCommentReportStats.mockResolvedValue({
      totalReports: 1,
      uniqueReporters: 1,
      categories: { [ReportCategory.HARASSMENT]: 1 },
      priorityBreakdown: { [ReportPriority.HIGH]: 1 },
      statusBreakdown: { [ReportStatus.PENDING]: 1 },
      averagePriority: 3,
      escalationRate: 0,
    });
  });

  afterEach(() => {
    CommentReportService.destroyInstance();
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

  describe("createReport", () => {
    const createReportData = {
      commentId: "comment123",
      whisperId: "whisper123",
      reporterId: "user123",
      reporterDisplayName: "Test User",
      category: ReportCategory.HARASSMENT,
      reason: "This comment is harassing",
      evidence: "Test evidence",
    };

    it("should create a comment report successfully", async () => {
      mockRepository.saveCommentReport.mockResolvedValue();

      const result = await commentReportService.createReport(createReportData);

      expect(result).toBeDefined();
      expect(result.commentId).toBe("comment123");
      expect(result.category).toBe(ReportCategory.HARASSMENT);
      expect(result.priority).toBe(ReportPriority.HIGH);
      expect(result.status).toBe(ReportStatus.PENDING);
      expect(mockRepository.saveCommentReport).toHaveBeenCalled();
    });

    it("should update existing report if same user reports same comment with same category", async () => {
      const existingReport = {
        ...mockCommentReport,
        reason: "Original report",
      };
      mockRepository.getWithFilters.mockResolvedValue([existingReport as any]);
      mockRepository.updateCommentReport.mockResolvedValue();

      const result = await commentReportService.createReport(createReportData);

      expect(result).toBeDefined();
      expect(result.reason).toContain("Original report");
      expect(result.reason).toContain("This comment is harassing");
      expect(result.priority).toBe(ReportPriority.CRITICAL); // Escalated priority
      expect(mockRepository.updateCommentReport).toHaveBeenCalled();
    });

    it("should handle different category reports from same user", async () => {
      const existingReport = {
        ...mockCommentReport,
        category: ReportCategory.SPAM,
        reason: "Original spam report",
      };
      mockRepository.getWithFilters.mockResolvedValue([existingReport as any]);
      mockRepository.saveCommentReport.mockResolvedValue();

      const result = await commentReportService.createReport(createReportData);

      expect(result).toBeDefined();
      expect(result.category).toBe(ReportCategory.HARASSMENT);
      expect(result.reason).toBe("This comment is harassing");
      expect(mockRepository.saveCommentReport).toHaveBeenCalled();
    });

    it("should throw error if banned user tries to report", async () => {
      const bannedReputation = { ...mockUserReputation, level: "banned" };
      mockReputationService.getUserReputation.mockResolvedValue(
        bannedReputation
      );

      await expect(
        commentReportService.createReport(createReportData)
      ).rejects.toThrow("Banned users cannot submit reports");
    });

    it("should handle repository errors", async () => {
      mockRepository.saveCommentReport.mockRejectedValue(
        new Error("Database error")
      );

      await expect(
        commentReportService.createReport(createReportData)
      ).rejects.toThrow("Failed to create comment report: Database error");
    });

    it("should escalate critical priority reports", async () => {
      mockPriorityService.calculatePriority.mockReturnValue(
        ReportPriority.CRITICAL
      );
      mockRepository.saveCommentReport.mockResolvedValue();

      const result = await commentReportService.createReport(createReportData);

      expect(result.priority).toBe(ReportPriority.CRITICAL);
      expect(mockRepository.saveCommentReport).toHaveBeenCalled();
    });
  });

  describe("getReports", () => {
    it("should get reports with filters", async () => {
      const mockReports = [mockCommentReport];
      mockRepository.getWithFilters.mockResolvedValue(mockReports as any);

      const filters = {
        commentId: "comment123",
        category: ReportCategory.HARASSMENT,
      };

      const result = await commentReportService.getReports(filters);

      expect(result).toEqual(mockReports);
      expect(mockRepository.getWithFilters).toHaveBeenCalledWith(filters);
    });

    it("should handle empty filters", async () => {
      const mockReports = [mockCommentReport];
      mockRepository.getWithFilters.mockResolvedValue(mockReports as any);

      const result = await commentReportService.getReports();

      expect(result).toEqual(mockReports);
      expect(mockRepository.getWithFilters).toHaveBeenCalledWith({});
    });

    it("should handle repository errors", async () => {
      mockRepository.getWithFilters.mockRejectedValue(
        new Error("Database error")
      );

      await expect(commentReportService.getReports()).rejects.toThrow(
        "Failed to get comment reports: Database error"
      );
    });
  });

  describe("getReport", () => {
    it("should get a report by ID", async () => {
      mockRepository.getById.mockResolvedValue(mockCommentReport as any);

      const result = await commentReportService.getReport("report123");

      expect(result).toEqual(mockCommentReport);
      expect(mockRepository.getById).toHaveBeenCalledWith("report123");
    });

    it("should return null for non-existent report", async () => {
      mockRepository.getById.mockResolvedValue(null);

      const result = await commentReportService.getReport("nonexistent");

      expect(result).toBeNull();
    });

    it("should handle repository errors", async () => {
      mockRepository.getById.mockRejectedValue(new Error("Database error"));

      await expect(commentReportService.getReport("report123")).rejects.toThrow(
        "Failed to get comment report: Database error"
      );
    });
  });

  describe("updateStatus", () => {
    it("should update report status", async () => {
      mockRepository.getCommentReport.mockResolvedValue(
        mockCommentReport as any
      );
      mockRepository.updateCommentReport.mockResolvedValue();

      await commentReportService.updateStatus(
        "report123",
        ReportStatus.RESOLVED,
        "moderator123"
      );

      expect(mockRepository.updateCommentReport).toHaveBeenCalledWith(
        "report123",
        expect.objectContaining({
          status: ReportStatus.RESOLVED,
          reviewedBy: "moderator123",
        })
      );
    });

    it("should handle non-existent report", async () => {
      mockRepository.getCommentReport.mockResolvedValue(null);

      await expect(
        commentReportService.updateStatus("nonexistent", ReportStatus.RESOLVED)
      ).rejects.toThrow("Report not found");
    });

    it("should handle repository errors", async () => {
      mockRepository.getCommentReport.mockResolvedValue(
        mockCommentReport as any
      );
      mockRepository.updateCommentReport.mockRejectedValue(
        new Error("Database error")
      );

      await expect(
        commentReportService.updateStatus("report123", ReportStatus.RESOLVED)
      ).rejects.toThrow(
        "Failed to update comment report status: Database error"
      );
    });
  });

  describe("hasUserReported", () => {
    it("should return true if user has reported the comment", async () => {
      mockRepository.getWithFilters.mockResolvedValue([
        mockCommentReport as any,
      ]);

      const result = await commentReportService.hasUserReported(
        "comment123",
        "user123"
      );

      expect(result).toBe(true);
      expect(mockRepository.getWithFilters).toHaveBeenCalledWith({
        commentId: "comment123",
        reporterId: "user123",
      });
    });

    it("should return false if user has not reported the comment", async () => {
      mockRepository.getWithFilters.mockResolvedValue([]);

      const result = await commentReportService.hasUserReported(
        "comment123",
        "user123"
      );

      expect(result).toBe(false);
    });

    it("should handle repository errors gracefully", async () => {
      mockRepository.getWithFilters.mockRejectedValue(
        new Error("Database error")
      );

      // Should return false on error (graceful degradation)
      const result = await commentReportService.hasUserReported(
        "comment123",
        "user123"
      );

      expect(result).toBe(false);
    });
  });

  describe("getCommentStats", () => {
    it("should return comment report statistics", async () => {
      const mockReports = [mockCommentReport];
      mockRepository.getWithFilters.mockResolvedValue(mockReports as any);

      const result = await commentReportService.getCommentStats("comment123");

      expect(result).toBeDefined();
      expect(result.totalReports).toBe(1);
      expect(result.uniqueReporters).toBe(1);
      expect(mockRepository.getWithFilters).toHaveBeenCalledWith({
        commentId: "comment123",
      });
    });

    it("should handle empty reports", async () => {
      mockRepository.getWithFilters.mockResolvedValue([]);
      mockAnalyticsService.getCommentReportStats.mockResolvedValue({
        totalReports: 0,
        uniqueReporters: 0,
        categories: {} as any,
        priorityBreakdown: {} as any,
        statusBreakdown: {} as any,
        averagePriority: 0,
        escalationRate: 0,
      });

      const result = await commentReportService.getCommentStats("comment123");

      expect(result.totalReports).toBe(0);
      expect(result.uniqueReporters).toBe(0);
    });

    it("should handle repository errors", async () => {
      mockRepository.getWithFilters.mockRejectedValue(
        new Error("Database error")
      );

      await expect(
        commentReportService.getCommentStats("comment123")
      ).rejects.toThrow("Failed to get comment report stats: Database error");
    });
  });

  describe("getReportsByComment", () => {
    it("should get reports by comment ID", async () => {
      const mockReports = [mockCommentReport];
      mockRepository.getWithFilters.mockResolvedValue(mockReports as any);

      const result = await commentReportService.getReportsByComment(
        "comment123"
      );

      expect(result).toEqual(mockReports);
      expect(mockRepository.getWithFilters).toHaveBeenCalledWith({
        commentId: "comment123",
      });
    });

    it("should handle repository errors", async () => {
      mockRepository.getWithFilters.mockRejectedValue(
        new Error("Database error")
      );

      await expect(
        commentReportService.getReportsByComment("comment123")
      ).rejects.toThrow("Failed to get reports by comment: Database error");
    });
  });

  describe("getReportsByReporter", () => {
    it("should get reports by reporter ID", async () => {
      const mockReports = [mockCommentReport];
      mockRepository.getWithFilters.mockResolvedValue(mockReports as any);

      const result = await commentReportService.getReportsByReporter("user123");

      expect(result).toEqual(mockReports);
      expect(mockRepository.getWithFilters).toHaveBeenCalledWith({
        reporterId: "user123",
      });
    });

    it("should handle repository errors", async () => {
      mockRepository.getWithFilters.mockRejectedValue(
        new Error("Database error")
      );

      await expect(
        commentReportService.getReportsByReporter("user123")
      ).rejects.toThrow("Failed to get reports by reporter: Database error");
    });
  });

  describe("deleteReport", () => {
    it("should delete a report", async () => {
      mockRepository.getCommentReport.mockResolvedValue(mockCommentReport);
      mockRepository.delete.mockResolvedValue();

      await commentReportService.deleteReport("report123");

      expect(mockRepository.delete).toHaveBeenCalledWith("report123");
    });

    it("should handle non-existent report", async () => {
      // The service doesn't check for existence before deleting
      mockRepository.delete.mockRejectedValue(new Error("Report not found"));

      await expect(
        commentReportService.deleteReport("nonexistent")
      ).rejects.toThrow("Failed to delete comment report: Report not found");
    });

    it("should handle repository errors", async () => {
      mockRepository.getCommentReport.mockResolvedValue(mockCommentReport);
      mockRepository.delete.mockRejectedValue(new Error("Database error"));

      await expect(
        commentReportService.deleteReport("report123")
      ).rejects.toThrow("Failed to delete comment report: Database error");
    });
  });

  describe("updateReport", () => {
    it("should update a report", async () => {
      mockRepository.updateCommentReport.mockResolvedValue();

      const updates = {
        reason: "Updated reason",
        category: ReportCategory.SPAM,
      };

      await commentReportService.updateReport("report123", updates);

      expect(mockRepository.updateCommentReport).toHaveBeenCalledWith(
        "report123",
        expect.objectContaining({
          reason: "Updated reason",
          category: ReportCategory.SPAM,
          updatedAt: expect.any(Date),
        })
      );
    });

    it("should handle non-existent report", async () => {
      mockRepository.updateCommentReport.mockRejectedValue(
        new Error("Report not found")
      );

      await expect(
        commentReportService.updateReport("nonexistent", {})
      ).rejects.toThrow("Failed to update comment report: Report not found");
    });

    it("should handle repository errors", async () => {
      mockRepository.getCommentReport.mockResolvedValue(mockCommentReport);
      mockRepository.updateCommentReport.mockRejectedValue(
        new Error("Database error")
      );

      await expect(
        commentReportService.updateReport("report123", {})
      ).rejects.toThrow("Failed to update comment report: Database error");
    });
  });

  describe("Private Methods (via public methods)", () => {
    it("should trigger escalation for critical priority reports", async () => {
      mockPriorityService.calculatePriority.mockReturnValue(
        ReportPriority.CRITICAL
      );
      mockRepository.saveCommentReport.mockResolvedValue();
      mockRepository.updateCommentReportStatus.mockResolvedValue();

      const reportData = {
        commentId: "comment123",
        whisperId: "whisper123",
        reporterId: "user123",
        reporterDisplayName: "Test User",
        category: ReportCategory.HARASSMENT,
        reason: "Critical harassment",
      };

      const result = await commentReportService.createReport(reportData);

      expect(result.priority).toBe(ReportPriority.CRITICAL);
      expect(mockRepository.saveCommentReport).toHaveBeenCalled();
    });

    it("should check automatic escalation after report creation", async () => {
      mockRepository.saveCommentReport.mockResolvedValue();
      mockRepository.getWithFilters.mockResolvedValue([]);

      const reportData = {
        commentId: "comment123",
        whisperId: "whisper123",
        reporterId: "user123",
        reporterDisplayName: "Test User",
        category: ReportCategory.HARASSMENT,
        reason: "Test report",
      };

      await commentReportService.createReport(reportData);

      // Should call getWithFilters for escalation check
      expect(mockRepository.getWithFilters).toHaveBeenCalledWith({
        commentId: "comment123",
      });
    });
  });

  describe("Factory Functions", () => {
    it("should get service instance via factory", () => {
      const service = CommentReportService.getInstance();
      expect(service).toBeInstanceOf(CommentReportService);
    });

    it("should reset service via factory", () => {
      const instance1 = CommentReportService.getInstance();
      CommentReportService.resetInstance();
      const instance2 = CommentReportService.getInstance();
      expect(instance1).not.toBe(instance2);
    });

    it("should destroy service via factory", () => {
      const instance1 = CommentReportService.getInstance();
      CommentReportService.destroyInstance();
      const instance2 = CommentReportService.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });
});
