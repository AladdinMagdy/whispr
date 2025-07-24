import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { StatusBar } from "expo-status-bar";

interface CompletionScreenProps {
  onComplete: () => void;
}

const CompletionScreen: React.FC<CompletionScreenProps> = ({ onComplete }) => {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Main Content */}
      <View style={styles.content}>
        {/* UFO Illustration */}
        <View style={styles.ufoContainer}>
          <View style={styles.ufoBody}>
            {/* UFO base */}
            <View style={styles.ufoBase} />
            {/* UFO dome */}
            <View style={styles.ufoDome}>
              <View style={styles.ufoWindow} />
            </View>
            {/* UFO lights */}
            <View style={styles.ufoLights}>
              <View style={styles.ufoLight} />
              <View style={styles.ufoLight} />
              <View style={styles.ufoLight} />
            </View>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>You&apos;re all set.</Text>

        {/* Description */}
        <View style={styles.descriptionContainer}>
          <Text style={styles.description}>
            Your profile is ready, and your first whisper is out there.
          </Text>
          <Text style={styles.description}>Let the echoes begin.</Text>
        </View>
      </View>

      {/* Enter Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.enterButton} onPress={onComplete}>
          <Text style={styles.enterButtonText}>Enter Whispr</Text>
        </TouchableOpacity>
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
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  ufoContainer: {
    marginBottom: 40,
  },
  ufoBody: {
    alignItems: "center",
  },
  ufoBase: {
    width: 120,
    height: 40,
    backgroundColor: "#90EE90",
    borderRadius: 60,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  ufoDome: {
    width: 80,
    height: 40,
    backgroundColor: "#fff",
    borderRadius: 40,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    marginTop: -20,
    justifyContent: "center",
    alignItems: "center",
  },
  ufoWindow: {
    width: 12,
    height: 12,
    backgroundColor: "#000",
    borderRadius: 6,
    transform: [{ rotate: "45deg" }],
  },
  ufoLights: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 8,
    gap: 8,
  },
  ufoLight: {
    width: 8,
    height: 8,
    backgroundColor: "#FFD700",
    borderRadius: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    marginBottom: 24,
  },
  descriptionContainer: {
    alignItems: "center",
  },
  description: {
    fontSize: 16,
    color: "#fff",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 8,
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  enterButton: {
    backgroundColor: "#8B5CF6",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  enterButtonText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
});

export default CompletionScreen;
