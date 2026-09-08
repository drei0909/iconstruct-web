// src/utils/quotePdf.js
// Zero-dependency "shareable PDF" for a single quotation.
//
// Approach: build a self-contained, print-optimized HTML document and write it
// into a new same-origin tab (about:blank), then trigger the browser's native
// Print / "Save as PDF" dialog from the opener. No jsPDF / html2canvas — text
// stays selectable and crisp, and nothing is added to the bundle.
//
// The deployed CSP is script-src 'self' (no 'unsafe-inline'), so the generated
// page carries NO inline <script> and NO on* handlers. The print button and the
// auto-print are wired from THIS document, which is allowed to reach into the
// child window because it is same-origin.

import { getAcceptanceSummary } from "./quoteAnalytics";
import { estimateProjectBaseline } from "./recommendationEngine";

const peso = (n) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);

/** HTML-escape every interpolated value (item names / notes are builder-supplied). */
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toDate(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === "function") return ts.toDate();
  if (typeof ts.seconds === "number") return new Date(ts.seconds * 1000);
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDate(ts) {
  const d = toDate(ts);
  return d
    ? d.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })
    : "—";
}

/** Short, human-friendly reference from the Firestore doc id. */
function quoteRef(q) {
  const id = String(q.id || "");
  return id ? id.slice(-6).toUpperCase() : "—";
}

const STATUS_LABEL = {
  accepted: "ACCEPTED",
  partially_accepted: "PARTIALLY ACCEPTED",
  rejected: "REJECTED",
  pending: "PENDING",
};

/**
 * Build the full printable HTML string for one quotation.
 * @param {object} quote  - a quotation doc ({ id, projectTitle, amount, note, items, status, createdAt, acceptedTotal? })
 * @param {object} [ctx]
 * @param {object} [ctx.shop]           - { shopName, address?, contactNumber?/phone?, email? }
 * @param {object} [ctx.project]        - matched projectPosts doc (for location + DPWH baseline)
 * @param {object} [ctx.estimateConfig] - normalized recommendation-engine config
 */
