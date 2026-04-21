

import { db } from "../services/firebase";
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  serverTimestamp,
} from "firebase/firestore";

// ── Path helper ───────────────────────────────────────────────
const categoriesRef = (shopId) =>
  collection(db, "shops", shopId, "categories");

const categoryDoc = (shopId, categoryId) =>
  doc(db, "shops", shopId, "categories", categoryId);

// ── READ ──────────────────────────────────────────────────────

/**
 * Fetch all categories for a shop, ordered by createdAt ascending.
 * Returns array of { id, name, description, icon, createdAt }
 */
export async function fetchCategoriesByShop(shopId) {
  const snap = await getDocs(query(categoriesRef(shopId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0));
}

/**
 * Fetch a single category document.
 */
export async function fetchCategoryById(shopId, categoryId) {
  const snap = await getDoc(categoryDoc(shopId, categoryId));
  if (!snap.exists()) throw new Error("Category not found.");
  return { id: snap.id, ...snap.data() };
}

// ── CREATE ────────────────────────────────────────────────────

/**
 * Insert a new category under shops/{shopId}/categories.
 * Returns the new category document ID.
 */
export async function insertCategory(shopId, { name, description, icon }) {
  const ref = await addDoc(categoriesRef(shopId), {
    name: name.trim(),
    description: (description || "").trim(),
    icon: icon || "",
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

// ── UPDATE ────────────────────────────────────────────────────

/**
 * Update category fields (name, description, icon).
 */
export async function updateCategory(shopId, categoryId, data) {
  await updateDoc(categoryDoc(shopId, categoryId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

// ── DELETE ────────────────────────────────────────────────────

/**
 * Delete a category document.
 * NOTE: Products under this category keep their categoryId field
 * but will gracefully show as "Uncategorized" in the UI if the
 * category no longer exists.
 */
export async function deleteCategory(shopId, categoryId) {
  await deleteDoc(categoryDoc(shopId, categoryId));
}