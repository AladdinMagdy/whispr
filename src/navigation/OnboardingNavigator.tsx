import React, { useState } from "react";
import OnboardingScreen from "../screens/OnboardingScreen";
import PermissionsScreen from "../screens/PermissionsScreen";
import ContentPreferencesScreen from "../screens/ContentPreferencesScreen";
import RecordingScreen from "../screens/RecordingScreen";
import CompletionScreen from "../screens/CompletionScreen";

interface OnboardingNavigatorProps {
  onComplete: () => void;
}

type OnboardingStep =
  | "avatar"
  | "permissions"
  | "preferences"
  | "recording"
  | "completion";

const OnboardingNavigator: React.FC<OnboardingNavigatorProps> = ({
  onComplete,
}) => {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("avatar");

  console.log("🎯 OnboardingNavigator rendered, current step:", currentStep);

  const handleNext = () => {
    console.log("➡️ Moving to next step from:", currentStep);
    switch (currentStep) {
      case "avatar":
        setCurrentStep("permissions");
        break;
      case "permissions":
        setCurrentStep("preferences");
        break;
      case "preferences":
        setCurrentStep("recording");
        break;
      case "recording":
        setCurrentStep("completion");
        break;
      case "completion":
        onComplete();
        break;
    }
  };

  const handleBack = () => {
    console.log("⬅️ Moving to previous step from:", currentStep);
    switch (currentStep) {
      case "permissions":
        setCurrentStep("avatar");
        break;
      case "preferences":
        setCurrentStep("permissions");
        break;
      case "recording":
        setCurrentStep("preferences");
        break;
      case "completion":
        setCurrentStep("recording");
        break;
    }
  };

  const handleSkip = () => {
    console.log("⏭️ Skipping step:", currentStep);
    // Skip to next step
    handleNext();
  };

  const handleSurpriseMe = () => {
    console.log("🎲 Surprise me clicked, going to recording");
    // Skip preferences and go to recording
    setCurrentStep("recording");
  };

  console.log("🎯 Rendering step:", currentStep);

  switch (currentStep) {
    case "avatar":
      return <OnboardingScreen onComplete={handleNext} />;

    case "permissions":
      return (
        <PermissionsScreen
          onBack={handleBack}
          onComplete={handleNext}
          onSkip={handleSkip}
        />
      );

    case "preferences":
      return (
        <ContentPreferencesScreen
          onBack={handleBack}
          onComplete={handleNext}
          onSurpriseMe={handleSurpriseMe}
        />
      );

    case "recording":
      return (
        <RecordingScreen
          onBack={handleBack}
          onComplete={handleNext}
          onSkip={handleSkip}
        />
      );

    case "completion":
      return <CompletionScreen onComplete={handleNext} />;

    default:
      console.log("⚠️ Unknown step, defaulting to avatar");
      return <OnboardingScreen onComplete={handleNext} />;
  }
};

export default OnboardingNavigator;
