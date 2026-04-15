// src/controllers/authController.js

import { auth, db, storage } from "../services/firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { sendOTPEmail } from "../services/emailService";

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendOTP(email, ownerName) {
  const otp     = generateOTP();
  const expires = Date.now() + 10 * 60 * 1000;
  await setDoc(doc(db, "otps", email), {
    otp, expires, createdAt: serverTimestamp(),
  });
  await sendOTPEmail({
    toEmail: email,
    toName:  ownerName || "Shop Owner",
    otpCode: otp,
  });
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

  // Upload each document to Firebase Storage and get download URLs
  const cleanDocs = await Promise.all(
    (form.documents || []).map(async (d, i) => {
      let url = "";
      if (d.url) {
        try {
          const storageRef = ref(
            storage,
            `shop-documents/${cred.user.uid}/${Date.now()}_${i}_${d.name}`
          );
          await uploadString(storageRef, d.url, "data_url");
          url = await getDownloadURL(storageRef);
        } catch (err) {
          console.warn("Failed to upload document:", d.name, err);
        }
      }
      return {
        url,
        name:    d.name    || "",
        type:    d.type    || "",
        docType: d.docType || "other",
        size:    d.size    || 0,
      };
    })
  );

  await setDoc(doc(db, "shops", cred.user.uid), {
    uid:          cred.user.uid,
    ownerName:    form.ownerName,
    email:        form.email,
    shopName:     form.shopName,
    phone:        form.phone,
    address:      form.address,
    barangay:     form.barangay  || "",
    city:         "Lipa City",
    province:     "Batangas",
    description:  form.description || "",
    documents:    cleanDocs,
    documentURL:  cleanDocs[0]?.url  || "",
    documentName: cleanDocs[0]?.name || "",
    status:       "pending",
    subscriptionPlan:   "basic",
    subscriptionStatus: null,
    createdAt:    serverTimestamp(),
  });

  return cred.user;
}

export async function logoutShop() {
  await signOut(auth);
}

export async function initPasswordReset(email, db) {
  const { getDocs, collection, query, where } = await import("firebase/firestore");

  const q    = query(collection(db, "shops"), where("email", "==", email.toLowerCase()));
  const snap = await getDocs(q);

  if (snap.empty) throw new Error("no-account");

  const shopData  = snap.docs[0].data();
  const ownerName = shopData.ownerName || "Shop Owner";

  await sendOTP(email.toLowerCase(), ownerName);

  return { ownerName };
}

export async function firebasePasswordReset(email) {
  await sendPasswordResetEmail(auth, email.toLowerCase());
}