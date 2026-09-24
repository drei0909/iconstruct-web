// src/services/firebase.js
import { initializeApp, deleteApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
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

// ── App Check ──────────────────────────────────────────────────────────────
// Attaches an attestation token to every Firestore / Storage / Functions call
// so the backend can tell genuine app traffic from scripts. Enforcement is
// configured per-API in the Firebase Console — keep it OFF until the Flutter
// app also sends tokens.
//
// Local dev (npm run dev) can't run real reCAPTCHA, so a debug token is used.
// On first run the browser console prints:  "App Check debug token: <uuid>"
// Register that value at: Firebase Console → App Check → your web app →
// "Manage debug tokens".
if (import.meta.env.DEV) {
  // eslint-disable-next-line no-restricted-globals
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

try {
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(
      "6LdPvqEtAAAAAB0c93AWrDfoegfc8KttTr8uJRuz"
    ),
    isTokenAutoRefreshEnabled: true,
  });
} catch (err) {
  // Never let App Check init break the app (e.g. blocked reCAPTCHA script).
  console.warn("[AppCheck] init skipped:", err?.message || err);
}

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

/**
 * Create a new Firebase Auth user WITHOUT touching the caller's own session.
 * createUserWithEmailAndPassword on the primary `auth` instance signs the
 * client in as the newly created user, replacing whoever was already signed
 * in — fatal when an admin uses this to invite another admin, since it both
 * kicks them out mid-flow and leaves them unable to write the new admin's
 * Firestore doc (their own admin session is gone, and the brand-new user
 * isn't an admin yet). A throwaway secondary App instance sidesteps this.
 */
export async function createUserOnSecondaryApp(email, password) {
  const secondaryApp = initializeApp(firebaseConfig, `secondary-${Date.now()}`);
  try {
    const secondaryAuth = getAuth(secondaryApp);
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    return cred.user.uid;
  } finally {
    await deleteApp(secondaryApp);
  }
}