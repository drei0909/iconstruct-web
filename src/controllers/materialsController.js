// src/controllers/materialsController.js
// Business logic for hardware shop materials management and file parsing.

import { auth } from "../services/firebase";
import {
  fetchShopMaterials,
  subscribeShopMaterials,
  insertShopMaterial,
  updateShopMaterial,
  deleteShopMaterial,
  batchInsertShopMaterials,
  clearAllShopMaterials,
} from "../models/materialsModel";
import { classifyMaterial } from "../utils/supplyCategories";
import * as XLSX from "xlsx";

function getAuthenticatedShopId() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  return user.uid;
}

export async function getMaterials() {
  const shopId = getAuthenticatedShopId();
  return fetchShopMaterials(shopId);
}

export function watchMaterials(onChange, onError) {
  const user = auth.currentUser;
  if (!user) {
    onChange([]);
    return () => {};
  }
  return subscribeShopMaterials(user.uid, onChange, onError);
}

export async function createMaterial(data) {
  const shopId = getAuthenticatedShopId();

  const name = String(data.name || "").trim();
  if (!name) throw new Error("Material name is required.");

  const price = Number(data.price);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("Please enter a valid price greater than 0.");
  }

  const category = data.category || classifyMaterial(name);

  return insertShopMaterial(shopId, {
    ...data,
    name,
    price,
    category,
    unit: data.unit || "piece",
    size: data.size || "",
    stock: data.stock !== "" && data.stock !== undefined && data.stock !== null ? Number(data.stock) : null,
    brand: data.brand || "",
    sku: data.sku || "",
    description: data.description || "",
  });
}

export async function editMaterial(materialId, data) {
  const shopId = getAuthenticatedShopId();
  if (!materialId) throw new Error("Material ID is required");

  if (data.name !== undefined) {
    data.name = String(data.name).trim();
    if (!data.name) throw new Error("Material name cannot be empty.");
  }

  if (data.price !== undefined) {
    data.price = Number(data.price);
    if (!Number.isFinite(data.price) || data.price <= 0) {
      throw new Error("Please enter a valid price greater than 0.");
    }
  }

  return updateShopMaterial(shopId, materialId, data);
}

export async function removeMaterial(materialId) {
  const shopId = getAuthenticatedShopId();
  return deleteShopMaterial(shopId, materialId);
}


/**
 * Normalizes column header strings.
 */
