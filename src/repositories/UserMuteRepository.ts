/**
 * UserMute Repository Interface
 * Defines the contract for user mute data access operations
 */

import { UserMute } from "../types";

export interface UserMuteRepository {
  /**
   * Get all user mutes
   */
  getAll(): Promise<UserMute[]>;

  /**
   * Get user mute by ID
   */
  getById(id: string): Promise<UserMute | null>;

  /**
   * Save a new user mute
   */
  save(mute: UserMute): Promise<void>;

  /**
   * Update an existing user mute
   */
  update(id: string, updates: Partial<UserMute>): Promise<void>;

  /**
   * Delete a user mute
   */
  delete(id: string): Promise<void>;

  /**
   * Get mutes created by a specific user
   */
  getByUser(userId: string): Promise<UserMute[]>;

  /**
   * Get mutes where a user is the target (muted by others)
   */
  getByMutedUser(mutedUserId: string): Promise<UserMute[]>;

  /**
   * Get a specific mute between two users
   */
  getByUserAndMutedUser(
    userId: string,
    mutedUserId: string
  ): Promise<UserMute | null>;

  /**
   * Check if a user has muted another user
   */
  isUserMuted(userId: string, mutedUserId: string): Promise<boolean>;
}
