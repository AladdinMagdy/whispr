/**
 * ReportAnalyticsService Tests
 */

import { ReportAnalyticsService } from "../services/reportAnalyticsService";
import { Report, ReportCategory, ReportPriority, ReportStatus } from "../types";
import {
  getReportAnalyticsService,
  resetReportAnalyticsService,
  destroyReportAnalyticsService,
} from "../services/reportAnalyticsService";

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

    it("should handle errors gracefully in getCategoryBreakdown", async () => {
      const breakdown = await service.getCategoryBreakdown(null as any);
      expect(breakdown).toEqual([]);
    });

    it("should handle errors gracefully in getPriorityBreakdown", async () => {
      const breakdown = await service.getPriorityBreakdown(null as any);
      expect(breakdown).toEqual([]);
    });

    it("should handle errors gracefully in getReportTrends", async () => {
      const trends = await service.getReportTrends(null as any);
      expect(trends.dailyReports).toEqual([]);
      expect(trends.weeklyReports).toEqual([]);
      expect(trends.monthlyReports).toEqual([]);
    });
  });

  describe("getOverallStats - Edge Cases", () => {
    it("should handle reports with no reviewedAt timestamp", async () => {
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
          // No reviewedAt timestamp
          reputationWeight: 1.5,
        },
      ];

      const stats = await service.getOverallStats(mockReports);
      expect(stats.averageResolutionTime).toBe(0);
    });

    it("should handle reports with all statuses", async () => {
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
          status: ReportStatus.UNDER_REVIEW,
          reason: "Test report 2",
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
          reputationWeight: 2.0,
        },
        {
          id: "report3",
          whisperId: "whisper3",
          reporterId: "user3",
          reporterDisplayName: "User 3",
          reporterReputation: 70,
          category: ReportCategory.SPAM,
          priority: ReportPriority.MEDIUM,
          status: ReportStatus.DISMISSED,
          reason: "Test report 3",
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
          reputationWeight: 1.0,
        },
        {
          id: "report4",
          whisperId: "whisper4",
          reporterId: "user4",
          reporterDisplayName: "User 4",
          reporterReputation: 85,
          category: ReportCategory.SCAM,
          priority: ReportPriority.LOW,
          status: ReportStatus.ESCALATED,
          reason: "Test report 4",
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
          reputationWeight: 1.5,
        },
      ];

      const stats = await service.getOverallStats(mockReports);
      expect(stats.totalReports).toBe(4);
      expect(stats.pendingReports).toBe(1);
      expect(stats.criticalReports).toBe(1);
      expect(stats.resolvedReports).toBe(0);
      expect(stats.reportsByStatus[ReportStatus.PENDING]).toBe(1);
      expect(stats.reportsByStatus[ReportStatus.UNDER_REVIEW]).toBe(1);
      expect(stats.reportsByStatus[ReportStatus.DISMISSED]).toBe(1);
      expect(stats.reportsByStatus[ReportStatus.ESCALATED]).toBe(1);
    });
  });

  describe("getUserReportStats - Edge Cases", () => {
    it("should handle user with no actionable reports", async () => {
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
            action: "dismiss",
            reason: "No violation found",
            moderatorId: "mod1",
            timestamp: new Date("2024-01-02"),
          },
        },
      ];

      const stats = await service.getUserReportStats(mockReports, "user1");
      expect(stats.reportAccuracy).toBe(0); // All reports dismissed
    });

    it("should handle user with all actionable reports", async () => {
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
          reporterId: "user1",
          reporterDisplayName: "User 1",
          reporterReputation: 85,
          category: ReportCategory.VIOLENCE,
          priority: ReportPriority.CRITICAL,
          status: ReportStatus.RESOLVED,
          reason: "Test report 2",
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
          reviewedAt: new Date("2024-01-02"),
          reputationWeight: 2.0,
          resolution: {
            action: "ban",
            reason: "Serious violation",
            moderatorId: "mod1",
            timestamp: new Date("2024-01-02"),
          },
        },
      ];

      const stats = await service.getUserReportStats(mockReports, "user1");
      expect(stats.reportAccuracy).toBe(100); // All reports led to action
      expect(stats.averageReporterReputation).toBe(82.5);
    });

    it("should handle user with no reports", async () => {
      const mockReports: Report[] = [];

      const stats = await service.getUserReportStats(mockReports, "user1");
      expect(stats.totalReportsSubmitted).toBe(0);
      expect(stats.averageReporterReputation).toBe(0);
      expect(stats.mostReportedCategory).toBe(ReportCategory.HARASSMENT);
      expect(stats.reportAccuracy).toBe(0);
    });
  });

  describe("getCategoryBreakdown - Edge Cases", () => {
    it("should handle reports with all categories", async () => {
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
        {
          id: "report3",
          whisperId: "whisper3",
          reporterId: "user3",
          reporterDisplayName: "User 3",
          reporterReputation: 70,
          category: ReportCategory.SPAM,
          priority: ReportPriority.MEDIUM,
          status: ReportStatus.PENDING,
          reason: "Test report 3",
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
          reputationWeight: 1.0,
        },
      ];

      const breakdown = await service.getCategoryBreakdown(mockReports);
      expect(breakdown).toHaveLength(10); // All categories are returned
      expect(breakdown[0].count).toBe(1); // Should be sorted by count
      expect(breakdown[0].percentage).toBeCloseTo(33.33, 2); // 1/3 * 100
    });

    it("should handle empty reports array", async () => {
      const breakdown = await service.getCategoryBreakdown([]);
      expect(breakdown).toHaveLength(10); // All categories are returned
      breakdown.forEach((item) => {
        expect(item.count).toBe(0);
        expect(item.percentage).toBe(0);
        expect(item.averagePriority).toBe(0);
        expect(item.resolutionRate).toBe(0);
      });
    });
  });

  describe("getPriorityBreakdown - Edge Cases", () => {
    it("should handle reports with all priorities", async () => {
      const mockReports: Report[] = [
        {
          id: "report1",
          whisperId: "whisper1",
          reporterId: "user1",
          reporterDisplayName: "User 1",
          reporterReputation: 80,
          category: ReportCategory.HARASSMENT,
          priority: ReportPriority.LOW,
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
          priority: ReportPriority.MEDIUM,
          status: ReportStatus.PENDING,
          reason: "Test report 2",
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
          reputationWeight: 2.0,
        },
        {
          id: "report3",
          whisperId: "whisper3",
          reporterId: "user3",
          reporterDisplayName: "User 3",
          reporterReputation: 70,
          category: ReportCategory.SPAM,
          priority: ReportPriority.HIGH,
          status: ReportStatus.PENDING,
          reason: "Test report 3",
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
          reputationWeight: 1.0,
        },
        {
          id: "report4",
          whisperId: "whisper4",
          reporterId: "user4",
          reporterDisplayName: "User 4",
          reporterReputation: 85,
          category: ReportCategory.SCAM,
          priority: ReportPriority.CRITICAL,
          status: ReportStatus.PENDING,
          reason: "Test report 4",
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
          reputationWeight: 1.5,
        },
      ];

      const breakdown = await service.getPriorityBreakdown(mockReports);
      expect(breakdown).toHaveLength(4); // All priorities are returned
      expect(breakdown[0].count).toBe(1); // Should be sorted by count
      expect(breakdown[0].percentage).toBe(25); // 1/4 * 100
    });

    it("should handle reports with resolved status for resolution time calculation", async () => {
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
          updatedAt: new Date("2024-01-01T10:00:00"),
          reviewedAt: new Date("2024-01-01T12:00:00"), // 2 hours later
          reputationWeight: 1.5,
        },
      ];

      const breakdown = await service.getPriorityBreakdown(mockReports);
      expect(breakdown).toHaveLength(4);
      const highPriorityBreakdown = breakdown.find(
        (b) => b.priority === ReportPriority.HIGH
      );
      expect(highPriorityBreakdown?.averageResolutionTime).toBe(2); // 2 hours
    });
  });

  describe("Factory Functions", () => {
    it("should return singleton instance via getReportAnalyticsService", () => {
      const instance1 = getReportAnalyticsService();
      const instance2 = getReportAnalyticsService();
      expect(instance1).toBe(instance2);
    });

    it("should reset instance via resetReportAnalyticsService", () => {
      const instance1 = getReportAnalyticsService();
      resetReportAnalyticsService();
      const instance2 = getReportAnalyticsService();
      expect(instance1).not.toBe(instance2);
    });

    it("should destroy instance via destroyReportAnalyticsService", () => {
      const instance1 = getReportAnalyticsService();
      destroyReportAnalyticsService();
      const instance2 = getReportAnalyticsService();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe("Singleton Pattern - Edge Cases", () => {
    it("should create new instance when none exists", () => {
      ReportAnalyticsService.destroyInstance();
      const instance = ReportAnalyticsService.getInstance();
      expect(instance).toBeInstanceOf(ReportAnalyticsService);
    });

    it("should return existing instance when one exists", () => {
      const instance1 = ReportAnalyticsService.getInstance();
      const instance2 = ReportAnalyticsService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("should handle resetInstance when instance is null", () => {
      ReportAnalyticsService.destroyInstance();
      expect(() => ReportAnalyticsService.resetInstance()).not.toThrow();
    });

    it("should handle destroyInstance when instance is null", () => {
      ReportAnalyticsService.destroyInstance();
      expect(() => ReportAnalyticsService.destroyInstance()).not.toThrow();
    });
  });

  describe("All Categories Coverage", () => {
    it("should handle all report categories", async () => {
      const categories = [
        ReportCategory.HARASSMENT,
        ReportCategory.HATE_SPEECH,
        ReportCategory.VIOLENCE,
        ReportCategory.SEXUAL_CONTENT,
        ReportCategory.SPAM,
        ReportCategory.SCAM,
        ReportCategory.COPYRIGHT,
        ReportCategory.PERSONAL_INFO,
        ReportCategory.MINOR_SAFETY,
        ReportCategory.OTHER,
      ];

      const mockReports = categories.map((category, index) => ({
        id: `report${index}`,
        whisperId: `whisper${index}`,
        reporterId: `user${index}`,
        reporterDisplayName: `User ${index}`,
        reporterReputation: 80,
        category,
        priority: ReportPriority.MEDIUM,
        status: ReportStatus.PENDING,
        reason: "Test report",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        reputationWeight: 1.5,
      }));

      const stats = await service.getOverallStats(mockReports);
      expect(stats.totalReports).toBe(10);
      categories.forEach((category) => {
        expect(stats.reportsByCategory[category]).toBe(1);
      });
    });
  });

  describe("All Priorities Coverage", () => {
    it("should handle all report priorities", async () => {
      const priorities = [
        ReportPriority.LOW,
        ReportPriority.MEDIUM,
        ReportPriority.HIGH,
        ReportPriority.CRITICAL,
      ];

      const mockReports = priorities.map((priority, index) => ({
        id: `report${index}`,
        whisperId: `whisper${index}`,
        reporterId: `user${index}`,
        reporterDisplayName: `User ${index}`,
        reporterReputation: 80,
        category: ReportCategory.HARASSMENT,
        priority,
        status: ReportStatus.PENDING,
        reason: "Test report",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        reputationWeight: 1.5,
      }));

      const stats = await service.getOverallStats(mockReports);
      expect(stats.totalReports).toBe(4);
      priorities.forEach((priority) => {
        expect(stats.reportsByPriority[priority]).toBe(1);
      });
    });
  });

  describe("All Statuses Coverage", () => {
    it("should handle all report statuses", async () => {
      const statuses = [
        ReportStatus.PENDING,
        ReportStatus.UNDER_REVIEW,
        ReportStatus.RESOLVED,
        ReportStatus.DISMISSED,
        ReportStatus.ESCALATED,
      ];

      const mockReports = statuses.map((status, index) => ({
        id: `report${index}`,
        whisperId: `whisper${index}`,
        reporterId: `user${index}`,
        reporterDisplayName: `User ${index}`,
        reporterReputation: 80,
        category: ReportCategory.HARASSMENT,
        priority: ReportPriority.MEDIUM,
        status,
        reason: "Test report",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        reputationWeight: 1.5,
      }));

      const stats = await service.getOverallStats(mockReports);
      expect(stats.totalReports).toBe(5);
      statuses.forEach((status) => {
        expect(stats.reportsByStatus[status]).toBe(1);
      });
    });
  });
});
