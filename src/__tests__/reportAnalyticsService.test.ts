/**
 * ReportAnalyticsService Tests
 */

import { ReportAnalyticsService } from "../services/reportAnalyticsService";
import { Report, ReportCategory, ReportPriority, ReportStatus } from "../types";

describe("ReportAnalyticsService", () => {
  let service: ReportAnalyticsService;

  beforeEach(() => {
    ReportAnalyticsService.resetInstance();
    service = ReportAnalyticsService.getInstance();
  });

  afterEach(() => {
    ReportAnalyticsService.destroyInstance();
  });

  describe("Singleton Pattern", () => {
    it("should return the same instance", () => {
      const instance1 = ReportAnalyticsService.getInstance();
      const instance2 = ReportAnalyticsService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("should reset instance correctly", () => {
      const instance1 = ReportAnalyticsService.getInstance();
      ReportAnalyticsService.resetInstance();
      const instance2 = ReportAnalyticsService.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe("getOverallStats", () => {
    it("should generate correct overall stats", async () => {
      const mockReports: Report[] = [
        {
          id: "report1",
          whisperId: "whisper1",
          reporterId: "user1",
          reporterDisplayName: "User 1",
          reporterReputation: 80,
          category: ReportCategory.HARASSMENT,
          priority: ReportPriority.HIGH,
          status: ReportStatus.PENDING,
          reason: "Test report",
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
          reputationWeight: 1.5,
        },
        {
          id: "report2",
          whisperId: "whisper2",
          reporterId: "user2",
          reporterDisplayName: "User 2",
          reporterReputation: 90,
          category: ReportCategory.VIOLENCE,
          priority: ReportPriority.CRITICAL,
          status: ReportStatus.RESOLVED,
          reason: "Test report 2",
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-02"),
          reviewedAt: new Date("2024-01-02"),
          reputationWeight: 2.0,
        },
      ];

      const stats = await service.getOverallStats(mockReports);

      expect(stats.totalReports).toBe(2);
      expect(stats.pendingReports).toBe(1);
      expect(stats.criticalReports).toBe(1);
      expect(stats.resolvedReports).toBe(1);
      expect(stats.reportsByCategory[ReportCategory.HARASSMENT]).toBe(1);
      expect(stats.reportsByCategory[ReportCategory.VIOLENCE]).toBe(1);
      expect(stats.reportsByPriority[ReportPriority.HIGH]).toBe(1);
      expect(stats.reportsByPriority[ReportPriority.CRITICAL]).toBe(1);
    });

    it("should handle empty reports array", async () => {
      const stats = await service.getOverallStats([]);

      expect(stats.totalReports).toBe(0);
      expect(stats.pendingReports).toBe(0);
      expect(stats.criticalReports).toBe(0);
      expect(stats.resolvedReports).toBe(0);
      expect(stats.averageResolutionTime).toBe(0);
    });

    it("should calculate average resolution time correctly", async () => {
      const mockReports: Report[] = [
        {
          id: "report1",
          whisperId: "whisper1",
          reporterId: "user1",
          reporterDisplayName: "User 1",
          reporterReputation: 80,
          category: ReportCategory.HARASSMENT,
          priority: ReportPriority.HIGH,
          status: ReportStatus.RESOLVED,
          reason: "Test report",
          createdAt: new Date("2024-01-01T10:00:00"),
          updatedAt: new Date("2024-01-01T12:00:00"),
          reviewedAt: new Date("2024-01-01T12:00:00"), // 2 hours later
          reputationWeight: 1.5,
        },
      ];

      const stats = await service.getOverallStats(mockReports);
      expect(stats.averageResolutionTime).toBe(2); // 2 hours
    });
  });

  describe("getWhisperReportStats", () => {
    it("should generate correct whisper report stats", async () => {
      const mockReports: Report[] = [
        {
          id: "report1",
          whisperId: "whisper1",
          reporterId: "user1",
          reporterDisplayName: "User 1",
          reporterReputation: 80,
          category: ReportCategory.HARASSMENT,
          priority: ReportPriority.HIGH,
          status: ReportStatus.PENDING,
          reason: "Test report",
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
          reputationWeight: 1.5,
        },
        {
          id: "report2",
          whisperId: "whisper1", // Same whisper
          reporterId: "user2",
          reporterDisplayName: "User 2",
          reporterReputation: 90,
          category: ReportCategory.VIOLENCE,
          priority: ReportPriority.CRITICAL,
          status: ReportStatus.ESCALATED,
          reason: "Test report 2",
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
          reputationWeight: 2.0,
        },
      ];

      const stats = await service.getWhisperReportStats(
        mockReports,
        "whisper1"
      );

      expect(stats.totalReports).toBe(2);
      expect(stats.uniqueReporters).toBe(2);
      expect(stats.categories[ReportCategory.HARASSMENT]).toBe(1);
      expect(stats.categories[ReportCategory.VIOLENCE]).toBe(1);
      expect(stats.priorityBreakdown[ReportPriority.HIGH]).toBe(1);
      expect(stats.priorityBreakdown[ReportPriority.CRITICAL]).toBe(1);
      expect(stats.escalationRate).toBe(50); // 1 out of 2 reports escalated
    });

    it("should handle whisper with no reports", async () => {
      const mockReports: Report[] = [];

      const stats = await service.getWhisperReportStats(
        mockReports,
        "whisper1"
      );

      expect(stats.totalReports).toBe(0);
      expect(stats.uniqueReporters).toBe(0);
      expect(stats.averagePriority).toBe(0);
      expect(stats.escalationRate).toBe(0);
    });
  });

  describe("getCommentReportStats", () => {
    it("should generate correct comment report stats", async () => {
      const mockReports: Report[] = [
        {
          id: "report1",
          whisperId: "whisper1",
          commentId: "comment1",
          reporterId: "user1",
          reporterDisplayName: "User 1",
          reporterReputation: 80,
          category: ReportCategory.SPAM,
          priority: ReportPriority.MEDIUM,
          status: ReportStatus.PENDING,
          reason: "Test report",
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
          reputationWeight: 1.0,
        },
      ];

      const stats = await service.getCommentReportStats(
        mockReports,
        "comment1"
      );

      expect(stats.totalReports).toBe(1);
      expect(stats.uniqueReporters).toBe(1);
      expect(stats.categories[ReportCategory.SPAM]).toBe(1);
      expect(stats.priorityBreakdown[ReportPriority.MEDIUM]).toBe(1);
      expect(stats.averagePriority).toBe(2); // MEDIUM = 2
    });
  });

  describe("getUserReportStats", () => {
    it("should generate correct user report stats", async () => {
      const mockReports: Report[] = [
        {
          id: "report1",
          whisperId: "whisper1",
          reporterId: "user1",
          reporterDisplayName: "User 1",
          reporterReputation: 80,
          category: ReportCategory.HARASSMENT,
          priority: ReportPriority.HIGH,
          status: ReportStatus.RESOLVED,
          reason: "Test report",
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
          reviewedAt: new Date("2024-01-02"),
          reputationWeight: 1.5,
          resolution: {
            action: "warn",
            reason: "Warning issued",
            moderatorId: "mod1",
            timestamp: new Date("2024-01-02"),
          },
        },
        {
          id: "report2",
          whisperId: "whisper2",
          reporterId: "user1", // Same user
          reporterDisplayName: "User 1",
          reporterReputation: 85,
          category: ReportCategory.HARASSMENT,
          priority: ReportPriority.MEDIUM,
          status: ReportStatus.RESOLVED,
          reason: "Test report 2",
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
          reviewedAt: new Date("2024-01-02"),
          reputationWeight: 1.5,
          resolution: {
            action: "dismiss",
            reason: "No violation found",
            moderatorId: "mod1",
            timestamp: new Date("2024-01-02"),
          },
        },
      ];

      const stats = await service.getUserReportStats(mockReports, "user1");

      expect(stats.totalReportsSubmitted).toBe(2);
      expect(stats.reportsByCategory[ReportCategory.HARASSMENT]).toBe(2);
      expect(stats.averageReporterReputation).toBe(82.5); // (80 + 85) / 2
      expect(stats.mostReportedCategory).toBe(ReportCategory.HARASSMENT);
      expect(stats.reportAccuracy).toBe(50); // 1 out of 2 reports led to action
    });
  });

  describe("getCategoryBreakdown", () => {
    it("should generate correct category breakdown", async () => {
      const mockReports: Report[] = [
        {
          id: "report1",
          whisperId: "whisper1",
          reporterId: "user1",
          reporterDisplayName: "User 1",
          reporterReputation: 80,
          category: ReportCategory.HARASSMENT,
          priority: ReportPriority.HIGH,
          status: ReportStatus.RESOLVED,
          reason: "Test report",
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
          reviewedAt: new Date("2024-01-02"),
          reputationWeight: 1.5,
        },
        {
          id: "report2",
          whisperId: "whisper2",
          reporterId: "user2",
          reporterDisplayName: "User 2",
          reporterReputation: 90,
          category: ReportCategory.VIOLENCE,
          priority: ReportPriority.CRITICAL,
          status: ReportStatus.PENDING,
          reason: "Test report 2",
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
          reputationWeight: 2.0,
        },
      ];

      const breakdown = await service.getCategoryBreakdown(mockReports);

      expect(breakdown).toHaveLength(10); // All categories are returned
      const violenceBreakdown = breakdown.find(
        (b) => b.category === ReportCategory.VIOLENCE
      );
      const harassmentBreakdown = breakdown.find(
        (b) => b.category === ReportCategory.HARASSMENT
      );

      expect(violenceBreakdown?.count).toBe(1);
      expect(violenceBreakdown?.percentage).toBe(50);
      expect(harassmentBreakdown?.count).toBe(1);
      expect(harassmentBreakdown?.percentage).toBe(50);
    });
  });

  describe("getPriorityBreakdown", () => {
    it("should generate correct priority breakdown", async () => {
      const mockReports: Report[] = [
        {
          id: "report1",
          whisperId: "whisper1",
          reporterId: "user1",
          reporterDisplayName: "User 1",
          reporterReputation: 80,
          category: ReportCategory.HARASSMENT,
          priority: ReportPriority.HIGH,
          status: ReportStatus.PENDING,
          reason: "Test report",
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
          reputationWeight: 1.5,
        },
        {
          id: "report2",
          whisperId: "whisper2",
          reporterId: "user2",
          reporterDisplayName: "User 2",
          reporterReputation: 90,
          category: ReportCategory.VIOLENCE,
          priority: ReportPriority.CRITICAL,
          status: ReportStatus.PENDING,
          reason: "Test report 2",
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
          reputationWeight: 2.0,
        },
      ];

      const breakdown = await service.getPriorityBreakdown(mockReports);

      expect(breakdown).toHaveLength(4); // All priorities are returned
      const criticalBreakdown = breakdown.find(
        (b) => b.priority === ReportPriority.CRITICAL
      );
      const highBreakdown = breakdown.find(
        (b) => b.priority === ReportPriority.HIGH
      );

      expect(criticalBreakdown?.count).toBe(1);
      expect(criticalBreakdown?.percentage).toBe(50);
      expect(highBreakdown?.count).toBe(1);
      expect(highBreakdown?.percentage).toBe(50);
    });
  });

  describe("getReportTrends", () => {
    it("should generate report trends", async () => {
      const mockReports: Report[] = [];

      const trends = await service.getReportTrends(mockReports);

      expect(trends).toEqual({
        dailyReports: [],
        weeklyReports: [],
        monthlyReports: [],
        categoryTrends: {},
        priorityTrends: {},
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle errors gracefully in getOverallStats", async () => {
      const stats = await service.getOverallStats(null as any);
      expect(stats.totalReports).toBe(0);
    });

    it("should handle errors gracefully in getWhisperReportStats", async () => {
      const stats = await service.getWhisperReportStats(
        null as any,
        "whisper1"
      );
      expect(stats.totalReports).toBe(0);
    });

    it("should handle errors gracefully in getCommentReportStats", async () => {
      const stats = await service.getCommentReportStats(
        null as any,
        "comment1"
      );
      expect(stats.totalReports).toBe(0);
    });

    it("should handle errors gracefully in getUserReportStats", async () => {
      const stats = await service.getUserReportStats(null as any, "user1");
      expect(stats.totalReportsSubmitted).toBe(0);
    });
  });
});
