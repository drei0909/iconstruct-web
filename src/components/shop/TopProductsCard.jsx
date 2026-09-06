// Ranks the products a shop actually supplies, from its own accepted quotes.
// Shown on every shop dashboard's Dashboard tab.

import { Package } from "@phosphor-icons/react";
import { getTopQuotedProducts } from "../../utils/quoteAnalytics";

export default function TopProductsCard({ quotations = [], accentColor = "#2C5282", limit = 5 }) {
  const top = getTopQuotedProducts(quotations, { limit, status: "accepted" });

  return (
    <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0", padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
        <Package size={16} color={accentColor} weight="duotone" />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Top Products</div>
      </div>
      <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 14 }}>
        Most supplied on accepted quotes
      </div>

      {top.length === 0 ? (
        <div style={{ fontSize: 12, color: "#94A3B8", padding: "10px 0" }}>
          Once a builder accepts one of your quotes, the items you supplied rank here.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {top.map((p, i) => (
            <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{
                width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                background: i === 0 ? accentColor : "#F1F5F9",
                color: i === 0 ? "#fff" : "#64748B",
                fontSize: 11, fontWeight: 800,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {i + 1}
              </span>
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
          ))}
        </div>
      )}
    </div>
  );
}
