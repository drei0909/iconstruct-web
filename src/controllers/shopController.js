// src/controllers/shopController.js
// ONLY job: business logic. Gets data from models, checks rules, returns results.

import { auth } from "../services/firebase";
import { signOut } from "firebase/auth";
import {
  fetchShopById,
  fetchOpenProjects,
  fetchQuotationsByShop,
  subscribeToShopQuotations,
  subscribeToLatestPayment,
  insertQuotation,
  respondToAcceptedQuote,
  proposeItemRenegotiation,
  fetchLatestPaymentByShop,
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
  // Returns { success, id, revised } — revised=true when an existing
  // pending quote was updated instead of a new one being created.
  return insertQuotation({
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

/** Shop confirms or declines the builder's accepted total. Confirming
 *  finalizes the deal (unlocks chat/rating); declining ends the whole
 *  project deal, not just the disputed items. */
export async function confirmQuotation({ postId, quotationId, decision }) {
  await requireApprovedShop();
  if (!postId || !quotationId) throw new Error("Project and quotation are required.");
  if (!["confirm", "decline"].includes(decision)) throw new Error("Invalid decision.");
  return respondToAcceptedQuote({ postId, quotationId, decision });
}

/** Shop proposes a new price on one item the builder declined as overpriced. */
export async function renegotiateQuoteItem({ postId, quotationId, itemIndex, newPrice }) {
  await requireApprovedShop();
  if (!postId || !quotationId) throw new Error("Project and quotation are required.");
  const price = Number(newPrice);
  if (!Number.isFinite(price) || price <= 0) throw new Error("Enter a valid price.");
  return proposeItemRenegotiation({ postId, quotationId, itemIndex, newPrice: price });
}

// ── Payments ──────────────────────────────────────────────────────────────────

/** Live latest payment request for the signed-in shop. Returns unsubscribe. */
export function watchMyLatestPayment(onChange, onError) {
  const user = auth.currentUser;
  if (!user) {
    onChange(null);
    return () => {};
  }
  return subscribeToLatestPayment(user.uid, onChange, onError);
}

export async function getMyPaymentRequest() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  return fetchLatestPaymentByShop(user.uid);
}

// Approval, the one-pending rule and the price are all enforced by the
// server function now — the browser can't skip or fake them.
export async function submitPaymentRequest({
  planName, paymentMethod, referenceNumber, screenshotBase64,
}) {
  return insertPaymentRequest({ planName, paymentMethod, referenceNumber, screenshotBase64 });
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