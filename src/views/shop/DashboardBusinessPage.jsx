// src/views/shop/DashboardBusinessPage.jsx

import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  getShopProfile, getShopQuotations, getPostedProjects,
  submitQuotation, logoutShop,
} from "../../controllers/shopController";
import { auth, db } from "../../services/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import PayMongoPaymentForm from "../../components/forms/PayMongoPaymentForm";
import React from "react";
import QuoteModal from "../../components/QuoteModal";
import SettingsTab from "../../components/SettingsTab";
import MobileDrawerNav from "../../components/ui/MobileDrawerNav";
import ShopProjectsPanel from "../../components/shop/ShopProjectsPanel";
import ShopQuotationsPanel from "../../components/shop/ShopQuotationsPanel";
import ShopMessagesPanel from "../../components/shop/ShopMessagesPanel";
import PaidPlanAnalytics from "../../components/shop/PaidPlanAnalytics";
import {
  getQuoteMoneyStats,
  getStalePendingQuotes,
  buildShopInsights,
} from "../../utils/quoteAnalytics";
import { loadQuoteTemplates, saveQuoteTemplates } from "../../utils/quoteTemplates";
import { getRecommendationConfig } from "../../controllers/recommendationController";
import { normalizeEngineDoc } from "../../utils/recommendationEngine";
import { getShopRating } from "../../utils/shopRating";
import DashboardBrand from "../../components/ui/DashboardBrand";
import ShopNotificationBell from "../../components/ui/ShopNotificationBell";
import TopProductsCard from "../../components/shop/TopProductsCard";
import SupplyCoverageTab from "../../components/shop/SupplyCoverageTab";
import StorefrontTab from "../../components/shop/StorefrontTab";

import {
  TbConfetti, TbAlertTriangle, TbMenu2, TbLogout,
} from "react-icons/tb";
import {
  SquaresFour, Briefcase, Receipt, ChatCircleText, ChartLineUp,
  Wrench, ListChecks, Storefront, CreditCard, GearSix,
} from "@phosphor-icons/react";

const NAV = [
  { key: "overview",   label: "Dashboard",         icon: <SquaresFour size={16} /> },
  { key: "projects",   label: "All Projects",      icon: <Briefcase size={16} /> },
  { key: "quotations", label: "Quotations",        icon: <Receipt size={16} /> },
  { key: "messages",   label: "Messages",          icon: <ChatCircleText size={16} /> },
  { key: "analytics",  label: "Business Insights", icon: <ChartLineUp size={16} /> },
  { key: "tools",      label: "Bid Toolkit",       icon: <Wrench size={16} /> },
  { key: "supply",     label: "What We Supply",    icon: <ListChecks size={16} /> },
  { key: "storefront", label: "My Storefront",     icon: <Storefront size={16} /> },
  { key: "billing",    label: "Billing",           icon: <CreditCard size={16} /> },
  { key: "settings",   label: "Settings",          icon: <GearSix size={16} /> },
];

function PlanBadge() {
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, background:"#EFF6FF", color:"#1D4ED8", border:"1px solid #BFDBFE", borderRadius:20, padding:"3px 10px", fontSize:10, fontWeight:700, letterSpacing:"0.1em" }}>
      BUSINESS · Active
    </span>
  );
}

