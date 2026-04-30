// src/models/adminModel.js
// ONLY job: talk to Firestore for admin-related data.

import { db } from "../services/firebase";
import {
  collection, doc, getDocs, updateDoc,
  query, orderBy, serverTimestamp,
} from "firebase/firestore";

// Get all shops
export async function fetchAllShops() {
  const snap = await getDocs(collection(db, "shops"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Get all payment requests
export async function fetchAllPayments() {
  const q = query(
    collection(db, "subscriptionPayments"),
    orderBy("submittedAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Update a shop's approval status
export async function updateShopApproval(uid, status, rejectionReason = "") {
  await updateDoc(doc(db, "shops", uid), {
    status,
    rejectionReason,
    reviewedAt: serverTimestamp(),
     updatedAt:  serverTimestamp(),
  });
}

// Update a payment request status
export async function updatePaymentStatus(paymentId, status, extra = {}) {
  await updateDoc(doc(db, "subscriptionPayments", paymentId), {
    status,
    ...extra,
    reviewedAt: serverTimestamp(),
     updatedAt:  serverTimestamp(),
  });
}

// Upgrade a shop's subscription
export async function updateShopSubscription(uid, plan, expiry) {
  await updateDoc(doc(db, "shops", uid), {
    subscriptionPlan: plan,
    subscriptionStatus: "active",
    subscriptionExpiry: expiry,
    subscriptionUpdatedAt: serverTimestamp(),
     updatedAt:  serverTimestamp(),
  });
}