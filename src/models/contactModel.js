// src/models/contactModel.js
// Thin Firestore CRUD for public contact-us messages.

import { db } from "../services/firebase";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";

const COL = "contactMessages";

export async function insertContactMessage({ name, email, subject, message }) {
  const ref = await addDoc(collection(db, COL), {
    name,
    email,
    subject,
    message,
    status: "new", // new | read | archived
    createdAt: serverTimestamp(),
  });
  return ref.id;
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
