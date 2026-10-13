// src/views/admin/SalesTab.jsx
// Subscription Sales — every confirmed PayMongo and admin-verified manual
// payment, live. Filters, search, CSV export and a printable PDF report.

import { useEffect, useMemo, useState } from "react";
import {
  ArrowCounterClockwise,
  ChartLineUp,
  DownloadSimple,
  Printer,
  Receipt,
  UsersThree,
  CurrencyCircleDollar,
} from "@phosphor-icons/react";
import SearchBar from "../../components/ui/SearchBar";
import ListPagination, { paginate } from "../../components/ui/ListPagination";
import { watchSales, watchActiveSubscribers } from "../../controllers/adminController";
import {
  toSales, filterSales, summarizeSales, activeSubscriptions,
  METHOD_LABEL, planLabel, peso,
} from "../../utils/sales";
import { openSalesReport } from "../../utils/salesPdf";
import { formatDate, formatTime, formatDateTime, formatTimeLeft } from "../../utils/dateTime";

const RANGES = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "month", label: "This month" },
  { value: "lastMonth", label: "Last month" },
  { value: "year", label: "This year" },
  { value: "custom", label: "Custom range…" },
];

const PLAN_STYLE = {
  pro: { bg: "#EFF6FF", color: "#1D4ED8" },
  business: { bg: "#F5F3FF", color: "#6D28D9" },
};
const METHOD_STYLE = {
  paymongo: { bg: "#ECFDF5", color: "#047857", border: "#A7F3D0" },
  manual: { bg: "#FFFBEB", color: "#92400E", border: "#FCD34D" },
};

const pill = (on) => ({
  padding: "7px 14px", borderRadius: 8, fontSize: 11.5, fontWeight: 500, cursor: "pointer",
  fontFamily: "var(--font-ui)",
  ...(on
    ? { background: "#0F172A", color: "#fff", border: "1px solid #0F172A" }
    : { background: "#fff", color: "#64748B", border: "1px solid #E2E8F0" }),
});

const selectStyle = {
  padding: "7px 10px", borderRadius: 8, fontSize: 11.5, fontFamily: "var(--font-ui)",
  border: "1px solid #E2E8F0", background: "#fff", color: "#334155", cursor: "pointer",
};

/** CSV-safe cell: quotes escaped, and leading = + - @ neutralized so the file
 *  can't execute formulas when opened in Excel (CSV injection). */
