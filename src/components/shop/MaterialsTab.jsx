// src/components/shop/MaterialsTab.jsx
// Complete materials management panel for hardware shops.
// Allows adding, editing, deleting, bulk uploading (CSV/Excel), exporting, filtering, and pagination.

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Package,
  Plus,
  UploadSimple,
  DownloadSimple,
  MagnifyingGlass,
  PencilSimple,
  Trash,
  Check,
  X,
  FileCsv,
  FileXls,
  WarningCircle,
  CheckCircle,
  Funnel,
  CaretLeft,
  CaretRight,
  ArrowsDownUp,
} from "@phosphor-icons/react";
import {
  watchMaterials,
  createMaterial,
  editMaterial,
  removeMaterial,
  importMaterialsFromFile,
  downloadSampleTemplate,
  exportMaterialsToCSV,
} from "../../controllers/materialsController";
import { SUPPLY_CATEGORIES, categoryLabel } from "../../utils/supplyCategories";

const peso = (n) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(n ?? 0);

export default function MaterialsTab({ accentColor = "#2C5282", plan = "basic" }) {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter state
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all"); // "all", "in_stock", "out_of_stock"
  const [sortBy, setSortBy] = useState("name_asc"); // "name_asc", "name_desc", "price_asc", "price_desc", "stock_desc", "newest"

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Add/Edit Form State
  const [formData, setFormData] = useState({
    name: "",
    category: "cement_aggregates",
    unit: "piece",
    size: "",
    price: "",
    stock: "",
    brand: "",
    sku: "",
  });
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Upload State
  const [uploadFile, setUploadFile] = useState(null);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef(null);

  // Toast
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const unsub = watchMaterials(
      (items) => {
        setMaterials(items);
        setLoading(false);
      },
      (err) => {
        console.error("Materials load error:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // Reset pagination to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedCategory, statusFilter, sortBy, itemsPerPage]);

  // Filtered & Sorted materials
  const processedMaterials = useMemo(() => {
    const q = search.trim().toLowerCase();

    // 1. Filter
    const filtered = materials.filter((m) => {
      const matchSearch =
        !q ||
        m.name?.toLowerCase().includes(q) ||
        m.brand?.toLowerCase().includes(q) ||
        m.sku?.toLowerCase().includes(q) ||
        m.size?.toLowerCase().includes(q);

      const matchCat = selectedCategory === "all" || m.category === selectedCategory;

      let matchStatus = true;
      const isOut = m.stock !== null && m.stock !== undefined && m.stock <= 0;
      if (statusFilter === "in_stock") matchStatus = !isOut;
      if (statusFilter === "out_of_stock") matchStatus = isOut;

      return matchSearch && matchCat && matchStatus;
    });

    // 2. Sort
    filtered.sort((a, b) => {
      if (sortBy === "name_asc") return (a.name || "").localeCompare(b.name || "");
      if (sortBy === "name_desc") return (b.name || "").localeCompare(a.name || "");
      if (sortBy === "price_asc") return (Number(a.price) || 0) - (Number(b.price) || 0);
      if (sortBy === "price_desc") return (Number(b.price) || 0) - (Number(a.price) || 0);
      if (sortBy === "stock_desc") return (Number(b.stock) || 0) - (Number(a.stock) || 0);
      if (sortBy === "newest") {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      }
      return 0;
    });

    return filtered;
  }, [materials, search, selectedCategory, statusFilter, sortBy]);

  // Pagination calculation
  const totalItems = processedMaterials.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedMaterials = processedMaterials.slice(startIndex, startIndex + itemsPerPage);

  // Stat summary
  const stats = useMemo(() => {
    const total = materials.length;
    const inStock = materials.filter((m) => m.stock === null || m.stock > 0).length;
    const outOfStock = materials.filter((m) => m.stock !== null && m.stock <= 0).length;
    const avgPrice = total > 0 ? materials.reduce((sum, m) => sum + (Number(m.price) || 0), 0) / total : 0;
    return { total, inStock, outOfStock, avgPrice };
  }, [materials]);

  // Handle open Add Modal
  const openAddModal = () => {
    setEditingItem(null);
    setFormData({
      name: "",
      category: "cement_aggregates",
      unit: "piece",
      size: "",
      price: "",
      stock: "",
      brand: "",
      sku: "",
    });
    setFormError("");
    setShowAddModal(true);
  };

  // Handle open Edit Modal
  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name || "",
      category: item.category || "cement_aggregates",
      unit: item.unit || "piece",
      size: item.size || "",
      price: item.price ?? "",
      stock: item.stock ?? "",
      brand: item.brand || "",
      sku: item.sku || "",
    });
    setFormError("");
    setShowAddModal(true);
  };

  // Submit Add/Edit
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setFormSaving(true);
    try {
      if (editingItem) {
        await editMaterial(editingItem.id, formData);
        showToast("Material updated successfully!");
      } else {
        await createMaterial(formData);
        showToast("Material added to inventory!");
      }
      setShowAddModal(false);
    } catch (err) {
      setFormError(err.message || "Failed to save material.");
    } finally {
      setFormSaving(false);
    }
  };

  // Delete Material
  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete "${name}" from your materials catalog?`)) {
      return;
    }
    try {
      await removeMaterial(id);
      showToast("Material removed.");
    } catch (err) {
      showToast(err.message || "Failed to delete.", "error");
    }
  };

  // Process File Upload
  const handleUploadSubmit = async () => {
    if (!uploadFile) {
      setUploadError("Please select a CSV or Excel file first.");
      return;
    }
    setUploading(true);
    setUploadError("");
    setUploadResult(null);

    try {
      const result = await importMaterialsFromFile(uploadFile, {
        replace: replaceExisting,
      });
      setUploadResult(result);
      showToast(`Successfully imported ${result.importedCount} materials!`);
      setTimeout(() => {
        setShowUploadModal(false);
        setUploadFile(null);
        setUploadResult(null);
      }, 1500);
    } catch (err) {
      setUploadError(err.message || "Upload failed. Please check your file format.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <Package size={24} color={accentColor} weight="duotone" />
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 800, color: "#0F172A", margin: 0 }}>
              Materials Inventory
            </h2>
          </div>
          <p style={{ fontSize: 13, color: "#64748B", margin: 0, lineHeight: 1.5 }}>
            Upload and manage your store's material prices. When builders post project estimates, our{" "}
            <strong style={{ color: "#1D4ED8" }}>Smart Quoting engine</strong> auto-fills your bids with these products!
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={downloadSampleTemplate}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 14px",
              borderRadius: 8,
              border: "1px solid #CBD5E1",
              background: "#fff",
              color: "#334155",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <DownloadSimple size={15} /> Sample Template
          </button>

          <button
            type="button"
            onClick={() => {
              setUploadFile(null);
              setUploadError("");
              setUploadResult(null);
              setShowUploadModal(true);
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 14px",
              borderRadius: 8,
              border: "1px solid #BFDBFE",
              background: "#EFF6FF",
              color: "#1D4ED8",
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <UploadSimple size={15} /> Upload CSV / Excel
          </button>

          <button
            type="button"
            onClick={openAddModal}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 16px",
              borderRadius: 8,
              border: "none",
              background: `linear-gradient(135deg, ${accentColor}, #3B82F6)`,
              color: "#fff",
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(37,99,235,0.25)",
            }}
          >
            <Plus size={16} weight="bold" /> Add Material
          </button>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 20 }}>
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", padding: "14px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
            Total Catalog
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#0F172A", fontFamily: "var(--font-display)" }}>
            {stats.total}
          </div>
          <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>Products configured</div>
        </div>

        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", padding: "14px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#059669", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
            Available / In Stock
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#059669", fontFamily: "var(--font-display)" }}>
            {stats.inStock}
          </div>
          <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>Ready for instant quoting</div>
        </div>

        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", padding: "14px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#D97706", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
            Out of Stock
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: stats.outOfStock > 0 ? "#DC2626" : "#0F172A", fontFamily: "var(--font-display)" }}>
            {stats.outOfStock}
          </div>
          <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>Marked unavailable</div>
        </div>

        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", padding: "14px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#2563EB", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
            Avg. Unit Price
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#2563EB", fontFamily: "var(--font-display)", paddingTop: 4 }}>
            {peso(stats.avgPrice)}
          </div>
          <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>Across all materials</div>
        </div>
      </div>

      {/* ── Search, Smart Filters & Sort Controls ── */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", padding: "14px 18px", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
          {/* Search */}
          <div style={{ position: "relative", flex: "1 1 240px", minWidth: 200 }}>
            <MagnifyingGlass size={16} color="#94A3B8" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by material name, brand, spec, or SKU..."
              style={{
                width: "100%",
                padding: "8px 12px 8px 36px",
                borderRadius: 8,
                border: "1px solid #CBD5E1",
                fontSize: 13,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Filter Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {/* Category Filter */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Funnel size={15} color="#64748B" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{
                  padding: "7px 10px",
                  borderRadius: 7,
                  border: "1px solid #CBD5E1",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "#334155",
                  background: "#fff",
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                <option value="all">All Categories ({materials.length})</option>
                {SUPPLY_CATEGORIES.map((cat) => {
                  const count = materials.filter((m) => m.category === cat.key).length;
                  return (
                    <option key={cat.key} value={cat.key}>
                      {cat.label} ({count})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Stock Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: "7px 10px",
                borderRadius: 7,
                border: "1px solid #CBD5E1",
                fontSize: 12,
                fontWeight: 500,
                color: "#334155",
                background: "#fff",
                outline: "none",
                cursor: "pointer",
              }}
            >
              <option value="all">All Stock Status</option>
              <option value="in_stock">In Stock ({stats.inStock})</option>
              <option value="out_of_stock">Out of Stock ({stats.outOfStock})</option>
            </select>

            {/* Sort By */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <ArrowsDownUp size={15} color="#64748B" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  padding: "7px 10px",
                  borderRadius: 7,
                  border: "1px solid #CBD5E1",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "#334155",
                  background: "#fff",
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                <option value="name_asc">Name (A → Z)</option>
                <option value="name_desc">Name (Z → A)</option>
                <option value="price_asc">Price (Low → High)</option>
                <option value="price_desc">Price (High → Low)</option>
                <option value="stock_desc">Stock (Highest First)</option>
                <option value="newest">Recently Added</option>
              </select>
            </div>

            {/* Export CSV */}
            {materials.length > 0 && (
              <button
                type="button"
                onClick={() => exportMaterialsToCSV(materials)}
                title="Export Catalog to CSV"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "7px 12px",
                  borderRadius: 7,
                  border: "1px solid #E2E8F0",
                  background: "#F8FAFC",
                  color: "#475569",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <DownloadSimple size={14} /> Export CSV
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Materials Table ── */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#94A3B8" }}>
            Loading your materials inventory...
          </div>
        ) : paginatedMaterials.length === 0 ? (
          <div style={{ textAlign: "center", padding: "50px 20px" }}>
            <Package size={48} color="#CBD5E1" weight="duotone" style={{ margin: "0 auto 12px" }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1E293B", marginBottom: 6 }}>
              {materials.length === 0 ? "No materials in your inventory yet" : "No materials match your filters"}
            </div>
            <p style={{ fontSize: 13, color: "#64748B", maxWidth: 440, margin: "0 auto 18px", lineHeight: 1.5 }}>
              {materials.length === 0
                ? "Upload your hardware price list via CSV/Excel or add materials one by one. Once added, projects will auto-match with your stock when quoting!"
                : "Try clearing your search query or adjusting the category and stock filters."}
            </p>
            {materials.length === 0 && (
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button
                  type="button"
                  onClick={() => setShowUploadModal(true)}
                  style={{
                    padding: "9px 18px",
                    borderRadius: 8,
                    border: "none",
                    background: `linear-gradient(135deg, ${accentColor}, #3B82F6)`,
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <UploadSimple size={15} style={{ marginRight: 6, verticalAlign: "middle" }} />
                  Upload CSV / Excel
                </button>
                <button
                  type="button"
                  onClick={openAddModal}
                  style={{
                    padding: "9px 18px",
                    borderRadius: 8,
                    border: "1px solid #CBD5E1",
                    background: "#fff",
                    color: "#334155",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Add Manually
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", color: "#64748B", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  <th style={{ padding: "12px 18px" }}>Material Name &amp; Brand</th>
                  <th style={{ padding: "12px 14px" }}>Category</th>
                  <th style={{ padding: "12px 14px" }}>Unit / Spec</th>
                  <th style={{ padding: "12px 14px", textAlign: "right" }}>Price (₱)</th>
                  <th style={{ padding: "12px 14px", textAlign: "center" }}>Stock</th>
                  <th style={{ padding: "12px 18px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedMaterials.map((mat) => {
                  const isOutOfStock = mat.stock !== null && mat.stock !== undefined && mat.stock <= 0;
                  return (
                    <tr
                      key={mat.id}
                      style={{
                        borderBottom: "1px solid #F1F5F9",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#F8FAFC")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ fontWeight: 700, color: "#0F172A", fontSize: 13.5 }}>
                          {mat.name}
                        </div>
                        <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 2, display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {mat.brand && <span style={{ fontWeight: 600, color: "#2563EB" }}>Brand: {mat.brand}</span>}
                          {mat.sku && <span>SKU: {mat.sku}</span>}
                        </div>
                      </td>

                      <td style={{ padding: "14px 14px" }}>
                        <span style={{
                          display: "inline-block",
                          padding: "3px 8px",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          background: "#F1F5F9",
                          color: "#334155",
                          border: "1px solid #E2E8F0",
                        }}>
                          {categoryLabel(mat.category)}
                        </span>
                      </td>

                      <td style={{ padding: "14px 14px", color: "#475569" }}>
                        <div>{mat.unit || "piece"}</div>
                        {mat.size && <div style={{ fontSize: 11, color: "#94A3B8" }}>{mat.size}</div>}
                      </td>

                      <td style={{ padding: "14px 14px", textAlign: "right", fontWeight: 700, color: "#0F172A", fontSize: 14 }}>
                        {peso(mat.price)}
                      </td>

                      <td style={{ padding: "14px 14px", textAlign: "center" }}>
                        {mat.stock === null || mat.stock === undefined || mat.stock === "" ? (
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#059669", background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 12, padding: "2px 8px" }}>
                            In Stock
                          </span>
                        ) : isOutOfStock ? (
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#DC2626", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "2px 8px" }}>
                            0 (Out)
                          </span>
                        ) : (
                          <span style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}>
                            {mat.stock} {mat.unit || "pcs"}
                          </span>
                        )}
                      </td>

                      <td style={{ padding: "14px 18px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => openEditModal(mat)}
                            title="Edit Material"
                            style={{
                              padding: "6px 8px",
                              borderRadius: 6,
                              border: "1px solid #CBD5E1",
                              background: "#fff",
                              color: "#334155",
                              cursor: "pointer",
                            }}
                          >
                            <PencilSimple size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(mat.id, mat.name)}
                            title="Delete Material"
                            style={{
                              padding: "6px 8px",
                              borderRadius: 6,
                              border: "1px solid #FCA5A5",
                              background: "#FEF2F2",
                              color: "#DC2626",
                              cursor: "pointer",
                            }}
                          >
                            <Trash size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination Controls Bar ── */}
        {totalItems > 0 && (
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 18px",
            borderTop: "1px solid #E2E8F0",
            background: "#F8FAFC",
            flexWrap: "wrap",
            gap: 12,
          }}>
            <div style={{ fontSize: 12, color: "#64748B", display: "flex", alignItems: "center", gap: 8 }}>
              <span>
                Showing <strong>{startIndex + 1}</strong> to <strong>{Math.min(startIndex + itemsPerPage, totalItems)}</strong> of <strong>{totalItems}</strong> materials
              </span>

              <span style={{ color: "#CBD5E1" }}>|</span>

              <label style={{ display: "flex", alignItems: "center", gap: 5, margin: 0 }}>
                <span>Per page:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  style={{
                    padding: "3px 6px",
                    borderRadius: 5,
                    border: "1px solid #CBD5E1",
                    fontSize: 12,
                    background: "#fff",
                    color: "#334155",
                    outline: "none",
                  }}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </label>
            </div>

            {/* Page Buttons */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                style={{
                  padding: "5px 10px",
                  borderRadius: 6,
                  border: "1px solid #CBD5E1",
                  background: currentPage <= 1 ? "#F1F5F9" : "#fff",
                  color: currentPage <= 1 ? "#94A3B8" : "#334155",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: currentPage <= 1 ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <CaretLeft size={13} /> Previous
              </button>

              <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", padding: "0 8px" }}>
                Page {currentPage} of {totalPages}
              </div>

              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                style={{
                  padding: "5px 10px",
                  borderRadius: 6,
                  border: "1px solid #CBD5E1",
                  background: currentPage >= totalPages ? "#F1F5F9" : "#fff",
                  color: currentPage >= totalPages ? "#94A3B8" : "#334155",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: currentPage >= totalPages ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                Next <CaretRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Add / Edit Material Modal ── */}
      {showAddModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddModal(false);
          }}
        >
          <div style={{
            background: "#fff",
            borderRadius: 16,
            width: "100%",
            maxWidth: 520,
            boxShadow: "0 25px 60px rgba(0,0,0,0.25)",
            overflow: "hidden",
          }}>
            <div style={{
              padding: "16px 22px",
              borderBottom: "1px solid #E2E8F0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#F8FAFC",
            }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#0F172A" }}>
                {editingItem ? "Edit Material" : "Add Material to Inventory"}
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", display: "flex" }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} style={{ padding: "20px 22px" }}>
              {formError && (
                <div style={{
                  padding: "9px 12px",
                  borderRadius: 8,
                  background: "#FEF2F2",
                  border: "1px solid #FCA5A5",
                  color: "#B91C1C",
                  fontSize: 12.5,
                  marginBottom: 14,
                }}>
                  {formError}
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                  Material Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Concrete Primer (4 L), Portland Cement, etc."
                  value={formData.name}
                  onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1.5px solid #CBD5E1",
                    fontSize: 13,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData((f) => ({ ...f, category: e.target.value }))}
                    style={{
                      width: "100%",
                      padding: "9px 10px",
                      borderRadius: 8,
                      border: "1.5px solid #CBD5E1",
                      fontSize: 13,
                      outline: "none",
                      boxSizing: "border-box",
                      background: "#fff",
                    }}
                  >
                    {SUPPLY_CATEGORIES.map((c) => (
                      <option key={c.key} value={c.key}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                    Price (₱) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="0.00"
                    value={formData.price}
                    onChange={(e) => setFormData((f) => ({ ...f, price: e.target.value }))}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1.5px solid #CBD5E1",
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#0F172A",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                    Unit
                  </label>
                  <input
                    type="text"
                    placeholder="piece / bag / gallon"
                    value={formData.unit}
                    onChange={(e) => setFormData((f) => ({ ...f, unit: e.target.value }))}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1.5px solid #CBD5E1",
                      fontSize: 13,
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                    Size / Spec
                  </label>
                  <input
                    type="text"
                    placeholder="4 L / 12mm / 4x8"
                    value={formData.size}
                    onChange={(e) => setFormData((f) => ({ ...f, size: e.target.value }))}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1.5px solid #CBD5E1",
                      fontSize: 13,
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                    Stock Qty
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Unlimited"
                    value={formData.stock}
                    onChange={(e) => setFormData((f) => ({ ...f, stock: e.target.value }))}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1.5px solid #CBD5E1",
                      fontSize: 13,
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                    Brand (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Boysen, Davies, Holcim, etc."
                    value={formData.brand}
                    onChange={(e) => setFormData((f) => ({ ...f, brand: e.target.value }))}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1.5px solid #CBD5E1",
                      fontSize: 13,
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                    SKU / Code (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="PRM-001"
                    value={formData.sku}
                    onChange={(e) => setFormData((f) => ({ ...f, sku: e.target.value }))}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1.5px solid #CBD5E1",
                      fontSize: 13,
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    padding: "9px 18px",
                    borderRadius: 8,
                    border: "1px solid #CBD5E1",
                    background: "#F8FAFC",
                    color: "#475569",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSaving}
                  style={{
                    padding: "9px 22px",
                    borderRadius: 8,
                    border: "none",
                    background: formSaving ? "#94A3B8" : `linear-gradient(135deg, ${accentColor}, #3B82F6)`,
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: formSaving ? "wait" : "pointer",
                  }}
                >
                  {formSaving ? "Saving..." : editingItem ? "Update Material" : "Save Material"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Bulk Upload Modal ── */}
      {showUploadModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowUploadModal(false);
          }}
        >
          <div style={{
            background: "#fff",
            borderRadius: 16,
            width: "100%",
            maxWidth: 540,
            boxShadow: "0 25px 60px rgba(0,0,0,0.25)",
            overflow: "hidden",
          }}>
            <div style={{
              padding: "16px 22px",
              borderBottom: "1px solid #E2E8F0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#F8FAFC",
            }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: "#0F172A" }}>
                  Upload Materials Catalog
                </div>
                <div style={{ fontSize: 11.5, color: "#64748B" }}>
                  Supports CSV, XLSX, and XLS spreadsheets
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", display: "flex" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "20px 22px" }}>
              {uploadError && (
                <div style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: "#FEF2F2",
                  border: "1px solid #FCA5A5",
                  color: "#B91C1C",
                  fontSize: 12.5,
                  marginBottom: 16,
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                }}>
                  <WarningCircle size={18} style={{ flexShrink: 0 }} />
                  <div>{uploadError}</div>
                </div>
              )}

              {uploadResult && (
                <div style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: "#ECFDF5",
                  border: "1px solid #6EE7B7",
                  color: "#065F46",
                  fontSize: 12.5,
                  marginBottom: 16,
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                }}>
                  <CheckCircle size={18} style={{ flexShrink: 0 }} />
                  <div>
                    <strong>Successfully imported {uploadResult.importedCount} materials!</strong>
                    {uploadResult.skippedCount > 0 && (
                      <div style={{ fontSize: 11.5, marginTop: 2, color: "#047857" }}>
                        {uploadResult.skippedCount} rows skipped due to invalid prices.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* File Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: "2px dashed #CBD5E1",
                  borderRadius: 12,
                  padding: "28px 20px",
                  textAlign: "center",
                  background: uploadFile ? "#F0FDF4" : "#F8FAFC",
                  borderColor: uploadFile ? "#86EFAC" : "#CBD5E1",
                  cursor: "pointer",
                  marginBottom: 16,
                  transition: "all 0.15s",
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv, .xlsx, .xls"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setUploadFile(f);
                  }}
                  style={{ display: "none" }}
                />

                <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 10 }}>
                  <FileCsv size={32} color="#1D4ED8" weight="duotone" />
                  <FileXls size={32} color="#059669" weight="duotone" />
                </div>

                {uploadFile ? (
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>
                      {uploadFile.name}
                    </div>
                    <div style={{ fontSize: 12, color: "#059669", marginTop: 4 }}>
                      {(uploadFile.size / 1024).toFixed(1)} KB — Ready to import
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>
                      Click to choose CSV or Excel file
                    </div>
                    <div style={{ fontSize: 12, color: "#64748B" }}>
                      Columns: <strong>Name, Category, Unit, Size, Price, Stock, Brand, SKU</strong>
                    </div>
                  </div>
                )}
              </div>

              {/* Options */}
              <div style={{ background: "#F1F5F9", borderRadius: 8, padding: "12px 14px", marginBottom: 20 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#334155", cursor: "pointer", margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={replaceExisting}
                    onChange={(e) => setReplaceExisting(e.target.checked)}
                    style={{ cursor: "pointer" }}
                  />
                  <span>
                    <strong>Replace entire catalog</strong> (deletes current materials before importing)
                  </span>
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={downloadSampleTemplate}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#2563EB",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    padding: 0,
                    textDecoration: "underline",
                  }}
                >
                  Download template CSV
                </button>

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    style={{
                      padding: "9px 16px",
                      borderRadius: 8,
                      border: "1px solid #CBD5E1",
                      background: "#fff",
                      color: "#475569",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleUploadSubmit}
                    disabled={!uploadFile || uploading}
                    style={{
                      padding: "9px 20px",
                      borderRadius: 8,
                      border: "none",
                      background: !uploadFile || uploading ? "#94A3B8" : `linear-gradient(135deg, ${accentColor}, #3B82F6)`,
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: !uploadFile || uploading ? "not-allowed" : "pointer",
                    }}
                  >
                    {uploading ? "Importing..." : "Start Import"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          padding: "12px 18px",
          borderRadius: 10,
          background: toast.type === "error" ? "#DC2626" : "#0F172A",
          color: "#fff",
          fontSize: 13,
          fontWeight: 600,
          boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
          zIndex: 9999,
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
