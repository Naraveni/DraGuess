import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

// Helper to safely get env vars from various sources
const getEnv = (key: string, fallback: string) => {
  try {
    // @ts-ignore
    const val = (window.process?.env?.[key]) || (import.meta.env?.[key]);
    return (val && val !== "YOUR_API_KEY" && !val.includes("YOUR_")) ? val : fallback;
  } catch (e) {
    return fallback;
  }
};

const firebaseConfig = {
  apiKey: getEnv("VITE_FIREBASE_API_KEY", ""),
  authDomain: getEnv("VITE_FIREBASE_AUTH_DOMAIN", ""),
  projectId: getEnv("VITE_FIREBASE_PROJECT_ID", ""),
  storageBucket: getEnv("VITE_FIREBASE_STORAGE_BUCKET", ""),
  messagingSenderId: getEnv("VITE_FIREBASE_MESSAGING_SENDER_ID", ""),
  appId: getEnv("VITE_FIREBASE_APP_ID", "")
};

let app: FirebaseApp;
let db: Firestore;
let auth: Auth;

try {
  if (firebaseConfig.apiKey && firebaseConfig.apiKey.length > 5) {
    app = initializeApp(firebaseConfig);
  } else {
    // Fallback to avoid breaking the UI during initial setup
    console.warn("Firebase: Using placeholder. Add your VITE_FIREBASE_API_KEY to see real-time features.");
    app = initializeApp({ apiKey: "none", projectId: "none" });
  }
  db = getFirestore(app);
  auth = getAuth(app);
} catch (error) {
  console.error("Firebase init failed:", error);
  // Prevent fatal undefined errors
  app = {} as FirebaseApp;
  db = {} as Firestore;
  auth = {} as Auth;
}

export { db, auth };