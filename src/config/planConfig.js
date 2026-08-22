// src/config/planConfig.js
// ─────────────────────────────────────────────────────────────
// Static PLAN_CONFIG = theme + default fallbacks.
// Admin edits live in Firestore systemConfig/subscriptionPlans
// and are applied via getLivePlanConfig / getLivePaidPlans / Features.
// ─────────────────────────────────────────────────────────────

// ── Static theme/UI config (defaults when Firestore empty) ───
export const PLAN_CONFIG = {
  basic: {
    key: "basic",
    label: "Free · Basic",
    price: 0,
    billingCycle: "month",
    productLimit: 20,
    quotaLimit: 3,
    projectLimit: 5,
    color: "#648DB6",
    badgeBg: "#F1F5F9",
    badgeColor: "#475569",
    badgeBorder: "#CBD5E1",
    accentGradient: "linear-gradient(135deg, #2C3E50, #648DB6)",
    sidebarBg: "#1A2332",
    sidebarActiveColor: "#93C5FD",
    sidebarActiveBorder: "#3B82F6",
    sidebarActiveBg: "rgba(59,130,246,0.12)",
    features: [
      "List up to 20 products",
      "Public shop profile",
      "View limited project postings (5)",
      "Submit up to 3 quotations / month",
      "Standard search visibility",
    ],
  },
  pro: {
    key: "pro",
    label: "Pro · Active",
    price: 999,
    billingCycle: "month",
    productLimit: 150,
    quotaLimit: Infinity,
    projectLimit: Infinity,
    color: "#2C3E50",
    badgeBg: "#EFF6FF",
    badgeColor: "#1D4ED8",
    badgeBorder: "#BFDBFE",
    accentGradient: "linear-gradient(135deg, #1D4ED8, #3B82F6)",
    sidebarBg: "#0F172A",
    sidebarActiveColor: "#93C5FD",
    sidebarActiveBorder: "#3B82F6",
    sidebarActiveBg: "rgba(59,130,246,0.15)",
    features: [
      "Everything in Basic",
      "Up to 150 product listings",
      "Unlimited quotes & full project board",
      "Revenue & pipeline analytics",
      "Export quotation history (CSV)",
      "Quote note templates",
      "Live pricing guide when bidding",
      "Follow-up queue for pending bids",
    ],
  },
  business: {
    key: "business",
    label: "Business",
    price: 4999,
    billingCycle: "month",
    productLimit: Infinity,
    quotaLimit: Infinity,
    projectLimit: Infinity,
    color: "#154665",
    badgeBg: "#E8F1F7",
    badgeColor: "#154665",
    badgeBorder: "#A8C5D8",
    accentGradient: "linear-gradient(135deg, #0D2E43, #2D6A8F)",
    sidebarBg: "#0D2E43",
    sidebarActiveColor: "#E8D9BC",
    sidebarActiveBorder: "#CFB184",
    sidebarActiveBg: "rgba(207,177,132,0.15)",
    features: [
      "Everything in Pro",
      "Unlimited product listings",
      "Business intelligence dashboard",
      "Monthly revenue & lost-value tracking",
      "Smart pricing insights",
      "Extended follow-up & history limits",
      "Bid toolkit (template library)",
    ],
  },
};

