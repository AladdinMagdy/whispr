import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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

// Debounce utility function
const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

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

  // Track original user like state for smart server requests
  const [originalUserLikeState, setOriginalUserLikeState] = useState(false);
  const [pendingServerUpdate, setPendingServerUpdate] = useState(false);

  // Track the "settled" state - what the user wants after rapid toggling
  const [settledUserState, setSettledUserState] = useState(false);
  const [isUserSettled, setIsUserSettled] = useState(true);

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
        setOriginalUserLikeState(isLiked); // Track original state
        setSettledUserState(isLiked); // Initialize settled state
        setLikeCount(comment.likes);
      } catch (error) {
        console.error("Error loading comment like state:", error);
        setIsLiked(false);
        setOriginalUserLikeState(false);
        setSettledUserState(false); // Initialize settled state
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

  // Smart server update function - only sends when user has "settled"
  const sendSettledServerUpdate = useCallback(async () => {
    if (pendingServerUpdate || !isUserSettled) {
      console.log(
        "⏭️ Skipping comment server update - pending or user not settled"
      );
      return;
    }

    // Only send if settled state differs from original state
    if (settledUserState === originalUserLikeState) {
      console.log(
        "⏭️ Comment settled state matches original, no server update needed"
      );
      return;
    }

    setPendingServerUpdate(true);
    try {
      console.log(
        `🔄 Sending settled comment server update: ${originalUserLikeState} -> ${settledUserState}`
      );
      await interactionServiceRef.current.toggleCommentLike(comment.id);

      // Update original state after successful server update
      setOriginalUserLikeState(settledUserState);
      console.log(
        `✅ Settled comment server update successful, original state updated to: ${settledUserState}`
      );
    } catch (error) {
      console.error("Error updating comment like on server:", error);

      // Check if it's the "already in progress" error
      if (
        error instanceof Error &&
        error.message.includes("already in progress")
      ) {
        console.log(
          "⏭️ Comment like operation already in progress, this is expected for rapid clicks"
        );
        // Reset pending flag so we can try again later
        setPendingServerUpdate(false);
        return;
      }

      // For other errors, revert optimistic update
      console.log("❌ Comment server error, reverting optimistic update");
      setIsLiked(originalUserLikeState);
      setLikeCount((prev) =>
        originalUserLikeState ? prev + 1 : Math.max(0, prev - 1)
      );
    } finally {
      setPendingServerUpdate(false);
    }
  }, [
    comment.id,
    originalUserLikeState,
    settledUserState,
    isUserSettled,
    pendingServerUpdate,
  ]);

  // Use ref to prevent debounced function recreation
  const sendSettledServerUpdateRef = useRef(sendSettledServerUpdate);
  sendSettledServerUpdateRef.current = sendSettledServerUpdate;

  // Debounced function to mark user as "settled" after rapid clicking stops
  const debouncedSettleUser = useMemo(
    () =>
      debounce(() => {
        console.log(
          "🎯 User has settled on comment, checking if server update needed"
        );
        setIsUserSettled(true);
        // Use a small delay to ensure state is updated
        setTimeout(() => {
          sendSettledServerUpdateRef.current();
        }, 50);
      }, 1000), // Wait 1 second after last click before considering user "settled"
    [] // Empty dependency array - function never recreates
  );

  const handleLike = useCallback(() => {
    // Optimistic update - immediate UI response
    const newUserLikeState = !isLiked;
    const newLikeCount = newUserLikeState
      ? likeCount + 1
      : Math.max(0, likeCount - 1);

    console.log(
      `🎯 User comment like action: ${isLiked} -> ${newUserLikeState}`
    );
    console.log(
      `📊 Original comment state: ${originalUserLikeState}, New state: ${newUserLikeState}`
    );

    // Update UI immediately
    setIsLiked(newUserLikeState);
    setLikeCount(newLikeCount);
    onLikeComment(comment.id);

    // Update the "settled" state to what user wants
    setSettledUserState(newUserLikeState);
    setIsUserSettled(false); // Mark user as not settled (still clicking)

    // Start the settle timer
    debouncedSettleUser();

    console.log(
      `🎯 Updated comment settled state to: ${newUserLikeState}, waiting for user to settle...`
    );
  }, [
    comment.id,
    isLiked,
    likeCount,
    originalUserLikeState,
    onLikeComment,
    debouncedSettleUser,
  ]);

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
    pendingServerUpdate,

    // Actions
    handleLike,
    handleShowCommentLikes,
    loadCommentLikes,
  };
};
