// Shop access control helpers (approval + subscription expiry).

export const SHOP_STATUS = {
  pending: "pending",
  approved: "approved",
  rejected: "rejected",
  suspended: "suspended",
  deleted: "deleted",
};

/** @param {string|undefined|null} status */
export function isShopApproved(status) {
  return String(status || "").toLowerCase() === SHOP_STATUS.approved;
}

/**
 * Human messages for login / dashboard gate.
 * @returns {{ ok: boolean, code: string, message: string }}
 */
export function evaluateShopLoginAccess(status) {
  const s = String(status || "").toLowerCase();
  if (s === SHOP_STATUS.approved) {
    return { ok: true, code: "ok", message: "" };
  }
  if (s === SHOP_STATUS.pending) {
    return {
      ok: false,
      code: "pending",
      message: "Your shop application is still under review. You cannot access the dashboard yet.",
    };
  }
  if (s === SHOP_STATUS.rejected) {
    return {
      ok: false,
      code: "rejected",
      message: "Your application was not approved. Please contact support.",
    };
  }
  if (s === SHOP_STATUS.suspended) {
    return {
      ok: false,
      code: "suspended",
      message: "Your shop account has been suspended by an administrator. Please contact support.",
    };
  }
  if (s === SHOP_STATUS.deleted) {
    return {
      ok: false,
      code: "deleted",
      message: "This shop account has been closed.",
    };
  }
  return {
    ok: false,
    code: "unavailable",
    message: "This shop account is not allowed to sign in. Contact support.",
  };
}

function toDate(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === "function") return ts.toDate();
  if (typeof ts.seconds === "number") return new Date(ts.seconds * 1000);
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Paid plan past subscriptionExpiry counts as expired (treat as basic UI). */
export function isSubscriptionExpired(shop) {
  if (!shop) return false;
  const plan = String(shop.subscriptionPlan || "basic").toLowerCase();
  if (plan === "basic" || !plan) return false;
  const exp = toDate(shop.subscriptionExpiry);
  if (!exp) return false;
  return exp.getTime() < Date.now();
}

/**
 * Resolve plan for dashboard routing after approval + expiry checks.
 * @returns {"basic"|"pro"|"business"}
 */
export function resolveEffectivePlan(shop) {
  if (!shop || !isShopApproved(shop.status)) return "basic";
  if (isSubscriptionExpired(shop)) return "basic";
  const plan = String(shop.subscriptionPlan || "basic").toLowerCase().trim();
  if (plan === "pro" || plan === "business") return plan;
  return "basic";
}
