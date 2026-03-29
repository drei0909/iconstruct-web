// src/services/adminService.js
// iConstruct — Super Admin Service
//
// ROOT CAUSE FIX for "plan resets to basic on reload":
//   The old approveShop() always wrote subscriptionPlan: "basic" unconditionally.
//   If a shop already had "pro" or "business" and was re-reviewed, their plan got wiped.
//   FIX: only set subscriptionPlan:"basic" if the shop has NO plan yet.

import { db, auth } from "./firebase";
import {
  collection, getDocs, getDoc, doc,
  updateDoc, query, orderBy, where,
  serverTimestamp,
} from "firebase/firestore";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import emailjs from "@emailjs/browser";

const EMAILJS_SERVICE_ID         = "service_ekwltb2";
const EMAILJS_PUBLIC_KEY         = "8CRqLBqTGPfDxdwl-";
const TEMPLATE_APPROVED          = "template_shop_approved";
const TEMPLATE_REJECTED          = "template_shop_rejected";
const TEMPLATE_PAYMENT_CONFIRMED = "template_payment_confirmed";
const TEMPLATE_PAYMENT_REJECTED  = "template_payment_rejected";

emailjs.init(EMAILJS_PUBLIC_KEY);

/* ─── Email helpers ──────────────────────────────────────────── */

async function sendApprovalEmail(shop) {
  try {
    await emailjs.send(EMAILJS_SERVICE_ID, TEMPLATE_APPROVED, {
      to_email:  shop.email,
      to_name:   shop.ownerName,
      shop_name: shop.shopName,
    }, EMAILJS_PUBLIC_KEY);
  } catch (err) { console.error("Approval email failed:", err); }
}

async function sendRejectionEmail(shop, reason) {
  try {
    await emailjs.send(EMAILJS_SERVICE_ID, TEMPLATE_REJECTED, {
      to_email:         shop.email,
      to_name:          shop.ownerName,
      shop_name:        shop.shopName,
      rejection_reason: reason || "Application did not meet requirements.",
    }, EMAILJS_PUBLIC_KEY);
  } catch (err) { console.error("Rejection email failed:", err); }
}

async function sendPaymentConfirmedEmail(shop, planName, planPrice) {
  try {
    await emailjs.send(EMAILJS_SERVICE_ID, TEMPLATE_PAYMENT_CONFIRMED, {
      to_email:   shop.email,
      to_name:    shop.ownerName,
      shop_name:  shop.shopName,
      plan_name:  planName,
      plan_price: planPrice,
    }, EMAILJS_PUBLIC_KEY);
  } catch (err) { console.error("Payment confirm email failed:", err); }
}

async function sendPaymentRejectedEmail(shop, reason) {
  try {
    await emailjs.send(EMAILJS_SERVICE_ID, TEMPLATE_PAYMENT_REJECTED, {
      to_email:         shop.email,
      to_name:          shop.ownerName,
      shop_name:        shop.shopName,
      rejection_reason: reason || "Payment could not be verified.",
    }, EMAILJS_PUBLIC_KEY);
  } catch (err) { console.error("Payment reject email failed:", err); }
}

/* ─── Auth ───────────────────────────────────────────────────── */

export async function loginAdmin(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const adminDoc = await getDoc(doc(db, "admins", cred.user.uid));
  if (!adminDoc.exists()) {
    await signOut(auth);
    throw new Error("Unauthorized. This portal is for administrators only.");
  }
  return cred.user;
}

export async function logoutAdmin() {
  await signOut(auth);
}

/* ─── Shop Applications ──────────────────────────────────────── */

