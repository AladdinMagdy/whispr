/**
 * Firebase Suspension Repository Implementation
 * Handles Firestore operations for user suspensions
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  DocumentData,
} from "firebase/firestore";
import { getFirestoreInstance } from "../config/firebase";
import { SuspensionRepository } from "./SuspensionRepository";
import { Suspension } from "../types";

export class FirebaseSuspensionRepository implements SuspensionRepository {
  private firestore = getFirestoreInstance();
  private collectionName = "suspensions";

  /**
   * Save a new suspension
   */
  async save(suspension: Suspension): Promise<void> {
    try {
      const docRef = doc(this.firestore, this.collectionName, suspension.id);
      const suspensionData = {
        ...suspension,
        startDate: Timestamp.fromDate(suspension.startDate),
        endDate: suspension.endDate
          ? Timestamp.fromDate(suspension.endDate)
          : null,
        createdAt: Timestamp.fromDate(suspension.createdAt),
        updatedAt: Timestamp.fromDate(suspension.updatedAt),
      };

      await updateDoc(docRef, suspensionData);
    } catch (error) {
      console.error("Error saving suspension:", error);
      throw new Error("Failed to save suspension");
    }
  }

  /**
   * Get suspension by ID
   */
  async getById(suspensionId: string): Promise<Suspension | null> {
    try {
      const docRef = doc(this.firestore, this.collectionName, suspensionId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      const data = docSnap.data();
      return this.mapFirestoreDocument(data);
    } catch (error) {
      console.error("Error getting suspension by ID:", error);
      throw new Error("Failed to get suspension");
    }
  }

  /**
   * Get all suspensions
   */
  async getAll(): Promise<Suspension[]> {
    try {
      const q = query(
        collection(this.firestore, this.collectionName),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) =>
        this.mapFirestoreDocument(doc.data())
      );
    } catch (error) {
      console.error("Error getting all suspensions:", error);
      throw new Error("Failed to get all suspensions");
    }
  }

  /**
   * Get suspensions by user ID
   */
  async getByUser(userId: string): Promise<Suspension[]> {
    try {
      const q = query(
        collection(this.firestore, this.collectionName),
        where("userId", "==", userId),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) =>
        this.mapFirestoreDocument(doc.data())
      );
    } catch (error) {
      console.error("Error getting user suspensions:", error);
      throw new Error("Failed to get user suspensions");
    }
  }

  /**
   * Get active suspensions
   */
  async getActive(): Promise<Suspension[]> {
    try {
      const q = query(
        collection(this.firestore, this.collectionName),
        where("isActive", "==", true),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) =>
        this.mapFirestoreDocument(doc.data())
      );
    } catch (error) {
      console.error("Error getting active suspensions:", error);
      throw new Error("Failed to get active suspensions");
    }
  }

  /**
   * Update a suspension
   */
  async update(
    suspensionId: string,
    updates: Partial<Suspension>
  ): Promise<void> {
    try {
      const docRef = doc(this.firestore, this.collectionName, suspensionId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateData: any = {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date()),
      };

      // Convert Date objects to Timestamps
      if (updates.startDate) {
        updateData.startDate = Timestamp.fromDate(updates.startDate);
      }
      if (updates.endDate) {
        updateData.endDate = Timestamp.fromDate(updates.endDate);
      }

      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error("Error updating suspension:", error);
      throw new Error("Failed to update suspension");
    }
  }

  /**
   * Delete a suspension
   */
  async delete(suspensionId: string): Promise<void> {
    try {
      const docRef = doc(this.firestore, this.collectionName, suspensionId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting suspension:", error);
      throw new Error("Failed to delete suspension");
    }
  }

  /**
   * Get suspensions by moderator ID
   */
  async getByModerator(moderatorId: string): Promise<Suspension[]> {
    try {
      const q = query(
        collection(this.firestore, this.collectionName),
        where("moderatorId", "==", moderatorId),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) =>
        this.mapFirestoreDocument(doc.data())
      );
    } catch (error) {
      console.error("Error getting suspensions by moderator:", error);
      throw new Error("Failed to get suspensions by moderator");
    }
  }

  /**
   * Get suspensions by type
   */
  async getByType(type: string): Promise<Suspension[]> {
    try {
      const q = query(
        collection(this.firestore, this.collectionName),
        where("type", "==", type),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) =>
        this.mapFirestoreDocument(doc.data())
      );
    } catch (error) {
      console.error("Error getting suspensions by type:", error);
      throw new Error("Failed to get suspensions by type");
    }
  }

  /**
   * Get suspensions created within a date range
   */
  async getByDateRange(startDate: Date, endDate: Date): Promise<Suspension[]> {
    try {
      const q = query(
        collection(this.firestore, this.collectionName),
        where("createdAt", ">=", Timestamp.fromDate(startDate)),
        where("createdAt", "<=", Timestamp.fromDate(endDate)),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) =>
        this.mapFirestoreDocument(doc.data())
      );
    } catch (error) {
      console.error("Error getting suspensions by date range:", error);
      throw new Error("Failed to get suspensions by date range");
    }
  }

  /**
   * Map Firestore document to Suspension object
   */
  private mapFirestoreDocument(data: DocumentData): Suspension {
    return {
      id: data.id,
      userId: data.userId,
      type: data.type,
      banType: data.banType,
      reason: data.reason,
      moderatorId: data.moderatorId,
      startDate: data.startDate?.toDate() || new Date(),
      endDate: data.endDate?.toDate() || undefined,
      isActive: data.isActive || false,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
  }
}
