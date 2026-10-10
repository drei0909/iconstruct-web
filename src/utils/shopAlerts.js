// src/utils/shopAlerts.js
// In-app bell items for a shop, derived from its live quotations — so the
// shop learns it has something to act on without relying on browser push.

import { getAcceptanceSummary } from "./quoteAnalytics";
import { formatDateTime, toMillis } from "./dateTime";

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
