/**
 * Authentication Provider
 * Manages authentication state and provides auth context to the app
 */

import React, { createContext, useContext, useEffect, ReactNode } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import {
  useAuthStore,
  useAuthUser,
  useAuthLoading,
  useAuthError,
  useIsAuthenticated,
} from "../store/useAuthStore";
import { getAuthService } from "../services/authService";

interface AuthContextType {
  user: ReturnType<typeof useAuthUser>;
  isLoading: ReturnType<typeof useAuthLoading>;
  error: ReturnType<typeof useAuthError>;
  isAuthenticated: ReturnType<typeof useIsAuthenticated>;
  signInAnonymously: () => Promise<void>;
  signOut: () => Promise<void>;
  updateLastActive: () => Promise<void>;
  incrementWhisperCount: () => Promise<void>;
  incrementReactionCount: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const user = useAuthUser();
  const isLoading = useAuthLoading();
  const error = useAuthError();
  const isAuthenticated = useIsAuthenticated();

  const {
    signInAnonymously,
    signOut,
    updateLastActive,
    incrementWhisperCount,
    incrementReactionCount,
    clearError,
  } = useAuthStore();

  // Auto-sign in if not authenticated
  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      console.log("🔄 Auto-signing in anonymously...");
      signInAnonymously().catch(console.error);
    }
  }, [isAuthenticated, isLoading, signInAnonymously]);

  // Update last active when user is authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      const interval = setInterval(() => {
        updateLastActive();
      }, 5 * 60 * 1000); // Update every 5 minutes

      return () => clearInterval(interval);
    }
  }, [isAuthenticated, user, updateLastActive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cleanup auth service if needed
      console.log("🧹 AuthProvider cleanup");
    };
  }, []);

  const contextValue: AuthContextType = {
    user,
    isLoading,
    error,
    isAuthenticated,
    signInAnonymously,
    signOut,
    updateLastActive,
    incrementWhisperCount,
    incrementReactionCount,
    clearError,
  };

  // Show loading screen while initializing
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Signing you in...</Text>
      </View>
    );
  }

  // Show error screen if authentication failed
  if (error && !isAuthenticated) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Authentication Error</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <Text style={styles.retryText} onPress={() => signInAnonymously()}>
          Tap to retry
        </Text>
      </View>
    );
  }

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};

/**
 * Hook to use authentication context
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#F44336",
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
  },
  retryText: {
    fontSize: 16,
    color: "#007AFF",
    textDecorationLine: "underline",
  },
});
