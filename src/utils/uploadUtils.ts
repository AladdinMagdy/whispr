/**
 * Upload Utilities for Whispr
 * Utility functions for upload operations and validation
 */

import { StorageService } from "../services/storageService";
import { getFirestoreService } from "../services/firestoreService";
import { getAuthService } from "../services/authService";
import { ContentModerationService } from "../services/contentModerationService";
import { TranscriptionService } from "../services/transcriptionService";
import { AgeVerificationService } from "../services/ageVerificationService";
import { getReputationService } from "../services/reputationService";
import {
  formatFileSize,
  generateUniqueFilename,
  isValidAudioFormat,
} from "./fileUtils";
import { ModerationResult } from "../types";
import { AnonymousUser } from "../services/authService";
import { DocumentData } from "firebase/firestore";

// Types
export interface UploadProgress {
  progress: number;
  bytesTransferred: number;
  totalBytes: number;
}

export interface WhisperUploadData {
  audioUri: string;
  duration: number;
  whisperPercentage: number;
  averageLevel: number;
  confidence: number;
  userAge?: number; // Required for age verification
  dateOfBirth?: Date; // Alternative to userAge
}

export interface UploadResult {
  whisperId: string;
  audioUrl: string;
  transcription: string;
  moderationResult: ModerationResult;
}

export interface AgeVerificationData {
  age?: number;
  dateOfBirth?: Date;
}

export interface ModerationData {
  text: string;
  userId: string;
  age: number;
}

export interface WhisperData {
  audioUrl: string;
  duration: number;
  whisperPercentage: number;
  averageLevel: number;
  confidence: number;
  transcription: string;
  moderationResult: ModerationResult;
}

export interface AudioUploadData {
  uri: string;
  duration: number;
  volume: number;
  isWhisper: boolean;
  timestamp: Date;
}

// Constants
export const UPLOAD_ERROR_MESSAGES = {
  USER_NOT_AUTHENTICATED: "User not authenticated",
  INVALID_AUDIO_FORMAT: "Invalid audio file format",
  AGE_VERIFICATION_FAILED: "Age verification failed",
  CONTENT_REJECTED: "Content rejected",
  WHISPER_NOT_FOUND: "Whisper not found",
  NOT_AUTHORIZED: "Not authorized to delete this whisper",
  TRANSCRIPTION_FAILED: "Transcription failed",
  MODERATION_FAILED: "Content moderation failed",
  STORAGE_UPLOAD_FAILED: "Storage upload failed",
  FIRESTORE_CREATE_FAILED: "Firestore document creation failed",
  REPUTATION_UPDATE_FAILED: "Reputation update failed",
} as const;

export const UPLOAD_SUCCESS_MESSAGES = {
  AUDIO_UPLOADED: "Audio uploaded successfully",
  TRANSCRIPTION_COMPLETED: "Transcription completed",
  AGE_VERIFIED: "Age verification completed",
  CONTENT_MODERATED: "Content moderation completed",
  WHISPER_CREATED: "Whisper created successfully",
  REPUTATION_UPDATED: "Reputation updated",
  WHISPER_DELETED: "Whisper deleted successfully",
  TRANSCRIPTION_UPDATED: "Transcription updated successfully",
} as const;

/**
 * Validate user authentication
 */
export async function validateUserAuthentication(): Promise<{
  user: AnonymousUser;
  userId: string;
}> {
  const authService = getAuthService();
  const user = await authService.getCurrentUser();

  if (!user) {
    throw new Error(UPLOAD_ERROR_MESSAGES.USER_NOT_AUTHENTICATED);
  }

  return { user, userId: user.uid };
}

/**
 * Validate audio file format
 */
export function validateAudioFormat(audioUri: string): void {
  if (!isValidAudioFormat(audioUri)) {
    throw new Error(UPLOAD_ERROR_MESSAGES.INVALID_AUDIO_FORMAT);
  }
}

/**
 * Upload audio file to storage
 */
export async function uploadAudioToStorage(
  audioData: AudioUploadData,
  userId: string
): Promise<string> {
  try {
    const audioUrl = await StorageService.uploadAudio(audioData, userId);
    console.log(UPLOAD_SUCCESS_MESSAGES.AUDIO_UPLOADED);
    return audioUrl;
  } catch (error) {
    console.error("❌ Error uploading audio to storage:", error);
    throw new Error(UPLOAD_ERROR_MESSAGES.STORAGE_UPLOAD_FAILED);
  }
}

