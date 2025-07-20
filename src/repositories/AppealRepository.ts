import { Appeal } from "../types";

/**
 * Repository interface for Appeal data access operations
 * Defines the contract for appeal-related database operations
 */
export interface AppealRepository {
  /**
   * Get all appeals
   */
  getAll(): Promise<Appeal[]>;

  /**
   * Get appeal by ID
   */
  getById(id: string): Promise<Appeal | null>;

  /**
   * Save a new appeal
   */
  save(appeal: Appeal): Promise<void>;

  /**
   * Update an existing appeal
   */
  update(id: string, updates: Partial<Appeal>): Promise<void>;

  /**
   * Get appeals by user ID
   */
  getByUser(userId: string): Promise<Appeal[]>;

  /**
   * Get pending appeals for moderation
   */
  getPending(): Promise<Appeal[]>;

  /**
   * Get appeals by violation ID
   */
  getByViolation(violationId: string): Promise<Appeal[]>;
}
