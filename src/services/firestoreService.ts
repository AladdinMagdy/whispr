import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  DocumentData,
  QueryDocumentSnapshot,
  Timestamp,
} from "firebase/firestore";
import { getFirestoreInstance } from "@/config/firebase";
import { Whisper } from "@/types";
import { FIRESTORE_COLLECTIONS } from "@/constants";

export class FirestoreService {
  /**
   * Create a new whisper
   */
  static async createWhisper(
    whisperData: Omit<Whisper, "id" | "createdAt" | "updatedAt">
  ): Promise<Whisper> {
    try {
      const db = getFirestoreInstance();

      // Convert undefined values to null for Firestore compatibility
      const firestoreData = Object.fromEntries(
        Object.entries(whisperData).map(([key, value]) => [
          key,
          value === undefined ? null : value,
        ])
      );

      const docRef = await addDoc(
        collection(db, FIRESTORE_COLLECTIONS.WHISPERS),
        {
          ...firestoreData,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        }
      );

      const whisper: Whisper = {
        id: docRef.id,
        ...whisperData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return whisper;
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
      const db = getFirestoreInstance();

      const docRef = doc(db, FIRESTORE_COLLECTIONS.WHISPERS, whisperId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
        } as Whisper;
      }

      return null;
    } catch (error) {
      console.error("Error getting whisper:", error);
      return null;
    }
  }

  /**
   * Get whispers with pagination
   */
  static async getWhispers(
    options: {
      limit?: number;
      lastDoc?: QueryDocumentSnapshot<DocumentData>;
      userId?: string;
      isPublic?: boolean;
    } = {}
  ): Promise<{
    whispers: Whisper[];
    lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  }> {
    try {
      const db = getFirestoreInstance();

      const { limit: limitCount = 10, lastDoc, userId, isPublic } = options;

      let q = query(
        collection(db, FIRESTORE_COLLECTIONS.WHISPERS),
        orderBy("createdAt", "desc"),
        limit(limitCount)
      );

      // Add filters
      if (userId) {
        q = query(q, where("userId", "==", userId));
      }

      if (isPublic !== undefined) {
        q = query(q, where("isPublic", "==", isPublic));
      }

      // Add pagination
      if (lastDoc) {
        q = query(q, startAfter(lastDoc));
      }

      const querySnapshot = await getDocs(q);
      const whispers: Whisper[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        whispers.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
        } as Whisper);
      });

      const lastVisible =
        querySnapshot.docs[querySnapshot.docs.length - 1] || null;

      return {
        whispers,
        lastDoc: lastVisible,
      };
    } catch (error) {
      console.error("Error getting whispers:", error);
      throw new Error("Failed to get whispers");
    }
  }

  /**
   * Update a whisper
   */
  static async updateWhisper(
    whisperId: string,
    updateData: Partial<Omit<Whisper, "id" | "createdAt" | "updatedAt">>
  ): Promise<void> {
    try {
      const db = getFirestoreInstance();

      const docRef = doc(db, FIRESTORE_COLLECTIONS.WHISPERS, whisperId);
      await updateDoc(docRef, {
        ...updateData,
        updatedAt: Timestamp.now(),
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
      const db = getFirestoreInstance();

      const docRef = doc(db, FIRESTORE_COLLECTIONS.WHISPERS, whisperId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting whisper:", error);
      throw new Error("Failed to delete whisper");
    }
  }

  /**
   * Like a whisper
   */
  static async likeWhisper(whisperId: string, userId: string): Promise<void> {
    try {
      const db = getFirestoreInstance();

      const docRef = doc(db, FIRESTORE_COLLECTIONS.WHISPERS, whisperId);
      await updateDoc(docRef, {
        likes: {
          [userId]: true,
        },
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error("Error liking whisper:", error);
      throw new Error("Failed to like whisper");
    }
  }

  /**
   * Unlike a whisper
   */
  static async unlikeWhisper(whisperId: string, userId: string): Promise<void> {
    try {
      const db = getFirestoreInstance();

      const docRef = doc(db, FIRESTORE_COLLECTIONS.WHISPERS, whisperId);
      await updateDoc(docRef, {
        [`likes.${userId}`]: null,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error("Error unliking whisper:", error);
      throw new Error("Failed to unlike whisper");
    }
  }

  /**
   * Get user's whispers
   */
  static async getUserWhispers(
    userId: string,
    options: {
      limit?: number;
      lastDoc?: QueryDocumentSnapshot<DocumentData>;
    } = {}
  ): Promise<{
    whispers: Whisper[];
    lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  }> {
    return this.getWhispers({
      ...options,
      userId,
    });
  }

  /**
   * Get public whispers with pagination
   */
  static async getPublicWhispers(
    options: {
      limit?: number;
      lastDoc?: QueryDocumentSnapshot<DocumentData>;
    } = {}
  ): Promise<{
    whispers: Whisper[];
    lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  }> {
    const { limit: limitCount = 10, lastDoc } = options;

    try {
      const db = getFirestoreInstance();

      let q = query(
        collection(db, FIRESTORE_COLLECTIONS.WHISPERS),
        where("isPublic", "==", true),
        orderBy("createdAt", "desc"),
        limit(limitCount)
      );

      // Add pagination
      if (lastDoc) {
        q = query(q, startAfter(lastDoc));
      }

      const querySnapshot = await getDocs(q);
      const whispers: Whisper[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        whispers.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
        } as Whisper);
      });

      const lastVisible =
        querySnapshot.docs[querySnapshot.docs.length - 1] || null;

      return {
        whispers,
        lastDoc: lastVisible,
      };
    } catch (error) {
      console.error("Error getting public whispers:", error);

      // Check if it's an index error
      if (
        error instanceof Error &&
        error.message.includes("requires an index")
      ) {
        console.error(
          "Firestore index missing. Please create the required index:"
        );
        console.error("Collection: whispers");
        console.error("Fields: isPublic (Ascending), createdAt (Descending)");
        console.error(
          "You can create it at: https://console.firebase.google.com/project/YOUR_PROJECT_ID/firestore/indexes"
        );

        // For now, try a simpler query without the index
        try {
          console.log("Attempting fallback query without index...");
          const db = getFirestoreInstance();
          const q = query(
            collection(db, FIRESTORE_COLLECTIONS.WHISPERS),
            where("isPublic", "==", true),
            limit(limitCount)
          );

          const querySnapshot = await getDocs(q);
          const whispers: Whisper[] = [];

          querySnapshot.forEach((doc) => {
            const data = doc.data();
            whispers.push({
              id: doc.id,
              ...data,
              createdAt: data.createdAt.toDate(),
              updatedAt: data.updatedAt.toDate(),
            } as Whisper);
          });

          // Sort in memory since we can't use the index
          whispers.sort(
            (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
          );

          return {
            whispers: whispers.slice(0, limitCount),
            lastDoc: null,
          };
        } catch (fallbackError) {
          console.error("Fallback query also failed:", fallbackError);
        }
      }

      throw new Error("Failed to get public whispers");
    }
  }
}

export default FirestoreService;
