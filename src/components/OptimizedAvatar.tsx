import React, { useState, useCallback, useMemo } from "react";
import { View, Text, Image, StyleSheet } from "react-native";

interface OptimizedAvatarProps {
  displayName: string;
  profileColor: string;
  size?: number;
}

const OptimizedAvatar: React.FC<OptimizedAvatarProps> = ({
  displayName,
  profileColor,
  size = 40,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const avatarUrl = useMemo(
    () =>
      `https://ui-avatars.com/api/?name=${encodeURIComponent(
        displayName
      )}&background=${profileColor.replace("#", "")}&color=fff&size=${
        size * 2
      }`,
    [displayName, profileColor, size]
  );

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
  }, []);

  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);

  if (imageError) {
    // Fallback to colored circle with initial
    return (
      <View
        style={[
          styles.userAvatar,
          {
            backgroundColor: profileColor,
            width: size,
            height: size,
            borderRadius: size / 2,
          },
        ]}
      >
        <Text style={[styles.userInitial, { fontSize: size * 0.4 }]}>
          {displayName?.charAt(0)?.toUpperCase() || "?"}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.avatarContainer, { width: size, height: size }]}>
      {!imageLoaded && (
        <View
          style={[
            styles.avatarPlaceholder,
            {
              backgroundColor: profileColor,
              width: size,
              height: size,
              borderRadius: size / 2,
            },
          ]}
        >
          <Text style={[styles.userInitial, { fontSize: size * 0.4 }]}>
            {displayName?.charAt(0)?.toUpperCase() || "?"}
          </Text>
        </View>
      )}
      <Image
        source={{ uri: avatarUrl }}
        style={[
          styles.avatarImage,
          { width: size, height: size, borderRadius: size / 2 },
          { opacity: imageLoaded ? 1 : 0 },
        ]}
        onLoad={handleImageLoad}
        onError={handleImageError}
        // Performance optimizations
        fadeDuration={200}
        resizeMode="cover"
        // Prevent unnecessary re-renders
        key={avatarUrl}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  avatarContainer: {
    position: "relative",
  },
  avatarPlaceholder: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarImage: {
    position: "absolute",
  },
  userAvatar: {
    justifyContent: "center",
    alignItems: "center",
  },
  userInitial: {
    color: "#fff",
    fontWeight: "bold",
  },
});

export default OptimizedAvatar;
