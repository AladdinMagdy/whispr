import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import TrackPlayer, { State } from "react-native-track-player";

export interface AudioTrack {
  id: string;
  title: string;
  artist: string;
  artwork?: string;
  url: string;
}

interface AudioState {
  // Track data
  tracks: AudioTrack[];
  currentTrackIndex: number;

  // Playback state
  isPlaying: boolean;
  currentPosition: number;
  duration: number;

  // UI state
  scrollPosition: number;

  // Player state
  isInitialized: boolean;

  // Actions
  setTracks: (tracks: AudioTrack[]) => void;
  setCurrentTrackIndex: (index: number) => void;
  setScrollPosition: (position: number) => void;
  setPlaybackState: (isPlaying: boolean) => void;
  setPosition: (position: number) => void;
  setDuration: (duration: number) => void;
  setInitialized: (initialized: boolean) => void;

  // Audio control actions
  playTrack: (index: number) => Promise<void>;
  switchTrack: (index: number) => Promise<void>;
  pause: () => Promise<void>;
  play: () => Promise<void>;
  skipToNext: () => Promise<void>;
  skipToPrevious: () => Promise<void>;

  // Initialize player
  initializePlayer: (tracks: AudioTrack[]) => Promise<void>;
  restorePlayerState: () => Promise<void>;
}

export const useAudioStore = create<AudioState>()(
  persist(
    (set, get) => ({
      // Initial state
      tracks: [],
      currentTrackIndex: 0,
      isPlaying: false,
      currentPosition: 0,
      duration: 0,
      scrollPosition: 0,
      isInitialized: false,

      // State setters
      setTracks: (tracks) => set({ tracks }),
      setCurrentTrackIndex: (index) => set({ currentTrackIndex: index }),
      setScrollPosition: (position) => set({ scrollPosition: position }),
      setPlaybackState: (isPlaying) => set({ isPlaying }),
      setPosition: (position) => set({ currentPosition: position }),
      setDuration: (duration) => set({ duration }),
      setInitialized: (initialized) => set({ isInitialized: initialized }),

      // Audio control actions
      playTrack: async (index) => {
        const { tracks, isInitialized, currentTrackIndex } = get();
        if (!isInitialized || index < 0 || index >= tracks.length) return;

        try {
          console.log(
            `playTrack called: index=${index}, currentTrackIndex=${currentTrackIndex}, isPlaying=${
              get().isPlaying
            }`
          );

          // Force complete player reset for clean track switching
          console.log(
            `Force switching to track ${index}: ${tracks[index].title}`
          );

          // Stop and reset everything
          await TrackPlayer.pause();
          await TrackPlayer.reset();

          // Add all tracks again
          await TrackPlayer.add(tracks);

          // Switch to the specific track
          await TrackPlayer.skip(index);

          // Reset position and start playing
          await TrackPlayer.seekTo(0);
          await TrackPlayer.play();

          // Update state
          set({
            currentTrackIndex: index,
            isPlaying: true,
            currentPosition: 0,
            duration: 0,
          });

          console.log(
            `Successfully playing track ${index}: ${tracks[index].title}`
          );
        } catch (error) {
          console.error("Error playing track:", error);
        }
      },

      switchTrack: async (index) => {
        const { tracks, isInitialized, currentTrackIndex } = get();
        if (!isInitialized || index < 0 || index >= tracks.length) return;

        try {
          // If we're already on this track, do nothing
          if (index === currentTrackIndex) {
            console.log(`Already on track ${index}`);
            return;
          }

          // Switch to the new track
          console.log(
            `Switching from track ${currentTrackIndex} to track ${index}`
          );
          await TrackPlayer.pause();
          await TrackPlayer.reset();
          await TrackPlayer.add(tracks);
          await TrackPlayer.skip(index);
          await TrackPlayer.seekTo(0);

          // Update state (but don't set isPlaying to true)
          set({
            currentTrackIndex: index,
            isPlaying: false,
            currentPosition: 0,
            duration: 0,
          });

          console.log(
            `Switched to track ${index}: ${tracks[index].title} (paused)`
          );
        } catch (error) {
          console.error("Error switching track:", error);
        }
      },

      pause: async () => {
        try {
          await TrackPlayer.pause();
          set({ isPlaying: false });
        } catch (error) {
          console.error("Error pausing:", error);
        }
      },

      play: async () => {
        try {
          await TrackPlayer.play();
          set({ isPlaying: true });
        } catch (error) {
          console.error("Error playing:", error);
        }
      },

      skipToNext: async () => {
        const { tracks, currentTrackIndex } = get();
        if (tracks.length === 0) return;

        const nextIndex = (currentTrackIndex + 1) % tracks.length;
        await get().playTrack(nextIndex);
      },

      skipToPrevious: async () => {
        const { tracks, currentTrackIndex } = get();
        if (tracks.length === 0) return;

        const prevIndex =
          currentTrackIndex === 0 ? tracks.length - 1 : currentTrackIndex - 1;
        await get().playTrack(prevIndex);
      },

      // Restore player state without playing
      restorePlayerState: async () => {
        const { tracks, currentTrackIndex, currentPosition, isInitialized } =
          get();
        if (!isInitialized || tracks.length === 0) return;

        try {
          // Switch to the saved track index (this will pause and reset position)
          await get().switchTrack(currentTrackIndex);

          // Seek to the saved position if it's greater than 0
          if (currentPosition > 0) {
            await TrackPlayer.seekTo(currentPosition);
            set({ currentPosition }); // Update the state with the restored position
          }

          console.log(
            `Restored to track ${currentTrackIndex} at position ${currentPosition}`
          );
        } catch (error) {
          console.error("Error restoring player state:", error);
        }
      },

      // Initialize player
      initializePlayer: async (tracks) => {
        const { isInitialized } = get();

        if (isInitialized) {
          // If already initialized, just update tracks if they're different
          const currentTracks = get().tracks;
          const tracksChanged =
            tracks.length !== currentTracks.length ||
            tracks.some(
              (track, index) => track.id !== currentTracks[index]?.id
            );

          if (tracksChanged) {
            await TrackPlayer.reset();
            await TrackPlayer.add(tracks);
            set({ tracks, currentTrackIndex: 0, scrollPosition: 0 });
          } else {
            // Tracks are the same, just restore the player state
            await get().restorePlayerState();
          }
          return;
        }

        try {
          await TrackPlayer.setupPlayer();
          await TrackPlayer.reset();
          await TrackPlayer.add(tracks);

          set({
            tracks,
            isInitialized: true,
            currentTrackIndex: 0,
            scrollPosition: 0,
          });

          console.log("Audio player initialized successfully");
        } catch (error) {
          console.error("Failed to initialize audio player:", error);
          throw error;
        }
      },
    }),
    {
      name: "audio-storage",
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist these fields
      partialize: (state) => ({
        currentTrackIndex: state.currentTrackIndex,
        scrollPosition: state.scrollPosition,
        currentPosition: state.currentPosition,
        duration: state.duration,
      }),
    }
  )
);
