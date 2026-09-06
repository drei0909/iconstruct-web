// src/components/QuoteModal.jsx
import { useState, useEffect } from "react";
import { Package } from "@phosphor-icons/react";
import { db } from "../services/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

const peso = (n) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency", currency: "PHP", maximumFractionDigits: 0,
  }).format(n ?? 0);

// Looks up product images from Firestore by matching material name
async function fetchProductImages(materials) {
  const imageMap = {}; // { materialName: imageUrl }

  const names = [...new Set(materials.map(m => m.name).filter(Boolean))];
  if (names.length === 0) return imageMap;

  try {
    // Firestore "in" query supports up to 10 items at a time
    const chunks = [];
    for (let i = 0; i < names.length; i += 10) {
      chunks.push(names.slice(i, i + 10));
    }

    for (const chunk of chunks) {
      const q = query(
        collection(db, "products"),
        where("name", "in", chunk)
      );
      const snap = await getDocs(q);
      snap.docs.forEach(doc => {
        const data = doc.data();
        const img = data.imageUrl || data.imageBase64 || data.image || null;
        if (img && data.name) {
          imageMap[data.name] = img;
        }
      });
    }
  } catch (err) {
    console.warn("Could not fetch product images:", err.message);
  }

  return imageMap;
}

function MaterialImage({ name, imageUrl, accentColor, active }) {
  const [imgError, setImgError] = useState(false);

  if (imageUrl && !imgError) {
    return (
      <img
        src={imageUrl}
        alt={name}
        onError={() => setImgError(true)}
        style={{
          width: 44, height: 44, borderRadius: 8,
          objectFit: "cover", flexShrink: 0,
          border: `1px solid ${active ? accentColor + "30" : "#E4E9F0"}`,
        }}
      />
    );
  }

  // Fallback — Phosphor icon
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

export default function QuoteModal({
  project,
  onClose,
  onSubmit,
  submitting,
  accentColor = "#2C3E50",
  accentGradient = "linear-gradient(180deg, #2C3E50 30%, #648DB6 100%)",
}) {
  const materials = Array.isArray(project.materials) ? project.materials : [];

  // Every line starts as "quote" with an empty price. The shop flips the
  // 1–2 it cannot supply to "decline" and adds a reason.
  const [lines, setLines] = useState(() =>
    materials.map(() => ({ mode: "quote", price: "", note: "" }))
  );
  const [note, setNote] = useState("");

  // Image map: { materialName -> imageUrl }
  const [imageMap, setImageMap] = useState({});
  const [imagesLoading, setImagesLoading] = useState(true);

  // Fetch product images on mount by matching material name to products collection
  useEffect(() => {
    if (materials.length === 0) {
      setImagesLoading(false);
      return;
    }
    fetchProductImages(materials).then(map => {
      setImageMap(map);
      setImagesLoading(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const patchLine = (index, patch) =>
    setLines(prev => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  const setMode  = (index, mode) => patchLine(index, { mode });
  const setPrice = (index, val)  => patchLine(index, { price: val === "" ? "" : Math.max(0, parseFloat(val) || 0) });
  const setLineNote = (index, val) => patchLine(index, { note: val });

  const rows = materials.map((m, i) => {
    const l = lines[i] || { mode: "quote", price: "", note: "" };
    const qty = m.quantity || 0;
    const priceNum = Number(l.price) || 0;
    return {
      index: i,
      mode: l.mode,
      note: l.note,
      qty,
      priceRaw: l.price,
      price: priceNum,
      subtotal: l.mode === "quote" ? qty * priceNum : 0,
      productName: m.name,
      unit: m.unit || "piece",
      size: m.size || "",
      category: m.category || "",
    };
  });

  const quotedRows   = rows.filter(r => r.mode === "quote");
  const pricedRows   = quotedRows.filter(r => r.price > 0);
  const missingPrice = quotedRows.length - pricedRows.length;
  const declinedRows = rows.filter(r => r.mode === "decline");
  const total = pricedRows.reduce((sum, r) => sum + r.subtotal, 0);

  const canSubmit = !submitting && pricedRows.length > 0 && missingPrice === 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const items = rows.map(r => ({
      productName: r.productName,
      unit:        r.unit,
      size:        r.size,
      category:    r.category,
      qty:         r.qty,
      status:      r.mode === "decline" ? "declined" : "quoted",
      price:       r.mode === "decline" ? 0 : r.price,
      subtotal:    r.mode === "decline" ? 0 : r.subtotal,
      lineNote:    (r.note || "").trim(),
    }));
    onSubmit({
      projectId: project.id,
      amount: total,
      note,
      items,
      quotedCount: quotedRows.length,
      declinedCount: declinedRows.length,
    });
  };

  const infoPills = [
    project.totalAreaSqm   != null && { label: "Area",        value: `${project.totalAreaSqm} sqm` },
    project.quotationCount != null && { label: "Bids so far", value: project.quotationCount },
    project.budget                 && { label: "Budget",      value: project.budget },
    project.locationCity           && { label: "Location",    value: project.locationCity },
  ].filter(Boolean);

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
            Project Items — Price or Mark Unavailable
          </div>
          <div style={{ fontSize: 12, color: "#94A3B8", marginBottom: 14 }}>
            Enter your price per unit for each item you can supply. For anything you don't
            carry, tap <strong>Unavailable</strong> and add a short reason — you can still send the quote.
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
                const active  = isQuote && r.price > 0;
                const imgUrl  = imagesLoading ? null : (imageMap[m.name] || null);

                return (
                  <div key={r.index} style={{
                    border: `1.5px solid ${!isQuote ? "#FCA5A5" : active ? accentColor + "50" : "#E4E9F0"}`,
                    borderRadius: 10, padding: "12px 16px",
                    background: !isQuote ? "#FEF2F2" : active ? accentColor + "08" : "#F8FAFC",
                    transition: "all 0.15s",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>

                      <MaterialImage
                        name={m.name}
                        imageUrl={imgUrl}
                        accentColor={accentColor}
                        active={active}
                      />

                      <div style={{ flex: "1 1 140px", minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: !isQuote ? "#B91C1C" : "#0F172A", textDecoration: !isQuote ? "line-through" : "none" }}>{m.name}</div>
                        <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                          {r.qty} {r.unit}
                          {r.size && ` · ${r.size}`}
                          {r.category && ` · ${r.category}`}
                        </div>
                      </div>

                      {/* Quote / Unavailable toggle */}
                      <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: "1px solid #E4E9F0", flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => setMode(r.index, "quote")}
                          style={{
                            padding: "7px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", border: "none",
                            background: isQuote ? accentColor : "#fff",
                            color: isQuote ? "#fff" : "#64748B",
                          }}
                        >
                          Quote
                        </button>
                        <button
                          type="button"
                          onClick={() => setMode(r.index, "decline")}
                          style={{
                            padding: "7px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", border: "none",
                            borderLeft: "1px solid #E4E9F0",
                            background: !isQuote ? "#DC2626" : "#fff",
                            color: !isQuote ? "#fff" : "#64748B",
                          }}
                        >
                          Unavailable
                        </button>
                      </div>

                      {isQuote && (
                        <>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flexShrink: 0 }}>
                            <label style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.08em", textTransform: "uppercase" }}>PRICE (₱)</label>
                            <input
                              type="number" min="0"
                              value={r.priceRaw === "" ? "" : r.price || ""}
                              placeholder="0"
                              onChange={e => setPrice(r.index, e.target.value)}
                              style={{
                                width: 90, padding: "6px 8px",
                                border: `1.5px solid ${active ? accentColor : "#E4E9F0"}`,
                                borderRadius: 7, fontSize: 13, fontWeight: 600,
                                textAlign: "center", outline: "none",
                                color: "#0F172A", background: "#fff",
                              }}
                            />
                          </div>
                          <div style={{ minWidth: 80, textAlign: "right", flexShrink: 0 }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 3 }}>SUBTOTAL</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: active ? accentColor : "#CBD5E1" }}>
                              {active ? peso(r.subtotal) : "—"}
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Per-line note */}
                    <input
                      value={r.note}
                      onChange={e => setLineNote(r.index, e.target.value)}
                      placeholder={isQuote ? "Note for this item (optional) — e.g. only 40 in stock" : "Reason (optional) — e.g. we don't carry this / out of stock"}
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
          {(pricedRows.length > 0 || declinedRows.length > 0) && (
            <div style={{ background: "#F8FAFC", borderRadius: 10, border: "1px solid #E4E9F0", padding: "14px 16px", marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
                Quote Summary — {pricedRows.length} quoted{declinedRows.length > 0 ? ` · ${declinedRows.length} unavailable` : ""}
              </div>
              {pricedRows.map((item, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6, color: "#334155" }}>
                  <span>{item.productName} × {item.qty} {item.unit}</span>
                  <span style={{ fontWeight: 600 }}>{peso(item.subtotal)}</span>
                </div>
              ))}
              {declinedRows.map((item, i) => (
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

          {missingPrice > 0 && (
            <div style={{ fontSize: 12, color: "#B45309", background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: 8, padding: "9px 12px", marginBottom: 12 }}>
              {missingPrice} item{missingPrice > 1 ? "s are" : " is"} still set to <strong>Quote</strong> without a price. Enter a price or mark {missingPrice > 1 ? "them" : "it"} Unavailable.
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
            {submitting
              ? "Submitting..."
              : missingPrice > 0
                ? `Price ${missingPrice} more item${missingPrice > 1 ? "s" : ""}`
                : pricedRows.length > 0
                  ? `Submit Quote — ${peso(total)}`
                  : "Price at least 1 item"}
          </button>
        </div>
      </div>
    </div>
  );
}