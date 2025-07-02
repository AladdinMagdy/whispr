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

      // State setters
      setTracks: (tracks) => set({ tracks }),
      setCurrentTrackIndex: (index) => set({ currentTrackIndex: index }),
      setScrollPosition: (position) => set({ scrollPosition: position }),
      setPlaybackState: (isPlaying) => set({ isPlaying }),
      setPosition: (position) => {
        console.log(`Saving position: ${position}`);
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

      // Audio control actions
      playTrack: async (index) => {
        const {
          tracks,
          isInitialized,
          currentTrackIndex,
          lastPlayedTrackId,
          lastPlayedPosition,
        } = get();
        if (!isInitialized || index < 0 || index >= tracks.length) return;

        try {
          const targetTrack = tracks[index];
          const isSameTrackAsLastPlayed = lastPlayedTrackId === targetTrack.id;
          const savedPosition = isSameTrackAsLastPlayed
            ? lastPlayedPosition
            : 0;

          console.log(
            `playTrack called: index=${index}, currentTrackIndex=${currentTrackIndex}, isPlaying=${
              get().isPlaying
            }, isSameTrackAsLastPlayed=${isSameTrackAsLastPlayed}, savedPosition=${savedPosition}`
          );

          // Always switch to the target track to ensure proper track switching
          console.log(`Switching to track ${index}: ${targetTrack.title}`);

          // Stop and reset everything
          await TrackPlayer.pause();
          await TrackPlayer.reset();

          // Only add the specific track to prevent auto-advance
          await TrackPlayer.add([targetTrack]);

          // Only restore position if it's the same track that was last played
          if (isSameTrackAsLastPlayed && savedPosition > 0) {
            // Restore the saved position for this track
            await TrackPlayer.seekTo(savedPosition);
            console.log(
              `Restored position ${savedPosition} for track ${index}`
            );
          } else {
            // Start from beginning for new track or different track
            await TrackPlayer.seekTo(0);
            console.log(`Starting track ${index} from beginning`);
          }

          await TrackPlayer.play();

          // Update state
          set({
            currentTrackIndex: index,
            isPlaying: true,
            duration: 0,
            currentPosition: savedPosition,
            lastPlayedTrackId: targetTrack.id,
            lastPlayedPosition: savedPosition,
          });

          console.log(
            `Successfully playing track ${index}: ${targetTrack.title}`
          );
        } catch (error) {
          console.error("Error playing track:", error);
        }
      },

      replayTrack: async (index) => {
        const { tracks, isInitialized } = get();
        if (!isInitialized || index < 0 || index >= tracks.length) return;

        try {
          const targetTrack = tracks[index];
          console.log(`Replaying track ${index}: ${targetTrack.title}`);

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
          });

          console.log(
            `Successfully replayed track ${index}: ${targetTrack.title}`
          );
        } catch (error) {
          console.error("Error replaying track:", error);
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

      // Auto-replay functionality
      setupAutoReplay: () => {
        let isReplaying = false;

        const handleTrackEnd = async (event: any) => {
          console.log("🎵 Track event received:", event.type);

          if (event.type === Event.PlaybackQueueEnded && !isReplaying) {
            console.log("🔄 Track ended, auto-replaying");
            isReplaying = true;

            try {
              // Simple replay: seek to 0 and play
              await TrackPlayer.seekTo(0);
              await TrackPlayer.play();
              console.log("✅ Track auto-replayed successfully");
            } catch (error) {
              console.error("❌ Error auto-replaying track:", error);
            } finally {
              // Reset replay flag after a delay
              setTimeout(() => {
                isReplaying = false;
              }, 1000);
            }
          }
        };

        // Progress-based auto-replay as fallback
        const startProgressCheck = () => {
          const { progressCheckInterval } = get();
          if (progressCheckInterval) {
            clearInterval(progressCheckInterval);
          }

          const newInterval = setInterval(async () => {
            try {
              const state = await TrackPlayer.getState();
              if (state === State.Playing) {
                const position = await TrackPlayer.getPosition();
                const duration = await TrackPlayer.getDuration();

                // If we're within 0.5 seconds of the end and not already replaying
                if (
                  duration > 0 &&
                  position >= duration - 0.5 &&
                  !isReplaying
                ) {
                  console.log("🔄 Progress-based auto-replay triggered");
                  isReplaying = true;

                  await TrackPlayer.seekTo(0);
                  await TrackPlayer.play();
                  console.log("✅ Progress-based auto-replay successful");

                  // Reset replay flag after a delay
                  setTimeout(() => {
                    isReplaying = false;
                  }, 1000);
                }
              }
            } catch (error) {
              console.error("❌ Error in progress check:", error);
            }
          }, 500); // Check every 500ms

          // Store the interval reference
          set({ progressCheckInterval: newInterval });
        };

        // Set up event listeners
        TrackPlayer.addEventListener(Event.PlaybackQueueEnded, handleTrackEnd);

        // Start progress checking when playback starts
        TrackPlayer.addEventListener(Event.PlaybackState, (event) => {
          if (event.state === State.Playing) {
            startProgressCheck();
          } else if (
            event.state === State.Paused ||
            event.state === State.Stopped
          ) {
            const { progressCheckInterval } = get();
            if (progressCheckInterval) {
              clearInterval(progressCheckInterval);
              set({ progressCheckInterval: null });
            }
          }
        });

        console.log("✅ Auto-replay setup complete (event + progress-based)");
      },

      cleanupAutoReplay: () => {
        // TrackPlayer automatically cleans up listeners when the player is destroyed
        // But we need to clear any intervals we created
        const { progressCheckInterval } = get();
        if (progressCheckInterval) {
          clearInterval(progressCheckInterval);
          set({ progressCheckInterval: null });
        }
        console.log("🧹 Auto-replay cleanup complete");
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
