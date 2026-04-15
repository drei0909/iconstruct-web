// src/components/ProductsTab.jsx
// Plan-aware Products tab — works in Basic, Pro, and Business dashboards
//
// PLAN LIMITS (aligned with pricing page):
//   Basic    → 20 products max, no bulk import
//   Pro      → 150 products max, no bulk import
//   Business → No product cap, CSV/Excel bulk import with smart features
//
// SMART FEATURES (Business only):
//   - CSV/Excel bulk import via SheetJS
//   - Preview table before importing (confirm rows)
//   - Auto-correct: trim spaces, convert strings to numbers
//   - Flag duplicate product names automatically
//   - Maps CSV columns → Firestore fields automatically

import { useState, useEffect, useRef } from "react";
import {
  getMyProducts, addProduct, deleteProduct, toggleProductAvailability,
} from "../controllers/shopController";

// ── Plan configuration ─────────────────────────────────────────────────────
// planColor is passed from the dashboard. planLimit controls the product cap.
// planTier is derived from planColor to determine features.
const PLAN_LIMITS = {
  "#F59E0B": { label: "Basic",    max: 20,       csvImport: false }, // amber  = Basic
  "#3B82F6": { label: "Pro",      max: 150,      csvImport: false }, // blue   = Pro
  "#7C3AED": { label: "Business", max: Infinity, csvImport: true  }, // purple = Business
};

// ── Constants ──────────────────────────────────────────────────────────────
const PRODUCT_CATEGORIES = [
  "general", "lumber", "cement", "steel", "paint",
  "electrical", "plumbing", "tools", "hardware",
  "tiles", "roofing", "glass", "pipes", "fasteners",
];

const UNITS = [
  "piece", "bag", "sack", "roll", "sheet",
  "meter", "liter", "set", "box", "pair",
  "kilogram", "ton", "bundle",
];

const CATEGORY_ICONS = {
  general:"📦", lumber:"🪵", cement:"🏗️", steel:"⚙️", paint:"🎨",
  electrical:"⚡", plumbing:"🔧", tools:"🛠️", hardware:"🔩",
  tiles:"🟦", roofing:"🏠", glass:"🪟", pipes:"🔌", fasteners:"📌",
};

// CSV column → Firestore field mapping (case-insensitive, flexible headers)
const CSV_FIELD_MAP = {
  name:        ["name","product","product name","item","item name"],
  price:       ["price","cost","amount","unit price"],
  unit:        ["unit","unit of measure","uom","sold per"],
  category:    ["category","type","product type"],
  description: ["description","desc","details","notes"],
};

const initialForm = {
  name:"", description:"", price:"", unit:"piece", category:"general", imageBase64:"",
};

// ── Helper: parse CSV text → array of row objects ──────────────────────────
function parseCSVText(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, "").toLowerCase());
  return lines.slice(1).map(line => {
    const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
    const row  = {};
    headers.forEach((h, i) => { row[h] = vals[i] || ""; });
    return row;
  });
}

// ── Helper: map raw CSV row → product fields ───────────────────────────────
// Auto-corrects: trims whitespace, converts price strings → numbers
function mapRowToProduct(row) {
  const get = (fieldKey) => {
    const aliases = CSV_FIELD_MAP[fieldKey] || [];
    for (const alias of aliases) {
      if (row[alias] !== undefined && row[alias] !== "") return row[alias].trim();
    }
    return "";
  };

  const rawPrice = get("price").replace(/[₱,\s]/g, "");
  const price    = parseFloat(rawPrice) || 0;

  const rawCat  = get("category").toLowerCase();
  const category = PRODUCT_CATEGORIES.includes(rawCat) ? rawCat : "general";

  const rawUnit = get("unit").toLowerCase();
  const unit    = UNITS.includes(rawUnit) ? rawUnit : "piece";

  return {
    name:        get("name"),
    price:       price.toString(),
    unit,
    category,
    description: get("description"),
    imageBase64: "",
  };
}