/**
 * Transcribe audio file
 */
export async function transcribeAudio(audioUrl: string): Promise<{
  text: string;
}> {
  try {
    console.log("🎤 Transcribing audio for moderation...");
    const transcription = await TranscriptionService.transcribeAudio(audioUrl);
    console.log("✅ Transcription completed:", transcription.text);
    return transcription;
  } catch (error) {
    console.error("❌ Error transcribing audio:", error);
    throw new Error(UPLOAD_ERROR_MESSAGES.TRANSCRIPTION_FAILED);
  }
}

/**
 * Verify user age
 */
export async function verifyUserAge(ageData: AgeVerificationData): Promise<{
  isVerified: boolean;
  age: number;
  reason?: string;
}> {
  try {
    console.log("🔍 Verifying user age...");
    const ageVerification = await AgeVerificationService.verifyAge(ageData);

    if (!ageVerification.isVerified) {
      throw new Error(`Age verification failed: ${ageVerification.reason}`);
    }

    console.log("✅ Age verification completed");
    return ageVerification;
  } catch (error) {
    console.error("❌ Error verifying age:", error);
    throw new Error(UPLOAD_ERROR_MESSAGES.AGE_VERIFICATION_FAILED);
  }
}

/**
 * Moderate content
 */
export async function moderateContent(
  moderationData: ModerationData
): Promise<ModerationResult> {
  try {
    console.log("🛡️ Moderating content...");
    const moderationResult = await ContentModerationService.moderateWhisper(
      moderationData.text,
      moderationData.userId,
      moderationData.age
    );

    if (moderationResult.status === "rejected") {
      throw new Error(`Content rejected: ${moderationResult.reason}`);
    }

    console.log("✅ Content moderation completed");
    return moderationResult;
  } catch (error) {
    console.error("❌ Error moderating content:", error);
    throw new Error(UPLOAD_ERROR_MESSAGES.MODERATION_FAILED);
  }
}

/**
 * Create whisper document in Firestore
 */
export async function createWhisperDocument(
  userId: string,
  displayName: string,
  profileColor: string,
  whisperData: WhisperData
): Promise<string> {
  try {
    const firestoreService = getFirestoreService();
    const whisperId = await firestoreService.createWhisper(
      userId,
      displayName,
      profileColor,
      whisperData
    );

    console.log("✅ Whisper created successfully:", whisperId);
    return whisperId;
  } catch (error) {
    console.error("❌ Error creating whisper document:", error);
    throw new Error(UPLOAD_ERROR_MESSAGES.FIRESTORE_CREATE_FAILED);
  }
}

/**
 * Update user reputation
 */
export async function updateUserReputation(userId: string): Promise<void> {
  try {
    const reputationService = getReputationService();
    await reputationService.recordSuccessfulWhisper(userId);
    console.log("✅ Reputation updated");
  } catch (error) {
    console.warn("⚠️ Reputation update failed, but upload completed:", error);
    // Don't fail the upload if reputation update fails
    throw new Error(UPLOAD_ERROR_MESSAGES.REPUTATION_UPDATE_FAILED);
  }
}

/**
 * Get whisper data for deletion
 */
export async function getWhisperForDeletion(whisperId: string): Promise<{
  whisper: DocumentData;
  audioUrl: string;
}> {
  const firestoreService = getFirestoreService();
  const whisper = await firestoreService.getWhisper(whisperId);

  if (!whisper) {
    throw new Error(UPLOAD_ERROR_MESSAGES.WHISPER_NOT_FOUND);
  }

  return { whisper, audioUrl: whisper.audioUrl };
}

/**
 * Validate whisper ownership
 */
export function validateWhisperOwnership(
  whisperUserId: string,
  currentUserId: string
): void {
  if (whisperUserId !== currentUserId) {
    throw new Error(UPLOAD_ERROR_MESSAGES.NOT_AUTHORIZED);
  }
}

/**
 * Delete whisper from Firestore
 */
