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
function otpUrls() {
  const base = "https://us-central1-iconstruct-58a87.cloudfunctions.net";
  return {
    request: `${base}/requestEmailOtp`,
    verify: `${base}/verifyEmailOtp`,
    assert: `${base}/assertEmailOtpVerified`,
  };
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

/** Request OTP — code is generated and emailed only by Cloud Functions. */
export async function sendOTP(email, ownerName, purpose = "register") {
  const normalized = normalizeEmail(email);
  assertRateLimit(`otp:${normalized}`, RATE.otp, "Too many OTP requests");
  const { request } = otpUrls();
  await postOtpJson(request, {
    email: normalized,
    ownerName: ownerName || "Shop Owner",
    purpose,
  });
  return true;
}

/** Verify OTP code via Cloud Functions (single-use server-side). */
export async function verifyOTP(email, inputOtp) {
  const normalized = normalizeEmail(email);
  assertRateLimit(
    `otp-verify:${normalized}`,
    { max: 10, windowMs: 15 * 60 * 1000 },
    "Too many OTP checks"
  );
  const { verify } = otpUrls();
  await postOtpJson(verify, {
    email: normalized,
    otp: String(inputOtp || "").trim(),
  });
  return true;
}

async function assertEmailVerifiedForRegister(email) {
  const { assert } = otpUrls();
  await postOtpJson(assert, { email: normalizeEmail(email), consume: false });
}

async function consumeEmailVerification(email) {
  try {
    const { assert } = otpUrls();
    await postOtpJson(assert, { email: normalizeEmail(email), consume: true });
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
  assertRateLimit(`register:${email}`, RATE.register, "Too many registration attempts");

  // Server gate — OTP collection is no longer client-readable
  await assertEmailVerifiedForRegister(email);

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

  await consumeEmailVerification(email);

  return cred.user;
}

export async function logoutShop() {
  await signOut(auth);
}

export async function initPasswordReset(email, db) {
  const { getDocs, collection, query, where } = await import("firebase/firestore");
  const normalized = normalizeEmail(email);
  assertRateLimit(`pwreset:${normalized}`, RATE.passwordReset, "Too many password reset requests");

  const q = query(collection(db, "shops"), where("email", "==", normalized));
  const snap = await getDocs(q);

  if (snap.empty) throw new Error("no-account");

  const shopData = snap.docs[0].data();
  const ownerName = shopData.ownerName || "Shop Owner";

  await sendOTP(normalized, ownerName, "password_reset");

  return { ownerName };
}

export async function firebasePasswordReset(email) {
  const normalized = normalizeEmail(email);
  assertRateLimit(`pwreset-fb:${normalized}`, RATE.passwordReset, "Too many password reset requests");
  await sendPasswordResetEmail(auth, normalized);
}
