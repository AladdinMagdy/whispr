import { ReportingService } from "../services/reportingService";
import { getReputationService } from "../services/reputationService";
import { getSuspensionService } from "../services/suspensionService";
import { getFirestoreService } from "../services/firestoreService";
import {
  ReportCategory,
  ReportStatus,
  ReportPriority,
  CommentReport,
} from "../types";
import { ReportRepository } from "../repositories/ReportRepository";

// Mock the services
jest.mock("../services/reputationService");
jest.mock("../services/suspensionService");
jest.mock("../services/firestoreService");

const mockReputationService = {
  getUserReputation: jest.fn(),
  adjustUserReputationScore: jest.fn(),
};

const mockSuspensionService = {
  createSuspension: jest.fn(),
  getUserActiveSuspensions: jest.fn(),
};

const mockFirestoreService = {
  getWhisper: jest.fn(),
  deleteWhisper: jest.fn(),
  getComment: jest.fn(),
  deleteComment: jest.fn(),
};

const mockRepository: jest.Mocked<ReportRepository> = {
  save: jest.fn(),
  getById: jest.fn(),
  getAll: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  getByWhisper: jest.fn(),
  getByReporter: jest.fn(),
  getByStatus: jest.fn(),
  getByCategory: jest.fn(),
  getByPriority: jest.fn(),
  getByDateRange: jest.fn(),
  getWithFilters: jest.fn(),
  getPending: jest.fn(),
  getCritical: jest.fn(),
  getStats: jest.fn(),
  getWhisperStats: jest.fn(),
  saveCommentReport: jest.fn(),
  getCommentReport: jest.fn(),
  getCommentReports: jest.fn(),
  updateCommentReport: jest.fn(),
  updateCommentReportStatus: jest.fn(),
  hasUserReportedComment: jest.fn(),
  getCommentReportStats: jest.fn(),
};

(getReputationService as jest.Mock).mockReturnValue(mockReputationService);
(getSuspensionService as jest.Mock).mockReturnValue(mockSuspensionService);
(getFirestoreService as jest.Mock).mockReturnValue(mockFirestoreService);

describe("Comment Reporting", () => {
  let reportingService: ReportingService;

  beforeEach(() => {
    jest.clearAllMocks();
    ReportingService.resetInstance();

    // Create service with mocked repository
    reportingService = new ReportingService(mockRepository);

    // Set default mocks
    mockRepository.getCommentReports.mockResolvedValue([]);
    mockRepository.saveCommentReport.mockResolvedValue();
    mockRepository.updateCommentReport.mockResolvedValue();
    mockRepository.hasUserReportedComment.mockResolvedValue(false);
    mockFirestoreService.getComment.mockResolvedValue(null);
    mockFirestoreService.deleteComment.mockResolvedValue(undefined);
  });

  afterEach(() => {
    ReportingService.destroyInstance();
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
      mockRepository.getCommentReports.mockResolvedValue([]);
      mockRepository.saveCommentReport.mockResolvedValue();

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
      expect(mockRepository.saveCommentReport).toHaveBeenCalled();
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

      const existingReport: CommentReport = {
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
      mockRepository.getCommentReports.mockResolvedValue([existingReport]);
      mockRepository.updateCommentReport.mockResolvedValue();

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
      expect(mockRepository.updateCommentReport).toHaveBeenCalled();
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
      const existingReport: CommentReport = {
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

      mockRepository.hasUserReportedComment.mockResolvedValue(true);
      mockRepository.getCommentReports.mockResolvedValue([existingReport]);

      const result = await reportingService.hasUserReportedComment(
        "comment123",
        "user123"
      );

      expect(result.hasReported).toBe(true);
      expect(result.existingReport).toBeDefined();
      expect(result.existingReport?.id).toBe("report123");
    });

    it("should return false if user has not reported the comment", async () => {
      mockRepository.hasUserReportedComment.mockResolvedValue(false);

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
          [ReportCategory.SPAM]: 2,
        },
        priorityBreakdown: {
          [ReportPriority.HIGH]: 3,
          [ReportPriority.MEDIUM]: 2,
        },
      };

      mockRepository.getCommentReportStats.mockResolvedValue(mockStats);

      const result = await reportingService.getCommentReportStats("comment123");

      expect(result).toEqual(mockStats);
      expect(result.totalReports).toBe(5);
      expect(result.uniqueReporters).toBe(3);
      expect(result.categories[ReportCategory.HARASSMENT]).toBe(3);
    });
  });
});
