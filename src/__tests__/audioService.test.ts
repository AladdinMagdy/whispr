import type { AudioTrack } from "../services/audioService";
// Do not import any runtime modules here

let audioService: any;
let AudioUtils: any;
let getAudioCacheService: any;
let TrackPlayer: any;

// Mock react-native-track-player
jest.mock("react-native-track-player", () => ({
  setupPlayer: jest.fn(),
  reset: jest.fn(),
  add: jest.fn(),
  skip: jest.fn(),
  play: jest.fn(),
  pause: jest.fn(),
  stop: jest.fn(),
  getState: jest.fn(),
  State: { Playing: "playing", None: "none" },
}));

// Mock audioCacheService
jest.mock("../services/audioCacheService", () => ({
  getAudioCacheService: jest.fn(() => ({
    getCachedAudioUrl: jest.fn(),
    preloadTracks: jest.fn(),
    getCacheStats: jest.fn(),
    clearCache: jest.fn(),
  })),
}));

// Mock constants
jest.mock("../constants/whisperValidation", () => ({
  WHISPER_COLORS: {
    SUCCESS: "#4CAF50",
    LOUD: "#F44336",
  },
}));

// Patch: Reset global and singleton state before and after each test
const resetAudioServiceState = () => {
  // Reset singleton internal state
  (audioService as any).tracks = [];
  (audioService as any).currentTrackIndex = 0;
  (audioService as any).lastScrollPosition = 0;
  // Reset global isPlayerInitialized
  // @ts-ignore
  global.isPlayerInitialized = false;
  // Patch the module-level variable if possible
  try {
    // @ts-ignore
    require("../services/audioService").isPlayerInitialized = false;
  } catch {}
};

