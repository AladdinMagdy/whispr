import React, { useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  TouchableOpacity,
  ListRenderItemInfo,
  ViewToken,
} from "react-native";
import TrackPlayer, {
  State,
  usePlaybackState,
  useProgress,
} from "react-native-track-player";
import { useAudioStore, AudioTrack } from "../store/useAudioStore";

const { height, width } = Dimensions.get("window");

// Placeholder data (replace with Firestore whispers)
const AUDIO_FEED: AudioTrack[] = [
  {
    id: "1",
    title: "Bad Liar",
    artist: "Imagine Dragons",
    artwork: "https://i.imgur.com/8Km9tLL.jpg",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  },
  {
    id: "2",
    title: "Sample 2",
    artist: "Unknown",
    artwork: "https://i.imgur.com/8Km9tLL.jpg",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
  },
];

const FeedScreen = () => {
  const flatListRef = useRef<FlatList<AudioTrack>>(null);
  const playbackState = usePlaybackState();
  const progress = useProgress();
  const lastPlayedTrackRef = useRef<number>(-1);
  const hasMountedRef = useRef<boolean>(false);

  // Zustand store
  const {
    tracks,
    currentTrackIndex,
    scrollPosition,
    isPlaying,
    isInitialized,
    initializePlayer,
    restorePlayerState,
    setCurrentTrackIndex,
    setScrollPosition,
    playTrack,
    switchTrack,
    pause,
    play,
  } = useAudioStore();

  // Initialize audio player
  useEffect(() => {
    initializePlayer(AUDIO_FEED).catch(console.error);
    // Reset the last played track ref when initializing
    lastPlayedTrackRef.current = -1;
  }, [initializePlayer]);

  // Reset last played track ref when tracks change
  useEffect(() => {
    lastPlayedTrackRef.current = -1;
  }, [tracks.length]);

  // Sync playback state with Zustand
  useEffect(() => {
    const newPlayingState = playbackState.state === State.Playing;
    if (newPlayingState !== isPlaying) {
      console.log(`Playback state changed: ${isPlaying} -> ${newPlayingState}`);
      useAudioStore.getState().setPlaybackState(newPlayingState);
    }
  }, [playbackState.state, isPlaying]);

  // Sync progress with Zustand
  useEffect(() => {
    useAudioStore.getState().setPosition(progress.position);
    useAudioStore.getState().setDuration(progress.duration);
  }, [progress.position, progress.duration]);

  // Save position periodically during playback
  useEffect(() => {
    if (isPlaying && progress.position > 0) {
      const interval = setInterval(() => {
        const currentPos = progress.position;
        useAudioStore.getState().setPosition(currentPos);
        console.log(`Periodic save: position ${currentPos}`);
      }, 2000); // Save position every 2 seconds during playback

      return () => clearInterval(interval);
    }
  }, [isPlaying, progress.position]);

  // Restore scroll position when component mounts
  useEffect(() => {
    if (isInitialized && scrollPosition > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: scrollPosition,
          animated: false,
        });
      }, 100);
    }
  }, [isInitialized, scrollPosition]);

  // Restore player state when initialized (but don't auto-play)
  useEffect(() => {
    if (isInitialized && tracks.length > 0 && !hasMountedRef.current) {
      // Only restore once when the component first mounts
      hasMountedRef.current = true;
      const { currentTrackIndex, trackPositions } = useAudioStore.getState();
      const currentTrack = tracks[currentTrackIndex];
      const hasSavedPosition =
        currentTrack && trackPositions[currentTrack.id] > 0;

      if (hasSavedPosition) {
        console.log("Restoring player state on first mount");
        restorePlayerState().catch(console.error);

        // If we're restoring to the current track index, update the last played ref
        if (currentTrackIndex >= 0 && currentTrackIndex < tracks.length) {
          lastPlayedTrackRef.current = currentTrackIndex;
        }
      }
    }
  }, [isInitialized, tracks.length, restorePlayerState]);

  // Cleanup: pause audio when leaving the screen
  useEffect(() => {
    return () => {
      // Save the current position before pausing (only on unmount)
      const currentPos = progress.position;
      if (currentPos > 0) {
        useAudioStore.getState().setPosition(currentPos);
        console.log(`Saving position ${currentPos} before leaving screen`);
      }
      pause().catch(console.error);
      // Reset mount flag for next mount
      hasMountedRef.current = false;
    };
  }, [pause]); // Remove progress.position dependency to prevent frequent pausing

  const onViewableItemsChanged = useRef(
    (params: { viewableItems: ViewToken[]; changed: ViewToken[] }) => {
      if (
        params.viewableItems.length > 0 &&
        params.viewableItems[0].index !== null
      ) {
        const newIndex = params.viewableItems[0].index;

        console.log(
          `onViewableItemsChanged: newIndex=${newIndex}, currentTrackIndex=${currentTrackIndex}, lastPlayed=${lastPlayedTrackRef.current}`
        );

        // Only proceed if this is actually a new track
        if (newIndex !== lastPlayedTrackRef.current) {
          console.log(`Scrolling to new track: ${newIndex}`);

          // Update the last played track ref immediately to prevent duplicate calls
          lastPlayedTrackRef.current = newIndex;

          setCurrentTrackIndex(newIndex);
          setScrollPosition(newIndex);

          // Always switch to the new track when scrolling
          setTimeout(() => {
            console.log(`Calling playTrack for index ${newIndex}`);
            playTrack(newIndex).catch(console.error);
          }, 100); // Small delay to ensure scroll is complete
        } else {
          console.log(`Skipping duplicate call for track ${newIndex}`);
        }
      }
    }
  ).current;

  const handlePlayPause = useCallback(async () => {
    try {
      if (isPlaying) {
        await pause();
      } else {
        await play();
      }
    } catch (error) {
      console.error("Play/pause error:", error);
    }
  }, [isPlaying, pause, play]);

  const renderItem = ({ item }: ListRenderItemInfo<AudioTrack>) => (
    <View style={styles.page}>
      <View style={styles.artworkContainer}>
        <View style={styles.artworkShadow} />
        <View style={styles.artworkWrapper}>
          <View style={styles.artworkImage}>
            {/* Replace with <Image> for real artwork */}
          </View>
        </View>
      </View>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.artist}>{item.artist}</Text>
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${
                  (progress.position / (progress.duration || 1)) * 100
                }%`,
              },
            ]}
          />
        </View>
        <View style={styles.progressTimeRow}>
          <Text style={styles.progressTime}>
            {formatTime(progress.position)}
          </Text>
          <Text style={styles.progressTime}>
            {formatTime(progress.duration)}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.playPauseButton}
        onPress={handlePlayPause}
      >
        <Text style={styles.playPauseText}>{isPlaying ? "Pause" : "Play"}</Text>
      </TouchableOpacity>

      {/* Debug button */}
      <TouchableOpacity
        style={[
          styles.playPauseButton,
          { marginTop: 10, backgroundColor: "#666" },
        ]}
        onPress={() => {
          const storeState = useAudioStore.getState();
          console.log("Current state:", {
            currentTrackIndex,
            isPlaying,
            currentPosition: progress.position,
            duration: progress.duration,
            lastPlayedTrack: lastPlayedTrackRef.current,
            savedPosition: storeState.currentPosition,
            savedTrackIndex: storeState.currentTrackIndex,
          });

          // Test manual restoration
          if (storeState.currentPosition > 0) {
            console.log("Testing manual restoration...");
            restorePlayerState().catch(console.error);
          } else {
            // Test manual track switching
            const nextTrack = (currentTrackIndex + 1) % AUDIO_FEED.length;
            console.log(`Manually switching to track ${nextTrack}`);
            playTrack(nextTrack).catch(console.error);
          }
        }}
      >
        <Text style={styles.playPauseText}>Debug</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <FlatList
      ref={flatListRef}
      data={AUDIO_FEED}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      pagingEnabled
      horizontal={false}
      showsVerticalScrollIndicator={false}
      snapToInterval={height}
      decelerationRate="fast"
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={{ itemVisiblePercentThreshold: 80 }}
      getItemLayout={(_, index) => ({
        length: height,
        offset: height * index,
        index,
      })}
      initialScrollIndex={scrollPosition}
    />
  );
};

function formatTime(seconds: number = 0): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

const styles = StyleSheet.create({
  page: {
    height,
    width,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  artworkContainer: {
    marginTop: 60,
    marginBottom: 40,
    alignItems: "center",
  },
  artworkShadow: {
    position: "absolute",
    width: 220,
    height: 220,
    backgroundColor: "#eee",
    borderRadius: 110,
    top: 10,
    left: 10,
    zIndex: 0,
  },
  artworkWrapper: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#ddd",
    overflow: "hidden",
    zIndex: 1,
  },
  artworkImage: {
    flex: 1,
    backgroundColor: "#bbb",
    borderRadius: 100,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginTop: 24,
    color: "#222",
  },
  artist: {
    fontSize: 18,
    color: "#666",
    marginBottom: 32,
  },
  progressBarContainer: {
    width: "80%",
    marginBottom: 16,
  },
  progressBarBg: {
    height: 4,
    backgroundColor: "#eee",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBarFill: {
    height: 4,
    backgroundColor: "#007AFF",
    borderRadius: 2,
  },
  progressTimeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  progressTime: {
    fontSize: 12,
    color: "#888",
  },
  playPauseButton: {
    marginTop: 32,
    backgroundColor: "#007AFF",
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  playPauseText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
});

export default FeedScreen;
