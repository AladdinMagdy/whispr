import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PaperProvider } from "react-native-paper";
import { View, Text, ActivityIndicator } from "react-native";

// Import screens (we'll create these next)
import HomeScreen from "./screens/HomeScreen";
import RecordScreen from "./screens/RecordScreen";
import FeedScreen from "./screens/FeedScreen";

// Import store
import { useAppStore } from "./store/useAppStore";

// Import Firebase initialization and auth
import { initializeFirebase } from "./config/firebase";
import { AuthService } from "./services/authService";

const Stack = createStackNavigator();

export default function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setUser, setLoading } = useAppStore();

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize Firebase and other services
        console.log("Initializing Whispr app...");
        setLoading(true);

        // Initialize Firebase with proper error handling
        await initializeFirebase();

        // Add a small delay to ensure Firebase is ready
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Automatically sign in anonymously
        console.log("Signing in anonymously...");
        const user = await AuthService.signInAnonymously();
        setUser(user);
        console.log("User signed in anonymously:", user.anonymousId);

        setIsInitialized(true);
        console.log("Whispr app initialized successfully");
      } catch (err) {
        console.error("Failed to initialize app:", err);
        setError(
          err instanceof Error ? err.message : "Failed to initialize app"
        );
      } finally {
        setLoading(false);
      }
    };

    initializeApp();
  }, [setUser, setLoading]);

  if (error) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        <Text
          style={{
            fontSize: 18,
            color: "red",
            textAlign: "center",
            marginBottom: 20,
          }}
        >
          Error: {error}
        </Text>
        <Text style={{ textAlign: "center" }}>
          Please check your environment configuration and try again.
        </Text>
      </View>
    );
  }

  if (!isInitialized) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 16 }}>Initializing Whispr...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <PaperProvider>
        <NavigationContainer>
          <StatusBar style="auto" />
          <Stack.Navigator
            initialRouteName="Home"
            screenOptions={{
              headerStyle: {
                backgroundColor: "#f8f9fa",
              },
              headerTintColor: "#333",
              headerTitleStyle: {
                fontWeight: "bold",
              },
            }}
          >
            <Stack.Screen
              name="Home"
              component={HomeScreen}
              options={{ title: "Whispr" }}
            />
            <Stack.Screen
              name="Record"
              component={RecordScreen}
              options={{ title: "Record Whisper" }}
            />
            <Stack.Screen
              name="Feed"
              component={FeedScreen}
              options={{ title: "Whispers" }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
