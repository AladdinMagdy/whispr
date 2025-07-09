import { useState, useEffect, useRef, useCallback } from "react";
import { Alert } from "react-native";
import { getInteractionService } from "../services/interactionService";
import { getFirestoreService } from "../services/firestoreService";
import { Whisper, Like } from "../types";

interface UseWhisperLikesProps {
  whisper: Whisper;
  onLikeChange?: (isLiked: boolean, newLikeCount: number) => void;
  onWhisperUpdate?: (updatedWhisper: Whisper) => void;
}

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
  const [isLikeInProgress, setIsLikeInProgress] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

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

  const handleLike = useCallback(async () => {
    if (isLikeInProgress) {
      console.log("Like operation already in progress, ignoring click");
      return;
    }
    setIsLikeInProgress(true);
    const newIsLiked = !isLiked;
    const newLikeCount = newIsLiked
      ? likeCount + 1
      : Math.max(0, likeCount - 1);
    setIsLiked(newIsLiked);
    setLikeCount(newLikeCount);
    onLikeChange?.(newIsLiked, newLikeCount);
    try {
      await interactionServiceRef.current.toggleLike(whisperId);
      // The real-time listener will sync the actual state from the server
    } catch (error) {
      console.error("Error liking whisper:", error);
      Alert.alert("Error", "Failed to like whisper");
      setIsLiked(!newIsLiked);
      setLikeCount(newIsLiked ? Math.max(0, likeCount - 1) : likeCount + 1);
      onLikeChange?.(
        !newIsLiked,
        newIsLiked ? Math.max(0, likeCount - 1) : likeCount + 1
      );
    } finally {
      setIsLikeInProgress(false);
    }
  }, [isLiked, likeCount, onLikeChange, isLikeInProgress, whisperId]);

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
    isLikeInProgress,
    isInitialized,

    // Actions
    handleLike,
    handleShowLikes,
    handleValidateLikeCount,
    loadLikes,
  };
};
