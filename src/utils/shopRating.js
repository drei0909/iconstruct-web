// Reads the shop rating the builder app already computes server-side
// (onShopRatingWritten recomputes it whenever a builder rates a shop —
// see the Builder Mobile App's shops/{shopId}/ratings/{builderId} trigger).
// The web never writes this; it only displays it.
//
// The exact field names on shops/{shopId} aren't confirmed from this repo,
// so this checks the common candidates rather than assuming one and
// silently showing nothing (or NaN) if it guessed wrong.

const AVERAGE_FIELDS = ["avgRating", "averageRating", "rating", "shopRating", "ratingAvg"];
const COUNT_FIELDS = ["ratingCount", "ratingsCount", "totalRatings", "numRatings"];

function firstFiniteNumber(obj, fields) {
  for (const f of fields) {
    const n = Number(obj?.[f]);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/**
 * @param {object} shop - the shop doc (e.g. from the dashboard's live onSnapshot)
 * @returns {{ average: number|null, count: number, hasRatings: boolean }}
 */
export function getShopRating(shop) {
  const average = firstFiniteNumber(shop, AVERAGE_FIELDS);
  const count = firstFiniteNumber(shop, COUNT_FIELDS) ?? 0;
  return {
    average,
    count,
    hasRatings: average != null && count > 0,
  };
}

/** "4.6" style string for display, or null when there's nothing to show yet. */
export function formatShopRating(shop) {
  const { average, hasRatings } = getShopRating(shop);
  if (!hasRatings) return null;
  return average.toFixed(1);
}
