import { useMemo, useState } from "react";
import { estimateMaterials } from "../utils/recommendationEngine";

const peso = (n) =>
  `₱${Number(n || 0).toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;

/**
 * Live preview of material estimate for admin / shop helpers.
 * Pass formula+pricing from parent (already loaded).
 */
export default function RecommendationEstimatePreview({
  formula,
  pricing,
  defaultArea = 100,
  compact = false,
}) {
  const [area, setArea] = useState(defaultArea);

  const { result, error } = useMemo(() => {
    try {
      const a = Number(area);
      if (!Number.isFinite(a) || a <= 0) {
        return { result: null, error: "" };
      }
      return { result: estimateMaterials(a, { formula, pricing }), error: "" };
    } catch (e) {
      return { result: null, error: e.message || "Invalid area" };
    }
  }, [area, formula, pricing]);

  return (
    <div
      style={{
        background: compact ? "#F8FAFC" : "#fff",
        border: "1px solid #E2E8F0",
        borderRadius: 12,
        padding: compact ? 14 : 18,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "flex-end",
          marginBottom: 14,
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>
            Estimate preview
          </div>
          <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 2 }}>
            Same formulas the builder app should use
          </div>
        </div>
        <label style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>
          Area (sqm)
          <input
            type="number"
            min={1}
            step={1}
            value={area}
            onChange={(e) => setArea(e.target.value)}
            style={{
              display: "block",
              marginTop: 4,
              width: 110,
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #E2E8F0",
              fontSize: 13,
              fontFamily: "inherit",
            }}
          />
        </label>
      </div>

      {error ? (
        <div style={{ fontSize: 12.5, color: "#B91C1C" }}>{error}</div>
      ) : !result ? (
        <div style={{ fontSize: 12.5, color: "#94A3B8" }}>Enter a positive area.</div>
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#94A3B8", fontSize: 10, letterSpacing: "0.08em" }}>
                  <th style={{ padding: "6px 8px", fontWeight: 700 }}>MATERIAL</th>
                  <th style={{ padding: "6px 8px", fontWeight: 700 }}>QTY</th>
                  <th style={{ padding: "6px 8px", fontWeight: 700 }}>EST. COST</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((row) => (
                  <tr key={row.key} style={{ borderTop: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "8px", color: "#334155", fontWeight: 600 }}>
                      {row.label}
                    </td>
                    <td style={{ padding: "8px", color: "#64748B" }}>
                      {row.qty.toLocaleString("en-PH", { maximumFractionDigits: 2 })} {row.unit}
                    </td>
                    <td style={{ padding: "8px", color: "#0F172A", fontWeight: 600 }}>
                      {peso(row.cost)}
                    </td>
                  </tr>
                ))}
                <tr style={{ borderTop: "1px solid #E2E8F0" }}>
                  <td style={{ padding: "8px", color: "#334155", fontWeight: 600 }}>Labor</td>
                  <td style={{ padding: "8px", color: "#64748B" }}>
                    {result.areaSqm} m²
                  </td>
                  <td style={{ padding: "8px", color: "#0F172A", fontWeight: 600 }}>
                    {peso(result.labor)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div
            style={{
              marginTop: 12,
              paddingTop: 12,
              borderTop: "1px solid #E2E8F0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 11, color: "#94A3B8", maxWidth: 320, lineHeight: 1.4 }}>
              {result.disclaimer}
              {result.source?.reference ? (
                <>
                  <br />
                  Basis: {result.source.reference}
                  {result.source.region ? ` · ${result.source.region}` : ""}
                  {result.source.asOf ? ` · ${result.source.asOf}` : ""}
                </>
              ) : null}
            </span>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.08em" }}>
                TOTAL EST.
              </div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 20,
                  fontWeight: 900,
                  color: "#0F172A",
                }}
              >
                {peso(result.total)}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
