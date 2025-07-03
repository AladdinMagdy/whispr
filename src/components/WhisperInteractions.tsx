import React, { useState, useEffect } from "react";
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
} from "react-native";
import { useAuth } from "../providers/AuthProvider";
import { getFirestoreService } from "../services/firestoreService";
import { Whisper, Comment } from "../types";
import { FIRESTORE_COLLECTIONS } from "../constants";

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

const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  currentUserId,
  onLikeComment,
  onDeleteComment,
}) => {
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(comment.likes);

  const handleLike = async () => {
    try {
      const firestoreService = getFirestoreService();
      await firestoreService.likeComment(comment.id, currentUserId);

      const newLikeCount = isLiked ? likeCount - 1 : likeCount + 1;
      setLikeCount(newLikeCount);
      setIsLiked(!isLiked);
      onLikeComment(comment.id);
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

  return (
    <View style={styles.commentItem}>
      <View style={styles.commentHeader}>
        <View style={styles.commentUserInfo}>
          <View
            style={[
              styles.userAvatar,
              { backgroundColor: comment.userProfileColor },
            ]}
          >
            <Text style={styles.userInitial}>
              {comment.userDisplayName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.userName}>{comment.userDisplayName}</Text>
        </View>
        <View style={styles.commentActions}>
          <TouchableOpacity onPress={handleLike} style={styles.likeButton}>
            <Text style={[styles.likeIcon, isLiked && styles.likedIcon]}>
              {isLiked ? "❤️" : "🤍"}
            </Text>
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
      <Text style={styles.commentTime}>
        {new Date(comment.createdAt).toLocaleDateString()}
      </Text>
    </View>
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

  const firestoreService = getFirestoreService();

  // Check if user has liked this whisper and update counts when whisper changes
  useEffect(() => {
    // Update counts from whisper prop
    setLikeCount(whisper.likes);
    setCommentCount(whisper.replies);

    // Check if user has liked this whisper
    if (user) {
      firestoreService
        .hasUserLikedWhisper(whisper.id, user.uid)
        .then(setIsLiked)
        .catch(console.error);
    } else {
      setIsLiked(false);
    }
  }, [whisper.id, whisper.likes, whisper.replies, user]);

  const handleLike = async () => {
    if (!user) {
      Alert.alert("Error", "You must be logged in to like whispers");
      return;
    }

    try {
      await firestoreService.likeWhisper(whisper.id, user.uid);

      // Refresh whisper data to get accurate counts
      const updatedWhisper = await firestoreService.getWhisper(whisper.id);
      if (updatedWhisper) {
        setLikeCount(updatedWhisper.likes);
        setCommentCount(updatedWhisper.replies);
        onLikeChange?.(!isLiked, updatedWhisper.likes);
      } else {
        // Fallback to local calculation
        const newLikeCount = isLiked ? likeCount - 1 : likeCount + 1;
        setLikeCount(newLikeCount);
        onLikeChange?.(!isLiked, newLikeCount);
      }

      setIsLiked(!isLiked);
    } catch (error) {
      console.error("Error liking whisper:", error);
      Alert.alert("Error", "Failed to like whisper");
    }
  };

  const loadComments = async () => {
    if (loadingComments) return;

    setLoadingComments(true);
    try {
      const fetchedComments = await firestoreService.getComments(whisper.id);
      setComments(fetchedComments);
    } catch (error) {
      console.error("Error loading comments:", error);
      Alert.alert("Error", "Failed to load comments");
    } finally {
      setLoadingComments(false);
    }
  };

  const handleShowComments = () => {
    setShowComments(true);
    loadComments();
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
      await firestoreService.addComment(
        whisper.id,
        user.uid,
        user.displayName, // Using displayName from AnonymousUser
        user.profileColor, // Using profileColor from AnonymousUser
        newComment.trim()
      );

      setNewComment("");

      // Refresh whisper data to get accurate counts
      const updatedWhisper = await firestoreService.getWhisper(whisper.id);
      if (updatedWhisper) {
        setLikeCount(updatedWhisper.likes);
        setCommentCount(updatedWhisper.replies);
        onCommentChange?.(updatedWhisper.replies);
      } else {
        // Fallback to local calculation
        const newCommentCount = commentCount + 1;
        setCommentCount(newCommentCount);
        onCommentChange?.(newCommentCount);
      }

      // Reload comments to show the new one
      loadComments();
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
      await firestoreService.deleteComment(commentId, user.uid);

      // Refresh whisper data to get accurate counts
      const updatedWhisper = await firestoreService.getWhisper(whisper.id);
      if (updatedWhisper) {
        setLikeCount(updatedWhisper.likes);
        setCommentCount(updatedWhisper.replies);
        onCommentChange?.(updatedWhisper.replies);
      } else {
        // Fallback to local calculation
        const newCommentCount = commentCount - 1;
        setCommentCount(newCommentCount);
        onCommentChange?.(newCommentCount);
      }

      loadComments(); // Reload to remove the deleted comment
    } catch (error) {
      console.error("Error deleting comment:", error);
      Alert.alert("Error", "Failed to delete comment");
    }
  };

  const handleLikeComment = (commentId: string) => {
    // This will be handled by the CommentItem component
  };

  return (
    <View style={styles.container}>
      {/* Main interaction buttons */}
      <View style={styles.interactionRow}>
        <TouchableOpacity onPress={handleLike} style={styles.interactionButton}>
          <Text style={[styles.interactionIcon, isLiked && styles.likedIcon]}>
            {isLiked ? "❤️" : "🤍"}
          </Text>
          <Text style={styles.interactionCount}>{likeCount}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleShowComments}
          style={styles.interactionButton}
        >
          <Text style={styles.interactionIcon}>💬</Text>
          <Text style={styles.interactionCount}>{commentCount}</Text>
        </TouchableOpacity>
      </View>

      {/* Comments Modal */}
      <Modal
        visible={showComments}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowComments(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Comments ({commentCount})</Text>
            <TouchableOpacity
              onPress={() => setShowComments(false)}
              style={styles.closeButton}
            >
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Add comment section */}
          <View style={styles.addCommentSection}>
            <TextInput
              style={styles.commentInput}
              placeholder="Add a comment..."
              value={newComment}
              onChangeText={setNewComment}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              onPress={handleSubmitComment}
              disabled={submittingComment || !newComment.trim()}
              style={[
                styles.submitButton,
                (!newComment.trim() || submittingComment) &&
                  styles.submitButtonDisabled,
              ]}
            >
              {submittingComment ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Post</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Comments list */}
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
            ListEmptyComponent={
              <View style={styles.emptyComments}>
                <Text style={styles.emptyCommentsText}>
                  {loadingComments ? "Loading comments..." : "No comments yet"}
                </Text>
              </View>
            }
            style={styles.commentsList}
          />
        </View>
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
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  interactionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
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
  interactionCount: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
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
    borderBottomColor: "#e1e8ed",
    backgroundColor: "#f8f9fa",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  closeButton: {
    padding: 8,
  },
  closeIcon: {
    fontSize: 20,
    color: "#666",
  },
  addCommentSection: {
    flexDirection: "row",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e1e8ed",
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
  submitButton: {
    backgroundColor: "#007AFF",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    minWidth: 60,
    alignItems: "center",
  },
  submitButtonDisabled: {
    backgroundColor: "#ccc",
  },
  submitButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  commentsList: {
    flex: 1,
  },
  commentItem: {
    padding: 16,
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
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  userInitial: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
  userName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  commentActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  likeButton: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 12,
  },
  likeIcon: {
    fontSize: 16,
    marginRight: 4,
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
});

export default WhisperInteractions;
