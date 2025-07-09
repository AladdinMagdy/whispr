import React, {
  useEffect,
  useRef,
  useCallback,
  useState,
  useMemo,
} from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  FlatList,
  TouchableOpacity,
  ListRenderItemInfo,
  ViewToken,
  ActivityIndicator,
  RefreshControl,
  AppState,
  Text,
} from "react-native";
import { useFeedStore } from "../store/useFeedStore";
import { getFirestoreService } from "../services/firestoreService";
import { Whisper } from "../types";
import { useAuth } from "../providers/AuthProvider";
import ErrorBoundary from "../components/ErrorBoundary";
import LoadingSpinner from "../components/LoadingSpinner";
import AudioSlide, { pauseAllAudioSlides } from "../components/AudioSlide";
import { useFocusEffect } from "@react-navigation/native";
import { getAudioCacheService } from "../services/audioCacheService";
import { usePerformanceMonitor } from "../hooks/usePerformanceMonitor";

const { height } = Dimensions.get("window");

const FeedScreen = () => {
  // Add performance monitoring
  usePerformanceMonitor("FeedScreen");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newWhispersCount, setNewWhispersCount] = useState(0);
  const [isAppActive, setIsAppActive] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);

  const { user } = useAuth();
  const firestoreService = getFirestoreService();
  const flatListRef = useRef<FlatList<Whisper>>(null);

  // FeedStore for persistent caching
  const {
    whispers,
    lastDoc,
    hasMore,
    isCacheValid,
    addNewWhisper,
    updateWhisper,
  } = useFeedStore();

  // Helper function to format time
  const formatTime = useCallback((seconds: number): string => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = Math.floor(seconds % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${s}`;
  }, []);

  // Memoize audio tracks to prevent unnecessary re-creation
  const audioTracks = useMemo(
    () =>
      whispers.map((whisper) => ({
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
        url: whisper.audioUrl,
      })),
    [whispers, formatTime]
  );

  // Preload next tracks when currentIndex changes
  useEffect(() => {
    if (whispers.length > 0 && currentIndex >= 0) {
      const audioCacheService = getAudioCacheService();

      // Preload next 3 tracks for smooth scrolling
      audioCacheService
        .preloadTracks(audioTracks, currentIndex, 3)
        .catch((error) => {
          console.warn("Failed to preload tracks:", error);
        });

      // Log cache statistics periodically (every 20 index changes to reduce logging)
      if (currentIndex % 20 === 0 && currentIndex > 0) {
        const stats = audioCacheService.getCacheStats();
        console.log("📊 Audio Cache Stats:", {
          fileCount: stats.fileCount,
          totalSize: `${(stats.totalSize / 1024 / 1024).toFixed(1)}MB`,
          maxSize: `${(stats.maxSize / 1024 / 1024).toFixed(1)}MB`,
          usagePercentage: `${stats.usagePercentage.toFixed(1)}%`,
        });
      }
    }
  }, [currentIndex, audioTracks, whispers.length]);

  // Load whispers with caching and retry mechanism
  const loadWhispers = useCallback(
    async (forceRefresh = false, retryAttempt = 0) => {
      try {
        setLoading(true);
        setError(null);

        // Check if we have valid cached data and don't need to force refresh
        if (!forceRefresh && isCacheValid()) {
          console.log("✅ Using cached whispers:", whispers.length);
          setLoading(false);
          setRetryCount(0);
          return;
        }

        console.log("🔄 Loading fresh whispers from Firestore...");
        await firestoreService.getWhispers();

        // Update cache
        setRetryCount(0);
      } catch (err) {
        console.error("Error loading whispers:", err);
        const errorMessage =
          err instanceof Error ? err.message : "Failed to load whispers";
        setError(errorMessage);

        // Implement exponential backoff retry (max 3 attempts)
        if (retryAttempt < 3) {
          const delay = Math.pow(2, retryAttempt) * 1000; // 1s, 2s, 4s
          console.log(`Retrying in ${delay}ms (attempt ${retryAttempt + 1}/3)`);
          setTimeout(() => {
            loadWhispers(forceRefresh, retryAttempt + 1);
          }, delay);
        } else {
          setRetryCount(retryAttempt);
        }
      } finally {
        setLoading(false);
      }
    },
    [firestoreService, isCacheValid, whispers.length, setRetryCount]
  );

  // Set up real-time listener for whispers
  useEffect(() => {
    if (!user || !isAppActive) return;

    console.log("🔄 Setting up real-time whisper listener...");

    const unsubscribe = firestoreService.subscribeToNewWhispers(
      (newWhisper) => {
        try {
          if (!newWhisper || !newWhisper.id || !newWhisper.audioUrl) {
            console.warn("⚠️ Invalid new whisper data:", newWhisper);
            return;
          }

          console.log(`🆕 New whisper detected: ${newWhisper.id}`);

          // Add new whisper to cache
          addNewWhisper(newWhisper);

          // Show new whisper indicator
          setNewWhispersCount(1);

          // Auto-hide the indicator after 5 seconds
          setTimeout(() => {
            setNewWhispersCount(0);
          }, 5000);
        } catch (error) {
          console.error("❌ Error processing new whisper:", error);
        }
      },
      new Date(Date.now() - 60000) // Listen to whispers from the last minute
    );

    return () => {
      console.log("🔄 Cleaning up real-time whisper listener");
      unsubscribe();
    };
  }, [user, firestoreService, isAppActive, addNewWhisper]);

  // Load more whispers (pagination)
  const loadMoreWhispers = useCallback(async () => {
    if (!hasMore || loadingMore || !lastDoc) return;

    try {
      setLoadingMore(true);
      await firestoreService.getWhispers({
        limit: 20,
        startAfter: lastDoc,
      });
    } catch (err) {
      console.error("Error loading more whispers:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, lastDoc, firestoreService]);

  // Refresh whispers
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadWhispers(true);
    setRefreshing(false);
  }, [loadWhispers]);

  // Initialize and load whispers
  useEffect(() => {
    loadWhispers();
  }, [loadWhispers]);

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      setIsAppActive(nextAppState === "active");
      console.log(`App state changed: ${nextAppState}`);
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );
    return () => subscription?.remove();
  }, []);

  // Handle viewable items changed with debouncing
  const viewableItemsChangedRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      // Debounce the viewable items change to prevent excessive re-renders
      if (viewableItemsChangedRef.current) {
        clearTimeout(viewableItemsChangedRef.current);
      }

      viewableItemsChangedRef.current = setTimeout(() => {
        if (viewableItems.length > 0 && viewableItems[0].index !== null) {
          const newIndex = viewableItems[0].index;
          // Only update if the index actually changed
          if (newIndex !== currentIndex) {
            console.log(`Scrolling to slide ${newIndex}`);
            setCurrentIndex(newIndex);
          }
        }
      }, 500); // Increased debounce time to 500ms to reduce re-renders
    },
    [currentIndex]
  );

  // Callback to update whisper data in the store
  const handleWhisperUpdate = useCallback(
    (updatedWhisper: { id: string; replies: number }) => {
      updateWhisper(updatedWhisper);
    },
    [updateWhisper]
  );

  // Memoize render item function to prevent unnecessary re-renders
  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<Whisper>) => {
      // Use a function to get current index to avoid dependency issues
      const getIsActive = () => currentIndex === index;
      console.log(
        "[FeedScreen] renderItem:",
        item.id,
        "replies:",
        item.replies
      );
      return (
        <AudioSlide
          key={item.id}
          whisper={item}
          isVisible={true}
          isActive={getIsActive()}
          onWhisperUpdate={handleWhisperUpdate}
        />
      );
    },
    [currentIndex, handleWhisperUpdate] // Keep this dependency but the issue is elsewhere
  );

  // Memoize key extractor
  const keyExtractor = useCallback((item: Whisper) => item.id, []);

  // Memoize getItemLayout for better performance
  const getItemLayout = useCallback(
    (_: ArrayLike<Whisper> | null | undefined, index: number) => ({
      length: height,
      offset: height * index,
      index,
    }),
    []
  );

  // Pause all audio when FeedScreen loses focus or unmounts
  useFocusEffect(
    React.useCallback(() => {
      // On focus: do nothing
      return () => {
        pauseAllAudioSlides();
        // Clean up debounce timeout
        if (viewableItemsChangedRef.current) {
          clearTimeout(viewableItemsChangedRef.current);
        }
      };
    }, [])
  );

  // Show loading state
  if (loading) {
    return <LoadingSpinner message="Loading whispers..." />;
  }

  // Show error state
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Error: {error}</Text>
        {retryCount > 0 && (
          <Text style={styles.retryInfo}>
            Retried {retryCount} times. Please check your connection.
          </Text>
        )}
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
    <ErrorBoundary>
      <View style={styles.container}>
        {/* New whispers indicator */}
        {newWhispersCount > 0 && (
          <View style={styles.newWhispersIndicator}>
            <Text style={styles.newWhispersText}>
              🎉 {newWhispersCount} new whisper
              {newWhispersCount > 1 ? "s" : ""}!
            </Text>
          </View>
        )}

        <FlatList
          ref={flatListRef}
          data={whispers}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          pagingEnabled
          horizontal={false}
          showsVerticalScrollIndicator={false}
          snapToInterval={height}
          decelerationRate="fast"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 80 }}
          getItemLayout={getItemLayout}
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
          // Performance optimizations
          removeClippedSubviews={true}
          maxToRenderPerBatch={1}
          windowSize={2}
          initialNumToRender={1}
          updateCellsBatchingPeriod={200}
          disableVirtualization={false}
          scrollEventThrottle={64}
          onScrollBeginDrag={() => {
            // Pause all audio when user starts scrolling
            pauseAllAudioSlides();
          }}
          onMomentumScrollEnd={() => {
            // Resume audio for current slide after scrolling stops
            if (currentIndex >= 0 && whispers[currentIndex]) {
              console.log(
                `Resuming audio for slide ${currentIndex} after scroll`
              );
            }
          }}
          maintainVisibleContentPosition={{
            minIndexForVisible: 0,
            autoscrollToTopThreshold: 10,
          }}
        />
      </View>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  // Loading, error, and empty states
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
  retryInfo: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
  },
});

export default FeedScreen;
