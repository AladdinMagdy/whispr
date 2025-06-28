import React, { useEffect, useRef, useState, useCallback } from "react";
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

const { height, width } = Dimensions.get("window");

// Placeholder data (replace with Firestore whispers)
const AUDIO_FEED = [
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

type AudioFeedItem = (typeof AUDIO_FEED)[number];

const setupPlayer = async () => {
  await TrackPlayer.setupPlayer();
  await TrackPlayer.reset();
  await TrackPlayer.add(AUDIO_FEED);
};

const FeedScreen = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const playbackState = usePlaybackState();
  const progress = useProgress();
  const flatListRef = useRef<FlatList<AudioFeedItem>>(null);

  useEffect(() => {
    setupPlayer();
    return () => {
      TrackPlayer.reset();
    };
  }, []);

  // Play the current track when index changes
  useEffect(() => {
    TrackPlayer.skip(AUDIO_FEED[currentIndex].id as any);
    TrackPlayer.play();
  }, [currentIndex]);

  const onViewableItemsChanged = useRef(
    (params: { viewableItems: ViewToken[]; changed: ViewToken[] }) => {
      if (
        params.viewableItems.length > 0 &&
        params.viewableItems[0].index !== null
      ) {
        setCurrentIndex(params.viewableItems[0].index);
      }
    }
  ).current;

  const renderItem = ({ item }: ListRenderItemInfo<AudioFeedItem>) => (
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
        onPress={() => {
          if (playbackState.state === State.Playing) {
            TrackPlayer.pause();
          } else {
            TrackPlayer.play();
          }
        }}
      >
        <Text style={styles.playPauseText}>
          {playbackState.state === State.Playing ? "Pause" : "Play"}
        </Text>
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
