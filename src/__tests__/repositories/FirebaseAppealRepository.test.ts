import { FirebaseAppealRepository } from "@/repositories/FirebaseAppealRepository";
import { validateAppealData } from "@/utils/appealUtils";
import {
  Appeal,
  AppealStatus,
  AppealResolution,
  UserReputation,
  ViolationRecord,
  ViolationType,
} from "@/types";

// Mock Firebase Firestore
jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  Timestamp: {
    fromDate: jest.fn((date) => ({ toDate: () => date })),
  },
}));

// Mock Firebase config
jest.mock("@/config/firebase", () => ({
  getFirestoreInstance: jest.fn(() => ({})),
}));

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";

const mockCollection = collection as jest.MockedFunction<typeof collection>;
const mockDoc = doc as jest.MockedFunction<typeof doc>;
const mockGetDoc = getDoc as jest.MockedFunction<typeof getDoc>;
const mockGetDocs = getDocs as jest.MockedFunction<typeof getDocs>;
const mockSetDoc = setDoc as jest.MockedFunction<typeof setDoc>;
const mockUpdateDoc = updateDoc as jest.MockedFunction<typeof updateDoc>;
const mockQuery = query as jest.MockedFunction<typeof query>;
const mockWhere = where as jest.MockedFunction<typeof where>;
const mockOrderBy = orderBy as jest.MockedFunction<typeof orderBy>;
const mockTimestamp = Timestamp as jest.Mocked<typeof Timestamp>;

