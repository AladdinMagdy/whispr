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
  SuspensionType,
  UserViolation,
  CommentReport,
  CommentReportResolution,
  Whisper,
} from "../types";
import { ReportRepository } from "../repositories/ReportRepository";
import { FirebaseReportRepository } from "../repositories/FirebaseReportRepository";
import { getPrivacyService } from "./privacyService";
import { getReputationService } from "./reputationService";
import { getSuspensionService } from "./suspensionService";
import { getFirestoreService } from "./firestoreService";
import { REPORTING_CONSTANTS, TIME_CONSTANTS } from "../constants";
import { useFeedStore } from "../store/useFeedStore";

export interface CreateReportData {
  whisperId: string;
  commentId?: string; // Optional - for comment reports
  reporterId: string;
  reporterDisplayName: string;
  category: ReportCategory;
  reason: string;
  evidence?: string;
}

export interface CreateCommentReportData {
  commentId: string;
  whisperId: string;
  reporterId: string;
  reporterDisplayName: string;
  category: ReportCategory;
  reason: string;
  evidence?: string;
}

export class ReportingService {
  private static instance: ReportingService | null;
  private repository: ReportRepository;
  private privacyService = getPrivacyService();
  private reputationService = getReputationService();
  private firestoreService = getFirestoreService();

  // Priority thresholds based on reporter reputation
  private static readonly PRIORITY_THRESHOLDS =
    REPORTING_CONSTANTS.PRIORITY_THRESHOLDS;

  // Reputation weight multipliers
  private static readonly REPUTATION_WEIGHTS =
    REPORTING_CONSTANTS.REPUTATION_WEIGHTS;

  constructor(repository?: ReportRepository) {
    this.repository = repository || new FirebaseReportRepository();
  }

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

      // Check for existing reports from the same user on the same content
      const existingReports = await this.repository.getWithFilters({
        whisperId: data.whisperId,
        reporterId: data.reporterId,
      });

      // If user has already reported this content, check if it's a different category
      if (existingReports.length > 0) {
        const existingReport = existingReports[0]; // Get the most recent one

        // If same category, provide feedback but allow the report
        if (existingReport.category === data.category) {
          console.log(
            `📝 User ${data.reporterId} reporting same content again with same category: ${data.category}`
          );

          // Update the existing report with new information
          const updatedReport: Report = {
            ...existingReport,
            reason: `${existingReport.reason}\n\n--- Additional Report ---\n${data.reason}`,
            updatedAt: new Date(),
            // Increase priority if this is a repeat report
            priority: this.escalatePriority(existingReport.priority),
          };

          await this.repository.update(existingReport.id, updatedReport);

          console.log(
            `📝 Updated existing report: ${existingReport.id} with escalated priority`
          );

          return updatedReport;
        } else {
          // Different category - create new report but link to existing one
          console.log(
            `📝 User ${data.reporterId} reporting same content with different category: ${existingReport.category} → ${data.category}`
          );
        }
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

      // Save to repository
      await this.repository.save(report);

      console.log(`📝 Report created: ${report.id} (${priority} priority)`);

      // If critical priority, trigger immediate review
      if (priority === ReportPriority.CRITICAL) {
        await this.escalateReport(report.id);
      }

      // Check for automatic escalation based on report count
      await this.checkAutomaticEscalation(data.whisperId);

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
      return await this.repository.getWithFilters(filters);
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
      return await this.repository.getById(reportId);
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

      await this.repository.update(reportId, updates);

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

      await this.repository.update(reportId, updates);

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
      return await this.repository.getStats();
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
          await this.reputationService.adjustUserReputationScore(
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
      // TODO: Implement whisper deletion through whisper service
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
      const whisper = await this.getWhisper(whisperId);
      if (whisper) {
        // Create permanent suspension
        const suspensionService = getSuspensionService();
        await suspensionService.createSuspension({
          userId: whisper.userId,
          reason: `Banned due to report: ${reason}`,
          type: SuspensionType.PERMANENT,
          moderatorId: "system",
        });

        // Set user reputation to 0 (banned)
        await this.reputationService.adjustUserReputationScore(
          whisper.userId,
          0,
          `Banned due to report: ${reason}`
        );

        // Clear feed cache to ensure banned user's content is immediately hidden
        const { clearCache } = useFeedStore.getState();
        clearCache();

        // Force refresh of all active feeds by triggering a cache invalidation
        // This ensures the banned user's content disappears immediately
        console.log(
          `🚫 User ${whisper.userId} banned and suspended: ${reason}. Feed cache cleared.`
        );
      }
    } catch (error) {
      console.error("❌ Error banning user:", error);
      throw error;
    }
  }

