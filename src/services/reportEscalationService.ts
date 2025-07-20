/**
 * Report Escalation Service
 * Handles automatic escalation based on report count and rules
 */

import {
  Report,
  ReportStatus,
  ReportPriority,
  ReportCategory,
  CommentReport,
} from "../types";
import { ReportRepository } from "../repositories/ReportRepository";
import { FirebaseReportRepository } from "../repositories/FirebaseReportRepository";
import { getWhisperReportService } from "./whisperReportService";
import { getCommentReportService } from "./commentReportService";
import { getReportPriorityService } from "./reportPriorityService";

export interface EscalationThresholds {
  FLAG_FOR_REVIEW: number;
  AUTO_DELETE: number;
  DELETE_AND_TEMP_BAN: number;
  CRITICAL_PRIORITY_THRESHOLD: number;
  UNIQUE_REPORTERS_MIN: number;
}

export interface EscalationResult {
  escalated: boolean;
  reason: string;
  action: string;
  affectedReports: string[];
  timestamp: Date;
}

export interface EscalationStats {
  totalEscalations: number;
  escalationsByType: Record<string, number>;
  averageEscalationTime: number; // in hours
  escalationRate: number; // percentage of reports that were escalated
  mostEscalatedCategories: Array<{
    category: ReportCategory;
    count: number;
    percentage: number;
  }>;
}

export class ReportEscalationService {
  private static instance: ReportEscalationService | null;
  private repository: ReportRepository;
  private whisperReportService = getWhisperReportService();
  private commentReportService = getCommentReportService();
  private priorityService = getReportPriorityService();

  constructor(repository?: ReportRepository) {
    this.repository = repository || new FirebaseReportRepository();
  }

  static getInstance(): ReportEscalationService {
    if (!ReportEscalationService.instance) {
      ReportEscalationService.instance = new ReportEscalationService();
    }
    return ReportEscalationService.instance;
  }

