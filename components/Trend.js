export default function Trend({ values, color, label, unit }) {
  if (values.length < 2) {
    return (
      <p className="trend-empty">
        A trend appears once at least two readings are stored.
      </p>
    );
  }
  const w = 600, h = 120, pad = 6;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const d = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (w - pad * 2);
      const y = h - pad - ((v - min) / span) * (h - pad * 2);
      return `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="trend">
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${label} over the last ${values.length} readings`}>
        <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="trend-range">
        <span>Low {min.toFixed(1)}{unit}</span>
        <span>High {max.toFixed(1)}{unit}</span>
      </div>
    </div>
  );
}
