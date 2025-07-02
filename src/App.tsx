import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PaperProvider } from "react-native-paper";
import { View, Text, ActivityIndicator } from "react-native";

// Import screens
import HomeScreen from "./screens/HomeScreen";
import RecordScreen from "./screens/RecordScreen";
import FeedScreen from "./screens/FeedScreen";

// Import providers
import { AuthProvider } from "./providers/AuthProvider";

// Import Firebase initialization
import { initializeFirebase } from "./config/firebase";
import { setupAuthServiceCallbacks } from "./store/useAuthStore";
import { getAudioCacheService } from "./services/audioCacheService";
import { AppState } from "react-native";

const Stack = createStackNavigator();

export default function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize Firebase and other services
        console.log("Initializing Whispr app...");

        // Initialize Firebase with proper error handling
        await initializeFirebase();

        // Add a small delay to ensure Firebase is ready
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Setup AuthService callbacks after Firebase is ready
        setupAuthServiceCallbacks();

        // Preload whispers in background for faster FeedScreen loading
        const { getFirestoreService } = await import(
          "./services/firestoreService"
        );
        const firestoreService = getFirestoreService();
        firestoreService.getWhispers({ limit: 20 }).catch(console.error);

        // Set up cache cleanup on app state changes
        const handleAppStateChange = (nextAppState: string) => {
          if (nextAppState === "background" || nextAppState === "inactive") {
            // App is going to background, clean up old cache
            const audioCacheService = getAudioCacheService();
            const stats = audioCacheService.getCacheStats();

            // If cache is over 80% full, clean up old files
            if (stats.usagePercentage > 80) {
              console.log("🧹 Cleaning up audio cache due to high usage...");
              audioCacheService.clearCache().catch(console.error);
            }
          }
        };

        AppState.addEventListener("change", handleAppStateChange);

        setIsInitialized(true);
        console.log("Whispr app initialized successfully");
      } catch (err) {
        console.error("Failed to initialize app:", err);
        setError(
          err instanceof Error ? err.message : "Failed to initialize app"
        );
      }
    };

    initializeApp();
  }, []);

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
        <AuthProvider>
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
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
