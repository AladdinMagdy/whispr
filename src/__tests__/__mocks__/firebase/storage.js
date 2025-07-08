// Mock Firebase Storage
export const ref = jest.fn(() => ({
  put: jest.fn().mockResolvedValue({
    ref: { getDownloadURL: jest.fn().mockResolvedValue("mock-url") },
  }),
}));

export const uploadBytes = jest.fn().mockResolvedValue({
  ref: { getDownloadURL: jest.fn().mockResolvedValue("mock-url") },
});

export const uploadBytesResumable = jest.fn(() => ({
  on: jest.fn((event, next) => {
    if (event === "state_changed") {
      // Simulate progress
      next({
        bytesTransferred: 512,
        totalBytes: 1024,
      });
      // Simulate completion
      next({
        bytesTransferred: 1024,
        totalBytes: 1024,
      });
    }
    return Promise.resolve();
  }),
}));

export const getDownloadURL = jest.fn().mockResolvedValue("mock-url");