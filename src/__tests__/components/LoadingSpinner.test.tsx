import React from "react";
import { render, screen } from "@testing-library/react-native";
import LoadingSpinner from "@/components/LoadingSpinner";

describe("LoadingSpinner", () => {
  it("should render with default props", () => {
    render(<LoadingSpinner />);

    // Check that the loading message is displayed
    expect(screen.getByText("Loading...")).toBeTruthy();

    // Check that the ActivityIndicator is rendered
    expect(screen.getByTestId("activity-indicator")).toBeTruthy();
  });

  it("should render with custom message", () => {
    const customMessage = "Please wait...";
    render(<LoadingSpinner message={customMessage} />);

    expect(screen.getByText(customMessage)).toBeTruthy();
  });

  it("should not show message when showMessage is false", () => {
    render(<LoadingSpinner showMessage={false} />);

    // Should not find the default message
    expect(screen.queryByText("Loading...")).toBeNull();
  });

  it("should render with small size", () => {
    render(<LoadingSpinner size="small" />);

    const activityIndicator = screen.getByTestId("activity-indicator");
    expect(activityIndicator.props.size).toBe("small");
  });

  it("should render with large size", () => {
    render(<LoadingSpinner size="large" />);

    const activityIndicator = screen.getByTestId("activity-indicator");
    expect(activityIndicator.props.size).toBe("large");
  });

  it("should render with custom color", () => {
    const customColor = "#FF0000";
    render(<LoadingSpinner color={customColor} />);

    const activityIndicator = screen.getByTestId("activity-indicator");
    expect(activityIndicator.props.color).toBe(customColor);
  });

  it("should render with all custom props", () => {
    const customMessage = "Processing...";
    const customColor = "#00FF00";

    render(
      <LoadingSpinner
        message={customMessage}
        size="small"
        color={customColor}
        showMessage={true}
      />
    );

    expect(screen.getByText(customMessage)).toBeTruthy();

    const activityIndicator = screen.getByTestId("activity-indicator");
    expect(activityIndicator.props.size).toBe("small");
    expect(activityIndicator.props.color).toBe(customColor);
  });

  it("should have correct container styles", () => {
    const { getByTestId } = render(<LoadingSpinner />);

    const container = getByTestId("loading-spinner-container");
    expect(container.props.style).toMatchObject({
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "#fff",
    });
  });

  it("should have correct message styles", () => {
    const { getByText } = render(<LoadingSpinner message="Test message" />);

    const message = getByText("Test message");
    expect(message.props.style).toMatchObject({
      marginTop: 16,
      fontSize: 16,
      color: "#666",
      textAlign: "center",
    });
  });
});
