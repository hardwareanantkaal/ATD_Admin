"use client";
import Link from "next/link";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthContext";

export default function AppHeader() {
  const { user, role } = useAuth();
  const initial = user?.email ? user.email.charAt(0).toUpperCase() : "U";

  return (
    <header className="bar">
      <div className="bar-title-group">
        <div className="brand-icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 12 8 12 10 18 14 6 16 12 21 12" />
          </svg>
        </div>
        <div>
          <h2 className="bar-title">ATD Monitor</h2>
          <p className="bar-subtitle">Auto Tensioning Device</p>
        </div>
      </div>
      <nav>
        <button className="btn-icon" onClick={() => location.reload()} aria-label="Refresh">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
        {role === "admin" && (
          <Link href="/admin" className="btn-secondary">
            Manage users
          </Link>
        )}
        <div className="user-badge">
          <div className="user-avatar">{initial}</div>
          <span>{user?.email}</span>
          {role && <span className={`role-pill ${role}`}>{role}</span>}
        </div>
        <button className="btn-signout" onClick={() => signOut(auth)}>
          Sign out
        </button>
      </nav>
    </header>
  );
}
