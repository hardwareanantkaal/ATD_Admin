"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthContext";
import { usePoles } from "@/lib/usePoles";
import { hasTempFault, isOnline } from "@/lib/deviceStatus";
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

function toCoords(latRaw, lngRaw) {
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

// Accepts "19.0760, 72.8777" or a Google Maps URL (…/@lat,lng,17z, ?q=lat,lng, ?ll=lat,lng).
// Shortened maps.app.goo.gl links can't be resolved in the browser, so they won't match.
function parseCoordinates(input) {
  const text = input.trim();

  const direct = text.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (direct) return toCoords(direct[1], direct[2]);

  const fromUrl = text.match(/[@=](-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (fromUrl) return toCoords(fromUrl[1], fromUrl[2]);

  return null;
}

const icons = {
  radio: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="2" />
      <path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7" />
    </svg>
  ),
  temp: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0Z" />
    </svg>
  ),
  bolt: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  pin: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  wifiOff: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 16a6 6 0 0 1 7 0M5 12.5a11 11 0 0 1 3.5-2.5M15.5 10a11 11 0 0 1 3.5 2.5" />
      <line x1="2" y1="2" x2="22" y2="22" />
      <circle cx="12" cy="19.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  back: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  ),
};

export default function LiveContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const { poles, error } = usePoles(!!user);
  const [now, setNow] = useState(() => Date.now());
  const [deviceDoc, setDeviceDoc] = useState(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, user, router]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const requestedId = searchParams.get("pole");
  const effectiveId = poles.some((p) => p.id === requestedId) ? requestedId : (poles[0]?.id ?? null);

  useEffect(() => {
    if (!effectiveId) return;
    return onSnapshot(doc(db, "device", effectiveId), (snap) => setDeviceDoc(snap.exists() ? snap.data() : null));
  }, [effectiveId]);

  async function setLocation() {
    const input = prompt("Paste a Google Maps link, or enter coordinates as \"lat, lng\":");
    if (input === null) return;

    const coords = parseCoordinates(input);
    if (!coords) {
      alert("Could not read coordinates. Paste a Google Maps link, or enter them as \"19.0760, 72.8777\".");
      return;
    }
    try {
      await setDoc(doc(db, "device", effectiveId), { gps: coords }, { merge: true });
    } catch {
      alert("Could not save the location. Check your permissions.");
    }
  }

  if (loading || !user) {
    return (
      <main className="center">
        <div className="spinner" />
        <span>Loading live telemetry...</span>
      </main>
    );
  }

  const pole = poles.find((p) => p.id === effectiveId) ?? null;

  if (!pole) {
    return (
      <AppShell>
        {error && <p className="error" role="alert">{error}</p>}
        <p className="muted">No devices registered yet. Once a device sends its first reading, it will appear here.</p>
      </AppShell>
    );
  }

  const online = isOnline(pole.updatedAt, now);
  const gps = deviceDoc?.gps;

  return (
    <AppShell>
      {error && <p className="error" role="alert">{error}</p>}

      <div className="detail-toolbar">
        <div className="detail-toolbar-title">
          <Link href="/dashboard" className="btn-icon" aria-label="Back to dashboard">
            {icons.back}
          </Link>
          <div>
            <h1>{pole.id}</h1>
            {pole.mac && <p className="detail-mac">{pole.mac}</p>}
          </div>
        </div>
        <div className="detail-toolbar-actions">
          <Link href={`/history?pole=${encodeURIComponent(pole.id)}`} className="btn-secondary">
            View History
          </Link>
          <button className="btn-secondary" onClick={() => location.reload()}>
            Refresh
          </button>
        </div>
      </div>

      {!online && (
        <div className="offline-banner">
          {icons.wifiOff}
          <div>
            <strong>Device Offline</strong>
            <p>
              {pole.updatedAt ? `Last seen: ${new Date(pole.updatedAt).toLocaleString()} · ${ago(now - pole.updatedAt)}` : "No readings received yet."}
            </p>
          </div>
        </div>
      )}

      <div className="pole-metrics live-metrics">
        <div className="pole-metric">
          <div className="pole-metric-head">
            <span className="pole-metric-label">X Position</span>
            <span className="pole-metric-icon">{icons.radio}</span>
          </div>
          <span className="pole-metric-value" style={{ color: "var(--metric-x)" }}>
            {Number(pole.x_m).toFixed(3)} m
          </span>
          <StatusDot tone={pole.x_status === "OK" ? "good" : "critical"}>{pole.x_status}</StatusDot>
        </div>
        <div className="pole-metric">
          <div className="pole-metric-head">
            <span className="pole-metric-label">Y Position</span>
            <span className="pole-metric-icon">{icons.radio}</span>
          </div>
          <span className="pole-metric-value" style={{ color: "var(--metric-y)" }}>
            {Number(pole.y_m).toFixed(3)} m
          </span>
          <StatusDot tone={pole.y_status === "OK" ? "good" : "critical"}>{pole.y_status}</StatusDot>
        </div>
        <div className="pole-metric">
          <div className="pole-metric-head">
            <span className="pole-metric-label">Temperature</span>
            <span className="pole-metric-icon">{icons.temp}</span>
          </div>
          {hasTempFault(pole.temp_c) ? (
            <>
              <span className="pole-metric-value">—</span>
              <StatusDot tone="critical">Sensor fault</StatusDot>
            </>
          ) : (
            <span className="pole-metric-value" style={{ color: "var(--metric-temp)" }}>
              {Number(pole.temp_c).toFixed(1)} °C
            </span>
          )}
        </div>
        <div className="pole-metric">
          <div className="pole-metric-head">
            <span className="pole-metric-label">Voltage</span>
            <span className="pole-metric-icon">{icons.bolt}</span>
          </div>
          <span className="pole-metric-value">
            {typeof pole.voltage_v === "number" ? `${pole.voltage_v.toFixed(1)} V` : "—"}
          </span>
        </div>
      </div>

      <div className="gps-card">
        <div className="gps-card-head">
          <span className="gps-card-title">
            {icons.pin}
            GPS Location
          </span>
          <button className="btn-secondary" onClick={setLocation}>
            Set Location
          </button>
        </div>
        {gps ? (
          <div className="gps-coords">
            <span>{gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}</span>
            <a
              href={`https://www.google.com/maps?q=${gps.lat},${gps.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-table-action live"
            >
              Open in Google Maps
            </a>
          </div>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            No GPS data available — click &quot;Set Location&quot; to add coordinates manually
          </p>
        )}
      </div>
    </AppShell>
  );
}
