import React from "react";
import { View, Image, StyleSheet, Dimensions } from "react-native";
import { Whisper } from "../types";

const { height, width } = Dimensions.get("window");

interface BackgroundMediaProps {
  whisper: Whisper;
}

const BackgroundMedia: React.FC<BackgroundMediaProps> = ({ whisper }) => {
  // Generate a background image based on user profile color
  const getBackgroundImage = () => {
    const userColor = whisper.userProfileColor || "#007AFF";
    const userName = whisper.userDisplayName || "Anonymous";

    // Create a gradient-like background using UI Avatars API
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(
      userName
    )}&background=${userColor.replace("#", "")}&color=fff&size=400&bold=true`;
  };

  return (
    <View style={styles.backgroundContainer}>
      {/* Background image */}
      <Image
        source={{ uri: getBackgroundImage() }}
        style={styles.backgroundImage}
        resizeMode="cover"
      />

      {/* Gradient overlay for better text readability */}
      <View style={styles.gradientOverlay} />

      {/* Audio visualizer placeholder */}
      <View style={styles.audioVisualizer}>
        {/* TODO: Add real-time audio visualizer */}
      </View>
    </View>
  );
};

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
