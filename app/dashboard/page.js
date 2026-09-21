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
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
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

  if (loading || !user) {
    return (
      <main className="center">
        <div className="spinner" />
        <span>Loading dashboard...</span>
      </main>
    );
  }

  const onlineCount = poles.filter((p) => isOnline(p.updatedAt, now)).length;
  const faultCount = poles.filter((p) => p.x_status !== "OK" || p.y_status !== "OK").length;

  return (
    <AppShell title="Dashboard">
      <div className="page-header">
        <h1>System Overview</h1>
        <p>Overview of active device telemetry, connectivity, and hardware fault status.</p>
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      {poles.length === 0 ? (
        <div className="stat-tile" style={{ padding: "2rem" }}>
          <p className="muted" style={{ margin: 0 }}>
            No poles registered yet. Once a device sends its first reading, telemetry will appear here.
          </p>
        </div>
      ) : (
        <>
          <div className="stat-row">
            <div className="stat-tile">
              <div className="stat-tile-label">Total Poles</div>
              <div className="stat-tile-value">{poles.length}</div>
            </div>
            <div className="stat-tile">
              <div className="stat-tile-label">Online</div>
              <div className="stat-tile-value" style={{ color: "var(--status-good-dot)" }}>
                {onlineCount}
              </div>
            </div>
            <div className="stat-tile">
              <div className="stat-tile-label">Offline</div>
              <div className="stat-tile-value" style={{ color: "var(--status-warn-dot)" }}>
                {poles.length - onlineCount}
              </div>
            </div>
            <div className="stat-tile">
              <div className="stat-tile-label">Active Faults</div>
              <div className="stat-tile-value" style={{ color: "var(--status-crit-dot)" }}>
                {faultCount}
              </div>
            </div>
          </div>

          <div className="history" style={{ marginTop: "1rem" }}>
            <div className="history-head">
              <h2>Pole Devices Status</h2>
            </div>
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th>Pole ID</th>
                    <th>Connectivity</th>
                    <th>X Axis</th>
                    <th>Y Axis</th>
                    <th>Last Update</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {poles.map((p) => {
                    const updatedMs = p.updatedAt;
                    const online = isOnline(updatedMs, now);
                    return (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 700 }}>{p.id}</td>
                        <td>
                          <StatusDot tone={online ? "good" : "warning"} pulse={online}>
                            {online ? "Online" : "Offline"}
                          </StatusDot>
                        </td>
                        <td>
                          <StatusDot tone={p.x_status === "OK" ? "good" : "critical"}>
                            {p.x_status}
                          </StatusDot>
                        </td>
                        <td>
                          <StatusDot tone={p.y_status === "OK" ? "good" : "critical"}>
                            {p.y_status}
                          </StatusDot>
                        </td>
                        <td>{updatedMs ? ago(now - updatedMs) : "--"}</td>
                        <td>
                          <Link href={`/history?pole=${encodeURIComponent(p.id)}`} className="btn-card-action">
                            <span>History</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <line x1="5" y1="12" x2="19" y2="12" />
                              <polyline points="12 5 19 12 12 19" />
                            </svg>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
