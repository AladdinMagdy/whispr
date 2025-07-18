/**
 * Tests for User Action Utilities
 */

import {
  generateUserActionId,
  validateUserActionData,
  checkExistingAction,
  checkActionDoesNotExist,
  createUserBlock,
  createUserMute,
  createUserRestriction,
  calculateBlockStats,
  calculateMuteStats,
  calculateRestrictionStats,
  checkUserActionExists,
  handleUserActionError,
  logUserActionSuccess,
  getRecentDateThreshold,
  validateRestrictionType,
  getDefaultBlockStats,
  getDefaultMuteStats,
  getDefaultRestrictionStats,
  RECENT_DAYS_THRESHOLD,
  RECENT_DAYS_MS,
  type CreateBlockData,
  type CreateMuteData,
  type CreateRestrictionData,
  type UserMute,
} from "../utils/userActionUtils";
import { UserBlock, UserRestriction } from "../types";

// Mock console.log to capture log messages
const originalConsoleLog = console.log;
let logMessages: string[] = [];

beforeEach(() => {
  logMessages = [];
  console.log = jest.fn((...args) => {
    logMessages.push(args.join(" "));
    originalConsoleLog(...args);
  });
});

afterEach(() => {
  console.log = originalConsoleLog;
});

describe("User Action Utilities", () => {
  describe("ID Generation", () => {
    test("should generate unique block IDs", () => {
      const id1 = generateUserActionId("block");
      const id2 = generateUserActionId("block");

      expect(id1).toMatch(/^block-\d+-\w{9}$/);
      expect(id2).toMatch(/^block-\d+-\w{9}$/);
      expect(id1).not.toBe(id2);
    });

    test("should generate unique mute IDs", () => {
      const id1 = generateUserActionId("mute");
      const id2 = generateUserActionId("mute");

      expect(id1).toMatch(/^mute-\d+-\w{9}$/);
      expect(id2).toMatch(/^mute-\d+-\w{9}$/);
      expect(id1).not.toBe(id2);
    });

    test("should generate unique restrict IDs", () => {
      const id1 = generateUserActionId("restrict");
      const id2 = generateUserActionId("restrict");

      expect(id1).toMatch(/^restrict-\d+-\w{9}$/);
      expect(id2).toMatch(/^restrict-\d+-\w{9}$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe("Data Validation", () => {
    test("should validate correct user action data", () => {
      expect(() => {
        validateUserActionData("user1", "user2", "Test User");
      }).not.toThrow();
    });

    test("should throw error for invalid userId", () => {
      expect(() => {
        validateUserActionData("", "user2", "Test User");
      }).toThrow("Invalid userId provided");

      expect(() => {
        validateUserActionData(null as any, "user2", "Test User");
      }).toThrow("Invalid userId provided");
    });

    test("should throw error for invalid targetUserId", () => {
      expect(() => {
        validateUserActionData("user1", "", "Test User");
      }).toThrow("Invalid targetUserId provided");

      expect(() => {
        validateUserActionData("user1", null as any, "Test User");
      }).toThrow("Invalid targetUserId provided");
    });

    test("should throw error for invalid displayName", () => {
      expect(() => {
        validateUserActionData("user1", "user2", "");
      }).toThrow("Invalid displayName provided");

      expect(() => {
        validateUserActionData("user1", "user2", null as any);
      }).toThrow("Invalid displayName provided");
    });

    test("should throw error when user tries to act on themselves", () => {
      expect(() => {
        validateUserActionData("user1", "user1", "Test User");
      }).toThrow("Cannot perform action on yourself");
    });
  });

  describe("Action Checking", () => {
    test("should check existing action", () => {
      const mockAction = { id: "test-id" };

      expect(() => {
        checkExistingAction(mockAction, "block");
      }).toThrow("User is already blocked");

      expect(() => {
        checkExistingAction(mockAction, "mute");
      }).toThrow("User is already muted");

      expect(() => {
        checkExistingAction(mockAction, "restrict");
      }).toThrow("User is already restricted");
    });

    test("should not throw when action does not exist", () => {
      expect(() => {
        checkExistingAction(null, "block");
      }).not.toThrow();
    });

    test("should check action does not exist", () => {
      expect(() => {
        checkActionDoesNotExist(null, "block");
      }).toThrow("User is not blocked");

      expect(() => {
        checkActionDoesNotExist(null, "mute");
      }).toThrow("User is not muted");

      expect(() => {
        checkActionDoesNotExist(null, "restrict");
      }).toThrow("User is not restricted");
    });

    test("should not throw when action exists", () => {
      const mockAction = { id: "test-id" };

      expect(() => {
        checkActionDoesNotExist(mockAction, "block");
      }).not.toThrow();
    });

    test("should check if user action exists", () => {
      expect(checkUserActionExists(null)).toBe(false);
      expect(checkUserActionExists({ id: "test" })).toBe(true);
    });
  });

  describe("Object Creation", () => {
    test("should create user block object", () => {
      const data: CreateBlockData = {
        userId: "user1",
        blockedUserId: "user2",
        blockedUserDisplayName: "Test User",
      };

      const block = createUserBlock(data);

      expect(block.id).toMatch(/^block-\d+-\w{9}$/);
      expect(block.userId).toBe("user1");
      expect(block.blockedUserId).toBe("user2");
      expect(block.blockedUserDisplayName).toBe("Test User");
      expect(block.createdAt).toBeInstanceOf(Date);
      expect(block.updatedAt).toBeInstanceOf(Date);
    });

    test("should create user mute object", () => {
      const data: CreateMuteData = {
        userId: "user1",
        mutedUserId: "user2",
        mutedUserDisplayName: "Test User",
      };

      const mute = createUserMute(data);

      expect(mute.id).toMatch(/^mute-\d+-\w{9}$/);
      expect(mute.userId).toBe("user1");
      expect(mute.mutedUserId).toBe("user2");
      expect(mute.mutedUserDisplayName).toBe("Test User");
      expect(mute.createdAt).toBeInstanceOf(Date);
      expect(mute.updatedAt).toBeInstanceOf(Date);
    });

    test("should create user restriction object", () => {
      const data: CreateRestrictionData = {
        userId: "user1",
        restrictedUserId: "user2",
        restrictedUserDisplayName: "Test User",
        type: "interaction",
      };

      const restriction = createUserRestriction(data);

      expect(restriction.id).toMatch(/^restrict-\d+-\w{9}$/);
      expect(restriction.userId).toBe("user1");
      expect(restriction.restrictedUserId).toBe("user2");
      expect(restriction.restrictedUserDisplayName).toBe("Test User");
      expect(restriction.type).toBe("interaction");
      expect(restriction.createdAt).toBeInstanceOf(Date);
      expect(restriction.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe("Statistics Calculation", () => {
    test("should calculate block statistics", () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      const recentDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000); // 3 days ago

      const blockedUsers: UserBlock[] = [
        {
          id: "block1",
          userId: "user1",
          blockedUserId: "user2",
          blockedUserDisplayName: "User 2",
          createdAt: oldDate,
          updatedAt: oldDate,
        },
        {
          id: "block2",
          userId: "user1",
          blockedUserId: "user3",
          blockedUserDisplayName: "User 3",
          createdAt: recentDate,
          updatedAt: recentDate,
        },
      ];

      const stats = calculateBlockStats(blockedUsers);

      expect(stats.totalBlocked).toBe(2);
      expect(stats.recentlyBlocked).toBe(1);
    });

    test("should calculate mute statistics", () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      const recentDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000); // 3 days ago

      const mutedUsers: UserMute[] = [
        {
          id: "mute1",
          userId: "user1",
          mutedUserId: "user2",
          mutedUserDisplayName: "User 2",
          createdAt: oldDate,
          updatedAt: oldDate,
        },
        {
          id: "mute2",
          userId: "user1",
          mutedUserId: "user3",
          mutedUserDisplayName: "User 3",
          createdAt: recentDate,
          updatedAt: recentDate,
        },
      ];

      const stats = calculateMuteStats(mutedUsers);

      expect(stats.totalMuted).toBe(2);
      expect(stats.recentlyMuted).toBe(1);
    });

    test("should calculate restriction statistics", () => {
      const now = new Date();
      const restrictedUsers: UserRestriction[] = [
        {
          id: "restrict1",
          userId: "user1",
          restrictedUserId: "user2",
          restrictedUserDisplayName: "User 2",
          type: "interaction",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "restrict2",
          userId: "user1",
          restrictedUserId: "user3",
          restrictedUserDisplayName: "User 3",
          type: "visibility",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "restrict3",
          userId: "user1",
          restrictedUserId: "user4",
          restrictedUserDisplayName: "User 4",
          type: "full",
          createdAt: now,
          updatedAt: now,
        },
      ];

      const stats = calculateRestrictionStats(restrictedUsers);

      expect(stats.totalRestricted).toBe(3);
      expect(stats.byType.interaction).toBe(1);
      expect(stats.byType.visibility).toBe(1);
      expect(stats.byType.full).toBe(1);
    });

    test("should handle empty arrays", () => {
      expect(calculateBlockStats([])).toEqual({
        totalBlocked: 0,
        recentlyBlocked: 0,
      });

      expect(calculateMuteStats([])).toEqual({
        totalMuted: 0,
        recentlyMuted: 0,
      });

      expect(calculateRestrictionStats([])).toEqual({
        totalRestricted: 0,
        byType: { interaction: 0, visibility: 0, full: 0 },
      });
    });
  });

  describe("Error Handling", () => {
    test("should handle user action errors", () => {
      const error = new Error("Test error");

      expect(() => {
        handleUserActionError(error, "block", "create");
      }).toThrow("Failed to block: Test error");

      expect(() => {
        handleUserActionError(error, "mute", "delete");
      }).toThrow("Failed to unmute: Test error");

      expect(() => {
        handleUserActionError(error, "restrict", "get");
      }).toThrow("Failed to get restrict: Test error");

      expect(() => {
        handleUserActionError(error, "block", "check");
      }).toThrow("Failed to check block: Test error");
    });

    test("should handle unknown errors", () => {
      expect(() => {
        handleUserActionError("Unknown error", "block", "create");
      }).toThrow("Failed to block: Unknown error");
    });
  });

  describe("Logging", () => {
    test("should log user action success", () => {
      logUserActionSuccess("block", "create", "user1", "user2");
      expect(logMessages).toContain("🚫 User user2 blocked by user1");

      logUserActionSuccess("mute", "create", "user1", "user2");
      expect(logMessages).toContain("🔇 User user2 muted by user1");

      logUserActionSuccess("restrict", "create", "user1", "user2");
      expect(logMessages).toContain("🚫 User user2 restricted by user1");

      logUserActionSuccess("block", "delete", "user1", "user2");
      expect(logMessages).toContain("🚫 User user2 unblocked by user1");
    });
  });

  describe("Utility Functions", () => {
    test("should get recent date threshold", () => {
      const threshold = getRecentDateThreshold();
      const expected = new Date(Date.now() - RECENT_DAYS_MS);

      // Allow for small time differences
      expect(Math.abs(threshold.getTime() - expected.getTime())).toBeLessThan(
        1000
      );
    });

    test("should validate restriction types", () => {
      expect(validateRestrictionType("interaction")).toBe(true);
      expect(validateRestrictionType("visibility")).toBe(true);
      expect(validateRestrictionType("full")).toBe(true);
      expect(validateRestrictionType("invalid")).toBe(false);
      expect(validateRestrictionType("")).toBe(false);
    });

    test("should get default stats", () => {
      expect(getDefaultBlockStats()).toEqual({
        totalBlocked: 0,
        recentlyBlocked: 0,
      });

      expect(getDefaultMuteStats()).toEqual({
        totalMuted: 0,
        recentlyMuted: 0,
      });

      expect(getDefaultRestrictionStats()).toEqual({
        totalRestricted: 0,
        byType: { interaction: 0, visibility: 0, full: 0 },
      });
    });
  });

  describe("Constants", () => {
    test("should have correct constants", () => {
      expect(RECENT_DAYS_THRESHOLD).toBe(7);
      expect(RECENT_DAYS_MS).toBe(7 * 24 * 60 * 60 * 1000);
    });
  });
});
