import { useMemo, useState } from "react";
import SearchBar from "../../components/ui/SearchBar";
import {
  ArrowRight,
  CheckCircle,
  EnvelopeSimple,
  Phone,
  Warning,
  X,
} from "@phosphor-icons/react";
import { toDate, formatDateTime } from "../../utils/dateTime";
import { cycleDays } from "../../config/planConfig";
import { useLivePlanConfig } from "../../hooks/useLivePlanConfig";

function planKeyOf(shop) {
  return String(shop?.subscriptionPlan || "basic").toLowerCase();
}

function getExpiryInfo(shop) {
  const plan = planKeyOf(shop);
  const expiry = toDate(shop?.subscriptionExpiry);
  if (plan === "basic" || !expiry) {
    return { label: plan === "basic" ? "Free" : "No expiry", tone: "ok", expired: false, soon: false, daysLeft: null };
  }
  const daysLeft = Math.ceil((expiry.getTime() - Date.now()) / 86400000);
  if (daysLeft < 0) {
    return { label: `Expired ${formatDateTime(expiry)}`, tone: "bad", expired: true, soon: false, daysLeft };
  }
  if (daysLeft <= 14) {
    return { label: `${daysLeft}d left · ${formatDateTime(expiry)}`, tone: "warn", expired: false, soon: true, daysLeft };
  }
  return { label: formatDateTime(expiry), tone: "ok", expired: false, soon: false, daysLeft };
}

const PLAN_STYLE = {
  basic: { bg: "#F1F5F9", color: "#475569", border: "#E2E8F0" },
  pro: { bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
  business: { bg: "#F5F3FF", color: "#6D28D9", border: "#DDD6FE" },
};

function PlanBadge({ plan }) {
  const key = String(plan || "basic").toLowerCase();
  const s = PLAN_STYLE[key] || PLAN_STYLE.basic;
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        padding: "3px 8px",
        borderRadius: 20,
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
      }}
    >
      {key}
    </span>
  );
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
 * Live shops workspace: search, plan mix, expiry, and admin actions.
 */
