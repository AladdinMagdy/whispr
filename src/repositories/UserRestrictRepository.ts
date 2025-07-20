/**
 * UserRestrict Repository Interface
 * Defines the contract for user restriction data access operations
 */

import { UserRestriction } from "../types";

export interface UserRestrictRepository {
  /**
   * Get all user restrictions
   */
  getAll(): Promise<UserRestriction[]>;

  /**
   * Get user restriction by ID
   */
  getById(id: string): Promise<UserRestriction | null>;

  /**
   * Save a new user restriction
   */
  save(restriction: UserRestriction): Promise<void>;

  /**
   * Update an existing user restriction
   */
  update(id: string, updates: Partial<UserRestriction>): Promise<void>;

  /**
   * Delete a user restriction
   */
  delete(id: string): Promise<void>;

  /**
   * Get restrictions created by a specific user
   */
  getByUser(userId: string): Promise<UserRestriction[]>;

  /**
   * Get restrictions where a user is the target (restricted by others)
   */
  getByRestrictedUser(restrictedUserId: string): Promise<UserRestriction[]>;

  /**
   * Get a specific restriction between two users
   */
  getByUserAndRestrictedUser(
    userId: string,
    restrictedUserId: string
  ): Promise<UserRestriction | null>;

  /**
   * Check if a user has restricted another user
   */
  isUserRestricted(userId: string, restrictedUserId: string): Promise<boolean>;
}
