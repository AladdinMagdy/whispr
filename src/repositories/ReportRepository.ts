import { Report, ReportFilters, ReportStats, CommentReport } from "../types";

export interface ReportRepository {
  // Basic CRUD operations
  save(report: Report): Promise<void>;
  getById(id: string): Promise<Report | null>;
  getAll(): Promise<Report[]>;
  update(id: string, updates: Partial<Report>): Promise<void>;
  delete(id: string): Promise<void>;

  // Query methods
  getByWhisper(whisperId: string): Promise<Report[]>;
  getByReporter(reporterId: string): Promise<Report[]>;
  getByStatus(status: string): Promise<Report[]>;
  getByCategory(category: string): Promise<Report[]>;
  getByPriority(priority: string): Promise<Report[]>;
  getByDateRange(startDate: Date, endDate: Date): Promise<Report[]>;
  getWithFilters(filters: ReportFilters): Promise<Report[]>;
  getPending(): Promise<Report[]>;
  getCritical(): Promise<Report[]>;

  // Statistics
  getStats(): Promise<ReportStats>;
  getWhisperStats(whisperId: string): Promise<{
    totalReports: number;
    uniqueReporters: number;
    categories: Record<string, number>;
    priorityBreakdown: Record<string, number>;
  }>;

  // Comment Report methods
  saveCommentReport(report: CommentReport): Promise<void>;
  getCommentReport(reportId: string): Promise<CommentReport | null>;
  getCommentReports(filters: ReportFilters): Promise<CommentReport[]>;
  updateCommentReport(
    reportId: string,
    updates: Partial<CommentReport>
  ): Promise<void>;
  updateCommentReportStatus(
    reportId: string,
    status: string,
    moderatorId?: string
  ): Promise<void>;
  hasUserReportedComment(commentId: string, userId: string): Promise<boolean>;
  getCommentReportStats(commentId: string): Promise<{
    totalReports: number;
    uniqueReporters: number;
    categories: Record<string, number>;
    priorityBreakdown: Record<string, number>;
  }>;
}
