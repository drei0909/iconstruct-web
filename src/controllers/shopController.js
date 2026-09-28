// src/controllers/shopController.js
// ONLY job: business logic. Gets data from models, checks rules, returns results.

import { auth } from "../services/firebase";
import { signOut } from "firebase/auth";
import {
  fetchShopById,
  fetchOpenProjects,
  fetchQuotationsByShop,
  subscribeToShopQuotations,
  insertQuotation,
  fetchLatestPaymentByShop,
  fetchPendingPaymentByShop,
  insertPaymentRequest,
} from "../models/shopModel";
import { getDoc, doc } from "firebase/firestore";
import { db } from "../services/firebase";
import { evaluateShopLoginAccess, isShopApproved } from "../utils/shopAccess";

async function requireApprovedShop() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const shop = await fetchShopById(user.uid);
  if (!isShopApproved(shop.status)) {
    const access = evaluateShopLoginAccess(shop.status);
    throw new Error(access.message || "Shop is not approved for this action.");
  }
  return { user, shop };
}

// ── Shop Profile ──────────────────────────────────────────────────────────────

export async function getShopProfile() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  return fetchShopById(user.uid);
}

// ── Projects ──────────────────────────────────────────────────────────────────

/** All builder project posts from Firestore (Flutter + web) for shops to bid on. */
export async function getPostedProjects() {
  return fetchOpenProjects();
}

// ── Quotations ────────────────────────────────────────────────────────────────

export async function getShopQuotations() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  return fetchQuotationsByShop(user.uid);
}

/** Live quotations feed — updates instantly when a builder accepts/declines
 *  items on a quote, no manual refresh needed. Returns the unsubscribe fn. */
export function watchShopQuotations(onChange, onError) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  return subscribeToShopQuotations(user.uid, onChange, onError);
}

export async function submitQuotation({ projectId, amount, note, items, quotedCount, substitutedCount, declinedCount }) {
  const { user, shop } = await requireApprovedShop();

  const n = Number(amount);
  if (!projectId) throw new Error("Project is required.");
  if (!Number.isFinite(n) || n <= 0) throw new Error("Enter a valid quote amount.");

  const projectSnap = await getDoc(doc(db, "projectPosts", projectId));
  if (!projectSnap.exists()) throw new Error("Project not found");
  const post = projectSnap.data() || {};
  const projectTitle =
    post.projectName ||
    post.title ||
    "Project";
  const builderId =
    post.userId || post.builderId || post.ownerId || post.postedBy || "";

  const list = Array.isArray(items) ? items : [];
  await insertQuotation({
    projectId,
    projectTitle,
    shopId:   user.uid,
    shopName: shop.shopName,
    amount: n,
    note,
    items: list,
    quotedCount: Number.isFinite(quotedCount)
      ? quotedCount
      : list.filter((i) => i.status === "quoted" || i.status == null).length,
    substitutedCount: Number.isFinite(substitutedCount)
      ? substitutedCount
      : list.filter((i) => i.status === "substituted").length,
    declinedCount: Number.isFinite(declinedCount)
      ? declinedCount
      : list.filter((i) => i.status === "declined").length,
    builderId,
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
  const { user, shop } = await requireApprovedShop();

  const hasPending = await fetchPendingPaymentByShop(user.uid);
  if (hasPending) {
    throw new Error("You already have a pending payment request. Please wait for admin confirmation.");
  }

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