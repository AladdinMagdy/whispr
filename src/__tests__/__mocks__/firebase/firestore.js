// Mock Firebase Firestore
export const collection = jest.fn(() => ({
  addDoc: jest.fn().mockResolvedValue({ id: "test-doc-id" }),
}));

export const addDoc = jest.fn().mockResolvedValue({ id: "test-doc-id" });

export const serverTimestamp = jest.fn(() => new Date());