// src/controllers/authController.js

import { auth, db, storage } from "../services/firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { assertRateLimit, RATE } from "../utils/rateLimit";
import { evaluateShopLoginAccess } from "../utils/shopAccess";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

/** Cloud Function endpoints for server-side OTP (code never stored client-readable). */
const OTP_CF_BASE = "https://us-central1-iconstruct-58a87.cloudfunctions.net";

function otpEndpoints() {
  return {
    request: {
      local: "/api/otp/request",
      cloud: `${OTP_CF_BASE}/requestEmailOtp`,
    },
    verify: {
      local: "/api/otp/verify",
      cloud: `${OTP_CF_BASE}/verifyEmailOtp`,
    },
    assert: {
      local: "/api/otp/assert",
      cloud: `${OTP_CF_BASE}/assertEmailOtpVerified`,
    },
  };
}

function isLocalHost() {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

async function postOtpJson(url, body) {
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(
      "Cannot reach verification server. Check your connection or redeploy Cloud Functions."
    );
  }
  let data = {};
  try {
    data = await res.json();
  } catch {
    /* ignore */
  }
  return { res, data };
}

/**
 * Local: try Vite proxy first (no CORS), then fall back to deployed Cloud Function.
 * Production: call Cloud Function URL directly.
 */
async function callOtpEndpoint(kind, body) {
  const endpoints = otpEndpoints()[kind];
  if (!endpoints) throw new Error("Invalid OTP endpoint.");

  if (isLocalHost()) {
    const proxied = await postOtpJson(endpoints.local, body);
    if (proxied.res.ok) return proxied.data;

    // Proxy missing (old Vite process) or CF error through proxy — try cloud direct
    if (proxied.res.status === 404 || proxied.res.status === 502) {
      try {
        const direct = await postOtpJson(endpoints.cloud, body);
        if (direct.res.ok) return direct.data;
        throw new Error(
          direct.data.error ||
            `OTP service error (${direct.res.status}). Deploy: firebase deploy --only functions:requestEmailOtp,functions:verifyEmailOtp,functions:assertEmailOtpVerified`
        );
      } catch (err) {
        const msg = String(err?.message || err);
        if (/Cannot reach|Failed to fetch|NetworkError|CORS/i.test(msg)) {
          throw new Error(
            "OTP service not reachable. 1) Fully restart npm run dev  2) Deploy OTP functions: firebase deploy --only functions:requestEmailOtp,functions:verifyEmailOtp,functions:assertEmailOtpVerified"
          );
        }
        throw err;
      }
    }

    throw new Error(
      proxied.data.error || `Verification server error (${proxied.res.status}).`
    );
  }

  const { res, data } = await postOtpJson(endpoints.cloud, body);
  if (!res.ok) {
    throw new Error(data.error || `Verification server error (${res.status}).`);
  }
  return data;
}

/** Safe Storage object name (spaces / special chars break uploads). */
function safeFileName(name = "file") {
  return String(name)
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80);
}

async function fileFromDoc(d) {
  if (d.file instanceof Blob) return d.file;
  if (typeof d.url === "string" && d.url.startsWith("data:")) {
    const res = await fetch(d.url);
    return res.blob();
  }
  throw new Error(`Missing file data for "${d.name || "document"}".`);
}

async function uploadShopDocument(uid, d, index) {
  const blob = await fileFromDoc(d);
  const storageRef = ref(
    storage,
    `shop-documents/${uid}/${Date.now()}_${index}_${safeFileName(d.name)}`
  );
  await uploadBytes(storageRef, blob, {
    contentType: d.type || blob.type || "application/octet-stream",
  });
  const url = await getDownloadURL(storageRef);
  if (!url) throw new Error(`No download URL for "${d.name || "document"}".`);
  return {
    url,
    name: d.name || `document_${index + 1}`,
    type: d.type || blob.type || "",
    docType: d.docType || "other",
    size: d.size || blob.size || 0,
  };
}

/** Request OTP — code is generated and emailed only by Cloud Functions.
 *  flowId ties request → verify → register to one browser session. */
export async function sendOTP(email, ownerName, purpose = "register", flowId = "") {
  const normalized = normalizeEmail(email);
  assertRateLimit(`otp:${normalized}`, RATE.otp, "Too many OTP requests");
  await callOtpEndpoint("request", {
    email: normalized,
    ownerName: ownerName || "Shop Owner",
    purpose,
    flowId: flowId || "",
  });
  return true;
}

