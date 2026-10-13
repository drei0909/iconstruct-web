// src/utils/salesPdf.js
// Printable "Subscription Sales Report" for admins — same zero-dependency
// approach as quotePdf.js: a print-optimized HTML page in a new tab, then the
// browser's native Print / "Save as PDF". The page has no inline scripts or
// handlers (the CSP forbids them); the print button is wired from here.

import { METHOD_LABEL, planLabel, peso } from "./sales";
import { formatDateTime, formatDate } from "./dateTime";

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function breakdownRows(map, labelFn) {
  return Object.entries(map)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([k, v]) => `<tr><td>${esc(labelFn(k))}</td><td class="num">${v.count}</td><td class="num">${peso(v.total)}</td></tr>`)
    .join("");
}

/**
 * @param {object} p
 * @param {Array}  p.sales      filtered sale rows (from toSales/filterSales)
 * @param {object} p.summary    summarizeSales(sales)
 * @param {string} p.filterText human description of the active filters
 * @param {Array}  [p.active]   activeSubscriptions(shops), optional section
 * @returns {boolean} false if the popup was blocked
 */
export function openSalesReport({ sales, summary, filterText, active = [] }) {
  const rows = sales
    .map(
      (s, i) => `<tr>
        <td class="num muted">${i + 1}</td>
        <td>${esc(formatDateTime(s.date))}</td>
        <td><strong>${esc(s.shopName)}</strong><div class="sub">${esc(s.email)}</div></td>
        <td>${esc(planLabel(s.plan))}</td>
        <td>${esc(METHOD_LABEL[s.method] || s.method)}</td>
        <td class="ref">${esc(s.reference || "—")}</td>
        <td>${s.periodEnd ? esc(formatDate(s.periodEnd)) : "—"}</td>
        <td class="num">${peso(s.amount)}</td>
      </tr>`
    )
    .join("");

  const activeRows = active
    .map(
      (a) => `<tr>
        <td><strong>${esc(a.shopName)}</strong><div class="sub">${esc(a.email)}</div></td>
        <td>${esc(planLabel(a.plan))}</td>
        <td>${a.startedAt ? esc(formatDate(a.startedAt)) : "—"}</td>
        <td>${esc(formatDateTime(a.expiresAt))}</td>
      </tr>`
    )
    .join("");

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Subscription Sales Report — iConstruct</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  body { font: 12px/1.5 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
         color: #0F172A; background: #F1F5F9; padding: 28px 16px; }
  .sheet { max-width: 960px; margin: 0 auto; background: #fff; padding: 36px 40px;
           box-shadow: 0 1px 4px rgba(15,23,42,.12); }
  .bar { text-align: center; margin: 0 auto 18px; }
  .bar button { font: inherit; font-weight: 700; padding: 10px 24px; border: none;
                border-radius: 8px; background: #0F172A; color: #fff; cursor: pointer; }
  .head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px;
          border-bottom: 3px solid #154665; padding-bottom: 12px; }
  .brand { font-size: 18px; font-weight: 800; color: #154665; }
  .brand-sub { font-size: 10.5px; color: #64748B; letter-spacing: .08em; text-transform: uppercase; }
  h1 { margin: 0; font-size: 17px; letter-spacing: .06em; text-align: right; }
  .gen { font-size: 10.5px; color: #64748B; text-align: right; margin-top: 3px; }
  .filters { margin: 14px 0 0; font-size: 11px; color: #475569; background: #F8FAFC;
             border: 1px solid #E2E8F0; border-radius: 8px; padding: 8px 12px; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 16px 0; }
  .kpi { border: 1px solid #E2E8F0; border-radius: 10px; padding: 10px 12px; }
  .kpi .v { font-size: 17px; font-weight: 800; }
  .kpi .l { font-size: 10px; color: #64748B; text-transform: uppercase; letter-spacing: .06em; }
  .split { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 6px; }
  h3 { font-size: 10.5px; text-transform: uppercase; letter-spacing: .08em; color: #64748B; margin: 18px 0 6px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 9.5px; letter-spacing: .07em; text-transform: uppercase;
       color: #64748B; border-bottom: 1.5px solid #CBD5E1; padding: 7px 6px; }
  td { padding: 7px 6px; border-bottom: 1px solid #E2E8F0; vertical-align: top; }
  th.num, td.num { text-align: right; white-space: nowrap; }
  .sub { font-size: 10px; color: #94A3B8; }
  .muted { color: #94A3B8; }
  .ref { font-family: Consolas, monospace; font-size: 10.5px; word-break: break-all; }
  tr.total td { font-weight: 800; font-size: 13px; border-top: 2px solid #154665; border-bottom: none; }
  .empty { color: #94A3B8; text-align: center; padding: 18px; }
  .foot { margin-top: 26px; padding-top: 10px; border-top: 1px solid #E2E8F0; font-size: 9.5px; color: #94A3B8; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  @page { size: A4 landscape; margin: 12mm; }
  @media print {
    body { background: #fff; padding: 0; }
    .sheet { box-shadow: none; padding: 0; max-width: none; }
    .bar { display: none; }
  }
</style></head>
<body>
  <div class="bar"><button id="s-print" type="button">Print / Save as PDF</button></div>
  <div class="sheet">
    <div class="head">
      <div>
        <div class="brand">iConstruct</div>
        <div class="brand-sub">Admin Control Center</div>
      </div>
      <div>
        <h1>SUBSCRIPTION SALES REPORT</h1>
        <div class="gen">Generated ${esc(formatDateTime(new Date()))}</div>
      </div>
    </div>

    <div class="filters"><strong>Filters:</strong> ${esc(filterText)}</div>

    <div class="kpis">
      <div class="kpi"><div class="v">${peso(summary.total)}</div><div class="l">Total revenue</div></div>
      <div class="kpi"><div class="v">${summary.count}</div><div class="l">Sales</div></div>
      <div class="kpi"><div class="v">${peso(summary.average)}</div><div class="l">Average sale</div></div>
      <div class="kpi"><div class="v">${summary.shops}</div><div class="l">Paying shops</div></div>
    </div>

    <div class="split">
      <div>
        <h3>By plan</h3>
        <table><thead><tr><th>Plan</th><th class="num">Sales</th><th class="num">Revenue</th></tr></thead>
        <tbody>${breakdownRows(summary.byPlan, planLabel) || `<tr><td colspan="3" class="empty">—</td></tr>`}</tbody></table>
      </div>
      <div>
        <h3>By payment method</h3>
        <table><thead><tr><th>Method</th><th class="num">Sales</th><th class="num">Revenue</th></tr></thead>
        <tbody>${breakdownRows(summary.byMethod, (k) => METHOD_LABEL[k] || k) || `<tr><td colspan="3" class="empty">—</td></tr>`}</tbody></table>
      </div>
    </div>

    <h3>Sales (${summary.count})</h3>
    <table>
      <thead><tr><th class="num">#</th><th>Date &amp; time</th><th>Shop</th><th>Plan</th><th>Method</th><th>Reference</th><th>Paid until</th><th class="num">Amount</th></tr></thead>
      <tbody>
        ${rows || `<tr><td colspan="8" class="empty">No sales match these filters.</td></tr>`}
        <tr class="total"><td colspan="7">Total</td><td class="num">${peso(summary.total)}</td></tr>
      </tbody>
    </table>

    ${
      active.length
        ? `<h3>Active subscriptions right now (${active.length})</h3>
    <table>
      <thead><tr><th>Shop</th><th>Plan</th><th>Started</th><th>Expires</th></tr></thead>
      <tbody>${activeRows}</tbody>
    </table>`
        : ""
    }

    <div class="foot">
      Subscription revenue recorded by iConstruct from confirmed PayMongo and admin-verified manual payments.
      Pending and rejected payment requests are excluded. Amounts in Philippine Peso.
    </div>
  </div>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();

  const triggerPrint = () => {
    try {
      w.focus();
      w.print();
    } catch {
      /* closed or unavailable */
    }
  };
  const wire = () => {
    try {
      const btn = w.document.getElementById("s-print");
      if (btn) btn.addEventListener("click", triggerPrint);
    } catch {
      /* ignore */
    }
  };
  if (w.document.readyState === "complete") wire();
  else w.addEventListener?.("load", wire);
  w.setTimeout(triggerPrint, 500);
  return true;
}
