"use client";
import { useEffect, useRef } from "react";
import { onValue, ref as dbRef } from "firebase/database";
import { collection, doc, runTransaction } from "firebase/firestore";
import { db, rtdb } from "@/lib/firebase";
import { parseReadingTime } from "@/lib/parseReadingTime";

const BATCH_SIZE = 100;

// Mirrors each new RTDB pole reading into Firestore's batched device/{id}/sensor_data
// structure, client-side, while preserving exact device timestamps and preventing
// duplicate entries or fake "Online" status resets.
export function useSyncRtdbToFirestore(enabled) {
  const lastSignature = useRef({});

  useEffect(() => {
    if (!enabled) return;
    return onValue(dbRef(rtdb), (snap) => {
      const val = snap.val() ?? {};
      for (const [poleId, fields] of Object.entries(val)) {
        if (!fields || typeof fields !== "object" || !("x_m" in fields)) continue;

        const devTime = parseReadingTime(fields);
        const { x_m, y_m, htl, temp_c, voltage_v, solar_v, x_status, y_status } = fields;
        const signature = JSON.stringify([x_m, y_m, htl, temp_c, voltage_v, solar_v, x_status, y_status, devTime, fields.time]);

        if (lastSignature.current[poleId] === signature) continue;
        lastSignature.current[poleId] = signature;

        // Firestore rejects undefined, so only include the newer fields once the
        // device actually sends them.
        const readingFields = { x_m, y_m, temp_c, voltage_v, x_status, y_status };
        if (typeof htl === "number") readingFields.htl = htl;
        if (typeof solar_v === "number") readingFields.solar_v = solar_v;
        const readingTs = devTime ?? Date.now();
        const reading = { ...readingFields, ts: readingTs, time: fields.time ?? null };
        const deviceRef = doc(db, "device", poleId);
        const sensorData = collection(deviceRef, "sensor_data");

        runTransaction(db, async (tx) => {
          const deviceSnap = await tx.get(deviceRef);
          const meta = deviceSnap.exists() ? deviceSnap.data() : {};

          let batchNum = meta.currentBatch ?? 1;
          const batchSnap = await tx.get(doc(sensorData, `batch_${batchNum}`));
          const existing = batchSnap.exists() ? (batchSnap.data().readings ?? []) : [];

          // Deduplication check: do not write duplicate readings
          const isDuplicate = existing.some((r) => {
            if (devTime && r.ts === devTime) return true;
            if (fields.time && r.time === fields.time) return true;
            return false;
          });

          if (isDuplicate) return;

          let readings;
          if (existing.length >= BATCH_SIZE) {
            batchNum += 1;
            readings = [reading];
          } else {
            readings = [...existing, reading];
          }

          tx.set(doc(sensorData, `batch_${batchNum}`), { batch: batchNum, readings });
          tx.set(
            deviceRef,
            {
              ...readingFields,
              updatedAt: readingTs,
              currentBatch: batchNum,
              currentBatchCount: readings.length,
            },
            { merge: true }
          );
        }).catch(() => {
          // Ignored if permissions don't allow Firestore write
        });
      }
    });
  }, [enabled]);
}
