const pad2 = (n) => String(n).padStart(2, "0");

// Explicit 24h formatting throughout - toLocaleString/toLocaleTimeString switch
// to AM/PM on some locales, which would disagree between charts and tables.
export function time24(ms) {
  const d = new Date(ms);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function dateTime24(ms) {
  const d = new Date(ms);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

export function dayTime24(ms) {
  const d = new Date(ms);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)} ${time24(ms)}`;
}
