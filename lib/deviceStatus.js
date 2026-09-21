// iot.ino uploads every 60s (UPLOAD_PERIOD); 3 min tolerates a couple of
// missed cycles without flapping the indicator.
export const OFFLINE_AFTER_MS = 3 * 60 * 1000;

export function isOnline(updatedAtMs, now) {
  return typeof updatedAtMs === "number" && now - updatedAtMs < OFFLINE_AFTER_MS;
}

// iot.ino's readTemp() returns -999 when the NTC reading is out of range
// (sensor disconnected or shorted) - that's a fault flag, not a temperature.
export function hasTempFault(tempC) {
  return typeof tempC !== "number" || tempC <= -900;
}
