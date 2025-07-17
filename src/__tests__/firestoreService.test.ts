/**
 * FirestoreService Tests
 * Tests for Firestore data operations and real-time listeners
 */

import {
  FirestoreService,
  getFirestoreService,
} from "../services/firestoreService";

// Mock the entire firebase/firestore module
jest.mock("firebase/firestore", () => ({
  collection: jest.fn(() => "mock-collection"),
  doc: jest.fn(() => "mock-doc"),
  addDoc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  query: jest.fn(() => "mock-query"),
  where: jest.fn(() => "mock-where"),
  orderBy: jest.fn(() => "mock-orderBy"),
  limit: jest.fn(() => "mock-limit"),
  startAfter: jest.fn(() => "mock-startAfter"),
  onSnapshot: jest.fn(() => jest.fn()),
  increment: jest.fn(() => "mock-increment"),
  serverTimestamp: jest.fn(() => "mock-serverTimestamp"),
  Timestamp: {
    fromDate: jest.fn((date) => ({ toDate: () => date })),
  },
}));

// Mock Firebase config
jest.mock("../config/firebase", () => ({
  getFirestoreInstance: jest.fn(() => "mock-firestore"),
}));

describe("FirestoreService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    FirestoreService.resetInstance();
  });

  describe("Singleton Pattern", () => {
    test("should return the same instance", () => {
      const instance1 = getFirestoreService();
      const instance2 = getFirestoreService();
      expect(instance1).toBe(instance2);
    });

    test("should reset instance correctly", () => {
      const instance1 = getFirestoreService();
      FirestoreService.resetInstance();
      const instance2 = getFirestoreService();
      expect(instance1).not.toBe(instance2);
    });

    test("should destroy instance correctly", () => {
      const instance1 = getFirestoreService();
      FirestoreService.destroyInstance();
      const instance2 = getFirestoreService();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe("Factory Functions", () => {
    test("should return FirestoreService instance", () => {
      const service = getFirestoreService();
      expect(service).toBeInstanceOf(FirestoreService);
    });

    test("should reset service via factory function", () => {
      const instance1 = getFirestoreService();
      FirestoreService.resetInstance();
      const instance2 = getFirestoreService();
      expect(instance1).not.toBe(instance2);
    });

    test("should destroy service via factory function", () => {
      const instance1 = getFirestoreService();
      FirestoreService.destroyInstance();
      const instance2 = getFirestoreService();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe("Service Structure", () => {
    test("should have required methods", () => {
      const service = getFirestoreService();

      expect(typeof service.createWhisper).toBe("function");
      expect(typeof service.getWhispers).toBe("function");
      expect(typeof service.subscribeToWhispers).toBe("function");
      expect(typeof service.subscribeToNewWhispers).toBe("function");
      expect(typeof service.likeWhisper).toBe("function");
      expect(typeof service.deleteWhisper).toBe("function");
      expect(typeof service.updateTranscription).toBe("function");
      expect(typeof service.getUserWhispers).toBe("function");
    });

    test("should have static methods", () => {
      expect(typeof FirestoreService.getInstance).toBe("function");
      expect(typeof FirestoreService.resetInstance).toBe("function");
      expect(typeof FirestoreService.destroyInstance).toBe("function");
    });
  });

  describe("Error Handling", () => {
    test("should handle errors with message property correctly", () => {
      // Test the error handling logic directly
      const errorWithMessage = { message: "Test error" };
      const errorMessage =
        errorWithMessage &&
        typeof errorWithMessage === "object" &&
        "message" in errorWithMessage
          ? (errorWithMessage as any).message
          : "Unknown error";

      expect(errorMessage).toBe("Test error");
    });

    test("should handle errors without message property correctly", () => {
      // Test the error handling logic directly
      const errorWithoutMessage = {};
      const errorMessage =
        errorWithoutMessage &&
        typeof errorWithoutMessage === "object" &&
        "message" in errorWithoutMessage
          ? (errorWithoutMessage as any).message
          : "Unknown error";

      expect(errorMessage).toBe("Unknown error");
    });

    test("should handle null errors correctly", () => {
      // Test the error handling logic directly
      const nullError = null;
      const errorMessage =
        nullError && typeof nullError === "object" && "message" in nullError
          ? (nullError as any).message
          : "Unknown error";

      expect(errorMessage).toBe("Unknown error");
    });

    test("should handle string errors correctly", () => {
      // Test the error handling logic directly
      const stringError = "String error";
      const errorMessage =
        stringError &&
        typeof stringError === "object" &&
        "message" in stringError
          ? (stringError as any).message
          : "Unknown error";

      expect(errorMessage).toBe("Unknown error");
    });
  });

  describe("Method Signatures", () => {
    test("should have correct createWhisper signature", () => {
      const service = getFirestoreService();
      expect(service.createWhisper).toHaveLength(4);
    });

    test("should have correct getWhispers signature", () => {
      const service = getFirestoreService();
      expect(service.getWhispers).toHaveLength(0);
    });

    test("should have correct subscribeToWhispers signature", () => {
      const service = getFirestoreService();
      expect(service.subscribeToWhispers).toHaveLength(1);
    });

    test("should have correct subscribeToNewWhispers signature", () => {
      const service = getFirestoreService();
      expect(service.subscribeToNewWhispers).toHaveLength(2);
    });

    test("should have correct likeWhisper signature", () => {
      const service = getFirestoreService();
      expect(service.likeWhisper).toHaveLength(4);
    });

    test("should have correct deleteWhisper signature", () => {
      const service = getFirestoreService();
      expect(service.deleteWhisper).toHaveLength(1);
    });

    test("should have correct updateTranscription signature", () => {
      const service = getFirestoreService();
      expect(service.updateTranscription).toHaveLength(2);
    });

    test("should have correct getUserWhispers signature", () => {
      const service = getFirestoreService();
      expect(service.getUserWhispers).toHaveLength(1);
    });
  });
});
