// Import Firebase core
import { initializeApp } from "firebase/app";

// Import Firebase services
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getMessaging, isSupported } from "firebase/messaging";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC4hyvv3ZtGWs0XmpeRgkIsJloFvahc6LI",
  authDomain: "iconstruct-58a87.firebaseapp.com",
  projectId: "iconstruct-58a87",
  storageBucket: "iconstruct-58a87.firebasestorage.app",
  messagingSenderId: "244045941716",
  appId: "1:244045941716:web:3a6b24865a2f29d7606441",
  measurementId: "G-527KSF5D03",
};

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Initialize services (same as before — nothing removed)
export const storage = getStorage(app);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Initialize Firebase Cloud Messaging
// isSupported() checks if the browser supports FCM (not all browsers do)
export const messaging = isSupported().then((supported) =>
  supported ? getMessaging(app) : null
);