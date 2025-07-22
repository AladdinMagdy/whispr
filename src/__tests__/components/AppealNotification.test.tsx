import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import AppealNotification from "@/components/AppealNotification";

// Mock the services
jest.mock("@/services/privacyService", () => ({
  getPrivacyService: jest.fn(() => ({
    getUserViolations: jest.fn(),
  })),
}));

jest.mock("@/services/appealService", () => ({
  getAppealService: jest.fn(() => ({
    getUserAppeals: jest.fn(),
  })),
}));

// Mock the auth provider
jest.mock("@/providers/AuthProvider", () => ({
  useAuth: jest.fn(),
}));

import { getPrivacyService } from "@/services/privacyService";
import { getAppealService } from "@/services/appealService";
import { useAuth } from "@/providers/AuthProvider";

const mockGetPrivacyService = getPrivacyService as jest.MockedFunction<
  typeof getPrivacyService
>;
const mockGetAppealService = getAppealService as jest.MockedFunction<
  typeof getAppealService
>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe("AppealNotification", () => {
  const mockOnNavigateToAppeals = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock for useAuth
    mockUseAuth.mockReturnValue({
      user: {
        uid: "test-user-123",
        displayName: "Test User",
        isAnonymous: true,
        createdAt: new Date(),
        lastActiveAt: new Date(),
        whisperCount: 0,
        totalReactions: 0,
        profileColor: "#FF0000",
      },
      isLoading: false,
      error: null,
      isAuthenticated: true,
      signInAnonymously: jest.fn(),
      signOut: jest.fn(),
      updateLastActive: jest.fn(),
      incrementWhisperCount: jest.fn(),
      incrementReactionCount: jest.fn(),
      clearError: jest.fn(),
    });

    // Default mock for services
    mockGetPrivacyService.mockReturnValue({
      getUserViolations: jest.fn().mockResolvedValue([]),
    } as any);

    mockGetAppealService.mockReturnValue({
      getUserAppeals: jest.fn().mockResolvedValue([]),
    } as any);
  });

  it("should not render when user is not authenticated", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      error: null,
      isAuthenticated: false,
      signInAnonymously: jest.fn(),
      signOut: jest.fn(),
      updateLastActive: jest.fn(),
      incrementWhisperCount: jest.fn(),
      incrementReactionCount: jest.fn(),
      clearError: jest.fn(),
    });

    const { queryByTestId } = render(
      <AppealNotification onNavigateToAppeals={mockOnNavigateToAppeals} />
    );

    expect(queryByTestId("appeal-notification")).toBeNull();
  });

  it("should not render when there are no appealable violations or pending appeals", async () => {
    const { queryByTestId } = render(
      <AppealNotification onNavigateToAppeals={mockOnNavigateToAppeals} />
    );

    await waitFor(() => {
      expect(queryByTestId("appeal-notification")).toBeNull();
    });
  });

  it("should render when there are appealable violations", async () => {
    const mockViolations = [
      {
        id: "violation-1",
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        type: "inappropriate_content",
      },
    ];

    mockGetPrivacyService.mockReturnValue({
      getUserViolations: jest.fn().mockResolvedValue(mockViolations),
    } as any);

    const { getByTestId, getByText } = render(
      <AppealNotification onNavigateToAppeals={mockOnNavigateToAppeals} />
    );

    await waitFor(() => {
      expect(getByTestId("appeal-notification")).toBeTruthy();
      expect(
        getByText("You have new violations that can be appealed")
      ).toBeTruthy();
    });
  });

  it("should render when there are pending appeals", async () => {
    const mockAppeals = [
      {
        id: "appeal-1",
        status: "pending",
        violationId: "violation-1",
        createdAt: new Date(),
      },
    ];

    mockGetAppealService.mockReturnValue({
      getUserAppeals: jest.fn().mockResolvedValue(mockAppeals),
    } as any);

    const { getByTestId, getByText } = render(
      <AppealNotification onNavigateToAppeals={mockOnNavigateToAppeals} />
    );

    await waitFor(() => {
      expect(getByTestId("appeal-notification")).toBeTruthy();
      expect(getByText("You have 1 pending appeal")).toBeTruthy();
    });
  });

  it("should render when there are both appealable violations and pending appeals", async () => {
    const mockViolations = [
      {
        id: "violation-1",
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        type: "inappropriate_content",
      },
    ];

    const mockAppeals = [
      {
        id: "appeal-1",
        status: "pending",
        violationId: "violation-2",
        createdAt: new Date(),
      },
    ];

    mockGetPrivacyService.mockReturnValue({
      getUserViolations: jest.fn().mockResolvedValue(mockViolations),
    } as any);

    mockGetAppealService.mockReturnValue({
      getUserAppeals: jest.fn().mockResolvedValue(mockAppeals),
    } as any);

    const { getByTestId, getByText } = render(
      <AppealNotification onNavigateToAppeals={mockOnNavigateToAppeals} />
    );

    await waitFor(() => {
      expect(getByTestId("appeal-notification")).toBeTruthy();
      expect(
        getByText("You have new violations to appeal and pending appeals")
      ).toBeTruthy();
    });
  });

  it("should handle multiple pending appeals with correct pluralization", async () => {
    const mockAppeals = [
      {
        id: "appeal-1",
        status: "pending",
        violationId: "violation-1",
        createdAt: new Date(),
      },
      {
        id: "appeal-2",
        status: "under_review",
        violationId: "violation-2",
        createdAt: new Date(),
      },
    ];

    mockGetAppealService.mockReturnValue({
      getUserAppeals: jest.fn().mockResolvedValue(mockAppeals),
    } as any);

    const { getByTestId, getByText } = render(
      <AppealNotification onNavigateToAppeals={mockOnNavigateToAppeals} />
    );

    await waitFor(() => {
      expect(getByTestId("appeal-notification")).toBeTruthy();
      expect(getByText("You have 2 pending appeals")).toBeTruthy();
    });
  });

  it("should call onNavigateToAppeals when View button is pressed", async () => {
    const mockViolations = [
      {
        id: "violation-1",
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        type: "inappropriate_content",
      },
    ];

    mockGetPrivacyService.mockReturnValue({
      getUserViolations: jest.fn().mockResolvedValue(mockViolations),
    } as any);

    const { getByTestId } = render(
      <AppealNotification onNavigateToAppeals={mockOnNavigateToAppeals} />
    );

    await waitFor(() => {
      expect(getByTestId("appeal-notification")).toBeTruthy();
    });

    const viewButton = getByTestId("view-appeals-button");
    fireEvent.press(viewButton);

    expect(mockOnNavigateToAppeals).toHaveBeenCalledTimes(1);
  });

  it("should filter out violations older than 30 days", async () => {
    const mockViolations = [
      {
        id: "violation-1",
        createdAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000), // 31 days ago
        type: "inappropriate_content",
      },
    ];

    mockGetPrivacyService.mockReturnValue({
      getUserViolations: jest.fn().mockResolvedValue(mockViolations),
    } as any);

    const { queryByTestId } = render(
      <AppealNotification onNavigateToAppeals={mockOnNavigateToAppeals} />
    );

    await waitFor(() => {
      expect(queryByTestId("appeal-notification")).toBeNull();
    });
  });

  it("should filter out violations that already have appeals", async () => {
    const mockViolations = [
      {
        id: "violation-1",
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        type: "inappropriate_content",
      },
    ];

    const mockAppeals = [
      {
        id: "appeal-1",
        status: "pending",
        violationId: "violation-1", // Same violation ID
        createdAt: new Date(),
      },
    ];

    mockGetPrivacyService.mockReturnValue({
      getUserViolations: jest.fn().mockResolvedValue(mockViolations),
    } as any);

    mockGetAppealService.mockReturnValue({
      getUserAppeals: jest.fn().mockResolvedValue(mockAppeals),
    } as any);

    const { getByTestId, getByText } = render(
      <AppealNotification onNavigateToAppeals={mockOnNavigateToAppeals} />
    );

    await waitFor(() => {
      expect(getByTestId("appeal-notification")).toBeTruthy();
      // Should only show pending appeals, not appealable violations
      expect(getByText("You have 1 pending appeal")).toBeTruthy();
    });
  });

  it("should handle service errors gracefully", async () => {
    mockGetPrivacyService.mockReturnValue({
      getUserViolations: jest
        .fn()
        .mockRejectedValue(new Error("Service error")),
    } as any);

    const consoleSpy = jest.spyOn(console, "error").mockImplementation();

    const { queryByTestId } = render(
      <AppealNotification onNavigateToAppeals={mockOnNavigateToAppeals} />
    );

    await waitFor(() => {
      expect(queryByTestId("appeal-notification")).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error checking appeal status:",
        expect.any(Error)
      );
    });

    consoleSpy.mockRestore();
  });
});
