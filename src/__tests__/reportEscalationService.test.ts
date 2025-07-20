/**
 * Tests for ReportEscalationService
 */

import { ReportEscalationService } from "../services/reportEscalationService";
import { ReportRepository } from "../repositories/ReportRepository";
import {
  Report,
  ReportStatus,
  ReportPriority,
  ReportCategory,
  CommentReport,
} from "../types";

// Mock dependencies
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

const mockWhisperReportService = {
  getReportsByWhisper: jest.fn(),
  updateStatus: jest.fn(),
};

const mockCommentReportService = {
  getReportsByComment: jest.fn(),
  updateStatus: jest.fn(),
};

const mockReportPriorityService = {
  calculatePriority: jest.fn(),
  escalatePriority: jest.fn(),
  calculateReputationWeight: jest.fn(),
};

// Mock the service dependencies
jest.mock("../services/whisperReportService", () => ({
  getWhisperReportService: () => mockWhisperReportService,
}));

jest.mock("../services/commentReportService", () => ({
  getCommentReportService: () => mockCommentReportService,
}));

jest.mock("../services/reportPriorityService", () => ({
  getReportPriorityService: () => mockReportPriorityService,
}));

describe("ReportEscalationService", () => {
  let reportEscalationService: ReportEscalationService;

  beforeEach(() => {
    jest.clearAllMocks();
    reportEscalationService = new ReportEscalationService(mockRepository);
  });

  afterEach(() => {
    ReportEscalationService.resetInstance();
  });

  describe("Singleton Pattern", () => {
    it("should return the same instance", () => {
      const instance1 = ReportEscalationService.getInstance();
      const instance2 = ReportEscalationService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("should reset instance correctly", () => {
      const instance1 = ReportEscalationService.getInstance();
      ReportEscalationService.resetInstance();
      const instance2 = ReportEscalationService.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe("checkAutomaticEscalation", () => {
    const mockReports: Report[] = [
      {
        id: "report-1",
        whisperId: "whisper-123",
        reporterId: "reporter-1",
        reporterDisplayName: "Reporter 1",
        reporterReputation: 80,
        category: ReportCategory.HARASSMENT,
        priority: ReportPriority.HIGH,
        status: ReportStatus.PENDING,
        reason: "Test report 1",
        createdAt: new Date(),
        updatedAt: new Date(),
        reputationWeight: 1.2,
      },
      {
        id: "report-2",
        whisperId: "whisper-123",
        reporterId: "reporter-2",
        reporterDisplayName: "Reporter 2",
        reporterReputation: 60,
        category: ReportCategory.SPAM,
        priority: ReportPriority.MEDIUM,
        status: ReportStatus.PENDING,
        reason: "Test report 2",
        createdAt: new Date(),
        updatedAt: new Date(),
        reputationWeight: 1.0,
      },
    ];

    it("should escalate whisper with critical priority", async () => {
      const criticalReports = [
        {
          ...mockReports[0],
          priority: ReportPriority.CRITICAL,
        },
      ];

      mockWhisperReportService.getReportsByWhisper.mockResolvedValue(
        criticalReports
      );
      mockWhisperReportService.updateStatus.mockResolvedValue(undefined);

      const result = await reportEscalationService.checkAutomaticEscalation(
        "whisper-123",
        "whisper"
      );

      expect(result.escalated).toBe(true);
      expect(result.action).toBe("flagged_for_review");
      expect(mockWhisperReportService.updateStatus).toHaveBeenCalledWith(
        "report-1",
        ReportStatus.UNDER_REVIEW
      );
    });

    it("should escalate whisper with enough reports and unique reporters", async () => {
      const multipleReports = [
        ...mockReports,
        {
          id: "report-3",
          whisperId: "whisper-123",
          reporterId: "reporter-3",
          reporterDisplayName: "Reporter 3",
          reporterReputation: 70,
          category: ReportCategory.HATE_SPEECH,
          priority: ReportPriority.HIGH,
          status: ReportStatus.PENDING,
          reason: "Test report 3",
          createdAt: new Date(),
          updatedAt: new Date(),
          reputationWeight: 1.1,
        },
      ];

      mockWhisperReportService.getReportsByWhisper.mockResolvedValue(
        multipleReports
      );
      mockWhisperReportService.updateStatus.mockResolvedValue(undefined);

      const result = await reportEscalationService.checkAutomaticEscalation(
        "whisper-123",
        "whisper"
      );

      expect(result.escalated).toBe(true);
      expect(result.action).toBe("flagged_for_review");
      expect(mockWhisperReportService.updateStatus).toHaveBeenCalledTimes(3);
    });

    it("should not escalate with insufficient reports", async () => {
      const singleReport = [mockReports[0]];
      mockWhisperReportService.getReportsByWhisper.mockResolvedValue(
        singleReport
      );

      const result = await reportEscalationService.checkAutomaticEscalation(
        "whisper-123",
        "whisper"
      );

      expect(result.escalated).toBe(false);
      expect(result.action).toBe("none");
      expect(mockWhisperReportService.updateStatus).not.toHaveBeenCalled();
    });

    it("should handle comment escalation", async () => {
      const mockCommentReports: CommentReport[] = [
        {
          id: "comment-report-1",
          commentId: "comment-123",
          whisperId: "whisper-123",
          reporterId: "reporter-1",
          reporterDisplayName: "Reporter 1",
          reporterReputation: 80,
          category: ReportCategory.HARASSMENT,
          priority: ReportPriority.HIGH,
          status: ReportStatus.PENDING,
          reason: "Test comment report",
          createdAt: new Date(),
          updatedAt: new Date(),
          reputationWeight: 1.2,
        },
        {
          id: "comment-report-2",
          commentId: "comment-123",
          whisperId: "whisper-123",
          reporterId: "reporter-2",
          reporterDisplayName: "Reporter 2",
          reporterReputation: 70,
          category: ReportCategory.SPAM,
          priority: ReportPriority.MEDIUM,
          status: ReportStatus.PENDING,
          reason: "Test comment report 2",
          createdAt: new Date(),
          updatedAt: new Date(),
          reputationWeight: 1.0,
        },
        {
          id: "comment-report-3",
          commentId: "comment-123",
          whisperId: "whisper-123",
          reporterId: "reporter-3",
          reporterDisplayName: "Reporter 3",
          reporterReputation: 75,
          category: ReportCategory.HATE_SPEECH,
          priority: ReportPriority.HIGH,
          status: ReportStatus.PENDING,
          reason: "Test comment report 3",
          createdAt: new Date(),
          updatedAt: new Date(),
          reputationWeight: 1.1,
        },
      ];

      mockCommentReportService.getReportsByComment.mockResolvedValue(
        mockCommentReports
      );
      mockCommentReportService.updateStatus.mockResolvedValue(undefined);

      const result = await reportEscalationService.checkAutomaticEscalation(
        "comment-123",
        "comment"
      );

      expect(result.escalated).toBe(true);
      expect(mockCommentReportService.updateStatus).toHaveBeenCalledTimes(3);
    });

    it("should handle errors gracefully", async () => {
      mockWhisperReportService.getReportsByWhisper.mockRejectedValue(
        new Error("Database error")
      );

      const result = await reportEscalationService.checkAutomaticEscalation(
        "whisper-123",
        "whisper"
      );

      expect(result.escalated).toBe(false);
      expect(result.action).toBe("none");
      expect(result.reason).toBe("No escalation threshold met");
    });
  });

  describe("escalateReport", () => {
    const mockReport: Report = {
      id: "report-123",
      whisperId: "whisper-123",
      reporterId: "reporter-123",
      reporterDisplayName: "Test Reporter",
      reporterReputation: 75,
      category: ReportCategory.HARASSMENT,
      priority: ReportPriority.HIGH,
      status: ReportStatus.PENDING,
      reason: "Test report",
      createdAt: new Date(),
      updatedAt: new Date(),
      reputationWeight: 1.2,
    };

    it("should escalate report successfully", async () => {
      mockRepository.getById.mockResolvedValue(mockReport);
      mockRepository.update.mockResolvedValue();

      const result = await reportEscalationService.escalateReport("report-123");

      expect(result.escalated).toBe(true);
      expect(result.action).toBe("escalated");
      expect(result.affectedReports).toEqual(["report-123"]);
      expect(mockRepository.update).toHaveBeenCalledWith("report-123", {
        status: ReportStatus.ESCALATED,
        updatedAt: expect.any(Date),
      });
    });

    it("should handle report not found", async () => {
      mockRepository.getById.mockResolvedValue(null);

      await expect(
        reportEscalationService.escalateReport("report-123")
      ).rejects.toThrow("Failed to escalate report: Report not found");
    });

    it("should handle repository errors", async () => {
      mockRepository.getById.mockRejectedValue(new Error("Database error"));

      await expect(
        reportEscalationService.escalateReport("report-123")
      ).rejects.toThrow("Failed to escalate report: Database error");
    });
  });

  describe("checkUserLevelEscalation", () => {
    const mockUserReports: Report[] = [
      {
        id: "report-1",
        whisperId: "whisper-1",
        reporterId: "user-123",
        reporterDisplayName: "Test User",
        reporterReputation: 80,
        category: ReportCategory.HARASSMENT,
        priority: ReportPriority.HIGH,
        status: ReportStatus.RESOLVED,
        reason: "Test report 1",
        createdAt: new Date(),
        updatedAt: new Date(),
        reviewedAt: new Date(),
        reviewedBy: "mod-1",
        resolution: {
          action: "warn" as const,
          reason: "Warning issued",
          moderatorId: "mod-1",
          timestamp: new Date(),
        },
        reputationWeight: 1.2,
      },
      {
        id: "report-2",
        whisperId: "whisper-2",
        reporterId: "user-123",
        reporterDisplayName: "Test User",
        reporterReputation: 80,
        category: ReportCategory.SPAM,
        priority: ReportPriority.MEDIUM,
        status: ReportStatus.RESOLVED,
        reason: "Test report 2",
        createdAt: new Date(),
        updatedAt: new Date(),
        reviewedAt: new Date(),
        reviewedBy: "mod-2",
        resolution: {
          action: "reject" as const,
          reason: "Content rejected",
          moderatorId: "mod-2",
          timestamp: new Date(),
        },
        reputationWeight: 1.0,
      },
      {
        id: "report-3",
        whisperId: "whisper-3",
        reporterId: "user-123",
        reporterDisplayName: "Test User",
        reporterReputation: 80,
        category: ReportCategory.HATE_SPEECH,
        priority: ReportPriority.HIGH,
        status: ReportStatus.RESOLVED,
        reason: "Test report 3",
        createdAt: new Date(),
        updatedAt: new Date(),
        reviewedAt: new Date(),
        reviewedBy: "mod-3",
        resolution: {
          action: "ban" as const,
          reason: "User banned",
          moderatorId: "mod-3",
          timestamp: new Date(),
        },
        reputationWeight: 1.5,
      },
    ];

    it("should escalate user with 3 or more action reports", async () => {
      mockRepository.getByReporter.mockResolvedValue(mockUserReports);

      const result = await reportEscalationService.checkUserLevelEscalation(
        "user-123"
      );

      expect(result.escalated).toBe(true);
      expect(result.action).toBe("user_escalation");
      expect(result.affectedReports).toHaveLength(3);
    });

    it("should not escalate user with dismissed reports", async () => {
      const dismissedReports = [
        {
          ...mockUserReports[0],
          resolution: {
            action: "dismiss" as const,
            reason: "Report dismissed",
            moderatorId: "mod-1",
            timestamp: new Date(),
          },
        },
      ];

      mockRepository.getByReporter.mockResolvedValue(dismissedReports);

      const result = await reportEscalationService.checkUserLevelEscalation(
        "user-123"
      );

      expect(result.escalated).toBe(false);
      expect(result.action).toBe("none");
    });

    it("should not escalate user with insufficient action reports", async () => {
      const limitedReports = mockUserReports.slice(0, 2); // Only 2 action reports
      mockRepository.getByReporter.mockResolvedValue(limitedReports);

      const result = await reportEscalationService.checkUserLevelEscalation(
        "user-123"
      );

      expect(result.escalated).toBe(false);
      expect(result.action).toBe("none");
    });

    it("should handle repository errors", async () => {
      mockRepository.getByReporter.mockRejectedValue(
        new Error("Database error")
      );

      await expect(
        reportEscalationService.checkUserLevelEscalation("user-123")
      ).rejects.toThrow(
        "Failed to check user level escalation: Database error"
      );
    });
  });

  describe("getEscalationStats", () => {
    const mockAllReports: Report[] = [
      {
        id: "report-1",
        whisperId: "whisper-1",
        reporterId: "reporter-1",
        reporterDisplayName: "Reporter 1",
        reporterReputation: 80,
        category: ReportCategory.HARASSMENT,
        priority: ReportPriority.HIGH,
        status: ReportStatus.ESCALATED,
        reason: "Test report 1",
        createdAt: new Date(),
        updatedAt: new Date(),
        reputationWeight: 1.2,
      },
      {
        id: "report-2",
        whisperId: "whisper-2",
        reporterId: "reporter-2",
        reporterDisplayName: "Reporter 2",
        reporterReputation: 60,
        category: ReportCategory.SPAM,
        priority: ReportPriority.MEDIUM,
        status: ReportStatus.ESCALATED,
        reason: "Test report 2",
        createdAt: new Date(),
        updatedAt: new Date(),
        reputationWeight: 1.0,
      },
      {
        id: "report-3",
        whisperId: "whisper-3",
        reporterId: "reporter-3",
        reporterDisplayName: "Reporter 3",
        reporterReputation: 70,
        category: ReportCategory.HARASSMENT,
        priority: ReportPriority.MEDIUM,
        status: ReportStatus.PENDING,
        reason: "Test report 3",
        createdAt: new Date(),
        updatedAt: new Date(),
        reputationWeight: 1.1,
      },
    ];

    it("should generate correct escalation stats", async () => {
      mockRepository.getAll.mockResolvedValue(mockAllReports);

      const stats = await reportEscalationService.getEscalationStats();

      expect(stats.totalEscalations).toBe(2);
      expect(stats.escalationRate).toBe((2 / 3) * 100); // 66.67%
      expect(stats.mostEscalatedCategories).toHaveLength(2);
      expect(stats.mostEscalatedCategories[0].category).toBe(
        ReportCategory.HARASSMENT
      );
      expect(stats.mostEscalatedCategories[0].count).toBe(1);
    });

    it("should handle empty reports", async () => {
      mockRepository.getAll.mockResolvedValue([]);

      const stats = await reportEscalationService.getEscalationStats();

      expect(stats.totalEscalations).toBe(0);
      expect(stats.escalationRate).toBe(0);
      expect(stats.mostEscalatedCategories).toHaveLength(0);
    });

    it("should handle repository errors", async () => {
      mockRepository.getAll.mockRejectedValue(new Error("Database error"));

      await expect(
        reportEscalationService.getEscalationStats()
      ).rejects.toThrow("Failed to get escalation stats: Database error");
    });
  });

  describe("getEscalationThresholds", () => {
    it("should return default thresholds when constants import fails", async () => {
      // Mock the import to fail
      jest.doMock("../constants", () => {
        throw new Error("Constants not found");
      });

      const thresholds =
        await reportEscalationService.getEscalationThresholds();

      expect(thresholds.FLAG_FOR_REVIEW).toBe(3);
      expect(thresholds.AUTO_DELETE).toBe(5);
      expect(thresholds.DELETE_AND_TEMP_BAN).toBe(8);
      expect(thresholds.CRITICAL_PRIORITY_THRESHOLD).toBe(1);
      expect(thresholds.UNIQUE_REPORTERS_MIN).toBe(3);
    });
  });

  describe("Error Handling", () => {
    it("should handle errors in checkAutomaticEscalation gracefully", async () => {
      mockWhisperReportService.getReportsByWhisper.mockRejectedValue(
        new Error("Database error")
      );

      const result = await reportEscalationService.checkAutomaticEscalation(
        "whisper-123",
        "whisper"
      );

      expect(result.escalated).toBe(false);
      expect(result.action).toBe("none");
      expect(result.reason).toBe("No escalation threshold met");
    });

    it("should handle unknown errors gracefully", async () => {
      mockRepository.getById.mockRejectedValue("Unknown error");

      await expect(
        reportEscalationService.escalateReport("report-123")
      ).rejects.toThrow("Failed to escalate report: Unknown error");
    });
  });
});
