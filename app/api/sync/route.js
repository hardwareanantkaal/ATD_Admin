import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb, getAdminRtdb } from "@/lib/firebaseAdmin";
import { parseReadingTime } from "@/lib/parseReadingTime";
import { normalizeReading, readingsFromNode } from "@/lib/normalizeReading";

const BATCH_SIZE = 100;

// Server-side twin of lib/syncRtdbToFirestore.js. That one only runs while a
// browser has the portal open; this runs on Vercel, so a scheduled ping keeps
// history flowing with nobody's laptop on.
export async function GET(request) {
  const key = new URL(request.url).searchParams.get("key");
  if (!process.env.SYNC_SECRET || key !== process.env.SYNC_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const snapshot = await getAdminRtdb().ref("/").get();
    const val = snapshot.val() ?? {};
    const results = [];

    for (const [poleId, node] of Object.entries(val)) {
      if (!node || typeof node !== "object") continue;
      results.push(await mirrorPole(poleId, node));
    }

    return Response.json({ ok: true, syncedAt: Date.now(), poles: results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

async function mirrorPole(poleId, node) {
  const adminDb = getAdminDb();
  const deviceRef = adminDb.collection("device").doc(poleId);
  const sensorData = deviceRef.collection("sensor_data");

  const deviceSnap = await deviceRef.get();
  const meta = deviceSnap.exists ? deviceSnap.data() : {};
  let batchNum = meta.currentBatch ?? 1;
  let count = meta.currentBatchCount ?? 0;

  // Only mirror readings newer than what's already stored, so repeated pings
  // are cheap no-ops rather than rewriting the same entries.
  const lastStored = typeof meta.lastReadingTs === "number" ? meta.lastReadingTs : 0;
  const pending = readingsFromNode(node).filter((reading) => {
    const ts = parseReadingTime(reading);
    return typeof ts === "number" && ts > lastStored;
  });

  if (pending.length === 0) return { poleId, added: 0 };

  let newestTs = lastStored;

  for (const fields of pending) {
    const devTime = parseReadingTime(fields);
    const { x_mm, y_mm } = normalizeReading(fields);
    const { temp_c, voltage_v, solar_v, x_status, y_status } = fields;

    // htl_mm is fixed per pole and lives on the device profile, not per reading.
    const readingFields = { x_mm, y_mm, temp_c, voltage_v, x_status, y_status };
    if (typeof solar_v === "number") readingFields.solar_v = solar_v;

    const readingTs = devTime ?? Date.now();
    const reading = { ...readingFields, ts: readingTs, time: fields.time ?? null };

    if (count >= BATCH_SIZE) {
      batchNum += 1;
      count = 0;
    }

    // arrayUnion appends without a read, so concurrent runs can't clobber
    // each other, and an identical reading written twice collapses to one.
    await sensorData.doc(`batch_${batchNum}`).set(
      { batch: batchNum, readings: FieldValue.arrayUnion(reading) },
      { merge: true }
    );

    count += 1;
    newestTs = Math.max(newestTs, readingTs);
  }

  const newest = pending[pending.length - 1];
  const profile = {
    currentBatch: batchNum,
    currentBatchCount: count,
    lastReadingTs: newestTs,
  };
  if (typeof newest.device_id === "string") profile.device_id = newest.device_id;
  if (typeof newest.pole_id === "string") profile.pole_id = newest.pole_id;

  if (typeof meta.createdAt !== "number") {
    const firstSeen = parseReadingTime(pending[0]) ?? Date.now();
    profile.createdAt = firstSeen;
    if (typeof meta.installedAt !== "number") profile.installedAt = firstSeen;
  }

  await deviceRef.set(profile, { merge: true });
  return { poleId, added: pending.length };
}
