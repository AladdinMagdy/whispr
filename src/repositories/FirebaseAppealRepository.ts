import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  UpdateData,
  DocumentSnapshot,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import { getFirestoreInstance } from "../config/firebase";
import { Appeal } from "../types";
import { AppealRepository } from "./AppealRepository";
import { getErrorMessage } from "../utils/errorHelpers";

/**
 * Firebase implementation of AppealRepository
 * Handles all appeal data access operations using Firebase Firestore
 */
export class FirebaseAppealRepository implements AppealRepository {
  private firestore = getFirestoreInstance();
  private collection = "appeals";

  /**
   * Helper function to map Firestore document to Appeal object
   */
  private mapDocumentToAppeal(
    doc: DocumentSnapshot | QueryDocumentSnapshot
  ): Appeal {
    const data = doc.data();
    if (!data) {
      throw new Error(`Document ${doc.id} has no data`);
    }
    return {
      id: doc.id,
      userId: data.userId,
      whisperId: data.whisperId,
      violationId: data.violationId,
      reason: data.reason,
      evidence: data.evidence,
      status: data.status,
      submittedAt: data.submittedAt?.toDate() || new Date(),
      reviewedAt: data.reviewedAt?.toDate(),
      reviewedBy: data.reviewedBy,
      resolution: data.resolution,
      resolutionReason: data.resolutionReason,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as Appeal;
  }

  async getAll(): Promise<Appeal[]> {
    try {
      const q = query(
        collection(this.firestore, this.collection),
        orderBy("submittedAt", "desc")
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) => this.mapDocumentToAppeal(doc));
    } catch (error) {
      console.error("❌ Error getting all appeals:", error);
      throw new Error(`Failed to get all appeals: ${getErrorMessage(error)}`);
    }
  }

  async getById(id: string): Promise<Appeal | null> {
    try {
      const docRef = doc(this.firestore, this.collection, id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      return this.mapDocumentToAppeal(docSnap);
    } catch (error) {
      console.error("❌ Error getting appeal by ID:", error);
      throw new Error(`Failed to get appeal: ${getErrorMessage(error)}`);
    }
  }

  async save(appeal: Appeal): Promise<void> {
    try {
      const appealData = {
        ...appeal,
        submittedAt: Timestamp.fromDate(appeal.submittedAt),
        reviewedAt: appeal.reviewedAt
          ? Timestamp.fromDate(appeal.reviewedAt)
          : null,
        createdAt: Timestamp.fromDate(appeal.createdAt),
        updatedAt: Timestamp.fromDate(appeal.updatedAt),
      };

      await setDoc(doc(this.firestore, this.collection, appeal.id), appealData);
      console.log("✅ Appeal saved successfully:", appeal.id);
    } catch (error) {
      console.error("❌ Error saving appeal:", error);
      throw new Error(`Failed to save appeal: ${getErrorMessage(error)}`);
    }
  }

  async update(id: string, updates: Partial<Appeal>): Promise<void> {
    try {
      const updateData: UpdateData<Appeal> = {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date()),
      };

      // Handle date fields
      if (updates.submittedAt) {
        updateData.submittedAt = Timestamp.fromDate(updates.submittedAt);
      }
      if (updates.reviewedAt) {
        updateData.reviewedAt = Timestamp.fromDate(updates.reviewedAt);
      }

      await updateDoc(doc(this.firestore, this.collection, id), updateData);
      console.log("✅ Appeal updated successfully:", id);
    } catch (error) {
      console.error("❌ Error updating appeal:", error);
      throw new Error(`Failed to update appeal: ${getErrorMessage(error)}`);
    }
  }

  async getByUser(userId: string): Promise<Appeal[]> {
    try {
      const q = query(
        collection(this.firestore, this.collection),
        where("userId", "==", userId),
        orderBy("submittedAt", "desc")
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) => this.mapDocumentToAppeal(doc));
    } catch (error) {
      console.error("❌ Error getting user appeals:", error);
      throw new Error(`Failed to get user appeals: ${getErrorMessage(error)}`);
    }
  }

  async getPending(): Promise<Appeal[]> {
    try {
      const q = query(
        collection(this.firestore, this.collection),
        where("status", "==", "pending"),
        orderBy("submittedAt", "asc")
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) => this.mapDocumentToAppeal(doc));
    } catch (error) {
      console.error("❌ Error getting pending appeals:", error);
      throw new Error(
        `Failed to get pending appeals: ${getErrorMessage(error)}`
      );
    }
  }

  async getByViolation(violationId: string): Promise<Appeal[]> {
    try {
      const q = query(
        collection(this.firestore, this.collection),
        where("violationId", "==", violationId),
        orderBy("submittedAt", "desc")
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) => this.mapDocumentToAppeal(doc));
    } catch (error) {
      console.error("❌ Error getting appeals by violation:", error);
      throw new Error(
        `Failed to get appeals by violation: ${getErrorMessage(error)}`
      );
    }
  }
}
