// src/components/ProductsTab.jsx
// ─────────────────────────────────────────────────────────────
// "My Products" tab used by all three dashboards.
//
// FLOW:
//   1. Shop owner creates a Category first (shops/{uid}/categories/{id})
//   2. Under each Category, they add Products (top-level `products` collection
//      with shopId + categoryId fields)
//   3. The mobile app reads both collections from the same Firebase project
//
// BACKWARDS COMPATIBLE:
//   Products without a categoryId show under "Uncategorized".
//
// Props
// ─────
//   plan  {string}  "basic" | "pro" | "business"
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import { auth, db, storage } from "../services/firebase";
import {
  collection, addDoc, getDocs, deleteDoc,
  doc, query, where, serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getPlanConfig, formatProductLimit, isAtProductLimit } from "../config/planConfig";
import { getMyCategories, addCategory, editCategory, removeCategory } from "../controllers/shopCategoryController";

// ── Design tokens ─────────────────────────────────────────────
const T = {
  fontDisplay : "'Lora', Georgia, serif",
  fontBody    : "'Inter', sans-serif",
  ink         : "#1A2332",
  ink2        : "#3D5166",
  ink3        : "#6B7F96",
  ink4        : "#A8B8C8",
  border      : "#E4E9F0",
  borderLight : "#EEF2F7",
  surface     : "#FFFFFF",
  surface2    : "#F8FAFC",
  green       : "#059669",
  greenLight  : "#ECFDF5",
  greenBorder : "#6EE7B7",
  red         : "#DC2626",
  redLight    : "#FEF2F2",
  amber       : "#D97706",
  amberLight  : "#FFFBEB",
  radius      : "12px",
  radiusSm    : "8px",
  shadowSm    : "0 1px 3px rgba(26,35,50,0.06)",
  shadowMd    : "0 4px 16px rgba(26,35,50,0.08)",
};

const peso = (n) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency", currency: "PHP", maximumFractionDigits: 0,
  }).format(n ?? 0);