export async function getAllShops() {
  const q    = query(collection(db, "shops"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getShop(uid) {
  const snap = await getDoc(doc(db, "shops", uid));
  if (!snap.exists()) throw new Error("Shop not found.");
  return { id: snap.id, ...snap.data() };
}

/**
 * Approve a shop application.
 *
 * IMPORTANT: Only sets subscriptionPlan:"basic" if the shop does NOT already
 * have a plan. This prevents overwriting "pro" or "business" if the admin
 * re-reviews an already-active shop.
 */
export async function approveShop(uid) {
  const shop = await getShop(uid);

  // Build the update — only assign default plan if shop has none yet
  const update = {
    status:     "approved",
    reviewedAt: serverTimestamp(),
    rejectionReason: "",
  };

  if (!shop.subscriptionPlan || shop.subscriptionPlan === "") {
    // First-time approval → give basic
    update.subscriptionPlan   = "basic";
    update.subscriptionStatus = "none";
  }
  // If shop.subscriptionPlan is already "pro" or "business", leave it untouched

  await updateDoc(doc(db, "shops", uid), update);
  await sendApprovalEmail(shop);
}

export async function rejectShop(uid, reason) {
  const shop = await getShop(uid);
  await updateDoc(doc(db, "shops", uid), {
    status:          "rejected",
    reviewedAt:      serverTimestamp(),
    rejectionReason: reason || "Application did not meet requirements.",
  });
  await sendRejectionEmail(shop, reason);
}

export async function getShopStats() {
  const snap = await getDocs(collection(db, "shops"));
  const all  = snap.docs.map(d => d.data());
  return {
    total:    all.length,
    pending:  all.filter(s => s.status === "pending").length,
    approved: all.filter(s => s.status === "approved").length,
    rejected: all.filter(s => s.status === "rejected").length,
  };
}

/* ─── Subscription Payments ──────────────────────────────────── */

export async function getAllPayments() {
  const q    = query(collection(db, "subscriptionPayments"), orderBy("submittedAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getPaymentsByStatus(status) {
  const q    = query(
    collection(db, "subscriptionPayments"),
    where("status", "==", status),
    orderBy("submittedAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getPaymentStats() {
  const snap = await getDocs(collection(db, "subscriptionPayments"));
  const all  = snap.docs.map(d => d.data());
  return {
    total:     all.length,
    pending:   all.filter(p => p.status === "pending").length,
    confirmed: all.filter(p => p.status === "confirmed").length,
    rejected:  all.filter(p => p.status === "rejected").length,
  };
}

export async function confirmPayment(paymentId) {
  const paySnap = await getDoc(doc(db, "subscriptionPayments", paymentId));
  if (!paySnap.exists()) throw new Error("Payment record not found.");
  const payment = { id: paySnap.id, ...paySnap.data() };

  const days       = payment.planName === "business" ? 365 : 30;
  const expiryDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  // Mark payment confirmed
  await updateDoc(doc(db, "subscriptionPayments", paymentId), {
    status:     "confirmed",
    reviewedAt: serverTimestamp(),
  });

  // Upgrade the shop's plan — this is the AUTHORITATIVE plan write
  await updateDoc(doc(db, "shops", payment.shopId), {
    subscriptionPlan:      payment.planName,   // "pro" | "business"
    subscriptionStatus:    "active",
    subscriptionExpiry:    expiryDate,
    subscriptionUpdatedAt: serverTimestamp(),
  });

  await sendPaymentConfirmedEmail(
    { email: payment.email, ownerName: payment.ownerName, shopName: payment.shopName },
    payment.planName.charAt(0).toUpperCase() + payment.planName.slice(1),
    payment.planPrice
  );
}

export async function rejectPayment(paymentId, reason) {
  const paySnap = await getDoc(doc(db, "subscriptionPayments", paymentId));
  if (!paySnap.exists()) throw new Error("Payment record not found.");
  const payment = { id: paySnap.id, ...paySnap.data() };

  await updateDoc(doc(db, "subscriptionPayments", paymentId), {
    status:          "rejected",
    rejectionReason: reason || "Payment could not be verified.",
    reviewedAt:      serverTimestamp(),
  });

  await sendPaymentRejectedEmail(
    { email: payment.email, ownerName: payment.ownerName, shopName: payment.shopName },
    reason
  );
}

export async function getRevenueStats() {
  const snap      = await getDocs(collection(db, "subscriptionPayments"));
  const confirmed = snap.docs.map(d => d.data()).filter(p => p.status === "confirmed");
  const proCount  = confirmed.filter(p => p.planName === "pro").length;
  const bizCount  = confirmed.filter(p => p.planName === "business").length;
  return {
    totalRevenue:   proCount * 499 + bizCount * 4499,
    proCount,
    bizCount,
    totalPaidShops: proCount + bizCount,
  };
}
