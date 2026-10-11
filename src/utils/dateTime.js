// src/utils/dateTime.js
// One formatter for every timestamp the app shows, so dates read the same
// everywhere: "Oct 8, 2026 · 9:25 PM".

export function toDate(v) {
  try {
    if (!v) return null;
    if (typeof v.toDate === "function") return v.toDate();
    if (typeof v.seconds === "number") return new Date(v.seconds * 1000);
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export function toMillis(v) {
  return toDate(v)?.getTime() || 0;
}

export function formatDate(v, fallback = "—") {
  const d = toDate(v);
  if (!d) return fallback;
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

export function formatTime(v, fallback = "") {
  const d = toDate(v);
  if (!d) return fallback;
  return d.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", hour12: true });
}

export function formatDateTime(v, fallback = "—") {
  const d = toDate(v);
  if (!d) return fallback;
  return `${formatDate(d)} · ${formatTime(d)}`;
}

/** Remaining time until `v`: "6 days, 4 hours", "3 hours", "45 minutes",
 *  "less than a minute", or "" once it has passed. Never rounds up, so it
 *  can't promise time that isn't there. */
export function formatTimeLeft(v) {
  const d = toDate(v);
  if (!d) return "";
  const ms = d.getTime() - Date.now();
  if (ms <= 0) return "";
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "less than a minute";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.floor(hours / 24);
  const remH = hours % 24;
  return `${days} day${days === 1 ? "" : "s"}${remH ? `, ${remH} hour${remH === 1 ? "" : "s"}` : ""}`;
}

/** "Just now", "5m ago", "3h ago", "2d ago", then the full date-time. */
export function formatRelative(v, fallback = "") {
  const d = toDate(v);
  if (!d) return fallback;
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "Just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDateTime(d, fallback);
}
