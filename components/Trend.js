export default function Trend({ values, color, label, unit, series }) {
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
