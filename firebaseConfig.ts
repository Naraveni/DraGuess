
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
// Fix: Use namespace import for firebase/auth to resolve 'no exported member' errors in this environment
import * as firebaseAuth from 'firebase/auth';

// Fix: Use process.env for configuration variables as per the environment's pre-configured context
const firebaseConfig = {
  apiKey: (process.env as any).VITE_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: (process.env as any).VITE_FIREBASE_AUTH_DOMAIN || "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: (process.env as any).VITE_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
  storageBucket: (process.env as any).VITE_FIREBASE_STORAGE_BUCKET || "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: (process.env as any).VITE_FIREBASE_MESSAGING_SENDER_ID || "YOUR_SENDER_ID",
  appId: (process.env as any).VITE_FIREBASE_APP_ID || "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
// Fix: Access getAuth through the namespace to bypass resolution issues
export const auth = (firebaseAuth as any).getAuth(app);
