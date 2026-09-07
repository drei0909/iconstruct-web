// Fixed taxonomy of hardware-supply categories.
// A shop ticks which ones it carries ("What We Supply"); project materials
// are keyword-matched to these to score fit and pre-decline out-of-range lines.

export const SUPPLY_CATEGORIES = [
  { key: "cement_aggregates", label: "Cement & Aggregates",
    kw: /cement|portland|\bsand\b|gravel|aggregate|hollow ?block|\bchb\b|ready ?mix|concrete\b/i },
  { key: "steel_rebar", label: "Steel & Rebar",
    kw: /rebar|reinforc|steel ?bar|deformed ?bar|\brsb\b|angle ?bar|flat ?bar|\bg\.?i\.?\b.*(pipe|tube)|tubular|c-?purlin/i },
  { key: "lumber", label: "Lumber & Plywood",
    kw: /lumber|plywood|coco ?lumber|marine ?board|\bply\b|\bwood\b|\bboard\b|phenolic/i },
  { key: "roofing", label: "Roofing",
    kw: /roof|\byero\b|corrugated|rib ?type|ridge ?roll|gutter|\bpurlin\b|\bg\.?i\.? ?sheet/i },
  { key: "electrical", label: "Electrical",
    kw: /\bwire\b|electrical|breaker|\boutlet\b|\bconduit\b|panel ?board|\bthhn\b|\brsc\b|\bpdx\b|utility ?box|junction ?box/i },
  { key: "plumbing", label: "Plumbing",
    kw: /\bpipe\b|\bpvc\b|\bppr\b|faucet|plumb|fitting|\belbow\b|\btee\b|\bvalve\b|lavatory|water ?closet|\bwc\b|cistern/i },
  { key: "hardware_fasteners", label: "Hardware & Fasteners",
    kw: /\bnail\b|\bscrew\b|\bbolt\b|\bnut\b|washer|hinge|bracket|tie ?wire|anchor|\bblind ?rivet\b/i },
  { key: "paint_finishing", label: "Paint & Finishing",
    kw: /paint|primer|\bputty\b|skim ?coat|varnish|thinner|sealant|epoxy|\blatex\b/i },
  { key: "tiles_masonry_finish", label: "Tiles & Masonry Finish",
    kw: /\btile\b|ceramic|granite|marble|tile ?adhesive|\bgrout\b|\bskirting\b/i },
  { key: "doors_windows", label: "Doors & Windows",
    kw: /\bdoor\b|\bwindow\b|\bjamb\b|\bglass\b|jalousie|\bpanel ?door\b/i },
  { key: "tools_equipment", label: "Tools & Equipment",
    kw: /\btool\b|drill|grinder|trowel|\bwheelbarrow\b|shovel|\bbolo\b|\bhammer\b|\bsaw\b/i },
];

const BY_KEY = Object.fromEntries(SUPPLY_CATEGORIES.map((c) => [c.key, c.label]));

export function categoryLabel(key) {
  return BY_KEY[key] || "Other";
}

/** Best-effort category key for a project material line. "other" when nothing matches. */
export function classifyMaterial(name = "", category = "") {
  const hay = `${name} ${category}`.toLowerCase();
  for (const c of SUPPLY_CATEGORIES) {
    if (c.kw.test(hay)) return c.key;
  }
  return "other";
}

/**
 * How well a project fits what the shop supplies.
 * @returns {{ fit: "good"|"ok"|"poor"|"unknown", coverage:number, matched:number, total:number, cats:string[] }}
 */
export function scoreProjectFit(project = {}, suppliedKeys = []) {
  const set = new Set(Array.isArray(suppliedKeys) ? suppliedKeys : []);
  const mats = Array.isArray(project.materials) ? project.materials : [];
  if (set.size === 0 || mats.length === 0) {
    return { fit: "unknown", coverage: 0, matched: 0, total: mats.length, cats: [] };
  }
  const cats = new Set();
  let matched = 0;
  mats.forEach((m) => {
    const k = classifyMaterial(m.name, m.category);
    if (set.has(k)) {
      matched += 1;
      cats.add(k);
    }
  });
  const coverage = mats.length ? matched / mats.length : 0;
  const fit = coverage >= 0.6 ? "good" : coverage > 0 ? "ok" : "poor";
  return { fit, coverage, matched, total: mats.length, cats: [...cats] };
}
