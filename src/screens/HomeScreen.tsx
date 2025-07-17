import React from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { Button, Text, Card, Avatar, Divider } from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { useAuth } from "../providers/AuthProvider";

type RootStackParamList = {
  MainTabs: undefined;
  RecordModal: undefined;
  AppealScreen: undefined;
};

type HomeScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "MainTabs"
>;

export default function HomeScreen() {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const { user, signOut, isAuthenticated } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.profileCard}>
        <Card.Content style={styles.profileContent}>
          <Avatar.Text
            size={80}
            label={user?.displayName?.charAt(0) || "U"}
            style={[
              styles.avatar,
              { backgroundColor: user?.profileColor || "#007AFF" },
            ]}
          />
          <Text variant="headlineSmall" style={styles.displayName}>
            {user?.displayName || "Anonymous User"}
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Whisper Enthusiast
          </Text>
        </Card.Content>
      </Card>

      <Card style={styles.statsCard}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.statsTitle}>
            Your Stats
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text variant="headlineSmall" style={styles.statNumber}>
                {user?.whisperCount || 0}
              </Text>
              <Text variant="bodySmall" style={styles.statLabel}>
                Whispers
              </Text>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.statItem}>
              <Text variant="headlineSmall" style={styles.statNumber}>
                {user?.totalReactions || 0}
              </Text>
              <Text variant="bodySmall" style={styles.statLabel}>
                Reactions
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.actionsCard}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.actionsTitle}>
            Actions
          </Text>
          <Button
            mode="contained"
            onPress={() => navigation.navigate("RecordModal")}
            style={styles.actionButton}
            icon="microphone"
            contentStyle={styles.buttonContent}
          >
            Record New Whisper
          </Button>
          <Button
            mode="outlined"
            onPress={() => navigation.navigate("AppealScreen")}
            style={styles.actionButton}
            icon="gavel"
            contentStyle={styles.buttonContent}
          >
            Appeals Center
          </Button>
        </Card.Content>
      </Card>

      {isAuthenticated && (
        <Card style={styles.settingsCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.settingsTitle}>
              Account
            </Text>

            <Button
              mode="outlined"
              onPress={handleSignOut}
              style={styles.actionButton}
              icon="logout"
              contentStyle={styles.buttonContent}
              textColor="#FF3B30"
            >
              Sign Out
            </Button>
          </Card.Content>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 16,
  },
  profileCard: {
    marginBottom: 16,
    elevation: 2,
  },
  profileContent: {
    alignItems: "center",
    paddingVertical: 24,
  },
  avatar: {
    marginBottom: 16,
  },
  displayName: {
    fontWeight: "bold",
    marginBottom: 4,
    textAlign: "center",
  },
  subtitle: {
    color: "#666",
    textAlign: "center",
  },
  statsCard: {
    marginBottom: 16,
    elevation: 2,
  },
  statsTitle: {
    fontWeight: "bold",
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statNumber: {
    fontWeight: "bold",
    color: "#007AFF",
  },
  statLabel: {
    color: "#666",
    marginTop: 4,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: "#E5E5EA",
  },
  actionsCard: {
    marginBottom: 16,
    elevation: 2,
  },
  actionsTitle: {
    fontWeight: "bold",
    marginBottom: 16,
  },
  actionButton: {
    marginBottom: 12,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  settingsCard: {
    marginBottom: 16,
    elevation: 2,
  },
  settingsTitle: {
    fontWeight: "bold",
    marginBottom: 16,
  },
});
