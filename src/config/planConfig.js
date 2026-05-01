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
  },
  pro: {
    key: "pro",
    label: "Pro · Active",
    productLimit: 150,
    quotaLimit: Infinity,
    projectLimit: Infinity,
    color: "#3B82F6",
    badgeBg: "#EFF6FF",
    badgeColor: "#1D4ED8",
    badgeBorder: "#BFDBFE",
    accentGradient: "linear-gradient(135deg, #1D4ED8, #3B82F6)",
    sidebarBg: "#0F172A",
    sidebarActiveColor: "#93C5FD",
    sidebarActiveBorder: "#3B82F6",
    sidebarActiveBg: "rgba(59,130,246,0.15)",
  },
  business: {
    key: "business",
    label: "Business",
    productLimit: Infinity,
    quotaLimit: Infinity,
    projectLimit: Infinity,
    color: "#7C3AED",
    badgeBg: "linear-gradient(135deg, #7C3AED, #6D28D9)",
    badgeColor: "#FFFFFF",
    badgeBorder: "transparent",
    accentGradient: "linear-gradient(135deg, #4C1D95, #7C3AED)",
    sidebarBg: "linear-gradient(175deg, #1E0B3A 0%, #2D1B69 60%, #1E0B3A 100%)",
    sidebarActiveColor: "#C4B5FD",
    sidebarActiveBorder: "#7C3AED",
    sidebarActiveBg: "rgba(124,58,237,0.2)",
  },
};

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
        // Price
        if (firestorePlan.price !== undefined) {
          base.price = firestorePlan.price;
        }
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