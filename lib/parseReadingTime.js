/**
 * Helper to extract an epoch timestamp (in milliseconds) from device telemetry fields.
 * Handles string timestamps ("2026-09-19 14:32:10"), numeric ms/sec timestamps,
 * and Firestore Timestamp objects.
 */
export function parseReadingTime(fields) {
  if (!fields || typeof fields !== "object") return null;

  // 1. Firestore Timestamp objects with toMillis()
  if (fields.updatedAt && typeof fields.updatedAt.toMillis === "function") {
    return fields.updatedAt.toMillis();
  }
  if (fields.ts && typeof fields.ts.toMillis === "function") {
    return fields.ts.toMillis();
  }

  // 2. Numeric ms timestamp in updatedAt or ts
  if (typeof fields.updatedAt === "number" && !isNaN(fields.updatedAt) && fields.updatedAt > 0) {
    return fields.updatedAt;
  }
  if (typeof fields.ts === "number" && !isNaN(fields.ts) && fields.ts > 0) {
    return fields.ts;
  }

  // 3. String timestamp in fields.time (e.g. "2026-09-19 14:32:10" sent by ESP32)
  if (typeof fields.time === "string" && fields.time !== "NA" && fields.time.trim() !== "") {
    const raw = fields.time.trim();
    // Convert "YYYY-MM-DD HH:MM:SS" -> "YYYY-MM-DDTHH:MM:SS" for ISO compliance
    const isoStr = raw.replace(" ", "T");
    const parsed = Date.parse(isoStr);
    if (!isNaN(parsed)) return parsed;

    const directParsed = Date.parse(raw);
    if (!isNaN(directParsed)) return directParsed;
  }

  // 4. Numeric timestamp in fields.time
  if (typeof fields.time === "number" && !isNaN(fields.time) && fields.time > 0) {
    return fields.time < 1e11 ? fields.time * 1000 : fields.time;
  }

  return null;
}
