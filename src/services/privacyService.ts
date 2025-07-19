import { getFirestoreInstance } from "../config/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  setDoc,
  doc,
  Timestamp,
  orderBy,
  QueryDocumentSnapshot,
  DocumentData,
} from "firebase/firestore";
import { getFirestoreService, FirestoreService } from "./firestoreService";
import { getUserBlockService, UserBlockService } from "./userBlockService";
import { Like, UserViolation } from "../types";
import type { Firestore } from "firebase/firestore";

export interface PrivacyFilteredLikesResult {
  likes: Like[];
  hasMore: boolean;
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
}

export interface UserViolationStats {
  totalViolations: number;
  deletedWhispers: number;
  flaggedWhispers: number;
  temporaryBans: number;
  extendedBans: number;
  recentViolations: number; // Last 30 days
}

export interface PrivacyStats {
  permanentlyBannedUsers: number;
  totalUserViolations: number;
  averageViolationsPerUser: number;
}

export class PrivacyService {
  private static instance: PrivacyService | null;
  private firestore: Firestore;
  private firestoreService: FirestoreService;
  private userBlockService: UserBlockService;

  // Allow dependency injection for testability
  constructor(
    firestore?: Firestore,
    firestoreService?: FirestoreService,
    userBlockService?: UserBlockService
  ) {
    this.firestore = firestore || getFirestoreInstance();
    this.firestoreService = firestoreService || getFirestoreService();
    this.userBlockService = userBlockService || getUserBlockService();
  }

  static getInstance(): PrivacyService {
    if (!PrivacyService.instance) {
      PrivacyService.instance = new PrivacyService();
    }
    return PrivacyService.instance;
  }

  // ===== PRIVACY-FILTERED LIKES =====

