"use client";
import AppHeader from "./AppHeader";
import { useAuth } from "@/lib/AuthContext";
import { useSyncRtdbToFirestore } from "@/lib/syncRtdbToFirestore";

export default function AppShell({ children }) {
  const { user } = useAuth();
  useSyncRtdbToFirestore(!!user);

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="page">{children}</main>
    </div>
  );
}