function StatCard({ label, value, color, sub }) {
  return (
    <div style={{ background:"#fff", borderRadius:14, padding:"20px 22px", border:"1px solid #E2E8F0" }}
      onMouseEnter={e => { e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow="0 8px 24px rgba(15,23,42,0.08)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform=""; e.currentTarget.style.boxShadow=""; }}>
      <div style={{ fontSize:22, fontWeight:900, color, fontFamily:"var(--font-display)", lineHeight:1.1, marginBottom:4 }}>{value}</div>
      <div style={{ fontSize:12, fontWeight:600, color:"#0F172A", marginBottom:2 }}>{label}</div>
      <div style={{ fontSize:11, color:"#94A3B8" }}>{sub}</div>
    </div>
  );
}

// ─── TAB COMPONENTS ───────────────────────────────────────────────────────────

function subscriptionRenewLine(shop) {
  const t = shop?.subscriptionExpiry;
  const d = t ? (typeof t.toDate === "function" ? t.toDate() : new Date(t.seconds ? t.seconds * 1000 : t)) : null;
  if (!d || Number.isNaN(d.getTime())) return "Subscription active";
  const days = Math.max(Math.ceil((d.getTime() - Date.now()) / 86400000), 0);
  return `Renews ${d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })} · ${days} day${days === 1 ? "" : "s"} left`;
}

function Overview({ shop, quotations, projects, money, stale, insights, setQuoteModal, setActiveTab }) {
  const rating = getShopRating(shop);
  return (
    <div>
      <div className="db-status-bar">
        <div>
          <div className="db-status-bar-title" onClick={() => setActiveTab("quotations")}>
            <TbAlertTriangle size={14} /> {stale.length} follow-up{stale.length === 1 ? "" : "s"} due
          </div>
          <div className="db-status-bar-sub">{subscriptionRenewLine(shop)}</div>
        </div>
        <button className="db-status-bar-link" onClick={() => setActiveTab("billing")}>Manage billing →</button>
      </div>

      <div className="db-stat-grid-5" style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:12, marginBottom:24 }}>
        <StatCard label="Revenue won"     value={money.format.revenueWon} color="#10B981" sub="Accepted totals" />
        <StatCard label="Open pipeline"   value={money.format.pipeline}   color="#F59E0B" sub="Pending value" />
        <StatCard label="Win rate"        value={`${money.winRate}%`}     color="#3B82F6" sub="Acceptance" />
        <StatCard label="Follow-ups"      value={stale.length}            color="#EF4444" sub="Pending &gt; 3 days" />
        <StatCard label="Open projects"   value={projects.length}         color="#0F172A" sub="Ready to bid" />
        <StatCard
          label="Your Rating"
          value={rating.hasRatings ? `★ ${rating.average.toFixed(1)}` : "—"}
          color="#D97706"
          sub={rating.hasRatings ? `${rating.count} rating${rating.count === 1 ? "" : "s"} from builders` : "Not yet rated"}
        />
      </div>

      <div className="db-two-col" style={{ display:"grid", gridTemplateColumns:"1fr 280px", gap:20 }}>
        <div style={{ background:"#fff", borderRadius:14, border:"1px solid #E2E8F0", padding:"20px 22px" }}>
          <div style={{ fontSize:13, fontWeight:700, color:"#0F172A", marginBottom:12 }}>What to act on</div>
          {insights.length === 0 ? (
            <div style={{ color:"#94A3B8", fontSize:12 }}>Keep bidding — insights appear after more quote data.</div>
          ) : (
            insights.map((t, i) => (
              <div key={i} style={{ fontSize:12.5, color:"#334155", lineHeight:1.55, marginBottom:10, paddingLeft:10, borderLeft:`3px solid ${i === 0 ? "#3B82F6" : "#E2E8F0"}` }}>
                {t}
              </div>
            ))
          )}
          <button type="button" onClick={() => setActiveTab("analytics")} style={{ marginTop:8, fontSize:12, fontWeight:700, color:"#1D4ED8", background:"none", border:"none", cursor:"pointer", padding:0 }}>
            Open full insights →
          </button>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ background:"#fff", borderRadius:14, border:"1px solid #E2E8F0", padding:"14px 16px" }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#0F172A", marginBottom:8 }}>Recent Projects</div>
            {projects.length === 0
              ? <div style={{ fontSize:11, color:"#94A3B8" }}>No open projects yet.</div>
              : projects.slice(0, 3).map(p => (
                  <div key={p.id} style={{ fontSize:12, color:"#334155", marginBottom:6, display:"flex", justifyContent:"space-between", gap:8 }}>
                    <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:130 }}>{p.projectName || p.title || "Project"}</span>
                    <button onClick={() => setQuoteModal(p)} style={{ fontSize:10, fontWeight:600, color:"#3B82F6", background:"none", border:"none", cursor:"pointer" }}>Quote</button>
                  </div>
                ))
            }
          </div>
          <div style={{ background:"#F0F9FF", borderRadius:14, border:"1px solid #BAE6FD", padding:"14px 16px" }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#0369A1", marginBottom:4 }}>AVG WINNING BID</div>
            <div style={{ fontSize:20, fontWeight:900, color:"#0C4A6E" }}>{money.format.avgAccepted}</div>
            <div style={{ fontSize:11, color:"#64748B", marginTop:4 }}>Use as your price baseline when quoting.</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <TopProductsCard quotations={quotations} accentColor="#0D2E43" plan="business" />
      </div>
    </div>
  );
}

