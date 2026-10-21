// src/utils/materialsMatcher.js
// Smart matching between project requested materials and a hardware shop's uploaded inventory.

import { classifyMaterial } from "./supplyCategories";

// Common synonyms in Philippine construction hardware
const SYNONYM_GROUPS = [
  ["yero", "corrugated", "gi sheet", "g i sheet", "roofing", "rib type", "ridge roll", "galvanized iron", "long span"],
  ["rebar", "rsb", "deformed bar", "steel bar", "reinforcing bar"],
  ["chb", "hollow block", "concrete hollow block"],
  ["cement", "portland", "pozzolan", "hydraulic cement"],
  ["plywood", "marine plywood", "marine board", "phenolic", "ordinary plywood"],
  ["pvc", "blue pipe", "drainage pipe", "conduit pipe", "sanitary pipe"],
  ["sand", "fine sand", "vibro sand", "washed sand"],
  ["gravel", "g1", "g2", "aggregate"],
  ["primer", "concrete primer", "metal primer", "epoxy primer"],
  ["latex", "interior latex", "exterior latex", "acrylic paint"],
  ["tie wire", "g i wire", "gi wire"],
  ["sandpaper", "abrasive paper", "waterproof paper"],
];

/**
 * Clean & tokenize text for fuzzy token matching.
 */
