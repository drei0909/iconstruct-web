// Shared Projects list for Basic / Pro / Business dashboards
import { useEffect, useMemo, useState } from "react";
import {
  TbClipboardList, TbMapPin, TbRuler2, TbCurrencyDollar, TbTag,
  TbChevronDown, TbSearch, TbX, TbCheck, TbRefresh,
} from "react-icons/tb";
import ListPagination, { paginate } from "../ui/ListPagination";

const ACCENT = "#2C5282";
const DEFAULT_PAGE_SIZE = 8;

function toDate(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === "function") return ts.toDate();
  if (typeof ts.seconds === "number") return new Date(ts.seconds * 1000);
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDate(ts) {
  const d = toDate(ts);
  if (!d) return null;
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
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
}) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
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

  const types = useMemo(() => {
    const map = new Map();
    projects.forEach((p) => {
      const t = (p.projectType || "").trim();
      if (t) map.set(t, (map.get(t) || 0) + 1);
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
      if (!q) return true;
      const hay = [
        p.projectName,
        p.projectType,
        p.locationCity,
        p.budget,
        ...(p.materials || []).map((m) => m.name || m),
      ].join(" ").toLowerCase();
      return hay.includes(q);
    });

    list = [...list].sort((a, b) => {
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
  }, [projects, search, typeFilter, sortBy, scope, quotedIds]);

  // Reset to first page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, typeFilter, sortBy, scope, projects.length]);

  const { slice: pageItems, page: safePage, total: filteredTotal } = useMemo(
    () => paginate(filtered, page, pageSize),
    [filtered, page, pageSize]
  );

  const quotaBlocked = quotaLimit != null && quotaUsed != null && quotaUsed >= quotaLimit;
  const unquotedCount = projects.filter((p) => !quotedIds.has(p.id)).length;

  const clearFilters = () => {
    setSearch("");
    setTypeFilter("all");
    setSortBy("newest");
    setScope("all");
  };

  const hasActiveFilters =
    search || typeFilter !== "all" || sortBy !== "newest" || scope !== "all";

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
            const date = formatDate(p.postedAt || p.createdAt);
            const materials = p.materials || [];

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
                      {p.totalAreaSqm != null && (
                        <Chip tone="blue"><TbRuler2 size={11} /> {p.totalAreaSqm} sqm</Chip>
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
                    {materials.length > 0 && (
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
                    <button
                      type="button"
                      disabled={quotaBlocked}
                      onClick={() => !quotaBlocked && onQuote?.(p)}
                      title={
                        quotaBlocked
                          ? "Monthly quotation quota reached"
                          : already
                            ? "Submit another quote for this project"
                            : "Submit a quotation"
                      }
                      style={{
                        padding: "10px 18px",
                        borderRadius: 8,
                        border: "none",
                        background: quotaBlocked ? "#E2E8F0" : `linear-gradient(135deg,${ACCENT},#3B82F6)`,
                        color: quotaBlocked ? "#94A3B8" : "#fff",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: quotaBlocked ? "not-allowed" : "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      {quotaBlocked ? "Quota reached" : already ? "Quote again" : "Submit quote"}
                    </button>
                  </div>
                </div>

                {open && materials.length > 0 && (
                  <div style={{
                    borderTop: "1px solid #F1F5F9",
                    background: "#FAFBFC",
                    padding: "14px 18px 16px",
                  }}>
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
