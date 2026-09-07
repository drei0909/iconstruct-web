// src/models/chatModel.js
// Firestore CRUD for post-accept shop ↔ builder conversations.

import { db } from "../services/firebase";
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  limit,
} from "firebase/firestore";

/** One thread per project + shop pair after a quote is accepted. */
export function conversationIdFor(projectId, shopId) {
  return `${String(projectId)}_${String(shopId)}`;
}

function sortByLastMessageDesc(list) {
  return [...list].sort((a, b) => {
    const ta =
      typeof a.lastMessageAt?.toMillis === "function"
        ? a.lastMessageAt.toMillis()
        : a.lastMessageAt?.seconds
          ? a.lastMessageAt.seconds * 1000
          : 0;
    const tb =
      typeof b.lastMessageAt?.toMillis === "function"
        ? b.lastMessageAt.toMillis()
        : b.lastMessageAt?.seconds
          ? b.lastMessageAt.seconds * 1000
          : 0;
    return tb - ta;
  });
}

export async function fetchConversation(conversationId) {
  const snap = await getDoc(doc(db, "conversations", conversationId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function fetchShopConversations(shopId) {
  // Equality-only query — no composite index required; sort client-side.
  const q = query(collection(db, "conversations"), where("shopId", "==", shopId));
  const snap = await getDocs(q);
  return sortByLastMessageDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
}

/**
 * Create or refresh a conversation after acceptance.
 * Safe to call multiple times (merge).
 */
export async function upsertConversation({
  conversationId,
  projectId,
  quotationId,
  shopId,
  shopName,
  builderId,
  builderName,
  projectTitle,
}) {
  const ref = doc(db, "conversations", conversationId);
  const existing = await getDoc(ref);
  const base = {
    projectId: String(projectId),
    quotationId: String(quotationId || ""),
    shopId: String(shopId),
    shopName: shopName || "",
    builderId: String(builderId),
    builderName: builderName || "Builder",
    projectTitle: projectTitle || "Project",
    status: "open",
    updatedAt: serverTimestamp(),
  };

  if (existing.exists()) {
    await updateDoc(ref, base);
  } else {
    await setDoc(ref, {
      ...base,
      lastMessage: "Quote accepted — you can now message each other.",
      lastMessageAt: serverTimestamp(),
      lastSenderId: "",
      createdAt: serverTimestamp(),
    });
  }
  return conversationId;
}

export async function insertChatMessage(conversationId, { senderId, senderRole, text, imageUrl }) {
  const trimmed = String(text || "").trim();
  const img = String(imageUrl || "").trim();
  if (!trimmed && !img) throw new Error("Message cannot be empty.");

  const messagesRef = collection(db, "conversations", conversationId, "messages");
  const msg = {
    senderId: String(senderId),
    senderRole: senderRole === "builder" ? "builder" : "shop",
    text: trimmed.slice(0, 4000),
    createdAt: serverTimestamp(),
  };
  if (img) msg.imageUrl = img;
  await addDoc(messagesRef, msg);

  await updateDoc(doc(db, "conversations", conversationId), {
    lastMessage: (trimmed || "📷 Photo").slice(0, 200),
    lastMessageAt: serverTimestamp(),
    lastSenderId: String(senderId),
    updatedAt: serverTimestamp(),
  });
}

/** Stamp the caller's read marker on a thread (backs the Sent / Seen state). */
export async function markConversationRead(conversationId, role) {
  const field = role === "builder" ? "builderLastReadAt" : "shopLastReadAt";
  await updateDoc(doc(db, "conversations", conversationId), {
    [field]: serverTimestamp(),
  });
}

export function listenShopConversations(shopId, onData, onError) {
  // Avoid where+orderBy composite index (and Firestore listen crashes when index is missing).
  const q = query(collection(db, "conversations"), where("shopId", "==", shopId));
  return onSnapshot(
    q,
    (snap) => {
      onData(sortByLastMessageDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    },
    (err) => {
      console.warn("[chat] conversations listen failed:", err?.code || err?.message || err);
      onError?.(err);
    }
  );
}

export function listenConversationMessages(conversationId, onData, onError) {
  const q = query(
    collection(db, "conversations", conversationId, "messages"),
    orderBy("createdAt", "asc"),
    limit(200)
  );
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.warn("[chat] messages listen failed:", err?.code || err?.message || err);
      onError?.(err);
    }
  );
}
