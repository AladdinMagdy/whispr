import React, { useMemo } from "react";
import { View, Image, StyleSheet } from "react-native";
import { Whisper } from "../types";

interface BackgroundMediaProps {
  whisper: Whisper;
}

const BackgroundMedia: React.FC<BackgroundMediaProps> = React.memo(
  ({ whisper }) => {
    // Memoize the background image URL to prevent unnecessary re-renders
    const backgroundImageUrl = useMemo(() => {
      const userColor = whisper.userProfileColor || "#007AFF";
      const userName = whisper.userDisplayName || "Mysterious Whisperer";

      // Create a gradient-like background using UI Avatars API
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(
        userName
      )}&background=${userColor.replace("#", "")}&color=fff&size=400&bold=true`;
    }, [whisper.userProfileColor, whisper.userDisplayName]);

    return (
      <View style={styles.backgroundContainer}>
        {/* Background image */}
        <Image
          source={{ uri: backgroundImageUrl }}
          style={styles.backgroundImage}
          resizeMode="cover"
          // Performance optimizations
          fadeDuration={200}
          key={backgroundImageUrl}
        />

        {/* Gradient overlay for better text readability */}
        <View style={styles.gradientOverlay} />

        {/* Audio visualizer placeholder */}
        <View style={styles.audioVisualizer}>
          {/* TODO: Add real-time audio visualizer */}
        </View>
      </View>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison function to prevent unnecessary re-renders
    return (
      prevProps.whisper.userProfileColor ===
        nextProps.whisper.userProfileColor &&
      prevProps.whisper.userDisplayName === nextProps.whisper.userDisplayName
    );
  }
);

BackgroundMedia.displayName = "BackgroundMedia";

const styles = StyleSheet.create({
  backgroundContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  backgroundImage: {
    width: "100%",
    height: "100%",
  },
  gradientOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    zIndex: 1,
  },
  audioVisualizer: {
    position: "absolute",
    bottom: 100,
    left: 20,
    right: 20,
    height: 60,
    zIndex: 2,
    // TODO: Add audio visualizer component
  },
});

export default BackgroundMedia;
