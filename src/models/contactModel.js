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
  const q = query(collection(db, COL), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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
