import { ReportRepository } from "../../repositories/ReportRepository";
import {
  Report,
  ReportCategory,
  ReportPriority,
  ReportStatus,
  ReportFilters,
  ReportStats,
  CommentReport,
} from "../../types";

describe("ReportRepository Interface", () => {
  let mockRepository: jest.Mocked<ReportRepository>;

  const mockReport: Report = {
    id: "report-1",
    whisperId: "whisper-1",
    reporterId: "user-1",
    reporterDisplayName: "Test User",
    reporterReputation: 85,
    category: ReportCategory.HARASSMENT,
    priority: ReportPriority.HIGH,
    status: ReportStatus.PENDING,
    reason: "Test report reason",
    evidence: "Test evidence",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    reputationWeight: 0.8,
  };

  const mockCommentReport: CommentReport = {
    id: "comment-report-1",
    commentId: "comment-1",
    whisperId: "whisper-1",
    reporterId: "user-1",
    reporterDisplayName: "Test User",
    reporterReputation: 85,
    category: ReportCategory.HARASSMENT,
    priority: ReportPriority.HIGH,
    status: ReportStatus.PENDING,
    reason: "Test comment report reason",
    evidence: "Test evidence",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    reputationWeight: 0.8,
  };

  const mockReportStats: ReportStats = {
    totalReports: 100,
    pendingReports: 20,
    criticalReports: 5,
    resolvedReports: 75,
    averageResolutionTime: 24,
    reportsByCategory: {
      [ReportCategory.HARASSMENT]: 30,
      [ReportCategory.HATE_SPEECH]: 10,
      [ReportCategory.VIOLENCE]: 5,
      [ReportCategory.SEXUAL_CONTENT]: 8,
      [ReportCategory.SPAM]: 20,
      [ReportCategory.SCAM]: 3,
      [ReportCategory.COPYRIGHT]: 2,
      [ReportCategory.PERSONAL_INFO]: 7,
      [ReportCategory.MINOR_SAFETY]: 1,
      [ReportCategory.OTHER]: 14,
    },
    reportsByPriority: {
      [ReportPriority.LOW]: 40,
      [ReportPriority.MEDIUM]: 35,
      [ReportPriority.HIGH]: 20,
      [ReportPriority.CRITICAL]: 5,
    },
  };

  beforeEach(() => {
    mockRepository = {
      // Basic CRUD operations
      save: jest.fn(),
      getById: jest.fn(),
      getAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),

      // Query methods
      getByWhisper: jest.fn(),
      getByReporter: jest.fn(),
      getByStatus: jest.fn(),
      getByCategory: jest.fn(),
      getByPriority: jest.fn(),
      getByDateRange: jest.fn(),
      getWithFilters: jest.fn(),
      getPending: jest.fn(),
      getCritical: jest.fn(),

      // Statistics
      getStats: jest.fn(),
      getWhisperStats: jest.fn(),

      // Comment Report methods
      saveCommentReport: jest.fn(),
      getCommentReport: jest.fn(),
      getCommentReports: jest.fn(),
      updateCommentReport: jest.fn(),
      updateCommentReportStatus: jest.fn(),
      hasUserReportedComment: jest.fn(),
      getCommentReportStats: jest.fn(),
    };
  });

  describe("Basic CRUD Operations", () => {
    it("should save a report", async () => {
      mockRepository.save.mockResolvedValue();

      await mockRepository.save(mockReport);

      expect(mockRepository.save).toHaveBeenCalledWith(mockReport);
    });

    it("should get a report by ID", async () => {
      mockRepository.getById.mockResolvedValue(mockReport);

      const result = await mockRepository.getById("report-1");

      expect(mockRepository.getById).toHaveBeenCalledWith("report-1");
      expect(result).toEqual(mockReport);
    });

    it("should return null for non-existent report", async () => {
      mockRepository.getById.mockResolvedValue(null);

      const result = await mockRepository.getById("non-existent");

      expect(mockRepository.getById).toHaveBeenCalledWith("non-existent");
      expect(result).toBeNull();
    });

    it("should get all reports", async () => {
      const reports = [mockReport];
      mockRepository.getAll.mockResolvedValue(reports);

      const result = await mockRepository.getAll();

      expect(mockRepository.getAll).toHaveBeenCalled();
      expect(result).toEqual(reports);
    });

    it("should update a report", async () => {
      const updates = { status: ReportStatus.RESOLVED };
      mockRepository.update.mockResolvedValue();

      await mockRepository.update("report-1", updates);

      expect(mockRepository.update).toHaveBeenCalledWith("report-1", updates);
    });

    it("should delete a report", async () => {
      mockRepository.delete.mockResolvedValue();

      await mockRepository.delete("report-1");

      expect(mockRepository.delete).toHaveBeenCalledWith("report-1");
    });
  });

  describe("Query Methods", () => {
    it("should get reports by whisper ID", async () => {
      const reports = [mockReport];
      mockRepository.getByWhisper.mockResolvedValue(reports);

      const result = await mockRepository.getByWhisper("whisper-1");

      expect(mockRepository.getByWhisper).toHaveBeenCalledWith("whisper-1");
      expect(result).toEqual(reports);
    });

    it("should get reports by reporter ID", async () => {
      const reports = [mockReport];
      mockRepository.getByReporter.mockResolvedValue(reports);

      const result = await mockRepository.getByReporter("user-1");

      expect(mockRepository.getByReporter).toHaveBeenCalledWith("user-1");
      expect(result).toEqual(reports);
    });

    it("should get reports by status", async () => {
      const reports = [mockReport];
      mockRepository.getByStatus.mockResolvedValue(reports);

      const result = await mockRepository.getByStatus(ReportStatus.PENDING);

      expect(mockRepository.getByStatus).toHaveBeenCalledWith(
        ReportStatus.PENDING
      );
      expect(result).toEqual(reports);
    });

    it("should get reports by category", async () => {
      const reports = [mockReport];
      mockRepository.getByCategory.mockResolvedValue(reports);

      const result = await mockRepository.getByCategory(
        ReportCategory.HARASSMENT
      );

      expect(mockRepository.getByCategory).toHaveBeenCalledWith(
        ReportCategory.HARASSMENT
      );
      expect(result).toEqual(reports);
    });

    it("should get reports by priority", async () => {
      const reports = [mockReport];
      mockRepository.getByPriority.mockResolvedValue(reports);

      const result = await mockRepository.getByPriority(ReportPriority.HIGH);

      expect(mockRepository.getByPriority).toHaveBeenCalledWith(
        ReportPriority.HIGH
      );
      expect(result).toEqual(reports);
    });

    it("should get reports by date range", async () => {
      const reports = [mockReport];
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");
      mockRepository.getByDateRange.mockResolvedValue(reports);

      const result = await mockRepository.getByDateRange(startDate, endDate);

      expect(mockRepository.getByDateRange).toHaveBeenCalledWith(
        startDate,
        endDate
      );
      expect(result).toEqual(reports);
    });

    it("should get reports with filters", async () => {
      const reports = [mockReport];
      const filters: ReportFilters = {
        status: ReportStatus.PENDING,
        category: ReportCategory.HARASSMENT,
        priority: ReportPriority.HIGH,
      };
      mockRepository.getWithFilters.mockResolvedValue(reports);

      const result = await mockRepository.getWithFilters(filters);

      expect(mockRepository.getWithFilters).toHaveBeenCalledWith(filters);
      expect(result).toEqual(reports);
    });

    it("should get pending reports", async () => {
      const reports = [mockReport];
      mockRepository.getPending.mockResolvedValue(reports);

      const result = await mockRepository.getPending();

      expect(mockRepository.getPending).toHaveBeenCalled();
      expect(result).toEqual(reports);
    });

    it("should get critical reports", async () => {
      const reports = [mockReport];
      mockRepository.getCritical.mockResolvedValue(reports);

      const result = await mockRepository.getCritical();

      expect(mockRepository.getCritical).toHaveBeenCalled();
      expect(result).toEqual(reports);
    });
  });

  describe("Statistics", () => {
    it("should get report stats", async () => {
      mockRepository.getStats.mockResolvedValue(mockReportStats);

      const result = await mockRepository.getStats();

      expect(mockRepository.getStats).toHaveBeenCalled();
      expect(result).toEqual(mockReportStats);
    });

    it("should get whisper stats", async () => {
      const whisperStats = {
        totalReports: 5,
        uniqueReporters: 3,
        categories: {
          [ReportCategory.HARASSMENT]: 3,
          [ReportCategory.SPAM]: 2,
        },
        priorityBreakdown: {
          [ReportPriority.HIGH]: 3,
          [ReportPriority.MEDIUM]: 2,
        },
      };
      mockRepository.getWhisperStats.mockResolvedValue(whisperStats);

      const result = await mockRepository.getWhisperStats("whisper-1");

      expect(mockRepository.getWhisperStats).toHaveBeenCalledWith("whisper-1");
      expect(result).toEqual(whisperStats);
    });
  });

  describe("Comment Report Methods", () => {
    it("should save a comment report", async () => {
      mockRepository.saveCommentReport.mockResolvedValue();

      await mockRepository.saveCommentReport(mockCommentReport);

      expect(mockRepository.saveCommentReport).toHaveBeenCalledWith(
        mockCommentReport
      );
    });

    it("should get a comment report by ID", async () => {
      mockRepository.getCommentReport.mockResolvedValue(mockCommentReport);

      const result = await mockRepository.getCommentReport("comment-report-1");

      expect(mockRepository.getCommentReport).toHaveBeenCalledWith(
        "comment-report-1"
      );
      expect(result).toEqual(mockCommentReport);
    });

    it("should return null for non-existent comment report", async () => {
      mockRepository.getCommentReport.mockResolvedValue(null);

      const result = await mockRepository.getCommentReport("non-existent");

      expect(mockRepository.getCommentReport).toHaveBeenCalledWith(
        "non-existent"
      );
      expect(result).toBeNull();
    });

    it("should get comment reports with filters", async () => {
      const commentReports = [mockCommentReport];
      const filters: ReportFilters = {
        status: ReportStatus.PENDING,
        category: ReportCategory.HARASSMENT,
      };
      mockRepository.getCommentReports.mockResolvedValue(commentReports);

      const result = await mockRepository.getCommentReports(filters);

      expect(mockRepository.getCommentReports).toHaveBeenCalledWith(filters);
      expect(result).toEqual(commentReports);
    });

    it("should update a comment report", async () => {
      const updates = { status: ReportStatus.RESOLVED };
      mockRepository.updateCommentReport.mockResolvedValue();

      await mockRepository.updateCommentReport("comment-report-1", updates);

      expect(mockRepository.updateCommentReport).toHaveBeenCalledWith(
        "comment-report-1",
        updates
      );
    });

    it("should update comment report status", async () => {
      mockRepository.updateCommentReportStatus.mockResolvedValue();

      await mockRepository.updateCommentReportStatus(
        "comment-report-1",
        ReportStatus.RESOLVED,
        "moderator-1"
      );

      expect(mockRepository.updateCommentReportStatus).toHaveBeenCalledWith(
        "comment-report-1",
        ReportStatus.RESOLVED,
        "moderator-1"
      );
    });

    it("should update comment report status without moderator ID", async () => {
      mockRepository.updateCommentReportStatus.mockResolvedValue();

      await mockRepository.updateCommentReportStatus(
        "comment-report-1",
        ReportStatus.RESOLVED
      );

      expect(mockRepository.updateCommentReportStatus).toHaveBeenCalledWith(
        "comment-report-1",
        ReportStatus.RESOLVED
      );
    });

    it("should check if user has reported a comment", async () => {
      mockRepository.hasUserReportedComment.mockResolvedValue(true);

      const result = await mockRepository.hasUserReportedComment(
        "comment-1",
        "user-1"
      );

      expect(mockRepository.hasUserReportedComment).toHaveBeenCalledWith(
        "comment-1",
        "user-1"
      );
      expect(result).toBe(true);
    });

    it("should get comment report stats", async () => {
      const commentStats = {
        totalReports: 3,
        uniqueReporters: 2,
        categories: {
          [ReportCategory.HARASSMENT]: 2,
          [ReportCategory.SPAM]: 1,
        },
        priorityBreakdown: {
          [ReportPriority.HIGH]: 2,
          [ReportPriority.MEDIUM]: 1,
        },
      };
      mockRepository.getCommentReportStats.mockResolvedValue(commentStats);

      const result = await mockRepository.getCommentReportStats("comment-1");

      expect(mockRepository.getCommentReportStats).toHaveBeenCalledWith(
        "comment-1"
      );
      expect(result).toEqual(commentStats);
    });
  });

  describe("Error Handling", () => {
    it("should handle save errors", async () => {
      const error = new Error("Database error");
      mockRepository.save.mockRejectedValue(error);

      await expect(mockRepository.save(mockReport)).rejects.toThrow(
        "Database error"
      );
    });

    it("should handle getById errors", async () => {
      const error = new Error("Database error");
      mockRepository.getById.mockRejectedValue(error);

      await expect(mockRepository.getById("report-1")).rejects.toThrow(
        "Database error"
      );
    });

    it("should handle update errors", async () => {
      const error = new Error("Database error");
      mockRepository.update.mockRejectedValue(error);

      await expect(
        mockRepository.update("report-1", { status: ReportStatus.RESOLVED })
      ).rejects.toThrow("Database error");
    });

    it("should handle delete errors", async () => {
      const error = new Error("Database error");
      mockRepository.delete.mockRejectedValue(error);

      await expect(mockRepository.delete("report-1")).rejects.toThrow(
        "Database error"
      );
    });
  });
});
