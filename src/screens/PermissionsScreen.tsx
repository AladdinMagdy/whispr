import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { globalStyles } from "../utils/styles";

// Import the permissions icon
import AllowNotificationsIcon from "../../assets/allow-notifications-icon.svg";

interface PermissionsScreenProps {
  onBack: () => void;
  onComplete: () => void;
  onSkip: () => void;
}

const PermissionsScreen: React.FC<PermissionsScreenProps> = ({
  onBack,
  onComplete,
  onSkip,
}) => {
  console.log("🔔 PermissionsScreen rendered");

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
            <Text style={[globalStyles.bodyMedium, styles.backText]}>Back</Text>
          </TouchableOpacity>
        </View>

        {/* Main Content */}
        <View style={styles.mainContent}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <View style={styles.iconBackground}>
              <AllowNotificationsIcon width={80} height={80} />
            </View>
          </View>

          {/* Title */}
          <Text style={[globalStyles.h1, styles.title]}>
            Let your whispers echo
          </Text>

          {/* Description */}
          <View style={styles.descriptionContainer}>
            <Text style={[globalStyles.bodyMedium, styles.description]}>
              Allow notifications so we can let you know when
            </Text>
            <Text style={[globalStyles.bodyMedium, styles.description]}>
              someone reacts to your voice.
            </Text>
            <Text style={[globalStyles.bodyMedium, styles.description]}>
              Enable location to hear whispers near you
            </Text>
            <Text style={[globalStyles.bodyMedium, styles.description]}>
              anonymously and safely.
            </Text>
          </View>
        </View>

        {/* Progress Dots */}
        <View style={styles.progressContainer}>
          <View style={styles.progressDots}>
            <View style={styles.dot} />
            <View style={[styles.dot, styles.activeDot]} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.primaryButton} onPress={onComplete}>
            <Text
              style={[globalStyles.buttonTextLarge, styles.primaryButtonText]}
            >
              Enable And Continue
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={onSkip}>
            <Text style={[globalStyles.bodyMedium, styles.secondaryButtonText]}>
              Maybe later
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 40,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
  },
  backText: {
    marginLeft: 8,
  },
  mainContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  iconContainer: {
    marginBottom: 40,
    alignSelf: "center",
  },
  iconBackground: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    textAlign: "left",
    marginBottom: 24,
  },
  descriptionContainer: {
    alignItems: "flex-start",
  },
  description: {
    textAlign: "left",
    marginBottom: 4,
    lineHeight: 22,
  },
  progressContainer: {
    alignItems: "center",
    marginVertical: 40,
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
  buttonContainer: {
    alignItems: "center",
  },
  primaryButton: {
    backgroundColor: "#8B5CF6",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: "center",
    marginBottom: 16,
    width: "100%",
  },
  primaryButtonText: {
    color: "#fff",
  },
  secondaryButton: {
    paddingVertical: 8,
  },
  secondaryButtonText: {
    color: "#fff",
    textAlign: "center",
  },
});

export default PermissionsScreen;
