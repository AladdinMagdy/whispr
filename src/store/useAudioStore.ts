import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import TrackPlayer, { State, Event } from "react-native-track-player";

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
  lastPlayedTrackId: string | null; // Only store the last played track ID
  lastPlayedPosition: number; // Only store the last played position

  // UI state
  scrollPosition: number;

  // Player state
  isInitialized: boolean;

  // Auto-replay control
  isTrackSwitching: boolean; // Flag to prevent auto-replay during track switching
  lastScrollTime: number; // Track when last scroll happened
  autoReplayEnabled: boolean; // Flag to enable/disable auto-replay

  // Actions
  setTracks: (tracks: AudioTrack[]) => void;
  setCurrentTrackIndex: (index: number) => void;
  setScrollPosition: (position: number) => void;
  setPlaybackState: (isPlaying: boolean) => void;
  setPosition: (position: number) => void;
  setDuration: (duration: number) => void;
  setInitialized: (initialized: boolean) => void;
  setTrackSwitching: (isSwitching: boolean) => void;
  setLastScrollTime: (time: number) => void;
  setAutoReplayEnabled: (enabled: boolean) => void;

  // Audio control actions
  playTrack: (index: number) => Promise<void>;
  replayTrack: (index: number) => Promise<void>;
  switchTrack: (index: number) => Promise<void>;
  pause: () => Promise<void>;
  play: () => Promise<void>;
  skipToNext: () => Promise<void>;
  skipToPrevious: () => Promise<void>;

  // Initialize player
  initializePlayer: (tracks: AudioTrack[]) => Promise<void>;
  restorePlayerState: () => Promise<void>;

  // Auto-replay functionality
  setupAutoReplay: () => void;
  cleanupAutoReplay: () => void;
  progressCheckInterval: NodeJS.Timeout | null;

  // Add a function to handle scroll activity and pause playback during scrolling
  handleScrollActivity: () => void;
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
      lastPlayedTrackId: null,
      lastPlayedPosition: 0,
      progressCheckInterval: null,
      isTrackSwitching: false,
      lastScrollTime: 0,
      autoReplayEnabled: false,

      // State setters
      setTracks: (tracks) => set({ tracks }),
      setCurrentTrackIndex: (index) => set({ currentTrackIndex: index }),
      setScrollPosition: (position) => set({ scrollPosition: position }),
      setPlaybackState: (isPlaying) => set({ isPlaying }),
      setPosition: (position) => {
        const {
          tracks,
          currentTrackIndex,
          lastPlayedTrackId,
          lastPlayedPosition,
        } = get();
        const currentTrack = tracks[currentTrackIndex];

        if (currentTrack) {
          const newLastPlayedTrackId = currentTrack.id;
          const newLastPlayedPosition = position;
          set({
            currentPosition: position,
            lastPlayedTrackId: newLastPlayedTrackId,
            lastPlayedPosition: newLastPlayedPosition,
          });
        } else {
          set({ currentPosition: position });
        }
      },
      setDuration: (duration) => set({ duration }),
      setInitialized: (initialized) => set({ isInitialized: initialized }),
      setTrackSwitching: (isSwitching) =>
        set({ isTrackSwitching: isSwitching }),
      setLastScrollTime: (time) => set({ lastScrollTime: time }),
      setAutoReplayEnabled: (enabled) => set({ autoReplayEnabled: enabled }),

      // Audio control actions
      playTrack: async (index) => {
        const { tracks, isInitialized } = get();
        if (!isInitialized || index < 0 || index >= tracks.length) {
          console.warn(
            `playTrack: Invalid parameters - initialized: ${isInitialized}, index: ${index}, tracks length: ${tracks.length}`
          );
          return;
        }

        try {
          const targetTrack = tracks[index];
          console.log(
            `playTrack: Playing track ${index} (${targetTrack.title})`
          );

          // Check if player is in a valid state
          const playerState = await TrackPlayer.getState();
          const queue = await TrackPlayer.getQueue();

          console.log(
            `playTrack: Player state: ${playerState}, queue length: ${queue.length}`
          );

          // Check if we need to switch tracks (different track or empty queue)
          const currentIndex = get().currentTrackIndex;
          const needsTrackSwitch =
            index !== currentIndex ||
            queue.length === 0 ||
            playerState === State.Ended;

          if (needsTrackSwitch) {
            // Set track switching flag to prevent auto-replay conflicts
            set({ isTrackSwitching: true });

            // Switch to the target track
            console.log(`playTrack: Switching to track ${index}`);
            await TrackPlayer.pause();
            await TrackPlayer.reset();
            await TrackPlayer.add([targetTrack]);
            await TrackPlayer.seekTo(0);
            await TrackPlayer.play();

            set({
              currentTrackIndex: index,
              isPlaying: true,
              duration: 0,
              currentPosition: 0,
              lastPlayedTrackId: targetTrack.id,
              lastPlayedPosition: 0,
              isTrackSwitching: false, // Clear the flag after switching
            });

            console.log(
              `playTrack: Successfully switched to and started playing track ${index}`
            );
          } else {
            // Already on the correct track, just play
            console.log(`playTrack: Already on track ${index}, just playing`);
            await TrackPlayer.play();
            set({ isPlaying: true });
            console.log(`playTrack: Started playing track ${index}`);
          }
        } catch (error) {
          console.error("Error playing track:", error);
          set({ isPlaying: false, isTrackSwitching: false }); // Clear flag on error
        }
      },

      replayTrack: async (index) => {
        const { tracks, isInitialized } = get();
        if (!isInitialized || index < 0 || index >= tracks.length) return;

        try {
          const targetTrack = tracks[index];
          console.log(`Replaying track ${index}: ${targetTrack.title}`);

          // Set track switching flag to prevent auto-replay conflicts
          set({ isTrackSwitching: true });

          // Always start from the beginning for replay
          await TrackPlayer.pause();
          await TrackPlayer.reset();
          await TrackPlayer.add([targetTrack]);
          await TrackPlayer.seekTo(0);
          await TrackPlayer.play();

          // Update state - always start from position 0 for replay
          set({
            currentTrackIndex: index,
            isPlaying: true,
            duration: 0,
            currentPosition: 0,
            lastPlayedTrackId: targetTrack.id,
            lastPlayedPosition: 0, // Reset position for replay
            isTrackSwitching: false, // Clear the flag after replay
          });

          console.log(
            `Successfully replayed track ${index}: ${targetTrack.title}`
          );
        } catch (error) {
          console.error("Error replaying track:", error);
          set({ isTrackSwitching: false }); // Clear flag on error
        }
      },

      switchTrack: async (index) => {
        const { tracks, isInitialized, currentTrackIndex, currentPosition } =
          get();
        if (!isInitialized || index < 0 || index >= tracks.length) return;

        try {
          // If we're already on this track, do nothing
          if (index === currentTrackIndex) {
            console.log(`Already on track ${index}`);
            return;
          }

          // Set track switching flag to prevent auto-replay conflicts
          set({ isTrackSwitching: true });

          // Switch to the new track
          console.log(
            `Switching from track ${currentTrackIndex} to track ${index}`
          );
          await TrackPlayer.pause();
          await TrackPlayer.reset();
          await TrackPlayer.add([tracks[index]]);
          await TrackPlayer.seekTo(0);

          // Update state (but don't set isPlaying to true)
          set({
            currentTrackIndex: index,
            isPlaying: false,
            duration: 0,
            currentPosition: 0, // Reset position when switching tracks
            lastPlayedTrackId: null,
            lastPlayedPosition: 0,
            isTrackSwitching: false, // Clear the flag after switching
          });

          console.log(
            `Switched to track ${index}: ${tracks[index].title} (paused)`
          );
        } catch (error) {
          console.error("Error switching track:", error);
          set({ isTrackSwitching: false }); // Clear flag on error
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
        const {
          tracks,
          currentTrackIndex,
          lastPlayedTrackId,
          lastPlayedPosition,
          isInitialized,
        } = get();
        if (!isInitialized || tracks.length === 0) return;

        try {
          // Validate that the saved track index is within bounds
          const validTrackIndex = Math.min(
            currentTrackIndex,
            tracks.length - 1
          );
          const actualTrackIndex = Math.max(0, validTrackIndex);
          const targetTrack = tracks[actualTrackIndex];
          const isSameTrackAsLastPlayed = lastPlayedTrackId === targetTrack.id;
          const savedPosition = isSameTrackAsLastPlayed
            ? lastPlayedPosition
            : 0;

          console.log(
            `Restoring: saved index=${currentTrackIndex}, valid index=${actualTrackIndex}, tracks length=${tracks.length}, isSameTrackAsLastPlayed=${isSameTrackAsLastPlayed}, position=${savedPosition}`
          );

          // Check if we need to switch tracks or just seek to position
          const currentPlayerState = await TrackPlayer.getState();
          const currentQueue = await TrackPlayer.getQueue();

          // If we're already on the correct track and have tracks loaded, just seek
          if (currentQueue.length > 0 && currentPlayerState !== State.None) {
            console.log(
              `Already on correct track, just seeking to position ${savedPosition}`
            );
            if (isSameTrackAsLastPlayed && savedPosition > 0) {
              await TrackPlayer.seekTo(savedPosition);
              console.log(`Seeked to position ${savedPosition}`);
            } else {
              await TrackPlayer.seekTo(0);
              console.log(`Seeked to beginning (different track)`);
            }
            set({
              currentPosition: savedPosition,
              isPlaying: false, // Keep it paused when restoring
              lastPlayedTrackId: null,
              lastPlayedPosition: 0,
            });
            return;
          }

          // Direct restoration without using switchTrack (which resets position)
          await TrackPlayer.pause();
          await TrackPlayer.reset();
          await TrackPlayer.add([tracks[actualTrackIndex]]);

          // Only seek to saved position if it's the same track
          if (isSameTrackAsLastPlayed && savedPosition > 0) {
            await TrackPlayer.seekTo(savedPosition);
            console.log(`Seeked to position ${savedPosition}`);
          } else {
            await TrackPlayer.seekTo(0);
            console.log(`Seeked to beginning (different track)`);
          }

          // Update state to reflect the restored track and position
          set({
            currentTrackIndex: actualTrackIndex,
            currentPosition: savedPosition,
            isPlaying: false, // Keep it paused when restoring
            lastPlayedTrackId: null,
            lastPlayedPosition: 0,
          });

          console.log(
            `Restored to track ${actualTrackIndex} at position ${savedPosition}`
          );
        } catch (error) {
          console.error("Error restoring player state:", error);
          // Fallback: reset to track 0 if restoration fails
          try {
            await get().switchTrack(0);
            console.log("Fallback: reset to track 0");
          } catch (fallbackError) {
            console.error("Fallback error:", fallbackError);
          }
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
            console.log("🔄 Updating audio tracks...");
            await TrackPlayer.reset();
            // Only add the first track to prevent auto-advance
            if (tracks.length > 0) {
              await TrackPlayer.add([tracks[0]]);
            }
            set({ tracks, currentTrackIndex: 0, scrollPosition: 0 });
          } else {
            // Tracks are the same, just restore the player state
            console.log("✅ Audio tracks unchanged, restoring state...");
            await get().restorePlayerState();
          }
          return;
        }

        try {
          console.log("🎵 Initializing audio player...");
          await TrackPlayer.setupPlayer({
            // Configure player to NOT auto-advance to next track
            autoHandleInterruptions: true,
            waitForBuffer: true,
          });
          await TrackPlayer.reset();
          // Only add the first track to prevent auto-advance
          if (tracks.length > 0) {
            await TrackPlayer.add([tracks[0]]);
          }

          set({
            tracks,
            isInitialized: true,
            currentTrackIndex: 0,
            scrollPosition: 0,
          });

          console.log("✅ Audio player initialized successfully");
        } catch (error) {
          console.error("❌ Failed to initialize audio player:", error);
          throw error;
        }
      },

      // --- Production-ready auto-replay: Only on PlaybackQueueEnded, debounced ---
      setupAutoReplay: () => {
        console.log(
          "✅ Auto-replay enabled - will replay current track when it ends"
        );

        // Enable auto-replay initially
        set({ autoReplayEnabled: true });

        // Auto-replay event listener
        const handlePlaybackQueueEnded = async () => {
          const { autoReplayEnabled, isTrackSwitching } = get();

          // Don't auto-replay if disabled or track switching
          if (!autoReplayEnabled || isTrackSwitching) {
            console.log(
              `Auto-replay: Skipping - auto-replay is disabled due to ${
                !autoReplayEnabled ? "auto-replay disabled" : "track switching"
              }`
            );
            return;
          }

          try {
            const { currentTrackIndex, tracks } = get();
            if (currentTrackIndex >= 0 && currentTrackIndex < tracks.length) {
              console.log(`Auto-replay: Replaying track ${currentTrackIndex}`);

              // Set track switching flag to prevent conflicts
              set({ isTrackSwitching: true });

              // Replay the current track
              const currentTrack = tracks[currentTrackIndex];
              await TrackPlayer.seekTo(0);
              await TrackPlayer.play();

              set({
                isPlaying: true,
                currentPosition: 0,
                lastPlayedPosition: 0,
                isTrackSwitching: false, // Clear the flag
              });

              console.log(
                `Auto-replay: Successfully replayed track ${currentTrackIndex}`
              );
            }
          } catch (error) {
            console.error("Auto-replay error:", error);
            set({ isTrackSwitching: false }); // Clear flag on error
          }
        };

        TrackPlayer.addEventListener(
          Event.PlaybackQueueEnded,
          handlePlaybackQueueEnded
        );

        return () => {
          // Cleanup function - TrackPlayer listeners are automatically cleaned up
          console.log("Auto-replay cleanup complete");
        };
      },

      // Add a function to handle scroll activity and pause playback during scrolling
      handleScrollActivity: () => {
        // Disable auto-replay when scrolling
        set({ autoReplayEnabled: false });
        console.log("Auto-replay disabled due to scroll activity");

        // Re-enable auto-replay after a delay if no more scrolling
        setTimeout(() => {
          const currentState = get();
          const timeSinceLastScroll = Date.now() - currentState.lastScrollTime;

          // Only re-enable auto-replay if no recent scroll activity
          if (timeSinceLastScroll > 5000) {
            console.log("Re-enabling auto-replay after scroll inactivity");
            set({ autoReplayEnabled: true });
          }
        }, 5000); // 5 second delay before re-enabling auto-replay
      },

      cleanupAutoReplay: () => {
        console.log("🧹 Auto-replay cleanup complete");
        // Cleanup is handled by the setup function return value
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
        lastPlayedTrackId: state.lastPlayedTrackId,
        lastPlayedPosition: state.lastPlayedPosition,
      }),
    }
  )
);