  /**
   * Get whisper likes with privacy filtering for blocked users
   * Extracted from FirestoreService.getWhisperLikesWithPrivacy
   */
  async getWhisperLikesWithPrivacy(
    whisperId: string,
    currentUserId: string,
    limit: number = 50,
    lastDoc?: QueryDocumentSnapshot<DocumentData>
  ): Promise<PrivacyFilteredLikesResult> {
    try {
      // Get the likes
      const result = await this.firestoreService.getWhisperLikes(
        whisperId,
        limit,
        lastDoc
      );

      // Get block lists for privacy filtering
      const [blockedUsers, usersWhoBlockedMe] = await Promise.all([
        this.userBlockService.getBlockedUsers(currentUserId),
        this.userBlockService.getUsersWhoBlockedMe(currentUserId),
      ]);

      const blockedSet = new Set([
        ...blockedUsers.map((b) => b.blockedUserId),
        ...usersWhoBlockedMe.map((b) => b.userId),
      ]);

      // Filter and anonymize blocked users' likes
      const filteredLikes = result.likes.map((like) => {
        if (blockedSet.has(like.userId)) {
          return {
            ...like,
            userDisplayName: "Anonymous",
            userProfileColor: "#9E9E9E", // Gray color for anonymous
          };
        }
        return like;
      });

      return {
        likes: filteredLikes,
        hasMore: result.hasMore,
        lastDoc: result.lastDoc,
      };
    } catch (error) {
      console.error("❌ Error getting whisper likes with privacy:", error);
      throw new Error(
        `Failed to get whisper likes with privacy: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // ===== PERMANENTLY BANNED USERS =====

  /**
   * Get all userIds of users with active permanent bans (banType: CONTENT_HIDDEN)
   * Extracted from FirestoreService.getPermanentlyBannedUserIds
   */
  async getPermanentlyBannedUserIds(): Promise<string[]> {
    try {
      const q = query(
        collection(this.firestore, "suspensions"),
        where("isActive", "==", true),
        where("type", "==", "permanent"),
        where("banType", "==", "content_hidden")
      );
      const querySnapshot = await getDocs(q);
      const userIds = new Set<string>();
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.userId) userIds.add(data.userId);
      });
      return Array.from(userIds);
    } catch (error) {
      console.error("❌ Error fetching permanently banned userIds:", error);
      return [];
    }
  }

  /**
   * Check if a user is permanently banned
   */
  async isUserPermanentlyBanned(userId: string): Promise<boolean> {
    try {
      const bannedUserIds = await this.getPermanentlyBannedUserIds();
      return bannedUserIds.includes(userId);
    } catch (error) {
      console.error("❌ Error checking if user is permanently banned:", error);
      return false;
    }
  }

  // ===== USER VIOLATIONS =====

  /**
   * Save a user violation for escalation tracking
   * Extracted from FirestoreService.saveUserViolation
   */
  async saveUserViolation(violation: UserViolation): Promise<void> {
    try {
      const violationData: Record<string, unknown> = {
        id: violation.id,
        userId: violation.userId,
        whisperId: violation.whisperId,
        violationType: violation.violationType,
        reason: violation.reason,
        reportCount: violation.reportCount,
        moderatorId: violation.moderatorId || "system",
        createdAt: Timestamp.fromDate(violation.createdAt),
      };

      if (violation.expiresAt) {
        violationData.expiresAt = Timestamp.fromDate(violation.expiresAt);
      }

      await setDoc(
        doc(this.firestore, "userViolations", violation.id),
        violationData
      );
      console.log("✅ User violation saved successfully:", violation.id);
    } catch (error) {
      console.error("❌ Error saving user violation:", error);
      throw new Error(
        `Failed to save user violation: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get user violations within a specified time period
   * Extracted from FirestoreService.getUserViolations
   */
  async getUserViolations(
    userId: string,
    daysBack: number = 90
  ): Promise<UserViolation[]> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);

      const q = query(
        collection(this.firestore, "userViolations"),
        where("userId", "==", userId),
        where("createdAt", ">=", Timestamp.fromDate(cutoffDate)),
        orderBy("createdAt", "desc")
      );

      const querySnapshot = await getDocs(q);
      const violations: UserViolation[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        violations.push({
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          expiresAt: data.expiresAt?.toDate(),
        } as UserViolation);
      });

      return violations;
    } catch (error) {
      console.error("❌ Error getting user violations:", error);
      return [];
    }
  }

  /**
   * Get count of deleted whispers for a user
   * Extracted from FirestoreService.getDeletedWhisperCount
   */
  async getDeletedWhisperCount(
    userId: string,
    daysBack: number = 90
  ): Promise<number> {
    try {
      const violations = await this.getUserViolations(userId, daysBack);
      return violations.filter((v) => v.violationType === "whisper_deleted")
        .length;
    } catch (error) {
      console.error("❌ Error getting deleted whisper count:", error);
      return 0;
    }
  }

  /**
   * Get comprehensive violation statistics for a user
   */
  async getUserViolationStats(userId: string): Promise<UserViolationStats> {
    try {
      const violations = await this.getUserViolations(userId, 90);
      const recentViolations = violations.filter(
        (v) =>
          v.createdAt.getTime() >
          new Date().getTime() - 30 * 24 * 60 * 60 * 1000
      );

      return {
        totalViolations: violations.length,
        deletedWhispers: violations.filter(
          (v) => v.violationType === "whisper_deleted"
        ).length,
        flaggedWhispers: violations.filter(
          (v) => v.violationType === "whisper_flagged"
        ).length,
        temporaryBans: violations.filter(
          (v) => v.violationType === "temporary_ban"
        ).length,
        extendedBans: violations.filter(
          (v) => v.violationType === "extended_ban"
        ).length,
        recentViolations: recentViolations.length,
      };
    } catch (error) {
      console.error("❌ Error getting user violation stats:", error);
      return {
        totalViolations: 0,
        deletedWhispers: 0,
        flaggedWhispers: 0,
        temporaryBans: 0,
        extendedBans: 0,
        recentViolations: 0,
      };
    }
  }

  /**
   * Get privacy statistics across the platform
   */
  async getPrivacyStats(): Promise<PrivacyStats> {
    try {
      const [bannedUserIds, allViolations] = await Promise.all([
        this.getPermanentlyBannedUserIds(),
        this.getAllUserViolations(),
      ]);

      const totalViolations = allViolations.length;
      const uniqueUsers = new Set(allViolations.map((v) => v.userId)).size;

      return {
        permanentlyBannedUsers: bannedUserIds.length,
        totalUserViolations: totalViolations,
        averageViolationsPerUser:
          uniqueUsers > 0 ? totalViolations / uniqueUsers : 0,
      };
    } catch (error) {
      console.error("❌ Error getting privacy stats:", error);
      return {
        permanentlyBannedUsers: 0,
        totalUserViolations: 0,
        averageViolationsPerUser: 0,
      };
    }
  }

  /**
   * Get all user violations (admin function)
   */
  private async getAllUserViolations(): Promise<UserViolation[]> {
    try {
      const q = query(
        collection(this.firestore, "userViolations"),
        orderBy("createdAt", "desc")
      );

      const querySnapshot = await getDocs(q);
      const violations: UserViolation[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        violations.push({
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          expiresAt: data.expiresAt?.toDate(),
        } as UserViolation);
      });

      return violations;
    } catch (error) {
      console.error("❌ Error getting all user violations:", error);
      return [];
    }
  }

  // ===== STATIC METHODS FOR RESET/DESTROY =====

  static resetInstance(): void {
    PrivacyService.instance = null;
  }

  static destroyInstance(): void {
    PrivacyService.instance = null;
  }
}

/**
 * Factory function to get PrivacyService instance
 */
export const getPrivacyService = (): PrivacyService => {
  return PrivacyService.getInstance();
};

/**
 * Reset the PrivacyService singleton instance
 */
export const resetPrivacyService = (): void => {
  PrivacyService.resetInstance();
};

/**
 * Destroy the PrivacyService singleton instance
 */
export const destroyPrivacyService = (): void => {
  PrivacyService.destroyInstance();
};
