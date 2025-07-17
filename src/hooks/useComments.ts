import { useState, useRef, useCallback, useEffect } from "react";
import { Alert } from "react-native";
import { getInteractionService } from "../services/interactionService";
import { getFirestoreService } from "../services/firestoreService";
import { Comment } from "../types";
import { useAuth } from "../providers/AuthProvider";

interface UseCommentsProps {
  whisperId: string;
  initialCommentCount: number;
  onCommentChange?: (newCommentCount: number) => void;
  onWhisperUpdate?: (updatedWhisper: { id: string; replies: number }) => void;
}

export const useComments = ({
  whisperId,
  initialCommentCount,
  onCommentChange,
  onWhisperUpdate,
}: UseCommentsProps) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentCount, setCommentCount] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentsHasMore, setCommentsHasMore] = useState(true);
  const [commentsLastDoc, setCommentsLastDoc] = useState<unknown>(null);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const interactionServiceRef = useRef(getInteractionService());
  const firestoreServiceRef = useRef(getFirestoreService());

  useEffect(() => {
    const loadCommentCount = async () => {
      try {
        console.log(`🔄 Initializing comment count for whisper ${whisperId}`);
        // Get the whisper document to get the real reply count
        const whisper = await firestoreServiceRef.current.getWhisper(whisperId);
        const actualCommentCount = whisper?.replies || 0;
        console.log(`✅ Initial comment count: ${actualCommentCount}`);
        setCommentCount(actualCommentCount);
        onCommentChange?.(actualCommentCount);

        // Always call onWhisperUpdate with the real count from server
        const updatedWhisper = { id: whisperId, replies: actualCommentCount };
        console.log("[useComments] onWhisperUpdate called:", updatedWhisper);
        onWhisperUpdate?.(updatedWhisper);

        setIsInitialized(true);
      } catch (error) {
        console.error("Error loading comment count:", error);
        setCommentCount(initialCommentCount || 0);
        onCommentChange?.(initialCommentCount || 0);
        setIsInitialized(true);
      }
    };

    if (!isInitialized) {
      loadCommentCount();
    }
  }, [
    whisperId,
    initialCommentCount,
    onCommentChange,
    onWhisperUpdate,
    isInitialized,
  ]);

  useEffect(() => {
    if (!isInitialized) return;

    const refreshCommentCount = async () => {
      try {
        // Get the whisper document to get the real reply count
        const whisper = await firestoreServiceRef.current.getWhisper(whisperId);
        const actualCommentCount = whisper?.replies || 0;
        if (actualCommentCount !== commentCount) {
          console.log(
            `🔄 Refreshing comment count: ${commentCount} -> ${actualCommentCount}`
          );
          setCommentCount(actualCommentCount);
          onCommentChange?.(actualCommentCount);

          // Only call onWhisperUpdate if the count actually changed from what we have
          // Don't compare with initialCommentCount here as it might be stale
          const updatedWhisper = {
            id: whisperId,
            replies: actualCommentCount,
          };
          console.log("[useComments] onWhisperUpdate called:", updatedWhisper);
          onWhisperUpdate?.(updatedWhisper);
        }
      } catch (error) {
        console.error("Error refreshing comment count:", error);
      }
    };

    const interval = setInterval(refreshCommentCount, 10000);

    return () => clearInterval(interval);
  }, [
    whisperId,
    commentCount,
    onCommentChange,
    onWhisperUpdate,
    isInitialized,
  ]);

  useEffect(() => {
    if (!showComments) return;

    const unsubscribe = firestoreServiceRef.current.subscribeToComments(
      whisperId,
      (updatedComments) => {
        setComments(updatedComments);
        const actualCommentCount = updatedComments.length;
        if (actualCommentCount !== commentCount) {
          console.log(
            `🔄 Real-time comment count update: ${commentCount} -> ${actualCommentCount}`
          );
          setCommentCount(actualCommentCount);
          onCommentChange?.(actualCommentCount);

          // Always call onWhisperUpdate when count changes in real-time
          const updatedWhisper = {
            id: whisperId,
            replies: actualCommentCount,
          };
          console.log("[useComments] onWhisperUpdate called:", updatedWhisper);
          onWhisperUpdate?.(updatedWhisper);
        }
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [whisperId, showComments, commentCount, onCommentChange, onWhisperUpdate]);

  const loadInitialComments = useCallback(async () => {
    if (loadingComments) return;
    setLoadingComments(true);
    try {
      const result = await interactionServiceRef.current.getComments(
        whisperId,
        20,
        null,
        user?.uid
      );
      setComments(result.comments);
      setCommentsHasMore(result.hasMore);
      setCommentsLastDoc(result.lastDoc);
      setCommentCount(result.comments.length);
      onCommentChange?.(result.comments.length);
    } catch (error) {
      console.error("Error loading comments:", error);
      Alert.alert("Error", "Failed to load comments");
    } finally {
      setLoadingComments(false);
    }
  }, [whisperId, loadingComments, onCommentChange, user?.uid]);

  const handleShowComments = useCallback(() => {
    setShowComments(true);
    setComments([]);
    setCommentsHasMore(true);
    setCommentsLastDoc(null);
    loadInitialComments();
  }, [loadInitialComments]);

  const handleSubmitComment = useCallback(async () => {
    if (!newComment.trim() || !user) {
      Alert.alert("Error", "Please enter a comment");
      return;
    }

    setSubmittingComment(true);

    const optimisticComment = {
      id: `optimistic-${Date.now()}`,
      whisperId: whisperId,
      userId: user.uid,
      userDisplayName: user.displayName || "Anonymous",
      userProfileColor: user.profileColor || "#9E9E9E",
      text: newComment.trim(),
      likes: 0,
      createdAt: new Date(),
      isEdited: false,
    };

    setComments((prev) => [optimisticComment, ...prev]);

    const newCommentCount = commentCount + 1;
    setCommentCount(newCommentCount);
    onCommentChange?.(newCommentCount);

    const text = newComment.trim();
    setNewComment("");

    try {
      await interactionServiceRef.current.addComment(whisperId, text);
    } catch (error) {
      console.error("Error adding comment:", error);
      Alert.alert("Error", "Failed to add comment");

      setComments((prev) => prev.filter((c) => c.id !== optimisticComment.id));
      setCommentCount((prev) => prev - 1);
      onCommentChange?.(commentCount - 1);
    } finally {
      setSubmittingComment(false);
    }
  }, [whisperId, newComment, commentCount, onCommentChange, user]);

  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      const commentToDelete = comments.find((c) => c.id === commentId);
      if (!commentToDelete) return;

      setComments((prev) => prev.filter((c) => c.id !== commentId));

      const newCommentCount = Math.max(0, commentCount - 1);
      setCommentCount(newCommentCount);
      onCommentChange?.(newCommentCount);

      try {
        await interactionServiceRef.current.deleteComment(commentId, whisperId);
      } catch (error) {
        console.error("Error deleting comment:", error);
        Alert.alert("Error", "Failed to delete comment");

        setComments((prev) => [...prev, commentToDelete]);
        setCommentCount((prev) => prev + 1);
        onCommentChange?.(commentCount + 1);
      }
    },
    [whisperId, comments, commentCount, onCommentChange]
  );

  const loadMoreComments = useCallback(async () => {
    if (loadingComments || !commentsHasMore) return;
    setLoadingComments(true);

    try {
      const result = await interactionServiceRef.current.getComments(
        whisperId,
        20,
        commentsLastDoc,
        user?.uid
      );

      setComments((prev) => [...prev, ...result.comments]);
      setCommentsHasMore(result.hasMore);
      setCommentsLastDoc(result.lastDoc);
    } catch (error) {
      console.error("Error loading more comments:", error);
      Alert.alert("Error", "Failed to load more comments");
    } finally {
      setLoadingComments(false);
    }
  }, [whisperId, loadingComments, commentsHasMore, commentsLastDoc, user?.uid]);

  return {
    comments,
    commentCount,
    showComments,
    setShowComments,
    loadingComments,
    commentsHasMore,
    newComment,
    setNewComment,
    submittingComment,
    isInitialized,
    handleShowComments,
    handleSubmitComment,
    handleDeleteComment,
    loadMoreComments,
  };
};
