"use client";
import { useEffect, useRef } from "react";
import { onValue, ref as dbRef } from "firebase/database";
import { arrayUnion, collection, doc, getDoc, setDoc } from "firebase/firestore";
import { db, rtdb } from "@/lib/firebase";
import { parseReadingTime } from "@/lib/parseReadingTime";
import { normalizeReading, readingsFromNode } from "@/lib/normalizeReading";

const BATCH_SIZE = 100;

// Mirrors RTDB pole readings into Firestore's batched device/{id}/sensor_data
// structure. Newer firmware keeps a {pole}/history subtree, so readings taken
// while nobody had the portal open get backfilled rather than lost - older
// firmware only exposes the latest snapshot, which is handled the same way.
export function useSyncRtdbToFirestore(enabled) {
  const lastSeenTs = useRef({});
  const inFlight = useRef({});

  useEffect(() => {
    if (!enabled) return;
    return onValue(dbRef(rtdb), (snap) => {
      const val = snap.val() ?? {};

      for (const [poleId, node] of Object.entries(val)) {
        if (!node || typeof node !== "object") continue;
        // One pass per pole at a time: each write needs the batch counter left
        // by the previous one, so overlapping runs would all read it stale.
        if (inFlight.current[poleId]) continue;

        const seen = lastSeenTs.current[poleId];
        const pending = readingsFromNode(node).filter((reading) => {
          const ts = parseReadingTime(reading);
          return typeof ts !== "number" || typeof seen !== "number" || ts > seen;
        });
        if (pending.length === 0) continue;

        inFlight.current[poleId] = true;
        mirrorPole(poleId, pending, lastSeenTs)
          .catch(() => {
            // Ignored if permissions don't allow the Firestore write.
          })
          .finally(() => {
            inFlight.current[poleId] = false;
          });
      }
    });
  }, [enabled]);
}

async function mirrorPole(poleId, pending, lastSeenTs) {
  const deviceRef = doc(db, "device", poleId);
  const sensorData = collection(deviceRef, "sensor_data");

  const deviceSnap = await getDoc(deviceRef);
  const meta = deviceSnap.exists() ? deviceSnap.data() : {};
  let batchNum = meta.currentBatch ?? 1;
  let count = meta.currentBatchCount ?? 0;

  for (const fields of pending) {
    const devTime = parseReadingTime(fields);
    const { x_mm, y_mm } = normalizeReading(fields);
    const { temp_c, voltage_v, solar_v, x_status, y_status } = fields;

    // htl_mm is deliberately not stored per reading - HTL is fixed per pole and
    // lives on the device profile. Firestore rejects undefined, so only include
    // fields the device actually sent.
    const readingFields = { x_mm, y_mm, temp_c, voltage_v, x_status, y_status };
    if (typeof solar_v === "number") readingFields.solar_v = solar_v;

    const readingTs = devTime ?? Date.now();
    const reading = { ...readingFields, ts: readingTs, time: fields.time ?? null };

    if (count >= BATCH_SIZE) {
      batchNum += 1;
      count = 0;
    }

    // arrayUnion rather than a read-modify-write transaction: several tabs
    // mirroring the same device used to contend on the batch document and fail
    // with failed-precondition. It has no read to invalidate, and its deep
    // equality collapses an identical reading written twice into one entry.
    await setDoc(
      doc(sensorData, `batch_${batchNum}`),
      { batch: batchNum, readings: arrayUnion(reading) },
      { merge: true }
    );
    count += 1;

    if (typeof devTime === "number") {
      lastSeenTs.current[poleId] = Math.max(lastSeenTs.current[poleId] ?? 0, devTime);
    }
  }

  // The device doc is a profile, not a telemetry copy: identity, fixed setup
  // values and batch bookkeeping only. Live readings come from RTDB and the
  // history lives in sensor_data.
  const newest = pending[pending.length - 1];
  const profile = { currentBatch: batchNum, currentBatchCount: count };
  if (typeof newest.device_id === "string") profile.device_id = newest.device_id;
  if (typeof newest.pole_id === "string") profile.pole_id = newest.pole_id;

  // Stamped from the device's first reading, not "now" - keyed on the field
  // being missing rather than the doc being new, so devices whose docs predate
  // these fields get backfilled with their true first-seen time. Runs once.
  if (typeof meta.createdAt !== "number") {
    const firstBatch = await getDoc(doc(sensorData, "batch_1"));
    const firstTs = firstBatch.exists() ? firstBatch.data().readings?.[0]?.ts : null;
    const firstSeen =
      typeof firstTs === "number" ? firstTs : (parseReadingTime(pending[0]) ?? Date.now());

    profile.createdAt = firstSeen;
    // Defaults to the same moment; editable on the Live page afterwards.
    if (typeof meta.installedAt !== "number") profile.installedAt = firstSeen;
  }

  await setDoc(deviceRef, profile, { merge: true });
}
