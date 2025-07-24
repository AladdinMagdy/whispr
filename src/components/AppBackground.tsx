import React from "react";
import { View, StyleSheet, ImageBackground } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

interface AppBackgroundProps {
  children: React.ReactNode;
  variant?: "default" | "animated" | "static";
}

const AppBackground: React.FC<AppBackgroundProps> = ({
  children,
  variant = "default",
}) => {
  return (
    <View style={styles.container}>
      {/* Primary gradient background using expo-linear-gradient */}
      <LinearGradient
        colors={["#010113", "#0E0E31"]}
        style={styles.primaryGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      {/* Secondary gradient overlay */}
      <LinearGradient
        colors={["rgba(49, 255, 156, 0.105)", "rgba(51, 27, 82, 0.15)"]}
        style={styles.secondaryGradient}
        start={{ x: 0, y: 0.0954 }}
        end={{ x: 0, y: 0.5793 }}
      />

      {/* Background image on top of gradient */}
      <ImageBackground
        // eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef
        source={require("../../assets/bg-image.png")}
        style={styles.backgroundImage}
        resizeMode="cover"
        imageStyle={styles.backgroundImageStyle}
      >
        <View style={styles.content}>{children}</View>
      </ImageBackground>

      {variant === "animated" && (
        <View style={styles.particlesContainer}>
          {/* TODO: Add animated particles */}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: "relative",
    backgroundColor: "#010113", // Fallback background color
  },
  primaryGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  secondaryGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
  },
  backgroundImage: {
    flex: 1,
    zIndex: 3,
  },
  backgroundImageStyle: {
    opacity: 0.05, // Lowered opacity for more subtle background image
  },
  content: {
    flex: 1,
    zIndex: 4,
  },
  particlesContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
  },
});

export default AppBackground;
