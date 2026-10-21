// src/controllers/chatController.js
// Shop-side chat after a builder accepts the shop's quotation.

import { auth, storage } from "../services/firebase";
import { getDoc, doc, collection, getDocs, query, where, limit } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { db } from "../services/firebase";
import {
  conversationIdFor,
  upsertConversation,
  insertChatMessage,
  markConversationRead,
  listenShopConversations,
  listenConversationMessages,
  fetchConversation,
} from "../models/chatModel";
import { fetchShopById } from "../models/shopModel";
import { isShopApproved } from "../utils/shopAccess";

async function requireApprovedShop() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const shop = await fetchShopById(user.uid);
  if (!isShopApproved(shop.status)) {
    throw new Error("Only approved shops can use chat.");
  }
  return { user, shop };
}

/**
 * Open (or create) chat for an accepted quotation.
 * Prefer Cloud Function creating the thread; this is a client fallback.
 */
export async function openChatForAcceptedQuote(quotation) {
  const { user, shop } = await requireApprovedShop();
  if (!quotation?.projectId) throw new Error("Missing project on quotation.");

  const status = String(quotation.status || "").toLowerCase();
  if (status !== "accepted" && status !== "partially_accepted") {
    throw new Error("Chat unlocks only after the builder accepts your quote.");
  }
  if (String(quotation.shopId) !== user.uid) {
    throw new Error("This quotation does not belong to your shop.");
  }

  const projectSnap = await getDoc(doc(db, "projectPosts", quotation.projectId));
  const post = projectSnap.exists() ? projectSnap.data() : {};
  const builderId =
    quotation.builderId ||
    post.userId ||
    post.builderId ||
    post.ownerId ||
    post.postedBy;

  if (!builderId) {
    throw new Error(
      "Cannot start chat: builder ID missing on project. Ask the Flutter team to set userId on projectPosts."
    );
  }

  const conversationId = conversationIdFor(quotation.projectId, user.uid);
  await upsertConversation({
    conversationId,
    projectId: quotation.projectId,
    quotationId: quotation.id,
    shopId: user.uid,
    shopName: shop.shopName || quotation.shopName || "",
    builderId,
    builderName: post.ownerName || post.builderName || post.userName || "Builder",
    projectTitle: quotation.projectTitle || post.projectName || post.title || "Project",
  });

  return conversationId;
}

export async function sendShopChatMessage(conversationId, { text = "", imageUrl = "" } = {}) {
  const { user } = await requireApprovedShop();
  const conv = await fetchConversation(conversationId);
  if (!conv) throw new Error("Conversation not found.");
  if (String(conv.shopId) !== user.uid) throw new Error("Not your conversation.");
  if (String(conv.status || "open") === "closed") {
    throw new Error("This conversation is closed.");
  }
  await insertChatMessage(conversationId, {
    senderId: user.uid,
    senderRole: "shop",
    text,
    imageUrl,
  });
}

/** Upload a chat photo to chat_images/{conversationId}/… and return its URL. */
export async function uploadChatImage(conversationId, file) {
  await requireApprovedShop();
  if (!file || !/^image\//.test(file.type)) throw new Error("Please choose an image file.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Image must be under 5 MB.");
  const ext = (file.name?.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `chat_images/${conversationId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const r = storageRef(storage, path);
  await uploadBytes(r, file, { contentType: file.type });
  return getDownloadURL(r);
}

/** Stamp the shop's read marker so the builder can see "Seen". */
export async function markShopConversationRead(conversationId) {
  const user = auth.currentUser;
  if (!user || !conversationId) return;
  try {
    await markConversationRead(conversationId, "shop");
  } catch {
    /* non-critical */
  }
}

export function subscribeShopConversations(onData, onError) {
  const user = auth.currentUser;
  if (!user) {
    onError?.(new Error("Not authenticated"));
    return () => {};
  }
  return listenShopConversations(user.uid, onData, onError);
}

export function subscribeConversationMessages(conversationId, onData, onError) {
  if (!conversationId) return () => {};
  return listenConversationMessages(conversationId, onData, onError);
}

/**
 * Dispatch the official transaction quotation invoice message into the chat.
 * Idempotent: checks for prior quotation_invoice messages for this quote.
 */
export async function sendQuotationInvoiceMessage({ quotation, shop = null, project = null }) {
  const { user } = await requireApprovedShop();
  if (!quotation?.projectId || !quotation?.id) throw new Error("Missing project or quotation.");

  const shopId = user.uid;
  const conversationId = conversationIdFor(quotation.projectId, shopId);

  // Check if invoice message already sent
  try {
    const messagesRef = collection(db, "conversations", conversationId, "messages");
    const qSnap = await getDocs(query(messagesRef, where("quotationId", "==", quotation.id), limit(1)));
    if (!qSnap.empty) {
      return conversationId;
    }
  } catch (err) {
    // Continue if query needs index or falls back
  }

  const pTitle = quotation.projectTitle || project?.projectName || project?.title || "Project";
  const sName = shop?.shopName || quotation.shopName || "Hardware Shop";

  // Ensure parent conversation doc exists
  const convRef = doc(db, "conversations", conversationId);
  const convSnap = await getDoc(convRef);
  if (!convSnap.exists()) {
    let builderId =
      quotation.builderId ||
      project?.userId ||
      project?.builderId ||
      project?.ownerId ||
      project?.postedBy;

    if (!builderId) {
      try {
        const postSnap = await getDoc(doc(db, "projectPosts", quotation.projectId));
        if (postSnap.exists()) {
          const post = postSnap.data() || {};
          builderId = post.userId || post.builderId || post.ownerId || post.postedBy;
        }
      } catch (postErr) {
        /* fallback */
      }
    }

    await upsertConversation({
      conversationId,
      projectId: quotation.projectId,
      quotationId: quotation.id,
      shopId,
      shopName: sName,
      builderId: builderId || "Builder",
      builderName: project?.ownerName || project?.builderName || "Builder",
      projectTitle: pTitle,
    });
  }

  const acceptedTotal = Number(quotation.acceptedTotal || quotation.amount || 0);
  const qRef = String(quotation.id).slice(-6).toUpperCase();
  const invoiceText = `[OFFICIAL_TRANSACTION_INVOICE]\nOfficial Quotation & Transaction Invoice\nRef: #${qRef}\nProject: ${pTitle}\nTotal: ₱${acceptedTotal.toLocaleString("en-PH", { maximumFractionDigits: 0 })}\nStatus: Confirmed & Secured by ${sName}\n\nClick below to download or print your official PDF quotation invoice.`;

  const quotationSnapshot = {
    id: quotation.id,
    projectId: quotation.projectId,
    projectTitle: pTitle,
    shopId,
    shopName: sName,
    amount: quotation.amount || 0,
    acceptedTotal,
    status: quotation.status || "accepted",
    shopConfirmation: "confirmed",
    items: Array.isArray(quotation.items) ? quotation.items : [],
    note: quotation.note || "",
    createdAt: quotation.createdAt || null,
  };

  await insertChatMessage(conversationId, {
    senderId: shopId,
    senderRole: "shop",
    type: "quotation_invoice",
    quotationId: quotation.id,
    projectId: quotation.projectId,
    acceptedTotal,
    quotationSnapshot,
    text: invoiceText,
  });

  return conversationId;
}

export { conversationIdFor };
