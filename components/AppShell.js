"use client";
import AppHeader from "./AppHeader";

// Mirroring to Firestore is handled server-side by /api/sync on a schedule, so
// there's deliberately no browser-side mirror here: two writers produced
// duplicate readings, and it only ran while a tab happened to be open.
export default function AppShell({ children }) {
  return (
    <div className="app-shell">
      <AppHeader />
      <main className="page">{children}</main>
    </div>
  );
}
