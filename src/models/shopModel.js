// src/models/shopModel.js
// ONLY job: talk to Firestore. No logic. No auth checks.

import { db } from "../services/firebase";
import {
  doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  collection, query, where, orderBy, serverTimestamp,
} from "firebase/firestore";

// ── Shop ──────────────────────────────────────────────────────────────────────

// Get one shop document by UID
export async function fetchShopById(uid) {
  const snap = await getDoc(doc(db, "shops", uid));
  if (!snap.exists()) throw new Error("Shop profile not found");
  return { id: snap.id, ...snap.data() };
}

// ── Projects ──────────────────────────────────────────────────────────────────

// Get all open projects — fallback if composite index missing
export async function fetchOpenProjects() {
  try {
    const q = query(
      collection(db, "projects"),
      where("status", "==", "open"),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn("Composite index missing, falling back:", err.message);
    const q = query(collection(db, "projects"), where("status", "==", "open"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
}

// ── Quotations ────────────────────────────────────────────────────────────────

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
    note:   note || "",
    status: "pending",
    createdAt: serverTimestamp(),
  });
}

// ── Payments ──────────────────────────────────────────────────────────────────

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

// ── Products (NEW) ────────────────────────────────────────────────────────────
// These write to the "products" collection which the mobile app also reads from.
// Both web and app use the SAME Firebase project, so data is shared in real time.

// Get all products for a specific shop
export async function fetchProductsByShop(shopId) {
  try {
    const q = query(
      collection(db, "products"),
      where("shopId", "==", shopId),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    // Fallback without orderBy if index doesn't exist yet
    console.warn("Products index missing, falling back:", err.message);
    const q = query(collection(db, "products"), where("shopId", "==", shopId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
}

// Get ALL available products (for the mobile app to fetch)
export async function fetchAllAvailableProducts() {
  try {
    const q = query(
      collection(db, "products"),
      where("available", "==", true),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    const q = query(collection(db, "products"), where("available", "==", true));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
}

// Add a new product to the "products" collection
export async function insertProduct({
  shopId, shopName, name, description,
  price, unit, category, imageBase64,
}) {
  const ref = await addDoc(collection(db, "products"), {
    shopId,
    shopName,
    name:         name        || "",
    description:  description || "",
    price:        parseFloat(price) || 0,
    unit:         unit        || "piece",
    category:     category    || "general",
    imageBase64:  imageBase64 || "",  // base64 image string or empty
    available:    true,
    createdAt:    serverTimestamp(),
    updatedAt:    serverTimestamp(),
  });
  return ref.id;
}

// Update product availability (toggle on/off)
export async function updateProductAvailability(productId, available) {
  await updateDoc(doc(db, "products", productId), {
    available,
    updatedAt: serverTimestamp(),
  });
}

// Update product details
export async function updateProduct(productId, data) {
  await updateDoc(doc(db, "products", productId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

// Delete a product permanently
export async function removeProduct(productId) {
  await deleteDoc(doc(db, "products", productId));
}