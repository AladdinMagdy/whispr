import { useState, useEffect, useRef, useCallback } from "react";
import { getInteractionService } from "../services/interactionService";
import {
  getFirestoreService,
  CommentLikeData,
} from "../services/firestoreService";
import { Comment } from "../types";

interface UseCommentLikesProps {
  comment: Comment;
  onLikeComment: (commentId: string) => void;
}

export const useCommentLikes = ({
  comment,
  onLikeComment,
}: UseCommentLikesProps) => {
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(comment.likes);
  const [showCommentLikes, setShowCommentLikes] = useState(false);
  const [commentLikes, setCommentLikes] = useState<CommentLikeData[]>([]);
  const [loadingCommentLikes, setLoadingCommentLikes] = useState(false);
  const [commentLikesHasMore, setCommentLikesHasMore] = useState(true);
  const [commentLikesLastDoc, setCommentLikesLastDoc] = useState<unknown>(null);
  const [isLikeInProgress, setIsLikeInProgress] = useState(false);

  const interactionServiceRef = useRef(getInteractionService());
  const firestoreServiceRef = useRef(getFirestoreService());

  // Load comment like state on mount
  useEffect(() => {
    const loadCommentLikeState = async () => {
      try {
        const isLiked = await interactionServiceRef.current.hasUserLikedComment(
          comment.id
        );
        setIsLiked(isLiked);
        setLikeCount(comment.likes);
      } catch (error) {
        console.error("Error loading comment like state:", error);
        setIsLiked(false);
        setLikeCount(comment.likes);
      }
    };

    loadCommentLikeState();
  }, [comment.id, comment.likes]);

  // Real-time comment likes modal
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    if (showCommentLikes) {
      setLoadingCommentLikes(true);
      unsubscribe = firestoreServiceRef.current.subscribeToCommentLikes(
        comment.id,
        (likes: CommentLikeData[]) => {
          setCommentLikes(likes);
          setLoadingCommentLikes(false);
        }
      );
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [showCommentLikes, comment.id]);

  const handleLike = useCallback(async () => {
    // Prevent rapid clicks
    if (isLikeInProgress) {
      console.log("Comment like operation already in progress, ignoring click");
      return;
    }

    setIsLikeInProgress(true);

    // Optimistic update - update UI immediately
    const newIsLiked = !isLiked;
    const newLikeCount = newIsLiked
      ? likeCount + 1
      : Math.max(0, likeCount - 1);

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
      setLikeCount(newIsLiked ? Math.max(0, likeCount - 1) : likeCount + 1);
    } finally {
      setIsLikeInProgress(false);
    }
  }, [comment.id, isLiked, likeCount, onLikeComment, isLikeInProgress]);

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

  return {
    // State
    isLiked,
    likeCount,
    showCommentLikes,
    setShowCommentLikes,
    commentLikes,
    loadingCommentLikes,
    commentLikesHasMore,
    isLikeInProgress,

    // Actions
    handleLike,
    handleShowCommentLikes,
    loadCommentLikes,
  };
};
