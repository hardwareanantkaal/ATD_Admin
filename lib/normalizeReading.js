// The firmware moved from metres (x_m / y_m / htl) to raw millimetres
// (x_mm / y_mm / htl_mm). Readings stored before that switch still carry the
// metre fields, so both shapes are normalised to millimetres on read and the
// rest of the app only ever deals with *_mm.
function toMm(reading, mmKey, metreKey) {
  if (typeof reading?.[mmKey] === "number") return reading[mmKey];
  if (typeof reading?.[metreKey] === "number") return reading[metreKey] * 1000;
  return null;
}

export function hasPositionFields(fields) {
  return typeof fields?.x_mm === "number" || typeof fields?.x_m === "number";
}

// Newer firmware appends to {pole}/history/{epochSeconds} and stops touching the
// pole's top-level fields, which then go stale. Older firmware only writes the
// top level. Returns every reading a pole node holds, oldest first.
export function readingsFromNode(node) {
  if (node?.history && typeof node.history === "object") {
    const entries = Object.entries(node.history)
      .filter(([, reading]) => hasPositionFields(reading))
      .sort((a, b) => Number(a[0]) - Number(b[0]));
    if (entries.length > 0) return entries.map(([key, reading]) => ({ ...reading, _historyKey: key }));
  }
  return hasPositionFields(node) ? [node] : [];
}

export function latestReading(node) {
  const readings = readingsFromNode(node);
  return readings.length > 0 ? readings[readings.length - 1] : null;
}

// HTL isn't normalised here: it's fixed per pole and lives on the device
// profile, not in the per-reading telemetry.
export function normalizeReading(reading) {
  return {
    ...reading,
    x_mm: toMm(reading, "x_mm", "x_m"),
    y_mm: toMm(reading, "y_mm", "y_m"),
  };
}
