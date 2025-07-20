/**
 * Suspension Repository Interface
 * Defines data access operations for user suspensions
 */

import { Suspension } from "../types";

export interface SuspensionRepository {
  /**
   * Save a new suspension
   */
  save(suspension: Suspension): Promise<void>;

  /**
   * Get suspension by ID
   */
  getById(suspensionId: string): Promise<Suspension | null>;

  /**
   * Get all suspensions
   */
  getAll(): Promise<Suspension[]>;

  /**
   * Get suspensions by user ID
   */
  getByUser(userId: string): Promise<Suspension[]>;

  /**
   * Get active suspensions
   */
  getActive(): Promise<Suspension[]>;

  /**
   * Update a suspension
   */
  update(suspensionId: string, updates: Partial<Suspension>): Promise<void>;

  /**
   * Delete a suspension
   */
  delete(suspensionId: string): Promise<void>;

  /**
   * Get suspensions by moderator ID
   */
  getByModerator(moderatorId: string): Promise<Suspension[]>;

  /**
   * Get suspensions by type
   */
  getByType(type: string): Promise<Suspension[]>;

  /**
   * Get suspensions created within a date range
   */
  getByDateRange(startDate: Date, endDate: Date): Promise<Suspension[]>;
}
