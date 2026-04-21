// src/config/planConfig.js
// ─────────────────────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH for all plan limits, labels, and theme
// colours. Import this wherever you need plan-aware behaviour.
// Never hardcode limits or colours in individual components.
// ─────────────────────────────────────────────────────────────

export const PLAN_CONFIG = {
  basic: {
    key: "basic",
    label: "Free · Basic",
    productLimit: 20,       // max products a Basic shop can list
    quotaLimit: 3,          // max quotations per month
    projectLimit: 5,        // max visible projects
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
    quotaLimit: Infinity,   // unlimited
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
    productLimit: Infinity, // unlimited — no cap
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
 * Returns the plan config object for a given plan key.
 * Falls back to "basic" if the key is unrecognised.
 *
 * @param {string} planKey - "basic" | "pro" | "business"
 * @returns {object} Plan config
 */
export function getPlanConfig(planKey) {
  const key = (planKey || "basic").toLowerCase();
  return PLAN_CONFIG[key] ?? PLAN_CONFIG.basic;
}

/**
 * Returns a human-readable product limit string.
 * Infinity → "Unlimited"
 *
 * @param {number} limit
 * @returns {string}
 */
export function formatProductLimit(limit) {
  return limit === Infinity ? "Unlimited" : String(limit);
}

/**
 * Returns whether a shop has reached its product listing limit.
 *
 * @param {number} currentCount - How many products the shop has listed
 * @param {number} limit        - Plan's productLimit (use Infinity for unlimited)
 * @returns {boolean}
 */
export function isAtProductLimit(currentCount, limit) {
  return limit !== Infinity && currentCount >= limit;
}