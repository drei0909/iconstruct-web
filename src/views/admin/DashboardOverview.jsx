import {
  ArrowCounterClockwise,
  ArrowRight,
  CheckCircle,
} from "@phosphor-icons/react";

function DonutChart({ segments = [], size = 128, thickness = 15, centerLabel, centerSub }) {
  const total = segments.reduce((s, x) => s + (Number(x.value) || 0), 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0, margin: "0 auto" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EEF2F7" strokeWidth={thickness} />
        {segments.map((seg, i) => {
          const val = Number(seg.value) || 0;
          if (val <= 0) return null;
          const len = (val / total) * c;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={thickness}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 22,
            fontWeight: 900,
            color: "#0F172A",
            lineHeight: 1,
          }}
        >
          {centerLabel}
        </div>
        {centerSub ? (
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.14em",
              color: "#94A3B8",
              marginTop: 4,
            }}
          >
            {centerSub}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Legend({ items }) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: "8px 16px",
        marginTop: 14,
      }}
    >
      {items.map((it) => (
        <div key={it.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: it.color, flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: "#64748B" }}>{it.label}</span>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: "#0F172A" }}>{it.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Equal square chart card — donut centered, legend under, action at bottom */
function SquareChart({ title, segments, centerLabel, centerSub, actionLabel, onAction }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #E8EEF4",
        borderRadius: 16,
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        boxSizing: "border-box",
      }}
    >
      <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A", marginBottom: 12 }}>{title}</div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 0 }}>
        <DonutChart segments={segments} centerLabel={centerLabel} centerSub={centerSub} />
        <Legend items={segments} />
      </div>
      {actionLabel ? (
        <button
          type="button"
          onClick={onAction}
          style={{
            marginTop: 12,
            fontSize: 12,
            fontWeight: 600,
            color: "#2563EB",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            alignSelf: "flex-start",
          }}
        >
          {actionLabel} <ArrowRight size={12} weight="bold" />
        </button>
      ) : null}
    </div>
  );
}

function Kpi({ label, value, color, hint, onClick }) {
  const urgent = Number(value) > 0 && label !== "Approved shops";
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: "left",
        background: "#fff",
        border: urgent ? `1px solid ${color}40` : "1px solid #E8EEF4",
        borderRadius: 14,
        padding: "14px 16px",
        cursor: "pointer",
        fontFamily: "inherit",
        boxShadow: urgent ? `0 0 0 3px ${color}10` : "none",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "#94A3B8",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 28,
          fontWeight: 900,
          color: "#0F172A",
          lineHeight: 1.1,
          marginTop: 6,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11.5, color: "#94A3B8", marginTop: 4 }}>{hint}</div>
    </button>
  );
}

/**
 * Neat one-screen admin overview: KPI strip + 2×2 equal squares.
 */