function AllProjects({ projects, quotations, setQuoteModal, estimateConfig, suppliedCategories }) {
  return (
    <ShopProjectsPanel
      projects={projects}
      quotations={quotations}
      onQuote={setQuoteModal}
      planLabel="Business · unlimited projects"
      estimateConfig={estimateConfig}
      suppliedCategories={suppliedCategories}
    />
  );
}

function QuotationsBusiness({ quotations, setActiveTab, accentColor = "#2C5282", onMessageBuilder, shop, projects, estimateConfig }) {
  return (
    <ShopQuotationsPanel
      quotations={quotations}
      accentColor={accentColor}
      onGoProjects={() => setActiveTab("projects")}
      onMessageBuilder={onMessageBuilder}
      shop={shop}
      projects={projects}
      estimateConfig={estimateConfig}
    />
  );
}

function BidToolkit({ shopId }) {
  const [templates, setTemplates] = useState([]);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (shopId) setTemplates(loadQuoteTemplates(shopId));
  }, [shopId]);

  const persist = (next) => {
    const saved = saveQuoteTemplates(shopId, next);
    setTemplates(saved);
  };

  return (
    <div>
      <h2 style={{ fontFamily:"var(--font-display)", fontSize:19, fontWeight:900, color:"#0F172A", marginBottom:4 }}>Bid Toolkit</h2>
      <p style={{ fontSize:12, color:"#64748B", marginBottom:20 }}>
        Reusable notes for faster, consistent quotations. Applied when you open the quote form.
      </p>

      <div style={{ background:"#fff", borderRadius:14, border:"1px solid #E2E8F0", padding:20, marginBottom:16, maxWidth:560 }}>
        <div style={{ fontSize:13, fontWeight:700, color:"#0F172A", marginBottom:12 }}>Add template</div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Template name (e.g. Same-day Lipa)"
          style={{ width:"100%", marginBottom:10, padding:"10px 12px", border:"1px solid #E2E8F0", borderRadius:8, fontSize:13, boxSizing:"border-box" }}
        />
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Note text builders will see on your quote..."
          style={{ width:"100%", marginBottom:12, padding:"10px 12px", border:"1px solid #E2E8F0", borderRadius:8, fontSize:13, boxSizing:"border-box", fontFamily:"inherit", resize:"vertical" }}
        />
        <button
          type="button"
          onClick={() => {
            if (!note.trim()) return setMsg("Note text is required.");
            persist([{ id: `tpl_${Date.now()}`, name: name.trim() || "Custom", note: note.trim() }, ...templates]);
            setName("");
            setNote("");
            setMsg("Template saved.");
          }}
          style={{ padding:"10px 18px", borderRadius:10, border:"none", background:"linear-gradient(135deg,#0D2E43,#2D6A8F)", color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer" }}
        >
          Save template
        </button>
        {msg && <div style={{ marginTop:10, fontSize:12, color: msg.includes("required") ? "#DC2626" : "#059669" }}>{msg}</div>}
      </div>

      <div style={{ display:"grid", gap:12 }}>
        {templates.map((t) => (
          <div key={t.id} style={{ background:"#fff", borderRadius:12, border:"1px solid #E2E8F0", padding:"14px 16px", display:"flex", justifyContent:"space-between", gap:12 }}>
            <div style={{ minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#0F172A" }}>{t.name}</div>
              <div style={{ fontSize:12, color:"#64748B", marginTop:4, lineHeight:1.5 }}>{t.note}</div>
            </div>
            <button
              type="button"
              onClick={() => persist(templates.filter((x) => x.id !== t.id))}
              style={{ fontSize:11, fontWeight:600, color:"#DC2626", background:"none", border:"none", cursor:"pointer", flexShrink:0 }}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function BillingBusiness({ shop }) {
  const [showRenew, setShowRenew] = React.useState(false);

  const expiryExact = (() => {
    const t = shop?.subscriptionExpiry;
    if (!t) return "—";
    const d = typeof t.toDate === "function" ? t.toDate() : new Date(t.seconds ? t.seconds * 1000 : t);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-PH", {
      year: "numeric", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true,
    });
  })();

  return (
    <div>
      <h2 style={{ fontFamily:"var(--font-display)", fontSize:19, fontWeight:900, color:"#0F172A", marginBottom:20 }}>Billing & Subscription</h2>
      <div style={{ background:"#fff", borderRadius:14, border:"1px solid #E2E8F0", padding:"24px", marginBottom:20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20, paddingBottom:20, borderBottom:"1px solid #F1F5F9" }}>
          <div>
            <div style={{ fontSize:18, fontWeight:900, color:"#0F172A", marginBottom:4 }}>Business Plan</div>
            <div style={{ fontSize:26, fontWeight:900, color:"#3B82F6" }}>
              ₱4,999<span style={{ fontSize:13, fontWeight:400, color:"#94A3B8" }}>/month</span>
            </div>
          </div>
          <span style={{ display:"inline-flex", alignItems:"center", background:"#EFF6FF", color:"#1D4ED8", border:"1px solid #BFDBFE", borderRadius:20, padding:"3px 10px", fontSize:10, fontWeight:700 }}>BUSINESS</span>
        </div>
        {shop && [
          ["Shop",                shop.shopName],
          ["Subscription Plan",   shop.subscriptionPlan?.toUpperCase() || "BUSINESS"],
          ["Subscription Status", shop.subscriptionStatus || "active"],
          ["Expires (date & time)", expiryExact],
        ].map(([k,v]) => (
          <div key={k} style={{ display:"flex", gap:12, marginBottom:12, fontSize:13 }}>
            <span style={{ color:"#94A3B8", minWidth:160, flexShrink:0 }}>{k}</span>
            <span style={{ color:"#0F172A", fontWeight:500 }}>{v}</span>
          </div>
        ))}
        {!showRenew && (
          <button onClick={() => setShowRenew(true)} style={{ marginTop:16, padding:"11px 24px", borderRadius:10, border:"none", background:"linear-gradient(135deg,#0D2E43,#2D6A8F)", color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer" }}>
            Renew / Pay with PayMongo →
          </button>
        )}
      </div>
      {showRenew && (
        <div style={{ background:"#fff", borderRadius:14, border:"1px solid #BFDBFE", padding:"24px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
            <button onClick={() => setShowRenew(false)} style={{ fontSize:12, color:"#64748B", background:"none", border:"none", cursor:"pointer", padding:0 }}>← Back</button>
            <div style={{ fontWeight:700, fontSize:15, color:"#0F172A" }}>Renew Your Plan</div>
          </div>
          <PayMongoPaymentForm defaultPlan="business" onCancel={() => setShowRenew(false)} />
        </div>
      )}
    </div>
  );
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────

export default function ShopDashboardBusiness() {
  const navigate = useNavigate();

  const [shop, setShop]             = useState(null);
  const [projects, setProjects]     = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [activeTab, setActiveTab]   = useState("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [toast, setToast]           = useState(null);
  const [quoteModal, setQuoteModal] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [chatQuote, setChatQuote] = useState(null);
  const [estimateConfig, setEstimateConfig] = useState(null);
  const [showPlanActivatedModal, setShowPlanActivatedModal] = useState(false);
  const prevStatusRef = useRef(null);

  useEffect(() => {
    getRecommendationConfig()
      .then(setEstimateConfig)
      .catch(() => setEstimateConfig(normalizeEngineDoc({})));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [shopData, projectData, quotData] = await Promise.all([
          getShopProfile(),
          getPostedProjects().catch(err => { console.warn("Projects:", err.message); return []; }),
          getShopQuotations().catch(() => []),
        ]);
        setShop(shopData);
        setProjects(projectData);
        setQuotations(quotData);
      } catch {
        showToast("Failed to load data.", "error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, "shops", user.uid), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setShop((prev) => ({ ...prev, ...data, id: snap.id }));
      const { subscriptionStatus } = data;
      if (prevStatusRef.current !== null && prevStatusRef.current !== "active" && subscriptionStatus === "active") {
        setShowPlanActivatedModal(true);
      }
      prevStatusRef.current = subscriptionStatus;
    });
    return () => unsubscribe();
  }, []);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const money = useMemo(() => getQuoteMoneyStats(quotations), [quotations]);
  const stale = useMemo(() => getStalePendingQuotes(quotations, 3), [quotations]);
  const insights = useMemo(() => buildShopInsights(money, stale.length, "business"), [money, stale.length]);

  const Sidebar = () => (
    <aside
      className="db-sidebar"
      style={{
        width: sidebarCollapsed ? 72 : 240,
        minHeight: "100vh",
        flexShrink: 0,
        background: "#0D2E43",
        display: "flex",
        flexDirection: "column",
        transition: "width 0.25s cubic-bezier(0.4,0,0.2,1)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: sidebarCollapsed ? "16px 0 14px" : "20px 18px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          flexDirection: sidebarCollapsed ? "column" : "row",
          alignItems: "center",
          justifyContent: sidebarCollapsed ? "center" : "space-between",
          gap: 10,
        }}
      >
        {sidebarCollapsed ? (
          <DashboardBrand collapsed />
        ) : (
          <div style={{ flex: 1, minWidth: 0 }}>
            <DashboardBrand subtitle="Shop Manager · Business" compact>
              <PlanBadge />
            </DashboardBrand>
          </div>
        )}
        <button
          type="button"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          title={sidebarCollapsed ? "Expand menu" : "Collapse menu"}
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(148,163,184,0.7)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <TbMenu2 size={15} />
        </button>
      </div>
      {!sidebarCollapsed && (
        <div style={{ margin: "12px 14px", padding: "10px 14px", background: "rgba(207,177,132,0.12)", borderRadius: 10, border: "1px solid rgba(207,177,132,0.28)" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#E8D9BC", marginBottom: 2 }}>BUSINESS INSIGHTS</div>
          <div style={{ fontSize: 10, color: "rgba(232,217,188,0.65)" }}>Revenue · pipeline · smart tips</div>
        </div>
      )}
      <nav style={{ flex: 1, padding: "4px 0" }}>
        {NAV.map(item => {
          const isActive = activeTab === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setActiveTab(item.key)}
              title={item.label}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: sidebarCollapsed ? "10px 0" : "10px 20px",
                justifyContent: sidebarCollapsed ? "center" : "flex-start",
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                background: isActive ? "rgba(207,177,132,0.15)" : "transparent",
                color: isActive ? "#E8D9BC" : "rgba(148,163,184,0.65)",
                borderLeft: isActive ? "2px solid #CFB184" : "2px solid transparent",
                textAlign: "left",
                transition: "all 0.15s",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>{item.icon}</span>
              {!sidebarCollapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>
      <div
        style={{
          padding: sidebarCollapsed ? "14px 0" : "14px 20px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          flexDirection: "column",
          alignItems: sidebarCollapsed ? "center" : "stretch",
          gap: 10,
        }}
      >
        {shop && !sidebarCollapsed && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#F1F5F9" }}>{shop.shopName}</div>
            <div style={{ fontSize: 10, color: "rgba(148,163,184,0.5)" }}>{shop.ownerName}</div>
          </div>
        )}
        {sidebarCollapsed ? (
          <button
            type="button"
            title="Sign Out"
            onClick={async () => { await logoutShop(); navigate("/login", { replace: true }); }}
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              border: "1px solid rgba(239,68,68,0.2)",
              background: "rgba(239,68,68,0.1)",
              color: "#F87171",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <TbLogout size={15} />
          </button>
        ) : (
          <button onClick={async () => { await logoutShop(); navigate("/login", { replace: true }); }} style={{ width: "100%", padding: "8px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)", color: "#F87171", fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>Sign Out</button>
        )}
      </div>
    </aside>
  );

  const Topbar = () => (
    <header className="db-topbar" style={{ height:58, background:"#fff", borderBottom:"1px solid #E2E8F0", display:"flex", alignItems:"center", padding:"0 28px", justifyContent:"space-between", position:"sticky", top:0, zIndex:50 }}>
      <div className="db-topbar-left">
        <button
          type="button"
          className="db-mobile-trigger"
          aria-label="Open menu"
          onClick={() => setMobileNavOpen(true)}
        >
          <TbMenu2 size={20} />
        </button>
        <div style={{ fontSize:15, fontWeight:700, color:"#0F172A" }}>{NAV.find(n=>n.key===activeTab)?.label}</div>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <ShopNotificationBell />
        <PlanBadge />
        <div style={{ width:34, height:34, borderRadius:"50%", background:"linear-gradient(135deg,#0D2E43,#2D6A8F)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:"#fff" }}>
          {shop?.shopName?.[0] || "S"}
        </div>
      </div>
    </header>
  );

  const renderContent = () => {
    switch (activeTab) {
      case "overview":   return <Overview shop={shop} quotations={quotations} projects={projects} money={money} stale={stale} insights={insights} setQuoteModal={setQuoteModal} setActiveTab={setActiveTab} />;
      case "projects":   return <AllProjects projects={projects} quotations={quotations} setQuoteModal={setQuoteModal} estimateConfig={estimateConfig} suppliedCategories={shop?.suppliedCategories || []} />;
      case "quotations": return (
        <QuotationsBusiness
          quotations={quotations}
          setActiveTab={setActiveTab}
          accentColor="#2C5282"
          shop={shop}
          projects={projects}
          estimateConfig={estimateConfig}
          onMessageBuilder={(q) => {
            setChatQuote(q);
            setActiveTab("messages");
          }}
        />
      );
      case "messages": return (
        <ShopMessagesPanel
          accentColor="#0D2E43"
          bootstrapQuote={chatQuote}
          onBootstrapped={() => setChatQuote(null)}
        />
      );
      case "analytics":  return <PaidPlanAnalytics quotations={quotations} tier="business" />;
      case "tools":      return <BidToolkit shopId={shop?.id || auth.currentUser?.uid} />;
      case "supply":     return <SupplyCoverageTab shop={shop} accentColor="#0D2E43" onShopUpdated={(next) => setShop((s) => ({ ...s, ...next }))} />;
      case "storefront": return <StorefrontTab shop={shop} plan="business" accentColor="#0D2E43" onShopUpdated={(next) => setShop((s) => ({ ...s, ...next }))} />;
      case "billing":    return <BillingBusiness shop={shop} />;
      case "settings":
      case "profile":
        return (
          <SettingsTab
            shop={shop}
            accentColor="#2C5282"
            accentGradient="linear-gradient(135deg,#0D2E43,#2D6A8F)"
            onShopUpdated={(next) => setShop((s) => ({ ...s, ...next }))}
          />
        );
      default:
        return <Overview shop={shop} quotations={quotations} projects={projects} money={money} stale={stale} insights={insights} setQuoteModal={setQuoteModal} setActiveTab={setActiveTab} />;
    }
  };

  return (
    <>
      <div className="db-shell" style={{ display:"flex", minHeight:"100vh", background:"#F4F6F9" }}>
        <Sidebar />
        <div className="db-main-col" style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0 }}>
          <Topbar />
          <main className="db-content" style={{ flex:1, padding:28, overflowY:"auto" }}>
            {loading ? <div style={{ textAlign:"center", padding:80, color:"#94A3B8" }}>Loading dashboard...</div> : renderContent()}
          </main>
        </div>
      </div>

      <MobileDrawerNav
        items={NAV}
        activeTab={activeTab}
        onSelect={setActiveTab}
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        accentColor="#CFB184"
        subtitle="Shop Manager · Business"
        onLogout={async () => { await logoutShop(); navigate("/login", { replace: true }); }}
      />

      {quoteModal && (
        <QuoteModal
          project={quoteModal}
          onClose={() => setQuoteModal(null)}
          onSubmit={async ({ projectId, amount, note, items }) => {
            setSubmitting(true);
            try {
              await submitQuotation({ projectId, amount, note, items });
              showToast("Quotation submitted!");
              setQuoteModal(null);
              const updated = await getShopQuotations();
              setQuotations(updated);
            } catch (err) {
              showToast(err.message || "Failed to submit.", "error");
            } finally {
              setSubmitting(false);
            }
          }}
          submitting={submitting}
          accentColor="#2C5282"
          accentGradient="linear-gradient(135deg, #0D2E43, #2D6A8F)"
          enableTemplates
          shopId={shop?.id || auth.currentUser?.uid}
          pricingGuide={money}
          estimateConfig={estimateConfig}
          plan="business"
          suppliedCategories={shop?.suppliedCategories || []}
        />
      )}

      {toast && <div style={{ position:"fixed", bottom:24, right:24, padding:"12px 18px", borderRadius:10, background:toast.type==="error"?"#DC2626":"#0F172A", color:"#fff", fontSize:12.5, fontWeight:500, boxShadow:"0 10px 30px rgba(0,0,0,0.25)", zIndex:500 }}>{toast.msg}</div>}

      {showPlanActivatedModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.6)", backdropFilter:"blur(8px)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
          <div style={{ background:"#fff", borderRadius:20, padding:"40px 36px", width:"100%", maxWidth:420, textAlign:"center", boxShadow:"0 32px 80px rgba(0,0,0,0.25)", position:"relative", overflow:"hidden" }}>
            <div style={{ position:"absolute", top:0, left:0, right:0, height:4, background:"linear-gradient(90deg,#0D2E43,#2D6A8F)", borderRadius:"20px 20px 0 0" }} />
            <div style={{ width:72, height:72, borderRadius:"50%", background:"linear-gradient(135deg,#D1FAE5,#A7F3D0)", border:"2px solid #6EE7B7", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 20px" }}>
              <TbConfetti size={36} color="#059669" />
            </div>
            <div style={{ fontFamily:"var(--font-display)", fontSize:22, fontWeight:900, color:"#0F172A", marginBottom:8 }}>Subscription Activated!</div>
            <p style={{ fontSize:14, color:"#64748B", lineHeight:1.7, marginBottom:8 }}>Your plan has been confirmed and is now <strong style={{ color:"#059669" }}>active</strong>.</p>
            <p style={{ fontSize:13, color:"#94A3B8", lineHeight:1.6, marginBottom:28 }}>Please <strong style={{ color:"#0F172A" }}>sign out and log back in</strong> to apply your new features.</p>
            <div style={{ background:"#FFF7ED", border:"1px solid #FED7AA", borderRadius:10, padding:"12px 16px", marginBottom:24, fontSize:12.5, color:"#92400E", lineHeight:1.6, display:"flex", alignItems:"flex-start", gap:8 }}>
              <TbAlertTriangle size={15} style={{ flexShrink:0, marginTop:1 }} color="#D97706" />
              You must sign out and sign back in for your upgraded plan to take effect.
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => setShowPlanActivatedModal(false)} style={{ flex:1, padding:"12px", borderRadius:10, border:"1.5px solid rgba(44,62,80,0.15)", background:"transparent", color:"rgba(44,62,80,0.6)", fontSize:13, fontWeight:500, cursor:"pointer" }}>Remind Me Later</button>
              <button onClick={async () => { await logoutShop(); navigate("/login", { replace: true }); }} style={{ flex:2, padding:"12px", borderRadius:10, border:"none", background:"linear-gradient(135deg,#0D2E43,#2D6A8F)", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>Sign Out &amp; Log In Again →</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
