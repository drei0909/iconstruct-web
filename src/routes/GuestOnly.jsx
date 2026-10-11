// src/routes/GuestOnly.jsx
// Wraps a login page. If the visitor is already signed in AND can actually
// use a dashboard, send them there (replace, so the login route never sits
// in history). Everyone else gets the login form.

import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../services/firebase";
import { useAuth } from "../context/AuthContext";

function Spinner() {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", background: "#F4F6F9",
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: "50%",
        border: "3px solid #E2E8F0", borderTopColor: "#2C5282",
        animation: "spin .8s linear infinite",
      }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// Statuses that can never open the shop dashboard. "unknown" (status read
// failed, e.g. flaky network) is deliberately NOT here — the dashboard
// router re-checks and shows the real error instead of a silent sign-out.
const BLOCKED = new Set(["pending", "rejected", "suspended", "deleted", "none"]);

export default function GuestOnly({
  children,
  to = "/shop/dashboard",
  adminAware = false,
}) {
  const { user, isAdmin, shopStatus, initializing, checking } = useAuth();

  // A leftover session that can't use the dashboard (unfinished sign-up,
  // pending/rejected/suspended shop) — clear it quietly so the visitor just
  // sees a normal login form instead of an "Access restricted" loop. Done as
  // an effect so the form below stays the same mounted element throughout.
  const blocked =
    !initializing && !checking && !!user && !isAdmin && !adminAware && BLOCKED.has(shopStatus);
  useEffect(() => {
    if (blocked) signOut(auth).catch(() => {});
  }, [blocked]);

  // First page load only: hold on a spinner so a signed-in visitor never
  // sees the form flash before being redirected.
  if (initializing) return <Spinner />;
  if (!user) return children;

  // Mid sign-in: keep the form MOUNTED. Swapping it for a spinner here used
  // to unmount the login form, so it could never show its own result —
  // e.g. "your application is still under review" was silently lost.
  if (checking) return children;

  if (adminAware) {
    // /admin: only bounce confirmed admins forward. A signed-in non-admin can
    // still use the form to authenticate with an admin account.
    return isAdmin ? <Navigate to="/admin/dashboard" replace /> : children;
  }

  if (isAdmin) return <Navigate to="/admin/dashboard" replace />;
  if (blocked) return children;
  return <Navigate to={to} replace />;
}
