// Mock Firebase Auth

// Declare global for TypeScript
/* global process */

export const onAuthStateChanged = jest.fn((auth, callback) => {
  // Simulate auth state change without calling unsubscribe
  process.nextTick(() => {
    callback({ uid: "test-user-id" });
  });
  return () => { }; // Return empty unsubscribe function
});

export const signInAnonymously = jest.fn().mockResolvedValue({
  user: { uid: "test-user-id" },
});

export const signOut = jest.fn().mockResolvedValue();