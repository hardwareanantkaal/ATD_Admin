import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebaseAdmin";

const BATCH_SIZE = 100;

function validate(body) {
  if (!body || typeof body !== "object") return "Body must be a JSON object.";
  if (typeof body.pole_id !== "string" || !body.pole_id) return "pole_id must be a non-empty string.";
  for (const key of ["x_m", "y_m", "temp_c", "voltage_v"]) {
    if (typeof body[key] !== "number" || !Number.isFinite(body[key])) return `${key} must be a number.`;
  }
  for (const key of ["x_status", "y_status"]) {
    if (typeof body[key] !== "string" || !body[key]) return `${key} must be a non-empty string.`;
  }
  return null;
}

export async function POST(request) {
  if (request.headers.get("x-api-key") !== process.env.DEVICE_API_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const error = validate(body);
  if (error) return Response.json({ error }, { status: 400 });

  const { pole_id, x_m, y_m, temp_c, voltage_v, x_status, y_status } = body;
  const fields = { x_m, y_m, temp_c, voltage_v, x_status, y_status };
  // FieldValue.serverTimestamp() can't be used inside an array element, so the
  // API route's own clock stands in for it (this runs server-side, not on the device).
  const reading = { ...fields, ts: Date.now() };

  const adminDb = getAdminDb();
  const deviceRef = adminDb.collection("device").doc(pole_id);

  await adminDb.runTransaction(async (tx) => {
    const deviceSnap = await tx.get(deviceRef);
    const meta = deviceSnap.exists ? deviceSnap.data() : {};
    let batchNum = meta.currentBatch ?? 1;

    const batchRef = deviceRef.collection("sensor_data").doc(`batch_${batchNum}`);
    const batchSnap = await tx.get(batchRef);
    const existingReadings = batchSnap.exists ? (batchSnap.data().readings ?? []) : [];

    let readings;
    if (existingReadings.length >= BATCH_SIZE) {
      batchNum += 1;
      readings = [reading];
    } else {
      readings = [...existingReadings, reading];
    }

    tx.set(deviceRef.collection("sensor_data").doc(`batch_${batchNum}`), { batch: batchNum, readings });
    tx.set(deviceRef, { ...fields, updatedAt: FieldValue.serverTimestamp(), currentBatch: batchNum, currentBatchCount: readings.length }, { merge: true });
  });

  return Response.json({ ok: true });
}