function normalizeHeader(h) {
  return String(h || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Map raw row headers to standardized keys.
 */
function mapRowKeys(row) {
  const mapped = {};
  for (const [key, val] of Object.entries(row)) {
    const norm = normalizeHeader(key);
    if (["name", "material", "product", "item", "itemname", "productname", "materialname"].includes(norm)) {
      mapped.name = val;
    } else if (["category", "cat", "group", "type"].includes(norm)) {
      mapped.category = val;
    } else if (["price", "unitprice", "cost", "amount", "srp", "rate"].includes(norm)) {
      mapped.price = val;
    } else if (["unit", "uom", "measure"].includes(norm)) {
      mapped.unit = val;
    } else if (["size", "specification", "spec", "dimensions", "dim"].includes(norm)) {
      mapped.size = val;
    } else if (["stock", "qty", "quantity", "inventory", "count", "available"].includes(norm)) {
      mapped.stock = val;
    } else if (["brand", "manufacturer", "maker"].includes(norm)) {
      mapped.brand = val;
    } else if (["sku", "code", "barcode", "itemcode"].includes(norm)) {
      mapped.sku = val;
    } else if (["description", "desc", "notes"].includes(norm)) {
      mapped.description = val;
    }
  }
  return mapped;
}

/**
 * Parses an uploaded CSV or Excel file and returns validated material items.
 */
export async function parseMaterialsFile(file) {
  if (!file) throw new Error("No file provided.");

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error("The file has no sheets or content.");

  const sheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  if (!rawRows.length) {
    throw new Error("No data rows found in the uploaded file.");
  }

  const validItems = [];
  const errors = [];

  rawRows.forEach((r, idx) => {
    const rowNum = idx + 2; // header is row 1
    const item = mapRowKeys(r);

    const name = String(item.name || "").trim();
    if (!name) {
      errors.push(`Row ${rowNum}: Missing material name.`);
      return;
    }

    const priceRaw = String(item.price || "")
      .replace(/[₱,$\s]/g, "");
    const price = parseFloat(priceRaw);
    if (isNaN(price) || price <= 0) {
      errors.push(`Row ${rowNum} (${name}): Invalid or missing price.`);
      return;
    }

    let stock = null;
    if (item.stock !== undefined && item.stock !== "") {
      const s = parseInt(String(item.stock).replace(/[^0-9]/g, ""), 10);
      if (!isNaN(s)) stock = s;
    }

    const category = item.category ? String(item.category).trim() : classifyMaterial(name);

    validItems.push({
      name,
      price,
      unit: String(item.unit || "piece").trim(),
      size: String(item.size || "").trim(),
      stock,
      category,
      brand: String(item.brand || "").trim(),
      sku: String(item.sku || "").trim(),
      description: String(item.description || "").trim(),
    });
  });

  return {
    totalRows: rawRows.length,
    validItems,
    errors,
  };
}

/**
 * Import materials from an uploaded file (CSV or Excel).
 */
export async function importMaterialsFromFile(file, { replace = false } = {}) {
  const shopId = getAuthenticatedShopId();
  const { validItems, errors } = await parseMaterialsFile(file);

  if (!validItems.length) {
    throw new Error("No valid material items could be parsed from the file.");
  }

  if (replace) {
    await clearAllShopMaterials(shopId);
  }

  const count = await batchInsertShopMaterials(shopId, validItems);
  return {
    importedCount: count,
    skippedCount: errors.length,
    errors,
  };
}

/**
 * Generates and triggers download of a sample CSV template for hardware shops.
 */
export function downloadSampleTemplate() {
  const sampleHeaders = "Name,Category,Unit,Size,Price,Stock,Brand,SKU\n";
  const sampleRows = [
    '"Concrete Primer (4 L)","Paint & Finishing","piece","4 L",480,50,"Davies","PRM-4L"',
    '"Interior Latex Paint (4 L)","Paint & Finishing","gallon","4 L",680,35,"Boysen","LTX-4L"',
    '"Portland Cement","Cement & Aggregates","bag","40 kg",265,500,"Eagle","CMT-40KG"',
    '"Deformed Steel Bar 10mm","Steel & Rebar","piece","10mm x 6m",185,250,"SteelAsia","DSB-10MM"',
    '"Deformed Steel Bar 12mm","Steel & Rebar","piece","12mm x 6m",270,200,"SteelAsia","DSB-12MM"',
    '"Marine Plywood 1/2\\"","Lumber & Plywood","sheet","4ft x 8ft",720,80,"Santa Clara","PLY-12MM"',
    '"PVC Blue Pipe 1/2\\"","Plumbing","piece","1/2\\" x 3m",110,120,"Neltex","PVC-05"',
    '"Assorted Sandpaper (Grit 100/180)","Paint & Finishing","piece","Standard",18,300,"Eagle","SND-100"',
    '"Common Wire Nails 3\\"","Hardware & Fasteners","kilo","3 inch",85,150,"Crown","CWN-3IN"',
    '"Corrugated G.I. Sheet 8ft","Roofing","sheet","8ft x 32in",340,90,"Coloroof","GI-8FT"',
  ].join("\n");

  const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(sampleHeaders + sampleRows);
  const link = document.createElement("a");
  link.setAttribute("href", csvContent);
  link.setAttribute("download", "iconstruct_materials_template.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Export current shop materials to CSV.
 */
export function exportMaterialsToCSV(materials = []) {
  if (!materials.length) throw new Error("No materials to export.");

  const headers = ["Name", "Category", "Unit", "Size", "Price", "Stock", "Brand", "SKU", "Status"];
  const rows = materials.map((m) => [
    `"${(m.name || "").replace(/"/g, '""')}"`,
    `"${(m.category || "").replace(/"/g, '""')}"`,
    `"${(m.unit || "").replace(/"/g, '""')}"`,
    `"${(m.size || "").replace(/"/g, '""')}"`,
    m.price || 0,
    m.stock !== null && m.stock !== undefined ? m.stock : "",
    `"${(m.brand || "").replace(/"/g, '""')}"`,
    `"${(m.sku || "").replace(/"/g, '""')}"`,
    m.isActive === false ? "Inactive" : "Active",
  ]);

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `shop_materials_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
