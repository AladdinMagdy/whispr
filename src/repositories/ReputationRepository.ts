import { UserReputation, UserViolation } from "../types";

export interface ReputationRepository {
  // Basic CRUD operations
  save(reputation: UserReputation): Promise<void>;
  getById(userId: string): Promise<UserReputation | null>;
  getAll(): Promise<UserReputation[]>;
  update(userId: string, updates: Partial<UserReputation>): Promise<void>;
  delete(userId: string): Promise<void>;

  // Query methods
  getByLevel(level: string): Promise<UserReputation[]>;
  getByScoreRange(
    minScore: number,
    maxScore: number
  ): Promise<UserReputation[]>;
  getWithRecentViolations(
    daysBack: number,
    limit: number
  ): Promise<UserReputation[]>;
  getByViolationCount(minViolations: number): Promise<UserReputation[]>;

  // Statistics
  getStats(): Promise<{
    totalUsers: number;
    trustedUsers: number;
    verifiedUsers: number;
    standardUsers: number;
    flaggedUsers: number;
    bannedUsers: number;
    averageScore: number;
  }>;

  // Violation methods
  saveViolation(violation: UserViolation): Promise<void>;
  getViolations(userId: string, daysBack: number): Promise<UserViolation[]>;
  getDeletedWhisperCount(userId: string, daysBack: number): Promise<number>;
}
