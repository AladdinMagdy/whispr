import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PaperProvider } from "react-native-paper";
import {
  View,
  Text,
  ActivityIndicator,
  AppState,
  TouchableOpacity,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import RecordScreen from "./screens/RecordScreen";
import SuspensionScreen from "./screens/SuspensionScreen";
import AppealScreen from "./screens/AppealScreen";

import MainTabs from "./navigation/MainTabs";
import OnboardingNavigator from "./navigation/OnboardingNavigator";
import { AuthProvider } from "./providers/AuthProvider";

// Import Firebase initialization
import { initializeFirebase } from "./config/firebase";
import { setupAuthServiceCallbacks } from "./store/useAuthStore";
import { getAudioCacheService } from "./services/audioCacheService";
import { pauseAllAudioSlides } from "./components/AudioSlide";
import { useSuspensionCheck } from "./hooks/useSuspensionCheck";
import AppBackground from "./components/AppBackground";

const Stack = createStackNavigator();

function AppContent() {
  const { isSuspended, loading: suspensionLoading } = useSuspensionCheck();
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<
    boolean | null
  >(null);

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        const onboardingComplete = await AsyncStorage.getItem(
          "onboardingComplete"
        );
        console.log(
          "🔍 Onboarding status from AsyncStorage:",
          onboardingComplete
        );
        setHasCompletedOnboarding(onboardingComplete === "true");
      } catch (error) {
        console.error("Error checking onboarding status:", error);
        setHasCompletedOnboarding(false);
      }
    };
    checkOnboardingStatus();
  }, []);

  const handleOnboardingComplete = async () => {
    try {
      console.log("✅ Onboarding completed, saving to AsyncStorage");
      await AsyncStorage.setItem("onboardingComplete", "true");
      setHasCompletedOnboarding(true);
    } catch (error) {
      console.error("Error saving onboarding status:", error);
      setHasCompletedOnboarding(true);
    }
  };

  const resetOnboarding = async () => {
    try {
      console.log("🔄 Resetting onboarding status");
      await AsyncStorage.removeItem("onboardingComplete");
      setHasCompletedOnboarding(false);
    } catch (error) {
      console.error("Error resetting onboarding status:", error);
    }
  };

  if (hasCompletedOnboarding === null) {
    console.log("⏳ Loading onboarding status...");
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 16 }}>Loading...</Text>
      </View>
    );
  }

  if (!hasCompletedOnboarding) {
    console.log("🎯 Showing onboarding screens");
    return <OnboardingNavigator onComplete={handleOnboardingComplete} />;
  }

  console.log("🏠 Showing main app (onboarding completed)");

  if (suspensionLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 16 }}>Checking account status...</Text>
      </View>
    );
  }

  if (isSuspended) {
    return <SuspensionScreen />;
  }

  return (
    <>
      {/* Temporary reset button for testing */}
      <TouchableOpacity
        style={{
          position: "absolute",
          top: 50,
          right: 20,
          backgroundColor: "#ff4444",
          padding: 10,
          borderRadius: 5,
          zIndex: 1000,
        }}
        onPress={resetOnboarding}
      >
        <Text style={{ color: "#fff", fontSize: 12 }}>Reset Onboarding</Text>
      </TouchableOpacity>

      <Stack.Navigator
        initialRouteName="MainTabs"
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
          name="MainTabs"
          component={MainTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="RecordModal"
          component={RecordScreen}
          options={{
            title: "Record Whisper",
            presentation: "modal",
            headerShown: true,
          }}
        />
        <Stack.Screen
          name="Suspension"
          component={SuspensionScreen}
          options={{
            title: "Account Suspended",
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="AppealScreen"
          component={AppealScreen}
          options={{
            title: "Appeals Center",
            headerShown: true,
          }}
        />
      </Stack.Navigator>
    </>
  );
}

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

            // If cache is over 70% full, clean up old files (reduced from 80%)
            if (stats.usagePercentage > 70) {
              console.log("🧹 Cleaning up audio cache due to high usage...");
              audioCacheService.clearCache().catch(console.error);
            }

            // Pause all audio when going to background
            pauseAllAudioSlides().catch(console.error);
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
          <AppBackground variant="default">
            <NavigationContainer>
              <StatusBar style="light" />
              <AppContent />
            </NavigationContainer>
          </AppBackground>
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
