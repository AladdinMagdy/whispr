/**
 * Report Resolution Service
 * Handles report resolution logic and actions
 */

import {
  Report,
  ReportResolution,
  CommentReport,
  CommentReportResolution,
  ReportStatus,
  ReportCategory,
  SuspensionType,
} from "../types";
import { ReportRepository } from "../repositories/ReportRepository";
import { FirebaseReportRepository } from "../repositories/FirebaseReportRepository";
import { getReputationService } from "./reputationService";
import { getSuspensionService } from "./suspensionService";
import { getFirestoreService } from "./firestoreService";

export interface ResolutionAction {
  action: "warn" | "flag" | "reject" | "ban" | "dismiss" | "hide" | "delete";
  reason: string;
  moderatorId: string;
  notes?: string;
  reputationAdjustment?: number;
}

export interface ResolutionResult {
  success: boolean;
  reportId: string;
  action: string;
  message: string;
  timestamp: Date;
  affectedUsers?: string[];
}

export interface ResolutionStats {
  totalResolutions: number;
  resolutionsByAction: Record<string, number>;
  averageResolutionTime: number; // in hours
  resolutionsByCategory: Record<ReportCategory, number>;
  moderatorPerformance: Record<
    string,
    {
      totalResolutions: number;
      averageTime: number;
      accuracy: number; // Percentage of resolutions that weren't appealed
    }
  >;
}

export class ReportResolutionService {
  private static instance: ReportResolutionService | null;
  private repository: ReportRepository;
  private reputationService = getReputationService();
  private suspensionService = getSuspensionService();
  private firestoreService = getFirestoreService();

  constructor(repository?: ReportRepository) {
    this.repository = repository || new FirebaseReportRepository();
  }

  static getInstance(): ReportResolutionService {
    if (!ReportResolutionService.instance) {
      ReportResolutionService.instance = new ReportResolutionService();
    }
    return ReportResolutionService.instance;
  }

