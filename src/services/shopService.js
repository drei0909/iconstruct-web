// src/services/shopService.js
// iConstruct — Shop Owner Service
//
// ROOT CAUSE FIX for "Failed to load data":
//   The old version called getAuth() / getFirestore() at the TOP of the file (module level).
//   Those calls execute before your firebase.js initialization code runs, so you get
//   a default uninitialized app → every Firestore read throws "not authenticated".
//
//   SOLUTION: Import the already-initialized `auth` and `db` from firebase.js directly.
//   Never call getAuth() / getFirestore() at module level in service files.

import { auth, db } from "./firebase";          // ← your initialized instances
import { signOut } from "firebase/auth";
import {
  doc, getDoc, getDocs,
  collection, query, where, orderBy,
  addDoc, serverTimestamp,
} from "firebase/firestore";

/* ─── Auth ──────────────────────────────────────────────────── */

export async function logoutShop() {
  await signOut(auth);
}

/* ─── Shop Profile ───────────────────────────────────────────── */

/**
 * Returns the shop owner's Firestore document.
 * Key subscription fields:
 *   subscriptionPlan:   "basic" | "pro" | "business"
 *   subscriptionStatus: "none"  | "active" | "expired"
 *   subscriptionExpiry: Date (JS Date, not Timestamp — converted by confirmPayment)
 */
export async function getShopProfile() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const snap = await getDoc(doc(db, "shops", user.uid));
  if (!snap.exists()) throw new Error("Shop profile not found");
  return { id: snap.id, ...snap.data() };
}

/* ─── Projects ───────────────────────────────────────────────── */

export async function getPostedProjects() {
  const q = query(
    collection(db, "projects"),
    where("status", "==", "open"),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/* ─── Quotations ─────────────────────────────────────────────── */

export async function getShopQuotations() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const q = query(
    collection(db, "quotations"),
    where("shopId", "==", user.uid),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function submitQuotation({ projectId, amount, note }) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const projectSnap  = await getDoc(doc(db, "projects", projectId));
  const projectTitle = projectSnap.data()?.title || "Project";
  await addDoc(collection(db, "quotations"), {
    projectId,
    projectTitle,
    shopId:    user.uid,
    amount:    parseFloat(amount),
    note:      note || "",
    status:    "pending",
    createdAt: serverTimestamp(),
  });
}

/* ─── Analytics (Pro & Business only) ───────────────────────── */

export async function getQuotationAnalytics() {
  const quotations = await getShopQuotations();
  const total    = quotations.length;
  const accepted = quotations.filter(q => q.status === "accepted").length;
  const rejected = quotations.filter(q => q.status === "rejected").length;
  const pending  = quotations.filter(q => q.status === "pending").length;
  const winRate  = total > 0 ? Math.round((accepted / total) * 100) : 0;

  const byMonth = {};
  quotations.forEach(q => {
    const d   = q.createdAt?.toDate?.() || new Date(q.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!byMonth[key]) byMonth[key] = { bids: 0, accepted: 0 };
    byMonth[key].bids++;
    if (q.status === "accepted") byMonth[key].accepted++;
  });

  return { total, accepted, rejected, pending, winRate, byMonth };
}

/* ─── Subscription Payment ───────────────────────────────────── */

export async function submitPaymentRequest({
  planName,
  planPrice,
  paymentMethod,
  referenceNumber,
  screenshotBase64,
}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");

  const shop = await getShopProfile();

  // Block duplicate pending requests
  const existing = await getDocs(query(
    collection(db, "subscriptionPayments"),
    where("shopId", "==", user.uid),
    where("status",  "==", "pending")
  ));
  if (!existing.empty) {
    throw new Error(
      "You already have a pending payment request. Please wait for admin confirmation."
    );
  }

  await addDoc(collection(db, "subscriptionPayments"), {
    shopId:           user.uid,
    shopName:         shop.shopName,
    ownerName:        shop.ownerName,
    email:            shop.email,
    planName,
    planPrice,
    paymentMethod,
    referenceNumber,
    screenshotBase64: screenshotBase64 || "",
    status:           "pending",
    submittedAt:      serverTimestamp(),
  });
}

export async function getMyPaymentRequest() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const q = query(
    collection(db, "subscriptionPayments"),
    where("shopId", "==", user.uid),
    orderBy("submittedAt", "desc")
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}
