// src/components/layout/PaymentForm.jsx
// iConstruct — Shop Owner Payment Submission Form
// Called from ShopDashboardBasic / Pro Upgrade tab
// Submits a payment request to Firestore for admin review

import { useState } from "react";
import { submitPaymentRequest, getMyPaymentRequest } from "../../controllers/shopController";

const PLANS = [
  {
    id: "pro",
    name: "Pro Plan",
    price: "₱499",
    period: "/month",
    label: "₱499/month",
    color: "#2C3E50",
    features: ["Unlimited project bidding", "Priority listing", "Promo exposure", "Quotation analytics"],
  },
  {
    id: "business",
    name: "Business Plan",
    price: "₱4,499",
    period: "/year",
    label: "₱4,499/year",
    color: "#648DB6",
    badge: "Best Value",
    features: ["Everything in Pro", "Featured placement", "Priority support", "Advanced analytics", "Save ₱1,489 vs monthly"],
  },
];

const PAYMENT_METHODS = [
  { id: "GCash",          label: "GCash",           icon: "📱", color: "#007aff", hint: "Send to: 0917-XXX-XXXX (iConstruct)" },
  { id: "Maya",           label: "Maya",             icon: "💳", color: "#00b4d8", hint: "Send to: 0961-XXX-XXXX (iConstruct)" },
  { id: "BDO",            label: "BDO Transfer",     icon: "🏦", color: "#1a3c6e", hint: "Account: 0012-3456-7890 (iConstruct Inc.)" },
  { id: "BPI",            label: "BPI Transfer",     icon: "🏦", color: "#c00",    hint: "Account: 1234-5678-90 (iConstruct Inc.)" },
  { id: "Visa/Mastercard",label: "Visa / Mastercard",icon: "💳", color: "#1a1a2e", hint: "Pay link will be emailed within 1 hour." },
  { id: "UnionBank",      label: "UnionBank Online", icon: "🏦", color: "#f7931e", hint: "Account: 109-500-123456-7 (iConstruct)" },
];

