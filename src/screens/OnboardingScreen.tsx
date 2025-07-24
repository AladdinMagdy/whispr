import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Platform,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import DateTimePicker from "@react-native-community/datetimepicker";
import { globalStyles } from "../utils/styles";
import { calculateAge } from "../utils/ageVerificationUtils";
import AgeRestrictionScreen from "../components/AgeRestrictionScreen";

// Import SVG avatars
import UserAvatar1 from "../../assets/user-avatar-1.svg";
import UserAvatar2 from "../../assets/user-avatar-2.svg";
import UserAvatar3 from "../../assets/user-avatar-3.svg";
import UserAvatar4 from "../../assets/user-avatar-4.svg";

interface OnboardingScreenProps {
  onComplete: () => void;
}

// Custom component for blurred avatar cards with subtle adjustments
const BlurredAvatarCard: React.FC<{
  children: React.ReactNode;
  isSelected: boolean;
  onPress: () => void;
}> = ({ children, isSelected, onPress }) => {
  return (
    <TouchableOpacity
      style={styles.avatarCardWrapper}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <BlurView intensity={20} style={styles.blurContainer}>
        <View
          style={[styles.avatarCard, isSelected && styles.selectedAvatarCard]}
        >
          {/* Content layer */}
          <View style={styles.avatarContent}>{children}</View>
        </View>
      </BlurView>
    </TouchableOpacity>
  );
};

