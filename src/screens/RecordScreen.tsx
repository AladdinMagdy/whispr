import React, { useState } from "react";
import { View, StyleSheet, Alert } from "react-native";
import { Button, Text, Card } from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { useAppStore } from "../store/useAppStore";

type RootStackParamList = {
  Home: undefined;
  Record: undefined;
  Feed: undefined;
};

type RecordScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "Record"
>;

export default function RecordScreen() {
  const navigation = useNavigation<RecordScreenNavigationProp>();
  const { setLoading, setError, isLoading } = useAppStore();

  const handleStartRecording = async () => {
    Alert.alert(
      "Coming Soon",
      "Recording functionality is being updated to use React Native Track Player. Please check back soon!"
    );
  };

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="headlineSmall" style={styles.title}>
            Record Your Whisper
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Recording functionality is being updated to use React Native Track
            Player
          </Text>
          <Text variant="bodySmall" style={styles.status}>
            This feature will be available soon with improved audio handling and
            background playback support.
          </Text>
        </Card.Content>
      </Card>

      <View style={styles.buttonContainer}>
        <Button
          mode="contained"
          onPress={handleStartRecording}
          style={styles.button}
          icon="microphone"
          disabled={isLoading}
        >
          Start Recording (Coming Soon)
        </Button>

        <Button
          mode="outlined"
          onPress={() => navigation.goBack()}
          style={styles.button}
          disabled={isLoading}
        >
          Back to Home
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
    backgroundColor: "#f5f5f5",
  },
  card: {
    marginBottom: 30,
    elevation: 4,
  },
  title: {
    textAlign: "center",
    marginBottom: 10,
    color: "#333",
  },
  subtitle: {
    textAlign: "center",
    color: "#666",
    marginBottom: 20,
  },
  status: {
    color: "#666",
  },
  buttonContainer: {
    gap: 15,
  },
  button: {
    marginVertical: 5,
  },
});
