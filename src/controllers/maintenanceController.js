// src/controllers/maintenanceController.js

import { sendMaintenanceNoticeEmail } from "../services/emailService";
import {
  fetchMaintenanceConfig,
  saveMaintenanceConfig,
  scheduleMaintenanceNotice,
  cancelMaintenanceNotice,
  enableMaintenanceNow,
  disableMaintenance,
  activateScheduledMaintenance,
  fetchShopsForMaintenanceNotice,
  markNoticeEmailsSent,
} from "../models/maintenanceModel";
import {
  isMaintenanceActive,
  isNoticeCountdownActive,
  formatStartLocal,
  validateFutureSchedule,
} from "../utils/maintenanceStatus";
import { writeLog } from "./settingsController";

export async function getMaintenanceConfig() {
  return fetchMaintenanceConfig();
}

export async function updateMaintenanceExtras(patch) {
  await saveMaintenanceConfig(patch);
}

/**
 * Schedule at custom date/time, email all shops.
 * Push: initial + reminder at start time via Cloud Functions.
 */
export async function scheduleMaintenanceWithNotice(message, scheduledAtMs) {
  const note = String(message || "").trim();
  if (!note) throw new Error("Please add a maintenance note for users.");

  const validationError = validateFutureSchedule(scheduledAtMs);
  if (validationError) throw new Error(validationError);

  const startLabel = formatStartLocal({}, scheduledAtMs);
  const { scheduleId } = await scheduleMaintenanceNotice({
    message: note,
    scheduledAtMs,
  });

  const shops = await fetchShopsForMaintenanceNotice();
  let sent = 0;
  let failed = 0;

  for (const shop of shops) {
    try {
      await sendMaintenanceNoticeEmail({
        toEmail: shop.email,
        toName: shop.ownerName || shop.shopName || "Shop Owner",
        shopName: shop.shopName || "Your shop",
        message: note,
        startLabel,
      });
      sent += 1;
      await new Promise((r) => setTimeout(r, 350));
    } catch (err) {
      failed += 1;
      console.warn("[maintenance] email failed:", shop.email, err?.message || err);
    }
  }

  await markNoticeEmailsSent(sent);
  await writeLog(
    "warn",
    `Maintenance scheduled for ${startLabel}. Emails: ${sent}/${shops.length}` +
      (failed ? ` (${failed} failed)` : "") +
      `. Push scheduled (scheduleId ${scheduleId}).`
  );

  return { sent, failed, total: shops.length, scheduledAtMs, scheduleId };
}

export async function cancelScheduledMaintenance() {
  await cancelMaintenanceNotice();
  await writeLog("info", "Scheduled maintenance cancelled.");
}

export async function turnOnMaintenanceImmediate() {
  await enableMaintenanceNow();
  await writeLog("warn", "Maintenance mode ENABLED immediately (no schedule).");
}

export async function turnOffMaintenance() {
  await disableMaintenance();
  await writeLog("success", "Maintenance mode DISABLED — platform restored.");
}

/** Client fallback when Cloud Scheduler has not fired yet. */
export async function promoteMaintenanceIfDue() {
  const data = await fetchMaintenanceConfig();
  if (data.maintenanceMode === true) return false;
  if (!isNoticeCountdownActive(data) && isMaintenanceActive(data)) {
    await activateScheduledMaintenance();
    await writeLog("warn", `Maintenance auto-activated at ${formatStartLocal(data)}.`);
    return true;
  }
  return false;
}
