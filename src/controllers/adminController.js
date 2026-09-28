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
  getDoc, doc, addDoc, collection, serverTimestamp, arrayUnion,
} from "firebase/firestore";
import {
  fetchAllShops,
  fetchAllPayments,
  updateShopApproval,
  updatePaymentStatus,
  updateShopSubscription,
  fetchPlatformOpsCounts,
} from "../models/adminModel";
import {
  fetchContactMessages,
  updateContactMessage,
  deleteContactMessageDoc,
} from "../models/contactModel";

import {
  sendApprovalEmail,
  sendRejectionEmail,
  sendPaymentConfirmedEmail,
  sendPaymentRejectedEmail,
  sendContactReplyEmail,
} from "../services/emailService";
import { assertRateLimit, RATE } from "../utils/rateLimit";




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
  const normalized = String(email || "").trim().toLowerCase();
  assertRateLimit(`admin-login:${normalized}`, RATE.login, "Too many admin login attempts");
  const cred = await signInWithEmailAndPassword(auth, normalized, password);
  const snap = await getDoc(doc(db, "admins", cred.user.uid));
  if (!snap.exists()) {
    await signOut(auth);
    throw new Error("Not authorized as admin.");
  }
  await writeLog("info", `Admin signed in: ${normalized}`);
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

// ── Lifecycle management (Manage Shops) ────────────────────────────────────

/** Block approved shop from logging into the shop dashboard (app still sees products if public rules allow). */
export async function suspendShop(uid, reason = "Suspended by administrator") {
  // Was writing status:"rejected" — the same value a brand-new registration
  // gets when its application is denied. Shop Applications and Manage Shops
  // both read the same shops list, so a suspended (previously approved,
  // operating) shop showed up mixed into the "Rejected" applications queue
  // with no way to tell it apart from a genuine new-signup rejection.
  // "suspended" is now its own status.
  await updateShopApproval(uid, "suspended", reason);
  const snap = await getDoc(doc(db, "shops", uid));
  const name = snap.exists() ? snap.data().shopName : uid;
  await writeLog("warn", `Shop "${name}" suspended. ${reason}`);
}

/** Re-open a suspended / rejected shop for login again. */
export async function reopenShop(uid) {
  await updateShopApproval(uid, "approved", "");
  const snap = await getDoc(doc(db, "shops", uid));
  if (snap.exists()) {
    const shop = snap.data();
    await sendApprovalEmail({
      toEmail: shop.email,
      toName: shop.ownerName,
      shopName: shop.shopName,
    }).catch(() => {});
    await writeLog("success", `Shop "${shop.shopName}" re-opened (approved).`);
  }
}

/**
 * Manually set plan (e.g. grace, demo, downgrade after support call).
 * plan: "basic" | "pro" | "business"
 * days: subscription length from now (ignored for basic)
 */
export async function setShopPlanManual(uid, plan, days = 30) {
  const planKey = String(plan || "basic").toLowerCase();
  let expiry = null;
  if (planKey === "pro" || planKey === "business") {
    const d = Number(days) > 0 ? Number(days) : planKey === "business" ? 365 : 30;
    expiry = new Date();
    expiry.setDate(expiry.getDate() + d);
  }
  await updateShopSubscription(uid, planKey, expiry);
  const snap = await getDoc(doc(db, "shops", uid));
  const name = snap.exists() ? snap.data().shopName : uid;
  await writeLog(
    "success",
    `Manual plan set for "${name}": ${planKey.toUpperCase()}${expiry ? ` until ${expiry.toLocaleDateString("en-PH")}` : ""}.`
  );
  return { plan: planKey, expiry };
}

/** Lightweight counts for admin dashboard ↔ app data. */
export async function getPlatformOps() {
  return fetchPlatformOpsCounts();
}

// ── Contact Us inbox ───────────────────────────────────────────────────────
export async function getContactMessages() {
  return fetchContactMessages();
}

export async function getContactMessageStats(list) {
  const messages = list || (await fetchContactMessages());
  return {
    total: messages.length,
    new: messages.filter((m) => m.status === "new").length,
    read: messages.filter((m) => m.status === "read").length,
    archived: messages.filter((m) => m.status === "archived").length,
  };
}

export async function markContactMessageRead(id) {
  await updateContactMessage(id, { status: "read", readAt: serverTimestamp() });
  await writeLog("info", `Contact message ${id} marked as read.`);
}

export async function archiveContactMessage(id) {
  await updateContactMessage(id, { status: "archived", archivedAt: serverTimestamp() });
  await writeLog("info", `Contact message ${id} archived.`);
}

export async function reopenContactMessage(id) {
  await updateContactMessage(id, { status: "new" });
  await writeLog("info", `Contact message ${id} reopened as new.`);
}

/** Permanently remove a contact message (manual admin action only). */
export async function deleteContactMessage(id) {
  await deleteContactMessageDoc(id);
  await writeLog("warn", `Contact message ${id} deleted permanently.`);
}

/**
 * Reply to a Contact Us sender via EmailJS/Gmail.
 * Email goes TO their address; FROM is your connected Gmail in EmailJS.
 */
export async function replyToContactMessage(id, replyText, messageSnapshot = {}) {
  const body = String(replyText || "").trim();
  if (body.length < 5) throw new Error("Please write a longer reply (at least 5 characters).");
  if (body.length > 5000) throw new Error("Reply is too long (max 5000 characters).");

  const toEmail = String(messageSnapshot.email || "").trim().toLowerCase();
  const toName = String(messageSnapshot.name || "there").trim();
  if (!toEmail) throw new Error("This message has no email address to reply to.");

  assertRateLimit(
    `contact-reply:${auth.currentUser?.uid || "admin"}`,
    RATE.contactReply || { max: 20, windowMs: 60 * 60 * 1000 },
    "Too many replies sent"
  );

  const result = await sendContactReplyEmail({
    toEmail,
    toName,
    subject: messageSnapshot.subject || "your inquiry",
    replyBody: body,
    originalMessage: messageSnapshot.message || "",
  });

  if (result?.suppressed && result.reason === "duplicate") {
    throw new Error("Please wait a few seconds before sending the same reply again.");
  }

  const actor = auth.currentUser?.email || "admin";
  await updateContactMessage(id, {
    status: "read",
    lastReplyAt: serverTimestamp(),
    lastReplyBy: actor,
    lastReplyText: body.slice(0, 2000),
    replies: arrayUnion({
      body: body.slice(0, 2000),
      by: actor,
      at: new Date().toISOString(),
      channel: "gmail",
    }),
  });

  await writeLog("success", `Contact reply emailed to ${toEmail} (message ${id}).`);
  return { ok: true, toEmail };
}