import React, { useState, useRef, useEffect, useCallback } from "react";
import { View, StyleSheet, Dimensions, Button } from "react-native";
import { Audio, AVPlaybackStatus } from "expo-av";
import BackgroundMedia from "./BackgroundMedia";
import AudioControls from "./AudioControls";
import WhisperInteractions from "./WhisperInteractions";
import { Whisper } from "../types";
import { getAudioCacheService } from "../services/audioCacheService";
import { usePerformanceMonitor } from "../hooks/usePerformanceMonitor";

const { height, width } = Dimensions.get("window");

// --- BEGIN: Global Audio Pause Logic ---
const activeSounds = new Set<Audio.Sound>();

export const pauseAllAudioSlides = async () => {
  console.log("🔄 Pausing all audio slides...");
  const pausePromises = Array.from(activeSounds).map(async (sound) => {
    try {
      await sound.pauseAsync();
    } catch (error) {
      console.warn("Error pausing sound:", error);
    }
  });
  await Promise.all(pausePromises);
  console.log("✅ All audio slides paused");
};
// --- END: Global Audio Pause Logic ---

interface AudioSlideProps {
  whisper: Whisper;
  isVisible: boolean;
  isActive: boolean;
}

const AudioSlide: React.FC<AudioSlideProps> = ({
  whisper,
  isVisible,
  isActive,
}) => {
  // Add performance monitoring
  usePerformanceMonitor("AudioSlide");

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const audioRef = useRef<Audio.Sound | null>(null);
  const initializationRef = useRef(false);
  const whisperIdRef = useRef(whisper.id);
  const audioUrlRef = useRef(whisper.audioUrl);
  const isActiveRef = useRef(isActive);
  const isVisibleRef = useRef(isVisible);
  const hasInitializedRef = useRef(false);

  // Update refs when props change
  useEffect(() => {
    whisperIdRef.current = whisper.id;
    audioUrlRef.current = whisper.audioUrl;
  }, [whisper.id, whisper.audioUrl]);

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  useEffect(() => {
    isVisibleRef.current = isVisible;
  }, [isVisible]);

  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      // Audio is not loaded
      if (status.error) {
        console.error(`Audio error: ${status.error}`);
      }
      return;
    }

    // Update UI based on playback status
    setIsPlaying(status.isPlaying);

    if (status.positionMillis !== undefined) {
      setProgress(status.positionMillis / 1000); // Convert to seconds
    }

    if (status.durationMillis !== undefined) {
      setDuration(status.durationMillis / 1000); // Convert to seconds
    }

    // Log when audio finishes and loops (for debugging)
    if (status.didJustFinish && status.isLooping) {
      console.log(
        `🎵 Audio finished and looping for whisper: ${whisperIdRef.current}`
      );
    }
  }, []);

  const playAudio = useCallback(async () => {
    try {
      if (
        audioRef.current &&
        isLoaded &&
        !isInitializing &&
        !initializationRef.current
      ) {
        console.log(`Playing audio for whisper: ${whisperIdRef.current}`);
        await audioRef.current.playAsync();
      }
    } catch (error) {
      console.error("Error playing audio:", error);
    }
  }, [isLoaded, isInitializing]);

  const pauseAudio = useCallback(async () => {
    try {
      if (
        audioRef.current &&
        isLoaded &&
        !isInitializing &&
        !initializationRef.current
      ) {
        console.log(`Pausing audio for whisper: ${whisperIdRef.current}`);
        await audioRef.current.pauseAsync();
      }
    } catch (error) {
      console.error("Error pausing audio:", error);
    }
  }, [isLoaded, isInitializing]);

  const cleanupAudio = useCallback(async () => {
    try {
      if (audioRef.current && !isInitializing && !initializationRef.current) {
        console.log(`Cleaning up audio for whisper: ${whisperIdRef.current}`);
        activeSounds.delete(audioRef.current); // Unregister sound
        await audioRef.current.unloadAsync();
        audioRef.current = null;
        setIsLoaded(false);
        hasInitializedRef.current = false;
      }
    } catch (error) {
      console.error("Error cleaning up audio:", error);
    }
  }, [isInitializing]);

  // Initialize audio only once when component mounts
  useEffect(() => {
    // Only initialize if not already initialized and not currently initializing
    if (hasInitializedRef.current || initializationRef.current) {
      return;
    }

    const initializeAudio = async () => {
      try {
        setIsInitializing(true);
        initializationRef.current = true;
        hasInitializedRef.current = true;
        console.log(`Initializing audio for whisper: ${whisperIdRef.current}`);

        // Set audio mode for better iOS compatibility
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });

        // Get cached audio URL (downloads and caches if not already cached)
        const audioCacheService = getAudioCacheService();
        const cachedAudioUrl = await audioCacheService.getCachedAudioUrl(
          audioUrlRef.current
        );

        // Create and load the audio with looping enabled
        const { sound } = await Audio.Sound.createAsync(
          { uri: cachedAudioUrl },
          { shouldPlay: false, isLooping: true }, // Enable looping
          onPlaybackStatusUpdate
        );

        audioRef.current = sound;
        activeSounds.add(sound); // Register sound
        setIsLoaded(true);
        setIsInitializing(false);
        initializationRef.current = false;
        console.log(
          `Audio loaded for whisper: ${whisperIdRef.current} with looping enabled`
        );

        // If this slide is already active when audio loads, start playing immediately
        if (isActiveRef.current && isVisibleRef.current) {
          console.log(
            `Slide was active when audio loaded, starting playback immediately`
          );
          // Use a longer delay to ensure audio is fully loaded
          setTimeout(async () => {
            try {
              if (audioRef.current && !initializationRef.current) {
                console.log(
                  `Auto-playing audio for whisper: ${whisperIdRef.current}`
                );
                await audioRef.current.playAsync();
              }
            } catch (error) {
              console.error("Error auto-playing audio:", error);
            }
          }, 300); // Increased delay to ensure everything is ready
        }
      } catch (error) {
        console.error("Error initializing audio:", error);
        setIsInitializing(false);
        initializationRef.current = false;
        hasInitializedRef.current = false;
      }
    };

    initializeAudio();

    return () => {
      cleanupAudio();
    };
  }, [cleanupAudio, onPlaybackStatusUpdate]); // Include required dependencies

  // Handle visibility and active state changes
  useEffect(() => {
    if (
      isActive &&
      isVisible &&
      isLoaded &&
      !isInitializing &&
      !initializationRef.current
    ) {
      console.log(`Auto-playing audio for slide: ${whisperIdRef.current}`);
      playAudio();
    } else if (isLoaded && !isInitializing && !initializationRef.current) {
      console.log(`Pausing audio for slide: ${whisperIdRef.current}`);
      pauseAudio();
    }
  }, [isActive, isVisible, isLoaded, isInitializing, playAudio, pauseAudio]);

  const replayAudio = async () => {
    try {
      if (
        audioRef.current &&
        isLoaded &&
        !isInitializing &&
        !initializationRef.current
      ) {
        console.log(`🔄 Replaying audio for whisper: ${whisperIdRef.current}`);
        await audioRef.current.replayAsync();
      } else {
        console.log(
          `[AudioSlide] Replay failed: audio not loaded for ${whisperIdRef.current}`
        );
      }
    } catch (error) {
      console.error("Error replaying audio:", error);
    }
  };

  const handlePlayPause = async () => {
    if (isPlaying) {
      await pauseAudio();
    } else {
      if (progress > 0) {
        // If we're in the middle, continue from where we left off
        await playAudio();
      } else {
        // If we're at the beginning, start from the beginning
        await replayAudio();
      }
    }
  };

  const handleReplay = async () => {
    await replayAudio();
  };

  return (
    <View style={styles.slide}>
      {/* Background media (image/video) */}
      <BackgroundMedia whisper={whisper} />

      {/* Audio controls */}
      <AudioControls
        isPlaying={isPlaying}
        progress={progress}
        duration={duration}
        onPlayPause={handlePlayPause}
        onReplay={handleReplay}
        whisper={whisper}
      />

      {/* Whisper interactions */}
      <WhisperInteractions whisper={whisper} />

      {/* Debug: Manual replay button */}
      <Button title="Manual Replay (Debug)" onPress={replayAudio} />
    </View>
  );
};

const styles = StyleSheet.create({
  slide: {
    height,
    width,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
});

export default AudioSlide;
