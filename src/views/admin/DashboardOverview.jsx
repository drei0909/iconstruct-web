import {
  ArrowCounterClockwise,
  ArrowRight,
  CheckCircle,
} from "@phosphor-icons/react";

function DonutChart({ segments = [], size = 132, thickness = 16, centerLabel, centerSub }) {
  const total = segments.reduce((s, x) => s + (Number(x.value) || 0), 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
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
            fontSize: 20,
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
              letterSpacing: "0.12em",
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
    <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minWidth: 0 }}>
      {items.map((it) => (
        <div key={it.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: it.color, flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 12.5, color: "#64748B" }}>{it.label}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>
            {it.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function ChartCard({ title, segments, centerLabel, centerSub, actionLabel, onAction }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #E8EEF4",
        borderRadius: 16,
        padding: "20px 22px",
        display: "flex",
        alignItems: "center",
        gap: 18,
        minHeight: 168,
      }}
    >
      <DonutChart segments={segments} centerLabel={centerLabel} centerSub={centerSub} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A", marginBottom: 12 }}>{title}</div>
        <Legend items={segments} />
        {actionLabel ? (
          <button
            type="button"
            onClick={onAction}
            style={{
              marginTop: 14,
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
            }}
          >
            {actionLabel} <ArrowRight size={12} weight="bold" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Kpi({ label, value, color, hint, onClick }) {
  const urgent = Number(value) > 0 && label !== "Live shops";
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: "left",
        background: "#fff",
        border: urgent ? `1px solid ${color}40` : "1px solid #E8EEF4",
        borderRadius: 14,
        padding: "16px 18px",
        cursor: "pointer",
        fontFamily: "inherit",
        boxShadow: urgent ? `0 0 0 3px ${color}10` : "none",
      }}
    >
      <div
        style={{
          fontSize: 10,
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
          fontSize: 30,
          fontWeight: 900,
          color,
          lineHeight: 1.1,
          marginTop: 8,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 6 }}>{hint}</div>
    </button>
  );
}

/**
 * Clean Super Admin dashboard with donut charts + action list.
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

  const planSegments = [
    { label: "Basic", value: planMix.basic, color: "#94A3B8" },
    { label: "Pro", value: planMix.pro, color: "#3B82F6" },
    { label: "Business", value: planMix.business, color: "#CFB184" },
  ];

  const shopSegments = [
    { label: "Pending", value: stats.pending || 0, color: "#F59E0B" },
    { label: "Approved", value: stats.approved || 0, color: "#10B981" },
    { label: "Rejected", value: stats.rejected || 0, color: "#EF4444" },
  ];

  const paySegments = [
    { label: "Pending", value: payStats.pending || 0, color: "#7C3AED" },
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
  ].slice(0, 6);

  const timeStr = lastRefreshed
    ? lastRefreshed.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <div style={{ maxWidth: 1000 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 12,
          marginBottom: 22,
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 26,
              fontWeight: 900,
              color: "#0F172A",
              margin: "0 0 6px",
              letterSpacing: "-0.02em",
            }}
          >
            {workCount > 0 ? `${workCount} waiting on you` : "All clear"}
          </h2>
          <p style={{ margin: 0, fontSize: 13.5, color: "#64748B" }}>
            Review shops, confirm payments, and reply to Contact Us — click any card to jump in.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: "#94A3B8" }}>Updated {timeStr}</span>
          <button
            type="button"
            onClick={onRefresh}
            title="Refresh"
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              border: "1px solid #E8EEF4",
              background: "#fff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#64748B",
            }}
          >
            <ArrowCounterClockwise size={17} />
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div
        className="adm-kpi-row"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 12,
          marginBottom: 16,
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
          color="#7C3AED"
          hint="Awaiting confirm"
          onClick={() => {
            setPayFilter?.("pending");
            setActiveTab("subscriptions");
          }}
        />
        <Kpi
          label="Messages"
          value={newContactCount || 0}
          color="#0EA5E9"
          hint="Contact Us"
          onClick={() => setActiveTab("messages")}
        />
        <Kpi
          label="Live shops"
          value={stats.approved || 0}
          color="#10B981"
          hint="Approved"
          onClick={() => setActiveTab("shops")}
        />
      </div>

      {/* Donuts row */}
      <div
        className="adm-donut-row"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <ChartCard
          title="Plan mix"
          segments={planSegments}
          centerLabel={String(approved.length)}
          centerSub="LIVE"
          actionLabel="Manage shops"
          onAction={() => setActiveTab("shops")}
        />
        <ChartCard
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
      </div>

      {/* Payments donut + attention */}
      <div
        className="adm-lower-clean"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1.15fr",
          gap: 12,
        }}
      >
        <ChartCard
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

        <div
          style={{
            background: "#fff",
            border: "1px solid #E8EEF4",
            borderRadius: 16,
            overflow: "hidden",
            minHeight: 168,
          }}
        >
          <div
            style={{
              padding: "14px 18px",
              borderBottom: "1px solid #F1F5F9",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A" }}>Needs attention</div>
            {workCount > 0 ? (
              <span
                style={{
                  fontSize: 11,
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
            <div style={{ padding: "36px 20px", textAlign: "center", color: "#94A3B8" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
                <CheckCircle size={26} color="#CBD5E1" weight="duotone" />
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#64748B" }}>Nothing pending</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>New work shows up here automatically.</div>
            </div>
          ) : (
            attention.map((item, i) => (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={item.onClick}
                onKeyDown={(e) => e.key === "Enter" && item.onClick()}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "11px 18px",
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
                {Avatar ? <Avatar name={item.name || ""} size={32} /> : null}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
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
                <ArrowRight size={14} color="#CBD5E1" />
              </div>
            ))
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 920px) {
          .adm-kpi-row { grid-template-columns: 1fr 1fr !important; }
          .adm-donut-row, .adm-lower-clean { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 520px) {
          .adm-kpi-row { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
