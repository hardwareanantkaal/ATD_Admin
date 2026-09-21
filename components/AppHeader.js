"use client";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthContext";

export default function AppHeader({ title }) {
  const { user, role } = useAuth();
  const initial = user?.email ? user.email.charAt(0).toUpperCase() : "U";

  return (
    <header className="bar">
      <div className="bar-title-group">
        <h2 className="bar-title">{title}</h2>
      </div>
      <nav>
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
