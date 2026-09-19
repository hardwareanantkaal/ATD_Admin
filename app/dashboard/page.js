"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { usePoles } from "@/lib/usePoles";
import { isOnline } from "@/lib/deviceStatus";
import AppShell from "@/components/AppShell";
import StatusDot from "@/components/StatusDot";

function ago(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

export default function Dashboard() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { poles, error } = usePoles(!!user);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, user, router]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (loading || !user) return <main className="center">Loading</main>;

  const onlineCount = poles.filter((p) => isOnline(p.updatedAt?.toMillis?.(), now)).length;
  const faultCount = poles.filter((p) => p.x_status !== "OK" || p.y_status !== "OK").length;

  return (
    <AppShell title="Dashboard">
      {error && <p className="error" role="alert">{error}</p>}

      {poles.length === 0 ? (
        <p className="muted">No poles yet. Once a device sends its first reading, it will appear here.</p>
      ) : (
        <>
            <div className="stat-row">
              <div className="stat-tile">
                <div className="stat-tile-value">{poles.length}</div>
                <div className="stat-tile-label">Total poles</div>
              </div>
              <div className="stat-tile">
                <div className="stat-tile-value" style={{ color: "var(--status-good)" }}>{onlineCount}</div>
                <div className="stat-tile-label">Online</div>
              </div>
              <div className="stat-tile">
                <div className="stat-tile-value" style={{ color: "var(--status-warning)" }}>{poles.length - onlineCount}</div>
                <div className="stat-tile-label">Offline</div>
              </div>
              <div className="stat-tile">
                <div className="stat-tile-value" style={{ color: "var(--status-critical)" }}>{faultCount}</div>
                <div className="stat-tile-label">Faults</div>
              </div>
            </div>

            <div className="scroll">
              <table>
                <thead>
                  <tr><th>Pole</th><th>Status</th><th>X axis</th><th>Y axis</th><th>Last update</th><th></th></tr>
                </thead>
                <tbody>
                  {poles.map((p) => {
                    const updatedMs = p.updatedAt?.toMillis?.();
                    const online = isOnline(updatedMs, now);
                    return (
                      <tr key={p.id}>
                        <td>{p.id}</td>
                        <td><StatusDot tone={online ? "good" : "warning"}>{online ? "Online" : "Offline"}</StatusDot></td>
                        <td><StatusDot tone={p.x_status === "OK" ? "good" : "critical"}>{p.x_status}</StatusDot></td>
                        <td><StatusDot tone={p.y_status === "OK" ? "good" : "critical"}>{p.y_status}</StatusDot></td>
                        <td>{updatedMs ? ago(now - updatedMs) : "--"}</td>
                        <td><Link href={`/history?pole=${encodeURIComponent(p.id)}`}>History</Link></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
          </div>
        </>
      )}
    </AppShell>
  );
}