/** Verify OTP code via Cloud Functions (single-use server-side). */
export async function verifyOTP(email, inputOtp, flowId = "") {
  const normalized = normalizeEmail(email);
  assertRateLimit(
    `otp-verify:${normalized}`,
    { max: 10, windowMs: 15 * 60 * 1000 },
    "Too many OTP checks"
  );
  await callOtpEndpoint("verify", {
    email: normalized,
    otp: String(inputOtp || "").trim(),
    flowId: flowId || "",
  });
  return true;
}

async function assertEmailVerifiedForRegister(email, flowId = "") {
  await callOtpEndpoint("assert", {
    email: normalizeEmail(email),
    consume: false,
    flowId: flowId || "",
  });
}

async function consumeEmailVerification(email, flowId = "") {
  try {
    await callOtpEndpoint("assert", {
      email: normalizeEmail(email),
      consume: true,
      flowId: flowId || "",
    });
  } catch {
    /* best-effort */
  }
}

export async function loginShop(email, password) {
  const normalized = normalizeEmail(email);
  assertRateLimit(`login:${normalized}`, RATE.login, "Too many login attempts");

  const cred = await signInWithEmailAndPassword(auth, normalized, password);
  const snap = await getDoc(doc(db, "shops", cred.user.uid));
  if (!snap.exists()) {
    await signOut(auth);
    throw new Error("no-shop");
  }

  const status = snap.data().status;
  const access = evaluateShopLoginAccess(status);
  if (!access.ok) {
    await signOut(auth);
    const err = new Error(access.code);
    err.userMessage = access.message;
    throw err;
  }

  return { user: cred.user, status, shop: snap.data() };
}

export async function registerShop(form) {
  const email = normalizeEmail(form.email);
  const flowId = form.flowId || "";
  assertRateLimit(`register:${email}`, RATE.register, "Too many registration attempts");

  // Server gate — OTP collection is no longer client-readable
  await assertEmailVerifiedForRegister(email, flowId);

  const cred = await createUserWithEmailAndPassword(auth, email, form.password);

  let cleanDocs;
  try {
    cleanDocs = await Promise.all(
      (form.documents || []).map((d, i) => uploadShopDocument(cred.user.uid, d, i))
    );
  } catch (err) {
    try {
      await cred.user.delete();
    } catch {
      /* ignore */
    }
    throw new Error(
      err.message ||
        "Failed to upload documents to storage. Check Firebase Storage rules and try again."
    );
  }

  if (!cleanDocs.length || cleanDocs.some((d) => !d.url)) {
    try {
      await cred.user.delete();
    } catch {
      /* ignore */
    }
    throw new Error("Document upload incomplete. Please try again.");
  }

  try {
    await setDoc(doc(db, "shops", cred.user.uid), {
      uid: cred.user.uid,
      ownerName: form.ownerName,
      email: email,
      shopName: form.shopName,
      phone: form.phone,
      address: form.address,
      barangay: form.barangay || "",
      city: "Lipa City",
      province: "Batangas",
      description: form.description || "",
      documents: cleanDocs,
      documentURL: cleanDocs[0]?.url || "",
      documentName: cleanDocs[0]?.name || "",
      status: "pending",
      subscriptionPlan: "basic",
      subscriptionStatus: null,
      createdAt: serverTimestamp(),
    });
  } catch {
    // Without this, a failed profile write left a login account with no shop
    // behind it — every retry then hit "email already registered" for good.
    try {
      await cred.user.delete();
    } catch {
      /* ignore */
    }
    throw new Error("Couldn't save your shop details. Please check your connection and submit again.");
  }

  await consumeEmailVerification(email, flowId);

  // A pending shop can't use the dashboard yet, and staying signed in made
  // "Sign in" bounce through an access-restricted popup right after submit.
  await signOut(auth);

  return cred.user;
}

export async function logoutShop() {
  await signOut(auth);
}

export async function firebasePasswordReset(email) {
  const normalized = normalizeEmail(email);
  assertRateLimit(`pwreset-fb:${normalized}`, RATE.passwordReset, "Too many password reset requests");
  await sendPasswordResetEmail(auth, normalized);
}
