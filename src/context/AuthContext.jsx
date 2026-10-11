// src/context/AuthContext.jsx
// Single source of truth for auth state. One onAuthStateChanged subscription
// for the whole app; everything else reads useAuth().
//
//   initializing — true only until the very first auth resolution (page load)
//   checking     — true while ANY sign-in/out transition is being resolved
//   shopStatus   — the signed-in non-admin's shops/{uid}.status, lowercased;
//                  "none" if they have no shop profile, "unknown" if it
//                  couldn't be read (network), null when signed out / admin

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { getDoc, doc } from "firebase/firestore";
import { auth, db } from "../services/firebase";

const AuthContext = createContext({
  user: null,
  isAdmin: false,
  shopStatus: null,
  initializing: true,
  checking: true,
});

export function AuthProvider({ children }) {
  const [state, setState] = useState({
    user: null,
    isAdmin: false,
    shopStatus: null,
    initializing: true,
    checking: true,
  });

  useEffect(() => {
    // Sign-in then an immediate sign-out (e.g. a pending shop rejected by
    // loginShop) fires this twice; without a sequence check the first,
    // slower lookup could land last and resurrect the signed-out user.
    let seq = 0;
    const unsub = onAuthStateChanged(auth, async (user) => {
      const mine = ++seq;
      if (!user) {
        setState({ user: null, isAdmin: false, shopStatus: null, initializing: false, checking: false });
        return;
      }
      // Route guards must wait on `checking` — acting on the previous
      // state here is what used to bounce a real admin back to /admin.
      setState((prev) => ({ ...prev, checking: true }));

      let isAdmin = false;
      try {
        isAdmin = (await getDoc(doc(db, "admins", user.uid))).exists();
      } catch {
        /* treat as non-admin on read failure */
      }

      let shopStatus = null;
      if (!isAdmin) {
        try {
          const snap = await getDoc(doc(db, "shops", user.uid));
          shopStatus = snap.exists() ? String(snap.data()?.status || "").toLowerCase() : "none";
        } catch {
          shopStatus = "unknown";
        }
      }

      if (mine !== seq) return;
      setState({ user, isAdmin, shopStatus, initializing: false, checking: false });
    });
    return () => unsub();
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
