import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

interface InteractionButtonsProps {
  isLiked: boolean;
  likeCount: number;
  commentCount?: number;
  onLike: () => void;
  onShowComments: () => void;
  onShowLikes: () => void;
  onValidateLikeCount: () => void;
}

const InteractionButtons: React.FC<InteractionButtonsProps> = ({
  isLiked,
  likeCount,
  commentCount,
  onLike,
  onShowComments,
  onShowLikes,
  onValidateLikeCount,
}) => {
  return (
    <View style={styles.interactionRow}>
      <TouchableOpacity onPress={onLike} style={styles.interactionButton}>
        <Text style={[styles.interactionIcon, isLiked && styles.likedIcon]}>
          {isLiked ? "❤️" : "🤍"}
        </Text>
        <Text style={styles.countText}>{likeCount}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onShowComments}
        style={styles.interactionButton}
      >
        <Text style={styles.interactionIcon}>💬</Text>
        <Text style={styles.countText}>
          {commentCount !== undefined ? commentCount : ""}
        </Text>
      </TouchableOpacity>

      {/* View Likes Button */}
      <TouchableOpacity onPress={onShowLikes} style={styles.interactionButton}>
        <Text style={styles.interactionIcon}>👥</Text>
      </TouchableOpacity>

      {/* Debug: Validate Like Count Button */}
      <TouchableOpacity
        onPress={onValidateLikeCount}
        style={[styles.interactionButton, { backgroundColor: "#666" }]}
      >
        <Text style={styles.interactionIcon}>🔍</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  interactionRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  interactionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f8f9fa",
  },
  interactionIcon: {
    fontSize: 18,
    marginRight: 4,
  },
  likedIcon: {
    // Already styled with emoji
  },
  countText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
});

export default InteractionButtons;
