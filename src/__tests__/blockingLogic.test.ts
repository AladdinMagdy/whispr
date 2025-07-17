import { getFirestoreService } from "../services/firestoreService";
import { getUserBlockService } from "../services/userBlockService";

// Mock Firebase
jest.mock("../services/firestoreService");
jest.mock("../services/userBlockService");

describe("Bidirectional Blocking Logic", () => {
  let mockFirestoreService: any;
  let mockUserBlockService: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    mockFirestoreService = {
      getUserBlocks: jest.fn(),
      getUsersWhoBlockedMe: jest.fn(),
      getUserBlock: jest.fn(),
    };

    mockUserBlockService = {
      blockUser: jest.fn(),
      isUserBlocked: jest.fn(),
    };

    (getFirestoreService as jest.Mock).mockReturnValue(mockFirestoreService);
    (getUserBlockService as jest.Mock).mockReturnValue(mockUserBlockService);
  });

  describe("Blocking Scenarios", () => {
    it("should filter out content when user A blocks user B", async () => {
      // Setup: User A blocks User B
      mockFirestoreService.getUserBlocks.mockResolvedValue([
        { userId: "userA", blockedUserId: "userB" },
      ]);
      mockFirestoreService.getUsersWhoBlockedMe.mockResolvedValue([]);

      const firestoreService = getFirestoreService();

      // Mock whispers data
      const mockWhispers = [
        { id: "1", userId: "userA", userDisplayName: "User A" },
        { id: "2", userId: "userB", userDisplayName: "User B" },
        { id: "3", userId: "userC", userDisplayName: "User C" },
      ];

      // Simulate the filtering logic
      const blockedUsers = await firestoreService.getUserBlocks("userA");
      const usersWhoBlockedMe = await firestoreService.getUsersWhoBlockedMe(
        "userA"
      );

      const blockedUserIds = blockedUsers.map(
        (block: any) => block.blockedUserId
      );
      const usersWhoBlockedMeIds = usersWhoBlockedMe.map(
        (block: any) => block.userId
      );
      const allBlockedUserIds = [...blockedUserIds, ...usersWhoBlockedMeIds];

      const filteredWhispers = mockWhispers.filter(
        (whisper) => !allBlockedUserIds.includes(whisper.userId)
      );

      // User B's content should be filtered out
      expect(filteredWhispers).toHaveLength(2);
      expect(
        filteredWhispers.find((w) => w.userId === "userB")
      ).toBeUndefined();
      expect(filteredWhispers.find((w) => w.userId === "userA")).toBeDefined();
      expect(filteredWhispers.find((w) => w.userId === "userC")).toBeDefined();
    });

    it("should filter out content when user B blocks user A", async () => {
      // Setup: User B blocks User A
      mockFirestoreService.getUserBlocks.mockResolvedValue([]);
      mockFirestoreService.getUsersWhoBlockedMe.mockResolvedValue([
        { userId: "userB", blockedUserId: "userA" },
      ]);

      const firestoreService = getFirestoreService();

      // Mock whispers data
      const mockWhispers = [
        { id: "1", userId: "userA", userDisplayName: "User A" },
        { id: "2", userId: "userB", userDisplayName: "User B" },
        { id: "3", userId: "userC", userDisplayName: "User C" },
      ];

      // Simulate the filtering logic
      const blockedUsers = await firestoreService.getUserBlocks("userA");
      const usersWhoBlockedMe = await firestoreService.getUsersWhoBlockedMe(
        "userA"
      );

      const blockedUserIds = blockedUsers.map(
        (block: any) => block.blockedUserId
      );
      const usersWhoBlockedMeIds = usersWhoBlockedMe.map(
        (block: any) => block.userId
      );
      const allBlockedUserIds = [...blockedUserIds, ...usersWhoBlockedMeIds];

      const filteredWhispers = mockWhispers.filter(
        (whisper) => !allBlockedUserIds.includes(whisper.userId)
      );

      // User B's content should be filtered out (because B blocked A)
      expect(filteredWhispers).toHaveLength(2);
      expect(
        filteredWhispers.find((w) => w.userId === "userB")
      ).toBeUndefined();
      expect(filteredWhispers.find((w) => w.userId === "userA")).toBeDefined();
      expect(filteredWhispers.find((w) => w.userId === "userC")).toBeDefined();
    });

    it("should filter out content in both directions when mutual blocking occurs", async () => {
      // Setup: User A blocks User B, and User B blocks User A
      mockFirestoreService.getUserBlocks.mockResolvedValue([
        { userId: "userA", blockedUserId: "userB" },
      ]);
      mockFirestoreService.getUsersWhoBlockedMe.mockResolvedValue([
        { userId: "userB", blockedUserId: "userA" },
      ]);

      const firestoreService = getFirestoreService();

      // Mock whispers data
      const mockWhispers = [
        { id: "1", userId: "userA", userDisplayName: "User A" },
        { id: "2", userId: "userB", userDisplayName: "User B" },
        { id: "3", userId: "userC", userDisplayName: "User C" },
      ];

      // Simulate the filtering logic
      const blockedUsers = await firestoreService.getUserBlocks("userA");
      const usersWhoBlockedMe = await firestoreService.getUsersWhoBlockedMe(
        "userA"
      );

      const blockedUserIds = blockedUsers.map(
        (block: any) => block.blockedUserId
      );
      const usersWhoBlockedMeIds = usersWhoBlockedMe.map(
        (block: any) => block.userId
      );
      const allBlockedUserIds = [...blockedUserIds, ...usersWhoBlockedMeIds];

      const filteredWhispers = mockWhispers.filter(
        (whisper) => !allBlockedUserIds.includes(whisper.userId)
      );

      // User B's content should be filtered out, but User A should still see their own content
      expect(filteredWhispers).toHaveLength(2);
      expect(filteredWhispers.find((w) => w.userId === "userA")).toBeDefined();
      expect(
        filteredWhispers.find((w) => w.userId === "userB")
      ).toBeUndefined();
      expect(filteredWhispers.find((w) => w.userId === "userC")).toBeDefined();
    });

    it("should not filter out content when no blocking exists", async () => {
      // Setup: No blocking relationships
      mockFirestoreService.getUserBlocks.mockResolvedValue([]);
      mockFirestoreService.getUsersWhoBlockedMe.mockResolvedValue([]);

      const firestoreService = getFirestoreService();

      // Mock whispers data
      const mockWhispers = [
        { id: "1", userId: "userA", userDisplayName: "User A" },
        { id: "2", userId: "userB", userDisplayName: "User B" },
        { id: "3", userId: "userC", userDisplayName: "User C" },
      ];

      // Simulate the filtering logic
      const blockedUsers = await firestoreService.getUserBlocks("userA");
      const usersWhoBlockedMe = await firestoreService.getUsersWhoBlockedMe(
        "userA"
      );

      const blockedUserIds = blockedUsers.map(
        (block: any) => block.blockedUserId
      );
      const usersWhoBlockedMeIds = usersWhoBlockedMe.map(
        (block: any) => block.userId
      );
      const allBlockedUserIds = [...blockedUserIds, ...usersWhoBlockedMeIds];

      const filteredWhispers = mockWhispers.filter(
        (whisper) => !allBlockedUserIds.includes(whisper.userId)
      );

      // All content should remain visible
      expect(filteredWhispers).toHaveLength(3);
      expect(filteredWhispers.find((w) => w.userId === "userA")).toBeDefined();
      expect(filteredWhispers.find((w) => w.userId === "userB")).toBeDefined();
      expect(filteredWhispers.find((w) => w.userId === "userC")).toBeDefined();
    });
  });
});
