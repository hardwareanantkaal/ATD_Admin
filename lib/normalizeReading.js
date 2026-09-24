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

export function normalizeReading(reading) {
  return {
    ...reading,
    x_mm: toMm(reading, "x_mm", "x_m"),
    y_mm: toMm(reading, "y_mm", "y_m"),
    htl_mm: toMm(reading, "htl_mm", "htl"),
  };
}
