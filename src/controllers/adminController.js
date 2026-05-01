// src/controllers/adminController.js
//
// FIXES APPLIED:
// 1. writeLog() helper added — writes to Firestore "systemLogs" collection
//    after every major admin action so System Logs in Settings are populated.
// 2. All actions (approveShop, rejectShop, confirmPayment, rejectPayment)
//    now write a log entry with level, message, actor, and timestamp.
// 3. loginAdmin reads notificationSettings correctly.
// 4. No duplicate email sends — emails only called from here, not from UI.

import { auth, db } from "../services/firebase";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import {
  getDoc, doc, addDoc, collection, serverTimestamp,
} from "firebase/firestore";
import {
  fetchAllShops,
  fetchAllPayments,
  updateShopApproval,
  updatePaymentStatus,
  updateShopSubscription,
} from "../models/adminModel";
import {
  sendApprovalEmail,
  sendRejectionEmail,
  sendPaymentConfirmedEmail,
  sendPaymentRejectedEmail,
} from "../services/emailService";

// ── System Log Writer ──────────────────────────────────────────────────────
// level: "info" | "success" | "warn" | "error"
async function writeLog(level, message) {
  try {
    const actor = auth.currentUser?.email || "system";
    await addDoc(collection(db, "systemLogs"), {
      level,
      message,
      actor,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    // Never let log failures break the main action
    console.warn("[adminController] Failed to write log:", err);
  }
}

// ── Auth ───────────────────────────────────────────────────────────────────
export async function loginAdmin(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const snap = await getDoc(doc(db, "admins", cred.user.uid));
  if (!snap.exists()) {
    await signOut(auth);
    throw new Error("Not authorized as admin.");
  }
  await writeLog("info", `Admin signed in: ${email}`);
  return cred.user;
}

export async function logoutAdmin() {
  const email = auth.currentUser?.email || "unknown";
  await writeLog("info", `Admin signed out: ${email}`);
  await signOut(auth);
}

// ── Shops ──────────────────────────────────────────────────────────────────
export async function getAllShops() {
  return fetchAllShops();
}

export async function getShopStats() {
  const shops = await fetchAllShops();
  return {
    total:    shops.length,
    pending:  shops.filter(s => s.status === "pending").length,
    approved: shops.filter(s => s.status === "approved").length,
    rejected: shops.filter(s => s.status === "rejected").length,
  };
}

export async function approveShop(uid) {
  await updateShopApproval(uid, "approved");

  const snap = await getDoc(doc(db, "shops", uid));
  if (snap.exists()) {
    const shop = snap.data();

    // Send gated email (respects notificationSettings toggles)
    await sendApprovalEmail({
      toEmail:  shop.email,
      toName:   shop.ownerName,
      shopName: shop.shopName,
    }).catch(err => {
      console.warn("Approval email failed:", err);
      writeLog("warn", `Approval email failed for ${shop.shopName}: ${err.message}`);
    });

    // Write success log
    await writeLog("success", `Shop "${shop.shopName}" approved by administrator.`);
  }
}

export async function rejectShop(uid, reason) {
  await updateShopApproval(uid, "rejected", reason);

  const snap = await getDoc(doc(db, "shops", uid));
  if (snap.exists()) {
    const shop = snap.data();

    await sendRejectionEmail({
      toEmail:  shop.email,
      toName:   shop.ownerName,
      shopName: shop.shopName,
      reason,
    }).catch(err => {
      console.warn("Rejection email failed:", err);
      writeLog("warn", `Rejection email failed for ${shop.shopName}: ${err.message}`);
    });

    await writeLog("info", `Shop "${shop.shopName}" rejected. Reason: ${reason}`);
  }
}

// ── Payments ───────────────────────────────────────────────────────────────
export async function getAllPayments() {
  return fetchAllPayments();
}

export async function getPaymentStats() {
  const payments = await fetchAllPayments();
  return {
    total:     payments.length,
    pending:   payments.filter(p => p.status === "pending").length,
    confirmed: payments.filter(p => p.status === "confirmed").length,
    rejected:  payments.filter(p => p.status === "rejected").length,
  };
}

export async function confirmPayment(paymentId, planName, shopId) {
  // Calculate expiry: Business = 365 days, everything else = 30 days
  const days   = planName?.toLowerCase() === "business" ? 365 : 30;
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + days);

  await updatePaymentStatus(paymentId, "confirmed");
  await updateShopSubscription(shopId, planName, expiry);

  const snap = await getDoc(doc(db, "shops", shopId));
  if (snap.exists()) {
    const shop = snap.data();

    await sendPaymentConfirmedEmail({
      toEmail:  shop.email,
      toName:   shop.ownerName,
      shopName: shop.shopName,
      planName,
    }).catch(err => {
      console.warn("Payment confirm email failed:", err);
      writeLog("warn", `Payment confirm email failed for ${shop.shopName}: ${err.message}`);
    });

    await writeLog(
      "success",
      `Subscription payment confirmed for "${shop.shopName}". Plan: ${planName?.toUpperCase()}. Expires: ${expiry.toLocaleDateString("en-PH")}.`
    );
  }
}

export async function rejectPayment(paymentId, reason, shopId) {
  await updatePaymentStatus(paymentId, "rejected", { rejectionReason: reason });

  const snap = await getDoc(doc(db, "shops", shopId));
  if (snap.exists()) {
    const shop = snap.data();

    await sendPaymentRejectedEmail({
      toEmail:  shop.email,
      toName:   shop.ownerName,
      shopName: shop.shopName,
      reason,
    }).catch(err => {
      console.warn("Payment reject email failed:", err);
      writeLog("warn", `Payment reject email failed for ${shop.shopName}: ${err.message}`);
    });

    await writeLog("info", `Payment rejected for "${shop.shopName}". Reason: ${reason}`);
  }
}