  /**
   * Check for automatic escalation based on report count
   */
  async checkAutomaticEscalation(
    contentId: string,
    contentType: "whisper" | "comment"
  ): Promise<EscalationResult> {
    try {
      const reports = await this.getReportsByContent(contentId, contentType);
      const totalReports = reports.length;
      const uniqueReporters = new Set(reports.map((r) => r.reporterId)).size;

      // Check if we should escalate
      if (
        await this.shouldEscalateContent(
          contentId,
          contentType,
          totalReports,
          uniqueReporters
        )
      ) {
        const escalationResult = await this.performEscalation(
          contentId,
          contentType,
          reports,
          totalReports,
          uniqueReporters
        );

        console.log(
          `🚨 Auto-escalated ${contentType} ${contentId}: ${escalationResult.action}`
        );

        return escalationResult;
      }

      return {
        escalated: false,
        reason: "No escalation threshold met",
        action: "none",
        affectedReports: [],
        timestamp: new Date(),
      };
    } catch (error) {
      console.error("❌ Error checking automatic escalation:", error);
      throw new Error(
        `Failed to check automatic escalation: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Escalate a specific report for immediate review
   */
  async escalateReport(reportId: string): Promise<EscalationResult> {
    try {
      const report = await this.repository.getById(reportId);
      if (!report) {
        throw new Error("Report not found");
      }

      // Update report status to escalated
      await this.repository.update(reportId, {
        status: ReportStatus.ESCALATED,
        updatedAt: new Date(),
      });

      console.log(`🚨 Report ${reportId} escalated for immediate review`);

      return {
        escalated: true,
        reason: "Manual escalation",
        action: "escalated",
        affectedReports: [reportId],
        timestamp: new Date(),
      };
    } catch (error) {
      console.error("❌ Error escalating report:", error);
      throw new Error(
        `Failed to escalate report: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Check for user-level escalation based on multiple violations
   */
  async checkUserLevelEscalation(userId: string): Promise<EscalationResult> {
    try {
      const userReports = await this.repository.getByReporter(userId);
      const resolvedReports = userReports.filter(
        (r) => r.status === ReportStatus.RESOLVED
      );

      // Count reports that led to action (not dismissed)
      const actionReports = resolvedReports.filter(
        (r) => r.resolution?.action !== "dismiss"
      );

      if (actionReports.length >= 3) {
        console.log(
          `🚨 User ${userId} has ${actionReports.length} reports with actions - considering escalation`
        );

        // This would trigger user-level moderation actions
        // For now, just log the escalation
        return {
          escalated: true,
          reason: `User has ${actionReports.length} reports with actions`,
          action: "user_escalation",
          affectedReports: actionReports.map((r) => r.id),
          timestamp: new Date(),
        };
      }

      return {
        escalated: false,
        reason: "User escalation threshold not met",
        action: "none",
        affectedReports: [],
        timestamp: new Date(),
      };
    } catch (error) {
      console.error("❌ Error checking user level escalation:", error);
      throw new Error(
        `Failed to check user level escalation: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get escalation statistics
   */
  async getEscalationStats(): Promise<EscalationStats> {
    try {
      const allReports = await this.repository.getAll();
      const escalatedReports = allReports.filter(
        (r) => r.status === ReportStatus.ESCALATED
      );

      const stats: EscalationStats = {
        totalEscalations: escalatedReports.length,
        escalationsByType: {},
        averageEscalationTime: 0,
        escalationRate: 0,
        mostEscalatedCategories: [],
      };

      // Calculate escalation rate
      if (allReports.length > 0) {
        stats.escalationRate =
          (escalatedReports.length / allReports.length) * 100;
      }

      // Calculate escalations by category
      const categoryCounts = new Map<ReportCategory, number>();
      escalatedReports.forEach((report) => {
        const count = categoryCounts.get(report.category) || 0;
        categoryCounts.set(report.category, count + 1);
      });

      // Convert to array and sort by count
      const categoryArray = Array.from(categoryCounts.entries()).map(
        ([category, count]) => ({
          category,
          count,
          percentage: (count / escalatedReports.length) * 100,
        })
      );

      stats.mostEscalatedCategories = categoryArray.sort(
        (a, b) => b.count - a.count
      );

      // Calculate average escalation time (placeholder)
      stats.averageEscalationTime = 2.5; // Placeholder value

      return stats;
    } catch (error) {
      console.error("❌ Error getting escalation stats:", error);
      throw new Error(
        `Failed to get escalation stats: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get escalation thresholds
   */
  async getEscalationThresholds(): Promise<EscalationThresholds> {
    try {
      // Import constants dynamically to avoid circular dependencies
      const { REPORTING_CONSTANTS } = await import("../constants");

      return {
        FLAG_FOR_REVIEW:
          REPORTING_CONSTANTS.AUTO_ESCALATION.WHISPER.FLAG_FOR_REVIEW,
        AUTO_DELETE: REPORTING_CONSTANTS.AUTO_ESCALATION.WHISPER.AUTO_DELETE,
        DELETE_AND_TEMP_BAN:
          REPORTING_CONSTANTS.AUTO_ESCALATION.WHISPER.DELETE_AND_TEMP_BAN,
        CRITICAL_PRIORITY_THRESHOLD: 1, // Any critical priority report
        UNIQUE_REPORTERS_MIN: 3, // Minimum unique reporters for escalation
      };
    } catch (error) {
      console.error("❌ Error getting escalation thresholds:", error);
      // Return default thresholds
      return {
        FLAG_FOR_REVIEW: 3,
        AUTO_DELETE: 5,
        DELETE_AND_TEMP_BAN: 8,
        CRITICAL_PRIORITY_THRESHOLD: 1,
        UNIQUE_REPORTERS_MIN: 3,
      };
    }
  }

  // Private helper methods

  /**
   * Get reports by content ID and type
   */
  private async getReportsByContent(
    contentId: string,
    contentType: "whisper" | "comment"
  ): Promise<(Report | CommentReport)[]> {
    try {
      if (contentType === "whisper") {
        return await this.whisperReportService.getReportsByWhisper(contentId);
      } else {
        return await this.commentReportService.getReportsByComment(contentId);
      }
    } catch (error) {
      console.error("❌ Error getting reports by content:", error);
      return [];
    }
  }

  /**
   * Check if content should be escalated
   */
  private async shouldEscalateContent(
    contentId: string,
    contentType: "whisper" | "comment",
    totalReports: number,
    uniqueReporters: number
  ): Promise<boolean> {
    try {
      const thresholds = await this.getEscalationThresholds();

      // Check for critical priority reports
      const reports = await this.getReportsByContent(contentId, contentType);
      const hasCriticalPriority = reports.some(
        (r) => r.priority === ReportPriority.CRITICAL
      );

      if (hasCriticalPriority) {
        return true;
      }

      // Check for threshold-based escalation
      if (
        totalReports >= thresholds.FLAG_FOR_REVIEW &&
        uniqueReporters >= thresholds.UNIQUE_REPORTERS_MIN
      ) {
        return true;
      }

      return false;
    } catch (error) {
      console.error("❌ Error checking if content should be escalated:", error);
      return false;
    }
  }

  /**
   * Perform escalation actions
   */
  private async performEscalation(
    contentId: string,
    contentType: "whisper" | "comment",
    reports: (Report | CommentReport)[],
    totalReports: number,
    uniqueReporters: number
  ): Promise<EscalationResult> {
    try {
      const thresholds = await this.getEscalationThresholds();
      const pendingReports = reports.filter(
        (r) => r.status === ReportStatus.PENDING
      );

      let action = "flagged_for_review";
      let reason = `Content flagged for review (${totalReports} reports, ${uniqueReporters} unique reporters)`;

      // Update all pending reports to under review
      for (const report of pendingReports) {
        if (contentType === "whisper") {
          await this.whisperReportService.updateStatus(
            report.id,
            ReportStatus.UNDER_REVIEW
          );
        } else {
          await this.commentReportService.updateStatus(
            report.id,
            ReportStatus.UNDER_REVIEW
          );
        }
      }

      // Check for higher-level escalation
      if (totalReports >= thresholds.AUTO_DELETE && uniqueReporters >= 5) {
        action = "auto_delete";
        reason = `Content auto-deleted (${totalReports} reports, ${uniqueReporters} unique reporters)`;
      }

      if (
        totalReports >= thresholds.DELETE_AND_TEMP_BAN &&
        uniqueReporters >= 8
      ) {
        action = "delete_and_ban";
        reason = `Content deleted and user temporarily banned (${totalReports} reports, ${uniqueReporters} unique reporters)`;
      }

      return {
        escalated: true,
        reason,
        action,
        affectedReports: pendingReports.map((r) => r.id),
        timestamp: new Date(),
      };
    } catch (error) {
      console.error("❌ Error performing escalation:", error);
      throw error;
    }
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    ReportEscalationService.instance = null;
  }

  /**
   * Destroy singleton instance
   */
  static destroyInstance(): void {
    ReportEscalationService.instance = null;
  }
}

/**
 * Factory function to get ReportEscalationService instance
 */
export const getReportEscalationService = (): ReportEscalationService =>
  ReportEscalationService.getInstance();

/**
 * Factory function to reset ReportEscalationService instance
 */
export const resetReportEscalationService = (): void =>
  ReportEscalationService.resetInstance();

/**
 * Factory function to destroy ReportEscalationService instance
 */
export const destroyReportEscalationService = (): void =>
  ReportEscalationService.destroyInstance();
