import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import AppealScreen from "../screens/AppealScreen";
import AppealNotification from "../components/AppealNotification";
import { AppealStatus } from "../types";

const now = new Date();

// Mock the services
const mockGetUserAppeals = jest.fn();
const mockCreateAppeal = jest.fn();
const mockGetUserViolations = jest.fn();

jest.mock("../services/appealService", () => ({
  getAppealService: jest.fn(() => ({
    getUserAppeals: mockGetUserAppeals,
    createAppeal: mockCreateAppeal,
  })),
}));

jest.mock("../services/firestoreService", () => ({
  getFirestoreService: jest.fn(() => ({
    getUserViolations: mockGetUserViolations,
  })),
}));

jest.mock("../providers/AuthProvider", () => ({
  useAuth: () => ({
    user: { uid: "test-user-id" },
  }),
}));

// Mock Alert
jest.spyOn(Alert, "alert").mockImplementation(() => {});

describe("Appeal System", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("AppealScreen", () => {
    it("should render loading state initially", () => {
      const { getByText } = render(React.createElement(AppealScreen));
      expect(getByText("Loading appeals...")).toBeTruthy();
    });

    it("should call services when user is available", async () => {
      const mockViolations: import("../types").UserViolation[] = [
        {
          id: "violation-1",
          userId: "test-user-id",
          whisperId: "whisper-1",
          violationType: "whisper_deleted",
          reason: "Inappropriate content",
          reportCount: 5,
          createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        },
      ];

      const mockAppeals: import("../types").Appeal[] = [
        {
          id: "appeal-1",
          userId: "test-user-id",
          whisperId: "whisper-1",
          violationId: "violation-1",
          reason: "This was a misunderstanding",
          status: AppealStatus.PENDING,
          submittedAt: now,
          createdAt: now,
          updatedAt: now,
          reviewedAt: undefined,
          resolution: undefined,
        },
      ];

      mockGetUserAppeals.mockResolvedValue(mockAppeals);
      mockGetUserViolations.mockResolvedValue(mockViolations);

      render(React.createElement(AppealScreen));

      await waitFor(
        () => {
          expect(mockGetUserAppeals).toHaveBeenCalledWith("test-user-id");
        },
        { timeout: 5000 }
      );
    });

    it("should show appeals center after loading", async () => {
      const mockViolations: import("../types").UserViolation[] = [
        {
          id: "violation-1",
          userId: "test-user-id",
          whisperId: "whisper-1",
          violationType: "whisper_deleted",
          reason: "Inappropriate content",
          reportCount: 5,
          createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        },
      ];

      const mockAppeals: import("../types").Appeal[] = [];

      mockGetUserAppeals.mockResolvedValue(mockAppeals);
      mockGetUserViolations.mockResolvedValue(mockViolations);

      const { findByText } = render(React.createElement(AppealScreen));

      await waitFor(() => {
        expect(mockGetUserAppeals).toHaveBeenCalled();
      });

      await findByText("Appeals Center");
    });

    it("should show empty state when no appeals available", async () => {
      mockGetUserAppeals.mockResolvedValue([]);
      mockGetUserViolations.mockResolvedValue([]);

      const { findByText } = render(React.createElement(AppealScreen));

      await waitFor(() => {
        expect(mockGetUserAppeals).toHaveBeenCalled();
      });

      await findByText("No Appeals Available");
    });

    it("should handle service errors gracefully", async () => {
      mockGetUserAppeals.mockRejectedValue(new Error("Network error"));

      render(React.createElement(AppealScreen));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "Error",
          "Failed to load appeal data"
        );
      });
    });
  });

  describe("AppealNotification", () => {
    it("should show notification when there are appealable violations", async () => {
      const mockViolations: import("../types").UserViolation[] = [
        {
          id: "violation-1",
          userId: "test-user-id",
          whisperId: "whisper-1",
          violationType: "whisper_deleted",
          reason: "Inappropriate content",
          reportCount: 5,
          createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        },
      ];

      const mockAppeals: import("../types").Appeal[] = []; // No pending appeals

      mockGetUserAppeals.mockResolvedValue(mockAppeals);
      mockGetUserViolations.mockResolvedValue(mockViolations);

      const mockNavigateToAppeals = jest.fn();
      const { findByText } = render(
        React.createElement(AppealNotification, {
          onNavigateToAppeals: mockNavigateToAppeals,
        })
      );

      await waitFor(() => {
        expect(mockGetUserAppeals).toHaveBeenCalledWith("test-user-id");
      });

      await findByText("You have new violations that can be appealed");
    });

    it("should not show notification when no appealable content", async () => {
      mockGetUserAppeals.mockResolvedValue([]);
      mockGetUserViolations.mockResolvedValue([]);

      const mockNavigateToAppeals = jest.fn();
      const { queryByText } = render(
        React.createElement(AppealNotification, {
          onNavigateToAppeals: mockNavigateToAppeals,
        })
      );

      await waitFor(() => {
        expect(mockGetUserAppeals).toHaveBeenCalled();
      });

      const el1 = queryByText("You have new violations that can be appealed");
      expect(el1).toBeNull();
      const el2 = queryByText("You have 1 pending appeal");
      expect(el2).toBeNull();
    });
  });
});
