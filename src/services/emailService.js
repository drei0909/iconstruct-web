// src/services/emailService.js
//
// FIXES:
// 1. Deduplication guard — tracks recently-sent emails by key to prevent
//    double-sends that happen when two code paths call the same function.
// 2. sendPaymentConfirmedEmail now accepts planName correctly (pro/business/basic).
// 3. All email helpers are exported once — do NOT call them from both
//    adminModel.js AND an admin UI component. Pick one place only.

import emailjs from "@emailjs/browser";

const SERVICE_ID     = "service_ekwltb2";
const PUBLIC_KEY     = "8CRqLBqTGPfDxdwl-";
const NOTIF_TEMPLATE = "o2fr3vo";
const OTP_TEMPLATE   = "template_i4tvz8h";

emailjs.init(PUBLIC_KEY);

// ── Deduplication guard ────────────────────────────────────────────────────
// Prevents the same email from being sent twice within a 10-second window.
// Key format: "<templateId>|<toEmail>|<statusTitle>"
const recentlySent = new Map();
const DEDUP_WINDOW_MS = 10_000;

function isDuplicate(key) {
  const last = recentlySent.get(key);
  if (last && Date.now() - last < DEDUP_WINDOW_MS) return true;
  recentlySent.set(key, Date.now());
  return false;
}

// ── Base sender ────────────────────────────────────────────────────────────
async function sendEmail(templateId, params) {
  return emailjs.send(SERVICE_ID, templateId, params, PUBLIC_KEY);
}

// ── Notification emails ────────────────────────────────────────────────────
function sendNotification({ toEmail, toName, shopName, statusTitle, message }) {
  const key = `${NOTIF_TEMPLATE}|${toEmail}|${statusTitle}`;
  if (isDuplicate(key)) {
    console.warn(`[emailService] Duplicate suppressed: ${key}`);
    return Promise.resolve({ suppressed: true });
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

// ── Shop status emails ─────────────────────────────────────────────────────
export function sendApprovalEmail({ toEmail, toName, shopName }) {
  return sendNotification({
    toEmail, toName, shopName,
    statusTitle: "Application Approved",
    message: `Congratulations! Your hardware shop "${shopName}" has been approved on iConstruct. You can now log in to your dashboard and start submitting quotations.`,
  });
}

export function sendRejectionEmail({ toEmail, toName, shopName, reason }) {
  return sendNotification({
    toEmail, toName, shopName,
    statusTitle: "Application Rejected",
    message: `We're sorry, your hardware shop "${shopName}" application was not approved.\n\nReason: ${reason || "Please contact support for more information."}`,
  });
}

// ── Payment status emails ──────────────────────────────────────────────────
export function sendPaymentConfirmedEmail({ toEmail, toName, shopName, planName }) {
  // Normalize planName to a readable label
  const planLabels = {
    pro:      "Pro (₱499/month)",
    business: "Business (₱4,499/year)",
    basic:    "Basic (30 Days)",
  };
  const label = planLabels[planName?.toLowerCase()] ?? "Basic (30 Days)";

  return sendNotification({
    toEmail, toName, shopName,
    statusTitle: "Payment Confirmed",
    message: `Your payment for the ${label} plan has been confirmed. Your subscription is now active. Thank you for choosing iConstruct!\n\nPlease sign out and log back in to activate your upgraded features.`,
  });
}

export function sendPaymentRejectedEmail({ toEmail, toName, shopName, reason }) {
  return sendNotification({
    toEmail, toName, shopName,
    statusTitle: "Payment Rejected",
    message: `Your subscription payment for "${shopName}" was not confirmed.\n\nReason: ${reason || "Please contact support for more information."}\n\nYou may resubmit a new payment request from your dashboard.`,
  });
}