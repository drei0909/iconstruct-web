// src/components/forms/PayMongoPaymentForm.jsx
// PayMongo Hosted Checkout — GCash, Maya, card (plan prices from admin / Firestore)

import { useState, useEffect } from "react";
import { redirectToPayMongoCheckout } from "../../controllers/paymongoController";
import { auth } from "../../services/firebase";
import { getLivePaidPlans, peekLivePaidPlans } from "../../config/planConfig";

export default function PayMongoPaymentForm({ defaultPlan = null, onCancel }) {
  // Start from the cached admin prices (or nothing) — never the static
  // defaults, which flashed ₱999 / ₱4,999 before the real price loaded.
  const [plans, setPlans] = useState(() => peekLivePaidPlans() || []);
  const [selectedPlan, setSelectedPlan] = useState(() =>
    defaultPlan ? (peekLivePaidPlans() || []).find((p) => p.id === defaultPlan) || null : null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [plansLoading, setPlansLoading] = useState(() => !peekLivePaidPlans());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const live = await getLivePaidPlans();
        if (cancelled) return;
        setPlans(live);
        if (defaultPlan) {
          setSelectedPlan((cur) => live.find((p) => p.id === (cur?.id || defaultPlan)) || null);
        } else {
          setSelectedPlan((cur) => (cur ? live.find((p) => p.id === cur.id) || null : null));
        }
      } catch {
        if (!cancelled) setError("Couldn't load plan prices. Check your connection and try again.");
      } finally {
        if (!cancelled) setPlansLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [defaultPlan]);

  const handleCheckout = async () => {
    if (!selectedPlan) return;
    setLoading(true);
    setError("");
    try {
      const user = auth.currentUser;
      await redirectToPayMongoCheckout({
        planId: selectedPlan.id,
        shopId: user?.uid || "",
        shopEmail: user?.email || "",
      });
    } catch (err) {
      setError(err.message || "Failed to connect to PayMongo. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div style={{ fontFamily: "var(--font-ui)" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginBottom: 12, fontFamily: "var(--font-display)" }}>
          Select a Plan
        </div>
        {plansLoading && (
          <div style={{ fontSize: 12, color: "#94A3B8", marginBottom: 10 }}>Loading plans…</div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {plans.map((plan) => (
            <div
              key={plan.id}
              onClick={() => setSelectedPlan(plan)}
              style={{
                borderRadius: 12,
                padding: "16px 18px",
                border: `2px solid ${selectedPlan?.id === plan.id ? plan.color : "#E2E8F0"}`,
                background: selectedPlan?.id === plan.id ? "#F8FAFC" : "#fff",
                cursor: "pointer",
                transition: "all 0.2s",
                position: "relative",
              }}
            >
              {plan.badge && (
                <span
                  style={{
                    position: "absolute",
                    top: -10,
                    right: 14,
                    background: plan.color,
                    color: "#fff",
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    padding: "2px 10px",
                    borderRadius: 20,
                    textTransform: "uppercase",
                  }}
                >
                  {plan.badge}
                </span>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: "#0F172A" }}>{plan.name}</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: plan.color, fontFamily: "var(--font-display)" }}>
                    {plan.priceLabel}
                    <span style={{ fontSize: 12, fontWeight: 400, color: "#94A3B8" }}>{plan.period}</span>
                  </div>
                </div>
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    border: `2px solid ${selectedPlan?.id === plan.id ? plan.color : "#CBD5E1"}`,
                    background: selectedPlan?.id === plan.id ? plan.color : "transparent",
                  }}
                />
              </div>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11.5, color: "#64748B", lineHeight: 1.55 }}>
                {(plan.features || []).map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "#B91C1C", marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: 10,
              border: "1px solid #E2E8F0",
              background: "#F8FAFC",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          disabled={!selectedPlan || loading}
          onClick={handleCheckout}
          style={{
            flex: 2,
            padding: "12px",
            borderRadius: 10,
            border: "none",
            background:
              !selectedPlan || loading
                ? "#E2E8F0"
                : "linear-gradient(135deg,#2C5282,#3B82F6)",
            color: !selectedPlan || loading ? "#94A3B8" : "#fff",
            fontWeight: 700,
            fontSize: 13,
            cursor: !selectedPlan || loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Connecting to PayMongo…" : "Continue to PayMongo →"}
        </button>
      </div>
    </div>
  );
}
