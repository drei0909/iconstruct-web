// src/components/forms/PayMongoPaymentForm.jsx
// PayMongo Hosted Checkout — GCash, Maya, card

import { useState } from "react";
import { redirectToPayMongoCheckout } from "../../controllers/paymongoController";
import { auth } from "../../services/firebase";
import { getPaidPlans } from "../../config/planConfig";

const PLANS = getPaidPlans();

export default function PayMongoPaymentForm({ defaultPlan = null, onCancel }) {
  const [selectedPlan, setSelectedPlan] = useState(
    defaultPlan ? PLANS.find((p) => p.id === defaultPlan) || null : null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {PLANS.map((plan) => (
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
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {selectedPlan?.id === plan.id && (
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />
                  )}
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {plan.features.slice(0, 4).map((f) => (
                  <span
                    key={f}
                    style={{
                      fontSize: 10.5,
                      color: "#64748B",
                      background: "#F1F5F9",
                      borderRadius: 6,
                      padding: "2px 8px",
                    }}
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          background: "#F0F7FB",
          border: "1px solid #B8D4E8",
          borderRadius: 10,
          padding: "12px 14px",
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 11.5, fontWeight: 700, color: "#154665", marginBottom: 2 }}>
          Secure Payment via PayMongo
        </div>
        <div style={{ fontSize: 11, color: "#1E5A80", lineHeight: 1.6 }}>
          You will be redirected to PayMongo&apos;s secure checkout. Accepts GCash, Maya, and cards.
          Payment details are never stored on iConstruct servers.
        </div>
      </div>

      {error && (
        <div
          style={{
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: 14,
            fontSize: 12.5,
            color: "#DC2626",
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: "12px 20px",
              borderRadius: 10,
              border: "1px solid #E2E8F0",
              background: "#F8FAFC",
              color: "#64748B",
              fontWeight: 500,
              fontSize: 13,
              cursor: "pointer",
              fontFamily: "var(--font-ui)",
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
            flex: 1,
            padding: "13px",
            borderRadius: 10,
            border: "none",
            cursor: selectedPlan && !loading ? "pointer" : "not-allowed",
            background: selectedPlan
              ? "linear-gradient(135deg,#154665,#2D6A8F)"
              : "#E2E8F0",
            color: selectedPlan ? "#fff" : "#94A3B8",
            fontWeight: 700,
            fontSize: 13,
            fontFamily: "var(--font-ui)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            opacity: loading ? 0.75 : 1,
          }}
        >
          {loading ? "Connecting to PayMongo..." : "Pay with PayMongo →"}
        </button>
      </div>
    </div>
  );
}
