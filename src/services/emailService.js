// src/services/emailService.js

import emailjs from "@emailjs/browser";
import { db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";

const SERVICE_ID     = "service_ekwltb2";
const PUBLIC_KEY     = "8CRqLBqTGPfDxdwl-";
const NOTIF_TEMPLATE = "o2fr3vo";
const OTP_TEMPLATE   = "template_i4tvz8h";

emailjs.init(PUBLIC_KEY);

// ── Deduplication guard ────────────────────────────────────────────────────
const recentlySent = new Map();
const DEDUP_WINDOW_MS = 10_000;

function isDuplicate(key) {
  const last = recentlySent.get(key);
  if (last && Date.now() - last < DEDUP_WINDOW_MS) return true;
  recentlySent.set(key, Date.now());
  return false;
}

// ── Fetch notification settings from Firestore ─────────────────────────────
let _cachedSettings = null;
let _cacheTime = 0;
const CACHE_TTL = 60_000;

async function getNotifSettings() {
  if (_cachedSettings && Date.now() - _cacheTime < CACHE_TTL) {
    return _cachedSettings;
  }
  try {
    const snap = await getDoc(doc(db, "systemConfig", "notificationSettings"));
    _cachedSettings = snap.exists() ? snap.data() : {};
    _cacheTime = Date.now();
  } catch {
    _cachedSettings = {};
  }
  return _cachedSettings;
}

// ── Base sender ────────────────────────────────────────────────────────────
async function sendEmail(templateId, params) {
  return emailjs.send(SERVICE_ID, templateId, params, PUBLIC_KEY);
}

// ── Gated notification sender ──────────────────────────────────────────────
async function sendGatedNotification(settingKey, { toEmail, toName, shopName, statusTitle, message }) {
  const settings = await getNotifSettings();

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

// ── OTP emails ─────────────────────────────────────────────────────────────
export function sendOTPEmail({ toEmail, toName, otpCode }) {
  const key = `${OTP_TEMPLATE}|${toEmail}|otp`;
  if (isDuplicate(key)) return Promise.resolve({ suppressed: true });
  return sendEmail(OTP_TEMPLATE, { to_email: toEmail, to_name: toName, otp_code: otpCode });
}

export function sendPasswordResetOTPEmail({ toEmail, toName, otpCode }) {
  const key = `${OTP_TEMPLATE}|${toEmail}|reset`;
  if (isDuplicate(key)) return Promise.resolve({ suppressed: true });
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

// ── Quotation Accepted — notify PROJECT OWNER (mobile user) ───────────────
// Called when the mobile user accepts a shop's quotation
export function sendQuotationAcceptedToUser({ toEmail, toName, projectTitle, shopName, amount }) {
  return sendGatedNotification("quotationAcceptedUser", {
    toEmail,
    toName,
    shopName,
    statusTitle: "Your Project Quote Was Accepted!",
    message: `Great news! The hardware shop "${shopName}" has submitted a quotation of ₱${Number(amount).toLocaleString()} for your project "${projectTitle}".\n\nLog in to the iConstruct app to review the full quote and contact the shop directly.`,
  });
}

// ── Quotation Accepted — notify SHOP OWNER (hardware admin) ───────────────
// Called when the mobile user accepts a shop's quotation
export function sendQuotationAcceptedToShop({ toEmail, toName, shopName, projectTitle, amount }) {
  return sendGatedNotification("quotationAcceptedShop", {
    toEmail,
    toName,
    shopName,
    statusTitle: "Your Quotation Was Accepted!",
    message: `Congratulations! The project owner has accepted your quotation of ₱${Number(amount).toLocaleString()} for the project "${projectTitle}".\n\nLog in to your iConstruct Shop Dashboard to view the details and coordinate with the client.`,
  });
}