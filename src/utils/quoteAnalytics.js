// Money / performance metrics for Pro & Business quotation analytics.

const peso = (n) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value.seconds) return new Date(value.seconds * 1000);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function getQuoteMoneyStats(quotations = []) {
  const list = Array.isArray(quotations) ? quotations : [];
  const accepted = list.filter((q) => q.status === "accepted");
  const pending = list.filter((q) => !q.status || q.status === "pending");
  const rejected = list.filter((q) => q.status === "rejected");

  const sum = (arr) => arr.reduce((s, q) => s + (Number(q.amount) || 0), 0);
  const avg = (arr) => (arr.length ? sum(arr) / arr.length : 0);

  const revenueWon = sum(accepted);
  const pipeline = sum(pending);
  const lostValue = sum(rejected);
  const totalQuoted = sum(list);

  return {
    total: list.length,
    accepted: accepted.length,
    pending: pending.length,
    rejected: rejected.length,
    winRate: list.length ? Math.round((accepted.length / list.length) * 100) : 0,
    revenueWon,
    pipeline,
    lostValue,
    totalQuoted,
    avgBid: avg(list),
    avgAccepted: avg(accepted),
    avgRejected: avg(rejected),
    avgPending: avg(pending),
    format: {
      revenueWon: peso(revenueWon),
      pipeline: peso(pipeline),
      lostValue: peso(lostValue),
      totalQuoted: peso(totalQuoted),
      avgBid: peso(avg(list)),
      avgAccepted: peso(avg(accepted)),
      avgRejected: peso(avg(rejected)),
    },
  };
}

/** Pending quotes older than `days` (default 3), newest first. */
export function getStalePendingQuotes(quotations = [], days = 3) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return (quotations || [])
    .filter((q) => (!q.status || q.status === "pending"))
    .map((q) => {
      const d = toDate(q.createdAt);
      const ms = d ? d.getTime() : 0;
      return {
        ...q,
        ageDays: d ? Math.floor((Date.now() - ms) / (24 * 60 * 60 * 1000)) : 0,
        createdMs: ms,
      };
    })
    .filter((q) => q.createdMs > 0 && q.createdMs < cutoff)
    .sort((a, b) => a.createdMs - b.createdMs);
}

export function getMonthlyMoneyBreakdown(quotations = [], limit = 6) {
  const map = {};
  (quotations || []).forEach((q) => {
    const d = toDate(q.createdAt);
    if (!d) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-PH", { month: "long", year: "numeric" });
    if (!map[key]) {
      map[key] = { key, label, bids: 0, acc: 0, rej: 0, revenue: 0, pipeline: 0 };
    }
    map[key].bids++;
    const amt = Number(q.amount) || 0;
    if (q.status === "accepted") {
      map[key].acc++;
      map[key].revenue += amt;
    } else if (q.status === "rejected") {
      map[key].rej++;
    } else {
      map[key].pipeline += amt;
    }
  });
  return Object.values(map)
    .sort((a, b) => b.key.localeCompare(a.key))
    .slice(0, limit);
}

/** Actionable tips for Business (and light tips for Pro). */
export function buildShopInsights(stats, staleCount, tier = "pro") {
  const tips = [];
  if (stats.total === 0) {
    tips.push("Submit your first quotation on an open project to unlock performance tracking.");
    return tips;
  }
  if (stats.winRate < 25 && stats.total >= 4) {
    tips.push(
      `Win rate is ${stats.winRate}%. Review rejected quotes — winning bids average ${stats.format.avgAccepted}.`
    );
  } else if (stats.winRate >= 50 && stats.accepted >= 2) {
    tips.push(`Strong win rate (${stats.winRate}%). Keep bid amounts near your accepted average of ${stats.format.avgAccepted}.`);
  }
  if (stats.avgRejected > 0 && stats.avgAccepted > 0 && stats.avgRejected > stats.avgAccepted * 1.2) {
    tips.push(
      `Rejected quotes are often higher (${stats.format.avgRejected}) than accepted ones (${stats.format.avgAccepted}). Consider tighter pricing.`
    );
  }
  if (staleCount > 0) {
    tips.push(
      `${staleCount} pending quote${staleCount === 1 ? "" : "s"} older than 3 days. Follow up with the builder or adjust pricing.`
    );
  }
  if (stats.pipeline > 0) {
    tips.push(`Open pipeline of ${stats.format.pipeline} still waiting on builder decisions.`);
  }
  if (tier === "business" && stats.revenueWon > 0) {
    tips.push(`Accepted quotes have brought ${stats.format.revenueWon} in potential supply value (material totals you won).`);
  }
  if (tips.length === 0) {
    tips.push("Keep bidding consistently — more data sharpens pricing guidance.");
  }
  return tips.slice(0, 5);
}

/**
 * Rank the products a shop actually sells, from its own quotations.
 * "Most purchased" = lines on accepted quotes. Declined lines never count.
 * Legacy items with no `status` are treated as quoted.
 *
 * @returns {{ name, orders, qty, value, valueLabel }[]}
 */
export function getTopQuotedProducts(quotations = [], { limit = 5, status = "accepted" } = {}) {
  const list = (Array.isArray(quotations) ? quotations : []).filter(
    (q) => (q.status || "pending") === status
  );

  const map = new Map();
  list.forEach((q) => {
    (Array.isArray(q.items) ? q.items : []).forEach((it) => {
      if (it && it.status === "declined") return;
      const name = (it?.productName || "").trim();
      if (!name) return;
      const qty = Number(it.qty) || 0;
      const sub = Number(it.subtotal) || qty * (Number(it.price) || 0);
      const row = map.get(name) || { name, orders: 0, qty: 0, value: 0 };
      row.orders += 1;
      row.qty += qty;
      row.value += sub;
      map.set(name, row);
    });
  });

  return [...map.values()]
    .sort((a, b) => b.qty - a.qty || b.value - a.value)
    .slice(0, limit)
    .map((r) => ({ ...r, valueLabel: peso(r.value) }));
}

export function downloadQuotationsCsv(quotations = [], filename = "quotations.csv") {
  const rows = [
    ["Project", "Amount", "Status", "Note", "Date"],
    ...(quotations || []).map((q) => {
      const d = toDate(q.createdAt);
      return [
        q.projectTitle || "Project",
        Number(q.amount) || 0,
        q.status || "pending",
        (q.note || "").replace(/\r?\n/g, " ").replace(/"/g, '""'),
        d ? d.toISOString() : "",
      ];
    }),
  ];
  const csv = rows
    .map((r) => r.map((cell) => `"${String(cell ?? "")}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export { peso };
