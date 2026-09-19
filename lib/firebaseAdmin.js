import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function loadCredential() {
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!encoded) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is not set");
  }
  return JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
}

export function getAdminDb() {
  const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(loadCredential()) });
  return getFirestore(app);
}
