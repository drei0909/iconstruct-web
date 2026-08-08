// src/config/planConfig.js
// ─────────────────────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH for all plan limits, labels, and theme
// colours. Static PLAN_CONFIG holds UI/theme values only.
// Runtime limits (productLimit, quotaLimit, projectLimit) are
// fetched live from Firestore so admin edits take effect
// immediately across all dashboards and the homepage.
// ─────────────────────────────────────────────────────────────

// ── Static theme/UI config (never changes at runtime) ─────────
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

/** Paid plans for checkout / upgrade UIs (single source). */
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
    };
  });
}

/**
 * Returns the static plan config (theme/UI only).
 * For runtime limits, use getLivePlanConfig() instead.
 */
export function getPlanConfig(planKey) {
  const key = (planKey || "basic").toLowerCase();
  return PLAN_CONFIG[key] ?? PLAN_CONFIG.basic;
}

/**
 * Fetches live plan limits from Firestore and merges them
 * with the static theme config. Falls back to static values
 * if Firestore is unavailable.
 *
 * @param {string} planKey - "basic" | "pro" | "business"
 * @returns {Promise<object>} Merged plan config with live limits
 */
export async function getLivePlanConfig(planKey) {
  const key = (planKey || "basic").toLowerCase();
  const base = { ...(PLAN_CONFIG[key] ?? PLAN_CONFIG.basic) };

  try {
    // Lazy-import firebase to avoid circular deps
    const { db } = await import("../services/firebase");
    const { doc, getDoc } = await import("firebase/firestore");

    const snap = await getDoc(doc(db, "systemConfig", "subscriptionPlans"));
    if (snap.exists()) {
      const firestorePlan = snap.data()?.plans?.[key];
      if (firestorePlan) {
        // productLimit: -1 in Firestore means Infinity
        if (firestorePlan.productLimit !== undefined) {
          base.productLimit = firestorePlan.productLimit === -1
            ? Infinity
            : firestorePlan.productLimit;
        }
        // quotaLimit: -1 means Infinity
        if (firestorePlan.quotaLimit !== undefined) {
          base.quotaLimit = firestorePlan.quotaLimit === -1
            ? Infinity
            : firestorePlan.quotaLimit;
        }
        // projectLimit: -1 means Infinity
        if (firestorePlan.projectLimit !== undefined) {
          base.projectLimit = firestorePlan.projectLimit === -1
            ? Infinity
            : firestorePlan.projectLimit;
        }
        // Label from Firestore if set
        if (firestorePlan.label) {
          base.label = firestorePlan.label;
        }
        // Price stays from PLAN_CONFIG (synced with PayMongo amounts)
      }
    }
  } catch (err) {
    console.warn("getLivePlanConfig: Firestore fetch failed, using static defaults.", err);
  }

  return base;
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
 * Example Basic (20): shop has 0, file has 40 → accept 20, skip 20.
 * Example Pro (150): shop has 140, file has 40 → accept 10, skip 30.
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