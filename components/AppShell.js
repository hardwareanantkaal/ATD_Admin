"use client";
import Sidebar from "./Sidebar";
import AppHeader from "./AppHeader";

export default function AppShell({ title, children }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <AppHeader title={title} />
        <main className="page">{children}</main>
      </div>
    </div>
  );
}
