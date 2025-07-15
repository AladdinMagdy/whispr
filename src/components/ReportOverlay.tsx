import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

interface ReportOverlayProps {
  onShowPost: () => void;
}

const ReportOverlay: React.FC<ReportOverlayProps> = ({ onShowPost }) => {
  return (
    <View style={styles.container}>
      {/* Blurred background */}
      <View style={styles.blurContainer}>
        <View style={styles.content}>
          {/* Thank you message */}
          <View style={styles.messageContainer}>
            <Text style={styles.thankYouText}>
              Thanks for reporting this post.
            </Text>
            <Text style={styles.descriptionText}>
              Your feedback is important in helping us keep the Whispr community
              safe.
            </Text>
          </View>

          {/* Show Post button */}
          <TouchableOpacity style={styles.showPostButton} onPress={onShowPost}>
            <Text style={styles.showPostButtonText}>Show Post</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  blurContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  content: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 16,
    padding: 24,
    margin: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  messageContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  thankYouText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
  },
  showPostButton: {
    backgroundColor: "#007AFF",
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 32,
    minWidth: 120,
  },
  showPostButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
  },
});

export default ReportOverlay;
