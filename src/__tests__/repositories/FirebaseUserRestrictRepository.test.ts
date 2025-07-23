import { FirebaseUserRestrictRepository } from "../../repositories/FirebaseUserRestrictRepository";
import { UserRestriction } from "../../types";

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

describe("FirebaseUserRestrictRepository", () => {
  let repository: FirebaseUserRestrictRepository;
  let mockFirestore: any;

  const mockUserRestriction: UserRestriction = {
    id: "restrict-1",
    userId: "user-1",
    restrictedUserId: "user-2",
    restrictedUserDisplayName: "Restricted User",
    type: "interaction",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new FirebaseUserRestrictRepository();

    // Get the mocked firestore instance
    const { getFirestoreInstance } = jest.requireMock("../../config/firebase");
    mockFirestore = getFirestoreInstance();
  });

  describe("Basic CRUD Operations", () => {
    it("should save a user restriction successfully", async () => {
      const { setDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "restrict-1" };

      doc.mockReturnValue(mockDocRef);
      setDoc.mockResolvedValue(undefined);

      await repository.save(mockUserRestriction);

      expect(doc).toHaveBeenCalledWith(
        mockFirestore,
        "userRestrictions",
        "restrict-1"
      );
      expect(setDoc).toHaveBeenCalledWith(
        mockDocRef,
        expect.objectContaining({
          id: "restrict-1",
          userId: "user-1",
          restrictedUserId: "user-2",
          restrictedUserDisplayName: "Restricted User",
          type: "interaction",
        })
      );
    });

    it("should get user restriction by ID successfully", async () => {
      const { getDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "restrict-1" };
      const mockDocSnap = {
        id: "restrict-1",
        exists: () => true,
        data: () => ({
          userId: "user-1",
          restrictedUserId: "user-2",
          restrictedUserDisplayName: "Restricted User",
          type: "interaction",
          createdAt: { toDate: () => new Date("2024-01-01") },
          updatedAt: { toDate: () => new Date("2024-01-01") },
        }),
      };

      doc.mockReturnValue(mockDocRef);
      getDoc.mockResolvedValue(mockDocSnap);

      const result = await repository.getById("restrict-1");

      expect(doc).toHaveBeenCalledWith(
        mockFirestore,
        "userRestrictions",
        "restrict-1"
      );
      expect(getDoc).toHaveBeenCalledWith(mockDocRef);
      expect(result).toEqual(mockUserRestriction);
    });

    it("should return null when user restriction does not exist", async () => {
      const { getDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "restrict-1" };
      const mockDocSnap = {
        exists: () => false,
      };

      doc.mockReturnValue(mockDocRef);
      getDoc.mockResolvedValue(mockDocSnap);

      const result = await repository.getById("restrict-1");

      expect(result).toBeNull();
    });

    it("should get all user restrictions successfully", async () => {
      const { getDocs, query, collection, orderBy } =
        jest.requireMock("firebase/firestore");
      const mockQuerySnapshot = {
        docs: [
          {
            id: "restrict-1",
            data: () => ({
              userId: "user-1",
              restrictedUserId: "user-2",
              restrictedUserDisplayName: "Restricted User",
              type: "interaction",
              createdAt: { toDate: () => new Date("2024-01-01") },
              updatedAt: { toDate: () => new Date("2024-01-01") },
            }),
          },
        ],
      };

      query.mockReturnValue({});
      collection.mockReturnValue({});
      orderBy.mockReturnValue({});
      getDocs.mockResolvedValue(mockQuerySnapshot);

      const result = await repository.getAll();

      expect(collection).toHaveBeenCalledWith(
        mockFirestore,
        "userRestrictions"
      );
      expect(orderBy).toHaveBeenCalledWith("createdAt", "desc");
      expect(result).toEqual([mockUserRestriction]);
    });

    it("should update user restriction successfully", async () => {
      const { updateDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "restrict-1" };

      doc.mockReturnValue(mockDocRef);
      updateDoc.mockResolvedValue(undefined);

      const updates = {
        type: "full" as const,
        restrictedUserDisplayName: "Updated Name",
      };

      await repository.update("restrict-1", updates);

      expect(doc).toHaveBeenCalledWith(
        mockFirestore,
        "userRestrictions",
        "restrict-1"
      );
      expect(updateDoc).toHaveBeenCalledWith(
        mockDocRef,
        expect.objectContaining({
          type: "full",
          restrictedUserDisplayName: "Updated Name",
          updatedAt: expect.any(Object),
        })
      );
    });

    it("should delete user restriction successfully", async () => {
      const { deleteDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "restrict-1" };

      doc.mockReturnValue(mockDocRef);
      deleteDoc.mockResolvedValue(undefined);

      await repository.delete("restrict-1");

      expect(doc).toHaveBeenCalledWith(
        mockFirestore,
        "userRestrictions",
        "restrict-1"
      );
      expect(deleteDoc).toHaveBeenCalledWith(mockDocRef);
    });
  });

  describe("Query Methods", () => {
    it("should get user restrictions by user ID", async () => {
      const { getDocs, query, collection, where, orderBy } =
        jest.requireMock("firebase/firestore");
      const mockQuerySnapshot = {
        docs: [
          {
            id: "restrict-1",
            data: () => ({
              userId: "user-1",
              restrictedUserId: "user-2",
              restrictedUserDisplayName: "Restricted User",
              type: "interaction",
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

      const result = await repository.getByUser("user-1");

      expect(collection).toHaveBeenCalledWith(
        mockFirestore,
        "userRestrictions"
      );
      expect(where).toHaveBeenCalledWith("userId", "==", "user-1");
      expect(orderBy).toHaveBeenCalledWith("createdAt", "desc");
      expect(result).toEqual([mockUserRestriction]);
    });

    it("should get user restrictions by restricted user ID", async () => {
      const { getDocs, query, collection, where, orderBy } =
        jest.requireMock("firebase/firestore");
      const mockQuerySnapshot = {
        docs: [
          {
            id: "restrict-1",
            data: () => ({
              userId: "user-1",
              restrictedUserId: "user-2",
              restrictedUserDisplayName: "Restricted User",
              type: "interaction",
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

      const result = await repository.getByRestrictedUser("user-2");

      expect(collection).toHaveBeenCalledWith(
        mockFirestore,
        "userRestrictions"
      );
      expect(where).toHaveBeenCalledWith("restrictedUserId", "==", "user-2");
      expect(orderBy).toHaveBeenCalledWith("createdAt", "desc");
      expect(result).toEqual([mockUserRestriction]);
    });

    it("should get user restriction by user and restricted user", async () => {
      const { getDocs, query, collection, where } =
        jest.requireMock("firebase/firestore");
      const mockQuerySnapshot = {
        empty: false,
        docs: [
          {
            id: "restrict-1",
            data: () => ({
              userId: "user-1",
              restrictedUserId: "user-2",
              restrictedUserDisplayName: "Restricted User",
              type: "interaction",
              createdAt: { toDate: () => new Date("2024-01-01") },
              updatedAt: { toDate: () => new Date("2024-01-01") },
            }),
          },
        ],
      };

      query.mockReturnValue({});
      collection.mockReturnValue({});
      where.mockReturnValue({});
      getDocs.mockResolvedValue(mockQuerySnapshot);

      const result = await repository.getByUserAndRestrictedUser(
        "user-1",
        "user-2"
      );

      expect(collection).toHaveBeenCalledWith(
        mockFirestore,
        "userRestrictions"
      );
      expect(where).toHaveBeenCalledWith("userId", "==", "user-1");
      expect(where).toHaveBeenCalledWith("restrictedUserId", "==", "user-2");
      expect(result).toEqual(mockUserRestriction);
    });

    it("should return null when no restriction found by user and restricted user", async () => {
      const { getDocs, query, collection, where } =
        jest.requireMock("firebase/firestore");
      const mockQuerySnapshot = {
        empty: true,
        docs: [],
      };

      query.mockReturnValue({});
      collection.mockReturnValue({});
      where.mockReturnValue({});
      getDocs.mockResolvedValue(mockQuerySnapshot);

      const result = await repository.getByUserAndRestrictedUser(
        "user-1",
        "user-2"
      );

      expect(result).toBeNull();
    });

    it("should return true when user is restricted", async () => {
      const { getDocs, query, collection, where } =
        jest.requireMock("firebase/firestore");
      const mockQuerySnapshot = {
        empty: false,
        docs: [
          {
            id: "restrict-1",
            data: () => ({
              userId: "user-1",
              restrictedUserId: "user-2",
              restrictedUserDisplayName: "Restricted User",
              type: "interaction",
              createdAt: { toDate: () => new Date("2024-01-01") },
              updatedAt: { toDate: () => new Date("2024-01-01") },
            }),
          },
        ],
      };

      query.mockReturnValue({});
      collection.mockReturnValue({});
      where.mockReturnValue({});
      getDocs.mockResolvedValue(mockQuerySnapshot);

      const result = await repository.isUserRestricted("user-1", "user-2");

      expect(result).toBe(true);
    });

    it("should return false when user is not restricted", async () => {
      const { getDocs, query, collection, where } =
        jest.requireMock("firebase/firestore");
      const mockQuerySnapshot = {
        empty: true,
        docs: [],
      };

      query.mockReturnValue({});
      collection.mockReturnValue({});
      where.mockReturnValue({});
      getDocs.mockResolvedValue(mockQuerySnapshot);

      const result = await repository.isUserRestricted("user-1", "user-2");

      expect(result).toBe(false);
    });
  });

  describe("Error Handling", () => {
    it("should handle error when saving user restriction", async () => {
      const { setDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "restrict-1" };

      doc.mockReturnValue(mockDocRef);
      setDoc.mockRejectedValue(new Error("Firestore error"));

      await expect(repository.save(mockUserRestriction)).rejects.toThrow(
        "Failed to save user restriction: Firestore error"
      );
    });

    it("should handle error when getting user restriction by ID", async () => {
      const { getDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "restrict-1" };

      doc.mockReturnValue(mockDocRef);
      getDoc.mockRejectedValue(new Error("Firestore error"));

      await expect(repository.getById("restrict-1")).rejects.toThrow(
        "Failed to get user restriction: Firestore error"
      );
    });

    it("should handle error when getting all user restrictions", async () => {
      const { getDocs, query, collection, orderBy } =
        jest.requireMock("firebase/firestore");

      query.mockReturnValue({});
      collection.mockReturnValue({});
      orderBy.mockReturnValue({});
      getDocs.mockRejectedValue(new Error("Firestore error"));

      await expect(repository.getAll()).rejects.toThrow(
        "Failed to get all user restrictions: Firestore error"
      );
    });

    it("should handle error when updating user restriction", async () => {
      const { updateDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "restrict-1" };

      doc.mockReturnValue(mockDocRef);
      updateDoc.mockRejectedValue(new Error("Firestore error"));

      await expect(
        repository.update("restrict-1", { type: "full" })
      ).rejects.toThrow("Failed to update user restriction: Firestore error");
    });

    it("should handle error when deleting user restriction", async () => {
      const { deleteDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "restrict-1" };

      doc.mockReturnValue(mockDocRef);
      deleteDoc.mockRejectedValue(new Error("Firestore error"));

      await expect(repository.delete("restrict-1")).rejects.toThrow(
        "Failed to delete user restriction: Firestore error"
      );
    });

    it("should handle error when getting user restrictions by user", async () => {
      const { getDocs, query, collection, where, orderBy } =
        jest.requireMock("firebase/firestore");

      query.mockReturnValue({});
      collection.mockReturnValue({});
      where.mockReturnValue({});
      orderBy.mockReturnValue({});
      getDocs.mockRejectedValue(new Error("Firestore error"));

      await expect(repository.getByUser("user-1")).rejects.toThrow(
        "Failed to get user restrictions: Firestore error"
      );
    });

    it("should handle error when getting user restrictions by restricted user", async () => {
      const { getDocs, query, collection, where, orderBy } =
        jest.requireMock("firebase/firestore");

      query.mockReturnValue({});
      collection.mockReturnValue({});
      where.mockReturnValue({});
      orderBy.mockReturnValue({});
      getDocs.mockRejectedValue(new Error("Firestore error"));

      await expect(repository.getByRestrictedUser("user-2")).rejects.toThrow(
        "Failed to get user restrictions by restricted user: Firestore error"
      );
    });

    it("should handle error when getting user restriction by user and restricted user", async () => {
      const { getDocs, query, collection, where } =
        jest.requireMock("firebase/firestore");

      query.mockReturnValue({});
      collection.mockReturnValue({});
      where.mockReturnValue({});
      getDocs.mockRejectedValue(new Error("Firestore error"));

      await expect(
        repository.getByUserAndRestrictedUser("user-1", "user-2")
      ).rejects.toThrow("Failed to get user restriction: Firestore error");
    });

    it("should handle error when checking if user is restricted", async () => {
      const { getDocs, query, collection, where } =
        jest.requireMock("firebase/firestore");

      query.mockReturnValue({});
      collection.mockReturnValue({});
      where.mockReturnValue({});
      getDocs.mockRejectedValue(new Error("Firestore error"));

      await expect(
        repository.isUserRestricted("user-1", "user-2")
      ).rejects.toThrow(
        "Failed to check if user is restricted: Failed to get user restriction: Firestore error"
      );
    });
  });

  describe("Edge Cases", () => {
    it("should handle document with no data in mapDocumentToUserRestriction", async () => {
      const { getDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "restrict-1" };
      const mockDocSnap = {
        id: "restrict-1",
        exists: () => true,
        data: () => null,
      };

      doc.mockReturnValue(mockDocRef);
      getDoc.mockResolvedValue(mockDocSnap);

      await expect(repository.getById("restrict-1")).rejects.toThrow(
        "Document restrict-1 has no data"
      );
    });

    it("should handle missing timestamp fields in mapDocumentToUserRestriction", async () => {
      const { getDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "restrict-1" };
      const mockDocSnap = {
        id: "restrict-1",
        exists: () => true,
        data: () => ({
          userId: "user-1",
          restrictedUserId: "user-2",
          restrictedUserDisplayName: "Restricted User",
          type: "interaction",
          // Missing createdAt and updatedAt
        }),
      };

      doc.mockReturnValue(mockDocRef);
      getDoc.mockResolvedValue(mockDocSnap);

      const result = await repository.getById("restrict-1");

      expect(result).toEqual({
        id: "restrict-1",
        userId: "user-1",
        restrictedUserId: "user-2",
        restrictedUserDisplayName: "Restricted User",
        type: "interaction",
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });
  });
});
