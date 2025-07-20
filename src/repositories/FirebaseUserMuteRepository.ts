/**
 * Firebase implementation of UserMuteRepository
 * Handles all user mute data access operations using Firebase Firestore
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  UpdateData,
  DocumentSnapshot,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import { getFirestoreInstance } from "../config/firebase";
import { UserMute } from "../types";
import { UserMuteRepository } from "./UserMuteRepository";
import { getErrorMessage } from "../utils/errorHelpers";

/**
 * Firebase implementation of UserMuteRepository
 * Handles all user mute data access operations using Firebase Firestore
 */
export class FirebaseUserMuteRepository implements UserMuteRepository {
  private firestore = getFirestoreInstance();
  private collection = "userMutes";

  /**
   * Helper function to map Firestore document to UserMute object
   */
  private mapDocumentToUserMute(
    doc: DocumentSnapshot | QueryDocumentSnapshot
  ): UserMute {
    const data = doc.data();
    if (!data) {
      throw new Error(`Document ${doc.id} has no data`);
    }
    return {
      id: doc.id,
      userId: data.userId,
      mutedUserId: data.mutedUserId,
      mutedUserDisplayName: data.mutedUserDisplayName,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as UserMute;
  }

  async getAll(): Promise<UserMute[]> {
    try {
      const q = query(
        collection(this.firestore, this.collection),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) => this.mapDocumentToUserMute(doc));
    } catch (error) {
      console.error("❌ Error getting all user mutes:", error);
      throw new Error(
        `Failed to get all user mutes: ${getErrorMessage(error)}`
      );
    }
  }

  async getById(id: string): Promise<UserMute | null> {
    try {
      const docRef = doc(this.firestore, this.collection, id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      return this.mapDocumentToUserMute(docSnap);
    } catch (error) {
      console.error("❌ Error getting user mute by ID:", error);
      throw new Error(`Failed to get user mute: ${getErrorMessage(error)}`);
    }
  }

  async save(mute: UserMute): Promise<void> {
    try {
      const muteData = {
        ...mute,
        createdAt: Timestamp.fromDate(mute.createdAt),
        updatedAt: Timestamp.fromDate(mute.updatedAt),
      };

      await setDoc(doc(this.firestore, this.collection, mute.id), muteData);
      console.log("✅ User mute saved successfully:", mute.id);
    } catch (error) {
      console.error("❌ Error saving user mute:", error);
      throw new Error(`Failed to save user mute: ${getErrorMessage(error)}`);
    }
  }

  async update(id: string, updates: Partial<UserMute>): Promise<void> {
    try {
      const updateData: UpdateData<UserMute> = {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date()),
      };

      // Handle date fields
      if (updates.createdAt) {
        updateData.createdAt = Timestamp.fromDate(updates.createdAt);
      }

      await updateDoc(doc(this.firestore, this.collection, id), updateData);
      console.log("✅ User mute updated successfully:", id);
    } catch (error) {
      console.error("❌ Error updating user mute:", error);
      throw new Error(`Failed to update user mute: ${getErrorMessage(error)}`);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await deleteDoc(doc(this.firestore, this.collection, id));
      console.log("✅ User mute deleted successfully:", id);
    } catch (error) {
      console.error("❌ Error deleting user mute:", error);
      throw new Error(`Failed to delete user mute: ${getErrorMessage(error)}`);
    }
  }

  async getByUser(userId: string): Promise<UserMute[]> {
    try {
      const q = query(
        collection(this.firestore, this.collection),
        where("userId", "==", userId),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) => this.mapDocumentToUserMute(doc));
    } catch (error) {
      console.error("❌ Error getting user mutes by user:", error);
      throw new Error(`Failed to get user mutes: ${getErrorMessage(error)}`);
    }
  }

  async getByMutedUser(mutedUserId: string): Promise<UserMute[]> {
    try {
      const q = query(
        collection(this.firestore, this.collection),
        where("mutedUserId", "==", mutedUserId),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) => this.mapDocumentToUserMute(doc));
    } catch (error) {
      console.error("❌ Error getting user mutes by muted user:", error);
      throw new Error(
        `Failed to get user mutes by muted user: ${getErrorMessage(error)}`
      );
    }
  }

  async getByUserAndMutedUser(
    userId: string,
    mutedUserId: string
  ): Promise<UserMute | null> {
    try {
      const q = query(
        collection(this.firestore, this.collection),
        where("userId", "==", userId),
        where("mutedUserId", "==", mutedUserId)
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return null;
      }

      return this.mapDocumentToUserMute(querySnapshot.docs[0]);
    } catch (error) {
      console.error(
        "❌ Error getting user mute by user and muted user:",
        error
      );
      throw new Error(`Failed to get user mute: ${getErrorMessage(error)}`);
    }
  }

  async isUserMuted(userId: string, mutedUserId: string): Promise<boolean> {
    try {
      const mute = await this.getByUserAndMutedUser(userId, mutedUserId);
      return mute !== null;
    } catch (error) {
      console.error("❌ Error checking if user is muted:", error);
      throw new Error(
        `Failed to check if user is muted: ${getErrorMessage(error)}`
      );
    }
  }
}
