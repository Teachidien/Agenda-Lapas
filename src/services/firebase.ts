import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBYpKQmRMlbASYnRP92UuylmaNDuj-jREM",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "agenda-lapas.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "agenda-lapas",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "agenda-lapas.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "897361130409",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:897361130409:web:e3f716135f0948d4a40ab8",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-ZQJP27W97T"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Firebase Services
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
