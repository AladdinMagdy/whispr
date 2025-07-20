/**
 * Report Analytics Service
 * Handles report statistics and analytics
 */

import { Report, ReportCategory, ReportPriority, ReportStatus } from "../types";

export interface OverallReportStats {
  totalReports: number;
  pendingReports: number;
  criticalReports: number;
  resolvedReports: number;
  averageResolutionTime: number; // in hours
  reportsByCategory: Record<ReportCategory, number>;
  reportsByPriority: Record<ReportPriority, number>;
  reportsByStatus: Record<ReportStatus, number>;
}

export interface WhisperReportStats {
  totalReports: number;
  uniqueReporters: number;
  categories: Record<ReportCategory, number>;
  priorityBreakdown: Record<ReportPriority, number>;
  statusBreakdown: Record<ReportStatus, number>;
  averagePriority: number;
  escalationRate: number; // Percentage of reports that were escalated
}

export interface CommentReportStats {
  totalReports: number;
  uniqueReporters: number;
  categories: Record<ReportCategory, number>;
  priorityBreakdown: Record<ReportPriority, number>;
  statusBreakdown: Record<ReportStatus, number>;
  averagePriority: number;
  escalationRate: number;
}

export interface UserReportStats {
  totalReportsSubmitted: number;
  reportsByCategory: Record<ReportCategory, number>;
  reportsByPriority: Record<ReportPriority, number>;
  averageReporterReputation: number;
  mostReportedCategory: ReportCategory;
  reportAccuracy: number; // Percentage of reports that led to action
}

export interface CategoryBreakdown {
  category: ReportCategory;
  count: number;
  percentage: number;
  averagePriority: number;
  resolutionRate: number;
}

export interface PriorityBreakdown {
  priority: ReportPriority;
  count: number;
  percentage: number;
  averageResolutionTime: number;
  escalationRate: number;
}

export interface ReportTrends {
  dailyReports: Array<{ date: string; count: number }>;
  weeklyReports: Array<{ week: string; count: number }>;
  monthlyReports: Array<{ month: string; count: number }>;
  categoryTrends: Record<
    ReportCategory,
    Array<{ date: string; count: number }>
  >;
  priorityTrends: Record<
    ReportPriority,
    Array<{ date: string; count: number }>
  >;
}

export class ReportAnalyticsService {
  private static instance: ReportAnalyticsService | null;

  private constructor() {}

  static getInstance(): ReportAnalyticsService {
    if (!ReportAnalyticsService.instance) {
      ReportAnalyticsService.instance = new ReportAnalyticsService();
    }
    return ReportAnalyticsService.instance;
  }

  /**
   * Generate overall report statistics
   */
  async getOverallStats(reports: Report[]): Promise<OverallReportStats> {
    try {
      const totalReports = reports.length;
      const pendingReports = reports.filter(
        (r) => r.status === ReportStatus.PENDING
      ).length;
      const criticalReports = reports.filter(
        (r) => r.priority === ReportPriority.CRITICAL
      ).length;
      const resolvedReports = reports.filter(
        (r) => r.status === ReportStatus.RESOLVED
      ).length;

      // Calculate average resolution time
      const resolvedReportsWithTime = reports.filter(
        (r) => r.status === ReportStatus.RESOLVED && r.reviewedAt
      );
      const averageResolutionTime =
        resolvedReportsWithTime.length > 0
          ? resolvedReportsWithTime.reduce((sum, report) => {
              const resolutionTime =
                report.reviewedAt!.getTime() - report.createdAt.getTime();
              return sum + resolutionTime;
            }, 0) /
            resolvedReportsWithTime.length /
            (1000 * 60 * 60) // Convert to hours
          : 0;

      // Generate category breakdown
      const reportsByCategory = this.generateCategoryBreakdown(reports);
      const reportsByPriority = this.generatePriorityBreakdown(reports);
      const reportsByStatus = this.generateStatusBreakdown(reports);

      return {
        totalReports,
        pendingReports,
        criticalReports,
        resolvedReports,
        averageResolutionTime,
        reportsByCategory,
        reportsByPriority,
        reportsByStatus,
      };
    } catch (error) {
      console.error("❌ Error generating overall stats:", error);
      return this.getEmptyOverallStats();
    }
  }

