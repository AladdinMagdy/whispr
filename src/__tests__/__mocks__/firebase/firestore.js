// Mock Firebase Firestore
export const collection = jest.fn(() => ({
  addDoc: jest.fn().mockResolvedValue({ id: "test-doc-id" }),
}));

export const addDoc = jest.fn().mockResolvedValue({ id: "test-doc-id" });

export const serverTimestamp = jest.fn(() => new Date());

// Query functions
export const orderBy = jest.fn((field, direction) => ({ type: "orderBy", field, direction }));
export const where = jest.fn((field, operator, value) => ({ type: "where", field, operator, value }));
export const limit = jest.fn((count) => ({ type: "limit", count }));
export const startAfter = jest.fn((doc) => ({ type: "startAfter", doc }));

// Document functions
export const doc = jest.fn((firestore, collection, id) => ({ id, collection }));
export const getDoc = jest.fn().mockResolvedValue({ exists: () => true, data: () => ({}) });
export const getDocs = jest.fn().mockResolvedValue({
  docs: [],
  forEach: jest.fn(),
  empty: true
});
export const updateDoc = jest.fn().mockResolvedValue(undefined);
export const deleteDoc = jest.fn().mockResolvedValue(undefined);
export const setDoc = jest.fn().mockResolvedValue(undefined);

// Query functions
export const query = jest.fn((collection, ...constraints) => ({ collection, constraints }));
export const onSnapshot = jest.fn(() => jest.fn()); // Returns unsubscribe function

// Field value
export const increment = jest.fn((value) => ({ type: "increment", value }));

// Types
export const Timestamp = {
  fromDate: jest.fn((date) => ({ toDate: () => date })),
  now: jest.fn(() => ({ toDate: () => new Date() })),
};

export const FieldValue = {
  serverTimestamp: jest.fn(() => new Date()),
};