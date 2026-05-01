// src/components/forms/StripePaymentForm.jsx
// Stripe Checkout trigger — shown alongside the existing manual PaymentForm
// User picks: Pay with Card (Stripe) OR Manual (GCash/bank)

import { useState } from "react";
import { redirectToStripeCheckout } from "../../controllers/stripeController";
import { auth } from "../../services/firebase";

const PLANS = [
  {
    id:      "pro",
    name:    "Pro Plan",
    price:   "₱499",
    period:  "/month",
    amount:  499,
    color:   "#1D4ED8",
    features: ["Unlimited bidding", "Priority listing", "Promo exposure", "Analytics"],
  },
  {
    id:      "business",
    name:    "Business Plan",
    price:   "₱4,499",
    period:  "/year",
    amount:  4499,
    color:   "#7C3AED",
    badge:   "Best Value",
    features: ["Everything in Pro", "Featured placement", "Priority support", "Advanced analytics"],
  },
];

export default function StripePaymentForm({ defaultPlan = null, onCancel }) {
  const [selectedPlan, setSelectedPlan] = useState(
    defaultPlan ? PLANS.find(p => p.id === defaultPlan) || null : null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const handleStripeCheckout = async () => {
    if (!selectedPlan) return;
    setLoading(true);
    setError("");
    try {
      const user = auth.currentUser;
      await redirectToStripeCheckout({
        planId:    selectedPlan.id,
        shopId:    user?.uid    || "",
        shopEmail: user?.email  || "",
      });
      // Browser redirects to Stripe — no further code runs
    } catch (err) {
      setError(err.message || "Failed to connect to Stripe. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* Plan Selector */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginBottom: 12 }}>
          Select a Plan
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {PLANS.map(plan => (
            <div
              key={plan.id}
              onClick={() => setSelectedPlan(plan)}
              style={{
                borderRadius: 12, padding: "16px 18px",
                border: `2px solid ${selectedPlan?.id === plan.id ? plan.color : "#E2E8F0"}`,
                background: selectedPlan?.id === plan.id ? "#F8FAFC" : "#fff",
                cursor: "pointer", transition: "all 0.2s",
                position: "relative",
              }}
            >
              {plan.badge && (
                <span style={{
                  position: "absolute", top: -10, right: 14,
                  background: "#7C3AED", color: "#fff",
                  fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
                  padding: "2px 10px", borderRadius: 20, textTransform: "uppercase",
                }}>{plan.badge}</span>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: "#0F172A" }}>{plan.name}</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: plan.color }}>
                    {plan.price}<span style={{ fontSize: 12, fontWeight: 400, color: "#94A3B8" }}>{plan.period}</span>
                  </div>
                </div>
                <div style={{
                  width: 20, height: 20, borderRadius: "50%",
                  border: `2px solid ${selectedPlan?.id === plan.id ? plan.color : "#CBD5E1"}`,
                  background: selectedPlan?.id === plan.id ? plan.color : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {selectedPlan?.id === plan.id && (
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />
                  )}
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {plan.features.map(f => (
                  <span key={f} style={{
                    fontSize: 10.5, color: "#64748B",
                    background: "#F1F5F9", borderRadius: 6, padding: "2px 8px",
                  }}> {f}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stripe Info Box */}
      <div style={{
        background: "#F0F9FF", border: "1px solid #BAE6FD",
        borderRadius: 10, padding: "12px 14px", marginBottom: 16,
        display: "flex", gap: 10, alignItems: "flex-start",
      }}>
        <span style={{ fontSize: 18 }}></span>
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: "#0369A1", marginBottom: 2 }}>
            Secure Payment via Stripe
          </div>
          <div style={{ fontSize: 11, color: "#0C4A6E", lineHeight: 1.6 }}>
            You'll be redirected to Stripe's secure checkout page. Accepts Visa, Mastercard, and other major cards.
            Your card info is never stored on our servers.
          </div>
        </div>
      </div>

      {error && (
        <div style={{
          background: "#FEF2F2", border: "1px solid #FECACA",
          borderRadius: 8, padding: "10px 14px", marginBottom: 14,
          fontSize: 12.5, color: "#DC2626",
        }}>{error}</div>
      )}

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: 10 }}>
        {onCancel && (
          <button
            onClick={onCancel}
            style={{
              padding: "12px 20px", borderRadius: 10,
              border: "1px solid #E2E8F0", background: "#F8FAFC",
              color: "#64748B", fontWeight: 500, fontSize: 13,
              cursor: "pointer", fontFamily: "'Inter', sans-serif",
            }}
          >Cancel</button>
        )}
        <button
          disabled={!selectedPlan || loading}
          onClick={handleStripeCheckout}
          style={{
            flex: 1, padding: "13px", borderRadius: 10, border: "none",
            cursor: selectedPlan && !loading ? "pointer" : "not-allowed",
            background: selectedPlan
              ? "linear-gradient(135deg,#1D4ED8,#3B82F6)"
              : "#E2E8F0",
            color:  selectedPlan ? "#fff" : "#94A3B8",
            fontWeight: 700, fontSize: 13,
            fontFamily: "'Inter', sans-serif",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            opacity: loading ? 0.75 : 1,
            transition: "all 0.2s",
          }}
        >
          {loading ? (
            <>
              <span style={{
                width: 14, height: 14, borderRadius: "50%",
                border: "2px solid rgba(255,255,255,0.3)",
                borderTop: "2px solid #fff",
                animation: "spin 0.8s linear infinite",
                display: "inline-block",
              }} />
              Connecting to Stripe...
            </>
          ) : (
            <>Pay with Card via Stripe →</>
          )}
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}