import {
  getReportingService,
  ReportingService,
} from "../services/reportingService";
import { getFirestoreService } from "../services/firestoreService";
import { getReputationService } from "../services/reputationService";
import {
  ReportCategory,
  ReportStatus,
  ReportPriority,
  UserReputation,
  Report,
  ReportResolution,
} from "../types";

jest.mock("../services/firestoreService");
jest.mock("../services/reputationService");

const mockFirestoreService = {
  saveReport: jest.fn(),
  getReports: jest.fn(),
  getReport: jest.fn(),
  updateReport: jest.fn(),
  getReportStats: jest.fn(),
  deleteWhisper: jest.fn(),
  getWhisper: jest.fn(),
  adjustUserReputationScore: jest.fn(),
};

const mockReputationService = {
  getUserReputation: jest.fn(),
};

(getFirestoreService as jest.Mock).mockReturnValue(mockFirestoreService);
(getReputationService as jest.Mock).mockReturnValue(mockReputationService);

describe("ReportingService", () => {
  let reportingService: ReportingService;

  beforeEach(() => {
    jest.clearAllMocks();
    ReportingService.resetInstance();
    reportingService = getReportingService();

    // Set default mock for getReports to return empty array
    mockFirestoreService.getReports.mockResolvedValue([]);
  });

  afterEach(() => {
    ReportingService.destroyInstance();
  });

  it("should create a report successfully", async () => {
    const mockUserReputation: UserReputation = {
      userId: "user123",
      score: 85,
      level: "verified",
      totalWhispers: 50,
      approvedWhispers: 48,
      flaggedWhispers: 1,
      rejectedWhispers: 1,
      violationHistory: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockReputationService.getUserReputation.mockResolvedValue(
      mockUserReputation
    );
    mockFirestoreService.saveReport.mockResolvedValue(undefined);

    const result = await reportingService.createReport({
      whisperId: "whisper123",
      reporterId: "user123",
      reporterDisplayName: "Test User",
      category: ReportCategory.HARASSMENT,
      reason: "This whisper contains harassment",
    });

    expect(result).toMatchObject({
      whisperId: "whisper123",
      reporterId: "user123",
      reporterDisplayName: "Test User",
      category: ReportCategory.HARASSMENT,
      reason: "This whisper contains harassment",
      status: ReportStatus.PENDING,
      reporterReputation: 85,
      reputationWeight: 1.5,
    });
    expect(result.id).toMatch(/^report-\d+-[a-z0-9]+$/);
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.updatedAt).toBeInstanceOf(Date);
    expect(mockFirestoreService.saveReport).toHaveBeenCalledWith(result);
  });

  it("should prevent banned users from reporting", async () => {
    const bannedUserReputation: UserReputation = {
      userId: "user123",
      score: 0,
      level: "banned",
      totalWhispers: 10,
      approvedWhispers: 0,
      flaggedWhispers: 0,
      rejectedWhispers: 0,
      violationHistory: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockReputationService.getUserReputation.mockResolvedValue(
      bannedUserReputation
    );
    await expect(
      reportingService.createReport({
        whisperId: "whisper123",
        reporterId: "user123",
        reporterDisplayName: "Test User",
        category: ReportCategory.SPAM,
        reason: "Spam content",
      })
    ).rejects.toThrow("Banned users cannot submit reports");
    expect(mockFirestoreService.saveReport).not.toHaveBeenCalled();
  });

  it("should escalate critical reports immediately", async () => {
    const trustedUserReputation: UserReputation = {
      userId: "user123",
      score: 95,
      level: "trusted",
      totalWhispers: 100,
      approvedWhispers: 99,
      flaggedWhispers: 0,
      rejectedWhispers: 1,
      violationHistory: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockReputationService.getUserReputation.mockResolvedValue(
      trustedUserReputation
    );
    mockFirestoreService.saveReport.mockResolvedValue(undefined);
    mockFirestoreService.updateReport.mockResolvedValue(undefined);

    const result = await reportingService.createReport({
      whisperId: "whisper123",
      reporterId: "user123",
      reporterDisplayName: "Test User",
      category: ReportCategory.MINOR_SAFETY,
      reason: "Minor safety issue",
    });

    expect(result.priority).toBe(ReportPriority.CRITICAL);
    expect(mockFirestoreService.updateReport).toHaveBeenCalledWith(
      result.id,
      expect.objectContaining({ status: ReportStatus.UNDER_REVIEW })
    );
  });

  it("should calculate correct reputation weight for each level", async () => {
    const levels = [
      { level: "trusted", score: 95, expected: 2.0 },
      { level: "verified", score: 80, expected: 1.5 },
      { level: "standard", score: 60, expected: 1.0 },
      { level: "flagged", score: 20, expected: 0.5 },
    ];
    for (const { level, score, expected } of levels) {
      mockReputationService.getUserReputation.mockResolvedValue({
        userId: "user123",
        score,
        level,
        totalWhispers: 10,
        approvedWhispers: 8,
        flaggedWhispers: 1,
        rejectedWhispers: 1,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockFirestoreService.saveReport.mockResolvedValue(undefined);
      const result = await reportingService.createReport({
        whisperId: "whisper123",
        reporterId: "user123",
        reporterDisplayName: "Test User",
        category: ReportCategory.SPAM,
        reason: "Test reason",
      });
      expect(result.reputationWeight).toBe(expected);
    }
  });

  it("should resolve a report with action", async () => {
    const mockReport: Report = {
      id: "report123",
      whisperId: "whisper123",
      reporterId: "user123",
      reporterDisplayName: "Test User",
      reporterReputation: 80,
      category: ReportCategory.HARASSMENT,
      priority: ReportPriority.HIGH,
      status: ReportStatus.PENDING,
      reason: "Test reason",
      createdAt: new Date(),
      updatedAt: new Date(),
      reputationWeight: 1.5,
    };
    const mockResolution: ReportResolution = {
      action: "warn",
      reason: "Violation of community guidelines",
      moderatorId: "moderator123",
      timestamp: new Date(),
    };
    mockFirestoreService.getReport.mockResolvedValue(mockReport);
    mockFirestoreService.updateReport.mockResolvedValue(undefined);
    await reportingService.resolveReport("report123", mockResolution);
    expect(mockFirestoreService.updateReport).toHaveBeenCalledWith(
      "report123",
      expect.objectContaining({
        status: ReportStatus.RESOLVED,
        resolution: mockResolution,
      })
    );
  });
});
