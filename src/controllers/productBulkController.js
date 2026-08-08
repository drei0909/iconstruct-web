// Bulk product import with plan quota: only remaining slots are credited.

import { auth, db } from "../services/firebase";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { fetchShopById } from "../models/shopModel";
import { isShopApproved, resolveEffectivePlan } from "../utils/shopAccess";
import { getLivePlanConfig, applyProductPlanQuota } from "../config/planConfig";
import { insertCategory } from "../models/shopCategoryModel";

const PROJECT_ALIASES = {
  kitchen_renovation: "kitchen_renovation",
  "kitchen renovation": "kitchen_renovation",
  bathroom_renovation: "bathroom_renovation",
  "bathroom renovation": "bathroom_renovation",
  floor_renovation: "floor_renovation",
  "floor renovation": "floor_renovation",
  interior_painting: "interior_painting",
  "interior painting": "interior_painting",
  roof_repair: "roof_repair",
  "roof repair": "roof_repair",
  electrical_installation: "electrical_installation",
  electrical: "electrical_installation",
  "electrical installation": "electrical_installation",
  plumbing_installation: "plumbing_installation",
  plumbing: "plumbing_installation",
  "plumbing installation": "plumbing_installation",
};

const PROJECT_LABELS = {
  kitchen_renovation: "Kitchen Renovation",
  bathroom_renovation: "Bathroom Renovation",
  floor_renovation: "Floor Renovation",
  interior_painting: "Interior Painting",
  roof_repair: "Roof Repair",
  electrical_installation: "Electrical Installation",
  plumbing_installation: "Plumbing Installation",
};

function normalizeProjectId(raw) {
  const key = String(raw || "").trim().toLowerCase();
  return PROJECT_ALIASES[key] || key.replace(/\s+/g, "_");
}

/**
 * Preview how many rows will be credited under the current plan.
 * Does not write to Firestore.
 */
export async function previewBulkProductImport(parsedRows) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated.");
  const shop = await fetchShopById(user.uid);
  if (!isShopApproved(shop.status)) {
    throw new Error("Only approved shops can import products.");
  }

  const planKey = resolveEffectivePlan(shop);
  const cfg = await getLivePlanConfig(planKey);

  const snap = await getDocs(
    query(collection(db, "products"), where("shopId", "==", user.uid))
  );
  const currentCount = snap.size;

  const quota = applyProductPlanQuota(parsedRows, currentCount, cfg.productLimit);

  return {
    planKey,
    planLabel: cfg.label,
    productLimit: cfg.productLimit,
    currentCount,
    slotsRemaining: quota.slotsRemaining,
    fileRowCount: parsedRows.length,
    willUpload: quota.accepted.length,
    willSkip: quota.skipped.length,
    accepted: quota.accepted,
    skipped: quota.skipped,
    isUnlimited: cfg.productLimit === Infinity,
  };
}

/**
 * Upload accepted rows only (plan remaining slots). Creates missing categories.
 *
 * @returns summary for toast UI
 */
export async function runBulkProductImport(acceptedRows) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated.");
  const shop = await fetchShopById(user.uid);
  if (!isShopApproved(shop.status)) {
    throw new Error("Only approved shops can import products.");
  }

  // Re-check quota at write time so two tabs cannot overfill.
  const planKey = resolveEffectivePlan(shop);
  const cfg = await getLivePlanConfig(planKey);
  const snap = await getDocs(
    query(collection(db, "products"), where("shopId", "==", user.uid))
  );
  const currentCount = snap.size;
  const final = applyProductPlanQuota(acceptedRows, currentCount, cfg.productLimit);
  const rows = final.accepted;

  // Cache existing categories: key = `${projectId}::${nameLower}`
  const catSnap = await getDocs(collection(db, "shops", user.uid, "categories"));
  const catMap = new Map();
  catSnap.docs.forEach((d) => {
    const data = d.data();
    const k = `${data.projectId || ""}::${String(data.name || "").toLowerCase()}`;
    catMap.set(k, { id: d.id, ...data });
  });

  let created = 0;
  let categoriesCreated = 0;
  const rowErrors = [];

  for (const row of rows) {
    try {
      const projectId = normalizeProjectId(row.projectType);
      if (!PROJECT_LABELS[projectId]) {
        rowErrors.push(`"${row.name}": unknown projectType "${row.projectType}"`);
        continue;
      }
      const projectName = PROJECT_LABELS[projectId];
      const catName = String(row.category || "General").trim() || "General";
      const mapKey = `${projectId}::${catName.toLowerCase()}`;

      let cat = catMap.get(mapKey);
      if (!cat) {
        const id = await insertCategory(user.uid, {
          name: catName,
          description: "",
          icon: "PiPackage",
          projectId,
        });
        cat = { id, name: catName, projectId };
        catMap.set(mapKey, cat);
        categoriesCreated++;
      }

      await addDoc(collection(db, "products"), {
        shopId: user.uid,
        shopName: shop.shopName || "",
        categoryId: cat.id,
        category: cat.name || catName,
        projectId,
        projectName,
        name: row.name.trim(),
        unit: row.unit || "piece",
        description: row.description || "",
        inStock: row.inStock !== false,
        available: row.inStock !== false,
        sizes: Array.isArray(row.sizes) ? row.sizes : [],
        type: row.type || "",
        imageUrl: "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      created++;
    } catch (err) {
      rowErrors.push(`"${row.name}": ${err.message || "failed"}`);
    }
  }

  return {
    created,
    categoriesCreated,
    skippedByQuota: final.skipped.length,
    slotsRemainingAfter: final.slotsRemaining === Infinity
      ? Infinity
      : Math.max(0, final.slotsRemaining - created),
    productLimit: cfg.productLimit,
    planLabel: cfg.label,
    rowErrors,
  };
}
