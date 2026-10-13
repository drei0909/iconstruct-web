// src/models/contactModel.js
// Thin Firestore CRUD for public contact-us messages.

import { db } from "../services/firebase";
import {
  collection,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";

const COL = "contactMessages";

const SUBMIT_CONTACT_URL =
  "https://us-central1-iconstruct-58a87.cloudfunctions.net/submitContactMessage";

/** Public submit goes through the submitContactMessage Cloud Function (spam
 *  limits, honeypot). Direct Firestore creates are locked in the rules. */
export async function insertContactMessage({ name, email, subject, message, website }) {
  let res;
  try {
    res = await fetch(SUBMIT_CONTACT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, subject, message, website }),
    });
  } catch {
    throw new Error("Couldn't reach the server. Check your connection and try again.");
  }
  let data = {};
  try {
    data = await res.json();
  } catch {
    /* non-JSON */
  }
  if (!res.ok) throw new Error(data.error || `Couldn't send your message (${res.status}).`);
  return data.id || null;
}

export async function fetchContactMessages() {
  try {
    const q = query(collection(db, COL), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn("Contact messages ordered query failed, falling back:", err?.message || err);
    const snap = await getDocs(collection(db, COL));
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    rows.sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
      const tb = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
      return tb - ta;
    });
    return rows;
  }
}

export async function updateContactMessage(id, patch) {
  await updateDoc(doc(db, COL, id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteContactMessageDoc(id) {
  await deleteDoc(doc(db, COL, id));
}
