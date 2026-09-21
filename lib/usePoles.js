"use client";
import { useEffect, useState } from "react";
import { onValue, ref } from "firebase/database";
import { rtdb } from "@/lib/firebase";
import { parseReadingTime } from "@/lib/parseReadingTime";

export function usePoles(enabled) {
  const [poles, setPoles] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enabled) return;
    return onValue(
      ref(rtdb),
      (snap) => {
        const val = snap.val() ?? {};
        // Only pick up pole-shaped entries
        const rows = Object.entries(val)
          .filter(([, fields]) => fields && typeof fields === "object" && "x_m" in fields)
          .map(([id, fields]) => {
            const devTime = parseReadingTime(fields);
            return {
              id,
              ...fields,
              updatedAt: devTime ?? (typeof fields.updatedAt === "number" ? fields.updatedAt : null),
            };
          });
        setPoles(rows);
      },
      () => setError("You do not have permission to read the data. Ask an admin to check your account.")
    );
  }, [enabled]);

  return { poles, error };
}
