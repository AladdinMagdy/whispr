import {
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
import { getAuthInstance, getFirestoreInstance } from "@/config/firebase";
import { User } from "@/types";
import { FIRESTORE_COLLECTIONS } from "@/constants";

export class AuthService {
  /**
   * Sign in anonymously and create/update user document
   */
  static async signInAnonymously(): Promise<User> {
    try {
      const auth = getAuthInstance();
      const db = getFirestoreInstance();

      const { user: firebaseUser } = await signInAnonymously(auth);

      // Check if user document exists
      const userDocRef = doc(db, FIRESTORE_COLLECTIONS.USERS, firebaseUser.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        // Update last active
        await updateDoc(userDocRef, {
          lastActive: new Date(),
        });

        const userData = userDoc.data();
        return {
          id: firebaseUser.uid,
          anonymousId: userData.anonymousId,
          createdAt: userData.createdAt.toDate(),
          lastActive: new Date(),
        };
      } else {
        // Create new user document
        const newUser: User = {
          id: firebaseUser.uid,
          anonymousId: this.generateAnonymousId(),
          createdAt: new Date(),
          lastActive: new Date(),
        };

        await setDoc(userDocRef, {
          ...newUser,
          createdAt: newUser.createdAt,
          lastActive: newUser.lastActive,
        });

        return newUser;
      }
    } catch (error) {
      console.error("Error signing in anonymously:", error);
      throw new Error("Failed to sign in anonymously");
    }
  }

  /**
   * Sign out the current user
   */
  static async signOut(): Promise<void> {
    try {
      const auth = getAuthInstance();
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
      throw new Error("Failed to sign out");
    }
  }

  /**
   * Get current user from Firestore
   */
  static async getCurrentUser(): Promise<User | null> {
    try {
      const auth = getAuthInstance();
      const db = getFirestoreInstance();

      const firebaseUser = auth.currentUser;
      if (!firebaseUser) return null;

      const userDocRef = doc(db, FIRESTORE_COLLECTIONS.USERS, firebaseUser.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        return {
          id: firebaseUser.uid,
          anonymousId: userData.anonymousId,
          createdAt: userData.createdAt.toDate(),
          lastActive: userData.lastActive.toDate(),
        };
      }

      return null;
    } catch (error) {
      console.error("Error getting current user:", error);
      return null;
    }
  }

  /**
   * Update user's last active timestamp
   */
  static async updateLastActive(): Promise<void> {
    try {
      const auth = getAuthInstance();
      const db = getFirestoreInstance();

      const firebaseUser = auth.currentUser;
      if (!firebaseUser) return;

      const userDocRef = doc(db, FIRESTORE_COLLECTIONS.USERS, firebaseUser.uid);
      await updateDoc(userDocRef, {
        lastActive: new Date(),
      });
    } catch (error) {
      console.error("Error updating last active:", error);
    }
  }

  /**
   * Listen to authentication state changes
   */
  static onAuthStateChanged(callback: (user: User | null) => void): () => void {
    const auth = getAuthInstance();
    return onAuthStateChanged(
      auth,
      async (firebaseUser: FirebaseUser | null) => {
        if (firebaseUser) {
          const user = await this.getCurrentUser();
          callback(user);
        } else {
          callback(null);
        }
      }
    );
  }

  /**
   * Generate a random anonymous ID
   */
  private static generateAnonymousId(): string {
    const adjectives = [
      "Whispering",
      "Silent",
      "Quiet",
      "Secret",
      "Hidden",
      "Mysterious",
      "Gentle",
      "Soft",
      "Calm",
      "Peaceful",
      "Serene",
      "Tranquil",
    ];

    const nouns = [
      "Whisperer",
      "Listener",
      "Dreamer",
      "Thinker",
      "Soul",
      "Spirit",
      "Shadow",
      "Echo",
      "Voice",
      "Heart",
      "Mind",
      "Soul",
    ];

    const randomAdjective =
      adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
    const randomNumber = Math.floor(Math.random() * 999) + 1;

    return `${randomAdjective}${randomNoun}${randomNumber}`;
  }
}

export default AuthService;
