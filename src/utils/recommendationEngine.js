/**
 * iConstruct Recommendation Engine — web-only rule-based estimator.
 *
 * Used by Super Admin (System Settings) and shop Quote modal on the web.
 * Not wired to the Flutter app / AI assistant.
 *
 * Firestore: systemConfig/recommendationEngine (public read, admin write)
 * Formula: qty = area × perSqm × (1 + wasteFactor); cost = qty × price;
 *          labor = area × laborPerSqm; total = materials + labor
 * schemaVersion === 1
 */

export const ENGINE_SCHEMA_VERSION = 1;
export const ENGINE_DOC_PATH = ["systemConfig", "recommendationEngine"];

export const DEFAULT_FORMULA = {
  cementBagsPerSqm: 0.5,
  sandBagsPerSqm: 0.6,
  gravelBagsPerSqm: 0.4,
  steelBarsPerSqm: 1.2,
  hollowBlocksPerSqm: 12,
  wasteFactor: 0.1,
};

export const DEFAULT_PRICING = {
  cementPerBag: 280,
  sandPerBag: 120,
  gravelPerBag: 130,
  steelBarPer: 380,
  hollowBlockPer: 18,
  laborPerSqm: 650,
};

/** Materials the engine knows about (web estimator). */
export const ENGINE_MATERIALS = [
  {
    key: "cement",
    label: "Cement",
    unit: "bags",
    formulaKey: "cementBagsPerSqm",
    priceKey: "cementPerBag",
  },
  {
    key: "sand",
    label: "Sand",
    unit: "bags",
    formulaKey: "sandBagsPerSqm",
    priceKey: "sandPerBag",
  },
  {
    key: "gravel",
    label: "Gravel",
    unit: "bags",
    formulaKey: "gravelBagsPerSqm",
    priceKey: "gravelPerBag",
  },
  {
    key: "steel",
    label: "Steel bars",
    unit: "pcs",
    formulaKey: "steelBarsPerSqm",
    priceKey: "steelBarPer",
  },
  {
    key: "hollowBlocks",
    label: "Hollow blocks",
    unit: "pcs",
    formulaKey: "hollowBlocksPerSqm",
    priceKey: "hollowBlockPer",
  },
];

export function mergeFormula(raw = {}) {
  return { ...DEFAULT_FORMULA, ...sanitizeNumbers(raw) };
}

export function mergePricing(raw = {}) {
  return { ...DEFAULT_PRICING, ...sanitizeNumbers(raw) };
}

function sanitizeNumbers(obj) {
  const out = {};
  Object.entries(obj || {}).forEach(([k, v]) => {
    const n = Number(v);
    if (Number.isFinite(n)) out[k] = n;
  });
  return out;
}

function roundQty(n) {
  return Math.round(n * 100) / 100;
}

function roundMoney(n) {
  return Math.round(n * 100) / 100;
}

/**
 * @param {number} areaSqm
 * @param {{ formula?: object, pricing?: object }} config
 * @returns {object} estimate result
 */
export function estimateMaterials(areaSqm, config = {}) {
  const area = Number(areaSqm);
  if (!Number.isFinite(area) || area <= 0) {
    throw new Error("Area must be a positive number (sqm).");
  }

  const formula = mergeFormula(config.formula);
  const pricing = mergePricing(config.pricing);
  const waste = Math.max(0, Number(formula.wasteFactor) || 0);
  const multiplier = 1 + waste;

  const items = ENGINE_MATERIALS.map((m) => {
    const perSqm = Number(formula[m.formulaKey]) || 0;
    const unitPrice = Number(pricing[m.priceKey]) || 0;
    const qty = roundQty(area * perSqm * multiplier);
    const cost = roundMoney(qty * unitPrice);
    return {
      key: m.key,
      label: m.label,
      unit: m.unit,
      perSqm,
      unitPrice,
      qty,
      cost,
    };
  });

  const materialsTotal = roundMoney(items.reduce((s, i) => s + i.cost, 0));
  const laborPerSqm = Number(pricing.laborPerSqm) || 0;
  const labor = roundMoney(area * laborPerSqm);
  const total = roundMoney(materialsTotal + labor);

  return {
    schemaVersion: ENGINE_SCHEMA_VERSION,
    areaSqm: area,
    wasteFactor: waste,
    items,
    materialsTotal,
    labor,
    laborPerSqm,
    total,
    currency: "PHP",
    disclaimer:
      "Estimate only. Final prices come from hardware shop listings and quotations.",
  };
}

/** Normalize a Firestore document into { formula, pricing, schemaVersion }. */
export function normalizeEngineDoc(data = {}) {
  return {
    schemaVersion: Number(data.schemaVersion) || ENGINE_SCHEMA_VERSION,
    formula: mergeFormula(data.formula),
    pricing: mergePricing(data.pricing),
    updatedAt: data.updatedAt || null,
  };
}
