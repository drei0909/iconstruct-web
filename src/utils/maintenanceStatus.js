// src/utils/maintenanceStatus.js
// Shared helpers for scheduled maintenance + countdown notice.

export const MAINTENANCE_COUNTDOWN_MS = 60 * 60 * 1000; // legacy default preset

export const MAINTENANCE_PRESETS = [
  { id: "custom", label: "Custom date & time" },
  { id: "1h", label: "In 1 hour" },
  { id: "2h", label: "In 2 hours" },
  { id: "24h", label: "In 24 hours" },
];

export function toMillis(value) {
  if (!value) return null;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** True when maintenance is fully live (toggle OR scheduled time passed). */
export function isMaintenanceActive(data = {}, now = Date.now()) {
  if (data?.maintenanceMode === true) return true;
  const start = toMillis(data?.scheduledStartAt);
  if (data?.noticeActive && start != null && now >= start) return true;
  return false;
}

/** True while waiting for a future scheduled maintenance start. */
export function isNoticeCountdownActive(data = {}, now = Date.now()) {
  if (!data?.noticeActive) return false;
  if (data?.maintenanceMode === true) return false;
  const start = toMillis(data?.scheduledStartAt);
  if (start == null) return false;
  return now < start;
}

export function getCountdownRemainingMs(data = {}, now = Date.now()) {
  const start = toMillis(data?.scheduledStartAt);
  if (start == null) return 0;
  return Math.max(0, start - now);
}

export function formatCountdown(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Includes days when maintenance is far out (e.g. Aug 26 at 5 PM). */
export function formatCountdownLong(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (days > 0) {
    return `${days}d ${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return formatCountdown(ms);
}

export function formatStartLocal(data = {}, ms) {
  const start = ms ?? toMillis(data?.scheduledStartAt);
  if (start == null) return "";
  return new Date(start).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function combineDateAndTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  if (!y || !m || !d || Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return new Date(y, m - 1, d, hh, mm, 0, 0).getTime();
}

export function resolvePresetScheduleMs(presetId) {
  const now = Date.now();
  switch (presetId) {
    case "1h":
      return now + MAINTENANCE_COUNTDOWN_MS;
    case "2h":
      return now + 2 * MAINTENANCE_COUNTDOWN_MS;
    case "24h":
      return now + 24 * MAINTENANCE_COUNTDOWN_MS;
    default:
      return null;
  }
}

export function defaultScheduleDateTime(offsetMs = MAINTENANCE_COUNTDOWN_MS) {
  const d = new Date(Date.now() + offsetMs);
  return {
    date: d.toISOString().slice(0, 10),
    time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
  };
}

export function msToDateTimeInputs(ms) {
  const d = new Date(ms);
  return {
    date: d.toISOString().slice(0, 10),
    time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
  };
}

export function validateFutureSchedule(scheduledAtMs, minLeadMs = 60_000) {
  if (!Number.isFinite(scheduledAtMs)) {
    return "Pick a valid date and time.";
  }
  if (scheduledAtMs <= Date.now() + minLeadMs) {
    return "Maintenance must be scheduled at least 1 minute in the future.";
  }
  return null;
}
