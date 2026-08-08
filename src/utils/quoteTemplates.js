// Reusable quote note templates per shop (local; no Firestore dependency).

const storageKey = (shopId) => `iconstruct_quote_templates_${shopId || "anon"}`;

export function loadQuoteTemplates(shopId) {
  try {
    const raw = localStorage.getItem(storageKey(shopId));
    if (!raw) return defaultTemplates();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : defaultTemplates();
  } catch {
    return defaultTemplates();
  }
}

function defaultTemplates() {
  return [
    {
      id: "fast-delivery",
      name: "Fast delivery",
      note: "Materials available in stock. Can deliver within 24–48 hours in Lipa City. Thank you!",
    },
    {
      id: "volume-discount",
      name: "Volume discount",
      note: "Quoted prices include a contractor volume discount. Happy to adjust package pricing if the list changes.",
    },
  ];
}

export function saveQuoteTemplates(shopId, templates) {
  const cleaned = (templates || [])
    .filter((t) => t && String(t.note || "").trim())
    .slice(0, 12)
    .map((t, i) => ({
      id: t.id || `tpl_${Date.now()}_${i}`,
      name: String(t.name || "Template").slice(0, 40),
      note: String(t.note).slice(0, 800),
    }));
  localStorage.setItem(storageKey(shopId), JSON.stringify(cleaned));
  return cleaned;
}

export function addQuoteTemplate(shopId, { name, note }) {
  const list = loadQuoteTemplates(shopId);
  const next = [
    { id: `tpl_${Date.now()}`, name: name || "Custom", note: note || "" },
    ...list,
  ].slice(0, 12);
  return saveQuoteTemplates(shopId, next);
}
