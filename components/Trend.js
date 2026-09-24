// Short axis label: time of day, plus the date when the window spans days.
function axisLabel(ms, spansDays) {
  const d = new Date(ms);
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return spansDays ? `${d.toLocaleDateString([], { day: "2-digit", month: "short" })} ${time}` : time;
}

export default function Trend({ values, color, label, unit, series, timestamps }) {
  const allSeries = series ?? [{ values, color, label }];
  if (!allSeries.some((s) => s.values.length >= 2)) {
    return (
      <p className="trend-empty">
        A trend appears once at least two readings are stored.
      </p>
    );
  }

  const w = 600, h = 120, pad = 6;
  const allValues = allSeries.flatMap((s) => s.values);
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const span = max - min || 1;

  function pathFor(vals) {
    if (vals.length < 2) return "";
    return vals
      .map((v, i) => {
        const x = pad + (i / (vals.length - 1)) * (w - pad * 2);
        const y = h - pad - ((v - min) / span) * (h - pad * 2);
        return `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }

  return (
    <div className="trend">
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${allSeries.map((s) => s.label).join(", ")} over the last readings`}>
        {allSeries.map((s) => (
          <path key={s.label} d={pathFor(s.values)} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        ))}
      </svg>

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
