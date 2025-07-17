import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { useAuth } from "../providers/AuthProvider";
import { getSuspensionService } from "../services/suspensionService";
import { Suspension, SuspensionType } from "../types";
import { getAppealService } from "../services/appealService";

const SuspensionScreen = () => {
  const { user } = useAuth();
  const [suspensions, setSuspensions] = useState<Suspension[]>([]);
  const [loading, setLoading] = useState(true);
  const [canAppeal, setCanAppeal] = useState(false);

  const loadSuspensionStatus = useCallback(async () => {
    if (!user?.uid) return;
    try {
      setLoading(true);
      const suspensionService = getSuspensionService();
      const {
        suspended,
        suspensions: userSuspensions,
        canAppeal: userCanAppeal,
      } = await suspensionService.isUserSuspended(user.uid);
      if (suspended) {
        setSuspensions(userSuspensions);
        setCanAppeal(userCanAppeal);
      }
    } catch (error) {
      console.error("Error loading suspension status:", error);
      Alert.alert("Error", "Failed to load suspension status");
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    loadSuspensionStatus();
  }, [loadSuspensionStatus]);

  const handleAppeal = async () => {
    if (!user?.uid || suspensions.length === 0) return;

    try {
      const appealService = getAppealService();
      const suspension = suspensions[0]; // Appeal the first suspension

      await appealService.createAppeal({
        userId: user.uid,
        whisperId: "", // Not applicable for suspension appeals
        violationId: suspension.id,
        reason:
          "I believe this suspension was issued in error. Please review my case.",
      });

      Alert.alert(
        "Appeal Submitted",
        "Your appeal has been submitted and will be reviewed by our moderation team. You will be notified of the decision.",
        [{ text: "OK" }]
      );
    } catch (error) {
      console.error("Error submitting appeal:", error);
      Alert.alert("Error", "Failed to submit appeal. Please try again.");
    }
  };

  const formatDuration = (startDate: Date, endDate?: Date): string => {
    if (!endDate) return "Permanent";

    const now = new Date();
    const end = new Date(endDate);

    if (end <= now) return "Expired";

    const diffMs = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return "1 day remaining";
    if (diffDays < 7) return `${diffDays} days remaining`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks remaining`;
    return `${Math.ceil(diffDays / 30)} months remaining`;
  };

  const getSuspensionTypeText = (type: SuspensionType): string => {
    switch (type) {
      case SuspensionType.WARNING:
        return "Warning";
      case SuspensionType.TEMPORARY:
        return "Temporary Suspension";
      case SuspensionType.PERMANENT:
        return "Permanent Ban";
      default:
        return "Suspension";
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading suspension status...</Text>
      </View>
    );
  }

  if (suspensions.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.noSuspensionText}>
          No active suspensions found.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Account Suspended</Text>
        <Text style={styles.subtitle}>
          Your account has been suspended due to a violation of our community
          guidelines.
        </Text>
      </View>

      {suspensions.map((suspension) => (
        <View key={suspension.id} style={styles.suspensionCard}>
          <View style={styles.suspensionHeader}>
            <Text style={styles.suspensionType}>
              {getSuspensionTypeText(suspension.type)}
            </Text>
            <Text style={styles.duration}>
              {formatDuration(suspension.startDate, suspension.endDate)}
            </Text>
          </View>

          <Text style={styles.reason}>{suspension.reason}</Text>

          <Text style={styles.date}>
            Issued: {suspension.startDate.toLocaleDateString()}
          </Text>

          {suspension.type === SuspensionType.PERMANENT && (
            <View style={styles.permanentWarning}>
              <Text style={styles.permanentWarningText}>
                ⚠️ This is a permanent ban. Your account cannot be restored.
              </Text>
            </View>
          )}
        </View>
      ))}

      {canAppeal && (
        <View style={styles.appealSection}>
          <Text style={styles.appealTitle}>Appeal This Decision</Text>
          <Text style={styles.appealDescription}>
            If you believe this suspension was issued in error, you can submit
            an appeal for review.
          </Text>

          <TouchableOpacity style={styles.appealButton} onPress={handleAppeal}>
            <Text style={styles.appealButtonText}>Submit Appeal</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>What This Means</Text>
        <Text style={styles.infoText}>
          • You cannot post new whispers during this suspension
        </Text>
        <Text style={styles.infoText}>
          • You cannot like or comment on other whispers
        </Text>
        <Text style={styles.infoText}>
          • Your existing content remains visible to other users
        </Text>
        <Text style={styles.infoText}>
          • You can still view content but cannot interact
        </Text>
      </View>

      <View style={styles.contactSection}>
        <Text style={styles.contactTitle}>Need Help?</Text>
        <Text style={styles.contactText}>
          If you have questions about this suspension or need assistance, please
          contact our support team.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 20,
  },
  header: {
    alignItems: "center",
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#ff3b30",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    lineHeight: 24,
  },
  suspensionCard: {
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#ff3b30",
  },
  suspensionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  suspensionType: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  duration: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  reason: {
    fontSize: 16,
    color: "#333",
    lineHeight: 24,
    marginBottom: 10,
  },
  date: {
    fontSize: 14,
    color: "#666",
  },
  permanentWarning: {
    backgroundColor: "#fff3cd",
    borderRadius: 8,
    padding: 12,
    marginTop: 15,
    borderWidth: 1,
    borderColor: "#ffeaa7",
  },
  permanentWarningText: {
    fontSize: 14,
    color: "#856404",
    fontWeight: "500",
  },
  appealSection: {
    backgroundColor: "#e3f2fd",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#bbdefb",
  },
  appealTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1976d2",
    marginBottom: 10,
  },
  appealDescription: {
    fontSize: 16,
    color: "#333",
    lineHeight: 24,
    marginBottom: 20,
  },
  appealButton: {
    backgroundColor: "#1976d2",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  appealButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  infoSection: {
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 15,
  },
  infoText: {
    fontSize: 16,
    color: "#333",
    lineHeight: 24,
    marginBottom: 8,
  },
  contactSection: {
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  contactTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
  },
  contactText: {
    fontSize: 16,
    color: "#666",
    lineHeight: 24,
  },
  loadingText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginTop: 50,
  },
  noSuspensionText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginTop: 50,
  },
});

export default SuspensionScreen;
