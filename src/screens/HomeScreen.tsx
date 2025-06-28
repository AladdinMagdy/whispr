import React from "react";
import { View, StyleSheet } from "react-native";
import { Button, Text, Card } from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";

type RootStackParamList = {
  Home: undefined;
  Record: undefined;
  Feed: undefined;
};

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, "Home">;

export default function HomeScreen() {
  const navigation = useNavigation<HomeScreenNavigationProp>();

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="headlineMedium" style={styles.title}>
            Welcome to Whispr
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Share your whispers anonymously
          </Text>
        </Card.Content>
      </Card>

      <View style={styles.buttonContainer}>
        <Button
          mode="contained"
          onPress={() => navigation.navigate("Record")}
          style={styles.button}
          icon="microphone"
        >
          Record Whisper
        </Button>

        <Button
          mode="outlined"
          onPress={() => navigation.navigate("Feed")}
          style={styles.button}
          icon="format-list-bulleted"
        >
          View Whispers
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
  },
  buttonContainer: {
    gap: 15,
  },
  button: {
    marginVertical: 5,
  },
});
