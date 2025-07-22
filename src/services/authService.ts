/**
 * Authentication Service for Whispr
 * Handles Firebase anonymous authentication and user session management
 */

import { getAuthInstance, getFirestoreInstance } from "../config/firebase";
import {
  signInAnonymously,
  onAuthStateChanged,
  signOut,
  User as FirebaseUser,
  Auth,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  Firestore,
} from "firebase/firestore";
import { generateAnonymousProfile } from "../utils/profileGenerationUtils";

export interface AnonymousUser {
  uid: string;
  displayName: string;
  isAnonymous: boolean;
  createdAt: Date;
  lastActiveAt: Date;
  whisperCount: number;
  totalReactions: number;
  profileColor: string;
  // Age verification and content preferences
  age?: number;
  isMinor?: boolean;
  contentPreferences?: {
    allowAdultContent: boolean;
    strictFiltering: boolean;
  };
}

export interface AuthState {
  user: AnonymousUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

export interface AuthCallbacks {
  onAuthStateChanged?: (user: AnonymousUser | null) => void;
  onError?: (error: string) => void;
}

export interface AuthServiceDependencies {
  auth: Auth;
  firestore: Firestore;
}

export class AuthService {
  private static instance: AuthService;
  private callbacks: AuthCallbacks = {};
  private unsubscribeAuth: (() => void) | null = null;
  private auth: Auth;
  private firestore: Firestore;

