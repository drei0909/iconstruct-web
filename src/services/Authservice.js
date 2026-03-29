// src/services/authService.js
import emailjs from "@emailjs/browser";
import { auth, db } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
emailjs.init("8CRqLBqTGPfDxdwl-");

// ─── EmailJS config ───────────────────────────────────────────
// 1. Go to https://www.emailjs.com and create a free account
// 2. Create a Service (Gmail) and get your Service ID
// 3. Create an Email Template with these variables:
//    {{to_email}}, {{to_name}}, {{otp_code}}
// 4. Get your Public Key from Account > API Keys
// Replace the values below with your own:
const EMAILJS_SERVICE_ID  = "service_ekwltb2";
const EMAILJS_TEMPLATE_ID = "template_i4tvz8h";
const EMAILJS_PUBLIC_KEY  = "8CRqLBqTGPfDxdwl-";

// ─── OTP helpers ──────────────────────────────────────────────

/** Generate a random 6-digit OTP */
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send OTP to email and save it to Firestore (otps/{email}).
 * OTP expires in 10 minutes.
 */
export async function sendOTP(email, ownerName) {
  const otp     = generateOTP();
  const expires = Date.now() + 10 * 60 * 1000; // 10 min from now

  // Save OTP to Firestore
  await setDoc(doc(db, "otps", email), {
    otp,
    expires,
    createdAt: serverTimestamp(),
  });

  // Send email via EmailJS
  await emailjs.send(
    EMAILJS_SERVICE_ID,
    EMAILJS_TEMPLATE_ID,
    {
      to_email: email,
      to_name:  ownerName || "Shop Owner",
      otp_code: otp,
    },
    EMAILJS_PUBLIC_KEY
  );

  return true;
}

/**
 * Verify the OTP the user typed against what's in Firestore.
 * Returns true if valid, throws an error if invalid/expired.
 */
export async function verifyOTP(email, inputOtp) {
  const snap = await getDoc(doc(db, "otps", email));

  if (!snap.exists()) {
    throw new Error("OTP not found. Please request a new one.");
  }

  const { otp, expires } = snap.data();

  if (Date.now() > expires) {
    throw new Error("OTP has expired. Please request a new one.");
  }

  if (inputOtp.trim() !== otp) {
    throw new Error("Incorrect OTP. Please check your email and try again.");
  }

  return true;
}

// ─── Register ─────────────────────────────────────────────────

/**
 * Register a new hardware shop owner.
 * 1. Creates Firebase Auth account
 * 2. Saves shop data + document URL to Firestore with status: "pending"
 */
export async function registerShop(form) {
  const {
    ownerName,
    email,
    password,
    shopName,
    phone,
    address,
    city,
    province,
    description,
    documentURL, // uploaded file URL (from Cloudinary or base64)
  } = form;

  // 1. Create auth user
  const userCredential = await createUserWithEmailAndPassword(
    auth,
    email,
    password
  );
  const uid = userCredential.user.uid;

  // 2. Save to Firestore
  await setDoc(doc(db, "shops", uid), {
    uid,
    ownerName,
    email,
    shopName,
    phone,
    address,
    city,
    province,
    description:  description  || "",
    documentURL:  documentURL  || "",   // proof of legitimacy
    status:       "pending",
    createdAt:    serverTimestamp(),
  });

  return userCredential.user;
}

// ─── Login ────────────────────────────────────────────────────

/**
 * Sign in + check approval status.
 * Returns { user, status }
 */
export async function loginShop(email, password) {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  const shopSnap = await getDoc(doc(db, "shops", user.uid));
  if (!shopSnap.exists()) throw new Error("no-shop");

  return { user, status: shopSnap.data().status };
}

// ─── Logout ───────────────────────────────────────────────────

export async function logoutShop() {
  await signOut(auth);
}
