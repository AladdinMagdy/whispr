import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  QueryDocumentSnapshot,
  DocumentData,
} from "firebase/firestore";
import { getFirestoreInstance } from "../config/firebase";
import { ReputationRepository } from "./ReputationRepository";
import { UserReputation, UserViolation } from "../types";

export class FirebaseReputationRepository implements ReputationRepository {
  private firestore = getFirestoreInstance();
  private collectionName = "userReputations";
  private violationsCollectionName = "userViolations";

  async save(reputation: UserReputation): Promise<void> {
    try {
      const docRef = doc(
        this.firestore,
        this.collectionName,
        reputation.userId
      );
      const reputationData = {
        ...reputation,
        createdAt: Timestamp.fromDate(reputation.createdAt),
        updatedAt: Timestamp.fromDate(reputation.updatedAt),
        lastViolation: reputation.lastViolation
          ? Timestamp.fromDate(reputation.lastViolation)
          : null,
        violationHistory: reputation.violationHistory.map((violation) => ({
          ...violation,
          timestamp: Timestamp.fromDate(violation.timestamp),
        })),
      };
      await updateDoc(docRef, reputationData);
    } catch (error) {
      console.error("Error saving user reputation:", error);
      throw new Error(
        `Failed to save user reputation: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getById(userId: string): Promise<UserReputation | null> {
    try {
      const docRef = doc(this.firestore, this.collectionName, userId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      return this.mapFirestoreDocToReputation(docSnap);
    } catch (error) {
      console.error("Error getting user reputation by ID:", error);
      throw new Error(
        `Failed to get user reputation: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getAll(): Promise<UserReputation[]> {
    try {
      const q = query(
        collection(this.firestore, this.collectionName),
        orderBy("updatedAt", "desc")
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) =>
        this.mapFirestoreDocToReputation(doc)
      );
    } catch (error) {
      console.error("Error getting all user reputations:", error);
      throw new Error(
        `Failed to get user reputations: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async update(
    userId: string,
    updates: Partial<UserReputation>
  ): Promise<void> {
    try {
      const docRef = doc(this.firestore, this.collectionName, userId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateData: any = {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date()),
      };

      if (updates.lastViolation) {
        updateData.lastViolation = Timestamp.fromDate(updates.lastViolation);
      }

      if (updates.violationHistory) {
        updateData.violationHistory = updates.violationHistory.map(
          (violation) => ({
            ...violation,
            timestamp: Timestamp.fromDate(violation.timestamp),
          })
        );
      }

      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error("Error updating user reputation:", error);
      throw new Error(
        `Failed to update user reputation: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async delete(userId: string): Promise<void> {
    try {
      const docRef = doc(this.firestore, this.collectionName, userId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting user reputation:", error);
      throw new Error(
        `Failed to delete user reputation: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getByLevel(level: string): Promise<UserReputation[]> {
    try {
      const q = query(
        collection(this.firestore, this.collectionName),
        where("level", "==", level),
        orderBy("updatedAt", "desc")
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) =>
        this.mapFirestoreDocToReputation(doc)
      );
    } catch (error) {
      console.error("Error getting user reputations by level:", error);
      throw new Error(
        `Failed to get user reputations by level: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getByScoreRange(
    minScore: number,
    maxScore: number
  ): Promise<UserReputation[]> {
    try {
      const q = query(
        collection(this.firestore, this.collectionName),
        where("score", ">=", minScore),
        where("score", "<=", maxScore),
        orderBy("score", "desc")
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) =>
        this.mapFirestoreDocToReputation(doc)
      );
    } catch (error) {
      console.error("Error getting user reputations by score range:", error);
      throw new Error(
        `Failed to get user reputations by score range: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getWithRecentViolations(
    daysBack: number,
    limitCount: number
  ): Promise<UserReputation[]> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);

      const q = query(
        collection(this.firestore, this.collectionName),
        where("lastViolation", ">=", Timestamp.fromDate(cutoffDate)),
        orderBy("lastViolation", "desc"),
        limit(limitCount)
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) =>
        this.mapFirestoreDocToReputation(doc)
      );
    } catch (error) {
      console.error("Error getting users with recent violations:", error);
      throw new Error(
        `Failed to get users with recent violations: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getByViolationCount(minViolations: number): Promise<UserReputation[]> {
    try {
      const q = query(
        collection(this.firestore, this.collectionName),
        where("flaggedWhispers", ">=", minViolations),
        orderBy("flaggedWhispers", "desc")
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) =>
        this.mapFirestoreDocToReputation(doc)
      );
    } catch (error) {
      console.error("Error getting users by violation count:", error);
      throw new Error(
        `Failed to get users by violation count: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getStats(): Promise<{
    totalUsers: number;
    trustedUsers: number;
    verifiedUsers: number;
    standardUsers: number;
    flaggedUsers: number;
    bannedUsers: number;
    averageScore: number;
  }> {
    try {
      const allReputations = await this.getAll();

      const stats = {
        totalUsers: allReputations.length,
        trustedUsers: allReputations.filter((r) => r.level === "trusted")
          .length,
        verifiedUsers: allReputations.filter((r) => r.level === "verified")
          .length,
        standardUsers: allReputations.filter((r) => r.level === "standard")
          .length,
        flaggedUsers: allReputations.filter((r) => r.level === "flagged")
          .length,
        bannedUsers: allReputations.filter((r) => r.level === "banned").length,
        averageScore:
          allReputations.length > 0
            ? allReputations.reduce((sum, r) => sum + r.score, 0) /
              allReputations.length
            : 0,
      };

      return stats;
    } catch (error) {
      console.error("Error getting reputation stats:", error);
      throw new Error(
        `Failed to get reputation stats: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async saveViolation(violation: UserViolation): Promise<void> {
    try {
      const docRef = doc(
        this.firestore,
        this.violationsCollectionName,
        violation.id
      );
      const violationData = {
        ...violation,
        createdAt: Timestamp.fromDate(violation.createdAt),
        expiresAt: violation.expiresAt
          ? Timestamp.fromDate(violation.expiresAt)
          : null,
      };
      await updateDoc(docRef, violationData);
    } catch (error) {
      console.error("Error saving user violation:", error);
      throw new Error(
        `Failed to save user violation: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getViolations(
    userId: string,
    daysBack: number
  ): Promise<UserViolation[]> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);

      const q = query(
        collection(this.firestore, this.violationsCollectionName),
        where("userId", "==", userId),
        where("createdAt", ">=", Timestamp.fromDate(cutoffDate)),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) =>
        this.mapFirestoreDocToViolation(doc)
      );
    } catch (error) {
      console.error("Error getting user violations:", error);
      throw new Error(
        `Failed to get user violations: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getDeletedWhisperCount(
    userId: string,
    daysBack: number
  ): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);

      const q = query(
        collection(this.firestore, this.violationsCollectionName),
        where("userId", "==", userId),
        where("violationType", "==", "whisper_deleted"),
        where("createdAt", ">=", Timestamp.fromDate(cutoffDate))
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.size;
    } catch (error) {
      console.error("Error getting deleted whisper count:", error);
      throw new Error(
        `Failed to get deleted whisper count: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  private mapFirestoreDocToReputation(
    doc: QueryDocumentSnapshot<DocumentData>
  ): UserReputation {
    const data = doc.data();
    return {
      userId: doc.id,
      score: data.score,
      level: data.level,
      totalWhispers: data.totalWhispers,
      approvedWhispers: data.approvedWhispers,
      flaggedWhispers: data.flaggedWhispers,
      rejectedWhispers: data.rejectedWhispers,
      lastViolation:
        data.lastViolation instanceof Timestamp
          ? data.lastViolation.toDate()
          : data.lastViolation,
      violationHistory:
        data.violationHistory?.map((violation: Record<string, unknown>) => ({
          ...violation,
          timestamp:
            violation.timestamp instanceof Timestamp
              ? violation.timestamp.toDate()
              : violation.timestamp,
        })) || [],
      createdAt:
        data.createdAt instanceof Timestamp
          ? data.createdAt.toDate()
          : data.createdAt,
      updatedAt:
        data.updatedAt instanceof Timestamp
          ? data.updatedAt.toDate()
          : data.updatedAt,
    };
  }

  private mapFirestoreDocToViolation(
    doc: QueryDocumentSnapshot<DocumentData>
  ): UserViolation {
    const data = doc.data();
    return {
      id: doc.id,
      userId: data.userId,
      whisperId: data.whisperId,
      violationType: data.violationType,
      reason: data.reason,
      reportCount: data.reportCount,
      moderatorId: data.moderatorId,
      createdAt:
        data.createdAt instanceof Timestamp
          ? data.createdAt.toDate()
          : data.createdAt,
      expiresAt:
        data.expiresAt instanceof Timestamp
          ? data.expiresAt.toDate()
          : data.expiresAt,
    };
  }
}