function tokenize(str = "") {
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

/**
 * Normalize a material name for comparison.
 */
function normalizeName(str = "") {
  return String(str)
    .toLowerCase()
    .replace(/[()[\],.\-_/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Check if two words are in the same synonym group.
 */
function areSynonyms(wordA, wordB) {
  if (wordA === wordB) return true;
  for (const group of SYNONYM_GROUPS) {
    const hasA = group.some((term) => term === wordA || wordA.includes(term));
    const hasB = group.some((term) => term === wordB || wordB.includes(term));
    if (hasA && hasB) return true;
  }
  return false;
}

/**
 * Calculate token overlap score between 0 and 1 with synonym awareness.
 */
function tokenSimilarity(tokensA, tokensB) {
  if (!tokensA.length || !tokensB.length) return 0;
  const setB = new Set(tokensB);
  let matches = 0;

  for (const t of tokensA) {
    if (setB.has(t)) {
      matches += 1.0;
    } else {
      // Check for synonyms or partial stem matches
      let foundSynonym = false;
      for (const b of setB) {
        if (areSynonyms(t, b)) {
          matches += 0.9;
          foundSynonym = true;
          break;
        } else if ((t.length > 3 && b.startsWith(t)) || (b.length > 3 && t.startsWith(b))) {
          matches += 0.75;
          foundSynonym = true;
          break;
        }
      }
    }
  }

  return (2 * matches) / (tokensA.length + tokensB.length);
}

/**
 * Score how well a shop material matches a project material item.
 * Returns number from 0 to 1.
 */
export function scoreMaterialMatch(projectItem, shopItem) {
  if (!projectItem || !shopItem) return 0;

  const projNorm = normalizeName(projectItem.name);
  const shopNorm = normalizeName(shopItem.name);

  // Exact normalized match
  if (projNorm === shopNorm) return 1.0;

  // Check synonym group matches across the full phrase (e.g. "Yero" vs "Corrugated G.I. Sheet")
  for (const group of SYNONYM_GROUPS) {
    const projHas = group.some((term) => projNorm.includes(term));
    const shopHas = group.some((term) => shopNorm.includes(term));
    if (projHas && shopHas) {
      return 0.95; // Very strong match
    }
  }

  // Substring check only if length ratio is reasonable
  if (projNorm.includes(shopNorm) || shopNorm.includes(projNorm)) {
    const lenRatio = Math.min(projNorm.length, shopNorm.length) / Math.max(projNorm.length, shopNorm.length);
    if (lenRatio > 0.4) return 0.85;
  }

  const projTokens = tokenize(projectItem.name);
  const shopTokens = tokenize(`${shopItem.name} ${shopItem.brand || ""} ${shopItem.size || ""}`);

  const sim = tokenSimilarity(projTokens, shopTokens);

  // Category bonus only if there is already some semantic similarity (> 0.2)
  const projCat = projectItem.category || classifyMaterial(projectItem.name);
  const shopCat = shopItem.category || classifyMaterial(shopItem.name);
  const catBonus = sim > 0.2 && projCat && shopCat && projCat === shopCat ? 0.15 : 0;

  return Math.min(1.0, sim + catBonus);
}

/**
 * Finds the best matching shop inventory item for a given project item.
 */
export function findBestMatch(projectItem, shopMaterials = []) {
  if (!shopMaterials || shopMaterials.length === 0) return null;

  let best = null;
  let highestScore = 0;

  for (const shopMat of shopMaterials) {
    if (shopMat.isActive === false) continue;

    const score = scoreMaterialMatch(projectItem, shopMat);
    if (score > highestScore) {
      highestScore = score;
      best = shopMat;
    }
  }

  // If score is low (< 0.50), it is NOT a match
  if (!best || highestScore < 0.50) {
    return {
      match: null,
      score: 0,
      status: "unavailable",
      reason: "Not currently in your shop inventory",
    };
  }

  const isOutOfStock = best.stock !== undefined && best.stock !== null && Number(best.stock) <= 0;

  // Strong direct match (>= 0.70)
  if (highestScore >= 0.70) {
    if (isOutOfStock) {
      return {
        match: best,
        score: highestScore,
        status: "out_of_stock",
        price: Number(best.price) || 0,
        stock: 0,
        hasStock: false,
        availableQty: 0,
        reason: `Matched store product (${best.name}) is currently OUT OF STOCK (0 in stock)`,
      };
    }

    const availableQty = best.stock !== undefined && best.stock !== null ? Math.max(0, Number(best.stock)) : null;
    const hasStock = availableQty === null || availableQty > 0;

    return {
      match: best,
      score: highestScore,
      status: "direct_match",
      price: Number(best.price) || 0,
      stock: best.stock ?? null,
      hasStock,
      availableQty,
      reason: `Direct inventory match (${best.name})`,
    };
  }

  // Moderate match - suitable for substitution suggestion (0.50 <= score < 0.70)
  if (isOutOfStock) {
    return {
      match: best,
      score: highestScore,
      status: "out_of_stock",
      price: Number(best.price) || 0,
      stock: 0,
      hasStock: false,
      availableQty: 0,
      reason: `Similar store item (${best.name}) is currently OUT OF STOCK`,
    };
  }

  return {
    match: best,
    score: highestScore,
    status: "substitute_suggestion",
    price: Number(best.price) || 0,
    stock: best.stock ?? null,
    subName: best.name + (best.brand ? ` (${best.brand})` : ""),
    reason: `Similar store item found: ${best.name}`,
  };
}

function shopMatHasStock(shopMat, requestedQty = 1) {
  if (shopMat.stock === undefined || shopMat.stock === null || shopMat.stock === "") return true;
  const s = Number(shopMat.stock);
  return Number.isFinite(s) ? s > 0 : true;
}

/**
 * Match an entire list of project materials against the shop's inventory.
 */
export function smartMatchProjectMaterials(projectMaterials = [], shopMaterials = [], suppliedCategories = []) {
  if (!Array.isArray(projectMaterials)) return [];

  return projectMaterials.map((pItem, idx) => {
    const matchResult = findBestMatch(pItem, shopMaterials);
    const requestedQty = Number(pItem.quantity) || 1;

    if (!matchResult || matchResult.status === "unavailable") {
      return {
        index: idx,
        projectItem: pItem,
        mode: "decline", // Unavailable by default
        price: "",
        qty: requestedQty,
        subName: "",
        note: "Not currently in shop inventory",
        matchStatus: "unavailable",
        matchedProduct: null,
        autoMatched: false,
      };
    }

    // Handled out-of-stock items: automatically labeled as out of stock and marked unavailable
    if (matchResult.status === "out_of_stock") {
      const shopItem = matchResult.match;
      return {
        index: idx,
        projectItem: pItem,
        mode: "decline", // Do not quote out of stock
        price: "",
        qty: requestedQty,
        subName: "",
        note: `Out of stock in store inventory (0 available)`,
        matchStatus: "out_of_stock",
        matchedProduct: shopItem,
        autoMatched: false,
      };
    }

    if (matchResult.status === "direct_match") {
      const shopItem = matchResult.match;
      let fillQty = requestedQty;
      let isPartial = false;
      if (matchResult.availableQty !== null && matchResult.availableQty < requestedQty) {
        fillQty = matchResult.availableQty > 0 ? matchResult.availableQty : requestedQty;
        isPartial = matchResult.availableQty > 0;
      }

      return {
        index: idx,
        projectItem: pItem,
        mode: "quote", // Automatically quote!
        price: matchResult.price,
        qty: fillQty,
        subName: "",
        note: isPartial
          ? `Partial stock (${fillQty} of ${requestedQty} available in store)`
          : `In store stock: ${shopItem.name}`,
        matchStatus: "direct_match",
        matchedProduct: shopItem,
        autoMatched: true,
        isPartial,
      };
    }

    if (matchResult.status === "substitute_suggestion") {
      const shopItem = matchResult.match;
      return {
        index: idx,
        projectItem: pItem,
        mode: "decline", // Defaults to unavailable unless shop chooses substitute
        suggestedMode: "substitute",
        suggestedSubName: matchResult.subName,
        suggestedPrice: matchResult.price,
        price: "",
        qty: requestedQty,
        subName: "",
        note: "Not in inventory (store substitute available)",
        matchStatus: "substitute_suggestion",
        matchedProduct: shopItem,
        autoMatched: false,
      };
    }

    return {
      index: idx,
      projectItem: pItem,
      mode: "decline",
      price: "",
      qty: requestedQty,
      subName: "",
      note: "",
      matchStatus: "unavailable",
      matchedProduct: null,
      autoMatched: false,
    };
  });
}

/**
 * Computes the exact matching percentage of a project's requested materials
 * against a shop's uploaded store inventory.
 *
 * Example:
 * Project requests 7 materials. Shop inventory matches all 7 -> 100% (7/7).
 * Project requests 5 materials. Shop inventory matches 2 -> 40% (2/5).
 *
 * @param {Array} projectMaterials - Project's requested items
 * @param {Array} shopMaterials - Hardware shop's inventory items
 * @returns {object} { total, matched, outOfStock, unavailable, percentage, isFullMatch, hasMatches, badgeText, detail }
 */
export function computeProjectMaterialMatch(projectMaterials = [], shopMaterials = []) {
  const items = Array.isArray(projectMaterials) ? projectMaterials : [];
  const total = items.length;

  if (total === 0) {
    return {
      total: 0,
      matched: 0,
      outOfStock: 0,
      unavailable: 0,
      percentage: 0,
      isFullMatch: false,
      hasMatches: false,
      badgeText: "No materials requested",
      detail: "No materials requested",
    };
  }

  const stockItems = Array.isArray(shopMaterials) ? shopMaterials : [];
  if (stockItems.length === 0) {
    return {
      total,
      matched: 0,
      outOfStock: 0,
      unavailable: total,
      percentage: 0,
      isFullMatch: false,
      hasMatches: false,
      badgeText: `0% Match · 0/${total} in store`,
      detail: `0 of ${total} materials in store`,
    };
  }

  let matched = 0;
  let outOfStock = 0;
  let unavailable = 0;

  for (const item of items) {
    const res = findBestMatch(item, stockItems);
    if (!res || res.status === "unavailable") {
      unavailable++;
    } else if (res.status === "out_of_stock") {
      outOfStock++;
    } else if (res.status === "direct_match" && res.hasStock !== false) {
      matched++;
    } else {
      unavailable++;
    }
  }

  const percentage = Math.round((matched / total) * 100);
  const isFullMatch = matched === total && total > 0;
  const hasMatches = matched > 0;

  return {
    total,
    matched,
    outOfStock,
    unavailable,
    percentage,
    isFullMatch,
    hasMatches,
    badgeText: isFullMatch
      ? `100% Match · All ${total} in store`
      : `${percentage}% Match · ${matched}/${total} in store`,
    detail: isFullMatch
      ? `All ${total} materials are in your store inventory`
      : `${matched} of ${total} materials available in your store inventory`,
  };
}
