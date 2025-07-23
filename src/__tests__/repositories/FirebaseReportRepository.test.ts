import { FirebaseReportRepository } from "../../repositories/FirebaseReportRepository";
import {
  Report,
  CommentReport,
  ReportCategory,
  ReportPriority,
  ReportStatus,
} from "../../types";

// Mock the firebase config
jest.mock("../../config/firebase", () => ({
  getFirestoreInstance: jest.fn(() => ({})),
}));

// Mock firebase/firestore with comprehensive mocking
jest.mock("firebase/firestore", () => {
  const mockFirestore = {
    collection: jest.fn(),
    doc: jest.fn(),
    getDoc: jest.fn(),
    getDocs: jest.fn(),
    setDoc: jest.fn(),
    updateDoc: jest.fn(),
    deleteDoc: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    Timestamp: {
      fromDate: jest.fn((date) => ({
        toDate: () => date,
        seconds: Math.floor(date.getTime() / 1000),
        nanoseconds: (date.getTime() % 1000) * 1000000,
      })),
    },
  };

  return mockFirestore;
});

describe("FirebaseReportRepository", () => {
  let repository: FirebaseReportRepository;
  let mockFirestore: any;

  const mockReport: Report = {
    id: "report-1",
    whisperId: "whisper-1",
    reporterId: "user-1",
    reporterDisplayName: "Reporter User",
    reporterReputation: 85,
    category: ReportCategory.HARASSMENT,
    priority: ReportPriority.HIGH,
    status: ReportStatus.PENDING,
    reason: "Inappropriate content",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    reputationWeight: 1.2,
  };

  const mockCommentReport: CommentReport = {
    id: "comment-report-1",
    commentId: "comment-1",
    whisperId: "whisper-1",
    reporterId: "user-1",
    reporterDisplayName: "Reporter User",
    reporterReputation: 85,
    category: ReportCategory.HARASSMENT,
    priority: ReportPriority.HIGH,
    status: ReportStatus.PENDING,
    reason: "Inappropriate comment",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    reputationWeight: 1.2,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new FirebaseReportRepository();

    // Get the mocked firestore instance
    const { getFirestoreInstance } = jest.requireMock("../../config/firebase");
    mockFirestore = getFirestoreInstance();
  });

  describe("Basic CRUD Operations", () => {
    it("should save a report successfully", async () => {
      const { updateDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "report-1" };

      doc.mockReturnValue(mockDocRef);
      updateDoc.mockResolvedValue(undefined);

      await repository.save(mockReport);

      expect(doc).toHaveBeenCalledWith(mockFirestore, "reports", "report-1");
      expect(updateDoc).toHaveBeenCalledWith(
        mockDocRef,
        expect.objectContaining({
          id: "report-1",
          whisperId: "whisper-1",
          reporterId: "user-1",
          category: ReportCategory.HARASSMENT,
          priority: ReportPriority.HIGH,
          status: ReportStatus.PENDING,
        })
      );
    });

    it("should get report by ID successfully", async () => {
      const { getDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "report-1" };
      const mockDocSnap = {
        id: "report-1",
        exists: () => true,
        data: () => ({
          whisperId: "whisper-1",
          reporterId: "user-1",
          reporterDisplayName: "Reporter User",
          reporterReputation: 85,
          category: ReportCategory.HARASSMENT,
          priority: ReportPriority.HIGH,
          status: ReportStatus.PENDING,
          reason: "Inappropriate content",
          createdAt: { toDate: () => new Date("2024-01-01") },
          updatedAt: { toDate: () => new Date("2024-01-01") },
          reputationWeight: 1.2,
        }),
      };

      doc.mockReturnValue(mockDocRef);
      getDoc.mockResolvedValue(mockDocSnap);

      const result = await repository.getById("report-1");

      expect(doc).toHaveBeenCalledWith(mockFirestore, "reports", "report-1");
      expect(getDoc).toHaveBeenCalledWith(mockDocRef);
      expect(result).toEqual(mockReport);
    });

    it("should return null when report does not exist", async () => {
      const { getDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "report-1" };
      const mockDocSnap = {
        exists: () => false,
      };

      doc.mockReturnValue(mockDocRef);
      getDoc.mockResolvedValue(mockDocSnap);

      const result = await repository.getById("report-1");

      expect(result).toBeNull();
    });

    it("should get all reports successfully", async () => {
      const { getDocs, query, collection, orderBy } =
        jest.requireMock("firebase/firestore");
      const mockQuerySnapshot = {
        docs: [
          {
            id: "report-1",
            data: () => ({
              whisperId: "whisper-1",
              reporterId: "user-1",
              reporterDisplayName: "Reporter User",
              reporterReputation: 85,
              category: ReportCategory.HARASSMENT,
              priority: ReportPriority.HIGH,
              status: ReportStatus.PENDING,
              reason: "Inappropriate content",
              createdAt: { toDate: () => new Date("2024-01-01") },
              updatedAt: { toDate: () => new Date("2024-01-01") },
              reputationWeight: 1.2,
            }),
          },
        ],
      };

      query.mockReturnValue({});
      collection.mockReturnValue({});
      orderBy.mockReturnValue({});
      getDocs.mockResolvedValue(mockQuerySnapshot);

      const result = await repository.getAll();

      expect(collection).toHaveBeenCalledWith(mockFirestore, "reports");
      expect(orderBy).toHaveBeenCalledWith("createdAt", "desc");
      expect(result).toEqual([mockReport]);
    });

    it("should update report successfully", async () => {
      const { updateDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "report-1" };

      doc.mockReturnValue(mockDocRef);
      updateDoc.mockResolvedValue(undefined);

      const updates = {
        status: ReportStatus.RESOLVED,
        reason: "Updated reason",
      };

      await repository.update("report-1", updates);

      expect(doc).toHaveBeenCalledWith(mockFirestore, "reports", "report-1");
      expect(updateDoc).toHaveBeenCalledWith(
        mockDocRef,
        expect.objectContaining({
          status: ReportStatus.RESOLVED,
          reason: "Updated reason",
          updatedAt: expect.any(Object),
        })
      );
    });

    it("should delete report successfully", async () => {
      const { deleteDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "report-1" };

      doc.mockReturnValue(mockDocRef);
      deleteDoc.mockResolvedValue(undefined);

      await repository.delete("report-1");

      expect(doc).toHaveBeenCalledWith(mockFirestore, "reports", "report-1");
      expect(deleteDoc).toHaveBeenCalledWith(mockDocRef);
    });
  });

  describe("Query Methods", () => {
    it("should get reports by whisper ID", async () => {
      const { query, collection, where, orderBy, getDocs } =
        jest.requireMock("firebase/firestore");
      const mockQuerySnapshot = {
        docs: [
          {
            id: "report-1",
            data: () => ({
              id: "report-1",
              whisperId: "whisper-1",
              reporterId: "user-1",
              category: "harassment",
              priority: "high",
              status: "pending",
              createdAt: { toDate: () => new Date("2024-01-01") },
              updatedAt: { toDate: () => new Date("2024-01-01") },
            }),
          },
        ],
      };

      query.mockReturnValue({});
      collection.mockReturnValue({});
      where.mockReturnValue({});
      orderBy.mockReturnValue({});
      getDocs.mockResolvedValue(mockQuerySnapshot);

      const result = await repository.getByWhisper("whisper-1");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("report-1");
      expect(query).toHaveBeenCalled();
      expect(where).toHaveBeenCalledWith("whisperId", "==", "whisper-1");
    });

    it("should get reports by reporter ID", async () => {
      const { query, collection, where, orderBy, getDocs } =
        jest.requireMock("firebase/firestore");
      const mockQuerySnapshot = {
        docs: [
          {
            id: "report-1",
            data: () => ({
              id: "report-1",
              whisperId: "whisper-1",
              reporterId: "user-1",
              category: "harassment",
              priority: "high",
              status: "pending",
              createdAt: { toDate: () => new Date("2024-01-01") },
              updatedAt: { toDate: () => new Date("2024-01-01") },
            }),
          },
        ],
      };

      query.mockReturnValue({});
      collection.mockReturnValue({});
      where.mockReturnValue({});
      orderBy.mockReturnValue({});
      getDocs.mockResolvedValue(mockQuerySnapshot);

      const result = await repository.getByReporter("user-1");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("report-1");
      expect(query).toHaveBeenCalled();
      expect(where).toHaveBeenCalledWith("reporterId", "==", "user-1");
    });

    it("should get reports by status", async () => {
      const { query, collection, where, orderBy, getDocs } =
        jest.requireMock("firebase/firestore");
      const mockQuerySnapshot = {
        docs: [
          {
            id: "report-1",
            data: () => ({
              id: "report-1",
              whisperId: "whisper-1",
              reporterId: "user-1",
              category: "harassment",
              priority: "high",
              status: "pending",
              createdAt: { toDate: () => new Date("2024-01-01") },
              updatedAt: { toDate: () => new Date("2024-01-01") },
            }),
          },
        ],
      };

      query.mockReturnValue({});
      collection.mockReturnValue({});
      where.mockReturnValue({});
      orderBy.mockReturnValue({});
      getDocs.mockResolvedValue(mockQuerySnapshot);

      const result = await repository.getByStatus("pending");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("report-1");
      expect(query).toHaveBeenCalled();
      expect(where).toHaveBeenCalledWith("status", "==", "pending");
    });

    it("should get reports by category", async () => {
      const { query, collection, where, orderBy, getDocs } =
        jest.requireMock("firebase/firestore");
      const mockQuerySnapshot = {
        docs: [
          {
            id: "report-1",
            data: () => ({
              id: "report-1",
              whisperId: "whisper-1",
              reporterId: "user-1",
              category: "harassment",
              priority: "high",
              status: "pending",
              createdAt: { toDate: () => new Date("2024-01-01") },
              updatedAt: { toDate: () => new Date("2024-01-01") },
            }),
          },
        ],
      };

      query.mockReturnValue({});
      collection.mockReturnValue({});
      where.mockReturnValue({});
      orderBy.mockReturnValue({});
      getDocs.mockResolvedValue(mockQuerySnapshot);

      const result = await repository.getByCategory("harassment");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("report-1");
      expect(query).toHaveBeenCalled();
      expect(where).toHaveBeenCalledWith("category", "==", "harassment");
    });

    it("should get reports by priority", async () => {
      const { query, collection, where, orderBy, getDocs } =
        jest.requireMock("firebase/firestore");
      const mockQuerySnapshot = {
        docs: [
          {
            id: "report-1",
            data: () => ({
              id: "report-1",
              whisperId: "whisper-1",
              reporterId: "user-1",
              category: "harassment",
              priority: "high",
              status: "pending",
              createdAt: { toDate: () => new Date("2024-01-01") },
              updatedAt: { toDate: () => new Date("2024-01-01") },
            }),
          },
        ],
      };

      query.mockReturnValue({});
      collection.mockReturnValue({});
      where.mockReturnValue({});
      orderBy.mockReturnValue({});
      getDocs.mockResolvedValue(mockQuerySnapshot);

      const result = await repository.getByPriority("high");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("report-1");
      expect(query).toHaveBeenCalled();
      expect(where).toHaveBeenCalledWith("priority", "==", "high");
    });

    it("should get reports by date range", async () => {
      const { query, collection, where, orderBy, getDocs } =
        jest.requireMock("firebase/firestore");
      const mockQuerySnapshot = {
        docs: [
          {
            id: "report-1",
            data: () => ({
              id: "report-1",
              whisperId: "whisper-1",
              reporterId: "user-1",
              category: "harassment",
              priority: "high",
              status: "pending",
              createdAt: { toDate: () => new Date("2024-01-01") },
              updatedAt: { toDate: () => new Date("2024-01-01") },
            }),
          },
        ],
      };

      query.mockReturnValue({});
      collection.mockReturnValue({});
      where.mockReturnValue({});
      orderBy.mockReturnValue({});
      getDocs.mockResolvedValue(mockQuerySnapshot);

      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");
      const result = await repository.getByDateRange(startDate, endDate);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("report-1");
      expect(query).toHaveBeenCalled();
      expect(where).toHaveBeenCalledWith("createdAt", ">=", expect.any(Object));
      expect(where).toHaveBeenCalledWith("createdAt", "<=", expect.any(Object));
    });

    it("should get reports with filters", async () => {
      const { query, collection, where, orderBy, getDocs } =
        jest.requireMock("firebase/firestore");
      const mockQuerySnapshot = {
        docs: [
          {
            id: "report-1",
            data: () => ({
              id: "report-1",
              whisperId: "whisper-1",
              reporterId: "user-1",
              category: "harassment",
              priority: "high",
              status: "pending",
              createdAt: { toDate: () => new Date("2024-01-01") },
              updatedAt: { toDate: () => new Date("2024-01-01") },
            }),
          },
        ],
      };

      query.mockReturnValue({});
      collection.mockReturnValue({});
      where.mockReturnValue({});
      orderBy.mockReturnValue({});
      getDocs.mockResolvedValue(mockQuerySnapshot);

      const filters = {
        whisperId: "whisper-1",
        status: ReportStatus.PENDING,
        category: ReportCategory.HARASSMENT,
      };
      const result = await repository.getWithFilters(filters);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("report-1");
      expect(query).toHaveBeenCalled();
    });

    it("should get pending reports", async () => {
      const { query, collection, where, orderBy, getDocs } =
        jest.requireMock("firebase/firestore");
      const mockQuerySnapshot = {
        docs: [
          {
            id: "report-1",
            data: () => ({
              id: "report-1",
              whisperId: "whisper-1",
              reporterId: "user-1",
              category: "harassment",
              priority: "high",
              status: "pending",
              createdAt: { toDate: () => new Date("2024-01-01") },
              updatedAt: { toDate: () => new Date("2024-01-01") },
            }),
          },
        ],
      };

      query.mockReturnValue({});
      collection.mockReturnValue({});
      where.mockReturnValue({});
      orderBy.mockReturnValue({});
      getDocs.mockResolvedValue(mockQuerySnapshot);

      const result = await repository.getPending();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("report-1");
      expect(query).toHaveBeenCalled();
      expect(where).toHaveBeenCalledWith("status", "==", "pending");
    });

    it("should get critical reports", async () => {
      const { query, collection, where, orderBy, getDocs } =
        jest.requireMock("firebase/firestore");
      const mockQuerySnapshot = {
        docs: [
          {
            id: "report-1",
            data: () => ({
              id: "report-1",
              whisperId: "whisper-1",
              reporterId: "user-1",
              category: "harassment",
              priority: "critical",
              status: "pending",
              createdAt: { toDate: () => new Date("2024-01-01") },
              updatedAt: { toDate: () => new Date("2024-01-01") },
            }),
          },
        ],
      };

      query.mockReturnValue({});
      collection.mockReturnValue({});
      where.mockReturnValue({});
      orderBy.mockReturnValue({});
      getDocs.mockResolvedValue(mockQuerySnapshot);

      const result = await repository.getCritical();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("report-1");
      expect(query).toHaveBeenCalled();
      expect(where).toHaveBeenCalledWith("priority", "==", "critical");
    });
  });

  describe("Statistics Methods", () => {
    it("should get report stats", async () => {
      const { query, collection, orderBy, getDocs } =
        jest.requireMock("firebase/firestore");
      const mockQuerySnapshot = {
        docs: [
          {
            id: "report-1",
            data: () => ({
              id: "report-1",
              whisperId: "whisper-1",
              reporterId: "user-1",
              category: "harassment",
              priority: "high",
              status: "pending",
              createdAt: { toDate: () => new Date("2024-01-01") },
              updatedAt: { toDate: () => new Date("2024-01-01") },
            }),
          },
          {
            id: "report-2",
            data: () => ({
              id: "report-2",
              whisperId: "whisper-2",
              reporterId: "user-2",
              category: "spam",
              priority: "medium",
              status: "resolved",
              createdAt: { toDate: () => new Date("2024-01-02") },
              updatedAt: { toDate: () => new Date("2024-01-02") },
            }),
          },
        ],
      };

      query.mockReturnValue({});
      collection.mockReturnValue({});
      orderBy.mockReturnValue({});
      getDocs.mockResolvedValue(mockQuerySnapshot);

      const result = await repository.getStats();

      expect(result).toBeDefined();
      expect(result.totalReports).toBe(2);
      expect(result.pendingReports).toBe(1);
      expect(result.resolvedReports).toBe(1);
      expect(query).toHaveBeenCalled();
    });

    it("should get whisper stats", async () => {
      const { query, collection, where, orderBy, getDocs } =
        jest.requireMock("firebase/firestore");
      const mockQuerySnapshot = {
        docs: [
          {
            id: "report-1",
            data: () => ({
              id: "report-1",
              whisperId: "whisper-1",
              reporterId: "user-1",
              category: "harassment",
              priority: "high",
              status: "pending",
              createdAt: { toDate: () => new Date("2024-01-01") },
              updatedAt: { toDate: () => new Date("2024-01-01") },
            }),
          },
          {
            id: "report-2",
            data: () => ({
              id: "report-2",
              whisperId: "whisper-1",
              reporterId: "user-2",
              category: "spam",
              priority: "medium",
              status: "pending",
              createdAt: { toDate: () => new Date("2024-01-02") },
              updatedAt: { toDate: () => new Date("2024-01-02") },
            }),
          },
        ],
      };

      query.mockReturnValue({});
      collection.mockReturnValue({});
      where.mockReturnValue({});
      orderBy.mockReturnValue({});
      getDocs.mockResolvedValue(mockQuerySnapshot);

      const result = await repository.getWhisperStats("whisper-1");

      expect(result).toBeDefined();
      expect(result.totalReports).toBe(2);
      expect(result.uniqueReporters).toBe(2);
      expect(result.categories).toBeDefined();
      expect(result.priorityBreakdown).toBeDefined();
      expect(query).toHaveBeenCalled();
      expect(where).toHaveBeenCalledWith("whisperId", "==", "whisper-1");
    });
  });

  describe("Comment Report Operations", () => {
    it("should save comment report successfully", async () => {
      const { updateDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "comment-report-1" };

      doc.mockReturnValue(mockDocRef);
      updateDoc.mockResolvedValue(undefined);

      await repository.saveCommentReport(mockCommentReport);

      expect(doc).toHaveBeenCalledWith(
        mockFirestore,
        "reports",
        "comment-report-1"
      );
      expect(updateDoc).toHaveBeenCalledWith(
        mockDocRef,
        expect.objectContaining({
          id: "comment-report-1",
          commentId: "comment-1",
          whisperId: "whisper-1",
        })
      );
    });

    it("should get comment report by ID successfully", async () => {
      const { getDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "comment-report-1" };
      const mockDocSnap = {
        id: "comment-report-1",
        exists: jest.fn(() => true),
        data: jest.fn(() => ({
          id: "comment-report-1",
          commentId: "comment-1",
          whisperId: "whisper-1",
          reporterId: "user-1",
          reporterDisplayName: "Reporter User",
          reporterReputation: 85,
          category: "harassment",
          priority: "high",
          status: "pending",
          reason: "Inappropriate comment",
          reputationWeight: 1.2,
          createdAt: { toDate: () => new Date("2024-01-01") },
          updatedAt: { toDate: () => new Date("2024-01-01") },
        })),
      };

      doc.mockReturnValue(mockDocRef);
      getDoc.mockResolvedValue(mockDocSnap);

      const result = await repository.getCommentReport("comment-report-1");

      expect(result).toBeDefined();
      expect(result?.id).toBe("comment-report-1");
      expect(doc).toHaveBeenCalledWith(
        mockFirestore,
        "reports",
        "comment-report-1"
      );
    });

    it("should return null when comment report does not exist", async () => {
      const { getDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "comment-report-1" };
      const mockDocSnap = {
        exists: jest.fn(() => false),
      };

      doc.mockReturnValue(mockDocRef);
      getDoc.mockResolvedValue(mockDocSnap);

      const result = await repository.getCommentReport("comment-report-1");

      expect(result).toBeNull();
      expect(doc).toHaveBeenCalledWith(
        mockFirestore,
        "reports",
        "comment-report-1"
      );
    });

    it("should get comment reports with filters", async () => {
      const { query, collection, where, orderBy, getDocs } =
        jest.requireMock("firebase/firestore");
      const mockQuerySnapshot = {
        docs: [
          {
            id: "comment-report-1",
            data: () => ({
              id: "comment-report-1",
              commentId: "comment-1",
              whisperId: "whisper-1",
              reporterId: "user-1",
              reporterDisplayName: "Reporter User",
              reporterReputation: 85,
              category: "harassment",
              priority: "high",
              status: "pending",
              reason: "Inappropriate comment",
              reputationWeight: 1.2,
              createdAt: { toDate: () => new Date("2024-01-01") },
              updatedAt: { toDate: () => new Date("2024-01-01") },
            }),
          },
        ],
      };

      query.mockReturnValue({});
      collection.mockReturnValue({});
      where.mockReturnValue({});
      orderBy.mockReturnValue({});
      getDocs.mockResolvedValue(mockQuerySnapshot);

      const filters = {
        status: ReportStatus.PENDING,
        category: ReportCategory.HARASSMENT,
      };
      const result = await repository.getCommentReports(filters);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("comment-report-1");
      expect(query).toHaveBeenCalled();
    });

    it("should update comment report successfully", async () => {
      const { updateDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "comment-report-1" };

      doc.mockReturnValue(mockDocRef);
      updateDoc.mockResolvedValue(undefined);

      const updates = {
        status: ReportStatus.RESOLVED,
        reviewedAt: new Date("2024-01-02"),
      };

      await repository.updateCommentReport("comment-report-1", updates);

      expect(doc).toHaveBeenCalledWith(
        mockFirestore,
        "reports",
        "comment-report-1"
      );
      expect(updateDoc).toHaveBeenCalledWith(
        mockDocRef,
        expect.objectContaining({
          status: ReportStatus.RESOLVED,
          reviewedAt: expect.any(Object),
        })
      );
    });

    it("should update comment report status", async () => {
      const { updateDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "comment-report-1" };

      doc.mockReturnValue(mockDocRef);
      updateDoc.mockResolvedValue(undefined);

      await repository.updateCommentReportStatus(
        "comment-report-1",
        "resolved",
        "moderator-1"
      );

      expect(doc).toHaveBeenCalledWith(
        mockFirestore,
        "reports",
        "comment-report-1"
      );
      expect(updateDoc).toHaveBeenCalledWith(
        mockDocRef,
        expect.objectContaining({
          status: "resolved",
          moderatorId: "moderator-1",
          updatedAt: expect.any(Object),
        })
      );
    });

    it("should check if user has reported comment", async () => {
      const { query, collection, where, getDocs } =
        jest.requireMock("firebase/firestore");
      const mockQuerySnapshot = {
        docs: [
          {
            id: "comment-report-1",
            data: () => ({
              id: "comment-report-1",
              commentId: "comment-1",
              reporterId: "user-1",
            }),
          },
        ],
      };

      query.mockReturnValue({});
      collection.mockReturnValue({});
      where.mockReturnValue({});
      getDocs.mockResolvedValue(mockQuerySnapshot);

      const result = await repository.hasUserReportedComment(
        "comment-1",
        "user-1"
      );

      expect(result).toBe(true);
      expect(query).toHaveBeenCalled();
      expect(where).toHaveBeenCalledWith("commentId", "==", "comment-1");
      expect(where).toHaveBeenCalledWith("reporterId", "==", "user-1");
    });

    it("should return false when user has not reported comment", async () => {
      const { query, collection, where, getDocs } =
        jest.requireMock("firebase/firestore");
      const mockQuerySnapshot = {
        empty: true,
        docs: [],
      };

      query.mockReturnValue({});
      collection.mockReturnValue({});
      where.mockReturnValue({});
      getDocs.mockResolvedValue(mockQuerySnapshot);

      const result = await repository.hasUserReportedComment(
        "comment-1",
        "user-1"
      );

      expect(result).toBe(false);
      expect(query).toHaveBeenCalled();
    });

    it("should get comment report stats", async () => {
      const { query, collection, where, orderBy, getDocs } =
        jest.requireMock("firebase/firestore");
      const mockQuerySnapshot = {
        docs: [
          {
            id: "comment-report-1",
            data: () => ({
              id: "comment-report-1",
              commentId: "comment-1",
              reporterId: "user-1",
              category: "harassment",
              priority: "high",
              status: "pending",
              createdAt: { toDate: () => new Date("2024-01-01") },
            }),
          },
          {
            id: "comment-report-2",
            data: () => ({
              id: "comment-report-2",
              commentId: "comment-1",
              reporterId: "user-2",
              category: "spam",
              priority: "medium",
              status: "pending",
              createdAt: { toDate: () => new Date("2024-01-02") },
            }),
          },
        ],
      };

      query.mockReturnValue({});
      collection.mockReturnValue({});
      where.mockReturnValue({});
      orderBy.mockReturnValue({});
      getDocs.mockResolvedValue(mockQuerySnapshot);

      const result = await repository.getCommentReportStats("comment-1");

      expect(result).toBeDefined();
      expect(result.totalReports).toBe(2);
      expect(result.uniqueReporters).toBe(2);
      expect(result.categories).toBeDefined();
      expect(result.priorityBreakdown).toBeDefined();
      expect(query).toHaveBeenCalled();
      expect(where).toHaveBeenCalledWith("commentId", "==", "comment-1");
    });
  });

  describe("Error Handling", () => {
    it("should handle error when saving report", async () => {
      const { updateDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "report-1" };

      doc.mockReturnValue(mockDocRef);
      updateDoc.mockRejectedValue(new Error("Firestore error"));

      await expect(repository.save(mockReport)).rejects.toThrow(
        "Failed to save report: Firestore error"
      );
    });

    it("should handle error when getting report by ID", async () => {
      const { getDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "report-1" };

      doc.mockReturnValue(mockDocRef);
      getDoc.mockRejectedValue(new Error("Firestore error"));

      await expect(repository.getById("report-1")).rejects.toThrow(
        "Failed to get report: Firestore error"
      );
    });

    it("should handle error when getting all reports", async () => {
      const { getDocs, query, collection, orderBy } =
        jest.requireMock("firebase/firestore");

      query.mockReturnValue({});
      collection.mockReturnValue({});
      orderBy.mockReturnValue({});
      getDocs.mockRejectedValue(new Error("Firestore error"));

      await expect(repository.getAll()).rejects.toThrow(
        "Failed to get reports: Firestore error"
      );
    });

    it("should handle error when updating report", async () => {
      const { updateDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "report-1" };

      doc.mockReturnValue(mockDocRef);
      updateDoc.mockRejectedValue(new Error("Firestore error"));

      await expect(
        repository.update("report-1", { status: ReportStatus.RESOLVED })
      ).rejects.toThrow("Failed to update report: Firestore error");
    });

    it("should handle error when deleting report", async () => {
      const { deleteDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "report-1" };

      doc.mockReturnValue(mockDocRef);
      deleteDoc.mockRejectedValue(new Error("Firestore error"));

      await expect(repository.delete("report-1")).rejects.toThrow(
        "Failed to delete report: Firestore error"
      );
    });

    it("should handle error when saving comment report", async () => {
      const { updateDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "comment-report-1" };

      doc.mockReturnValue(mockDocRef);
      updateDoc.mockRejectedValue(new Error("Firestore error"));

      await expect(
        repository.saveCommentReport(mockCommentReport)
      ).rejects.toThrow("Failed to save comment report: Firestore error");
    });

    it("should handle error when getting comment report", async () => {
      const { getDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "comment-report-1" };

      doc.mockReturnValue(mockDocRef);
      getDoc.mockRejectedValue(new Error("Firestore error"));

      await expect(
        repository.getCommentReport("comment-report-1")
      ).rejects.toThrow("Failed to get comment report: Firestore error");
    });
  });
});
