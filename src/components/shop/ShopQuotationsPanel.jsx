// Shared Quotations list for Basic / Pro / Business dashboards
import { useEffect, useMemo, useState } from "react";
import { TbClipboardList, TbSearch, TbX, TbRefresh, TbChevronDown, TbFileDownload } from "react-icons/tb";
import ListPagination, { paginate } from "../ui/ListPagination";
import { getAcceptanceSummary } from "../../utils/quoteAnalytics";
import { openQuotePdf } from "../../utils/quotePdf";
import { confirmQuotation, renegotiateQuoteItem } from "../../controllers/shopController";

const ACCENT = "#2C5282";
const DEFAULT_PAGE_SIZE = 8;

const STATUS_META = {
  pending:              { bg: "#FEF3C7", color: "#92400E", border: "#FCD34D", label: "Pending" },
  accepted:             { bg: "#D1FAE5", color: "#065F46", border: "#6EE7B7", label: "Accepted" },
  partially_accepted:   { bg: "#FEF3C7", color: "#92400E", border: "#FCD34D", label: "Partial" },
  rejected:             { bg: "#FEE2E2", color: "#991B1B", border: "#FCA5A5", label: "Rejected" },
};

// "accepted" filter/count also covers partial acceptances.
const wonKey = (s) => (s === "partially_accepted" ? "accepted" : s);

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
 * @param {function} [props.onMessageBuilder] - open chat for accepted quote
 * @param {string} [props.accentColor]
 * @param {object} [props.shop] - shop profile, for the PDF header
 * @param {Array} [props.projects] - posted projects, matched by id for the PDF's DPWH baseline
 * @param {object} [props.estimateConfig] - recommendation-engine config for the PDF's DPWH baseline
 */
