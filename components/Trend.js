"use client";
import { useEffect, useRef, useState } from "react";
import { dateTime24, dayTime24, time24 } from "@/lib/formatTime";

function axisLabel(ms, spansDays) {
  return spansDays ? dayTime24(ms) : time24(ms);
}

// Past this many points the dots overlap into a solid band and just add
// thousands of DOM nodes, so the line alone reads better.
const DOT_LIMIT = 150;

export default function Trend({ values, color, label, unit, series, timestamps }) {
  const [hoverIndex, setHoverIndex] = useState(null);
  const plotRef = useRef(null);
  // The viewBox is sized to the rendered width so one SVG unit == one CSS pixel.
  // Without this the SVG stretches horizontally and every dot renders as an ellipse.
  const [plotWidth, setPlotWidth] = useState(600);

  useEffect(() => {
    const el = plotRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      setPlotWidth(Math.max(1, Math.round(entry.contentRect.width)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const allSeries = series ?? [{ values, color, label }];
  if (!allSeries.some((s) => s.values.length >= 2)) {
    return (
      <p className="trend-empty">
        A trend appears once at least two readings are stored.
      </p>
    );
  }

  const w = plotWidth, h = 120, pad = 6;
  const allValues = allSeries.flatMap((s) => s.values);
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const span = max - min || 1;
  const pointCount = Math.max(...allSeries.map((s) => s.values.length));

  const xAt = (i, count) => pad + (count > 1 ? (i / (count - 1)) * (w - pad * 2) : 0);
  const yAt = (v) => h - pad - ((v - min) / span) * (h - pad * 2);

  function pathFor(vals) {
    if (vals.length < 2) return "";
    return vals.map((v, i) => `${i ? "L" : "M"}${xAt(i, vals.length).toFixed(1)},${yAt(v).toFixed(1)}`).join(" ");
  }

  function handleMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const ratio = (e.clientX - rect.left) / rect.width;
    setHoverIndex(Math.max(0, Math.min(pointCount - 1, Math.round(ratio * (pointCount - 1)))));
  }

  const hoverTime = hoverIndex !== null && timestamps ? timestamps[hoverIndex] : null;
  const hoverPct = hoverIndex !== null && pointCount > 1 ? (hoverIndex / (pointCount - 1)) * 100 : 0;

  return (
    <div className="trend">
      <div
        className="trend-plot"
        ref={plotRef}
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={`${allSeries.map((s) => s.label).join(", ")} over time`}>
          {allSeries.map((s) => (
            <path key={s.label} d={pathFor(s.values)} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          ))}

          {pointCount <= DOT_LIMIT &&
            allSeries.map((s) =>
              s.values.map((v, i) =>
                typeof v === "number" && !Number.isNaN(v) ? (
                  <circle
                    key={`${s.label}-${i}`}
                    cx={xAt(i, s.values.length)}
                    cy={yAt(v)}
                    r="2.5"
                    fill={s.color}
                    stroke="#fff"
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                  />
                ) : null
              )
            )}

          {hoverIndex !== null && (
            <>
              <line
                x1={xAt(hoverIndex, pointCount)}
                x2={xAt(hoverIndex, pointCount)}
                y1={0}
                y2={h}
                stroke="currentColor"
                strokeWidth="1"
                strokeDasharray="3 3"
                opacity="0.35"
                vectorEffect="non-scaling-stroke"
              />
              {allSeries.map((s) => {
                const v = s.values[hoverIndex];
                if (typeof v !== "number" || Number.isNaN(v)) return null;
                return <circle key={s.label} cx={xAt(hoverIndex, s.values.length)} cy={yAt(v)} r="3" fill={s.color} stroke="#fff" strokeWidth="1.5" />;
              })}
            </>
          )}
        </svg>

        {hoverIndex !== null && (
          <div
            className="trend-tooltip"
            style={{ left: `${hoverPct}%`, transform: `translateX(${hoverPct > 70 ? "-90%" : hoverPct < 30 ? "-10%" : "-50%"})` }}
          >
            {hoverTime && <div className="trend-tooltip-time">{dateTime24(hoverTime)}</div>}
            {allSeries.map((s) => {
              const v = s.values[hoverIndex];
              if (typeof v !== "number" || Number.isNaN(v)) return null;
              return (
                <div key={s.label} className="trend-tooltip-row">
                  <span className="trend-legend-swatch" style={{ background: s.color }} />
                  <span>{s.label}</span>
                  <strong>{v.toFixed(Math.abs(v) >= 100 ? 0 : 2)}</strong>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {timestamps && timestamps.length >= 2 && (
        <div className="trend-axis">
          {(() => {
            const first = timestamps[0];
            const last = timestamps[timestamps.length - 1];
            const mid = timestamps[Math.floor((timestamps.length - 1) / 2)];
            const spansDays = new Date(first).toDateString() !== new Date(last).toDateString();
            return [first, mid, last].map((t, i) => <span key={i}>{axisLabel(t, spansDays)}</span>);
          })()}
        </div>
      )}

      {series ? (
        <div className="trend-legend">
          {allSeries.map((s) => (
            <span key={s.label} className="trend-legend-item">
              <span className="trend-legend-swatch" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      ) : (
        <div className="trend-range">
          <span>Low {min.toFixed(1)}{unit}</span>
          <span>High {max.toFixed(1)}{unit}</span>
        </div>
      )}
    </div>
  );
}
