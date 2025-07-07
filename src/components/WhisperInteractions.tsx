import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  Image,
  Animated,
} from "react-native";
import { useAuth } from "../providers/AuthProvider";
import { getInteractionService } from "../services/interactionService";
import { Whisper, Comment } from "../types";
import { FIRESTORE_COLLECTIONS } from "../constants";
import ErrorBoundary from "./ErrorBoundary";

interface WhisperInteractionsProps {
  whisper: Whisper;
  onLikeChange?: (isLiked: boolean, newLikeCount: number) => void;
  onCommentChange?: (newCommentCount: number) => void;
}

interface CommentItemProps {
  comment: Comment;
  currentUserId: string;
  onLikeComment: (commentId: string) => void;
  onDeleteComment: (commentId: string) => void;
}

// Optimized Avatar Component with lazy loading and caching
const OptimizedAvatar: React.FC<{
  displayName: string;
  profileColor: string;
  size?: number;
}> = ({ displayName, profileColor, size = 40 }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    displayName
  )}&background=${profileColor.replace("#", "")}&color=fff&size=${size * 2}`;

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  const handleImageError = () => {
    setImageError(true);
  };

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

const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  currentUserId,
  onLikeComment,
  onDeleteComment,
}) => {
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(comment.likes);
  const [showCommentLikes, setShowCommentLikes] = useState(false);
  const [commentLikes, setCommentLikes] = useState<any[]>([]);
  const [loadingCommentLikes, setLoadingCommentLikes] = useState(false);
  const [commentLikesHasMore, setCommentLikesHasMore] = useState(true);
  const [commentLikesLastDoc, setCommentLikesLastDoc] = useState<any>(null);

  const interactionService = getInteractionService();

  // Load comment like state on mount
  useEffect(() => {
    const loadCommentLikeState = async () => {
      try {
        const hasLiked = await interactionService.hasUserLikedComment(
          comment.id
        );
        setIsLiked(hasLiked);
        // Get the current comment data to ensure we have the latest like count
        const currentComment = await interactionService.getComment(comment.id);
        if (currentComment) {
          setLikeCount(currentComment.likes);
        } else {
          setLikeCount(comment.likes);
        }
      } catch (error) {
        console.error("Error loading comment like state:", error);
        setIsLiked(false);
        setLikeCount(comment.likes);
      }
    };

    loadCommentLikeState();
  }, [comment.id, interactionService]);

  const handleLike = async () => {
    try {
      const result = await interactionService.toggleCommentLike(comment.id);
      setIsLiked(result.isLiked);
      setLikeCount(result.count);
      onLikeComment(comment.id);

      // Refresh the comment data to ensure we have the latest count
      setTimeout(async () => {
        try {
          const currentComment = await interactionService.getComment(
            comment.id
          );
          if (currentComment) {
            setLikeCount(currentComment.likes);
          }
        } catch (error) {
          console.error("Error refreshing comment like count:", error);
        }
      }, 1000); // Small delay to ensure server has updated
    } catch (error) {
      console.error("Error liking comment:", error);
    }
  };

  const handleDelete = () => {
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
  };

  const loadCommentLikes = async (reset = false) => {
    if (loadingCommentLikes) return;
    setLoadingCommentLikes(true);

    try {
      const result = await interactionService.getCommentLikes(
        comment.id,
        20,
        reset ? null : commentLikesLastDoc
      );

      if (reset) {
        setCommentLikes(result.likes);
      } else {
        setCommentLikes([...commentLikes, ...result.likes]);
      }

      setCommentLikesHasMore(result.hasMore);
      setCommentLikesLastDoc(result.lastDoc);
    } catch (error) {
      console.error("Error loading comment likes:", error);
    } finally {
      setLoadingCommentLikes(false);
    }
  };

  const handleShowCommentLikes = () => {
    setShowCommentLikes(true);
    loadCommentLikes(true);
  };

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
            <AnimatedLikeButton
              isLiked={isLiked}
              onPress={handleLike}
              count={likeCount}
            />
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
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.likeItem}>
                <OptimizedAvatar
                  displayName={item.userDisplayName || "Anonymous"}
                  profileColor={item.userProfileColor}
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
};

// Animated Like Button Component
const AnimatedLikeButton: React.FC<{
  isLiked: boolean;
  onPress: () => void;
  count: number;
}> = ({ isLiked, onPress, count }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const heartAnim = useRef(new Animated.Value(isLiked ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(heartAnim, {
      toValue: isLiked ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isLiked, heartAnim]);

  const handlePress = () => {
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
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity onPress={handlePress} style={styles.likeButton}>
        <Animated.Text
          style={[
            styles.likeIcon,
            {
              opacity: heartAnim,
              transform: [{ scale: heartAnim }],
            },
          ]}
        >
          ❤️
        </Animated.Text>
        <Animated.Text
          style={[
            styles.likeIcon,
            {
              opacity: heartAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0],
              }),
            },
          ]}
        >
          🤍
        </Animated.Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const WhisperInteractions: React.FC<WhisperInteractionsProps> = ({
  whisper,
  onLikeChange,
  onCommentChange,
}) => {
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(whisper.likes);
  const [commentCount, setCommentCount] = useState(whisper.replies);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showLikes, setShowLikes] = useState(false);
  const [likes, setLikes] = useState<any[]>([]);
  const [loadingLikes, setLoadingLikes] = useState(false);
  const [likesHasMore, setLikesHasMore] = useState(true);
  const [likesLastDoc, setLikesLastDoc] = useState<any>(null);

  // Comments pagination
  const [commentsHasMore, setCommentsHasMore] = useState(true);
  const [commentsLastDoc, setCommentsLastDoc] = useState<any>(null);

  const interactionService = getInteractionService();

  // Check if user has liked this whisper and update counts when whisper changes
  useEffect(() => {
    const loadLikeState = async () => {
      // Update counts from whisper prop
      setLikeCount(whisper.likes);
      setCommentCount(whisper.replies);

      // Check if user has liked this whisper (cached)
      if (user) {
        try {
          const hasLiked = await interactionService.hasUserLiked(whisper.id);
          setIsLiked(hasLiked);
        } catch (error) {
          console.error("Error loading like state:", error);
          setIsLiked(false);
        }
      } else {
        setIsLiked(false);
      }
    };

    loadLikeState();
  }, [whisper.id, whisper.likes, whisper.replies, user, interactionService]);

  const handleLike = async () => {
    if (!user) {
      Alert.alert("Error", "You must be logged in to like whispers");
      return;
    }

    try {
      // Use optimized interaction service with caching and optimistic updates
      const result = await interactionService.toggleLike(whisper.id);

      setIsLiked(result.isLiked);
      setLikeCount(result.count);
      onLikeChange?.(result.isLiked, result.count);
    } catch (error) {
      console.error("Error liking whisper:", error);
      Alert.alert("Error", "Failed to like whisper");
    }
  };

  // Remove the old loadComments function and replace with proper pagination
  const loadInitialComments = async () => {
    if (loadingComments) return;
    setLoadingComments(true);
    try {
      const result = await interactionService.getComments(whisper.id, 20, null);
      setComments(result.comments);
      setCommentsHasMore(result.hasMore);
      setCommentsLastDoc(result.lastDoc);
    } catch (error) {
      console.error("Error loading comments:", error);
      Alert.alert("Error", "Failed to load comments");
    } finally {
      setLoadingComments(false);
    }
  };

  const handleShowComments = () => {
    setShowComments(true);
    // Reset and load initial comments
    setComments([]);
    setCommentsHasMore(true);
    setCommentsLastDoc(null);
    loadInitialComments();
  };

  const handleSubmitComment = async () => {
    if (!user) {
      Alert.alert("Error", "You must be logged in to comment");
      return;
    }

    if (!newComment.trim()) {
      Alert.alert("Error", "Please enter a comment");
      return;
    }

    setSubmittingComment(true);
    try {
      const result = await interactionService.addComment(
        whisper.id,
        newComment.trim()
      );

      setNewComment("");
      setCommentCount(result.count);
      onCommentChange?.(result.count);

      // Reload comments to show the new one
      loadInitialComments();
    } catch (error) {
      console.error("Error adding comment:", error);
      Alert.alert("Error", "Failed to add comment");
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!user) return;

    try {
      const result = await interactionService.deleteComment(
        commentId,
        whisper.id
      );

      setCommentCount(result.count);
      onCommentChange?.(result.count);
      // Reload comments to remove the deleted comment
      loadInitialComments();
    } catch (error) {
      console.error("Error deleting comment:", error);
      Alert.alert("Error", "Failed to delete comment");
    }
  };

  const handleLikeComment = (commentId: string) => {
    // This will be handled by the CommentItem component
  };

  const handleValidateLikeCount = async () => {
    try {
      const { getFirestoreService } = require("../services/firestoreService");
      const firestoreService = getFirestoreService();

      console.log("🔍 Validating like count for whisper:", whisper.id);
      const actualCount = await firestoreService.validateAndFixLikeCount(
        whisper.id
      );

      // Update local state
      setLikeCount(actualCount);
      onLikeChange?.(isLiked, actualCount);

      Alert.alert(
        "Like Count Validation",
        `Whisper like count: ${actualCount}\nThis count has been validated and fixed if needed.`
      );
    } catch (error) {
      console.error("Error validating like count:", error);
      Alert.alert("Error", "Failed to validate like count");
    }
  };

  // Load paginated likes with deduplication
  const loadLikes = async (reset = false) => {
    if (loadingLikes || (!likesHasMore && !reset)) return;
    setLoadingLikes(true);
    try {
      const result = await interactionService.getLikes(
        whisper.id,
        20,
        reset ? null : likesLastDoc
      );

      if (reset) {
        setLikes(result.likes);
      } else {
        // Deduplicate likes by ID
        const existingIds = new Set(likes.map((l) => l.id));
        const newLikes = result.likes.filter((l) => !existingIds.has(l.id));
        setLikes((prev) => [...prev, ...newLikes]);
      }

      setLikesHasMore(result.hasMore);
      setLikesLastDoc(result.lastDoc);
    } catch (error) {
      console.error("Error loading likes:", error);
      Alert.alert("Error", "Failed to load likes");
    } finally {
      setLoadingLikes(false);
    }
  };

  // Load paginated comments with deduplication
  const loadMoreComments = async () => {
    if (loadingComments || !commentsHasMore) return;
    setLoadingComments(true);
    try {
      const result = await interactionService.getComments(
        whisper.id,
        20,
        commentsLastDoc
      );

      // Deduplicate comments by ID
      const existingIds = new Set(comments.map((c) => c.id));
      const newComments = result.comments.filter((c) => !existingIds.has(c.id));

      setComments((prev) => [...prev, ...newComments]);
      setCommentsHasMore(result.hasMore);
      setCommentsLastDoc(result.lastDoc);
    } catch (error) {
      console.error("Error loading more comments:", error);
      Alert.alert("Error", "Failed to load more comments");
    } finally {
      setLoadingComments(false);
    }
  };

  // Reset likes/comments when modal opens
  useEffect(() => {
    if (showLikes) {
      setLikes([]);
      setLikesHasMore(true);
      setLikesLastDoc(null);
      loadLikes(true);
    }
  }, [showLikes, whisper.id]);

  return (
    <View style={styles.container}>
      {/* Main interaction buttons */}
      <View style={styles.interactionRow}>
        <TouchableOpacity onPress={handleLike} style={styles.interactionButton}>
          <Text style={[styles.interactionIcon, isLiked && styles.likedIcon]}>
            {isLiked ? "❤️" : "🤍"}
          </Text>
          <Text style={styles.countText}>{likeCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleShowComments}
          style={styles.interactionButton}
        >
          <Text style={styles.interactionIcon}>💬</Text>
          <Text style={styles.countText}>{commentCount}</Text>
        </TouchableOpacity>
        {/* View Likes Button */}
        <TouchableOpacity
          onPress={() => setShowLikes(true)}
          style={styles.interactionButton}
        >
          <Text style={styles.interactionIcon}>👥</Text>
        </TouchableOpacity>
        {/* Debug: Validate Like Count Button */}
        <TouchableOpacity
          onPress={handleValidateLikeCount}
          style={[styles.interactionButton, { backgroundColor: "#666" }]}
        >
          <Text style={styles.interactionIcon}>🔍</Text>
        </TouchableOpacity>
      </View>

      {/* Likes Modal */}
      <Modal
        visible={showLikes}
        animationType="slide"
        onRequestClose={() => setShowLikes(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Likes</Text>
            <TouchableOpacity
              onPress={() => setShowLikes(false)}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={likes}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.likeItem}>
                <OptimizedAvatar
                  displayName={item.userDisplayName || "Anonymous"}
                  profileColor={item.userProfileColor}
                />
                <Text style={styles.userName}>
                  {item.userDisplayName || "Anonymous"}
                </Text>
              </View>
            )}
            onEndReached={() => likesHasMore && loadLikes()}
            onEndReachedThreshold={0.5}
            ListFooterComponent={loadingLikes ? <ActivityIndicator /> : null}
            contentContainerStyle={styles.listContentContainer}
          />
        </SafeAreaView>
      </Modal>

      {/* Comments Modal (update for pagination) */}
      <Modal
        visible={showComments}
        animationType="slide"
        onRequestClose={() => setShowComments(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Comments</Text>
            <TouchableOpacity
              onPress={() => setShowComments(false)}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={comments}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <CommentItem
                comment={item}
                currentUserId={user?.uid || ""}
                onLikeComment={handleLikeComment}
                onDeleteComment={handleDeleteComment}
              />
            )}
            onEndReached={() => commentsHasMore && loadMoreComments()}
            onEndReachedThreshold={0.5}
            ListFooterComponent={loadingComments ? <ActivityIndicator /> : null}
            contentContainerStyle={styles.listContentContainer}
          />
          <View style={styles.commentInputRow}>
            <TextInput
              style={styles.commentInput}
              value={newComment}
              onChangeText={setNewComment}
              placeholder="Add a comment..."
              editable={!submittingComment}
            />
            <TouchableOpacity
              onPress={handleSubmitComment}
              style={styles.sendButton}
              disabled={submittingComment}
            >
              <Text style={styles.sendButtonText}>
                {submittingComment ? "..." : "Send"}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    marginBottom: 20,
  },
  interactionRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  interactionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginHorizontal: 8,
    borderRadius: 25,
    backgroundColor: "#f8f9fa",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  interactionIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  likedIcon: {
    color: "#e74c3c",
  },
  countText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#fff",
    paddingTop: 0, // SafeAreaView handles top padding
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e1e8ed",
    backgroundColor: "#fff",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "#f8f9fa",
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    fontSize: 16,
    color: "#666",
    fontWeight: "bold",
  },
  listContentContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  commentInputRow: {
    flexDirection: "row",
    padding: 16,
    paddingBottom: 34, // Extra padding for safe area on devices with home indicator
    borderTopWidth: 1,
    borderTopColor: "#e1e8ed",
    alignItems: "flex-end",
    backgroundColor: "#fff",
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e1e8ed",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 12,
    maxHeight: 100,
    fontSize: 16,
    backgroundColor: "#f8f9fa",
  },
  sendButton: {
    backgroundColor: "#007AFF",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    minWidth: 60,
    alignItems: "center",
  },
  sendButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  commentsList: {
    flex: 1,
  },
  commentItem: {
    padding: 16,
    paddingHorizontal: 20, // Extra horizontal padding to prevent edge-to-edge
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    backgroundColor: "#fff",
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
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  userInitial: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  userName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
    marginRight: 8,
  },
  commentActions: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
    minWidth: 60,
    marginLeft: 8,
  },
  likeButton: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 4,
  },
  likeIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  likeCountButton: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginLeft: 2,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
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
    fontSize: 16,
    color: "#333",
    lineHeight: 22,
    marginBottom: 8,
  },
  commentTime: {
    fontSize: 12,
    color: "#999",
  },
  commentFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  emptyComments: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyCommentsText: {
    fontSize: 16,
    color: "#666",
  },
  likeItem: {
    padding: 16,
    paddingHorizontal: 20, // Extra horizontal padding to prevent edge-to-edge
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
  },
  avatarPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
  },
  avatarImage: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
});

const WhisperInteractionsWithErrorBoundary: React.FC<
  WhisperInteractionsProps
> = (props) => {
  return (
    <ErrorBoundary>
      <WhisperInteractions {...props} />
    </ErrorBoundary>
  );
};

export default WhisperInteractionsWithErrorBoundary;
