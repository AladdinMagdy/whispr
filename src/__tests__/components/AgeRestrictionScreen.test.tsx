import React from "react";
import { render, fireEvent, screen } from "@testing-library/react-native";
import AgeRestrictionScreen from "../../components/AgeRestrictionScreen";

// Mock the global styles
jest.mock("../../utils/styles", () => ({
  globalStyles: {
    h2: { color: "#FFFFFF" },
    h4: { color: "#FFFFFF" },
    bodyLarge: { color: "#E8F0FF" },
    bodyMedium: { color: "#E8F0FF" },
    buttonTextLarge: { color: "#FFFFFF" },
  },
}));

describe("AgeRestrictionScreen", () => {
  const mockOnGoBack = jest.fn();
  const mockOnRemindMeLater = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders correctly with user age 12", () => {
    render(
      <AgeRestrictionScreen
        userAge={12}
        onGoBack={mockOnGoBack}
        onRemindMeLater={mockOnRemindMeLater}
      />
    );

    // Check main content is rendered
    expect(screen.getByText("Age Requirement")).toBeTruthy();
    expect(
      screen.getByText(
        "We're sorry, but you need to be at least 13 years old to use Whispr."
      )
    ).toBeTruthy();
    expect(screen.getByText("You are currently 12 years old")).toBeTruthy();
    expect(screen.getByText("You'll be eligible in 1 year")).toBeTruthy();
  });

  it("renders correctly with user age 10", () => {
    render(
      <AgeRestrictionScreen
        userAge={10}
        onGoBack={mockOnGoBack}
        onRemindMeLater={mockOnRemindMeLater}
      />
    );

    expect(screen.getByText("You are currently 10 years old")).toBeTruthy();
    expect(screen.getByText("You'll be eligible in 3 years")).toBeTruthy();
  });

  it("renders correctly with user age 5", () => {
    render(
      <AgeRestrictionScreen
        userAge={5}
        onGoBack={mockOnGoBack}
        onRemindMeLater={mockOnRemindMeLater}
      />
    );

    expect(screen.getByText("You are currently 5 years old")).toBeTruthy();
    expect(screen.getByText("You'll be eligible in 8 years")).toBeTruthy();
  });

  it("displays why section content", () => {
    render(
      <AgeRestrictionScreen
        userAge={12}
        onGoBack={mockOnGoBack}
        onRemindMeLater={mockOnRemindMeLater}
      />
    );

    expect(screen.getByText("Why do we have this requirement?")).toBeTruthy();
    expect(screen.getByText("To protect your privacy and safety")).toBeTruthy();
    expect(
      screen.getByText("To comply with child protection laws")
    ).toBeTruthy();
    expect(screen.getByText("To ensure age-appropriate content")).toBeTruthy();
  });

  it("displays alternatives section content", () => {
    render(
      <AgeRestrictionScreen
        userAge={12}
        onGoBack={mockOnGoBack}
        onRemindMeLater={mockOnRemindMeLater}
      />
    );

    expect(screen.getByText("What you can do instead:")).toBeTruthy();
    expect(screen.getByText("Wait until you're 13 years old")).toBeTruthy();
    expect(
      screen.getByText("Ask a parent or guardian about age-appropriate apps")
    ).toBeTruthy();
    expect(
      screen.getByText("Explore other creative outlets like writing or drawing")
    ).toBeTruthy();
  });

  it("calls onGoBack when back button is pressed", () => {
    render(
      <AgeRestrictionScreen
        userAge={12}
        onGoBack={mockOnGoBack}
        onRemindMeLater={mockOnRemindMeLater}
      />
    );

    const backButton = screen.getByTestId("back-button");
    fireEvent.press(backButton);

    expect(mockOnGoBack).toHaveBeenCalledTimes(1);
  });

  it("calls onGoBack when primary button is pressed", () => {
    render(
      <AgeRestrictionScreen
        userAge={12}
        onGoBack={mockOnGoBack}
        onRemindMeLater={mockOnRemindMeLater}
      />
    );

    const primaryButton = screen.getByText("Go Back & Change Age");
    fireEvent.press(primaryButton);

    expect(mockOnGoBack).toHaveBeenCalledTimes(1);
  });

  it("calls onRemindMeLater when secondary button is pressed", () => {
    render(
      <AgeRestrictionScreen
        userAge={12}
        onGoBack={mockOnGoBack}
        onRemindMeLater={mockOnRemindMeLater}
      />
    );

    const secondaryButton = screen.getByText("Remind Me When I'm 13");
    fireEvent.press(secondaryButton);

    expect(mockOnRemindMeLater).toHaveBeenCalledTimes(1);
  });

  it("does not show remind me button when onRemindMeLater is not provided", () => {
    render(<AgeRestrictionScreen userAge={12} onGoBack={mockOnGoBack} />);

    expect(screen.queryByText("Remind Me When I'm 13")).toBeNull();
  });

  it("handles edge case of age 12 (exactly 1 year until eligible)", () => {
    render(
      <AgeRestrictionScreen
        userAge={12}
        onGoBack={mockOnGoBack}
        onRemindMeLater={mockOnRemindMeLater}
      />
    );

    expect(screen.getByText("You'll be eligible in 1 year")).toBeTruthy();
  });

  it("handles edge case of age 11 (2 years until eligible)", () => {
    render(
      <AgeRestrictionScreen
        userAge={11}
        onGoBack={mockOnGoBack}
        onRemindMeLater={mockOnRemindMeLater}
      />
    );

    expect(screen.getByText("You'll be eligible in 2 years")).toBeTruthy();
  });

  it("handles very young age (5 years old)", () => {
    render(
      <AgeRestrictionScreen
        userAge={5}
        onGoBack={mockOnGoBack}
        onRemindMeLater={mockOnRemindMeLater}
      />
    );

    expect(screen.getByText("You are currently 5 years old")).toBeTruthy();
    expect(screen.getByText("You'll be eligible in 8 years")).toBeTruthy();
  });

  it("handles age 1 (12 years until eligible)", () => {
    render(
      <AgeRestrictionScreen
        userAge={1}
        onGoBack={mockOnGoBack}
        onRemindMeLater={mockOnRemindMeLater}
      />
    );

    expect(screen.getByText("You are currently 1 years old")).toBeTruthy();
    expect(screen.getByText("You'll be eligible in 12 years")).toBeTruthy();
  });
});
