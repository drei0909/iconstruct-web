// src/routes/GuestOnly.jsx
// Wraps a login page. If the visitor is already authenticated, send them to
// their dashboard (replace, so the login route never sits in history and
// browser Back can't land on it while signed in).

import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function GuestOnly({
  children,
  to = "/shop/dashboard",
  adminAware = false,
}) {
  const { user, isAdmin, initializing } = useAuth();

  // While auth is resolving, show the login form rather than a spinner —
  // a genuine guest sees it instantly; an authed user is redirected a beat later.
  if (initializing || !user) return children;

  if (adminAware) {
    // /admin: only bounce confirmed admins forward. A signed-in non-admin can
    // still use the form to authenticate with an admin account.
    return isAdmin ? <Navigate to="/admin/dashboard" replace /> : children;
  }
  return <Navigate to={to} replace />;
}
