/**
 * Reporting Service
 * Handles user reports with reputation-weighted prioritization
 */

import {
  Report,
  ReportCategory,
  ReportStatus,
  ReportPriority,
  ReportResolution,
  ReportStats,
  ReportFilters,
  UserReputation,
} from "../types";
import { getFirestoreService } from "./firestoreService";
import { getReputationService } from "./reputationService";
import { REPORTING_CONSTANTS } from "../constants";

export interface CreateReportData {
  whisperId: string;
  reporterId: string;
  reporterDisplayName: string;
  category: ReportCategory;
  reason: string;
  evidence?: string;
}

export class ReportingService {
  private static instance: ReportingService | null;
  private firestoreService = getFirestoreService();
  private reputationService = getReputationService();

  // Priority thresholds based on reporter reputation
  private static readonly PRIORITY_THRESHOLDS =
    REPORTING_CONSTANTS.PRIORITY_THRESHOLDS;

  // Reputation weight multipliers
  private static readonly REPUTATION_WEIGHTS =
    REPORTING_CONSTANTS.REPUTATION_WEIGHTS;

  private constructor() {}

  static getInstance(): ReportingService {
    if (!ReportingService.instance) {
      ReportingService.instance = new ReportingService();
    }
    return ReportingService.instance;
  }

