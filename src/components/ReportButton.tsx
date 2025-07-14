import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  StyleSheet,
} from "react-native";
import { ReportCategory } from "../types";
import { getReportingService } from "../services/reportingService";
import { useAuth } from "../providers/AuthProvider";

interface ReportButtonProps {
  whisperId: string;
  whisperUserDisplayName: string;
  onReportSubmitted?: () => void;
}

const ReportButton: React.FC<ReportButtonProps> = ({
  whisperId,
  whisperUserDisplayName,
  onReportSubmitted,
}) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] =
    useState<ReportCategory | null>(null);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { user } = useAuth();
  const reportingService = getReportingService();

  const reportCategories = [
    {
      category: ReportCategory.HARASSMENT,
      label: "Harassment",
      description: "Bullying, threats, or targeted abuse",
      icon: "🚫",
    },
    {
      category: ReportCategory.HATE_SPEECH,
      label: "Hate Speech",
      description: "Discriminatory or prejudiced content",
      icon: "💔",
    },
    {
      category: ReportCategory.VIOLENCE,
      label: "Violence",
      description: "Threats of harm or violent content",
      icon: "⚔️",
    },
    {
      category: ReportCategory.SEXUAL_CONTENT,
      label: "Sexual Content",
      description: "Inappropriate sexual material",
      icon: "🔞",
    },
    {
      category: ReportCategory.SPAM,
      label: "Spam",
      description: "Unwanted promotional content",
      icon: "📧",
    },
    {
      category: ReportCategory.SCAM,
      label: "Scam",
      description: "Fraudulent or deceptive content",
      icon: "🎭",
    },
    {
      category: ReportCategory.COPYRIGHT,
      label: "Copyright",
      description: "Unauthorized use of copyrighted material",
      icon: "©️",
    },
    {
      category: ReportCategory.PERSONAL_INFO,
      label: "Personal Information",
      description: "Sharing private personal details",
      icon: "👤",
    },
    {
      category: ReportCategory.MINOR_SAFETY,
      label: "Minor Safety",
      description: "Content inappropriate for minors",
      icon: "👶",
    },
    {
      category: ReportCategory.OTHER,
      label: "Other",
      description: "Other violations not listed above",
      icon: "❓",
    },
  ];

  const handleReport = async () => {
    if (!selectedCategory || !reason.trim()) {
      Alert.alert(
        "Incomplete Report",
        "Please select a category and provide a reason for your report."
      );
      return;
    }

    if (!user) {
      Alert.alert("Error", "You must be logged in to submit a report.");
      return;
    }

    setIsSubmitting(true);

    try {
      await reportingService.createReport({
        whisperId,
        reporterId: user.uid,
        reporterDisplayName: user.displayName || "Anonymous",
        category: selectedCategory,
        reason: reason.trim(),
      });

      Alert.alert(
        "Report Submitted",
        "Thank you for your report. Our moderation team will review it shortly.",
        [
          {
            text: "OK",
            onPress: () => {
              setIsModalVisible(false);
              setSelectedCategory(null);
              setReason("");
              onReportSubmitted?.();
            },
          },
        ]
      );
    } catch (error) {
      console.error("Error submitting report:", error);
      Alert.alert("Error", "Failed to submit report. Please try again later.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openReportModal = () => {
    setIsModalVisible(true);
  };

  const closeReportModal = () => {
    if (!isSubmitting) {
      setIsModalVisible(false);
      setSelectedCategory(null);
      setReason("");
    }
  };

  return (
    <>
      <TouchableOpacity style={styles.reportButton} onPress={openReportModal}>
        <Text style={styles.reportButtonText}>🚨 Report</Text>
      </TouchableOpacity>

      <Modal
        visible={isModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeReportModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Report Whisper</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={closeReportModal}
              disabled={isSubmitting}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.whisperInfo}>
              Reporting whisper by: {whisperUserDisplayName}
            </Text>

            <Text style={styles.sectionTitle}>Select Category</Text>
            <View style={styles.categoriesContainer}>
              {reportCategories.map((item) => (
                <TouchableOpacity
                  key={item.category}
                  style={[
                    styles.categoryButton,
                    selectedCategory === item.category &&
                      styles.categoryButtonSelected,
                  ]}
                  onPress={() => setSelectedCategory(item.category)}
                  disabled={isSubmitting}
                >
                  <Text style={styles.categoryIcon}>{item.icon}</Text>
                  <View style={styles.categoryTextContainer}>
                    <Text
                      style={[
                        styles.categoryLabel,
                        selectedCategory === item.category &&
                          styles.categoryLabelSelected,
                      ]}
                    >
                      {item.label}
                    </Text>
                    <Text
                      style={[
                        styles.categoryDescription,
                        selectedCategory === item.category &&
                          styles.categoryDescriptionSelected,
                      ]}
                    >
                      {item.description}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Additional Details</Text>
            <TextInput
              style={styles.reasonInput}
              placeholder="Please provide specific details about why you're reporting this whisper..."
              value={reason}
              onChangeText={setReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable={!isSubmitting}
            />

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (!selectedCategory || !reason.trim() || isSubmitting) &&
                    styles.submitButtonDisabled,
                ]}
                onPress={handleReport}
                disabled={!selectedCategory || !reason.trim() || isSubmitting}
              >
                <Text style={styles.submitButtonText}>
                  {isSubmitting ? "Submitting..." : "Submit Report"}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  reportButton: {
    backgroundColor: "#ff3b30",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginLeft: 8,
  },
  reportButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 24,
    color: "#666",
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  whisperInfo: {
    fontSize: 16,
    color: "#666",
    marginBottom: 20,
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
  },
  categoriesContainer: {
    marginBottom: 24,
  },
  categoryButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: "transparent",
  },
  categoryButtonSelected: {
    backgroundColor: "#e3f2fd",
    borderColor: "#2196f3",
  },
  categoryIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  categoryTextContainer: {
    flex: 1,
  },
  categoryLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 2,
  },
  categoryLabelSelected: {
    color: "#2196f3",
  },
  categoryDescription: {
    fontSize: 14,
    color: "#666",
  },
  categoryDescriptionSelected: {
    color: "#1976d2",
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    marginBottom: 24,
    backgroundColor: "#f8f9fa",
  },
  buttonContainer: {
    marginBottom: 40,
  },
  submitButton: {
    backgroundColor: "#ff3b30",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  submitButtonDisabled: {
    backgroundColor: "#ccc",
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default ReportButton;
