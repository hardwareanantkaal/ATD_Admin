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
  if (s < 60) return `${s} s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

function uptime(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const metrics = [
  { key: "x_m", label: "X displacement", unit: " m", color: "var(--x)" },
  { key: "y_m", label: "Y displacement", unit: " m", color: "var(--y)" },
  { key: "temp_c", label: "Temperature", unit: "°C", color: "var(--temp)" },
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
    // Readings are batched (up to 100 per doc); the newest batch may not have
    // 50 entries yet, so the previous one is fetched too and both flattened.
    const q = query(collection(db, "device", effectiveSelectedId, "sensor_data"), orderBy("batch", "desc"), limit(2));
    return onSnapshot(q, (snap) => {
      const batches = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.batch - b.batch);
      const rows = batches.flatMap((b) => (b.readings ?? []).map((r, i) => ({ ...r, _key: `${b.id}-${i}` })));
      setHistory(rows.slice(-50)); // oldest first
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

  if (loading || !user) return <main className="center">Loading</main>;

  const pole = poles.find((p) => p.id === effectiveSelectedId) ?? null;
  const updatedMs = pole?.updatedAt?.toMillis?.();

  return (
    <AppShell title="History">
      {(error || poleError) && <p className="error" role="alert">{error || poleError}</p>}

      {poles.length === 0 ? (
        <p className="muted">No poles yet. Once a device sends its first reading, it will appear here.</p>
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

            <p className="stamp">
              {updatedMs ? `Last reading received ${ago(now - updatedMs)}` : "No readings yet."}
              {typeof pole?.uptime_s === "number" && ` · Device uptime ${uptime(pole.uptime_s)}`}
            </p>

            <div className="status-row">
              <StatusDot tone={pole?.x_status === "OK" ? "good" : "critical"}>X axis {pole?.x_status ?? "--"}</StatusDot>
              <StatusDot tone={pole?.y_status === "OK" ? "good" : "critical"}>Y axis {pole?.y_status ?? "--"}</StatusDot>
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
                <h2>Stored readings</h2>
                {role === "admin" && history.length > 0 && (
                  <button className="danger" onClick={clearHistory}>Clear history</button>
                )}
              </div>
              {history.length === 0 ? (
                <p className="muted">Nothing stored yet.</p>
              ) : (
                <div className="scroll">
                  <table>
                    <thead>
                      <tr><th>Received</th><th>X (m)</th><th>Y (m)</th><th>Temp (°C)</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {[...history].reverse().slice(0, 25).map((r) => (
                        <tr key={r._key}>
                          <td>{r.ts ? new Date(r.ts).toLocaleString() : "--"}</td>
                          <td>{Number(r.x_m).toFixed(3)}</td>
                          <td>{Number(r.y_m).toFixed(3)}</td>
                          <td>{Number(r.temp_c).toFixed(1)}</td>
                          <td>{r.x_status} / {r.y_status}</td>
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
