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
      setMessage("Role saved.");
    } catch {
      setMessage("Could not save the role. Try again.");
    }
  }

  if (loading || role !== "admin") return <main className="center">Loading</main>;

  return (
    <AppShell title="Manage users">
      <p className="muted">
        <b>user</b> can view data. <b>admin</b> can also manage roles and clear history.
        <b> device</b> is for the ESP32 account and can write readings.
      </p>
      {message && <p className="stamp" role="status">{message}</p>}
      <div className="scroll">
        <table>
          <thead><tr><th>Email</th><th>Role</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.email}>
                <td>{u.email}</td>
                <td>
                  <select
                    value={u.role}
                    disabled={u.email === user.email.toLowerCase()}
                    onChange={(e) => changeRole(u.email, e.target.value)}
                    aria-label={`Role for ${u.email}`}
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                    <option value="device">device</option>
                  </select>
                  {u.email === user.email.toLowerCase() && <span className="muted"> (you)</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
