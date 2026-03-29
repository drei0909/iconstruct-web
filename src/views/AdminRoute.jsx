// src/views/AdminRoute.jsx
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { getDoc, doc } from "firebase/firestore";
import { auth, db } from "../services/firebase";

export default function AdminRoute({ children }) {
  const [status, setStatus] = useState("checking"); // checking | allowed | denied

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setStatus("denied");
        return;
      }
      try {
        // Check if this user's UID exists in the "admins" collection
        const adminDoc = await getDoc(doc(db, "admins", user.uid));
        setStatus(adminDoc.exists() ? "allowed" : "denied");
      } catch {
        setStatus("denied");
      }
    });
    return () => unsub();
  }, []);

  if (status === "checking") {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", background: "#f8f6f2",
        fontFamily: "'DM Sans', sans-serif", color: "rgba(44,62,80,0.5)",
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

  if (status === "denied") {
    return <Navigate to="/admin" replace />;
  }

  return children;
}
