// src/models/recommendationModel.js
// Firestore access for systemConfig/recommendationEngine

import { db } from "../services/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import {
  ENGINE_SCHEMA_VERSION,
  normalizeEngineDoc,
} from "../utils/recommendationEngine";

const REF = () => doc(db, "systemConfig", "recommendationEngine");

export async function fetchRecommendationEngine() {
  const snap = await getDoc(REF());
  if (!snap.exists()) return normalizeEngineDoc({});
  return normalizeEngineDoc(snap.data());
}

export async function saveRecommendationEngine({ formula, pricing }) {
  const payload = normalizeEngineDoc({ formula, pricing });
  await setDoc(
    REF(),
    {
      schemaVersion: ENGINE_SCHEMA_VERSION,
      formula: payload.formula,
      pricing: payload.pricing,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  return payload;
}
