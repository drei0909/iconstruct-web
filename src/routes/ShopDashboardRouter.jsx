// src/routes/ShopDashboardRouter.jsx
// DEBUG VERSION — open browser DevTools console and look for "🔍 ROUTER" lines.
// These logs will tell us exactly why pro is showing as business.
// Remove console.log lines once the bug is identified and fixed.

import { useState, useEffect, useRef } from "react";
import { useNavigate }                 from "react-router-dom";
import { onAuthStateChanged }          from "firebase/auth";
import { doc, onSnapshot }            from "firebase/firestore";
import { auth, db }                   from "../services/firebase";
import { getShopProfile, logoutShop } from "../controllers/shopController";

import ShopDashboardBasic    from "../views/shop/DashboardBasicPage";
import ShopDashboardPro      from "../views/shop/DashboardProPage";
import ShopDashboardBusiness from "../views/shop/DashboardBusinessPage";

const VALID_PLANS = ["basic", "pro", "business"];

async function showSubscriptionAlert({ planName, shopName, onConfirm, onLater }) {
  const Swal = (await import("sweetalert2")).default;
  const planMeta = {
    pro:      { label: "Pro Plan 🚀",      color: "#1D4ED8", price: "₱499/month"  },
    business: { label: "Business Plan 💼", color: "#7C3AED", price: "₱4,499/year" },
    basic:    { label: "Basic Plan",       color: "#059669", price: "Free"         },
  };
  const meta = planMeta[planName?.toLowerCase()] ?? planMeta.basic;
  const result = await Swal.fire({
    title: "🎉 Subscription Activated!",
    html: `<div style="text-align:center"><div style="display:inline-block;background:${meta.color}18;border:1px solid ${meta.color}40;border-radius:12px;padding:6px 18px;font-size:13px;font-weight:700;color:${meta.color};margin-bottom:14px;">${meta.label} · ${meta.price}</div><p style="font-size:14px;color:#374151;line-height:1.7;margin-bottom:10px">Your payment for <strong>${shopName || "your shop"}</strong> has been <strong style="color:#059669">confirmed by the admin</strong> and is now active.</p><p style="font-size:12px;color:#6B7280;line-height:1.6;margin:0">⚠️ Sign out and log back in for your upgraded features to take effect.</p></div>`,
    icon: "success",
    showCancelButton: true,
    confirmButtonText: "Sign Out & Log In →",
    cancelButtonText:  "Remind Me Later",
    confirmButtonColor: meta.color,
    cancelButtonColor: "#9CA3AF",
    allowOutsideClick: false,
    allowEscapeKey: false,
    backdrop: "rgba(15,23,42,0.65)",
  });
  if (result.isConfirmed) onConfirm();
  else onLater();
}

export default function ShopDashboardRouter() {
  const navigate = useNavigate();
  const [plan, setPlan]     = useState(null);
  const [shopId, setShopId] = useState(null);
  const shopMetaRef   = useRef(null);
  const prevStatusRef = useRef(null);
  const alertShownRef = useRef(false);
  const unsubRef      = useRef(null);

  // ── Step 1: Auth ──────────────────────────────────────────────────────
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setPlan(false);
        navigate("/login", { replace: true });
        return;
      }

      console.log("🔍 ROUTER — Firebase Auth UID:", user.uid);
      setShopId(user.uid);

      try {
        const shopData = await getShopProfile();
        console.log("🔍 ROUTER — getShopProfile():", {
          shopName: shopData?.shopName,
          plan: shopData?.subscriptionPlan,
          status: shopData?.subscriptionStatus,
          docId: shopData?.id,
        });
        shopMetaRef.current = {
          shopName:  shopData?.shopName  || "",
          email:     shopData?.email     || "",
          ownerName: shopData?.ownerName || "",
        };
      } catch (err) {
        console.warn("🔍 ROUTER — getShopProfile failed:", err.message);
      }
    });
    return () => unsubAuth();
  }, [navigate]);

  // ── Step 2: Firestore live snapshot ───────────────────────────────────
  useEffect(() => {
    if (!shopId) return;
    unsubRef.current?.();

    console.log("🔍 ROUTER — Listening to: shops/" + shopId);

    const unsub = onSnapshot(doc(db, "shops", shopId), async (snap) => {
      if (!snap.exists()) {
        console.error("🔍 ROUTER — Document shops/" + shopId + " does NOT exist!");
        return;
      }

      const data        = snap.data();
      const rawPlan     = data.subscriptionPlan;
      const normalized  = rawPlan?.toLowerCase()?.trim();
      const resolved    = VALID_PLANS.includes(normalized) ? normalized : "basic";

      console.log("🔍 ROUTER — Snapshot for shops/" + snap.id, {
        shopName:            data.shopName,
        subscriptionPlan:    rawPlan,           // exact value from Firestore
        normalized,                              // after toLowerCase + trim
        resolved,                               // what plan state will be set to
        subscriptionStatus:  data.subscriptionStatus,
      });

      setPlan(resolved);

      // Subscription activation alert
      if (
        prevStatusRef.current !== null &&
        prevStatusRef.current !== "active" &&
        data.subscriptionStatus === "active" &&
        !alertShownRef.current
      ) {
        alertShownRef.current = true;
        await showSubscriptionAlert({
          planName: normalized,
          shopName: data.shopName || shopMetaRef.current?.shopName || "",
          onConfirm: async () => {
            try { await logoutShop(); } catch (_) {}
            navigate("/login", { replace: true });
          },
          onLater: () => { alertShownRef.current = false; },
        });
      }

      prevStatusRef.current = data.subscriptionStatus;
    });

    unsubRef.current = unsub;
    return () => { unsub(); unsubRef.current = null; };
  }, [shopId, navigate]);

  useEffect(() => () => { unsubRef.current?.(); }, []);

  if (plan === null) {
    return (
      <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#F4F6F9", fontFamily:"'Inter',sans-serif" }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ width:40, height:40, border:"3px solid #E2E8F0", borderTopColor:"#2C5282", borderRadius:"50%", animation:"spin .8s linear infinite", margin:"0 auto 16px" }} />
          <div style={{ fontSize:14, color:"#94A3B8", fontWeight:500 }}>Loading your dashboard...</div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </div>
    );
  }

  if (plan === false) return null;

  console.log("🔍 ROUTER — Rendering:", plan, "dashboard");

  switch (plan) {
    case "pro":      return <ShopDashboardPro />;
    case "business": return <ShopDashboardBusiness />;
    default:         return <ShopDashboardBasic />;
  }
}