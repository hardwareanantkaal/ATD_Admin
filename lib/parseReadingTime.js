// Timezone the firmware formats its `time` string in - iot.ino sets
// TZ_POSIX "IST-5:30" and writes local time with no offset in the string.
const DEVICE_UTC_OFFSET = "+05:30";

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
    // The device formats local IST time (iot.ino: TZ_POSIX "IST-5:30") with no
    // offset in the string. Date.parse() would read a bare date-time as the
    // *runtime's* local zone, so the browser (IST) and Vercel (UTC) produced
    // epochs 5h30m apart for the same reading - storing it twice. Pinning the
    // offset here makes the value identical wherever it's parsed.
    const isoStr = `${raw.replace(" ", "T")}${DEVICE_UTC_OFFSET}`;
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
