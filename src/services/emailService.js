// src/services/emailService.js
//
// FIXES APPLIED:
// 1. Reads notificationSettings from Firestore BEFORE sending any email.
//    If the admin toggled off a notification type, it will NOT send.
// 2. Deduplication guard retained — prevents double-sends within 10s.
// 3. sendPaymentConfirmedEmail correctly handles planName.
// 4. All exports are clean and consistent.

import emailjs from "@emailjs/browser";
import { db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";

const SERVICE_ID     = "service_ekwltb2";
const PUBLIC_KEY     = "8CRqLBqTGPfDxdwl-";
const NOTIF_TEMPLATE = "o2fr3vo";
const OTP_TEMPLATE   = "template_i4tvz8h";

emailjs.init(PUBLIC_KEY);

// ── Deduplication guard ────────────────────────────────────────────────────
// Prevents the same email being sent twice within a 10-second window.
const recentlySent = new Map();
const DEDUP_WINDOW_MS = 10_000;

function isDuplicate(key) {
  const last = recentlySent.get(key);
  if (last && Date.now() - last < DEDUP_WINDOW_MS) return true;
  recentlySent.set(key, Date.now());
  return false;
}

// ── Fetch notification settings from Firestore ─────────────────────────────
// Returns the settings object. Falls back to all-enabled defaults if not set.
let _cachedSettings = null;
let _cacheTime = 0;
const CACHE_TTL = 60_000; // re-fetch at most every 60 seconds

async function getNotifSettings() {
  if (_cachedSettings && Date.now() - _cacheTime < CACHE_TTL) {
    return _cachedSettings;
  }
  try {
    const snap = await getDoc(doc(db, "systemConfig", "notificationSettings"));
    _cachedSettings = snap.exists() ? snap.data() : {};
    _cacheTime = Date.now();
  } catch {
    _cachedSettings = {}; // on error, treat all as enabled
  }
  return _cachedSettings;
}

// ── Base sender ────────────────────────────────────────────────────────────
async function sendEmail(templateId, params) {
  return emailjs.send(SERVICE_ID, templateId, params, PUBLIC_KEY);
}

// ── Gated notification sender ──────────────────────────────────────────────
// settingKey: the key in notificationSettings (e.g. "applicationApproved")
// If that key is explicitly false, the email is suppressed.
async function sendGatedNotification(settingKey, { toEmail, toName, shopName, statusTitle, message }) {
  const settings = await getNotifSettings();

  // If the toggle exists and is explicitly false, suppress
  if (settingKey && settings[settingKey] === false) {
    console.info(`[emailService] "${settingKey}" notifications are disabled. Email suppressed.`);
    return { suppressed: true, reason: "admin_disabled" };
  }

  const key = `${NOTIF_TEMPLATE}|${toEmail}|${statusTitle}`;
  if (isDuplicate(key)) {
    console.warn(`[emailService] Duplicate suppressed: ${key}`);
    return { suppressed: true, reason: "duplicate" };
  }

  return sendEmail(NOTIF_TEMPLATE, {
    to_email:     toEmail,
    to_name:      toName,
    shop_name:    shopName,
    status_title: statusTitle,
    message,
  });
}

// ── OTP emails (never gated — always send) ─────────────────────────────────
export function sendOTPEmail({ toEmail, toName, otpCode }) {
  const key = `${OTP_TEMPLATE}|${toEmail}|otp`;
  if (isDuplicate(key)) {
    console.warn(`[emailService] Duplicate OTP suppressed for ${toEmail}`);
    return Promise.resolve({ suppressed: true });
  }
  return sendEmail(OTP_TEMPLATE, { to_email: toEmail, to_name: toName, otp_code: otpCode });
}

export function sendPasswordResetOTPEmail({ toEmail, toName, otpCode }) {
  const key = `${OTP_TEMPLATE}|${toEmail}|reset`;
  if (isDuplicate(key)) {
    console.warn(`[emailService] Duplicate reset OTP suppressed for ${toEmail}`);
    return Promise.resolve({ suppressed: true });
  }
  return sendEmail(OTP_TEMPLATE, { to_email: toEmail, to_name: toName, otp_code: otpCode });
}

// ── Shop application status emails ─────────────────────────────────────────
export function sendApprovalEmail({ toEmail, toName, shopName }) {
  return sendGatedNotification("applicationApproved", {
    toEmail, toName, shopName,
    statusTitle: "Application Approved",
    message: `Congratulations! Your hardware shop "${shopName}" has been approved on iConstruct. You can now log in to your dashboard and start submitting quotations.`,
  });
}

export function sendRejectionEmail({ toEmail, toName, shopName, reason }) {
  return sendGatedNotification("applicationRejected", {
    toEmail, toName, shopName,
    statusTitle: "Application Rejected",
    message: `We're sorry, your hardware shop "${shopName}" application was not approved.\n\nReason: ${reason || "Please contact support for more information."}`,
  });
}

// ── Payment status emails ──────────────────────────────────────────────────
export function sendPaymentConfirmedEmail({ toEmail, toName, shopName, planName }) {
  const planLabels = {
    pro:      "Pro (₱499/month)",
    business: "Business (₱4,499/year)",
    basic:    "Basic (Free)",
  };
  const label = planLabels[planName?.toLowerCase()] ?? "Selected Plan";

  return sendGatedNotification("paymentConfirmed", {
    toEmail, toName, shopName,
    statusTitle: "Payment Confirmed",
    message: `Your payment for the ${label} plan has been confirmed. Your subscription is now active. Thank you for choosing iConstruct!\n\nPlease sign out and log back in to activate your upgraded features.`,
  });
}

export function sendPaymentRejectedEmail({ toEmail, toName, shopName, reason }) {
  return sendGatedNotification("paymentRejected", {
    toEmail, toName, shopName,
    statusTitle: "Payment Rejected",
    message: `Your subscription payment for "${shopName}" was not confirmed.\n\nReason: ${reason || "Please contact support for more information."}\n\nYou may resubmit a new payment request from your dashboard.`,
  });
}