  // src/models/shopModel.js
  // ONLY job: talk to Firestore. No logic. No auth checks.

  import { db, auth } from "../services/firebase";
  import {
    doc, getDoc, getDocs, addDoc,
    collection, collectionGroup, query, where, orderBy,
    serverTimestamp, onSnapshot,
  } from "firebase/firestore";

  const SUBMIT_QUOTATION_URL =
    "https://us-central1-iconstruct-58a87.cloudfunctions.net/submitQuotation";
  const RESPOND_TO_QUOTE_URL =
    "https://us-central1-iconstruct-58a87.cloudfunctions.net/respondToAcceptedQuote";
  const PROPOSE_RENEGOTIATION_URL =
    "https://us-central1-iconstruct-58a87.cloudfunctions.net/proposeItemRenegotiation";

  async function postToShopFunction(url, body) {
    const user = auth.currentUser;
    if (!user) throw new Error("Not authenticated");
    const token = await user.getIdToken(true);

    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
    } catch {
      throw new Error("Cannot reach the server. Check your connection and try again.");
    }

    let data = {};
    try {
      data = await res.json();
    } catch {
      /* non-JSON response */
    }
    if (!res.ok) {
      throw new Error(data.error || `Request failed (${res.status}).`);
    }
    return data;
  }

  // ── Shop ──────────────────────────────────────────────────────────────────────

  export async function fetchShopById(uid) {
    const snap = await getDoc(doc(db, "shops", uid));
    if (!snap.exists()) throw new Error("Shop profile not found");
    return { id: snap.id, ...snap.data() };
  }

  // ── Projects ──────────────────────────────────────────────────────────────────
  // Shared with Flutter: collection "projectPosts". Fetch all posts builders create
  // so the web shop dashboard can list them (not only status === "open").

  const CLOSED_STATUSES = new Set([
    "closed", "cancelled", "canceled", "completed", "rejected", "deleted",
  ]);

  function projectTimestamp(p) {
    const t = p.postedAt || p.createdAt || p.updatedAt || p.timestamp;
    if (!t) return 0;
    if (typeof t.toMillis === "function") return t.toMillis();
    if (typeof t.seconds === "number") return t.seconds * 1000;
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
  }

  /** Normalize app/web field names so the dashboard always has projectName, etc. */
  function normalizeProjectPost(id, data) {
    const location =
      data.locationCity ||
      data.location ||
      data.city ||
      data.address ||
      "";
    return {
      id,
      ...data,
      projectName:
        data.projectName || data.title || data.name || data.project_name || "Project",
      projectType:
        data.projectType || data.type || data.category || data.project_type || "",
      locationCity: location,
      materials: Array.isArray(data.materials) ? data.materials : [],
      budget: data.budget ?? data.budgetRange ?? data.budget_range ?? null,
      totalAreaSqm:
        data.totalAreaSqm ?? data.area ?? data.totalArea ?? data.total_area_sqm ?? null,
      status: (data.status || "open").toString().toLowerCase(),
    };
  }

  export async function fetchOpenProjects() {
    // Full collection read (rules: signed-in). No status filter — Flutter may omit
    // "status" or use a different value; shops still need to see those posts.
    // Sorted client-side on purpose: orderBy("postedAt") makes Firestore
    // silently EXCLUDE every post without that field (it doesn't throw, so a
    // catch-based fallback never ran) — a post saved with only createdAt would
    // never reach any shop. projectTimestamp() falls back across field names.
    const snap = await getDocs(collection(db, "projectPosts"));
    const docs = snap.docs.map((d) => normalizeProjectPost(d.id, d.data()));
    docs.sort((a, b) => projectTimestamp(b) - projectTimestamp(a));

    // Hide only clearly finished posts; keep open / missing status / active / etc.
    return docs.filter((p) => !CLOSED_STATUSES.has(p.status));
  }

  // ── Quotations ────────────────────────────────────────────────────────────────

  export async function fetchQuotationsByShop(shopId) {
    const q = query(
      collectionGroup(db, "quotations"),
      where("shopId", "==", shopId),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  /**
   * Live version of fetchQuotationsByShop — a builder unchecking materials
   * and re-submitting their acceptance updates the quotation doc directly
   * (no notification to the shop otherwise), so the shop's dashboard needs
   * to see that change without a manual page refresh. Returns the unsubscribe
   * function; caller must call it on unmount.
   */
  export function subscribeToShopQuotations(shopId, onChange, onError) {
    const q = query(
      collectionGroup(db, "quotations"),
      where("shopId", "==", shopId),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(
      q,
      (snap) => onChange(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      onError
    );
  }

  /**
   * Submits a quote through the submitQuotation Cloud Function instead of
   * writing the Firestore doc directly — that write is now locked to admin-
   * only in firestore.rules. The function enforces server-side what a direct
   * client write never could: a real rate limit, and the Basic plan's
   * monthly quota. It derives projectTitle/shopName/builderId itself (from
   * the shop + project docs) and bumps quotationCount atomically, so those
   * params are accepted here only for backward compatibility with the
   * caller and are otherwise unused.
   */
  export async function insertQuotation({ projectId, amount, note, items }) {
    const user = auth.currentUser;
    if (!user) throw new Error("Not authenticated");
    const token = await user.getIdToken(true);

    let res;
    try {
      res = await fetch(SUBMIT_QUOTATION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectId,
          amount: parseFloat(amount),
          note: note || "",
          items: Array.isArray(items) ? items : [],
        }),
      });
    } catch {
      throw new Error(
        "Cannot reach the quotation server. Check your connection and try again."
      );
    }

    let data = {};
    try {
      data = await res.json();
    } catch {
      /* non-JSON response */
    }
    if (!res.ok) {
      throw new Error(data.error || `Could not submit quote (${res.status}).`);
    }
    return data;
  }

  /** Shop's final say on the builder's accepted total — "confirm" locks the
   *  deal in (unlocks chat/rating); "decline" ends the whole project deal. */
  export async function respondToAcceptedQuote({ postId, quotationId, decision }) {
    return postToShopFunction(RESPOND_TO_QUOTE_URL, { postId, quotationId, decision });
  }

  /** Shop counters the price on one line item the builder declined for being
   *  overpriced. Capped server-side at 2 rounds per item. */
  export async function proposeItemRenegotiation({ postId, quotationId, itemIndex, newPrice }) {
    return postToShopFunction(PROPOSE_RENEGOTIATION_URL, {
      postId, quotationId, itemIndex, newPrice: parseFloat(newPrice),
    });
  }

  // ── Payments ──────────────────────────────────────────────────────────────────

  export async function fetchLatestPaymentByShop(shopId) {
    const q = query(
      collection(db, "subscriptionPayments"),
      where("shopId", "==", shopId),
      orderBy("submittedAt", "desc")
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() };
  }

  export async function fetchPendingPaymentByShop(shopId) {
    const q = query(
      collection(db, "subscriptionPayments"),
      where("shopId", "==", shopId),
      where("status", "==", "pending")
    );
    const snap = await getDocs(q);
    return !snap.empty;
  }

  export async function insertPaymentRequest(data) {
    await addDoc(collection(db, "subscriptionPayments"), {
      ...data,
      status: "pending",
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(), 
      createdAt:   serverTimestamp(),
    });
  }

