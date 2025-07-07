import React, { useState, useRef, useEffect } from "react";
import { View, StyleSheet, Dimensions, Button } from "react-native";
import { Audio } from "expo-av";
import BackgroundMedia from "./BackgroundMedia";
import AudioControls from "./AudioControls";
import WhisperInteractions from "./WhisperInteractions";
import { Whisper } from "../types";

const { height, width } = Dimensions.get("window");

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
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const audioRef = useRef<Audio.Sound | null>(null);

  // Initialize audio when component mounts
  useEffect(() => {
    initializeAudio();
    return () => {
      cleanupAudio();
    };
  }, []);

  // Handle visibility and active state changes
  useEffect(() => {
    if (isActive && isVisible) {
      if (isLoaded) {
        console.log(`Auto-playing audio for slide: ${whisper.id}`);
        playAudio();
      }
    } else if (isLoaded) {
      console.log(`Pausing audio for slide: ${whisper.id}`);
      pauseAudio();
    }
  }, [isActive, isVisible, isLoaded, whisper.id]);

  const initializeAudio = async () => {
    try {
      console.log(`Initializing audio for whisper: ${whisper.id}`);

      // Set audio mode for better iOS compatibility
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      // Create and load the audio with looping enabled
      const { sound } = await Audio.Sound.createAsync(
        { uri: whisper.audioUrl },
        { shouldPlay: false, isLooping: true }, // Enable looping
        onPlaybackStatusUpdate
      );

      audioRef.current = sound;
      setIsLoaded(true);
      console.log(
        `Audio loaded for whisper: ${whisper.id} with looping enabled`
      );

      // If this slide is already active when audio loads, start playing immediately
      if (isActive && isVisible) {
        console.log(
          `Slide was active when audio loaded, starting playback immediately`
        );
        setTimeout(() => {
          playAudio();
        }, 100); // Small delay to ensure everything is ready
      }
    } catch (error) {
      console.error("Error initializing audio:", error);
    }
  };

  const onPlaybackStatusUpdate = (status: any) => {
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
      console.log(`🎵 Audio finished and looping for whisper: ${whisper.id}`);
    }
  };

  const playAudio = async () => {
    try {
      if (audioRef.current && isLoaded) {
        console.log(`Playing audio for whisper: ${whisper.id}`);
        await audioRef.current.playAsync();
      }
    } catch (error) {
      console.error("Error playing audio:", error);
    }
  };

  const pauseAudio = async () => {
    try {
      if (audioRef.current && isLoaded) {
        console.log(`Pausing audio for whisper: ${whisper.id}`);
        await audioRef.current.pauseAsync();
      }
    } catch (error) {
      console.error("Error pausing audio:", error);
    }
  };

  const replayAudio = async () => {
    try {
      if (audioRef.current && isLoaded) {
        console.log(`🔄 Replaying audio for whisper: ${whisper.id}`);
        await audioRef.current.replayAsync();
      } else {
        console.log(
          `[AudioSlide] Replay failed: audio not loaded for ${whisper.id}`
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

  const cleanupAudio = async () => {
    try {
      if (audioRef.current) {
        console.log(`Cleaning up audio for whisper: ${whisper.id}`);
        await audioRef.current.unloadAsync();
        audioRef.current = null;
      }
    } catch (error) {
      console.error("Error cleaning up audio:", error);
    }
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
