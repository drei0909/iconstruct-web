// Shared Pro / Business analytics: real money metrics + export + insights.
import {
  getQuoteMoneyStats,
  getStalePendingQuotes,
  getMonthlyMoneyBreakdown,
  buildShopInsights,
  downloadQuotationsCsv,
  peso,
} from "../../utils/quoteAnalytics";

function StatCard({ label, value, color, sub }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: "18px 20px", border: "1px solid #E2E8F0" }}>
      <div style={{ fontSize: 22, fontWeight: 900, color, fontFamily: "var(--font-display)", lineHeight: 1.1, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 11, color: "#94A3B8" }}>{sub}</div>
    </div>
  );
}

/**
 * @param {"pro"|"business"} tier
 */
export default function PaidPlanAnalytics({ quotations = [], tier = "pro" }) {
  const isBiz = tier === "business";
  const stats = getQuoteMoneyStats(quotations);
  const stale = getStalePendingQuotes(quotations, 3);
  const monthly = getMonthlyMoneyBreakdown(quotations, isBiz ? 8 : 6);
  const insights = buildShopInsights(stats, stale.length, tier);

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
        <div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 900, color: "#0F172A", marginBottom: 4 }}>
            {isBiz ? "Business Intelligence" : "Performance Analytics"}
          </h2>
          <p style={{ fontSize: 12, color: "#64748B", margin: 0 }}>
            {isBiz
              ? "Revenue, pipeline, follow-ups, and pricing insights from your real quotes."
              : "Track money won, open pipeline, and export quote history — Pro plan."}
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            downloadQuotationsCsv(
              quotations,
              isBiz ? "business-quotations.csv" : "pro-quotations.csv"
            )
          }
          style={{
            padding: "10px 16px",
            borderRadius: 10,
            border: "1px solid #BFDBFE",
            background: "#EFF6FF",
            color: "#1D4ED8",
            fontWeight: 700,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Export CSV →
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
        <StatCard label="Revenue won" value={stats.format.revenueWon} color="#10B981" sub="Accepted quote totals" />
        <StatCard label="Open pipeline" value={stats.format.pipeline} color="#F59E0B" sub="Still pending" />
        <StatCard label="Win rate" value={`${stats.winRate}%`} color="#3B82F6" sub={`${stats.accepted} of ${stats.total} bids`} />
        <StatCard label="Avg accepted" value={stats.format.avgAccepted} color="#0F172A" sub="Guide your next price" />
        {isBiz && (
          <>
            <StatCard label="Value lost" value={stats.format.lostValue} color="#EF4444" sub="Rejected totals" />
            <StatCard label="Avg bid" value={stats.format.avgBid} color="#64748B" sub="All quotes" />
          </>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isBiz ? "1.2fr 1fr" : "1fr", gap: 16, marginBottom: 20 }}>
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0", overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #F1F5F9", fontSize: 13, fontWeight: 700, color: "#0F172A" }}>
            Monthly breakdown
          </div>
          {monthly.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontSize: 12 }}>No data yet.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#F8FAFC" }}>
                    {(isBiz
                      ? ["Month", "Bids", "Won", "Lost", "Revenue", "Pipeline"]
                      : ["Month", "Bids", "Accepted", "Rejected", "Win rate"]
                    ).map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "10px 14px",
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          color: "#94A3B8",
                          textAlign: "left",
                          borderBottom: "1px solid #E2E8F0",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((row, i) => {
                    const rate = row.bids > 0 ? Math.round((row.acc / row.bids) * 100) : 0;
                    const border = i < monthly.length - 1 ? "1px solid #F1F5F9" : "none";
                    return (
                      <tr key={row.key}>
                        <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 600, color: "#0F172A", borderBottom: border }}>{row.label}</td>
                        <td style={{ padding: "12px 14px", fontSize: 13, color: "#334155", borderBottom: border }}>{row.bids}</td>
                        <td style={{ padding: "12px 14px", fontSize: 13, color: "#10B981", fontWeight: 600, borderBottom: border }}>{row.acc}</td>
                        <td style={{ padding: "12px 14px", fontSize: 13, color: "#EF4444", borderBottom: border }}>{row.rej}</td>
                        {isBiz ? (
                          <>
                            <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 600, color: "#0F172A", borderBottom: border }}>{peso(row.revenue)}</td>
                            <td style={{ padding: "12px 14px", fontSize: 13, color: "#F59E0B", borderBottom: border }}>{peso(row.pipeline)}</td>
                          </>
                        ) : (
                          <td style={{ padding: "12px 14px", borderBottom: border }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ flex: 1, height: 5, background: "#F1F5F9", borderRadius: 3 }}>
                                <div style={{ height: "100%", width: `${rate}%`, background: "#3B82F6", borderRadius: 3 }} />
                              </div>
                              <span style={{ fontSize: 11, fontWeight: 700, color: "#3B82F6" }}>{rate}%</span>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {isBiz && (
          <div style={{ background: "linear-gradient(160deg,#0D2E43,#154665)", borderRadius: 14, padding: "18px 20px", color: "#fff" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "rgba(232,217,188,0.85)", marginBottom: 10 }}>
              SMART INSIGHTS
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, displayHeight: 1.65, fontSize: 12.5, color: "rgba(255,255,255,0.88)" }}>
              {insights.map((t, i) => (
                <li key={i} style={{ marginBottom: 8 }}>{t}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {!isBiz && insights.length > 0 && (
        <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 12, padding: "14px 16px", marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", marginBottom: 6 }}>Tips</div>
          {insights.slice(0, 2).map((t, i) => (
            <div key={i} style={{ fontSize: 12, color: "#64748B", lineHeight: 1.55, marginBottom: 4 }}>• {t}</div>
          ))}
        </div>
      )}

      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0", overflow: "hidden", marginBottom: 16 }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Follow-up queue</div>
          <span style={{ fontSize: 11, color: "#94A3B8" }}>Pending bids older than 3 days</span>
        </div>
        {stale.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "#94A3B8", fontSize: 12 }}>
            No stale pending quotes — nice follow-through.
          </div>
        ) : (
          <div>
            {stale.slice(0, isBiz ? 12 : 5).map((q, i) => (
              <div
                key={q.id || i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "12px 18px",
                  borderBottom: i < Math.min(stale.length, isBiz ? 12 : 5) - 1 ? "1px solid #F1F5F9" : "none",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {q.projectTitle || "Project"}
                  </div>
                  <div style={{ fontSize: 11, color: "#94A3B8" }}>{q.ageDays} day{q.ageDays === 1 ? "" : "s"} waiting</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#F59E0B", flexShrink: 0 }}>{peso(q.amount)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0", overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #F1F5F9", fontSize: 13, fontWeight: 700, color: "#0F172A" }}>
          Quotation history
        </div>
        {quotations.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontSize: 12 }}>No quotations yet.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F8FAFC" }}>
                  {["Project", "Amount", "Date", "Status"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 14px",
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "#94A3B8",
                        textAlign: "left",
                        borderBottom: "1px solid #E2E8F0",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {quotations.slice(0, isBiz ? 50 : 25).map((q, i) => {
                  const d = q.createdAt?.toDate?.() || (q.createdAt ? new Date(q.createdAt) : null);
                  const border = i < Math.min(quotations.length, isBiz ? 50 : 25) - 1 ? "1px solid #F1F5F9" : "none";
                  const badge =
                    q.status === "accepted"
                      ? { background: "#D1FAE5", color: "#065F46", border: "1px solid #6EE7B7" }
                      : q.status === "rejected"
                        ? { background: "#FEE2E2", color: "#991B1B", border: "1px solid #FCA5A5" }
                        : { background: "#FEF3C7", color: "#92400E", border: "1px solid #FCD34D" };
                  return (
                    <tr key={q.id || i}>
                      <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 600, color: "#0F172A", borderBottom: border }}>{q.projectTitle || "Project"}</td>
                      <td style={{ padding: "12px 14px", fontSize: 13, color: "#334155", borderBottom: border }}>{peso(q.amount)}</td>
                      <td style={{ padding: "12px 14px", fontSize: 11.5, color: "#94A3B8", borderBottom: border }}>
                        {d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("en-PH") : "—"}
                      </td>
                      <td style={{ padding: "12px 14px", borderBottom: border }}>
                        <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 20, padding: "3px 10px", textTransform: "uppercase", ...badge }}>
                          {q.status || "pending"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
