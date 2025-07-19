import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Card, Button, Chip } from "react-native-paper";
import { useAuth } from "../providers/AuthProvider";
import { getAppealService } from "../services/appealService";
import { getPrivacyService } from "../services/privacyService";
import { Appeal, AppealStatus, UserViolation } from "../types";

const AppealScreen = () => {
  const { user } = useAuth();
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [violations, setViolations] = useState<UserViolation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAppealModal, setShowAppealModal] = useState(false);
  const [selectedViolation, setSelectedViolation] =
    useState<UserViolation | null>(null);
  const [appealReason, setAppealReason] = useState("");
  const [submittingAppeal, setSubmittingAppeal] = useState(false);

  const loadAppealData = useCallback(async () => {
    if (!user?.uid) return;

    try {
      setLoading(true);
      const appealService = getAppealService();
      const privacyService = getPrivacyService();

      // Load appeals and violations in parallel
      const [userAppeals, userViolations] = await Promise.all([
        appealService.getUserAppeals(user.uid),
        privacyService.getUserViolations(user.uid, 90), // Last 90 days
      ]);

      setAppeals(userAppeals);
      setViolations(userViolations);
    } catch (error) {
      console.error("Error loading appeal data:", error);
      Alert.alert("Error", "Failed to load appeal data");
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAppealData();
    setRefreshing(false);
  }, [loadAppealData]);

  useEffect(() => {
    loadAppealData();
  }, [loadAppealData]);

  const handleCreateAppeal = async () => {
    if (!selectedViolation || !appealReason.trim()) {
      Alert.alert("Error", "Please select a violation and provide a reason");
      return;
    }

    try {
      setSubmittingAppeal(true);
      const appealService = getAppealService();

      await appealService.createAppeal({
        userId: user!.uid,
        whisperId: selectedViolation.whisperId,
        violationId: selectedViolation.id,
        reason: appealReason.trim(),
      });

      Alert.alert(
        "Appeal Submitted",
        "Your appeal has been submitted and will be reviewed. You'll be notified of the decision.",
        [{ text: "OK" }]
      );

      // Reset form and close modal
      setShowAppealModal(false);
      setSelectedViolation(null);
      setAppealReason("");

      // Refresh data
      await loadAppealData();
    } catch (error) {
      console.error("Error submitting appeal:", error);
      Alert.alert("Error", "Failed to submit appeal. Please try again.");
    } finally {
      setSubmittingAppeal(false);
    }
  };

  const getAppealStatusColor = (status: AppealStatus): string => {
    switch (status) {
      case AppealStatus.PENDING:
        return "#FFA500"; // Orange
      case AppealStatus.UNDER_REVIEW:
        return "#007AFF"; // Blue
      case AppealStatus.APPROVED:
        return "#4CAF50"; // Green
      case AppealStatus.REJECTED:
        return "#F44336"; // Red
      case AppealStatus.EXPIRED:
        return "#9E9E9E"; // Gray
      default:
        return "#666";
    }
  };

  const getAppealStatusText = (status: AppealStatus): string => {
    switch (status) {
      case AppealStatus.PENDING:
        return "Pending Review";
      case AppealStatus.UNDER_REVIEW:
        return "Under Review";
      case AppealStatus.APPROVED:
        return "Approved";
      case AppealStatus.REJECTED:
        return "Rejected";
      case AppealStatus.EXPIRED:
        return "Expired";
      default:
        return "Unknown";
    }
  };

  const getViolationTypeText = (type: string): string => {
    switch (type) {
      case "whisper_deleted":
        return "Whisper Deleted";
      case "whisper_flagged":
        return "Whisper Flagged";
      case "temporary_ban":
        return "Temporary Ban";
      case "extended_ban":
        return "Extended Ban";
      default:
        return type.replace("_", " ").toUpperCase();
    }
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const canAppealViolation = (violation: UserViolation): boolean => {
    // Can appeal if violation is recent (within appeal window) and not already appealed
    const daysSinceViolation = Math.floor(
      (Date.now() - violation.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Check if there's already an appeal for this violation
    const hasExistingAppeal = appeals.some(
      (appeal) => appeal.violationId === violation.id
    );

    return daysSinceViolation <= 30 && !hasExistingAppeal;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading appeals...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Appeals Center</Text>
        <Text style={styles.subtitle}>
          Challenge moderation decisions and restore your content
        </Text>
      </View>

      {/* Appealable Violations */}
      {violations.filter(canAppealViolation).length > 0 && (
        <Card style={styles.section}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Appealable Actions</Text>
            <Text style={styles.sectionSubtitle}>
              You can appeal these recent moderation actions:
            </Text>

            {violations.filter(canAppealViolation).map((violation) => (
              <View key={violation.id} style={styles.violationItem}>
                <View style={styles.violationHeader}>
                  <Text style={styles.violationType}>
                    {getViolationTypeText(violation.violationType)}
                  </Text>
                  <Chip
                    mode="outlined"
                    textStyle={{ fontSize: 12 }}
                    style={styles.violationChip}
                  >
                    {violation.reportCount || 0} reports
                  </Chip>
                </View>
                <Text style={styles.violationReason}>{violation.reason}</Text>
                <Text style={styles.violationDate}>
                  {formatDate(violation.createdAt)}
                </Text>
                <Button
                  mode="contained"
                  onPress={() => {
                    setSelectedViolation(violation);
                    setShowAppealModal(true);
                  }}
                  style={styles.appealButton}
                >
                  Appeal This Action
                </Button>
              </View>
            ))}
          </Card.Content>
        </Card>
      )}

      {/* Active Appeals */}
      {appeals.filter(
        (a) =>
          a.status === AppealStatus.PENDING ||
          a.status === AppealStatus.UNDER_REVIEW
      ).length > 0 && (
        <Card style={styles.section}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Active Appeals</Text>
            <Text style={styles.sectionSubtitle}>
              Appeals currently being reviewed:
            </Text>

            {appeals
              .filter(
                (a) =>
                  a.status === AppealStatus.PENDING ||
                  a.status === AppealStatus.UNDER_REVIEW
              )
              .map((appeal) => (
                <View key={appeal.id} style={styles.appealItem}>
                  <View style={styles.appealHeader}>
                    <Text style={styles.appealId}>#{appeal.id.slice(-8)}</Text>
                    <Chip
                      mode="outlined"
                      textStyle={{ color: getAppealStatusColor(appeal.status) }}
                      style={[
                        styles.statusChip,
                        { borderColor: getAppealStatusColor(appeal.status) },
                      ]}
                    >
                      {getAppealStatusText(appeal.status)}
                    </Chip>
                  </View>
                  <Text style={styles.appealReason}>{appeal.reason}</Text>
                  <Text style={styles.appealDate}>
                    Submitted: {formatDate(appeal.submittedAt)}
                  </Text>
                </View>
              ))}
          </Card.Content>
        </Card>
      )}

      {/* Appeal History */}
      {appeals.filter(
        (a) =>
          a.status === AppealStatus.APPROVED ||
          a.status === AppealStatus.REJECTED ||
          a.status === AppealStatus.EXPIRED
      ).length > 0 && (
        <Card style={styles.section}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Appeal History</Text>
            <Text style={styles.sectionSubtitle}>Past appeal decisions:</Text>

            {appeals
              .filter(
                (a) =>
                  a.status === AppealStatus.APPROVED ||
                  a.status === AppealStatus.REJECTED ||
                  a.status === AppealStatus.EXPIRED
              )
              .map((appeal) => (
                <View key={appeal.id} style={styles.appealItem}>
                  <View style={styles.appealHeader}>
                    <Text style={styles.appealId}>#{appeal.id.slice(-8)}</Text>
                    <Chip
                      mode="outlined"
                      textStyle={{ color: getAppealStatusColor(appeal.status) }}
                      style={[
                        styles.statusChip,
                        { borderColor: getAppealStatusColor(appeal.status) },
                      ]}
                    >
                      {getAppealStatusText(appeal.status)}
                    </Chip>
                  </View>
                  <Text style={styles.appealReason}>{appeal.reason}</Text>
                  {appeal.resolution && (
                    <Text style={styles.appealResolution}>
                      Response: {appeal.resolution.reason}
                    </Text>
                  )}
                  <Text style={styles.appealDate}>
                    {appeal.status === AppealStatus.APPROVED
                      ? "Approved"
                      : "Resolved"}
                    : {formatDate(appeal.reviewedAt || appeal.submittedAt)}
                  </Text>
                </View>
              ))}
          </Card.Content>
        </Card>
      )}

      {/* No Appeals State */}
      {appeals.length === 0 &&
        violations.filter(canAppealViolation).length === 0 && (
          <Card style={styles.section}>
            <Card.Content style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No Appeals Available</Text>
              <Text style={styles.emptyText}>
                You don&apos;t have any actions that can be appealed at this
                time.
              </Text>
              <Text style={styles.emptySubtext}>
                Appeals must be submitted within 30 days of the moderation
                action.
              </Text>
            </Card.Content>
          </Card>
        )}

      {/* Appeal Modal */}
      <Modal
        visible={showAppealModal}
        animationType="slide"
        onRequestClose={() => setShowAppealModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Submit Appeal</Text>
            <TouchableOpacity
              onPress={() => setShowAppealModal(false)}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {selectedViolation && (
              <View style={styles.modalViolationInfo}>
                <Text style={styles.modalViolationTitle}>
                  Appealing:{" "}
                  {getViolationTypeText(selectedViolation.violationType)}
                </Text>
                <Text style={styles.modalViolationReason}>
                  {selectedViolation.reason}
                </Text>
                <Text style={styles.modalViolationDate}>
                  Date: {formatDate(selectedViolation.createdAt)}
                </Text>
              </View>
            )}

            <View style={styles.modalForm}>
              <Text style={styles.modalLabel}>
                Why should this action be reversed?
              </Text>
              <TextInput
                style={styles.modalTextInput}
                multiline
                numberOfLines={6}
                placeholder="Explain why you believe this moderation action was incorrect. Provide any relevant context or evidence..."
                value={appealReason}
                onChangeText={setAppealReason}
                textAlignVertical="top"
              />

              <Text style={styles.modalHint}>
                Be specific and respectful. Appeals are reviewed by our
                moderation team.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <Button
              mode="outlined"
              onPress={() => setShowAppealModal(false)}
              style={styles.modalCancelButton}
              disabled={submittingAppeal}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleCreateAppeal}
              style={styles.modalSubmitButton}
              loading={submittingAppeal}
              disabled={submittingAppeal || !appealReason.trim()}
            >
              Submit Appeal
            </Button>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
  },
  header: {
    padding: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    lineHeight: 24,
  },
  section: {
    margin: 16,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
  },
  violationItem: {
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#ff6b6b",
  },
  violationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  violationType: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  violationChip: {
    height: 24,
  },
  violationReason: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
    lineHeight: 20,
  },
  violationDate: {
    fontSize: 12,
    color: "#999",
    marginBottom: 12,
  },
  appealButton: {
    marginTop: 8,
  },
  appealItem: {
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#007AFF",
  },
  appealHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  appealId: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
  },
  statusChip: {
    height: 24,
  },
  appealReason: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
    lineHeight: 20,
  },
  appealResolution: {
    fontSize: 14,
    color: "#333",
    marginBottom: 8,
    lineHeight: 20,
    fontStyle: "italic",
  },
  appealDate: {
    fontSize: 12,
    color: "#999",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
  },
  // Modal styles
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
    fontSize: 20,
    color: "#666",
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalViolationInfo: {
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  modalViolationTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  modalViolationReason: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
    lineHeight: 20,
  },
  modalViolationDate: {
    fontSize: 12,
    color: "#999",
  },
  modalForm: {
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  modalTextInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 120,
    textAlignVertical: "top",
  },
  modalHint: {
    fontSize: 12,
    color: "#999",
    marginTop: 8,
    fontStyle: "italic",
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  modalCancelButton: {
    flex: 1,
    marginRight: 8,
  },
  modalSubmitButton: {
    flex: 1,
    marginLeft: 8,
  },
});

export default AppealScreen;
