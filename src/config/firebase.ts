import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
  Firestore,
} from "firebase/firestore";
import {
  getStorage,
  connectStorageEmulator,
  FirebaseStorage,
} from "firebase/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { env, validateEnvironment, isDevelopment } from "./environment";

// Validate environment variables
validateEnvironment();

// Firebase configuration
const firebaseConfig = {
  apiKey: env.firebase.apiKey,
  authDomain: env.firebase.authDomain,
  projectId: env.firebase.projectId,
  storageBucket: env.firebase.storageBucket,
  messagingSenderId: env.firebase.messagingSenderId,
  appId: env.firebase.appId,
};

// Firebase service instances
let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;
let firebaseDb: Firestore | null = null;
let firebaseStorage: FirebaseStorage | null = null;
let isInitialized = false;

/**
 * Initialize Firebase services
 */
export const initializeFirebase = async (): Promise<void> => {
  if (isInitialized) {
    return;
  }

  try {
    // Initialize Firebase app
    firebaseApp =
      getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    console.log("Firebase app initialized successfully");

    // Initialize Firebase Auth
    // Note: In Expo Go, Firebase Auth uses memory persistence by default
    // For full persistence, you need to use a development build or bare workflow
    firebaseAuth = getAuth(firebaseApp);
    console.log("Firebase Auth initialized");

    // Initialize Firebase services
    firebaseDb = getFirestore(firebaseApp);
    console.log("Firebase Firestore initialized");

    firebaseStorage = getStorage(firebaseApp);
    console.log("Firebase Storage initialized");

    // Connect to emulators in development (only if explicitly enabled and emulators are running)
    if (isDevelopment() && env.app.enableEmulators) {
      await connectToEmulators();
    } else if (isDevelopment()) {
      console.log(
        "Firebase emulators disabled. Set EXPO_PUBLIC_ENABLE_EMULATORS=true to enable."
      );
    }

    isInitialized = true;
    console.log("Firebase initialization completed successfully");
  } catch (error) {
    console.error("Failed to initialize Firebase:", error);
    throw error;
  }
};

/**
 * Connect to Firebase emulators
 */
const connectToEmulators = async (): Promise<void> => {
  if (!firebaseAuth || !firebaseDb || !firebaseStorage) {
    throw new Error("Firebase services not initialized");
  }

  try {
    // Test if emulators are actually running before connecting
    const testAuthConnection = async () => {
      try {
        const { connectAuthEmulator } = await import("firebase/auth");
        await connectAuthEmulator(firebaseAuth!, "http://localhost:9099", {
          disableWarnings: true,
        });
        return true;
      } catch (error) {
        console.log("Auth emulator not available at localhost:9099");
        return false;
      }
    };

    const testFirestoreConnection = async () => {
      try {
        await connectFirestoreEmulator(firebaseDb!, "localhost", 8080);
        return true;
      } catch (error) {
        console.log("Firestore emulator not available at localhost:8080");
        return false;
      }
    };

    const testStorageConnection = async () => {
      try {
        await connectStorageEmulator(firebaseStorage!, "localhost", 9199);
        return true;
      } catch (error) {
        console.log("Storage emulator not available at localhost:9199");
        return false;
      }
    };

    // Try to connect to each emulator individually
    const authConnected = await testAuthConnection();
    const firestoreConnected = await testFirestoreConnection();
    const storageConnected = await testStorageConnection();

    if (authConnected || firestoreConnected || storageConnected) {
      console.log("Firebase emulators connected:", {
        auth: authConnected,
        firestore: firestoreConnected,
        storage: storageConnected,
      });
    } else {
      console.log(
        "No Firebase emulators are running. Using production services."
      );
    }
  } catch (error) {
    console.log("Failed to connect to Firebase emulators:", error);
    console.log("Using production Firebase services instead.");
  }
};

/**
 * Get Firebase Auth instance
 */
export const getAuthInstance = (): Auth => {
  if (!firebaseAuth || !isInitialized) {
    throw new Error(
      "Firebase Auth not initialized. Call initializeFirebase() first."
    );
  }
  return firebaseAuth;
};

/**
 * Get Firebase Firestore instance
 */
export const getFirestoreInstance = (): Firestore => {
  if (!firebaseDb || !isInitialized) {
    throw new Error(
      "Firebase Firestore not initialized. Call initializeFirebase() first."
    );
  }
  return firebaseDb;
};

/**
 * Get Firebase Storage instance
 */
export const getStorageInstance = (): FirebaseStorage => {
  if (!firebaseStorage || !isInitialized) {
    throw new Error(
      "Firebase Storage not initialized. Call initializeFirebase() first."
    );
  }
  return firebaseStorage;
};

/**
 * Get Firebase App instance
 */
export const getAppInstance = (): FirebaseApp => {
  if (!firebaseApp || !isInitialized) {
    throw new Error(
      "Firebase App not initialized. Call initializeFirebase() first."
    );
  }
  return firebaseApp;
};

/**
 * Check if Firebase is initialized
 */
export const isFirebaseInitialized = (): boolean => {
  return isInitialized;
};

// Legacy exports for backward compatibility
export const auth = getAuthInstance;
export const db = getFirestoreInstance;
export const storage = getStorageInstance;
export default getAppInstance;
