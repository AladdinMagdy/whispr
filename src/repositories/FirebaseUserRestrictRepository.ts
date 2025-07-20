/**
 * Firebase implementation of UserRestrictRepository
 * Handles all user restriction data access operations using Firebase Firestore
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
import { UserRestriction } from "../types";
import { UserRestrictRepository } from "./UserRestrictRepository";
import { getErrorMessage } from "../utils/errorHelpers";

/**
 * Firebase implementation of UserRestrictRepository
 * Handles all user restriction data access operations using Firebase Firestore
 */
export class FirebaseUserRestrictRepository implements UserRestrictRepository {
  private firestore = getFirestoreInstance();
  private collection = "userRestrictions";

  /**
   * Helper function to map Firestore document to UserRestriction object
   */
  private mapDocumentToUserRestriction(
    doc: DocumentSnapshot | QueryDocumentSnapshot
  ): UserRestriction {
    const data = doc.data();
    if (!data) {
      throw new Error(`Document ${doc.id} has no data`);
    }
    return {
      id: doc.id,
      userId: data.userId,
      restrictedUserId: data.restrictedUserId,
      restrictedUserDisplayName: data.restrictedUserDisplayName,
      type: data.type,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as UserRestriction;
  }

  async getAll(): Promise<UserRestriction[]> {
    try {
      const q = query(
        collection(this.firestore, this.collection),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) =>
        this.mapDocumentToUserRestriction(doc)
      );
    } catch (error) {
      console.error("❌ Error getting all user restrictions:", error);
      throw new Error(
        `Failed to get all user restrictions: ${getErrorMessage(error)}`
      );
    }
  }

  async getById(id: string): Promise<UserRestriction | null> {
    try {
      const docRef = doc(this.firestore, this.collection, id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      return this.mapDocumentToUserRestriction(docSnap);
    } catch (error) {
      console.error("❌ Error getting user restriction by ID:", error);
      throw new Error(
        `Failed to get user restriction: ${getErrorMessage(error)}`
      );
    }
  }

  async save(restriction: UserRestriction): Promise<void> {
    try {
      const restrictionData = {
        ...restriction,
        createdAt: Timestamp.fromDate(restriction.createdAt),
        updatedAt: Timestamp.fromDate(restriction.updatedAt),
      };

      await setDoc(
        doc(this.firestore, this.collection, restriction.id),
        restrictionData
      );
      console.log("✅ User restriction saved successfully:", restriction.id);
    } catch (error) {
      console.error("❌ Error saving user restriction:", error);
      throw new Error(
        `Failed to save user restriction: ${getErrorMessage(error)}`
      );
    }
  }

  async update(id: string, updates: Partial<UserRestriction>): Promise<void> {
    try {
      const updateData: UpdateData<UserRestriction> = {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date()),
      };

      // Handle date fields
      if (updates.createdAt) {
        updateData.createdAt = Timestamp.fromDate(updates.createdAt);
      }

      await updateDoc(doc(this.firestore, this.collection, id), updateData);
      console.log("✅ User restriction updated successfully:", id);
    } catch (error) {
      console.error("❌ Error updating user restriction:", error);
      throw new Error(
        `Failed to update user restriction: ${getErrorMessage(error)}`
      );
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await deleteDoc(doc(this.firestore, this.collection, id));
      console.log("✅ User restriction deleted successfully:", id);
    } catch (error) {
      console.error("❌ Error deleting user restriction:", error);
      throw new Error(
        `Failed to delete user restriction: ${getErrorMessage(error)}`
      );
    }
  }

  async getByUser(userId: string): Promise<UserRestriction[]> {
    try {
      const q = query(
        collection(this.firestore, this.collection),
        where("userId", "==", userId),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) =>
        this.mapDocumentToUserRestriction(doc)
      );
    } catch (error) {
      console.error("❌ Error getting user restrictions by user:", error);
      throw new Error(
        `Failed to get user restrictions: ${getErrorMessage(error)}`
      );
    }
  }

  async getByRestrictedUser(
    restrictedUserId: string
  ): Promise<UserRestriction[]> {
    try {
      const q = query(
        collection(this.firestore, this.collection),
        where("restrictedUserId", "==", restrictedUserId),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) =>
        this.mapDocumentToUserRestriction(doc)
      );
    } catch (error) {
      console.error(
        "❌ Error getting user restrictions by restricted user:",
        error
      );
      throw new Error(
        `Failed to get user restrictions by restricted user: ${getErrorMessage(
          error
        )}`
      );
    }
  }

  async getByUserAndRestrictedUser(
    userId: string,
    restrictedUserId: string
  ): Promise<UserRestriction | null> {
    try {
      const q = query(
        collection(this.firestore, this.collection),
        where("userId", "==", userId),
        where("restrictedUserId", "==", restrictedUserId)
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return null;
      }

      return this.mapDocumentToUserRestriction(querySnapshot.docs[0]);
    } catch (error) {
      console.error(
        "❌ Error getting user restriction by user and restricted user:",
        error
      );
      throw new Error(
        `Failed to get user restriction: ${getErrorMessage(error)}`
      );
    }
  }

  async isUserRestricted(
    userId: string,
    restrictedUserId: string
  ): Promise<boolean> {
    try {
      const restriction = await this.getByUserAndRestrictedUser(
        userId,
        restrictedUserId
      );
      return restriction !== null;
    } catch (error) {
      console.error("❌ Error checking if user is restricted:", error);
      throw new Error(
        `Failed to check if user is restricted: ${getErrorMessage(error)}`
      );
    }
  }
}