export default function ShopQuotationsPanel({
  quotations = [],
  onGoProjects,
  onMessageBuilder,
  accentColor = ACCENT,
  shop = null,
  projects = [],
  estimateConfig = null,
}) {
  const projectsById = useMemo(() => {
    const m = new Map();
    (projects || []).forEach((p) => p?.id && m.set(String(p.id), p));
    return m;
  }, [projects]);

  const handleExportPdf = (q) => {
    const ok = openQuotePdf(q, {
      shop,
      project: projectsById.get(String(q.projectId)) || null,
      estimateConfig,
    });
    if (!ok) {
      window.alert("Please allow pop-ups for this site, then try Download PDF again.");
    }
  };
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [expandedId, setExpandedId] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [confirmBusy, setConfirmBusy] = useState(null);
  const [confirmError, setConfirmError] = useState({});
  const [negoBusy, setNegoBusy] = useState(null);
  const [negoInputs, setNegoInputs] = useState({});
  const [negoError, setNegoError] = useState({});

  const handleConfirmDecision = async (q, decision) => {
    setConfirmBusy(q.id);
    setConfirmError((e) => ({ ...e, [q.id]: null }));
    try {
      await confirmQuotation({ postId: q.projectId, quotationId: q.id, decision });
    } catch (err) {
      setConfirmError((e) => ({ ...e, [q.id]: err.message || "Failed. Try again." }));
    } finally {
      setConfirmBusy(null);
    }
  };

  const handleRenegotiate = async (q, itemIndex) => {
    const key = `${q.id}:${itemIndex}`;
    const price = parseFloat(negoInputs[key]);
    if (!Number.isFinite(price) || price <= 0) {
      setNegoError((e) => ({ ...e, [key]: "Enter a valid price." }));
      return;
    }
    setNegoBusy(key);
    setNegoError((e) => ({ ...e, [key]: null }));
    try {
      await renegotiateQuoteItem({ postId: q.projectId, quotationId: q.id, itemIndex, newPrice: price });
      setNegoInputs((v) => ({ ...v, [key]: "" }));
    } catch (err) {
      setNegoError((e) => ({ ...e, [key]: err.message || "Failed. Try again." }));
    } finally {
      setNegoBusy(null);
    }
  };

  const counts = useMemo(() => {
    const c = { all: quotations.length, pending: 0, accepted: 0, rejected: 0 };
    quotations.forEach((q) => {
      const s = wonKey((q.status || "pending").toLowerCase());
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
      .filter((q) => wonKey((q.status || "").toLowerCase()) === "accepted")
      .reduce((sum, q) => sum + getAcceptanceSummary(q).acceptedTotal, 0),
    [quotations]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = quotations.filter((item) => {
      const s = wonKey((item.status || "pending").toLowerCase());
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
            // Kept as plain references (not spread/cloned) into `items` so
            // takenSet.has(item) below and items.indexOf(item) for the
            // renegotiation call both stay reference-accurate.
            const supplyItems = items.filter((it) => it.status !== "declined");
            const declinedItems = items.filter((it) => it.status === "declined");
            const acc = getAcceptanceSummary(q);
            const takenSet = new Set(acc.takenItems);
            // Quotations from before this confirmation step existed have no
            // shopConfirmation field at all — treat those as already final
            // so nothing that was already working suddenly looks locked.
            const isGrandfathered = acc.isClosed && q.shopConfirmation == null;
            const isConfirmed = q.shopConfirmation === "confirmed" || isGrandfathered;
            const needsConfirmation = acc.isClosed && q.shopConfirmation === "pending";
            const canMessage = (sKey === "accepted" || sKey === "partially_accepted") && isConfirmed;

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
                      {supplyItems.length > 0 ? ` · ${supplyItems.length} item${supplyItems.length > 1 ? "s" : ""}` : ""}
                      {declinedItems.length > 0 ? ` · ${declinedItems.length} unavailable` : ""}
                      {acc.isClosed ? ` · builder took ${acc.takenCount} of ${acc.lineCount}` : ""}
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
                    {acc.isClosed && (
                      <div style={{
                        marginBottom: 14, padding: "10px 14px", borderRadius: 10,
                        background: needsConfirmation ? "#EFF6FF" : acc.isPartial ? "#FFFBEB" : "#ECFDF5",
                        border: `1px solid ${needsConfirmation ? "#BFDBFE" : acc.isPartial ? "#FCD34D" : "#6EE7B7"}`,
                      }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: needsConfirmation ? "#1D4ED8" : acc.isPartial ? "#92400E" : "#065F46" }}>
                          {acc.isPartial
                            ? `Builder accepted ${acc.takenCount} of ${acc.lineCount} items`
                            : "Builder accepted this quote"}
                        </div>
                        <div style={{ fontSize: 11.5, color: needsConfirmation ? "#1D4ED8" : acc.isPartial ? "#B45309" : "#047857", marginTop: 2 }}>
                          Accepted total {peso(acc.acceptedTotal)}
                          {acc.isPartial ? ` · you quoted ${peso(acc.quotedTotal)}` : ""}
                        </div>

                        {needsConfirmation && (
                          <div style={{ marginTop: 10 }}>
                            <div style={{ fontSize: 11.5, color: "#1D4ED8", marginBottom: 8 }}>
                              Confirm you can fulfill this before the builder can chat with you or rate you.
                            </div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button
                                type="button"
                                disabled={confirmBusy === q.id}
                                onClick={(e) => { e.stopPropagation(); handleConfirmDecision(q, "confirm"); }}
                                style={{
                                  padding: "8px 16px", borderRadius: 8, border: "none",
                                  background: "#059669", color: "#fff", fontSize: 12.5, fontWeight: 700,
                                  cursor: confirmBusy === q.id ? "wait" : "pointer", opacity: confirmBusy === q.id ? 0.7 : 1,
                                }}
                              >
                                {confirmBusy === q.id ? "Working..." : "Accept"}
                              </button>
                              <button
                                type="button"
                                disabled={confirmBusy === q.id}
                                onClick={(e) => { e.stopPropagation(); handleConfirmDecision(q, "decline"); }}
                                style={{
                                  padding: "8px 16px", borderRadius: 8, border: "1.5px solid #DC2626",
                                  background: "#fff", color: "#DC2626", fontSize: 12.5, fontWeight: 700,
                                  cursor: confirmBusy === q.id ? "wait" : "pointer", opacity: confirmBusy === q.id ? 0.7 : 1,
                                }}
                              >
                                Reject
                              </button>
                            </div>
                            {confirmError[q.id] && (
                              <div style={{ fontSize: 11.5, color: "#B91C1C", marginTop: 6 }}>{confirmError[q.id]}</div>
                            )}
                          </div>
                        )}

                        {q.shopConfirmation === "confirmed" && (
                          <div style={{ fontSize: 11.5, color: "#065F46", marginTop: 6, fontWeight: 600 }}>
                            ✓ You confirmed this order — chat and rating are unlocked.
                          </div>
                        )}
                      </div>
                    )}

                    {items.length > 0 ? (
                      <>
                        <div style={{
                          fontSize: 10, fontWeight: 700, color: "#94A3B8",
                          letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10,
                        }}>
                          Items {acc.isClosed ? "supplied" : "quoted"}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                          {supplyItems.map((item, i) => {
                            const isSub = item.status === "substituted";
                            const taken = acc.isClosed ? takenSet.has(item) : null;
                            // Builder unchecked this item and said it's overpriced —
                            // eligible for a one-off counter-price from the shop.
                            const overpriced = taken === false && item.declineReason === "overpriced";
                            const negotiation = item.negotiation || null;
                            const negoKey = `${q.id}:${items.indexOf(item)}`;
                            const canProposeNew = overpriced && (!negotiation || negotiation.status !== "pending") && (Number(negotiation?.round) || 0) < 2;
                            return (
                              <div
                                key={i}
                                style={{
                                  background: "#fff",
                                  border: `1px solid ${isSub ? "#FCD34D" : overpriced ? "#BFDBFE" : "#E2E8F0"}`,
                                  borderRadius: 10,
                                  padding: "10px 14px",
                                  opacity: taken === false && !overpriced ? 0.55 : 1,
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                                  <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                      {item.productName || "Item"}
                                      {isSub && (
                                        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.05em", color: "#B45309", background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: 5, padding: "1px 5px" }}>
                                          SUBSTITUTE
                                        </span>
                                      )}
                                      {taken === true && (
                                        <span style={{ fontSize: 9, fontWeight: 800, color: "#065F46", background: "#D1FAE5", border: "1px solid #6EE7B7", borderRadius: 5, padding: "1px 5px" }}>TAKEN</span>
                                      )}
                                      {taken === false && (
                                        <span style={{ fontSize: 9, fontWeight: 800, color: "#64748B", background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 5, padding: "1px 5px" }}>NOT TAKEN</span>
                                      )}
                                      {overpriced && (
                                        <span style={{ fontSize: 9, fontWeight: 800, color: "#1D4ED8", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 5, padding: "1px 5px" }}>SAID OVERPRICED</span>
                                      )}
                                    </div>
                                    {isSub && item.requestedName ? (
                                      <div style={{ fontSize: 11, color: "#B45309", marginTop: 2 }}>
                                        instead of {item.requestedName}
                                      </div>
                                    ) : null}
                                    <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                                      {item.qty} {item.unit || ""} × {peso(item.price)}
                                    </div>
                                    {item.lineNote ? (
                                      <div style={{ fontSize: 11, color: "#64748B", marginTop: 4, fontStyle: "italic" }}>
                                        “{item.lineNote}”
                                      </div>
                                    ) : null}
                                  </div>
                                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", flexShrink: 0 }}>
                                    {peso(item.subtotal ?? (item.qty * item.price))}
                                  </div>
                                </div>

                                {overpriced && (
                                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed #BFDBFE" }}>
                                    {negotiation?.status === "pending" && (
                                      <div style={{ fontSize: 11.5, color: "#1D4ED8" }}>
                                        You proposed {peso(negotiation.shopOfferedPrice)} — waiting on the builder.
                                      </div>
                                    )}
                                    {negotiation?.status === "declined" && (
                                      <div style={{ fontSize: 11.5, color: "#B91C1C", marginBottom: canProposeNew ? 8 : 0 }}>
                                        Builder declined your {peso(negotiation.shopOfferedPrice)} offer
                                        {canProposeNew ? " — you can try once more." : "."}
                                      </div>
                                    )}
                                    {canProposeNew && (
                                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                        <input
                                          type="number" min="0" placeholder="New price"
                                          value={negoInputs[negoKey] || ""}
                                          onChange={(e) => setNegoInputs((v) => ({ ...v, [negoKey]: e.target.value }))}
                                          onClick={(e) => e.stopPropagation()}
                                          style={{
                                            width: 100, padding: "6px 8px", border: "1.5px solid #BFDBFE",
                                            borderRadius: 7, fontSize: 12.5, fontWeight: 600, outline: "none",
                                          }}
                                        />
                                        <button
                                          type="button"
                                          disabled={negoBusy === negoKey}
                                          onClick={(e) => { e.stopPropagation(); handleRenegotiate(q, items.indexOf(item)); }}
                                          style={{
                                            padding: "7px 14px", borderRadius: 7, border: "none",
                                            background: "#1D4ED8", color: "#fff", fontSize: 12, fontWeight: 700,
                                            cursor: negoBusy === negoKey ? "wait" : "pointer", opacity: negoBusy === negoKey ? 0.7 : 1,
                                          }}
                                        >
                                          {negoBusy === negoKey ? "Sending..." : "Propose new price"}
                                        </button>
                                      </div>
                                    )}
                                    {negoError[negoKey] && (
                                      <div style={{ fontSize: 11, color: "#B91C1C", marginTop: 6 }}>{negoError[negoKey]}</div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {declinedItems.length > 0 && (
                          <>
                            <div style={{
                              fontSize: 10, fontWeight: 700, color: "#B91C1C",
                              letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8,
                            }}>
                              Marked unavailable ({declinedItems.length})
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                              {declinedItems.map((item, i) => (
                                <div
                                  key={i}
                                  style={{
                                    background: "#FEF2F2",
                                    border: "1px solid #FCA5A5",
                                    borderRadius: 10,
                                    padding: "10px 14px",
                                  }}
                                >
                                  <div style={{ fontSize: 13, fontWeight: 600, color: "#B91C1C" }}>
                                    {item.productName || "Item"}
                                  </div>
                                  <div style={{ fontSize: 11, color: "#9F1239", marginTop: 2 }}>
                                    {item.lineNote ? item.lineNote : "Not available from this shop"}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        )}

                        <div style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          paddingTop: 12, borderTop: "1px solid #E2E8F0",
                        }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>
                            {acc.isClosed ? "Quote total" : "Total"}
                          </span>
                          <span style={{ fontSize: 18, fontWeight: 900, color: accentColor }}>
                            {peso(q.amount)}
                          </span>
                        </div>
                        {acc.isPartial && (
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#92400E" }}>Accepted total</span>
                            <span style={{ fontSize: 15, fontWeight: 900, color: "#B45309" }}>{peso(acc.acceptedTotal)}</span>
                          </div>
                        )}
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

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExportPdf(q);
                        }}
                        style={{
                          flex: canMessage && typeof onMessageBuilder === "function" ? "0 0 auto" : "1 1 100%",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          padding: "11px 16px",
                          borderRadius: 10,
                          border: `1.5px solid ${accentColor}`,
                          background: "#fff",
                          color: accentColor,
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        <TbFileDownload size={16} /> Download PDF
                      </button>
                      {canMessage && typeof onMessageBuilder === "function" && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onMessageBuilder(q);
                          }}
                          style={{
                            flex: "1 1 auto",
                            padding: "11px 16px",
                            borderRadius: 10,
                            border: "none",
                            background: accentColor,
                            color: "#fff",
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: "pointer",
                            fontFamily: "inherit",
                          }}
                        >
                          Message builder →
                        </button>
                      )}
                    </div>
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
