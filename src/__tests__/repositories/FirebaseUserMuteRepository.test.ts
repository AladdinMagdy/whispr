import { FirebaseUserMuteRepository } from "../../repositories/FirebaseUserMuteRepository";
import { UserMute } from "../../types";

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

describe("FirebaseUserMuteRepository", () => {
  let repository: FirebaseUserMuteRepository;
  let mockFirestore: any;

  const mockUserMute: UserMute = {
    id: "mute-1",
    userId: "user-1",
    mutedUserId: "user-2",
    mutedUserDisplayName: "Muted User",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new FirebaseUserMuteRepository();

    // Get the mocked firestore instance
    const { getFirestoreInstance } = jest.requireMock("../../config/firebase");
    mockFirestore = getFirestoreInstance();
  });

  describe("Basic CRUD Operations", () => {
    it("should save a user mute successfully", async () => {
      const { setDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "mute-1" };

      doc.mockReturnValue(mockDocRef);
      setDoc.mockResolvedValue(undefined);

      await repository.save(mockUserMute);

      expect(doc).toHaveBeenCalledWith(mockFirestore, "userMutes", "mute-1");
      expect(setDoc).toHaveBeenCalledWith(
        mockDocRef,
        expect.objectContaining({
          id: "mute-1",
          userId: "user-1",
          mutedUserId: "user-2",
          mutedUserDisplayName: "Muted User",
        })
      );
    });

    it("should get user mute by ID", async () => {
      const { getDoc, doc, Timestamp } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "mute-1" };
      const mockDocSnap = {
        id: "mute-1",
        exists: jest.fn(() => true),
        data: jest.fn(() => ({
          userId: "user-1",
          mutedUserId: "user-2",
          mutedUserDisplayName: "Muted User",
          createdAt: Timestamp.fromDate(new Date("2024-01-01")),
          updatedAt: Timestamp.fromDate(new Date("2024-01-01")),
        })),
      };

      doc.mockReturnValue(mockDocRef);
      getDoc.mockResolvedValue(mockDocSnap);

      const result = await repository.getById("mute-1");

      expect(doc).toHaveBeenCalledWith(mockFirestore, "userMutes", "mute-1");
      expect(getDoc).toHaveBeenCalledWith(mockDocRef);
      expect(result).toEqual(mockUserMute);
    });

    it("should return null when user mute does not exist", async () => {
      const { getDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "mute-1" };
      const mockDocSnap = {
        exists: jest.fn(() => false),
      };

      doc.mockReturnValue(mockDocRef);
      getDoc.mockResolvedValue(mockDocSnap);

      const result = await repository.getById("non-existent");

      expect(result).toBeNull();
    });

    it("should get all user mutes", async () => {
      const { getDocs, collection, query, orderBy, Timestamp } =
        jest.requireMock("firebase/firestore");
      const mockQuerySnapshot = {
        docs: [
          {
            id: "mute-1",
            data: () => ({
              userId: "user-1",
              mutedUserId: "user-2",
              mutedUserDisplayName: "Muted User",
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

      expect(collection).toHaveBeenCalledWith(mockFirestore, "userMutes");
      expect(query).toHaveBeenCalled();
      expect(orderBy).toHaveBeenCalledWith("createdAt", "desc");
      expect(getDocs).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockUserMute);
    });

    it("should update user mute", async () => {
      const { updateDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "mute-1" };
      const updates = { mutedUserDisplayName: "Updated Name" };

      doc.mockReturnValue(mockDocRef);
      updateDoc.mockResolvedValue(undefined);

      await repository.update("mute-1", updates);

      expect(doc).toHaveBeenCalledWith(mockFirestore, "userMutes", "mute-1");
      expect(updateDoc).toHaveBeenCalledWith(
        mockDocRef,
        expect.objectContaining({
          mutedUserDisplayName: "Updated Name",
          updatedAt: expect.any(Object),
        })
      );
    });

    it("should delete user mute", async () => {
      const { deleteDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "mute-1" };

      doc.mockReturnValue(mockDocRef);
      deleteDoc.mockResolvedValue(undefined);

      await repository.delete("mute-1");

      expect(doc).toHaveBeenCalledWith(mockFirestore, "userMutes", "mute-1");
      expect(deleteDoc).toHaveBeenCalledWith(mockDocRef);
    });
  });

  describe("Error Handling", () => {
    it("should handle save errors", async () => {
      const { setDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "mute-1" };
      const error = new Error("Firestore error");

      doc.mockReturnValue(mockDocRef);
      setDoc.mockRejectedValue(error);

      await expect(repository.save(mockUserMute)).rejects.toThrow(
        "Failed to save user mute: Firestore error"
      );
    });

    it("should handle get by ID errors", async () => {
      const { getDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "mute-1" };
      const error = new Error("Firestore error");

      doc.mockReturnValue(mockDocRef);
      getDoc.mockRejectedValue(error);

      await expect(repository.getById("mute-1")).rejects.toThrow(
        "Failed to get user mute: Firestore error"
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
        "Failed to get all user mutes: Firestore error"
      );
    });

    it("should handle update errors", async () => {
      const { updateDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "mute-1" };
      const error = new Error("Firestore error");

      doc.mockReturnValue(mockDocRef);
      updateDoc.mockRejectedValue(error);

      await expect(
        repository.update("mute-1", { mutedUserDisplayName: "Updated" })
      ).rejects.toThrow("Failed to update user mute: Firestore error");
    });

    it("should handle delete errors", async () => {
      const { deleteDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "mute-1" };
      const error = new Error("Firestore error");

      doc.mockReturnValue(mockDocRef);
      deleteDoc.mockRejectedValue(error);

      await expect(repository.delete("mute-1")).rejects.toThrow(
        "Failed to delete user mute: Firestore error"
      );
    });
  });

  describe("Query Methods", () => {
    it("should get mutes by user", async () => {
      const { collection, query, where, orderBy, getDocs, Timestamp } =
        jest.requireMock("firebase/firestore");
      const mockQuerySnapshot = {
        docs: [
          {
            id: "mute-1",
            data: () => ({
              userId: "user-1",
              mutedUserId: "user-2",
              mutedUserDisplayName: "Muted User",
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

      expect(collection).toHaveBeenCalledWith(mockFirestore, "userMutes");
      expect(query).toHaveBeenCalled();
      expect(where).toHaveBeenCalledWith("userId", "==", "user-1");
      expect(orderBy).toHaveBeenCalledWith("createdAt", "desc");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockUserMute);
    });

    it("should get mutes by muted user", async () => {
      const { collection, query, where, orderBy, getDocs, Timestamp } =
        jest.requireMock("firebase/firestore");
      const mockQuerySnapshot = {
        docs: [
          {
            id: "mute-1",
            data: () => ({
              userId: "user-1",
              mutedUserId: "user-2",
              mutedUserDisplayName: "Muted User",
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

      const result = await repository.getByMutedUser("user-2");

      expect(collection).toHaveBeenCalledWith(mockFirestore, "userMutes");
      expect(query).toHaveBeenCalled();
      expect(where).toHaveBeenCalledWith("mutedUserId", "==", "user-2");
      expect(orderBy).toHaveBeenCalledWith("createdAt", "desc");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockUserMute);
    });

    it("should get mute by user and muted user", async () => {
      const { collection, query, where, getDocs, Timestamp } =
        jest.requireMock("firebase/firestore");
      const mockQuerySnapshot = {
        empty: false,
        docs: [
          {
            id: "mute-1",
            data: () => ({
              userId: "user-1",
              mutedUserId: "user-2",
              mutedUserDisplayName: "Muted User",
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

      const result = await repository.getByUserAndMutedUser("user-1", "user-2");

      expect(collection).toHaveBeenCalledWith(mockFirestore, "userMutes");
      expect(query).toHaveBeenCalled();
      expect(where).toHaveBeenCalledWith("userId", "==", "user-1");
      expect(where).toHaveBeenCalledWith("mutedUserId", "==", "user-2");
      expect(result).toEqual(mockUserMute);
    });

    it("should return null when no mute found by user and muted user", async () => {
      const { collection, query, where, getDocs } =
        jest.requireMock("firebase/firestore");
      const mockQuerySnapshot = {
        empty: true,
        docs: [],
      };

      collection.mockReturnValue({});
      query.mockReturnValue({});
      where.mockReturnValue({});
      getDocs.mockResolvedValue(mockQuerySnapshot);

      const result = await repository.getByUserAndMutedUser("user-1", "user-3");

      expect(result).toBeNull();
    });

    it("should check if user is muted", async () => {
      const { collection, query, where, getDocs, Timestamp } =
        jest.requireMock("firebase/firestore");
      const mockQuerySnapshot = {
        empty: false,
        docs: [
          {
            id: "mute-1",
            data: () => ({
              userId: "user-1",
              mutedUserId: "user-2",
              mutedUserDisplayName: "Muted User",
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

      const result = await repository.isUserMuted("user-1", "user-2");

      expect(collection).toHaveBeenCalledWith(mockFirestore, "userMutes");
      expect(query).toHaveBeenCalled();
      expect(where).toHaveBeenCalledWith("userId", "==", "user-1");
      expect(where).toHaveBeenCalledWith("mutedUserId", "==", "user-2");
      expect(result).toBe(true);
    });

    it("should return false when user is not muted", async () => {
      const { collection, query, where, getDocs } =
        jest.requireMock("firebase/firestore");
      const mockQuerySnapshot = {
        empty: true,
        docs: [],
      };

      collection.mockReturnValue({});
      query.mockReturnValue({});
      where.mockReturnValue({});
      getDocs.mockResolvedValue(mockQuerySnapshot);

      const result = await repository.isUserMuted("user-1", "user-3");

      expect(result).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    it("should handle document with no data", async () => {
      const { getDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "mute-1" };
      const mockDocSnap = {
        id: "mute-1",
        exists: jest.fn(() => true),
        data: jest.fn(() => null),
      };

      doc.mockReturnValue(mockDocRef);
      getDoc.mockResolvedValue(mockDocSnap);

      await expect(repository.getById("mute-1")).rejects.toThrow(
        "Document mute-1 has no data"
      );
    });

    it("should handle missing timestamp fields", async () => {
      const { getDoc, doc } = jest.requireMock("firebase/firestore");
      const mockDocRef = { id: "mute-1" };
      const mockDocSnap = {
        id: "mute-1",
        exists: jest.fn(() => true),
        data: jest.fn(() => ({
          userId: "user-1",
          mutedUserId: "user-2",
          mutedUserDisplayName: "Muted User",
          // Missing createdAt and updatedAt
        })),
      };

      doc.mockReturnValue(mockDocRef);
      getDoc.mockResolvedValue(mockDocSnap);

      const result = await repository.getById("mute-1");

      expect(result).toEqual({
        id: "mute-1",
        userId: "user-1",
        mutedUserId: "user-2",
        mutedUserDisplayName: "Muted User",
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });
  });
});
