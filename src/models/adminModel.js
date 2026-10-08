// src/models/adminModel.js
// ONLY job: talk to Firestore for admin-related data.

import { db } from "../services/firebase";
import {
  collection, doc, getDocs, updateDoc, getCountFromServer,
  query, orderBy, serverTimestamp, Timestamp,
  where, limit, onSnapshot,
} from "firebase/firestore";

const NOTIF_SOURCES = [
  { key: "shops",    col: "shops",                field: "status", value: "pending" },
  { key: "payments", col: "subscriptionPayments", field: "status", value: "pending" },
  { key: "messages", col: "contactMessages",      field: "status", value: "new" },
];

/**
 * Live feed of everything waiting on an admin: pending shop applications,
 * pending payments, and new contact messages. Each listener only watches
 * the actionable subset (status filter + cap), never a whole collection,
 * so it stays cheap no matter how many shops/payments pile up over time.
 *
 * onChange receives { shops, payments, messages } (arrays of docs) and,
 * after the first load, `added` — docs that just arrived — so the caller
 * can alert on genuinely new items without re-alerting on page load.
 */
export function subscribeToAdminInbox(onChange, onError, cap = 50) {
  const state = { shops: [], payments: [], messages: [] };
  const primed = { shops: false, payments: false, messages: false };

  const unsubs = NOTIF_SOURCES.map(({ key, col, field, value }) =>
    onSnapshot(
      query(collection(db, col), where(field, "==", value), limit(cap)),
      (snap) => {
        const added = primed[key]
          ? snap.docChanges()
              .filter((c) => c.type === "added")
              .map((c) => ({ id: c.doc.id, ...c.doc.data(), kind: key }))
          : [];
        primed[key] = true;
        state[key] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        onChange({ ...state, added });
      },
      (err) => onError?.(key, err)
    )
  );

  return () => unsubs.forEach((u) => u());
}

// Get all shops
export async function fetchAllShops() {
  const snap = await getDocs(collection(db, "shops"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Get all payment requests
export async function fetchAllPayments() {
  try {
    const q = query(
      collection(db, "subscriptionPayments"),
      orderBy("submittedAt", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn("Payments ordered query failed, falling back:", err?.message || err);
    const snap = await getDocs(collection(db, "subscriptionPayments"));
    const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    rows.sort((a, b) => {
      const ta = a.submittedAt?.toMillis?.() || a.submittedAt?.seconds * 1000 || 0;
      const tb = b.submittedAt?.toMillis?.() || b.submittedAt?.seconds * 1000 || 0;
      return tb - ta;
    });
    return rows;
  }
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

  const [projects, users] = await Promise.all([
    safeCount("projectPosts"),
    safeCount("users"),
  ]);

  return {
    projectPosts: projects,
    builders: users,
  };
}
