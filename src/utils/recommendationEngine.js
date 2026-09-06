/**
 * iConstruct Recommendation Engine — web-only rule-based estimator.
 *
 * Used by Super Admin (System Settings). Not currently wired to the Flutter app.
 *
 * Firestore: systemConfig/recommendationEngine (public read, admin write)
 * Formula: qty = area(m²) × perSqm × (1 + wasteFactor); cost = qty × price;
 *          labor = area × laborPerSqm; total = materials + labor
 *
 * Basis (schemaVersion 2): DPWH Detailed Unit Price Analysis (DUPA) quantity
 * take-off. Concrete = Class A (1:2:4). CHB = 100 mm load-bearing wall.
 * Factors are per m² of gross floor area for a typical 1-storey structure.
 *
 * schemaVersion 1 → 2 changed units:
 *   sand/gravel  : bags   → m³      (key renamed, legacy value dropped)
 *   steel        : pcs    → kg      (key renamed, legacy value dropped)
 *   hollowBlocks : pcs    → pcs     (key renamed hollowBlocksPerSqm→chbPcsPerSqm, value kept)
 * If the Flutter/builder app ever reads this doc it must be updated for v2.
 */

export const ENGINE_SCHEMA_VERSION = 2;
export const ENGINE_DOC_PATH = ["systemConfig", "recommendationEngine"];

export const DEFAULT_FORMULA = {
  cementBagsPerSqm: 0.9,   // Class A concrete ≈ 9 bags / m³
  sandCuMPerSqm: 0.05,     // ≈ 0.5 m³ sand / m³ concrete
  gravelCuMPerSqm: 0.10,   // ≈ 1.0 m³ gravel / m³ concrete
  steelKgPerSqm: 8.0,      // ≈ 70 kg rebar / m³ concrete (residential)
  chbPcsPerSqm: 10,        // 12.5 pcs / m² wall × wall-to-floor ratio
  wasteFactor: 0.05,       // DPWH DUPA standard material allowance
};

// Indicative national averages (PHP). Super Admin MUST override with the current
// DPWH regional Department Order (Revised Unit Prices of Construction Materials
// & Labor) for the project's region.
export const DEFAULT_PRICING = {
  cementPerBag: 260,
  sandPerCuM: 1450,
  gravelPerCuM: 1650,
  steelPerKg: 78,
  chbPerPc: 16,
  laborPerSqm: 900,
};

// Where the prices above came from — recorded for auditability / defense.
export const DEFAULT_SOURCE = {
  reference: "",  // e.g. "DPWH D.O. No. 24, s. 2024"
  region: "",     // e.g. "Region IV-A (CALABARZON)"
  asOf: "",       // e.g. "2024 Q4" or a date
};

/** Materials the engine knows about (web estimator). */
export const ENGINE_MATERIALS = [
  { key: "cement", label: "Cement",                unit: "bags", formulaKey: "cementBagsPerSqm", priceKey: "cementPerBag" },
  { key: "sand",   label: "Sand",                  unit: "m³",   formulaKey: "sandCuMPerSqm",    priceKey: "sandPerCuM" },
  { key: "gravel", label: "Gravel",                unit: "m³",   formulaKey: "gravelCuMPerSqm",  priceKey: "gravelPerCuM" },
  { key: "steel",  label: "Reinforcing steel",     unit: "kg",   formulaKey: "steelKgPerSqm",    priceKey: "steelPerKg" },
  { key: "chb",    label: "Concrete hollow blocks", unit: "pcs", formulaKey: "chbPcsPerSqm",     priceKey: "chbPerPc" },
];

// ── v1 → v2 migration ────────────────────────────────────────────────────────
// Keys whose unit changed: drop the legacy value so the corrected v2 default
// applies unless the admin has already set the new key.
const LEGACY_DROP = {
  formula: ["sandBagsPerSqm", "gravelBagsPerSqm", "steelBarsPerSqm"],
  pricing: ["sandPerBag", "gravelPerBag", "steelBarPer"],
};
// Pure renames (unit unchanged): carry the value forward.
const LEGACY_RENAME = {
  formula: { hollowBlocksPerSqm: "chbPcsPerSqm" },
  pricing: { hollowBlockPer: "chbPerPc" },
};

function migrateLegacy(raw = {}, kind) {
  const r = { ...(raw || {}) };
  Object.entries(LEGACY_RENAME[kind]).forEach(([oldK, newK]) => {
    if (r[newK] == null && r[oldK] != null) r[newK] = r[oldK];
    delete r[oldK];
  });
  LEGACY_DROP[kind].forEach((k) => { delete r[k]; });
  return r;
}

export function mergeFormula(raw = {}) {
  return { ...DEFAULT_FORMULA, ...sanitizeNumbers(migrateLegacy(raw, "formula")) };
}

export function mergePricing(raw = {}) {
  return { ...DEFAULT_PRICING, ...sanitizeNumbers(migrateLegacy(raw, "pricing")) };
}

export function mergeSource(raw = {}) {
  const out = { ...DEFAULT_SOURCE };
  Object.entries(raw || {}).forEach(([k, v]) => {
    if (k in DEFAULT_SOURCE && typeof v === "string") out[k] = v.trim();
  });
  return out;
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
 * @param {{ formula?: object, pricing?: object, source?: object }} config
 * @returns {object} estimate result
 */
export function estimateMaterials(areaSqm, config = {}) {
  const area = Number(areaSqm);
  if (!Number.isFinite(area) || area <= 0) {
    throw new Error("Area must be a positive number (m²).");
  }

  const formula = mergeFormula(config.formula);
  const pricing = mergePricing(config.pricing);
  const source = mergeSource(config.source);
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
    source,
    disclaimer:
      "Rule-based estimate on DPWH DUPA quantity factors. Prices are reference " +
      "values only — final pricing comes from hardware shop quotations.",
  };
}

/** Normalize a Firestore document into { schemaVersion, formula, pricing, source }. */
export function normalizeEngineDoc(data = {}) {
  return {
    schemaVersion: ENGINE_SCHEMA_VERSION,
    formula: mergeFormula(data.formula),
    pricing: mergePricing(data.pricing),
    source: mergeSource(data.source),
    updatedAt: data.updatedAt || null,
  };
}
