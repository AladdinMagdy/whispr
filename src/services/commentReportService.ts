/**
 * Comment Report Service
 * Handles comment-specific report operations
 */

import {
  CommentReport,
  ReportCategory,
  ReportStatus,
  ReportPriority,
  ReportFilters,
} from "../types";
import { ReportRepository } from "../repositories/ReportRepository";
import { FirebaseReportRepository } from "../repositories/FirebaseReportRepository";
import { getReportPriorityService } from "./reportPriorityService";
import { getReportAnalyticsService } from "./reportAnalyticsService";
import { getReputationService } from "./reputationService";

export interface CreateCommentReportData {
  commentId: string;
  whisperId: string;
  reporterId: string;
  reporterDisplayName: string;
  category: ReportCategory;
  reason: string;
  evidence?: string;
}

export interface CommentReportFilters extends ReportFilters {
  commentId?: string;
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

export class CommentReportService {
  private static instance: CommentReportService | null;
  private repository: ReportRepository;
  private priorityService = getReportPriorityService();
  private analyticsService = getReportAnalyticsService();
  private reputationService = getReputationService();

  constructor(repository?: ReportRepository) {
    this.repository = repository || new FirebaseReportRepository();
  }

  static getInstance(): CommentReportService {
    if (!CommentReportService.instance) {
      CommentReportService.instance = new CommentReportService();
    }
    return CommentReportService.instance;
  }

