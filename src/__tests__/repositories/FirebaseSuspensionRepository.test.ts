import { FirebaseSuspensionRepository } from "../../repositories/FirebaseSuspensionRepository";
import { Suspension, SuspensionType, BanType } from "../../types";

// Mock the firebase config
jest.mock("../../config/firebase", () => ({
  getFirestoreInstance: jest.fn(() => ({})),
}));

// Mock firebase/firestore with firebase-mock
jest.mock("firebase/firestore", () => {
  const mockFirestore = {
    collection: jest.fn(),
    doc: jest.fn(),
    getDoc: jest.fn(),
    getDocs: jest.fn(),
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

describe("FirebaseSuspensionRepository", () => {
  let repository: FirebaseSuspensionRepository;
  let mockFirestore: any;

  const mockSuspension: Suspension = {
    id: "suspension-1",
    userId: "user-1",
    type: SuspensionType.TEMPORARY,
    banType: BanType.CONTENT_HIDDEN,
    reason: "Violation of community guidelines",
    moderatorId: "mod-1",
    startDate: new Date("2024-01-01"),
    endDate: new Date("2024-01-08"),
    isActive: true,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new FirebaseSuspensionRepository();

    // Get the mocked firestore instance
    const { getFirestoreInstance } = jest.requireMock("../../config/firebase");
    mockFirestore = getFirestoreInstance();
  });

  describe("Basic CRUD Operations", () => {
    it("should save a suspension successfully", async () => {
      const { updateDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "suspension-1" };

      doc.mockReturnValue(mockDocRef);
      updateDoc.mockResolvedValue(undefined);

      await repository.save(mockSuspension);

      expect(doc).toHaveBeenCalledWith(
        mockFirestore,
        "suspensions",
        "suspension-1"
      );
      expect(updateDoc).toHaveBeenCalledWith(
        mockDocRef,
        expect.objectContaining({
          id: "suspension-1",
          userId: "user-1",
          type: SuspensionType.TEMPORARY,
        })
      );
    });

    it("should get suspension by ID", async () => {
      const { getDoc, doc, Timestamp } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "suspension-1" };
      const mockDocSnap = {
        exists: jest.fn(() => true),
        data: jest.fn(() => ({
          id: "suspension-1",
          userId: "user-1",
          type: SuspensionType.TEMPORARY,
          banType: BanType.CONTENT_HIDDEN,
          reason: "Violation of community guidelines",
          moderatorId: "mod-1",
          startDate: Timestamp.fromDate(new Date("2024-01-01")),
          endDate: Timestamp.fromDate(new Date("2024-01-08")),
          isActive: true,
          createdAt: Timestamp.fromDate(new Date("2024-01-01")),
          updatedAt: Timestamp.fromDate(new Date("2024-01-01")),
        })),
      };

      doc.mockReturnValue(mockDocRef);
      getDoc.mockResolvedValue(mockDocSnap);

      const result = await repository.getById("suspension-1");

      expect(doc).toHaveBeenCalledWith(
        mockFirestore,
        "suspensions",
        "suspension-1"
      );
      expect(getDoc).toHaveBeenCalledWith(mockDocRef);
      expect(result).toEqual(mockSuspension);
    });

    it("should return null when suspension does not exist", async () => {
      const { getDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "suspension-1" };
      const mockDocSnap = {
        exists: jest.fn(() => false),
      };

      doc.mockReturnValue(mockDocRef);
      getDoc.mockResolvedValue(mockDocSnap);

      const result = await repository.getById("non-existent");

      expect(result).toBeNull();
    });

    it("should get all suspensions", async () => {
      const { getDocs, collection, query, orderBy, Timestamp } =
        jest.requireMock("firebase/firestore");
      const mockQuerySnapshot = {
        docs: [
          {
            data: () => ({
              id: "suspension-1",
              userId: "user-1",
              type: SuspensionType.TEMPORARY,
              banType: BanType.CONTENT_HIDDEN,
              reason: "Violation of community guidelines",
              moderatorId: "mod-1",
              startDate: Timestamp.fromDate(new Date("2024-01-01")),
              endDate: Timestamp.fromDate(new Date("2024-01-08")),
              isActive: true,
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

      expect(collection).toHaveBeenCalledWith(mockFirestore, "suspensions");
      expect(query).toHaveBeenCalled();
      expect(orderBy).toHaveBeenCalledWith("createdAt", "desc");
      expect(getDocs).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockSuspension);
    });

    it("should update suspension", async () => {
      const { updateDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "suspension-1" };
      const updates = { isActive: false, reason: "Updated reason" };

      doc.mockReturnValue(mockDocRef);
      updateDoc.mockResolvedValue(undefined);

      await repository.update("suspension-1", updates);

      expect(doc).toHaveBeenCalledWith(
        mockFirestore,
        "suspensions",
        "suspension-1"
      );
      expect(updateDoc).toHaveBeenCalledWith(
        mockDocRef,
        expect.objectContaining({
          isActive: false,
          reason: "Updated reason",
          updatedAt: expect.any(Object),
        })
      );
    });

    it("should delete suspension", async () => {
      const { deleteDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "suspension-1" };

      doc.mockReturnValue(mockDocRef);
      deleteDoc.mockResolvedValue(undefined);

      await repository.delete("suspension-1");

      expect(doc).toHaveBeenCalledWith(
        mockFirestore,
        "suspensions",
        "suspension-1"
      );
      expect(deleteDoc).toHaveBeenCalledWith(mockDocRef);
    });
  });

  describe("Error Handling", () => {
    it("should handle save errors", async () => {
      const { updateDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "suspension-1" };
      const error = new Error("Firestore error");

      doc.mockReturnValue(mockDocRef);
      updateDoc.mockRejectedValue(error);

      await expect(repository.save(mockSuspension)).rejects.toThrow(
        "Failed to save suspension"
      );
    });

    it("should handle get by ID errors", async () => {
      const { getDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "suspension-1" };
      const error = new Error("Firestore error");

      doc.mockReturnValue(mockDocRef);
      getDoc.mockRejectedValue(error);

      await expect(repository.getById("suspension-1")).rejects.toThrow(
        "Failed to get suspension"
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
        "Failed to get all suspensions"
      );
    });

    it("should handle update errors", async () => {
      const { updateDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "suspension-1" };
      const error = new Error("Firestore error");

      doc.mockReturnValue(mockDocRef);
      updateDoc.mockRejectedValue(error);

      await expect(
        repository.update("suspension-1", { isActive: false })
      ).rejects.toThrow("Failed to update suspension");
    });

    it("should handle delete errors", async () => {
      const { deleteDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "suspension-1" };
      const error = new Error("Firestore error");

      doc.mockReturnValue(mockDocRef);
      deleteDoc.mockRejectedValue(error);

      await expect(repository.delete("suspension-1")).rejects.toThrow(
        "Failed to delete suspension"
      );
    });
  });

  describe("Query Methods", () => {
    it("should get suspensions by user ID", async () => {
      const { collection, query, where, orderBy, getDocs } =
        jest.requireMock("firebase/firestore");
      const mockQuerySnapshot = { docs: [] };

      collection.mockReturnValue({});
      query.mockReturnValue({});
      where.mockReturnValue({});
      orderBy.mockReturnValue({});
      getDocs.mockResolvedValue(mockQuerySnapshot);

      await repository.getByUser("user-1");

      expect(collection).toHaveBeenCalledWith(mockFirestore, "suspensions");
      expect(query).toHaveBeenCalled();
      expect(where).toHaveBeenCalledWith("userId", "==", "user-1");
      expect(orderBy).toHaveBeenCalledWith("createdAt", "desc");
    });

    it("should get active suspensions", async () => {
      const { collection, query, where, orderBy, getDocs } =
        jest.requireMock("firebase/firestore");
      const mockQuerySnapshot = { docs: [] };

      collection.mockReturnValue({});
      query.mockReturnValue({});
      where.mockReturnValue({});
      orderBy.mockReturnValue({});
      getDocs.mockResolvedValue(mockQuerySnapshot);

      await repository.getActive();

      expect(collection).toHaveBeenCalledWith(mockFirestore, "suspensions");
      expect(query).toHaveBeenCalled();
      expect(where).toHaveBeenCalledWith("isActive", "==", true);
      expect(orderBy).toHaveBeenCalledWith("createdAt", "desc");
    });

    it("should get suspensions by type", async () => {
      const { collection, query, where, orderBy, getDocs } =
        jest.requireMock("firebase/firestore");
      const mockQuerySnapshot = { docs: [] };

      collection.mockReturnValue({});
      query.mockReturnValue({});
      where.mockReturnValue({});
      orderBy.mockReturnValue({});
      getDocs.mockResolvedValue(mockQuerySnapshot);

      await repository.getByType(SuspensionType.TEMPORARY);

      expect(collection).toHaveBeenCalledWith(mockFirestore, "suspensions");
      expect(query).toHaveBeenCalled();
      expect(where).toHaveBeenCalledWith(
        "type",
        "==",
        SuspensionType.TEMPORARY
      );
      expect(orderBy).toHaveBeenCalledWith("createdAt", "desc");
    });

    it("should get suspensions by moderator", async () => {
      const { query, collection, where, orderBy, getDocs } =
        jest.requireMock("firebase/firestore");
      const mockQuerySnapshot = {
        docs: [
          {
            data: () => ({
              id: "suspension-1",
              userId: "user-1",
              type: "temporary",
              reason: "Violation of community guidelines",
              moderatorId: "mod-1",
              startDate: { toDate: () => new Date("2024-01-01") },
              endDate: { toDate: () => new Date("2024-02-01") },
              isActive: true,
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

      const result = await repository.getByModerator("mod-1");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("suspension-1");
      expect(query).toHaveBeenCalled();
      expect(where).toHaveBeenCalledWith("moderatorId", "==", "mod-1");
    });

    it("should get suspensions by date range", async () => {
      const { query, collection, where, orderBy, getDocs } =
        jest.requireMock("firebase/firestore");
      const mockQuerySnapshot = {
        docs: [
          {
            data: () => ({
              id: "suspension-1",
              userId: "user-1",
              type: "temporary",
              reason: "Violation of community guidelines",
              moderatorId: "mod-1",
              startDate: { toDate: () => new Date("2024-01-15") },
              endDate: { toDate: () => new Date("2024-02-15") },
              isActive: true,
              createdAt: { toDate: () => new Date("2024-01-15") },
              updatedAt: { toDate: () => new Date("2024-01-15") },
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
      expect(result[0].id).toBe("suspension-1");
      expect(query).toHaveBeenCalled();
      expect(where).toHaveBeenCalledWith("createdAt", ">=", expect.any(Object));
      expect(where).toHaveBeenCalledWith("createdAt", "<=", expect.any(Object));
    });
  });
});
