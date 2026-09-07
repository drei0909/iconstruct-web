// "What We Supply" — the shop declares which material categories it carries.
// Drives project fit-ranking and pre-declines out-of-range lines in the quote form.

import { useEffect, useState } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../../services/firebase";
import { Check, ListChecks } from "@phosphor-icons/react";
import { SUPPLY_CATEGORIES } from "../../utils/supplyCategories";

export default function SupplyCoverageTab({ shop, onShopUpdated, accentColor = "#2C5282" }) {
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    setSelected(Array.isArray(shop?.suppliedCategories) ? shop.suppliedCategories : []);
  }, [shop]);

  const toggle = (key) =>
    setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));

  const dirty =
    JSON.stringify([...selected].sort()) !==
    JSON.stringify([...(shop?.suppliedCategories || [])].sort());

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated.");
      await updateDoc(doc(db, "shops", user.uid), {
        suppliedCategories: selected,
        updatedAt: serverTimestamp(),
      });
      onShopUpdated?.({ ...shop, suppliedCategories: selected });
      setMsg({ type: "success", text: "Saved. Projects will now be ranked by fit." });
    } catch (err) {
      setMsg({ type: "error", text: err.message || "Failed to save." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <ListChecks size={20} color={accentColor} weight="duotone" />
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 700, color: "#0F172A", margin: 0 }}>
          What We Supply
        </h2>
      </div>
      <p style={{ fontSize: 12.5, color: "#64748B", margin: "0 0 18px", lineHeight: 1.6 }}>
        Tick the material categories your shop carries. Projects that need these
        rise to the top of your Projects list, and any item outside them is
        pre-marked <strong>Unavailable</strong> when you open a quote (still editable).
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10, marginBottom: 20 }}>
        {SUPPLY_CATEGORIES.map((c) => {
          const on = selected.includes(c.key);
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => toggle(c.key)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "12px 14px", borderRadius: 10, cursor: "pointer",
                textAlign: "left", fontFamily: "inherit",
                border: `1.5px solid ${on ? accentColor : "#E2E8F0"}`,
                background: on ? `${accentColor}0D` : "#fff",
              }}
            >
              <span style={{
                width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: on ? accentColor : "#F1F5F9",
                color: "#fff",
              }}>
                {on && <Check size={13} weight="bold" />}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: on ? "#0F172A" : "#475569" }}>
                {c.label}
              </span>
            </button>
          );
        })}
      </div>

      {msg && (
        <div style={{
          fontSize: 12.5, marginBottom: 12, padding: "9px 12px", borderRadius: 8,
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
        disabled={saving || !dirty}
        style={{
          padding: "11px 22px", borderRadius: 10, border: "none",
          background: saving || !dirty ? "#E2E8F0" : `linear-gradient(135deg,${accentColor},#3B82F6)`,
          color: saving || !dirty ? "#94A3B8" : "#fff",
          fontSize: 13, fontWeight: 700, cursor: saving || !dirty ? "not-allowed" : "pointer",
        }}
      >
        {saving ? "Saving…" : dirty ? "Save supply categories" : "Saved"}
      </button>
    </div>
  );
}
