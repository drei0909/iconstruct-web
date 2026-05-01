// src/models/shopModel.js
// ONLY job: talk to Firestore. No logic. No auth checks.

import { db } from "../services/firebase";
import {
  doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  collection, collectionGroup, query, where, orderBy,
  serverTimestamp,
} from "firebase/firestore";

// ── Shop ──────────────────────────────────────────────────────────────────────

export async function fetchShopById(uid) {
  const snap = await getDoc(doc(db, "shops", uid));
  if (!snap.exists()) throw new Error("Shop profile not found");
  return { id: snap.id, ...snap.data() };
}

// ── Projects ──────────────────────────────────────────────────────────────────

export async function fetchOpenProjects() {
  try {
    const q = query(
      collection(db, "projectPosts"),
      where("status", "==", "open"),
      orderBy("postedAt", "desc")
    );
    const snap = await getDocs(q);
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    console.log("First project fields:", JSON.stringify(docs[0], null, 2)); // ← ADD THIS
    return docs;
  } catch (err) {
    console.warn("Composite index missing, falling back:", err.message);
    const q = query(
      collection(db, "projectPosts"),
      where("status", "==", "open")
    );
    const snap = await getDocs(q);
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
   /*  console.log("Fallback first project:", JSON.stringify(docs[0], null, 2)); */ // ← ADD THIS TOO
    return docs;
  }
}

// ── Quotations ────────────────────────────────────────────────────────────────

export async function fetchQuotationsByShop(shopId) {
  const q = query(
    collectionGroup(db, "quotations"),
    where("shopId", "==", shopId),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function insertQuotation({ projectId, projectTitle, shopId, shopName, amount, note }) {
  const quotationRef = collection(db, "projectPosts", projectId, "quotations");
  await addDoc(quotationRef, {
    projectId,
    projectTitle,
    shopId,
    shopName,
    amount: parseFloat(amount),
    note:   note || "",
    status: "pending",
    createdAt: serverTimestamp(),
     updatedAt: serverTimestamp(), 
  });

  const postRef  = doc(db, "projectPosts", projectId);
  const postSnap = await getDoc(postRef);
  const currentCount = postSnap.data()?.quotationCount || 0;
  await updateDoc(postRef, {
    quotationCount: currentCount + 1,
    updatedAt: serverTimestamp(),
  });
}

// ── Payments ──────────────────────────────────────────────────────────────────

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

export async function fetchPendingPaymentByShop(shopId) {
  const q = query(
    collection(db, "subscriptionPayments"),
    where("shopId", "==", shopId),
    where("status", "==", "pending")
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

export async function insertPaymentRequest(data) {
  await addDoc(collection(db, "subscriptionPayments"), {
    ...data,
    status: "pending",
    submittedAt: serverTimestamp(),
     updatedAt: serverTimestamp(), 
     createdAt:   serverTimestamp(),
  });
}

// ── Products ──────────────────────────────────────────────────────────────────

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
    console.warn("Products index missing, falling back:", err.message);
    const q = query(collection(db, "products"), where("shopId", "==", shopId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
}

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

export async function insertProduct({
  shopId, shopName, name, description,
  price, unit, category, imageBase64, sizes,
}) {
  const ref = await addDoc(collection(db, "products"), {
    shopId,
    shopName,
    name:        name        || "",
    description: description || "",
    price:       parseFloat(price) || 0,
    unit:        unit        || "piece",
    category:    category    || "general",
    imageBase64: imageBase64 || "",
    sizes:       sizes       || [],
    available:   true,
    createdAt:   serverTimestamp(),
    updatedAt:   serverTimestamp(),
  });
  return ref.id;
}

export async function updateProductAvailability(productId, available) {
  await updateDoc(doc(db, "products", productId), {
    available,
    updatedAt: serverTimestamp(),
  });
}

export async function updateProduct(productId, data) {
  await updateDoc(doc(db, "products", productId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function removeProduct(productId) {
  await deleteDoc(doc(db, "products", productId));
}