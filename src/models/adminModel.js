// src/models/adminModel.js
// ONLY job: talk to Firestore for admin-related data.

import { db } from "../services/firebase";
import {
  collection, doc, getDocs, updateDoc, getCountFromServer,
  query, orderBy, serverTimestamp, Timestamp,
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
    updatedAt: serverTimestamp(),
  });
}

// Update a payment request status
export async function updatePaymentStatus(paymentId, status, extra = {}) {
  await updateDoc(doc(db, "subscriptionPayments", paymentId), {
    status,
    ...extra,
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// Upgrade / set a shop's subscription (manual admin / payment confirm)
export async function updateShopSubscription(uid, plan, expiry) {
  const planKey = String(plan || "basic").toLowerCase();
  const isPaid = planKey === "pro" || planKey === "business";
  const payload = {
    subscriptionPlan: planKey,
    subscriptionStatus: isPaid ? "active" : "inactive",
    subscriptionUpdatedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (isPaid && expiry) {
    payload.subscriptionExpiry =
      expiry instanceof Date
        ? Timestamp.fromDate(expiry)
        : expiry;
  } else if (!isPaid) {
    payload.subscriptionExpiry = null;
  }
  await updateDoc(doc(db, "shops", uid), payload);
}

/** Count shared collections used by web shops + Flutter app. */
export async function fetchPlatformOpsCounts() {
  const safeCount = async (colName) => {
    try {
      const snap = await getCountFromServer(collection(db, colName));
      return snap.data().count || 0;
    } catch {
      // Fallback if count API / rules block (list may still work partially)
      try {
        const snap = await getDocs(collection(db, colName));
        return snap.size;
      } catch {
        return null;
      }
    }
  };

  const [projects, products, users] = await Promise.all([
    safeCount("projectPosts"),
    safeCount("products"),
    safeCount("users"),
  ]);

  return {
    projectPosts: projects,
    products,
    builders: users,
  };
}
