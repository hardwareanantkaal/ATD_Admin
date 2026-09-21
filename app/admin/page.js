"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthContext";
import AppShell from "@/components/AppShell";

export default function Admin() {
  const router = useRouter();
  const { user, role, loading } = useAuth();
  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/");
    else if (role !== "admin") router.replace("/dashboard");
  }, [loading, user, role, router]);

  useEffect(() => {
    if (role !== "admin") return;
    return onSnapshot(collection(db, "users"), (snap) => {
      setUsers(snap.docs.map((d) => ({ email: d.id, ...d.data() })));
    });
  }, [role]);

  async function changeRole(email, newRole) {
    setMessage("");
    try {
      await updateDoc(doc(db, "users", email), { role: newRole });
      setMessage("Role successfully updated.");
    } catch {
      setMessage("Could not save role. Try again.");
    }
  }

  if (loading || role !== "admin") {
    return (
      <main className="center">
        <div className="spinner" />
        <span>Loading user permissions...</span>
      </main>
    );
  }

  return (
    <AppShell title="Manage users">
      <div className="page-header">
        <h1>User Management</h1>
        <p>Assign access roles for portal users and ESP32 device accounts.</p>
      </div>

      <div className="stat-tile" style={{ marginBottom: "1.5rem" }}>
        <p className="muted" style={{ margin: 0 }}>
          <b>user</b> can view live telemetry & history. <b>admin</b> can manage user roles and clear sensor log history. <b>device</b> account is used by ESP32 microcontrollers to write readings.
        </p>
      </div>

      {message && <p className="error" style={{ background: "#f0fdf4", color: "#166534", borderColor: "#bbf7d0" }} role="status">{message}</p>}

      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>User Email</th>
              <th>Assigned Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.email}>
                <td style={{ fontWeight: 600 }}>
                  {u.email}
                  {u.email === user.email.toLowerCase() && <span className="muted"> (you)</span>}
                </td>
                <td>
                  <select
                    value={u.role}
                    disabled={u.email === user.email.toLowerCase()}
                    onChange={(e) => changeRole(u.email, e.target.value)}
                    aria-label={`Role for ${u.email}`}
                    style={{ padding: "0.4rem 0.75rem", fontSize: "0.85rem" }}
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                    <option value="device">device</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
