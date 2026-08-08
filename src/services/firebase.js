// src/services/firebase.js
import { initializeApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getMessaging, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyC4hyvv3ZtGWs0XmpeRgkIsJloFvahc6LI",
  authDomain: "iconstruct-58a87.firebaseapp.com",
  projectId: "iconstruct-58a87",
  storageBucket: "iconstruct-58a87.firebasestorage.app",
  messagingSenderId: "244045941716",
  appId: "1:244045941716:web:3a6b24865a2f29d7606441",
  measurementId: "G-527KSF5D03",
};

const app = initializeApp(firebaseConfig);

// ── Firestore with persistent local cache (multi-tab safe) ──────────────────
// This replaces getFirestore(app).
// persistentLocalCache = data cached in IndexedDB across sessions.
// persistentMultipleTabManager = safe when multiple tabs are open.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

export const storage  = getStorage(app);
export const auth     = getAuth(app);
export const messaging = isSupported().then((supported) =>
  supported ? getMessaging(app) : null
);