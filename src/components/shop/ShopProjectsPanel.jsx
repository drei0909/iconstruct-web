import { useEffect, useMemo, useState } from "react";
import {
  TbClipboardList, TbMapPin, TbRuler2, TbCurrencyDollar, TbTag,
  TbChevronDown, TbSearch, TbX, TbCheck, TbRefresh,
  TbCalendarTime, TbClock, TbAlertCircle, TbLock, TbSparkles, TbPackage, TbCircleFilled,
} from "react-icons/tb";
import ListPagination, { paginate } from "../ui/ListPagination";
import { estimateProjectBaseline } from "../../utils/recommendationEngine";
import { scoreProjectFit } from "../../utils/supplyCategories";
import { toDate, formatDateTime } from "../../utils/dateTime";
import { getBiddingSchedule, evaluateQuotationAction } from "../../utils/biddingSchedule";
import { computeProjectMaterialMatch, findBestMatch } from "../../utils/materialsMatcher";
import { watchMaterials } from "../../controllers/materialsController";
import MaterialPhoto from "../ui/MaterialPhoto";

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
  shopMaterials: initialShopMaterials = null,
}) {
  const hasCoverage = Array.isArray(suppliedCategories) && suppliedCategories.length > 0;
  const [shopMaterials, setShopMaterials] = useState(initialShopMaterials || []);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [scopeFilter, setScopeFilter] = useState("all"); // projectScope value, e.g. "Structural"
  const [sortBy, setSortBy] = useState(hasCoverage ? "best_match" : "newest");
  const [scope, setScope] = useState("all"); // all | not_quoted | quoted
  const [scheduleFilter, setScheduleFilter] = useState("all"); // all | open | scheduled | closed
  const [expandedId, setExpandedId] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [nowMs, setNowMs] = useState(Date.now());

  // Subscribe to live shop uploaded materials inventory for instant match percentages
  useEffect(() => {
    if (initialShopMaterials && initialShopMaterials.length > 0) {
      setShopMaterials(initialShopMaterials);
      return;
    }
    const unsub = watchMaterials((mats) => setShopMaterials(mats || []));
    return () => unsub?.();
  }, [initialShopMaterials]);

  // Keep countdowns & schedule status fresh every 15 seconds
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  // Map each project ID to the shop's authoritative quotation document & status
  const quotationsByProjectId = useMemo(() => {
    const map = new Map();
    quotations.forEach((q) => {
      if (!q.projectId) return;
      const pid = String(q.projectId);
      const s = String(q.status || "pending").toLowerCase();
      const state = s === "accepted" || s === "partially_accepted" ? "won" : s === "pending" ? "pending" : "rejected";
      const rank = state === "won" ? 3 : state === "pending" ? 2 : 1;
      const prev = map.get(pid);
      if (!prev || rank > prev._rank) {
        map.set(pid, { ...q, _rank: rank, _state: state });
      }
    });
    return map;
  }, [quotations]);

  const quotedIds = useMemo(() => {
    return new Set(quotationsByProjectId.keys());
  }, [quotationsByProjectId]);

  const myQuoteState = useMemo(() => {
    const map = new Map();
    quotationsByProjectId.forEach((q, pid) => {
      map.set(pid, q._state);
    });
    return map;
  }, [quotationsByProjectId]);

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
      const pid = String(p.id);
      const already = quotedIds.has(pid);
      const myQuote = quotationsByProjectId.get(pid);
      const sched = getBiddingSchedule(p, nowMs);
      const isCompleted = sched.isCompleted || p.isCompleted || myQuote?._state === "won";

      if (scope === "quoted" && !already) return false;
      if (scope === "not_quoted" && (already || isCompleted)) return false;
      if (scope === "completed" && !isCompleted) return false;
      if (typeFilter !== "all" && (p.projectType || "") !== typeFilter) return false;
      if (scopeFilter !== "all" && (p.projectScope || "") !== scopeFilter) return false;

      // Filter by bidding schedule status
      if (scheduleFilter !== "all") {
        if (scheduleFilter === "completed") {
          if (!isCompleted) return false;
        } else if (scheduleFilter === "closed") {
          if (!sched.isClosed || isCompleted) return false;
        } else if (sched.status !== scheduleFilter) {
          return false;
        }
      }

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
      if (sortBy === "highest_match") {
        const ma = computeProjectMaterialMatch(a.materials, shopMaterials).percentage;
        const mb = computeProjectMaterialMatch(b.materials, shopMaterials).percentage;
        if (mb !== ma) return mb - ma;
        const ta0 = toDate(a.postedAt || a.createdAt)?.getTime() || 0;
        const tb0 = toDate(b.postedAt || b.createdAt)?.getTime() || 0;
        return tb0 - ta0;
      }
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
  }, [projects, search, typeFilter, scopeFilter, scheduleFilter, sortBy, scope, quotedIds, quotationsByProjectId, suppliedCategories, shopMaterials, nowMs]);

  // Reset to first page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, typeFilter, scopeFilter, scheduleFilter, sortBy, scope, projects.length]);

  const { slice: pageItems, page: safePage, total: filteredTotal } = useMemo(
    () => paginate(filtered, page, pageSize),
    [filtered, page, pageSize]
  );

  const quotaBlocked = quotaLimit != null && quotaUsed != null && quotaUsed >= quotaLimit;

  // Accurately compute counts matching the actual projects list
  const completedCount = useMemo(() => {
    return projects.filter((p) => {
      const q = quotationsByProjectId.get(String(p.id));
      const sched = getBiddingSchedule(p, nowMs);
      return sched.isCompleted || p.isCompleted || q?._state === "won";
    }).length;
  }, [projects, quotationsByProjectId, nowMs]);

  const completedProjectsWonCount = useMemo(() => {
    return projects.filter((p) => {
      const q = quotationsByProjectId.get(String(p.id));
      return q?._state === "won";
    }).length;
  }, [projects, quotationsByProjectId]);

  const quotedCount = useMemo(() => {
    return projects.filter((p) => quotedIds.has(String(p.id))).length;
  }, [projects, quotedIds]);

  const unquotedCount = useMemo(() => {
    return projects.filter((p) => {
      const sched = getBiddingSchedule(p, nowMs);
      return !quotedIds.has(String(p.id)) && !sched.isCompleted && !p.isCompleted;
    }).length;
  }, [projects, quotedIds, nowMs]);

  const clearFilters = () => {
    setSearch("");
    setTypeFilter("all");
    setScopeFilter("all");
    setSortBy("newest");
    setScope("all");
    setScheduleFilter("all");
  };

  const hasActiveFilters =
    search ||
    typeFilter !== "all" ||
    scopeFilter !== "all" ||
    scheduleFilter !== "all" ||
    sortBy !== "newest" ||
    scope !== "all";

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
            <option value="highest_match">Highest material match (%)</option>
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
          { id: "quoted", label: `You quoted (${quotedCount})` },
          { id: "completed", label: `Completed (${completedCount})` },
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

        {/* Schedule Filter Buttons */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginLeft: 4 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>Schedule:</span>
          {[
            { id: "all", label: "All" },
            { id: "open", label: "Open Now", icon: TbCircleFilled, iconColor: "#16A34A" },
            { id: "scheduled", label: "Scheduled", icon: TbCalendarTime, iconColor: "#D97706" },
            { id: "closed", label: "Closed", icon: TbLock, iconColor: "#DC2626" },
            { id: "completed", label: "Completed", icon: TbCheck, iconColor: "#059669" },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setScheduleFilter(tab.id)}
                style={{
                  ...selectStyle(scheduleFilter === tab.id),
                  borderRadius: 20,
                  padding: "4px 11px",
                  fontSize: 11,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                {Icon && <Icon size={11} color={tab.iconColor} />}
                {tab.label}
              </button>
            );
          })}
        </div>
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

      {(scope === "completed" || scheduleFilter === "completed") && (
        <div style={{
          marginBottom: 16,
          padding: "12px 18px",
          borderRadius: 12,
          background: "#ECFDF5",
          border: "1px solid #A7F3D0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
          fontSize: 12.5,
          color: "#065F46",
        }}>
          <div>
            <strong style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <TbCheck size={15} /> Completed Projects Section:
            </strong> Displaying {completedCount} project{completedCount !== 1 ? "s" : ""} where a builder accepted a quotation and marked the project as completed.
          </div>
          <div style={{ fontWeight: 800 }}>
            {completedProjectsWonCount} Deal{completedProjectsWonCount !== 1 ? "s" : ""} Won by Your Shop
          </div>
        </div>
      )}

      <div style={{ fontSize: 12, color: "#94A3B8", marginBottom: 12 }}>
        Showing <strong style={{ color: "#334155" }}>{filteredTotal}</strong>
        {scope === "completed" || scheduleFilter === "completed" ? " completed" : ""} of {projects.length} projects
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
            const pid = String(p.id);
            const myQuote = quotationsByProjectId.get(pid);
            const already = Boolean(myQuote);
            const open = expandedId === p.id;
            const date = formatDateTime(p.postedAt || p.createdAt, null);
            const materials = p.materials || [];
            const siteDetails = normalizeSiteDetails(p.siteDetails);
            const baseline = estimateConfig ? estimateProjectBaseline(p, estimateConfig) : null;
            const fit = hasCoverage ? scoreProjectFit(p, suppliedCategories) : null;
            const fitMeta = fit && fit.fit !== "unknown" ? FIT_META[fit.fit] : null;

            // Authoritative Bidding Schedule & Action
            const schedule = getBiddingSchedule(p, nowMs);
            const myState = myQuote?._state || null;
            const action = evaluateQuotationAction(p, myState, quotaBlocked, nowMs);

            // Compute exact store inventory absorption and matching percentage
            const matMatch = computeProjectMaterialMatch(materials, shopMaterials);

            return (
              <div
                key={p.id}
                style={{
                  background: "#fff",
                  borderRadius: 14,
                  border: `1.5px solid ${
                    schedule.isCompleted
                      ? (myState === "won" ? "#86EFAC" : "#CBD5E1")
                      : schedule.isOpen
                      ? (already ? "#93C5FD" : "#CBD5E1")
                      : schedule.isScheduled
                      ? "#FDE68A"
                      : "#E2E8F0"
                  }`,
                  overflow: "hidden",
                  transition: "box-shadow 0.15s",
                  boxShadow: schedule.isOpen ? "0 2px 8px rgba(0,0,0,0.03)" : "none",
                }}
              >
                <div style={{
                  padding: "16px 18px",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 14,
                  alignItems: "flex-start",
                }}>
                  <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                    <div style={{
                      display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 4,
                    }}>
                      <div style={{
                        fontSize: 14, fontWeight: 700, color: "#0F172A",
                      }}>
                        {p.projectName || "Project"}
                      </div>

                      {/* Bidding & Completion Status Badge */}
                      {schedule.isCompleted ? (
                        <span style={{
                          fontSize: 11, fontWeight: 800, borderRadius: 20, padding: "3px 11px",
                          display: "inline-flex", alignItems: "center", gap: 5,
                          background: myState === "won" ? "#DCFCE7" : "#F1F5F9",
                          color: myState === "won" ? "#166534" : "#475569",
                          border: `1.5px solid ${myState === "won" ? "#86EFAC" : "#CBD5E1"}`,
                        }}>
                          <TbCheck size={13} color={myState === "won" ? "#16A34A" : "#64748B"} />
                          {myState === "won" ? "Completed · Deal Won by Your Shop" : "Completed · Accepted by Builder"}
                        </span>
                      ) : schedule.isOpen ? (
                        <span style={{
                          fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "3px 10px",
                          display: "inline-flex", alignItems: "center", gap: 5,
                          background: "#F0FDF4", color: "#166534", border: "1px solid #86EFAC",
                        }}>
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22C55E", display: "inline-block" }} />
                          Bidding Open{schedule.remainingFormatted ? ` · ${schedule.remainingFormatted}` : ""}
                        </span>
                      ) : schedule.isScheduled ? (
                        <span style={{
                          fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "3px 10px",
                          display: "inline-flex", alignItems: "center", gap: 5,
                          background: "#FEF3C7", color: "#92400E", border: "1px solid #FCD34D",
                        }}>
                          <TbCalendarTime size={13} />
                          Bidding Scheduled · Opens {schedule.openDateOnly}
                        </span>
                      ) : (
                        <span style={{
                          fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "3px 10px",
                          display: "inline-flex", alignItems: "center", gap: 5,
                          background: "#F1F5F9", color: "#64748B", border: "1px solid #CBD5E1",
                        }}>
                          <TbLock size={12} />
                          Bidding Closed {schedule.closesAt ? `· Ended ${schedule.closeDateOnly}` : ""}
                        </span>
                      )}

                      {/* Prominent Store Material Absorption & Match Percentage Badge */}
                      {matMatch.total > 0 && shopMaterials.length > 0 && (
                        matMatch.isFullMatch ? (
                          <span
                            title="100% store match! All requested materials are in your store inventory and ready to bid."
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              borderRadius: 20,
                              padding: "3px 11px",
                              background: "linear-gradient(135deg, #059669, #10B981)",
                              color: "#fff",
                              boxShadow: "0 2px 6px rgba(16, 185, 129, 0.35)",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              letterSpacing: "0.2px",
                            }}
                          >
                            <TbSparkles size={13} />
                            100% Match ({matMatch.matched}/{matMatch.total} in store)
                          </span>
                        ) : matMatch.hasMatches ? (
                          <span
                            title={`${matMatch.matched} of ${matMatch.total} requested materials are available in your store inventory`}
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              borderRadius: 20,
                              padding: "3px 10px",
                              background: matMatch.percentage >= 50 ? "#EFF6FF" : "#FFFBEB",
                              color: matMatch.percentage >= 50 ? "#1D4ED8" : "#B45309",
                              border: `1.5px solid ${matMatch.percentage >= 50 ? "#93C5FD" : "#FCD34D"}`,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                            }}
                          >
                            <TbSparkles size={13} color={matMatch.percentage >= 50 ? "#2563EB" : "#D97706"} />
                            {matMatch.percentage}% Match ({matMatch.matched}/{matMatch.total} in store)
                          </span>
                        ) : (
                          <span
                            title={`None of the ${matMatch.total} requested materials are currently in your store inventory`}
                            style={{
                              fontSize: 10.5,
                              fontWeight: 600,
                              borderRadius: 20,
                              padding: "2px 8px",
                              background: "#F8FAFC",
                              color: "#94A3B8",
                              border: "1px solid #E2E8F0",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            0% Match (0/{matMatch.total} in store)
                          </span>
                        )
                      )}

                      {/* Quoted Status Label */}
                      {already && myQuote && (
                        myState === "won" ? (
                          <span
                            title={`Builder accepted your quotation of ₱${Number(myQuote.acceptedTotal || myQuote.amount || 0).toLocaleString()}!`}
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              borderRadius: 20,
                              padding: "3px 11px",
                              background: "linear-gradient(135deg, #059669, #10B981)",
                              color: "#fff",
                              boxShadow: "0 2px 6px rgba(16, 185, 129, 0.35)",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                            }}
                          >
                            <TbCheck size={13} />
                            Quote Accepted · ₱{Number(myQuote.acceptedTotal || myQuote.amount || 0).toLocaleString()}
                          </span>
                        ) : myState === "pending" ? (
                          <span
                            title={`Your quotation of ₱${Number(myQuote.amount || 0).toLocaleString()} is pending builder review.`}
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              borderRadius: 20,
                              padding: "3px 10px",
                              background: "#EFF6FF",
                              color: "#1D4ED8",
                              border: "1.5px solid #93C5FD",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                            }}
                          >
                            <TbCheck size={13} color="#2563EB" />
                            You quoted · ₱{Number(myQuote.amount || 0).toLocaleString()} (Pending)
                          </span>
                        ) : (
                          <span
                            title="Your previous quote was not selected by the builder."
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              borderRadius: 20,
                              padding: "3px 10px",
                              background: "#FEF2F2",
                              color: "#991B1B",
                              border: "1px solid #FECACA",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                            }}
                          >
                            <TbX size={12} />
                            Quote not selected
                          </span>
                        )
                      )}
                    </div>

                    <div style={{ fontSize: 12, color: "#64748B", marginBottom: 8 }}>
                      {p.projectType || "General Construction"}
                      {date ? ` · Posted ${date}` : ""}
                    </div>

                    {/* Schedule and project chips */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {/* Bidding timeline chip */}
                      <Chip tone={schedule.isCompleted ? (myState === "won" ? "green" : "slate") : schedule.isOpen ? (schedule.closesAt ? "green" : "slate") : schedule.isScheduled ? "amber" : "slate"}>
                        <TbClock size={11} />
                        {schedule.isCompleted ? (
                          <span>Completed{p.completedAt ? ` · ${formatDateTime(p.completedAt)}` : ""}</span>
                        ) : schedule.isOpen ? (
                          <span>Deadline: {schedule.closesAt ? schedule.closeFormatted : "N/A"}</span>
                        ) : schedule.isScheduled ? (
                          <span>Opens: {schedule.openFormatted}</span>
                        ) : (
                          <span>Closed: {schedule.closesAt ? schedule.closeFormatted : "N/A"}</span>
                        )}
                      </Chip>

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
                        <Chip tone={matMatch.isFullMatch ? "green" : matMatch.hasMatches ? "brand" : "neutral"}>
                          <TbPackage size={11} /> {materials.length} material{materials.length > 1 ? "s" : ""}
                          {shopMaterials.length > 0 && (
                            <span style={{ fontWeight: 700, marginLeft: 2 }}>
                              · {matMatch.percentage}% match ({matMatch.matched}/{matMatch.total})
                            </span>
                          )}
                        </Chip>
                      )}
                    </div>

                    {/* Homeowner Deadline Change Alert Banner */}
                    {schedule.deadlineChange && (
                      <div style={{
                        marginTop: 10,
                        background: "#FFFBEB",
                        border: "1px solid #FDE68A",
                        borderRadius: 8,
                        padding: "7px 11px",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 11.5,
                        color: "#92400E",
                      }}>
                        <TbAlertCircle size={15} color="#D97706" style={{ flexShrink: 0 }} />
                        <div>
                          <strong>Deadline Notice:</strong> Homeowner changed deadline to{" "}
                          <strong>{schedule.deadlineChange.newFormatted}</strong> (previously {schedule.deadlineChange.previousFormatted}).
                          {schedule.deadlineChange.reason && <span> Reason: <em>"{schedule.deadlineChange.reason}"</em></span>}
                          {schedule.deadlineChange.details && <div style={{ marginTop: 3, fontSize: 11, color: "#B45309" }}>Note: {schedule.deadlineChange.details}</div>}
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{
                    display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center",
                    flexShrink: 0,
                  }}>
                    {(materials.length > 0 || siteDetails || schedule) && (
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

                    {/* Action Button: Scheduled (disabled), Open (submit/update quote), Closed (disabled or view quote) */}
                    <button
                      type="button"
                      disabled={!action.canSubmit && !action.allowView}
                      onClick={() => {
                        if (action.canSubmit) {
                          onQuote?.(p);
                        } else if (action.allowView) {
                          setExpandedId(open ? null : p.id);
                        }
                      }}
                      title={action.buttonTitle}
                      style={{
                        padding: "10px 18px",
                        borderRadius: 8,
                        border: "none",
                        background: action.canSubmit
                          ? `linear-gradient(135deg,${ACCENT},#3B82F6)`
                          : action.allowView
                          ? "#EFF6FF"
                          : "#E2E8F0",
                        color: action.canSubmit
                          ? "#fff"
                          : action.allowView
                          ? "#1D4ED8"
                          : "#94A3B8",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: (action.canSubmit || action.allowView) ? "pointer" : "not-allowed",
                        fontFamily: "inherit",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      {action.buttonLabel}
                    </button>
                  </div>
                </div>

                {open && (
                  <div style={{
                    borderTop: "1px solid #F1F5F9",
                    background: "#FAFBFC",
                    padding: "14px 18px 16px",
                  }}>
                    {/* ── Bidding Schedule & Policy Section ── */}
                    <div style={{
                      marginBottom: 14,
                      padding: "12px 14px",
                      borderRadius: 10,
                      background: "#fff",
                      border: "1px solid #E2E8F0",
                    }}>
                      <div style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: "#1E3A8A",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        marginBottom: 8,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}>
                        <TbCalendarTime size={15} color="#2563EB" /> Bidding Period &amp; Schedule
                      </div>

                      <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                        gap: 8,
                        fontSize: 12,
                      }}>
                        <div style={{ background: "#F8FAFC", padding: "8px 10px", borderRadius: 7 }}>
                          <div style={{ fontSize: 9.5, color: "#64748B", textTransform: "uppercase", fontWeight: 700 }}>
                            Bidding Status
                          </div>
                          <div style={{
                            fontWeight: 800,
                            color: schedule.isOpen ? "#166534" : schedule.isScheduled ? "#92400E" : "#64748B",
                            marginTop: 2,
                          }}>
                            {schedule.statusLabel} ({schedule.remainingFormatted})
                          </div>
                        </div>

                        <div style={{ background: "#F8FAFC", padding: "8px 10px", borderRadius: 7 }}>
                          <div style={{ fontSize: 9.5, color: "#64748B", textTransform: "uppercase", fontWeight: 700 }}>
                            Opening Date &amp; Time
                          </div>
                          <div style={{ fontWeight: 800, color: "#0F172A", marginTop: 2 }}>
                            {schedule.openFormatted}
                          </div>
                        </div>

                        <div style={{ background: "#F8FAFC", padding: "8px 10px", borderRadius: 7 }}>
                          <div style={{ fontSize: 9.5, color: "#64748B", textTransform: "uppercase", fontWeight: 700 }}>
                            Submission Deadline
                          </div>
                          <div style={{
                            fontWeight: 800,
                            color: schedule.isClosed ? "#DC2626" : "#0F172A",
                            marginTop: 2,
                          }}>
                            {schedule.closeFormatted}
                          </div>
                        </div>
                      </div>

                      {schedule.deadlineChange && (
                        <div style={{
                          marginTop: 8,
                          padding: "8px 10px",
                          background: "#FFFBEB",
                          border: "1px solid #FCD34D",
                          borderRadius: 7,
                          fontSize: 11.5,
                          color: "#92400E",
                        }}>
                          <strong>Homeowner Deadline Notice:</strong> Deadline was updated from {schedule.deadlineChange.previousFormatted} to <strong>{schedule.deadlineChange.newFormatted}</strong>. Reason: <em>"{schedule.deadlineChange.reason}"</em>.
                        </div>
                      )}

                      <div style={{ marginTop: 8, fontSize: 11, color: "#64748B", lineHeight: 1.5 }}>
                        ℹ️ <strong>iConstruct Platform Deadline Policy:</strong> Quotations must be submitted before the closing deadline. Late submissions are automatically rejected. Quotations submitted within the valid bidding period remain preserved for homeowner review after bidding closes.
                      </div>
                    </div>
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
                        {/* Store Inventory Match & Absorption Breakdown Card */}
                        {shopMaterials.length > 0 && (
                          <div style={{
                            marginBottom: 14,
                            padding: "12px 14px",
                            borderRadius: 10,
                            background: matMatch.isFullMatch ? "#F0FDF4" : matMatch.hasMatches ? "#F8FAFC" : "#F8FAFC",
                            border: `1px solid ${matMatch.isFullMatch ? "#BBF7D0" : matMatch.hasMatches ? "#E2E8F0" : "#E2E8F0"}`,
                          }}>
                            <div style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              flexWrap: "wrap",
                              gap: 8,
                              marginBottom: 8,
                            }}>
                              <div style={{
                                fontSize: 11,
                                fontWeight: 800,
                                color: matMatch.isFullMatch ? "#166534" : "#1E293B",
                                letterSpacing: "0.06em",
                                textTransform: "uppercase",
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                              }}>
                                <TbSparkles size={15} color={matMatch.isFullMatch ? "#16A34A" : "#2563EB"} />
                                Store Inventory Match: {matMatch.percentage}% Absorption
                              </div>
                              <div style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: matMatch.isFullMatch ? "#15803D" : matMatch.hasMatches ? "#1D4ED8" : "#64748B",
                              }}>
                                {matMatch.matched} of {matMatch.total} materials in store stock
                              </div>
                            </div>

                            {/* Visual Progress Bar */}
                            <div style={{
                              width: "100%",
                              height: 8,
                              background: "#E2E8F0",
                              borderRadius: 999,
                              overflow: "hidden",
                              marginBottom: 10,
                            }}>
                              <div style={{
                                width: `${matMatch.percentage}%`,
                                height: "100%",
                                background: matMatch.isFullMatch
                                  ? "linear-gradient(90deg, #10B981, #059669)"
                                  : matMatch.percentage >= 50
                                  ? "linear-gradient(90deg, #3B82F6, #1D4ED8)"
                                  : "linear-gradient(90deg, #F59E0B, #D97706)",
                                borderRadius: 999,
                                transition: "width 0.3s ease",
                              }} />
                            </div>

                            <div style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                              gap: 6,
                              fontSize: 11,
                            }}>
                              <div style={{ background: "#fff", padding: "6px 8px", borderRadius: 6, border: "1px solid #E2E8F0" }}>
                                <span style={{ color: "#64748B" }}>Ready in Store: </span>
                                <strong style={{ color: "#166534" }}>{matMatch.matched} items ({matMatch.percentage}%)</strong>
                              </div>
                              {matMatch.outOfStock > 0 && (
                                <div style={{ background: "#fff", padding: "6px 8px", borderRadius: 6, border: "1px solid #FED7AA" }}>
                                  <span style={{ color: "#9A3412" }}>Out of Stock: </span>
                                  <strong style={{ color: "#EA580C" }}>{matMatch.outOfStock} items</strong>
                                </div>
                              )}
                              {matMatch.unavailable > 0 && (
                                <div style={{ background: "#fff", padding: "6px 8px", borderRadius: 6, border: "1px solid #E2E8F0" }}>
                                  <span style={{ color: "#64748B" }}>Not in Store: </span>
                                  <strong style={{ color: "#64748B" }}>{matMatch.unavailable} items</strong>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        <div style={{
                          fontSize: 10, fontWeight: 700, color: "#94A3B8",
                          letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10,
                        }}>
                          Materials needed ({materials.length})
                        </div>
                        <div style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                          gap: 8,
                        }}>
                          {materials.map((m, i) => {
                            const matchResult = shopMaterials.length > 0 ? findBestMatch(m, shopMaterials) : null;
                            const isDirectMatch = matchResult && matchResult.status === "direct_match" && matchResult.hasStock !== false;
                            const isOutOfStock = matchResult && matchResult.status === "out_of_stock";

                            return (
                              <div
                                key={i}
                                style={{
                                  background: "#fff",
                                  border: `1px solid ${isDirectMatch ? "#86EFAC" : isOutOfStock ? "#FECACA" : "#E2E8F0"}`,
                                  borderRadius: 10,
                                  padding: "10px 12px",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 10,
                                }}
                              >
                                <MaterialPhoto photoKey={m.photoKey} name={m.name} size={40} />
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                                    <div style={{
                                      fontSize: 13,
                                      fontWeight: 600,
                                      color: "#0F172A",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}>
                                      {m.name || "Material"}
                                    </div>
                                    {shopMaterials.length > 0 && (
                                      isDirectMatch ? (
                                        <span style={{
                                          fontSize: 9.5,
                                          fontWeight: 700,
                                          background: "#DCFCE7",
                                          color: "#166534",
                                          padding: "2px 6px",
                                          borderRadius: 4,
                                          flexShrink: 0,
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: 3,
                                        }}>
                                          <TbCheck size={11} /> In Store
                                        </span>
                                      ) : isOutOfStock ? (
                                        <span style={{
                                          fontSize: 9.5,
                                          fontWeight: 700,
                                          background: "#FEE2E2",
                                          color: "#991B1B",
                                          padding: "2px 6px",
                                          borderRadius: 4,
                                          flexShrink: 0,
                                        }}>
                                          Out of Stock
                                        </span>
                                      ) : (
                                        <span style={{
                                          fontSize: 9.5,
                                          fontWeight: 600,
                                          background: "#F1F5F9",
                                          color: "#64748B",
                                          padding: "2px 6px",
                                          borderRadius: 4,
                                          flexShrink: 0,
                                        }}>
                                          Not in Store
                                        </span>
                                      )
                                    )}
                                  </div>
                                  <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                                    {[m.category, m.quantity != null ? `${m.quantity} ${m.unit || ""}`.trim() : null, m.size]
                                      .filter(Boolean)
                                      .join(" · ") || "—"}
                                  </div>
                                  {isDirectMatch && matchResult?.price && (
                                    <div style={{ fontSize: 11, color: "#15803D", fontWeight: 700, marginTop: 2 }}>
                                      Store price: ₱{Number(matchResult.price).toLocaleString()}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
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
