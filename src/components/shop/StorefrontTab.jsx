// "My Storefront" — the shop's public profile a builder sees when choosing who
// to contact. Not a product catalog: identity, coverage, hours, contact.

import { useEffect, useState } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../../services/firebase";
import { Storefront, MapPin, Clock, Phone, X } from "@phosphor-icons/react";
import { categoryLabel } from "../../utils/supplyCategories";
import { LIPA_BARANGAYS, LIPA_CITY } from "../../utils/lipaBarangays";

const initials = (name = "") =>
  name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "S";

export default function StorefrontTab({ shop, onShopUpdated, accentColor = "#2C5282", plan = "basic" }) {
  const isPaid = plan === "pro" || plan === "business";

  const [form, setForm] = useState({
    description: "",
    businessHours: "",
    storefrontAbout: "",
  });
  const [cities, setCities] = useState([]);
  const [cityDraft, setCityDraft] = useState("");
  const [selectedBrgy, setSelectedBrgy] = useState("");
  const [sitioDraft, setSitioDraft] = useState("");
  const [showSug, setShowSug] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!shop) return;
    setForm({
      description: shop.description || "",
      businessHours: shop.businessHours || "",
      storefrontAbout: shop.storefrontAbout || "",
    });
    setCities(Array.isArray(shop.coverageCities) ? shop.coverageCities : []);
  }, [shop]);

  const q = cityDraft.trim().toLowerCase();
  const suggestions = LIPA_BARANGAYS
    .filter((b) => !q || b.toLowerCase().includes(q))
    .slice(0, 8);

  const pickBarangay = (barangay) => {
    setSelectedBrgy(barangay);
    setCityDraft(barangay);
    setShowSug(false);
  };

  const addArea = () => {
    if (!selectedBrgy) return;
    const sub = sitioDraft.trim();
    const val = sub
      ? `${sub}, ${selectedBrgy}, ${LIPA_CITY}`
      : `${selectedBrgy}, ${LIPA_CITY}`;
    if (!cities.some((c) => c.toLowerCase() === val.toLowerCase())) {
      setCities((c) => [...c, val]);
    }
    setCityDraft("");
    setSelectedBrgy("");
    setSitioDraft("");
    setShowSug(false);
  };

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated.");
      const payload = {
        description: form.description.trim(),
        businessHours: form.businessHours.trim(),
        coverageCities: cities,
        updatedAt: serverTimestamp(),
      };
      if (isPaid) payload.storefrontAbout = form.storefrontAbout.trim();
      await updateDoc(doc(db, "shops", user.uid), payload);
      onShopUpdated?.({ ...shop, ...payload });
      setMsg({ type: "success", text: "Storefront saved. Builders now see this." });
    } catch (err) {
      setMsg({ type: "error", text: err.message || "Failed to save." });
    } finally {
      setSaving(false);
    }
  };

  const labelStyle = { fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 5 };
  const inputStyle = {
    width: "100%", padding: "9px 12px", border: "1.5px solid #E2E8F0", borderRadius: 8,
    fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  };
  const suppliedLabels = (shop?.suppliedCategories || []).map(categoryLabel);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <Storefront size={20} color={accentColor} weight="duotone" />
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 700, color: "#0F172A", margin: 0 }}>
          My Storefront
        </h2>
      </div>
      <p style={{ fontSize: 12.5, color: "#64748B", margin: "0 0 18px", lineHeight: 1.6 }}>
        This is the profile builders see when they compare quotes and decide who
        to contact. Shop name, owner and address are edited in <strong>Settings</strong>.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,320px)", gap: 24, alignItems: "start" }}>
        {/* ── Form ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelStyle}>Short description (shown under your name)</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="e.g. Family-owned hardware, 15 years, bulk orders welcome."
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>

          <div>
            <label style={labelStyle}>Store hours</label>
            <input
              value={form.businessHours}
              onChange={(e) => setForm((f) => ({ ...f, businessHours: e.target.value }))}
              placeholder="e.g. Mon–Sat, 7:00 AM – 6:00 PM"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Coverage areas you serve (Lipa City)</label>

            {/* Step 1 — barangay from the official list */}
            <div style={{ position: "relative" }}>
              <input
                value={cityDraft}
                onChange={(e) => { setCityDraft(e.target.value); setSelectedBrgy(""); setShowSug(true); }}
                onFocus={() => setShowSug(true)}
                onBlur={() => setTimeout(() => setShowSug(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); if (suggestions[0]) pickBarangay(suggestions[0]); }
                  if (e.key === "Escape") setShowSug(false);
                }}
                placeholder="1. Type a barangay… e.g. Marauoy, San Jose, Poblacion"
                style={{ ...inputStyle, borderColor: selectedBrgy ? accentColor : "#E2E8F0" }}
              />
              {showSug && !selectedBrgy && (
                <div style={{
                  position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 20,
                  background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8,
                  boxShadow: "0 10px 30px rgba(15,23,42,0.12)", maxHeight: 240, overflowY: "auto",
                }}>
                  {suggestions.length === 0 ? (
                    <div style={{ padding: "10px 12px", fontSize: 12.5, color: "#94A3B8" }}>
                      No Lipa City barangay matches “{cityDraft.trim()}”.
                    </div>
                  ) : (
                    suggestions.map((b) => (
                      <button
                        key={b}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); pickBarangay(b); }}
                        style={{
                          display: "block", width: "100%", textAlign: "left",
                          padding: "9px 12px", border: "none", background: "transparent",
                          fontSize: 13, color: "#334155", cursor: "pointer", fontFamily: "inherit",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#F1F5F9")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        {b}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Step 2 — optional purok / sitio (free text — no official list exists below barangay) */}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input
                value={sitioDraft}
                onChange={(e) => setSitioDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addArea(); } }}
                disabled={!selectedBrgy}
                placeholder={selectedBrgy ? `2. Purok / sitio / subdivision in ${selectedBrgy} (optional)` : "Pick a barangay first"}
                style={{ ...inputStyle, background: selectedBrgy ? "#fff" : "#F8FAFC" }}
              />
              <button
                type="button"
                onClick={addArea}
                disabled={!selectedBrgy}
                style={{
                  padding: "0 18px", borderRadius: 8, border: "none", flexShrink: 0,
                  background: selectedBrgy ? accentColor : "#E2E8F0",
                  color: selectedBrgy ? "#fff" : "#94A3B8",
                  fontSize: 13, fontWeight: 700, cursor: selectedBrgy ? "pointer" : "not-allowed",
                }}
              >
                Add
              </button>
            </div>
            <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 4 }}>
              Barangay is picked from Lipa City's official list. Purok / sitio is optional and free text —
              there's no standard list below barangay level.
            </div>

            {cities.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {cities.map((c) => (
                  <span key={c} style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    fontSize: 12, fontWeight: 600, color: "#334155",
                    background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 16, padding: "3px 6px 3px 10px",
                  }}>
                    {c.replace(/,\s*Lipa City$/i, "")}
                    <button type="button" onClick={() => setCities((x) => x.filter((y) => y !== c))}
                      style={{ border: "none", background: "none", cursor: "pointer", color: "#94A3B8", display: "flex", padding: 2 }}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {isPaid && (
            <div>
              <label style={labelStyle}>
                About / specialties <span style={{ color: "#94A3B8", fontWeight: 500 }}>· {plan === "business" ? "Business" : "Pro"}</span>
              </label>
              <textarea
                rows={4}
                value={form.storefrontAbout}
                onChange={(e) => setForm((f) => ({ ...f, storefrontAbout: e.target.value }))}
                placeholder="Longer description — brands you carry, delivery notes, minimum orders, what you're known for."
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>
          )}

          {msg && (
            <div style={{
              fontSize: 12.5, padding: "9px 12px", borderRadius: 8,
              color: msg.type === "error" ? "#B91C1C" : "#065F46",
              background: msg.type === "error" ? "#FEF2F2" : "#ECFDF5",
              border: `1px solid ${msg.type === "error" ? "#FCA5A5" : "#6EE7B7"}`,
            }}>
              {msg.text}
            </div>
          )}

          <button
            type="button"
            onClick={save}
            disabled={saving}
            style={{
              alignSelf: "flex-start",
              padding: "11px 22px", borderRadius: 10, border: "none",
              background: saving ? "#E2E8F0" : `linear-gradient(135deg,${accentColor},#3B82F6)`,
              color: saving ? "#94A3B8" : "#fff",
              fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Saving…" : "Save storefront"}
          </button>
        </div>

        {/* ── Preview ── */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
            What builders see
          </div>
          <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ padding: "16px 16px 14px", display: "flex", gap: 12, alignItems: "center", borderBottom: "1px solid #F1F5F9" }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                background: `linear-gradient(135deg,${accentColor},#3B82F6)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: 15, fontWeight: 800,
              }}>
                {initials(shop?.shopName)}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {shop?.shopName || "Your shop"}
                </div>
                <div style={{ fontSize: 11.5, color: "#64748B" }}>
                  {[shop?.barangay, shop?.city].filter(Boolean).join(", ") || shop?.address || "—"}
                </div>
              </div>
            </div>
            <div style={{ padding: "12px 16px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
              {form.description && (
                <div style={{ fontSize: 12.5, color: "#334155", lineHeight: 1.5 }}>{form.description}</div>
              )}
              {suppliedLabels.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {suppliedLabels.map((l) => (
                    <span key={l} style={{ fontSize: 10.5, fontWeight: 600, color: accentColor, background: `${accentColor}12`, borderRadius: 6, padding: "2px 7px" }}>{l}</span>
                  ))}
                </div>
              )}
              {form.businessHours && (
                <div style={{ fontSize: 12, color: "#475569", display: "flex", alignItems: "center", gap: 6 }}>
                  <Clock size={13} color="#94A3B8" /> {form.businessHours}
                </div>
              )}
              {cities.length > 0 && (
                <div style={{ fontSize: 12, color: "#475569", display: "flex", alignItems: "flex-start", gap: 6 }}>
                  <MapPin size={13} color="#94A3B8" style={{ marginTop: 1, flexShrink: 0 }} />
                  Serves {cities.map((c) => c.replace(/,\s*Lipa City$/i, "")).join(", ")} · Lipa City
                </div>
              )}
              {shop?.phone && (
                <div style={{ fontSize: 12, color: "#475569", display: "flex", alignItems: "center", gap: 6 }}>
                  <Phone size={13} color="#94A3B8" /> {shop.phone}
                </div>
              )}
              {isPaid && form.storefrontAbout && (
                <div style={{ fontSize: 11.5, color: "#64748B", lineHeight: 1.5, borderTop: "1px solid #F1F5F9", paddingTop: 8 }}>
                  {form.storefrontAbout}
                </div>
              )}
            </div>
          </div>
          {(shop?.suppliedCategories || []).length === 0 && (
            <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 8 }}>
              Tip: set your categories in <strong>What We Supply</strong> — they show here too.
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 760px) {
          div[style*="minmax(0,320px)"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
