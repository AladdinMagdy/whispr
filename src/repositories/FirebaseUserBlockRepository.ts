/**
 * Firebase implementation of UserBlockRepository
 * Handles all user block data access operations using Firebase Firestore
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
import { UserBlock } from "../types";
import { UserBlockRepository } from "./UserBlockRepository";
import { getErrorMessage } from "../utils/errorHelpers";

/**
 * Firebase implementation of UserBlockRepository
 * Handles all user block data access operations using Firebase Firestore
 */
export class FirebaseUserBlockRepository implements UserBlockRepository {
  private firestore = getFirestoreInstance();
  private collection = "userBlocks";

  /**
   * Helper function to map Firestore document to UserBlock object
   */
  private mapDocumentToUserBlock(
    doc: DocumentSnapshot | QueryDocumentSnapshot
  ): UserBlock {
    const data = doc.data();
    if (!data) {
      throw new Error(`Document ${doc.id} has no data`);
    }
    return {
      id: doc.id,
      userId: data.userId,
      blockedUserId: data.blockedUserId,
      blockedUserDisplayName: data.blockedUserDisplayName,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as UserBlock;
  }

  async getAll(): Promise<UserBlock[]> {
    try {
      const q = query(
        collection(this.firestore, this.collection),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) => this.mapDocumentToUserBlock(doc));
    } catch (error) {
      console.error("❌ Error getting all user blocks:", error);
      throw new Error(
        `Failed to get all user blocks: ${getErrorMessage(error)}`
      );
    }
  }

  async getById(id: string): Promise<UserBlock | null> {
    try {
      const docRef = doc(this.firestore, this.collection, id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      return this.mapDocumentToUserBlock(docSnap);
    } catch (error) {
      console.error("❌ Error getting user block by ID:", error);
      throw new Error(`Failed to get user block: ${getErrorMessage(error)}`);
    }
  }

  async save(block: UserBlock): Promise<void> {
    try {
      const blockData = {
        ...block,
        createdAt: Timestamp.fromDate(block.createdAt),
        updatedAt: Timestamp.fromDate(block.updatedAt),
      };

      await setDoc(doc(this.firestore, this.collection, block.id), blockData);
      console.log("✅ User block saved successfully:", block.id);
    } catch (error) {
      console.error("❌ Error saving user block:", error);
      throw new Error(`Failed to save user block: ${getErrorMessage(error)}`);
    }
  }

  async update(id: string, updates: Partial<UserBlock>): Promise<void> {
    try {
      const updateData: UpdateData<UserBlock> = {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date()),
      };

      // Handle date fields
      if (updates.createdAt) {
        updateData.createdAt = Timestamp.fromDate(updates.createdAt);
      }

      await updateDoc(doc(this.firestore, this.collection, id), updateData);
      console.log("✅ User block updated successfully:", id);
    } catch (error) {
      console.error("❌ Error updating user block:", error);
      throw new Error(`Failed to update user block: ${getErrorMessage(error)}`);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await deleteDoc(doc(this.firestore, this.collection, id));
      console.log("✅ User block deleted successfully:", id);
    } catch (error) {
      console.error("❌ Error deleting user block:", error);
      throw new Error(`Failed to delete user block: ${getErrorMessage(error)}`);
    }
  }

  async getByUser(userId: string): Promise<UserBlock[]> {
    try {
      const q = query(
        collection(this.firestore, this.collection),
        where("userId", "==", userId),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) => this.mapDocumentToUserBlock(doc));
    } catch (error) {
      console.error("❌ Error getting user blocks by user:", error);
      throw new Error(`Failed to get user blocks: ${getErrorMessage(error)}`);
    }
  }

  async getByBlockedUser(blockedUserId: string): Promise<UserBlock[]> {
    try {
      const q = query(
        collection(this.firestore, this.collection),
        where("blockedUserId", "==", blockedUserId),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) => this.mapDocumentToUserBlock(doc));
    } catch (error) {
      console.error("❌ Error getting user blocks by blocked user:", error);
      throw new Error(
        `Failed to get user blocks by blocked user: ${getErrorMessage(error)}`
      );
    }
  }

  async getByUserAndBlockedUser(
    userId: string,
    blockedUserId: string
  ): Promise<UserBlock | null> {
    try {
      const q = query(
        collection(this.firestore, this.collection),
        where("userId", "==", userId),
        where("blockedUserId", "==", blockedUserId)
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty || querySnapshot.docs.length === 0) {
        return null;
      }

      return this.mapDocumentToUserBlock(querySnapshot.docs[0]);
    } catch (error) {
      console.error(
        "❌ Error getting user block by user and blocked user:",
        error
      );
      throw new Error(`Failed to get user block: ${getErrorMessage(error)}`);
    }
  }

  async isUserBlocked(userId: string, blockedUserId: string): Promise<boolean> {
    try {
      const block = await this.getByUserAndBlockedUser(userId, blockedUserId);
      return block !== null;
    } catch (error) {
      console.error("❌ Error checking if user is blocked:", error);
      throw new Error(
        `Failed to check if user is blocked: ${getErrorMessage(error)}`
      );
    }
  }
}
