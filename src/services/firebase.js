// Import Firebase core
import { initializeApp } from "firebase/app";

// Import Firebase services you will use
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC4hyvv3ZtGWs0XmpeRgkIsJloFvahc6LI",
  authDomain: "iconstruct-58a87.firebaseapp.com",
  projectId: "iconstruct-58a87",
  storageBucket: "iconstruct-58a87.firebasestorage.app",
  messagingSenderId: "244045941716",
  appId: "1:244045941716:web:3a6b24865a2f29d7606441",
  measurementId: "G-527KSF5D03"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const db = getFirestore(app);
export const auth = getAuth(app);