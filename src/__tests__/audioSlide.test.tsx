import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import AudioSlide from "../components/AudioSlide";
import { Whisper } from "../types";

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
    const { Audio } = require("expo-av");

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
        { uri: mockWhisper.audioUrl },
        { shouldPlay: false, isLooping: true },
        expect.any(Function)
      );
    });
  });

  it("plays audio when active and visible", async () => {
    const { Audio } = require("expo-av");
    const mockSound = {
      playAsync: jest.fn(),
      pauseAsync: jest.fn(),
      unloadAsync: jest.fn(),
    };

    Audio.Sound.createAsync.mockResolvedValue({ sound: mockSound });

    render(
      <AudioSlide whisper={mockWhisper} isVisible={true} isActive={true} />
    );

    await waitFor(() => {
      expect(mockSound.playAsync).toHaveBeenCalled();
    });
  });

  it("pauses audio when not active", async () => {
    const { Audio } = require("expo-av");
    const mockSound = {
      playAsync: jest.fn(),
      pauseAsync: jest.fn(),
      unloadAsync: jest.fn(),
    };

    Audio.Sound.createAsync.mockResolvedValue({ sound: mockSound });

    render(
      <AudioSlide whisper={mockWhisper} isVisible={true} isActive={false} />
    );

    await waitFor(() => {
      expect(mockSound.pauseAsync).toHaveBeenCalled();
    });
  });

  it("cleans up audio when unmounting", async () => {
    const { Audio } = require("expo-av");
    const mockSound = {
      playAsync: jest.fn(),
      pauseAsync: jest.fn(),
      unloadAsync: jest.fn(),
    };

    Audio.Sound.createAsync.mockResolvedValue({ sound: mockSound });

    const { unmount } = render(
      <AudioSlide whisper={mockWhisper} isVisible={true} isActive={true} />
    );

    // Wait for audio to be initialized
    await waitFor(() => {
      expect(Audio.Sound.createAsync).toHaveBeenCalled();
    });

    unmount();

    // Wait longer for cleanup to complete
    await waitFor(
      () => {
        expect(mockSound.unloadAsync).toHaveBeenCalled();
      },
      { timeout: 3000 }
    );
  });
});
