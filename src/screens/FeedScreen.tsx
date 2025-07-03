import React, { useEffect, useRef, useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  TouchableOpacity,
  ListRenderItemInfo,
  ViewToken,
  ActivityIndicator,
  RefreshControl,
  AppState,
} from "react-native";
import TrackPlayer, {
  State,
  usePlaybackState,
  useProgress,
  Event,
} from "react-native-track-player";
import { useAudioStore, AudioTrack } from "../store/useAudioStore";
import { useFeedStore } from "../store/useFeedStore";
import {
  getFirestoreService,
  PaginatedWhispersResult,
} from "../services/firestoreService";
import { getAudioCacheService } from "../services/audioCacheService";
import { getPreloadService } from "../services/preloadService";
import { Whisper } from "../types";
import { useAuth } from "../providers/AuthProvider";
import { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import WhisperInteractions from "../components/WhisperInteractions";

const { height, width } = Dimensions.get("window");

const FeedScreen = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newWhispersCount, setNewWhispersCount] = useState(0);
  const [isAppActive, setIsAppActive] = useState(true);

  const { user } = useAuth();
  const firestoreService = getFirestoreService();
  const audioCacheService = getAudioCacheService();
  const preloadService = getPreloadService();
  const flatListRef = useRef<FlatList<AudioTrack>>(null);
  const playbackState = usePlaybackState();
  const progress = useProgress();
  const lastPlayedTrackRef = useRef<number>(-1);
  const hasMountedRef = useRef<boolean>(false);

  // Zustand stores
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
    replayTrack,
    switchTrack,
    pause,
    play,
    setupAutoReplay,
    cleanupAutoReplay,
  } = useAudioStore();

  // FeedStore for persistent caching
  const {
    whispers,
    lastDoc,
    hasMore,
    isCacheValid,
    setWhispers,
    setLastDoc,
    setHasMore,
    setLastLoadTime,
    addNewWhisper,
    updateCache,
  } = useFeedStore();

  // Convert whispers to AudioTrack format (synchronous for FlatList)
  const convertWhispersToAudioTracks = (whispers: Whisper[]): AudioTrack[] => {
    return whispers.map((whisper) => ({
      id: whisper.id,
      title: whisper.userDisplayName,
      artist: `${whisper.whisperPercentage.toFixed(1)}% whisper • ${formatTime(
        whisper.duration
      )}`,
      artwork: `https://ui-avatars.com/api/?name=${encodeURIComponent(
        whisper.userDisplayName
      )}&background=${whisper.userProfileColor.replace(
        "#",
        ""
      )}&color=fff&size=200`,
      url: whisper.audioUrl, // Keep original URL for FlatList display
    }));
  };

  // Convert whispers to AudioTrack format with cached URLs (async for audio player)
  const convertWhispersToAudioTracksWithCache = async (
    whispers: Whisper[]
  ): Promise<AudioTrack[]> => {
    const audioTracks: AudioTrack[] = [];

    for (const whisper of whispers) {
      try {
        // Get cached URL (downloads if not cached)
        const cachedUrl = await audioCacheService.getCachedAudioUrl(
          whisper.audioUrl
        );

        audioTracks.push({
          id: whisper.id,
          title: whisper.userDisplayName,
          artist: `${whisper.whisperPercentage.toFixed(
            1
          )}% whisper • ${formatTime(whisper.duration)}`,
          artwork: `https://ui-avatars.com/api/?name=${encodeURIComponent(
            whisper.userDisplayName
          )}&background=${whisper.userProfileColor.replace(
            "#",
            ""
          )}&color=fff&size=200`,
          url: cachedUrl, // Use cached URL for audio player
        });
      } catch (error) {
        console.warn(
          `⚠️ Failed to cache audio for whisper ${whisper.id}:`,
          error
        );
        // Fallback to original URL if caching fails
        audioTracks.push({
          id: whisper.id,
          title: whisper.userDisplayName,
          artist: `${whisper.whisperPercentage.toFixed(
            1
          )}% whisper • ${formatTime(whisper.duration)}`,
          artwork: `https://ui-avatars.com/api/?name=${encodeURIComponent(
            whisper.userDisplayName
          )}&background=${whisper.userProfileColor.replace(
            "#",
            ""
          )}&color=fff&size=200`,
          url: whisper.audioUrl, // Fallback to original URL
        });
      }
    }

    return audioTracks;
  };

  // Load whispers with caching
  const loadWhispers = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      // Check if we have valid cached data and don't need to force refresh
      if (!forceRefresh && isCacheValid()) {
        console.log("✅ Using cached whispers:", whispers.length);

        // Convert to audio tracks and initialize player
        const audioTracks = await convertWhispersToAudioTracksWithCache(
          whispers
        );
        await initializePlayer(audioTracks);
        lastPlayedTrackRef.current = -1;

        // Preload audio files in background
        audioCacheService.preloadTracks(audioTracks, 0, 5).catch(console.error);

        setLoading(false);
        return;
      }

      console.log("🔄 Loading fresh whispers from Firestore...");
      const result: PaginatedWhispersResult =
        await firestoreService.getWhispers();

      // Update cache
      updateCache(result.whispers, result.lastDoc, result.hasMore);

      // Convert to audio tracks and initialize player
      const audioTracks = await convertWhispersToAudioTracksWithCache(
        result.whispers
      );
      await initializePlayer(audioTracks);
      lastPlayedTrackRef.current = -1;

      // Preload audio files in background
      audioCacheService.preloadTracks(audioTracks, 0, 5).catch(console.error);
    } catch (err) {
      console.error("Error loading whispers:", err);
      setError(err instanceof Error ? err.message : "Failed to load whispers");
    } finally {
      setLoading(false);
    }
  };

  // Set up real-time listener for whispers
  useEffect(() => {
    if (!user || !isAppActive) return; // Don't set up listener if not authenticated or app is in background

    console.log("🔄 Setting up real-time whisper listener...");

    const unsubscribe = firestoreService.subscribeToNewWhispers(
      (newWhisper) => {
        console.log(`🆕 New whisper detected: ${newWhisper.id}`);

        // Add new whisper to cache
        addNewWhisper(newWhisper);

        // Update audio player with new track at the beginning
        const updatedWhispers = [newWhisper, ...whispers.slice(0, 19)];
        convertWhispersToAudioTracksWithCache(updatedWhispers)
          .then((audioTracks) => initializePlayer(audioTracks))
          .catch(console.error);

        // Preload the new audio file
        audioCacheService
          .getCachedAudioUrl(newWhisper.audioUrl)
          .catch(console.error);

        // Show new whisper indicator
        setNewWhispersCount(1);

        // Auto-hide the indicator after 5 seconds
        setTimeout(() => {
          setNewWhispersCount(0);
        }, 5000);
      },
      new Date(Date.now() - 60000) // Listen to whispers from the last minute
    );

    // Cleanup listener on unmount
    return () => {
      console.log("🔄 Cleaning up real-time whisper listener");
      unsubscribe();
    };
  }, [
    user,
    firestoreService,
    isAppActive,
    whispers,
    addNewWhisper,
    initializePlayer,
    audioCacheService,
  ]);

  // Load more whispers (pagination)
  const loadMoreWhispers = async () => {
    if (!hasMore || loadingMore || !lastDoc) return;

    try {
      setLoadingMore(true);
      const result: PaginatedWhispersResult =
        await firestoreService.getWhispers({
          limit: 20,
          startAfter: lastDoc,
        });

      // Update cache with new whispers
      const allWhispers = [...whispers, ...result.whispers];
      updateCache(allWhispers, result.lastDoc, result.hasMore);

      // Update audio player with new tracks
      const audioTracks = await convertWhispersToAudioTracksWithCache(
        allWhispers
      );
      await initializePlayer(audioTracks);

      // Preload new audio files
      const newTracks = audioTracks.slice(whispers.length);
      for (const track of newTracks) {
        audioCacheService.getCachedAudioUrl(track.url).catch(console.error);
      }
    } catch (err) {
      console.error("Error loading more whispers:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  // Refresh whispers
  const onRefresh = async () => {
    setRefreshing(true);
    await loadWhispers(true); // Force refresh
    setRefreshing(false);
  };

  // Initialize audio player and load whispers
  useEffect(() => {
    loadWhispers();
  }, []);

  // Handle app state changes (background/foreground)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      const wasActive = isAppActive;
      setIsAppActive(nextAppState === "active");
      console.log(`📱 App state changed: ${nextAppState}`);

      // Clean up cache when app goes to background
      if (nextAppState === "background" || nextAppState === "inactive") {
        const stats = audioCacheService.getCacheStats();
        if (stats.usagePercentage > 80) {
          console.log("🧹 Cleaning up audio cache due to high usage...");
          audioCacheService.clearCache().catch(console.error);
        }
      }

      // Refresh whisper data when app becomes active (to get latest like/comment counts)
      if (!wasActive && nextAppState === "active" && whispers.length > 0) {
        console.log("🔄 App became active, refreshing whisper data...");
        loadWhispers(true).catch(console.error);
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );
    return () => subscription?.remove();
  }, [audioCacheService, isAppActive, whispers.length]);

  // Set up centralized auto-replay from the store
  useEffect(() => {
    if (isInitialized) {
      setupAutoReplay();
      return () => {
        cleanupAutoReplay();
      };
    }
  }, [isInitialized, setupAutoReplay, cleanupAutoReplay]);

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
      const { currentTrackIndex, lastPlayedTrackId, lastPlayedPosition } =
        useAudioStore.getState();
      const currentTrack = tracks[currentTrackIndex];
      const hasSavedPosition =
        currentTrack &&
        lastPlayedTrackId === currentTrack.id &&
        lastPlayedPosition > 0;

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

          // Preload next tracks when scrolling
          audioCacheService
            .preloadTracks(tracks, newIndex, 5)
            .catch(console.error);
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

  const renderItem = ({ item, index }: ListRenderItemInfo<AudioTrack>) => {
    // Find the corresponding whisper for this item
    const whisper = whispers.find((w) => w.id === item.id);

    if (!whisper) {
      console.warn(`Whisper not found for item ${item.id}`);
      return null;
    }

    return (
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
          <Text style={styles.playPauseText}>
            {isPlaying ? "Pause" : "Play"}
          </Text>
        </TouchableOpacity>

        {/* Whisper Interactions */}
        <WhisperInteractions
          whisper={whisper}
          onLikeChange={(isLiked, newLikeCount) => {
            // Update the whisper in the feed store
            const updatedWhispers = whispers.map((w) =>
              w.id === whisper.id ? { ...w, likes: newLikeCount } : w
            );
            setWhispers(updatedWhispers);
          }}
          onCommentChange={(newCommentCount) => {
            // Update the whisper in the feed store
            const updatedWhispers = whispers.map((w) =>
              w.id === whisper.id ? { ...w, replies: newCommentCount } : w
            );
            setWhispers(updatedWhispers);
          }}
        />

        {/* Debug button */}
        <TouchableOpacity
          style={[
            styles.playPauseButton,
            { marginTop: 10, backgroundColor: "#666" },
          ]}
          onPress={() => {
            const storeState = useAudioStore.getState();
            const cacheStats = audioCacheService.getCacheStats();
            console.log("Current state:", {
              currentTrackIndex,
              isPlaying,
              currentPosition: progress.position,
              duration: progress.duration,
              lastPlayedTrack: lastPlayedTrackRef.current,
              savedPosition: storeState.currentPosition,
              savedTrackIndex: storeState.currentTrackIndex,
              cacheStats,
              cachedWhispers: whispers.length,
              cacheValid: isCacheValid(),
            });

            // Test manual restoration
            if (storeState.currentPosition > 0) {
              console.log("Testing manual restoration...");
              restorePlayerState().catch(console.error);
            } else {
              // Test manual track switching
              const nextTrack = (currentTrackIndex + 1) % tracks.length;
              console.log(`Manually switching to track ${nextTrack}`);
              playTrack(nextTrack).catch(console.error);
            }
          }}
        >
          <Text style={styles.playPauseText}>Debug</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Show loading state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading whispers...</Text>
      </View>
    );
  }

  // Show error state
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Error: {error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => loadWhispers(true)}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Show empty state
  if (whispers.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No whispers yet</Text>
        <Text style={styles.emptySubtext}>Be the first to whisper!</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => loadWhispers(true)}
        >
          <Text style={styles.retryButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* New whispers indicator */}
      {newWhispersCount > 0 && (
        <View style={styles.newWhispersIndicator}>
          <Text style={styles.newWhispersText}>
            🎉 {newWhispersCount} new whisper{newWhispersCount > 1 ? "s" : ""}!
          </Text>
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={convertWhispersToAudioTracks(whispers)}
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReached={loadMoreWhispers}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.loadingMoreContainer}>
              <ActivityIndicator size="small" color="#007AFF" />
              <Text style={styles.loadingMoreText}>
                Loading more whispers...
              </Text>
            </View>
          ) : null
        }
      />
    </View>
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
  // Loading, error, and empty states
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: "#ff3b30",
    textAlign: "center",
    marginBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 20,
  },
  emptyText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#222",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: "#007AFF",
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  // Real-time update styles
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  newWhispersIndicator: {
    position: "absolute",
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: "#007AFF",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    zIndex: 1000,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  newWhispersText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
  },
  // Pagination styles
  loadingMoreContainer: {
    paddingVertical: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingMoreText: {
    marginTop: 8,
    fontSize: 14,
    color: "#666",
  },
});

export default FeedScreen;