describe("AudioService", () => {
  let mockAudioCacheService: any;
  let mockTrackPlayer: any;

  const sampleTracks: AudioTrack[] = [
    {
      id: "1",
      title: "Test Track 1",
      artist: "Test Artist 1",
      url: "https://example.com/audio1.mp3",
    },
    {
      id: "2",
      title: "Test Track 2",
      artist: "Test Artist 2",
      url: "https://example.com/audio2.mp3",
    },
  ];

  beforeEach(() => {
    jest.resetModules(); // Reset module registry to reload singletons and globals
    // Re-require modules after resetModules
    ({ audioService, AudioUtils } = require("../services/audioService"));
    getAudioCacheService =
      require("../services/audioCacheService").getAudioCacheService;
    TrackPlayer = require("react-native-track-player");

    jest.clearAllMocks();
    resetAudioServiceState();

    // Always return a fresh mock for audioCacheService
    mockAudioCacheService = {
      getCachedAudioUrl: jest.fn().mockResolvedValue("cached-url"),
      preloadTracks: jest.fn().mockResolvedValue(undefined),
      getCacheStats: jest.fn().mockReturnValue({ usagePercentage: 50 }),
      clearCache: jest.fn().mockResolvedValue(undefined),
    };
    (getAudioCacheService as jest.Mock).mockReturnValue(mockAudioCacheService);
    mockTrackPlayer = TrackPlayer as jest.Mocked<typeof TrackPlayer>;
    mockTrackPlayer.setupPlayer.mockResolvedValue(undefined);
    mockTrackPlayer.reset.mockResolvedValue(undefined);
    mockTrackPlayer.add.mockResolvedValue(undefined);
    mockTrackPlayer.skip.mockResolvedValue(undefined);
    mockTrackPlayer.play.mockResolvedValue(undefined);
    mockTrackPlayer.pause.mockResolvedValue(undefined);
    mockTrackPlayer.stop.mockResolvedValue(undefined);
    mockTrackPlayer.getState.mockResolvedValue("playing");
    // Patch the singleton's audioCacheService property to use the mock
    audioService.audioCacheService = mockAudioCacheService;
  });

  afterEach(() => {
    jest.resetModules();
    resetAudioServiceState();
  });

  describe("initialize", () => {
    it("should initialize the player successfully", async () => {
      await audioService.initialize(sampleTracks);

      expect(mockTrackPlayer.setupPlayer).toHaveBeenCalled();
      expect(mockTrackPlayer.reset).toHaveBeenCalled();
      expect(mockTrackPlayer.add).toHaveBeenCalledWith(sampleTracks);
      expect(audioService.isInitialized()).toBe(true);
    });

    it("should not reinitialize if already initialized", async () => {
      await audioService.initialize(sampleTracks);
      await audioService.initialize(sampleTracks);

      expect(mockTrackPlayer.setupPlayer).toHaveBeenCalledTimes(1);
    });

    it("should handle initialization errors", async () => {
      const error = new Error("Setup failed");
      mockTrackPlayer.setupPlayer.mockRejectedValue(error);

      await expect(audioService.initialize(sampleTracks)).rejects.toThrow(
        "Setup failed"
      );
      expect(audioService.isInitialized()).toBe(false);
    });

    it("should preload tracks during initialization", async () => {
      await audioService.initialize(sampleTracks);

      expect(mockAudioCacheService.getCachedAudioUrl).toHaveBeenCalledWith(
        sampleTracks[0].url
      );
      expect(mockAudioCacheService.getCachedAudioUrl).toHaveBeenCalledWith(
        sampleTracks[1].url
      );
    });

    it("should handle preload errors gracefully", async () => {
      mockAudioCacheService.getCachedAudioUrl.mockRejectedValue(
        new Error("Preload failed")
      );

      await audioService.initialize(sampleTracks);

      expect(audioService.isInitialized()).toBe(true);
      expect(mockTrackPlayer.setupPlayer).toHaveBeenCalled();
    });
  });

  describe("setTracks", () => {
    beforeEach(async () => {
      await audioService.initialize();
    });

    it("should update tracks when tracks are different", async () => {
      await audioService.setTracks(sampleTracks);

      expect(mockTrackPlayer.reset).toHaveBeenCalled();
      expect(mockTrackPlayer.add).toHaveBeenCalledWith(sampleTracks);
      expect((audioService as any).currentTrackIndex).toBe(0);
    });

    it("should not update tracks when tracks are the same", async () => {
      await audioService.setTracks(sampleTracks);
      await audioService.setTracks(sampleTracks);

      expect(mockTrackPlayer.reset).toHaveBeenCalledTimes(1);
      expect(mockTrackPlayer.add).toHaveBeenCalledTimes(1);
    });

    it("should handle different track lengths", async () => {
      await audioService.setTracks(sampleTracks);
      await audioService.setTracks([sampleTracks[0]]);

      expect(mockTrackPlayer.reset).toHaveBeenCalledTimes(2);
    });

    it("should handle different track IDs", async () => {
      const modifiedTracks = [
        { ...sampleTracks[0], id: "modified-1" },
        sampleTracks[1],
      ];

      await audioService.setTracks(sampleTracks);
      await audioService.setTracks(modifiedTracks);

      expect(mockTrackPlayer.reset).toHaveBeenCalledTimes(2);
    });
  });

  describe("playTrack", () => {
    beforeEach(async () => {
      await audioService.initialize(sampleTracks);
    });

    it("should play track by ID successfully", async () => {
      await audioService.playTrack("1");

      expect(mockTrackPlayer.skip).toHaveBeenCalledWith(0);
      expect(mockTrackPlayer.play).toHaveBeenCalled();
      expect((audioService as any).currentTrackIndex).toBe(0);
    });

    it("should throw error if not initialized", async () => {
      await audioService.destroy();

      await expect(audioService.playTrack("1")).rejects.toThrow(
        "AudioService not initialized"
      );
    });

    it("should throw error if track not found", async () => {
      await expect(audioService.playTrack("nonexistent")).rejects.toThrow(
        "Track with id nonexistent not found"
      );
    });
  });

  describe("playTrackByIndex", () => {
    beforeEach(async () => {
      await audioService.initialize(sampleTracks);
    });

    it("should play track by index successfully", async () => {
      await audioService.playTrackByIndex(1);

      expect(mockTrackPlayer.skip).toHaveBeenCalledWith(1);
      expect(mockTrackPlayer.play).toHaveBeenCalled();
      expect((audioService as any).currentTrackIndex).toBe(1);
    });

    it("should preload next tracks when playing", async () => {
      await audioService.playTrackByIndex(0);

      expect(mockAudioCacheService.preloadTracks).toHaveBeenCalledWith(
        sampleTracks,
        0,
        3
      );
    });

    it("should not play if index is out of bounds", async () => {
      await audioService.playTrackByIndex(10);

      expect(mockTrackPlayer.skip).not.toHaveBeenCalled();
      expect(mockTrackPlayer.play).not.toHaveBeenCalled();
    });

    it("should not play if not initialized", async () => {
      await audioService.destroy();

      await audioService.playTrackByIndex(0);

      expect(mockTrackPlayer.skip).not.toHaveBeenCalled();
      expect(mockTrackPlayer.play).not.toHaveBeenCalled();
    });
  });

  describe("playback controls", () => {
    beforeEach(async () => {
      await audioService.initialize(sampleTracks);
    });

    it("should play successfully", async () => {
      await audioService.play();

      expect(mockTrackPlayer.play).toHaveBeenCalled();
    });

    it("should pause successfully", async () => {
      await audioService.pause();

      expect(mockTrackPlayer.pause).toHaveBeenCalled();
    });

    it("should stop successfully", async () => {
      await audioService.stop();

      expect(mockTrackPlayer.stop).toHaveBeenCalled();
    });

    it("should not call playback methods if not initialized", async () => {
      await audioService.destroy();

      await audioService.play();
      await audioService.pause();
      await audioService.stop();

      expect(mockTrackPlayer.play).not.toHaveBeenCalled();
      expect(mockTrackPlayer.pause).not.toHaveBeenCalled();
      expect(mockTrackPlayer.stop).not.toHaveBeenCalled();
    });
  });

  describe("skipToNext", () => {
    beforeEach(async () => {
      await audioService.initialize(sampleTracks);
    });

    it("should skip to next track", async () => {
      (audioService as any).currentTrackIndex = 0;
      await audioService.skipToNext();

      expect(mockTrackPlayer.skip).toHaveBeenCalledWith(1);
      expect(mockTrackPlayer.play).toHaveBeenCalled();
    });

    it("should wrap around to first track when at last track", async () => {
      (audioService as any).currentTrackIndex = 1;
      await audioService.skipToNext();

      expect(mockTrackPlayer.skip).toHaveBeenCalledWith(0);
      expect(mockTrackPlayer.play).toHaveBeenCalled();
    });

    it("should not skip if not initialized", async () => {
      await audioService.destroy();

      await audioService.skipToNext();

      expect(mockTrackPlayer.skip).not.toHaveBeenCalled();
      expect(mockTrackPlayer.play).not.toHaveBeenCalled();
    });

    it("should not skip if no tracks", async () => {
      (audioService as any).tracks = [];

      await audioService.skipToNext();

      expect(mockTrackPlayer.skip).not.toHaveBeenCalled();
      expect(mockTrackPlayer.play).not.toHaveBeenCalled();
    });
  });

  describe("skipToPrevious", () => {
    beforeEach(async () => {
      await audioService.initialize(sampleTracks);
    });

    it("should skip to previous track", async () => {
      (audioService as any).currentTrackIndex = 1;
      await audioService.skipToPrevious();

      expect(mockTrackPlayer.skip).toHaveBeenCalledWith(0);
      expect(mockTrackPlayer.play).toHaveBeenCalled();
    });

    it("should wrap around to last track when at first track", async () => {
      (audioService as any).currentTrackIndex = 0;
      await audioService.skipToPrevious();

      expect(mockTrackPlayer.skip).toHaveBeenCalledWith(1);
      expect(mockTrackPlayer.play).toHaveBeenCalled();
    });

    it("should not skip if not initialized", async () => {
      await audioService.destroy();

      await audioService.skipToPrevious();

      expect(mockTrackPlayer.skip).not.toHaveBeenCalled();
      expect(mockTrackPlayer.play).not.toHaveBeenCalled();
    });

    it("should not skip if no tracks", async () => {
      (audioService as any).tracks = [];

      await audioService.skipToPrevious();

      expect(mockTrackPlayer.skip).not.toHaveBeenCalled();
      expect(mockTrackPlayer.play).not.toHaveBeenCalled();
    });
  });

  describe("getCurrentTrack", () => {
    beforeEach(async () => {
      await audioService.initialize(sampleTracks);
    });

    it("should return current track", async () => {
      (audioService as any).currentTrackIndex = 1;
      const track = await audioService.getCurrentTrack();

      expect(track).toEqual(sampleTracks[1]);
    });

    it("should return null if not initialized", async () => {
      await audioService.destroy();

      const track = await audioService.getCurrentTrack();

      expect(track).toBeNull();
    });

    it("should return null if no tracks", async () => {
      (audioService as any).tracks = [];

      const track = await audioService.getCurrentTrack();

      expect(track).toBeNull();
    });
  });

  describe("getCurrentTrackIndex", () => {
    beforeEach(async () => {
      await audioService.initialize(sampleTracks);
    });

    it("should return current track index", async () => {
      (audioService as any).currentTrackIndex = 1;
      const index = await audioService.getCurrentTrackIndex();

      expect(index).toBe(1);
    });
  });

  describe("setCurrentTrackIndex", () => {
    it("should set current track index", () => {
      audioService.setCurrentTrackIndex(2);

      expect((audioService as any).currentTrackIndex).toBe(2);
    });
  });

  describe("scroll position management", () => {
    it("should get last scroll position", () => {
      (audioService as any).lastScrollPosition = 5;
      const position = audioService.getLastScrollPosition();

      expect(position).toBe(5);
    });

    it("should set last scroll position", () => {
      audioService.setLastScrollPosition(10);

      expect((audioService as any).lastScrollPosition).toBe(10);
    });
  });

  describe("getPlaybackState", () => {
    beforeEach(async () => {
      await audioService.initialize(sampleTracks);
    });

    it("should return playback state", async () => {
      const state = await audioService.getPlaybackState();

      expect(mockTrackPlayer.getState).toHaveBeenCalled();
      expect(state).toBe("playing");
    });

    it("should return None if not initialized", async () => {
      await audioService.destroy();

      const state = await audioService.getPlaybackState();

      expect(state).toBe("none");
    });
  });

  describe("cache management", () => {
    beforeEach(async () => {
      await audioService.initialize(sampleTracks);
    });

    it("should get cache stats", () => {
      const stats = audioService.getCacheStats();

      expect(mockAudioCacheService.getCacheStats).toHaveBeenCalled();
      expect(stats).toEqual({ usagePercentage: 50 });
    });

    it("should clear cache", async () => {
      await audioService.clearCache();

      expect(mockAudioCacheService.clearCache).toHaveBeenCalled();
    });
  });

  describe("destroy", () => {
    beforeEach(async () => {
      await audioService.initialize(sampleTracks);
    });

    it("should destroy the player", async () => {
      await audioService.destroy();

      expect(mockTrackPlayer.reset.mock.calls.length).toBeGreaterThanOrEqual(1);
      expect(audioService.isInitialized()).toBe(false);
    });

    it("should not destroy if not initialized", async () => {
      await audioService.destroy();
      await audioService.destroy();

      expect(mockTrackPlayer.reset.mock.calls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("isInitialized", () => {
    it("should return false when not initialized", () => {
      expect(audioService.isInitialized()).toBe(false);
    });

    it("should return true when initialized", async () => {
      await audioService.initialize(sampleTracks);

      expect(audioService.isInitialized()).toBe(true);
    });
  });
});

describe("AudioUtils", () => {
  describe("formatTime", () => {
    it("should format seconds correctly", () => {
      expect(AudioUtils.formatTime(0)).toBe("0:00");
      expect(AudioUtils.formatTime(30)).toBe("0:30");
      expect(AudioUtils.formatTime(60)).toBe("1:00");
      expect(AudioUtils.formatTime(90)).toBe("1:30");
      expect(AudioUtils.formatTime(125)).toBe("2:05");
    });

    it("should handle decimal seconds", () => {
      expect(AudioUtils.formatTime(30.7)).toBe("0:30");
      expect(AudioUtils.formatTime(60.9)).toBe("1:00");
    });
  });

  describe("levelToPercentage", () => {
    it("should convert level to percentage", () => {
      expect(AudioUtils.levelToPercentage(0)).toBe(0);
      expect(AudioUtils.levelToPercentage(0.5)).toBe(50);
      expect(AudioUtils.levelToPercentage(1)).toBe(100);
      expect(AudioUtils.levelToPercentage(0.123)).toBe(12);
    });
  });

  describe("getWhisperStatusDescription", () => {
    it("should return whisper description for whisper", () => {
      const description = AudioUtils.getWhisperStatusDescription(true, 0.05);
      expect(description).toBe("Whisper (5%)");
    });

    it("should return loud description for non-whisper", () => {
      const description = AudioUtils.getWhisperStatusDescription(false, 0.8);
      expect(description).toBe("Too loud (80%)");
    });
  });

  describe("getWhisperStatusColor", () => {
    it("should return success color for whisper", () => {
      const color = AudioUtils.getWhisperStatusColor(true);
      expect(color).toBe("#4CAF50");
    });

    it("should return loud color for non-whisper", () => {
      const color = AudioUtils.getWhisperStatusColor(false);
      expect(color).toBe("#F44336");
    });
  });
});
