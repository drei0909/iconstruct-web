// src/controllers/adminController.js

import { auth, db } from "../services/firebase";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getDoc, doc } from "firebase/firestore";
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

// ── Auth ──
export async function loginAdmin(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const snap = await getDoc(doc(db, "admins", cred.user.uid));
  if (!snap.exists()) throw new Error("Not authorized as admin.");
  return cred.user;
}

export async function logoutAdmin() {
  await signOut(auth);
}

// ── Shops ──
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
    await sendApprovalEmail({
      toEmail:  shop.email,
      toName:   shop.ownerName,
      shopName: shop.shopName,
    }).catch(err => console.warn("Approval email failed:", err));
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
    }).catch(err => console.warn("Rejection email failed:", err));
  }
}

// ── Payments ──
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
  const days   = planName === "business" ? 365 : 30;
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
    }).catch(err => console.warn("Payment confirm email failed:", err));
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
    }).catch(err => console.warn("Payment reject email failed:", err));
  }
}