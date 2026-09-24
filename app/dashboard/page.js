"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { usePoles } from "@/lib/usePoles";
import { isOnline } from "@/lib/deviceStatus";
import AppShell from "@/components/AppShell";
import StatusDot from "@/components/StatusDot";

// Firmware sends a fixed 5.0 V today (see iot.ino SUPPLY_V) - this filter is
// inert until real battery sensing ships, but the UI is ready for it.
const LOW_BATTERY_V = 3.5;

function ago(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const icons = {
  radio: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="2" />
      <path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.5 5.5a9 9 0 0 0 0 13M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  ),
  wifi: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5a11 11 0 0 1 14 0M8.5 16a6 6 0 0 1 7 0" />
      <circle cx="12" cy="19.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  wifiOff: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 16a6 6 0 0 1 7 0M5 12.5a11 11 0 0 1 3.5-2.5M15.5 10a11 11 0 0 1 3.5 2.5" />
      <line x1="2" y1="2" x2="22" y2="22" />
      <circle cx="12" cy="19.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  alert: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.72 3h16.92a2 2 0 0 0 1.72-3L13.7 3.86a2 2 0 0 0-3.4 0Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  search: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
};

const filters = [
  { id: "all", label: "All" },
  { id: "alerts", label: "Alerts" },
  { id: "offline", label: "Offline" },
  { id: "low-battery", label: "Low Battery" },
];

export default function Dashboard() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { poles, error } = usePoles(!!user);
  const [now, setNow] = useState(() => Date.now());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [showCount, setShowCount] = useState(10);

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, user, router]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const enriched = useMemo(
    () =>
      poles.map((p) => {
        const online = isOnline(p.updatedAt, now);
        const hasFault = p.x_status !== "OK" || p.y_status !== "OK";
        return {
          ...p,
          online,
          alert: !online || hasFault,
          lowBattery: typeof p.voltage_v === "number" && p.voltage_v < LOW_BATTERY_V,
        };
      }),
    [poles, now]
  );

  const filtered = useMemo(() => {
    return enriched
      .filter((p) => !search || p.id.toLowerCase().includes(search.toLowerCase()))
      .filter((p) => {
        if (filter === "alerts") return p.alert;
        if (filter === "offline") return !p.online;
        if (filter === "low-battery") return p.lowBattery;
        return true;
      })
      .slice(0, showCount);
  }, [enriched, search, filter, showCount]);

  if (loading || !user) {
    return (
      <main className="center">
        <div className="spinner" />
        <span>Loading dashboard...</span>
      </main>
    );
  }

  const onlineCount = enriched.filter((p) => p.online).length;
  const alertCount = enriched.filter((p) => p.alert).length;

  return (
    <AppShell>
      {error && <p className="error" role="alert">{error}</p>}

      {poles.length === 0 ? (
        <div className="stat-tile" style={{ padding: "2rem" }}>
          <p className="muted" style={{ margin: 0 }}>
            No devices registered yet. Once a device sends its first reading, it will appear here.
          </p>
        </div>
      ) : (
        <>
          <div className="stat-row">
            <div className="stat-tile stat-tile-total">
              <div className="stat-tile-head">
                <span className="stat-tile-label">Total Devices</span>
                <span className="stat-tile-icon">{icons.radio}</span>
              </div>
              <div className="stat-tile-value">{enriched.length}</div>
            </div>
            <div className="stat-tile stat-tile-online">
              <div className="stat-tile-head">
                <span className="stat-tile-label">Online</span>
                <span className="stat-tile-icon">{icons.wifi}</span>
              </div>
              <div className="stat-tile-value">{onlineCount}</div>
            </div>
            <div className="stat-tile stat-tile-offline">
              <div className="stat-tile-head">
                <span className="stat-tile-label">Offline</span>
                <span className="stat-tile-icon">{icons.wifiOff}</span>
              </div>
              <div className="stat-tile-value">{enriched.length - onlineCount}</div>
            </div>
            <div className="stat-tile stat-tile-alerts">
              <div className="stat-tile-head">
                <span className="stat-tile-label">Alerts</span>
                <span className="stat-tile-icon">{icons.alert}</span>
              </div>
              <div className="stat-tile-value">{alertCount}</div>
            </div>
          </div>

          <div className="filter-bar">
            <div className="search-input">
              {icons.search}
              <input
                type="text"
                placeholder="Search by Pole ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="filter-pills">
              {filters.map((f) => (
                <button
                  key={f.id}
                  className={`filter-pill ${filter === f.id ? "active" : ""}`}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <label className="show-count">
              Show
              <select value={showCount} onChange={(e) => setShowCount(Number(e.target.value))}>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              devices
            </label>
          </div>

          <div className="readings-section">
            <div className="history-head">
              <h2>Devices</h2>
            </div>
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th>Pole ID</th>
                    <th>Status</th>
                    <th>Alert</th>
                    <th>Battery</th>
                    <th>Solar</th>
                    <th>Last seen</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{p.id}</div>
                        {p.mac && <div className="muted" style={{ fontSize: "0.8rem", fontFamily: "monospace" }}>{p.mac}</div>}
                      </td>
                      <td>
                        <StatusDot tone={p.online ? "good" : "warning"} pulse={p.online}>
                          {p.online ? "Online" : "Offline"}
                        </StatusDot>
                      </td>
                      <td>
                        {p.alert ? <StatusDot tone="warning">Alert</StatusDot> : <span className="muted">--</span>}
                      </td>
                      <td>{typeof p.voltage_v === "number" ? `${p.voltage_v.toFixed(1)} V` : "--"}</td>
                      <td>{typeof p.solar_v === "number" ? `${p.solar_v.toFixed(1)} V` : "--"}</td>
                      <td>{p.updatedAt ? ago(now - p.updatedAt) : "--"}</td>
                      <td>
                        <div className="table-actions">
                          <Link href={`/live?pole=${encodeURIComponent(p.id)}`} className="btn-table-action btn-live">
                            Live
                          </Link>
                          <Link href={`/history?pole=${encodeURIComponent(p.id)}`} className="btn-table-action btn-history">
                            History
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
