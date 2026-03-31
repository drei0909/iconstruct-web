// src/controllers/authController.js

import { auth, db } from "../services/firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import emailjs from "@emailjs/browser";

emailjs.init("8CRqLBqTGPfDxdwl-");

const EMAILJS_SERVICE_ID  = "service_ekwltb2";
const EMAILJS_TEMPLATE_ID = "template_i4tvz8h";
const EMAILJS_PUBLIC_KEY  = "8CRqLBqTGPfDxdwl-";

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendOTP(email, ownerName) {
  const otp     = generateOTP();
  const expires = Date.now() + 10 * 60 * 1000;

  await setDoc(doc(db, "otps", email), {
    otp,
    expires,
    createdAt: serverTimestamp(),
  });

  await emailjs.send(
    EMAILJS_SERVICE_ID,
    EMAILJS_TEMPLATE_ID,
    { to_email: email, to_name: ownerName || "Shop Owner", otp_code: otp },
    EMAILJS_PUBLIC_KEY
  );
  return true;
}

export async function verifyOTP(email, inputOtp) {
  const snap = await getDoc(doc(db, "otps", email));
  if (!snap.exists()) throw new Error("OTP not found. Please request a new one.");
  const { otp, expires } = snap.data();
  if (Date.now() > expires) throw new Error("OTP has expired. Please request a new one.");
  if (inputOtp.trim() !== otp) throw new Error("Incorrect OTP. Please check your email and try again.");
  return true;
}

export async function loginShop(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const snap = await getDoc(doc(db, "shops", cred.user.uid));
  if (!snap.exists()) throw new Error("no-shop");
  return { user: cred.user, status: snap.data().status };
}

export async function registerShop(form) {
  const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
  await setDoc(doc(db, "shops", cred.user.uid), {
    uid:         cred.user.uid,
    ownerName:   form.ownerName,
    email:       form.email,
    shopName:    form.shopName,
    phone:       form.phone,
    address:     form.address,
    city:        form.city,
    province:    form.province,
    description: form.description || "",
    documentURL: form.documentURL || "",
    status:      "pending",
    createdAt:   serverTimestamp(),
  });
  return cred.user;
}

export async function logoutShop() {
  await signOut(auth);
}


