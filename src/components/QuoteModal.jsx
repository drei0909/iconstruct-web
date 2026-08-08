// src/components/QuoteModal.jsx
import { useState, useEffect } from "react";
import { Package } from "@phosphor-icons/react";
import { db } from "../services/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { loadQuoteTemplates, addQuoteTemplate } from "../utils/quoteTemplates";

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
  /** Pro/Business: show average accepted bid as a pricing guide */
  pricingGuide = null,
  /** Pro/Business: enable saved note templates */
  enableTemplates = false,
  shopId = null,
}) {
  const materials = Array.isArray(project.materials) ? project.materials : [];

  const [prices, setPrices] = useState(() => {
    const init = {};
    materials.forEach((m, i) => { init[i] = ""; });
    return init;
  });
  const [note, setNote] = useState("");
  const [templates, setTemplates] = useState([]);
  const [templateSaved, setTemplateSaved] = useState(false);

  // Image map: { materialName -> imageUrl }
  const [imageMap, setImageMap] = useState({});
  const [imagesLoading, setImagesLoading] = useState(true);

  useEffect(() => {
    if (enableTemplates && shopId) {
      setTemplates(loadQuoteTemplates(shopId));
    }
  }, [enableTemplates, shopId]);

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

  const setPrice = (index, val) => {
    const price = Math.max(0, parseFloat(val) || 0);
    setPrices(prev => ({ ...prev, [index]: price }));
  };

  const selectedItems = materials
    .map((m, i) => ({
      productName: m.name,
      unit:        m.unit || "piece",
      size:        m.size || "",
      category:    m.category || "",
      qty:         m.quantity || 0,
      price:       prices[i] || 0,
      subtotal:    (m.quantity || 0) * (prices[i] || 0),
    }))
    .filter(item => item.price > 0);

  const total = selectedItems.reduce((sum, i) => sum + i.subtotal, 0);
  const canSubmit = selectedItems.length > 0 && !submitting;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      projectId: project.id,
      amount: total,
      note,
      items: selectedItems,
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
      className="quote-modal-overlay"
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
      <div
        className="quote-modal-card"
        style={{
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
            Project Materials — Set Your Price
          </div>
          <div style={{ fontSize: 12, color: "#94A3B8", marginBottom: 14 }}>
            Quantities are from the project post. Enter your price per unit for each item you can supply.
          </div>

          {materials.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0", color: "#94A3B8", fontSize: 13 }}>
              No materials listed in this project.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {materials.map((m, i) => {
                const price  = prices[i] || 0;
                const qty    = m.quantity || 0;
                const sub    = qty * price;
                const active = price > 0;
                const imgUrl = imagesLoading ? null : (imageMap[m.name] || null);

                return (
                  <div key={i} style={{
                    border: `1.5px solid ${active ? accentColor + "50" : "#E4E9F0"}`,
                    borderRadius: 10, padding: "12px 16px",
                    background: active ? accentColor + "08" : "#F8FAFC",
                    transition: "all 0.15s",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>

                      {/* Real product image or Phosphor fallback */}
                      <MaterialImage
                        name={m.name}
                        imageUrl={imgUrl}
                        accentColor={accentColor}
                        active={active}
                      />

                      {/* Material info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A" }}>{m.name}</div>
                        <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                          {m.unit || "piece"}
                          {m.size && ` · ${m.size}`}
                          {m.category && ` · ${m.category}`}
                        </div>
                      </div>

                      {/* QTY — read only */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flexShrink: 0 }}>
                        <label style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.08em", textTransform: "uppercase" }}>QTY</label>
                        <div style={{
                          width: 60, padding: "6px 8px",
                          border: "1.5px solid #E4E9F0",
                          borderRadius: 7, fontSize: 13, fontWeight: 600,
                          textAlign: "center", color: "#0F172A",
                          background: "#F1F5F9",
                        }}>
                          {qty}
                        </div>
                      </div>

                      {/* PRICE — editable */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flexShrink: 0 }}>
                        <label style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.08em", textTransform: "uppercase" }}>PRICE (₱)</label>
                        <input
                          type="number" min="0"
                          value={price || ""}
                          placeholder="0"
                          onChange={e => setPrice(i, e.target.value)}
                          style={{
                            width: 90, padding: "6px 8px",
                            border: `1.5px solid ${active ? accentColor : "#E4E9F0"}`,
                            borderRadius: 7, fontSize: 13, fontWeight: 600,
                            textAlign: "center", outline: "none",
                            color: "#0F172A", background: "#fff",
                          }}
                        />
                      </div>

                      {/* SUBTOTAL */}
                      <div style={{ minWidth: 80, textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 3 }}>SUBTOTAL</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: active ? accentColor : "#CBD5E1" }}>
                          {active ? peso(sub) : "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quote summary */}
          {selectedItems.length > 0 && (
            <div style={{ background: "#F8FAFC", borderRadius: 10, border: "1px solid #E4E9F0", padding: "14px 16px", marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
                Quote Summary ({selectedItems.length} item{selectedItems.length > 1 ? "s" : ""})
              </div>
              {selectedItems.map((item, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6, color: "#334155" }}>
                  <span>{item.productName} × {item.qty} {item.unit}</span>
                  <span style={{ fontWeight: 600 }}>{peso(item.subtotal)}</span>
                </div>
              ))}
              <div style={{ borderTop: "1px solid #E4E9F0", marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Total</span>
                <span style={{ fontSize: 18, fontWeight: 900, color: accentColor, fontFamily: "var(--font-base)" }}>{peso(total)}</span>
              </div>
              {pricingGuide?.avgAccepted > 0 && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed #E4E9F0", fontSize: 11.5, color: "#64748B", lineHeight: 1.5 }}>
                  Your accepted bids average <strong style={{ color: accentColor }}>{pricingGuide.format?.avgAccepted || peso(pricingGuide.avgAccepted)}</strong>
                  {pricingGuide.winRate != null && <> · win rate {pricingGuide.winRate}%</>}.
                  {total > 0 && pricingGuide.avgAccepted > 0 && total > pricingGuide.avgAccepted * 1.25 && (
                    <span style={{ display: "block", marginTop: 4, color: "#B45309" }}>
                      This total is notably higher than your wins — tighten if competing hard.
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Notes + Pro/Business templates */}
          <div style={{ marginBottom: 4 }}>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: "#334155", display: "block", marginBottom: 5 }}>Notes (optional)</label>
            {enableTemplates && templates.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                {templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setNote(t.note)}
                    style={{
                      fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 20,
                      border: `1px solid ${accentColor}40`, background: `${accentColor}10`,
                      color: accentColor, cursor: "pointer",
                    }}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            )}
            <textarea
              rows={2} value={note} onChange={e => { setNote(e.target.value); setTemplateSaved(false); }}
              placeholder="Delivery terms, availability, conditions..."
              style={{ width: "100%", padding: "10px 14px", border: "1.5px solid #E4E9F0", borderRadius: 8, fontSize: 13, fontFamily: "var(--font-base)", resize: "none", outline: "none", color: "#0F172A", boxSizing: "border-box" }}
            />
            {enableTemplates && note.trim().length > 8 && shopId && (
              <button
                type="button"
                onClick={() => {
                  const next = addQuoteTemplate(shopId, {
                    name: note.trim().slice(0, 28) + (note.length > 28 ? "…" : ""),
                    note: note.trim(),
                  });
                  setTemplates(next);
                  setTemplateSaved(true);
                }}
                style={{
                  marginTop: 6, fontSize: 11, fontWeight: 600, background: "none", border: "none",
                  color: templateSaved ? "#059669" : accentColor, cursor: "pointer", padding: 0,
                }}
              >
                {templateSaved ? "Saved to templates ✓" : "Save note as template"}
              </button>
            )}
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
            {submitting ? "Submitting..." : selectedItems.length > 0 ? `Submit Quote — ${peso(total)}` : "Set price for at least 1 item"}
          </button>
        </div>
      </div>
    </div>
  );
}