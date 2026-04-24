import { getToken, onMessage } from "firebase/messaging";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";

import { db, messaging as messagingPromise } from "./firebase";

// ─── Your VAPID key from Firebase Console ────────────────────────────────────
// Firebase Console → Project Settings → Cloud Messaging → Web Push certificates
const VAPID_KEY = "BH_v-D15brArRsVBcVQFDVmRKWWJ7T1_F5oZv4XK99PcJCdZUIHE4krWHIpuO3_eOtOzaJUyknB1FCjliv6__r4";

// ─────────────────────────────────────────────────────────────────────────────
// Finds the Firestore shop document ID for a given UID.
// First tries shops/{uid} directly, then falls back to a query.
// ─────────────────────────────────────────────────────────────────────────────
async function resolveShopDocId(shopUid) {
  const q = query(
    collection(db, "shops"),
    where("uid", "==", shopUid)
  );

  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    return snapshot.docs[0].id;
  }

  // Fallback: assume docId === uid
  console.warn("[FCM] No shop found via uid query, falling back to direct path.");
  return shopUid;
}

// ─────────────────────────────────────────────────────────────────────────────
// Saves the FCM token to shops/{shopDocId}.fcmTokens
// arrayUnion ensures no duplicates and no overwriting
// ─────────────────────────────────────────────────────────────────────────────
async function saveTokenToFirestore(shopDocId, token) {
  const shopRef = doc(db, "shops", shopDocId);
  await updateDoc(shopRef, {
    fcmTokens: arrayUnion(token),
  });
  console.log(`[FCM] Token saved to shops/${shopDocId}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN FUNCTION — call this right after shop login
// ─────────────────────────────────────────────────────────────────────────────
export async function requestNotificationPermission(shopUid) {
  if (!shopUid) {
    console.error("[FCM] shopUid is required.");
    return null;
  }

  // Step 1: Check / request browser notification permission
  if (Notification.permission === "denied") {
    console.warn("[FCM] Notifications are blocked. User must enable in browser settings.");
    return null;
  }

  const permission =
    Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();

  if (permission !== "granted") {
    console.warn("[FCM] Notification permission not granted.");
    return null;
  }

  // Step 2: Get the messaging instance
  const messaging = await messagingPromise;
  if (!messaging) {
    console.warn("[FCM] FCM not supported in this browser.");
    return null;
  }

  try {
    // Step 3: Register the service worker
    const swRegistration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js",
      { scope: "/" }
    );

    // Step 4: Generate / retrieve FCM token
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    });

    if (!token) {
      console.error("[FCM] No token returned. Check VAPID key.");
      return null;
    }

    // Step 5: Find the correct shop document and save token
    const shopDocId = await resolveShopDocId(shopUid);
    await saveTokenToFirestore(shopDocId, token);

    // Step 6: Handle foreground messages (when app tab is open/visible)
    onMessage(messaging, (payload) => {
      console.log("[FCM] Foreground message:", payload);
      const { title, body } = payload.notification ?? {};
      if (title) {
        new Notification(title, {
          body: body ?? "",
          icon: "/assets/icons/icon-192x192.png",
        });
      }
    });

    console.log("[FCM] Setup complete.");
    return token;

  } catch (error) {
    console.error("[FCM] Setup error:", error);
    return null;
  }
}