  /**
   * Escalate priority for repeat reports
   */
  private escalatePriority(currentPriority: ReportPriority): ReportPriority {
    switch (currentPriority) {
      case ReportPriority.LOW:
        return ReportPriority.MEDIUM;
      case ReportPriority.MEDIUM:
        return ReportPriority.HIGH;
      case ReportPriority.HIGH:
        return ReportPriority.CRITICAL;
      case ReportPriority.CRITICAL:
        return ReportPriority.CRITICAL; // Already at max
      default:
        return ReportPriority.MEDIUM;
    }
  }

  /**
   * Check if a user has already reported specific content
   */
  async hasUserReportedContent(
    whisperId: string,
    userId: string
  ): Promise<{ hasReported: boolean; existingReport?: Report }> {
    try {
      const existingReports = await this.repository.getWithFilters({
        whisperId,
        reporterId: userId,
      });

      if (existingReports.length > 0) {
        return {
          hasReported: true,
          existingReport: existingReports[0], // Return the most recent report
        };
      }

      return { hasReported: false };
    } catch (error) {
      console.error("❌ Error checking if user has reported content:", error);
      return { hasReported: false };
    }
  }

  /**
   * Get report statistics for a specific whisper
   */
  async getWhisperReportStats(whisperId: string): Promise<{
    totalReports: number;
    uniqueReporters: number;
    categories: Record<ReportCategory, number>;
    priorityBreakdown: Record<ReportPriority, number>;
  }> {
    try {
      return await this.repository.getWhisperStats(whisperId);
    } catch (error) {
      console.error("❌ Error getting whisper report stats:", error);
      return {
        totalReports: 0,
        uniqueReporters: 0,
        categories: {} as Record<ReportCategory, number>,
        priorityBreakdown: {} as Record<ReportPriority, number>,
      };
    }
  }

  /**
   * Get whisper by ID
   */
  private async getWhisper(whisperId: string): Promise<Whisper | null> {
    try {
      return await this.firestoreService.getWhisper(whisperId);
    } catch (error) {
      console.error("❌ Error getting whisper:", error);
      return null;
    }
  }

