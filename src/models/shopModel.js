// src/models/shopModel.js
// ONLY job: talk to Firestore. No logic. No auth checks.

import { db } from "../services/firebase";
import {
  doc, getDoc, getDocs, addDoc,
  collection, query, where, orderBy, serverTimestamp,
} from "firebase/firestore";

// Get one shop document by UID
export async function fetchShopById(uid) {
  const snap = await getDoc(doc(db, "shops", uid));
  if (!snap.exists()) throw new Error("Shop profile not found");
  return { id: snap.id, ...snap.data() };
}

// Get all open projects
export async function fetchOpenProjects() {
  const q = query(
    collection(db, "projects"),
    where("status", "==", "open"),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Get all quotations for a specific shop
export async function fetchQuotationsByShop(shopId) {
  const q = query(
    collection(db, "quotations"),
    where("shopId", "==", shopId),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Save a new quotation
export async function insertQuotation({ projectId, projectTitle, shopId, amount, note }) {
  await addDoc(collection(db, "quotations"), {
    projectId,
    projectTitle,
    shopId,
    amount: parseFloat(amount),
    note: note || "",
    status: "pending",
    createdAt: serverTimestamp(),
  });
}

// Get latest payment request for a shop
export async function fetchLatestPaymentByShop(shopId) {
  const q = query(
    collection(db, "subscriptionPayments"),
    where("shopId", "==", shopId),
    orderBy("submittedAt", "desc")
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

// Check if shop already has a pending payment
export async function fetchPendingPaymentByShop(shopId) {
  const q = query(
    collection(db, "subscriptionPayments"),
    where("shopId", "==", shopId),
    where("status", "==", "pending")
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

// Save a new payment request
export async function insertPaymentRequest(data) {
  await addDoc(collection(db, "subscriptionPayments"), {
    ...data,
    status: "pending",
    submittedAt: serverTimestamp(),
  });
}