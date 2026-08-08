// Shared Quotations list for Basic / Pro / Business dashboards
import { useEffect, useMemo, useState } from "react";
import { TbClipboardList, TbSearch, TbX, TbRefresh, TbChevronDown } from "react-icons/tb";
import ListPagination, { paginate } from "../ui/ListPagination";

const ACCENT = "#2C5282";
const DEFAULT_PAGE_SIZE = 8;

const STATUS_META = {
  pending:  { bg: "#FEF3C7", color: "#92400E", border: "#FCD34D", label: "Pending" },
  accepted: { bg: "#D1FAE5", color: "#065F46", border: "#6EE7B7", label: "Accepted" },
  rejected: { bg: "#FEE2E2", color: "#991B1B", border: "#FCA5A5", label: "Rejected" },
};

function toDate(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === "function") return ts.toDate();
  if (typeof ts.seconds === "number") return new Date(ts.seconds * 1000);
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDate(ts) {
  const d = toDate(ts);
  if (!d) return "—";
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

function peso(n) {
  return `₱${Number(n || 0).toLocaleString()}`;
}

function selectStyle(active) {
  return {
    padding: "8px 12px",
    borderRadius: 8,
    border: `1.5px solid ${active ? ACCENT : "#E2E8F0"}`,
    background: active ? "#EFF6FF" : "#fff",
    color: active ? ACCENT : "#334155",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "var(--font-ui, inherit)",
    outline: "none",
  };
}

/**
 * @param {object} props
 * @param {Array} props.quotations
 * @param {function} [props.onGoProjects] - navigate to projects tab
 * @param {string} [props.accentColor]
 */
export default function ShopQuotationsPanel({
  quotations = [],
  onGoProjects,
  accentColor = ACCENT,
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [expandedId, setExpandedId] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const counts = useMemo(() => {
    const c = { all: quotations.length, pending: 0, accepted: 0, rejected: 0 };
    quotations.forEach((q) => {
      const s = (q.status || "pending").toLowerCase();
      if (c[s] != null) c[s] += 1;
      else c.pending += 1;
    });
    return c;
  }, [quotations]);

  const totalAmount = useMemo(
    () => quotations.reduce((sum, q) => sum + (Number(q.amount) || 0), 0),
    [quotations]
  );
  const acceptedAmount = useMemo(
    () => quotations
      .filter((q) => (q.status || "").toLowerCase() === "accepted")
      .reduce((sum, q) => sum + (Number(q.amount) || 0), 0),
    [quotations]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = quotations.filter((item) => {
      const s = (item.status || "pending").toLowerCase();
      if (status !== "all" && s !== status) return false;
      if (!q) return true;
      const hay = [
        item.projectTitle,
        item.note,
        item.status,
        String(item.amount ?? ""),
        ...(item.items || []).map((i) => i.productName),
      ].join(" ").toLowerCase();
      return hay.includes(q);
    });

    list = [...list].sort((a, b) => {
      if (sortBy === "amount_high") return (Number(b.amount) || 0) - (Number(a.amount) || 0);
      if (sortBy === "amount_low") return (Number(a.amount) || 0) - (Number(b.amount) || 0);
      if (sortBy === "status") {
        return (a.status || "").localeCompare(b.status || "");
      }
      const ta = toDate(a.createdAt)?.getTime() || 0;
      const tb = toDate(b.createdAt)?.getTime() || 0;
      return sortBy === "oldest" ? ta - tb : tb - ta;
    });

    return list;
  }, [quotations, search, status, sortBy]);

  useEffect(() => {
    setPage(1);
  }, [search, status, sortBy, quotations.length]);

  const { slice: pageItems, page: safePage, total: filteredTotal } = useMemo(
    () => paginate(filtered, page, pageSize),
    [filtered, page, pageSize]
  );

  const hasFilters = search || status !== "all" || sortBy !== "newest";
  const clearFilters = () => {
    setSearch("");
    setStatus("all");
    setSortBy("newest");
  };

  return (
    <div>
      <div style={{
        display: "flex", flexWrap: "wrap", justifyContent: "space-between",
        gap: 12, marginBottom: 16, alignItems: "flex-start",
      }}>
        <div>
          <h2 style={{
            fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 700,
            color: "#0F172A", margin: "0 0 4px",
          }}>
            My Quotations
          </h2>
          <p style={{ fontSize: 12, color: "#64748B", margin: 0 }}>
            Track bids you sent to builders. Click a row for full item details.
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <TbSearch
              size={15}
              style={{
                position: "absolute", left: 10, top: "50%",
                transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none",
              }}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search project or amount…"
              style={{
                width: 220, maxWidth: "100%", padding: "9px 32px 9px 32px",
                borderRadius: 8, border: "1.5px solid #E2E8F0", fontSize: 13,
                outline: "none", fontFamily: "inherit",
              }}
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                style={{
                  position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                  border: "none", background: "none", cursor: "pointer", color: "#94A3B8",
                  display: "flex", padding: 2,
                }}
              >
                <TbX size={14} />
              </button>
            ) : null}
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={selectStyle(sortBy !== "newest")}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="amount_high">Amount · high</option>
            <option value="amount_low">Amount · low</option>
            <option value="status">Status</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      {quotations.length > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10,
          marginBottom: 16,
        }}>
          {[
            { label: "Total quotes", value: counts.all, sub: peso(totalAmount) },
            { label: "Pending", value: counts.pending, sub: "Awaiting reply" },
            { label: "Accepted", value: counts.accepted, sub: peso(acceptedAmount) },
            { label: "Rejected", value: counts.rejected, sub: "Not selected" },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                background: "#fff",
                border: "1px solid #E2E8F0",
                borderRadius: 12,
                padding: "12px 14px",
              }}
            >
              <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, marginBottom: 4 }}>
                {s.label}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#0F172A" }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Status filters */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12, alignItems: "center",
      }}>
        {[
          { id: "all", label: `All (${counts.all})` },
          { id: "pending", label: `Pending (${counts.pending})` },
          { id: "accepted", label: `Accepted (${counts.accepted})` },
          { id: "rejected", label: `Rejected (${counts.rejected})` },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStatus(tab.id)}
            style={{
              ...selectStyle(status === tab.id),
              borderRadius: 20,
              padding: "6px 14px",
            }}
          >
            {tab.label}
          </button>
        ))}
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            style={{
              ...selectStyle(false),
              display: "inline-flex", alignItems: "center", gap: 4, color: "#64748B",
            }}
          >
            <TbRefresh size={14} /> Reset
          </button>
        )}
      </div>

      <div style={{ fontSize: 12, color: "#94A3B8", marginBottom: 12 }}>
        Showing <strong style={{ color: "#334155" }}>{filteredTotal}</strong>
        {status !== "all" ? ` ${status}` : ""} quotation{filteredTotal !== 1 ? "s" : ""}
      </div>

      {quotations.length === 0 ? (
        <div style={{
          background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0",
          textAlign: "center", padding: "48px 24px",
        }}>
          <TbClipboardList size={36} color="#CBD5E1" style={{ marginBottom: 8 }} />
          <div style={{ fontWeight: 600, color: "#0F172A", marginBottom: 4 }}>
            No quotations yet
          </div>
          <div style={{ fontSize: 12, color: "#94A3B8", marginBottom: 14 }}>
            Open Projects, pick a builder post, and submit your first quote.
          </div>
          {onGoProjects && (
            <button
              type="button"
              onClick={onGoProjects}
              style={{
                padding: "10px 18px",
                borderRadius: 8,
                border: "none",
                background: `linear-gradient(135deg,${accentColor},#3B82F6)`,
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Browse projects →
            </button>
          )}
        </div>
      ) : filteredTotal === 0 ? (
        <div style={{
          background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0",
          textAlign: "center", padding: "40px 24px",
        }}>
          <div style={{ fontWeight: 600, color: "#0F172A", marginBottom: 6 }}>
            No quotations match
          </div>
          <button type="button" onClick={clearFilters} style={selectStyle(true)}>
            Clear filters
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {pageItems.map((q) => {
            const isOpen = expandedId === q.id;
            const sKey = (q.status || "pending").toLowerCase();
            const sc = STATUS_META[sKey] || STATUS_META.pending;
            const items = q.items || [];

            return (
              <div
                key={q.id}
                style={{
                  background: "#fff",
                  borderRadius: 14,
                  border: "1px solid #E2E8F0",
                  overflow: "hidden",
                }}
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(isOpen ? null : q.id)}
                  style={{
                    width: "100%",
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: 12,
                    padding: "14px 18px",
                    cursor: "pointer",
                    border: "none",
                    background: "transparent",
                    textAlign: "left",
                    fontFamily: "inherit",
                  }}
                >
                  <div style={{ flex: "1 1 160px", minWidth: 0 }}>
                    <div style={{
                      fontSize: 14, fontWeight: 700, color: "#0F172A",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {q.projectTitle || "Project"}
                    </div>
                    <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 2 }}>
                      Submitted {formatDate(q.createdAt)}
                      {items.length > 0 ? ` · ${items.length} item${items.length > 1 ? "s" : ""}` : ""}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A" }}>
                      {peso(q.amount)}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, borderRadius: 20, padding: "4px 12px",
                    border: `1px solid ${sc.border}`, background: sc.bg, color: sc.color,
                    letterSpacing: "0.06em", textTransform: "uppercase", flexShrink: 0,
                  }}>
                    {sc.label}
                  </span>
                  <TbChevronDown
                    size={18}
                    color="#94A3B8"
                    style={{
                      flexShrink: 0,
                      transition: "transform 0.15s",
                      transform: isOpen ? "rotate(180deg)" : "none",
                    }}
                  />
                </button>

                {isOpen && (
                  <div style={{
                    borderTop: "1px solid #F1F5F9",
                    padding: "16px 18px",
                    background: "#FAFBFC",
                  }}>
                    {items.length > 0 ? (
                      <>
                        <div style={{
                          fontSize: 10, fontWeight: 700, color: "#94A3B8",
                          letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10,
                        }}>
                          Items quoted
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                          {items.map((item, i) => (
                            <div
                              key={i}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 12,
                                background: "#fff",
                                border: "1px solid #E2E8F0",
                                borderRadius: 10,
                                padding: "10px 14px",
                              }}
                            >
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>
                                  {item.productName || "Item"}
                                </div>
                                <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                                  {item.qty} {item.unit || ""} × {peso(item.price)}
                                </div>
                              </div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>
                                {peso(item.subtotal ?? (item.qty * item.price))}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          paddingTop: 12, borderTop: "1px solid #E2E8F0",
                        }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Total</span>
                          <span style={{ fontSize: 18, fontWeight: 900, color: accentColor }}>
                            {peso(q.amount)}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: 13, color: "#94A3B8", marginBottom: q.note ? 12 : 0 }}>
                        No line-item breakdown for this quote. Total: <strong>{peso(q.amount)}</strong>
                      </div>
                    )}

                    {q.note && (
                      <div style={{
                        marginTop: items.length > 0 ? 12 : 0,
                        padding: "10px 14px",
                        background: "#fff",
                        borderRadius: 8,
                        border: "1px solid #E4E9F0",
                      }}>
                        <div style={{
                          fontSize: 10, fontWeight: 700, color: "#94A3B8",
                          textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4,
                        }}>
                          Your note
                        </div>
                        <div style={{ fontSize: 12.5, color: "#334155", lineHeight: 1.6 }}>{q.note}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ListPagination
        page={safePage}
        pageSize={pageSize}
        total={filteredTotal}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        pageSizeOptions={[5, 8, 12, 20]}
      />
    </div>
  );
}
