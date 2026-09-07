  // src/models/shopModel.js
  // ONLY job: talk to Firestore. No logic. No auth checks.

  import { db } from "../services/firebase";
  import {
    doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
    collection, collectionGroup, query, where, orderBy,
    serverTimestamp, increment,
  } from "firebase/firestore";

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
    let docs = [];
    try {
      const q = query(collection(db, "projectPosts"), orderBy("postedAt", "desc"));
      const snap = await getDocs(q);
      docs = snap.docs.map((d) => normalizeProjectPost(d.id, d.data()));
    } catch {
      // Missing index / no postedAt on some docs → plain collection scan
      const snap = await getDocs(collection(db, "projectPosts"));
      docs = snap.docs.map((d) => normalizeProjectPost(d.id, d.data()));
      docs.sort((a, b) => projectTimestamp(b) - projectTimestamp(a));
    }

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

  export async function insertQuotation({
    projectId,
    projectTitle,
    shopId,
    shopName,
    amount,
    note,
    items,
    quotedCount,
    substitutedCount,
    declinedCount,
    builderId,
  }) {
    const quotationRef = collection(db, "projectPosts", projectId, "quotations");
    const list = Array.isArray(items) ? items : [];
    const payload = {
      projectId: String(projectId),
      projectTitle: projectTitle || "Project",
      shopId: String(shopId),
      shopName: shopName || "",
      amount: parseFloat(amount),
      note: note || "",
      items: list,
      quotedCount: Number.isFinite(quotedCount) ? quotedCount : list.filter((i) => i.status === "quoted" || i.status == null).length,
      substitutedCount: Number.isFinite(substitutedCount) ? substitutedCount : list.filter((i) => i.status === "substituted").length,
      declinedCount: Number.isFinite(declinedCount) ? declinedCount : list.filter((i) => i.status === "declined").length,
      status: "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (builderId) payload.builderId = String(builderId);

    try {
      await addDoc(quotationRef, payload);
    } catch (err) {
      const msg = String(err?.message || err || "");
      if (/permission|insufficient/i.test(msg)) {
        throw new Error(
          "Firebase blocked this quote (permissions). Confirm your shop status is approved and run: firebase deploy --only firestore:rules"
        );
      }
      throw err;
    }

    // Bid counter is best-effort — quote already saved if this fails
    try {
      const postRef = doc(db, "projectPosts", projectId);
      await updateDoc(postRef, {
        quotationCount: increment(1),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn("quotationCount update skipped:", err.message);
    }
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

