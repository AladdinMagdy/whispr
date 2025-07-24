import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { globalStyles } from "../utils/styles";

interface AgeRestrictionScreenProps {
  userAge: number;
  onGoBack: () => void;
  onRemindMeLater?: () => void;
}

const AgeRestrictionScreen: React.FC<AgeRestrictionScreenProps> = ({
  userAge,
  onGoBack,
  onRemindMeLater,
}) => {
  const yearsUntilEligible = 13 - userAge;
  const isPlural = yearsUntilEligible > 1;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onGoBack}
            testID="back-button"
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Main Content */}
        <View style={styles.content}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <View style={styles.iconBackground}>
              <Ionicons name="shield-checkmark" size={48} color="#fff" />
            </View>
          </View>

          {/* Title */}
          <Text style={[globalStyles.h2, styles.title]}>Age Requirement</Text>

          {/* Message */}
          <Text style={[globalStyles.bodyLarge, styles.message]}>
            We&apos;re sorry, but you need to be at least 13 years old to use
            Whispr.
          </Text>

          {/* Age Info */}
          <View style={styles.ageInfoContainer}>
            <Text style={[globalStyles.bodyMedium, styles.ageInfoText]}>
              You are currently{" "}
              <Text style={styles.ageHighlight}>{userAge} years old</Text>
            </Text>
            <Text style={[globalStyles.bodyMedium, styles.ageInfoText]}>
              You&apos;ll be eligible in{" "}
              <Text style={styles.ageHighlight}>
                {yearsUntilEligible} year{isPlural ? "s" : ""}
              </Text>
            </Text>
          </View>

          {/* Why Section */}
          <View style={styles.whySection}>
            <Text style={[globalStyles.h4, styles.whyTitle]}>
              Why do we have this requirement?
            </Text>
            <View style={styles.whyPoints}>
              <View style={styles.whyPoint}>
                <Ionicons name="shield-outline" size={20} color="#8B9DC3" />
                <Text style={[globalStyles.bodyMedium, styles.whyPointText]}>
                  To protect your privacy and safety
                </Text>
              </View>
              <View style={styles.whyPoint}>
                <Ionicons name="school-outline" size={20} color="#8B9DC3" />
                <Text style={[globalStyles.bodyMedium, styles.whyPointText]}>
                  To comply with child protection laws
                </Text>
              </View>
              <View style={styles.whyPoint}>
                <Ionicons name="heart-outline" size={20} color="#8B9DC3" />
                <Text style={[globalStyles.bodyMedium, styles.whyPointText]}>
                  To ensure age-appropriate content
                </Text>
              </View>
            </View>
          </View>

          {/* What You Can Do */}
          <View style={styles.alternativesSection}>
            <Text style={[globalStyles.h4, styles.alternativesTitle]}>
              What you can do instead:
            </Text>
            <View style={styles.alternatives}>
              <View style={styles.alternative}>
                <Ionicons name="time-outline" size={20} color="#8B9DC3" />
                <Text style={[globalStyles.bodyMedium, styles.alternativeText]}>
                  Wait until you&apos;re 13 years old
                </Text>
              </View>
              <View style={styles.alternative}>
                <Ionicons name="people-outline" size={20} color="#8B9DC3" />
                <Text style={[globalStyles.bodyMedium, styles.alternativeText]}>
                  Ask a parent or guardian about age-appropriate apps
                </Text>
              </View>
              <View style={styles.alternative}>
                <Ionicons name="library-outline" size={20} color="#8B9DC3" />
                <Text style={[globalStyles.bodyMedium, styles.alternativeText]}>
                  Explore other creative outlets like writing or drawing
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.primaryButton} onPress={onGoBack}>
            <Text
              style={[globalStyles.buttonTextLarge, styles.primaryButtonText]}
            >
              Go Back & Change Age
            </Text>
          </TouchableOpacity>

          {onRemindMeLater && (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onRemindMeLater}
            >
              <Text
                style={[globalStyles.bodyMedium, styles.secondaryButtonText]}
              >
                Remind Me When I&apos;m 13
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
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
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 40,
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  content: {
    flex: 1,
    alignItems: "center",
  },
  iconContainer: {
    marginBottom: 32,
  },
  iconBackground: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    // Subtle glow effect
    shadowColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  title: {
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 16,
  },
  message: {
    color: "#E8F0FF",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 24,
  },
  ageInfoContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    width: "100%",
    alignItems: "center",
    // Subtle border
    borderWidth: 1,
    borderColor: "rgba(227, 222, 255, 0.1)",
  },
  ageInfoText: {
    color: "#E8F0FF",
    textAlign: "center",
    marginBottom: 4,
  },
  ageHighlight: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  whySection: {
    width: "100%",
    marginBottom: 32,
  },
  whyTitle: {
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 20,
  },
  whyPoints: {
    gap: 16,
  },
  whyPoint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  whyPointText: {
    color: "#E8F0FF",
    flex: 1,
    lineHeight: 20,
  },
  alternativesSection: {
    width: "100%",
    marginBottom: 40,
  },
  alternativesTitle: {
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 20,
  },
  alternatives: {
    gap: 16,
  },
  alternative: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  alternativeText: {
    color: "#E8F0FF",
    flex: 1,
    lineHeight: 20,
  },
  actions: {
    gap: 16,
  },
  primaryButton: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
    // Subtle glow
    shadowColor: "#E8F0FF",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: "#FFFFFF",
  },
  secondaryButton: {
    padding: 16,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#8B9DC3",
  },
});

export default AgeRestrictionScreen;
