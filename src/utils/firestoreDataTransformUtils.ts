/**
 * Firestore Data Transformation Utilities
 * Extracted from FirestoreService for better testability
 */

import { Whisper, Comment, Like, ModerationResult } from "../types";
import {
  QueryDocumentSnapshot,
  DocumentData,
  Timestamp,
} from "firebase/firestore";

export interface CommentLikeData {
  commentId: string;
  userId: string;
  userDisplayName: string;
  userProfileColor: string;
  createdAt: Timestamp | Date | null;
}

export interface FirestoreWhisperData {
  userId: string;
  userDisplayName: string;
  userProfileColor: string;
  audioUrl: string;
  duration: number;
  whisperPercentage: number;
  averageLevel: number;
  confidence: number;
  likes?: number;
  replies?: number;
  createdAt?: Timestamp | Date | null;
  transcription?: string;
  isTranscribed?: boolean;
  moderationResult?: ModerationResult;
}

export interface FirestoreCommentData {
  whisperId: string;
  userId: string;
  userDisplayName: string;
  userProfileColor: string;
  text: string;
  likes?: number;
  createdAt: Timestamp | Date | null;
  isEdited?: boolean;
  editedAt?: Timestamp | Date | null;
}

export interface FirestoreLikeData {
  whisperId?: string;
  commentId?: string;
  userId: string;
  userDisplayName?: string;
  userProfileColor?: string;
  createdAt: Timestamp | Date | null;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Transform Firestore document data to Whisper object
 */
export function transformWhisperData(
  docId: string,
  data: FirestoreWhisperData
): Whisper {
  return {
    id: docId,
    userId: data.userId,
    userDisplayName: data.userDisplayName,
    userProfileColor: data.userProfileColor,
    audioUrl: data.audioUrl,
    duration: data.duration,
    whisperPercentage: data.whisperPercentage,
    averageLevel: data.averageLevel,
    confidence: data.confidence,
    likes: data.likes || 0,
    replies: data.replies || 0,
    createdAt: transformTimestamp(data.createdAt),
    transcription: data.transcription || "",
    isTranscribed: data.isTranscribed || false,
    moderationResult: data.moderationResult || undefined,
  };
}

/**
 * Transform Firestore document data to Comment object
 */
export function transformCommentData(
  docId: string,
  data: FirestoreCommentData
): Comment {
  return {
    id: docId,
    whisperId: data.whisperId,
    userId: data.userId,
    userDisplayName: data.userDisplayName,
    userProfileColor: data.userProfileColor,
    text: data.text,
    likes: data.likes || 0,
    createdAt: transformTimestamp(data.createdAt),
    isEdited: data.isEdited || false,
    editedAt: data.editedAt ? transformTimestamp(data.editedAt) : undefined,
  };
}

/**
 * Transform Firestore document data to Like object
 */
export function transformLikeData(
  docId: string,
  data: FirestoreLikeData
): Like {
  return {
    id: docId,
    whisperId: data.whisperId || "",
    userId: data.userId,
    userDisplayName: data.userDisplayName || "Anonymous",
    userProfileColor: data.userProfileColor || "#007AFF",
    createdAt: transformTimestamp(data.createdAt),
  };
}

/**
 * Transform comment like data from Firestore to application format
 */
export function transformCommentLikeData(
  docId: string,
  data: FirestoreLikeData
): CommentLikeData {
  return {
    commentId: data.commentId || "",
    userId: data.userId,
    userDisplayName: data.userDisplayName || "Anonymous",
    userProfileColor: data.userProfileColor || "#007AFF",
    createdAt: data.createdAt,
  };
}

/**
 * Transform Firestore Timestamp to Date
 */
export function transformTimestamp(
  timestamp: Timestamp | Date | number | string | null | undefined
): Date {
  if (!timestamp) {
    return new Date();
  }

  // Handle Firestore Timestamp
  if (
    typeof timestamp === "object" &&
    timestamp !== null &&
    "toDate" in timestamp &&
    typeof timestamp.toDate === "function"
  ) {
    return timestamp.toDate();
  }

  // Handle regular Date
  if (timestamp instanceof Date) {
    return timestamp;
  }

  // Handle timestamp number
  if (typeof timestamp === "number") {
    return new Date(timestamp);
  }

  // Handle string date
  if (typeof timestamp === "string") {
    const parsed = new Date(timestamp);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  // Fallback to current date
  return new Date();
}

/**
 * Transform query snapshot to array of transformed objects
 */
export function transformQuerySnapshot<T>(
  querySnapshot: {
    forEach: (
      callback: (doc: { id: string; data: () => DocumentData }) => void
    ) => void;
  },
  transformFn: (docId: string, data: DocumentData) => T
): T[] {
  const results: T[] = [];

  querySnapshot.forEach((doc: { id: string; data: () => DocumentData }) => {
    const data = doc.data();
    const transformed = transformFn(doc.id, data);
    results.push(transformed);
  });

  return results;
}

/**
 * Calculate pagination metadata from query snapshot
 */
export function calculatePaginationMetadata(
  querySnapshot: { docs: QueryDocumentSnapshot<DocumentData>[] },
  limitCount: number
): {
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
} {
  const docs = querySnapshot.docs || [];
  const lastDoc = docs[docs.length - 1] || null;
  const hasMore = docs.length === limitCount;

  return { lastDoc, hasMore };
}

/**
 * Validate whisper data structure
 */
export function validateWhisperData(
  data: Partial<FirestoreWhisperData> & Record<string, unknown>
): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Required fields
  const requiredFields = [
    "userId",
    "userDisplayName",
    "userProfileColor",
    "audioUrl",
    "duration",
    "whisperPercentage",
    "averageLevel",
    "confidence",
  ];

  requiredFields.forEach((field) => {
    if (
      data[field] === undefined ||
      data[field] === null ||
      data[field] === ""
    ) {
      errors.push(`Missing required field: ${field}`);
    }
  });

  // Validate numeric fields
  const numericFields = [
    "duration",
    "whisperPercentage",
    "averageLevel",
    "confidence",
  ];
  numericFields.forEach((field) => {
    if (data[field] !== undefined && typeof data[field] !== "number") {
      errors.push(`${field} must be a number`);
    }
  });

  // Validate duration range
  if (data.duration !== undefined) {
    if (data.duration <= 0) {
      errors.push("Duration must be greater than 0");
    }
    if (data.duration > 300) {
      // 5 minutes max
      errors.push("Duration cannot exceed 300 seconds");
    }
  }

  // Validate percentage range
  if (data.whisperPercentage !== undefined) {
    if (data.whisperPercentage < 0 || data.whisperPercentage > 100) {
      errors.push("Whisper percentage must be between 0 and 100");
    }
  }

  // Validate audio level range
  if (data.averageLevel !== undefined) {
    if (data.averageLevel < 0 || data.averageLevel > 1) {
      errors.push("Average level must be between 0 and 1");
    }
  }

  // Validate confidence range
  if (data.confidence !== undefined) {
    if (data.confidence < 0 || data.confidence > 1) {
      errors.push("Confidence must be between 0 and 1");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate comment data
 */
export function validateCommentData(
  data: Partial<FirestoreCommentData>
): ValidationResult {
  const errors: string[] = [];

  if (!data.whisperId) {
    errors.push("whisperId is required");
  }

  if (!data.userId) {
    errors.push("userId is required");
  }

  if (!data.userDisplayName) {
    errors.push("userDisplayName is required");
  }

  if (!data.userProfileColor) {
    errors.push("userProfileColor is required");
  }

  if (!data.text) {
    errors.push("text is required");
  } else if (data.text.length > 500) {
    errors.push("text must be 500 characters or less");
  }

  if (
    data.likes !== undefined &&
    (typeof data.likes !== "number" || data.likes < 0)
  ) {
    errors.push("likes must be a non-negative number");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate like data
 */
export function validateLikeData(
  data: Partial<FirestoreLikeData>
): ValidationResult {
  const errors: string[] = [];

  if (!data.userId) {
    errors.push("userId is required");
  }

  if (!data.whisperId && !data.commentId) {
    errors.push("either whisperId or commentId is required");
  }

  if (data.whisperId && data.commentId) {
    errors.push("cannot have both whisperId and commentId");
  }

  if (data.userDisplayName && data.userDisplayName.length > 50) {
    errors.push("userDisplayName must be 50 characters or less");
  }

  if (data.userProfileColor && !isValidHexColor(data.userProfileColor)) {
    errors.push("userProfileColor must be a valid hex color");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Sanitize whisper data for storage
 */
export function sanitizeWhisperData(
  data: Partial<FirestoreWhisperData>
): FirestoreWhisperData {
  return {
    userId: data.userId || "",
    userDisplayName: data.userDisplayName || "",
    userProfileColor: data.userProfileColor || "#000000",
    audioUrl: data.audioUrl || "",
    duration: data.duration || 0,
    whisperPercentage: data.whisperPercentage || 0,
    averageLevel: data.averageLevel || 0,
    confidence: data.confidence || 0,
    likes: data.likes || 0,
    replies: data.replies || 0,
    transcription: data.transcription || "",
    isTranscribed: data.isTranscribed || false,
    moderationResult: data.moderationResult || undefined,
  };
}

/**
 * Sanitize comment data for storage
 */
export function sanitizeCommentData(
  data: Partial<FirestoreCommentData>
): FirestoreCommentData {
  return {
    whisperId: data.whisperId || "",
    userId: data.userId || "",
    userDisplayName: data.userDisplayName || "",
    userProfileColor: data.userProfileColor || "#000000",
    text: data.text || "",
    likes: data.likes || 0,
    isEdited: data.isEdited || false,
    editedAt: data.editedAt,
    createdAt: data.createdAt || new Date(),
  };
}

/**
 * Sanitize like data for storage
 */
export function sanitizeLikeData(
  data: Partial<FirestoreLikeData>
): FirestoreLikeData {
  return {
    whisperId: data.whisperId || "",
    commentId: data.commentId || "",
    userId: data.userId || "",
    userDisplayName: data.userDisplayName || "",
    userProfileColor: data.userProfileColor || "#000000",
    createdAt: data.createdAt || new Date(),
  };
}

/**
 * Check if data has required fields for whisper
 */
export function hasRequiredWhisperFields(
  data: Partial<FirestoreWhisperData> & Record<string, unknown>
): boolean {
  const requiredFields = [
    "userId",
    "userDisplayName",
    "userProfileColor",
    "audioUrl",
    "duration",
    "whisperPercentage",
    "averageLevel",
    "confidence",
  ];

  return requiredFields.every(
    (field) => data[field] !== undefined && data[field] !== null
  );
}

/**
 * Check if data has required fields for comment
 */
export function hasRequiredCommentFields(
  data: Partial<FirestoreCommentData> & Record<string, unknown>
): boolean {
  const requiredFields = [
    "whisperId",
    "userId",
    "userDisplayName",
    "userProfileColor",
    "text",
  ];

  return requiredFields.every(
    (field) =>
      data[field] !== undefined && data[field] !== null && data[field] !== ""
  );
}

/**
 * Check if data has required fields for like
 */
export function hasRequiredLikeFields(
  data: Partial<FirestoreLikeData> & Record<string, unknown>
): boolean {
  const requiredFields = ["whisperId", "userId"];

  return requiredFields.every(
    (field) => data[field] !== undefined && data[field] !== null
  );
}

/**
 * Get default values for whisper data
 */
export function getDefaultWhisperData(): Partial<FirestoreWhisperData> {
  return {
    likes: 0,
    replies: 0,
    transcription: "",
    isTranscribed: false,
    moderationResult: undefined,
  };
}

/**
 * Get default comment data
 */
export function getDefaultCommentData(): Partial<FirestoreCommentData> {
  return {
    likes: 0,
    isEdited: false,
    createdAt: new Date(),
  };
}

/**
 * Get default like data
 */
export function getDefaultLikeData(): Partial<FirestoreLikeData> {
  return {
    userDisplayName: "Anonymous",
    userProfileColor: "#007AFF",
    createdAt: new Date(),
  };
}

/**
 * Merge data with defaults
 */
export function mergeWithDefaults<T>(
  data: Partial<T>,
  defaults: Partial<T>
): T {
  return {
    ...defaults,
    ...data,
  } as T;
}

/**
 * Sanitize comment text
 */
export function sanitizeCommentText(text: string): string {
  return text.trim().slice(0, 500); // Trim and limit to 500 characters
}

/**
 * Sanitize user display name
 */
export function sanitizeUserDisplayName(name: string): string {
  return name.trim().slice(0, 50); // Trim and limit to 50 characters
}

/**
 * Validate hex color format
 */
export function isValidHexColor(color: string): boolean {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
}
