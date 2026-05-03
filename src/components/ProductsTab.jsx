// src/components/ProductsTab.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import { auth, db, storage } from "../services/firebase";
import {
  collection, addDoc, getDocs, deleteDoc,
  doc, query, where, serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  getLivePlanConfig,
  formatProductLimit,
  isAtProductLimit,
} from "../config/planConfig";
import { getMyCategories, addCategory, editCategory, removeCategory } from "../controllers/shopCategoryController";

// ── Phosphor Icons ────────────────────────────────────────────
import {
  PiPackage, PiPackageLight, PiStack, PiTag, PiTrash,
  PiPencilSimple, PiCaretRight, PiCaretLeft, PiPlus,
  PiCamera, PiMagnifyingGlass, PiCheckCircle, PiXCircle,
  PiX, PiSpinner, PiWarning, PiHammer, PiPaintBrush,
  PiLightningA, PiDropHalf, PiWrench, PiHouse, PiGridFour,
  PiShower, PiPlugs, PiWall,
  PiArrowsHorizontal, PiArrowsVertical, PiSealCheck,
} from "react-icons/pi";

// Aliases
const PiGrid4  = PiGridFour;
const PiBricks = PiWall;
const PiFloor  = PiGridFour; // reuse GridFour for floor icon

// ── Project definitions with matching Phosphor icons ─────────
const FIXED_PROJECTS = [
  { id: "kitchen_renovation",      label: "Kitchen Renovation",      Icon: PiHouse },
  { id: "bathroom_renovation",     label: "Bathroom Renovation",     Icon: PiShower },
  { id: "floor_renovation",        label: "Floor Renovation",        Icon: PiGrid4 },
  { id: "interior_painting",       label: "Interior Painting",       Icon: PiPaintBrush },
  { id: "roof_repair",             label: "Roof Repair",             Icon: PiHammer },
  { id: "electrical_installation", label: "Electrical Installation", Icon: PiLightningA },
  { id: "plumbing_installation",   label: "Plumbing Installation",   Icon: PiDropHalf },
];

// ── Category icon picker options ─────────────────────────────
const CAT_ICONS = [
  { key: "PiPackage",        Icon: PiPackage },
  { key: "PiStack",          Icon: PiStack },
  { key: "PiTag",            Icon: PiTag },
  { key: "PiHammer",         Icon: PiHammer },
  { key: "PiPaintBrush",     Icon: PiPaintBrush },
  { key: "PiWrench",         Icon: PiWrench },
  { key: "PiLightningA",     Icon: PiLightningA },
  { key: "PiDropHalf",       Icon: PiDropHalf },
  { key: "PiHouse",          Icon: PiHouse },
  { key: "PiGrid4",          Icon: PiGrid4 },
  { key: "PiShower",         Icon: PiShower },
  { key: "PiPlugs",          Icon: PiPlugs },
  { key: "PiBricks",         Icon: PiBricks },
  { key: "PiArrowsVertical", Icon: PiArrowsVertical },
];

function getCatIcon(key) {
  const found = CAT_ICONS.find(c => c.key === key);
  return found ? found.Icon : PiPackage;
}

const T = {
  fontDisplay : "var(--font-base)",
  fontBody    : "var(--font-base)",
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

const inputStyle = () => ({
  width: "100%", padding: "10px 14px",
  border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm,
  fontSize: 13, fontFamily: T.fontBody, color: T.ink,
  background: T.surface, outline: "none",
  transition: "border-color 0.15s", boxSizing: "border-box",
});

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
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 4,
          background: accentColor, borderRadius: "16px 16px 0 0",
        }} />
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: 14, right: 14,
            width: 30, height: 30, borderRadius: 8,
            border: `1px solid ${T.border}`, background: T.surface2,
            cursor: "pointer", display: "flex", alignItems: "center",
            justifyContent: "center", color: T.ink3,
          }}
        >
          <PiX size={16} />
        </button>
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

function QuotaSkeleton() {
  return (
    <div style={{
      background: T.surface, borderRadius: T.radius,
      border: `1px solid ${T.border}`, padding: "14px 20px",
      marginBottom: 20, boxShadow: T.shadowSm,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ width: 140, height: 14, background: T.borderLight, borderRadius: 6 }} />
        <div style={{ width: 80,  height: 14, background: T.borderLight, borderRadius: 6 }} />
      </div>
      <div style={{ height: 6, background: T.borderLight, borderRadius: 99 }} />
      <div style={{ width: 180, height: 11, background: T.borderLight, borderRadius: 6, marginTop: 8 }} />
    </div>
  );
}

