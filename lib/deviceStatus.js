// Device reports every 5-10 min; 20 min tolerates one missed cycle without flapping.
export const OFFLINE_AFTER_MS = 20 * 60 * 1000;

export function isOnline(updatedAtMs, now) {
  return typeof updatedAtMs === "number" && now - updatedAtMs < OFFLINE_AFTER_MS;
}
