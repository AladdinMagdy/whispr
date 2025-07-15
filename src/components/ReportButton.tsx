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
  const [isPostReportModalVisible, setIsPostReportModalVisible] =
    useState(false);
  const [selectedCategory, setSelectedCategory] =
    useState<ReportCategory | null>(null);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasReported, setHasReported] = useState(false);
  const [existingReport, setExistingReport] = useState<Report | null>(null);
  const [isCheckingReport, setIsCheckingReport] = useState(false);
  const [currentReport, setCurrentReport] = useState<Report | null>(null);

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

      // Store the current report and show post-report modal
      setCurrentReport(report);
      setIsModalVisible(false);
      setIsPostReportModalVisible(true);
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

  const closePostReportModal = () => {
    setIsPostReportModalVisible(false);
    setCurrentReport(null);
    setSelectedCategory(null);
    setReason("");
    onReportSubmitted?.();
  };

  const handleMuteUser = () => {
    Alert.alert(
      "Mute User",
      `You won't see content from ${whisperUserDisplayName} in your feed anymore. You can unmute them anytime in your settings.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mute",
          style: "destructive",
          onPress: () => {
            // TODO: Implement mute user functionality
            Alert.alert(
              "User Muted",
              `${whisperUserDisplayName} has been muted.`
            );
            closePostReportModal();
          },
        },
      ]
    );
  };

  const handleRestrictUser = () => {
    Alert.alert(
      "Restrict User",
      `${whisperUserDisplayName} won't be able to see when you're online or when you've read their messages.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restrict",
          style: "destructive",
          onPress: () => {
            // TODO: Implement restrict user functionality
            Alert.alert(
              "User Restricted",
              `${whisperUserDisplayName} has been restricted.`
            );
            closePostReportModal();
          },
        },
      ]
    );
  };

  const handleBlockUser = () => {
    Alert.alert(
      "Block User",
      `${whisperUserDisplayName} won't be able to find your profile, see your posts, or start conversations with you.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: () => {
            // TODO: Implement block user functionality
            Alert.alert(
              "User Blocked",
              `${whisperUserDisplayName} has been blocked.`
            );
            closePostReportModal();
          },
        },
      ]
    );
  };

  const handleLearnMore = () => {
    Alert.alert(
      "Community Standards",
      "Our community standards help ensure Whispr remains a safe and welcoming space for everyone. We review reports within 24 hours and take appropriate action based on our policies.",
      [{ text: "OK" }]
    );
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

      {/* Post-Report Modal */}
      <Modal
        visible={isPostReportModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closePostReportModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Report Submitted</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={closePostReportModal}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Report Status */}
            <View style={styles.statusContainer}>
              <Text style={styles.statusTitle}>Report Status</Text>
              <View style={styles.statusItem}>
                <Text style={styles.statusLabel}>Status:</Text>
                <Text style={styles.statusValue}>Awaiting Review</Text>
              </View>
              {currentReport && (
                <View style={styles.statusItem}>
                  <Text style={styles.statusLabel}>Report ID:</Text>
                  <Text style={styles.statusValue}>{currentReport.id}</Text>
                </View>
              )}
              <Text style={styles.statusDescription}>
                Our moderation team will review your report within 24 hours and
                take appropriate action.
              </Text>
            </View>

            {/* User Actions */}
            <View style={styles.actionsContainer}>
              <Text style={styles.sectionTitle}>Additional Actions</Text>
              <Text style={styles.actionsDescription}>
                You can also take action to control your experience with this
                user:
              </Text>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleMuteUser}
              >
                <Text style={styles.actionIcon}>🔇</Text>
                <View style={styles.actionTextContainer}>
                  <Text style={styles.actionLabel}>Mute User</Text>
                  <Text style={styles.actionDescription}>
                    Stop seeing content from {whisperUserDisplayName}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleRestrictUser}
              >
                <Text style={styles.actionIcon}>🚫</Text>
                <View style={styles.actionTextContainer}>
                  <Text style={styles.actionLabel}>Restrict User</Text>
                  <Text style={styles.actionDescription}>
                    Limit their ability to interact with you
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleBlockUser}
              >
                <Text style={styles.actionIcon}>🚫</Text>
                <View style={styles.actionTextContainer}>
                  <Text style={styles.actionLabel}>Block User</Text>
                  <Text style={styles.actionDescription}>
                    Completely block {whisperUserDisplayName}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Learn More */}
            <View style={styles.learnMoreContainer}>
              <TouchableOpacity
                style={styles.learnMoreButton}
                onPress={handleLearnMore}
              >
                <Text style={styles.learnMoreText}>
                  Learn more about our process and community standards
                </Text>
              </TouchableOpacity>
            </View>

            {/* Done Button */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.doneButton}
                onPress={closePostReportModal}
              >
                <Text style={styles.doneButtonText}>Done</Text>
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
  // Post-report modal styles
  statusContainer: {
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
  },
  statusItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  statusValue: {
    fontSize: 14,
    color: "#333",
    fontWeight: "bold",
  },
  statusDescription: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
    marginTop: 8,
  },
  actionsContainer: {
    marginBottom: 24,
  },
  actionsDescription: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
    lineHeight: 20,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e9ecef",
  },
  actionIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 2,
  },
  actionDescription: {
    fontSize: 14,
    color: "#666",
  },
  learnMoreContainer: {
    marginBottom: 24,
  },
  learnMoreButton: {
    padding: 16,
    backgroundColor: "#e3f2fd",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2196f3",
  },
  learnMoreText: {
    fontSize: 14,
    color: "#1976d2",
    textAlign: "center",
    fontWeight: "500",
  },
  doneButton: {
    backgroundColor: "#007AFF",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  doneButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default ReportButton;