export default function ProductsTab({ plan = "basic" }) {
  const [cfg, setCfg]           = useState(null);
  const [cfgReady, setCfgReady] = useState(false);
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    let cancelled = false;
    getLivePlanConfig(plan).then(liveCfg => {
      if (!cancelled) { setCfg(liveCfg); setCfgReady(true); }
    });
    return () => { cancelled = true; };
  }, [plan]);

  const limit       = cfg?.productLimit ?? Infinity;
  const isUnlimited = limit === Infinity;

  const [view,            setView]            = useState("projects");
  const [selectedProject, setSelectedProject] = useState(null);
  const [categories,      setCategories]      = useState([]);
  const [products,        setProducts]        = useState([]);
  const [allProducts,     setAllProducts]     = useState([]);
  const [loadingCats,     setLoadingCats]     = useState(false);
  const [loadingProds,    setLoadingProds]    = useState(false);
  const [selectedCat,     setSelectedCat]     = useState(null);

  const [showCatModal,  setShowCatModal]  = useState(false);
  const [editCatData,   setEditCatData]   = useState(null);
  const [showProdModal, setShowProdModal] = useState(false);

  const [catForm, setCatForm] = useState({ name: "", description: "", iconKey: "PiPackage" });
  const [prodForm, setProdForm] = useState({
    name: "", unit: "", description: "",
    inStock: true, imageFile: null, imagePreview: null,
    sizes: [], type: "",
  });
  const [sizeInput, setSizeInput] = useState("");
  const [saving,    setSaving]    = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchQ,   setSearchQ]   = useState("");
  const [toast,     setToast]     = useState(null);
  const fileRef = useRef(null);

  const atLimit = cfgReady ? isAtProductLimit(allProducts.length, limit) : false;

  const filteredProducts = products.filter(p => {
    const q = searchQ.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q) ||
      p.unit?.toLowerCase().includes(q)
    );
  });

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchAllProducts = useCallback(async () => {
    if (!uid) return [];
    try {
      const snap = await getDocs(query(collection(db, "products"), where("shopId", "==", uid)));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch { return []; }
  }, [uid]);

  useEffect(() => {
    fetchAllProducts().then(p => setAllProducts(p));
  }, [fetchAllProducts]);

  const fetchCategoriesForProject = useCallback(async (projectId) => {
    if (!uid) return;
    setLoadingCats(true);
    try {
      const snap = await getDocs(
        query(collection(db, "shops", uid, "categories"), where("projectId", "==", projectId))
      );
      const cats = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0));
      setCategories(cats);
    } catch {
      showToast("Could not load categories.", "error");
    } finally {
      setLoadingCats(false);
    }
  }, [uid]);

  const fetchProductsForCategory = useCallback(async (categoryId) => {
    if (!uid) return;
    setLoadingProds(true);
    try {
      const snap = await getDocs(
        query(collection(db, "products"), where("shopId", "==", uid), where("categoryId", "==", categoryId))
      );
      const docs = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
      setProducts(docs);
    } catch {
      showToast("Could not load products.", "error");
    } finally {
      setLoadingProds(false);
    }
  }, [uid]);

  const openProject = (project) => {
    setSelectedProject(project);
    setView("categories");
    setSearchQ("");
    fetchCategoriesForProject(project.id);
  };

  const openCategory = (cat) => {
    setSelectedCat(cat);
    setView("products");
    setSearchQ("");
    fetchProductsForCategory(cat.id);
  };

  const backToProjects = () => {
    setView("projects");
    setSelectedProject(null);
    setCategories([]);
    setSearchQ("");
    fetchAllProducts().then(p => setAllProducts(p));
  };

  const backToCategories = () => {
    setView("categories");
    setSelectedCat(null);
    setProducts([]);
    setSearchQ("");
    fetchCategoriesForProject(selectedProject.id);
    fetchAllProducts().then(p => setAllProducts(p));
  };

  const resetCatForm  = () => setCatForm({ name: "", description: "", iconKey: "PiPackage" });
  const resetProdForm = () => {
    setProdForm({ name: "", unit: "", description: "", inStock: true, imageFile: null, imagePreview: null, sizes: [], type: "" });
    setSizeInput("");
  };

  const openAddCat = () => { setEditCatData(null); resetCatForm(); setShowCatModal(true); };
  const openEditCat = (e, cat) => {
    e.stopPropagation();
    setEditCatData(cat);
    setCatForm({ name: cat.name, description: cat.description || "", iconKey: cat.iconKey || "PiPackage" });
    setShowCatModal(true);
  };

  const handleSaveCategory = async () => {
    if (!catForm.name.trim()) { showToast("Category name is required.", "error"); return; }
    setSaving(true);
    try {
      if (editCatData) {
        await editCategory(editCatData.id, { name: catForm.name, description: catForm.description, iconKey: catForm.iconKey });
        showToast("Category updated.");
      } else {
        await addCategory({ ...catForm, projectId: selectedProject.id });
        showToast("Category created.");
      }
      setShowCatModal(false);
      resetCatForm();
      await fetchCategoriesForProject(selectedProject.id);
    } catch (err) {
      showToast(err.message || "Failed to save category.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (e, cat) => {
    e.stopPropagation();
    const count = allProducts.filter(p => p.categoryId === cat.id).length;
    if (!window.confirm(`Delete "${cat.name}"? ${count > 0 ? `${count} product(s) will be removed.` : ""}`)) return;
    try {
      await removeCategory(cat.id);
      showToast("Category deleted.");
      await fetchCategoriesForProject(selectedProject.id);
      fetchAllProducts().then(p => setAllProducts(p));
    } catch { showToast("Failed to delete category.", "error"); }
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProdForm(f => ({ ...f, imageFile: file, imagePreview: URL.createObjectURL(file) }));
  };

  const handleSaveProduct = async () => {
    if (!prodForm.name) { showToast("Product name is required.", "error"); return; }
    if (cfgReady && isAtProductLimit(allProducts.length, limit)) {
      showToast(`${cfg.label} plan limit reached (${isUnlimited ? "Unlimited" : limit} products).`, "error");
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
        shopId: uid, categoryId: selectedCat.id, category: selectedCat.name,
        projectId: selectedProject.id, projectName: selectedProject.label,
        name: prodForm.name.trim(), unit: prodForm.unit.trim(),
        description: prodForm.description.trim(), inStock: prodForm.inStock,
        sizes: prodForm.sizes, type: prodForm.type, imageUrl,
        createdAt: serverTimestamp(),
      });
      showToast("Product added!");
      setShowProdModal(false);
      resetProdForm();
      await fetchProductsForCategory(selectedCat.id);
      fetchAllProducts().then(p => setAllProducts(p));
    } catch { showToast("Failed to add product.", "error"); }
    finally { setUploading(false); }
  };

  const handleDeleteProduct = async (productId, productName) => {
    if (!window.confirm(`Remove "${productName}"?`)) return;
    try {
      await deleteDoc(doc(db, "products", productId));
      showToast("Product removed.");
      await fetchProductsForCategory(selectedCat.id);
      fetchAllProducts().then(p => setAllProducts(p));
    } catch { showToast("Failed to remove product.", "error"); }
  };

  const countForCat     = (catId)     => allProducts.filter(p => p.categoryId === catId).length;
  const countForProject = (projectId) => allProducts.filter(p => p.projectId  === projectId).length;
  const totalCount = allProducts.length;
  const pct      = !cfgReady ? 0 : isUnlimited ? 100 : Math.min((totalCount / limit) * 100, 100);
  const barColor = !cfgReady ? T.green : isUnlimited ? T.green : pct >= 100 ? T.red : pct >= 75 ? T.amber : T.green;
  const limitLabel = !cfgReady ? "Loading..." : isUnlimited ? `${totalCount} listed · no cap` : `${totalCount} / ${limit} used`;
  const planLabel  = cfgReady
    ? (cfg.label + ": " + (isUnlimited ? "unlimited products." : `up to ${formatProductLimit(limit)} products total.`))
    : "Loading plan limits...";

  const breadcrumb = () => {
    if (view === "projects")   return "My Products";
    if (view === "categories") return `My Products › ${selectedProject?.label}`;
    return `My Products › ${selectedProject?.label} › ${selectedCat?.name}`;
  };

  return (
    <div style={{ fontFamily: T.fontBody }}>

      {/* ── HEADER ──────────────────────────────────────────── */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16, marginBottom:24, flexWrap:"wrap" }}>
        <div>
          <div style={{ fontFamily:T.fontDisplay, fontSize:22, fontWeight:700, color:T.ink, marginBottom:6, display:"flex", alignItems:"center", gap:8 }}>
            <PiPackage size={24} />
            My Products
          </div>
          <div style={{ fontSize:12, color:T.ink4, marginBottom:2 }}>{breadcrumb()}</div>
          <p style={{ fontSize:13, color:T.ink3, lineHeight:1.55, maxWidth:480 }}>
            {view === "projects"   && "Select a project type to manage its categories and products."}
            {view === "categories" && `Categories under ${selectedProject?.label}. Click a category to add products.`}
            {view === "products"   && `Products in "${selectedCat?.name}". Visible to builders in the app instantly.`}
            {" "}<strong style={{ color: cfgReady ? cfg.color : T.ink3 }}>{planLabel}</strong>
          </p>
        </div>

        <div style={{ display:"flex", gap:10 }}>
          {view !== "projects" && (
            <button
              onClick={view === "categories" ? backToProjects : backToCategories}
              style={{
                padding:"10px 18px", borderRadius:T.radiusSm,
                border:`1.5px solid ${T.border}`, cursor:"pointer",
                background:T.surface2, color:T.ink2,
                fontSize:13, fontWeight:600, fontFamily:T.fontBody,
                display:"flex", alignItems:"center", gap:6,
              }}
            >
              <PiCaretLeft size={16} /> Back
            </button>
          )}
          {view === "categories" && (
            <button
              onClick={openAddCat}
              style={{
                padding:"10px 20px", borderRadius:T.radiusSm, border:"none",
                cursor:"pointer", background: cfgReady ? cfg.accentGradient : T.border,
                color:"#fff", fontSize:13, fontWeight:600, fontFamily:T.fontBody,
                display:"flex", alignItems:"center", gap:6,
                boxShadow: cfgReady ? `0 2px 8px ${cfg.color}40` : "none",
              }}
            >
              <PiPlus size={16} /> Add Category
            </button>
          )}
          {view === "products" && (
            <button
              onClick={() => atLimit ? showToast("Limit reached — upgrade your plan.", "error") : setShowProdModal(true)}
              disabled={!cfgReady}
              style={{
                padding:"10px 20px", borderRadius:T.radiusSm, border:"none",
                cursor: (!cfgReady || atLimit) ? "not-allowed" : "pointer",
                background: !cfgReady ? T.border : atLimit ? T.border : cfg.accentGradient,
                color: (!cfgReady || atLimit) ? T.ink3 : "#fff",
                fontSize:13, fontWeight:600, fontFamily:T.fontBody,
                opacity: (!cfgReady || atLimit) ? 0.7 : 1,
                display:"flex", alignItems:"center", gap:6,
              }}
            >
              {!cfgReady
                ? <><PiSpinner size={16} style={{ animation:"pt-spin 0.8s linear infinite" }} /> Loading...</>
                : atLimit
                ? <><PiWarning size={16} /> Limit Reached</>
                : <><PiPlus size={16} /> Add Product</>
              }
            </button>
          )}
        </div>
      </div>

      {/* ── QUOTA BAR ─────────────────────────────────────────── */}
      {!cfgReady ? <QuotaSkeleton /> : (
        <div style={{ background:T.surface, borderRadius:T.radius, border:`1px solid ${T.border}`, padding:"14px 20px", marginBottom:20, boxShadow:T.shadowSm }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
            <span style={{ fontSize:12, fontWeight:600, color:T.ink2, display:"flex", alignItems:"center", gap:6 }}>
              <PiStack size={15} color={T.ink3} /> Total Product Listings
            </span>
            <span style={{ fontSize:12, fontWeight:700, color:barColor }}>{limitLabel}</span>
          </div>
          <div style={{ height:6, background:T.borderLight, borderRadius:99, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${pct}%`, background:barColor, borderRadius:99, transition:"width 0.6s ease" }} />
          </div>
          <div style={{ fontSize:11, color:T.ink4, marginTop:6 }}>
            {totalCount} total products across all projects{!isUnlimited && ` · limit: ${limit}`}
          </div>
        </div>
      )}

      {/* ════ VIEW: PROJECTS ════ */}
      {view === "projects" && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))", gap:16 }}>
          {FIXED_PROJECTS.map(project => {
            const count = countForProject(project.id);
            const ProjectIcon = project.Icon;
            return (
              <div
                key={project.id}
                onClick={() => openProject(project)}
                style={{
                  background:T.surface, borderRadius:T.radius,
                  border:`1.5px solid ${T.border}`, padding:"28px 20px",
                  cursor:"pointer", transition:"all 0.2s", textAlign:"center",
                }}
                onMouseEnter={e => {
                  if (!cfgReady) return;
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
                <div style={{
                  width:60, height:60, borderRadius:"50%",
                  background: cfgReady ? `${cfg.color}15` : T.surface2,
                  border:`1.5px solid ${cfgReady ? cfg.color + "30" : T.border}`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  margin:"0 auto 14px",
                }}>
                  <ProjectIcon size={28} color={cfgReady ? cfg.color : T.ink3} />
                </div>
                <div style={{ fontFamily:T.fontDisplay, fontSize:14, fontWeight:700, color:T.ink, marginBottom:8 }}>
                  {project.label}
                </div>
                <div style={{
                  display:"inline-flex", alignItems:"center", gap:4,
                  background: count > 0 && cfgReady ? `${cfg.color}15` : T.surface2,
                  border:`1px solid ${count > 0 && cfgReady ? cfg.color + "40" : T.border}`,
                  borderRadius:20, padding:"3px 10px",
                  fontSize:11, fontWeight:600,
                  color: count > 0 && cfgReady ? cfg.color : T.ink4,
                }}>
                  <PiPackageLight size={12} />
                  {count} {count === 1 ? "product" : "products"}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ════ VIEW: CATEGORIES ════ */}
      {view === "categories" && (
        <div>
          {loadingCats ? (
            <div style={{ textAlign:"center", padding:"64px 24px", color:T.ink4 }}>
              <PiSpinner size={32} color={cfgReady ? cfg.color : T.ink3} style={{ animation:"pt-spin 0.8s linear infinite", display:"block", margin:"0 auto 12px" }} />
              <div style={{ fontSize:13 }}>Loading categories...</div>
            </div>
          ) : categories.length === 0 ? (
            <div style={{ background:T.surface, borderRadius:T.radius, border:`2px dashed ${T.border}`, padding:"64px 24px", textAlign:"center" }}>
              <div style={{ width:64, height:64, borderRadius:"50%", background:T.surface2, border:`1.5px solid ${T.border}`, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
                <PiStack size={30} color={T.ink4} />
              </div>
              <div style={{ fontFamily:T.fontDisplay, fontSize:16, fontWeight:700, color:T.ink2, marginBottom:6 }}>
                No categories yet for {selectedProject?.label}
              </div>
              <div style={{ fontSize:13, color:T.ink4, marginBottom:20 }}>
                Add a category (e.g. "Tiles", "Paint", "Pipes") to start listing products.
              </div>
              <button
                onClick={openAddCat}
                style={{ padding:"10px 24px", borderRadius:T.radiusSm, border:"none", cursor:"pointer", background: cfgReady ? cfg.accentGradient : T.border, color:"#fff", fontSize:13, fontWeight:600, fontFamily:T.fontBody, display:"inline-flex", alignItems:"center", gap:6 }}
              >
                <PiPlus size={16} /> Create First Category
              </button>
            </div>
          ) : (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(220px, 1fr))", gap:16 }}>
              {categories.map(cat => {
                const count = countForCat(cat.id);
                const CatIcon = getCatIcon(cat.iconKey);
                return (
                  <div
                    key={cat.id}
                    onClick={() => openCategory(cat)}
                    style={{ background:T.surface, borderRadius:T.radius, border:`1.5px solid ${T.border}`, padding:"20px", cursor:"pointer", transition:"all 0.2s", position:"relative" }}
                    onMouseEnter={e => {
                      if (!cfgReady) return;
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
                    <div style={{
                      width:44, height:44, borderRadius:10,
                      background: cfgReady ? `${cfg.color}15` : T.surface2,
                      border:`1.5px solid ${cfgReady ? cfg.color + "30" : T.border}`,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      marginBottom:12,
                    }}>
                      <CatIcon size={22} color={cfgReady ? cfg.color : T.ink3} />
                    </div>
                    <div style={{ fontFamily:T.fontDisplay, fontSize:15, fontWeight:700, color:T.ink, marginBottom:4 }}>{cat.name}</div>
                    {cat.description && <div style={{ fontSize:12, color:T.ink3, lineHeight:1.5, marginBottom:8 }}>{cat.description}</div>}
                    <div style={{ display:"inline-flex", alignItems:"center", gap:4, background:count>0&&cfgReady?`${cfg.color}15`:T.surface2, border:`1px solid ${count>0&&cfgReady?cfg.color+"40":T.border}`, borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:600, color:count>0&&cfgReady?cfg.color:T.ink4 }}>
                      <PiPackageLight size={12} />
                      {count} {count === 1 ? "product" : "products"}
                    </div>
                    <div style={{ position:"absolute", top:12, right:12, display:"flex", gap:4 }}>
                      <button
                        onClick={e => openEditCat(e, cat)}
                        style={{ width:28, height:28, borderRadius:6, border:`1px solid ${T.border}`, background:T.surface2, color:T.ink3, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}
                      ><PiPencilSimple size={14} /></button>
                      <button
                        onClick={e => handleDeleteCategory(e, cat)}
                        style={{ width:28, height:28, borderRadius:6, border:`1px solid ${T.border}`, background:T.surface2, color:T.ink3, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}
                        onMouseEnter={e => { e.currentTarget.style.background=T.redLight; e.currentTarget.style.color=T.red; e.currentTarget.style.borderColor="#FCA5A5"; }}
                        onMouseLeave={e => { e.currentTarget.style.background=T.surface2; e.currentTarget.style.color=T.ink3; e.currentTarget.style.borderColor=T.border; }}
                      ><PiTrash size={14} /></button>
                    </div>
                    <PiCaretRight size={16} color={T.ink4} style={{ position:"absolute", bottom:16, right:16 }} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ════ VIEW: PRODUCTS ════ */}
      {view === "products" && (
        <div style={{ background:T.surface, borderRadius:T.radius, border:`1px solid ${T.border}`, boxShadow:T.shadowSm, overflow:"hidden" }}>
          <div style={{ padding:"14px 20px", borderBottom:`1px solid ${T.borderLight}`, display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ position:"relative", flex:1, maxWidth:300 }}>
              <PiMagnifyingGlass size={15} color={T.ink4} style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)" }} />
              <input
                type="text"
                placeholder={`Search in ${selectedCat?.name}...`}
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                style={{ ...inputStyle(), paddingLeft:32 }}
              />
            </div>
            <span style={{ fontSize:12, color:T.ink4 }}>{filteredProducts.length} products</span>
          </div>

          {loadingProds ? (
            <div style={{ textAlign:"center", padding:"64px 24px", color:T.ink4 }}>
              <PiSpinner size={32} color={cfgReady ? cfg.color : T.ink3} style={{ animation:"pt-spin 0.8s linear infinite", display:"block", margin:"0 auto 12px" }} />
              <div style={{ fontSize:13 }}>Loading products...</div>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div style={{ textAlign:"center", padding:"64px 24px", color:T.ink4 }}>
              <div style={{ width:64, height:64, borderRadius:"50%", background:T.surface2, border:`1.5px solid ${T.border}`, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
                <PiPackage size={30} color={T.ink4} />
              </div>
              <div style={{ fontFamily:T.fontDisplay, fontSize:15, fontWeight:700, color:T.ink2, marginBottom:6 }}>
                {searchQ ? "No products match your search" : "No products yet"}
              </div>
              {!searchQ && (
                <button onClick={() => setShowProdModal(true)} style={{ marginTop:8, padding:"10px 24px", borderRadius:T.radiusSm, border:"none", cursor:"pointer", background: cfgReady ? cfg.accentGradient : T.border, color:"#fff", fontSize:13, fontWeight:600, fontFamily:T.fontBody, display:"inline-flex", alignItems:"center", gap:6 }}>
                  <PiPlus size={16} /> Add First Product
                </button>
              )}
            </div>
          ) : (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))", gap:16, padding:20 }}>
              {filteredProducts.map(p => (
                <div key={p.id}
                  style={{ background:T.surface, borderRadius:T.radiusSm, border:`1px solid ${T.border}`, overflow:"hidden", display:"flex", flexDirection:"column", transition:"box-shadow 0.2s, transform 0.2s" }}
                  onMouseEnter={e => { if (!cfgReady) return; e.currentTarget.style.boxShadow=`0 8px 24px ${cfg.color}20`; e.currentTarget.style.transform="translateY(-2px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow="none"; e.currentTarget.style.transform="none"; }}
                >
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} style={{ width:"100%", aspectRatio:"4/3", objectFit:"cover", display:"block" }} loading="lazy" />
                  ) : (
                    <div style={{ width:"100%", aspectRatio:"4/3", background:T.surface2, display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <PiPackage size={44} color={T.border} />
                    </div>
                  )}
                  <div style={{ padding:"12px 14px", flex:1, display:"flex", flexDirection:"column", gap:4 }}>
                    <div style={{ fontFamily:T.fontDisplay, fontSize:13.5, fontWeight:700, color:T.ink }}>{p.name}</div>
                    {p.unit && (
                      <div style={{ fontSize:11, color:T.ink3, display:"flex", alignItems:"center", gap:4 }}>
                        <PiTag size={11} color={T.ink4} /> {p.unit}
                      </div>
                    )}
                    {p.description && <div style={{ fontSize:11.5, color:T.ink3, lineHeight:1.5, flex:1 }}>{p.description}</div>}
                    {p.type && (
                      <div style={{ marginTop:4 }}>
                        <span style={{ fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:20, background:"#EFF6FF", border:"1px solid #BFDBFE", color:"#1D4ED8", display:"inline-flex", alignItems:"center", gap:4 }}>
                          {p.type === "For Floor"
                            ? <><PiArrowsHorizontal size={11} /> For Floor</>
                            : <><PiArrowsVertical size={11} /> For Wall</>}
                        </span>
                      </div>
                    )}
                    {p.sizes && p.sizes.length > 0 && (
                      <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginTop:4 }}>
                        {p.sizes.map(s => (
                          <span key={s} style={{ fontSize:10, fontWeight:600, padding:"2px 7px", borderRadius:20, background:T.surface2, border:`1px solid ${T.border}`, color:T.ink3 }}>{s}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 14px", borderTop:`1px solid ${T.borderLight}` }}>
                    <div style={{ flex:1, padding:"5px 10px", borderRadius:T.radiusSm, fontSize:11.5, fontWeight:600, textAlign:"center", border:`1px solid ${p.inStock?T.greenBorder:T.border}`, background:p.inStock?T.greenLight:T.surface2, color:p.inStock?"#065F46":T.ink3, display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}>
                      {p.inStock
                        ? <><PiCheckCircle size={14} /> In Stock</>
                        : <><PiXCircle size={14} /> Out of Stock</>}
                    </div>
                    <button
                      onClick={() => handleDeleteProduct(p.id, p.name)}
                      style={{ width:30, height:30, borderRadius:T.radiusSm, border:`1px solid ${T.border}`, background:"transparent", color:T.ink4, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}
                      onMouseEnter={e => { e.currentTarget.style.background=T.redLight; e.currentTarget.style.borderColor="#FCA5A5"; e.currentTarget.style.color=T.red; }}
                      onMouseLeave={e => { e.currentTarget.style.background="transparent"; e.currentTarget.style.borderColor=T.border; e.currentTarget.style.color=T.ink4; }}
                    ><PiTrash size={15} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MODAL: ADD/EDIT CATEGORY ─────────────────────────── */}
      {showCatModal && cfgReady && (
        <Modal
          title={editCatData ? "Edit Category" : "Add Category"}
          subtitle={`For project: ${selectedProject?.label}`}
          accentColor={cfg.accentGradient}
          onClose={() => { setShowCatModal(false); resetCatForm(); }}
        >
          <Field label="Icon">
            <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:4 }}>
              {CAT_ICONS.map(({ key, Icon: IconComp }) => (
                <button
                  key={key}
                  onClick={() => setCatForm(f => ({ ...f, iconKey: key }))}
                  style={{
                    width:40, height:40, borderRadius:8,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    border:`2px solid ${catForm.iconKey===key ? cfg.color : T.border}`,
                    background: catForm.iconKey===key ? `${cfg.color}15` : T.surface2,
                    cursor:"pointer", transition:"all 0.15s",
                  }}
                >
                  <IconComp size={20} color={catForm.iconKey===key ? cfg.color : T.ink3} />
                </button>
              ))}
            </div>
          </Field>
          <Field label="Category Name" required>
            <input autoFocus style={inputStyle()} placeholder="e.g. Tiles, Paint, Pipes" value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="Description (optional)">
            <textarea rows={2} style={{ ...inputStyle(), resize:"none" }} placeholder="Short description" value={catForm.description} onChange={e => setCatForm(f => ({ ...f, description: e.target.value }))} />
          </Field>
          <div style={{ display:"flex", gap:10, marginTop:4 }}>
            <button onClick={() => { setShowCatModal(false); resetCatForm(); }} style={{ flex:1, padding:"11px", borderRadius:T.radiusSm, border:`1px solid ${T.border}`, background:T.surface2, color:T.ink3, fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:T.fontBody }}>Cancel</button>
            <button onClick={handleSaveCategory} disabled={saving || !catForm.name.trim()} style={{ flex:2, padding:"11px", borderRadius:T.radiusSm, border:"none", fontFamily:T.fontBody, background:(!catForm.name.trim()||saving)?T.border:cfg.accentGradient, color:(!catForm.name.trim()||saving)?T.ink3:"#fff", fontSize:13, fontWeight:600, cursor:(!catForm.name.trim()||saving)?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
              {saving ? <><PiSpinner size={15} style={{ animation:"pt-spin 0.8s linear infinite" }} /> Saving...</> : editCatData ? "Update Category" : "Create Category"}
            </button>
          </div>
        </Modal>
      )}

      {/* ── MODAL: ADD PRODUCT ──────────────────────────────── */}
      {showProdModal && selectedCat && cfgReady && (
        <Modal
          title="Add Product"
          subtitle={`${selectedProject?.label} › ${selectedCat?.name}`}
          accentColor={cfg.accentGradient}
          onClose={() => { setShowProdModal(false); resetProdForm(); }}
        >
          <Field label="Product Image">
            <div
              onClick={() => fileRef.current?.click()}
              style={{ border:`2px dashed ${prodForm.imagePreview?cfg.color:T.border}`, borderRadius:T.radiusSm, cursor:"pointer", overflow:"hidden", background:T.surface2, padding:prodForm.imagePreview?0:"28px 16px", textAlign:"center" }}
            >
              {prodForm.imagePreview ? (
                <img src={prodForm.imagePreview} alt="Preview" style={{ width:"100%", maxHeight:160, objectFit:"cover", display:"block" }} />
              ) : (
                <>
                  <PiCamera size={32} color={T.ink4} style={{ display:"block", margin:"0 auto 8px" }} />
                  <div style={{ fontSize:12, color:T.ink3 }}>Click to upload · PNG, JPG, WEBP</div>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleImageChange} />
          </Field>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <Field label="Product Name" required>
              <input autoFocus style={inputStyle()} placeholder="e.g. Portland Cement" value={prodForm.name} onChange={e => setProdForm(f => ({ ...f, name: e.target.value }))} />
            </Field>
            <Field label="Unit">
              <input style={inputStyle()} placeholder="e.g. per bag, per sqm" value={prodForm.unit} onChange={e => setProdForm(f => ({ ...f, unit: e.target.value }))} />
            </Field>
          </div>
          <Field label="Description (optional)">
            <textarea rows={2} style={{ ...inputStyle(), resize:"none" }} placeholder="Brief description" value={prodForm.description} onChange={e => setProdForm(f => ({ ...f, description: e.target.value }))} />
          </Field>
          <Field label="Type / Application (optional)">
            <div style={{ display:"flex", gap:8 }}>
              {["For Floor", "For Wall"].map(option => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setProdForm(f => ({ ...f, type: f.type === option ? "" : option }))}
                  style={{
                    flex:1, padding:"10px 14px", borderRadius:T.radiusSm,
                    fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:T.fontBody,
                    border:`1.5px solid ${prodForm.type===option?(cfgReady?cfg.color:T.ink2):T.border}`,
                    background:prodForm.type===option?(cfgReady?`${cfg.color}15`:T.surface2):T.surface2,
                    color:prodForm.type===option?(cfgReady?cfg.color:T.ink):T.ink3,
                    display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                    transition:"all 0.15s",
                  }}
                >
                  {option === "For Floor"
                    ? <><PiArrowsHorizontal size={16} /> For Floor</>
                    : <><PiArrowsVertical size={16} /> For Wall</>}
                </button>
              ))}
            </div>
            <div style={{ fontSize:11, color:T.ink4, marginTop:6 }}>Click to select. Click again to deselect.</div>
          </Field>
          <Field label="Sizes (optional)">
            <div style={{ display:"flex", gap:8, marginBottom:8 }}>
              <input
                style={{ ...inputStyle(), flex:1 }}
                placeholder="e.g. Small, Medium or 10mm, 12mm"
                value={sizeInput}
                onChange={e => setSizeInput(e.target.value)}
                onKeyDown={e => {
                  if ((e.key === "Enter" || e.key === ",") && sizeInput.trim()) {
                    e.preventDefault();
                    const val = sizeInput.trim().replace(/,$/, "");
                    if (val && !prodForm.sizes.includes(val)) setProdForm(f => ({ ...f, sizes: [...f.sizes, val] }));
                    setSizeInput("");
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const val = sizeInput.trim().replace(/,$/, "");
                  if (val && !prodForm.sizes.includes(val)) setProdForm(f => ({ ...f, sizes: [...f.sizes, val] }));
                  setSizeInput("");
                }}
                style={{ padding:"10px 14px", borderRadius:T.radiusSm, border:"none", background:cfgReady?cfg.accentGradient:T.border, color:"#fff", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:T.fontBody, display:"flex", alignItems:"center", gap:4 }}
              >
                <PiPlus size={15} /> Add
              </button>
            </div>
            {prodForm.sizes.length > 0 && (
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {prodForm.sizes.map(s => (
                  <div key={s} style={{ display:"inline-flex", alignItems:"center", gap:6, background:cfgReady?`${cfg.color}15`:T.surface2, border:`1px solid ${cfgReady?cfg.color+"40":T.border}`, borderRadius:20, padding:"4px 10px", fontSize:12, fontWeight:600, color:cfgReady?cfg.color:T.ink2 }}>
                    {s}
                    <button type="button" onClick={() => setProdForm(f => ({ ...f, sizes: f.sizes.filter(x => x !== s) }))} style={{ background:"none", border:"none", cursor:"pointer", color:"inherit", display:"flex", alignItems:"center", padding:0 }}>
                      <PiX size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ fontSize:11, color:T.ink4, marginTop:4 }}>Press Enter or comma to add. Click × to remove.</div>
          </Field>
          <Field label="Stock Status">
            <div style={{ display:"flex", gap:8 }}>
              {[true, false].map(val => (
                <button
                  key={String(val)}
                  onClick={() => setProdForm(f => ({ ...f, inStock: val }))}
                  style={{ flex:1, padding:"8px 12px", borderRadius:T.radiusSm, fontSize:12.5, fontWeight:600, cursor:"pointer", fontFamily:T.fontBody, border:`1.5px solid ${prodForm.inStock===val?(val?T.green:T.red):T.border}`, background:prodForm.inStock===val?(val?T.greenLight:T.redLight):"transparent", color:prodForm.inStock===val?(val?"#065F46":T.red):T.ink3, display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}
                >
                  {val ? <><PiCheckCircle size={15} /> In Stock</> : <><PiXCircle size={15} /> Out of Stock</>}
                </button>
              ))}
            </div>
          </Field>
          <div style={{ display:"flex", gap:10, marginTop:4 }}>
            <button onClick={() => { setShowProdModal(false); resetProdForm(); }} style={{ flex:1, padding:"11px", borderRadius:T.radiusSm, border:`1px solid ${T.border}`, background:T.surface2, color:T.ink3, fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:T.fontBody }}>Cancel</button>
            <button onClick={handleSaveProduct} disabled={uploading||!prodForm.name} style={{ flex:2, padding:"11px", borderRadius:T.radiusSm, border:"none", fontFamily:T.fontBody, background:(!prodForm.name||uploading)?T.border:cfg.accentGradient, color:(!prodForm.name||uploading)?T.ink3:"#fff", fontSize:13, fontWeight:600, cursor:(!prodForm.name||uploading)?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
              {uploading ? <><PiSpinner size={15} style={{ animation:"pt-spin 0.8s linear infinite" }} /> Saving...</> : "Save Product"}
            </button>
          </div>
        </Modal>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position:"fixed", bottom:24, right:24, padding:"12px 18px", borderRadius:10, background:toast.type==="error"?T.red:T.ink, color:"#fff", fontSize:12.5, fontWeight:500, boxShadow:"0 10px 30px rgba(0,0,0,0.2)", zIndex:500, fontFamily:T.fontBody, maxWidth:300, display:"flex", alignItems:"center", gap:8 }}>
          {toast.type === "error" ? <PiWarning size={16} /> : <PiSealCheck size={16} />}
          {toast.msg}
        </div>
      )}

      <style>{`@keyframes pt-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}