  /**
   * Check for automatic escalation based on report count
   * New fairer approach: whisper-level actions first, user-level bans only for repeated violations
   */
  private async checkAutomaticEscalation(whisperId: string): Promise<void> {
    try {
      const whisper = await this.getWhisper(whisperId);
      if (!whisper) {
        console.log(
          `⚠️ Whisper ${whisperId} not found for automatic escalation check`
        );
        return;
      }

      // Get all reports for this whisper within the escalation window
      const escalationWindow = new Date();
      escalationWindow.setDate(
        escalationWindow.getDate() -
          REPORTING_CONSTANTS.AUTO_ESCALATION.ESCALATION_WINDOW_DAYS
      );

      const reports = await this.repository.getWithFilters({
        whisperId,
        dateRange: { start: escalationWindow, end: new Date() },
      });

      // Count unique reporters
      const uniqueReporters = new Set(reports.map((r) => r.reporterId)).size;

      console.log(
        `📊 Automatic escalation check for whisper ${whisperId}: ${uniqueReporters} unique reporters`
      );

      // Check if user is already suspended
      const suspensionService = getSuspensionService();
      const activeSuspensions =
        await suspensionService.getUserActiveSuspensions(whisper.userId);

      if (activeSuspensions.length > 0) {
        console.log(
          `⚠️ User ${whisper.userId} already has active suspension: ${activeSuspensions[0].type}`
        );
        return;
      }

      // WHISPER-LEVEL ESCALATION
      let whisperActionTaken = false;

      // Flag whisper for review (5 reports)
      if (
        uniqueReporters >=
          REPORTING_CONSTANTS.AUTO_ESCALATION.WHISPER.FLAG_FOR_REVIEW &&
        uniqueReporters <
          REPORTING_CONSTANTS.AUTO_ESCALATION.WHISPER.AUTO_DELETE
      ) {
        console.log(
          `🚩 Auto-flagging whisper ${whisperId} for review after ${uniqueReporters} reports`
        );

        // Record the violation
        const violation: UserViolation = {
          id: `violation-${Date.now()}-${Math.random()
            .toString(36)
            .substr(2, 9)}`,
          userId: whisper.userId,
          whisperId,
          violationType: "whisper_flagged",
          reason: `Auto-flagged for review: ${uniqueReporters} unique reports`,
          reportCount: uniqueReporters,
          moderatorId: "system",
          createdAt: new Date(),
        };

        await this.privacyService.saveUserViolation(violation);
        whisperActionTaken = true;
      }

      // Auto-delete whisper (15 reports)
      if (
        uniqueReporters >=
          REPORTING_CONSTANTS.AUTO_ESCALATION.WHISPER.AUTO_DELETE &&
        uniqueReporters <
          REPORTING_CONSTANTS.AUTO_ESCALATION.WHISPER.DELETE_AND_TEMP_BAN
      ) {
        console.log(
          `🗑️ Auto-deleting whisper ${whisperId} after ${uniqueReporters} reports`
        );

        // Delete the whisper
        await this.firestoreService.deleteWhisper(whisperId);

        // Record the violation
        const violation: UserViolation = {
          id: `violation-${Date.now()}-${Math.random()
            .toString(36)
            .substr(2, 9)}`,
          userId: whisper.userId,
          whisperId,
          violationType: "whisper_deleted",
          reason: `Auto-deleted: ${uniqueReporters} unique reports`,
          reportCount: uniqueReporters,
          moderatorId: "system",
          createdAt: new Date(),
        };

        await this.privacyService.saveUserViolation(violation);
        whisperActionTaken = true;
      }

      // Delete whisper + temporary ban user (25 reports)
      if (
        uniqueReporters >=
        REPORTING_CONSTANTS.AUTO_ESCALATION.WHISPER.DELETE_AND_TEMP_BAN
      ) {
        console.log(
          `🚫 Auto-deleting whisper ${whisperId} and temporarily banning user ${whisper.userId} after ${uniqueReporters} reports`
        );

        // Delete the whisper
        await this.firestoreService.deleteWhisper(whisperId);

        // Record the violation
        const violation: UserViolation = {
          id: `violation-${Date.now()}-${Math.random()
            .toString(36)
            .substr(2, 9)}`,
          userId: whisper.userId,
          whisperId,
          violationType: "whisper_deleted",
          reason: `Auto-deleted + temp ban: ${uniqueReporters} unique reports`,
          reportCount: uniqueReporters,
          moderatorId: "system",
          createdAt: new Date(),
        };

        await this.privacyService.saveUserViolation(violation);

        // Apply temporary ban
        await suspensionService.createSuspension({
          userId: whisper.userId,
          reason: `Automatic temporary ban: ${uniqueReporters} reports on single whisper`,
          type: SuspensionType.TEMPORARY,
          moderatorId: "system",
          duration: TIME_CONSTANTS.TEMPORARY_SUSPENSION_DURATION,
        });

        whisperActionTaken = true;
      }

      // USER-LEVEL ESCALATION (only if whisper action was taken)
      if (whisperActionTaken) {
        await this.checkUserLevelEscalation(whisper.userId);
      }

      // Clear feed cache if any action was taken
      if (whisperActionTaken) {
        const { clearCache } = useFeedStore.getState();
        clearCache();
      }
    } catch (error) {
      console.error("❌ Error in automatic escalation check:", error);
      // Don't throw - this is a background process that shouldn't break report creation
    }
  }

