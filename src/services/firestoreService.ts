import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import { Whisper, User } from "@/types";
import { FIRESTORE_COLLECTIONS } from "@/constants";

export interface WhisperData {
  userId: string;
  audioUrl: string;
  transcription?: string;
  duration: number;
  volume: number;
  isWhisper: boolean;
  isPublic: boolean;
  likes: number;
  replies: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export class FirestoreService {
  /**
   * Create a new whisper document
   */
  static async createWhisper(
    whisperData: Omit<WhisperData, "createdAt" | "updatedAt">
  ): Promise<string> {
    try {
      const docRef = await addDoc(
        collection(db, FIRESTORE_COLLECTIONS.WHISPERS),
        {
          ...whisperData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );

      return docRef.id;
    } catch (error) {
      console.error("Error creating whisper:", error);
      throw new Error("Failed to create whisper");
    }
  }

  /**
   * Get a whisper by ID
   */
  static async getWhisper(whisperId: string): Promise<Whisper | null> {
    try {
      const docRef = doc(db, FIRESTORE_COLLECTIONS.WHISPERS, whisperId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as WhisperData;
        return this.convertFirestoreWhisper(docSnap.id, data);
      }

      return null;
    } catch (error) {
      console.error("Error getting whisper:", error);
      throw new Error("Failed to get whisper");
    }
  }

  /**
   * Get whispers for feed (public whispers, ordered by creation time)
   */
  static async getPublicWhispers(limitCount: number = 20): Promise<Whisper[]> {
    try {
      const q = query(
        collection(db, FIRESTORE_COLLECTIONS.WHISPERS),
        where("isPublic", "==", true),
        orderBy("createdAt", "desc"),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      const whispers: Whisper[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data() as WhisperData;
        whispers.push(this.convertFirestoreWhisper(doc.id, data));
      });

      return whispers;
    } catch (error) {
      console.error("Error getting public whispers:", error);
      throw new Error("Failed to get public whispers");
    }
  }

  /**
   * Get whispers by user ID
   */
  static async getUserWhispers(
    userId: string,
    limitCount: number = 20
  ): Promise<Whisper[]> {
    try {
      const q = query(
        collection(db, FIRESTORE_COLLECTIONS.WHISPERS),
        where("userId", "==", userId),
        orderBy("createdAt", "desc"),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      const whispers: Whisper[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data() as WhisperData;
        whispers.push(this.convertFirestoreWhisper(doc.id, data));
      });

      return whispers;
    } catch (error) {
      console.error("Error getting user whispers:", error);
      throw new Error("Failed to get user whispers");
    }
  }

  /**
   * Update a whisper
   */
  static async updateWhisper(
    whisperId: string,
    updates: Partial<WhisperData>
  ): Promise<void> {
    try {
      const docRef = doc(db, FIRESTORE_COLLECTIONS.WHISPERS, whisperId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error updating whisper:", error);
      throw new Error("Failed to update whisper");
    }
  }

  /**
   * Delete a whisper
   */
  static async deleteWhisper(whisperId: string): Promise<void> {
    try {
      const docRef = doc(db, FIRESTORE_COLLECTIONS.WHISPERS, whisperId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting whisper:", error);
      throw new Error("Failed to delete whisper");
    }
  }

  /**
   * Like a whisper (increment likes count)
   */
  static async likeWhisper(whisperId: string): Promise<void> {
    try {
      const docRef = doc(db, FIRESTORE_COLLECTIONS.WHISPERS, whisperId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const currentLikes = docSnap.data().likes || 0;
        await updateDoc(docRef, {
          likes: currentLikes + 1,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error("Error liking whisper:", error);
      throw new Error("Failed to like whisper");
    }
  }

  /**
   * Listen to real-time updates for public whispers
   */
  static subscribeToPublicWhispers(
    callback: (whispers: Whisper[]) => void,
    limitCount: number = 20
  ): () => void {
    const q = query(
      collection(db, FIRESTORE_COLLECTIONS.WHISPERS),
      where("isPublic", "==", true),
      orderBy("createdAt", "desc"),
      limit(limitCount)
    );

    return onSnapshot(q, (querySnapshot) => {
      const whispers: Whisper[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data() as WhisperData;
        whispers.push(this.convertFirestoreWhisper(doc.id, data));
      });
      callback(whispers);
    });
  }

  /**
   * Listen to real-time updates for user whispers
   */
  static subscribeToUserWhispers(
    userId: string,
    callback: (whispers: Whisper[]) => void,
    limitCount: number = 20
  ): () => void {
    const q = query(
      collection(db, FIRESTORE_COLLECTIONS.WHISPERS),
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(limitCount)
    );

    return onSnapshot(q, (querySnapshot) => {
      const whispers: Whisper[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data() as WhisperData;
        whispers.push(this.convertFirestoreWhisper(doc.id, data));
      });
      callback(whispers);
    });
  }

  /**
   * Convert Firestore document to Whisper type
   */
  private static convertFirestoreWhisper(
    id: string,
    data: WhisperData
  ): Whisper {
    return {
      id,
      userId: data.userId,
      audioUrl: data.audioUrl,
      transcription: data.transcription,
      duration: data.duration,
      volume: data.volume,
      isWhisper: data.isWhisper,
      isPublic: data.isPublic,
      likes: data.likes,
      replies: data.replies,
      createdAt: data.createdAt.toDate(),
      updatedAt: data.updatedAt.toDate(),
    };
  }

  /**
   * Search whispers by transcription text
   */
  static async searchWhispers(
    searchTerm: string,
    limitCount: number = 20
  ): Promise<Whisper[]> {
    try {
      // Note: This is a simple search. For production, consider using Algolia or similar
      const q = query(
        collection(db, FIRESTORE_COLLECTIONS.WHISPERS),
        where("isPublic", "==", true),
        orderBy("createdAt", "desc"),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      const whispers: Whisper[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data() as WhisperData;
        const whisper = this.convertFirestoreWhisper(doc.id, data);

        // Simple text search in transcription
        if (
          whisper.transcription
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase())
        ) {
          whispers.push(whisper);
        }
      });

      return whispers;
    } catch (error) {
      console.error("Error searching whispers:", error);
      throw new Error("Failed to search whispers");
    }
  }
}

export default FirestoreService;
