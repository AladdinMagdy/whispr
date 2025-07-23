import { FirebaseUserBlockRepository } from "../../repositories/FirebaseUserBlockRepository";
import { UserBlock } from "../../types";

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

describe("FirebaseUserBlockRepository", () => {
  let repository: FirebaseUserBlockRepository;
  let mockFirestore: any;

  const mockUserBlock: UserBlock = {
    id: "block-1",
    userId: "user-1",
    blockedUserId: "user-2",
    blockedUserDisplayName: "Blocked User",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new FirebaseUserBlockRepository();

    // Get the mocked firestore instance
    const { getFirestoreInstance } = jest.requireMock("../../config/firebase");
    mockFirestore = getFirestoreInstance();
  });

  describe("Basic CRUD Operations", () => {
    it("should save a user block successfully", async () => {
      const { setDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "block-1" };

      doc.mockReturnValue(mockDocRef);
      setDoc.mockResolvedValue(undefined);

      await repository.save(mockUserBlock);

      expect(doc).toHaveBeenCalledWith(mockFirestore, "userBlocks", "block-1");
      expect(setDoc).toHaveBeenCalledWith(
        mockDocRef,
        expect.objectContaining({
          id: "block-1",
          userId: "user-1",
          blockedUserId: "user-2",
          blockedUserDisplayName: "Blocked User",
        })
      );
    });

    it("should get user block by ID", async () => {
      const { getDoc, doc, Timestamp } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "block-1" };
      const mockDocSnap = {
        id: "block-1",
        exists: jest.fn(() => true),
        data: jest.fn(() => ({
          userId: "user-1",
          blockedUserId: "user-2",
          blockedUserDisplayName: "Blocked User",
          createdAt: Timestamp.fromDate(new Date("2024-01-01")),
          updatedAt: Timestamp.fromDate(new Date("2024-01-01")),
        })),
      };

      doc.mockReturnValue(mockDocRef);
      getDoc.mockResolvedValue(mockDocSnap);

      const result = await repository.getById("block-1");

      expect(doc).toHaveBeenCalledWith(mockFirestore, "userBlocks", "block-1");
      expect(getDoc).toHaveBeenCalledWith(mockDocRef);
      expect(result).toEqual(mockUserBlock);
    });

    it("should return null when user block does not exist", async () => {
      const { getDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "block-1" };
      const mockDocSnap = {
        exists: jest.fn(() => false),
      };

      doc.mockReturnValue(mockDocRef);
      getDoc.mockResolvedValue(mockDocSnap);

      const result = await repository.getById("non-existent");

      expect(result).toBeNull();
    });

    it("should get all user blocks", async () => {
      const { getDocs, collection, query, orderBy, Timestamp } =
        jest.requireMock("firebase/firestore");
      const mockQuerySnapshot = {
        docs: [
          {
            id: "block-1",
            data: () => ({
              userId: "user-1",
              blockedUserId: "user-2",
              blockedUserDisplayName: "Blocked User",
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

      expect(collection).toHaveBeenCalledWith(mockFirestore, "userBlocks");
      expect(query).toHaveBeenCalled();
      expect(orderBy).toHaveBeenCalledWith("createdAt", "desc");
      expect(getDocs).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockUserBlock);
    });

    it("should update user block", async () => {
      const { updateDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "block-1" };
      const updates = { blockedUserDisplayName: "Updated Name" };

      doc.mockReturnValue(mockDocRef);
      updateDoc.mockResolvedValue(undefined);

      await repository.update("block-1", updates);

      expect(doc).toHaveBeenCalledWith(mockFirestore, "userBlocks", "block-1");
      expect(updateDoc).toHaveBeenCalledWith(
        mockDocRef,
        expect.objectContaining({
          blockedUserDisplayName: "Updated Name",
          updatedAt: expect.any(Object),
        })
      );
    });

    it("should delete user block", async () => {
      const { deleteDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "block-1" };

      doc.mockReturnValue(mockDocRef);
      deleteDoc.mockResolvedValue(undefined);

      await repository.delete("block-1");

      expect(doc).toHaveBeenCalledWith(mockFirestore, "userBlocks", "block-1");
      expect(deleteDoc).toHaveBeenCalledWith(mockDocRef);
    });
  });

  describe("Query Methods", () => {
    it("should get blocks by user", async () => {
      const { collection, query, where, orderBy, getDocs, Timestamp } =
        jest.requireMock("firebase/firestore");
      const mockQuerySnapshot = {
        docs: [
          {
            id: "block-1",
            data: () => ({
              userId: "user-1",
              blockedUserId: "user-2",
              blockedUserDisplayName: "Blocked User",
              createdAt: Timestamp.fromDate(new Date("2024-01-01")),
              updatedAt: Timestamp.fromDate(new Date("2024-01-01")),
            }),
          },
        ],
      };

      collection.mockReturnValue({});
      query.mockReturnValue({});
      where.mockReturnValue({});
      orderBy.mockReturnValue({});
      getDocs.mockResolvedValue(mockQuerySnapshot);

      const result = await repository.getByUser("user-1");

      expect(collection).toHaveBeenCalledWith(mockFirestore, "userBlocks");
      expect(query).toHaveBeenCalled();
      expect(where).toHaveBeenCalledWith("userId", "==", "user-1");
      expect(orderBy).toHaveBeenCalledWith("createdAt", "desc");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockUserBlock);
    });

    it("should get blocks by blocked user", async () => {
      const { collection, query, where, orderBy, getDocs, Timestamp } =
        jest.requireMock("firebase/firestore");
      const mockQuerySnapshot = {
        docs: [
          {
            id: "block-1",
            data: () => ({
              userId: "user-1",
              blockedUserId: "user-2",
              blockedUserDisplayName: "Blocked User",
              createdAt: Timestamp.fromDate(new Date("2024-01-01")),
              updatedAt: Timestamp.fromDate(new Date("2024-01-01")),
            }),
          },
        ],
      };

      collection.mockReturnValue({});
      query.mockReturnValue({});
      where.mockReturnValue({});
      orderBy.mockReturnValue({});
      getDocs.mockResolvedValue(mockQuerySnapshot);

      const result = await repository.getByBlockedUser("user-2");

      expect(collection).toHaveBeenCalledWith(mockFirestore, "userBlocks");
      expect(query).toHaveBeenCalled();
      expect(where).toHaveBeenCalledWith("blockedUserId", "==", "user-2");
      expect(orderBy).toHaveBeenCalledWith("createdAt", "desc");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockUserBlock);
    });

    it("should check if user is blocked", async () => {
      const { collection, query, where, getDocs, Timestamp } =
        jest.requireMock("firebase/firestore");
      const mockQuerySnapshot = {
        docs: [
          {
            id: "block-1",
            data: () => ({
              userId: "user-1",
              blockedUserId: "user-2",
              blockedUserDisplayName: "Blocked User",
              createdAt: Timestamp.fromDate(new Date("2024-01-01")),
              updatedAt: Timestamp.fromDate(new Date("2024-01-01")),
            }),
          },
        ],
      };

      collection.mockReturnValue({});
      query.mockReturnValue({});
      where.mockReturnValue({});
      getDocs.mockResolvedValue(mockQuerySnapshot);

      const result = await repository.isUserBlocked("user-1", "user-2");

      expect(collection).toHaveBeenCalledWith(mockFirestore, "userBlocks");
      expect(query).toHaveBeenCalled();
      expect(where).toHaveBeenCalledWith("userId", "==", "user-1");
      expect(where).toHaveBeenCalledWith("blockedUserId", "==", "user-2");
      expect(result).toBe(true);
    });

    it("should return false when user is not blocked", async () => {
      const { collection, query, where, getDocs } =
        jest.requireMock("firebase/firestore");
      const mockQuerySnapshot = {
        docs: [],
      };

      collection.mockReturnValue({});
      query.mockReturnValue({});
      where.mockReturnValue({});
      getDocs.mockResolvedValue(mockQuerySnapshot);

      const result = await repository.isUserBlocked("user-1", "user-3");

      expect(result).toBe(false);
    });
  });

  describe("Error Handling", () => {
    it("should handle save errors", async () => {
      const { setDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "block-1" };
      const error = new Error("Firestore error");

      doc.mockReturnValue(mockDocRef);
      setDoc.mockRejectedValue(error);

      await expect(repository.save(mockUserBlock)).rejects.toThrow(
        "Failed to save user block: Firestore error"
      );
    });

    it("should handle get by ID errors", async () => {
      const { getDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "block-1" };
      const error = new Error("Firestore error");

      doc.mockReturnValue(mockDocRef);
      getDoc.mockRejectedValue(error);

      await expect(repository.getById("block-1")).rejects.toThrow(
        "Failed to get user block: Firestore error"
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
        "Failed to get all user blocks: Firestore error"
      );
    });

    it("should handle update errors", async () => {
      const { updateDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "block-1" };
      const error = new Error("Firestore error");

      doc.mockReturnValue(mockDocRef);
      updateDoc.mockRejectedValue(error);

      await expect(
        repository.update("block-1", { blockedUserDisplayName: "Updated" })
      ).rejects.toThrow("Failed to update user block: Firestore error");
    });

    it("should handle delete errors", async () => {
      const { deleteDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "block-1" };
      const error = new Error("Firestore error");

      doc.mockReturnValue(mockDocRef);
      deleteDoc.mockRejectedValue(error);

      await expect(repository.delete("block-1")).rejects.toThrow(
        "Failed to delete user block: Firestore error"
      );
    });
  });
});