function firestoreLimit(val, fallback) {
  if (val === undefined || val === null) return fallback;
  if (val === -1) return Infinity;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function firestorePrice(val, fallback) {
  if (val === undefined || val === null || val === "") return fallback;
  const n = Number(val);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function firestoreFeatures(val, fallback) {
  if (Array.isArray(val) && val.length) {
    return val.map((f) => String(f).trim()).filter(Boolean);
  }
  if (typeof val === "string" && val.trim()) {
    return val.split("\n").map((s) => s.trim()).filter(Boolean);
  }
  return fallback;
}

function normalizeBillingCycle(raw) {
  const s = String(raw || "month").toLowerCase();
  if (s.startsWith("month")) return "month";
  if (s.startsWith("quarter")) return "quarter";
  if (s.startsWith("year") || s.startsWith("annual")) return "year";
  return s || "month";
}

/** Paid plans snapshot (static). Prefer getLivePaidPlans() for UI after admin edits. */
export function getPaidPlans() {
  return ["pro", "business"].map((key) => {
    const p = PLAN_CONFIG[key];
    return {
      id: key,
      name: key === "pro" ? "Pro Plan" : "Business Plan",
      price: p.price,
      priceLabel: `₱${p.price.toLocaleString("en-PH")}`,
      period: `/ ${p.billingCycle}`,
      label: `₱${p.price.toLocaleString("en-PH")}/${p.billingCycle}`,
      color: p.color,
      badge: key === "pro" ? "Most Popular" : "Best Value",
      features: p.features,
      isPublic: true,
    };
  });
}

/**
 * Static plan config (theme + defaults).
 * Prefer getLivePlanConfig for anything the admin can change.
 */
export function getPlanConfig(planKey) {
  const key = (planKey || "basic").toLowerCase();
  return PLAN_CONFIG[key] ?? PLAN_CONFIG.basic;
}

/**
 * Merges Firestore admin plan edits into static theme config.
 * Applies: price, features, label, billingCycle, isPublic, product/quota/project limits.
 */
export async function getLivePlanConfig(planKey) {
  const key = (planKey || "basic").toLowerCase();
  const base = { ...(PLAN_CONFIG[key] ?? PLAN_CONFIG.basic), key };

  try {
    const { db } = await import("../services/firebase");
    const { doc, getDoc } = await import("firebase/firestore");

    const snap = await getDoc(doc(db, "systemConfig", "subscriptionPlans"));
    if (snap.exists()) {
      const firestorePlan = snap.data()?.plans?.[key];
      if (firestorePlan) {
        base.productLimit = firestoreLimit(
          firestorePlan.productLimit,
          base.productLimit
        );
        base.quotaLimit = firestoreLimit(
          firestorePlan.quotaLimit,
          base.quotaLimit
        );
        base.projectLimit = firestoreLimit(
          firestorePlan.projectLimit,
          base.projectLimit
        );
        if (firestorePlan.label) base.label = String(firestorePlan.label);
        base.price = firestorePrice(firestorePlan.price, base.price);
        base.billingCycle = normalizeBillingCycle(
          firestorePlan.billingCycle || base.billingCycle
        );
        base.features = firestoreFeatures(firestorePlan.features, base.features);
        base.isPublic = firestorePlan.isPublic !== false;
      }
    }
  } catch (err) {
    console.warn(
      "getLivePlanConfig: Firestore fetch failed, using static defaults.",
      err
    );
  }

  return base;
}

/** Paid plans for upgrade/checkout UIs using admin-edited Firestore values. */
export async function getLivePaidPlans() {
  const keys = ["pro", "business"];
  const live = await Promise.all(keys.map((k) => getLivePlanConfig(k)));
  return live
    .filter((p) => p.isPublic !== false)
    .map((p) => {
      const key = p.key || "pro";
      const cycle = normalizeBillingCycle(p.billingCycle);
      return {
        id: key,
        name: key === "pro" ? "Pro Plan" : "Business Plan",
        price: p.price,
        priceLabel: `₱${Number(p.price).toLocaleString("en-PH")}`,
        period: `/ ${cycle}`,
        label: `₱${Number(p.price).toLocaleString("en-PH")}/${cycle}`,
        color: p.color,
        badge: key === "pro" ? "Most Popular" : "Best Value",
        features: p.features,
        isPublic: p.isPublic !== false,
      };
    });
}

/** Full map of all plans (admin + marketing). */
export async function getAllLivePlans() {
  const keys = ["basic", "pro", "business"];
  const list = await Promise.all(keys.map((k) => getLivePlanConfig(k)));
  const map = {};
  list.forEach((p) => {
    map[p.key] = p;
  });
  return map;
}

export function formatProductLimit(limit) {
  return limit === Infinity ? "Unlimited" : String(limit);
}

export function isAtProductLimit(currentCount, limit) {
  return limit !== Infinity && currentCount >= limit;
}

/** How many more products this plan still allows. */
export function getProductSlotsRemaining(currentCount, limit) {
  if (limit === Infinity) return Infinity;
  return Math.max(0, (Number(limit) || 0) - (Number(currentCount) || 0));
}

/**
 * Credit only as many rows as the plan still has room for.
 */
export function applyProductPlanQuota(rows, currentCount, limit) {
  const list = Array.isArray(rows) ? rows : [];
  if (limit === Infinity) {
    return {
      accepted: list,
      skipped: [],
      slotsRemaining: Infinity,
      limit,
      currentCount: Number(currentCount) || 0,
    };
  }
  const slotsRemaining = getProductSlotsRemaining(currentCount, limit);
  return {
    accepted: list.slice(0, slotsRemaining),
    skipped: list.slice(slotsRemaining),
    slotsRemaining,
    limit,
    currentCount: Number(currentCount) || 0,
  };
}
