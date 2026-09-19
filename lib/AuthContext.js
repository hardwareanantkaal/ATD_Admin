"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

const AuthContext = createContext({ user: null, role: null, loading: true });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stopRole = () => {};
    const stopAuth = onAuthStateChanged(auth, (u) => {
      stopRole();
      setUser(u);
      if (!u) {
        setRole(null);
        setLoading(false);
        return;
      }
      // Role lives in Firestore: users/{email}.role  ("user" | "admin" | "device")
      stopRole = onSnapshot(doc(db, "users", u.email.toLowerCase()), (snap) => {
        setRole(snap.data()?.role ?? "user");
        setLoading(false);
      });
    });
    return () => {
      stopRole();
      stopAuth();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
