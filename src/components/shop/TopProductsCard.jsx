// Ranks the products a shop actually supplies, from its own accepted quotes.
// Shown on every shop dashboard's Dashboard tab. Depth of detail scales with
// the shop's plan: Basic = the list, Pro = + pricing & volume share,
// Business = + concentration insight, unit economics and recency.

import { Package, TrendUp, ArrowRight } from "@phosphor-icons/react";
import { getTopQuotedProducts, peso } from "../../utils/quoteAnalytics";

function ShareBar({ pct, color }) {
  return (
    <div style={{ height: 4, background: "#EEF2F7", borderRadius: 3, overflow: "hidden", marginTop: 5 }}>
      <div style={{ height: "100%", width: `${Math.max(pct, 4)}%`, background: color, borderRadius: 3 }} />
    </div>
  );
}

function CategoryChip({ label }) {
  if (!label) return null;
  return (
    <span style={{
      fontSize: 9.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase",
      color: "#64748B", background: "#F1F5F9", border: "1px solid #E2E8F0",
      borderRadius: 6, padding: "1px 6px", whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

function RankBadge({ n, color, active }) {
  return (
    <span style={{
      width: 22, height: 22, borderRadius: 7, flexShrink: 0,
      background: active ? color : "#F1F5F9",
      color: active ? "#fff" : "#64748B",
      fontSize: 11, fontWeight: 800,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {n}
    </span>
  );
}

export default function TopProductsCard({
  quotations = [],
  accentColor = "#2C5282",
  plan = "basic",
  onUpgrade,
}) {
  const tier = plan === "business" ? "business" : plan === "pro" ? "pro" : "basic";
  const limit = tier === "business" ? 6 : tier === "pro" ? 5 : 3;
  const top = getTopQuotedProducts(quotations, { limit });

  const totalValue = top.reduce((s, p) => s + p.value, 0);
  const totalUnits = top.reduce((s, p) => s + p.qty, 0);
  const leadValue = top[0]?.value || 1;
  const top3Share = totalValue
    ? Math.round((top.slice(0, 3).reduce((s, p) => s + p.value, 0) / totalValue) * 100)
    : 0;

  const subtitle =
    tier === "basic"
      ? "Most supplied on accepted quotes"
      : tier === "pro"
        ? "Ranked by volume — value and unit pricing from accepted quotes"
        : "Volume, unit economics and order recency from accepted quotes";

  return (
    <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0", padding: "18px 20px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <Package size={16} color={accentColor} weight="duotone" />
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Top Products</div>
            {tier !== "basic" && (
              <span style={{
                fontSize: 9, fontWeight: 800, letterSpacing: "0.08em",
                color: accentColor, background: `${accentColor}12`,
                border: `1px solid ${accentColor}33`, borderRadius: 6, padding: "1px 6px",
              }}>
                {tier === "pro" ? "PRO" : "BUSINESS"}
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: "#94A3B8" }}>{subtitle}</div>
        </div>
        {tier !== "basic" && top.length > 0 && (
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>{peso(totalValue)}</div>
            <div style={{ fontSize: 10, color: "#94A3B8" }}>{totalUnits} units supplied</div>
          </div>
        )}
      </div>

      {/* Business-only insight strip */}
      {tier === "business" && top.length > 0 && (
        <div style={{
          display: "flex", gap: 10, marginTop: 14, padding: "10px 12px",
          background: "#F8FAFC", border: "1px solid #EEF2F7", borderRadius: 10,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em" }}>Best seller</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{top[0].name}</div>
          </div>
          <div style={{ width: 1, background: "#E2E8F0" }} />
          <div style={{ flexShrink: 0, textAlign: "right" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em" }}>Top 3 concentration</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: top3Share >= 75 ? "#D97706" : "#0F172A", display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
              <TrendUp size={12} weight="bold" /> {top3Share}% of value
            </div>
          </div>
        </div>
      )}

      {/* Rows */}
      {top.length === 0 ? (
        <div style={{ fontSize: 12, color: "#94A3B8", padding: "14px 0 4px" }}>
          Once a builder accepts one of your quotes, the items you supplied rank here.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: tier === "basic" ? 10 : 12, marginTop: 14 }}>
          {top.map((p, i) => {
            const barPct = (p.value / leadValue) * 100;

            if (tier === "basic") {
              return (
                <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <RankBadge n={i + 1} color={accentColor} active={i === 0} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: 10.5, color: "#94A3B8" }}>
                      {p.qty} unit{p.qty === 1 ? "" : "s"} · {p.orders} order{p.orders === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: accentColor, flexShrink: 0 }}>
                    {p.valueLabel}
                  </div>
                </div>
              );
            }

            // Pro + Business rows
            return (
              <div key={p.name} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <RankBadge n={i + 1} color={accentColor} active={i === 0} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.name}
                    </span>
                    <CategoryChip label={p.category} />
                    {tier === "business" && p.orders > 1 && (
                      <span style={{ fontSize: 9, fontWeight: 700, color: "#059669", background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 6, padding: "1px 5px" }}>
                        REPEAT
                      </span>
                    )}
                  </div>
                  <ShareBar pct={barPct} color={accentColor} />
                  <div style={{ fontSize: 10.5, color: "#94A3B8", marginTop: 4 }}>
                    {p.qty} units · {p.avgUnitPriceLabel}/unit · {p.orders} order{p.orders === 1 ? "" : "s"}
                    {tier === "business" && p.lastOrdered ? ` · last ${p.lastOrdered}` : ""}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: accentColor }}>{p.valueLabel}</div>
                  <div style={{ fontSize: 10, color: "#94A3B8" }}>{Math.round(p.share * 100)}% of top</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Basic-only upsell */}
      {tier === "basic" && typeof onUpgrade === "function" && (
        <button
          type="button"
          onClick={onUpgrade}
          style={{
            marginTop: 14, display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 11.5, fontWeight: 700, color: accentColor,
            background: "none", border: "none", cursor: "pointer", padding: 0,
          }}
        >
          Upgrade for volume share, unit pricing &amp; order history
          <ArrowRight size={12} weight="bold" />
        </button>
      )}
    </div>
  );
}
