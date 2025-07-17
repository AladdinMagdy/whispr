import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from "react-native";
import { useAuth } from "../providers/AuthProvider";
import { getFirestoreService } from "../services/firestoreService";
import { getAppealService } from "../services/appealService";

interface AppealNotificationProps {
  onNavigateToAppeals: () => void;
}

const AppealNotification: React.FC<AppealNotificationProps> = ({
  onNavigateToAppeals,
}) => {
  const { user } = useAuth();
  const [hasAppealableViolations, setHasAppealableViolations] = useState(false);
  const [pendingAppeals, setPendingAppeals] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    if (!user?.uid) return;

    const checkAppealStatus = async () => {
      try {
        const firestoreService = getFirestoreService();
        const appealService = getAppealService();

        // Get violations and appeals in parallel
        const [violations, appeals] = await Promise.all([
          firestoreService.getUserViolations(user.uid, 30), // Last 30 days
          appealService.getUserAppeals(user.uid),
        ]);

        // Check for appealable violations
        const appealableViolations = violations.filter((violation) => {
          const daysSinceViolation = Math.floor(
            (Date.now() - violation.createdAt.getTime()) / (1000 * 60 * 60 * 24)
          );

          const hasExistingAppeal = appeals.some(
            (appeal) => appeal.violationId === violation.id
          );

          return daysSinceViolation <= 30 && !hasExistingAppeal;
        });

        const pendingAppealsCount = appeals.filter(
          (appeal) =>
            appeal.status === "pending" || appeal.status === "under_review"
        ).length;

        setHasAppealableViolations(appealableViolations.length > 0);
        setPendingAppeals(pendingAppealsCount);

        // Show notification if there are appealable violations or pending appeals
        if (appealableViolations.length > 0 || pendingAppealsCount > 0) {
          setIsVisible(true);
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }).start();
        } else {
          setIsVisible(false);
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }).start();
        }
      } catch (error) {
        console.error("Error checking appeal status:", error);
      }
    };

    checkAppealStatus();

    // Check every 5 minutes
    const interval = setInterval(checkAppealStatus, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user?.uid, fadeAnim]);

  if (!isVisible) return null;

  const getNotificationText = () => {
    if (hasAppealableViolations && pendingAppeals > 0) {
      return "You have new violations to appeal and pending appeals";
    } else if (hasAppealableViolations) {
      return "You have new violations that can be appealed";
    } else if (pendingAppeals > 0) {
      return `You have ${pendingAppeals} pending appeal${
        pendingAppeals > 1 ? "s" : ""
      }`;
    }
    return "";
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.notification}>
        <View style={styles.content}>
          <Text style={styles.icon}>⚖️</Text>
          <Text style={styles.text}>{getNotificationText()}</Text>
        </View>
        <TouchableOpacity style={styles.button} onPress={onNavigateToAppeals}>
          <Text style={styles.buttonText}>View</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 50,
    left: 16,
    right: 16,
    zIndex: 1000,
  },
  notification: {
    backgroundColor: "#007AFF",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  content: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  icon: {
    fontSize: 20,
    marginRight: 12,
  },
  text: {
    flex: 1,
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  button: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginLeft: 12,
  },
  buttonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
});

export default AppealNotification;
