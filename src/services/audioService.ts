import TrackPlayer, { State } from "react-native-track-player";

// Global state to track if player is initialized
let isPlayerInitialized = false;

export interface AudioTrack {
  id: string;
  title: string;
  artist: string;
  artwork?: string;
  url: string;
}

class AudioService {
  private tracks: AudioTrack[] = [];
  private currentTrackIndex: number = 0;
  private lastScrollPosition: number = 0;

  async initialize(tracks: AudioTrack[] = []) {
    if (isPlayerInitialized) {
      return;
    }

    try {
      await TrackPlayer.setupPlayer();
      this.tracks = tracks;

      if (tracks.length > 0) {
        await TrackPlayer.reset();
        await TrackPlayer.add(tracks);
      }

      isPlayerInitialized = true;
      console.log("AudioService initialized successfully");
    } catch (error) {
      console.error("Failed to initialize AudioService:", error);
      throw error;
    }
  }

  async setTracks(tracks: AudioTrack[]) {
    // Only reset if tracks are actually different
    const tracksChanged =
      this.tracks.length !== tracks.length ||
      tracks.some((track, index) => track.id !== this.tracks[index]?.id);

    if (tracksChanged) {
      this.tracks = tracks;
      if (isPlayerInitialized && tracks.length > 0) {
        await TrackPlayer.reset();
        await TrackPlayer.add(tracks);
        // Reset current index when tracks change
        this.currentTrackIndex = 0;
      }
    } else {
      console.log("Tracks unchanged, preserving current state");
    }
  }

  async playTrack(trackId: string) {
    if (!isPlayerInitialized) {
      throw new Error("AudioService not initialized");
    }

    const trackIndex = this.tracks.findIndex((track) => track.id === trackId);
    if (trackIndex === -1) {
      throw new Error(`Track with id ${trackId} not found`);
    }

    this.currentTrackIndex = trackIndex;
    await TrackPlayer.skip(trackIndex);
    await TrackPlayer.play();
  }

  async playTrackByIndex(index: number) {
    if (!isPlayerInitialized || index < 0 || index >= this.tracks.length) {
      return;
    }

    this.currentTrackIndex = index;
    await TrackPlayer.skip(index);
    await TrackPlayer.play();
  }

  async play() {
    if (isPlayerInitialized) {
      await TrackPlayer.play();
    }
  }

  async pause() {
    if (isPlayerInitialized) {
      await TrackPlayer.pause();
    }
  }

  async stop() {
    if (isPlayerInitialized) {
      await TrackPlayer.stop();
    }
  }

  async skipToNext() {
    if (!isPlayerInitialized || this.tracks.length === 0) {
      return;
    }

    const nextIndex = (this.currentTrackIndex + 1) % this.tracks.length;
    await this.playTrackByIndex(nextIndex);
  }

  async skipToPrevious() {
    if (!isPlayerInitialized || this.tracks.length === 0) {
      return;
    }

    const prevIndex =
      this.currentTrackIndex === 0
        ? this.tracks.length - 1
        : this.currentTrackIndex - 1;
    await this.playTrackByIndex(prevIndex);
  }

  async getCurrentTrack() {
    if (!isPlayerInitialized || this.tracks.length === 0) {
      return null;
    }
    return this.tracks[this.currentTrackIndex];
  }

  async getCurrentTrackIndex() {
    return this.currentTrackIndex;
  }

  setCurrentTrackIndex(index: number) {
    this.currentTrackIndex = index;
  }

  getLastScrollPosition() {
    return this.lastScrollPosition;
  }

  setLastScrollPosition(position: number) {
    this.lastScrollPosition = position;
  }

  async getPlaybackState(): Promise<State> {
    if (!isPlayerInitialized) {
      return State.None;
    }
    return await TrackPlayer.getState();
  }

  async destroy() {
    if (isPlayerInitialized) {
      await TrackPlayer.reset();
      isPlayerInitialized = false;
    }
  }

  isInitialized() {
    return isPlayerInitialized;
  }
}

// Export singleton instance
export const audioService = new AudioService();
