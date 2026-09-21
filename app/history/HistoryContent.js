"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, doc, getDocs, limit, onSnapshot, orderBy, query, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthContext";
import { usePoles } from "@/lib/usePoles";
import AppShell from "@/components/AppShell";
import StatusDot from "@/components/StatusDot";
import Trend from "@/components/Trend";

function ago(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const metrics = [
  { key: "x_m", label: "X displacement", unit: " m", color: "var(--metric-x)" },
  { key: "y_m", label: "Y displacement", unit: " m", color: "var(--metric-y)" },
  { key: "temp_c", label: "Temperature", unit: "°C", color: "var(--metric-temp)" },
];

export default function HistoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, role, loading } = useAuth();
  const { poles, error: poleError } = usePoles(!!user);
  const [selectedPoleId, setSelectedPoleId] = useState(null);
  const [history, setHistory] = useState([]);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, user, router]);

  const requestedId = searchParams.get("pole");
  const effectiveSelectedId = poles.some((p) => p.id === selectedPoleId)
    ? selectedPoleId
    : poles.some((p) => p.id === requestedId)
      ? requestedId
      : (poles[0]?.id ?? null);

  useEffect(() => {
    if (!effectiveSelectedId) return;
    const q = query(collection(db, "device", effectiveSelectedId, "sensor_data"), orderBy("batch", "desc"), limit(2));
    return onSnapshot(q, (snap) => {
      const batches = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.batch - b.batch);
      const rows = batches.flatMap((b) => (b.readings ?? []).map((r, i) => ({ ...r, _key: `${b.id}-${i}` })));
      setHistory(rows.slice(-50));
    });
  }, [effectiveSelectedId]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  async function clearHistory() {
    if (!confirm("Delete all stored readings for this pole? This cannot be undone.")) return;
    try {
      const snap = await getDocs(collection(db, "device", effectiveSelectedId, "sensor_data"));
      for (let i = 0; i < snap.docs.length; i += 500) {
        const batch = writeBatch(db);
        snap.docs.slice(i, i + 500).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
      await updateDoc(doc(db, "device", effectiveSelectedId), { currentBatch: 1, currentBatchCount: 0 });
    } catch {
      setError("Could not delete the history. Only admins can do this.");
    }
  }

  if (loading || !user) {
    return (
      <main className="center">
        <div className="spinner" />
        <span>Loading history...</span>
      </main>
    );
  }

  const pole = poles.find((p) => p.id === effectiveSelectedId) ?? null;
  const updatedMs = pole?.updatedAt;

  return (
    <AppShell title="History">
      <div className="page-header">
        <h1>Telemetry History</h1>
        <p>Historical trends and logged sensor batches for connected devices.</p>
      </div>

      {(error || poleError) && <p className="error" role="alert">{error || poleError}</p>}

      {poles.length === 0 ? (
        <div className="stat-tile" style={{ padding: "2rem" }}>
          <p className="muted" style={{ margin: 0 }}>
            No poles registered yet. Telemetry history will appear here once readings are recorded.
          </p>
        </div>
      ) : (
        <>
          {poles.length > 1 && (
            <div className="pole-tabs">
              {poles.map((p) => (
                <button
                  key={p.id}
                  className={`pole-tab ${p.id === effectiveSelectedId ? "active" : ""}`}
                  onClick={() => setSelectedPoleId(p.id)}
                >
                  {p.id}
                </button>
              ))}
            </div>
          )}

          <div className="stat-tile" style={{ marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
              <div>
                <h3 style={{ margin: "0 0 0.25rem", fontSize: "1.1rem" }}>{effectiveSelectedId}</h3>
                <p className="stamp" style={{ margin: 0 }}>
                  {updatedMs ? `Last reading received ${ago(now - updatedMs)}` : "No readings yet."}
                  {typeof pole?.voltage_v === "number" && ` · Battery ${pole.voltage_v.toFixed(1)} V`}
                </p>
              </div>

              <div className="status-row">
                <StatusDot tone={pole?.x_status === "OK" ? "good" : "critical"}>
                  X axis {pole?.x_status ?? "--"}
                </StatusDot>
                <StatusDot tone={pole?.y_status === "OK" ? "good" : "critical"}>
                  Y axis {pole?.y_status ?? "--"}
                </StatusDot>
              </div>
            </div>
          </div>

          {metrics.map((m) => (
            <section key={m.key} className="metric">
              <div className="metric-value">
                <span className="metric-label">{m.label}</span>
                <span className="numeral" style={{ color: m.color }}>
                  {pole ? Number(pole[m.key]).toFixed(m.key === "temp_c" ? 1 : 3) : "--"}
                  <small>{m.unit}</small>
                </span>
              </div>
              <Trend values={history.map((r) => Number(r[m.key]))} color={m.color} label={m.label} unit={m.unit} />
            </section>
          ))}

          <section className="history">
            <div className="history-head">
              <h2>Stored Readings Log</h2>
              {role === "admin" && history.length > 0 && (
                <button className="danger" onClick={clearHistory}>
                  Clear history
                </button>
              )}
            </div>
            {history.length === 0 ? (
              <p className="muted">No readings stored yet.</p>
            ) : (
              <div className="scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>X Displacement (m)</th>
                      <th>Y Displacement (m)</th>
                      <th>Temp (°C)</th>
                      <th>Battery (V)</th>
                      <th>Status (X / Y)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...history].reverse().slice(0, 25).map((r) => (
                      <tr key={r._key}>
                        <td>{r.ts ? new Date(r.ts).toLocaleString() : "--"}</td>
                        <td style={{ color: "var(--metric-x)", fontWeight: 600 }}>{Number(r.x_m).toFixed(3)}</td>
                        <td style={{ color: "var(--metric-y)", fontWeight: 600 }}>{Number(r.y_m).toFixed(3)}</td>
                        <td style={{ color: "var(--metric-temp)", fontWeight: 600 }}>{Number(r.temp_c).toFixed(1)}</td>
                        <td>{Number(r.voltage_v).toFixed(1)}</td>
                        <td>
                          <StatusDot tone={r.x_status === "OK" && r.y_status === "OK" ? "good" : "critical"}>
                            {r.x_status} / {r.y_status}
                          </StatusDot>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </AppShell>
  );
}
