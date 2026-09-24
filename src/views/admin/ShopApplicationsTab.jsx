import { useMemo, useState } from "react";
import SearchBar from "../../components/ui/SearchBar";
import {
  ArrowRight,
  CheckCircle,
  Clock,
  FileText,
  Warning,
} from "@phosphor-icons/react";

const REQUIRED_DOC_GROUPS = [
  {
    key: "business",
    label: "Business document",
    types: ["dti", "business", "mayors", "bir"],
  },
  { key: "shop", label: "Shop exterior photo", types: ["shop"] },
  { key: "validId", label: "Valid ID", types: ["validId"] },
  { key: "selfie", label: "ID selfie", types: ["selfie"] },
];

function toDate(v) {
  try {
    if (!v) return null;
    if (typeof v.toDate === "function") return v.toDate();
    if (typeof v.seconds === "number") return new Date(v.seconds * 1000);
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function formatDate(v) {
  const d = toDate(v);
  if (!d) return "—";
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

function waitingLabel(v) {
  const d = toDate(v);
  if (!d) return "";
  const hours = Math.floor((Date.now() - d.getTime()) / 3600000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h waiting`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1 day waiting";
  return `${days} days waiting`;
}

/** Completeness of the 4 required registration document groups. */
export function getDocCompleteness(shop) {
  const docs = Array.isArray(shop?.documents) ? shop.documents : [];
  const presentTypes = new Set(
    docs.map((d) => String(d.docType || d.type || "").toLowerCase()).filter(Boolean)
  );
  // Also accept generic image uploads without typed docType as "other"
  // "validId" is camelCase in REQUIRED_DOC_GROUPS but presentTypes is all
  // lowercase (from d.docType.toLowerCase()) — without lowering `t` too,
  // "validId" !== "validid" and that document group could never match,
  // even though the shop's actual valid-ID upload was right there.
  const groups = REQUIRED_DOC_GROUPS.map((g) => {
    const found = g.types.some((t) => presentTypes.has(t.toLowerCase()));
    return { ...g, found };
  });
  const foundCount = groups.filter((g) => g.found).length;
  // Fallback: if they uploaded files but types missing, still count raw files
  const rawCount = docs.length;
  const score = foundCount > 0 ? foundCount : Math.min(rawCount, 4);
  return {
    score,
    total: 4,
    groups,
    rawCount,
    complete: foundCount === 4 || rawCount >= 4,
    missing: groups.filter((g) => !g.found).map((g) => g.label),
  };
}

function StatPill({ label, value, color, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: "left",
        background: active ? "#0F172A" : "#fff",
        border: active ? "1px solid #0F172A" : "1px solid #E2E8F0",
        borderRadius: 12,
        padding: "12px 14px",
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 22,
          fontWeight: 900,
          color: active ? "#fff" : color,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: active ? "rgba(255,255,255,0.7)" : "#64748B", marginTop: 4 }}>
        {label}
      </div>
    </button>
  );
}

/**
 * Functional Shop Applications inbox for Super Admin.
 */
export default function ShopApplicationsTab({
  filtered = [],
  filter = "all",
  setFilter,
  search = "",
  setSearch,
  setSelected,
  shopsCount = 0,
  stats = {},
  onQuickApprove,
  actionLoading = false,
  Avatar,
  StatusBadge,
}) {
  const [sortBy, setSortBy] = useState("priority"); // priority | newest | oldest

  const rows = useMemo(() => {
    const list = [...filtered];
    const statusRank = (s) => {
      const st = String(s.status || "").toLowerCase();
      if (st === "pending") return 0;
      if (st === "approved") return 1;
      return 2;
    };
    const ts = (s) => toDate(s.createdAt)?.getTime() || 0;

    list.sort((a, b) => {
      if (sortBy === "newest") return ts(b) - ts(a);
      if (sortBy === "oldest") return ts(a) - ts(b);
      // priority: pending first, then oldest pending (FIFO review)
      const ra = statusRank(a);
      const rb = statusRank(b);
      if (ra !== rb) return ra - rb;
      if (ra === 0) return ts(a) - ts(b);
      return ts(b) - ts(a);
    });
    return list;
  }, [filtered, sortBy]);

  const pendingCount = stats.pending || 0;

  return (
    <div>
      <div
        style={{
          marginBottom: 16,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-end",
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 20,
              fontWeight: 900,
              color: "#0F172A",
              marginBottom: 4,
            }}
          >
            Shop Applications
          </h2>
          <p style={{ fontSize: 13, color: "#64748B", margin: 0, maxWidth: 520, lineHeight: 1.45 }}>
            Verify documents, then approve shops so they can sign in. Pending applications are listed first.
          </p>
        </div>
        {pendingCount > 0 ? (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "#FEF3C7",
              border: "1px solid #FCD34D",
              borderRadius: 20,
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: 700,
              color: "#92400E",
            }}
          >
            <Clock size={14} weight="bold" />
            {pendingCount} waiting for review
          </div>
        ) : null}
      </div>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 10,
          marginBottom: 14,
        }}
        className="app-stats"
      >
        <StatPill
          label="All"
          value={stats.total || shopsCount || 0}
          color="#3B82F6"
          active={filter === "all"}
          onClick={() => setFilter("all")}
        />
        <StatPill
          label="Pending"
          value={stats.pending || 0}
          color="#F59E0B"
          active={filter === "pending"}
          onClick={() => setFilter("pending")}
        />
        <StatPill
          label="Approved"
          value={stats.approved || 0}
          color="#10B981"
          active={filter === "approved"}
          onClick={() => setFilter("approved")}
        />
        <StatPill
          label="Rejected"
          value={stats.rejected || 0}
          color="#EF4444"
          active={filter === "rejected"}
          onClick={() => setFilter("rejected")}
        />
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <SearchBar
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search shop, owner, email, city, phone..."
          accentColor="#3B82F6"
          style={{ flex: 1, minWidth: 220 }}
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          style={{
            padding: "9px 12px",
            borderRadius: 8,
            border: "1px solid #E2E8F0",
            background: "#fff",
            fontSize: 12,
            color: "#334155",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <option value="priority">Sort: Pending first</option>
          <option value="newest">Sort: Newest</option>
          <option value="oldest">Sort: Oldest</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 780 }}>
            <thead>
              <tr style={{ background: "#F8FAFC" }}>
                {["Shop", "Owner / Contact", "Location", "Docs", "Submitted", "Status", "Actions"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "11px 14px",
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "#94A3B8",
                      textAlign: "left",
                      borderBottom: "1px solid #E2E8F0",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: "48px 22px", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
                    {shopsCount === 0
                      ? "No shop applications yet."
                      : `No shops match “${filter === "all" ? "All" : filter}”${search ? ` for “${search}”` : ""}.`}
                    {filter !== "all" && shopsCount > 0 ? (
                      <div style={{ marginTop: 10 }}>
                        <button
                          type="button"
                          onClick={() => setFilter("all")}
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: "#3B82F6",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          Show all applications
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ) : (
                rows.map((shop) => {
                  const docs = getDocCompleteness(shop);
                  const pending = String(shop.status || "").toLowerCase() === "pending";
                  const wait = pending ? waitingLabel(shop.createdAt) : "";
                  const overdue = pending && wait.includes("days") && parseInt(wait, 10) >= 2;

                  return (
                    <tr
                      key={shop.id}
                      style={{
                        background: pending ? "#FFFBEB08" : "transparent",
                        borderLeft: pending ? "3px solid #F59E0B" : "3px solid transparent",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "#F8FAFC";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = pending ? "#FFFBEB08" : "transparent";
                      }}
                    >
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {Avatar ? <Avatar name={shop.shopName || ""} size={34} /> : null}
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: "#0F172A",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                maxWidth: 180,
                              }}
                            >
                              {shop.shopName || "Untitled shop"}
                            </div>
                            <div style={{ fontSize: 11, color: "#94A3B8" }}>{shop.email || "—"}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ fontSize: 13, color: "#334155", fontWeight: 500 }}>{shop.ownerName || "—"}</div>
                        <div style={{ fontSize: 11, color: "#94A3B8" }}>{shop.phone || "No phone"}</div>
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 12, color: "#64748B" }}>
                        {[shop.city, shop.province].filter(Boolean).join(", ") || "—"}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            padding: "4px 8px",
                            borderRadius: 8,
                            background: docs.complete ? "#ECFDF5" : "#FFF7ED",
                            border: `1px solid ${docs.complete ? "#A7F3D0" : "#FED7AA"}`,
                            fontSize: 11,
                            fontWeight: 700,
                            color: docs.complete ? "#065F46" : "#9A3412",
                          }}
                          title={
                            docs.missing.length
                              ? `Missing: ${docs.missing.join(", ")}`
                              : `${docs.rawCount} file(s) uploaded`
                          }
                        >
                          {docs.complete ? <CheckCircle size={12} weight="bold" /> : <Warning size={12} weight="bold" />}
                          {docs.score}/{docs.total}
                          <FileText size={11} />
                        </div>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ fontSize: 12, color: "#64748B" }}>{formatDate(shop.createdAt)}</div>
                        {wait ? (
                          <div
                            style={{
                              fontSize: 10.5,
                              fontWeight: 600,
                              color: overdue ? "#DC2626" : "#B45309",
                              marginTop: 2,
                            }}
                          >
                            {wait}
                          </div>
                        ) : null}
                      </td>
                      <td style={{ padding: "12px 14px" }}>{StatusBadge ? <StatusBadge status={shop.status} /> : null}</td>
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            onClick={() => setSelected(shop)}
                            style={{
                              padding: "6px 11px",
                              borderRadius: 7,
                              border: "1px solid #E2E8F0",
                              background: "#fff",
                              fontSize: 11.5,
                              fontWeight: 600,
                              color: "#334155",
                              cursor: "pointer",
                              fontFamily: "inherit",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            Review <ArrowRight size={11} weight="bold" />
                          </button>
                          {pending && onQuickApprove ? (
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={async () => {
                                const Swal = (await import("sweetalert2")).default;
                                const result = await Swal.fire({
                                  icon: "question",
                                  title: "Approve this shop?",
                                  text: `"${shop.shopName}" will receive a confirmation email and can sign in.`,
                                  showCancelButton: true,
                                  confirmButtonText: "Approve",
                                  cancelButtonText: "Cancel",
                                  confirmButtonColor: "#154665",
                                  cancelButtonColor: "#94A3B8",
                                  reverseButtons: true,
                                  focusCancel: true,
                                });
                                if (result.isConfirmed) onQuickApprove(shop.id);
                              }}
                              style={{
                                padding: "6px 11px",
                                borderRadius: 7,
                                border: "none",
                                background: "#10B981",
                                fontSize: 11.5,
                                fontWeight: 600,
                                color: "#fff",
                                cursor: actionLoading ? "not-allowed" : "pointer",
                                fontFamily: "inherit",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                opacity: actionLoading ? 0.7 : 1,
                              }}
                            >
                              <CheckCircle size={12} weight="bold" /> Approve
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        @media (max-width: 720px) {
          .app-stats { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  );
}

export { REQUIRED_DOC_GROUPS };
