/**
 * Tests for ReportResolutionService
 */

import { ReportResolutionService } from "../services/reportResolutionService";
import { ReportRepository } from "../repositories/ReportRepository";
import {
  Report,
  ReportResolution,
  CommentReport,
  CommentReportResolution,
  ReportStatus,
  ReportCategory,
  ReportPriority,
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

const mockReputationService = {
  getUserReputation: jest.fn(),
  adjustUserReputationScore: jest.fn(),
  updateUserReputation: jest.fn(),
};

const mockSuspensionService = {
  createSuspension: jest.fn(),
  isUserSuspended: jest.fn(),
  getActiveSuspensions: jest.fn(),
  getSuspensionStats: jest.fn(),
};

const mockFirestoreService = {
  getWhisper: jest.fn(),
  deleteWhisper: jest.fn(),
  getComment: jest.fn(),
  deleteComment: jest.fn(),
};

// Mock the service dependencies
jest.mock("../services/reputationService", () => ({
  getReputationService: () => mockReputationService,
}));

jest.mock("../services/suspensionService", () => ({
  getSuspensionService: () => mockSuspensionService,
}));

jest.mock("../services/firestoreService", () => ({
  getFirestoreService: () => mockFirestoreService,
}));

describe("ReportResolutionService", () => {
  let reportResolutionService: ReportResolutionService;

  beforeEach(() => {
    jest.clearAllMocks();
    reportResolutionService = new ReportResolutionService(mockRepository);
  });

  afterEach(() => {
    ReportResolutionService.resetInstance();
  });

  describe("Singleton Pattern", () => {
    it("should return the same instance", () => {
      const instance1 = ReportResolutionService.getInstance();
      const instance2 = ReportResolutionService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("should reset instance correctly", () => {
      const instance1 = ReportResolutionService.getInstance();
      ReportResolutionService.resetInstance();
      const instance2 = ReportResolutionService.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe("resolveWhisperReport", () => {
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

    const mockResolution: ReportResolution = {
      action: "warn",
      reason: "Warning issued",
      moderatorId: "mod-123",
      timestamp: new Date(),
    };

    it("should resolve whisper report successfully", async () => {
      mockRepository.getById.mockResolvedValue(mockReport);
      mockRepository.update.mockResolvedValue();
      mockFirestoreService.getWhisper.mockResolvedValue({
        id: "whisper-123",
        userId: "user-123",
        userDisplayName: "Test User",
        userProfileColor: "#007AFF",
        audioUrl: "test-url",
        duration: 10,
        whisperPercentage: 80,
        averageLevel: 0.5,
        confidence: 0.9,
        likes: 5,
        replies: 2,
        createdAt: new Date(),
      });
      mockSuspensionService.createSuspension.mockResolvedValue({} as any);

      const result = await reportResolutionService.resolveWhisperReport(
        "report-123",
        mockResolution
      );

      expect(result.success).toBe(true);
      expect(result.reportId).toBe("report-123");
      expect(result.action).toBe("warn");
      expect(mockRepository.update).toHaveBeenCalledWith("report-123", {
        status: ReportStatus.RESOLVED,
        resolution: mockResolution,
        updatedAt: expect.any(Date),
        reviewedAt: expect.any(Date),
        reviewedBy: "mod-123",
      });
    });

    it("should handle report not found", async () => {
      mockRepository.getById.mockResolvedValue(null);

      await expect(
        reportResolutionService.resolveWhisperReport(
          "report-123",
          mockResolution
        )
      ).rejects.toThrow("Failed to resolve whisper report: Report not found");
    });

    it("should handle repository errors", async () => {
      mockRepository.getById.mockRejectedValue(new Error("Database error"));

      await expect(
        reportResolutionService.resolveWhisperReport(
          "report-123",
          mockResolution
        )
      ).rejects.toThrow("Failed to resolve whisper report: Database error");
    });
  });

  describe("resolveCommentReport", () => {
    const mockCommentReport: CommentReport = {
      id: "comment-report-123",
      commentId: "comment-123",
      whisperId: "whisper-123",
      reporterId: "reporter-123",
      reporterDisplayName: "Test Reporter",
      reporterReputation: 75,
      category: ReportCategory.SPAM,
      priority: ReportPriority.MEDIUM,
      status: ReportStatus.PENDING,
      reason: "Test comment report",
      createdAt: new Date(),
      updatedAt: new Date(),
      reputationWeight: 1.0,
    };

    const mockCommentResolution: CommentReportResolution = {
      action: "hide",
      reason: "Comment hidden",
      moderatorId: "mod-123",
      timestamp: new Date(),
    };

    it("should resolve comment report successfully", async () => {
      mockRepository.getCommentReport.mockResolvedValue(mockCommentReport);
      mockRepository.updateCommentReport.mockResolvedValue();

      const result = await reportResolutionService.resolveCommentReport(
        "comment-report-123",
        mockCommentResolution
      );

      expect(result.success).toBe(true);
      expect(result.reportId).toBe("comment-report-123");
      expect(result.action).toBe("hide");
      expect(mockRepository.updateCommentReport).toHaveBeenCalledWith(
        "comment-report-123",
        {
          status: ReportStatus.RESOLVED,
          resolution: mockCommentResolution,
          updatedAt: expect.any(Date),
          reviewedAt: expect.any(Date),
          reviewedBy: "mod-123",
        }
      );
    });

    it("should handle comment report not found", async () => {
      mockRepository.getCommentReport.mockResolvedValue(null);

      await expect(
        reportResolutionService.resolveCommentReport(
          "comment-report-123",
          mockCommentResolution
        )
      ).rejects.toThrow(
        "Failed to resolve comment report: Comment report not found"
      );
    });
  });

  describe("getResolutionStats", () => {
    const mockReports: Report[] = [
      {
        id: "report-1",
        whisperId: "whisper-1",
        reporterId: "reporter-1",
        reporterDisplayName: "Reporter 1",
        reporterReputation: 80,
        category: ReportCategory.HARASSMENT,
        priority: ReportPriority.HIGH,
        status: ReportStatus.RESOLVED,
        reason: "Test report 1",
        createdAt: new Date("2024-01-01T10:00:00Z"),
        updatedAt: new Date("2024-01-01T11:00:00Z"),
        reviewedAt: new Date("2024-01-01T11:00:00Z"),
        reviewedBy: "mod-1",
        resolution: {
          action: "warn",
          reason: "Warning issued",
          moderatorId: "mod-1",
          timestamp: new Date("2024-01-01T11:00:00Z"),
        },
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
        status: ReportStatus.RESOLVED,
        reason: "Test report 2",
        createdAt: new Date("2024-01-01T12:00:00Z"),
        updatedAt: new Date("2024-01-01T13:00:00Z"),
        reviewedAt: new Date("2024-01-01T13:00:00Z"),
        reviewedBy: "mod-2",
        resolution: {
          action: "dismiss",
          reason: "Report dismissed",
          moderatorId: "mod-2",
          timestamp: new Date("2024-01-01T13:00:00Z"),
        },
        reputationWeight: 1.0,
      },
    ];

    it("should generate correct resolution stats", async () => {
      mockRepository.getAll.mockResolvedValue(mockReports);

      const stats = await reportResolutionService.getResolutionStats();

      expect(stats.totalResolutions).toBe(2);
      expect(stats.resolutionsByAction).toEqual({
        warn: 1,
        dismiss: 1,
      });
      expect(stats.resolutionsByCategory).toEqual({
        harassment: 1,
        spam: 1,
      });
      expect(stats.averageResolutionTime).toBe(1); // 1 hour average
      expect(stats.moderatorPerformance).toEqual({
        "mod-1": {
          totalResolutions: 1,
          averageTime: 1,
          accuracy: 100,
        },
        "mod-2": {
          totalResolutions: 1,
          averageTime: 1,
          accuracy: 100,
        },
      });
    });

    it("should handle empty reports", async () => {
      mockRepository.getAll.mockResolvedValue([]);

      const stats = await reportResolutionService.getResolutionStats();

      expect(stats.totalResolutions).toBe(0);
      expect(stats.averageResolutionTime).toBe(0);
      expect(stats.resolutionsByAction).toEqual({});
    });

    it("should handle repository errors", async () => {
      mockRepository.getAll.mockRejectedValue(new Error("Database error"));

      await expect(
        reportResolutionService.getResolutionStats()
      ).rejects.toThrow("Failed to get resolution stats: Database error");
    });
  });

  describe("getUserResolutionHistory", () => {
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
        createdAt: new Date("2024-01-01T10:00:00Z"),
        updatedAt: new Date("2024-01-01T11:00:00Z"),
        reviewedAt: new Date("2024-01-01T11:00:00Z"),
        reviewedBy: "mod-1",
        resolution: {
          action: "warn",
          reason: "Warning issued",
          moderatorId: "mod-1",
          timestamp: new Date("2024-01-01T11:00:00Z"),
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
        status: ReportStatus.PENDING,
        reason: "Test report 2",
        createdAt: new Date("2024-01-01T12:00:00Z"),
        updatedAt: new Date("2024-01-01T12:00:00Z"),
        reputationWeight: 1.0,
      },
    ];

    it("should generate correct user resolution history", async () => {
      mockRepository.getAll.mockResolvedValue(mockUserReports);

      const history = await reportResolutionService.getUserResolutionHistory(
        "user-123"
      );

      expect(history.reportsSubmitted).toHaveLength(2);
      expect(history.reportsResolved).toHaveLength(1);
      expect(history.averageResolutionTime).toBe(1); // 1 hour
      expect(history.mostCommonAction).toBe("warn");
    });

    it("should handle user with no reports", async () => {
      mockRepository.getAll.mockResolvedValue([]);

      const history = await reportResolutionService.getUserResolutionHistory(
        "user-123"
      );

      expect(history.reportsSubmitted).toHaveLength(0);
      expect(history.reportsResolved).toHaveLength(0);
      expect(history.averageResolutionTime).toBe(0);
      expect(history.mostCommonAction).toBe("none");
    });

    it("should handle repository errors", async () => {
      mockRepository.getAll.mockRejectedValue(new Error("Database error"));

      await expect(
        reportResolutionService.getUserResolutionHistory("user-123")
      ).rejects.toThrow(
        "Failed to get user resolution history: Database error"
      );
    });
  });

  describe("Private helper methods", () => {
    it("should apply warn resolution correctly", async () => {
      const resolution: ReportResolution = {
        action: "warn",
        reason: "Warning issued",
        moderatorId: "mod-123",
        timestamp: new Date(),
      };

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

      mockRepository.getById.mockResolvedValue(mockReport);
      mockRepository.update.mockResolvedValue();
      mockFirestoreService.getWhisper.mockResolvedValue({
        id: "whisper-123",
        userId: "user-123",
        userDisplayName: "Test User",
        userProfileColor: "#007AFF",
        audioUrl: "test-url",
        duration: 10,
        whisperPercentage: 80,
        averageLevel: 0.5,
        confidence: 0.9,
        likes: 5,
        replies: 2,
        createdAt: new Date(),
      });
      mockSuspensionService.createSuspension.mockResolvedValue({} as any);

      // Access private method through public method
      await reportResolutionService.resolveWhisperReport(
        "report-123",
        resolution
      );

      expect(mockSuspensionService.createSuspension).toHaveBeenCalledWith({
        userId: "user-123",
        reason: "Whisper warning: Warning issued",
        type: expect.any(String),
        moderatorId: "system",
      });
    });

    it("should apply reject resolution correctly", async () => {
      const resolution: ReportResolution = {
        action: "reject",
        reason: "Content rejected",
        moderatorId: "mod-123",
        timestamp: new Date(),
      };

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

      mockRepository.getById.mockResolvedValue(mockReport);
      mockRepository.update.mockResolvedValue();
      mockFirestoreService.getWhisper.mockResolvedValue({
        id: "whisper-123",
        userId: "user-123",
        userDisplayName: "Test User",
        userProfileColor: "#007AFF",
        audioUrl: "test-url",
        duration: 10,
        whisperPercentage: 80,
        averageLevel: 0.5,
        confidence: 0.9,
        likes: 5,
        replies: 2,
        createdAt: new Date(),
      });
      mockFirestoreService.deleteWhisper.mockResolvedValue(undefined);
      mockReputationService.adjustUserReputationScore.mockResolvedValue(
        undefined
      );

      // Access private method through public method
      await reportResolutionService.resolveWhisperReport(
        "report-123",
        resolution
      );

      expect(mockFirestoreService.deleteWhisper).toHaveBeenCalledWith(
        "whisper-123"
      );
      expect(
        mockReputationService.adjustUserReputationScore
      ).toHaveBeenCalledWith(
        "user-123",
        -20,
        "Whisper rejected: Content rejected"
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle errors in resolveWhisperReport gracefully", async () => {
      mockRepository.getById.mockRejectedValue(new Error("Database error"));

      await expect(
        reportResolutionService.resolveWhisperReport("report-123", {
          action: "warn",
          reason: "Test",
          moderatorId: "mod-123",
          timestamp: new Date(),
        })
      ).rejects.toThrow("Failed to resolve whisper report: Database error");
    });

    it("should handle errors in resolveCommentReport gracefully", async () => {
      mockRepository.getCommentReport.mockRejectedValue(
        new Error("Database error")
      );

      await expect(
        reportResolutionService.resolveCommentReport("report-123", {
          action: "hide",
          reason: "Test",
          moderatorId: "mod-123",
          timestamp: new Date(),
        })
      ).rejects.toThrow("Failed to resolve comment report: Database error");
    });

    it("should handle unknown errors gracefully", async () => {
      mockRepository.getById.mockRejectedValue("Unknown error");

      await expect(
        reportResolutionService.resolveWhisperReport("report-123", {
          action: "warn",
          reason: "Test",
          moderatorId: "mod-123",
          timestamp: new Date(),
        })
      ).rejects.toThrow("Failed to resolve whisper report: Unknown error");
    });
  });
});
