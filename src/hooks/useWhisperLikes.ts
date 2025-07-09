import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Alert } from "react-native";
import { getInteractionService } from "../services/interactionService";
import { getFirestoreService } from "../services/firestoreService";
import { Whisper, Like } from "../types";

interface UseWhisperLikesProps {
  whisper: Whisper;
  onLikeChange?: (isLiked: boolean, newLikeCount: number) => void;
  onWhisperUpdate?: (updatedWhisper: Whisper) => void;
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

export const useWhisperLikes = ({
  whisper,
  onLikeChange,
  onWhisperUpdate,
}: UseWhisperLikesProps) => {
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0); // Start with 0, will be updated by initial load
  const [showLikes, setShowLikes] = useState(false);
  const [likes, setLikes] = useState<Like[]>([]);
  const [loadingLikes, setLoadingLikes] = useState(false);
  const [likesHasMore, setLikesHasMore] = useState(true);
  const [likesLastDoc, setLikesLastDoc] = useState<unknown>(null);
  const [likesLoaded, setLikesLoaded] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Track original user like state for smart server requests
  const [originalUserLikeState, setOriginalUserLikeState] = useState(false);
  const [pendingServerUpdate, setPendingServerUpdate] = useState(false);

  // Track the "settled" state - what the user wants after rapid toggling
  const [settledUserState, setSettledUserState] = useState(false);
  const [isUserSettled, setIsUserSettled] = useState(true);

  const interactionServiceRef = useRef(getInteractionService());
  const firestoreServiceRef = useRef(getFirestoreService());

  // Destructure whisper for stable dependencies
  const { id: whisperId, likes: whisperLikes } = whisper;

  // Load like state on mount (only once)
  useEffect(() => {
    const loadLikeState = async () => {
      try {
        console.log(`🔄 Initializing like state for whisper ${whisperId}`);
        const [isLikedResult, countResult] = await Promise.all([
          interactionServiceRef.current.hasUserLiked(whisperId),
          interactionServiceRef.current.getLikeCount(whisperId),
        ]);
        console.log(
          `✅ Initial like state: isLiked=${isLikedResult}, count=${countResult}`
        );
        setIsLiked(isLikedResult);
        setLikeCount(countResult);
        setOriginalUserLikeState(isLikedResult); // Track original state
        setSettledUserState(isLikedResult); // Initialize settled state
        onLikeChange?.(isLikedResult, countResult);
        // Update whisper data if count differs from stored data
        if (countResult !== whisperLikes && onWhisperUpdate) {
          const updatedWhisper = { ...whisper, likes: countResult };
          onWhisperUpdate(updatedWhisper);
        }
        setIsInitialized(true);
      } catch (error) {
        console.error("Error loading like state:", error);
        setIsLiked(false);
        setLikeCount(whisperLikes || 0);
        setOriginalUserLikeState(false);
        setSettledUserState(false); // Initialize settled state
        onLikeChange?.(false, whisperLikes || 0);
        setIsInitialized(true);
      }
    };
    if (!isInitialized) {
      loadLikeState();
    }
  }, [
    whisperId,
    whisperLikes,
    onLikeChange,
    onWhisperUpdate,
    isInitialized,
    whisper,
  ]);

  // Refresh like count periodically (only after initialization)
  useEffect(() => {
    if (!isInitialized) return;
    const refreshLikeCount = async () => {
      try {
        const countResult = await interactionServiceRef.current.getLikeCount(
          whisperId
        );
        if (countResult !== likeCount) {
          console.log(
            `🔄 Refreshing like count: ${likeCount} -> ${countResult}`
          );
          setLikeCount(countResult);
          onLikeChange?.(isLiked, countResult);
          // Update whisper data if count differs
          if (countResult !== whisperLikes && onWhisperUpdate) {
            const updatedWhisper = { ...whisper, likes: countResult };
            onWhisperUpdate(updatedWhisper);
          }
        }
      } catch (error) {
        console.error("Error refreshing like count:", error);
      }
    };
    const interval = setInterval(refreshLikeCount, 10000);
    return () => clearInterval(interval);
  }, [
    whisperId,
    likeCount,
    isLiked,
    onLikeChange,
    whisperLikes,
    onWhisperUpdate,
    isInitialized,
    whisper,
  ]);

  // Real-time likes modal
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    if (showLikes) {
      setLoadingLikes(true);
      unsubscribe = firestoreServiceRef.current.subscribeToWhisperLikes(
        whisperId,
        (likes: Like[]) => {
          setLikes(likes);
          setLoadingLikes(false);
          // Update like count when real-time data is received
          const actualLikeCount = likes.length;
          if (actualLikeCount !== likeCount) {
            console.log(
              `🔄 Real-time like count update: ${likeCount} -> ${actualLikeCount}`
            );
            setLikeCount(actualLikeCount);
            onLikeChange?.(isLiked, actualLikeCount);
            // Update whisper data if count differs
            if (actualLikeCount !== whisperLikes && onWhisperUpdate) {
              const updatedWhisper = { ...whisper, likes: actualLikeCount };
              onWhisperUpdate(updatedWhisper);
            }
          }
        }
      );
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [
    showLikes,
    whisperId,
    likeCount,
    isLiked,
    onLikeChange,
    whisperLikes,
    onWhisperUpdate,
    whisper,
  ]);

