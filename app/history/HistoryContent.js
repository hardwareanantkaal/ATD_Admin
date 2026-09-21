"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { collection, doc, getDocs, limit, onSnapshot, orderBy, query, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthContext";
import { usePoles } from "@/lib/usePoles";
import { hasTempFault } from "@/lib/deviceStatus";
import AppShell from "@/components/AppShell";
import StatusDot from "@/components/StatusDot";
import Trend from "@/components/Trend";

const backIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

export default function HistoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, role, loading } = useAuth();
  const { poles, error: poleError } = usePoles(!!user);
  const [selectedPoleId, setSelectedPoleId] = useState(null);
  const [history, setHistory] = useState([]);
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
  const hasVoltage = history.some((r) => typeof r.voltage_v === "number");

  return (
    <AppShell>
      {(error || poleError) && <p className="error" role="alert">{error || poleError}</p>}

      {poles.length === 0 ? (
        <p className="muted">No devices registered yet. Telemetry history will appear here once readings are recorded.</p>
      ) : (
        <>
          <div className="detail-toolbar">
            <div className="detail-toolbar-title">
              <Link href="/dashboard" className="btn-icon" aria-label="Back to dashboard">
                {backIcon}
              </Link>
              <div>
                <h1>{effectiveSelectedId} — History</h1>
                {pole?.mac && <p className="detail-mac">{pole.mac}</p>}
              </div>
            </div>
            <div className="detail-toolbar-actions">
              <button className="btn-secondary" onClick={() => location.reload()}>
                Refresh
              </button>
            </div>
          </div>

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

          <div className="chart-grid">
            <div className="chart-card">
              <h3>X / Y Position (meters)</h3>
              <Trend
                series={[
                  { values: history.map((r) => Number(r.x_m)), color: "var(--metric-x)", label: "X (m)" },
                  { values: history.map((r) => Number(r.y_m)), color: "var(--metric-y)", label: "Y (m)" },
                ]}
              />
            </div>
            <div className="chart-card">
              <h3>Temperature (°C)</h3>
              {/* -999 readings are the firmware's sensor-fault flag; they'd wreck the scale. */}
              <Trend
                values={history.map((r) => r.temp_c).filter((t) => !hasTempFault(t)).map(Number)}
                color="var(--metric-temp)"
                label="Temp (°C)"
                unit="°C"
              />
            </div>
          </div>

          <div className="chart-grid">
            <div className="chart-card">
              <h3>Voltage (V)</h3>
              {hasVoltage ? (
                <Trend values={history.map((r) => Number(r.voltage_v))} color="var(--metric-battery)" label="Voltage (V)" unit=" V" />
              ) : (
                <p className="trend-empty">No data</p>
              )}
            </div>
            <div className="chart-card">
              <h3>Status Timeline</h3>
              {history.length > 0 ? (
                <>
                  <div className="status-timeline">
                    {history.map((r) => {
                      const fault = r.x_status !== "OK" || r.y_status !== "OK";
                      return (
                        <span
                          key={r._key}
                          className={`status-timeline-seg ${fault ? "fault" : "ok"}`}
                          title={`${r.ts ? new Date(r.ts).toLocaleString() : ""} — X:${r.x_status} Y:${r.y_status}`}
                        />
                      );
                    })}
                  </div>
                  <div className="trend-legend">
                    <span className="trend-legend-item">
                      <span className="trend-legend-swatch" style={{ background: "var(--status-good-dot)" }} />
                      OK
                    </span>
                    <span className="trend-legend-item">
                      <span className="trend-legend-swatch" style={{ background: "var(--status-warn-dot)" }} />
                      Fault/Down
                    </span>
                  </div>
                </>
              ) : (
                <p className="trend-empty">No data</p>
              )}
            </div>
          </div>

          <section className="history">
            <div className="history-head">
              <h2>Raw Data ({history.length} records)</h2>
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
                      <th>Time</th>
                      <th>X (m)</th>
                      <th>Y (m)</th>
                      <th>Temp (°C)</th>
                      <th>V (V)</th>
                      <th>X status</th>
                      <th>Y status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...history].reverse().slice(0, 25).map((r) => (
                      <tr key={r._key}>
                        <td>{r.ts ? new Date(r.ts).toLocaleString() : "--"}</td>
                        <td>{Number(r.x_m).toFixed(3)}</td>
                        <td>{Number(r.y_m).toFixed(3)}</td>
                        <td>{hasTempFault(r.temp_c) ? "—" : Number(r.temp_c).toFixed(1)}</td>
                        <td>{typeof r.voltage_v === "number" ? r.voltage_v.toFixed(1) : "--"}</td>
                        <td><StatusDot tone={r.x_status === "OK" ? "good" : "critical"}>{r.x_status}</StatusDot></td>
                        <td><StatusDot tone={r.y_status === "OK" ? "good" : "critical"}>{r.y_status}</StatusDot></td>
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
