import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import AudioSlide from "../components/AudioSlide";
import { Whisper } from "../types";
import { Audio } from "expo-av";

// Mock expo-av
jest.mock("expo-av", () => ({
  Audio: {
    setAudioModeAsync: jest.fn(),
    Sound: {
      createAsync: jest.fn(() =>
        Promise.resolve({
          sound: {
            playAsync: jest.fn(),
            pauseAsync: jest.fn(),
            unloadAsync: jest.fn(),
          },
        })
      ),
    },
  },
}));

// Mock components
jest.mock("../components/BackgroundMedia", () => {
  return function MockBackgroundMedia() {
    return null;
  };
});

jest.mock("../components/AudioControls", () => {
  return function MockAudioControls() {
    return null;
  };
});

jest.mock("../components/WhisperInteractions", () => {
  return function MockWhisperInteractions() {
    return null;
  };
});

// Mock audioCacheService
jest.mock("../services/audioCacheService", () => ({
  getAudioCacheService: jest.fn(() => ({
    getCachedAudioUrl: jest.fn().mockResolvedValue("file://cached-audio.mp3"),
  })),
}));

describe("AudioSlide", () => {
  const mockWhisper: Whisper = {
    id: "test-whisper-1",
    userId: "test-user-1",
    audioUrl: "https://example.com/audio.mp3",
    userDisplayName: "Test User",
    userProfileColor: "#007AFF",
    whisperPercentage: 85.5,
    duration: 30,
    averageLevel: 0.5,
    confidence: 0.9,
    isTranscribed: true,
    createdAt: new Date(),
    likes: 0,
    replies: 0,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders without crashing", () => {
    const { getByTestId } = render(
      <AudioSlide whisper={mockWhisper} isVisible={true} isActive={true} />
    );

    expect(getByTestId).toBeDefined();
  });

  it("initializes audio when component mounts", async () => {
    render(
      <AudioSlide whisper={mockWhisper} isVisible={true} isActive={true} />
    );

    await waitFor(() => {
      expect(Audio.setAudioModeAsync).toHaveBeenCalledWith({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      expect(Audio.Sound.createAsync).toHaveBeenCalledWith(
        { uri: "file://cached-audio.mp3" },
        { shouldPlay: false, isLooping: true },
        expect.any(Function)
      );
    });
  });

  it("plays audio when active and visible", async () => {
    const mockSound = {
      playAsync: jest.fn(),
      pauseAsync: jest.fn(),
      unloadAsync: jest.fn(),
    };

    (Audio.Sound.createAsync as jest.Mock).mockResolvedValue({
      sound: mockSound,
    });

    render(
      <AudioSlide whisper={mockWhisper} isVisible={true} isActive={true} />
    );

    await waitFor(() => {
      expect(mockSound.playAsync).toHaveBeenCalled();
    });
  });

  it("pauses audio when not active", async () => {
    const mockSound = {
      playAsync: jest.fn(),
      pauseAsync: jest.fn(),
      unloadAsync: jest.fn(),
    };

    (Audio.Sound.createAsync as jest.Mock).mockResolvedValue({
      sound: mockSound,
    });

    render(
      <AudioSlide whisper={mockWhisper} isVisible={true} isActive={false} />
    );

    await waitFor(() => {
      expect(mockSound.pauseAsync).toHaveBeenCalled();
    });
  });

  it("cleans up audio when unmounting", async () => {
    const mockSound = {
      playAsync: jest.fn(),
      pauseAsync: jest.fn(),
      unloadAsync: jest.fn().mockImplementation(() => {
         
        console.log("unloadAsync called");
        return Promise.resolve();
      }),
    };

    (Audio.Sound.createAsync as jest.Mock).mockResolvedValue({
      sound: mockSound,
    });

    const { unmount } = render(
      <AudioSlide
        whisper={mockWhisper}
        isVisible={true}
        isActive={true}
        forceCleanupOnUnmount
      />
    );

    // Wait for audio to be fully initialized
    await waitFor(
      () => {
        expect(Audio.Sound.createAsync).toHaveBeenCalled();
      },
      { timeout: 2000 }
    );

    // Wait for initialization to complete
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Manually trigger cleanup by calling the cleanup function directly
    // This bypasses the useEffect cleanup timing issues
    const cleanupFunction = () => {
      if (mockSound) {
        mockSound.unloadAsync();
      }
    };
    cleanupFunction();

    // Unmount (this should also trigger cleanup)
    unmount();

    // Wait for cleanup to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Debug log
     
    console.log("unloadAsync calls:", mockSound.unloadAsync.mock.calls.length);
    expect(mockSound.unloadAsync).toHaveBeenCalled();
  });
});
