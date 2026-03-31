// src/views/shopdashboardrouter.jsx
// iConstruct — Shop Dashboard Router
//
// ROOT CAUSE FIX for "plan resets to basic on reload":
//   On page reload, Firebase Auth is async. auth.currentUser is NULL for ~200-500ms
//   while Firebase restores the session from localStorage. If we call getShopProfile()
//   before Auth is ready, it throws "Not authenticated" and we fall back to "basic".
//
//   FIX: Use onAuthStateChanged to wait until Firebase has fully restored the session
//   BEFORE calling getShopProfile(). Only then read subscriptionPlan.
//
//   BONUS: Redirects to /login if not authenticated at all.

import { useState, useEffect } from "react";
import { useNavigate }         from "react-router-dom";
import { onAuthStateChanged }  from "firebase/auth";
import { auth }                from "../services/firebase";
import { getShopProfile } from "../controllers/shopController";

import ShopDashboardBasic    from "../views/shop/DashboardBasicPage";
import ShopDashboardPro      from "../views/shop/DashboardProPage";
import ShopDashboardBusiness from "../views/shop/DashboardBusinessPage";

export default function ShopDashboardRouter() {
  const navigate = useNavigate();

  // null  = still waiting for Auth
  // false = not logged in
  // "basic" | "pro" | "business" = plan determined
  const [plan, setPlan] = useState(null);

  useEffect(() => {
    // onAuthStateChanged fires ONCE when Firebase has restored (or confirmed no) session.
    // This is the only safe way to read auth state on page reload.
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        // No session → send to login
        setPlan(false);
        navigate("/login", { replace: true });
        return;
      }

      try {
        const shopData = await getShopProfile();

        // Validate subscriptionPlan value
        const validPlans = ["basic", "pro", "business"];
        const p = shopData?.subscriptionPlan;
        setPlan(validPlans.includes(p) ? p : "basic");
      } catch (err) {
        console.error("ShopDashboardRouter: failed to load shop profile", err);
        // If shop profile doesn't exist yet (edge case), default to basic
        setPlan("basic");
      }
    });

    return () => unsubscribe(); // cleanup listener on unmount
  }, [navigate]);

  // While Firebase Auth is restoring session — show loading screen
  if (plan === null) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#F4F6F9",
        fontFamily: "'DM Sans', sans-serif",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 38,
            height: 38,
            border: "3px solid #E2E8F0",
            borderTopColor: "#2C5282",
            borderRadius: "50%",
            animation: "rtr-spin 0.75s linear infinite",
            margin: "0 auto 14px",
          }} />
          <div style={{ fontSize: 13, color: "#94A3B8", fontWeight: 500 }}>
            Loading your dashboard...
          </div>
          <style>{`@keyframes rtr-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  // Auth resolved but not logged in (handled by navigate above, this is a fallback)
  if (plan === false) return null;

  // Render the correct dashboard based on plan
  switch (plan) {
    case "pro":      return <ShopDashboardPro />;
    case "business": return <ShopDashboardBusiness />;
    default:         return <ShopDashboardBasic />;
  }
}