function csvCell(v) {
  let s = String(v == null ? "" : v);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export default function SalesTab({ shops: initialShops = [], Avatar }) {
  const [payments, setPayments] = useState(null);
  // Live, so a shop that just subscribed (or just expired) shows up here
  // right away; starts from the dashboard's already-loaded shops.
  const [shops, setShops] = useState(initialShops);
  useEffect(() => {
    const unsub = watchActiveSubscribers(
      (list) => setShops(list),
      (err) => console.warn("Active subscribers listener failed:", err?.message || err)
    );
    return () => unsub();
  }, []);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [range, setRange] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [plan, setPlan] = useState("all");
  const [method, setMethod] = useState("all");
  const [pageSize, setPageSize] = useState(10);
  const [view, setView] = useState("sales"); // sales | active
  const [nowMs] = useState(() => Date.now());

  // Live: a PayMongo sale is written by a Cloud Function, so it should
  // appear here on its own, without a refresh.
  useEffect(() => {
    const unsub = watchSales(
      (list) => { setPayments(list); setError(""); },
      (err) => {
        console.warn("Sales listener failed:", err?.message || err);
        setError("Couldn't load sales. Check your connection and refresh.");
        setPayments((p) => p || []);
      }
    );
    return () => unsub();
  }, []);

  const allSales = useMemo(() => toSales(payments || []), [payments]);
  const filtered = useMemo(
    () => filterSales(allSales, { query, plan, method, range, from, to }),
    [allSales, query, plan, method, range, from, to]
  );
  const summary = useMemo(() => summarizeSales(filtered), [filtered]);
  const active = useMemo(() => activeSubscriptions(shops), [shops]);
  const lifetime = useMemo(() => summarizeSales(allSales), [allSales]);

  // Page resets to 1 whenever any filter changes (derived, not an effect).
  const filterKey = JSON.stringify([query, plan, method, range, from, to, pageSize]);
  const [pageState, setPageState] = useState({ key: filterKey, page: 1 });
  const page = pageState.key === filterKey ? pageState.page : 1;
  const setPage = (p) => setPageState({ key: filterKey, page: p });
  const pg = paginate(filtered, page, pageSize);

  const filterText = [
    RANGES.find((r) => r.value === range)?.label +
      (range === "custom" ? ` (${from || "start"} → ${to || "today"})` : ""),
    plan === "all" ? "All plans" : `${planLabel(plan)} plan`,
    method === "all" ? "All methods" : METHOD_LABEL[method],
    query.trim() ? `Search: "${query.trim()}"` : null,
  ].filter(Boolean).join(" · ");

  const exportCsv = () => {
    const header = ["Date", "Time", "Shop", "Owner", "Email", "Plan", "Method", "Reference", "Paid until", "Amount (PHP)"];
    const lines = filtered.map((s) => [
      formatDate(s.date, ""), formatTime(s.date, ""), s.shopName, s.ownerName, s.email,
      planLabel(s.plan), METHOD_LABEL[s.method] || s.method, s.reference,
      s.periodEnd ? formatDate(s.periodEnd, "") : "", s.amount.toFixed(2),
    ].map(csvCell).join(","));
    lines.push(["", "", "", "", "", "", "", "", "TOTAL", summary.total.toFixed(2)].map(csvCell).join(","));
    const blob = new Blob(["﻿" + [header.map(csvCell).join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `iconstruct-sales-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    const ok = openSalesReport({ sales: filtered, summary, filterText, active });
    if (!ok) window.alert("Please allow pop-ups for this site, then try Print / PDF again.");
  };

  const clearFilters = () => {
    setQuery(""); setRange("all"); setFrom(""); setTo(""); setPlan("all"); setMethod("all");
  };
  const hasFilters = query || range !== "all" || plan !== "all" || method !== "all";

  const btn = (primary) => ({
    display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 9,
    fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-ui)",
    ...(primary
      ? { background: "#0F172A", color: "#fff", border: "1px solid #0F172A" }
      : { background: "#fff", color: "#334155", border: "1px solid #E2E8F0" }),
  });

  const loading = payments === null;
  const proActive = active.filter((a) => a.plan === "pro").length;
  const bizActive = active.filter((a) => a.plan === "business").length;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20, display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: "'Lora',Georgia,serif", fontSize: 20, fontWeight: 900, color: "#0F172A", marginBottom: 2 }}>Sales</h2>
          <p style={{ fontSize: 12, color: "#64748B" }}>
            Subscription revenue from confirmed PayMongo and verified manual payments. Updates live.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" style={btn(false)} onClick={exportCsv} disabled={loading || !filtered.length}>
            <DownloadSimple size={15} /> Export CSV
          </button>
          <button type="button" style={btn(true)} onClick={printReport} disabled={loading}>
            <Printer size={15} /> Print / PDF
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="sales-kpis" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
        {[
          { label: "Revenue", value: peso(summary.total), sub: filterText.split(" · ")[0], color: "#10B981", icon: <CurrencyCircleDollar size={18} /> },
          { label: "Sales", value: summary.count, sub: `${summary.shops} paying shop${summary.shops === 1 ? "" : "s"}`, color: "#3B82F6", icon: <Receipt size={18} /> },
          { label: "Average sale", value: peso(summary.average), sub: `Lifetime ${peso(lifetime.total)}`, color: "#6D28D9", icon: <ChartLineUp size={18} /> },
          { label: "Active subscriptions", value: active.length, sub: `Pro ${proActive} · Business ${bizActive}`, color: "#F59E0B", icon: <UsersThree size={18} /> },
        ].map((c) => (
          <div key={c.label} style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", padding: "16px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontFamily: "'Lora',Georgia,serif", fontSize: 24, fontWeight: 900, color: c.color }}>{loading ? "—" : c.value}</div>
              <span style={{ color: c.color, opacity: 0.7 }}>{c.icon}</span>
            </div>
            <div style={{ fontSize: 11.5, color: "#0F172A", fontWeight: 600, marginTop: 2 }}>{c.label}</div>
            <div style={{ fontSize: 10.5, color: "#94A3B8", marginTop: 1 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* View switch */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        <button type="button" style={pill(view === "sales")} onClick={() => setView("sales")}>Sales history</button>
        <button type="button" style={pill(view === "active")} onClick={() => setView("active")}>
          Active subscriptions ({active.length})
        </button>
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", borderRadius: 10, padding: "10px 14px", fontSize: 12.5, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {view === "sales" ? (
        <>
          {/* Filter bar */}
          <SearchBar
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by shop, owner, email, or reference…"
            accentColor="#154665"
            style={{ marginBottom: 12 }}
            width="100%"
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 14 }}>
            <select value={range} onChange={(e) => setRange(e.target.value)} style={selectStyle} aria-label="Date range">
              {RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            {range === "custom" && (
              <>
                <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} style={selectStyle} aria-label="From date" />
                <span style={{ fontSize: 12, color: "#94A3B8" }}>to</span>
                <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} style={selectStyle} aria-label="To date" />
              </>
            )}
            <span style={{ width: 1, height: 22, background: "#E2E8F0", margin: "0 4px" }} />
            {["all", "pro", "business"].map((p) => (
              <button key={p} type="button" style={pill(plan === p)} onClick={() => setPlan(p)}>
                {p === "all" ? "All plans" : planLabel(p)}
              </button>
            ))}
            <span style={{ width: 1, height: 22, background: "#E2E8F0", margin: "0 4px" }} />
            {["all", "paymongo", "manual"].map((m) => (
              <button key={m} type="button" style={pill(method === m)} onClick={() => setMethod(m)}>
                {m === "all" ? "All methods" : METHOD_LABEL[m]}
              </button>
            ))}
            {hasFilters && (
              <button type="button" onClick={clearFilters} style={{ ...pill(false), color: "#3B82F6", borderColor: "transparent", background: "transparent", display: "inline-flex", alignItems: "center", gap: 4 }}>
                <ArrowCounterClockwise size={13} /> Reset
              </button>
            )}
          </div>

          {/* Breakdown */}
          {summary.count > 0 && (
            <div className="sales-split" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              {[
                { title: "By plan", map: summary.byPlan, label: planLabel, color: (k) => (k === "business" ? "#6D28D9" : "#1D4ED8") },
                { title: "By payment method", map: summary.byMethod, label: (k) => METHOD_LABEL[k] || k, color: (k) => (k === "paymongo" ? "#10B981" : "#F59E0B") },
              ].map((b) => (
                <div key={b.title} style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", padding: "14px 16px" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#94A3B8", marginBottom: 10 }}>{b.title}</div>
                  {Object.entries(b.map).sort((x, y) => y[1].total - x[1].total).map(([k, v]) => {
                    const pct = summary.total > 0 ? Math.round((v.total / summary.total) * 100) : 0;
                    return (
                      <div key={k} style={{ marginBottom: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                          <span style={{ color: "#334155", fontWeight: 600 }}>{b.label(k)} <span style={{ color: "#94A3B8", fontWeight: 400 }}>· {v.count} sale{v.count === 1 ? "" : "s"}</span></span>
                          <span style={{ color: "#0F172A", fontWeight: 700 }}>{peso(v.total)} <span style={{ color: "#94A3B8", fontWeight: 400 }}>({pct}%)</span></span>
                        </div>
                        <div style={{ height: 6, borderRadius: 4, background: "#F1F5F9", overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: b.color(k) }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {/* Sales table */}
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0", overflow: "hidden" }}>
            {loading ? (
              <div style={{ padding: 48, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>Loading sales…</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 56, textAlign: "center", color: "#94A3B8" }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
                  <Receipt size={36} weight="thin" color="#CBD5E1" />
                </div>
                <div style={{ fontWeight: 600, color: "#0F172A", marginBottom: 4 }}>
                  {allSales.length ? "No sales match these filters" : "No sales yet"}
                </div>
                <div style={{ fontSize: 12 }}>
                  {allSales.length
                    ? "Try a wider date range or reset the filters."
                    : "Confirmed PayMongo and manual subscription payments will appear here."}
                </div>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
                  <thead>
                    <tr style={{ background: "#F8FAFC" }}>
                      {["#", "Date & time", "Shop", "Plan", "Method", "Reference", "Paid until", "Amount"].map((h) => (
                        <th key={h} style={{ padding: "11px 14px", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#94A3B8", textAlign: h === "Amount" ? "right" : "left", borderBottom: "1px solid #E2E8F0", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pg.slice.map((s, i) => {
                      const ps = PLAN_STYLE[s.plan] || { bg: "#F1F5F9", color: "#475569" };
                      const ms = METHOD_STYLE[s.method] || METHOD_STYLE.manual;
                      return (
                        <tr key={s.id}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#F8FAFC")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                          <td style={{ padding: "12px 14px", color: "#CBD5E1", fontSize: 11 }}>{String((pg.page - 1) * pageSize + i + 1).padStart(2, "0")}</td>
                          <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                            <div style={{ fontSize: 12, color: "#334155" }}>{formatDate(s.date)}</div>
                            <div style={{ fontSize: 10.5, color: "#94A3B8" }}>{formatTime(s.date)}</div>
                          </td>
                          <td style={{ padding: "12px 14px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                              {Avatar ? <Avatar name={s.shopName} size={30} /> : null}
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 12.5, fontWeight: 600, color: "#0F172A" }}>{s.shopName}</div>
                                <div style={{ fontSize: 10.5, color: "#94A3B8" }}>{s.email || s.ownerName}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: "12px 14px" }}>
                            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 6, background: ps.bg, color: ps.color }}>{planLabel(s.plan)}</span>
                          </td>
                          <td style={{ padding: "12px 14px" }}>
                            <span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: ms.bg, color: ms.color, border: `1px solid ${ms.border}`, whiteSpace: "nowrap" }}>{METHOD_LABEL[s.method]}</span>
                          </td>
                          <td style={{ padding: "12px 14px" }}>
                            <code title={s.reference} style={{ fontSize: 11, background: "#F1F5F9", padding: "2px 6px", borderRadius: 4, color: "#334155", display: "inline-block", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "middle" }}>{s.reference || "—"}</code>
                          </td>
                          <td style={{ padding: "12px 14px", fontSize: 12, color: "#64748B", whiteSpace: "nowrap" }}>{s.periodEnd ? formatDate(s.periodEnd) : "—"}</td>
                          <td style={{ padding: "12px 14px", textAlign: "right", fontSize: 13, fontWeight: 700, color: "#0F172A", whiteSpace: "nowrap" }}>{peso(s.amount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "#F8FAFC" }}>
                      <td colSpan={7} style={{ padding: "12px 14px", fontSize: 12, fontWeight: 700, color: "#0F172A", borderTop: "1px solid #E2E8F0" }}>
                        Total · {summary.count} sale{summary.count === 1 ? "" : "s"}
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "right", fontSize: 14, fontWeight: 900, color: "#10B981", borderTop: "1px solid #E2E8F0", whiteSpace: "nowrap" }}>{peso(summary.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
          {filtered.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <ListPagination
                page={pg.page}
                pageSize={pageSize}
                total={pg.total}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                pageSizeOptions={[10, 25, 50, 100]}
              />
            </div>
          )}
        </>
      ) : (
        /* Active subscriptions right now */
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0", overflow: "hidden" }}>
          {active.length === 0 ? (
            <div style={{ padding: 56, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>No shop has an active paid plan right now.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
                <thead>
                  <tr style={{ background: "#F8FAFC" }}>
                    {["Shop", "Plan", "Started", "Expires", "Time left"].map((h) => (
                      <th key={h} style={{ padding: "11px 14px", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#94A3B8", textAlign: "left", borderBottom: "1px solid #E2E8F0" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {active.map((a) => {
                    const ps = PLAN_STYLE[a.plan] || { bg: "#F1F5F9", color: "#475569" };
                    const soon = a.expiresAt && a.expiresAt.getTime() - nowMs < 7 * 24 * 60 * 60 * 1000;
                    return (
                      <tr key={a.id} style={{ borderLeft: soon ? "3px solid #F59E0B" : "3px solid transparent" }}>
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                            {Avatar ? <Avatar name={a.shopName} size={30} /> : null}
                            <div>
                              <div style={{ fontSize: 12.5, fontWeight: 600, color: "#0F172A" }}>{a.shopName}</div>
                              <div style={{ fontSize: 10.5, color: "#94A3B8" }}>{a.email || a.ownerName}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 6, background: ps.bg, color: ps.color }}>{planLabel(a.plan)}</span>
                        </td>
                        <td style={{ padding: "12px 14px", fontSize: 12, color: "#64748B" }}>{a.startedAt ? formatDate(a.startedAt) : "—"}</td>
                        <td style={{ padding: "12px 14px", fontSize: 12, color: "#334155", whiteSpace: "nowrap" }}>{formatDateTime(a.expiresAt)}</td>
                        <td style={{ padding: "12px 14px", fontSize: 12, fontWeight: 600, color: soon ? "#B45309" : "#047857", whiteSpace: "nowrap" }}>{formatTimeLeft(a.expiresAt) || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <style>{`
        @media (max-width: 900px) {
          .sales-kpis { grid-template-columns: repeat(2, 1fr) !important; }
          .sales-split { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
