// src/utils/shopAlerts.js
// In-app bell items for a shop, derived from its live quotations — so the
// shop learns it has something to act on without relying on browser push.

import { getAcceptanceSummary } from "./quoteAnalytics";
import { formatDateTime, formatTimeLeft, toDate, toMillis } from "./dateTime";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Bell item for a paid plan ending within 7 days (or that just ended).
 * Derived from the live shop doc, so it appears and updates in real time —
 * the same warning the hourly job pushes/emails at 7, 3 and 1 day out.
 */
export function buildSubscriptionAlert(shop) {
  if (!shop) return null;
  const plan = String(shop.subscriptionPlan || "").toLowerCase();
  const status = String(shop.subscriptionStatus || "").toLowerCase();
  const planName = (p) => (p === "business" ? "Business" : "Pro");

  if ((plan === "pro" || plan === "business") && status === "active") {
    const exp = toDate(shop.subscriptionExpiry);
    if (!exp) return null;
    const left = exp.getTime() - Date.now();
    if (left <= 0 || left > WEEK_MS) return null;
    return {
      id: `sub-expiring-${exp.getTime()}`,
      important: true,
      at: shop.subscriptionExpiry,
      title: `${planName(plan)} plan ends in ${formatTimeLeft(exp)}`,
      body: `Renew from Billing to keep your ${planName(plan)} features. If it lapses, your shop moves to Basic.`,
      meta: `Expires ${formatDateTime(exp)}`,
    };
  }

  if (status === "expired" && (shop.lastExpiredPlan === "pro" || shop.lastExpiredPlan === "business")) {
    const ended = toDate(shop.subscriptionExpiry) || toDate(shop.lastExpiredAt);
    if (!ended || Date.now() - ended.getTime() > WEEK_MS) return null;
    return {
      id: `sub-expired-${ended.getTime()}`,
      important: true,
      at: ended,
      title: `Your ${planName(shop.lastExpiredPlan)} plan has ended`,
      body: "Your shop is now on Basic. Renew anytime to get your features back.",
      meta: `Ended ${formatDateTime(ended)}`,
    };
  }
  return null;
}

const peso = (n) => `₱${Number(n || 0).toLocaleString("en-PH")}`;

export function buildShopQuoteAlerts(quotations = []) {
  const alerts = [];

  for (const q of quotations || []) {
    const status = String(q.status || "").toLowerCase();
    const won = status === "accepted" || status === "partially_accepted";
    const title = q.projectTitle || "a project";

    if (won && q.shopConfirmation === "pending") {
      const acc = getAcceptanceSummary(q);
      const at = q.acceptedAt || q.updatedAt;
      alerts.push({
        id: `confirm-${q.id}`,
        important: true,
        at,
        title: `Confirm order: ${title}`,
        body: acc.isPartial
          ? `Builder accepted ${acc.takenCount} of ${acc.lineCount} items (${peso(acc.acceptedTotal)}). Accept or reject to continue.`
          : `Builder accepted your quote (${peso(acc.acceptedTotal)}). Accept or reject to continue.`,
        meta: formatDateTime(at, ""),
      });
    }

    if (won && Array.isArray(q.items)) {
      const counterable = q.items.filter((it) => {
        if (it?.accepted !== false || it?.declineReason !== "overpriced") return false;
        const n = it.negotiation;
        if (!n) return true;
        return n.status === "declined" && (Number(n.round) || 0) < 2;
      });
      if (counterable.length) {
        alerts.push({
          id: `overpriced-${q.id}`,
          important: false,
          at: q.acceptedAt || q.updatedAt,
          title: `Price too high on ${title}`,
          body: `The builder skipped ${counterable.length} item${counterable.length > 1 ? "s" : ""} as overpriced — you can propose a new price.`,
          meta: formatDateTime(q.acceptedAt || q.updatedAt, ""),
        });
      }
    }
  }

  return alerts.sort((a, b) => toMillis(b.at) - toMillis(a.at));
}
