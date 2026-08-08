// src/controllers/shopCategoryController.js
// ─────────────────────────────────────────────────────────────
// Business logic for shop categories.
// Called by ProductsTab (and any future component that needs
// category management). Never touches Firestore directly —
// delegates to shopCategoryModel.js.
// ─────────────────────────────────────────────────────────────

import { auth } from "../services/firebase";
import {
  fetchCategoriesByShop,
  fetchCategoryById,
  insertCategory,
  updateCategory,
  deleteCategory,
} from "../models/shopCategoryModel";
import { fetchShopById } from "../models/shopModel";
import { isShopApproved } from "../utils/shopAccess";

// ── Helpers ───────────────────────────────────────────────────

function getUid() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated.");
  return user.uid;
}

async function requireApprovedUid() {
  const uid = getUid();
  const shop = await fetchShopById(uid);
  if (!isShopApproved(shop.status)) {
    throw new Error("Only approved shops can manage categories.");
  }
  return uid;
}

// ── READ ──────────────────────────────────────────────────────

/**
 * Get all categories for the logged-in shop.
 * @returns {Promise<Array>} [{ id, name, description, icon, createdAt }, ...]
 */
export async function getMyCategories() {
  const uid = getUid();
  return fetchCategoriesByShop(uid);
}

/**
 * Get a single category by its ID.
 */
export async function getCategory(categoryId) {
  const uid = getUid();
  return fetchCategoryById(uid, categoryId);
}

// ── CREATE ────────────────────────────────────────────────────

/**
 * Add a new category to the logged-in shop.
 * Validates name before writing.
 * @returns {Promise<string>} New category document ID
 */
export async function addCategory({ name, description, icon, iconKey, projectId }) {
  if (!name || !name.trim()) throw new Error("Category name is required.");
  const uid = await requireApprovedUid();
  return insertCategory(uid, {
    name,
    description,
    icon: iconKey || icon,
    iconKey: iconKey || icon,
    projectId,
  });
}

// ── UPDATE ────────────────────────────────────────────────────

/**
 * Edit an existing category's name, description, or icon.
 */
export async function editCategory(categoryId, { name, description, icon }) {
  if (!name || !name.trim()) throw new Error("Category name is required.");
  const uid = await requireApprovedUid();
  return updateCategory(uid, categoryId, { name: name.trim(), description, icon });
}

// ── DELETE ────────────────────────────────────────────────────

/**
 * Remove a category. Products that referenced this category
 * will fall back to "Uncategorized" display in the UI.
 */
export async function removeCategory(categoryId) {
  const uid = await requireApprovedUid();
  return deleteCategory(uid, categoryId);
}

