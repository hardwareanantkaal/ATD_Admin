"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { collection, doc, getDocs, limit, onSnapshot, orderBy, query, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthContext";
import { usePoles } from "@/lib/usePoles";
import { hasTempFault } from "@/lib/deviceStatus";
import { normalizeReading } from "@/lib/normalizeReading";
import { dateTime24 } from "@/lib/formatTime";
import AppShell from "@/components/AppShell";
import StatusDot from "@/components/StatusDot";
import Trend from "@/components/Trend";

const backIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

// Readings are stored 100 per batch doc and the device reports ~every 60s, so
// `batches` is how many docs to pull to comfortably cover each window.
const RANGES = [
  { id: "recent", label: "Last 50 readings", batches: 2, ms: null },
  { id: "1h", label: "Last hour", batches: 3, ms: 60 * 60 * 1000 },
  { id: "6h", label: "Last 6 hours", batches: 8, ms: 6 * 60 * 60 * 1000 },
  { id: "24h", label: "Last 24 hours", batches: 20, ms: 24 * 60 * 60 * 1000 },
  { id: "7d", label: "Last 7 days", batches: 60, ms: 7 * 24 * 60 * 60 * 1000 },
];

function csvCell(value) {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function HistoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, role, loading } = useAuth();
  const { poles, error: poleError } = usePoles(!!user);
  const [selectedPoleId, setSelectedPoleId] = useState(null);
  const [history, setHistory] = useState([]);
  const [rangeId, setRangeId] = useState("recent");
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState("");

  const range = RANGES.find((r) => r.id === rangeId) ?? RANGES[0];

  // Coarse tick - this only moves a time-window cutoff, so per-second precision
  // would just churn the filter for nothing.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

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
    const q = query(collection(db, "device", effectiveSelectedId, "sensor_data"), orderBy("batch", "desc"), limit(range.batches));
    return onSnapshot(q, (snap) => {
      const batches = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.batch - b.batch);
      const rows = batches.flatMap((b) =>
        (b.readings ?? []).map((r, i) => ({ ...normalizeReading(r), _key: `${b.id}-${i}` }))
      );
      setHistory(rows);
    });
  }, [effectiveSelectedId, range.batches]);

  // "Last N readings" takes the tail; the timed windows cut by timestamp.
  // The cutoff comes from ticking state so the filter stays pure during render.
  const visible = useMemo(() => {
    if (!range.ms) return history.slice(-50);
    const cutoff = now - range.ms;
    return history.filter((r) => typeof r.ts === "number" && r.ts >= cutoff);
  }, [history, range, now]);

  function downloadCsv() {
    const header = ["Time", "X (mm)", "Y (mm)", "HTL (m)", "Temp (C)", "Battery (V)", "Solar (V)", "X status", "Y status"];
    const rows = visible.map((r) => [
      r.ts ? new Date(r.ts).toISOString() : "",
      typeof r.x_mm === "number" ? Math.round(r.x_mm) : "",
      typeof r.y_mm === "number" ? Math.round(r.y_mm) : "",
      typeof r.htl_mm === "number" ? (r.htl_mm / 1000).toFixed(3) : "",
      hasTempFault(r.temp_c) ? "" : Number(r.temp_c).toFixed(1),
      typeof r.voltage_v === "number" ? r.voltage_v.toFixed(1) : "",
      typeof r.solar_v === "number" ? r.solar_v.toFixed(1) : "",
      r.x_status ?? "",
      r.y_status ?? "",
    ]);

    const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${effectiveSelectedId}-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

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
  const hasVoltage = visible.some((r) => typeof r.voltage_v === "number");
  const hasSolar = visible.some((r) => typeof r.solar_v === "number");
  const hasHtl = visible.some((r) => typeof r.htl_mm === "number");
  const times = visible.map((r) => r.ts).filter((t) => typeof t === "number");

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
              <button className="btn-secondary" onClick={downloadCsv} disabled={visible.length === 0}>
                Download CSV
              </button>
              <button className="btn-secondary" onClick={() => location.reload()}>
                Refresh
              </button>
            </div>
          </div>

          <div className="filter-bar">
            <div className="filter-pills">
              {RANGES.map((r) => (
                <button
                  key={r.id}
                  className={`filter-pill ${r.id === rangeId ? "active" : ""}`}
                  onClick={() => setRangeId(r.id)}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <span className="muted" style={{ marginLeft: "auto" }}>
              {visible.length} reading{visible.length === 1 ? "" : "s"}
            </span>
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
              <h3>X / Y Position (mm)</h3>
              {/* Payload is in metres (iot.ino divides the sensor's mm by 1000). */}
              <Trend
                timestamps={times}
                series={[
                  { values: visible.map((r) => Number(r.x_mm)), color: "var(--metric-x)", label: "X (mm)" },
                  { values: visible.map((r) => Number(r.y_mm)), color: "var(--metric-y)", label: "Y (mm)" },
                ]}
              />
            </div>
            <div className="chart-card">
              <h3>HTL (meters)</h3>
              {hasHtl ? (
                <Trend
                  timestamps={visible.filter((r) => typeof r.htl_mm === "number").map((r) => r.ts)}
                  values={visible.filter((r) => typeof r.htl_mm === "number").map((r) => r.htl_mm / 1000)}
                  color="var(--metric-htl)"
                  label="HTL (m)"
                  unit=" m"
                />
              ) : (
                <p className="trend-empty">No data</p>
              )}
            </div>
          </div>

          <div className="chart-grid">
            <div className="chart-card">
              <h3>Temperature (°C)</h3>
              {/* -999 readings are the firmware's sensor-fault flag; they'd wreck the scale. */}
              <Trend
                timestamps={visible.filter((r) => !hasTempFault(r.temp_c)).map((r) => r.ts)}
                values={visible.map((r) => r.temp_c).filter((t) => !hasTempFault(t)).map(Number)}
                color="var(--metric-temp)"
                label="Temp (°C)"
                unit="°C"
              />
            </div>
            <div className="chart-card">
              <h3>Battery / Solar (V)</h3>
              {hasVoltage || hasSolar ? (
                <Trend
                  timestamps={times}
                  series={[
                    { values: visible.filter((r) => typeof r.voltage_v === "number").map((r) => r.voltage_v), color: "var(--metric-battery)", label: "Battery (V)" },
                    { values: visible.filter((r) => typeof r.solar_v === "number").map((r) => r.solar_v), color: "var(--metric-solar)", label: "Solar (V)" },
                  ]}
                />
              ) : (
                <p className="trend-empty">No data</p>
              )}
            </div>
          </div>

          <div className="chart-grid">
            <div className="chart-card">
              <h3>Status Timeline</h3>
              {visible.length > 0 ? (
                <>
                  <div className="status-timeline">
                    {visible.map((r) => {
                      const fault = r.x_status !== "OK" || r.y_status !== "OK";
                      return (
                        <span
                          key={r._key}
                          className={`status-timeline-seg ${fault ? "fault" : "ok"}`}
                          title={`${r.ts ? dateTime24(r.ts) : ""} — X:${r.x_status} Y:${r.y_status}`}
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

          <section className="readings-section">
            <div className="history-head">
              <h2>Raw Data ({visible.length} records)</h2>
              {role === "admin" && visible.length > 0 && (
                <button className="danger" onClick={clearHistory}>
                  Clear history
                </button>
              )}
            </div>
            {visible.length === 0 ? (
              <p className="muted">
                {history.length > 0
                  ? "No readings in this time range — pick a wider range above."
                  : "No readings stored yet. History is written to Firestore while the portal is open in a browser; if this stays empty, check that the Firestore rules allow writes to the device collection."}
              </p>
            ) : (
              <div className="scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>X (mm)</th>
                      <th>Y (mm)</th>
                      <th>HTL (m)</th>
                      <th>Temp (°C)</th>
                      <th>Batt (V)</th>
                      <th>Solar (V)</th>
                      <th>X status</th>
                      <th>Y status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...visible].reverse().slice(0, 25).map((r) => (
                      <tr key={r._key}>
                        <td>{r.ts ? dateTime24(r.ts) : "--"}</td>
                        <td>{typeof r.x_mm === "number" ? Math.round(r.x_mm) : "--"}</td>
                        <td>{typeof r.y_mm === "number" ? Math.round(r.y_mm) : "--"}</td>
                        <td>{typeof r.htl_mm === "number" ? (r.htl_mm / 1000).toFixed(3) : "--"}</td>
                        <td>{hasTempFault(r.temp_c) ? "—" : Number(r.temp_c).toFixed(1)}</td>
                        <td>{typeof r.voltage_v === "number" ? r.voltage_v.toFixed(1) : "--"}</td>
                        <td>{typeof r.solar_v === "number" ? r.solar_v.toFixed(1) : "--"}</td>
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
