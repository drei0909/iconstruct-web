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
} from "../models/shopModel";
import { getDoc, doc } from "firebase/firestore";
import { db } from "../services/firebase";

export async function getShopProfile() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  return fetchShopById(user.uid);
}

export async function getPostedProjects() {
  return fetchOpenProjects();
}

export async function getShopQuotations() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  return fetchQuotationsByShop(user.uid);
}

export async function submitQuotation({ projectId, amount, note }) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");

  // Get project title from Firestore
  const projectSnap = await getDoc(doc(db, "projects", projectId));
  const projectTitle = projectSnap.data()?.title || "Project";

  await insertQuotation({
    projectId,
    projectTitle,
    shopId: user.uid,
    amount,
    note,
  });
}

export async function getMyPaymentRequest() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  return fetchLatestPaymentByShop(user.uid);
}

export async function submitPaymentRequest({ planName, planPrice, paymentMethod, referenceNumber, screenshotBase64 }) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");

  // Business rule: block duplicate pending requests
  const hasPending = await fetchPendingPaymentByShop(user.uid);
  if (hasPending) {
    throw new Error("You already have a pending payment request. Please wait for admin confirmation.");
  }

  const shop = await fetchShopById(user.uid);

  await insertPaymentRequest({
    shopId: user.uid,
    shopName: shop.shopName,
    ownerName: shop.ownerName,
    email: shop.email,
    planName,
    planPrice,
    paymentMethod,
    referenceNumber,
    screenshotBase64: screenshotBase64 || "",
  });
}

export async function getQuotationAnalytics() {
  const quotations = await getShopQuotations();
  const total    = quotations.length;
  const accepted = quotations.filter(q => q.status === "accepted").length;
  const rejected = quotations.filter(q => q.status === "rejected").length;
  const pending  = quotations.filter(q => q.status === "pending").length;
  const winRate  = total > 0 ? Math.round((accepted / total) * 100) : 0;
  return { total, accepted, rejected, pending, winRate };
}

export async function logoutShop() {
  await signOut(auth);
}