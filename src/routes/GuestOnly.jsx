// src/routes/GuestOnly.jsx
// Wraps a login page. If the visitor is already authenticated, send them to
// their dashboard (replace, so the login route never sits in history and
// browser Back can't land on it while signed in).

import { Navigate } from "react-router-dom";
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

export default function GuestOnly({
  children,
  to = "/shop/dashboard",
  adminAware = false,
}) {
  const { user, isAdmin, initializing } = useAuth();

  // Never flash the login form to someone who already has a session:
  // hold on a spinner until auth resolves, then either redirect or show the form.
  if (initializing) return <Spinner />;
  if (!user) return children;

  if (adminAware) {
    // /admin: only bounce confirmed admins forward. A signed-in non-admin can
    // still use the form to authenticate with an admin account.
    return isAdmin ? <Navigate to="/admin/dashboard" replace /> : children;
  }
  return <Navigate to={to} replace />;
}
