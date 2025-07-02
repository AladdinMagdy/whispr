// Mock @firebase/firestore
export const getFirestore = jest.fn(() => ({
  app: { name: "test-app" },
}));

export const collection = jest.fn(() => ({
  addDoc: jest.fn().mockResolvedValue({ id: "test-doc-id" }),
}));

export const addDoc = jest.fn().mockResolvedValue({ id: "test-doc-id" });

export const serverTimestamp = jest.fn(() => new Date());