export default function DashboardOverview({
  shops = [],
  payments = [],
  contactMessages = [],
  stats = {},
  payStats = {},
  setActiveTab,
  setSelected,
  setSelectedPayment,
  setFilter,
  setPayFilter,
  lastRefreshed,
  onRefresh,
  newContactCount = 0,
  Avatar,
  StatusBadge,
}) {
  const workCount = (stats.pending || 0) + (payStats.pending || 0) + (newContactCount || 0);

  const approved = shops.filter((s) => s.status === "approved");
  const planMix = { basic: 0, pro: 0, business: 0 };
  approved.forEach((s) => {
    const p = String(s.subscriptionPlan || "basic").toLowerCase();
    if (p === "pro") planMix.pro += 1;
    else if (p === "business") planMix.business += 1;
    else planMix.basic += 1;
  });

  // One palette, reused everywhere: neutral/brand for plan tiers, amber/green/red
  // for status. No one-off hues per chart.
  const planSegments = [
    { label: "Basic", value: planMix.basic, color: "#94A3B8" },
    { label: "Pro", value: planMix.pro, color: "#2C5282" },
    { label: "Business", value: planMix.business, color: "#CFB184" },
  ];

  const shopSegments = [
    { label: "Pending", value: stats.pending || 0, color: "#F59E0B" },
    { label: "Approved", value: stats.approved || 0, color: "#10B981" },
    { label: "Rejected", value: stats.rejected || 0, color: "#EF4444" },
  ];

  const paySegments = [
    { label: "Pending", value: payStats.pending || 0, color: "#F59E0B" },
    { label: "Confirmed", value: payStats.confirmed || 0, color: "#10B981" },
    { label: "Rejected", value: payStats.rejected || 0, color: "#EF4444" },
  ];

  const attention = [
    ...shops
      .filter((s) => s.status === "pending")
      .slice(0, 4)
      .map((s) => ({
        id: `shop-${s.id}`,
        kind: "Application",
        name: s.shopName,
        sub: s.ownerName || s.email,
        status: "pending",
        onClick: () => {
          setFilter?.("pending");
          setSelected?.(s);
          setActiveTab("applications");
        },
      })),
    ...payments
      .filter((p) => p.status === "pending")
      .slice(0, 3)
      .map((p) => ({
        id: `pay-${p.id}`,
        kind: "Payment",
        name: p.shopName,
        sub: `${(p.planName || "").toUpperCase()} plan`,
        status: "pending",
        onClick: () => {
          setPayFilter?.("pending");
          setSelectedPayment?.(p);
          setActiveTab("subscriptions");
        },
      })),
    ...contactMessages
      .filter((m) => String(m.status || "").toLowerCase() === "new")
      .slice(0, 3)
      .map((m) => ({
        id: `msg-${m.id}`,
        kind: "Message",
        name: m.name || "Contact",
        sub: m.subject || m.email,
        status: "pending",
        onClick: () => setActiveTab("messages"),
      })),
  ].slice(0, 5);

  const timeStr = lastRefreshed
    ? lastRefreshed.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <div
      className="adm-overview"
      style={{
        width: "100%",
        height: "calc(100vh - 116px)",
        maxHeight: "calc(100vh - 116px)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexShrink: 0,
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 22,
              fontWeight: 900,
              color: "#0F172A",
              margin: "0 0 2px",
              letterSpacing: "-0.02em",
            }}
          >
            {workCount > 0 ? `${workCount} waiting on you` : "All clear"}
          </h2>
          <p style={{ margin: 0, fontSize: 12.5, color: "#64748B" }}>
            Click a card to jump to the right tab.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11.5, color: "#94A3B8" }}>Updated {timeStr}</span>
          <button
            type="button"
            onClick={onRefresh}
            title="Refresh"
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              border: "1px solid #E8EEF4",
              background: "#fff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#64748B",
            }}
          >
            <ArrowCounterClockwise size={15} />
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div
        className="adm-kpi-row"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 10,
          flexShrink: 0,
        }}
      >
        <Kpi
          label="Review"
          value={stats.pending || 0}
          color="#F59E0B"
          hint="Applications"
          onClick={() => {
            setFilter?.("pending");
            setActiveTab("applications");
          }}
        />
        <Kpi
          label="Payments"
          value={payStats.pending || 0}
          color="#F59E0B"
          hint="Awaiting confirmation"
          onClick={() => {
            setPayFilter?.("pending");
            setActiveTab("subscriptions");
          }}
        />
        <Kpi
          label="Messages"
          value={newContactCount || 0}
          color="#F59E0B"
          hint="New from Contact Us"
          onClick={() => setActiveTab("messages")}
        />
        <Kpi
          label="Approved shops"
          value={stats.approved || 0}
          color="#10B981"
          hint="Currently live"
          onClick={() => setActiveTab("shops")}
        />
      </div>

      {/* 2×2 equal squares — fills remaining height */}
      <div
        className="adm-square-grid"
        style={{
          flex: 1,
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "1fr 1fr",
          gap: 12,
        }}
      >
        <SquareChart
          title="Plan mix"
          segments={planSegments}
          centerLabel={String(approved.length)}
          centerSub="LIVE"
          actionLabel="Manage shops"
          onAction={() => setActiveTab("shops")}
        />
        <SquareChart
          title="Applications"
          segments={shopSegments}
          centerLabel={String(stats.total || 0)}
          centerSub="SHOPS"
          actionLabel="Review queue"
          onAction={() => {
            setFilter?.("pending");
            setActiveTab("applications");
          }}
        />
        <SquareChart
          title="Subscriptions"
          segments={paySegments}
          centerLabel={String(payStats.total || 0)}
          centerSub="PAY"
          actionLabel="Open payments"
          onAction={() => {
            setPayFilter?.("pending");
            setActiveTab("subscriptions");
          }}
        />

        {/* Needs attention — same square size */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #E8EEF4",
            borderRadius: 16,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            height: "100%",
            minHeight: 0,
          }}
        >
          <div
            style={{
              padding: "14px 18px",
              borderBottom: "1px solid #F1F5F9",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexShrink: 0,
            }}
          >
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A" }}>Needs attention</div>
            {workCount > 0 ? (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#B45309",
                  background: "#FEF3C7",
                  borderRadius: 20,
                  padding: "2px 8px",
                }}
              >
                {workCount}
              </span>
            ) : null}
          </div>

          {attention.length === 0 ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "#94A3B8",
                padding: 20,
                textAlign: "center",
              }}
            >
              <CheckCircle size={28} color="#CBD5E1" weight="duotone" />
              <div style={{ fontSize: 13, fontWeight: 600, color: "#64748B", marginTop: 10 }}>
                Nothing pending
              </div>
              <div style={{ fontSize: 12, marginTop: 4 }}>You’re all caught up.</div>
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
              {attention.map((item, i) => (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={item.onClick}
                  onKeyDown={(e) => e.key === "Enter" && item.onClick()}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 16px",
                    borderBottom: i < attention.length - 1 ? "1px solid #F8FAFC" : "none",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#F8FAFC";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  {Avatar ? <Avatar name={item.name || ""} size={30} /> : null}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: "#0F172A",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {item.name}
                    </div>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>
                      {item.kind} · {item.sub}
                    </div>
                  </div>
                  {StatusBadge ? <StatusBadge status={item.status} /> : null}
                  <ArrowRight size={13} color="#CBD5E1" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .adm-square-grid {
            grid-template-columns: 1fr !important;
            grid-template-rows: none !important;
            overflow: auto !important;
          }
          .adm-overview {
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
          }
          .adm-kpi-row { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 520px) {
          .adm-kpi-row { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
