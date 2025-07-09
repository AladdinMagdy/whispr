import React, { useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  Animated,
} from "react-native";
import { Comment } from "../types";
import OptimizedAvatar from "./OptimizedAvatar";
import { useCommentLikes } from "../hooks/useCommentLikes";

interface CommentItemProps {
  comment: Comment;
  currentUserId: string;
  onLikeComment: (commentId: string) => void;
  onDeleteComment: (commentId: string) => void;
}

const CommentItem: React.FC<CommentItemProps> = React.memo(
  ({ comment, currentUserId, onLikeComment, onDeleteComment }) => {
    const {
      isLiked,
      likeCount,
      showCommentLikes,
      setShowCommentLikes,
      commentLikes,
      loadingCommentLikes,
      commentLikesHasMore,
      handleLike,
      handleShowCommentLikes,
      loadCommentLikes,
    } = useCommentLikes({ comment, onLikeComment });

    const handleDelete = useCallback(() => {
      Alert.alert(
        "Delete Comment",
        "Are you sure you want to delete this comment?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => onDeleteComment(comment.id),
          },
        ]
      );
    }, [comment.id, onDeleteComment]);

    return (
      <>
        <View style={styles.commentItem}>
          <View style={styles.commentHeader}>
            <View style={styles.commentUserInfo}>
              <OptimizedAvatar
                displayName={comment.userDisplayName || "Anonymous"}
                profileColor={comment.userProfileColor}
              />
              <Text style={styles.userName}>
                {comment.userDisplayName || "Anonymous"}
              </Text>
            </View>
            <View style={styles.commentActions}>
              <AnimatedLikeButton isLiked={isLiked} onPress={handleLike} />
              <TouchableOpacity
                onPress={handleShowCommentLikes}
                style={styles.likeCountButton}
              >
                <Text style={styles.likeCount}>{likeCount}</Text>
              </TouchableOpacity>
              {comment.userId === currentUserId && (
                <TouchableOpacity
                  onPress={handleDelete}
                  style={styles.deleteButton}
                >
                  <Text style={styles.deleteIcon}>🗑️</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          <Text style={styles.commentText}>{comment.text}</Text>
          <View style={styles.commentFooter}>
            <Text style={styles.commentTime}>
              {new Date(comment.createdAt).toLocaleDateString()}
            </Text>
          </View>
        </View>

        {/* Comment Likes Modal */}
        <Modal
          visible={showCommentLikes}
          animationType="slide"
          onRequestClose={() => setShowCommentLikes(false)}
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Comment Likes</Text>
              <TouchableOpacity
                onPress={() => setShowCommentLikes(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={commentLikes}
              keyExtractor={(item) => item.userId}
              renderItem={({ item }) => (
                <View style={styles.likeItem}>
                  <OptimizedAvatar
                    displayName={item.userDisplayName || "Anonymous"}
                    profileColor={item.userProfileColor || "#9E9E9E"}
                  />
                  <Text style={styles.userName}>
                    {item.userDisplayName || "Anonymous"}
                  </Text>
                </View>
              )}
              onEndReached={() => commentLikesHasMore && loadCommentLikes()}
              onEndReachedThreshold={0.5}
              ListFooterComponent={
                loadingCommentLikes ? <ActivityIndicator /> : null
              }
              contentContainerStyle={styles.listContentContainer}
            />
          </SafeAreaView>
        </Modal>
      </>
    );
  }
);

CommentItem.displayName = "CommentItem";

// Animated Like Button Component
const AnimatedLikeButton = React.memo<{
  isLiked: boolean;
  onPress: () => void;
}>(({ isLiked, onPress }) => {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const heartAnim = React.useRef(new Animated.Value(isLiked ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.timing(heartAnim, {
      toValue: isLiked ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isLiked, heartAnim]);

  const handlePress = React.useCallback(() => {
    // Scale animation on press
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    onPress();
  }, [scaleAnim, onPress]);

  return (
    <TouchableOpacity onPress={handlePress} style={styles.likeButton}>
      <Animated.View
        style={[
          styles.likeButtonContent,
          {
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Text style={[styles.likeIcon, isLiked && styles.likedIcon]}>
          {isLiked ? "❤️" : "🤍"}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
});

AnimatedLikeButton.displayName = "AnimatedLikeButton";

const styles = StyleSheet.create({
  commentItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  commentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  commentUserInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  userName: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  commentActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  likeButton: {
    marginRight: 8,
  },
  likeButtonContent: {
    padding: 4,
  },
  likeIcon: {
    fontSize: 16,
  },
  likedIcon: {
    // Already styled with emoji
  },
  likeCountButton: {
    marginRight: 8,
  },
  likeCount: {
    fontSize: 12,
    color: "#666",
  },
  deleteButton: {
    padding: 4,
  },
  deleteIcon: {
    fontSize: 16,
  },
  commentText: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
    marginBottom: 8,
  },
  commentFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  commentTime: {
    fontSize: 12,
    color: "#999",
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 18,
    color: "#666",
  },
  listContentContainer: {
    padding: 16,
  },
  likeItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
});

export default CommentItem;
