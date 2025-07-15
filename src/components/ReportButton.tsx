import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { ReportCategory, Report } from "../types";
import { getReportingService } from "../services/reportingService";
import { useAuth } from "../providers/AuthProvider";
import { useFeedStore } from "../store/useFeedStore";

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
  const [hasReported, setHasReported] = useState(false);
  const [existingReport, setExistingReport] = useState<Report | null>(null);
  const [isCheckingReport, setIsCheckingReport] = useState(false);

  const { user } = useAuth();
  const reportingService = getReportingService();
  const { markWhisperAsReported } = useFeedStore();

  // Check if user has already reported this content
  useEffect(() => {
    const checkExistingReport = async () => {
      if (!user) return;

      setIsCheckingReport(true);
      try {
        const result = await reportingService.hasUserReportedContent(
          whisperId,
          user.uid
        );
        setHasReported(result.hasReported);
        setExistingReport(result.existingReport || null);
      } catch (error) {
        console.error("Error checking existing report:", error);
      } finally {
        setIsCheckingReport(false);
      }
    };

    checkExistingReport();
  }, [whisperId, user, reportingService]);

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
      const report = await reportingService.createReport({
        whisperId,
        reporterId: user.uid,
        reporterDisplayName: user.displayName || "Anonymous",
        category: selectedCategory,
        reason: reason.trim(),
      });

      // Mark the whisper as reported in the feed store
      markWhisperAsReported(whisperId);

      // Check if this was an update to an existing report
      const isUpdate =
        report.updatedAt.getTime() !== report.createdAt.getTime();

      if (isUpdate) {
        Alert.alert(
          "Report Updated",
          "Your report has been updated with additional information. This helps our moderation team better understand the issue.",
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
      } else {
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
      }
    } catch (error) {
      console.error("Error submitting report:", error);
      Alert.alert("Error", "Failed to submit report. Please try again later.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openReportModal = () => {
    // If user has already reported, show their existing report
    if (hasReported && existingReport) {
      Alert.alert(
        "Already Reported",
        `You have already reported this content for "${existingReport.category}". You can report it again for a different reason or add additional information.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Report Again", onPress: () => setIsModalVisible(true) },
        ]
      );
    } else {
      setIsModalVisible(true);
    }
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
      <TouchableOpacity
        onPress={openReportModal}
        style={[
          styles.reportButton,
          hasReported && styles.reportButtonReported,
        ]}
        disabled={isCheckingReport}
      >
        {isCheckingReport ? (
          <ActivityIndicator size="small" color="#666" />
        ) : (
          <Text
            style={[
              styles.reportButtonText,
              hasReported && styles.reportButtonTextReported,
            ]}
          >
            {hasReported ? "📝 Reported" : "🚨 Report"}
          </Text>
        )}
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
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 8,
  },
  reportButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  reportButtonReported: {
    backgroundColor: "#ccc",
  },
  reportButtonTextReported: {
    color: "#666",
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
