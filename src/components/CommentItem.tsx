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
import { Comment, Whisper, ReportCategory } from "../types";
import OptimizedAvatar from "./OptimizedAvatar";
import { useCommentLikes } from "../hooks/useCommentLikes";
import { getCommentReportService } from "../services/commentReportService";
import { useAuth } from "../providers/AuthProvider";

interface CommentItemProps {
  comment: Comment;
  whisper: Whisper;
  currentUserId: string;
  onLikeComment: (commentId: string) => void;
  onDeleteComment: (commentId: string) => void;
  onReportSubmitted?: () => void;
}

const CommentItem: React.FC<CommentItemProps> = React.memo(
  ({
    comment,
    whisper,
    currentUserId,
    onLikeComment,
    onDeleteComment,
    onReportSubmitted,
  }) => {
    const { user } = useAuth();
    const commentReportService = getCommentReportService();

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

    const isCommentOwner = comment.userId === currentUserId;
    const isWhisperOwner = whisper.userId === currentUserId;
    const canDeleteComment = isCommentOwner || isWhisperOwner;

    const handleDelete = useCallback(() => {
      const deleteReason = isWhisperOwner
        ? "Are you sure you want to delete this comment from your whisper?"
        : "Are you sure you want to delete this comment?";

      Alert.alert("Delete Comment", deleteReason, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => onDeleteComment(comment.id),
        },
      ]);
    }, [comment.id, onDeleteComment, isWhisperOwner]);

    const submitReport = useCallback(
      async (category: ReportCategory) => {
        if (!user) return;

        try {
          await commentReportService.createReport({
            commentId: comment.id,
            whisperId: comment.whisperId,
            reporterId: user.uid,
            reporterDisplayName: user.displayName || "Anonymous",
            category,
            reason: `Reported for ${category}`,
          });

          Alert.alert(
            "Report Submitted",
            "Thank you for your report. We'll review it and take appropriate action.",
            [{ text: "OK" }]
          );

          onReportSubmitted?.();
        } catch (error) {
          console.error("Error submitting comment report:", error);
          Alert.alert("Error", "Failed to submit report. Please try again.");
        }
      },
      [
        comment.id,
        comment.whisperId,
        user,
        commentReportService,
        onReportSubmitted,
      ]
    );

    const handleReport = useCallback(async () => {
      if (!user) {
        Alert.alert("Error", "You must be logged in to report comments");
        return;
      }

      // Show report categories
      Alert.alert(
        "Report Comment",
        "Select a reason for reporting this comment:",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Harassment",
            onPress: () => submitReport(ReportCategory.HARASSMENT),
          },
          {
            text: "Hate Speech",
            onPress: () => submitReport(ReportCategory.HATE_SPEECH),
          },
          {
            text: "Violence",
            onPress: () => submitReport(ReportCategory.VIOLENCE),
          },
          {
            text: "Sexual Content",
            onPress: () => submitReport(ReportCategory.SEXUAL_CONTENT),
          },
          { text: "Spam", onPress: () => submitReport(ReportCategory.SPAM) },
          { text: "Scam", onPress: () => submitReport(ReportCategory.SCAM) },
          {
            text: "Personal Info",
            onPress: () => submitReport(ReportCategory.PERSONAL_INFO),
          },
          { text: "Other", onPress: () => submitReport(ReportCategory.OTHER) },
        ]
      );
    }, [user, submitReport]);

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
              {isWhisperOwner && comment.userId !== whisper.userId && (
                <Text style={styles.whisperOwnerBadge}>👑</Text>
              )}
            </View>
            <View style={styles.commentActions}>
              <AnimatedLikeButton isLiked={isLiked} onPress={handleLike} />
              <TouchableOpacity
                onPress={handleShowCommentLikes}
                style={styles.likeCountButton}
              >
                <Text style={styles.likeCount}>{likeCount}</Text>
              </TouchableOpacity>

              {/* Report button - available to everyone except comment owner */}
              {!isCommentOwner && (
                <TouchableOpacity
                  onPress={handleReport}
                  style={styles.reportButton}
                >
                  <Text style={styles.reportIcon}>🚩</Text>
                </TouchableOpacity>
              )}

              {/* Delete button - available to comment owner and whisper owner */}
              {canDeleteComment && (
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
            {isWhisperOwner && comment.userId !== whisper.userId && (
              <Text style={styles.whisperOwnerNote}>
                (You can delete this comment as the whisper owner)
              </Text>
            )}
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
  whisperOwnerBadge: {
    marginLeft: 4,
    fontSize: 12,
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
  reportButton: {
    padding: 4,
    marginRight: 8,
  },
  reportIcon: {
    fontSize: 16,
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
    justifyContent: "space-between",
    alignItems: "center",
  },
  commentTime: {
    fontSize: 12,
    color: "#999",
  },
  whisperOwnerNote: {
    fontSize: 10,
    color: "#666",
    fontStyle: "italic",
  },
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
    flexGrow: 1,
  },
  likeItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
});

export default CommentItem;
