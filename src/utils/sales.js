// src/utils/sales.js
// Subscription sales = CONFIRMED subscriptionPayments, from both paths:
//   • PayMongo  — written "confirmed" by activateShopSubscription (functions)
//   • Manual    — submitted "pending", confirmed by an admin
// Pending / rejected requests are never sales.

import { toDate, toMillis } from "./dateTime";

/**
 * Peso amount of a sale. New records carry a numeric `amount`. Older ones
 * only had `planPrice`: a number on PayMongo records, but a display string
 * like "₱1,999/month" on manual ones — parse that rather than show ₱0.
 */
export function saleAmount(p) {
  if (Number.isFinite(Number(p?.amount)) && p?.amount !== null && p?.amount !== "") return Number(p.amount);
  if (typeof p?.planPrice === "number") return p.planPrice;
  const m = String(p?.planPrice || "").replace(/,/g, "").match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : 0;
}

/** When the sale happened: confirmation time, else review, else submission. */
export function saleDate(p) {
  return toDate(p?.confirmedAt) || toDate(p?.reviewedAt) || toDate(p?.submittedAt) || toDate(p?.createdAt);
}

export function saleMethod(p) {
  const m = String(p?.paymentMethod || "").toLowerCase();
  // PayMongo activations write paymentMethod "paymongo" and a sessionId;
  // manual requests have neither.
  return m === "paymongo" || p?.sessionId ? "paymongo" : "manual";
}

export const METHOD_LABEL = { paymongo: "PayMongo", manual: "Manual (GCash)" };

export function planLabel(plan) {
  const k = String(plan || "").toLowerCase();
  return k === "business" ? "Business" : k === "pro" ? "Pro" : k ? k[0].toUpperCase() + k.slice(1) : "—";
}

/** Normalize confirmed payment docs into sale rows, newest first. */
export function toSales(payments = []) {
  return (payments || [])
    .filter((p) => String(p?.status || "").toLowerCase() === "confirmed")
    .map((p) => ({
      id: p.id,
      date: saleDate(p),
      shopId: p.shopId || "",
      shopName: p.shopName || "Unnamed shop",
      ownerName: p.ownerName || "",
      email: p.email || "",
      plan: String(p.planName || "").toLowerCase(),
      method: saleMethod(p),
      reference: p.referenceNumber || p.sessionId || "",
      amount: saleAmount(p),
      periodEnd: toDate(p.periodEnd),
    }))
    .sort((a, b) => toMillis(b.date) - toMillis(a.date));
}

const DAY = 24 * 60 * 60 * 1000;

/** [from, to) in ms for a range preset, or null bounds for "all". */
export function rangeBounds(range, customFrom, customTo, now = new Date()) {
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = startOfDay(now);
  switch (range) {
    case "today": return [today.getTime(), today.getTime() + DAY];
    case "7d": return [today.getTime() - 6 * DAY, today.getTime() + DAY];
    case "30d": return [today.getTime() - 29 * DAY, today.getTime() + DAY];
    case "month": return [new Date(now.getFullYear(), now.getMonth(), 1).getTime(), new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime()];
    case "lastMonth": return [new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime(), new Date(now.getFullYear(), now.getMonth(), 1).getTime()];
    case "year": return [new Date(now.getFullYear(), 0, 1).getTime(), new Date(now.getFullYear() + 1, 0, 1).getTime()];
    case "custom": {
      const f = customFrom ? new Date(`${customFrom}T00:00:00`).getTime() : null;
      const t = customTo ? new Date(`${customTo}T00:00:00`).getTime() + DAY : null;
      return [Number.isFinite(f) ? f : null, Number.isFinite(t) ? t : null];
    }
    default: return [null, null];
  }
}

export function filterSales(sales, { query = "", plan = "all", method = "all", range = "all", from = "", to = "" } = {}) {
  const q = query.trim().toLowerCase();
  const [lo, hi] = rangeBounds(range, from, to);
  return sales.filter((s) => {
    if (plan !== "all" && s.plan !== plan) return false;
    if (method !== "all" && s.method !== method) return false;
    const t = toMillis(s.date);
    if (lo != null && t < lo) return false;
    if (hi != null && t >= hi) return false;
    if (!q) return true;
    return (
      s.shopName.toLowerCase().includes(q) ||
      s.ownerName.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      String(s.reference).toLowerCase().includes(q)
    );
  });
}

export function summarizeSales(sales) {
  const total = sales.reduce((sum, s) => sum + s.amount, 0);
  const by = (key) =>
    sales.reduce((acc, s) => {
      const k = s[key] || "other";
      acc[k] = acc[k] || { count: 0, total: 0 };
      acc[k].count += 1;
      acc[k].total += s.amount;
      return acc;
    }, {});
  return {
    count: sales.length,
    total,
    average: sales.length ? total / sales.length : 0,
    byPlan: by("plan"),
    byMethod: by("method"),
    shops: new Set(sales.map((s) => s.shopId).filter(Boolean)).size,
  };
}

/** Shops on a paid plan RIGHT NOW (active and not past expiry). */
export function activeSubscriptions(shops = [], now = Date.now()) {
  return (shops || [])
    .filter((s) => {
      const plan = String(s?.subscriptionPlan || "").toLowerCase();
      if (plan !== "pro" && plan !== "business") return false;
      if (String(s?.subscriptionStatus || "").toLowerCase() !== "active") return false;
      const exp = toMillis(s.subscriptionExpiry);
      return exp > now;
    })
    .map((s) => ({
      id: s.id,
      shopName: s.shopName || "Unnamed shop",
      ownerName: s.ownerName || "",
      email: s.email || "",
      plan: String(s.subscriptionPlan).toLowerCase(),
      startedAt: toDate(s.subscriptionStartedAt) || toDate(s.lastPaymentAt),
      expiresAt: toDate(s.subscriptionExpiry),
    }))
    .sort((a, b) => toMillis(a.expiresAt) - toMillis(b.expiresAt));
}

export const peso = (n) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0);
