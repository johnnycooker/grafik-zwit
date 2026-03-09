// lib/firebase-admin.ts

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(
  /^"|"$/g,
  "",
).replace(/\\n/g, "\n");

if (!projectId) {
  throw new Error("Brak FIREBASE_ADMIN_PROJECT_ID");
}

if (!clientEmail) {
  throw new Error("Brak FIREBASE_ADMIN_CLIENT_EMAIL");
}

if (!privateKey) {
  throw new Error("Brak FIREBASE_ADMIN_PRIVATE_KEY");
}

const app =
  getApps()[0] ??
  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });

export const firestore = getFirestore(app);
