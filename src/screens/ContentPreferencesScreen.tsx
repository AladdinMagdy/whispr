import React, { useState } from "react";
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

interface ContentPreferencesScreenProps {
  onBack: () => void;
  onComplete: () => void;
  onSurpriseMe: () => void;
}

const ContentPreferencesScreen: React.FC<ContentPreferencesScreenProps> = ({
  onBack,
  onComplete,
  onSurpriseMe,
}) => {
  const [selectedPreferences, setSelectedPreferences] = useState<string[]>([]);

  console.log("🎭 ContentPreferencesScreen rendered");

  const preferences = [
    { id: "confessions", label: "Confessions", emoji: "🎭" },
    { id: "deep-thoughts", label: "Deep thoughts", emoji: "🧠" },
    { id: "heartbreak", label: "Heartbreak", emoji: "💔" },
    { id: "funny-shit", label: "Funny shit", emoji: "😂" },
    { id: "random-chaos", label: "Random chaos", emoji: "🌀" },
    { id: "raw-rants", label: "Raw rants", emoji: "🎤" },
    { id: "advice", label: "Advice", emoji: "📜" },
    { id: "venting", label: "Venting", emoji: "☁️" },
    { id: "ideas", label: "Ideas", emoji: "🚀" },
    { id: "audio-aesthetics", label: "Audio aesthetics", emoji: "🔊" },
  ];

  const togglePreference = (id: string) => {
    setSelectedPreferences((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

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

        {/* Title */}
        <View style={styles.titleContainer}>
          <Text style={[globalStyles.h1, styles.title]}>
            What do you want to hear more of?
          </Text>
          <Text style={[globalStyles.bodyMedium, styles.subtitle]}>
            Choose your favorite whisper vibes.
          </Text>
        </View>

        {/* Preferences Grid */}
        <View style={styles.preferencesContainer}>
          <View style={styles.preferencesGrid}>
            {preferences.map((pref) => (
              <TouchableOpacity
                key={pref.id}
                style={[
                  styles.preferenceButton,
                  selectedPreferences.includes(pref.id) &&
                    styles.selectedPreferenceButton,
                ]}
                onPress={() => togglePreference(pref.id)}
              >
                <Text style={styles.preferenceEmoji}>{pref.emoji}</Text>
                <Text style={[globalStyles.bodyMedium, styles.preferenceText]}>
                  {pref.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Progress Dots */}
        <View style={styles.progressContainer}>
          <View style={styles.progressDots}>
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={[styles.dot, styles.activeDot]} />
            <View style={styles.dot} />
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.primaryButton,
              selectedPreferences.length === 0 && styles.disabledButton,
            ]}
            onPress={onComplete}
            disabled={selectedPreferences.length === 0}
          >
            <Text
              style={[globalStyles.buttonTextLarge, styles.primaryButtonText]}
            >
              Next
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={onSurpriseMe}
          >
            <Text style={[globalStyles.bodyMedium, styles.secondaryButtonText]}>
              Surprise me
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
  titleContainer: {
    marginBottom: 32,
  },
  title: {
    textAlign: "left",
    marginBottom: 8,
  },
  subtitle: {
    textAlign: "left",
    color: "rgba(255, 255, 255, 0.8)",
  },
  preferencesContainer: {
    flex: 1,
  },
  preferencesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  preferenceButton: {
    width: "48%",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  selectedPreferenceButton: {
    borderColor: "#8B5CF6",
    backgroundColor: "rgba(139, 92, 246, 0.2)",
  },
  preferenceEmoji: {
    fontSize: 20,
    marginRight: 12,
  },
  preferenceText: {
    flex: 1,
    textAlign: "left",
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
  disabledButton: {
    backgroundColor: "rgba(139, 92, 246, 0.5)",
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

export default ContentPreferencesScreen;
