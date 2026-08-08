// src/routes/ShopDashboardRouter.jsx
// Access control: only approved shops reach dashboards; expired paid plans use Basic UI.

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../services/firebase";
import { logoutShop } from "../controllers/shopController";
import {
  evaluateShopLoginAccess,
  isShopApproved,
  resolveEffectivePlan,
} from "../utils/shopAccess";

import ShopDashboardBasic from "../views/shop/DashboardBasicPage";
import ShopDashboardPro from "../views/shop/DashboardProPage";
import ShopDashboardBusiness from "../views/shop/DashboardBusinessPage";

async function showAccessDenied(message) {
  const Swal = (await import("sweetalert2")).default;
  await Swal.fire({
    icon: "info",
    title: "Access restricted",
    text: message,
    confirmButtonColor: "#2C5282",
    allowOutsideClick: false,
  });
}

async function showSubscriptionAlert({ planName, shopName, onConfirm, onLater }) {
  const Swal = (await import("sweetalert2")).default;
  const planMeta = {
    pro: { label: "Pro Plan", color: "#1D4ED8", price: "₱999/month" },
    business: { label: "Business Plan", color: "#7C3AED", price: "₱4,999/month" },
    basic: { label: "Basic Plan", color: "#059669", price: "Free" },
  };
  const meta = planMeta[planName?.toLowerCase()] ?? planMeta.basic;
  const safeName = String(shopName || "your shop")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const result = await Swal.fire({
    title: "Subscription Activated!",
    html: `<div style="text-align:center;font-family:var(--font-ui)">
      <div style="display:inline-block;background:${meta.color}18;border:1px solid ${meta.color}40;border-radius:12px;padding:6px 18px;font-size:13px;font-weight:700;color:${meta.color};margin-bottom:14px;">${meta.label} · ${meta.price}</div>
      <p style="font-size:14px;color:#374151;line-height:1.7;margin-bottom:10px">Payment for <strong>${safeName}</strong> is active. Your features update automatically.</p>
    </div>`,
    icon: "success",
    showCancelButton: true,
    confirmButtonText: "Continue",
    cancelButtonText: "OK",
    confirmButtonColor: meta.color,
    cancelButtonColor: "#9CA3AF",
    allowOutsideClick: false,
    backdrop: "rgba(15,23,42,0.65)",
  });
  if (result.isConfirmed) onConfirm();
  else onLater();
}

export default function ShopDashboardRouter() {
  const navigate = useNavigate();
  // null = loading | false = blocked/redirect | plan string = ok
  const [plan, setPlan] = useState(null);
  const [shopId, setShopId] = useState(null);
  const [gateNote, setGateNote] = useState("");
  const shopMetaRef = useRef(null);
  const prevSubStatusRef = useRef(null);
  const alertShownRef = useRef(false);
  const deniedOnceRef = useRef(false);
  const unsubRef = useRef(null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setPlan(false);
        setShopId(null);
        navigate("/login", { replace: true });
        return;
      }
      deniedOnceRef.current = false;
      setShopId(user.uid);
    });
    return () => unsubAuth();
  }, [navigate]);

  useEffect(() => {
    if (!shopId) return;
    unsubRef.current?.();

    const unsub = onSnapshot(
      doc(db, "shops", shopId),
      async (snap) => {
        if (!snap.exists()) {
          if (!deniedOnceRef.current) {
            deniedOnceRef.current = true;
            await showAccessDenied("Shop profile not found. Contact support.");
            try {
              await logoutShop();
            } catch {
              /* ignore */
            }
            navigate("/login", { replace: true });
          }
          setPlan(false);
          return;
        }

        const data = snap.data();
        shopMetaRef.current = {
          shopName: data.shopName || "",
          email: data.email || "",
          ownerName: data.ownerName || "",
        };

        // ── Approval gate (cannot use dashboard while pending/rejected) ──
        const access = evaluateShopLoginAccess(data.status);
        if (!access.ok) {
          setPlan(false);
          setGateNote(access.message);
          if (!deniedOnceRef.current) {
            deniedOnceRef.current = true;
            await showAccessDenied(access.message);
            try {
              await logoutShop();
            } catch {
              /* ignore */
            }
            navigate("/login", { replace: true });
          }
          return;
        }

        deniedOnceRef.current = false;

        // ── Plan routing (expired paid plan → basic features) ──
        const resolved = resolveEffectivePlan(data);
        setPlan(resolved);
        if (resolved === "basic" && isShopApproved(data.status)) {
          const raw = String(data.subscriptionPlan || "").toLowerCase();
          if ((raw === "pro" || raw === "business") && data.subscriptionExpiry) {
            setGateNote("Your paid plan has expired. You are on Basic until you renew.");
          } else {
            setGateNote("");
          }
        } else {
          setGateNote("");
        }

        // ── Activation toast (status flips to active) ──
        if (
          prevSubStatusRef.current !== null &&
          prevSubStatusRef.current !== "active" &&
          data.subscriptionStatus === "active" &&
          !alertShownRef.current
        ) {
          alertShownRef.current = true;
          await showSubscriptionAlert({
            planName: data.subscriptionPlan,
            shopName: data.shopName || shopMetaRef.current?.shopName || "",
            onConfirm: () => {
              /* plan already live via snapshot */
            },
            onLater: () => {
              alertShownRef.current = false;
            },
          });
        }

        prevSubStatusRef.current = data.subscriptionStatus;
      },
      async () => {
        setPlan(false);
        if (!deniedOnceRef.current) {
          deniedOnceRef.current = true;
          await showAccessDenied("Could not load your shop. Please sign in again.");
          try {
            await logoutShop();
          } catch {
            /* ignore */
          }
          navigate("/login", { replace: true });
        }
      }
    );

    unsubRef.current = unsub;
    return () => {
      unsub();
      unsubRef.current = null;
    };
  }, [shopId, navigate]);

  useEffect(
    () => () => {
      unsubRef.current?.();
    },
    []
  );

  if (plan === null) {
    return (
      <div
        className="db-shell"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F4F6F9",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 40,
              height: 40,
              border: "3px solid #E2E8F0",
              borderTopColor: "#2C5282",
              borderRadius: "50%",
              animation: "spin .8s linear infinite",
              margin: "0 auto 16px",
            }}
          />
          <div style={{ fontSize: 14, color: "#94A3B8", fontWeight: 500 }}>
            Checking access…
          </div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </div>
    );
  }

  if (plan === false) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F4F6F9",
          padding: 24,
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 360, color: "#64748B", fontSize: 14 }}>
          {gateNote || "Redirecting to login…"}
        </div>
      </div>
    );
  }

  return (
    <>
      {gateNote ? (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 200,
            background: "#FEF3C7",
            color: "#92400E",
            fontSize: 12,
            fontWeight: 600,
            textAlign: "center",
            padding: "8px 12px",
            borderBottom: "1px solid #FCD34D",
          }}
        >
          {gateNote}
        </div>
      ) : null}
      {plan === "pro" && <ShopDashboardPro />}
      {plan === "business" && <ShopDashboardBusiness />}
      {plan === "basic" && <ShopDashboardBasic />}
    </>
  );
}
