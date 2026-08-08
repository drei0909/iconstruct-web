// Parse and build product bulk CSV for plan-capped imports.

/** Columns shops fill offline. */
export const PRODUCT_CSV_HEADERS = [
  "projectType",
  "category",
  "name",
  "unit",
  "description",
  "sizes",
  "type",
  "inStock",
];

/**
 * projectType values that match Productstab project cards:
 * kitchen_renovation, bathroom_renovation, floor_renovation, etc.
 * Or the human label e.g. "Kitchen Renovation"
 */
export function downloadProductCsvTemplate() {
  const sample = [
    PRODUCT_CSV_HEADERS.join(","),
    "kitchen_renovation,Pipes,PVC Pipe Orange,piece,Schedule 40 PVC,1/2\"|3/4\"|1\",,",
    "plumbing_installation,Fittings,PVC Elbow 90deg,piece,White schedule 40,1/2\"|3/4\",,yes",
    "electrical_installation,Wires,THHN Wire #12,meter,Copper stranded,,yes",
  ].join("\n");
  const blob = new Blob([sample], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "iconstruct-products-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/** Minimal CSV line split (supports quoted commas). */
function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/**
 * @returns {{ rows: object[], errors: string[] }}
 */
export function parseProductCsv(text) {
  const errors = [];
  const lines = String(text || "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return { rows: [], errors: ["CSV is empty. Add a header row and at least one product."] };
  }

  const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, ""));
  const idx = (key) => headers.indexOf(key.toLowerCase());

  const need = ["projecttype", "category", "name"];
  for (const n of need) {
    if (idx(n) < 0 && idx(n.replace("type", "Type")) < 0) {
      // projectType may be projecttype after lowercasing
    }
  }
  if (idx("projecttype") < 0) errors.push('Missing column "projectType".');
  if (idx("category") < 0) errors.push('Missing column "category".');
  if (idx("name") < 0) errors.push('Missing column "name".');
  if (errors.length) return { rows: [], errors };

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const get = (key) => {
      const j = idx(key);
      return j >= 0 ? (cols[j] || "").trim() : "";
    };
    const name = get("name");
    if (!name) {
      errors.push(`Row ${i + 1}: skipped (empty name).`);
      continue;
    }
    const sizesRaw = get("sizes");
    const sizes = sizesRaw
      ? sizesRaw.split(/[|;]/).map((s) => s.trim()).filter(Boolean)
      : [];
    const stockRaw = get("instock").toLowerCase();
    const inStock =
      stockRaw === "" ||
      stockRaw === "yes" ||
      stockRaw === "true" ||
      stockRaw === "1" ||
      stockRaw === "in stock";

    rows.push({
      projectType: get("projecttype"),
      category: get("category"),
      name,
      unit: get("unit") || "piece",
      description: get("description") || "",
      sizes,
      type: get("type") || "",
      inStock,
      lineNumber: i + 1,
    });
  }

  return { rows, errors };
}
