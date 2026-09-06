// src/controllers/recommendationController.js

import {
  fetchRecommendationEngine,
  saveRecommendationEngine,
} from "../models/recommendationModel";
import {
  estimateMaterials,
  normalizeEngineDoc,
} from "../utils/recommendationEngine";
import { auth, db } from "../services/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

async function writeLog(level, message) {
  try {
    await addDoc(collection(db, "systemLogs"), {
      level,
      message,
      actor: auth.currentUser?.email || "system",
      createdAt: serverTimestamp(),
    });
  } catch {
    /* ignore */
  }
}

/** Live config for web + same doc Flutter reads. */
export async function getRecommendationConfig() {
  return fetchRecommendationEngine();
}

/**
 * Run estimate with live Firestore config (falls back to defaults).
 * @param {number} areaSqm
 */
export async function runMaterialEstimate(areaSqm) {
  const config = await getRecommendationConfig();
  return estimateMaterials(areaSqm, config);
}

/** Pure estimate with an already-loaded config (no network). */
export function runMaterialEstimateLocal(areaSqm, config) {
  return estimateMaterials(areaSqm, normalizeEngineDoc(config || {}));
}

/** Admin save from System Settings. */
export async function updateRecommendationEngine({ formula, pricing, source }) {
  const saved = await saveRecommendationEngine({ formula, pricing, source });
  await writeLog("info", "Recommendation engine formulas and pricing updated.");
  return saved;
}
