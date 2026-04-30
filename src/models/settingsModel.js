// src/models/settingsModel.js

import { db } from "../services/firebase";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";

// ── Admin Accounts ──────────────────────────────────────────────────────────

export async function fetchAllAdmins() {
  const snap = await getDocs(collection(db, "admins"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchAdminById(uid) {
  const snap = await getDoc(doc(db, "admins", uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createAdminRecord(uid, data) {
  // Writes the admin doc keyed by Firebase Auth UID
  await updateDoc(doc(db, "admins", uid), {
    ...data,
    createdAt: serverTimestamp(),
  }).catch(async () => {
    // Doc doesn't exist yet — use setDoc
    const { setDoc } = await import("firebase/firestore");
    await setDoc(doc(db, "admins", uid), {
      ...data,
      createdAt: serverTimestamp(),
    });
  });
}

export async function updateAdminRecord(uid, data) {
  await updateDoc(doc(db, "admins", uid), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteAdminRecord(uid) {
  await deleteDoc(doc(db, "admins", uid));
}