  constructor(dependencies?: AuthServiceDependencies) {
    if (dependencies) {
      this.auth = dependencies.auth;
      this.firestore = dependencies.firestore;
    } else {
      // Use default instances for backward compatibility
      this.auth = getAuthInstance();
      this.firestore = getFirestoreInstance();
    }

    this.initializeAuthListener();
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Create a new instance with custom dependencies (for testing)
   */
  static createInstance(dependencies: AuthServiceDependencies): AuthService {
    return new AuthService(dependencies);
  }

  /**
   * Set callbacks for auth events
   */
  setCallbacks(callbacks: AuthCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Initialize Firebase auth state listener
   */
  private initializeAuthListener(): void {
    this.unsubscribeAuth = onAuthStateChanged(
      this.auth,
      async (firebaseUser: FirebaseUser | null) => {
        if (firebaseUser) {
          try {
            const anonymousUser = await this.getOrCreateAnonymousUser(
              firebaseUser
            );
            this.callbacks.onAuthStateChanged?.(anonymousUser);
          } catch (error) {
            console.error("Error getting anonymous user:", error);
            this.callbacks.onError?.(
              error instanceof Error ? error.message : "Authentication error"
            );
          }
        } else {
          this.callbacks.onAuthStateChanged?.(null);
        }
      },
      (error) => {
        console.error("Auth state change error:", error);
        this.callbacks.onError?.(
          error instanceof Error ? error.message : "Authentication error"
        );
      }
    );
  }

  /**
   * Sign in anonymously
   */
  async signInAnonymously(): Promise<AnonymousUser> {
    try {
      const userCredential = await signInAnonymously(this.auth);
      const firebaseUser = userCredential.user;

      // Get or create anonymous user profile
      const anonymousUser = await this.getOrCreateAnonymousUser(firebaseUser);

      console.log("Anonymous sign-in successful:", anonymousUser.displayName);
      return anonymousUser;
    } catch (error) {
      console.error("Anonymous sign-in error:", error);
      throw new Error(
        `Failed to sign in anonymously: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Sign out current user
   */
  async signOut(): Promise<void> {
    try {
      await signOut(this.auth);
      console.log("Sign out successful");
    } catch (error) {
      console.error("Sign out error:", error);
      throw new Error(
        `Failed to sign out: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<AnonymousUser | null> {
    const firebaseUser = this.auth.currentUser;
    if (!firebaseUser) {
      return null;
    }

    try {
      return await this.getOrCreateAnonymousUser(firebaseUser);
    } catch (error) {
      console.error("Error getting current user:", error);
      return null;
    }
  }

  /**
   * Get or create anonymous user profile in Firestore
   */
  private async getOrCreateAnonymousUser(
    firebaseUser: FirebaseUser
  ): Promise<AnonymousUser> {
    const userDocRef = doc(this.firestore, "users", firebaseUser.uid);

    try {
      // Try to get existing user document
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        // User exists, return existing data
        const userData = userDoc.data();
        return {
          uid: firebaseUser.uid,
          displayName: userData.displayName,
          isAnonymous: firebaseUser.isAnonymous,
          createdAt: userData.createdAt.toDate(),
          lastActiveAt: userData.lastActiveAt.toDate(),
          whisperCount: userData.whisperCount || 0,
          totalReactions: userData.totalReactions || 0,
          profileColor: userData.profileColor,
        };
      } else {
        // User doesn't exist, create new anonymous profile
        const anonymousProfile = this.generateAnonymousProfile();

        const newUserData = {
          displayName: anonymousProfile.displayName,
          isAnonymous: true,
          createdAt: serverTimestamp(),
          lastActiveAt: serverTimestamp(),
          whisperCount: 0,
          totalReactions: 0,
          profileColor: anonymousProfile.profileColor,
        };

        await setDoc(userDocRef, newUserData);

        return {
          uid: firebaseUser.uid,
          displayName: anonymousProfile.displayName,
          isAnonymous: true,
          createdAt: new Date(),
          lastActiveAt: new Date(),
          whisperCount: 0,
          totalReactions: 0,
          profileColor: anonymousProfile.profileColor,
        };
      }
    } catch (error) {
      console.error("Error getting/creating user profile:", error);
      throw new Error(
        `Failed to get user profile: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Generate anonymous profile with random name and color
   */
  private generateAnonymousProfile(): {
    displayName: string;
    profileColor: string;
  } {
    return generateAnonymousProfile();
  }

  /**
   * Update user's last active timestamp
   */
  async updateLastActive(): Promise<void> {
    const firebaseUser = this.auth.currentUser;
    if (!firebaseUser) return;

    try {
      const userDocRef = doc(this.firestore, "users", firebaseUser.uid);
      await setDoc(
        userDocRef,
        { lastActiveAt: serverTimestamp() },
        { merge: true }
      );
    } catch (error) {
      console.error("Error updating last active:", error);
    }
  }

  /**
   * Increment user's whisper count
   */
  async incrementWhisperCount(): Promise<void> {
    const firebaseUser = this.auth.currentUser;
    if (!firebaseUser) return;

    try {
      const userDocRef = doc(this.firestore, "users", firebaseUser.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const currentCount = userDoc.data().whisperCount || 0;
        await setDoc(
          userDocRef,
          { whisperCount: currentCount + 1 },
          { merge: true }
        );
      }
    } catch (error) {
      console.error("Error incrementing whisper count:", error);
    }
  }

  /**
   * Increment user's reaction count
   */
  async incrementReactionCount(): Promise<void> {
    const firebaseUser = this.auth.currentUser;
    if (!firebaseUser) return;

    try {
      const userDocRef = doc(this.firestore, "users", firebaseUser.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const currentCount = userDoc.data().totalReactions || 0;
        await setDoc(
          userDocRef,
          { totalReactions: currentCount + 1 },
          { merge: true }
        );
      }
    } catch (error) {
      console.error("Error incrementing reaction count:", error);
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.unsubscribeAuth) {
      this.unsubscribeAuth();
      this.unsubscribeAuth = null;
    }
    this.callbacks = {};
  }

  /**
   * Reset singleton instance
   */
  static resetInstance(): void {
    if (AuthService.instance) {
      AuthService.instance.destroy();
      AuthService.instance = new AuthService();
      console.log("🔄 AuthService singleton reset successfully");
    }
  }

  /**
   * Destroy singleton instance
   */
  static destroyInstance(): void {
    if (AuthService.instance) {
      AuthService.instance.destroy();
      AuthService.instance = null as unknown as AuthService;
      console.log("🗑️ AuthService singleton destroyed");
    }
  }
}

/**
 * Factory function to get AuthService instance
 */
export const getAuthService = (): AuthService => {
  return AuthService.getInstance();
};

/**
 * Reset the AuthService singleton instance
 */
export const resetAuthService = (): void => {
  AuthService.resetInstance();
};

/**
 * Destroy the AuthService singleton instance
 */
export const destroyAuthService = (): void => {
  AuthService.destroyInstance();
};