  /**
   * Generate whisper report statistics
   */
  async getWhisperReportStats(
    reports: Report[],
    whisperId: string
  ): Promise<WhisperReportStats> {
    try {
      const whisperReports = reports.filter((r) => r.whisperId === whisperId);
      const totalReports = whisperReports.length;
      const uniqueReporters = new Set(whisperReports.map((r) => r.reporterId))
        .size;

      const categories = this.generateCategoryBreakdown(whisperReports);
      const priorityBreakdown = this.generatePriorityBreakdown(whisperReports);
      const statusBreakdown = this.generateStatusBreakdown(whisperReports);

      // Calculate average priority (convert to numeric for calculation)
      const priorityValues = {
        [ReportPriority.LOW]: 1,
        [ReportPriority.MEDIUM]: 2,
        [ReportPriority.HIGH]: 3,
        [ReportPriority.CRITICAL]: 4,
      };
      const averagePriority =
        whisperReports.length > 0
          ? whisperReports.reduce(
              (sum, report) => sum + priorityValues[report.priority],
              0
            ) / whisperReports.length
          : 0;

      // Calculate escalation rate
      const escalatedReports = whisperReports.filter(
        (r) => r.status === ReportStatus.ESCALATED
      ).length;
      const escalationRate =
        totalReports > 0 ? (escalatedReports / totalReports) * 100 : 0;

      return {
        totalReports,
        uniqueReporters,
        categories,
        priorityBreakdown,
        statusBreakdown,
        averagePriority,
        escalationRate,
      };
    } catch (error) {
      console.error("❌ Error generating whisper report stats:", error);
      return this.getEmptyWhisperReportStats();
    }
  }

  /**
   * Generate comment report statistics
   */
  async getCommentReportStats(
    reports: Report[],
    commentId: string
  ): Promise<CommentReportStats> {
    try {
      const commentReports = reports.filter((r) => r.commentId === commentId);
      const totalReports = commentReports.length;
      const uniqueReporters = new Set(commentReports.map((r) => r.reporterId))
        .size;

      const categories = this.generateCategoryBreakdown(commentReports);
      const priorityBreakdown = this.generatePriorityBreakdown(commentReports);
      const statusBreakdown = this.generateStatusBreakdown(commentReports);

      // Calculate average priority
      const priorityValues = {
        [ReportPriority.LOW]: 1,
        [ReportPriority.MEDIUM]: 2,
        [ReportPriority.HIGH]: 3,
        [ReportPriority.CRITICAL]: 4,
      };
      const averagePriority =
        commentReports.length > 0
          ? commentReports.reduce(
              (sum, report) => sum + priorityValues[report.priority],
              0
            ) / commentReports.length
          : 0;

      // Calculate escalation rate
      const escalatedReports = commentReports.filter(
        (r) => r.status === ReportStatus.ESCALATED
      ).length;
      const escalationRate =
        totalReports > 0 ? (escalatedReports / totalReports) * 100 : 0;

      return {
        totalReports,
        uniqueReporters,
        categories,
        priorityBreakdown,
        statusBreakdown,
        averagePriority,
        escalationRate,
      };
    } catch (error) {
      console.error("❌ Error generating comment report stats:", error);
      return this.getEmptyCommentReportStats();
    }
  }

  /**
   * Generate user report statistics
   */
  async getUserReportStats(
    reports: Report[],
    userId: string
  ): Promise<UserReportStats> {
    try {
      const userReports = reports.filter((r) => r.reporterId === userId);
      const totalReportsSubmitted = userReports.length;

      const reportsByCategory = this.generateCategoryBreakdown(userReports);
      const reportsByPriority = this.generatePriorityBreakdown(userReports);

      // Calculate average reporter reputation
      const averageReporterReputation =
        userReports.length > 0
          ? userReports.reduce(
              (sum, report) => sum + report.reporterReputation,
              0
            ) / userReports.length
          : 0;

      // Find most reported category
      const mostReportedCategory =
        (Object.entries(reportsByCategory).sort(
          ([, a], [, b]) => b - a
        )[0]?.[0] as ReportCategory) || ReportCategory.OTHER;

      // Calculate report accuracy (reports that led to action)
      const actionableReports = userReports.filter(
        (r) =>
          r.status === ReportStatus.RESOLVED &&
          r.resolution?.action !== "dismiss"
      ).length;
      const reportAccuracy =
        totalReportsSubmitted > 0
          ? (actionableReports / totalReportsSubmitted) * 100
          : 0;

      return {
        totalReportsSubmitted,
        reportsByCategory,
        reportsByPriority,
        averageReporterReputation,
        mostReportedCategory,
        reportAccuracy,
      };
    } catch (error) {
      console.error("❌ Error generating user report stats:", error);
      return this.getEmptyUserReportStats();
    }
  }

