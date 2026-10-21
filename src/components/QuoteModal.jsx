// src/components/QuoteModal.jsx
import { useState, useEffect, useMemo, useRef } from "react";
import {
  Package,
  CheckCircle,
  MagnifyingGlass,
  ArrowRight,
  Sparkle,
  Storefront,
  X,
  ListPlus,
  Funnel,
  ArrowsLeftRight,
  Info,
  Check,
  Calculator,
  FileText,
  WarningCircle,
  WarningOctagon,
  CaretRight,
  CaretDown,
  TrendUp,
  Buildings,
  MapPin,
  Tag,
  CurrencyCircleDollar,
  CalendarCheck,
  Clock,
  Lock,
} from "@phosphor-icons/react";
import {
  estimateProjectBaseline,
  estimateMaterials,
  referenceUnitPrice,
} from "../utils/recommendationEngine";
import { classifyMaterial, SUPPLY_CATEGORIES, categoryLabel } from "../utils/supplyCategories";
import { getMaterials } from "../controllers/materialsController";
import { smartMatchProjectMaterials, scoreMaterialMatch } from "../utils/materialsMatcher";
import { getBiddingSchedule } from "../utils/biddingSchedule";
import MaterialPhoto from "./ui/MaterialPhoto";

const peso = (n) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(n ?? 0);

function MaterialImage({ accentColor, active, photoKey, name }) {
  const icon = (
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: 8,
        background: active ? accentColor + "15" : "#E4E9F0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <Package size={22} color={active ? accentColor : "#94A3B8"} weight="duotone" />
    </div>
  );
  return <MaterialPhoto photoKey={photoKey} name={name} size={44} fallback={icon} />;
}

const AMBER = "#D97706";

