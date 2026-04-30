// src/views/shop/PaymentSuccessPage.jsx
// Shown after Stripe redirects back to the app after payment

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { verifyStripePayment } from "../../controllers/stripeController";
import { auth, db } from "../../services/firebase";
import { doc, updateDoc, Timestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export default function PaymentSuccessPage() {
  const [searchParams]  = useSearchParams();
  const navigate        = useNavigate();
  const [status, setStatus]   = useState("loading"); 
  const [planId, setPlanId]   = useState("");

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (!sessionId) {
      setStatus("failed");
      return;
    }

    // Wait for Firebase auth to restore before verifying
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      unsubAuth(); // stop listening after first call
      try {
        const result = await verifyStripePayment(sessionId);
        if (result.paid) {
          setPlanId(result.planId);
          if (user) {
            const expiry = result.planId === "business"
              ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
              : new Date(Date.now() + 30  * 24 * 60 * 60 * 1000);
            await updateDoc(doc(db, "shops", user.uid), {
              subscriptionPlan:   result.planId,
              subscriptionStatus: "active",
              subscriptionExpiry: Timestamp.fromDate(expiry),
              updatedAt:          Timestamp.now(),
            });
          }
          setStatus("success");
        } else {
          setStatus("failed");
        }
      } catch (err) {
        console.error("Payment verification error:", err);
        setStatus("failed");
      }
    });
  }, []);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (status === "loading") {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.spinner} />
          <div style={styles.title}>Verifying Payment...</div>
          <div style={styles.sub}>Please wait while we confirm your payment.</div>
        </div>
        <style>{spinnerCSS}</style>
      </div>
    );
  }

  // ── Success ──────────────────────────────────────────────────────────────
  if (status === "success") {
    const planLabel = planId === "business" ? "Business Plan" : "Pro Plan";
    const planColor = planId === "business" ? "#7C3AED" : "#1D4ED8";

    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ ...styles.iconCircle, background: "linear-gradient(135deg,#D1FAE5,#A7F3D0)", border: "2px solid #6EE7B7" }}>
            
          </div>
          <div style={styles.title}>Payment Successful!</div>
          <div style={styles.sub}>
            Your <strong style={{ color: planColor }}>{planLabel}</strong> is now active.
            Sign out and log back in to access all your new features.
          </div>

          <div style={styles.infoBox}>
            <div style={styles.infoRow}><span style={styles.infoKey}>Plan</span><span style={styles.infoVal}>{planLabel}</span></div>
            <div style={styles.infoRow}><span style={styles.infoKey}>Status</span><span style={{ ...styles.infoVal, color: "#059669", fontWeight: 700 }}>Active</span></div>
          </div>

          <div style={{ background:"#FFF7ED", border:"1px solid #FED7AA", borderRadius:10, padding:"12px 16px", marginBottom:20, fontSize:12.5, color:"#92400E", lineHeight:1.6 }}>
            Please sign out and log back in for your plan features to take effect.
          </div>

          <button
            onClick={() => navigate("/shop/dashboard")}
            style={{ ...styles.btn, background: `linear-gradient(135deg,${planColor},${planColor}CC)`, marginBottom: 10 }}
          >
            Go to Dashboard →
          </button>
          <button
            onClick={() => auth.signOut().then(() => navigate("/login"))}
            style={{ ...styles.btn, background: "#0F172A" }}
          >
            Sign Out &amp; Log Back In
          </button>
        </div>
      </div>
    );
  }

  // ── Failed ───────────────────────────────────────────────────────────────
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={{ ...styles.iconCircle, background: "#FEE2E2", border: "2px solid #FCA5A5" }}>
          ✗
        </div>
        <div style={styles.title}>Payment Not Confirmed</div>
        <div style={styles.sub}>
          We could not verify your payment. If you were charged, please contact support.
        </div>
        <button
          onClick={() => navigate("/shop/dashboard")}
          style={{ ...styles.btn, background: "#0F172A" }}
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  page: {
    minHeight: "100vh", background: "#F8FAFC",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: 24, fontFamily: "'Inter', sans-serif",
  },
  card: {
    background: "#fff", borderRadius: 20, padding: "40px 36px",
    width: "100%", maxWidth: 420, textAlign: "center",
    boxShadow: "0 8px 40px rgba(0,0,0,0.1)",
  },
  iconCircle: {
    width: 72, height: 72, borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    margin: "0 auto 20px", fontSize: 32,
  },
  title: {
    fontFamily: "'Lora', Georgia, serif", fontSize: 22,
    fontWeight: 900, color: "#0F172A", marginBottom: 8,
  },
  sub: {
    fontSize: 13.5, color: "#64748B", lineHeight: 1.7, marginBottom: 20,
  },
  infoBox: {
    background: "#F8FAFC", border: "1px solid #E2E8F0",
    borderRadius: 10, padding: "14px 18px", marginBottom: 20, textAlign: "left",
  },
  infoRow: {
    display: "flex", gap: 12, marginBottom: 8, fontSize: 13,
  },
  infoKey: { color: "#94A3B8", minWidth: 80 },
  infoVal: { color: "#0F172A", fontWeight: 500 },
  btn: {
    width: "100%", padding: "13px", borderRadius: 10, border: "none",
    color: "#fff", fontWeight: 700, fontSize: 13,
    cursor: "pointer", fontFamily: "'Inter', sans-serif",
  },
  spinner: {
    width: 40, height: 40, borderRadius: "50%",
    border: "3px solid #E2E8F0", borderTop: "3px solid #3B82F6",
    margin: "0 auto 20px", animation: "spin 0.8s linear infinite",
  },
};

const spinnerCSS = `@keyframes spin { to { transform: rotate(360deg); } }`;