export default function ProductsTab({ planColor = "#2C5282" }) {
  // ── Resolve plan config from planColor ──
  const planCfg  = PLAN_LIMITS[planColor] || { label:"Basic", max:20, csvImport:false };
  const planMax  = planCfg.max;
  const canCSV   = planCfg.csvImport;
  const planLabel = planCfg.label;

  // ── State ──────────────────────────────────────────────────────────────
  const [products, setProducts]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [showModal, setShowModal]       = useState(false);
  const [form, setForm]                 = useState(initialForm);
  const [formErrors, setFormErrors]     = useState({});
  const [submitting, setSubmitting]     = useState(false);
  const [toast, setToast]               = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [searchQ, setSearchQ]           = useState("");
  const [filterCat, setFilterCat]       = useState("all");

  // ── CSV import state (Business only) ───────────────────────────────────
  const [showCSVModal, setShowCSVModal]   = useState(false);
  const [csvRows, setCSVRows]             = useState([]);      // parsed + mapped rows
  const [csvFileName, setCSVFileName]     = useState("");
  const [csvParsing, setCSVParsing]       = useState(false);
  const [csvImporting, setCSVImporting]   = useState(false);
  const [csvErrors, setCSVErrors]         = useState([]);      // per-row issues flagged
  const [selectedRows, setSelectedRows]   = useState([]);      // rows user confirmed

  const imageRef = useRef(null);
  const csvRef   = useRef(null);

  useEffect(() => { loadProducts(); }, []);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const data = await getMyProducts();
      setProducts(data);
    } catch {
      showToast("Failed to load products.", "error");
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  // ── Image upload ──────────────────────────────────────────────────────
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { showToast("Image must be under 3MB.", "error"); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setForm(f => ({ ...f, imageBase64: ev.target.result }));
    reader.readAsDataURL(file);
    if (imageRef.current) imageRef.current.value = "";
  };

  // ── Form validation ───────────────────────────────────────────────────
  const validateForm = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Product name is required.";
    if (!form.price || isNaN(parseFloat(form.price)) || parseFloat(form.price) <= 0)
      e.price = "Enter a valid price greater than 0.";
    setFormErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Add single product ────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validateForm()) return;
    // Plan limit check
    if (products.length >= planMax) {
      showToast(`${planLabel} plan allows up to ${planMax} products. Upgrade to add more.`, "error");
      return;
    }
    setSubmitting(true);
    try {
      await addProduct(form);
      showToast("Product added! Visible in the app. 📱");
      setShowModal(false);
      setForm(initialForm);
      setFormErrors({});
      await loadProducts();
    } catch (err) {
      showToast(err.message || "Failed to add product.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete product ────────────────────────────────────────────────────
  const handleDelete = async (productId, productName) => {
    if (deleteConfirm !== productId) {
      setDeleteConfirm(productId);
      setTimeout(() => setDeleteConfirm(null), 3000);
      return;
    }
    try {
      await deleteProduct(productId);
      showToast(`"${productName}" removed.`);
      setDeleteConfirm(null);
      await loadProducts();
    } catch {
      showToast("Failed to remove product.", "error");
    }
  };

  // ── Toggle availability ───────────────────────────────────────────────
  const handleToggleAvailability = async (productId, currentAvailable) => {
    try {
      await toggleProductAvailability(productId, !currentAvailable);
      setProducts(prev => prev.map(p =>
        p.id === productId ? { ...p, available: !currentAvailable } : p
      ));
      showToast(!currentAvailable ? "Marked as available." : "Marked as out of stock.");
    } catch {
      showToast("Failed to update availability.", "error");
    }
  };

  // ── CSV/Excel file picked ─────────────────────────────────────────────
  // Uses SheetJS (xlsx) loaded via CDN to parse both .csv and .xlsx files.
  // Then maps columns → product fields and flags issues automatically.
  const handleCSVFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (csvRef.current) csvRef.current.value = "";

    setCSVParsing(true);
    setCSVFileName(file.name);
    setCSVErrors([]);
    setCSVRows([]);
    setSelectedRows([]);

    try {
      // ── Load SheetJS dynamically ──
      let XLSX;
      try {
        XLSX = await import("https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs");
      } catch {
        // Fallback: load via script tag
        await new Promise((res, rej) => {
          if (window.XLSX) { res(); return; }
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
          s.onload = res; s.onerror = rej;
          document.head.appendChild(s);
        });
        XLSX = window.XLSX;
      }

      // ── Parse file ──
      const arrayBuffer = await file.arrayBuffer();
      const workbook    = XLSX.read(arrayBuffer, { type:"array" });
      const sheetName   = workbook.SheetNames[0];
      const sheet       = workbook.Sheets[sheetName];
      const rawRows     = XLSX.utils.sheet_to_json(sheet, { defval:"", raw:false });

      if (rawRows.length === 0) {
        showToast("File is empty or has no data rows.", "error");
        setCSVParsing(false);
        return;
      }

      // ── Map + auto-correct each row ──
      const existingNames = products.map(p => p.name.toLowerCase().trim());
      const mappedRows    = [];
      const errors        = [];

      rawRows.forEach((raw, i) => {
        // Normalize all keys to lowercase
        const normalized = {};
        Object.keys(raw).forEach(k => { normalized[k.toLowerCase().trim()] = raw[k]; });

        const product = mapRowToProduct(normalized);
        const rowNum  = i + 2; // +2 because row 1 is header
        const rowErrors = [];

        // ── Validation ──
        if (!product.name) {
          rowErrors.push("Missing product name");
        }
        if (!product.price || parseFloat(product.price) <= 0) {
          rowErrors.push("Invalid or missing price");
        }

        // ── Flag duplicates ──
        const isDuplicate = existingNames.includes(product.name.toLowerCase().trim()) ||
          mappedRows.some(r => r.name.toLowerCase().trim() === product.name.toLowerCase().trim());
        if (isDuplicate && product.name) {
          rowErrors.push(`Duplicate: "${product.name}" already exists`);
        }

        mappedRows.push({
          ...product,
          _rowNum:    rowNum,
          _errors:    rowErrors,
          _duplicate: isDuplicate,
          _raw:       normalized,
        });

        if (rowErrors.length > 0) {
          errors.push({ rowNum, name: product.name || "(unnamed)", issues: rowErrors });
        }
      });

      setCSVRows(mappedRows);
      setCSVErrors(errors);
      // Pre-select all valid (no error) rows
      setSelectedRows(mappedRows.filter(r => r._errors.length === 0).map(r => r._rowNum));
      setShowCSVModal(true);

    } catch (err) {
      showToast("Failed to parse file. Make sure it's a valid CSV or Excel file.", "error");
      console.error("CSV parse error:", err);
    } finally {
      setCSVParsing(false);
    }
  };

  // ── Confirm & import selected rows ────────────────────────────────────
  const handleCSVImport = async () => {
    const toImport = csvRows.filter(r => selectedRows.includes(r._rowNum));
    if (toImport.length === 0) {
      showToast("No rows selected to import.", "error");
      return;
    }
    // Check plan limit
    if (products.length + toImport.length > planMax) {
      showToast(`Importing ${toImport.length} products would exceed your plan limit of ${planMax}.`, "error");
      return;
    }

    setCSVImporting(true);
    let success = 0;
    let failed  = 0;

    for (const row of toImport) {
      try {
        await addProduct({
          name:        row.name,
          price:       row.price,
          unit:        row.unit,
          category:    row.category,
          description: row.description,
          imageBase64: "",
        });
        success++;
      } catch {
        failed++;
      }
    }

    setCSVImporting(false);
    setShowCSVModal(false);
    setCSVRows([]);
    setSelectedRows([]);
    setCSVFileName("");
    await loadProducts();

    if (failed === 0) {
      showToast(`✅ ${success} product${success !== 1 ? "s" : ""} imported successfully!`);
    } else {
      showToast(`Imported ${success}, failed ${failed}. Check and retry.`, "error");
    }
  };

  // ── Filter + search ───────────────────────────────────────────────────
  const displayed = products.filter(p => {
    const q = searchQ.toLowerCase();
    const matchSearch =
      p.name?.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q);
    const matchCat = filterCat === "all" || p.category === filterCat;
    return matchSearch && matchCat;
  });

  const usedCategories = [...new Set(products.map(p => p.category).filter(Boolean))];

  // ── Computed plan limit display ───────────────────────────────────────
  const atLimit     = planMax !== Infinity && products.length >= planMax;
  const limitPct    = planMax !== Infinity ? Math.min((products.length / planMax) * 100, 100) : 0;
  const limitColor  = limitPct >= 100 ? "#EF4444" : limitPct >= 80 ? "#F59E0B" : "#10B981";

  return (
    <div>
      {/* ── Header row ────────────────────────────────────────────────── */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:18, flexWrap:"wrap", gap:12 }}>
        <div>
          <div style={{ fontFamily:"'Lora', Georgia, serif", fontSize:20, fontWeight:900, color:"#0F172A", marginBottom:4 }}>
            My Products
          </div>
          <div style={{ fontSize:12.5, color:"#64748B", maxWidth:480 }}>
            Products you add here appear in the iConstruct app in real time.
            {planMax !== Infinity
              ? ` ${planLabel} plan: up to ${planMax} products.`
              : " Business plan: unlimited products."}
          </div>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {/* Bulk import button — Business only */}
          {canCSV && (
            <label
              style={{
                display:"flex", alignItems:"center", gap:7,
                padding:"10px 16px", borderRadius:9,
                border:`1.5px solid ${planColor}`,
                background:"transparent", color:planColor,
                fontSize:13, fontWeight:700, cursor: atLimit ? "not-allowed" : "pointer",
                fontFamily:"'Inter', sans-serif", opacity: atLimit ? 0.5 : 1,
                transition:"all 0.15s",
              }}
              title={atLimit ? `Product limit reached (${planMax})` : "Import products from CSV or Excel"}
            >
              <input
                ref={csvRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                style={{ display:"none" }}
                disabled={atLimit || csvParsing}
                onChange={handleCSVFile}
              />
              {csvParsing ? "Parsing..." : "📊 Bulk Import CSV/Excel"}
            </label>
          )}
          {/* Add single product button */}
          <button
            onClick={() => { setShowModal(true); setForm(initialForm); setFormErrors({}); }}
            disabled={atLimit}
            style={{
              display:"flex", alignItems:"center", gap:7,
              padding:"10px 20px", borderRadius:9, border:"none",
              background: atLimit ? "#E2E8F0" : `linear-gradient(135deg, ${planColor}, ${planColor}CC)`,
              color: atLimit ? "#94A3B8" : "#fff",
              fontSize:13, fontWeight:700,
              cursor: atLimit ? "not-allowed" : "pointer",
              fontFamily:"'Inter', sans-serif",
              boxShadow: atLimit ? "none" : `0 4px 14px ${planColor}40`,
            }}
            title={atLimit ? `${planLabel} plan limit reached (${planMax} products)` : "Add a product"}
          >
            + Add Product
          </button>
        </div>
      </div>

      {/* ── Plan limit bar ────────────────────────────────────────────── */}
      {planMax !== Infinity && (
        <div style={{ background:"#fff", borderRadius:10, border:"1px solid #E2E8F0", padding:"12px 16px", marginBottom:16 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
            <span style={{ fontSize:12, fontWeight:600, color:"#334155" }}>Product Listings</span>
            <span style={{ fontSize:12, fontWeight:700, color: limitColor }}>
              {products.length} / {planMax} used
            </span>
          </div>
          <div style={{ height:5, background:"#F1F5F9", borderRadius:4 }}>
            <div style={{ height:"100%", width:`${limitPct}%`, background: limitColor, borderRadius:4, transition:"width 0.3s" }} />
          </div>
          {atLimit && (
            <p style={{ fontSize:11.5, color:"#EF4444", marginTop:6 }}>
              ⚠ Product limit reached.{" "}
              {planLabel === "Basic" ? "Upgrade to Pro (150 products) or Business (unlimited)." :
               planLabel === "Pro"   ? "Upgrade to Business for unlimited products + bulk import." : ""}
            </p>
          )}
        </div>
      )}

      {/* ── Firebase info banner ──────────────────────────────────────── */}
      <div style={{ background:"#F0FDF4", border:"1px solid #BBF7D0", borderRadius:10, padding:"12px 16px", marginBottom:18, display:"flex", alignItems:"flex-start", gap:12 }}>
        <span style={{ fontSize:20, flexShrink:0 }}>📱</span>
        <div>
          <div style={{ fontSize:12.5, fontWeight:700, color:"#065F46", marginBottom:3 }}>How this connects to the app</div>
          <div style={{ fontSize:12, color:"#047857", lineHeight:1.6 }}>
            Products saved here go to Firebase → your mobile app reads from the same database → builders see your products instantly.
            {canCSV && " Business plan includes bulk CSV/Excel import for fast product uploads."}
          </div>
        </div>
      </div>

      {/* ── Search + filter ───────────────────────────────────────────── */}
      {products.length > 0 && (
        <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
          <div style={{ position:"relative", flex:1, minWidth:200 }}>
            <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#94A3B8", fontSize:14 }}>🔍</span>
            <input type="text" placeholder="Search products..." value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              style={{ width:"100%", paddingLeft:32, paddingRight:12, paddingTop:9, paddingBottom:9, border:"1px solid #E2E8F0", borderRadius:8, fontSize:12.5, fontFamily:"'Inter', sans-serif", outline:"none", color:"#0F172A", background:"#fff" }}
              onFocus={e => e.target.style.borderColor = planColor}
              onBlur={e  => e.target.style.borderColor = "#E2E8F0"}
            />
          </div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            <button onClick={() => setFilterCat("all")}
              style={{ padding:"8px 14px", borderRadius:8, border:`1px solid ${filterCat==="all" ? planColor : "#E2E8F0"}`, background: filterCat==="all" ? planColor : "#fff", color: filterCat==="all" ? "#fff" : "#64748B", fontSize:11.5, fontWeight:500, cursor:"pointer" }}>
              All ({products.length})
            </button>
            {usedCategories.map(cat => (
              <button key={cat} onClick={() => setFilterCat(cat === filterCat ? "all" : cat)}
                style={{ padding:"8px 14px", borderRadius:8, border:`1px solid ${filterCat===cat ? planColor : "#E2E8F0"}`, background: filterCat===cat ? planColor : "#fff", color: filterCat===cat ? "#fff" : "#64748B", fontSize:11.5, fontWeight:500, cursor:"pointer" }}>
                {CATEGORY_ICONS[cat] || "📦"} {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Products grid ─────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ textAlign:"center", padding:"64px 0" }}>
          <div style={{ width:32, height:32, border:`3px solid #E2E8F0`, borderTopColor: planColor, borderRadius:"50%", animation:"prodspin 0.8s linear infinite", margin:"0 auto 12px" }} />
          <div style={{ fontSize:13, color:"#94A3B8" }}>Loading products...</div>
          <style>{`@keyframes prodspin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : products.length === 0 ? (
        <div style={{ background:"#fff", borderRadius:14, border:"1px solid #E2E8F0", padding:"64px 24px", textAlign:"center" }}>
          <div style={{ fontSize:48, marginBottom:16 }}>📦</div>
          <div style={{ fontSize:16, fontWeight:700, color:"#0F172A", marginBottom:8 }}>No products yet</div>
          <div style={{ fontSize:13, color:"#64748B", marginBottom:24, maxWidth:300, margin:"0 auto 24px" }}>
            Add your first product and it will appear in the iConstruct app for builders to browse.
          </div>
          <div style={{ display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap" }}>
            <button onClick={() => { setShowModal(true); setForm(initialForm); setFormErrors({}); }}
              style={{ padding:"11px 28px", borderRadius:9, border:"none", background: planColor, color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>
              + Add Your First Product
            </button>
            {canCSV && (
              <label style={{ padding:"11px 20px", borderRadius:9, border:`1.5px solid ${planColor}`, background:"transparent", color:planColor, fontSize:13, fontWeight:700, cursor:"pointer" }}>
                <input ref={csvRef} type="file" accept=".csv,.xlsx,.xls" style={{ display:"none" }} onChange={handleCSVFile} />
                📊 Import from CSV
              </label>
            )}
          </div>
        </div>
      ) : displayed.length === 0 ? (
        <div style={{ background:"#fff", borderRadius:14, border:"1px solid #E2E8F0", padding:"48px 24px", textAlign:"center" }}>
          <div style={{ fontSize:32, marginBottom:12 }}>🔍</div>
          <div style={{ fontSize:14, fontWeight:600, color:"#0F172A", marginBottom:6 }}>No products match your search</div>
          <button onClick={() => { setSearchQ(""); setFilterCat("all"); }} style={{ fontSize:12, color: planColor, background:"none", border:"none", cursor:"pointer", fontWeight:600 }}>Clear filters</button>
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(220px, 1fr))", gap:14 }}>
          {displayed.map(product => (
            <div key={product.id}
              style={{ background:"#fff", borderRadius:14, border:`1px solid ${product.available ? "#E2E8F0" : "#FEE2E2"}`, overflow:"hidden", position:"relative", transition:"transform 0.2s, box-shadow 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.transform="translateY(-3px)"; e.currentTarget.style.boxShadow="0 10px 28px rgba(0,0,0,0.09)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform=""; e.currentTarget.style.boxShadow=""; }}>
              {!product.available && (
                <div style={{ position:"absolute", top:8, left:0, right:0, zIndex:2, display:"flex", justifyContent:"center" }}>
                  <span style={{ background:"rgba(220,38,38,0.9)", color:"#fff", fontSize:10, fontWeight:700, padding:"3px 10px", borderRadius:20, letterSpacing:"0.08em" }}>OUT OF STOCK</span>
                </div>
              )}
              {product.imageBase64 ? (
                <img src={product.imageBase64} alt={product.name} style={{ width:"100%", height:140, objectFit:"cover", display:"block", opacity: product.available ? 1 : 0.5 }} />
              ) : (
                <div style={{ height:120, background:"#F8FAFC", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:6, opacity: product.available ? 1 : 0.5 }}>
                  <span style={{ fontSize:36 }}>{CATEGORY_ICONS[product.category] || "📦"}</span>
                  <span style={{ fontSize:10, color:"#CBD5E1", fontWeight:500, letterSpacing:"0.06em", textTransform:"uppercase" }}>{product.category}</span>
                </div>
              )}
              <div style={{ padding:"12px 14px" }}>
                <div style={{ fontSize:13.5, fontWeight:700, color:"#0F172A", marginBottom:3, lineHeight:1.3 }}>{product.name}</div>
                <div style={{ fontSize:10.5, color:"#64748B", marginBottom:6 }}>{CATEGORY_ICONS[product.category] || "📦"} {product.category} · per {product.unit}</div>
                {product.description && (
                  <div style={{ fontSize:11, color:"#94A3B8", marginBottom:8, lineHeight:1.5, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{product.description}</div>
                )}
                <div style={{ fontSize:18, fontWeight:900, color: planColor, fontFamily:"'Lora', Georgia, serif", marginBottom:10 }}>₱{Number(product.price).toLocaleString()}</div>
                <div style={{ display:"flex", gap:6 }}>
                  <button onClick={() => handleToggleAvailability(product.id, product.available)}
                    style={{ flex:1, padding:"7px 10px", borderRadius:7, fontSize:10.5, fontWeight:600, cursor:"pointer", border: product.available ? "1px solid #BBF7D0" : "1px solid #FCA5A5", background: product.available ? "#F0FDF4" : "#FEF2F2", color: product.available ? "#065F46" : "#991B1B" }}>
                    {product.available ? "✓ In Stock" : "✗ Out of Stock"}
                  </button>
                  <button onClick={() => handleDelete(product.id, product.name)}
                    style={{ padding:"7px 10px", borderRadius:7, fontSize:10.5, fontWeight:600, cursor:"pointer", border: deleteConfirm === product.id ? "1px solid #EF4444" : "1px solid #E2E8F0", background: deleteConfirm === product.id ? "#EF4444" : "#F8FAFC", color: deleteConfirm === product.id ? "#fff" : "#94A3B8", transition:"all 0.2s" }}
                    title={deleteConfirm === product.id ? "Click again to confirm" : "Delete"}>
                    {deleteConfirm === product.id ? "Confirm?" : "🗑"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Stats bar ─────────────────────────────────────────────────── */}
      {products.length > 0 && (
        <div style={{ marginTop:20, display:"flex", gap:16, flexWrap:"wrap" }}>
          {[
            { label:"Total Products", value: products.length,                           color:"#0F172A" },
            { label:"In Stock",       value: products.filter(p => p.available).length,  color:"#059669" },
            { label:"Out of Stock",   value: products.filter(p => !p.available).length, color:"#DC2626" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ fontSize:12, color:"#64748B" }}>
              <span style={{ fontWeight:700, color, fontSize:15 }}>{value}</span> {label}
            </div>
          ))}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          ADD PRODUCT MODAL
      ════════════════════════════════════════════════════════════════ */}
      {showModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.55)", backdropFilter:"blur(6px)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div style={{ background:"#fff", borderRadius:18, width:"100%", maxWidth:500, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 40px 100px rgba(0,0,0,0.25)" }}>
            <div style={{ padding:"22px 28px 18px", borderBottom:"1px solid #F1F5F9", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, background:"#fff", zIndex:2 }}>
              <div>
                <div style={{ fontFamily:"'Lora', Georgia, serif", fontSize:18, fontWeight:900, color:"#0F172A", marginBottom:2 }}>Add New Product</div>
                <div style={{ fontSize:12, color:"#64748B" }}>Appears in the iConstruct app instantly.</div>
              </div>
              <button onClick={() => setShowModal(false)} style={{ width:32, height:32, borderRadius:"50%", background:"#F1F5F9", border:"none", cursor:"pointer", fontSize:18, color:"#64748B", display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
            </div>
            <div style={{ padding:"20px 28px 24px" }}>
              {/* Photo upload */}
              <div style={{ marginBottom:16 }}>
                <label style={{ fontSize:11.5, fontWeight:600, color:"#64748B", display:"block", marginBottom:7, textTransform:"uppercase", letterSpacing:"0.08em" }}>Product Photo <span style={{ fontWeight:400, textTransform:"none" }}>(optional)</span></label>
                {form.imageBase64 ? (
                  <div style={{ position:"relative", borderRadius:10, overflow:"hidden", marginBottom:4 }}>
                    <img src={form.imageBase64} alt="preview" style={{ width:"100%", height:160, objectFit:"cover", display:"block" }} />
                    <button onClick={() => setForm(f => ({ ...f, imageBase64:"" }))} style={{ position:"absolute", top:8, right:8, width:28, height:28, borderRadius:"50%", background:"rgba(15,23,42,0.7)", border:"none", color:"#fff", cursor:"pointer", fontSize:14, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
                  </div>
                ) : (
                  <label style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8, padding:"20px", border:"2px dashed #E2E8F0", borderRadius:10, cursor:"pointer", background:"#F8FAFC" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = planColor; e.currentTarget.style.background="#F0F9FF"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.background="#F8FAFC"; }}>
                    <input ref={imageRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleImageUpload} />
                    <span style={{ fontSize:28 }}>📷</span>
                    <span style={{ fontSize:12.5, color:"#64748B" }}>Click to upload product photo</span>
                    <span style={{ fontSize:11, color:"#94A3B8" }}>JPG, PNG · Max 3MB</span>
                  </label>
                )}
              </div>
              {/* Name */}
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:11.5, fontWeight:600, color:"#64748B", display:"block", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.08em" }}>Product Name *</label>
                <input type="text" placeholder="e.g. Portland Cement 40kg" value={form.name}
                  onChange={e => { setForm(f => ({...f, name: e.target.value})); setFormErrors(fe => ({...fe, name:""})); }}
                  style={{ width:"100%", padding:"11px 14px", border:`1.5px solid ${formErrors.name ? "#EF4444" : "#E2E8F0"}`, borderRadius:8, fontSize:13.5, fontFamily:"'Inter', sans-serif", outline:"none", color:"#0F172A" }}
                  onFocus={e => { if (!formErrors.name) e.target.style.borderColor = planColor; }}
                  onBlur={e  => { if (!formErrors.name) e.target.style.borderColor = "#E2E8F0"; }}
                />
                {formErrors.name && <p style={{ fontSize:11, color:"#EF4444", marginTop:4 }}>⚠ {formErrors.name}</p>}
              </div>
              {/* Price + Unit */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
                <div>
                  <label style={{ fontSize:11.5, fontWeight:600, color:"#64748B", display:"block", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.08em" }}>Price (₱) *</label>
                  <input type="number" min="0" step="0.01" placeholder="e.g. 285" value={form.price}
                    onChange={e => { setForm(f => ({...f, price: e.target.value})); setFormErrors(fe => ({...fe, price:""})); }}
                    style={{ width:"100%", padding:"11px 14px", border:`1.5px solid ${formErrors.price ? "#EF4444" : "#E2E8F0"}`, borderRadius:8, fontSize:13.5, fontFamily:"'Inter', sans-serif", outline:"none", color:"#0F172A" }}
                    onFocus={e => { if (!formErrors.price) e.target.style.borderColor = planColor; }}
                    onBlur={e  => { if (!formErrors.price) e.target.style.borderColor = "#E2E8F0"; }}
                  />
                  {formErrors.price && <p style={{ fontSize:11, color:"#EF4444", marginTop:4 }}>⚠ {formErrors.price}</p>}
                </div>
                <div>
                  <label style={{ fontSize:11.5, fontWeight:600, color:"#64748B", display:"block", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.08em" }}>Unit</label>
                  <select value={form.unit} onChange={e => setForm(f => ({...f, unit: e.target.value}))}
                    style={{ width:"100%", padding:"11px 14px", border:"1.5px solid #E2E8F0", borderRadius:8, fontSize:13, fontFamily:"'Inter', sans-serif", outline:"none", color:"#0F172A", cursor:"pointer", background:"#fff" }}
                    onFocus={e => e.target.style.borderColor = planColor}
                    onBlur={e  => e.target.style.borderColor = "#E2E8F0"}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              {/* Category */}
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:11.5, fontWeight:600, color:"#64748B", display:"block", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.08em" }}>Category</label>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                  {PRODUCT_CATEGORIES.map(cat => (
                    <button key={cat} type="button" onClick={() => setForm(f => ({...f, category: cat}))}
                      style={{ padding:"6px 12px", borderRadius:20, fontSize:11.5, fontWeight:500, cursor:"pointer", border: form.category === cat ? `1.5px solid ${planColor}` : "1.5px solid #E2E8F0", background: form.category === cat ? `${planColor}15` : "#F8FAFC", color: form.category === cat ? planColor : "#64748B" }}>
                      {CATEGORY_ICONS[cat] || "📦"} {cat}
                    </button>
                  ))}
                </div>
              </div>
              {/* Description */}
              <div style={{ marginBottom:20 }}>
                <label style={{ fontSize:11.5, fontWeight:600, color:"#64748B", display:"block", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.08em" }}>Description <span style={{ fontWeight:400, textTransform:"none" }}>(optional)</span></label>
                <textarea rows={2} placeholder="Brand, size, specs, notes..." value={form.description}
                  onChange={e => setForm(f => ({...f, description: e.target.value}))}
                  style={{ width:"100%", padding:"11px 14px", border:"1.5px solid #E2E8F0", borderRadius:8, fontSize:13, fontFamily:"'Inter', sans-serif", outline:"none", resize:"none", color:"#0F172A" }}
                  onFocus={e => e.target.style.borderColor = planColor}
                  onBlur={e  => e.target.style.borderColor = "#E2E8F0"}
                />
              </div>
              {/* Buttons */}
              <div style={{ display:"flex", gap:10 }}>
                <button onClick={() => setShowModal(false)} style={{ padding:"12px 20px", borderRadius:9, border:"1px solid #E2E8F0", background:"#F8FAFC", fontSize:13, fontWeight:500, color:"#64748B", cursor:"pointer" }}>Cancel</button>
                <button onClick={handleSubmit} disabled={submitting}
                  style={{ flex:1, padding:"12px", borderRadius:9, border:"none", background: submitting ? "#E2E8F0" : `linear-gradient(135deg, ${planColor}, ${planColor}BB)`, color: submitting ? "#94A3B8" : "#fff", fontSize:13, fontWeight:700, cursor: submitting ? "not-allowed" : "pointer", boxShadow: submitting ? "none" : `0 4px 14px ${planColor}40` }}>
                  {submitting ? "Adding..." : "Add to Catalog 📱"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          CSV PREVIEW + IMPORT MODAL (Business only)
          Smart features:
          - Shows parsed rows before importing
          - Flags duplicates and invalid rows in red
          - User can uncheck rows to skip them
          - Auto-corrected values shown in the preview
      ════════════════════════════════════════════════════════════════ */}
      {showCSVModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.6)", backdropFilter:"blur(8px)", zIndex:600, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}
          onClick={e => { if (e.target === e.currentTarget && !csvImporting) setShowCSVModal(false); }}>
          <div style={{ background:"#fff", borderRadius:18, width:"100%", maxWidth:820, maxHeight:"90vh", display:"flex", flexDirection:"column", boxShadow:"0 40px 100px rgba(0,0,0,0.3)" }}>
            {/* Modal header */}
            <div style={{ padding:"20px 26px 16px", borderBottom:"1px solid #F1F5F9", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div>
                <div style={{ fontFamily:"'Lora', Georgia, serif", fontSize:17, fontWeight:900, color:"#0F172A", marginBottom:3 }}>
                  📊 Import Preview — {csvFileName}
                </div>
                <div style={{ fontSize:12, color:"#64748B" }}>
                  {csvRows.length} rows found · {selectedRows.length} selected to import ·{" "}
                  <span style={{ color:"#EF4444" }}>{csvErrors.length} with issues</span>
                </div>
              </div>
              {!csvImporting && (
                <button onClick={() => setShowCSVModal(false)} style={{ width:32, height:32, borderRadius:"50%", background:"#F1F5F9", border:"none", cursor:"pointer", fontSize:18, color:"#64748B", display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
              )}
            </div>

            {/* Smart features info */}
            <div style={{ margin:"12px 26px 0", padding:"10px 14px", background:"#F0FDF4", border:"1px solid #BBF7D0", borderRadius:8, fontSize:12, color:"#065F46" }}>
              ✅ Auto-corrected: spaces trimmed, prices cleaned, categories & units validated.
              Uncheck any row you don't want to import. Rows with errors are pre-deselected.
            </div>

            {/* Error summary */}
            {csvErrors.length > 0 && (
              <div style={{ margin:"10px 26px 0", padding:"10px 14px", background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:8 }}>
                <div style={{ fontSize:12, fontWeight:700, color:"#991B1B", marginBottom:4 }}>⚠ Issues found in {csvErrors.length} row{csvErrors.length>1?"s":""}:</div>
                {csvErrors.slice(0,3).map((e, i) => (
                  <div key={i} style={{ fontSize:11.5, color:"#DC2626", marginBottom:2 }}>
                    Row {e.rowNum} ({e.name || "unnamed"}): {e.issues.join(" · ")}
                  </div>
                ))}
                {csvErrors.length > 3 && <div style={{ fontSize:11, color:"#DC2626" }}>...and {csvErrors.length - 3} more</div>}
              </div>
            )}

            {/* Preview table */}
            <div style={{ flex:1, overflowY:"auto", margin:"12px 0 0" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                <thead style={{ position:"sticky", top:0, background:"#F8FAFC", zIndex:1 }}>
                  <tr>
                    <th style={{ padding:"10px 14px", textAlign:"left", borderBottom:"1px solid #E2E8F0", width:36 }}>
                      <input type="checkbox"
                        checked={selectedRows.length === csvRows.filter(r => r._errors.length === 0).length && csvRows.filter(r => r._errors.length === 0).length > 0}
                        onChange={e => {
                          if (e.target.checked) {
                            setSelectedRows(csvRows.filter(r => r._errors.length === 0).map(r => r._rowNum));
                          } else {
                            setSelectedRows([]);
                          }
                        }}
                      />
                    </th>
                    {["Row","Name","Price","Unit","Category","Description","Status"].map(h => (
                      <th key={h} style={{ padding:"10px 12px", textAlign:"left", fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:"#94A3B8", borderBottom:"1px solid #E2E8F0" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvRows.map((row) => {
                    const hasError  = row._errors.length > 0;
                    const isChecked = selectedRows.includes(row._rowNum);
                    const rowBg     = hasError ? "#FFF8F8" : isChecked ? "#F0FDF4" : "#fff";
                    return (
                      <tr key={row._rowNum} style={{ background: rowBg, borderBottom:"1px solid #F1F5F9" }}>
                        <td style={{ padding:"10px 14px" }}>
                          <input type="checkbox" disabled={hasError} checked={isChecked && !hasError}
                            onChange={e => {
                              if (e.target.checked) setSelectedRows(prev => [...prev, row._rowNum]);
                              else setSelectedRows(prev => prev.filter(r => r !== row._rowNum));
                            }}
                          />
                        </td>
                        <td style={{ padding:"10px 12px", color:"#94A3B8" }}>{row._rowNum}</td>
                        <td style={{ padding:"10px 12px", fontWeight:600, color: hasError ? "#DC2626" : "#0F172A", maxWidth:140, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {row.name || <span style={{ color:"#EF4444", fontStyle:"italic" }}>missing</span>}
                          {row._duplicate && <span style={{ marginLeft:6, fontSize:10, background:"#FEF3C7", color:"#92400E", padding:"1px 5px", borderRadius:4 }}>dup</span>}
                        </td>
                        <td style={{ padding:"10px 12px", color: parseFloat(row.price) > 0 ? "#059669" : "#EF4444", fontWeight:600 }}>
                          {parseFloat(row.price) > 0 ? `₱${parseFloat(row.price).toLocaleString()}` : <span style={{ fontStyle:"italic" }}>invalid</span>}
                        </td>
                        <td style={{ padding:"10px 12px", color:"#334155" }}>{row.unit}</td>
                        <td style={{ padding:"10px 12px", color:"#334155" }}>
                          {CATEGORY_ICONS[row.category] || "📦"} {row.category}
                        </td>
                        <td style={{ padding:"10px 12px", color:"#94A3B8", maxWidth:140, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {row.description || "—"}
                        </td>
                        <td style={{ padding:"10px 12px" }}>
                          {hasError
                            ? <span style={{ fontSize:10, fontWeight:700, background:"#FEE2E2", color:"#991B1B", padding:"2px 8px", borderRadius:10 }}>⚠ Error</span>
                            : row._duplicate
                              ? <span style={{ fontSize:10, fontWeight:700, background:"#FEF3C7", color:"#92400E", padding:"2px 8px", borderRadius:10 }}>Duplicate</span>
                              : <span style={{ fontSize:10, fontWeight:700, background:"#D1FAE5", color:"#065F46", padding:"2px 8px", borderRadius:10 }}>✓ Ready</span>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Modal footer */}
            <div style={{ padding:"14px 26px 20px", borderTop:"1px solid #F1F5F9", display:"flex", gap:10, alignItems:"center" }}>
              <div style={{ flex:1, fontSize:12.5, color:"#64748B" }}>
                {selectedRows.length} of {csvRows.length} rows selected
                {planMax !== Infinity && products.length + selectedRows.length > planMax && (
                  <span style={{ color:"#EF4444", marginLeft:8 }}>⚠ Would exceed plan limit ({planMax})</span>
                )}
              </div>
              <button onClick={() => setShowCSVModal(false)} disabled={csvImporting}
                style={{ padding:"10px 20px", borderRadius:9, border:"1px solid #E2E8F0", background:"#F8FAFC", fontSize:13, fontWeight:500, color:"#64748B", cursor:"pointer" }}>
                Cancel
              </button>
              <button onClick={handleCSVImport} disabled={csvImporting || selectedRows.length === 0}
                style={{ padding:"10px 24px", borderRadius:9, border:"none", background: (csvImporting || selectedRows.length === 0) ? "#E2E8F0" : `linear-gradient(135deg,${planColor},${planColor}BB)`, color: (csvImporting || selectedRows.length === 0) ? "#94A3B8" : "#fff", fontSize:13, fontWeight:700, cursor: (csvImporting || selectedRows.length === 0) ? "not-allowed" : "pointer", boxShadow: selectedRows.length > 0 ? `0 4px 14px ${planColor}40` : "none" }}>
                {csvImporting ? "Importing..." : `Import ${selectedRows.length} Product${selectedRows.length !== 1 ? "s" : ""} →`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position:"fixed", bottom:24, right:24, display:"flex", alignItems:"center", gap:10, padding:"12px 18px", borderRadius:10, background: toast.type === "error" ? "#DC2626" : "#0F172A", color:"#fff", fontSize:12.5, fontWeight:500, boxShadow:"0 10px 30px rgba(0,0,0,0.25)", zIndex:700, maxWidth:320 }}>
          {toast.type === "error" ? "❌" : "✓"} {toast.msg}
        </div>
      )}
    </div>
  );
}