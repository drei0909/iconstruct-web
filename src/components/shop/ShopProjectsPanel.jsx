// Shared Projects list for Basic / Pro / Business dashboards
import { useEffect, useMemo, useState } from "react";
import {
  TbClipboardList, TbMapPin, TbRuler2, TbCurrencyDollar, TbTag,
  TbChevronDown, TbSearch, TbX, TbCheck, TbRefresh,
} from "react-icons/tb";
import ListPagination, { paginate } from "../ui/ListPagination";
import { estimateProjectBaseline } from "../../utils/recommendationEngine";
import { scoreProjectFit } from "../../utils/supplyCategories";
import { toDate, formatDateTime } from "../../utils/dateTime";

const ACCENT = "#2C5282";
const peso0 = (n) => `₱${Number(n || 0).toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;
const FIT_META = {
  good: { tone: "green", label: "Great match" },
  ok:   { tone: "brand", label: "Partial match" },
  poor: { tone: "slate", label: "Low match" },
};
const DEFAULT_PAGE_SIZE = 8;

function humanizeKey(key) {
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

/** "dryRoom" -> "Dry Room"; leaves normal sentences/phrases alone. */
function formatScalar(v) {
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (v == null || v === "") return "—";
  if (typeof v === "string" && /^[a-z][a-zA-Z0-9]*$/.test(v)) return humanizeKey(v);
  return String(v);
}

const isPlainValue = (v) => v == null || typeof v !== "object";

/** One object's own fields as "Key A, Key B" — used for array items and nested objects. */
function summarizeObject(obj) {
  return Object.entries(obj)
    .filter(([, v]) => v != null && String(v).trim() !== "")
    .map(([k, v]) => `${humanizeKey(k)} ${formatScalar(v)}`)
    .join(" · ");
}

/**
 * siteDetails' shape isn't fixed on the builder side yet — normalize whatever
 * comes in (string / array / plain object, arbitrarily nested) into something
 * renderable, or null when there's nothing to show. Each entry is tagged
 * "simple" (short scalar — fits a compact grid cell) or "complex" (a nested
 * object/array — rendered on its own full-width row instead of squeezed into
 * one, which is what was overlapping and unreadable before).
 */
function normalizeSiteDetails(details) {
  if (details == null) return null;
  if (typeof details === "string") {
    const s = details.trim();
    return s ? { kind: "text", value: s } : null;
  }
  if (Array.isArray(details)) {
    const items = details.filter((v) => v != null && String(v).trim());
    return items.length ? { kind: "list", value: items } : null;
  }
  if (typeof details === "object") {
    const entries = Object.entries(details)
      .filter(([, v]) => v != null && String(v).trim() !== "")
      .map(([key, v]) => {
        if (Array.isArray(v)) {
          const rows = v.every(isPlainValue)
            ? [v.map(formatScalar).join(", ")]
            : v.map((item) => (isPlainValue(item) ? formatScalar(item) : summarizeObject(item)));
          return { key, kind: "complex", rows };
        }
        if (typeof v === "object") {
          return { key, kind: "complex", rows: [summarizeObject(v)] };
        }
        return { key, kind: "simple", text: formatScalar(v) };
      });
    return entries.length ? { kind: "entries", value: entries } : null;
  }
  return { kind: "text", value: String(details) };
}

function Chip({ children, tone = "neutral" }) {
  const styles = {
    blue:    { background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE" },
    green:   { background: "#F0FDF4", color: "#166534", border: "1px solid #86EFAC" },
    amber:   { background: "#FEF3C7", color: "#92400E", border: "1px solid #FCD34D" },
    slate:   { background: "#F8FAFC", color: "#64748B", border: "1px solid #E2E8F0" },
    brand:   { background: "#EFF6FF", color: ACCENT, border: "1px solid #BFDBFE" },
    neutral: { background: "#F8FAFC", color: "#64748B", border: "1px solid #E2E8F0" },
  };
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, borderRadius: 20, padding: "3px 10px",
      display: "inline-flex", alignItems: "center", gap: 4, ...styles[tone],
    }}>
      {children}
    </span>
  );
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
 * @param {Array} props.projects - full project list (already plan-capped if Basic)
 * @param {Array} [props.quotations] - shop quotations (to mark already quoted)
 * @param {function} props.onQuote - (project) => void
 * @param {boolean} [props.loading]
 * @param {number|null} [props.quotaUsed]
 * @param {number|null} [props.quotaLimit] - null = unlimited
 * @param {string} [props.planLabel]
 * @param {function} [props.onUpgrade]
 * @param {boolean} [props.showUpgradeBanner]
 */
export default function ShopProjectsPanel({
  projects = [],
  quotations = [],
  onQuote,
  loading = false,
  quotaUsed = null,
  quotaLimit = null,
  planLabel = "",
  onUpgrade,
  showUpgradeBanner = false,
  estimateConfig = null,
  suppliedCategories = [],
}) {
  const hasCoverage = Array.isArray(suppliedCategories) && suppliedCategories.length > 0;
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [scopeFilter, setScopeFilter] = useState("all"); // projectScope value, e.g. "Structural"
  const [sortBy, setSortBy] = useState(hasCoverage ? "best_match" : "newest");
  const [scope, setScope] = useState("all"); // all | not_quoted | quoted
  const [expandedId, setExpandedId] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const quotedIds = useMemo(() => {
    const set = new Set();
    quotations.forEach((q) => {
      if (q.projectId) set.add(q.projectId);
    });
    return set;
  }, [quotations]);

  // This shop's quote state per project, matching submitQuotation's rules:
  // "won" (accepted — locked), "pending" (re-submitting revises it), or
  // "rejected" (may quote again). Won beats pending beats rejected.
  const myQuoteState = useMemo(() => {
    const rank = { won: 3, pending: 2, rejected: 1 };
    const map = new Map();
    quotations.forEach((q) => {
      if (!q.projectId) return;
      const s = String(q.status || "pending").toLowerCase();
      const state = s === "accepted" || s === "partially_accepted" ? "won" : s === "pending" ? "pending" : "rejected";
      const prev = map.get(q.projectId);
      if (!prev || rank[state] > rank[prev]) map.set(q.projectId, state);
    });
    return map;
  }, [quotations]);

  const types = useMemo(() => {
    const map = new Map();
    projects.forEach((p) => {
      const t = (p.projectType || "").trim();
      if (t) map.set(t, (map.get(t) || 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [projects]);

  // projectScope: "Cosmetic" | "Structural" | "Functional" on new posts, still
  // "Full Renovation" | "Extension" on older ones — both read fine here since
  // this just lists whatever distinct values actually show up in the data.
  const scopes = useMemo(() => {
    const map = new Map();
    projects.forEach((p) => {
      const s = (p.projectScope || "").trim();
      if (s) map.set(s, (map.get(s) || 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [projects]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = projects.filter((p) => {
      const already = quotedIds.has(p.id);
      if (scope === "quoted" && !already) return false;
      if (scope === "not_quoted" && already) return false;
      if (typeFilter !== "all" && (p.projectType || "") !== typeFilter) return false;
      if (scopeFilter !== "all" && (p.projectScope || "") !== scopeFilter) return false;
      if (!q) return true;
      const hay = [
        p.projectName,
        p.projectType,
        p.projectScope,
        p.locationCity,
        p.budget,
        ...(p.materials || []).map((m) => m.name || m),
      ].join(" ").toLowerCase();
      return hay.includes(q);
    });

    list = [...list].sort((a, b) => {
      if (sortBy === "best_match") {
        const fa = scoreProjectFit(a, suppliedCategories).coverage;
        const fb = scoreProjectFit(b, suppliedCategories).coverage;
        if (fb !== fa) return fb - fa;
        const ta0 = toDate(a.postedAt || a.createdAt)?.getTime() || 0;
        const tb0 = toDate(b.postedAt || b.createdAt)?.getTime() || 0;
        return tb0 - ta0;
      }
      if (sortBy === "name") {
        return (a.projectName || "").localeCompare(b.projectName || "");
      }
      if (sortBy === "bids") {
        return (b.quotationCount || 0) - (a.quotationCount || 0);
      }
      if (sortBy === "materials") {
        return (b.materials?.length || 0) - (a.materials?.length || 0);
      }
      // newest / oldest
      const ta = toDate(a.postedAt || a.createdAt)?.getTime() || 0;
      const tb = toDate(b.postedAt || b.createdAt)?.getTime() || 0;
      return sortBy === "oldest" ? ta - tb : tb - ta;
    });

    return list;
  }, [projects, search, typeFilter, scopeFilter, sortBy, scope, quotedIds, suppliedCategories]);

  // Reset to first page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, typeFilter, scopeFilter, sortBy, scope, projects.length]);

  const { slice: pageItems, page: safePage, total: filteredTotal } = useMemo(
    () => paginate(filtered, page, pageSize),
    [filtered, page, pageSize]
  );

  const quotaBlocked = quotaLimit != null && quotaUsed != null && quotaUsed >= quotaLimit;
  const unquotedCount = projects.filter((p) => !quotedIds.has(p.id)).length;

  const clearFilters = () => {
    setSearch("");
    setTypeFilter("all");
    setScopeFilter("all");
    setSortBy("newest");
    setScope("all");
  };

  const hasActiveFilters =
    search || typeFilter !== "all" || scopeFilter !== "all" || sortBy !== "newest" || scope !== "all";

  return (
    <div>
      {/* Header */}
      <div style={{
        display: "flex", flexWrap: "wrap", alignItems: "flex-start",
        justifyContent: "space-between", gap: 12, marginBottom: 16,
      }}>
        <div>
          <h2 style={{
            fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 700,
            color: "#0F172A", margin: "0 0 4px",
          }}>
            Posted Projects
          </h2>
          <p style={{ fontSize: 12, color: "#64748B", margin: 0, lineHeight: 1.5 }}>
            Projects posted by builders. Submit a quotation to bid.
            {planLabel ? (
              <span style={{ color: "#D97706", fontWeight: 600 }}> · {planLabel}</span>
            ) : null}
          </p>
        </div>

        <div style={{
          display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center",
          position: "relative",
        }}>
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
              placeholder="Search name, type, materials…"
              style={{
                width: 240, maxWidth: "100%", padding: "9px 32px 9px 32px",
                borderRadius: 8, border: "1.5px solid #E2E8F0", fontSize: 13,
                outline: "none", fontFamily: "inherit",
              }}
              onFocus={(e) => { e.target.style.borderColor = ACCENT; }}
              onBlur={(e) => { e.target.style.borderColor = "#E2E8F0"; }}
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
                aria-label="Clear search"
              >
                <TbX size={14} />
              </button>
            ) : null}
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={selectStyle(sortBy !== "newest")}
            title="Sort projects"
          >
            {hasCoverage && <option value="best_match">Best match</option>}
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="bids">Most bids</option>
            <option value="materials">Most materials</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>
      </div>

      {/* Summary pills */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12, alignItems: "center",
      }}>
        {[
          { id: "all", label: `All (${projects.length})` },
          { id: "not_quoted", label: `Not quoted yet (${unquotedCount})` },
          { id: "quoted", label: `You quoted (${quotedIds.size})` },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setScope(tab.id)}
            style={{
              ...selectStyle(scope === tab.id),
              borderRadius: 20,
              padding: "6px 14px",
            }}
          >
            {tab.label}
          </button>
        ))}
        {quotaLimit != null && (
          <Chip tone={quotaBlocked ? "amber" : "blue"}>
            Quota {quotaUsed ?? 0}/{quotaLimit} this month
          </Chip>
        )}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            style={{
              ...selectStyle(false),
              display: "inline-flex", alignItems: "center", gap: 4,
              color: "#64748B",
            }}
          >
            <TbRefresh size={14} /> Reset
          </button>
        )}
      </div>

      {/* Type chips */}
      {types.length > 0 && (
        <div style={{
          display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16, alignItems: "center",
        }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8" }}>Type:</span>
          <button
            type="button"
            onClick={() => setTypeFilter("all")}
            style={{
              ...selectStyle(typeFilter === "all"),
              borderRadius: 20, padding: "4px 12px", fontSize: 11,
            }}
          >
            All
          </button>
          {types.slice(0, 8).map(([type, count]) => (
            <button
              key={type}
              type="button"
              onClick={() => setTypeFilter(typeFilter === type ? "all" : type)}
              style={{
                ...selectStyle(typeFilter === type),
                borderRadius: 20, padding: "4px 12px", fontSize: 11,
              }}
            >
              {type} ({count})
            </button>
          ))}
        </div>
      )}

      {/* Scope chips */}
      {scopes.length > 0 && (
        <div style={{
          display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16, alignItems: "center",
        }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8" }}>Scope:</span>
          <button
            type="button"
            onClick={() => setScopeFilter("all")}
            style={{
              ...selectStyle(scopeFilter === "all"),
              borderRadius: 20, padding: "4px 12px", fontSize: 11,
            }}
          >
            All
          </button>
          {scopes.slice(0, 8).map(([sc, count]) => (
            <button
              key={sc}
              type="button"
              onClick={() => setScopeFilter(scopeFilter === sc ? "all" : sc)}
              style={{
                ...selectStyle(scopeFilter === sc),
                borderRadius: 20, padding: "4px 12px", fontSize: 11,
              }}
            >
              {sc} ({count})
            </button>
          ))}
        </div>
      )}

      <div style={{ fontSize: 12, color: "#94A3B8", marginBottom: 12 }}>
        Showing <strong style={{ color: "#334155" }}>{filteredTotal}</strong> of {projects.length} projects
        {filteredTotal > pageSize ? " (paged)" : ""}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: "#94A3B8", fontSize: 13 }}>
          Loading projects…
        </div>
      ) : filteredTotal === 0 ? (
        <div style={{
          background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0",
          textAlign: "center", padding: "48px 24px",
        }}>
          <TbClipboardList size={36} color="#CBD5E1" style={{ marginBottom: 8 }} />
          <div style={{ fontWeight: 600, color: "#0F172A", marginBottom: 4 }}>
            {hasActiveFilters ? "No projects match your filters" : "No projects available"}
          </div>
          <div style={{ fontSize: 12, color: "#94A3B8", marginBottom: 12 }}>
            {hasActiveFilters
              ? "Try another search or clear filters."
              : "When builders post projects in the app, they will show up here."}
          </div>
          {hasActiveFilters && (
            <button type="button" onClick={clearFilters} style={{ ...selectStyle(true), borderRadius: 8 }}>
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {pageItems.map((p) => {
            const already = quotedIds.has(p.id);
            const open = expandedId === p.id;
            const date = formatDateTime(p.postedAt || p.createdAt, null);
            const materials = p.materials || [];
            const siteDetails = normalizeSiteDetails(p.siteDetails);
            const baseline = estimateConfig ? estimateProjectBaseline(p, estimateConfig) : null;
            const fit = hasCoverage ? scoreProjectFit(p, suppliedCategories) : null;
            const fitMeta = fit && fit.fit !== "unknown" ? FIT_META[fit.fit] : null;

            return (
              <div
                key={p.id}
                style={{
                  background: "#fff",
                  borderRadius: 14,
                  border: `1px solid ${already ? "#BFDBFE" : "#E2E8F0"}`,
                  overflow: "hidden",
                  transition: "box-shadow 0.15s",
                }}
              >
                <div style={{
                  padding: "16px 18px",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 14,
                  alignItems: "flex-start",
                }}>
                  <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                    <div style={{
                      display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 4,
                    }}>
                      <div style={{
                        fontSize: 14, fontWeight: 700, color: "#0F172A",
                      }}>
                        {p.projectName || "Project"}
                      </div>
                      {already && (
                        <Chip tone="brand">
                          <TbCheck size={12} /> You quoted
                        </Chip>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748B", marginBottom: 8 }}>
                      {p.projectType || "General"}
                      {date ? ` · Posted ${date}` : ""}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {fitMeta && (
                        <Chip tone={fitMeta.tone}>
                          <TbCheck size={11} /> {fitMeta.label}
                          {fit.matched > 0 ? ` · ${fit.matched}/${fit.total}` : ""}
                        </Chip>
                      )}
                      {p.projectScope && (
                        <Chip tone="slate">Scope: {p.projectScope}</Chip>
                      )}
                      {p.totalAreaSqm != null && (
                        <Chip tone="blue"><TbRuler2 size={11} /> {p.totalAreaSqm} sqm</Chip>
                      )}
                      {baseline && (
                        <Chip tone="brand" title="DPWH planning estimate (materials only)">
                          DPWH est. {peso0(baseline.materialsTotal)}
                        </Chip>
                      )}
                      {p.budget && (
                        <Chip tone="green"><TbCurrencyDollar size={11} /> {p.budget}</Chip>
                      )}
                      {p.quotationCount != null && (
                        <Chip tone="amber">
                          <TbTag size={11} /> {p.quotationCount} bid{p.quotationCount !== 1 ? "s" : ""}
                        </Chip>
                      )}
                      {p.locationCity && (
                        <Chip tone="slate"><TbMapPin size={11} /> {p.locationCity}</Chip>
                      )}
                      {materials.length > 0 && (
                        <Chip tone="neutral">{materials.length} materials</Chip>
                      )}
                    </div>
                  </div>

                  <div style={{
                    display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center",
                    flexShrink: 0,
                  }}>
                    {(materials.length > 0 || siteDetails) && (
                      <button
                        type="button"
                        onClick={() => setExpandedId(open ? null : p.id)}
                        style={{
                          ...selectStyle(open),
                          display: "inline-flex", alignItems: "center", gap: 4,
                        }}
                      >
                        Details
                        <TbChevronDown
                          size={14}
                          style={{
                            transition: "transform 0.15s",
                            transform: open ? "rotate(180deg)" : "none",
                          }}
                        />
                      </button>
                    )}
                    {(() => {
                      const mine = myQuoteState.get(p.id);
                      // Revising a pending quote doesn't use the monthly quota.
                      const locked = mine === "won" || (quotaBlocked && mine !== "pending");
                      const label =
                        mine === "won" ? "Quote accepted"
                        : mine === "pending" ? "Update my quote"
                        : quotaBlocked ? "Quota reached"
                        : mine === "rejected" ? "Quote again"
                        : "Submit quote";
                      const title =
                        mine === "won" ? "The builder accepted your quote — manage it from Quotations"
                        : mine === "pending" ? "Replace your current quote with an updated one"
                        : quotaBlocked ? "Monthly quotation quota reached"
                        : mine === "rejected" ? "Your last quote wasn't accepted — you can send a new one"
                        : "Submit a quotation";
                      return (
                        <button
                          type="button"
                          disabled={locked}
                          onClick={() => !locked && onQuote?.(p)}
                          title={title}
                          style={{
                            padding: "10px 18px",
                            borderRadius: 8,
                            border: "none",
                            background: locked
                              ? (mine === "won" ? "#D1FAE5" : "#E2E8F0")
                              : `linear-gradient(135deg,${ACCENT},#3B82F6)`,
                            color: locked ? (mine === "won" ? "#065F46" : "#94A3B8") : "#fff",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: locked ? "not-allowed" : "pointer",
                            fontFamily: "inherit",
                          }}
                        >
                          {label}
                        </button>
                      );
                    })()}
                  </div>
                </div>

                {open && (materials.length > 0 || baseline || siteDetails) && (
                  <div style={{
                    borderTop: "1px solid #F1F5F9",
                    background: "#FAFBFC",
                    padding: "14px 18px 16px",
                  }}>
                    {siteDetails && (
                      <div style={{
                        marginBottom: (materials.length > 0 || baseline) ? 16 : 0,
                        padding: "10px 12px", borderRadius: 10,
                        background: "#fff", border: "1px solid #E2E8F0",
                      }}>
                        <div style={{
                          fontSize: 10, fontWeight: 700, color: "#94A3B8",
                          letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8,
                        }}>
                          Site details
                        </div>
                        {siteDetails.kind === "text" && (
                          <p style={{ fontSize: 12.5, color: "#334155", lineHeight: 1.6, margin: 0 }}>
                            {siteDetails.value}
                          </p>
                        )}
                        {siteDetails.kind === "list" && (
                          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "#334155", lineHeight: 1.7 }}>
                            {siteDetails.value.map((item, i) => (
                              <li key={i}>{String(item)}</li>
                            ))}
                          </ul>
                        )}
                        {siteDetails.kind === "entries" && (
                          <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                            gap: "6px 16px",
                          }}>
                            {siteDetails.value.map((entry) => (
                              <div
                                key={entry.key}
                                style={{
                                  fontSize: 12, color: "#334155", lineHeight: 1.6,
                                  wordBreak: "break-word",
                                  gridColumn: entry.kind === "complex" ? "1 / -1" : "auto",
                                }}
                              >
                                <span style={{ color: "#94A3B8" }}>{humanizeKey(entry.key)}: </span>
                                {entry.kind === "simple" ? (
                                  <strong>{entry.text}</strong>
                                ) : entry.rows.length > 1 ? (
                                  <ul style={{ margin: "2px 0 0", paddingLeft: 18 }}>
                                    {entry.rows.map((row, i) => <li key={i}>{row}</li>)}
                                  </ul>
                                ) : (
                                  <strong>{entry.rows[0] || "—"}</strong>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {baseline && (
                      <div style={{
                        marginBottom: materials.length > 0 ? 16 : 0,
                        padding: "10px 12px", borderRadius: 10,
                        background: "#EFF6FF", border: "1px solid #BFDBFE",
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#1D4ED8", marginBottom: 6 }}>
                          DPWH planning estimate · {baseline.areaSqm} m²
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", fontSize: 11.5, color: "#334155" }}>
                          {baseline.perMaterial.map((mat) => (
                            <span key={mat.key}>{mat.label}: <strong>{peso0(mat.cost)}</strong></span>
                          ))}
                        </div>
                        <div style={{ fontSize: 11.5, color: "#1E40AF", marginTop: 6 }}>
                          Materials {peso0(baseline.materialsTotal)} · with labor {peso0(baseline.grandTotal)} —
                          reference only, your quote is the real price.
                        </div>
                      </div>
                    )}
                    {materials.length > 0 && (
                      <>
                        <div style={{
                          fontSize: 10, fontWeight: 700, color: "#94A3B8",
                          letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10,
                        }}>
                          Materials needed
                        </div>
                        <div style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                          gap: 8,
                        }}>
                          {materials.map((m, i) => (
                            <div
                              key={i}
                              style={{
                                background: "#fff",
                                border: "1px solid #E2E8F0",
                                borderRadius: 10,
                                padding: "10px 12px",
                              }}
                            >
                              <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>
                                {m.name || "Material"}
                              </div>
                              <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                                {[m.category, m.quantity != null ? `${m.quantity} ${m.unit || ""}`.trim() : null, m.size]
                                  .filter(Boolean)
                                  .join(" · ") || "—"}
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
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

      {showUpgradeBanner && onUpgrade && (
        <div style={{
          marginTop: 20,
          padding: "16px 18px",
          borderRadius: 12,
          border: "1.5px dashed #CBD5E1",
          textAlign: "center",
          background: "#F8FAFC",
        }}>
          <div style={{ fontSize: 13, color: "#64748B", marginBottom: 8 }}>
            Basic shows a limited set of projects.
          </div>
          <button
            type="button"
            onClick={onUpgrade}
            style={{
              border: "none", background: "none", color: ACCENT,
              fontWeight: 600, fontSize: 13, cursor: "pointer",
            }}
          >
            Upgrade to see more projects →
          </button>
        </div>
      )}
    </div>
  );
}
