"use client";
import { useEffect, useState } from "react";
import { onValue, ref } from "firebase/database";
import { rtdb } from "@/lib/firebase";
import { parseReadingTime } from "@/lib/parseReadingTime";
import { latestReading, normalizeReading } from "@/lib/normalizeReading";

export function usePoles(enabled) {
  const [poles, setPoles] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enabled) return;
    return onValue(
      ref(rtdb),
      (snap) => {
        const val = snap.val() ?? {};
        // Status is per pole, taken from that pole's newest reading. Firmware
        // that writes to {pole}/history leaves the top-level fields stale, so
        // reading those directly reported healthy devices as offline.
        const rows = Object.entries(val)
          .map(([id, node]) => [id, latestReading(node)])
          .filter(([, reading]) => reading !== null)
          .map(([id, reading]) => {
            const devTime = parseReadingTime(reading);
            return {
              id,
              ...normalizeReading(reading),
              updatedAt: devTime ?? (typeof reading.updatedAt === "number" ? reading.updatedAt : null),
            };
          });
        setPoles(rows);
      },
      () => setError("You do not have permission to read the data. Ask an admin to check your account.")
    );
  }, [enabled]);

  return { poles, error };
}
