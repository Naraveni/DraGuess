
// Fix: Use scoped package imports to resolve module resolution issues with named exports in the environment
import { initializeApp } from '@firebase/app';
import { getFirestore } from '@firebase/firestore';
import { getAuth } from '@firebase/auth';

/**
 * Firebase configuration for 'sketch-party'.
 * These credentials allow the app to function in a live, public environment.
 */
const firebaseConfig = {
  apiKey: "AIzaSyCHrH7SyEJAQxea9ImT-wlX6xnO3lk1tXo",
  authDomain: "sketch-party.firebaseapp.com",
  projectId: "sketch-party",
  storageBucket: "sketch-party.firebasestorage.app",
  messagingSenderId: "742387552704",
  appId: "1:742387552704:web:5e3d27dfe841d8a4de7825",
  measurementId: "G-R0XGNJGDEQ"
};

// Initialize Firebase services
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };
