// src/views/shop/PaymentSuccessPage.jsx
// Shown after PayMongo redirects back after payment.

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  verifyPayMongoPayment,
  syncMyLatestPayment,
} from "../../controllers/paymongoController";
import { auth } from "../../services/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading");
  const [planId, setPlanId] = useState("");
  const [retrying, setRetrying] = useState(false);
  const [hint, setHint] = useState("");

  const runVerify = async () => {
    const sessionId =
      searchParams.get("session_id") ||
      searchParams.get("checkout_session_id") ||
      null;

    const result = await verifyPayMongoPayment(sessionId || undefined);
    if (result.paid) {
      setPlanId(result.planId || "");
      setStatus("success");
      return;
    }
    setHint(result.message || "Payment still pending confirmation.");
    setStatus("failed");
  };

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      unsubAuth();
      if (!user) {
        setStatus("failed");
        setHint("Please sign in again, then open this page or click Confirm payment on Upgrade.");
        return;
      }
      try {
        await runVerify();
      } catch (err) {
        console.error("Payment verification error:", err);
        setHint(err.message || "Verification failed.");
        setStatus("failed");
      }
    });

    return () => {
      try {
        unsubAuth();
      } catch {
        /* already unsubscribed */
      }
    };
  }, [searchParams]);

  const handleRetry = async () => {
    setRetrying(true);
    setStatus("loading");
    try {
      if (!auth.currentUser) {
        setStatus("failed");
        setHint("Sign in first, then retry.");
        return;
      }
      const result = await syncMyLatestPayment();
      if (result.paid) {
        setPlanId(result.planId || "");
        setStatus("success");
      } else {
        setHint(result.message || "Still not paid/confirmed.");
        setStatus("failed");
      }
    } catch (err) {
      setHint(err.message || "Retry failed.");
      setStatus("failed");
    } finally {
      setRetrying(false);
    }
  };

  if (status === "loading") {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.spinner} />
          <div style={styles.title}>Verifying Payment...</div>
          <div style={styles.sub}>
            Confirming with PayMongo. This can take a few seconds.
          </div>
        </div>
        <style>{spinnerCSS}</style>
      </div>
    );
  }

  if (status === "success") {
    const planLabel = planId === "business" ? "Business Plan" : "Pro Plan";
    const planColor = planId === "business" ? "#154665" : "#2C3E50";

    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div
            style={{
              ...styles.iconCircle,
              background: "linear-gradient(135deg,#D1FAE5,#A7F3D0)",
              border: "2px solid #6EE7B7",
            }}
          >
            ✓
          </div>
          <div style={styles.title}>Payment Successful!</div>
          <div style={styles.sub}>
            Your <strong style={{ color: planColor }}>{planLabel}</strong> is now active.
            Sign out and log back in so the correct dashboard loads.
          </div>

          <div style={styles.infoBox}>
            <div style={styles.infoRow}>
              <span style={styles.infoKey}>Plan</span>
              <span style={styles.infoVal}>{planLabel}</span>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.infoKey}>Status</span>
              <span style={{ ...styles.infoVal, color: "#059669", fontWeight: 700 }}>Active</span>
            </div>
          </div>

          <button
            type="button"
            onClick={async () => {
              await signOut(auth);
              navigate("/login", { replace: true });
            }}
            style={styles.btn}
          >
            Sign out &amp; log in again →
          </button>
          <button
            type="button"
            onClick={() => navigate("/shop/dashboard")}
            style={{ ...styles.btn, marginTop: 10, background: "#E2E8F0", color: "#0F172A" }}
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div
          style={{
            ...styles.iconCircle,
            background: "#FEE2E2",
            border: "2px solid #FCA5A5",
            color: "#DC2626",
          }}
        >
          !
        </div>
        <div style={styles.title}>Payment Not Confirmed Yet</div>
        <div style={styles.sub}>
          {hint ||
            "We could not verify this payment yet. If you already authorized GCash, click Confirm payment below."}
        </div>
        <button type="button" onClick={handleRetry} disabled={retrying} style={styles.btn}>
          {retrying ? "Checking…" : "Confirm payment again →"}
        </button>
        <button
          type="button"
          onClick={() => navigate("/shop/dashboard")}
          style={{ ...styles.btn, marginTop: 10, background: "#E2E8F0", color: "#0F172A" }}
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}

const spinnerCSS = `
  @keyframes spin { to { transform: rotate(360deg); } }
`;

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#F4F6F9",
    padding: 24,
    fontFamily: "var(--font-ui)",
  },
  card: {
    background: "#fff",
    borderRadius: 20,
    padding: "40px 36px",
    width: "100%",
    maxWidth: 420,
    textAlign: "center",
    border: "1px solid #E2E8F0",
  },
  spinner: {
    width: 40,
    height: 40,
    border: "3px solid #E2E8F0",
    borderTopColor: "#2C5282",
    borderRadius: "50%",
    animation: "spin .8s linear infinite",
    margin: "0 auto 20px",
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 20px",
    fontSize: 28,
    fontWeight: 700,
    color: "#059669",
  },
  title: {
    fontFamily: "var(--font-display)",
    fontSize: 22,
    fontWeight: 900,
    color: "#0F172A",
    marginBottom: 8,
  },
  sub: {
    fontSize: 14,
    color: "#64748B",
    lineHeight: 1.7,
    marginBottom: 20,
  },
  infoBox: {
    background: "#F8FAFC",
    borderRadius: 12,
    border: "1px solid #E2E8F0",
    padding: "14px 16px",
    marginBottom: 16,
    textAlign: "left",
  },
  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "6px 0",
    fontSize: 13,
  },
  infoKey: { color: "#94A3B8", fontWeight: 500 },
  infoVal: { color: "#0F172A", fontWeight: 600 },
  btn: {
    width: "100%",
    padding: "12px 16px",
    borderRadius: 10,
    border: "none",
    background: "linear-gradient(135deg,#2C5282,#3B82F6)",
    color: "#fff",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
};
