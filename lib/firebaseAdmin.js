import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getDatabase } from "firebase-admin/database";

function loadCredential() {
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!encoded) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is not set");
  }
  return JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
}

// Initialised lazily: at build time the env vars aren't present, and a
// module-level init would break Next's route collection.
function adminApp() {
  if (getApps().length) return getApps()[0];
  return initializeApp({
    credential: cert(loadCredential()),
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  });
}

export function getAdminDb() {
  return getFirestore(adminApp());
}

export function getAdminRtdb() {
  return getDatabase(adminApp());
}
