// src/services/activityLog.js
// Reports sign-ins, sign-outs, dashboard visits and failed sign-ins to the
// logAuthEvent Cloud Function, which writes them to systemLogs (admin →
// System Settings → System Logs). Who did it is taken from the verified ID
// token server-side, never from what this file sends.
//
// Fire-and-forget: logging must never slow down or break signing in.

import { auth } from "./firebase";

const LOG_URL = "https://us-central1-iconstruct-58a87.cloudfunctions.net/logAuthEvent";
const VISIT_KEY = "ic_visit_logged";

export async function logAuthEvent(event, { email = "", reason = "" } = {}) {
  try {
    const headers = { "Content-Type": "application/json" };
    const user = auth.currentUser;
    if (user && !event.endsWith("_failed")) {
      headers.Authorization = `Bearer ${await user.getIdToken()}`;
    }
    await fetch(LOG_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ event, email, reason }),
      keepalive: true,
    });
  } catch {
    /* never surface logging problems to the user */
  }
}

/** Log "opened the dashboard" once per browser tab session per account —
 *  catches returning users whose login was remembered. */
export function logVisitOnce(uid) {
  try {
    const key = `${VISIT_KEY}:${uid}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {
    /* sessionStorage unavailable — still log, at most once per page load */
  }
  logAuthEvent("shop_visit");
}

/** Mark this tab's session as already logged (a fresh sign-in was logged),
 *  so the dashboard doesn't add a second "visit" entry right after it. */
export function markVisitLogged(uid) {
  try {
    sessionStorage.setItem(`${VISIT_KEY}:${uid}`, "1");
  } catch {
    /* ignore */
  }
}

/** Map a sign-in error to the server's fixed reason vocabulary. */
export function failReason(err) {
  const code = String(err?.code || err?.message || "");
  if (/invalid-credential|wrong-password|user-not-found|invalid-email/.test(code)) return "wrong_credentials";
  if (/too-many-requests/.test(code)) return "too_many_attempts";
  if (/network-request-failed|unavailable/.test(code)) return "network";
  if (/^(pending|rejected|suspended|deleted)$/.test(code)) return code;
  if (code === "no-shop") return "no_shop";
  if (/Not authorized as admin/i.test(code)) return "not_admin";
  return "";
}
