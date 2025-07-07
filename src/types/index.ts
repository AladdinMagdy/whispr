// Core app types
export interface User {
  id: string;
  anonymousId: string;
  createdAt: Date;
  lastActive: Date;
}

export interface Whisper {
  id: string;
  userId: string;
  userDisplayName: string;
  userProfileColor: string;
  audioUrl: string;
  duration: number;
  whisperPercentage: number;
  averageLevel: number;
  confidence: number;
  likes: number;
  replies: number;
  createdAt: Date;
  transcription?: string;
  isTranscribed: boolean;
}

// New types for comments/interactions
export interface Comment {
  id: string;
  whisperId: string;
  userId: string;
  userDisplayName: string;
  userProfileColor: string;
  text: string;
  likes: number;
  createdAt: Date;
  isEdited: boolean;
  editedAt?: Date;
}

export interface Like {
  id: string;
  whisperId: string;
  userId: string;
  userDisplayName: string;
  userProfileColor: string;
  createdAt: Date;
}

export interface CommentLike {
  id: string;
  commentId: string;
  userId: string;
  createdAt: Date;
}

export interface WhisperInteractions {
  isLiked: boolean;
  likeCount: number;
  commentCount: number;
  comments: Comment[];
}

export interface AudioRecording {
  uri: string;
  duration: number;
  volume: number;
  isWhisper: boolean;
  timestamp: Date;
}

// Navigation types
export type RootStackParamList = {
  Home: undefined;
  Record: undefined;
  Feed: undefined;
  Profile: undefined;
  WhisperDetail: { whisperId: string };
};

// Firebase types
export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

// Audio processing types
export interface VolumeThreshold {
  WHISPER_MIN: number;
  WHISPER_MAX: number;
  NORMAL_MIN: number;
  NORMAL_MAX: number;
  SILENCE_THRESHOLD: number;
}

export interface AudioValidationResult {
  isValid: boolean;
  isWhisper: boolean;
  volume: number;
  duration: number;
  error?: string;
}

// API response types
export interface TranscriptionResponse {
  text: string;
  confidence: number;
  language: string;
}

export interface UploadResponse {
  success: boolean;
  url?: string;
  error?: string;
}

// Component prop types
export interface AudioRecorderProps {
  onRecordingComplete: (recording: AudioRecording) => void;
  onRecordingStart?: () => void;
  onRecordingStop?: () => void;
  maxDuration?: number;
  volumeThreshold?: VolumeThreshold;
}

export interface WhisperCardProps {
  whisper: Whisper;
  onPress?: () => void;
  onLike?: () => void;
  onReply?: () => void;
}

// Store types (for Zustand)
export interface AppState {
  user: User | null;
  whispers: Whisper[];
  isLoading: boolean;
  error: string | null;
  currentRecording: AudioRecording | null;
}

export interface AppActions {
  setUser: (user: User | null) => void;
  addWhisper: (whisper: Whisper) => void;
  setWhispers: (whispers: Whisper[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setCurrentRecording: (recording: AudioRecording | null) => void;
  likeWhisper: (whisperId: string) => void;
}
