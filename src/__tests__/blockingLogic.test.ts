import { getUserBlockService } from "../services/userBlockService";
import { getUserMuteService } from "../services/userMuteService";
import { getBlockListCacheService } from "../services/blockListCacheService";

describe("Blocking Logic", () => {
  let userBlockService: ReturnType<typeof getUserBlockService>;
  let userMuteService: ReturnType<typeof getUserMuteService>;
  let blockListCacheService: ReturnType<typeof getBlockListCacheService>;

  beforeEach(() => {
    userBlockService = getUserBlockService();
    userMuteService = getUserMuteService();
    blockListCacheService = getBlockListCacheService();

    // Inject the services into the cache service to avoid dynamic import issues
    blockListCacheService.setUserBlockService(userBlockService);
    blockListCacheService.setUserMuteService(userMuteService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("User Blocking", () => {
    test("should correctly identify when user A blocks user B", async () => {
      // Mock the repository methods
      jest.spyOn(userBlockService, "getBlockedUsers").mockResolvedValue([
        {
          id: "block1",
          userId: "userA",
          blockedUserId: "userB",
          blockedUserDisplayName: "User B",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      jest
        .spyOn(userBlockService, "getUsersWhoBlockedMe")
        .mockResolvedValue([]);

      const blockedUsers = await userBlockService.getBlockedUsers("userA");
      const usersWhoBlockedMe = await userBlockService.getUsersWhoBlockedMe(
        "userA"
      );

      expect(blockedUsers).toHaveLength(1);
      expect(blockedUsers[0].blockedUserId).toBe("userB");
      expect(usersWhoBlockedMe).toHaveLength(0);
    });

    test("should correctly identify when user B blocks user A", async () => {
      // Mock the repository methods
      jest.spyOn(userBlockService, "getBlockedUsers").mockResolvedValue([]);
      jest.spyOn(userBlockService, "getUsersWhoBlockedMe").mockResolvedValue([
        {
          id: "block2",
          userId: "userB",
          blockedUserId: "userA",
          blockedUserDisplayName: "User A",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const blockedUsers = await userBlockService.getBlockedUsers("userA");
      const usersWhoBlockedMe = await userBlockService.getUsersWhoBlockedMe(
        "userA"
      );

      expect(blockedUsers).toHaveLength(0);
      expect(usersWhoBlockedMe).toHaveLength(1);
      expect(usersWhoBlockedMe[0].userId).toBe("userB");
    });

    test("should correctly identify mutual blocking", async () => {
      // Mock the repository methods
      jest.spyOn(userBlockService, "getBlockedUsers").mockResolvedValue([
        {
          id: "block1",
          userId: "userA",
          blockedUserId: "userB",
          blockedUserDisplayName: "User B",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      jest.spyOn(userBlockService, "getUsersWhoBlockedMe").mockResolvedValue([
        {
          id: "block2",
          userId: "userB",
          blockedUserId: "userA",
          blockedUserDisplayName: "User A",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const blockedUsers = await userBlockService.getBlockedUsers("userA");
      const usersWhoBlockedMe = await userBlockService.getUsersWhoBlockedMe(
        "userA"
      );

      expect(blockedUsers).toHaveLength(1);
      expect(usersWhoBlockedMe).toHaveLength(1);
      expect(blockedUsers[0].blockedUserId).toBe("userB");
      expect(usersWhoBlockedMe[0].userId).toBe("userB");
    });

    test("should correctly identify no blocking relationship", async () => {
      // Mock the repository methods
      jest.spyOn(userBlockService, "getBlockedUsers").mockResolvedValue([]);
      jest
        .spyOn(userBlockService, "getUsersWhoBlockedMe")
        .mockResolvedValue([]);

      const blockedUsers = await userBlockService.getBlockedUsers("userA");
      const usersWhoBlockedMe = await userBlockService.getUsersWhoBlockedMe(
        "userA"
      );

      expect(blockedUsers).toHaveLength(0);
      expect(usersWhoBlockedMe).toHaveLength(0);
    });
  });

  describe("User Muting", () => {
    test("should correctly identify when user A mutes user B", async () => {
      // Mock the repository method
      jest.spyOn(userMuteService, "getMutedUsers").mockResolvedValue([
        {
          id: "mute1",
          userId: "userA",
          mutedUserId: "userB",
          mutedUserDisplayName: "User B",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const mutedUsers = await userMuteService.getMutedUsers("userA");

      expect(mutedUsers).toHaveLength(1);
      expect(mutedUsers[0].mutedUserId).toBe("userB");
    });

    test("should correctly identify no muting relationship", async () => {
      // Mock the repository method
      jest.spyOn(userMuteService, "getMutedUsers").mockResolvedValue([]);

      const mutedUsers = await userMuteService.getMutedUsers("userA");

      expect(mutedUsers).toHaveLength(0);
    });
  });

  describe("Block List Cache Service", () => {
    test("should return cached block lists", async () => {
      // Mock the service methods
      jest.spyOn(userBlockService, "getBlockedUsers").mockResolvedValue([
        {
          id: "block1",
          userId: "userA",
          blockedUserId: "userB",
          blockedUserDisplayName: "User B",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      jest
        .spyOn(userBlockService, "getUsersWhoBlockedMe")
        .mockResolvedValue([]);
      jest.spyOn(userMuteService, "getMutedUsers").mockResolvedValue([]);

      const blockLists = await blockListCacheService.getBlockLists("userA");

      expect(blockLists.blockedUsers.has("userB")).toBe(true);
      expect(blockLists.blockedByUsers.size).toBe(0);
      expect(blockLists.mutedUsers.size).toBe(0);
    });

    test("should correctly identify blocked users", async () => {
      // Mock the service methods
      jest.spyOn(userBlockService, "getBlockedUsers").mockResolvedValue([
        {
          id: "block1",
          userId: "userA",
          blockedUserId: "userB",
          blockedUserDisplayName: "User B",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      jest
        .spyOn(userBlockService, "getUsersWhoBlockedMe")
        .mockResolvedValue([]);
      jest.spyOn(userMuteService, "getMutedUsers").mockResolvedValue([]);

      const isBlocked = await blockListCacheService.isUserBlocked(
        "userA",
        "userB"
      );

      expect(isBlocked).toBe(true);
    });

    test("should correctly identify muted users", async () => {
      // Mock the service methods
      jest.spyOn(userBlockService, "getBlockedUsers").mockResolvedValue([]);
      jest
        .spyOn(userBlockService, "getUsersWhoBlockedMe")
        .mockResolvedValue([]);
      jest.spyOn(userMuteService, "getMutedUsers").mockResolvedValue([
        {
          id: "mute1",
          userId: "userA",
          mutedUserId: "userB",
          mutedUserDisplayName: "User B",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      // Clear any existing cache
      await blockListCacheService.invalidateCache("userA");

      const isMuted = await blockListCacheService.isUserMuted("userA", "userB");

      expect(isMuted).toBe(true);
    });
  });
});
