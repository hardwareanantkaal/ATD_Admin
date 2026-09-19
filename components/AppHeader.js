"use client";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthContext";

export default function AppHeader({ title }) {
  const { user, role } = useAuth();

  return (
    <header className="bar">
      <strong>{title}</strong>
      <nav>
        <span className="who">{user?.email} ({role})</span>
        <button className="link" onClick={() => signOut(auth)}>Sign out</button>
      </nav>
    </header>
  );
}
