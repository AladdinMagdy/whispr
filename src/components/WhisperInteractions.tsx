import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
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
import { Whisper, Comment, Like } from "../types";
import ErrorBoundary from "./ErrorBoundary";
import {
  getFirestoreService,
  CommentLikeData,
} from "../services/firestoreService";
import { onSnapshot, doc } from "firebase/firestore";
import { usePerformanceMonitor } from "../hooks/usePerformanceMonitor";

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
const OptimizedAvatar = React.memo<{
  displayName: string;
  profileColor: string;
  size?: number;
}>(({ displayName, profileColor, size = 40 }) => {
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
});
OptimizedAvatar.displayName = "OptimizedAvatar";

const CommentItem = React.memo<CommentItemProps>(
  ({ comment, currentUserId, onLikeComment, onDeleteComment }) => {
    const [isLiked, setIsLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(comment.likes);
    const [showCommentLikes, setShowCommentLikes] = useState(false);
    const [commentLikes, setCommentLikes] = useState<CommentLikeData[]>([]);
    const [loadingCommentLikes, setLoadingCommentLikes] = useState(false);
    const [commentLikesHasMore, setCommentLikesHasMore] = useState(true);
    const [commentLikesLastDoc, setCommentLikesLastDoc] =
      useState<unknown>(null);

    // Use refs to prevent infinite loops
    const interactionServiceRef = useRef(getInteractionService());
    const firestoreServiceRef = useRef(getFirestoreService());

    // Load comment like state on mount
    useEffect(() => {
      const loadCommentLikeState = async () => {
        try {
          const isLiked =
            await interactionServiceRef.current.hasUserLikedComment(comment.id);
          setIsLiked(isLiked);
          setLikeCount(comment.likes);
        } catch (error) {
          console.error("Error loading comment like state:", error);
          setIsLiked(false);
          setLikeCount(comment.likes);
        }
      };

      loadCommentLikeState();
    }, [comment.id, comment.likes]); // Remove service dependencies

    // Real-time comment likes modal
    useEffect(() => {
      let unsubscribe: (() => void) | undefined;
      if (showCommentLikes) {
        setLoadingCommentLikes(true);
        unsubscribe = firestoreServiceRef.current.subscribeToCommentLikes(
          comment.id,
          (likes) => {
            setCommentLikes(likes);
            setLoadingCommentLikes(false);
          }
        );
      }
      return () => {
        if (unsubscribe) unsubscribe();
      };
    }, [showCommentLikes, comment.id]); // Remove service dependency

    const handleLike = useCallback(async () => {
      // Optimistic update - update UI immediately
      const newIsLiked = !isLiked;
      const newLikeCount = newIsLiked ? likeCount + 1 : likeCount - 1;

      setIsLiked(newIsLiked);
      setLikeCount(newLikeCount);
      onLikeComment(comment.id);

      try {
        // Call server after optimistic update
        await interactionServiceRef.current.toggleCommentLike(comment.id);

        // The real-time listener will sync the actual state from the server
        // No need to update state here as the listener handles it
      } catch (error) {
        console.error("Error liking comment:", error);

        // Revert optimistic update on error
        setIsLiked(!newIsLiked);
        setLikeCount(newIsLiked ? likeCount - 1 : likeCount + 1);
      }
    }, [comment.id, onLikeComment, isLiked, likeCount]);

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

    const loadCommentLikes = useCallback(
      async (reset = false) => {
        if (loadingCommentLikes) return;
        setLoadingCommentLikes(true);

        try {
          const result = await interactionServiceRef.current.getCommentLikes(
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
      },
      [comment.id, loadingCommentLikes, commentLikes, commentLikesLastDoc]
    );

    const handleShowCommentLikes = useCallback(() => {
      setShowCommentLikes(true);
      loadCommentLikes(true);
    }, [loadCommentLikes]);

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
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const heartAnim = useRef(new Animated.Value(isLiked ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(heartAnim, {
      toValue: isLiked ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isLiked, heartAnim]);

  const handlePress = useCallback(() => {
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

const WhisperInteractions = React.memo<WhisperInteractionsProps>(
  ({ whisper, onLikeChange, onCommentChange }) => {
    // Add performance monitoring
    usePerformanceMonitor("WhisperInteractions");

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
    const [likes, setLikes] = useState<Like[]>([]);
    const [loadingLikes, setLoadingLikes] = useState(false);
    const [likesHasMore, setLikesHasMore] = useState(true);
    const [likesLastDoc, setLikesLastDoc] = useState<unknown>(null);

    // Comments pagination
    const [commentsHasMore, setCommentsHasMore] = useState(true);
    const [commentsLastDoc, setCommentsLastDoc] = useState<unknown>(null);

    // Use refs to prevent infinite loops
    const interactionServiceRef = useRef(getInteractionService());
    const firestoreServiceRef = useRef(getFirestoreService());
    const likesLoadedRef = useRef(false);
    const loadLikesRef = useRef<((reset?: boolean) => Promise<void>) | null>(
      null
    );

    // Real-time like and comment count for whisper
    useEffect(() => {
      const whisperDocRef = doc(
        firestoreServiceRef.current["firestore"],
        "whispers",
        whisper.id
      );
      const unsubscribe = onSnapshot(whisperDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setLikeCount(data.likes || 0);
          setCommentCount(data.replies || 0);
        }
      });
      return () => unsubscribe();
    }, [whisper.id]);

    // Real-time comments modal
    useEffect(() => {
      let unsubscribe: (() => void) | undefined;
      if (showComments) {
        setLoadingComments(true);
        unsubscribe = firestoreServiceRef.current.subscribeToComments(
          whisper.id,
          (newComments) => {
            // Replace comments array with server data - this will include the new comment
            // and replace any optimistic comments with their server versions
            setComments(newComments);
            setLoadingComments(false);
          }
        );
      }
      return () => {
        if (unsubscribe) unsubscribe();
      };
    }, [showComments, whisper.id]);

    // Real-time likes modal
    useEffect(() => {
      let unsubscribe: (() => void) | undefined;
      if (showLikes) {
        setLoadingLikes(true);
        unsubscribe = firestoreServiceRef.current.subscribeToWhisperLikes(
          whisper.id,
          (likes) => {
            setLikes(likes);
            setLoadingLikes(false);
          }
        );
      }
      return () => {
        if (unsubscribe) unsubscribe();
      };
    }, [showLikes, whisper.id]);

    // Check if user has liked this whisper and update counts when whisper changes
    useEffect(() => {
      const loadLikeState = async () => {
        // Update counts from whisper prop
        setLikeCount(whisper.likes);
        setCommentCount(whisper.replies);

        // Check if user has liked this whisper (cached)
        if (user?.uid) {
          try {
            const hasLiked = await interactionServiceRef.current.hasUserLiked(
              whisper.id
            );
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
    }, [whisper.id, whisper.likes, whisper.replies, user?.uid]); // Use user?.uid instead of user

    // Load paginated likes with deduplication
    const loadLikes = useCallback(
      async (reset = false) => {
        if (loadingLikes) return;
        setLoadingLikes(true);

        try {
          const result = await interactionServiceRef.current.getLikes(
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
      },
      [loadingLikes, whisper.id, likes, likesLastDoc] // Remove interactionServiceRef dependency
    );

    // Store the function in ref to avoid dependency issues
    loadLikesRef.current = loadLikes;

    // Reset likes when modal opens - use ref to prevent infinite loop
    useEffect(() => {
      if (showLikes && !likesLoadedRef.current) {
        setLikes([]);
        setLikesHasMore(true);
        setLikesLastDoc(null);
        likesLoadedRef.current = true;
        loadLikesRef.current?.(true);
      } else if (!showLikes) {
        likesLoadedRef.current = false;
      }
    }, [showLikes, whisper.id]); // Now we don't need loadLikes dependency

    const handleLike = async () => {
      if (!user) {
        Alert.alert("Error", "You must be logged in to like whispers");
        return;
      }

      // Optimistic update - update UI immediately
      const newIsLiked = !isLiked;
      const newLikeCount = newIsLiked ? likeCount + 1 : likeCount - 1;

      setIsLiked(newIsLiked);
      setLikeCount(newLikeCount);
      onLikeChange?.(newIsLiked, newLikeCount);

      try {
        // Call server after optimistic update
        await interactionServiceRef.current.toggleLike(whisper.id);

        // The real-time listener will sync the actual state from the server
        // No need to update state here as the listener handles it
      } catch (error) {
        console.error("Error liking whisper:", error);
        Alert.alert("Error", "Failed to like whisper");

        // Revert optimistic update on error
        setIsLiked(!newIsLiked);
        setLikeCount(newIsLiked ? likeCount - 1 : likeCount + 1);
        onLikeChange?.(!newIsLiked, newIsLiked ? likeCount - 1 : likeCount + 1);
      }
    };

    // Remove the old loadComments function and replace with proper pagination
    const loadInitialComments = async () => {
      if (loadingComments) return;
      setLoadingComments(true);
      try {
        const result = await interactionServiceRef.current.getComments(
          whisper.id,
          20,
          null
        );
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

      // Create optimistic comment first
      const optimisticComment = {
        id: `optimistic-${Date.now()}`, // Temporary ID to avoid conflicts
        whisperId: whisper.id,
        userId: user.uid,
        userDisplayName: user.displayName,
        userProfileColor: user.profileColor,
        text: newComment.trim(),
        likes: 0,
        createdAt: new Date(),
        isEdited: false,
      };

      // Add optimistic comment to UI IMMEDIATELY (before server call)
      setComments((prev) => [optimisticComment, ...prev]);

      // Update comment count optimistically
      setCommentCount((prev) => prev + 1);
      onCommentChange?.(commentCount + 1);

      // Clear input immediately for better UX
      const text = newComment.trim();
      setNewComment("");

      try {
        // Now call the server - the optimistic comment is already in place
        await interactionServiceRef.current.addComment(whisper.id, text);

        // The real-time listener will replace the optimistic comment with the real one
        // when it receives the server update
      } catch (error) {
        console.error("Error adding comment:", error);
        Alert.alert("Error", "Failed to add comment");

        // Remove optimistic comment on error
        setComments((prev) =>
          prev.filter((c) => c.id !== optimisticComment.id)
        );
        setCommentCount((prev) => prev - 1);
        onCommentChange?.(commentCount - 1);
      } finally {
        setSubmittingComment(false);
      }
    };

    const handleDeleteComment = async (commentId: string) => {
      if (!user) return;

      // Optimistic update - remove comment from UI immediately
      const commentToDelete = comments.find((c) => c.id === commentId);
      if (!commentToDelete) return;

      // Remove comment from UI immediately
      setComments((prev) => prev.filter((c) => c.id !== commentId));

      // Update comment count optimistically
      const newCommentCount = commentCount - 1;
      setCommentCount(newCommentCount);
      onCommentChange?.(newCommentCount);

      try {
        // Call server after optimistic update
        await interactionServiceRef.current.deleteComment(
          commentId,
          whisper.id
        );

        // The real-time listener will sync the actual state from the server
        // No need to update state here as the listener handles it
      } catch (error) {
        console.error("Error deleting comment:", error);
        Alert.alert("Error", "Failed to delete comment");

        // Revert optimistic update on error
        setComments((prev) => [...prev, commentToDelete]);
        setCommentCount((prev) => prev + 1);
        onCommentChange?.(commentCount + 1);
      }
    };

    const handleLikeComment = () => {
      // This will be handled by the CommentItem component
    };

    const handleValidateLikeCount = async () => {
      try {
        console.log("🔍 Validating like count for whisper:", whisper.id);
        const actualCount =
          await firestoreServiceRef.current.validateAndFixLikeCount(whisper.id);

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

    // Load paginated comments with deduplication
    const loadMoreComments = async () => {
      if (loadingComments || !commentsHasMore) return;
      setLoadingComments(true);
      try {
        const result = await interactionServiceRef.current.getComments(
          whisper.id,
          20,
          commentsLastDoc
        );

        // Deduplicate comments by ID to prevent duplicates
        const existingIds = new Set(comments.map((c) => c.id));
        const newComments = result.comments.filter(
          (c) => !existingIds.has(c.id)
        );

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

    return (
      <View style={styles.container}>
        {/* Main interaction buttons */}
        <View style={styles.interactionRow}>
          <TouchableOpacity
            onPress={handleLike}
            style={styles.interactionButton}
          >
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
              ListFooterComponent={
                loadingComments ? <ActivityIndicator /> : null
              }
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
  }
);
WhisperInteractions.displayName = "WhisperInteractions";

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
  likeButtonContent: {
    alignItems: "center",
    justifyContent: "center",
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
