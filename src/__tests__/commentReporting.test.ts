import { getReportingService } from "../services/reportingService";
import { getFirestoreService } from "../services/firestoreService";
import { getReputationService } from "../services/reputationService";
import { ReportCategory, ReportStatus, ReportPriority } from "../types";

// Mock the services
jest.mock("../services/firestoreService");
jest.mock("../services/reputationService");

const mockFirestoreService = {
  saveCommentReport: jest.fn(),
  getCommentReports: jest.fn(),
  getCommentReport: jest.fn(),
  updateCommentReportStatus: jest.fn(),
  updateCommentReport: jest.fn(),
  hasUserReportedComment: jest.fn(),
  getCommentReportStats: jest.fn(),
  getComment: jest.fn(),
  deleteComment: jest.fn(),
};

const mockReputationService = {
  getUserReputation: jest.fn(),
};

(getFirestoreService as jest.Mock).mockReturnValue(mockFirestoreService);
(getReputationService as jest.Mock).mockReturnValue(mockReputationService);

describe("Comment Reporting", () => {
  let reportingService: ReturnType<typeof getReportingService>;

  beforeEach(() => {
    jest.clearAllMocks();
    reportingService = getReportingService();
  });

  describe("createCommentReport", () => {
    it("should create a comment report successfully", async () => {
      const mockReputation = {
        userId: "user123",
        score: 75,
        level: "verified" as const,
        totalWhispers: 10,
        approvedWhispers: 8,
        flaggedWhispers: 1,
        rejectedWhispers: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        violationHistory: [],
      };

      mockReputationService.getUserReputation.mockResolvedValue(mockReputation);
      mockFirestoreService.getCommentReports.mockResolvedValue([]);
      mockFirestoreService.saveCommentReport.mockResolvedValue(undefined);

      const reportData = {
        commentId: "comment123",
        whisperId: "whisper123",
        reporterId: "user123",
        reporterDisplayName: "Test User",
        category: ReportCategory.HARASSMENT,
        reason: "This comment is harassing",
      };

      const result = await reportingService.createCommentReport(reportData);

      expect(result).toBeDefined();
      expect(result.commentId).toBe("comment123");
      expect(result.category).toBe(ReportCategory.HARASSMENT);
      expect(result.priority).toBe(ReportPriority.HIGH); // Verified user gets high priority
      expect(result.status).toBe(ReportStatus.PENDING);
      expect(mockFirestoreService.saveCommentReport).toHaveBeenCalled();
    });

    it("should update existing report if same user reports same comment with same category", async () => {
      const mockReputation = {
        userId: "user123",
        score: 50,
        level: "standard" as const,
        totalWhispers: 5,
        approvedWhispers: 4,
        flaggedWhispers: 1,
        rejectedWhispers: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        violationHistory: [],
      };

      const existingReport = {
        id: "report123",
        commentId: "comment123",
        whisperId: "whisper123",
        reporterId: "user123",
        reporterDisplayName: "Test User",
        reporterReputation: 50,
        category: ReportCategory.HARASSMENT,
        priority: ReportPriority.MEDIUM,
        status: ReportStatus.PENDING,
        reason: "Original report",
        createdAt: new Date(),
        updatedAt: new Date(),
        reputationWeight: 1.0,
      };

      mockReputationService.getUserReputation.mockResolvedValue(mockReputation);
      mockFirestoreService.getCommentReports.mockResolvedValue([
        existingReport,
      ]);
      mockFirestoreService.updateCommentReport.mockResolvedValue(undefined);

      const reportData = {
        commentId: "comment123",
        whisperId: "whisper123",
        reporterId: "user123",
        reporterDisplayName: "Test User",
        category: ReportCategory.HARASSMENT,
        reason: "Additional harassment evidence",
      };

      const result = await reportingService.createCommentReport(reportData);

      expect(result).toBeDefined();
      expect(result.id).toBe("report123");
      expect(result.reason).toContain("Original report");
      expect(result.reason).toContain("Additional harassment evidence");
      expect(result.priority).toBe(ReportPriority.HIGH); // Escalated priority
      expect(mockFirestoreService.updateCommentReport).toHaveBeenCalled();
    });

    it("should throw error if banned user tries to report", async () => {
      const mockReputation = {
        userId: "user123",
        score: 0,
        level: "banned" as const,
        totalWhispers: 10,
        approvedWhispers: 0,
        flaggedWhispers: 10,
        rejectedWhispers: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        violationHistory: [],
      };

      mockReputationService.getUserReputation.mockResolvedValue(mockReputation);

      const reportData = {
        commentId: "comment123",
        whisperId: "whisper123",
        reporterId: "user123",
        reporterDisplayName: "Banned User",
        category: ReportCategory.HARASSMENT,
        reason: "This comment is harassing",
      };

      await expect(
        reportingService.createCommentReport(reportData)
      ).rejects.toThrow("Banned users cannot submit reports");
    });
  });

  describe("hasUserReportedComment", () => {
    it("should return true if user has reported the comment", async () => {
      const existingReport = {
        id: "report123",
        commentId: "comment123",
        whisperId: "whisper123",
        reporterId: "user123",
        reporterDisplayName: "Test User",
        reporterReputation: 50,
        category: ReportCategory.HARASSMENT,
        priority: ReportPriority.MEDIUM,
        status: ReportStatus.PENDING,
        reason: "Original report",
        createdAt: new Date(),
        updatedAt: new Date(),
        reputationWeight: 1.0,
      };

      mockFirestoreService.hasUserReportedComment.mockResolvedValue({
        hasReported: true,
        existingReport,
      });

      const result = await reportingService.hasUserReportedComment(
        "comment123",
        "user123"
      );

      expect(result.hasReported).toBe(true);
      expect(result.existingReport).toBeDefined();
      expect(result.existingReport?.id).toBe("report123");
    });

    it("should return false if user has not reported the comment", async () => {
      mockFirestoreService.hasUserReportedComment.mockResolvedValue({
        hasReported: false,
      });

      const result = await reportingService.hasUserReportedComment(
        "comment123",
        "user123"
      );

      expect(result.hasReported).toBe(false);
      expect(result.existingReport).toBeUndefined();
    });
  });

  describe("getCommentReportStats", () => {
    it("should return comment report statistics", async () => {
      const mockStats = {
        totalReports: 5,
        uniqueReporters: 3,
        categories: {
          [ReportCategory.HARASSMENT]: 3,
          [ReportCategory.HATE_SPEECH]: 1,
          [ReportCategory.SPAM]: 1,
          [ReportCategory.VIOLENCE]: 0,
          [ReportCategory.SEXUAL_CONTENT]: 0,
          [ReportCategory.SCAM]: 0,
          [ReportCategory.COPYRIGHT]: 0,
          [ReportCategory.PERSONAL_INFO]: 0,
          [ReportCategory.MINOR_SAFETY]: 0,
          [ReportCategory.OTHER]: 0,
        },
        priorityBreakdown: {
          [ReportPriority.LOW]: 1,
          [ReportPriority.MEDIUM]: 2,
          [ReportPriority.HIGH]: 2,
          [ReportPriority.CRITICAL]: 0,
        },
      };

      mockFirestoreService.getCommentReportStats.mockResolvedValue(mockStats);

      const result = await reportingService.getCommentReportStats("comment123");

      expect(result.totalReports).toBe(5);
      expect(result.uniqueReporters).toBe(3);
      expect(result.categories[ReportCategory.HARASSMENT]).toBe(3);
      expect(result.priorityBreakdown[ReportPriority.HIGH]).toBe(2);
    });
  });
});
