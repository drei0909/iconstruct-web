import { db } from "../services/firebase";
import {
  collection, addDoc, getDocs, getDoc,
  updateDoc, deleteDoc, doc, query, serverTimestamp,
} from "firebase/firestore";

const categoriesRef = (shopId) =>
  collection(db, "shops", shopId, "categories");

const categoryDoc = (shopId, categoryId) =>
  doc(db, "shops", shopId, "categories", categoryId);

export async function fetchCategoriesByShop(shopId) {
  const snap = await getDocs(query(categoriesRef(shopId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0));
}

export async function fetchCategoryById(shopId, categoryId) {
  const snap = await getDoc(categoryDoc(shopId, categoryId));
  if (!snap.exists()) throw new Error("Category not found.");
  return { id: snap.id, ...snap.data() };
}

export async function insertCategory(shopId, { name, description, icon, projectId }) {
  const ref = await addDoc(categoriesRef(shopId), {
    name:        name.trim(),
    description: (description || "").trim(),
    icon:        icon || "",
    projectId:   projectId || "",
    createdAt:   serverTimestamp(),
  });
  return ref.id;
}

export async function updateCategory(shopId, categoryId, data) {
  await updateDoc(categoryDoc(shopId, categoryId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCategory(shopId, categoryId) {
  await deleteDoc(categoryDoc(shopId, categoryId));
}