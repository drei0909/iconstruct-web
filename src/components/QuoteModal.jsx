// src/components/QuoteModal.jsx
import { useState } from "react";
import { Package } from "@phosphor-icons/react";
import { estimateProjectBaseline, referenceUnitPrice } from "../utils/recommendationEngine";
import { classifyMaterial } from "../utils/supplyCategories";

const peso = (n) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency", currency: "PHP", maximumFractionDigits: 0,
  }).format(n ?? 0);

function MaterialImage({ accentColor, active }) {
  return (
    <div style={{
      width: 44, height: 44, borderRadius: 8,
      background: active ? accentColor + "15" : "#E4E9F0",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
    }}>
      <Package size={22} color={active ? accentColor : "#94A3B8"} weight="duotone" />
    </div>
  );
}

const AMBER = "#D97706";

export default function QuoteModal({
  project,
  onClose,
  onSubmit,
  submitting,
  accentColor = "#2C3E50",
  accentGradient = "linear-gradient(180deg, #2C3E50 30%, #648DB6 100%)",
  estimateConfig = null,
  plan = "basic",
  suppliedCategories = [],
}) {
  const materials = Array.isArray(project.materials) ? project.materials : [];

  // DPWH planning baseline for this project (all plans see the total; Pro/Business
  // also get per-line reference prices; Business gets an over-baseline warning).
  const baseline = estimateConfig ? estimateProjectBaseline(project, estimateConfig) : null;
  const showLineRef = plan === "pro" || plan === "business";
  const showBaselineWarning = plan === "business";
  const refPricing = estimateConfig?.pricing || null;

  // When the shop has declared its supply categories, a project line that
  // clearly belongs to a category the shop did NOT tick starts pre-marked
  // "Unavailable" (still editable). Unrecognised lines are left as "quote".
  const coverage = Array.isArray(suppliedCategories) ? suppliedCategories : [];
  const outOfCoverage = (m) => {
    if (coverage.length === 0) return false;
    const cat = classifyMaterial(m.name, m.category);
    return cat !== "other" && !coverage.includes(cat);
  };

  // Each line starts as "quote" with an empty price, offering the full quantity
  // requested. The shop can flip a line to "substitute" (offer a different item
  // it does carry), "decline" (can't supply), or lower the quantity when it only
  // has partial stock (e.g. builder needs 11 plywood, shop only has 5).
  const [lines, setLines] = useState(() =>
    materials.map((m) =>
      outOfCoverage(m)
        ? { mode: "decline", price: "", note: "Outside our supply categories", subName: "", qty: m.quantity || 0 }
        : { mode: "quote", price: "", note: "", subName: "", qty: m.quantity || 0 }
    )
  );
  const [note, setNote] = useState("");

  const patchLine = (index, patch) =>
    setLines(prev => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  const setMode     = (index, mode) => patchLine(index, { mode });
  const setPrice    = (index, val)  => patchLine(index, { price: val === "" ? "" : Math.max(0, parseFloat(val) || 0) });
  const setLineNote = (index, val)  => patchLine(index, { note: val });
  const setSubName  = (index, val)  => patchLine(index, { subName: val });
  const setQty      = (index, val, requestedQty) => {
    if (val === "") return patchLine(index, { qty: "" });
    const n = Math.max(1, Math.min(Math.round(Number(val) || 0), requestedQty));
    patchLine(index, { qty: n });
  };

  const rows = materials.map((m, i) => {
    const l = lines[i] || { mode: "quote", price: "", note: "", subName: "", qty: m.quantity || 0 };
    const requestedQty = m.quantity || 0;
    const qty = l.qty === "" ? "" : (l.qty ?? requestedQty);
    const qtyNum = Number(qty) || 0;
    const priceNum = Number(l.price) || 0;
    const priced = l.mode === "quote" || l.mode === "substitute";
    const partial = priced && qtyNum > 0 && qtyNum < requestedQty;
    return {
      index: i,
      mode: l.mode,
      note: l.note,
      subName: l.subName || "",
      qty: qtyNum,
      qtyRaw: qty,
      requestedQty,
      partial,
      priceRaw: l.price,
      price: priceNum,
      subtotal: priced ? qtyNum * priceNum : 0,
      productName: m.name,
      unit: m.unit || "piece",
      size: m.size || "",
      category: m.category || "",
    };
  });

  const quotedRows = rows.filter(r => r.mode === "quote");
  const subRows    = rows.filter(r => r.mode === "substitute");
  const declineRows = rows.filter(r => r.mode === "decline");

  const quotedPriced = quotedRows.filter(r => r.price > 0 && r.qty > 0);
  const subValid     = subRows.filter(r => r.subName.trim() && r.price > 0 && r.qty > 0);

  const missingQuotePrice = quotedRows.length - quotedPriced.length;
  const missingSubInfo    = subRows.length - subValid.length;
  const incomplete = missingQuotePrice + missingSubInfo;

  const supplyRows = [...quotedPriced, ...subValid];
  const total = supplyRows.reduce((sum, r) => sum + r.subtotal, 0);
  const partialCount = supplyRows.filter(r => r.partial).length;
  const canSubmit = !submitting && supplyRows.length > 0 && incomplete === 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const items = rows.map(r => {
      const base = {
        unit: r.unit, size: r.size, category: r.category,
        lineNote: (r.note || "").trim(),
      };
      if (r.mode === "decline") {
        return { ...base, productName: r.productName, status: "declined", qty: r.requestedQty, price: 0, subtotal: 0 };
      }
      const partialFields = r.partial ? { requestedQty: r.requestedQty } : {};
      if (r.mode === "substitute") {
        return {
          ...base,
          ...partialFields,
          productName: r.subName.trim() || r.productName,
          requestedName: r.productName,
          status: "substituted",
          qty: r.qty,
          price: r.price,
          subtotal: r.subtotal,
        };
      }
      return { ...base, ...partialFields, productName: r.productName, status: "quoted", qty: r.qty, price: r.price, subtotal: r.subtotal };
    });
    onSubmit({
      projectId: project.id,
      amount: total,
      note,
      items,
      quotedCount: quotedRows.length,
      substitutedCount: subRows.length,
      declinedCount: declineRows.length,
    });
  };

  const infoPills = [
    project.totalAreaSqm   != null && { label: "Area",        value: `${project.totalAreaSqm} sqm` },
    baseline                       && { label: "DPWH est.",   value: peso(baseline.materialsTotal) },
    project.quotationCount != null && { label: "Bids so far", value: project.quotationCount },
    project.budget                 && { label: "Budget",      value: project.budget },
    project.locationCity           && { label: "Location",    value: project.locationCity },
  ].filter(Boolean);

  const btnLabel = submitting
    ? "Submitting..."
    : incomplete > 0
      ? `Finish ${incomplete} more line${incomplete > 1 ? "s" : ""}`
      : supplyRows.length > 0
        ? `Submit Quote — ${peso(total)}`
        : "Price or substitute at least 1 item";

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(15,23,42,0.55)",
        backdropFilter: "blur(6px)",
        zIndex: 300,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "#fff", borderRadius: 18,
        width: "100%", maxWidth: 640,
        maxHeight: "90vh", display: "flex", flexDirection: "column",
        boxShadow: "0 32px 80px rgba(0,0,0,0.25)",
        overflow: "hidden",
      }}>

        {/* Header */}
        <div style={{ background: accentGradient, padding: "20px 24px", flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(237,228,212,0.6)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 4 }}>
            Submit Quotation
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 2 }}>
            {project.projectName || "Project"}
          </div>
          <div style={{ fontSize: 12, color: "rgba(237,228,212,0.7)", marginBottom: infoPills.length ? 10 : 0 }}>
            {project.projectType || "—"}
            {materials.length > 0 && ` · ${materials.slice(0, 3).map(m => m.name).join(", ")}`}
          </div>
          {infoPills.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
              {infoPills.map(pill => (
                <div key={pill.label} style={{
                  background: "rgba(255,255,255,0.15)",
                  border: "1px solid rgba(255,255,255,0.25)",
                  borderRadius: 20, padding: "4px 12px",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(237,228,212,0.65)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    {pill.label}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>
                    {pill.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#94A3B8", marginBottom: 4 }}>
            Project Items — Price, Substitute or Mark Unavailable
          </div>
          <div style={{ fontSize: 12, color: "#94A3B8", marginBottom: 14 }}>
            Enter your price for each item you can supply. Only have part of the stock?
            Lower the <strong style={{ color: "#1D4ED8" }}>quantity</strong> — the builder will see exactly how much you can fill and can
            source the rest elsewhere. Don't carry the exact item?
            Tap <strong style={{ color: AMBER }}>Substitute</strong> to offer an equivalent, or
            <strong style={{ color: "#B91C1C" }}> Unavailable</strong> to skip it. You can still send the quote.
          </div>

          {materials.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0", color: "#94A3B8", fontSize: 13 }}>
              No items listed in this project.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {rows.map((r) => {
                const m = materials[r.index];
                const isQuote = r.mode === "quote";
                const isSub   = r.mode === "substitute";
                const isDecl  = r.mode === "decline";
                const active  = (isQuote || isSub) && r.price > 0;

                const ref = showLineRef && refPricing && !isDecl
                  ? referenceUnitPrice(m.name, r.category, refPricing)
                  : null;
                const refDiffPct = ref && r.price > 0
                  ? Math.round(((r.price - ref.price) / ref.price) * 100)
                  : null;

                const borderColor = isDecl ? "#FCA5A5" : isSub ? "#FCD34D" : active ? accentColor + "50" : "#E4E9F0";
                const bgColor     = isDecl ? "#FEF2F2" : isSub ? "#FFFBEB" : active ? accentColor + "08" : "#F8FAFC";
                const seg = (label, mode, on, onColor) => (
                  <button
                    type="button"
                    onClick={() => setMode(r.index, mode)}
                    style={{
                      padding: "7px 10px", fontSize: 10.5, fontWeight: 700, cursor: "pointer", border: "none",
                      borderLeft: label !== "Quote" ? "1px solid #E4E9F0" : "none",
                      background: on ? onColor : "#fff",
                      color: on ? "#fff" : "#64748B",
                    }}
                  >
                    {label}
                  </button>
                );

                return (
                  <div key={r.index} style={{
                    border: `1.5px solid ${borderColor}`,
                    borderRadius: 10, padding: "12px 16px",
                    background: bgColor,
                    transition: "all 0.15s",
                  }}>
                    {/* Row 1: identity + mode toggle */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>

                      <MaterialImage accentColor={accentColor} active={active} />

                      <div style={{ flex: "1 1 140px", minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: isDecl ? "#B91C1C" : "#0F172A", textDecoration: isDecl ? "line-through" : "none", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          {m.name}
                          {isSub && <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.06em", color: AMBER, background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: 5, padding: "1px 5px" }}>SUBSTITUTE</span>}
                          {r.partial && <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.06em", color: "#1D4ED8", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 5, padding: "1px 5px" }}>PARTIAL</span>}
                        </div>
                        <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                          Needs {r.requestedQty} {r.unit}
                          {r.size && ` · ${r.size}`}
                          {r.category && ` · ${r.category}`}
                        </div>
                      </div>

                      {/* Quote / Substitute / Unavailable toggle */}
                      <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: "1px solid #E4E9F0", flexShrink: 0 }}>
                        {seg("Quote", "quote", isQuote, accentColor)}
                        {seg("Substitute", "substitute", isSub, AMBER)}
                        {seg("Unavailable", "decline", isDecl, "#DC2626")}
                      </div>
                    </div>

                    {/* Row 2: quantity you can supply + price + subtotal (own row so it
                        never wraps against the mode buttons above) */}
                    {(isQuote || isSub) && (
                      <div style={{
                        display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap",
                        marginTop: 10, paddingTop: 10, borderTop: "1px dashed #E4E9F0",
                      }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 3, flexShrink: 0 }}>
                          <label style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                            QTY YOU CAN SUPPLY
                          </label>
                          <input
                            type="number" min="1" max={r.requestedQty}
                            value={r.qtyRaw === "" ? "" : r.qty || ""}
                            placeholder={String(r.requestedQty)}
                            onChange={e => setQty(r.index, e.target.value, r.requestedQty)}
                            style={{
                              width: 80, padding: "6px 8px",
                              border: `1.5px solid ${r.partial ? "#1D4ED8" : "#E4E9F0"}`,
                              borderRadius: 7, fontSize: 13, fontWeight: 600,
                              textAlign: "center", outline: "none",
                              color: "#0F172A", background: "#fff",
                            }}
                          />
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 3, flexShrink: 0 }}>
                          <label style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.08em", textTransform: "uppercase" }}>PRICE (₱)</label>
                          <input
                            type="number" min="0"
                            value={r.priceRaw === "" ? "" : r.price || ""}
                            placeholder="0"
                            onChange={e => setPrice(r.index, e.target.value)}
                            style={{
                              width: 90, padding: "6px 8px",
                              border: `1.5px solid ${active ? (isSub ? AMBER : accentColor) : "#E4E9F0"}`,
                              borderRadius: 7, fontSize: 13, fontWeight: 600,
                              textAlign: "center", outline: "none",
                              color: "#0F172A", background: "#fff",
                            }}
                          />
                        </div>

                        <div style={{ minWidth: 80, textAlign: "right", flexShrink: 0, marginLeft: "auto" }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 3 }}>SUBTOTAL</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: active ? (isSub ? AMBER : accentColor) : "#CBD5E1" }}>
                            {active ? peso(r.subtotal) : "—"}
                          </div>
                        </div>

                        {r.partial && (
                          <div style={{ flexBasis: "100%", fontSize: 11, color: "#1D4ED8" }}>
                            Builder will see {r.qty} of {r.requestedQty} {r.unit} fulfilled — they can source the rest elsewhere.
                          </div>
                        )}
                      </div>
                    )}

                    {/* DPWH reference price (Pro / Business) */}
                    {ref && (
                      <div style={{ fontSize: 11, color: "#64748B", marginTop: 8 }}>
                        DPWH reference: <strong>{peso(ref.price)}/{ref.unit}</strong>
                        {refDiffPct != null && (
                          <span style={{
                            marginLeft: 6, fontWeight: 700,
                            color: refDiffPct > 10 ? "#B45309" : refDiffPct < -10 ? "#1D4ED8" : "#059669",
                          }}>
                            · your price is {refDiffPct > 0 ? `${refDiffPct}% above` : refDiffPct < 0 ? `${Math.abs(refDiffPct)}% below` : "on"} reference
                          </span>
                        )}
                      </div>
                    )}

                    {/* Substitute name */}
                    {isSub && (
                      <input
                        value={r.subName}
                        onChange={e => setSubName(r.index, e.target.value)}
                        placeholder="What you'll supply instead — e.g. 12mm rebar (thicker, same length)"
                        style={{
                          width: "100%", marginTop: 10, padding: "8px 10px",
                          border: `1px solid ${r.subName.trim() ? "#FCD34D" : "#E4E9F0"}`,
                          borderRadius: 7, fontSize: 12.5, fontWeight: 600,
                          outline: "none", color: "#92400E", background: "#fff", boxSizing: "border-box",
                        }}
                      />
                    )}

                    {/* Per-line note */}
                    <input
                      value={r.note}
                      onChange={e => setLineNote(r.index, e.target.value)}
                      placeholder={
                        isDecl ? "Reason (optional) — e.g. we don't carry this / out of stock"
                        : isSub ? "Note for the builder (optional) — why this is a good match"
                        : "Note for this item (optional) — e.g. delivery lead time"
                      }
                      style={{
                        width: "100%", marginTop: 10, padding: "7px 10px",
                        border: "1px solid #E4E9F0", borderRadius: 7, fontSize: 12,
                        outline: "none", color: "#334155", background: "#fff", boxSizing: "border-box",
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Quote summary */}
          {(quotedPriced.length > 0 || subValid.length > 0 || declineRows.length > 0) && (
            <div style={{ background: "#F8FAFC", borderRadius: 10, border: "1px solid #E4E9F0", padding: "14px 16px", marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
                Quote Summary — {quotedPriced.length} quoted
                {subValid.length > 0 ? ` · ${subValid.length} substitute` : ""}
                {declineRows.length > 0 ? ` · ${declineRows.length} unavailable` : ""}
                {partialCount > 0 ? ` · ${partialCount} partial` : ""}
              </div>
              {quotedPriced.map((item, i) => (
                <div key={`q${i}`} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6, color: "#334155" }}>
                  <span>
                    {item.productName} × {item.qty} {item.unit}
                    {item.partial && <span style={{ color: "#1D4ED8", fontWeight: 600 }}> (of {item.requestedQty} needed)</span>}
                  </span>
                  <span style={{ fontWeight: 600 }}>{peso(item.subtotal)}</span>
                </div>
              ))}
              {subValid.map((item, i) => (
                <div key={`s${i}`} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6, color: "#92400E" }}>
                  <span>
                    {item.subName.trim()} <span style={{ color: "#B45309" }}>(instead of {item.productName})</span> × {item.qty}
                    {item.partial && <span style={{ color: "#1D4ED8", fontWeight: 600 }}> (of {item.requestedQty} needed)</span>}
                  </span>
                  <span style={{ fontWeight: 600 }}>{peso(item.subtotal)}</span>
                </div>
              ))}
              {declineRows.map((item, i) => (
                <div key={`d${i}`} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6, color: "#B91C1C" }}>
                  <span>{item.productName}{item.note ? ` — ${item.note}` : ""}</span>
                  <span style={{ fontWeight: 600 }}>Unavailable</span>
                </div>
              ))}
              <div style={{ borderTop: "1px solid #E4E9F0", marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Total</span>
                <span style={{ fontSize: 18, fontWeight: 900, color: accentColor, fontFamily: "var(--font-base)" }}>{peso(total)}</span>
              </div>
            </div>
          )}

          {showBaselineWarning && baseline && total > 0 && (() => {
            const base = baseline.materialsTotal || 0;
            const diffPct = base > 0 ? Math.round(((total - base) / base) * 100) : 0;
            const high = diffPct > 10, low = diffPct < -10;
            const c = high
              ? { bg: "#FEF3C7", bd: "#FCD34D", fg: "#92400E" }
              : low
                ? { bg: "#EFF6FF", bd: "#BFDBFE", fg: "#1D4ED8" }
                : { bg: "#ECFDF5", bd: "#6EE7B7", fg: "#065F46" };
            return (
              <div style={{ fontSize: 12, color: c.fg, background: c.bg, border: `1px solid ${c.bd}`, borderRadius: 8, padding: "9px 12px", marginBottom: 12, lineHeight: 1.5 }}>
                {high
                  ? `Your quote is ${diffPct}% above the DPWH baseline of ${peso(base)} (materials).`
                  : low
                    ? `Your quote is ${Math.abs(diffPct)}% below the DPWH baseline of ${peso(base)} (materials).`
                    : `Your quote is in line with the DPWH baseline (${peso(base)} materials).`}
                {" "}Reference only — you decide the final price.
              </div>
            );
          })()}

          {incomplete > 0 && (
            <div style={{ fontSize: 12, color: "#B45309", background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: 8, padding: "9px 12px", marginBottom: 12 }}>
              {missingQuotePrice > 0 && <div>{missingQuotePrice} item{missingQuotePrice > 1 ? "s" : ""} set to <strong>Quote</strong> without a price.</div>}
              {missingSubInfo > 0 && <div>{missingSubInfo} <strong>Substitute</strong> line{missingSubInfo > 1 ? "s" : ""} missing the item name or price.</div>}
            </div>
          )}

          {/* Notes */}
          <div style={{ marginBottom: 4 }}>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: "#334155", display: "block", marginBottom: 5 }}>Overall note to the builder (optional)</label>
            <textarea
              rows={2} value={note} onChange={e => setNote(e.target.value)}
              placeholder="Delivery terms, lead time, payment conditions..."
              style={{ width: "100%", padding: "10px 14px", border: "1.5px solid #E4E9F0", borderRadius: 8, fontSize: 13, fontFamily: "var(--font-base)", resize: "none", outline: "none", color: "#0F172A", boxSizing: "border-box" }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 24px", borderTop: "1px solid #E4E9F0", display: "flex", gap: 10, alignItems: "center", flexShrink: 0, background: "#FAFAF8" }}>
          <button onClick={onClose} style={{ padding: "11px 20px", borderRadius: 8, border: "1px solid #E4E9F0", background: "#F8FAFC", fontSize: 13, fontWeight: 500, color: "#64748B", cursor: "pointer" }}>
            Cancel
          </button>
          <button
            disabled={!canSubmit} onClick={handleSubmit}
            style={{ flex: 1, padding: "11px", borderRadius: 8, border: "none", background: canSubmit ? accentGradient : "#E4E9F0", color: canSubmit ? "#fff" : "#94A3B8", fontSize: 13, fontWeight: 700, cursor: canSubmit ? "pointer" : "not-allowed", transition: "all 0.15s" }}
          >
            {btnLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
