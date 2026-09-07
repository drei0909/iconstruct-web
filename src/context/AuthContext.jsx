// src/context/AuthContext.jsx
// Single source of truth for auth state. One onAuthStateChanged subscription
// for the whole app; everything else reads useAuth().

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { getDoc, doc } from "firebase/firestore";
import { auth, db } from "../services/firebase";

const AuthContext = createContext({
  user: null,
  isAdmin: false,
  initializing: true,
});

export function AuthProvider({ children }) {
  const [state, setState] = useState({ user: null, isAdmin: false, initializing: true });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState({ user: null, isAdmin: false, initializing: false });
        return;
      }
      let isAdmin = false;
      try {
        isAdmin = (await getDoc(doc(db, "admins", user.uid))).exists();
      } catch {
        /* treat as non-admin on read failure */
      }
      setState({ user, isAdmin, initializing: false });
    });
    return () => unsub();
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
