"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

const icons = {
  live: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" />
    </svg>
  ),
  dashboard: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  ),
  history: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  ),
  admin: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3" />
      <path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6" />
      <circle cx="18" cy="8" r="2.3" />
      <path d="M16 14.2c2.9.5 5 2.6 5 5.8" />
    </svg>
  ),
};

const items = [
  { href: "/live", label: "Live", icon: "live" },
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/history", label: "History", icon: "history" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { role } = useAuth();

  return (
    <nav className="sidebar" aria-label="Main">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`sidebar-item ${pathname === item.href ? "active" : ""}`}
          aria-label={item.label}
          aria-current={pathname === item.href ? "page" : undefined}
        >
          {icons[item.icon]}
          <span className="sidebar-label">{item.label}</span>
        </Link>
      ))}
      {role === "admin" && (
        <Link
          href="/admin"
          className={`sidebar-item ${pathname === "/admin" ? "active" : ""}`}
          aria-label="Manage users"
          aria-current={pathname === "/admin" ? "page" : undefined}
        >
          {icons.admin}
          <span className="sidebar-label">Manage users</span>
        </Link>
      )}
    </nav>
  );
}
