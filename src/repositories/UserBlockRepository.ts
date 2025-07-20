/**
 * UserBlock Repository Interface
 * Defines the contract for user block data access operations
 */

import { UserBlock } from "../types";

export interface UserBlockRepository {
  /**
   * Get all user blocks
   */
  getAll(): Promise<UserBlock[]>;

  /**
   * Get user block by ID
   */
  getById(id: string): Promise<UserBlock | null>;

  /**
   * Save a new user block
   */
  save(block: UserBlock): Promise<void>;

  /**
   * Update an existing user block
   */
  update(id: string, updates: Partial<UserBlock>): Promise<void>;

  /**
   * Delete a user block
   */
  delete(id: string): Promise<void>;

  /**
   * Get blocks created by a specific user
   */
  getByUser(userId: string): Promise<UserBlock[]>;

  /**
   * Get blocks where a user is the target (blocked by others)
   */
  getByBlockedUser(blockedUserId: string): Promise<UserBlock[]>;

  /**
   * Get a specific block between two users
   */
  getByUserAndBlockedUser(
    userId: string,
    blockedUserId: string
  ): Promise<UserBlock | null>;

  /**
   * Check if a user has blocked another user
   */
  isUserBlocked(userId: string, blockedUserId: string): Promise<boolean>;
}