export default function PaymentForm({ onSuccess, existingRequest }) {
  const [step, setStep]         = useState(1); // 1=plan, 2=method, 3=reference, 4=done
  const [selectedPlan, setSelectedPlan]     = useState(null);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [reference, setReference]           = useState("");
  const [screenshot, setScreenshot]         = useState(null); // base64 proof
  const [submitting, setSubmitting]         = useState(false);
  const [error, setError]                   = useState("");

  // If there's already a pending/confirmed request, show status instead
  if (existingRequest) {
    const statusColor = {
      pending:   { bg: "#FEF3C7", border: "#FCD34D", text: "#92400E", dot: "#F59E0B" },
      confirmed: { bg: "#D1FAE5", border: "#6EE7B7", text: "#065F46", dot: "#10B981" },
      rejected:  { bg: "#FEE2E2", border: "#FCA5A5", text: "#991B1B", dot: "#EF4444" },
    }[existingRequest.status] || {};

    return (
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <div style={{
          background: statusColor.bg,
          border: `1px solid ${statusColor.border}`,
          borderRadius: 14, padding: "24px 28px",
        }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 16 }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: statusColor.dot, marginTop: 5, flexShrink: 0,
            }} />
            <div>
              <div style={{ fontWeight: 700, color: statusColor.text, fontSize: 14, marginBottom: 4 }}>
                Payment Request — {existingRequest.status.charAt(0).toUpperCase() + existingRequest.status.slice(1)}
              </div>
              <div style={{ fontSize: 12.5, color: statusColor.text, opacity: 0.8, lineHeight: 1.6 }}>
                <strong>Plan:</strong> {existingRequest.planName?.toUpperCase()} · {existingRequest.planPrice}<br />
                <strong>Method:</strong> {existingRequest.paymentMethod}<br />
                <strong>Reference:</strong> {existingRequest.referenceNumber}<br />
                <strong>Submitted:</strong> {existingRequest.submittedAt?.toDate?.()?.toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" }) || "—"}
              </div>
            </div>
          </div>
          {existingRequest.status === "pending" && (
            <p style={{ fontSize: 12, color: statusColor.text, opacity: 0.75, borderTop: `1px solid ${statusColor.border}`, paddingTop: 12, marginTop: 4 }}>
              ⏳ The admin is reviewing your payment. You'll receive an email once confirmed. This usually takes within 24 hours.
            </p>
          )}
          {existingRequest.status === "confirmed" && (
            <p style={{ fontSize: 12, color: statusColor.text, opacity: 0.75, borderTop: `1px solid ${statusColor.border}`, paddingTop: 12, marginTop: 4 }}>
              ✅ Your plan is now active! Refresh the page to access your upgraded dashboard.
            </p>
          )}
          {existingRequest.status === "rejected" && (
            <div style={{ borderTop: `1px solid ${statusColor.border}`, paddingTop: 12, marginTop: 4 }}>
              <p style={{ fontSize: 12, color: statusColor.text, opacity: 0.75, marginBottom: 10 }}>
                ❌ Reason: {existingRequest.rejectionReason || "Payment could not be verified."}
              </p>
              <button onClick={() => window.location.reload()} style={{
                fontSize: 12, fontWeight: 600, padding: "7px 16px",
                borderRadius: 8, border: "none",
                background: "#991B1B", color: "#fff", cursor: "pointer",
              }}>Try Again</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setScreenshot(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!reference.trim()) { setError("Please enter your payment reference number."); return; }
    setSubmitting(true);
    setError("");
    try {
      await submitPaymentRequest({
        planName:        selectedPlan.id,
        planPrice:       selectedPlan.label,
        paymentMethod:   selectedMethod.id,
        referenceNumber: reference.trim(),
        screenshotBase64: screenshot || "",
      });
      setStep(4);
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message || "Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Step indicators ── */
  const steps = ["Choose Plan", "Payment Method", "Submit Proof", "Done"];

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", fontFamily: "'Inter', sans-serif" }}>

      {/* Step bar */}
      {step < 4 && (
        <div style={{ display: "flex", alignItems: "center", marginBottom: 28, gap: 0 }}>
          {steps.slice(0, 3).map((s, i) => {
            const idx = i + 1;
            const done = idx < step;
            const active = idx === step;
            return (
              <div key={s} style={{ display: "flex", alignItems: "center", flex: i < 2 ? 1 : 0 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%", display: "flex",
                    alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 700,
                    background: done ? "#10B981" : active ? "#2C3E50" : "#E2E8F0",
                    color: done || active ? "#fff" : "#94A3B8",
                    transition: "all 0.3s",
                  }}>
                    {done ? "✓" : idx}
                  </div>
                  <span style={{ fontSize: 10, color: active ? "#0F172A" : "#94A3B8", fontWeight: active ? 600 : 400, whiteSpace: "nowrap" }}>{s}</span>
                </div>
                {i < 2 && <div style={{ flex: 1, height: 2, background: done ? "#10B981" : "#E2E8F0", margin: "0 6px", marginBottom: 18 }} />}
              </div>
            );
          })}
        </div>
      )}

      {/* ── STEP 1: Choose Plan ── */}
      {step === 1 && (
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>Select a Plan</div>
          <div style={{ fontSize: 12.5, color: "#64748B", marginBottom: 20 }}>You can upgrade or change plans at any time.</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {PLANS.map(plan => (
              <div key={plan.id}
                onClick={() => setSelectedPlan(plan)}
                style={{
                  borderRadius: 12, padding: "18px 20px",
                  border: `2px solid ${selectedPlan?.id === plan.id ? plan.color : "#E2E8F0"}`,
                  background: selectedPlan?.id === plan.id ? "#F8FAFC" : "#fff",
                  cursor: "pointer", transition: "all 0.2s",
                  position: "relative",
                }}>
                {plan.badge && (
                  <span style={{
                    position: "absolute", top: -10, right: 16,
                    background: "#648DB6", color: "#fff",
                    fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
                    padding: "2px 10px", borderRadius: 20, textTransform: "uppercase",
                  }}>{plan.badge}</span>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#0F172A" }}>{plan.name}</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: plan.color, fontFamily: "'Lora', Georgia, serif" }}>
                      {plan.price}<span style={{ fontSize: 12, fontWeight: 400, color: "#94A3B8" }}>{plan.period}</span>
                    </div>
                  </div>
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%",
                    border: `2px solid ${selectedPlan?.id === plan.id ? plan.color : "#CBD5E1"}`,
                    background: selectedPlan?.id === plan.id ? plan.color : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.2s",
                  }}>
                    {selectedPlan?.id === plan.id && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />}
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {plan.features.map(f => (
                    <span key={f} style={{
                      fontSize: 10.5, color: "#64748B",
                      background: "#F1F5F9", borderRadius: 6,
                      padding: "2px 8px",
                    }}>✓ {f}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button
            disabled={!selectedPlan}
            onClick={() => setStep(2)}
            style={{
              marginTop: 20, width: "100%", padding: "13px",
              borderRadius: 10, border: "none", cursor: selectedPlan ? "pointer" : "not-allowed",
              background: selectedPlan ? "linear-gradient(135deg,#2C3E50,#648DB6)" : "#E2E8F0",
              color: selectedPlan ? "#fff" : "#94A3B8",
              fontWeight: 700, fontSize: 13, fontFamily: "'Inter', sans-serif",
              transition: "all 0.2s",
            }}>
            Continue with {selectedPlan?.name || "a plan"} →
          </button>
        </div>
      )}

      {/* ── STEP 2: Payment Method ── */}
      {step === 2 && (
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>Choose Payment Method</div>
          <div style={{ fontSize: 12.5, color: "#64748B", marginBottom: 20 }}>
            For <strong style={{ color: "#0F172A" }}>{selectedPlan.name} — {selectedPlan.label}</strong>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            {PAYMENT_METHODS.map(m => (
              <div key={m.id}
                onClick={() => setSelectedMethod(m)}
                style={{
                  borderRadius: 10, padding: "14px 16px",
                  border: `2px solid ${selectedMethod?.id === m.id ? m.color : "#E2E8F0"}`,
                  background: selectedMethod?.id === m.id ? "#F8FAFC" : "#fff",
                  cursor: "pointer", transition: "all 0.2s",
                }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{m.icon}</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "#0F172A" }}>{m.label}</div>
              </div>
            ))}
          </div>

          {/* Payment hint */}
          {selectedMethod && (
            <div style={{
              background: "#F0F9FF", border: "1px solid #BAE6FD",
              borderRadius: 10, padding: "12px 16px", marginBottom: 16,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#0369A1", marginBottom: 3 }}>📋 PAYMENT DETAILS</div>
              <div style={{ fontSize: 12.5, color: "#0C4A6E" }}>{selectedMethod.hint}</div>
              <div style={{ fontSize: 11, color: "#0369A1", marginTop: 6 }}>
                ℹ️ Send exactly <strong>{selectedPlan.price}</strong> then keep your reference number.
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setStep(1)} style={{
              padding: "12px 20px", borderRadius: 10,
              border: "1px solid #E2E8F0", background: "#F8FAFC",
              color: "#64748B", fontWeight: 500, fontSize: 13,
              fontFamily: "'Inter', sans-serif", cursor: "pointer",
            }}>← Back</button>
            <button
              disabled={!selectedMethod}
              onClick={() => setStep(3)}
              style={{
                flex: 1, padding: "12px", borderRadius: 10,
                border: "none", cursor: selectedMethod ? "pointer" : "not-allowed",
                background: selectedMethod ? "linear-gradient(135deg,#2C3E50,#648DB6)" : "#E2E8F0",
                color: selectedMethod ? "#fff" : "#94A3B8",
                fontWeight: 700, fontSize: 13, fontFamily: "'Inter', sans-serif",
                transition: "all 0.2s",
              }}>
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Reference Number + Screenshot ── */}
      {step === 3 && (
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>Submit Payment Proof</div>
          <div style={{ fontSize: 12.5, color: "#64748B", marginBottom: 4 }}>
            {selectedMethod.label} · {selectedPlan.label}
          </div>
          <div style={{
            background: "#FFFBEB", border: "1px solid #FCD34D",
            borderRadius: 10, padding: "10px 14px", marginBottom: 20, fontSize: 12,
            color: "#92400E",
          }}>
            ⚠️ Make sure you've already sent payment before submitting. The admin will verify your reference number and activate your plan within 24 hours.
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 }}>
              Reference / Transaction Number <span style={{ color: "#EF4444" }}>*</span>
            </label>
            <input
              value={reference}
              onChange={e => setReference(e.target.value)}
              placeholder="e.g. 4567890123456 or TX-ABC-12345"
              style={{
                width: "100%", padding: "11px 14px",
                border: "1.5px solid #E2E8F0", borderRadius: 8,
                fontSize: 13, fontFamily: "'Inter', sans-serif",
                color: "#0F172A", outline: "none",
                transition: "border-color 0.15s",
              }}
              onFocus={e => e.target.style.borderColor = "#648DB6"}
              onBlur={e => e.target.style.borderColor = "#E2E8F0"}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 }}>
              Screenshot / Proof of Payment <span style={{ color: "#94A3B8", fontWeight: 400 }}>(optional but recommended)</span>
            </label>
            <label style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", padding: "20px",
              border: "2px dashed #CBD5E1", borderRadius: 10,
              cursor: "pointer", background: "#F8FAFC",
              transition: "border-color 0.2s",
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = "#648DB6"}
            onMouseLeave={e => e.currentTarget.style.borderColor = "#CBD5E1"}
            >
              {screenshot ? (
                <img src={screenshot} alt="proof" style={{ maxHeight: 120, maxWidth: "100%", borderRadius: 6, objectFit: "contain" }} />
              ) : (
                <>
                  <span style={{ fontSize: 24, marginBottom: 6 }}>📎</span>
                  <span style={{ fontSize: 12, color: "#64748B" }}>Click to upload screenshot</span>
                  <span style={{ fontSize: 11, color: "#94A3B8" }}>PNG, JPG up to 5MB</span>
                </>
              )}
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
            </label>
          </div>

          {error && (
            <div style={{
              background: "#FEF2F2", border: "1px solid #FECACA",
              borderRadius: 8, padding: "10px 14px", marginBottom: 14,
              fontSize: 12.5, color: "#DC2626",
            }}>{error}</div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setStep(2)} style={{
              padding: "12px 20px", borderRadius: 10,
              border: "1px solid #E2E8F0", background: "#F8FAFC",
              color: "#64748B", fontWeight: 500, fontSize: 13,
              fontFamily: "'Inter', sans-serif", cursor: "pointer",
            }}>← Back</button>
            <button
              disabled={submitting || !reference.trim()}
              onClick={handleSubmit}
              style={{
                flex: 1, padding: "12px", borderRadius: 10,
                border: "none",
                cursor: submitting || !reference.trim() ? "not-allowed" : "pointer",
                background: reference.trim() ? "linear-gradient(135deg,#059669,#10B981)" : "#E2E8F0",
                color: reference.trim() ? "#fff" : "#94A3B8",
                fontWeight: 700, fontSize: 13, fontFamily: "'Inter', sans-serif",
                transition: "all 0.2s",
                opacity: submitting ? 0.7 : 1,
              }}>
              {submitting ? "Submitting..." : "Submit Payment ✓"}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 4: Done ── */}
      {step === 4 && (
        <div style={{ textAlign: "center", padding: "24px 0" }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: "linear-gradient(135deg,#D1FAE5,#A7F3D0)",
            border: "2px solid #6EE7B7",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px", fontSize: 28,
          }}>✅</div>
          <div style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 20, fontWeight: 900, color: "#0F172A", marginBottom: 8 }}>
            Payment Submitted!
          </div>
          <p style={{ fontSize: 13, color: "#64748B", lineHeight: 1.7, maxWidth: 360, margin: "0 auto 20px" }}>
            Your <strong style={{ color: "#0F172A" }}>{selectedPlan.name}</strong> payment request has been sent to the admin.
            You'll receive an email at your registered address once confirmed — usually within 24 hours.
          </p>

           <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 20, padding: "12px 28px",
              borderRadius: 10, border: "none", cursor: "pointer",
              background: "linear-gradient(135deg,#2C3E50,#648DB6)",
              color: "#fff", fontWeight: 700, fontSize: 13,
              fontFamily: "'Inter', sans-serif",
            }}>
            Refresh to see your plan status
          </button>

          <div style={{
            background: "#F8FAFC", border: "1px solid #E2E8F0",
            borderRadius: 10, padding: "14px 18px", textAlign: "left",
            fontSize: 12.5, color: "#334155", lineHeight: 1.8,
            maxWidth: 320, margin: "0 auto",
          }}>
            <strong>Plan:</strong> {selectedPlan.name}<br />
            <strong>Amount:</strong> {selectedPlan.label}<br />
            <strong>Method:</strong> {selectedMethod.label}<br />
            <strong>Reference:</strong> {reference}
          </div>
        </div>
      )}
    </div>
  );
}
