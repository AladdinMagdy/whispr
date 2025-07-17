import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Suspension, SuspensionType } from "../types";

interface TemporaryBanNotificationProps {
  suspensions: Suspension[];
  onDismiss?: () => void;
}

const TemporaryBanNotification: React.FC<TemporaryBanNotificationProps> = ({
  suspensions,
  onDismiss = () => {},
}) => {
  const [isVisible, setIsVisible] = useState(true);

  // Only show for temporary bans and warnings
  const temporarySuspensions = suspensions.filter(
    (s) =>
      s.type === SuspensionType.TEMPORARY || s.type === SuspensionType.WARNING
  );

  if (!isVisible || temporarySuspensions.length === 0) {
    return null;
  }

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss();
  };

  const formatDuration = (startDate: Date, endDate?: Date): string => {
    if (!endDate) return "Unknown duration";
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
      default:
        return "Suspension";
    }
  };

  const suspension = temporarySuspensions[0]; // Show the first one

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>
          {getSuspensionTypeText(suspension.type)}
        </Text>
        <Text style={styles.message}>
          {suspension.type === SuspensionType.WARNING
            ? "You've received a warning for violating community guidelines."
            : "Your account is temporarily suspended for violating community guidelines."}
        </Text>
        <Text style={styles.details}>
          {suspension.type === SuspensionType.WARNING
            ? "You can continue using the app normally, but please review our guidelines."
            : `You can browse and interact with content, but cannot create new whispers until ${formatDuration(
                suspension.startDate,
                suspension.endDate
              )}.`}
        </Text>
        <Text style={styles.reason}>Reason: {suspension.reason}</Text>
      </View>
      <TouchableOpacity style={styles.dismissButton} onPress={handleDismiss}>
        <Text style={styles.dismissText}>Dismiss</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff3cd",
    borderColor: "#ffeaa7",
    borderWidth: 1,
    borderRadius: 8,
    margin: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  content: {
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#856404",
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: "#856404",
    marginBottom: 8,
    lineHeight: 20,
  },
  details: {
    fontSize: 13,
    color: "#856404",
    marginBottom: 8,
    lineHeight: 18,
  },
  reason: {
    fontSize: 12,
    color: "#856404",
    fontStyle: "italic",
  },
  dismissButton: {
    alignSelf: "flex-end",
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#856404",
    borderRadius: 4,
  },
  dismissText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "500",
  },
});

export default TemporaryBanNotification;
