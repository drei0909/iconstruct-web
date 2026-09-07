// src/routes/AdminRoute.jsx
// Gate for /admin/dashboard. Auth + admin status come from the single
// AuthProvider (context/AuthContext) — no per-route auth subscription.

import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AdminRoute({ children }) {
  const { user, isAdmin, initializing } = useAuth();

  if (initializing) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", background: "#f8f6f2",
        fontFamily: "var(--font-base)", color: "rgba(44,62,80,0.5)",
        fontSize: 14,
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 32, height: 32,
            border: "3px solid rgba(44,62,80,0.1)",
            borderTopColor: "#648DB6",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
            margin: "0 auto 12px",
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          Checking access...
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  return children;
}