export async function deleteWhisperFromFirestore(
  whisperId: string
): Promise<void> {
  const firestoreService = getFirestoreService();
  await firestoreService.deleteWhisper(whisperId);
}

/**
 * Delete audio file from storage
 */
export async function deleteAudioFromStorage(audioUrl: string): Promise<void> {
  if (audioUrl) {
    await StorageService.deleteAudio(audioUrl);
  }
}

/**
 * Update whisper transcription
 */
export async function updateWhisperTranscription(
  whisperId: string,
  transcription: string
): Promise<void> {
  try {
    const firestoreService = getFirestoreService();
    await firestoreService.updateTranscription(whisperId, transcription);
    console.log("✅ Transcription updated successfully");
  } catch (error) {
    console.error("❌ Error updating transcription:", error);
    throw error;
  }
}

/**
 * Format file size for display
 */
export function formatFileSizeForDisplay(bytes: number): string {
  return formatFileSize(bytes);
}

/**
 * Format upload progress for display
 */
export function formatUploadProgress(progress: UploadProgress): string {
  return `${progress.progress.toFixed(1)}% (${formatFileSizeForDisplay(
    progress.bytesTransferred
  )} / ${formatFileSizeForDisplay(progress.totalBytes)})`;
}

/**
 * Generate unique filename
 */
export function generateUniqueFilenameForUpload(originalName: string): string {
  return generateUniqueFilename(originalName);
}

/**
 * Validate audio file format
 */
export function validateAudioFileFormat(audioUri: string): boolean {
  return isValidAudioFormat(audioUri);
}

/**
 * Create audio upload data object
 */
export function createAudioUploadData(
  audioUri: string,
  duration: number,
  averageLevel: number,
  whisperPercentage: number
): AudioUploadData {
  return {
    uri: audioUri,
    duration,
    volume: averageLevel,
    isWhisper: whisperPercentage > 0.5,
    timestamp: new Date(),
  };
}

/**
 * Create whisper data object
 */
export function createWhisperData(
  audioUrl: string,
  duration: number,
  whisperPercentage: number,
  averageLevel: number,
  confidence: number,
  transcription: string,
  moderationResult: ModerationResult
): WhisperData {
  return {
    audioUrl,
    duration,
    whisperPercentage,
    averageLevel,
    confidence,
    transcription,
    moderationResult,
  };
}

/**
 * Create age verification data object
 */
export function createAgeVerificationData(
  userAge?: number,
  dateOfBirth?: Date
): AgeVerificationData {
  return {
    age: userAge,
    dateOfBirth,
  };
}

/**
 * Create moderation data object
 */
export function createModerationData(
  text: string,
  userId: string,
  age: number
): ModerationData {
  return {
    text,
    userId,
    age,
  };
}

/**
 * Handle upload errors gracefully
 */
export function handleUploadError(error: unknown, context: string): never {
  console.error(`❌ Error in ${context}:`, error);

  if (error instanceof Error) {
    throw error;
  }

  throw new Error(`Unknown error in ${context}: ${String(error)}`);
}

/**
 * Log upload progress
 */
export function logUploadProgress(
  stage: string,
  progress?: number,
  additionalInfo?: string
): void {
  const progressText = progress ? ` (${progress.toFixed(1)}%)` : "";
  const infoText = additionalInfo ? ` - ${additionalInfo}` : "";
  console.log(`📊 ${stage}${progressText}${infoText}`);
}

/**
 * Validate upload data
 */
export function validateUploadData(uploadData: WhisperUploadData): void {
  if (!uploadData.audioUri) {
    throw new Error("Audio URI is required");
  }

  if (uploadData.duration <= 0) {
    throw new Error("Duration must be greater than 0");
  }

  if (uploadData.whisperPercentage < 0 || uploadData.whisperPercentage > 1) {
    throw new Error("Whisper percentage must be between 0 and 1");
  }

  if (uploadData.averageLevel < 0) {
    throw new Error("Average level must be non-negative");
  }

  if (uploadData.confidence < 0 || uploadData.confidence > 1) {
    throw new Error("Confidence must be between 0 and 1");
  }

  if (!uploadData.userAge && !uploadData.dateOfBirth) {
    throw new Error("Either userAge or dateOfBirth is required");
  }
}