const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const [selectedAvatar, setSelectedAvatar] = useState(0);
  const [username, setUsername] = useState("Floovari");
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(true);
  const [showAgeRestriction, setShowAgeRestriction] = useState(false);
  const [userAge, setUserAge] = useState<number | null>(null);
  const [tempDate, setTempDate] = useState<Date | null>(null); // For iOS intermediate selections

  console.log("🎭 OnboardingScreen rendered");

  const avatars = [
    {
      id: 0,
      Component: UserAvatar1,
      color: "#90EE90",
    },
    {
      id: 1,
      Component: UserAvatar2,
      color: "#DDA0DD",
    },
    {
      id: 2,
      Component: UserAvatar3,
      color: "#FF6B6B",
    },
    {
      id: 3,
      Component: UserAvatar4,
      color: "#98FB98",
    },
  ];

  const generateNewUsername = () => {
    const usernames = ["Floovari", "Zephyrix", "Nebulix", "Cosmara", "Stellix"];
    const randomIndex = Math.floor(Math.random() * usernames.length);
    setUsername(usernames[randomIndex]);
  };

  const handleDateChange = (_event: unknown, selectedDate?: Date) => {
    if (Platform.OS === "ios") {
      // On iOS, the picker shows a spinner and onChange fires for each change
      // We store the intermediate selection in tempDate
      if (selectedDate) {
        setTempDate(selectedDate);
      } else {
        // User cancelled
        setShowDatePicker(false);
        setTempDate(null);
      }
    } else {
      // On Android, the picker shows a calendar and onChange fires only on final selection
      if (selectedDate) {
        setShowDatePicker(false);
        setBirthDate(selectedDate);
        processAgeVerification(selectedDate);
      } else {
        // User cancelled
        setShowDatePicker(false);
      }
    }
  };

  const processAgeVerification = (date: Date) => {
    const age = calculateAge(date);
    setUserAge(age);

    if (age < 13) {
      setShowAgeRestriction(true);
    }
  };

  const handleDatePickerConfirm = () => {
    if (tempDate) {
      setShowDatePicker(false);
      setBirthDate(tempDate);
      setTempDate(null);
      processAgeVerification(tempDate);
    }
  };

  const handleDatePickerCancel = () => {
    setShowDatePicker(false);
    setTempDate(null);
  };

  const formatDate = (date: Date) => {
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const handleNext = () => {
    console.log("🎭 OnboardingScreen: Next button pressed");
    if (birthDate && agreedToTerms) {
      // Final age verification before proceeding
      if (userAge && userAge >= 13) {
        onComplete();
      } else {
        // This should not happen as we check age when date is selected
        console.error("Age verification failed");
      }
    }
  };

  const handleGoBackFromAgeRestriction = () => {
    setShowAgeRestriction(false);
    setBirthDate(null);
    setUserAge(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {showAgeRestriction && userAge ? (
        <AgeRestrictionScreen
          userAge={userAge}
          onGoBack={handleGoBackFromAgeRestriction}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Title */}
          <View style={styles.titleContainer}>
            <Text style={[globalStyles.h4, styles.title]}>Say it.</Text>
            <Text style={[globalStyles.h1, styles.subtitle]}>Whisper it.</Text>
          </View>

          {/* Avatar Selection */}
          <View style={styles.section}>
            <Text style={[globalStyles.h4, styles.sectionTitle]}>
              Your Avatar
            </Text>
            <View style={styles.avatarGrid}>
              {avatars.map((avatar) => {
                const AvatarComponent = avatar.Component;
                return (
                  <BlurredAvatarCard
                    key={avatar.id}
                    isSelected={selectedAvatar === avatar.id}
                    onPress={() => setSelectedAvatar(avatar.id)}
                  >
                    <AvatarComponent
                      style={styles.avatarImage}
                      width={70}
                      height={70}
                    />
                  </BlurredAvatarCard>
                );
              })}
            </View>
          </View>

          {/* Username */}
          <View style={styles.section}>
            <Text style={[globalStyles.h4, styles.sectionTitle]}>
              You Are...
            </Text>
            <View style={styles.usernameContainer}>
              <Text style={[globalStyles.bodyLarge, styles.usernameText]}>
                {username}
              </Text>
            </View>
            <TouchableOpacity onPress={generateNewUsername}>
              <Text style={[globalStyles.bodySmall, styles.generateText]}>
                Not you?{" "}
                <Text style={styles.generateLink}>Generate Another</Text>
              </Text>
            </TouchableOpacity>
          </View>

          {/* Age Input */}
          <View style={styles.section}>
            <Text style={[globalStyles.h4, styles.sectionTitle]}>Your Age</Text>
            <TouchableOpacity
              style={styles.ageInput}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.8}
            >
              <Text style={[globalStyles.bodyMedium, styles.ageInputText]}>
                {birthDate ? formatDate(birthDate) : "dd/mm/yyyy"}
              </Text>
              <Ionicons name="calendar-outline" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Terms of Use */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.termsContainer}
              onPress={() => setAgreedToTerms(!agreedToTerms)}
            >
              <View style={styles.checkboxContainer}>
                {agreedToTerms ? (
                  <View style={styles.checkedBox}>
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  </View>
                ) : (
                  <View style={styles.uncheckedBox} />
                )}
              </View>
              <Text style={[globalStyles.bodyMedium, styles.termsText]}>
                I agree to the{" "}
                <Text style={styles.termsLink}>Terms of Use</Text>
              </Text>
            </TouchableOpacity>
          </View>

          {/* Progress Dots */}
          <View style={styles.progressContainer}>
            <View style={styles.progressDots}>
              <View style={[styles.dot, styles.activeDot]} />
              <View style={styles.dot} />
              <View style={styles.dot} />
              <View style={styles.dot} />
            </View>
          </View>

          {/* Next Button */}
          <TouchableOpacity
            style={[
              styles.nextButton,
              (!birthDate || !agreedToTerms) && styles.disabledButton,
            ]}
            onPress={handleNext}
            disabled={!birthDate || !agreedToTerms}
          >
            <Text style={[globalStyles.buttonTextLarge, styles.nextButtonText]}>
              Next
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}
      {showDatePicker && (
        <View style={styles.datePickerOverlay}>
          <View style={styles.datePickerContainer}>
            <DateTimePicker
              value={tempDate || birthDate || new Date()}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={handleDateChange}
              testID="date-picker"
              maximumDate={new Date()} // Prevent future dates
              minimumDate={new Date(1900, 0, 1)} // Prevent unreasonable ages (before 1900)
            />
            {Platform.OS === "ios" && (
              <View style={styles.datePickerButtons}>
                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={handleDatePickerCancel}
                >
                  <Text style={styles.datePickerButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.datePickerButton,
                    styles.datePickerConfirmButton,
                  ]}
                  onPress={handleDatePickerConfirm}
                >
                  <Text
                    style={[
                      styles.datePickerButtonText,
                      styles.datePickerConfirmButtonText,
                    ]}
                  >
                    Done
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  titleContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  title: {
    marginBottom: 4,
  },
  subtitle: {
    // Font styles are applied via globalStyles
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    marginBottom: 16,
  },
  avatarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  avatarCardWrapper: {
    width: "48.305%",
    // Very subtle outer glow to match the design
    shadowColor: "#FFFFFF",
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  blurContainer: {
    borderRadius: 30,
    overflow: "hidden",
  },
  avatarCard: {
    width: "100%",
    // aspectRatio: 1,
    backgroundColor: "rgba(255, 255, 255, 0.05)", // Very subtle translucent background
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    borderWidth: 3,
    borderColor: "rgba(255, 255, 255, 0.1)", // Subtle border
    position: "relative",
  },
  selectedAvatarCard: {
    borderColor: "rgba(185, 167, 255, 0.7)", // Light purple border for selected
    borderWidth: 3,
    backgroundColor: "rgba(139, 92, 246, 0.03)", // Very subtle purple tint
  },
  avatarImage: {
    // SVG components will handle their own styling
  },
  usernameContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    // Very subtle outer glow to match the design
    shadowColor: "#FFFFFF",
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 1,
    // Inset shadow effect
    borderWidth: 1,
    borderColor: "rgba(227, 222, 255, 0.1)",
  },
  usernameText: {
    textAlign: "left",
  },
  generateText: {
    textAlign: "left",
  },
  generateLink: {
    color: "#B9A7FF",
    fontWeight: "600",
  },
  ageInput: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 12,
    padding: 16,
    // Inset shadow effect
    borderWidth: 1,
    borderColor: "rgba(227, 222, 255, 0.1)",
    // Very subtle outer glow to match the design
    shadowColor: "#FFFFFF",
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  ageInputText: {
    flex: 1,
    marginRight: 8,
  },
  termsContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkboxContainer: {
    marginRight: 12,
  },
  checkedBox: {
    width: 20,
    height: 20,
    backgroundColor: "#8B5CF6",
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  uncheckedBox: {
    width: 20,
    height: 20,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  termsText: {
    flex: 1,
  },
  termsLink: {
    color: "#8B5CF6",
    fontWeight: "600",
  },
  progressContainer: {
    alignItems: "center",
    marginVertical: 32,
  },
  progressDots: {
    flexDirection: "row",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  activeDot: {
    backgroundColor: "#fff",
  },
  nextButton: {
    backgroundColor: "#8B5CF6",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 20,
    // Subtle shadow to match the design
    shadowColor: "#8B5CF6",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  disabledButton: {
    backgroundColor: "rgba(139, 92, 246, 0.5)",
  },
  nextButtonText: {
    // Font styles are applied via globalStyles
  },
  avatarContent: {
    position: "relative",
    zIndex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  datePickerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  datePickerContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    width: "90%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  datePickerButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginTop: 20,
    gap: 12,
  },
  datePickerButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    alignItems: "center",
  },
  datePickerButtonText: {
    color: "#374151",
    fontSize: 16,
    fontWeight: "500",
  },
  datePickerConfirmButton: {
    backgroundColor: "#8B5CF6",
    borderColor: "#8B5CF6",
  },
  datePickerConfirmButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
});

export default OnboardingScreen;