export function buildQuoteHtml(quote = {}, { shop = null, project = null, estimateConfig = null } = {}) {
  const acc = getAcceptanceSummary(quote);
  const items = Array.isArray(quote.items) ? quote.items : [];
  const supply = items.filter((it) => it && it.status !== "declined");
  const declined = items.filter((it) => it && it.status === "declined");

  const lineSubtotal = (it) =>
    Number(it.subtotal) || (Number(it.qty) || 0) * (Number(it.price) || 0);

  const rowsHtml = supply
    .map((it) => {
      const isSub = it.status === "substituted";
      const name =
        esc(it.productName || "Item") +
        (isSub && it.requestedName
          ? ` <span class="tag">substitute for ${esc(it.requestedName)}</span>`
          : "");
      const note = it.lineNote ? `<div class="note">“${esc(it.lineNote)}”</div>` : "";
      const qty = `${esc(it.qty ?? "")} ${esc(it.unit || "")}`.trim();
      return `<tr>
        <td>${name}${note}</td>
        <td class="num">${esc(qty)}</td>
        <td class="num">${peso(it.price)}</td>
        <td class="num">${peso(lineSubtotal(it))}</td>
      </tr>`;
    })
    .join("");

  const declinedHtml = declined.length
    ? `<h3>Not available from this shop</h3>
       <ul class="declined">
         ${declined
           .map(
             (it) =>
               `<li>${esc(it.productName || "Item")}${
                 it.lineNote ? ` — ${esc(it.lineNote)}` : ""
               }</li>`
           )
           .join("")}
       </ul>`
    : "";

  const acceptedRow = acc.isClosed
    ? `<tr class="totals ${acc.isPartial ? "" : "grand"}">
         <td colspan="3">${acc.isPartial ? "Builder accepted (partial)" : "Accepted total"}</td>
         <td class="num">${peso(acc.acceptedTotal)}</td>
       </tr>`
    : "";

  // DPWH planning baseline — reference only.
  let baselineHtml = "";
  const baseline = project ? estimateProjectBaseline(project, estimateConfig || {}) : null;
  if (baseline && baseline.grandTotal > 0) {
    const diff = Number(quote.amount || 0) - baseline.grandTotal;
    const pct = baseline.grandTotal ? Math.round((diff / baseline.grandTotal) * 100) : 0;
    const rel =
      diff === 0 ? "matches" : diff > 0 ? `${pct}% above` : `${Math.abs(pct)}% below`;
    const src = baseline.source || {};
    const srcLine = [src.reference, src.region, src.asOf].filter(Boolean).map(esc).join(" · ");
    baselineHtml = `<div class="baseline">
      <strong>DPWH planning baseline:</strong> ${peso(baseline.grandTotal)}
      &nbsp;·&nbsp; ${esc(baseline.areaSqm)} m² (materials + labor)
      <div>This quote is <strong>${rel}</strong> the reference estimate.</div>
      <div class="fine">Rule-based on DPWH DUPA quantity factors${
        srcLine ? ` — ${srcLine}` : ""
      }. Reference figure for planning, not an official DPWH price.</div>
    </div>`;
  }

  const statusKey = (quote.status || "pending").toLowerCase();
  const statusLabel = STATUS_LABEL[statusKey] || "PENDING";

  const shopName = esc(shop?.shopName || quote.shopName || "Hardware Shop");
  const shopSub = [shop?.address, shop?.contactNumber || shop?.phone, shop?.email]
    .filter(Boolean)
    .map(esc)
    .join(" &nbsp;·&nbsp; ");

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Quotation ${esc(quoteRef(quote))} — ${shopName}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  body { font: 13px/1.55 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
         color: #0F172A; background: #F1F5F9; padding: 28px 16px; }
  .sheet { max-width: 720px; margin: 0 auto; background: #fff; padding: 40px 44px;
           box-shadow: 0 1px 4px rgba(15,23,42,.12); }
  .bar { text-align: center; margin: 0 auto 18px; max-width: 720px; }
  .bar button { font: inherit; font-weight: 700; padding: 10px 24px; border: none;
                border-radius: 8px; background: #2C5282; color: #fff; cursor: pointer; }
  .bar button:hover { background: #234069; }
  .head { display: flex; justify-content: space-between; align-items: flex-start;
          gap: 16px; border-bottom: 3px solid #2C5282; padding-bottom: 14px; }
  .shop { font-size: 18px; font-weight: 800; }
  .shop-sub { font-size: 11px; color: #64748B; margin-top: 4px; max-width: 360px; }
  .title { text-align: right; flex-shrink: 0; }
  .title h1 { font-size: 21px; letter-spacing: 0.16em; margin: 0; color: #2C5282; }
  .status { display: inline-block; margin-top: 7px; font-size: 10px; font-weight: 800;
            letter-spacing: 0.08em; padding: 3px 10px; border-radius: 999px;
            background: #EFF6FF; color: #1E40AF; border: 1px solid #BFDBFE; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 5px 24px; margin: 18px 0 4px;
          font-size: 12px; }
  .meta span { color: #64748B; display: inline-block; min-width: 88px; }
  table { width: 100%; border-collapse: collapse; margin-top: 14px; }
  th { text-align: left; font-size: 10px; letter-spacing: 0.07em; text-transform: uppercase;
       color: #64748B; border-bottom: 1.5px solid #CBD5E1; padding: 8px 6px; }
  th.num, td.num { text-align: right; white-space: nowrap; }
  td { padding: 9px 6px; border-bottom: 1px solid #E2E8F0; vertical-align: top; }
  .tag { display: inline-block; font-size: 9px; font-weight: 700; letter-spacing: 0.03em;
         color: #B45309; background: #FEF3C7; border: 1px solid #FCD34D; border-radius: 4px;
         padding: 1px 5px; text-transform: uppercase; }
  .note { font-size: 11px; color: #64748B; font-style: italic; margin-top: 3px; }
  tr.totals td { font-weight: 700; border-bottom: none; padding-top: 12px; }
  tr.totals.grand td { font-size: 15px; color: #2C5282; border-top: 2px solid #2C5282; }
  h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #64748B;
       margin: 22px 0 6px; }
  ul.declined { margin: 0; padding-left: 18px; font-size: 12px; color: #991B1B; }
  ul.declined li { margin: 2px 0; }
  .baseline { margin-top: 18px; padding: 12px 15px; background: #F8FAFC;
              border: 1px solid #E2E8F0; border-radius: 8px; font-size: 12px; }
  .baseline .fine { font-size: 10px; color: #94A3B8; margin-top: 5px; }
  .shop-note { margin-top: 18px; padding: 12px 15px; border-left: 3px solid #CBD5E1;
               background: #F8FAFC; font-size: 12px; white-space: pre-wrap; }
  .foot { margin-top: 30px; padding-top: 12px; border-top: 1px solid #E2E8F0;
          font-size: 10px; color: #94A3B8; }
  @page { margin: 14mm; }
  @media print {
    body { background: #fff; padding: 0; }
    .sheet { box-shadow: none; padding: 0; max-width: none; }
    .bar { display: none; }
  }
</style></head>
<body>
  <div class="bar"><button id="q-print" type="button">Print / Save as PDF</button></div>
  <div class="sheet">
    <div class="head">
      <div>
        <div class="shop">${shopName}</div>
        ${shopSub ? `<div class="shop-sub">${shopSub}</div>` : ""}
      </div>
      <div class="title">
        <h1>QUOTATION</h1>
        <div class="status">${statusLabel}</div>
      </div>
    </div>

    <div class="meta">
      <div><span>Quotation #</span>${esc(quoteRef(quote))}</div>
      <div><span>Date</span>${fmtDate(quote.createdAt)}</div>
      <div><span>Project</span>${esc(quote.projectTitle || project?.projectName || "Project")}</div>
      <div><span>Location</span>${esc(project?.locationCity || "—")}</div>
    </div>

    <table>
      <thead>
        <tr><th>Item</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Amount</th></tr>
      </thead>
      <tbody>
        ${
          rowsHtml ||
          `<tr><td colspan="4" style="color:#94A3B8">No line items recorded for this quote.</td></tr>`
        }
        <tr class="totals grand"><td colspan="3">Quote total</td><td class="num">${peso(
          quote.amount
        )}</td></tr>
        ${acceptedRow}
      </tbody>
    </table>

    ${declinedHtml}
    ${baselineHtml}
    ${
      quote.note
        ? `<div class="shop-note"><strong>Note from shop</strong>\n${esc(quote.note)}</div>`
        : ""
    }

    <div class="foot">
      Generated by iConstruct on ${fmtDate(new Date())}. This is a hardware-shop quotation for
      planning purposes; prices remain subject to stock and final confirmation at the store.
      Not an official receipt or invoice.
    </div>
  </div>
</body></html>`;
}

/**
 * Open the printable quote in a new tab and prompt Print / Save-as-PDF.
 * @returns {boolean} false if the popup was blocked.
 */
export function openQuotePdf(quote, ctx = {}) {
  const html = buildQuoteHtml(quote, ctx);

  const w = window.open("", "_blank");
  if (!w) return false; // popup blocked — caller shows guidance

  w.document.open();
  w.document.write(html);
  w.document.close();

  const triggerPrint = () => {
    try {
      w.focus();
      w.print();
    } catch {
      /* user closed the tab, or print unavailable */
    }
  };

  // Wire the button from here (child page has no inline handlers under CSP).
  const wire = () => {
    try {
      const btn = w.document.getElementById("q-print");
      if (btn) btn.addEventListener("click", triggerPrint);
    } catch {
      /* ignore */
    }
  };

  if (w.document.readyState === "complete") wire();
  else w.addEventListener?.("load", wire);

  // Auto-open the print dialog once layout settles.
  w.setTimeout(triggerPrint, 500);
  return true;
}