describe("FirebaseAppealRepository", () => {
  let repository: FirebaseAppealRepository;
  let mockFirestore: any;

  const mockAppeal: Appeal = {
    id: "appeal-123",
    userId: "user-456",
    whisperId: "whisper-789",
    violationId: "violation-101",
    reason: "This was a misunderstanding",
    evidence: "I can provide additional context",
    status: AppealStatus.PENDING,
    submittedAt: new Date("2024-01-15T10:00:00Z"),
    reviewedAt: undefined,
    reviewedBy: null,
    resolution: null,
    resolutionReason: null,
    createdAt: new Date("2024-01-15T10:00:00Z"),
    updatedAt: new Date("2024-01-15T10:00:00Z"),
  } as unknown as Appeal;

  const mockFirestoreDoc = {
    id: "appeal-123",
    data: () => ({
      userId: "user-456",
      whisperId: "whisper-789",
      violationId: "violation-101",
      reason: "This was a misunderstanding",
      evidence: "I can provide additional context",
      status: "pending",
      submittedAt: { toDate: () => new Date("2024-01-15T10:00:00Z") },
      reviewedAt: null,
      reviewedBy: null,
      resolution: null,
      resolutionReason: null,
      createdAt: { toDate: () => new Date("2024-01-15T10:00:00Z") },
      updatedAt: { toDate: () => new Date("2024-01-15T10:00:00Z") },
    }),
    exists: () => true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFirestore = {};
    repository = new FirebaseAppealRepository();
  });

  describe("getAll", () => {
    it("should retrieve all appeals ordered by submittedAt desc", async () => {
      const mockQuerySnapshot = {
        docs: [mockFirestoreDoc],
      };

      mockCollection.mockReturnValue("appeals-collection" as any);
      mockOrderBy.mockReturnValue("ordered-query" as any);
      mockQuery.mockReturnValue("final-query" as any);
      mockGetDocs.mockResolvedValue(mockQuerySnapshot as any);

      const result = await repository.getAll();

      expect(mockCollection).toHaveBeenCalledWith(mockFirestore, "appeals");
      expect(mockOrderBy).toHaveBeenCalledWith("submittedAt", "desc");
      expect(mockQuery).toHaveBeenCalledWith(
        "appeals-collection",
        "ordered-query"
      );
      expect(mockGetDocs).toHaveBeenCalledWith("final-query");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockAppeal);
    });

    it("should handle errors gracefully", async () => {
      const error = new Error("Firestore error");
      mockCollection.mockReturnValue("appeals-collection" as any);
      mockOrderBy.mockReturnValue("ordered-query" as any);
      mockQuery.mockReturnValue("final-query" as any);
      mockGetDocs.mockRejectedValue(error);

      await expect(repository.getAll()).rejects.toThrow(
        "Failed to get all appeals"
      );
    });
  });

  describe("getById", () => {
    it("should retrieve appeal by ID", async () => {
      mockDoc.mockReturnValue("appeal-doc" as any);
      mockGetDoc.mockResolvedValue(mockFirestoreDoc as any);

      const result = await repository.getById("appeal-123");

      expect(mockDoc).toHaveBeenCalledWith(
        mockFirestore,
        "appeals",
        "appeal-123"
      );
      expect(mockGetDoc).toHaveBeenCalledWith("appeal-doc");
      expect(result).toEqual(mockAppeal);
    });

    it("should return null for non-existent appeal", async () => {
      const nonExistentDoc = {
        ...mockFirestoreDoc,
        exists: () => false,
      };

      mockDoc.mockReturnValue("appeal-doc" as any);
      mockGetDoc.mockResolvedValue(nonExistentDoc as any);

      const result = await repository.getById("non-existent");

      expect(result).toBeNull();
    });

    it("should handle errors gracefully", async () => {
      const error = new Error("Firestore error");
      mockDoc.mockReturnValue("appeal-doc" as any);
      mockGetDoc.mockRejectedValue(error);

      await expect(repository.getById("appeal-123")).rejects.toThrow(
        "Failed to get appeal"
      );
    });
  });

  describe("save", () => {
    it("should save appeal with valid data", async () => {
      mockDoc.mockReturnValue("appeal-doc" as any);
      mockSetDoc.mockResolvedValue(undefined);
      mockTimestamp.fromDate.mockImplementation(
        (date) =>
          ({
            toDate: () => date,
          } as any)
      );

      await repository.save(mockAppeal);

      expect(mockDoc).toHaveBeenCalledWith(
        mockFirestore,
        "appeals",
        "appeal-123"
      );
      expect(mockSetDoc).toHaveBeenCalledWith(
        "appeal-doc",
        expect.objectContaining({
          id: "appeal-123",
          userId: "user-456",
          whisperId: "whisper-789",
          violationId: "violation-101",
          reason: "This was a misunderstanding",
          evidence: "I can provide additional context",
          status: "pending",
          reviewedAt: null,
          reviewedBy: null,
          resolution: null,
          resolutionReason: null,
        })
      );
    });

    it("should handle errors gracefully", async () => {
      const error = new Error("Firestore error");
      mockDoc.mockReturnValue("appeal-doc" as any);
      mockSetDoc.mockRejectedValue(error);

      await expect(repository.save(mockAppeal)).rejects.toThrow(
        "Failed to save appeal"
      );
    });
  });

  describe("update", () => {
    it("should update appeal with valid data", async () => {
      const updates = {
        status: AppealStatus.APPROVED,
        resolution: {
          action: "approve" as const,
          reason: "Appeal was valid",
          moderatorId: "moderator-123",
          reputationAdjustment: 5,
        } as AppealResolution,
        resolutionReason: "Appeal was valid",
        reviewedAt: new Date("2024-01-16T10:00:00Z"),
        reviewedBy: "moderator-123",
      };

      mockDoc.mockReturnValue("appeal-doc" as any);
      mockUpdateDoc.mockResolvedValue(undefined);
      mockTimestamp.fromDate.mockImplementation(
        (date) =>
          ({
            toDate: () => date,
          } as any)
      );

      await repository.update("appeal-123", updates);

      expect(mockDoc).toHaveBeenCalledWith(
        mockFirestore,
        "appeals",
        "appeal-123"
      );
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        "appeal-doc",
        expect.any(Object)
      );
      const callArgs = mockUpdateDoc.mock.calls[0][1] as any;
      expect(callArgs.status).toBe(AppealStatus.APPROVED);
      expect(callArgs.reviewedBy).toBe("moderator-123");
      expect(callArgs.resolutionReason).toBe("Appeal was valid");
      expect(callArgs.updatedAt).toBeDefined();
    });

    it("should handle errors gracefully", async () => {
      const error = new Error("Firestore error");
      mockDoc.mockReturnValue("appeal-doc" as any);
      mockUpdateDoc.mockRejectedValue(error);

      await expect(
        repository.update("appeal-123", { status: AppealStatus.APPROVED })
      ).rejects.toThrow("Failed to update appeal");
    });
  });

  describe("getByUser", () => {
    it("should retrieve appeals by user ID", async () => {
      const mockQuerySnapshot = {
        docs: [mockFirestoreDoc],
      };

      mockCollection.mockReturnValue("appeals-collection" as any);
      mockWhere.mockReturnValue("filtered-query" as any);
      mockOrderBy.mockReturnValue("ordered-query" as any);
      mockQuery.mockReturnValue("final-query" as any);
      mockGetDocs.mockResolvedValue(mockQuerySnapshot as any);

      const result = await repository.getByUser("user-456");

      expect(mockCollection).toHaveBeenCalledWith(mockFirestore, "appeals");
      expect(mockWhere).toHaveBeenCalledWith("userId", "==", "user-456");
      expect(mockOrderBy).toHaveBeenCalledWith("submittedAt", "desc");
      expect(mockQuery).toHaveBeenCalledWith(
        "appeals-collection",
        "filtered-query",
        "ordered-query"
      );
      expect(mockGetDocs).toHaveBeenCalledWith("final-query");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockAppeal);
    });

    it("should handle errors gracefully", async () => {
      const error = new Error("Firestore error");
      mockCollection.mockReturnValue("appeals-collection" as any);
      mockWhere.mockReturnValue("filtered-query" as any);
      mockOrderBy.mockReturnValue("ordered-query" as any);
      mockQuery.mockReturnValue("final-query" as any);
      mockGetDocs.mockRejectedValue(error);

      await expect(repository.getByUser("user-456")).rejects.toThrow(
        "Failed to get user appeals"
      );
    });
  });

  describe("getPending", () => {
    it("should retrieve pending appeals", async () => {
      const mockQuerySnapshot = {
        docs: [mockFirestoreDoc],
      };

      mockCollection.mockReturnValue("appeals-collection" as any);
      mockWhere.mockReturnValue("filtered-query" as any);
      mockOrderBy.mockReturnValue("ordered-query" as any);
      mockQuery.mockReturnValue("final-query" as any);
      mockGetDocs.mockResolvedValue(mockQuerySnapshot as any);

      const result = await repository.getPending();

      expect(mockCollection).toHaveBeenCalledWith(mockFirestore, "appeals");
      expect(mockWhere).toHaveBeenCalledWith("status", "==", "pending");
      expect(mockOrderBy).toHaveBeenCalledWith("submittedAt", "asc");
      expect(mockQuery).toHaveBeenCalledWith(
        "appeals-collection",
        "filtered-query",
        "ordered-query"
      );
      expect(mockGetDocs).toHaveBeenCalledWith("final-query");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockAppeal);
    });

    it("should handle errors gracefully", async () => {
      const error = new Error("Firestore error");
      mockCollection.mockReturnValue("appeals-collection" as any);
      mockWhere.mockReturnValue("filtered-query" as any);
      mockOrderBy.mockReturnValue("ordered-query" as any);
      mockQuery.mockReturnValue("final-query" as any);
      mockGetDocs.mockRejectedValue(error);

      await expect(repository.getPending()).rejects.toThrow(
        "Failed to get pending appeals"
      );
    });
  });

  describe("getByViolation", () => {
    it("should retrieve appeals by violation ID", async () => {
      const mockQuerySnapshot = {
        docs: [mockFirestoreDoc],
      };

      mockCollection.mockReturnValue("appeals-collection" as any);
      mockWhere.mockReturnValue("filtered-query" as any);
      mockOrderBy.mockReturnValue("ordered-query" as any);
      mockQuery.mockReturnValue("final-query" as any);
      mockGetDocs.mockResolvedValue(mockQuerySnapshot as any);

      const result = await repository.getByViolation("violation-101");

      expect(mockCollection).toHaveBeenCalledWith(mockFirestore, "appeals");
      expect(mockWhere).toHaveBeenCalledWith(
        "violationId",
        "==",
        "violation-101"
      );
      expect(mockOrderBy).toHaveBeenCalledWith("submittedAt", "desc");
      expect(mockQuery).toHaveBeenCalledWith(
        "appeals-collection",
        "filtered-query",
        "ordered-query"
      );
      expect(mockGetDocs).toHaveBeenCalledWith("final-query");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockAppeal);
    });

    it("should handle errors gracefully", async () => {
      const error = new Error("Firestore error");
      mockCollection.mockReturnValue("appeals-collection" as any);
      mockWhere.mockReturnValue("filtered-query" as any);
      mockOrderBy.mockReturnValue("ordered-query" as any);
      mockQuery.mockReturnValue("final-query" as any);
      mockGetDocs.mockRejectedValue(error);

      await expect(repository.getByViolation("violation-101")).rejects.toThrow(
        "Failed to get appeals by violation"
      );
    });
  });

  describe("data mapping", () => {
    it("should correctly map Firestore document to Appeal object", async () => {
      mockDoc.mockReturnValue("appeal-doc" as any);
      mockGetDoc.mockResolvedValue(mockFirestoreDoc as any);

      const result = await repository.getById("appeal-123");

      expect(result).toEqual({
        id: "appeal-123",
        userId: "user-456",
        whisperId: "whisper-789",
        violationId: "violation-101",
        reason: "This was a misunderstanding",
        evidence: "I can provide additional context",
        status: AppealStatus.PENDING,
        submittedAt: new Date("2024-01-15T10:00:00Z"),
        reviewedAt: undefined,
        reviewedBy: null,
        resolution: null,
        resolutionReason: null,
        createdAt: new Date("2024-01-15T10:00:00Z"),
        updatedAt: new Date("2024-01-15T10:00:00Z"),
      });
    });

    it("should handle missing data gracefully", async () => {
      const docWithMissingData = {
        id: "appeal-123",
        data: () => null,
        exists: () => true,
      };

      mockDoc.mockReturnValue("appeal-doc" as any);
      mockGetDoc.mockResolvedValue(docWithMissingData as any);

      await expect(repository.getById("appeal-123")).rejects.toThrow(
        "Document appeal-123 has no data"
      );
    });
  });

  describe("business logic integration", () => {
    it("should validate appeal data before saving", async () => {
      const invalidAppeal = {
        ...mockAppeal,
        userId: "", // Invalid: empty user ID
        reason: "", // Invalid: empty reason
      };

      // Test real validation logic with proper parameters
      const mockReputation: UserReputation = {
        userId: "user-456",
        score: 85,
        level: "standard",
        totalWhispers: 10,
        approvedWhispers: 9,
        flaggedWhispers: 1,
        rejectedWhispers: 0,
        violationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockViolation: ViolationRecord = {
        id: "violation-101",
        whisperId: "whisper-789",
        violationType: ViolationType.SPAM,
        severity: "low",
        timestamp: new Date("2024-01-15T09:00:00Z"), // Recent violation within appeal time limit
        resolved: false,
      };

      expect(() =>
        validateAppealData(
          {
            userId: invalidAppeal.userId,
            whisperId: invalidAppeal.whisperId,
            violationId: invalidAppeal.violationId,
            reason: invalidAppeal.reason,
          },
          mockReputation,
          mockViolation
        )
      ).toThrow();

      mockDoc.mockReturnValue("appeal-doc" as any);
      mockSetDoc.mockResolvedValue(undefined);

      // Repository should still attempt to save (validation is typically done at service layer)
      await repository.save(invalidAppeal);

      expect(mockSetDoc).toHaveBeenCalled();
    });

    it("should handle appeal status transitions correctly", async () => {
      mockDoc.mockReturnValue("appeal-doc" as any);
      mockUpdateDoc.mockResolvedValue(undefined);

      // Update from pending to approved
      await repository.update("appeal-123", { status: AppealStatus.APPROVED });

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        "appeal-doc",
        expect.objectContaining({
          status: AppealStatus.APPROVED,
          updatedAt: expect.any(Object),
        })
      );
    });
  });
});