  /**
   * Generate category breakdown
   */
  async getCategoryBreakdown(reports: Report[]): Promise<CategoryBreakdown[]> {
    try {
      const categoryStats = this.generateCategoryBreakdown(reports);
      const totalReports = reports.length;

      return Object.entries(categoryStats)
        .map(([category, count]) => {
          const categoryReports = reports.filter(
            (r) => r.category === category
          );
          const averagePriority =
            this.calculateAveragePriority(categoryReports);
          const resolutionRate = this.calculateResolutionRate(categoryReports);

          return {
            category: category as ReportCategory,
            count,
            percentage: totalReports > 0 ? (count / totalReports) * 100 : 0,
            averagePriority,
            resolutionRate,
          };
        })
        .sort((a, b) => b.count - a.count);
    } catch (error) {
      console.error("❌ Error generating category breakdown:", error);
      return [];
    }
  }

  /**
   * Generate priority breakdown
   */
  async getPriorityBreakdown(reports: Report[]): Promise<PriorityBreakdown[]> {
    try {
      const priorityStats = this.generatePriorityBreakdown(reports);
      const totalReports = reports.length;

      return Object.entries(priorityStats)
        .map(([priority, count]) => {
          const priorityReports = reports.filter(
            (r) => r.priority === priority
          );
          const averageResolutionTime =
            this.calculateAverageResolutionTime(priorityReports);
          const escalationRate = this.calculateEscalationRate(priorityReports);

          return {
            priority: priority as ReportPriority,
            count,
            percentage: totalReports > 0 ? (count / totalReports) * 100 : 0,
            averageResolutionTime,
            escalationRate,
          };
        })
        .sort((a, b) => b.count - a.count);
    } catch (error) {
      console.error("❌ Error generating priority breakdown:", error);
      return [];
    }
  }

  /**
   * Generate report trends over time
   */
  async getReportTrends(reports: Report[]): Promise<ReportTrends> {
    try {
      const dailyReports = this.generateDailyTrends(reports);
      const weeklyReports = this.generateWeeklyTrends(reports);
      const monthlyReports = this.generateMonthlyTrends(reports);
      const categoryTrends = this.generateCategoryTrends(reports);
      const priorityTrends = this.generatePriorityTrends(reports);

      return {
        dailyReports,
        weeklyReports,
        monthlyReports,
        categoryTrends,
        priorityTrends,
      };
    } catch (error) {
      console.error("❌ Error generating report trends:", error);
      return this.getEmptyReportTrends();
    }
  }

  // Private helper methods

  private generateCategoryBreakdown(
    reports: Report[]
  ): Record<ReportCategory, number> {
    const breakdown: Record<ReportCategory, number> = {
      [ReportCategory.HARASSMENT]: 0,
      [ReportCategory.HATE_SPEECH]: 0,
      [ReportCategory.VIOLENCE]: 0,
      [ReportCategory.SEXUAL_CONTENT]: 0,
      [ReportCategory.SPAM]: 0,
      [ReportCategory.SCAM]: 0,
      [ReportCategory.COPYRIGHT]: 0,
      [ReportCategory.PERSONAL_INFO]: 0,
      [ReportCategory.MINOR_SAFETY]: 0,
      [ReportCategory.OTHER]: 0,
    };

    reports.forEach((report) => {
      breakdown[report.category]++;
    });

    return breakdown;
  }

  private generatePriorityBreakdown(
    reports: Report[]
  ): Record<ReportPriority, number> {
    const breakdown: Record<ReportPriority, number> = {
      [ReportPriority.LOW]: 0,
      [ReportPriority.MEDIUM]: 0,
      [ReportPriority.HIGH]: 0,
      [ReportPriority.CRITICAL]: 0,
    };

    reports.forEach((report) => {
      breakdown[report.priority]++;
    });

    return breakdown;
  }

  private generateStatusBreakdown(
    reports: Report[]
  ): Record<ReportStatus, number> {
    const breakdown: Record<ReportStatus, number> = {
      [ReportStatus.PENDING]: 0,
      [ReportStatus.UNDER_REVIEW]: 0,
      [ReportStatus.RESOLVED]: 0,
      [ReportStatus.DISMISSED]: 0,
      [ReportStatus.ESCALATED]: 0,
    };

    reports.forEach((report) => {
      breakdown[report.status]++;
    });

    return breakdown;
  }

  private calculateAveragePriority(reports: Report[]): number {
    if (reports.length === 0) return 0;

    const priorityValues = {
      [ReportPriority.LOW]: 1,
      [ReportPriority.MEDIUM]: 2,
      [ReportPriority.HIGH]: 3,
      [ReportPriority.CRITICAL]: 4,
    };

    const totalPriority = reports.reduce(
      (sum, report) => sum + priorityValues[report.priority],
      0
    );
    return totalPriority / reports.length;
  }

  private calculateResolutionRate(reports: Report[]): number {
    if (reports.length === 0) return 0;

    const resolvedReports = reports.filter(
      (r) => r.status === ReportStatus.RESOLVED
    ).length;
    return (resolvedReports / reports.length) * 100;
  }

