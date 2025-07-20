/**
 * Whisper Report Service
 * Handles whisper-specific report operations
 */

import {
  Report,
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
import { getPrivacyService } from "./privacyService";

export interface CreateWhisperReportData {
  whisperId: string;
  reporterId: string;
  reporterDisplayName: string;
  category: ReportCategory;
  reason: string;
  evidence?: string;
}

export interface WhisperReportFilters extends ReportFilters {
  whisperId?: string;
}

export interface WhisperReportStats {
  totalReports: number;
  uniqueReporters: number;
  categories: Record<ReportCategory, number>;
  priorityBreakdown: Record<ReportPriority, number>;
  statusBreakdown: Record<ReportStatus, number>;
  averagePriority: number;
  escalationRate: number;
}

export class WhisperReportService {
  private static instance: WhisperReportService | null;
  private repository: ReportRepository;
  private priorityService = getReportPriorityService();
  private analyticsService = getReportAnalyticsService();
  private reputationService = getReputationService();
  private privacyService = getPrivacyService();

  constructor(repository?: ReportRepository) {
    this.repository = repository || new FirebaseReportRepository();
  }

  static getInstance(): WhisperReportService {
    if (!WhisperReportService.instance) {
      WhisperReportService.instance = new WhisperReportService();
    }
    return WhisperReportService.instance;
  }

  /**
   * Create a new whisper report
   */
  async createReport(data: CreateWhisperReportData): Promise<Report> {
    try {
      // Get reporter's reputation
      const reporterReputation = await this.reputationService.getUserReputation(
        data.reporterId
      );

      // Check if user can report (not banned)
      if (reporterReputation.level === "banned") {
        throw new Error("Banned users cannot submit reports");
      }

      // Check for existing reports from the same user on the same whisper
      const existingReports = await this.repository.getWithFilters({
        whisperId: data.whisperId,
        reporterId: data.reporterId,
      });

      // If user has already reported this whisper, check if it's a different category
      if (existingReports.length > 0) {
        const existingReport = existingReports[0]; // Get the most recent one

        // If same category, provide feedback but allow the report
        if (existingReport.category === data.category) {
          console.log(
            `📝 User ${data.reporterId} reporting same whisper again with same category: ${data.category}`
          );

          // Update the existing report with new information
          const updatedReport: Report = {
            ...existingReport,
            reason: `${existingReport.reason}\n\n--- Additional Report ---\n${data.reason}`,
            updatedAt: new Date(),
            // Increase priority if this is a repeat report
            priority: this.priorityService.escalatePriority(
              existingReport.priority
            ),
          };

          await this.repository.update(existingReport.id, updatedReport);

          console.log(
            `📝 Updated existing report: ${existingReport.id} with escalated priority`
          );

          return updatedReport;
        } else {
          // Different category - create new report but link to existing one
          console.log(
            `📝 User ${data.reporterId} reporting same whisper with different category: ${existingReport.category} → ${data.category}`
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
      const report: Report = {
        id: `whisper-report-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`,
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
      await this.repository.save(report);

      console.log(
        `📝 Whisper report created: ${report.id} (${priority} priority)`
      );

      // If critical priority, trigger immediate review
      if (priority === ReportPriority.CRITICAL) {
        await this.escalateReport(report.id);
      }

      // Check for automatic escalation based on report count
      await this.checkAutomaticEscalation(data.whisperId);

      return report;
    } catch (error) {
      console.error("❌ Error creating whisper report:", error);
      throw new Error(
        `Failed to create whisper report: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get whisper reports with filtering
   */
  async getReports(filters: WhisperReportFilters = {}): Promise<Report[]> {
    try {
      return await this.repository.getWithFilters(filters);
    } catch (error) {
      console.error("❌ Error getting whisper reports:", error);
      throw new Error(
        `Failed to get whisper reports: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get whisper report by ID
   */
  async getReport(reportId: string): Promise<Report | null> {
    try {
      return await this.repository.getById(reportId);
    } catch (error) {
      console.error("❌ Error getting whisper report:", error);
      throw new Error(
        `Failed to get whisper report: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Update whisper report status
   */
  async updateStatus(
    reportId: string,
    status: ReportStatus,
    moderatorId?: string
  ): Promise<void> {
    try {
      const report = await this.repository.getById(reportId);
      if (!report) {
        throw new Error("Report not found");
      }

      const updatedReport: Report = {
        ...report,
        status,
        updatedAt: new Date(),
        reviewedAt: new Date(),
        reviewedBy: moderatorId,
      };

      await this.repository.update(reportId, updatedReport);

      console.log(`📝 Updated whisper report ${reportId} status to ${status}`);
    } catch (error) {
      console.error("❌ Error updating whisper report status:", error);
      throw new Error(
        `Failed to update whisper report status: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Check if user has reported a whisper
   */
  async hasUserReported(whisperId: string, userId: string): Promise<boolean> {
    try {
      const reports = await this.repository.getWithFilters({
        whisperId,
        reporterId: userId,
      });
      return reports.length > 0;
    } catch (error) {
      console.error("❌ Error checking if user reported whisper:", error);
      return false;
    }
  }

  /**
   * Get whisper report statistics
   */
  async getWhisperStats(whisperId: string): Promise<WhisperReportStats> {
    try {
      const reports = await this.repository.getWithFilters({ whisperId });
      return await this.analyticsService.getWhisperReportStats(
        reports,
        whisperId
      );
    } catch (error) {
      console.error("❌ Error getting whisper report stats:", error);
      throw new Error(
        `Failed to get whisper report stats: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get reports by whisper ID
   */
  async getReportsByWhisper(whisperId: string): Promise<Report[]> {
    try {
      return await this.repository.getWithFilters({ whisperId });
    } catch (error) {
      console.error("❌ Error getting reports by whisper:", error);
      throw new Error(
        `Failed to get reports by whisper: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get reports by reporter ID
   */
  async getReportsByReporter(reporterId: string): Promise<Report[]> {
    try {
      return await this.repository.getWithFilters({ reporterId });
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
   * Delete a whisper report
   */
  async deleteReport(reportId: string): Promise<void> {
    try {
      await this.repository.delete(reportId);
      console.log(`📝 Deleted whisper report: ${reportId}`);
    } catch (error) {
      console.error("❌ Error deleting whisper report:", error);
      throw new Error(
        `Failed to delete whisper report: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Update whisper report
   */
  async updateReport(
    reportId: string,
    updates: Partial<Report>
  ): Promise<void> {
    try {
      await this.repository.update(reportId, {
        ...updates,
        updatedAt: new Date(),
      });
      console.log(`📝 Updated whisper report: ${reportId}`);
    } catch (error) {
      console.error("❌ Error updating whisper report:", error);
      throw new Error(
        `Failed to update whisper report: ${
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
      console.log(`🚨 Escalated whisper report: ${reportId}`);
    } catch (error) {
      console.error("❌ Error escalating whisper report:", error);
    }
  }

  /**
   * Check for automatic escalation based on report count
   */
  private async checkAutomaticEscalation(whisperId: string): Promise<void> {
    try {
      const reports = await this.repository.getWithFilters({ whisperId });
      const totalReports = reports.length;
      const uniqueReporters = new Set(reports.map((r) => r.reporterId)).size;

      // Get escalation thresholds from constants
      const { REPORTING_CONSTANTS } = await import("../constants");
      const thresholds = REPORTING_CONSTANTS.AUTO_ESCALATION.WHISPER;

      // Check if we should flag for review
      if (totalReports >= thresholds.FLAG_FOR_REVIEW && uniqueReporters >= 3) {
        console.log(
          `🚨 Auto-escalating whisper ${whisperId} for review (${totalReports} reports)`
        );
        // Update all pending reports to under review
        const pendingReports = reports.filter(
          (r) => r.status === ReportStatus.PENDING
        );
        for (const report of pendingReports) {
          await this.updateStatus(report.id, ReportStatus.UNDER_REVIEW);
        }
      }

      // Check if we should auto-delete
      if (totalReports >= thresholds.AUTO_DELETE && uniqueReporters >= 5) {
        console.log(
          `🗑️ Auto-deleting whisper ${whisperId} (${totalReports} reports)`
        );
        // This would trigger content deletion logic
        // For now, just log the action
      }

      // Check if we should ban user
      if (
        totalReports >= thresholds.DELETE_AND_TEMP_BAN &&
        uniqueReporters >= 8
      ) {
        console.log(
          `🚫 Auto-banning user for whisper ${whisperId} (${totalReports} reports)`
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
    WhisperReportService.instance = null;
  }

  /**
   * Destroy singleton instance
   */
  static destroyInstance(): void {
    WhisperReportService.instance = null;
  }
}

/**
 * Factory function to get WhisperReportService instance
 */
export const getWhisperReportService = (): WhisperReportService =>
  WhisperReportService.getInstance();

/**
 * Factory function to reset WhisperReportService instance
 */
export const resetWhisperReportService = (): void =>
  WhisperReportService.resetInstance();

/**
 * Factory function to destroy WhisperReportService instance
 */
export const destroyWhisperReportService = (): void =>
  WhisperReportService.destroyInstance();
