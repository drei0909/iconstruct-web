// src/models/materialsModel.js
// Firestore CRUD for hardware shop materials catalog: shops/{shopId}/materials

import { db } from "../services/firebase";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

function materialsRef(shopId) {
  return collection(db, "shops", shopId, "materials");
}

function materialDocRef(shopId, materialId) {
  return doc(db, "shops", shopId, "materials", materialId);
}

/**
 * Fetch all materials for a shop.
 */
export async function fetchShopMaterials(shopId) {
  if (!shopId) return [];
  const q = query(materialsRef(shopId), orderBy("name", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Real-time listener for a shop's materials.
 */
export function subscribeShopMaterials(shopId, onData, onError) {
  if (!shopId) {
    onData([]);
    return () => {};
  }
  const q = query(materialsRef(shopId), orderBy("name", "asc"));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      onData(items);
    },
    onError
  );
}

/**
 * Insert a single material item.
 */
export async function insertShopMaterial(shopId, data) {
  if (!shopId) throw new Error("Shop ID is required");
  const payload = {
    ...data,
    price: Number(data.price) || 0,
    stock: data.stock !== "" && data.stock !== undefined ? Number(data.stock) : null,
    isActive: data.isActive !== false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const docRef = await addDoc(materialsRef(shopId), payload);
  return { id: docRef.id, ...payload };
}

/**
 * Update an existing material item.
 */
export async function updateShopMaterial(shopId, materialId, data) {
  if (!shopId || !materialId) throw new Error("Shop ID and Material ID are required");
  const payload = {
    ...data,
    updatedAt: serverTimestamp(),
  };
  if (data.price !== undefined) payload.price = Number(data.price) || 0;
  if (data.stock !== undefined) {
    payload.stock = data.stock !== "" && data.stock !== null ? Number(data.stock) : null;
  }
  await updateDoc(materialDocRef(shopId, materialId), payload);
  return { id: materialId, ...payload };
}

/**
 * Delete a single material item.
 */
export async function deleteShopMaterial(shopId, materialId) {
  if (!shopId || !materialId) throw new Error("Shop ID and Material ID are required");
  await deleteDoc(materialDocRef(shopId, materialId));
  return { id: materialId };
}

/**
 * Batch insert multiple materials (e.g. from CSV/Excel import).
 * Handles Firestore 500-op limit per batch.
 */
export async function batchInsertShopMaterials(shopId, items = []) {
  if (!shopId) throw new Error("Shop ID is required");
  if (!items.length) return 0;

  const BATCH_SIZE = 450;
  let totalSaved = 0;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);

    chunk.forEach((item) => {
      const newRef = doc(materialsRef(shopId));
      batch.set(newRef, {
        name: String(item.name || "").trim(),
        category: String(item.category || "other").trim(),
        unit: String(item.unit || "piece").trim(),
        size: String(item.size || "").trim(),
        price: Number(item.price) || 0,
        stock: item.stock !== "" && item.stock !== undefined && item.stock !== null ? Number(item.stock) : null,
        brand: String(item.brand || "").trim(),
        sku: String(item.sku || "").trim(),
        description: String(item.description || "").trim(),
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    await batch.commit();
    totalSaved += chunk.length;
  }

  return totalSaved;
}

/**
 * Batch delete all materials for a shop (useful for full catalog replacement).
 */
export async function clearAllShopMaterials(shopId) {
  if (!shopId) throw new Error("Shop ID is required");
  const snap = await getDocs(materialsRef(shopId));
  if (snap.empty) return 0;

  const BATCH_SIZE = 450;
  let totalDeleted = 0;

  for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
    const chunk = snap.docs.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });
    await batch.commit();
    totalDeleted += chunk.length;
  }

  return totalDeleted;
}

/**
 * Deduct stock quantity for a single material item.
 * If stock is null/undefined (untracked), leaves as is.
 * Decrements accurately down to minimum 0.
 */
export async function deductShopMaterialStock(shopId, materialId, qtyToDeduct) {
  if (!shopId || !materialId || !qtyToDeduct || qtyToDeduct <= 0) return null;
  const ref = materialDocRef(shopId, materialId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  const current = snap.data();
  if (current.stock === null || current.stock === undefined) return null;

  const currentStock = Number(current.stock) || 0;
  const newStock = Math.max(0, currentStock - Number(qtyToDeduct));

  await updateDoc(ref, {
    stock: newStock,
    updatedAt: serverTimestamp(),
  });

  return newStock;
}

/**
 * Deduct stock for multiple materials at once (e.g. when submitting a quotation).
 * deductions: [{ materialId, qty }]
 */
export async function deductMultipleShopMaterials(shopId, deductions = []) {
  if (!shopId || !deductions.length) return [];
  const results = [];

  for (const item of deductions) {
    if (!item?.materialId || !item?.qty) continue;
    try {
      const newStock = await deductShopMaterialStock(shopId, item.materialId, item.qty);
      results.push({ materialId: item.materialId, newStock });
    } catch (err) {
      console.warn(`Failed to deduct stock for material ${item.materialId}:`, err);
    }
  }

  return results;
}