  /**
   * Create a new report
   */
  async createReport(data: CreateReportData): Promise<Report> {
    try {
      // Get reporter's reputation
      const reporterReputation = await this.reputationService.getUserReputation(
        data.reporterId
      );

      // Check if user can report (not banned)
      if (reporterReputation.level === "banned") {
        throw new Error("Banned users cannot submit reports");
      }

      // Calculate priority based on reporter reputation and category
      const priority = this.calculatePriority(
        reporterReputation,
        data.category
      );

      // Calculate reputation weight
      const reputationWeight =
        this.calculateReputationWeight(reporterReputation);

      // Create report object
      const report: Report = {
        id: `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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

      // Save to Firestore
      await this.firestoreService.saveReport(report);

      console.log(`📝 Report created: ${report.id} (${priority} priority)`);

      // If critical priority, trigger immediate review
      if (priority === ReportPriority.CRITICAL) {
        await this.escalateReport(report.id);
      }

      return report;
    } catch (error) {
      console.error("❌ Error creating report:", error);
      throw new Error(
        `Failed to create report: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get reports with filtering
   */
  async getReports(filters: ReportFilters = {}): Promise<Report[]> {
    try {
      return await this.firestoreService.getReports(filters);
    } catch (error) {
      console.error("❌ Error getting reports:", error);
      throw new Error(
        `Failed to get reports: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get report by ID
   */
  async getReport(reportId: string): Promise<Report | null> {
    try {
      return await this.firestoreService.getReport(reportId);
    } catch (error) {
      console.error("❌ Error getting report:", error);
      throw new Error(
        `Failed to get report: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Update report status
   */
  async updateReportStatus(
    reportId: string,
    status: ReportStatus,
    moderatorId?: string
  ): Promise<void> {
    try {
      const updates: Partial<Report> = {
        status,
        updatedAt: new Date(),
      };

      if (
        status === ReportStatus.UNDER_REVIEW ||
        status === ReportStatus.RESOLVED
      ) {
        updates.reviewedAt = new Date();
        if (moderatorId) {
          updates.reviewedBy = moderatorId;
        }
      }

      await this.firestoreService.updateReport(reportId, updates);

      console.log(`📝 Report ${reportId} status updated to ${status}`);
    } catch (error) {
      console.error("❌ Error updating report status:", error);
      throw new Error(
        `Failed to update report status: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Resolve a report with action
   */
  async resolveReport(
    reportId: string,
    resolution: ReportResolution
  ): Promise<void> {
    try {
      const updates: Partial<Report> = {
        status: ReportStatus.RESOLVED,
        resolution,
        updatedAt: new Date(),
        reviewedAt: new Date(),
        reviewedBy: resolution.moderatorId,
      };

      await this.firestoreService.updateReport(reportId, updates);

      // Apply the resolution action to the reported whisper/user
      await this.applyResolution(reportId, resolution);

      console.log(
        `✅ Report ${reportId} resolved with action: ${resolution.action}`
      );
    } catch (error) {
      console.error("❌ Error resolving report:", error);
      throw new Error(
        `Failed to resolve report: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get reporting statistics
   */
  async getReportStats(): Promise<ReportStats> {
    try {
      return await this.firestoreService.getReportStats();
    } catch (error) {
      console.error("❌ Error getting report stats:", error);
      throw new Error(
        `Failed to get report stats: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Calculate report priority based on reporter reputation and category
   */
  private calculatePriority(
    reporterReputation: UserReputation,
    category: ReportCategory
  ): ReportPriority {
    const { score } = reporterReputation;
    const { PRIORITY_THRESHOLDS } = ReportingService;

    // Critical violations always get high priority regardless of reporter
    if (category === ReportCategory.MINOR_SAFETY) {
      return ReportPriority.CRITICAL;
    }

    // Hate speech and violence get elevated priority
    if (
      category === ReportCategory.HATE_SPEECH ||
      category === ReportCategory.VIOLENCE
    ) {
      return score >= PRIORITY_THRESHOLDS.HIGH
        ? ReportPriority.HIGH
        : ReportPriority.MEDIUM;
    }

    // Other categories based on reporter reputation
    if (score >= PRIORITY_THRESHOLDS.CRITICAL) {
      return ReportPriority.CRITICAL;
    }
    if (score >= PRIORITY_THRESHOLDS.HIGH) {
      return ReportPriority.HIGH;
    }
    if (score >= PRIORITY_THRESHOLDS.MEDIUM) {
      return ReportPriority.MEDIUM;
    }

    return ReportPriority.LOW;
  }

  /**
   * Calculate reputation weight for the report
   */
  private calculateReputationWeight(
    reporterReputation: UserReputation
  ): number {
    const { REPUTATION_WEIGHTS } = ReportingService;
    return REPUTATION_WEIGHTS[reporterReputation.level] || 1.0;
  }

  /**
   * Escalate a report for immediate review
   */
  private async escalateReport(reportId: string): Promise<void> {
    try {
      await this.updateReportStatus(reportId, ReportStatus.UNDER_REVIEW);
      console.log(`🚨 Report ${reportId} escalated for immediate review`);
    } catch (error) {
      console.error("❌ Error escalating report:", error);
    }
  }

  /**
   * Apply resolution action to the reported content/user
   */
  private async applyResolution(
    reportId: string,
    resolution: ReportResolution
  ): Promise<void> {
    try {
      const report = await this.getReport(reportId);
      if (!report) {
        throw new Error("Report not found");
      }

      const { action, reason } = resolution;

      switch (action) {
        case "warn":
          // Send warning to the whisper owner
          await this.sendWarning(report.whisperId, reason);
          break;

        case "flag":
          // Flag the whisper for review
          await this.flagWhisper(report.whisperId, reason);
          break;

        case "reject":
          // Remove the whisper
          await this.rejectWhisper(report.whisperId, reason);
          break;

        case "ban":
          // Ban the user who created the whisper
          await this.banUser(report.whisperId, reason);
          break;

        case "dismiss":
          // No action needed, just dismiss the report
          await this.firestoreService.adjustUserReputationScore(
            report.reporterId,
            -10,
            `Report dismissed: ${reason}`
          );
          break;

        default:
          console.warn(`Unknown resolution action: ${action}`);
      }
    } catch (error) {
      console.error("❌ Error applying resolution:", error);
      throw error;
    }
  }

  /**
   * Send warning to whisper owner
   */
  private async sendWarning(whisperId: string, reason: string): Promise<void> {
    // TODO: Implement warning system
    console.log(`⚠️ Warning sent for whisper ${whisperId}: ${reason}`);
  }

  /**
   * Flag whisper for review
   */
  private async flagWhisper(whisperId: string, reason: string): Promise<void> {
    // TODO: Implement whisper flagging
    console.log(`🚩 Whisper ${whisperId} flagged: ${reason}`);
  }

  /**
   * Reject/remove whisper
   */
  private async rejectWhisper(
    whisperId: string,
    reason: string
  ): Promise<void> {
    try {
      await this.firestoreService.deleteWhisper(whisperId);
      console.log(`❌ Whisper ${whisperId} rejected: ${reason}`);
    } catch (error) {
      console.error("❌ Error rejecting whisper:", error);
      throw error;
    }
  }

  /**
   * Ban user who created the whisper
   */
  private async banUser(whisperId: string, reason: string): Promise<void> {
    try {
      const whisper = await this.firestoreService.getWhisper(whisperId);
      if (whisper) {
        // Set user reputation to 0 (banned)
        await this.firestoreService.adjustUserReputationScore(
          whisper.userId,
          0,
          `Banned due to report: ${reason}`
        );
        console.log(`🚫 User ${whisper.userId} banned: ${reason}`);
      }
    } catch (error) {
      console.error("❌ Error banning user:", error);
      throw error;
    }
  }

  // Singleton management
  static resetInstance(): void {
    ReportingService.instance = new ReportingService();
  }

  static destroyInstance(): void {
    ReportingService.instance = null;
  }
}

/**
 * Factory function to get ReportingService instance
 */
export const getReportingService = (): ReportingService => {
  return ReportingService.getInstance();
};

/**
 * Reset the ReportingService singleton instance
 */
export const resetReportingService = (): void => {
  ReportingService.resetInstance();
};

/**
 * Destroy the ReportingService singleton instance
 */
export const destroyReportingService = (): void => {
  ReportingService.destroyInstance();
};