export default function QuoteModal({
  project,
  onClose,
  onSubmit,
  submitting,
  accentColor = "#2C3E50",
  accentGradient = "linear-gradient(180deg, #2C3E50 30%, #648DB6 100%)",
  estimateConfig = null,
  plan = "basic",
  suppliedCategories = [],
  shopMaterials: initialShopMaterials = null,
}) {
  const materials = Array.isArray(project.materials) ? project.materials : [];

  // Hardware shop's uploaded materials
  const [shopMaterials, setShopMaterials] = useState(initialShopMaterials || []);
  const [loadingMaterials, setLoadingMaterials] = useState(!initialShopMaterials);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogCat, setCatalogCat] = useState("all");

  // Track per-card selected project line: { [materialId]: lineIndex }
  const [cardTargetLine, setCardTargetLine] = useState({});

  // Active focused line in the bidding sheet
  const [activeLineIndex, setActiveLineIndex] = useState(0);

  // Mobile Tab toggle: "quote" | "catalog" | "reference"
  const [mobileTab, setMobileTab] = useState("quote");

  // Load shop inventory if not provided via props
  useEffect(() => {
    if (initialShopMaterials) {
      setShopMaterials(initialShopMaterials);
      setLoadingMaterials(false);
      return;
    }
    let isMounted = true;
    getMaterials()
      .then((items) => {
        if (isMounted) {
          setShopMaterials(items || []);
          setLoadingMaterials(false);
        }
      })
      .catch((err) => {
        console.warn("Could not load shop materials for quotation:", err);
        if (isMounted) setLoadingMaterials(false);
      });
    return () => {
      isMounted = false;
    };
  }, [initialShopMaterials]);

  // DPWH baseline calculation
  const projectArea = Number(
    project.totalAreaSqm ?? project.area ?? project.totalArea ?? project.total_area_sqm ?? 0
  );
  const effectiveArea = projectArea > 0 ? projectArea : 12.5;

  const dpwhEstimate = useMemo(() => {
    try {
      return estimateMaterials(effectiveArea, estimateConfig || {});
    } catch {
      return null;
    }
  }, [effectiveArea, estimateConfig]);

  // Authoritative Bidding Schedule calculation
  const biddingSchedule = useMemo(() => getBiddingSchedule(project), [project]);

  const showLineRef = plan === "pro" || plan === "business";
  const showBaselineWarning = plan === "business";
  const refPricing = estimateConfig?.pricing || null;

  // Initialize lines using smart matching against shop's uploaded materials
  const [lines, setLines] = useState(() => {
    const coverage = Array.isArray(suppliedCategories) ? suppliedCategories : [];
    return materials.map((m) => {
      const cat = classifyMaterial(m.name, m.category);
      const outOfCov = coverage.length > 0 && cat !== "other" && !coverage.includes(cat);
      return {
        mode: outOfCov ? "decline" : "quote",
        price: "",
        note: outOfCov ? "Outside our supply categories" : "",
        subName: "",
        qty: m.quantity || 0,
        autoMatched: false,
        matchStatus: "pending",
        matchedProduct: null,
      };
    });
  });

  // When shopMaterials are loaded or updated, run smart matching
  useEffect(() => {
    if (!shopMaterials || shopMaterials.length === 0 || materials.length === 0) return;

    const matchedResults = smartMatchProjectMaterials(materials, shopMaterials, suppliedCategories);

    setLines((prev) =>
      prev.map((existingLine, i) => {
        const match = matchedResults[i];
        if (!match) return existingLine;

        // If the shop user already edited this line manually with a price, preserve their input
        if (existingLine.price !== "" && existingLine.price !== 0 && !existingLine.autoMatched) {
          return existingLine;
        }

        // Direct in-stock match
        if (match.autoMatched && match.mode === "quote") {
          return {
            ...existingLine,
            mode: "quote",
            price: match.price,
            qty: match.qty,
            note: match.note || existingLine.note,
            autoMatched: true,
            matchStatus: "direct_match",
            matchedProduct: match.matchedProduct,
          };
        }

        // Item is carried by shop BUT OUT OF STOCK (0 in stock)
        if (match.matchStatus === "out_of_stock") {
          return {
            ...existingLine,
            mode: "decline",
            price: "",
            note: match.note || "Out of stock in store inventory (0 available)",
            autoMatched: false,
            matchStatus: "out_of_stock",
            matchedProduct: match.matchedProduct,
          };
        }

        // Unavailable in store inventory
        return {
          ...existingLine,
          mode: "decline",
          price: "",
          note: match.note || "Not currently in store inventory",
          autoMatched: false,
          matchStatus: match.matchStatus || "unavailable",
          suggestedSubName: match.suggestedSubName || "",
          suggestedPrice: match.suggestedPrice || "",
          matchedProduct: match.matchedProduct,
        };
      })
    );

    // Smart default target line for each catalog card
    const targetMap = {};
    shopMaterials.forEach((item) => {
      let bestIdx = 0;
      let highestScore = 0;
      materials.forEach((m, idx) => {
        const score = scoreMaterialMatch(m, item);
        if (score > highestScore) {
          highestScore = score;
          bestIdx = idx;
        }
      });
      targetMap[item.id] = highestScore >= 0.5 ? bestIdx : 0;
    });
    setCardTargetLine(targetMap);
  }, [shopMaterials]);

  const [note, setNote] = useState("");

  const patchLine = (index, patch) =>
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  const setMode = (index, mode) => patchLine(index, { mode });
  const setPrice = (index, val) =>
    patchLine(index, { price: val === "" ? "" : Math.max(0, parseFloat(val) || 0), autoMatched: false });
  const setLineNote = (index, val) => patchLine(index, { note: val });
  const setSubName = (index, val) => patchLine(index, { subName: val });
  const setQty = (index, val, requestedQty) => {
    if (val === "") return patchLine(index, { qty: "" });
    const n = Math.max(1, Math.min(Math.round(Number(val) || 0), requestedQty));
    patchLine(index, { qty: n });
  };

  /**
   * Action: Apply a store product from the left catalog directly to a selected project line.
   * - mode "quote": fills price, sets mode to Quote, and marks as store product.
   * - mode "substitute": automatically switches to Substitute, fills substitute name & price!
   */
  const applyCatalogItemToLine = (catalogItem, targetIndex, targetMode = "quote") => {
    const idx = targetIndex ?? activeLineIndex;
    if (idx < 0 || idx >= materials.length) return;

    const originalMaterial = materials[idx];
    const subLabel = `${catalogItem.name}${catalogItem.brand ? " (" + catalogItem.brand + ")" : ""}${
      catalogItem.size ? " · " + catalogItem.size : ""
    }`;

    if (targetMode === "substitute") {
      patchLine(idx, {
        mode: "substitute",
        subName: subLabel,
        price: Number(catalogItem.price) || 0,
        note: `Store substitute for ${originalMaterial?.name || "requested item"}`,
        autoMatched: false,
        matchedProduct: catalogItem,
      });
    } else {
      const requestedQty = Number(originalMaterial.quantity) || 1;
      const availableStock =
        catalogItem.stock !== null && catalogItem.stock !== undefined ? Number(catalogItem.stock) : null;
      let fillQty = requestedQty;
      let isPartial = false;
      if (availableStock !== null && availableStock < requestedQty) {
        fillQty = availableStock > 0 ? availableStock : requestedQty;
        isPartial = availableStock > 0;
      }

      patchLine(idx, {
        mode: "quote",
        subName: "",
        qty: fillQty,
        price: Number(catalogItem.price) || 0,
        note: isPartial
          ? `Partial stock (${fillQty} of ${requestedQty} available in store)`
          : `In store stock: ${catalogItem.name}`,
        autoMatched: true,
        matchedProduct: catalogItem,
      });
    }

    setActiveLineIndex(idx);
    const element = document.getElementById(`quote-bid-line-${idx}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  // Filtered catalog materials on left side
  const filteredCatalog = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    return shopMaterials.filter((m) => {
      const matchSearch =
        !q ||
        m.name?.toLowerCase().includes(q) ||
        m.brand?.toLowerCase().includes(q) ||
        m.size?.toLowerCase().includes(q) ||
        m.sku?.toLowerCase().includes(q);
      const matchCat = catalogCat === "all" || m.category === catalogCat;
      return matchSearch && matchCat;
    });
  }, [shopMaterials, catalogSearch, catalogCat]);

  const rows = materials.map((m, i) => {
    const l = lines[i] || { mode: "quote", price: "", note: "", subName: "", qty: m.quantity || 0 };
    const requestedQty = m.quantity || 0;
    const qty = l.qty === "" ? "" : l.qty ?? requestedQty;
    const qtyNum = Number(qty) || 0;
    const priceNum = Number(l.price) || 0;
    const priced = l.mode === "quote" || l.mode === "substitute";
    const partial = priced && qtyNum > 0 && qtyNum < requestedQty;

    // Customer / DPWH reference unit price for this line
    const ref = refPricing ? referenceUnitPrice(m.name, m.category, refPricing) : null;
    const customerOriginalPrice = m.price || m.estimatedPrice || m.targetPrice || ref?.price || null;

    return {
      index: i,
      mode: l.mode,
      note: l.note,
      subName: l.subName || "",
      qty: qtyNum,
      qtyRaw: qty,
      requestedQty,
      partial,
      priceRaw: l.price,
      price: priceNum,
      subtotal: priced ? qtyNum * priceNum : 0,
      productName: m.name,
      unit: m.unit || "piece",
      size: m.size || "",
      category: m.category || "",
      autoMatched: l.autoMatched,
      matchedProduct: l.matchedProduct,
      matchStatus: l.matchStatus,
      suggestedSubName: l.suggestedSubName,
      suggestedPrice: l.suggestedPrice,
      customerOriginalPrice,
      ref,
    };
  });

  const quotedRows = rows.filter((r) => r.mode === "quote");
  const subRows = rows.filter((r) => r.mode === "substitute");
  const declineRows = rows.filter((r) => r.mode === "decline");

  const quotedPriced = quotedRows.filter((r) => r.price > 0 && r.qty > 0);
  const subValid = subRows.filter((r) => r.subName.trim() && r.price > 0 && r.qty > 0);

  const missingQuotePrice = quotedRows.length - quotedPriced.length;
  const missingSubInfo = subRows.length - subValid.length;
  const incomplete = missingQuotePrice + missingSubInfo;

  const supplyRows = [...quotedPriced, ...subValid];
  const total = supplyRows.reduce((sum, r) => sum + r.subtotal, 0);
  const partialCount = supplyRows.filter((r) => r.partial).length;

  // Enforce bidding schedule: quotation submission is strictly disabled when scheduled or closed
  const canSubmit = !submitting && supplyRows.length > 0 && incomplete === 0 && biddingSchedule.isOpen;

  const autoMatchedCount = rows.filter((r) => r.autoMatched && r.price > 0).length;
  const outOfStockCount = rows.filter((r) => r.matchStatus === "out_of_stock").length;

  // Handle submit with accurate stock deduction
  const handleSubmit = async () => {
    if (!canSubmit) return;

    // Stock is NOT deducted here: a quote is only an offer. The server
    // deducts the sold quantities once the shop confirms the final offer.

    // 2. Prepare items payload
    const items = rows.map((r) => {
      const base = {
        unit: r.unit,
        size: r.size,
        category: r.category,
        lineNote: (r.note || "").trim(),
        requestedName: r.productName,
        customerQty: r.requestedQty,
        // Inventory item this line sells from (lets the server deduct it on a confirmed sale).
        ...(r.mode !== "decline" && r.matchedProduct?.id ? { materialId: r.matchedProduct.id } : {}),
      };
      if (r.mode === "decline") {
        return {
          ...base,
          productName: r.productName,
          status: "declined",
          qty: r.requestedQty,
          price: 0,
          subtotal: 0,
        };
      }
      const partialFields = r.partial ? { requestedQty: r.requestedQty } : {};
      if (r.mode === "substitute") {
        return {
          ...base,
          ...partialFields,
          productName: r.subName.trim() || r.productName,
          status: "substituted",
          qty: r.qty,
          price: r.price,
          subtotal: r.subtotal,
        };
      }
      return {
        ...base,
        ...partialFields,
        productName: r.productName,
        status: "quoted",
        qty: r.qty,
        price: r.price,
        subtotal: r.subtotal,
      };
    });

    onSubmit({
      projectId: project.id,
      amount: total,
      note,
      items,
      quotedCount: quotedRows.length,
      substitutedCount: subRows.length,
      declinedCount: declineRows.length,
    });
  };

  const infoPills = [
    { label: "Bidding", value: biddingSchedule.statusLabel },
    biddingSchedule.isOpen && { label: "Time Left", value: biddingSchedule.remainingFormatted },
    biddingSchedule.closesAt && { label: "Deadline", value: biddingSchedule.closeDateOnly },
    project.totalAreaSqm != null && { label: "Area", value: `${project.totalAreaSqm} sqm` },
    dpwhEstimate && { label: "DPWH est.", value: peso(dpwhEstimate.materialsTotal) },
    project.quotationCount != null && { label: "Bids so far", value: project.quotationCount },
    project.budget && { label: "Budget", value: project.budget },
    project.locationCity && { label: "Location", value: project.locationCity },
  ].filter(Boolean);

  const btnLabel = submitting
    ? "Submitting Quote & Decreasing Stock..."
    : biddingSchedule.isScheduled
    ? `Bidding Not Open (Opens ${biddingSchedule.openDateOnly})`
    : biddingSchedule.isClosed
    ? `Bidding Closed (Submission Rejected)`
    : incomplete > 0
    ? `Finish ${incomplete} more line${incomplete > 1 ? "s" : ""}`
    : supplyRows.length > 0
    ? `Submit Quote — ${peso(total)}`
    : "Price or substitute at least 1 item";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.68)",
        backdropFilter: "blur(6px)",
        zIndex: 400,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "12px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 18,
          width: "98vw",
          maxWidth: 1380,
          height: "94vh",
          maxHeight: 930,
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 32px 80px rgba(0,0,0,0.32)",
          overflow: "hidden",
        }}
      >
        {/* ── Top Header ── */}
        <div style={{ background: accentGradient, padding: "14px 22px", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div>
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: "rgba(237,228,212,0.75)",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  marginBottom: 3,
                }}
              >
                Submit Quotation · Smart Matching &amp; DPWH Estimation
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 2 }}>
                {project.projectName || "Project"}
              </div>
              <div style={{ fontSize: 12, color: "rgba(237,228,212,0.85)" }}>
                {project.projectType || "General Construction"}
                {materials.length > 0 && ` · ${materials.length} material lines requested`}
                {project.locationCity && ` · ${project.locationCity}`}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: "rgba(255,255,255,0.15)",
                border: "none",
                borderRadius: 8,
                color: "#fff",
                width: 32,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <X size={18} />
            </button>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 8,
              marginTop: 10,
            }}
          >
            {infoPills.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {infoPills.map((pill) => (
                  <div
                    key={pill.label}
                    style={{
                      background: "rgba(255,255,255,0.15)",
                      border: "1px solid rgba(255,255,255,0.22)",
                      borderRadius: 16,
                      padding: "3px 10px",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 600,
                        color: "rgba(237,228,212,0.75)",
                        textTransform: "uppercase",
                      }}
                    >
                      {pill.label}
                    </span>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "#fff" }}>{pill.value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Smart Status Badges */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {outOfStockCount > 0 && (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    background: "rgba(239, 68, 68, 0.25)",
                    border: "1px solid rgba(239, 68, 68, 0.5)",
                    borderRadius: 20,
                    padding: "3px 10px",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#FCA5A5",
                  }}
                >
                  <WarningOctagon size={13} color="#FCA5A5" weight="fill" />
                  <span>{outOfStockCount} Out of Stock in Shop</span>
                </div>
              )}

              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background:
                    autoMatchedCount === materials.length && materials.length > 0
                      ? "linear-gradient(135deg, rgba(16, 185, 129, 0.45), rgba(5, 150, 105, 0.5))"
                      : autoMatchedCount > 0
                      ? "rgba(16, 185, 129, 0.3)"
                      : "rgba(255,255,255,0.15)",
                  border:
                    autoMatchedCount === materials.length && materials.length > 0
                      ? "1.5px solid #34D399"
                      : autoMatchedCount > 0
                      ? "1.5px solid rgba(16, 185, 129, 0.6)"
                      : "1px solid rgba(255,255,255,0.25)",
                  borderRadius: 20,
                  padding: "4px 14px",
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#fff",
                  boxShadow: autoMatchedCount > 0 ? "0 2px 8px rgba(0,0,0,0.15)" : "none",
                }}
              >
                <Sparkle size={14} color={autoMatchedCount > 0 ? "#6EE7B7" : "#FCD34D"} weight="fill" />
                <span>
                  {autoMatchedCount > 0
                    ? autoMatchedCount === materials.length
                      ? `100% Store Match · All ${materials.length} items auto-filled`
                      : `${Math.round((autoMatchedCount / materials.length) * 100)}% Store Match · ${autoMatchedCount} of ${materials.length} items auto-filled`
                    : shopMaterials.length > 0
                    ? `0% Store Match (0 of ${materials.length} items in store)`
                    : "No store materials uploaded yet"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Bidding Schedule Alert Banner ── */}
        {biddingSchedule.isScheduled && (
          <div
            style={{
              background: "#FEF3C7",
              borderBottom: "1px solid #FCD34D",
              padding: "9px 22px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              color: "#92400E",
              fontWeight: 600,
            }}
          >
            <WarningCircle size={16} color="#D97706" weight="bold" />
            <span>
              <strong>Bidding Not Open Yet:</strong> Quotation submission opens on{" "}
              <strong>{biddingSchedule.openFormatted}</strong>. You can review requirements and pre-fill your materials, but submitting is locked until bidding opens.
            </span>
          </div>
        )}

        {biddingSchedule.isClosed && (
          <div
            style={{
              background: "#FEE2E2",
              borderBottom: "1px solid #FCA5A5",
              padding: "9px 22px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              color: "#991B1B",
              fontWeight: 600,
            }}
          >
            <WarningOctagon size={16} color="#DC2626" weight="bold" />
            <span>
              <strong>Bidding Is Closed:</strong> The quotation deadline ended on{" "}
              <strong>{biddingSchedule.closeFormatted}</strong>. Late quotations are rejected automatically according to iConstruct platform policy.
            </span>
          </div>
        )}

        {/* ── Mobile/Tablet Tab Selector (< 992px) ── */}
        <div
          className="quote-mobile-nav"
          style={{ display: "none", borderBottom: "1px solid #E2E8F0", background: "#F8FAFC" }}
        >
          <button
            type="button"
            onClick={() => setMobileTab("catalog")}
            style={{
              flex: 1,
              padding: "10px",
              border: "none",
              borderBottom: mobileTab === "catalog" ? `2.5px solid ${accentColor}` : "none",
              background: "transparent",
              color: mobileTab === "catalog" ? accentColor : "#64748B",
              fontWeight: 700,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Store Catalog ({shopMaterials.length})
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("quote")}
            style={{
              flex: 1,
              padding: "10px",
              border: "none",
              borderBottom: mobileTab === "quote" ? `2.5px solid ${accentColor}` : "none",
              background: "transparent",
              color: mobileTab === "quote" ? accentColor : "#64748B",
              fontWeight: 700,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Quotation Form ({quotedPriced.length}/{materials.length})
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("reference")}
            style={{
              flex: 1,
              padding: "10px",
              border: "none",
              borderBottom: mobileTab === "reference" ? `2.5px solid ${accentColor}` : "none",
              background: "transparent",
              color: mobileTab === "reference" ? accentColor : "#64748B",
              fontWeight: 700,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            DPWH &amp; Specs
          </button>
        </div>

        {/* ── 3-Column Split Body ── */}
        <div
          style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}
          className="quote-split-container"
        >
          {/* ═════════════════════════════════════════════════════════
              COLUMN 1 (LEFT): Hardware Store Materials Inventory
             ═════════════════════════════════════════════════════════ */}
          <div
            className={`quote-left-catalog ${mobileTab !== "catalog" ? "quote-col-hide-mobile" : ""}`}
            style={{
              width: 340,
              borderRight: "1.5px solid #E2E8F0",
              background: "#F8FAFC",
              display: "flex",
              flexDirection: "column",
              flexShrink: 0,
            }}
          >
            {/* Catalog Header & Filters */}
            <div style={{ padding: "12px 14px", borderBottom: "1px solid #E2E8F0", background: "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Storefront size={16} color={accentColor} weight="bold" />
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>Your Store Materials</span>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#64748B",
                    background: "#F1F5F9",
                    padding: "2px 8px",
                    borderRadius: 12,
                  }}
                >
                  {shopMaterials.length} items
                </span>
              </div>

              {/* Quick Search & Category Filter */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ position: "relative" }}>
                  <MagnifyingGlass
                    size={13}
                    color="#94A3B8"
                    style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}
                  />
                  <input
                    type="text"
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder="Search store inventory..."
                    style={{
                      width: "100%",
                      padding: "6px 10px 6px 28px",
                      borderRadius: 6,
                      border: "1px solid #CBD5E1",
                      fontSize: 11.5,
                      outline: "none",
                      boxSizing: "border-box",
                      background: "#F8FAFC",
                    }}
                  />
                </div>

                <select
                  value={catalogCat}
                  onChange={(e) => setCatalogCat(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "5px 8px",
                    borderRadius: 6,
                    border: "1px solid #CBD5E1",
                    fontSize: 11,
                    color: "#334155",
                    background: "#F8FAFC",
                    outline: "none",
                  }}
                >
                  <option value="all">All Categories</option>
                  {SUPPLY_CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Catalog Items Scrollable List */}
            <div style={{ flex: 1, overflowY: "auto", padding: "10px" }}>
              {loadingMaterials ? (
                <div style={{ textAlign: "center", padding: "30px 10px", color: "#94A3B8", fontSize: 12 }}>
                  Loading store materials...
                </div>
              ) : shopMaterials.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 16px", color: "#64748B" }}>
                  <Package size={36} color="#CBD5E1" weight="duotone" style={{ margin: "0 auto 8px" }} />
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>
                    No materials uploaded yet
                  </div>
                  <div style={{ fontSize: 11.5, lineHeight: 1.5, color: "#64748B" }}>
                    Upload your store price list via CSV or Excel in the <strong>Materials</strong> tab of your
                    dashboard!
                  </div>
                </div>
              ) : filteredCatalog.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px 10px", color: "#94A3B8", fontSize: 12 }}>
                  No store materials match "{catalogSearch}"
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {filteredCatalog.map((item) => {
                    const isOutOfStock = item.stock !== null && item.stock !== undefined && Number(item.stock) <= 0;
                    // Target line selected for this specific card
                    const selectedLine = cardTargetLine[item.id] ?? 0;
                    const isTargetQuoted =
                      rows[selectedLine]?.mode === "quote" && rows[selectedLine]?.matchedProduct?.id === item.id;
                    const isTargetSub =
                      rows[selectedLine]?.mode === "substitute" &&
                      rows[selectedLine]?.subName?.includes(item.name);

                    return (
                      <div
                        key={item.id}
                        style={{
                          background: isOutOfStock ? "#FEF2F2" : "#fff",
                          border: isOutOfStock
                            ? "1.5px solid #FCA5A5"
                            : isTargetQuoted
                            ? "1.5px solid #86EFAC"
                            : "1px solid #E2E8F0",
                          borderRadius: 9,
                          padding: "10px 11px",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                        }}
                      >
                        {/* Title, Brand, Unit & Price */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#0F172A", lineHeight: 1.3 }}>
                              {item.name}
                            </div>
                            <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                              {item.brand && <span style={{ color: "#2563EB", fontWeight: 600 }}>{item.brand} · </span>}
                              {item.size && <span>{item.size} · </span>}
                              <span>{item.unit || "piece"}</span>
                            </div>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>
                              {peso(item.price)}
                            </div>
                            {item.stock !== null && item.stock !== undefined && (
                              <div
                                style={{
                                  fontSize: 10,
                                  color: item.stock > 0 ? "#059669" : "#DC2626",
                                  fontWeight: 700,
                                }}
                              >
                                {item.stock > 0 ? `${item.stock} in stock` : "OUT OF STOCK"}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Per-Card Dynamic Line Dropdown: Line 1..N based on project materials */}
                        <div style={{ marginTop: 8, paddingTop: 6, borderTop: "1px dashed #E2E8F0" }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              marginBottom: 4,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 9.5,
                                fontWeight: 700,
                                color: "#1E40AF",
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                              }}
                            >
                              Apply to Project Line:
                            </span>
                            <span style={{ fontSize: 9.5, color: "#64748B" }}>
                              {materials.length} lines total
                            </span>
                          </div>

                          <select
                            value={selectedLine}
                            onChange={(e) =>
                              setCardTargetLine((prev) => ({
                                ...prev,
                                [item.id]: Number(e.target.value),
                              }))
                            }
                            style={{
                              width: "100%",
                              padding: "4px 7px",
                              borderRadius: 5,
                              border: "1px solid #BFDBFE",
                              fontSize: 11,
                              fontWeight: 700,
                              color: "#1E3A8A",
                              background: "#EFF6FF",
                              outline: "none",
                              cursor: "pointer",
                            }}
                          >
                            {materials.map((m, idx) => (
                              <option key={idx} value={idx}>
                                #{idx + 1}: {m.name} ({m.quantity || 1} {m.unit || "pcs"})
                              </option>
                            ))}
                          </select>

                          {/* Direct Actions: Apply Quote vs Substitute on the selected line */}
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr",
                              gap: 5,
                              marginTop: 6,
                            }}
                          >
                            <button
                              type="button"
                              title={
                                isOutOfStock
                                  ? "Item is out of stock in your store inventory"
                                  : `Apply ${item.name} as direct quote on Line #${selectedLine + 1}`
                              }
                              onClick={() => {
                                applyCatalogItemToLine(item, selectedLine, "quote");
                                if (window.innerWidth < 992) setMobileTab("quote");
                              }}
                              style={{
                                padding: "5px 6px",
                                fontSize: 10,
                                fontWeight: 700,
                                borderRadius: 5,
                                border: isOutOfStock
                                  ? "1px solid #FCA5A5"
                                  : `1px solid ${isTargetQuoted ? "#2563EB" : "#BFDBFE"}`,
                                background: isOutOfStock
                                  ? "#FEE2E2"
                                  : isTargetQuoted
                                  ? "#2563EB"
                                  : "#EFF6FF",
                                color: isOutOfStock ? "#DC2626" : isTargetQuoted ? "#fff" : "#1D4ED8",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 3,
                              }}
                            >
                              <Check size={11} weight="bold" /> Quote #{selectedLine + 1}
                            </button>

                            <button
                              type="button"
                              title={`Offer ${item.name} as substitute on Line #${selectedLine + 1}`}
                              onClick={() => {
                                applyCatalogItemToLine(item, selectedLine, "substitute");
                                if (window.innerWidth < 992) setMobileTab("quote");
                              }}
                              style={{
                                padding: "5px 6px",
                                fontSize: 10,
                                fontWeight: 700,
                                borderRadius: 5,
                                border: `1px solid ${isTargetSub ? AMBER : "#FCD34D"}`,
                                background: isTargetSub ? AMBER : "#FEF3C7",
                                color: isTargetSub ? "#fff" : "#B45309",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 3,
                              }}
                            >
                              <ArrowsLeftRight size={11} weight="bold" /> Sub #{selectedLine + 1}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ═════════════════════════════════════════════════════════
              COLUMN 2 (MIDDLE): Project Bidding & Quotation Sheet
             ═════════════════════════════════════════════════════════ */}
          <div
            className={`quote-middle-bidding ${mobileTab !== "quote" ? "quote-col-hide-mobile" : ""}`}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              minWidth: 0,
              background: "#fff",
              borderRight: "1.5px solid #E2E8F0",
            }}
          >
            {/* Scrollable Items Form */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "#94A3B8",
                    }}
                  >
                    Bidding Sheet — Interactive Quotation Form
                  </div>
                  <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
                    In-stock store items are <strong style={{ color: "#059669" }}>auto-quoted</strong>. Out of
                    stock or non-carried items are marked{" "}
                    <strong style={{ color: "#DC2626" }}>Unavailable</strong> unless substituted.
                  </div>
                </div>
              </div>

              {materials.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 0", color: "#94A3B8", fontSize: 13 }}>
                  No items listed in this project.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
                  {rows.map((r) => {
                    const m = materials[r.index];
                    const isQuote = r.mode === "quote";
                    const isSub = r.mode === "substitute";
                    const isDecl = r.mode === "decline";
                    const active = (isQuote || isSub) && r.price > 0;
                    const isSelected = activeLineIndex === r.index;
                    const isOutOfStock = r.matchStatus === "out_of_stock";

                    const ref =
                      showLineRef && refPricing && !isDecl
                        ? referenceUnitPrice(m.name, r.category, refPricing)
                        : null;
                    const refDiffPct =
                      ref && r.price > 0 ? Math.round(((r.price - ref.price) / ref.price) * 100) : null;

                    const borderColor = isSelected
                      ? "#2563EB"
                      : isOutOfStock
                      ? "#F87171"
                      : isDecl
                      ? "#FCA5A5"
                      : isSub
                      ? "#FCD34D"
                      : active
                      ? accentColor + "50"
                      : "#E2E8F0";

                    const bgColor = isOutOfStock
                      ? "#FEF2F2"
                      : isDecl
                      ? "#FEF2F2"
                      : isSub
                      ? "#FFFBEB"
                      : active
                      ? accentColor + "08"
                      : "#F8FAFC";

                    const seg = (label, mode, on, onColor) => (
                      <button
                        type="button"
                        onClick={() => {
                          setMode(r.index, mode);
                          setActiveLineIndex(r.index);
                        }}
                        style={{
                          padding: "6px 12px",
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer",
                          border: "none",
                          borderLeft: label !== "Quote" ? "1px solid #E4E9F0" : "none",
                          background: on ? onColor : "#fff",
                          color: on ? "#fff" : "#64748B",
                          transition: "all 0.15s",
                        }}
                      >
                        {label}
                      </button>
                    );

                    return (
                      <div
                        key={r.index}
                        id={`quote-bid-line-${r.index}`}
                        onClick={() => setActiveLineIndex(r.index)}
                        style={{
                          border: `1.5px solid ${borderColor}`,
                          borderRadius: 12,
                          padding: "12px 14px",
                          background: bgColor,
                          boxShadow: isSelected ? "0 4px 14px rgba(37,99,235,0.08)" : "none",
                          transition: "all 0.15s",
                          cursor: "pointer",
                          position: "relative",
                        }}
                      >
                        {/* ── Original Customer Request Header ── */}
                        <div
                          style={{
                            background: "rgba(15, 23, 42, 0.04)",
                            border: "1px solid rgba(15, 23, 42, 0.08)",
                            borderRadius: 8,
                            padding: "8px 12px",
                            marginBottom: 10,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: 6,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 800,
                                background: "#0F172A",
                                color: "#fff",
                                borderRadius: 4,
                                padding: "2px 5px",
                              }}
                            >
                              LINE #{r.index + 1}
                            </span>
                            <span
                              style={{
                                fontSize: 10.5,
                                fontWeight: 700,
                                color: "#475569",
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                              }}
                            >
                              Customer's Requested Item:
                            </span>
                            <span style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>
                              {m.name}
                            </span>
                          </div>

                          <div style={{ fontSize: 11, color: "#64748B", display: "flex", gap: 10, flexWrap: "wrap" }}>
                            <span>
                              Needed: <strong style={{ color: "#0F172A" }}>{r.requestedQty} {r.unit}</strong>
                            </span>
                            {m.size && (
                              <span>
                                Spec: <strong style={{ color: "#0F172A" }}>{m.size}</strong>
                              </span>
                            )}
                            {r.customerOriginalPrice && (
                              <span style={{ color: "#2563EB", fontWeight: 700 }}>
                                Baseline: {peso(r.customerOriginalPrice)}/{r.unit}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Row 1: Status Badges & Mode Toggle */}
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <MaterialImage
                            accentColor={accentColor}
                            active={active}
                            photoKey={m.photoKey}
                            name={m.name}
                          />

                          <div style={{ flex: "1 1 180px", minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              {/* Status Badges */}
                              {r.autoMatched && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 800,
                                    color: "#059669",
                                    background: "#ECFDF5",
                                    border: "1px solid #A7F3D0",
                                    borderRadius: 5,
                                    padding: "2px 8px",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                  }}
                                >
                                  <Check size={11} weight="bold" /> AUTO-MATCHED IN STORE (₱{r.price})
                                </span>
                              )}

                              {isOutOfStock && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 800,
                                    color: "#DC2626",
                                    background: "#FEE2E2",
                                    border: "1px solid #FCA5A5",
                                    borderRadius: 5,
                                    padding: "2px 8px",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                  }}
                                >
                                  <WarningCircle size={11} weight="bold" /> OUT OF STOCK IN STORE (0 in stock)
                                </span>
                              )}

                              {isSub && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 800,
                                    color: AMBER,
                                    background: "#FEF3C7",
                                    border: "1px solid #FCD34D",
                                    borderRadius: 5,
                                    padding: "2px 8px",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                  }}
                                >
                                  <ArrowsLeftRight size={11} weight="bold" /> SUBSTITUTION OFFER
                                </span>
                              )}

                              {isDecl && !isOutOfStock && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 800,
                                    color: "#DC2626",
                                    background: "#FEE2E2",
                                    border: "1px solid #FCA5A5",
                                    borderRadius: 5,
                                    padding: "2px 8px",
                                  }}
                                >
                                  UNAVAILABLE (NOT IN STORE)
                                </span>
                              )}

                              {r.partial && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 800,
                                    color: "#1D4ED8",
                                    background: "#EFF6FF",
                                    border: "1px solid #BFDBFE",
                                    borderRadius: 5,
                                    padding: "2px 8px",
                                  }}
                                >
                                  PARTIAL STOCK ({r.qty} of {r.requestedQty})
                                </span>
                              )}
                            </div>

                            <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 4 }}>
                              {isSub ? (
                                <span>
                                  Offering substitute:{" "}
                                  <strong style={{ color: AMBER }}>
                                    {r.subName || "(Select store substitute from left catalog)"}
                                  </strong>
                                </span>
                              ) : isOutOfStock ? (
                                <span style={{ color: "#DC2626", fontWeight: 600 }}>
                                  Store currently has 0 stock of this item. Select a substitute product or leave
                                  unavailable.
                                </span>
                              ) : isDecl ? (
                                <span style={{ color: "#B91C1C" }}>
                                  Not carried in store inventory. Customer will source elsewhere unless substituted.
                                </span>
                              ) : (
                                <span>
                                  Supplying exact store stock:{" "}
                                  <strong style={{ color: "#0F172A" }}>
                                    {r.matchedProduct?.name || m.name}
                                  </strong>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Toggle: Quote / Substitute / Unavailable */}
                          <div
                            style={{
                              display: "flex",
                              borderRadius: 8,
                              overflow: "hidden",
                              border: "1px solid #CBD5E1",
                              flexShrink: 0,
                            }}
                          >
                            {seg("Quote", "quote", isQuote, accentColor)}
                            {seg("Substitute", "substitute", isSub, AMBER)}
                            {seg("Unavailable", "decline", isDecl, "#DC2626")}
                          </div>
                        </div>

                        {/* Substitution input fields if in substitute mode */}
                        {isSub && (
                          <div
                            style={{
                              marginTop: 10,
                              padding: "10px 12px",
                              background: "#FFFBEB",
                              border: "1px solid #FDE68A",
                              borderRadius: 8,
                            }}
                          >
                            <label
                              style={{
                                display: "block",
                                fontSize: 10.5,
                                fontWeight: 800,
                                color: AMBER,
                                textTransform: "uppercase",
                                marginBottom: 4,
                              }}
                            >
                              Substitute Product Name &amp; Specifications (What your shop carries instead) *
                            </label>
                            <input
                              value={r.subName}
                              onChange={(e) => setSubName(r.index, e.target.value)}
                              placeholder="e.g. Union Galvasteel Yero (0.4mm rib type) / Deformed Bar 10mm (SteelAsia)"
                              style={{
                                width: "100%",
                                padding: "8px 10px",
                                border: `1.5px solid ${r.subName.trim() ? "#FCD34D" : "#CBD5E1"}`,
                                borderRadius: 7,
                                fontSize: 12.5,
                                fontWeight: 700,
                                outline: "none",
                                color: "#92400E",
                                background: "#fff",
                                boxSizing: "border-box",
                              }}
                            />
                            <div style={{ fontSize: 10.5, color: "#B45309", marginTop: 4 }}>
                              Tip: Click [Sub #{r.index + 1}] on any product in the left catalog to instantly
                              fill this substitute with its price!
                            </div>
                          </div>
                        )}

                        {/* Row 2: QTY, PRICE, SUBTOTAL */}
                        {(isQuote || isSub) && (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "flex-end",
                              gap: 16,
                              flexWrap: "wrap",
                              marginTop: 10,
                              paddingTop: 10,
                              borderTop: "1px dashed #E2E8F0",
                            }}
                          >
                            <div style={{ display: "flex", flexDirection: "column", gap: 3, flexShrink: 0 }}>
                              <label
                                style={{
                                  fontSize: 9.5,
                                  fontWeight: 700,
                                  color: "#64748B",
                                  textTransform: "uppercase",
                                }}
                              >
                                QTY YOU CAN SUPPLY
                              </label>
                              <input
                                type="number"
                                min="1"
                                max={r.requestedQty}
                                value={r.qtyRaw === "" ? "" : r.qty || ""}
                                placeholder={String(r.requestedQty)}
                                onChange={(e) => setQty(r.index, e.target.value, r.requestedQty)}
                                style={{
                                  width: 84,
                                  padding: "6px 8px",
                                  border: `1.5px solid ${r.partial ? "#1D4ED8" : "#CBD5E1"}`,
                                  borderRadius: 7,
                                  fontSize: 13,
                                  fontWeight: 700,
                                  textAlign: "center",
                                  outline: "none",
                                  color: "#0F172A",
                                  background: "#fff",
                                }}
                              />
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: 3, flexShrink: 0 }}>
                              <label
                                style={{
                                  fontSize: 9.5,
                                  fontWeight: 700,
                                  color: "#64748B",
                                  textTransform: "uppercase",
                                }}
                              >
                                YOUR PRICE (₱ / {r.unit})
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={r.priceRaw === "" ? "" : r.price || ""}
                                placeholder="0.00"
                                onChange={(e) => setPrice(r.index, e.target.value)}
                                style={{
                                  width: 110,
                                  padding: "6px 8px",
                                  border: `1.5px solid ${active ? (isSub ? AMBER : accentColor) : "#CBD5E1"}`,
                                  borderRadius: 7,
                                  fontSize: 13,
                                  fontWeight: 700,
                                  textAlign: "center",
                                  outline: "none",
                                  color: "#0F172A",
                                  background: "#fff",
                                }}
                              />
                            </div>

                            <div style={{ minWidth: 90, textAlign: "right", flexShrink: 0, marginLeft: "auto" }}>
                              <div
                                style={{
                                  fontSize: 9.5,
                                  fontWeight: 700,
                                  color: "#64748B",
                                  textTransform: "uppercase",
                                  marginBottom: 3,
                                }}
                              >
                                SUBTOTAL
                              </div>
                              <div
                                style={{
                                  fontSize: 15,
                                  fontWeight: 800,
                                  color: active ? (isSub ? AMBER : accentColor) : "#94A3B8",
                                }}
                              >
                                {active ? peso(r.subtotal) : "—"}
                              </div>
                            </div>

                            {r.partial && (
                              <div style={{ flexBasis: "100%", fontSize: 11, color: "#1D4ED8", fontWeight: 600 }}>
                                Customer will see {r.qty} of {r.requestedQty} {r.unit} fulfilled.
                              </div>
                            )}
                          </div>
                        )}

                        {/* DPWH reference price */}
                        {ref && (
                          <div style={{ fontSize: 11, color: "#64748B", marginTop: 8 }}>
                            DPWH reference baseline: <strong>{peso(ref.price)}/{ref.unit}</strong>
                            {refDiffPct != null && (
                              <span
                                style={{
                                  marginLeft: 6,
                                  fontWeight: 700,
                                  color: refDiffPct > 10 ? "#B45309" : refDiffPct < -10 ? "#1D4ED8" : "#059669",
                                }}
                              >
                                · {refDiffPct > 0 ? `${refDiffPct}% above` : refDiffPct < 0 ? `${Math.abs(refDiffPct)}% below` : "equal to"} reference
                              </span>
                            )}
                          </div>
                        )}

                        {/* Line note / reason */}
                        <input
                          value={r.note}
                          onChange={(e) => setLineNote(r.index, e.target.value)}
                          placeholder={
                            isDecl
                              ? "Reason for unavailability (e.g. out of stock / not carried in store)"
                              : isSub
                              ? "Reason for substitution (e.g. equivalent brand, thicker spec, same warranty)"
                              : "Note for this item (e.g. brand, batch, lead time)"
                          }
                          style={{
                            width: "100%",
                            marginTop: 8,
                            padding: "6px 10px",
                            border: "1px solid #E2E8F0",
                            borderRadius: 7,
                            fontSize: 11.5,
                            outline: "none",
                            color: "#334155",
                            background: "#fff",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Quote Summary Box */}
              {(quotedPriced.length > 0 || subValid.length > 0 || declineRows.length > 0) && (
                <div
                  style={{
                    background: "#F8FAFC",
                    borderRadius: 10,
                    border: "1px solid #E2E8F0",
                    padding: "14px 16px",
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#64748B",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      marginBottom: 10,
                    }}
                  >
                    Quote Summary — {quotedPriced.length} Quoted
                    {subValid.length > 0 ? ` · ${subValid.length} Substituted` : ""}
                    {declineRows.length > 0 ? ` · ${declineRows.length} Unavailable` : ""}
                    {partialCount > 0 ? ` · ${partialCount} Partial` : ""}
                  </div>

                  {quotedPriced.map((item, i) => (
                    <div
                      key={`q${i}`}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 12,
                        marginBottom: 5,
                        color: "#334155",
                      }}
                    >
                      <span>
                        {item.productName} × {item.qty} {item.unit}
                        {item.partial && (
                          <span style={{ color: "#1D4ED8", fontWeight: 600 }}>
                            {" "}
                            (of {item.requestedQty} needed)
                          </span>
                        )}
                      </span>
                      <span style={{ fontWeight: 600 }}>{peso(item.subtotal)}</span>
                    </div>
                  ))}

                  {subValid.map((item, i) => (
                    <div
                      key={`s${i}`}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 12,
                        marginBottom: 5,
                        color: "#92400E",
                      }}
                    >
                      <span>
                        {item.subName.trim()}{" "}
                        <span style={{ color: "#B45309" }}>(substitute for {item.productName})</span> ×{" "}
                        {item.qty}
                      </span>
                      <span style={{ fontWeight: 600 }}>{peso(item.subtotal)}</span>
                    </div>
                  ))}

                  {declineRows.map((item, i) => (
                    <div
                      key={`d${i}`}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 12,
                        marginBottom: 5,
                        color: "#B91C1C",
                      }}
                    >
                      <span>
                        {item.productName}
                        {item.note ? ` (${item.note})` : ""}
                      </span>
                      <span style={{ fontWeight: 600 }}>Unavailable</span>
                    </div>
                  ))}

                  <div
                    style={{
                      borderTop: "1px solid #E2E8F0",
                      marginTop: 8,
                      paddingTop: 8,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>
                      Total Quoted Amount
                    </span>
                    <span style={{ fontSize: 18, fontWeight: 900, color: accentColor }}>
                      {peso(total)}
                    </span>
                  </div>
                </div>
              )}

              {/* Baseline check for Business tier */}
              {showBaselineWarning && dpwhEstimate && total > 0 && (() => {
                const base = dpwhEstimate.materialsTotal || 0;
                const diffPct = base > 0 ? Math.round(((total - base) / base) * 100) : 0;
                const high = diffPct > 10;
                const low = diffPct < -10;
                const c = high
                  ? { bg: "#FEF3C7", bd: "#FCD34D", fg: "#92400E" }
                  : low
                  ? { bg: "#EFF6FF", bd: "#BFDBFE", fg: "#1D4ED8" }
                  : { bg: "#ECFDF5", bd: "#6EE7B7", fg: "#065F46" };
                return (
                  <div
                    style={{
                      fontSize: 12,
                      color: c.fg,
                      background: c.bg,
                      border: `1px solid ${c.bd}`,
                      borderRadius: 8,
                      padding: "9px 12px",
                      marginBottom: 12,
                      lineHeight: 1.5,
                    }}
                  >
                    {high
                      ? `Your quote is ${diffPct}% above the DPWH baseline of ${peso(base)}.`
                      : low
                      ? `Your quote is ${Math.abs(diffPct)}% below the DPWH baseline of ${peso(base)}.`
                      : `Your quote aligns with the DPWH baseline (${peso(base)}).`}{" "}
                    DPWH estimates are for planning reference.
                  </div>
                );
              })()}

              {incomplete > 0 && (
                <div
                  style={{
                    fontSize: 12,
                    color: "#B45309",
                    background: "#FEF3C7",
                    border: "1px solid #FCD34D",
                    borderRadius: 8,
                    padding: "9px 12px",
                    marginBottom: 12,
                  }}
                >
                  {missingQuotePrice > 0 && (
                    <div>
                      {missingQuotePrice} item{missingQuotePrice > 1 ? "s" : ""} set to{" "}
                      <strong>Quote</strong> without a price.
                    </div>
                  )}
                  {missingSubInfo > 0 && (
                    <div>
                      {missingSubInfo} <strong>Substitute</strong> line
                      {missingSubInfo > 1 ? "s" : ""} missing the item name or price.
                    </div>
                  )}
                </div>
              )}

              {/* Overall Note */}
              <div style={{ marginBottom: 4 }}>
                <label
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: "#334155",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Overall note to the builder (optional)
                </label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Delivery terms, lead time, store pickup address, payment conditions..."
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1.5px solid #CBD5E1",
                    borderRadius: 8,
                    fontSize: 12,
                    resize: "none",
                    outline: "none",
                    color: "#0F172A",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            {/* Bottom Footer Action Bar */}
            <div
              style={{
                padding: "12px 20px",
                borderTop: "1px solid #E2E8F0",
                display: "flex",
                gap: 10,
                alignItems: "center",
                background: "#FAFAF8",
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: "10px 18px",
                  borderRadius: 8,
                  border: "1px solid #CBD5E1",
                  background: "#fff",
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: "#64748B",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canSubmit}
                onClick={handleSubmit}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: 8,
                  border: "none",
                  background: canSubmit ? accentGradient : "#E2E8F0",
                  color: canSubmit ? "#fff" : "#94A3B8",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: canSubmit ? "pointer" : "not-allowed",
                  transition: "all 0.15s",
                }}
              >
                {btnLabel}
              </button>
            </div>
          </div>

          {/* ═════════════════════════════════════════════════════════
              COLUMN 3 (RIGHT): Customer Original Project Reference
                                & DPWH Planning Estimate Breakdown
             ═════════════════════════════════════════════════════════ */}
          <div
            className={`quote-right-reference ${mobileTab !== "reference" ? "quote-col-hide-mobile" : ""}`}
            style={{
              width: 340,
              background: "#F8FAFC",
              display: "flex",
              flexDirection: "column",
              flexShrink: 0,
              overflowY: "auto",
            }}
          >
            {/* Right Column Header */}
            <div
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid #E2E8F0",
                background: "#fff",
                position: "sticky",
                top: 0,
                zIndex: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
                <Calculator size={17} color={accentColor} weight="bold" />
                <span style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>
                  DPWH Planning &amp; Original Ref
                </span>
              </div>
              <div style={{ fontSize: 11, color: "#64748B" }}>
                Official government benchmarks &amp; original client specs
              </div>
            </div>

            <div style={{ padding: "14px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Card 0: Bidding Schedule & Period */}
              <div
                style={{
                  background: "#fff",
                  border: `1.5px solid ${
                    biddingSchedule.isOpen ? "#86EFAC" : biddingSchedule.isScheduled ? "#FCD34D" : "#CBD5E1"
                  }`,
                  borderRadius: 10,
                  padding: "12px 14px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: biddingSchedule.isOpen ? "#166534" : biddingSchedule.isScheduled ? "#92400E" : "#475569",
                    marginBottom: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <CalendarCheck size={15} color={biddingSchedule.isOpen ? "#166534" : "#64748B"} />
                    Bidding Period
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      borderRadius: 4,
                      padding: "2px 6px",
                      background: biddingSchedule.isOpen
                        ? "#DCFCE7"
                        : biddingSchedule.isScheduled
                        ? "#FEF3C7"
                        : "#F1F5F9",
                      color: biddingSchedule.isOpen
                        ? "#166534"
                        : biddingSchedule.isScheduled
                        ? "#92400E"
                        : "#64748B",
                    }}
                  >
                    {biddingSchedule.statusLabel}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 11.5 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748B" }}>Opening:</span>
                    <strong style={{ color: "#0F172A" }}>{biddingSchedule.openFormatted}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748B" }}>Deadline:</span>
                    <strong style={{ color: biddingSchedule.isClosed ? "#DC2626" : "#0F172A" }}>
                      {biddingSchedule.closeFormatted}
                    </strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748B" }}>Remaining:</span>
                    <strong style={{ color: biddingSchedule.isOpen ? "#059669" : "#64748B" }}>
                      {biddingSchedule.remainingFormatted}
                    </strong>
                  </div>

                  {biddingSchedule.deadlineChange && (
                    <div
                      style={{
                        marginTop: 6,
                        padding: "6px 8px",
                        background: "#FFFBEB",
                        border: "1px solid #FCD34D",
                        borderRadius: 6,
                        fontSize: 10.5,
                        color: "#92400E",
                      }}
                    >
                      <strong>Deadline Notice:</strong> Homeowner changed deadline to{" "}
                      <strong>{biddingSchedule.deadlineChange.newFormatted}</strong> (was{" "}
                      {biddingSchedule.deadlineChange.previousFormatted}).
                      {biddingSchedule.deadlineChange.reason && (
                        <div>Reason: <em>"{biddingSchedule.deadlineChange.reason}"</em></div>
                      )}
                    </div>
                  )}

                  <div style={{ marginTop: 6, fontSize: 9.5, color: "#94A3B8", lineHeight: 1.4 }}>
                    Late quotations are rejected automatically. Quotations submitted within the valid window remain preserved for review.
                  </div>
                </div>
              </div>

              {/* Card 1: Project Scope Summary */}
              <div
                style={{
                  background: "#fff",
                  border: "1px solid #E2E8F0",
                  borderRadius: 10,
                  padding: "12px 14px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                }}
              >
                <div
                  style={{
                    fontSize: 10.5,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "#475569",
                    marginBottom: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <Buildings size={14} color="#64748B" /> Project Stated Scope
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11.5 }}>
                  <div style={{ background: "#F8FAFC", padding: "6px 8px", borderRadius: 6 }}>
                    <div style={{ fontSize: 9.5, color: "#64748B", textTransform: "uppercase" }}>Floor Area</div>
                    <div style={{ fontWeight: 800, color: "#0F172A", marginTop: 2 }}>
                      {effectiveArea} m² {projectArea <= 0 ? "(std. baseline)" : ""}
                    </div>
                  </div>

                  <div style={{ background: "#F8FAFC", padding: "6px 8px", borderRadius: 6 }}>
                    <div style={{ fontSize: 9.5, color: "#64748B", textTransform: "uppercase" }}>Category</div>
                    <div style={{ fontWeight: 800, color: "#0F172A", marginTop: 2 }}>
                      {project.projectType || "Residential"}
                    </div>
                  </div>

                  <div style={{ background: "#F8FAFC", padding: "6px 8px", borderRadius: 6 }}>
                    <div style={{ fontSize: 9.5, color: "#64748B", textTransform: "uppercase" }}>Budget Tier</div>
                    <div style={{ fontWeight: 800, color: "#0F172A", marginTop: 2 }}>
                      {project.budget || "Market Rate"}
                    </div>
                  </div>

                  <div style={{ background: "#F8FAFC", padding: "6px 8px", borderRadius: 6 }}>
                    <div style={{ fontSize: 9.5, color: "#64748B", textTransform: "uppercase" }}>Material Lines</div>
                    <div style={{ fontWeight: 800, color: "#0F172A", marginTop: 2 }}>
                      {materials.length} items
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: DPWH Planning Estimate (Exact DUPA Engine) */}
              {dpwhEstimate && (
                <div
                  style={{
                    background: "#fff",
                    border: "1.5px solid #BFDBFE",
                    borderRadius: 10,
                    padding: "12px 14px",
                    boxShadow: "0 2px 6px rgba(37,99,235,0.04)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: "#1E40AF",
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <Sparkle size={14} color="#2563EB" weight="fill" />
                      DPWH Planning Estimate
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#1E40AF",
                        background: "#EFF6FF",
                        padding: "2px 6px",
                        borderRadius: 4,
                      }}
                    >
                      {effectiveArea} m²
                    </span>
                  </div>

                  {/* DPWH Material Items Breakdown */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 }}>
                    {dpwhEstimate.items?.map((item) => (
                      <div
                        key={item.key}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          fontSize: 11.5,
                          padding: "3px 0",
                          borderBottom: "1px dashed #F1F5F9",
                        }}
                      >
                        <div>
                          <span style={{ color: "#334155", fontWeight: 600 }}>{item.label}</span>
                          <span style={{ fontSize: 10, color: "#94A3B8", marginLeft: 4 }}>
                            ({item.qty} {item.unit})
                          </span>
                        </div>
                        <span style={{ fontWeight: 700, color: "#0F172A" }}>{peso(item.cost)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Subtotals & Grand Total with Labor */}
                  <div
                    style={{
                      background: "#F8FAFC",
                      border: "1px solid #E2E8F0",
                      borderRadius: 7,
                      padding: "8px 10px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      fontSize: 11.5,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#64748B" }}>
                      <span>Materials Total:</span>
                      <strong style={{ color: "#0F172A" }}>{peso(dpwhEstimate.materialsTotal)}</strong>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", color: "#64748B" }}>
                      <span>Estimated Labor:</span>
                      <strong style={{ color: "#0F172A" }}>{peso(dpwhEstimate.labor)}</strong>
                    </div>

                    <div
                      style={{
                        borderTop: "1px solid #CBD5E1",
                        paddingTop: 4,
                        marginTop: 2,
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 12,
                        fontWeight: 800,
                      }}
                    >
                      <span style={{ color: "#1E3A8A" }}>With Labor:</span>
                      <span style={{ color: "#1D4ED8" }}>{peso(dpwhEstimate.total)}</span>
                    </div>
                  </div>

                  <div style={{ fontSize: 9.5, color: "#94A3B8", marginTop: 7, lineHeight: 1.4 }}>
                    Official DPWH DUPA formula guidelines. Unit reference prices: Cement ₱265/bag, Rebar
                    ₱59/kg, Sand ₱917/m³, Gravel ₱1,190/m³, CHB ₱14/pc.
                  </div>
                </div>
              )}

              {/* Card 3: Original Posted Items & Target Pricing Reference */}
              <div
                style={{
                  background: "#fff",
                  border: "1px solid #E2E8F0",
                  borderRadius: 10,
                  padding: "12px 14px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "#475569",
                    marginBottom: 10,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <FileText size={15} color="#475569" /> Original Posted Lines
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {rows.map((r, i) => {
                    const isSelected = activeLineIndex === r.index;
                    const benchUnitPrice = r.customerOriginalPrice || r.ref?.price;
                    const benchSubtotal = benchUnitPrice ? benchUnitPrice * r.requestedQty : null;

                    return (
                      <div
                        key={i}
                        onClick={() => {
                          setActiveLineIndex(r.index);
                          const el = document.getElementById(`quote-bid-line-${r.index}`);
                          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                          if (window.innerWidth < 992) setMobileTab("quote");
                        }}
                        style={{
                          background: isSelected ? "#EFF6FF" : "#F8FAFC",
                          border: isSelected ? "1px solid #93C5FD" : "1px solid #E2E8F0",
                          borderRadius: 7,
                          padding: "8px 10px",
                          cursor: "pointer",
                          transition: "all 0.15s",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
                          <div>
                            <span
                              style={{
                                fontSize: 9.5,
                                fontWeight: 800,
                                background: isSelected ? "#2563EB" : "#64748B",
                                color: "#fff",
                                borderRadius: 3,
                                padding: "1px 5px",
                                marginRight: 5,
                              }}
                            >
                              #{i + 1}
                            </span>
                            <span style={{ fontSize: 11.5, fontWeight: 700, color: "#0F172A" }}>
                              {r.productName}
                            </span>
                          </div>
                          <span style={{ fontSize: 11, color: "#64748B", fontWeight: 600, flexShrink: 0 }}>
                            {r.requestedQty} {r.unit}
                          </span>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            fontSize: 10.5,
                            marginTop: 4,
                            paddingTop: 4,
                            borderTop: "1px dashed #E2E8F0",
                          }}
                        >
                          <span style={{ color: "#64748B" }}>
                            Baseline:{" "}
                            {benchUnitPrice ? (
                              <strong style={{ color: "#1E40AF" }}>{peso(benchUnitPrice)}/{r.unit}</strong>
                            ) : (
                              <span style={{ color: "#94A3B8" }}>Market rate</span>
                            )}
                          </span>

                          {benchSubtotal && (
                            <span style={{ fontWeight: 700, color: "#475569" }}>
                              Est. {peso(benchSubtotal)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Embedded CSS for responsive 3-column modal */}
      <style>{`
        @media (max-width: 992px) {
          .quote-split-container {
            flex-direction: column !important;
          }
          .quote-mobile-nav {
            display: flex !important;
          }
          .quote-left-catalog,
          .quote-middle-bidding,
          .quote-right-reference {
            width: 100% !important;
            border-right: none !important;
            border-bottom: 1.5px solid #E2E8F0 !important;
          }
          .quote-col-hide-mobile {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
