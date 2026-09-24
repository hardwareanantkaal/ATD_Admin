// iot.ino uploads every 60s (UPLOAD_PERIOD), but GSM uploads fail often enough
// that a tight window flaps the indicator - 20 min rides out a run of failures.
export const OFFLINE_AFTER_MS = 20 * 60 * 1000;

export function isOnline(updatedAtMs, now) {
  return typeof updatedAtMs === "number" && now - updatedAtMs < OFFLINE_AFTER_MS;
}

// iot.ino's readTemp() returns -999 when the NTC reading is out of range
// (sensor disconnected or shorted) - that's a fault flag, not a temperature.
export function hasTempFault(tempC) {
  return typeof tempC !== "number" || tempC <= -900;
}
