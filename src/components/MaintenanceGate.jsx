// src/components/MaintenanceGate.jsx
import { useState, useEffect } from "react";
import { doc, onSnapshot, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useLocation } from "react-router-dom";
import { auth, db } from "../services/firebase";

function isAdminPath(pathname = "") {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export default function MaintenanceGate({ children }) {
  const location = useLocation();
  const [status, setStatus] = useState("checking"); // checking | maintenance | ok
  const [maintenanceOn, setMaintenanceOn] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);

  useEffect(() => {
    const unsubMaintenance = onSnapshot(
      doc(db, "systemConfig", "maintenance"),
      async (snap) => {
        const on = snap.exists() ? snap.data().maintenanceMode === true : false;
        setMaintenanceOn(on);
        if (!on) {
          setStatus("ok");
          return;
        }

        const user = auth.currentUser;
        if (!user) {
          // Admins still need /admin login during maintenance
          setIsAdminUser(false);
          setStatus(isAdminPath(window.location.pathname) ? "ok" : "maintenance");
          return;
        }

        try {
          const adminSnap = await getDoc(doc(db, "admins", user.uid));
          const admin = adminSnap.exists();
          setIsAdminUser(admin);
          setStatus(admin || isAdminPath(window.location.pathname) ? "ok" : "maintenance");
        } catch {
          setIsAdminUser(false);
          setStatus(isAdminPath(window.location.pathname) ? "ok" : "maintenance");
        }
      },
      () => setStatus("ok")
    );

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      const snap = await getDoc(doc(db, "systemConfig", "maintenance")).catch(() => null);
      const on = snap?.exists() ? snap.data().maintenanceMode === true : false;
      setMaintenanceOn(on);

      if (!on) {
        setStatus("ok");
        return;
      }
      if (!user) {
        setIsAdminUser(false);
        setStatus(isAdminPath(window.location.pathname) ? "ok" : "maintenance");
        return;
      }
      try {
        const adminSnap = await getDoc(doc(db, "admins", user.uid));
        const admin = adminSnap.exists();
        setIsAdminUser(admin);
        setStatus(admin || isAdminPath(window.location.pathname) ? "ok" : "maintenance");
      } catch {
        setStatus(isAdminPath(window.location.pathname) ? "ok" : "maintenance");
      }
    });

    return () => {
      unsubMaintenance?.();
      unsubAuth();
    };
  }, []);

  // Re-evaluate when route changes (e.g. jump to /admin while maintenance is on)
  useEffect(() => {
    if (!maintenanceOn) {
      setStatus("ok");
      return;
    }
    if (isAdminUser || isAdminPath(location.pathname)) {
      setStatus("ok");
    } else {
      setStatus("maintenance");
    }
  }, [location.pathname, maintenanceOn, isAdminUser]);

  if (status === "checking") {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", background: "#F0F4F8",
        fontFamily: "var(--font-base)",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            border: "3px solid #E2E8F0", borderTopColor: "#4F46E5",
            animation: "spin 0.8s linear infinite", margin: "0 auto 14px",
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <div style={{ fontSize: 13, color: "#94A3B8" }}>Checking system status...</div>
        </div>
      </div>
    );
  }

  if (status === "maintenance") {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", background: "#0F172A",
        fontFamily: "var(--font-base)", padding: 24,
      }}>
        <div style={{ textAlign: "center", maxWidth: 480 }}>
          <div style={{
            width: 80, height: 80, borderRadius: "50%",
            background: "linear-gradient(135deg, #2C3E50, #648DB6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 28px", fontSize: 36,
            boxShadow: "0 0 40px rgba(44,62,80,0.4)",
          }}>
            🔧
          </div>

          <h1 style={{
            fontSize: 28, fontWeight: 800, color: "#F1F5F9",
            marginBottom: 12, letterSpacing: "-0.02em",
          }}>
            Down for Maintenance
          </h1>

          <p style={{
            fontSize: 15, color: "#94A3B8", lineHeight: 1.7,
            marginBottom: 32,
          }}>
            iConstruct is currently undergoing scheduled maintenance.
            We&apos;ll be back online shortly. Thank you for your patience.
          </p>

          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(100,141,182,0.12)", border: "1px solid rgba(100,141,182,0.3)",
            borderRadius: 40, padding: "8px 18px",
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: "#F59E0B",
              animation: "pulse 1.5s ease-in-out infinite",
              display: "inline-block",
            }} />
            <style>{`
              @keyframes pulse {
                0%, 100% { opacity: 1; transform: scale(1); }
                50%       { opacity: 0.4; transform: scale(0.75); }
              }
            `}</style>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#93C5FD" }}>
              Maintenance in progress
            </span>
          </div>

          <p style={{ fontSize: 12, color: "#475569", marginTop: 28 }}>
            Are you an admin?{" "}
            <a href="/admin" style={{ color: "#93C5FD", textDecoration: "none", fontWeight: 600 }}>
              Sign in here →
            </a>
          </p>
        </div>
      </div>
    );
  }

  return children;
}