  /**
   * Create a new comment report
   */
  async createReport(data: CreateCommentReportData): Promise<CommentReport> {
    try {
      // Get reporter's reputation
      const reporterReputation = await this.reputationService.getUserReputation(
        data.reporterId
      );

      // Check if user can report (not banned)
      if (reporterReputation.level === "banned") {
        throw new Error("Banned users cannot submit reports");
      }

      // Check for existing reports from the same user on the same comment
      const existingReports = await this.repository.getWithFilters({
        commentId: data.commentId,
        reporterId: data.reporterId,
      });

      // If user has already reported this comment, check if it's a different category
      if (existingReports.length > 0) {
        const existingReport = existingReports[0] as CommentReport; // Get the most recent one

        // If same category, provide feedback but allow the report
        if (existingReport.category === data.category) {
          console.log(
            `📝 User ${data.reporterId} reporting same comment again with same category: ${data.category}`
          );

          // Update the existing report with new information
          const updatedReport: CommentReport = {
            ...existingReport,
            reason: `${existingReport.reason}\n\n--- Additional Report ---\n${data.reason}`,
            updatedAt: new Date(),
            // Increase priority if this is a repeat report
            priority: this.priorityService.escalatePriority(
              existingReport.priority
            ),
          };

          await this.repository.updateCommentReport(
            existingReport.id,
            updatedReport
          );

          console.log(
            `📝 Updated existing comment report: ${existingReport.id} with escalated priority`
          );

          return updatedReport;
        } else {
          // Different category - create new report but link to existing one
          console.log(
            `📝 User ${data.reporterId} reporting same comment with different category: ${existingReport.category} → ${data.category}`
          );
        }
      }

      // Calculate priority based on reporter reputation and category
      const priority = this.priorityService.calculatePriority(
        reporterReputation,
        data.category
      );

      // Calculate reputation weight
      const reputationWeight =
        this.priorityService.calculateReputationWeight(reporterReputation);

      // Create report object
      const report: CommentReport = {
        id: `comment-report-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`,
        commentId: data.commentId,
        whisperId: data.whisperId,
        reporterId: data.reporterId,
        reporterDisplayName: data.reporterDisplayName,
        reporterReputation: reporterReputation.score,
        category: data.category,
        priority,
        status: ReportStatus.PENDING,
        reason: data.reason,
        evidence: data.evidence,
        createdAt: new Date(),
        updatedAt: new Date(),
        reputationWeight,
      };

      // Save to repository
      await this.repository.saveCommentReport(report);

      console.log(
        `📝 Comment report created: ${report.id} (${priority} priority)`
      );

      // If critical priority, trigger immediate review
      if (priority === ReportPriority.CRITICAL) {
        await this.escalateReport(report.id);
      }

      // Check for automatic escalation based on report count
      await this.checkAutomaticEscalation(data.commentId);

      return report;
    } catch (error) {
      console.error("❌ Error creating comment report:", error);
      throw new Error(
        `Failed to create comment report: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get comment reports with filtering
   */
  async getReports(
    filters: CommentReportFilters = {}
  ): Promise<CommentReport[]> {
    try {
      const reports = await this.repository.getWithFilters(filters);
      return reports as CommentReport[];
    } catch (error) {
      console.error("❌ Error getting comment reports:", error);
      throw new Error(
        `Failed to get comment reports: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get comment report by ID
   */
  async getReport(reportId: string): Promise<CommentReport | null> {
    try {
      const report = await this.repository.getById(reportId);
      return report as CommentReport | null;
    } catch (error) {
      console.error("❌ Error getting comment report:", error);
      throw new Error(
        `Failed to get comment report: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Update comment report status
   */
  async updateStatus(
    reportId: string,
    status: ReportStatus,
    moderatorId?: string
  ): Promise<void> {
    try {
      const report = await this.repository.getCommentReport(reportId);
      if (!report) {
        throw new Error("Report not found");
      }

      const updatedReport: CommentReport = {
        ...report,
        status,
        updatedAt: new Date(),
        reviewedAt: new Date(),
        reviewedBy: moderatorId,
      };

      await this.repository.updateCommentReport(reportId, updatedReport);

      console.log(`📝 Updated comment report ${reportId} status to ${status}`);
    } catch (error) {
      console.error("❌ Error updating comment report status:", error);
      throw new Error(
        `Failed to update comment report status: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Check if user has reported a comment
   */
  async hasUserReported(commentId: string, userId: string): Promise<boolean> {
    try {
      const reports = await this.repository.getWithFilters({
        commentId,
        reporterId: userId,
      });
      return reports.length > 0;
    } catch (error) {
      console.error("❌ Error checking if user reported comment:", error);
      return false;
    }
  }

  /**
   * Get comment report statistics
   */
  async getCommentStats(commentId: string): Promise<CommentReportStats> {
    try {
      const reports = await this.repository.getWithFilters({ commentId });
      return await this.analyticsService.getCommentReportStats(
        reports,
        commentId
      );
    } catch (error) {
      console.error("❌ Error getting comment report stats:", error);
      throw new Error(
        `Failed to get comment report stats: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get reports by comment ID
   */
  async getReportsByComment(commentId: string): Promise<CommentReport[]> {
    try {
      const reports = await this.repository.getWithFilters({ commentId });
      return reports as CommentReport[];
    } catch (error) {
      console.error("❌ Error getting reports by comment:", error);
      throw new Error(
        `Failed to get reports by comment: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get reports by reporter ID
   */
  async getReportsByReporter(reporterId: string): Promise<CommentReport[]> {
    try {
      const reports = await this.repository.getWithFilters({ reporterId });
      return reports as CommentReport[];
    } catch (error) {
      console.error("❌ Error getting reports by reporter:", error);
      throw new Error(
        `Failed to get reports by reporter: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Delete a comment report
   */
  async deleteReport(reportId: string): Promise<void> {
    try {
      await this.repository.delete(reportId);
      console.log(`📝 Deleted comment report: ${reportId}`);
    } catch (error) {
      console.error("❌ Error deleting comment report:", error);
      throw new Error(
        `Failed to delete comment report: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Update comment report
   */
  async updateReport(
    reportId: string,
    updates: Partial<CommentReport>
  ): Promise<void> {
    try {
      await this.repository.updateCommentReport(reportId, {
        ...updates,
        updatedAt: new Date(),
      });
      console.log(`📝 Updated comment report: ${reportId}`);
    } catch (error) {
      console.error("❌ Error updating comment report:", error);
      throw new Error(
        `Failed to update comment report: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // Private helper methods

  /**
   * Escalate report for immediate review
   */
  private async escalateReport(reportId: string): Promise<void> {
    try {
      await this.updateStatus(reportId, ReportStatus.ESCALATED);
      console.log(`🚨 Escalated comment report: ${reportId}`);
    } catch (error) {
      console.error("❌ Error escalating comment report:", error);
    }
  }

  /**
   * Check for automatic escalation based on report count
   */
  private async checkAutomaticEscalation(commentId: string): Promise<void> {
    try {
      const reports = await this.repository.getWithFilters({ commentId });
      const totalReports = reports.length;
      const uniqueReporters = new Set(reports.map((r) => r.reporterId)).size;

      // Get escalation thresholds from constants
      const { REPORTING_CONSTANTS } = await import("../constants");
      const thresholds = REPORTING_CONSTANTS.AUTO_ESCALATION.WHISPER; // Using whisper thresholds for now

      // Check if we should flag for review
      if (totalReports >= thresholds.FLAG_FOR_REVIEW && uniqueReporters >= 3) {
        console.log(
          `🚨 Auto-escalating comment ${commentId} for review (${totalReports} reports)`
        );
        // Update all pending reports to under review
        const pendingReports = reports.filter(
          (r) => r.status === ReportStatus.PENDING
        );
        for (const report of pendingReports) {
          await this.updateStatus(report.id, ReportStatus.UNDER_REVIEW);
        }
      }

      // Check if we should auto-hide
      if (totalReports >= thresholds.AUTO_DELETE && uniqueReporters >= 5) {
        console.log(
          `👁️ Auto-hiding comment ${commentId} (${totalReports} reports)`
        );
        // This would trigger comment hiding logic
        // For now, just log the action
      }

      // Check if we should ban user
      if (
        totalReports >= thresholds.DELETE_AND_TEMP_BAN &&
        uniqueReporters >= 8
      ) {
        console.log(
          `🚫 Auto-banning user for comment ${commentId} (${totalReports} reports)`
        );
        // This would trigger user suspension logic
        // For now, just log the action
      }
    } catch (error) {
      console.error("❌ Error checking automatic escalation:", error);
    }
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    CommentReportService.instance = null;
  }

  /**
   * Destroy singleton instance
   */
  static destroyInstance(): void {
    CommentReportService.instance = null;
  }
}

/**
 * Factory function to get CommentReportService instance
 */
export const getCommentReportService = (): CommentReportService =>
  CommentReportService.getInstance();

/**
 * Factory function to reset CommentReportService instance
 */
export const resetCommentReportService = (): void =>
  CommentReportService.resetInstance();

/**
 * Factory function to destroy CommentReportService instance
 */
export const destroyCommentReportService = (): void =>
  CommentReportService.destroyInstance();