// ── Reusable Field wrapper ────────────────────────────────────
function Field({ label, required, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{
        fontSize: 11.5, fontWeight: 600, color: T.ink2,
        display: "block", marginBottom: 5, fontFamily: T.fontBody,
      }}>
        {label}{required && <span style={{ color: T.red, marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

// ── Shared input style ────────────────────────────────────────
const inputStyle = (accentColor) => ({
  width: "100%", padding: "10px 14px",
  border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm,
  fontSize: 13, fontFamily: T.fontBody, color: T.ink,
  background: T.surface, outline: "none",
  transition: "border-color 0.15s", boxSizing: "border-box",
});

// ── Modal shell ───────────────────────────────────────────────
function Modal({ title, subtitle, accentColor, onClose, children }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(26,35,50,0.55)", backdropFilter: "blur(6px)",
        zIndex: 300, display: "flex", alignItems: "center",
        justifyContent: "center", padding: 24,
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: T.surface, borderRadius: 16,
        width: "100%", maxWidth: 480, padding: "32px 28px",
        boxShadow: "0 32px 80px rgba(26,35,50,0.2)",
        maxHeight: "90vh", overflowY: "auto", position: "relative",
      }}>
        {/* Top accent bar */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 4,
          background: accentColor, borderRadius: "16px 16px 0 0",
        }} />
        <div style={{
          fontFamily: T.fontDisplay, fontSize: 18, fontWeight: 700,
          color: T.ink, marginBottom: 4, marginTop: 8,
        }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 13, color: T.ink3, marginBottom: 22, lineHeight: 1.5 }}>
            {subtitle}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function ProductsTab({ plan = "basic" }) {
  const cfg        = getPlanConfig(plan);
  const limit      = cfg.productLimit;
  const isUnlimited = limit === Infinity;
  const uid        = auth.currentUser?.uid;

  // ── View state: "categories" | "products" ────────────────────
  const [view, setView] = useState("categories"); // start on categories list

  // ── Data ─────────────────────────────────────────────────────
  const [categories, setCategories] = useState([]);
  const [products,   setProducts]   = useState([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [loadingProds, setLoadingProds] = useState(false);

  // ── Selected category (when drilling into products) ───────────
  const [selectedCat, setSelectedCat] = useState(null); // { id, name, icon }

  // ── Modals ────────────────────────────────────────────────────
  const [showCatModal,  setShowCatModal]  = useState(false);
  const [editCatData,   setEditCatData]   = useState(null); // null = add mode
  const [showProdModal, setShowProdModal] = useState(false);

  // ── Forms ─────────────────────────────────────────────────────
  const [catForm,  setCatForm]  = useState({ name: "", description: "", icon: "📦" });
  const [prodForm, setProdForm] = useState({
    name: "", unit: "", price: "", description: "",
    inStock: true, imageFile: null, imagePreview: null,
  });

  // ── UI state ──────────────────────────────────────────────────
  const [saving,    setSaving]    = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchQ,   setSearchQ]   = useState("");
  const [toast,     setToast]     = useState(null);
  const fileRef = useRef(null);

  // ── Derived ───────────────────────────────────────────────────
  const totalProducts = products.length; // across all categories for this shop
  const atLimit = isAtProductLimit(totalProducts, limit);

  const filteredProducts = products.filter(p => {
    const q = searchQ.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q) ||
      p.unit?.toLowerCase().includes(q)
    );
  });

  // ── Toast helper ──────────────────────────────────────────────
  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Fetch categories ──────────────────────────────────────────
  const fetchCategories = useCallback(async () => {
    if (!uid) return;
    setLoadingCats(true);
    try {
      const cats = await getMyCategories();
      setCategories(cats);
    } catch (err) {
      console.error("fetchCategories:", err);
      showToast("Could not load categories.", "error");
    } finally {
      setLoadingCats(false);
    }
  }, [uid]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  // ── Fetch products for ALL shop (for limit counting) and for
  //    selected category (for the product list view) ────────────
 const fetchAllProducts = useCallback(async () => {
  if (!uid) return;
  try {
    const snap = await getDocs(
      query(
        collection(db, "products"),
        where("shopId", "==", uid)
      )
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error("fetchAllProducts:", err);
    return [];
  }
}, [uid]);

 const fetchProductsForCategory = useCallback(async (categoryId) => {
  if (!uid) return;
  setLoadingProds(true);
  try {
    const snap = await getDocs(
      query(
        collection(db, "products"),
        where("shopId", "==", uid),
        where("categoryId", "==", categoryId)
      )
    );
    const docs = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
    setProducts(docs);
  } catch (err) {
    console.error("fetchProductsForCategory:", err);
    showToast("Could not load products.", "error");
  } finally {
    setLoadingProds(false);
  }
}, [uid]);

  // Also keep a running total for the limit bar
  const [allProducts, setAllProducts] = useState([]);
  useEffect(() => {
    fetchAllProducts().then(p => { if (p) setAllProducts(p); });
  }, [fetchAllProducts]);

  // ── Open a category → switch to product view ──────────────────
  const openCategory = (cat) => {
    setSelectedCat(cat);
    setView("products");
    setSearchQ("");
    fetchProductsForCategory(cat.id);
  };

  // ── Back to categories view ───────────────────────────────────
  const backToCategories = () => {
    setView("categories");
    setSelectedCat(null);
    setProducts([]);
    setSearchQ("");
    // Refresh categories in case product counts changed
    fetchCategories();
    // Refresh total count
    fetchAllProducts().then(p => { if (p) setAllProducts(p); });
  };

  // ── Category CRUD ─────────────────────────────────────────────
  const resetCatForm = () => setCatForm({ name: "", description: "", icon: "📦" });

  const openAddCat = () => {
    setEditCatData(null);
    resetCatForm();
    setShowCatModal(true);
  };

  const openEditCat = (e, cat) => {
    e.stopPropagation(); // don't open the category
    setEditCatData(cat);
    setCatForm({ name: cat.name, description: cat.description || "", icon: cat.icon || "📦" });
    setShowCatModal(true);
  };

  const handleSaveCategory = async () => {
    if (!catForm.name.trim()) { showToast("Category name is required.", "error"); return; }
    setSaving(true);
    try {
      if (editCatData) {
        await editCategory(editCatData.id, catForm);
        showToast("Category updated.");
      } else {
        await addCategory(catForm);
        showToast("Category created.");
      }
      setShowCatModal(false);
      resetCatForm();
      await fetchCategories();
    } catch (err) {
      console.error("handleSaveCategory:", err);
      showToast(err.message || "Failed to save category.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (e, cat) => {
    e.stopPropagation();
    const productCount = allProducts.filter(p => p.categoryId === cat.id).length;
    const msg = productCount > 0
      ? `Delete "${cat.name}"? It has ${productCount} product(s) that will become uncategorized.`
      : `Delete "${cat.name}"?`;
    if (!window.confirm(msg)) return;
    try {
      await removeCategory(cat.id);
      showToast("Category deleted.");
      await fetchCategories();
      fetchAllProducts().then(p => { if (p) setAllProducts(p); });
    } catch (err) {
      console.error("handleDeleteCategory:", err);
      showToast("Failed to delete category.", "error");
    }
  };

  // ── Product CRUD ──────────────────────────────────────────────
  const resetProdForm = () => setProdForm({
    name: "", unit: "", price: "", description: "",
    inStock: true, imageFile: null, imagePreview: null,
  });

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProdForm(f => ({ ...f, imageFile: file, imagePreview: URL.createObjectURL(file) }));
  };

  const handleSaveProduct = async () => {
    if (!prodForm.name || !prodForm.price) {
      showToast("Name and price are required.", "error");
      return;
    }
    if (isAtProductLimit(allProducts.length, limit)) {
      showToast(`${cfg.label} plan limit reached.`, "error");
      return;
    }
    setUploading(true);
    try {
      let imageUrl = "";
      if (prodForm.imageFile) {
        const imgRef = ref(storage, `products/${uid}/${Date.now()}_${prodForm.imageFile.name}`);
        await uploadBytes(imgRef, prodForm.imageFile);
        imageUrl = await getDownloadURL(imgRef);
      }
      await addDoc(collection(db, "products"), {
        shopId     : uid,
        categoryId : selectedCat.id,
        category   : selectedCat.name, // kept for backwards compat with old queries
        name       : prodForm.name.trim(),
        unit       : prodForm.unit.trim(),
        price      : Number(prodForm.price),
        description: prodForm.description.trim(),
        inStock    : prodForm.inStock,
        imageUrl,
        createdAt  : serverTimestamp(),
      });
      showToast("Product added!");
      setShowProdModal(false);
      resetProdForm();
      // Refresh both lists
      await fetchProductsForCategory(selectedCat.id);
      fetchAllProducts().then(p => { if (p) setAllProducts(p); });
    } catch (err) {
      console.error("handleSaveProduct:", err);
      showToast("Failed to add product.", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteProduct = async (productId, productName) => {
    if (!window.confirm(`Remove "${productName}"?`)) return;
    try {
      await deleteDoc(doc(db, "products", productId));
      showToast("Product removed.");
      await fetchProductsForCategory(selectedCat.id);
      fetchAllProducts().then(p => { if (p) setAllProducts(p); });
    } catch (err) {
      console.error("handleDeleteProduct:", err);
      showToast("Failed to remove product.", "error");
    }
  };

  // ── Product count per category (derived from allProducts) ──────
  const countForCat = (catId) => allProducts.filter(p => p.categoryId === catId).length;

  // ── Quota bar values ──────────────────────────────────────────
  const totalCount = allProducts.length;
  const pct        = isUnlimited ? 100 : Math.min((totalCount / limit) * 100, 100);
  const barColor   = isUnlimited ? T.green : pct >= 100 ? T.red : pct >= 75 ? T.amber : T.green;
  const limitLabel = isUnlimited ? `${totalCount} listed · no cap` : `${totalCount} / ${limit} used`;

  // ── ICON PICKER options ───────────────────────────────────────
  const ICONS = ["📦","🧱","🪨","🔩","🪟","🚪","💡","🎨","🔧","🪚","🛠️","🪣","🧰","🛁","🚿","🏗️","🪜","📐","📏","🔌"];

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: T.fontBody }}>

      {/* ── PAGE HEADER ─────────────────────────────────────── */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16, marginBottom:24, flexWrap:"wrap" }}>
        <div>
          {/* Breadcrumb */}
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
            <button
              onClick={view === "products" ? backToCategories : undefined}
              style={{
                fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 700,
                color: view === "products" ? cfg.color : T.ink,
                background: "none", border: "none", cursor: view === "products" ? "pointer" : "default",
                padding: 0, letterSpacing: "-0.01em",
                textDecoration: view === "products" ? "underline" : "none",
              }}
            >
              My Products
            </button>
            {view === "products" && selectedCat && (
              <>
                <span style={{ color: T.ink4, fontSize: 18 }}>›</span>
                <span style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 700, color: T.ink }}>
                  {selectedCat.icon} {selectedCat.name}
                </span>
              </>
            )}
          </div>
          <p style={{ fontSize: 13, color: T.ink3, lineHeight: 1.55, maxWidth: 480 }}>
            {view === "categories"
              ? "Create categories first, then add products inside each one."
              : `Products in "${selectedCat?.name}". These appear in the iConstruct app instantly.`
            }
            {" "}<strong style={{ color: cfg.color, fontWeight: 600 }}>
              {cfg.label}: {isUnlimited ? "unlimited products." : `up to ${formatProductLimit(limit)} products total.`}
            </strong>
          </p>
        </div>

        {/* Action button */}
        {view === "categories" ? (
          <button
            onClick={openAddCat}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "10px 20px", borderRadius: T.radiusSm,
              border: "none", cursor: "pointer",
              background: cfg.accentGradient, color: "#fff",
              fontSize: 13, fontWeight: 600, fontFamily: T.fontBody,
              boxShadow: `0 2px 8px ${cfg.color}40`, flexShrink: 0,
            }}
          >
            + Add Category
          </button>
        ) : (
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={backToCategories}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "10px 18px", borderRadius: T.radiusSm,
                border: `1.5px solid ${T.border}`, cursor: "pointer",
                background: T.surface2, color: T.ink2,
                fontSize: 13, fontWeight: 600, fontFamily: T.fontBody,
              }}
            >
              ← Back
            </button>
            <button
              onClick={() => atLimit
                ? showToast("Limit reached — upgrade to add more.", "error")
                : setShowProdModal(true)
              }
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "10px 20px", borderRadius: T.radiusSm,
                border: "none", cursor: atLimit ? "not-allowed" : "pointer",
                background: atLimit ? T.border : cfg.accentGradient,
                color: atLimit ? T.ink3 : "#fff",
                fontSize: 13, fontWeight: 600, fontFamily: T.fontBody,
                opacity: atLimit ? 0.7 : 1, flexShrink: 0,
              }}
            >
              {atLimit ? "Limit Reached" : "+ Add Product"}
            </button>
          </div>
        )}
      </div>

      {/* ── QUOTA BAR ───────────────────────────────────────── */}
      <div style={{
        background: T.surface, borderRadius: T.radius,
        border: `1px solid ${T.border}`, padding: "14px 20px",
        marginBottom: 20, boxShadow: T.shadowSm,
      }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
          <span style={{ fontSize:12, fontWeight:600, color:T.ink2 }}>Total Product Listings</span>
          <span style={{ fontSize:12, fontWeight:700, color:barColor }}>{limitLabel}</span>
        </div>
        <div style={{ height:6, background:T.borderLight, borderRadius:99, overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${pct}%`, background:barColor, borderRadius:99, transition:"width 0.6s ease" }} />
        </div>
        <div style={{ fontSize:11, color:T.ink4, marginTop:6 }}>
          {categories.length} {categories.length === 1 ? "category" : "categories"} · {allProducts.length} total products
        </div>
      </div>

      {/* ── LIMIT BANNER ────────────────────────────────────── */}
      {isAtProductLimit(allProducts.length, limit) && (
        <div style={{
          background: T.amberLight, border: `1px solid #FCD34D`,
          borderRadius: T.radiusSm, padding: "12px 16px", marginBottom: 20,
          fontSize: 12.5, color: "#92400E", lineHeight: 1.6,
          display: "flex", gap: 10, alignItems: "flex-start",
        }}>
          <span style={{ fontSize:16, flexShrink:0 }}>⚠️</span>
          <div>
            <strong>Product limit reached.</strong>{" "}
            Your {cfg.label} plan allows up to {formatProductLimit(limit)} product listings.
            Upgrade your plan to add more.
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          VIEW: CATEGORIES
      ════════════════════════════════════════════════════════ */}
      {view === "categories" && (
        <div>
          {loadingCats ? (
            <div style={{ textAlign:"center", padding:"64px 24px", color:T.ink4 }}>
              <div style={{
                width:28, height:28, border:`3px solid ${T.border}`,
                borderTopColor:cfg.color, borderRadius:"50%",
                animation:"pt-spin 0.8s linear infinite", margin:"0 auto 12px",
              }} />
              <div style={{ fontSize:13 }}>Loading categories...</div>
            </div>
          ) : categories.length === 0 ? (
            <div style={{
              background: T.surface, borderRadius: T.radius,
              border: `2px dashed ${T.border}`, padding: "64px 24px",
              textAlign: "center",
            }}>
              <div style={{ fontSize:40, marginBottom:12 }}>🗂️</div>
              <div style={{ fontFamily:T.fontDisplay, fontSize:16, fontWeight:700, color:T.ink2, marginBottom:6 }}>
                No categories yet
              </div>
              <div style={{ fontSize:13, color:T.ink4, marginBottom:20 }}>
                Create a category (e.g. "Cement", "Tiles", "Hardware") before adding products.
              </div>
              <button
                onClick={openAddCat}
                style={{
                  padding:"10px 24px", borderRadius:T.radiusSm,
                  border:"none", cursor:"pointer",
                  background:cfg.accentGradient, color:"#fff",
                  fontSize:13, fontWeight:600, fontFamily:T.fontBody,
                }}
              >
                + Create First Category
              </button>
            </div>
          ) : (
            <div style={{
              display:"grid",
              gridTemplateColumns:"repeat(auto-fill, minmax(220px, 1fr))",
              gap:16,
            }}>
              {categories.map(cat => {
                const count = countForCat(cat.id);
                return (
                  <div
                    key={cat.id}
                    onClick={() => openCategory(cat)}
                    style={{
                      background: T.surface, borderRadius: T.radius,
                      border: `1.5px solid ${T.border}`, padding: "20px",
                      cursor: "pointer", transition: "all 0.2s",
                      position: "relative",
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = cfg.color;
                      e.currentTarget.style.boxShadow = `0 4px 20px ${cfg.color}20`;
                      e.currentTarget.style.transform = "translateY(-2px)";
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = T.border;
                      e.currentTarget.style.boxShadow = "none";
                      e.currentTarget.style.transform = "none";
                    }}
                  >
                    {/* Icon + name */}
                    <div style={{ fontSize:32, marginBottom:10 }}>{cat.icon || "📦"}</div>
                    <div style={{ fontFamily:T.fontDisplay, fontSize:15, fontWeight:700, color:T.ink, marginBottom:4 }}>
                      {cat.name}
                    </div>
                    {cat.description && (
                      <div style={{ fontSize:12, color:T.ink3, lineHeight:1.5, marginBottom:8 }}>
                        {cat.description}
                      </div>
                    )}

                    {/* Product count badge */}
                    <div style={{
                      display:"inline-flex", alignItems:"center", gap:4,
                      background: count > 0 ? `${cfg.color}15` : T.surface2,
                      border: `1px solid ${count > 0 ? cfg.color + "40" : T.border}`,
                      borderRadius:20, padding:"3px 10px",
                      fontSize:11, fontWeight:600,
                      color: count > 0 ? cfg.color : T.ink4,
                    }}>
                      {count} {count === 1 ? "product" : "products"}
                    </div>

                    {/* Action buttons */}
                    <div style={{
                      position:"absolute", top:12, right:12,
                      display:"flex", gap:4,
                    }}>
                      <button
                        onClick={e => openEditCat(e, cat)}
                        title="Edit category"
                        style={{
                          width:28, height:28, borderRadius:6,
                          border:`1px solid ${T.border}`, background:T.surface2,
                          color:T.ink3, cursor:"pointer", fontSize:13,
                          display:"flex", alignItems:"center", justifyContent:"center",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background=`${cfg.color}15`; e.currentTarget.style.color=cfg.color; }}
                        onMouseLeave={e => { e.currentTarget.style.background=T.surface2; e.currentTarget.style.color=T.ink3; }}
                      >✏️</button>
                      <button
                        onClick={e => handleDeleteCategory(e, cat)}
                        title="Delete category"
                        style={{
                          width:28, height:28, borderRadius:6,
                          border:`1px solid ${T.border}`, background:T.surface2,
                          color:T.ink3, cursor:"pointer", fontSize:13,
                          display:"flex", alignItems:"center", justifyContent:"center",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background=T.redLight; e.currentTarget.style.color=T.red; e.currentTarget.style.borderColor="#FCA5A5"; }}
                        onMouseLeave={e => { e.currentTarget.style.background=T.surface2; e.currentTarget.style.color=T.ink3; e.currentTarget.style.borderColor=T.border; }}
                      >🗑</button>
                    </div>

                    {/* "Open" arrow */}
                    <div style={{
                      position:"absolute", bottom:16, right:16,
                      color:T.ink4, fontSize:16,
                    }}>›</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          VIEW: PRODUCTS (inside a category)
      ════════════════════════════════════════════════════════ */}
      {view === "products" && (
        <div style={{
          background: T.surface, borderRadius: T.radius,
          border: `1px solid ${T.border}`, boxShadow: T.shadowSm,
          overflow: "hidden",
        }}>

          {/* Search row */}
          <div style={{
            padding:"14px 20px", borderBottom:`1px solid ${T.borderLight}`,
            display:"flex", alignItems:"center", gap:12,
          }}>
            <div style={{ position:"relative", flex:1, maxWidth:300 }}>
              <span style={{
                position:"absolute", left:10, top:"50%",
                transform:"translateY(-50%)", color:T.ink4, fontSize:13,
                pointerEvents:"none",
              }}></span>
              <input
                type="text"
                placeholder={`Search in ${selectedCat?.name}...`}
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                style={{ ...inputStyle(cfg.color), paddingLeft:34 }}
                onFocus={e => e.target.style.borderColor = cfg.color}
                onBlur={e  => e.target.style.borderColor = T.border}
              />
            </div>
            <span style={{ fontSize:12, color:T.ink4 }}>
              {filteredProducts.length} {filteredProducts.length === 1 ? "product" : "products"}
            </span>
          </div>

          {/* Products grid */}
          {loadingProds ? (
            <div style={{ textAlign:"center", padding:"64px 24px", color:T.ink4 }}>
              <div style={{
                width:28, height:28, border:`3px solid ${T.border}`,
                borderTopColor:cfg.color, borderRadius:"50%",
                animation:"pt-spin 0.8s linear infinite", margin:"0 auto 12px",
              }} />
              <div style={{ fontSize:13 }}>Loading products...</div>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div style={{ textAlign:"center", padding:"64px 24px", color:T.ink4 }}>
              <div style={{ fontSize:36, marginBottom:12 }}>📦</div>
              <div style={{ fontFamily:T.fontDisplay, fontSize:15, fontWeight:700, color:T.ink2, marginBottom:6 }}>
                {searchQ ? "No products match your search" : "No products in this category"}
              </div>
              <div style={{ fontSize:12, color:T.ink4, marginBottom:16 }}>
                {searchQ
                  ? "Try a different search term."
                  : "Add your first product to make it visible to builders."
                }
              </div>
              {searchQ ? (
                <button
                  onClick={() => setSearchQ("")}
                  style={{
                    padding:"8px 18px", borderRadius:T.radiusSm,
                    border:`1px solid ${T.border}`, background:T.surface2,
                    fontSize:12, fontWeight:500, color:T.ink3,
                    cursor:"pointer", fontFamily:T.fontBody,
                  }}
                >Clear search</button>
              ) : (
                <button
                  onClick={() => setShowProdModal(true)}
                  style={{
                    padding:"10px 24px", borderRadius:T.radiusSm,
                    border:"none", cursor:"pointer",
                    background:cfg.accentGradient, color:"#fff",
                    fontSize:13, fontWeight:600, fontFamily:T.fontBody,
                  }}
                >+ Add First Product</button>
              )}
            </div>
          ) : (
            <div style={{
              display:"grid",
              gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))",
              gap:16, padding:20,
            }}>
              {filteredProducts.map(p => (
                <div
                  key={p.id}
                  style={{
                    background:T.surface, borderRadius:T.radiusSm,
                    border:`1px solid ${T.border}`, overflow:"hidden",
                    display:"flex", flexDirection:"column",
                    transition:"box-shadow 0.2s, transform 0.2s",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.boxShadow = `0 8px 24px ${cfg.color}20`;
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.boxShadow = "none";
                    e.currentTarget.style.transform = "none";
                  }}
                >
                  {/* Image */}
                  {p.imageUrl ? (
                    <img
                      src={p.imageUrl} alt={p.name}
                      style={{ width:"100%", aspectRatio:"4/3", objectFit:"cover", display:"block" }}
                      loading="lazy"
                    />
                  ) : (
                    <div style={{
                      width:"100%", aspectRatio:"4/3",
                      background:T.surface2, display:"flex",
                      alignItems:"center", justifyContent:"center",
                    }}>
                      <span style={{ fontSize:32, opacity:0.25 }}>📦</span>
                    </div>
                  )}

                  {/* Body */}
                  <div style={{ padding:"12px 14px", flex:1, display:"flex", flexDirection:"column", gap:4 }}>
                    <div style={{ fontFamily:T.fontDisplay, fontSize:13.5, fontWeight:700, color:T.ink }}>
                      {p.name}
                    </div>
                    {p.unit && (
                      <div style={{ fontSize:11, color:T.ink3 }}>{p.unit}</div>
                    )}
                    {p.description && (
                      <div style={{ fontSize:11.5, color:T.ink3, lineHeight:1.5, flex:1 }}>
                        {p.description}
                      </div>
                    )}
                    <div style={{ fontFamily:T.fontDisplay, fontSize:16, fontWeight:700, color:T.ink, marginTop:4 }}>
                      {peso(p.price)}
                    </div>
                  </div>

                  {/* Footer */}
                  <div style={{
                    display:"flex", alignItems:"center", gap:8,
                    padding:"10px 14px", borderTop:`1px solid ${T.borderLight}`,
                  }}>
                    <div style={{
                      flex:1, padding:"5px 10px", borderRadius:T.radiusSm,
                      fontSize:11.5, fontWeight:600, textAlign:"center",
                      border:`1px solid ${p.inStock ? T.greenBorder : T.border}`,
                      background:p.inStock ? T.greenLight : T.surface2,
                      color:p.inStock ? "#065F46" : T.ink3,
                    }}>
                      {p.inStock ? "✓ In Stock" : "Out of Stock"}
                    </div>
                    <button
                      onClick={() => handleDeleteProduct(p.id, p.name)}
                      style={{
                        width:30, height:30, borderRadius:T.radiusSm,
                        border:`1px solid ${T.border}`, background:"transparent",
                        color:T.ink4, cursor:"pointer", display:"flex",
                        alignItems:"center", justifyContent:"center", fontSize:13,
                        flexShrink:0,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background=T.redLight; e.currentTarget.style.borderColor="#FCA5A5"; e.currentTarget.style.color=T.red; }}
                      onMouseLeave={e => { e.currentTarget.style.background="transparent"; e.currentTarget.style.borderColor=T.border; e.currentTarget.style.color=T.ink4; }}
                    >🗑</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          MODAL: ADD / EDIT CATEGORY
      ════════════════════════════════════════════════════════ */}
      {showCatModal && (
        <Modal
          title={editCatData ? "Edit Category" : "Add Category"}
          subtitle={editCatData
            ? "Update the name, icon, or description of this category."
            : "Create a category first. You'll add products inside it next."
          }
          accentColor={cfg.accentGradient}
          onClose={() => { setShowCatModal(false); resetCatForm(); }}
        >
          {/* Icon picker */}
          <Field label="Icon">
            <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:4 }}>
              {ICONS.map(icon => (
                <button
                  key={icon}
                  onClick={() => setCatForm(f => ({ ...f, icon }))}
                  style={{
                    width:38, height:38, borderRadius:8, fontSize:18,
                    border:`2px solid ${catForm.icon === icon ? cfg.color : T.border}`,
                    background: catForm.icon === icon ? `${cfg.color}15` : T.surface2,
                    cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
                    transition:"all 0.15s",
                  }}
                >{icon}</button>
              ))}
            </div>
          </Field>

          {/* Name */}
          <Field label="Category Name" required>
            <input
              autoFocus
              style={inputStyle(cfg.color)}
              placeholder="e.g. Cement, Tiles, Hardware"
              value={catForm.name}
              onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))}
              onFocus={e => e.target.style.borderColor = cfg.color}
              onBlur={e  => e.target.style.borderColor = T.border}
            />
          </Field>

          {/* Description */}
          <Field label="Description (optional)">
            <textarea
              rows={2}
              style={{ ...inputStyle(cfg.color), resize:"none" }}
              placeholder="Short description of what's in this category"
              value={catForm.description}
              onChange={e => setCatForm(f => ({ ...f, description: e.target.value }))}
              onFocus={e => e.target.style.borderColor = cfg.color}
              onBlur={e  => e.target.style.borderColor = T.border}
            />
          </Field>

          {/* Actions */}
          <div style={{ display:"flex", gap:10, marginTop:4 }}>
            <button
              onClick={() => { setShowCatModal(false); resetCatForm(); }}
              style={{
                flex:1, padding:"11px", borderRadius:T.radiusSm,
                border:`1px solid ${T.border}`, background:T.surface2,
                color:T.ink3, fontSize:13, fontWeight:500,
                cursor:"pointer", fontFamily:T.fontBody,
              }}
            >Cancel</button>
            <button
              onClick={handleSaveCategory}
              disabled={saving || !catForm.name.trim()}
              style={{
                flex:2, padding:"11px", borderRadius:T.radiusSm,
                border:"none", fontFamily:T.fontBody,
                background: (!catForm.name.trim() || saving) ? T.border : cfg.accentGradient,
                color: (!catForm.name.trim() || saving) ? T.ink3 : "#fff",
                fontSize:13, fontWeight:600,
                cursor: (!catForm.name.trim() || saving) ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Saving..." : editCatData ? "Update Category" : "Create Category"}
            </button>
          </div>
        </Modal>
      )}

      {/* ════════════════════════════════════════════════════════
          MODAL: ADD PRODUCT
      ════════════════════════════════════════════════════════ */}
      {showProdModal && selectedCat && (
        <Modal
          title="Add Product"
          subtitle={`Adding to category: ${selectedCat.icon} ${selectedCat.name}`}
          accentColor={cfg.accentGradient}
          onClose={() => { setShowProdModal(false); resetProdForm(); }}
        >
          {/* Image upload */}
          <Field label="Product Image">
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                border:`2px dashed ${prodForm.imagePreview ? cfg.color : T.border}`,
                borderRadius:T.radiusSm, cursor:"pointer",
                overflow:"hidden", background:T.surface2,
                padding: prodForm.imagePreview ? 0 : "18px 16px",
                textAlign:"center", transition:"border-color 0.15s",
              }}
            >
              {prodForm.imagePreview ? (
                <img
                  src={prodForm.imagePreview} alt="Preview"
                  style={{ width:"100%", maxHeight:160, objectFit:"cover", display:"block" }}
                />
              ) : (
                <>
                  <div style={{ fontSize:22, marginBottom:4 }}>📷</div>
                  <div style={{ fontSize:12, color:T.ink3 }}>Click to upload · PNG, JPG, WEBP</div>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleImageChange} />
          </Field>

          {/* Name + Unit */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <Field label="Product Name" required>
              <input
                autoFocus
                style={inputStyle(cfg.color)}
                placeholder="e.g. Portland Cement"
                value={prodForm.name}
                onChange={e => setProdForm(f => ({ ...f, name: e.target.value }))}
                onFocus={e => e.target.style.borderColor = cfg.color}
                onBlur={e  => e.target.style.borderColor = T.border}
              />
            </Field>
            <Field label="Unit">
              <input
                style={inputStyle(cfg.color)}
                placeholder="e.g. per bag, per sqm"
                value={prodForm.unit}
                onChange={e => setProdForm(f => ({ ...f, unit: e.target.value }))}
                onFocus={e => e.target.style.borderColor = cfg.color}
                onBlur={e  => e.target.style.borderColor = T.border}
              />
            </Field>
          </div>

          {/* Price */}
          <Field label="Price (₱)" required>
            <input
              type="number" min="0"
              style={inputStyle(cfg.color)}
              placeholder="e.g. 280"
              value={prodForm.price}
              onChange={e => setProdForm(f => ({ ...f, price: e.target.value }))}
              onFocus={e => e.target.style.borderColor = cfg.color}
              onBlur={e  => e.target.style.borderColor = T.border}
            />
          </Field>

          {/* Description */}
          <Field label="Description (optional)">
            <textarea
              rows={2}
              style={{ ...inputStyle(cfg.color), resize:"none" }}
              placeholder="Brief description of this product"
              value={prodForm.description}
              onChange={e => setProdForm(f => ({ ...f, description: e.target.value }))}
              onFocus={e => e.target.style.borderColor = cfg.color}
              onBlur={e  => e.target.style.borderColor = T.border}
            />
          </Field>

          {/* Stock status */}
          <Field label="Stock Status">
            <div style={{ display:"flex", gap:8 }}>
              {[true, false].map(val => (
                <button
                  key={String(val)}
                  onClick={() => setProdForm(f => ({ ...f, inStock: val }))}
                  style={{
                    flex:1, padding:"8px 12px", borderRadius:T.radiusSm,
                    fontSize:12.5, fontWeight:600, cursor:"pointer",
                    fontFamily:T.fontBody,
                    border:`1.5px solid ${prodForm.inStock === val ? (val ? T.green : T.red) : T.border}`,
                    background: prodForm.inStock === val ? (val ? T.greenLight : T.redLight) : "transparent",
                    color: prodForm.inStock === val ? (val ? "#065F46" : T.red) : T.ink3,
                    transition:"all 0.15s",
                  }}
                >
                  {val ? "✓ In Stock" : "Out of Stock"}
                </button>
              ))}
            </div>
          </Field>

          {/* Actions */}
          <div style={{ display:"flex", gap:10, marginTop:4 }}>
            <button
              onClick={() => { setShowProdModal(false); resetProdForm(); }}
              style={{
                flex:1, padding:"11px", borderRadius:T.radiusSm,
                border:`1px solid ${T.border}`, background:T.surface2,
                color:T.ink3, fontSize:13, fontWeight:500,
                cursor:"pointer", fontFamily:T.fontBody,
              }}
            >Cancel</button>
            <button
              onClick={handleSaveProduct}
              disabled={uploading || !prodForm.name || !prodForm.price}
              style={{
                flex:2, padding:"11px", borderRadius:T.radiusSm,
                border:"none", fontFamily:T.fontBody,
                background: (!prodForm.name || !prodForm.price || uploading) ? T.border : cfg.accentGradient,
                color: (!prodForm.name || !prodForm.price || uploading) ? T.ink3 : "#fff",
                fontSize:13, fontWeight:600,
                cursor: (!prodForm.name || !prodForm.price || uploading) ? "not-allowed" : "pointer",
              }}
            >
              {uploading ? "Saving..." : "Save Product"}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position:"fixed", bottom:24, right:24,
          padding:"12px 18px", borderRadius:10,
          background: toast.type === "error" ? T.red : T.ink,
          color:"#fff", fontSize:12.5, fontWeight:500,
          boxShadow:"0 10px 30px rgba(0,0,0,0.2)", zIndex:500,
          fontFamily:T.fontBody, maxWidth:300,
        }}>
          {toast.msg}
        </div>
      )}

      {/* Keyframes */}
      <style>{`@keyframes pt-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}