  // Smart server update function - only sends when user has "settled"
  const sendSettledServerUpdate = useCallback(async () => {
    if (pendingServerUpdate || !isUserSettled) {
      console.log("⏭️ Skipping server update - pending or user not settled");
      return;
    }

    // Only send if settled state differs from original state
    if (settledUserState === originalUserLikeState) {
      console.log("⏭️ Settled state matches original, no server update needed");
      return;
    }

    setPendingServerUpdate(true);
    try {
      console.log(
        `🔄 Sending settled server update: ${originalUserLikeState} -> ${settledUserState}`
      );
      await interactionServiceRef.current.toggleLike(whisperId);

      // Update original state after successful server update
      setOriginalUserLikeState(settledUserState);
      console.log(
        `✅ Settled server update successful, original state updated to: ${settledUserState}`
      );
    } catch (error) {
      console.error("Error updating like on server:", error);

      // Check if it's the "already in progress" error
      if (
        error instanceof Error &&
        error.message.includes("already in progress")
      ) {
        console.log(
          "⏭️ Like operation already in progress, this is expected for rapid clicks"
        );
        // Reset pending flag so we can try again later
        setPendingServerUpdate(false);
        return;
      }

      // For other errors, show alert and revert optimistic update
      Alert.alert("Error", "Failed to update like");

      // Revert optimistic update on failure
      setIsLiked(originalUserLikeState);
      setLikeCount((prev) =>
        originalUserLikeState ? prev + 1 : Math.max(0, prev - 1)
      );
      onLikeChange?.(
        originalUserLikeState,
        originalUserLikeState ? likeCount + 1 : Math.max(0, likeCount - 1)
      );
    } finally {
      setPendingServerUpdate(false);
    }
  }, [
    whisperId,
    originalUserLikeState,
    settledUserState,
    isUserSettled,
    pendingServerUpdate,
    likeCount,
    onLikeChange,
  ]);

  // Use ref to prevent debounced function recreation
  const sendSettledServerUpdateRef = useRef(sendSettledServerUpdate);
  sendSettledServerUpdateRef.current = sendSettledServerUpdate;

  // Debounced function to mark user as "settled" after rapid clicking stops
  const debouncedSettleUser = useMemo(
    () =>
      debounce(() => {
        console.log("🎯 User has settled, checking if server update needed");
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

    console.log(`🎯 User like action: ${isLiked} -> ${newUserLikeState}`);
    console.log(
      `📊 Original state: ${originalUserLikeState}, New state: ${newUserLikeState}`
    );

    // Update UI immediately
    setIsLiked(newUserLikeState);
    setLikeCount(newLikeCount);
    onLikeChange?.(newUserLikeState, newLikeCount);

    // Update the "settled" state to what user wants
    setSettledUserState(newUserLikeState);
    setIsUserSettled(false); // Mark user as not settled (still clicking)

    // Start the settle timer
    debouncedSettleUser();

    console.log(
      `🎯 Updated settled state to: ${newUserLikeState}, waiting for user to settle...`
    );
  }, [
    isLiked,
    likeCount,
    originalUserLikeState,
    onLikeChange,
    debouncedSettleUser,
  ]);

  const loadLikes = useCallback(
    async (reset = false) => {
      if (loadingLikes) return;
      setLoadingLikes(true);
      try {
        const result = await interactionServiceRef.current.getLikes(
          whisperId,
          20,
          reset ? null : likesLastDoc
        );
        if (reset) {
          setLikes(result.likes);
        } else {
          setLikes([...likes, ...result.likes]);
        }
        setLikesHasMore(result.hasMore);
        setLikesLastDoc(result.lastDoc);
        setLikesLoaded(true);
      } catch (error) {
        console.error("Error loading likes:", error);
      } finally {
        setLoadingLikes(false);
      }
    },
    [loadingLikes, likes, likesLastDoc, whisperId]
  );

  const handleShowLikes = useCallback(() => {
    setShowLikes(true);
    if (!likesLoaded) {
      loadLikes(true);
    }
  }, [loadLikes, likesLoaded]);

  const handleValidateLikeCount = useCallback(async () => {
    try {
      console.log("🔍 Validating like count for whisper:", whisperId);
      const actualCount =
        await firestoreServiceRef.current.validateAndFixLikeCount(whisperId);
      setLikeCount(actualCount);
      onLikeChange?.(isLiked, actualCount);
      if (actualCount !== whisperLikes && onWhisperUpdate) {
        const updatedWhisper = { ...whisper, likes: actualCount };
        onWhisperUpdate(updatedWhisper);
      }
      Alert.alert(
        "Like Count Validation",
        `Whisper like count: ${actualCount}\nThis count has been validated and fixed if needed.`
      );
    } catch (error) {
      console.error("Error validating like count:", error);
      Alert.alert("Error", "Failed to validate like count");
    }
  }, [
    isLiked,
    onLikeChange,
    onWhisperUpdate,
    whisperId,
    whisperLikes,
    whisper,
  ]);

  return {
    // State
    isLiked,
    likeCount,
    showLikes,
    setShowLikes,
    likes,
    loadingLikes,
    likesHasMore,
    likesLoaded,
    isInitialized,
    pendingServerUpdate,

    // Actions
    handleLike,
    handleShowLikes,
    handleValidateLikeCount,
    loadLikes,
  };
};
