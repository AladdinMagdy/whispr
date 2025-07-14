import React from "react";
import { View, StyleSheet } from "react-native";
import { useAuth } from "../providers/AuthProvider";
import { Whisper } from "../types";
import ErrorBoundary from "./ErrorBoundary";
import { useWhisperLikes } from "../hooks/useWhisperLikes";
import { useComments } from "../hooks/useComments";
import InteractionButtons from "./InteractionButtons";
import LikesModal from "./LikesModal";
import CommentsModal from "./CommentsModal";

interface WhisperInteractionsProps {
  whisper: Whisper;
  onLikeChange?: (isLiked: boolean, newLikeCount: number) => void;
  onCommentChange?: (newCommentCount: number) => void;
  onWhisperUpdate?: (updatedWhisper: { id: string; replies: number }) => void;
}

const WhisperInteractions: React.FC<WhisperInteractionsProps> = ({
  whisper,
  onLikeChange,
  onCommentChange,
  onWhisperUpdate,
}) => {
  const { user } = useAuth();

  // Use custom hooks for state management
  const {
    isLiked,
    likeCount,
    showLikes,
    setShowLikes,
    likes,
    loadingLikes,
    likesHasMore,
    handleLike,
    handleShowLikes,
    handleValidateLikeCount,
    loadLikes,
  } = useWhisperLikes({ whisper, onLikeChange, onWhisperUpdate });

  const {
    comments,
    commentCount,
    showComments,
    setShowComments,
    loadingComments,
    commentsHasMore,
    newComment,
    setNewComment,
    submittingComment,
    isInitialized: commentsInitialized,
    handleShowComments,
    handleSubmitComment,
    handleDeleteComment,
    loadMoreComments,
  } = useComments({
    whisperId: whisper.id,
    initialCommentCount: whisper.replies || 0,
    onCommentChange,
    onWhisperUpdate,
  });

  // Handle comment like (no-op for now, handled by CommentItem)
  const handleLikeComment = () => {
    // This is handled by the CommentItem component
  };

  React.useEffect(() => {
    console.log("[WhisperInteractions] render:", {
      whisperId: whisper.id,
      whisperReplies: whisper.replies,
      commentCount,
      commentsInitialized,
    });
  }, [whisper.id, whisper.replies, commentCount, commentsInitialized]);

  return (
    <View style={styles.container}>
      {/* Main interaction buttons */}
      <InteractionButtons
        isLiked={isLiked}
        likeCount={likeCount}
        commentCount={commentsInitialized ? commentCount : undefined}
        whisperId={whisper.id}
        whisperUserDisplayName={whisper.userDisplayName}
        onLike={handleLike}
        onShowComments={handleShowComments}
        onShowLikes={handleShowLikes}
        onValidateLikeCount={handleValidateLikeCount}
        onReportSubmitted={() => {
          console.log("Report submitted for whisper:", whisper.id);
        }}
      />

      {/* Likes Modal */}
      <LikesModal
        visible={showLikes}
        onClose={() => setShowLikes(false)}
        likes={likes}
        loadingLikes={loadingLikes}
        likesHasMore={likesHasMore}
        onLoadMore={() => loadLikes()}
      />

      {/* Comments Modal */}
      <CommentsModal
        visible={showComments}
        onClose={() => setShowComments(false)}
        comments={comments}
        loadingComments={loadingComments}
        commentsHasMore={commentsHasMore}
        newComment={newComment}
        setNewComment={setNewComment}
        submittingComment={submittingComment}
        currentUserId={user?.uid || ""}
        onLoadMore={loadMoreComments}
        onSubmitComment={handleSubmitComment}
        onLikeComment={handleLikeComment}
        onDeleteComment={handleDeleteComment}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
  },
});

// Error boundary wrapper
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