  /**
   * Check for user-level escalation based on deleted whisper count
   */
  private async checkUserLevelEscalation(userId: string): Promise<void> {
    try {
      // Get user reputation to check current level
      const reputation = await this.reputationService.getUserReputation(userId);

      // Check if user should be escalated based on reputation level
      if (reputation.level === "flagged" && reputation.score < 30) {
        // Create automatic suspension for flagged users with low scores
        const suspensionService = getSuspensionService();
        await suspensionService.createAutomaticSuspension(
          userId,
          3, // violation count
          "Automatic escalation due to low reputation score"
        );

        console.log(
          `🚨 User ${userId} automatically escalated due to low reputation`
        );
      }
    } catch (error) {
      console.error("❌ Error checking user level escalation:", error);
    }
  }

  /**
   * Create a new comment report
   */
  async createCommentReport(
    data: CreateCommentReportData
  ): Promise<CommentReport> {
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
      const existingReports = await this.repository.getCommentReports({
        reporterId: data.reporterId,
      });

      const existingCommentReport = existingReports.find(
        (report) => report.commentId === data.commentId
      );

      // If user has already reported this comment, check if it's a different category
      if (existingCommentReport) {
        // If same category, provide feedback but allow the report
        if (existingCommentReport.category === data.category) {
          console.log(
            `📝 User ${data.reporterId} reporting same comment again with same category: ${data.category}`
          );

          // Update the existing report with new information
          const updatedReport: CommentReport = {
            ...existingCommentReport,
            reason: `${existingCommentReport.reason}\n\n--- Additional Report ---\n${data.reason}`,
            updatedAt: new Date(),
            // Increase priority if this is a repeat report
            priority: this.escalatePriority(existingCommentReport.priority),
          };

          await this.repository.updateCommentReport(
            existingCommentReport.id,
            updatedReport
          );

          console.log(
            `📝 Updated existing comment report: ${existingCommentReport.id} with escalated priority`
          );

          return updatedReport;
        } else {
          // Different category - create new report but link to existing one
          console.log(
            `📝 User ${data.reporterId} reporting same comment with different category: ${existingCommentReport.category} → ${data.category}`
          );
        }
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
        await this.escalateCommentReport(report.id);
      }

      // Check for automatic escalation based on report count
      await this.checkCommentAutomaticEscalation(data.commentId);

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
  async getCommentReports(
    filters: ReportFilters = {}
  ): Promise<CommentReport[]> {
    try {
      return await this.repository.getCommentReports(filters);
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
  async getCommentReport(reportId: string): Promise<CommentReport | null> {
    try {
      return await this.repository.getCommentReport(reportId);
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
  async updateCommentReportStatus(
    reportId: string,
    status: ReportStatus,
    moderatorId?: string
  ): Promise<void> {
    try {
      await this.repository.updateCommentReportStatus(
        reportId,
        status,
        moderatorId
      );
      console.log("✅ Comment report status updated:", reportId, status);
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
   * Resolve comment report with action
   */
  async resolveCommentReport(
    reportId: string,
    resolution: CommentReportResolution
  ): Promise<void> {
    try {
      const report = await this.getCommentReport(reportId);
      if (!report) {
        throw new Error("Comment report not found");
      }

      // Update report with resolution
      await this.updateCommentReport(reportId, {
        status: ReportStatus.RESOLVED,
        resolution,
        reviewedAt: new Date(),
        reviewedBy: resolution.moderatorId,
      });

      // Apply the resolution action
      await this.applyCommentResolution(reportId, resolution);

      console.log("✅ Comment report resolved:", reportId, resolution.action);
    } catch (error) {
      console.error("❌ Error resolving comment report:", error);
      throw new Error(
        `Failed to resolve comment report: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Check if user has reported a comment
   */
  async hasUserReportedComment(
    commentId: string,
    userId: string
  ): Promise<{ hasReported: boolean; existingReport?: CommentReport }> {
    try {
      const hasReported = await this.repository.hasUserReportedComment(
        commentId,
        userId
      );
      if (hasReported) {
        const reports = await this.repository.getCommentReports({
          commentId,
          reporterId: userId,
        });
        return {
          hasReported: true,
          existingReport: reports[0],
        };
      }
      return { hasReported: false };
    } catch (error) {
      console.error("❌ Error checking comment report status:", error);
      return { hasReported: false };
    }
  }

  /**
   * Update a comment report
   */
  async updateCommentReport(
    reportId: string,
    updates: Partial<CommentReport>
  ): Promise<void> {
    try {
      await this.repository.updateCommentReport(reportId, updates);
    } catch (error) {
      console.error("❌ Error updating comment report:", error);
      throw new Error(
        `Failed to update comment report: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get comment report stats for a specific comment
   */
  async getCommentReportStats(commentId: string): Promise<{
    totalReports: number;
    uniqueReporters: number;
    categories: Record<ReportCategory, number>;
    priorityBreakdown: Record<ReportPriority, number>;
  }> {
    try {
      return await this.repository.getCommentReportStats(commentId);
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
   * Private method to escalate comment report
   */
  private async escalateCommentReport(reportId: string): Promise<void> {
    try {
      await this.updateCommentReportStatus(reportId, ReportStatus.ESCALATED);
      console.log("🚨 Comment report escalated:", reportId);
    } catch (error) {
      console.error("❌ Error escalating comment report:", error);
    }
  }

  /**
   * Private method to apply comment resolution
   */
  private async applyCommentResolution(
    reportId: string,
    resolution: CommentReportResolution
  ): Promise<void> {
    try {
      const report = await this.getCommentReport(reportId);
      if (!report) {
        throw new Error("Comment report not found");
      }

      switch (resolution.action) {
        case "hide":
          await this.hideComment(report.commentId, resolution.reason);
          break;
        case "delete":
          await this.deleteComment(report.commentId, resolution.reason);
          break;
        case "dismiss":
          // No action needed for dismissed reports
          console.log("📝 Comment report dismissed:", reportId);
          break;
        default:
          console.warn(
            "⚠️ Unknown comment resolution action:",
            resolution.action
          );
      }
    } catch (error) {
      console.error("❌ Error applying comment resolution:", error);
      throw error;
    }
  }

  /**
   * Hide comment (mark as hidden but don't delete)
   */
  private async hideComment(commentId: string, reason: string): Promise<void> {
    try {
      // For now, we'll just log this action
      // In a full implementation, you might add a 'hidden' field to comments
      console.log(`👁️ Comment ${commentId} hidden: ${reason}`);
    } catch (error) {
      console.error("❌ Error hiding comment:", error);
      throw error;
    }
  }

  /**
   * Delete comment
   */
  private async deleteComment(
    commentId: string,
    reason: string
  ): Promise<void> {
    try {
      // Get the comment to find the whisperId for updating reply count
      const comment = await this.firestoreService.getComment(commentId);
      if (!comment) {
        throw new Error("Comment not found");
      }

      // Delete the comment (this will also update the whisper reply count)
      await this.firestoreService.deleteComment(commentId, "system");

      console.log(`🗑️ Comment ${commentId} deleted: ${reason}`);
    } catch (error) {
      console.error("❌ Error deleting comment:", error);
      throw error;
    }
  }

  /**
   * Check for automatic escalation based on comment report count
   */
  private async checkCommentAutomaticEscalation(
    commentId: string
  ): Promise<void> {
    try {
      const reportStats = await this.getCommentReportStats(commentId);
      const { uniqueReporters } = reportStats;

      // Get the comment to find the whisper owner
      const comment = await this.firestoreService.getComment(commentId);
      if (!comment) {
        console.log("Comment not found for escalation check:", commentId);
        return;
      }

      let commentActionTaken = false;

      // Hide comment after 3 reports
      if (uniqueReporters >= 3 && uniqueReporters < 5) {
        console.log(
          `👁️ Auto-hiding comment ${commentId} after ${uniqueReporters} reports`
        );
        await this.hideComment(
          commentId,
          `Auto-hidden: ${uniqueReporters} unique reports`
        );
        commentActionTaken = true;
      }

      // Delete comment after 5 reports
      if (uniqueReporters >= 5) {
        console.log(
          `🗑️ Auto-deleting comment ${commentId} after ${uniqueReporters} reports`
        );
        await this.deleteComment(
          commentId,
          `Auto-deleted: ${uniqueReporters} unique reports`
        );
        commentActionTaken = true;
      }

      // Clear feed cache if any action was taken
      if (commentActionTaken) {
        const { clearCache } = useFeedStore.getState();
        clearCache();
      }
    } catch (error) {
      console.error("❌ Error in comment automatic escalation check:", error);
      // Don't throw - this is a background process that shouldn't break report creation
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
