// lib/firebase-admin.ts

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(
  /\\n/g,
  "\n",
);

if (!projectId) {
  throw new Error("Brak FIREBASE_ADMIN_PROJECT_ID w .env.local");
}

if (!clientEmail) {
  throw new Error("Brak FIREBASE_ADMIN_CLIENT_EMAIL w .env.local");
}

if (!privateKey) {
  throw new Error("Brak FIREBASE_ADMIN_PRIVATE_KEY w .env.local");
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
