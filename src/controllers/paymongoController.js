// src/controllers/paymongoController.js
// ALWAYS use Cloud Functions (local + production) so webhooks + checkoutSessions work.

import { auth } from "../services/firebase";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../services/firebase";
import { assertRateLimit, RATE } from "../utils/rateLimit";
import { isShopApproved } from "../utils/shopAccess";

const SESSION_STORAGE_KEY = "pm_checkout_id";
const SESSION_LOCAL_KEY = "pm_checkout_id_persistent";

const CF = {
  create:
    "https://us-central1-iconstruct-58a87.cloudfunctions.net/createCheckoutSession",
  verify:
    "https://us-central1-iconstruct-58a87.cloudfunctions.net/verifyPaymentSession",
  sync:
    "https://us-central1-iconstruct-58a87.cloudfunctions.net/syncMyLatestPayment",
};

function apiUrls() {
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  const isLocal = host === "localhost" || host === "127.0.0.1";
  // Local Vite proxy avoids browser CORS while developing
  if (isLocal) {
    return {
      create: "/api/paymongo/create",
      verify: "/api/paymongo/verify",
      sync: "/api/paymongo/sync",
    };
  }
  return CF;
}

function saveSessionId(sessionId) {
  if (!sessionId) return;
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(SESSION_LOCAL_KEY, sessionId);
  } catch {
    /* ignore */
  }
}

function readSavedSessionId() {
  try {
    const a = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (a) return a;
  } catch {
    /* ignore */
  }
  try {
    return localStorage.getItem(SESSION_LOCAL_KEY);
  } catch {
    return null;
  }
}

function clearSavedSessionId() {
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(SESSION_LOCAL_KEY);
  } catch {
    /* ignore */
  }
}

async function authHeaders() {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("You must be signed in to start a payment.");
  }
  // Force refresh so Cloud Functions / Vite don't get a stale token (401)
  const token = await user.getIdToken(true);
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function postJson(url, body) {
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(
      "Cannot reach payment server. Check your connection and that Cloud Functions are deployed."
    );
  }

  let data = {};
  try {
    data = await res.json();
  } catch {
    /* non-JSON */
  }

  if (!res.ok) {
    throw new Error(data.error || `Payment server error (${res.status}).`);
  }
  return data;
}

/**
 * Creates a PayMongo Checkout Session and redirects the browser.
 */
export async function redirectToPayMongoCheckout({ planId, shopId, shopEmail }) {
  const user = auth.currentUser;
  if (!user) throw new Error("You must be signed in to start a payment.");

  const uid = user.uid;
  const shopSnap = await getDoc(doc(db, "shops", uid));
  if (!shopSnap.exists() || !isShopApproved(shopSnap.data().status)) {
    throw new Error("Only approved shops can start a payment.");
  }
  assertRateLimit(`checkout:${uid}`, RATE.checkout, "Too many checkout attempts");

  const data = await postJson(apiUrls().create, {
    planId,
    shopId: uid,
    shopEmail: shopEmail || user.email || "",
    successUrl: `${window.location.origin}/shop/payment-success`,
    cancelUrl: `${window.location.origin}/shop/dashboard`,
  });

  if (!data.url) {
    throw new Error(data.error || "Failed to start PayMongo checkout.");
  }

  if (data.sessionId) saveSessionId(data.sessionId);

  window.location.href = data.url;
}

/**
 * Verifies a PayMongo checkout session after redirect.
 */
export async function verifyPayMongoPayment(sessionId) {
  const id = sessionId || readSavedSessionId();

  if (!id) {
    // Fall back to sync (checks all pending cloud checkouts for this shop)
    return syncMyLatestPayment();
  }

  let last = { success: true, paid: false };
  const delays = [0, 1200, 2000, 3000, 4000];

  for (let i = 0; i < delays.length; i++) {
    if (delays[i] > 0) {
      await new Promise((r) => setTimeout(r, delays[i]));
    }
    last = await postJson(apiUrls().verify, { sessionId: id });
    if (last.paid) {
      clearSavedSessionId();
      return last;
    }
  }

  // Final attempt: sync all pending for this user
  const sync = await syncMyLatestPayment(id);
  if (sync.paid) {
    clearSavedSessionId();
    return sync;
  }

  return last;
}

/**
 * Re-check PayMongo for this shop (missed webhook / closed tab).
 * Call after login if still Basic after paying.
 */
export async function syncMyLatestPayment(sessionId) {
  const id = sessionId || readSavedSessionId() || undefined;
  const data = await postJson(apiUrls().sync, id ? { sessionId: id } : {});
  if (data.paid) clearSavedSessionId();
  return data;
}