  /**
   * Resolve a whisper report with action
   */
  async resolveWhisperReport(
    reportId: string,
    resolution: ReportResolution
  ): Promise<ResolutionResult> {
    try {
      const report = await this.repository.getById(reportId);
      if (!report) {
        throw new Error("Report not found");
      }

      // Update report with resolution
      await this.repository.update(reportId, {
        status: ReportStatus.RESOLVED,
        resolution,
        updatedAt: new Date(),
        reviewedAt: new Date(),
        reviewedBy: resolution.moderatorId,
      });

      // Apply the resolution action to the reported whisper/user
      const result = await this.applyWhisperResolution(report, resolution);

      console.log(
        `✅ Whisper report ${reportId} resolved with action: ${resolution.action}`
      );

      return {
        success: true,
        reportId,
        action: resolution.action,
        message: `Successfully resolved report with action: ${resolution.action}`,
        timestamp: new Date(),
        affectedUsers: result.affectedUsers,
      };
    } catch (error) {
      console.error("❌ Error resolving whisper report:", error);
      throw new Error(
        `Failed to resolve whisper report: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Resolve a comment report with action
   */
  async resolveCommentReport(
    reportId: string,
    resolution: CommentReportResolution
  ): Promise<ResolutionResult> {
    try {
      const report = await this.repository.getCommentReport(reportId);
      if (!report) {
        throw new Error("Comment report not found");
      }

      // Update report with resolution
      await this.repository.updateCommentReport(reportId, {
        status: ReportStatus.RESOLVED,
        resolution,
        updatedAt: new Date(),
        reviewedAt: new Date(),
        reviewedBy: resolution.moderatorId,
      });

      // Apply the resolution action
      const result = await this.applyCommentResolution(report, resolution);

      console.log(
        `✅ Comment report ${reportId} resolved with action: ${resolution.action}`
      );

      return {
        success: true,
        reportId,
        action: resolution.action,
        message: `Successfully resolved comment report with action: ${resolution.action}`,
        timestamp: new Date(),
        affectedUsers: result.affectedUsers,
      };
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
   * Get resolution statistics
   */
  async getResolutionStats(): Promise<ResolutionStats> {
    try {
      const reports = await this.repository.getAll();
      const resolvedReports = reports.filter(
        (r) => r.status === ReportStatus.RESOLVED && r.resolution
      );

      const stats: ResolutionStats = {
        totalResolutions: resolvedReports.length,
        resolutionsByAction: {},
        averageResolutionTime: 0,
        resolutionsByCategory: {} as Record<ReportCategory, number>,
        moderatorPerformance: {},
      };

      // Calculate resolutions by action
      resolvedReports.forEach((report) => {
        const action = report.resolution?.action || "unknown";
        stats.resolutionsByAction[action] =
          (stats.resolutionsByAction[action] || 0) + 1;
      });

      // Calculate resolutions by category
      resolvedReports.forEach((report) => {
        stats.resolutionsByCategory[report.category] =
          (stats.resolutionsByCategory[report.category] || 0) + 1;
      });

      // Calculate average resolution time
      const resolutionTimes = resolvedReports
        .filter((r) => r.reviewedAt && r.createdAt)
        .map((r) => {
          const created = new Date(r.createdAt);
          const resolved = new Date(r.reviewedAt!);
          return (resolved.getTime() - created.getTime()) / (1000 * 60 * 60); // hours
        });

      if (resolutionTimes.length > 0) {
        stats.averageResolutionTime =
          resolutionTimes.reduce((sum, time) => sum + time, 0) /
          resolutionTimes.length;
      }

      // Calculate moderator performance
      const moderatorStats = new Map<
        string,
        {
          totalResolutions: number;
          totalTime: number;
          resolutions: Array<{ time: number; appealed: boolean }>;
        }
      >();

      resolvedReports.forEach((report) => {
        if (report.reviewedBy && report.reviewedAt && report.createdAt) {
          const moderatorId = report.reviewedBy;
          const created = new Date(report.createdAt);
          const resolved = new Date(report.reviewedAt);
          const time =
            (resolved.getTime() - created.getTime()) / (1000 * 60 * 60);

          const existing = moderatorStats.get(moderatorId) || {
            totalResolutions: 0,
            totalTime: 0,
            resolutions: [],
          };

          existing.totalResolutions += 1;
          existing.totalTime += time;
          existing.resolutions.push({ time, appealed: false }); // TODO: Check appeal status

          moderatorStats.set(moderatorId, existing);
        }
      });

      // Convert moderator stats to final format
      moderatorStats.forEach((modStats, moderatorId) => {
        const accuracy =
          modStats.resolutions.filter((r) => !r.appealed).length /
          modStats.resolutions.length;
        stats.moderatorPerformance[moderatorId] = {
          totalResolutions: modStats.totalResolutions,
          averageTime: modStats.totalTime / modStats.totalResolutions,
          accuracy: accuracy * 100,
        };
      });

      return stats;
    } catch (error) {
      console.error("❌ Error getting resolution stats:", error);
      throw new Error(
        `Failed to get resolution stats: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get resolution history for a user
   */
  async getUserResolutionHistory(userId: string): Promise<{
    reportsSubmitted: Report[];
    reportsResolved: Report[];
    averageResolutionTime: number;
    mostCommonAction: string;
  }> {
    try {
      const allReports = await this.repository.getAll();
      const userReports = allReports.filter((r) => r.reporterId === userId);
      const resolvedReports = userReports.filter(
        (r) => r.status === ReportStatus.RESOLVED
      );

      // Calculate average resolution time
      const resolutionTimes = resolvedReports
        .filter((r) => r.reviewedAt && r.createdAt)
        .map((r) => {
          const created = new Date(r.createdAt);
          const resolved = new Date(r.reviewedAt!);
          return (resolved.getTime() - created.getTime()) / (1000 * 60 * 60);
        });

      const averageResolutionTime =
        resolutionTimes.length > 0
          ? resolutionTimes.reduce((sum, time) => sum + time, 0) /
            resolutionTimes.length
          : 0;

      // Find most common action
      const actionCounts = new Map<string, number>();
      resolvedReports.forEach((report) => {
        const action = report.resolution?.action || "unknown";
        actionCounts.set(action, (actionCounts.get(action) || 0) + 1);
      });

      let mostCommonAction = "none";
      let maxCount = 0;
      actionCounts.forEach((count, action) => {
        if (count > maxCount) {
          maxCount = count;
          mostCommonAction = action;
        }
      });

      return {
        reportsSubmitted: userReports,
        reportsResolved: resolvedReports,
        averageResolutionTime,
        mostCommonAction,
      };
    } catch (error) {
      console.error("❌ Error getting user resolution history:", error);
      throw new Error(
        `Failed to get user resolution history: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // Private helper methods

  /**
   * Apply whisper resolution action
   */
  private async applyWhisperResolution(
    report: Report,
    resolution: ReportResolution
  ): Promise<{ affectedUsers: string[] }> {
    const affectedUsers: string[] = [];
    const { action, reason } = resolution;

    try {
      switch (action) {
        case "warn":
          // Send warning to the whisper owner
          await this.sendWarning(report.whisperId, reason);
          affectedUsers.push(report.reporterId);
          break;

        case "flag":
          // Flag the whisper for review
          await this.flagWhisper(report.whisperId, reason);
          break;

        case "reject":
          // Remove the whisper
          await this.rejectWhisper(report.whisperId, reason);
          affectedUsers.push(report.reporterId);
          break;

        case "ban":
          // Ban the user who created the whisper
          await this.banUser(report.whisperId, reason);
          affectedUsers.push(report.reporterId);
          break;

        case "dismiss":
          // No action needed, just dismiss the report
          await this.reputationService.adjustUserReputationScore(
            report.reporterId,
            -10,
            `Report dismissed: ${reason}`
          );
          affectedUsers.push(report.reporterId);
          break;

        default:
          console.warn(`Unknown resolution action: ${action}`);
      }
    } catch (error) {
      console.error("❌ Error applying whisper resolution:", error);
      throw error;
    }

    return { affectedUsers };
  }

  /**
   * Apply comment resolution action
   */
  private async applyCommentResolution(
    report: CommentReport,
    resolution: CommentReportResolution
  ): Promise<{ affectedUsers: string[] }> {
    const affectedUsers: string[] = [];

    try {
      switch (resolution.action) {
        case "hide":
          await this.hideComment(report.commentId, resolution.reason);
          break;
        case "delete":
          await this.deleteComment(report.commentId, resolution.reason);
          affectedUsers.push(report.reporterId);
          break;
        case "dismiss":
          // No action needed for dismissed reports
          console.log("📝 Comment report dismissed:", report.id);
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

    return { affectedUsers };
  }

  /**
   * Send warning to user
   */
  private async sendWarning(whisperId: string, reason: string): Promise<void> {
    try {
      const whisper = await this.firestoreService.getWhisper(whisperId);
      if (whisper) {
        // Create a warning record
        await this.suspensionService.createSuspension({
          userId: whisper.userId,
          reason: `Whisper warning: ${reason}`,
          type: SuspensionType.WARNING,
          moderatorId: "system",
        });
        console.log(
          `⚠️ Warning sent to user ${whisper.userId} for whisper ${whisperId}`
        );
      }
    } catch (error) {
      console.error("❌ Error sending warning:", error);
      throw error;
    }
  }

  /**
   * Flag whisper for review
   */
  private async flagWhisper(whisperId: string, reason: string): Promise<void> {
    try {
      // For now, just log the flag action since FirestoreService doesn't have updateWhisper
      // In a real implementation, this would update the whisper document
      console.log(`🚩 Whisper ${whisperId} flagged for review: ${reason}`);
    } catch (error) {
      console.error("❌ Error flagging whisper:", error);
      throw error;
    }
  }

  /**
   * Reject/delete whisper
   */
  private async rejectWhisper(
    whisperId: string,
    reason: string
  ): Promise<void> {
    try {
      const whisper = await this.firestoreService.getWhisper(whisperId);
      if (whisper) {
        // Delete the whisper
        await this.firestoreService.deleteWhisper(whisperId);

        // Adjust user reputation
        await this.reputationService.adjustUserReputationScore(
          whisper.userId,
          -20,
          `Whisper rejected: ${reason}`
        );

        console.log(`🗑️ Whisper ${whisperId} rejected and deleted`);
      }
    } catch (error) {
      console.error("❌ Error rejecting whisper:", error);
      throw error;
    }
  }

  /**
   * Ban user
   */
  private async banUser(whisperId: string, reason: string): Promise<void> {
    try {
      const whisper = await this.firestoreService.getWhisper(whisperId);
      if (whisper) {
        // Create temporary ban
        await this.suspensionService.createSuspension({
          userId: whisper.userId,
          reason: reason,
          type: SuspensionType.TEMPORARY,
          duration: 7 * 24 * 60 * 60 * 1000, // 7 days
          moderatorId: "system",
        });

        // Delete the whisper
        await this.firestoreService.deleteWhisper(whisperId);

        console.log(`🚫 User ${whisper.userId} banned for 7 days`);
      }
    } catch (error) {
      console.error("❌ Error banning user:", error);
      throw error;
    }
  }

  /**
   * Hide comment
   */
  private async hideComment(commentId: string, reason: string): Promise<void> {
    try {
      // For now, just log the hide action since FirestoreService doesn't have updateComment
      // In a real implementation, this would update the comment document
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
      const comment = await this.firestoreService.getComment(commentId);
      if (comment) {
        // Delete the comment
        await this.firestoreService.deleteComment(commentId, "system");

        // Adjust user reputation
        await this.reputationService.adjustUserReputationScore(
          comment.userId,
          -15,
          `Comment deleted: ${reason}`
        );

        console.log(`🗑️ Comment ${commentId} deleted`);
      }
    } catch (error) {
      console.error("❌ Error deleting comment:", error);
      throw error;
    }
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    ReportResolutionService.instance = null;
  }

  /**
   * Destroy singleton instance
   */
  static destroyInstance(): void {
    ReportResolutionService.instance = null;
  }
}

/**
 * Factory function to get ReportResolutionService instance
 */
export const getReportResolutionService = (): ReportResolutionService =>
  ReportResolutionService.getInstance();

/**
 * Factory function to reset ReportResolutionService instance
 */
export const resetReportResolutionService = (): void =>
  ReportResolutionService.resetInstance();

/**
 * Factory function to destroy ReportResolutionService instance
 */
export const destroyReportResolutionService = (): void =>
  ReportResolutionService.destroyInstance();
