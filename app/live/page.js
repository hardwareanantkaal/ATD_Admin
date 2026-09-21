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

export default function Live() {
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
        <span>Loading live telemetry...</span>
      </main>
    );
  }

  return (
    <AppShell title="Live readings">
      <div className="page-header">
        <h1>Live Sensor Readings</h1>
        <p>Real-time telemetry and status monitoring for all connected field poles.</p>
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      {poles.length === 0 ? (
        <div className="stat-tile" style={{ padding: "2rem" }}>
          <p className="muted" style={{ margin: 0 }}>
            No poles registered yet. As soon as an ESP32 device transmits telemetry, it will display here automatically.
          </p>
        </div>
      ) : (
        <div className="pole-grid">
          {poles.map((p) => {
            const updatedMs = p.updatedAt;
            const online = isOnline(updatedMs, now);
            return (
              <article key={p.id} className="pole-card">
                <div>
                  <div className="pole-card-head">
                    <div className="pole-title-group">
                      <div className="pole-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="5" y="2" width="14" height="20" rx="2" />
                          <line x1="12" y1="18" x2="12" y2="18.01" />
                        </svg>
                      </div>
                      <h3>{p.id}</h3>
                    </div>
                    <StatusDot tone={online ? "good" : "warning"} pulse={online}>
                      {online ? "Online" : "Offline"}
                    </StatusDot>
                  </div>

                  <p className="stamp">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    {updatedMs ? `Last reading ${ago(now - updatedMs)}` : "No readings yet."}
                  </p>

                  <div className="pole-metrics">
                    <div className="pole-metric">
                      <span className="pole-metric-label">X displacement</span>
                      <span className="pole-metric-value" style={{ color: "var(--metric-x)" }}>
                        {Number(p.x_m).toFixed(3)} <small style={{ fontSize: "0.65em", color: "var(--text-muted)" }}>m</small>
                      </span>
                    </div>

                    <div className="pole-metric">
                      <span className="pole-metric-label">Y displacement</span>
                      <span className="pole-metric-value" style={{ color: "var(--metric-y)" }}>
                        {Number(p.y_m).toFixed(3)} <small style={{ fontSize: "0.65em", color: "var(--text-muted)" }}>m</small>
                      </span>
                    </div>

                    <div className="pole-metric">
                      <span className="pole-metric-label">Temperature</span>
                      <span className="pole-metric-value" style={{ color: "var(--metric-temp)" }}>
                        {Number(p.temp_c).toFixed(1)} <small style={{ fontSize: "0.65em", color: "var(--text-muted)" }}>°C</small>
                      </span>
                    </div>

                    <div className="pole-metric">
                      <span className="pole-metric-label">Battery</span>
                      <span className="pole-metric-value" style={{ color: "var(--metric-battery)" }}>
                        {Number(p.voltage_v).toFixed(1)} <small style={{ fontSize: "0.65em", color: "var(--text-muted)" }}>V</small>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pole-card-footer">
                  <div className="status-row">
                    <StatusDot tone={p.x_status === "OK" ? "good" : "critical"}>
                      X axis {p.x_status}
                    </StatusDot>
                    <StatusDot tone={p.y_status === "OK" ? "good" : "critical"}>
                      Y axis {p.y_status}
                    </StatusDot>
                  </div>

                  <Link href={`/history?pole=${encodeURIComponent(p.id)}`} className="btn-card-action">
                    <span>View history</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
