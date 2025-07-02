// Mock @firebase/auth
export const getAuth = jest.fn(() => ({
  currentUser: { uid: "test-user-id" },
}));

export const onAuthStateChanged = jest.fn((auth, callback) => {
  // Simulate auth state change without calling unsubscribe
  setTimeout(() => {
    callback({ uid: "test-user-id" });
  }, 0);
  return () => { }; // Return empty unsubscribe function
});

export const signInAnonymously = jest.fn().mockResolvedValue({
  user: { uid: "test-user-id" },
});

export const signOut = jest.fn().mockResolvedValue();