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

  if (loading || !user) return <main className="center">Loading</main>;

  return (
    <AppShell title="Live readings">
      {error && <p className="error" role="alert">{error}</p>}

      {poles.length === 0 ? (
        <p className="muted">No poles yet. Once a device sends its first reading, it will appear here.</p>
      ) : (
        <div className="pole-grid">
            {poles.map((p) => {
              const updatedMs = p.updatedAt?.toMillis?.();
              const online = isOnline(updatedMs, now);
              return (
                <article key={p.id} className="pole-card">
                  <div className="pole-card-head">
                    <h3>{p.id}</h3>
                    <StatusDot tone={online ? "good" : "warning"}>{online ? "Online" : "Offline"}</StatusDot>
                  </div>
                  <p className="stamp">{updatedMs ? `Last reading ${ago(now - updatedMs)}` : "No readings yet."}</p>
                  <div className="pole-metrics">
                    <div className="pole-metric">
                      <span className="pole-metric-label">X displacement</span>
                      <span className="pole-metric-value" style={{ color: "var(--x)" }}>
                        {Number(p.x_m).toFixed(3)} m
                      </span>
                    </div>
                    <div className="pole-metric">
                      <span className="pole-metric-label">Y displacement</span>
                      <span className="pole-metric-value" style={{ color: "var(--y)" }}>
                        {Number(p.y_m).toFixed(3)} m
                      </span>
                    </div>
                    <div className="pole-metric">
                      <span className="pole-metric-label">Temperature</span>
                      <span className="pole-metric-value" style={{ color: "var(--temp)" }}>
                        {Number(p.temp_c).toFixed(1)} °C
                      </span>
                    </div>
                  </div>
                  <div className="status-row">
                    <StatusDot tone={p.x_status === "OK" ? "good" : "critical"}>X axis {p.x_status}</StatusDot>
                    <StatusDot tone={p.y_status === "OK" ? "good" : "critical"}>Y axis {p.y_status}</StatusDot>
                  </div>
                  <Link href={`/history?pole=${encodeURIComponent(p.id)}`}>View history</Link>
                </article>
              );
            })}
        </div>
      )}
    </AppShell>
  );
}
