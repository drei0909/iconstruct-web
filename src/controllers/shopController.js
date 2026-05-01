// src/controllers/shopController.js
// ONLY job: business logic. Gets data from models, checks rules, returns results.

import { auth } from "../services/firebase";
import { signOut } from "firebase/auth";
import {
  fetchShopById,
  fetchOpenProjects,
  fetchQuotationsByShop,
  insertQuotation,
  fetchLatestPaymentByShop,
  fetchPendingPaymentByShop,
  insertPaymentRequest,
  fetchProductsByShop,
  insertProduct,
  updateProductAvailability,
  updateProduct,
  removeProduct,
} from "../models/shopModel";
import { getDoc, doc } from "firebase/firestore";
import { db } from "../services/firebase";

// ── Shop Profile ──────────────────────────────────────────────────────────────

export async function getShopProfile() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  return fetchShopById(user.uid);
}

// ── Projects ──────────────────────────────────────────────────────────────────

export async function getPostedProjects() {
  return fetchOpenProjects();
}

// ── Quotations ────────────────────────────────────────────────────────────────

export async function getShopQuotations() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  return fetchQuotationsByShop(user.uid);
}

export async function submitQuotation({ projectId, amount, note }) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");

  // ✅ was doc(db, "projects", projectId) — wrong collection
  const projectSnap = await getDoc(doc(db, "projectPosts", projectId));
  if (!projectSnap.exists()) throw new Error("Project not found");
  const projectTitle = projectSnap.data()?.projectName || "Project";

  // Get shop name to include in quotation
  const shop = await fetchShopById(user.uid);

  await insertQuotation({
    projectId,
    projectTitle,
    shopId:    user.uid,
    shopName:  shop.shopName,              // ✅ added shopName
    amount,
    note,
  });
}

// ── Payments ──────────────────────────────────────────────────────────────────

export async function getMyPaymentRequest() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  return fetchLatestPaymentByShop(user.uid);
}

export async function submitPaymentRequest({
  planName, planPrice, paymentMethod, referenceNumber, screenshotBase64,
}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");

  const hasPending = await fetchPendingPaymentByShop(user.uid);
  if (hasPending) {
    throw new Error("You already have a pending payment request. Please wait for admin confirmation.");
  }

  const shop = await fetchShopById(user.uid);

  await insertPaymentRequest({
    shopId:          user.uid,
    shopName:        shop.shopName,
    ownerName:       shop.ownerName,
    email:           shop.email,
    planName,
    planPrice,
    paymentMethod,
    referenceNumber,
    screenshotBase64: screenshotBase64 || "",
  });
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export async function getQuotationAnalytics() {
  const quotations = await getShopQuotations();
  const total    = quotations.length;
  const accepted = quotations.filter(q => q.status === "accepted").length;
  const rejected = quotations.filter(q => q.status === "rejected").length;
  const pending  = quotations.filter(q => q.status === "pending").length;
  const winRate  = total > 0 ? Math.round((accepted / total) * 100) : 0;
  return { total, accepted, rejected, pending, winRate };
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function logoutShop() {
  await signOut(auth);
}

// ── Products (NEW) ────────────────────────────────────────────────────────────
// When a shop owner adds a product here, the mobile app reads it from Firestore.
// Both use the same Firebase project — no extra server needed.

// Get all products for the logged-in shop
export async function getMyProducts() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  return fetchProductsByShop(user.uid);
}

// Add a new product (shows up in app immediately via Firestore real-time)
// AFTER — add sizes param and pass it through
export async function addProduct({
  name, description, price, unit, category, imageBase64, sizes,
}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");

  if (!name || !name.trim()) throw new Error("Product name is required.");
  if (!price || isNaN(parseFloat(price))) throw new Error("Valid price is required.");

  const shop = await fetchShopById(user.uid);

  const productId = await insertProduct({
    shopId:      user.uid,
    shopName:    shop.shopName,
    name:        name.trim(),
    description: description || "",
    price,
    unit:        unit     || "piece",
    category:    category || "general",
    imageBase64: imageBase64 || "",
    sizes:       sizes || [],        // ← NEW: array of strings e.g. ["S","M","L"]
  });

  return productId;
}

// Toggle product availability (in stock / out of stock)
export async function toggleProductAvailability(productId, available) {
  await updateProductAvailability(productId, available);
}

// Edit product details
export async function editProduct(productId, data) {
  await updateProduct(productId, data);
}

// Remove a product from the catalog
export async function deleteProduct(productId) {
  await removeProduct(productId);
}