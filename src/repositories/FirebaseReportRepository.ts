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
  Timestamp,
  QueryDocumentSnapshot,
  DocumentData,
} from "firebase/firestore";
import { getFirestoreInstance } from "../config/firebase";
import { ReportRepository } from "./ReportRepository";
import {
  Report,
  ReportFilters,
  ReportStats,
  ReportCategory,
  ReportPriority,
  ReportStatus,
  CommentReport,
} from "../types";

export class FirebaseReportRepository implements ReportRepository {
  private firestore = getFirestoreInstance();
  private collectionName = "reports";

  async save(report: Report): Promise<void> {
    try {
      const docRef = doc(this.firestore, this.collectionName, report.id);
      const reportData = {
        ...report,
        createdAt: Timestamp.fromDate(report.createdAt),
        updatedAt: Timestamp.fromDate(report.updatedAt),
        reviewedAt: report.reviewedAt
          ? Timestamp.fromDate(report.reviewedAt)
          : null,
        resolution: report.resolution
          ? {
              ...report.resolution,
              timestamp: Timestamp.fromDate(report.resolution.timestamp),
            }
          : null,
      };
      await updateDoc(docRef, reportData);
    } catch (error) {
      console.error("Error saving report:", error);
      throw new Error(
        `Failed to save report: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getById(id: string): Promise<Report | null> {
    try {
      const docRef = doc(this.firestore, this.collectionName, id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      return this.mapFirestoreDocToReport(docSnap);
    } catch (error) {
      console.error("Error getting report by ID:", error);
      throw new Error(
        `Failed to get report: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getAll(): Promise<Report[]> {
    try {
      const q = query(
        collection(this.firestore, this.collectionName),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) => this.mapFirestoreDocToReport(doc));
    } catch (error) {
      console.error("Error getting all reports:", error);
      throw new Error(
        `Failed to get reports: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async update(id: string, updates: Partial<Report>): Promise<void> {
    try {
      const docRef = doc(this.firestore, this.collectionName, id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateData: any = {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date()),
      };

      if (updates.reviewedAt) {
        updateData.reviewedAt = Timestamp.fromDate(updates.reviewedAt);
      }

      if (updates.resolution) {
        updateData.resolution = {
          ...updates.resolution,
          timestamp: Timestamp.fromDate(updates.resolution.timestamp),
        };
      }

      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error("Error updating report:", error);
      throw new Error(
        `Failed to update report: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const docRef = doc(this.firestore, this.collectionName, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting report:", error);
      throw new Error(
        `Failed to delete report: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getByWhisper(whisperId: string): Promise<Report[]> {
    try {
      const q = query(
        collection(this.firestore, this.collectionName),
        where("whisperId", "==", whisperId),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) => this.mapFirestoreDocToReport(doc));
    } catch (error) {
      console.error("Error getting reports by whisper:", error);
      throw new Error(
        `Failed to get reports by whisper: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getByReporter(reporterId: string): Promise<Report[]> {
    try {
      const q = query(
        collection(this.firestore, this.collectionName),
        where("reporterId", "==", reporterId),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) => this.mapFirestoreDocToReport(doc));
    } catch (error) {
      console.error("Error getting reports by reporter:", error);
      throw new Error(
        `Failed to get reports by reporter: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getByStatus(status: string): Promise<Report[]> {
    try {
      const q = query(
        collection(this.firestore, this.collectionName),
        where("status", "==", status),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) => this.mapFirestoreDocToReport(doc));
    } catch (error) {
      console.error("Error getting reports by status:", error);
      throw new Error(
        `Failed to get reports by status: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getByCategory(category: string): Promise<Report[]> {
    try {
      const q = query(
        collection(this.firestore, this.collectionName),
        where("category", "==", category),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) => this.mapFirestoreDocToReport(doc));
    } catch (error) {
      console.error("Error getting reports by category:", error);
      throw new Error(
        `Failed to get reports by category: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getByPriority(priority: string): Promise<Report[]> {
    try {
      const q = query(
        collection(this.firestore, this.collectionName),
        where("priority", "==", priority),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) => this.mapFirestoreDocToReport(doc));
    } catch (error) {
      console.error("Error getting reports by priority:", error);
      throw new Error(
        `Failed to get reports by priority: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getByDateRange(startDate: Date, endDate: Date): Promise<Report[]> {
    try {
      const q = query(
        collection(this.firestore, this.collectionName),
        where("createdAt", ">=", Timestamp.fromDate(startDate)),
        where("createdAt", "<=", Timestamp.fromDate(endDate)),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) => this.mapFirestoreDocToReport(doc));
    } catch (error) {
      console.error("Error getting reports by date range:", error);
      throw new Error(
        `Failed to get reports by date range: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getWithFilters(filters: ReportFilters): Promise<Report[]> {
    try {
      let q = query(collection(this.firestore, this.collectionName));

      if (filters.status) {
        q = query(q, where("status", "==", filters.status));
      }
      if (filters.category) {
        q = query(q, where("category", "==", filters.category));
      }
      if (filters.priority) {
        q = query(q, where("priority", "==", filters.priority));
      }
      if (filters.reporterId) {
        q = query(q, where("reporterId", "==", filters.reporterId));
      }
      if (filters.whisperId) {
        q = query(q, where("whisperId", "==", filters.whisperId));
      }
      if (filters.dateRange) {
        q = query(
          q,
          where("createdAt", ">=", Timestamp.fromDate(filters.dateRange.start)),
          where("createdAt", "<=", Timestamp.fromDate(filters.dateRange.end))
        );
      }

      q = query(q, orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) => this.mapFirestoreDocToReport(doc));
    } catch (error) {
      console.error("Error getting reports with filters:", error);
      throw new Error(
        `Failed to get reports with filters: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getPending(): Promise<Report[]> {
    return this.getByStatus(ReportStatus.PENDING);
  }

  async getCritical(): Promise<Report[]> {
    return this.getByPriority(ReportPriority.CRITICAL);
  }

  async getStats(): Promise<ReportStats> {
    try {
      const allReports = await this.getAll();

      const reportsByCategory: Record<ReportCategory, number> = {
        [ReportCategory.HARASSMENT]: 0,
        [ReportCategory.HATE_SPEECH]: 0,
        [ReportCategory.VIOLENCE]: 0,
        [ReportCategory.SEXUAL_CONTENT]: 0,
        [ReportCategory.SPAM]: 0,
        [ReportCategory.SCAM]: 0,
        [ReportCategory.COPYRIGHT]: 0,
        [ReportCategory.PERSONAL_INFO]: 0,
        [ReportCategory.MINOR_SAFETY]: 0,
        [ReportCategory.OTHER]: 0,
      };

      const reportsByPriority: Record<ReportPriority, number> = {
        [ReportPriority.LOW]: 0,
        [ReportPriority.MEDIUM]: 0,
        [ReportPriority.HIGH]: 0,
        [ReportPriority.CRITICAL]: 0,
      };

      let totalResolutionTime = 0;
      let resolvedCount = 0;

      allReports.forEach((report) => {
        reportsByCategory[report.category]++;
        reportsByPriority[report.priority]++;

        if (report.status === ReportStatus.RESOLVED && report.reviewedAt) {
          const resolutionTime =
            report.reviewedAt.getTime() - report.createdAt.getTime();
          totalResolutionTime += resolutionTime;
          resolvedCount++;
        }
      });

      const averageResolutionTime =
        resolvedCount > 0
          ? totalResolutionTime / resolvedCount / (1000 * 60 * 60) // Convert to hours
          : 0;

      return {
        totalReports: allReports.length,
        pendingReports: allReports.filter(
          (r) => r.status === ReportStatus.PENDING
        ).length,
        criticalReports: allReports.filter(
          (r) => r.priority === ReportPriority.CRITICAL
        ).length,
        resolvedReports: allReports.filter(
          (r) => r.status === ReportStatus.RESOLVED
        ).length,
        averageResolutionTime,
        reportsByCategory,
        reportsByPriority,
      };
    } catch (error) {
      console.error("Error getting report stats:", error);
      throw new Error(
        `Failed to get report stats: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getWhisperStats(whisperId: string): Promise<{
    totalReports: number;
    uniqueReporters: number;
    categories: Record<string, number>;
    priorityBreakdown: Record<string, number>;
  }> {
    try {
      const reports = await this.getByWhisper(whisperId);
      const uniqueReporters = new Set(reports.map((r) => r.reporterId)).size;

      const categories: Record<string, number> = {
        [ReportCategory.HARASSMENT]: 0,
        [ReportCategory.HATE_SPEECH]: 0,
        [ReportCategory.VIOLENCE]: 0,
        [ReportCategory.SEXUAL_CONTENT]: 0,
        [ReportCategory.SPAM]: 0,
        [ReportCategory.SCAM]: 0,
        [ReportCategory.COPYRIGHT]: 0,
        [ReportCategory.PERSONAL_INFO]: 0,
        [ReportCategory.MINOR_SAFETY]: 0,
        [ReportCategory.OTHER]: 0,
      };

      const priorityBreakdown: Record<string, number> = {
        [ReportPriority.LOW]: 0,
        [ReportPriority.MEDIUM]: 0,
        [ReportPriority.HIGH]: 0,
        [ReportPriority.CRITICAL]: 0,
      };

      reports.forEach((report) => {
        categories[report.category]++;
        priorityBreakdown[report.priority]++;
      });

      return {
        totalReports: reports.length,
        uniqueReporters,
        categories,
        priorityBreakdown,
      };
    } catch (error) {
      console.error("Error getting whisper report stats:", error);
      throw new Error(
        `Failed to get whisper report stats: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // Comment Report methods
  async saveCommentReport(report: CommentReport): Promise<void> {
    try {
      const docRef = doc(this.firestore, this.collectionName, report.id);
      const reportData = {
        ...report,
        createdAt: Timestamp.fromDate(report.createdAt),
        updatedAt: Timestamp.fromDate(report.updatedAt),
        reviewedAt: report.reviewedAt
          ? Timestamp.fromDate(report.reviewedAt)
          : null,
      };
      await updateDoc(docRef, reportData);
    } catch (error) {
      console.error("Error saving comment report:", error);
      throw new Error(
        `Failed to save comment report: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getCommentReport(reportId: string): Promise<CommentReport | null> {
    try {
      const docRef = doc(this.firestore, this.collectionName, reportId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      return this.mapFirestoreDocToCommentReport(docSnap);
    } catch (error) {
      console.error("Error getting comment report by ID:", error);
      throw new Error(
        `Failed to get comment report: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getCommentReports(filters: ReportFilters): Promise<CommentReport[]> {
    try {
      let q = query(collection(this.firestore, this.collectionName));

      if (filters.status) {
        q = query(q, where("status", "==", filters.status));
      }
      if (filters.category) {
        q = query(q, where("category", "==", filters.category));
      }
      if (filters.priority) {
        q = query(q, where("priority", "==", filters.priority));
      }
      if (filters.reporterId) {
        q = query(q, where("reporterId", "==", filters.reporterId));
      }
      if (filters.commentId) {
        q = query(q, where("commentId", "==", filters.commentId));
      }
      if (filters.dateRange) {
        q = query(
          q,
          where("createdAt", ">=", Timestamp.fromDate(filters.dateRange.start)),
          where("createdAt", "<=", Timestamp.fromDate(filters.dateRange.end))
        );
      }

      q = query(q, orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) =>
        this.mapFirestoreDocToCommentReport(doc)
      );
    } catch (error) {
      console.error("Error getting comment reports with filters:", error);
      throw new Error(
        `Failed to get comment reports with filters: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async updateCommentReport(
    reportId: string,
    updates: Partial<CommentReport>
  ): Promise<void> {
    try {
      const docRef = doc(this.firestore, this.collectionName, reportId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateData: any = {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date()),
      };

      if (updates.reviewedAt) {
        updateData.reviewedAt = Timestamp.fromDate(updates.reviewedAt);
      }

      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error("Error updating comment report:", error);
      throw new Error(
        `Failed to update comment report: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async updateCommentReportStatus(
    reportId: string,
    status: string,
    moderatorId?: string
  ): Promise<void> {
    try {
      const docRef = doc(this.firestore, this.collectionName, reportId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateData: any = {
        status,
        updatedAt: Timestamp.fromDate(new Date()),
      };

      if (moderatorId) {
        updateData.moderatorId = moderatorId;
      }

      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error("Error updating comment report status:", error);
      throw new Error(
        `Failed to update comment report status: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async hasUserReportedComment(
    commentId: string,
    userId: string
  ): Promise<boolean> {
    try {
      const q = query(
        collection(this.firestore, this.collectionName),
        where("commentId", "==", commentId),
        where("reporterId", "==", userId)
      );
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (error) {
      console.error("Error checking if user reported comment:", error);
      throw new Error(
        `Failed to check if user reported comment: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getCommentReportStats(commentId: string): Promise<{
    totalReports: number;
    uniqueReporters: number;
    categories: Record<string, number>;
    priorityBreakdown: Record<string, number>;
  }> {
    try {
      const reports = await this.getCommentReports({ commentId });
      const uniqueReporters = new Set(reports.map((r) => r.reporterId)).size;

      const categories: Record<string, number> = {
        [ReportCategory.HARASSMENT]: 0,
        [ReportCategory.HATE_SPEECH]: 0,
        [ReportCategory.VIOLENCE]: 0,
        [ReportCategory.SEXUAL_CONTENT]: 0,
        [ReportCategory.SPAM]: 0,
        [ReportCategory.SCAM]: 0,
        [ReportCategory.COPYRIGHT]: 0,
        [ReportCategory.PERSONAL_INFO]: 0,
        [ReportCategory.MINOR_SAFETY]: 0,
        [ReportCategory.OTHER]: 0,
      };

      const priorityBreakdown: Record<string, number> = {
        [ReportPriority.LOW]: 0,
        [ReportPriority.MEDIUM]: 0,
        [ReportPriority.HIGH]: 0,
        [ReportPriority.CRITICAL]: 0,
      };

      reports.forEach((report) => {
        categories[report.category]++;
        priorityBreakdown[report.priority]++;
      });

      return {
        totalReports: reports.length,
        uniqueReporters,
        categories,
        priorityBreakdown,
      };
    } catch (error) {
      console.error("Error getting comment report stats:", error);
      throw new Error(
        `Failed to get comment report stats: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  private mapFirestoreDocToReport(
    doc: QueryDocumentSnapshot<DocumentData>
  ): Report {
    const data = doc.data();
    return {
      id: doc.id,
      whisperId: data.whisperId,
      commentId: data.commentId,
      reporterId: data.reporterId,
      reporterDisplayName: data.reporterDisplayName,
      reporterReputation: data.reporterReputation,
      category: data.category,
      priority: data.priority,
      status: data.status,
      reason: data.reason,
      evidence: data.evidence,
      createdAt:
        data.createdAt instanceof Timestamp
          ? data.createdAt.toDate()
          : data.createdAt,
      updatedAt:
        data.updatedAt instanceof Timestamp
          ? data.updatedAt.toDate()
          : data.updatedAt,
      reviewedAt:
        data.reviewedAt instanceof Timestamp
          ? data.reviewedAt.toDate()
          : data.reviewedAt,
      reviewedBy: data.reviewedBy,
      resolution: data.resolution
        ? {
            ...data.resolution,
            timestamp:
              data.resolution.timestamp instanceof Timestamp
                ? data.resolution.timestamp.toDate()
                : data.resolution.timestamp,
          }
        : undefined,
      reputationWeight: data.reputationWeight,
    };
  }

  private mapFirestoreDocToCommentReport(
    doc: QueryDocumentSnapshot<DocumentData>
  ): CommentReport {
    const data = doc.data();
    return {
      id: doc.id,
      commentId: data.commentId,
      whisperId: data.whisperId,
      reporterId: data.reporterId,
      reporterDisplayName: data.reporterDisplayName,
      reporterReputation: data.reporterReputation,
      category: data.category,
      priority: data.priority,
      status: data.status,
      reason: data.reason,
      evidence: data.evidence,
      createdAt:
        data.createdAt instanceof Timestamp
          ? data.createdAt.toDate()
          : data.createdAt,
      updatedAt:
        data.updatedAt instanceof Timestamp
          ? data.updatedAt.toDate()
          : data.updatedAt,
      reviewedAt:
        data.reviewedAt instanceof Timestamp
          ? data.reviewedAt.toDate()
          : data.reviewedAt,
      reviewedBy: data.reviewedBy,
      resolution: data.resolution
        ? {
            ...data.resolution,
            timestamp:
              data.resolution.timestamp instanceof Timestamp
                ? data.resolution.timestamp.toDate()
                : data.resolution.timestamp,
          }
        : undefined,
      reputationWeight: data.reputationWeight,
    };
  }
}