export default function ManageShopsTab({
  shops = [],
  actionLoading = false,
  onSetPlan,
  onSuspend,
  onReopen,
  Avatar,
  StatusBadge,
}) {
  const [query, setQuery] = useState("");
  const [planFilter, setPlanFilter] = useState("all"); // all | basic | pro | business | expiring
  const [managing, setManaging] = useState(null);
  const [planPick, setPlanPick] = useState("pro");
  const [planDays, setPlanDays] = useState(30);
  const [suspendReason, setSuspendReason] = useState("");
  const livePro = useLivePlanConfig("pro");
  const liveBusiness = useLivePlanConfig("business");
  // One billing cycle of that plan (Monthly 30 / Quarterly 90 / Annually 365);
  // Business used to pre-fill 365 days even on a monthly plan.
  const defaultDaysFor = (p) =>
    cycleDays((p === "business" ? liveBusiness : p === "pro" ? livePro : null)?.billingCycle);

  const live = useMemo(
    () => shops.filter((s) => String(s.status || "").toLowerCase() === "approved"),
    [shops]
  );
  const suspended = useMemo(
    () => shops.filter((s) => String(s.status || "").toLowerCase() === "suspended"),
    [shops]
  );

  const mix = useMemo(() => {
    const counts = { basic: 0, pro: 0, business: 0, expiring: 0, expired: 0 };
    live.forEach((s) => {
      const k = planKeyOf(s);
      if (k === "pro") counts.pro += 1;
      else if (k === "business") counts.business += 1;
      else counts.basic += 1;
      const info = getExpiryInfo(s);
      if (info.soon) counts.expiring += 1;
      if (info.expired) counts.expired += 1;
    });
    return counts;
  }, [live]);

  const isSuspended = (s) => String(s?.status || "").toLowerCase() === "suspended";

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Suspended shops stay in the main list (they used to vanish from it,
    // reachable only through the separate "Suspended" filter). Plan / expiry
    // filters still mean live shops only.
    const pool =
      planFilter === "suspended" ? suspended
      : planFilter === "all" ? [...live, ...suspended]
      : live;
    return pool
      .filter((s) => {
        const k = planKeyOf(s);
        const info = getExpiryInfo(s);
        if (planFilter === "basic" || planFilter === "pro" || planFilter === "business") {
          if (k !== planFilter) return false;
        }
        if (planFilter === "expiring" && !(info.soon || info.expired)) return false;
        if (!q) return true;
        return (
          s.shopName?.toLowerCase().includes(q) ||
          s.ownerName?.toLowerCase().includes(q) ||
          s.email?.toLowerCase().includes(q) ||
          s.city?.toLowerCase().includes(q) ||
          s.phone?.toLowerCase?.().includes(q) ||
          String(s.phone || "").includes(q)
        );
      })
      .sort((a, b) => {
        // Suspended first so an admin sees them without hunting.
        if (isSuspended(a) !== isSuspended(b)) return isSuspended(a) ? -1 : 1;
        const ia = getExpiryInfo(a);
        const ib = getExpiryInfo(b);
        if (ia.expired !== ib.expired) return ia.expired ? -1 : 1;
        if (ia.soon !== ib.soon) return ia.soon ? -1 : 1;
        return (a.shopName || "").localeCompare(b.shopName || "");
      });
  }, [live, suspended, query, planFilter]);

  const openManage = (shop) => {
    setManaging(shop);
    const k = planKeyOf(shop);
    const pick = k === "basic" ? "pro" : k;
    setPlanPick(pick);
    setPlanDays(defaultDaysFor(pick));
    setSuspendReason("");
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, alignItems: "flex-end" }}>
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
            Manage Shops
          </h2>
          <p style={{ fontSize: 13, color: "#64748B", margin: 0, maxWidth: 540, lineHeight: 1.45 }}>
            Approved and suspended shops. Change plans, catch expiries, suspend access, or restore a suspended shop.
          </p>
        </div>
      </div>

      <div
        className="ms-stats"
        style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 10, marginBottom: 14 }}
      >
        <StatPill label="All shops" value={live.length + suspended.length} color="#10B981" active={planFilter === "all"} onClick={() => setPlanFilter("all")} />
        <StatPill label="Basic" value={mix.basic} color="#64748B" active={planFilter === "basic"} onClick={() => setPlanFilter("basic")} />
        <StatPill label="Pro" value={mix.pro} color="#2C5282" active={planFilter === "pro"} onClick={() => setPlanFilter("pro")} />
        <StatPill label="Business" value={mix.business} color="#CFB184" active={planFilter === "business"} onClick={() => setPlanFilter("business")} />
        <StatPill
          label="Expiring / expired"
          value={mix.expiring + mix.expired}
          color="#F59E0B"
          active={planFilter === "expiring"}
          onClick={() => setPlanFilter("expiring")}
        />
        <StatPill
          label="Suspended"
          value={suspended.length}
          color="#EF4444"
          active={planFilter === "suspended"}
          onClick={() => setPlanFilter("suspended")}
        />
      </div>

      <SearchBar
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search shop, owner, email, city, phone..."
        accentColor="#10B981"
        style={{ marginBottom: 12 }}
        width="100%"
      />

      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
            <thead>
              <tr style={{ background: "#F8FAFC" }}>
                {["Shop", "Owner / Contact", "Location", "Plan", "Expiry", "Status", "Actions"].map((h) => (
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
                    {planFilter === "suspended"
                      ? "No suspended shops."
                      : live.length + suspended.length === 0
                        ? "No approved shops yet."
                        : "No shops match this search or filter."}
                    {planFilter !== "all" ? (
                      <div style={{ marginTop: 10 }}>
                        <button
                          type="button"
                          onClick={() => setPlanFilter("all")}
                          style={{ fontSize: 12, fontWeight: 600, color: "#3B82F6", background: "none", border: "none", cursor: "pointer" }}
                        >
                          Show all shops
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ) : (
                rows.map((shop) => {
                  const info = getExpiryInfo(shop);
                  const susp = isSuspended(shop);
                  const rowBg = susp ? "#FEF2F2" : "transparent";
                  return (
                    <tr
                      key={shop.id}
                      style={{
                        background: rowBg,
                        borderLeft: susp
                          ? "3px solid #64748B"
                          : info.expired ? "3px solid #EF4444" : info.soon ? "3px solid #F59E0B" : "3px solid transparent",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = susp ? "#FEE2E2" : "#F8FAFC";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = rowBg;
                      }}
                    >
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {Avatar ? <Avatar name={shop.shopName || ""} size={34} /> : null}
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 180 }}>
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
                        <PlanBadge plan={shop.subscriptionPlan} />
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: info.tone === "ok" ? 500 : 700,
                            color: info.tone === "bad" ? "#DC2626" : info.tone === "warn" ? "#B45309" : "#64748B",
                          }}
                        >
                          {info.label}
                        </div>
                      </td>
                      <td style={{ padding: "12px 14px" }}>{StatusBadge ? <StatusBadge status={shop.status} /> : null}</td>
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {susp ? (
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={async () => {
                                if (!window.confirm(`Restore “${shop.shopName || "this shop"}”? They will be able to sign in again.`)) return;
                                await onReopen?.(shop.id);
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
                                opacity: actionLoading ? 0.6 : 1,
                                fontFamily: "inherit",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <CheckCircle size={12} weight="bold" /> Restore
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => openManage(shop)}
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
                            Manage <ArrowRight size={11} weight="bold" />
                          </button>
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

      {managing ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.55)",
            backdropFilter: "blur(6px)",
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setManaging(null);
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 20,
              width: "100%",
              maxWidth: 560,
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 40px 100px rgba(0,0,0,0.3)",
            }}
          >
            <div
              style={{
                padding: "20px 24px 16px",
                borderBottom: "1px solid #F1F5F9",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                position: "sticky",
                top: 0,
                background: "#fff",
                zIndex: 2,
              }}
            >
              <div style={{ display: "flex", gap: 12 }}>
                {Avatar ? <Avatar name={managing.shopName || ""} size={42} /> : null}
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 900, color: "#0F172A" }}>
                    {managing.shopName}
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4, flexWrap: "wrap" }}>
                    <PlanBadge plan={managing.subscriptionPlan} />
                    {StatusBadge ? <StatusBadge status={managing.status} /> : null}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setManaging(null)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "#F1F5F9",
                  border: "none",
                  cursor: "pointer",
                  color: "#64748B",
                }}
              >
                <X size={16} weight="bold" />
              </button>
            </div>

            <div style={{ padding: "20px 24px" }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                {managing.email ? (
                  <a
                    href={`mailto:${managing.email}`}
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#2563EB",
                      textDecoration: "none",
                      padding: "7px 12px",
                      borderRadius: 8,
                      border: "1px solid #BFDBFE",
                      background: "#EFF6FF",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <EnvelopeSimple size={14} weight="bold" /> Email
                  </a>
                ) : null}
                {managing.phone ? (
                  <a
                    href={`tel:${String(managing.phone).replace(/\s/g, "")}`}
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#059669",
                      textDecoration: "none",
                      padding: "7px 12px",
                      borderRadius: 8,
                      border: "1px solid #A7F3D0",
                      background: "#ECFDF5",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Phone size={14} weight="bold" /> {managing.phone}
                  </a>
                ) : null}
              </div>

              {[
                ["Owner", managing.ownerName],
                ["Email", managing.email],
                ["Phone", managing.phone],
                ["Address", managing.address],
                ["City", [managing.city, managing.province].filter(Boolean).join(", ")],
                ["Registered", formatDateTime(managing.createdAt)],
                ["Last reviewed", formatDateTime(managing.reviewedAt)],
                ["Expiry", getExpiryInfo(managing).label],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", gap: 12, fontSize: 13, marginBottom: 8 }}>
                  <span style={{ color: "#94A3B8", minWidth: 90, flexShrink: 0 }}>{k}</span>
                  <span style={{ color: "#0F172A", fontWeight: 500 }}>{v || "—"}</span>
                </div>
              ))}

              {getExpiryInfo(managing).expired || getExpiryInfo(managing).soon ? (
                <div
                  style={{
                    marginTop: 12,
                    background: getExpiryInfo(managing).expired ? "#FEF2F2" : "#FFFBEB",
                    border: `1px solid ${getExpiryInfo(managing).expired ? "#FECACA" : "#FCD34D"}`,
                    borderRadius: 10,
                    padding: "10px 12px",
                    fontSize: 12.5,
                    color: getExpiryInfo(managing).expired ? "#991B1B" : "#92400E",
                    display: "flex",
                    gap: 8,
                    alignItems: "flex-start",
                  }}
                >
                  <Warning size={15} weight="bold" style={{ flexShrink: 0, marginTop: 1 }} />
                  {getExpiryInfo(managing).expired
                    ? "Paid plan has expired. Set a new plan or leave them on Basic."
                    : "Subscription expires within 14 days. Extend the plan if they already paid."}
                </div>
              ) : null}

              <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #F1F5F9" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginBottom: 10 }}>Set plan</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                  {["basic", "pro", "business"].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setPlanPick(p);
                        setPlanDays(defaultDaysFor(p));
                      }}
                      style={{
                        padding: "7px 12px",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        textTransform: "capitalize",
                        border: planPick === p ? "1px solid #0F172A" : "1px solid #E2E8F0",
                        background: planPick === p ? "#0F172A" : "#fff",
                        color: planPick === p ? "#fff" : "#334155",
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                {planPick !== "basic" ? (
                  <label style={{ display: "block", fontSize: 12, color: "#64748B", marginBottom: 12 }}>
                    Duration (days)
                    <input
                      type="number"
                      min={1}
                      max={730}
                      value={planDays}
                      onChange={(e) => setPlanDays(Number(e.target.value) || 30)}
                      style={{
                        display: "block",
                        marginTop: 6,
                        width: 120,
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: "1px solid #E2E8F0",
                        fontSize: 13,
                        fontFamily: "inherit",
                      }}
                    />
                  </label>
                ) : (
                  <p style={{ fontSize: 12, color: "#64748B", margin: "0 0 12px" }}>
                    Basic has no expiry. Paid features will turn off.
                  </p>
                )}
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={async () => {
                    await onSetPlan?.(managing.id, planPick, planDays);
                    setManaging(null);
                  }}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 9,
                    border: "none",
                    background: "#0F172A",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: actionLoading ? "not-allowed" : "pointer",
                    opacity: actionLoading ? 0.7 : 1,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <CheckCircle size={15} weight="bold" />
                  {actionLoading ? "Saving..." : `Apply ${planPick.toUpperCase()} plan`}
                </button>
              </div>

              <div style={{ marginTop: 22, paddingTop: 16, borderTop: "1px solid #F1F5F9" }}>
                {["rejected", "suspended"].includes(String(managing.status).toLowerCase()) ? (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginBottom: 8 }}>Restore access</div>
                    {managing.rejectionReason ? (
                      <p style={{ fontSize: 12.5, color: "#991B1B", margin: "0 0 10px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 12px" }}>
                        Last reason: {managing.rejectionReason}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={async () => {
                        await onReopen?.(managing.id);
                        setManaging(null);
                      }}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 9,
                        border: "none",
                        background: "#10B981",
                        color: "#fff",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: actionLoading ? "not-allowed" : "pointer",
                      }}
                    >
                      Restore shop (approve again)
                    </button>
                  </>
                ) : (
                  <>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginBottom: 8 }}>Suspend access</div>
                <p style={{ fontSize: 12, color: "#64748B", margin: "0 0 10px", lineHeight: 1.45 }}>
                  Shop cannot sign in until you restore them. Use this for policy issues — not for plan expiry.
                </p>
                <input
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  placeholder="Reason (required)"
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid #E2E8F0",
                    fontSize: 13,
                    fontFamily: "inherit",
                    marginBottom: 10,
                    boxSizing: "border-box",
                  }}
                />
                <button
                  type="button"
                  disabled={actionLoading || !suspendReason.trim()}
                  onClick={async () => {
                    const ok = window.confirm(`Suspend “${managing.shopName}”? They will not be able to sign in.`);
                    if (!ok) return;
                    await onSuspend?.(managing.id, suspendReason.trim());
                    setManaging(null);
                  }}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 9,
                    border: "1.5px solid #FECACA",
                    background: "#FEF2F2",
                    color: "#DC2626",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: actionLoading || !suspendReason.trim() ? "not-allowed" : "pointer",
                    opacity: !suspendReason.trim() ? 0.5 : 1,
                  }}
                >
                    Suspend shop
                  </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <style>{`
        @media (max-width: 900px) {
          .ms-stats { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  );
}
