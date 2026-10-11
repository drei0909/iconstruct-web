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
      "Per-item quoting on open projects",
      "3 quotations per month",
      "See 5 open project postings",
      "Smart project matching — right jobs float to the top",
      "Public storefront profile (hours, coverage, contact)",
      "DPWH material cost estimate on every project",
      "Top Products ranking — your 3 best sellers",
    ],
  },
  pro: {
    key: "pro",
    label: "Pro · Active",
    price: 999,
    billingCycle: "month",
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
      "Unlimited quotations",
      "Full project board — every open project",
      "Revenue, pipeline and win-rate analytics",
      "DPWH price reference on every quote line",
      "Reusable quote-note templates",
      "Follow-up queue for pending bids",
      "Storefront \"About / specialties\" section",
      "Top Products with volume share and unit pricing",
    ],
  },
  business: {
    key: "business",
    label: "Business",
    price: 4999,
    billingCycle: "month",
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
      "Business intelligence dashboard",
      "Monthly revenue and lost-value tracking",
      "\"Quote vs DPWH baseline\" check on every quotation",
      "Bid Toolkit — reusable quote-template library",
      "Featured storefront placement",
      "Top Products with concentration and recency insights",
      "Priority support",
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

// ── Shared cache of the admin's plan doc ─────────────────────────────────────
// Every price screen used to fetch systemConfig/subscriptionPlans on its own
// and show the static defaults above (e.g. ₱999 / ₱4,999) until it answered,
// so the wrong price flashed for 1–2 s on every open. One shared, short-lived
// cache means the first screen loads it once and every later one is instant.
const PLANS_TTL_MS = 60 * 1000;
let plansCache = { data: undefined, at: 0, promise: null };

async function loadPlansDoc() {
  if (plansCache.data !== undefined && Date.now() - plansCache.at < PLANS_TTL_MS) {
    return plansCache.data;
  }
  if (plansCache.promise) return plansCache.promise;
  plansCache.promise = (async () => {
    try {
      const { db } = await import("../services/firebase");
      const { doc, getDoc } = await import("firebase/firestore");
      const snap = await getDoc(doc(db, "systemConfig", "subscriptionPlans"));
      const plans = snap.exists() ? snap.data()?.plans || {} : {};
      plansCache = { data: plans, at: Date.now(), promise: null };
      return plans;
    } catch (err) {
      plansCache.promise = null;
      throw err;
    }
  })();
  return plansCache.promise;
}

function mergePlan(key, firestorePlans) {
  const base = { ...(PLAN_CONFIG[key] ?? PLAN_CONFIG.basic), key };
  const firestorePlan = firestorePlans?.[key];
  if (firestorePlan) {
    base.quotaLimit = firestoreLimit(firestorePlan.quotaLimit, base.quotaLimit);
    base.projectLimit = firestoreLimit(firestorePlan.projectLimit, base.projectLimit);
    if (firestorePlan.label) base.label = String(firestorePlan.label);
    base.price = firestorePrice(firestorePlan.price, base.price);
    base.billingCycle = normalizeBillingCycle(firestorePlan.billingCycle || base.billingCycle);
    base.features = firestoreFeatures(firestorePlan.features, base.features);
    base.isPublic = firestorePlan.isPublic !== false;
  }
  return base;
}

/** Synchronous read of the live config IF it's already cached; else null.
 *  Lets a screen render the real price on its very first paint. */
export function peekLivePlanConfig(planKey) {
  if (plansCache.data === undefined) return null;
  return mergePlan((planKey || "basic").toLowerCase(), plansCache.data);
}

/** Call after the admin saves plan changes so open screens refetch. */
export function invalidatePlanCache() {
  plansCache = { data: undefined, at: 0, promise: null };
}

/**
 * Merges Firestore admin plan edits into static theme config.
 * Applies: price, features, label, billingCycle, isPublic, quota/project limits.
 */
export async function getLivePlanConfig(planKey) {
  const key = (planKey || "basic").toLowerCase();
  try {
    return mergePlan(key, await loadPlansDoc());
  } catch (err) {
    console.warn("getLivePlanConfig: Firestore fetch failed, using static defaults.", err);
    return mergePlan(key, {});
  }
}

function toPaidPlanCards(live) {
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

/** Paid plans for upgrade/checkout UIs using admin-edited Firestore values. */
export async function getLivePaidPlans() {
  const live = await Promise.all(["pro", "business"].map((k) => getLivePlanConfig(k)));
  return toPaidPlanCards(live);
}

/** Same as getLivePaidPlans but synchronous, from cache only; null if not
 *  loaded yet — so a payment form can open with real prices or a loader,
 *  never the static defaults. */
export function peekLivePaidPlans() {
  if (plansCache.data === undefined) return null;
  return toPaidPlanCards(["pro", "business"].map((k) => mergePlan(k, plansCache.data)));
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