  private calculateAverageResolutionTime(reports: Report[]): number {
    const resolvedReports = reports.filter(
      (r) => r.status === ReportStatus.RESOLVED && r.reviewedAt
    );

    if (resolvedReports.length === 0) return 0;

    const totalTime = resolvedReports.reduce((sum, report) => {
      const resolutionTime =
        report.reviewedAt!.getTime() - report.createdAt.getTime();
      return sum + resolutionTime;
    }, 0);

    return totalTime / resolvedReports.length / (1000 * 60 * 60); // Convert to hours
  }

  private calculateEscalationRate(reports: Report[]): number {
    if (reports.length === 0) return 0;

    const escalatedReports = reports.filter(
      (r) => r.status === ReportStatus.ESCALATED
    ).length;
    return (escalatedReports / reports.length) * 100;
  }

  private generateDailyTrends(
    _reports: Report[]
  ): Array<{ date: string; count: number }> {
    console.log("generateDailyTrends", _reports);
    // Implementation for daily trends
    // This would group reports by day and count them
    return [];
  }

  private generateWeeklyTrends(
    _reports: Report[]
  ): Array<{ week: string; count: number }> {
    console.log("generateWeeklyTrends", _reports);
    // Implementation for weekly trends
    return [];
  }

  private generateMonthlyTrends(
    _reports: Report[]
  ): Array<{ month: string; count: number }> {
    console.log("generateMonthlyTrends", _reports);
    // Implementation for monthly trends
    return [];
  }

  private generateCategoryTrends(
    _reports: Report[]
  ): Record<ReportCategory, Array<{ date: string; count: number }>> {
    console.log("generateCategoryTrends", _reports);
    // Implementation for category trends
    return {} as Record<ReportCategory, Array<{ date: string; count: number }>>;
  }

  private generatePriorityTrends(
    _reports: Report[]
  ): Record<ReportPriority, Array<{ date: string; count: number }>> {
    console.log("generatePriorityTrends", _reports);
    // Implementation for priority trends
    return {} as Record<ReportPriority, Array<{ date: string; count: number }>>;
  }

  // Empty state generators for error handling

  private getEmptyOverallStats(): OverallReportStats {
    return {
      totalReports: 0,
      pendingReports: 0,
      criticalReports: 0,
      resolvedReports: 0,
      averageResolutionTime: 0,
      reportsByCategory: {} as Record<ReportCategory, number>,
      reportsByPriority: {} as Record<ReportPriority, number>,
      reportsByStatus: {} as Record<ReportStatus, number>,
    };
  }

  private getEmptyWhisperReportStats(): WhisperReportStats {
    return {
      totalReports: 0,
      uniqueReporters: 0,
      categories: {} as Record<ReportCategory, number>,
      priorityBreakdown: {} as Record<ReportPriority, number>,
      statusBreakdown: {} as Record<ReportStatus, number>,
      averagePriority: 0,
      escalationRate: 0,
    };
  }

  private getEmptyCommentReportStats(): CommentReportStats {
    return {
      totalReports: 0,
      uniqueReporters: 0,
      categories: {} as Record<ReportCategory, number>,
      priorityBreakdown: {} as Record<ReportPriority, number>,
      statusBreakdown: {} as Record<ReportStatus, number>,
      averagePriority: 0,
      escalationRate: 0,
    };
  }

  private getEmptyUserReportStats(): UserReportStats {
    return {
      totalReportsSubmitted: 0,
      reportsByCategory: {} as Record<ReportCategory, number>,
      reportsByPriority: {} as Record<ReportPriority, number>,
      averageReporterReputation: 0,
      mostReportedCategory: ReportCategory.OTHER,
      reportAccuracy: 0,
    };
  }

  private getEmptyReportTrends(): ReportTrends {
    return {
      dailyReports: [],
      weeklyReports: [],
      monthlyReports: [],
      categoryTrends: {} as Record<
        ReportCategory,
        Array<{ date: string; count: number }>
      >,
      priorityTrends: {} as Record<
        ReportPriority,
        Array<{ date: string; count: number }>
      >,
    };
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    ReportAnalyticsService.instance = null;
  }

  /**
   * Destroy singleton instance
   */
  static destroyInstance(): void {
    ReportAnalyticsService.instance = null;
  }
}

/**
 * Factory function to get ReportAnalyticsService instance
 */
export const getReportAnalyticsService = (): ReportAnalyticsService =>
  ReportAnalyticsService.getInstance();

/**
 * Factory function to reset ReportAnalyticsService instance
 */
export const resetReportAnalyticsService = (): void =>
  ReportAnalyticsService.resetInstance();

/**
 * Factory function to destroy ReportAnalyticsService instance
 */
export const destroyReportAnalyticsService = (): void =>
  ReportAnalyticsService.destroyInstance();
