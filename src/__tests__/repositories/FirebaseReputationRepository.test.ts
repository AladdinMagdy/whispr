import { FirebaseReputationRepository } from "../../repositories/FirebaseReputationRepository";
import { UserReputation, UserViolation } from "../../types";

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

describe("FirebaseReputationRepository", () => {
  let repository: FirebaseReputationRepository;
  let mockFirestore: any;

  const mockUserReputation: UserReputation = {
    userId: "user-1",
    score: 85,
    level: "trusted",
    totalWhispers: 50,
    approvedWhispers: 45,
    flaggedWhispers: 3,
    rejectedWhispers: 2,
    lastViolation: new Date("2024-01-01"),
    violationHistory: [],
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  };

  const mockUserViolation: UserViolation = {
    id: "violation-1",
    userId: "user-1",
    whisperId: "whisper-1",
    violationType: "whisper_deleted",
    reason: "Violation of community guidelines",
    reportCount: 3,
    moderatorId: "mod-1",
    createdAt: new Date("2024-01-01"),
    expiresAt: new Date("2024-02-01"),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new FirebaseReputationRepository();

    // Get the mocked firestore instance
    const { getFirestoreInstance } = jest.requireMock("../../config/firebase");
    mockFirestore = getFirestoreInstance();
  });

  describe("Basic CRUD Operations", () => {
    it("should save a user reputation successfully", async () => {
      const { updateDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "user-1" };

      doc.mockReturnValue(mockDocRef);
      updateDoc.mockResolvedValue(undefined);

      await repository.save(mockUserReputation);

      expect(doc).toHaveBeenCalledWith(
        mockFirestore,
        "userReputations",
        "user-1"
      );
      expect(updateDoc).toHaveBeenCalledWith(
        mockDocRef,
        expect.objectContaining({
          userId: "user-1",
          score: 85,
          level: "trusted",
        })
      );
    });

    it("should get user reputation by ID", async () => {
      const { getDoc, doc, Timestamp } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "user-1" };
      const mockDocSnap = {
        id: "user-1",
        exists: jest.fn(() => true),
        data: jest.fn(() => ({
          score: 85,
          level: "trusted",
          totalWhispers: 50,
          approvedWhispers: 45,
          flaggedWhispers: 3,
          rejectedWhispers: 2,
          lastViolation: Timestamp.fromDate(new Date("2024-01-01")),
          violationHistory: [],
          createdAt: Timestamp.fromDate(new Date("2024-01-01")),
          updatedAt: Timestamp.fromDate(new Date("2024-01-01")),
        })),
      };

      doc.mockReturnValue(mockDocRef);
      getDoc.mockResolvedValue(mockDocSnap);

      const result = await repository.getById("user-1");

      expect(doc).toHaveBeenCalledWith(
        mockFirestore,
        "userReputations",
        "user-1"
      );
      expect(getDoc).toHaveBeenCalledWith(mockDocRef);
      expect(result).toEqual(mockUserReputation);
    });

    it("should return null when user reputation does not exist", async () => {
      const { getDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "user-1" };
      const mockDocSnap = {
        exists: jest.fn(() => false),
      };

      doc.mockReturnValue(mockDocRef);
      getDoc.mockResolvedValue(mockDocSnap);

      const result = await repository.getById("non-existent");

      expect(result).toBeNull();
    });

    it("should get all user reputations", async () => {
      const { getDocs, collection, query, orderBy, Timestamp } =
        jest.requireMock("firebase/firestore");
      const mockQuerySnapshot = {
        docs: [
          {
            id: "user-1",
            data: () => ({
              score: 85,
              level: "trusted",
              totalWhispers: 50,
              approvedWhispers: 45,
              flaggedWhispers: 3,
              rejectedWhispers: 2,
              lastViolation: Timestamp.fromDate(new Date("2024-01-01")),
              violationHistory: [],
              createdAt: Timestamp.fromDate(new Date("2024-01-01")),
              updatedAt: Timestamp.fromDate(new Date("2024-01-01")),
            }),
          },
        ],
      };

      collection.mockReturnValue({});
      query.mockReturnValue({});
      orderBy.mockReturnValue({});
      getDocs.mockResolvedValue(mockQuerySnapshot);

      const result = await repository.getAll();

      expect(collection).toHaveBeenCalledWith(mockFirestore, "userReputations");
      expect(query).toHaveBeenCalled();
      expect(orderBy).toHaveBeenCalledWith("updatedAt", "desc");
      expect(getDocs).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockUserReputation);
    });

    it("should update user reputation", async () => {
      const { updateDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "user-1" };
      const updates = { score: 90, level: "verified" as const };

      doc.mockReturnValue(mockDocRef);
      updateDoc.mockResolvedValue(undefined);

      await repository.update("user-1", updates);

      expect(doc).toHaveBeenCalledWith(
        mockFirestore,
        "userReputations",
        "user-1"
      );
      expect(updateDoc).toHaveBeenCalledWith(
        mockDocRef,
        expect.objectContaining({
          score: 90,
          level: "verified",
          updatedAt: expect.any(Object),
        })
      );
    });

    it("should delete user reputation", async () => {
      const { deleteDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "user-1" };

      doc.mockReturnValue(mockDocRef);
      deleteDoc.mockResolvedValue(undefined);

      await repository.delete("user-1");

      expect(doc).toHaveBeenCalledWith(
        mockFirestore,
        "userReputations",
        "user-1"
      );
      expect(deleteDoc).toHaveBeenCalledWith(mockDocRef);
    });
  });

  describe("Error Handling", () => {
    it("should handle save errors", async () => {
      const { updateDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "user-1" };
      const error = new Error("Firestore error");

      doc.mockReturnValue(mockDocRef);
      updateDoc.mockRejectedValue(error);

      await expect(repository.save(mockUserReputation)).rejects.toThrow(
        "Failed to save user reputation: Firestore error"
      );
    });

    it("should handle get by ID errors", async () => {
      const { getDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "user-1" };
      const error = new Error("Firestore error");

      doc.mockReturnValue(mockDocRef);
      getDoc.mockRejectedValue(error);

      await expect(repository.getById("user-1")).rejects.toThrow(
        "Failed to get user reputation: Firestore error"
      );
    });

    it("should handle get all errors", async () => {
      const { getDocs, collection, query, orderBy } =
        jest.requireMock("firebase/firestore");
      const error = new Error("Firestore error");

      collection.mockReturnValue({});
      query.mockReturnValue({});
      orderBy.mockReturnValue({});
      getDocs.mockRejectedValue(error);

      await expect(repository.getAll()).rejects.toThrow(
        "Failed to get user reputations: Firestore error"
      );
    });

    it("should handle update errors", async () => {
      const { updateDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "user-1" };
      const error = new Error("Firestore error");

      doc.mockReturnValue(mockDocRef);
      updateDoc.mockRejectedValue(error);

      await expect(repository.update("user-1", { score: 90 })).rejects.toThrow(
        "Failed to update user reputation: Firestore error"
      );
    });

    it("should handle delete errors", async () => {
      const { deleteDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "user-1" };
      const error = new Error("Firestore error");

      doc.mockReturnValue(mockDocRef);
      deleteDoc.mockRejectedValue(error);

      await expect(repository.delete("user-1")).rejects.toThrow(
        "Failed to delete user reputation: Firestore error"
      );
    });
  });

  describe("Query Methods", () => {
    it("should get users by reputation level", async () => {
      const { query, collection, where, orderBy, getDocs } =
        jest.requireMock("firebase/firestore");
      const mockQuerySnapshot = {
        docs: [
          {
            id: "user-1",
            data: () => ({
              userId: "user-1",
              score: 85,
              level: "trusted",
              totalWhispers: 50,
              approvedWhispers: 45,
              flaggedWhispers: 3,
              rejectedWhispers: 2,
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

      const result = await repository.getByLevel("trusted");

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe("user-1");
      expect(query).toHaveBeenCalled();
      expect(where).toHaveBeenCalledWith("level", "==", "trusted");
    });

    it("should get users by score range", async () => {
      const { query, collection, where, orderBy, getDocs } =
        jest.requireMock("firebase/firestore");
      const mockQuerySnapshot = {
        docs: [
          {
            id: "user-1",
            data: () => ({
              userId: "user-1",
              score: 85,
              level: "trusted",
              totalWhispers: 50,
              approvedWhispers: 45,
              flaggedWhispers: 3,
              rejectedWhispers: 2,
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

      const result = await repository.getByScoreRange(80, 90);

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe("user-1");
      expect(query).toHaveBeenCalled();
      expect(where).toHaveBeenCalledWith("score", ">=", 80);
      expect(where).toHaveBeenCalledWith("score", "<=", 90);
    });

    it("should get users with recent violations", async () => {
      const { query, collection, where, orderBy, limit, getDocs } =
        jest.requireMock("firebase/firestore");
      const mockQuerySnapshot = {
        docs: [
          {
            id: "user-1",
            data: () => ({
              userId: "user-1",
              score: 85,
              level: "trusted",
              totalWhispers: 50,
              approvedWhispers: 45,
              flaggedWhispers: 3,
              rejectedWhispers: 2,
              lastViolation: { toDate: () => new Date("2024-01-01") },
              violationHistory: [],
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
      limit.mockReturnValue({});
      getDocs.mockResolvedValue(mockQuerySnapshot);

      const result = await repository.getWithRecentViolations(30, 10);

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe("user-1");
      expect(query).toHaveBeenCalled();
      expect(where).toHaveBeenCalledWith(
        "lastViolation",
        ">=",
        expect.any(Object)
      );
      expect(limit).toHaveBeenCalledWith(10);
    });

    it("should get users by violation count", async () => {
      const { query, collection, where, orderBy, getDocs } =
        jest.requireMock("firebase/firestore");
      const mockQuerySnapshot = {
        docs: [
          {
            id: "user-1",
            data: () => ({
              userId: "user-1",
              score: 85,
              level: "trusted",
              totalWhispers: 50,
              approvedWhispers: 45,
              flaggedWhispers: 3,
              rejectedWhispers: 2,
              violationHistory: [
                {
                  id: "violation-1",
                  timestamp: { toDate: () => new Date("2024-01-01") },
                },
                {
                  id: "violation-2",
                  timestamp: { toDate: () => new Date("2024-01-02") },
                },
              ],
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

      const result = await repository.getByViolationCount(2);

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe("user-1");
      expect(query).toHaveBeenCalled();
      expect(where).toHaveBeenCalledWith("flaggedWhispers", ">=", 2);
    });
  });

  describe("Statistics", () => {
    it("should get reputation statistics", async () => {
      const { collection, query, orderBy, getDocs, Timestamp } =
        jest.requireMock("firebase/firestore");
      const mockQuerySnapshot = {
        docs: [
          {
            id: "user-1",
            data: () => ({
              score: 85,
              level: "trusted",
              totalWhispers: 50,
              approvedWhispers: 45,
              flaggedWhispers: 3,
              rejectedWhispers: 2,
              lastViolation: Timestamp.fromDate(new Date("2024-01-01")),
              violationHistory: [],
              createdAt: Timestamp.fromDate(new Date("2024-01-01")),
              updatedAt: Timestamp.fromDate(new Date("2024-01-01")),
            }),
          },
        ],
      };

      collection.mockReturnValue({});
      query.mockReturnValue({});
      orderBy.mockReturnValue({});
      getDocs.mockResolvedValue(mockQuerySnapshot);

      const result = await repository.getStats();

      expect(collection).toHaveBeenCalledWith(mockFirestore, "userReputations");
      expect(getDocs).toHaveBeenCalled();
      expect(result).toEqual({
        totalUsers: 1,
        averageScore: 85,
        trustedUsers: 1,
        verifiedUsers: 0,
        standardUsers: 0,
        flaggedUsers: 0,
        bannedUsers: 0,
      });
    });
  });

  describe("Violation Methods", () => {
    it("should save user violation", async () => {
      const { updateDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "violation-1" };

      doc.mockReturnValue(mockDocRef);
      updateDoc.mockResolvedValue(undefined);

      await repository.saveViolation(mockUserViolation);

      expect(doc).toHaveBeenCalledWith(
        mockFirestore,
        "userViolations",
        "violation-1"
      );
      expect(updateDoc).toHaveBeenCalledWith(
        mockDocRef,
        expect.objectContaining({
          id: "violation-1",
          userId: "user-1",
          violationType: "whisper_deleted",
        })
      );
    });

    it("should get user violations", async () => {
      const { collection, query, where, orderBy, getDocs, Timestamp } =
        jest.requireMock("firebase/firestore");
      const mockQuerySnapshot = {
        docs: [
          {
            id: "violation-1",
            data: () => ({
              userId: "user-1",
              whisperId: "whisper-1",
              violationType: "whisper_deleted",
              reason: "Violation of community guidelines",
              reportCount: 3,
              moderatorId: "mod-1",
              createdAt: Timestamp.fromDate(new Date("2024-01-01")),
              expiresAt: Timestamp.fromDate(new Date("2024-02-01")),
            }),
          },
        ],
      };

      collection.mockReturnValue({});
      query.mockReturnValue({});
      where.mockReturnValue({});
      orderBy.mockReturnValue({});
      getDocs.mockResolvedValue(mockQuerySnapshot);

      const result = await repository.getViolations("user-1", 30);

      expect(collection).toHaveBeenCalledWith(mockFirestore, "userViolations");
      expect(query).toHaveBeenCalled();
      expect(where).toHaveBeenCalledWith("userId", "==", "user-1");
      expect(orderBy).toHaveBeenCalledWith("createdAt", "desc");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockUserViolation);
    });

    it("should get deleted whisper count", async () => {
      const { collection, query, where, getDocs } =
        jest.requireMock("firebase/firestore");
      const mockQuerySnapshot = {
        size: 2,
      };

      collection.mockReturnValue({});
      query.mockReturnValue({});
      where.mockReturnValue({});
      getDocs.mockResolvedValue(mockQuerySnapshot);

      const result = await repository.getDeletedWhisperCount("user-1", 30);

      expect(collection).toHaveBeenCalledWith(mockFirestore, "userViolations");
      expect(query).toHaveBeenCalled();
      expect(where).toHaveBeenCalledWith("userId", "==", "user-1");
      expect(result).toBe(2);
    });
  });
});
