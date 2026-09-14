// src/views/shop/DashboardProPage.jsx
// FIX: All tab components moved OUTSIDE ShopDashboardPro to prevent
// remount-on-every-keystroke. Each gets only the props it needs.

import { useState, useEffect, useRef } from "react";
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
import { getQuoteMoneyStats } from "../../utils/quoteAnalytics";
import { getRecommendationConfig } from "../../controllers/recommendationController";
import { normalizeEngineDoc } from "../../utils/recommendationEngine";
import DashboardBrand from "../../components/ui/DashboardBrand";
import ShopNotificationBell from "../../components/ui/ShopNotificationBell";
import TopProductsCard from "../../components/shop/TopProductsCard";
import SupplyCoverageTab from "../../components/shop/SupplyCoverageTab";
import StorefrontTab from "../../components/shop/StorefrontTab";

import {
  ArrowRight,
  CheckCircle,
  Lightning,
  List,
  SignOut,
  SquaresFour,
  Briefcase,
  Receipt,
  ChatCircleText,
  ChartLineUp,
  ListChecks,
  Storefront,
  CreditCard,
  GearSix,
} from "@phosphor-icons/react";

const NAV = [
  { key: "overview",   label: "Dashboard",    icon: <SquaresFour size={16} /> },
  { key: "projects",   label: "All Projects", icon: <Briefcase size={16} /> },
  { key: "quotations", label: "Quotations",   icon: <Receipt size={16} /> },
  { key: "messages",   label: "Messages",     icon: <ChatCircleText size={16} /> },
  { key: "analytics",  label: "Analytics",      icon: <ChartLineUp size={16} /> },
  { key: "supply",     label: "What We Supply", icon: <ListChecks size={16} /> },
  { key: "storefront", label: "My Storefront",  icon: <Storefront size={16} /> },
  { key: "billing",    label: "Billing",        icon: <CreditCard size={16} /> },
  { key: "settings",   label: "Settings",       icon: <GearSix size={16} /> },
];

function PlanBadge() {
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, background:"#EFF6FF", color:"#1D4ED8", border:"1px solid #BFDBFE", borderRadius:20, padding:"3px 10px", fontSize:10, fontWeight:700, letterSpacing:"0.1em" }}>
      PRO · Active
    </span>
  );
}

function StatCard({ label, value, color, sub }) {
  return (
    <div style={{ background:"#fff", borderRadius:14, padding:"20px 22px", border:"1px solid #E2E8F0" }}>
      <div style={{ fontSize:28, fontWeight:900, color, fontFamily:"var(--font-display)", lineHeight:1, marginBottom:4 }}>{value}</div>
      <div style={{ fontSize:12, fontWeight:600, color:"#0F172A", marginBottom:2 }}>{label}</div>
      <div style={{ fontSize:11, color:"#94A3B8" }}>{sub}</div>
    </div>
  );
}

// ─── TAB COMPONENTS (defined OUTSIDE parent — stable identity, no remount) ────

function subscriptionRenewLine(shop) {
  const t = shop?.subscriptionExpiry;
  const d = t ? (typeof t.toDate === "function" ? t.toDate() : new Date(t.seconds ? t.seconds * 1000 : t)) : null;
  if (!d || Number.isNaN(d.getTime())) return "Subscription active";
  const days = Math.max(Math.ceil((d.getTime() - Date.now()) / 86400000), 0);
  return `Renews ${d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })} · ${days} day${days === 1 ? "" : "s"} left`;
}

function Overview({ shop, quotations, projects, accepted, pending, rejected, money, monthQuotes, setQuoteModal, setActiveTab }) {
  return (
    <div>
      <div style={{ background:"linear-gradient(135deg,#2C5282,#3B82F6)", borderRadius:14, padding:"20px 24px", marginBottom:24, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ fontSize:14, fontWeight:700, color:"#fff", marginBottom:3, display:"flex", alignItems:"center", gap:6 }}>
            <Lightning size={14} weight="fill" /> Pro Plan Active
          </div>
          <div style={{ fontSize:12, color:"rgba(255,255,255,0.7)" }}>
            {subscriptionRenewLine(shop)} · {pending} quote{pending === 1 ? "" : "s"} awaiting reply
          </div>
        </div>
        <button onClick={() => setActiveTab("billing")} style={{ background:"rgba(255,255,255,0.15)", border:"1px solid rgba(255,255,255,0.3)", borderRadius:8, padding:"8px 16px", fontSize:11.5, fontWeight:600, color:"#fff", cursor:"pointer" }}>Manage Billing →</button>
      </div>

      <div className="db-stat-grid-4" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:24 }}>
        <StatCard label="Revenue won"     value={money.format.revenueWon} color="#10B981" sub="Accepted quote totals" />
        <StatCard label="Open pipeline"   value={money.format.pipeline}   color="#F59E0B" sub="Pending value" />
        <StatCard label="Win rate"        value={`${money.winRate}%`}     color="#3B82F6" sub={`${monthQuotes.length} bids this month`} />
        <StatCard label="Open projects"   value={projects.length}         color="#2C5282" sub="Ready to bid" />
      </div>

      <div className="db-two-col" style={{ display:"grid", gridTemplateColumns:"1fr 300px", gap:20 }}>
        <div style={{ background:"#fff", borderRadius:14, border:"1px solid #E2E8F0", padding:"20px 22px" }}>
          <div style={{ fontSize:13, fontWeight:700, color:"#0F172A", marginBottom:14 }}>Bid Status Breakdown</div>
          {quotations.length === 0 ? (
            <div style={{ textAlign:"center", padding:"32px 0", color:"#94A3B8", fontSize:12 }}>No quotations submitted yet.</div>
          ) : (
            [{ label:"Accepted", value:accepted, color:"#10B981" }, { label:"Pending", value:pending, color:"#F59E0B" }, { label:"Rejected", value:rejected, color:"#EF4444" }].map(({ label, value, color }) => {
              const pct = quotations.length > 0 ? Math.round((value / quotations.length) * 100) : 0;
              return (
                <div key={label} style={{ marginBottom:10 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontSize:12, color:"#64748B" }}>{label}</span>
                    <span style={{ fontSize:12, fontWeight:700, color }}>{value} ({pct}%)</span>
                  </div>
                  <div style={{ height:5, background:"#F1F5F9", borderRadius:4 }}>
                    <div style={{ height:"100%", width:`${pct}%`, background:color, borderRadius:4 }} />
                  </div>
                </div>
              );
            })
          )}
          <button type="button" onClick={() => setActiveTab("analytics")} style={{ marginTop:8, fontSize:12, fontWeight:700, color:"#1D4ED8", background:"none", border:"none", cursor:"pointer", padding:0 }}>
            Open analytics &amp; export →
          </button>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ background:"linear-gradient(135deg,#EFF6FF,#DBEAFE)", borderRadius:14, border:"1px solid #BFDBFE", padding:"16px 18px" }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#1D4ED8", marginBottom:6 }}>PRICING GUIDE</div>
            <div style={{ fontSize:18, fontWeight:900, color:"#1E40AF", marginBottom:4 }}>{money.format.avgAccepted}</div>
            <div style={{ fontSize:11, color:"#1E40AF" }}>Average accepted bid — use when quoting.</div>
          </div>
          <div style={{ background:"#fff", borderRadius:14, border:"1px solid #E2E8F0", padding:"16px 18px" }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#0F172A", marginBottom:8 }}>Recent Projects</div>
            {projects.length === 0
              ? <div style={{ fontSize:11, color:"#94A3B8" }}>No open projects yet.</div>
              : projects.slice(0, 3).map(p => (
                  <div key={p.id} style={{ fontSize:12, color:"#334155", marginBottom:6, display:"flex", justifyContent:"space-between" }}>
                    <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:120 }}>{p.projectName || "Project"}</span>
                    <button onClick={() => setQuoteModal(p)} style={{ fontSize:10, fontWeight:600, color:"#3B82F6", background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:3 }}>
                      Quote <ArrowRight size={10} weight="bold" />
                    </button>
                  </div>
                ))
            }
          </div>
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <TopProductsCard quotations={quotations} accentColor="#3B82F6" plan="pro" />
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
      planLabel="Pro · unlimited projects"
      estimateConfig={estimateConfig}
      suppliedCategories={suppliedCategories}
    />
  );
}

function Billing({ shop }) {
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

      <div style={{ background:"#fff", borderRadius:14, border:"1px solid #E2E8F0", padding:"24px", marginBottom: 20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20, paddingBottom:20, borderBottom:"1px solid #F1F5F9" }}>
          <div>
            <div style={{ fontSize:18, fontWeight:900, color:"#0F172A", marginBottom:4 }}>Pro Plan</div>
            <div style={{ fontSize:22, fontWeight:900, color:"#3B82F6" }}>
              ₱999<span style={{ fontSize:13, fontWeight:400, color:"#94A3B8" }}>/month</span>
            </div>
          </div>
          <span style={{ display:"inline-flex", alignItems:"center", background:"#EFF6FF", color:"#1D4ED8", border:"1px solid #BFDBFE", borderRadius:20, padding:"3px 10px", fontSize:10, fontWeight:700 }}>
            PRO · Active
          </span>
        </div>
        {shop && [
          ["Shop",                shop.shopName],
          ["Subscription Plan",   shop.subscriptionPlan?.toUpperCase() || "PRO"],
          ["Subscription Status", shop.subscriptionStatus || "active"],
          ["Expires (date & time)", expiryExact],
        ].map(([k,v]) => (
          <div key={k} style={{ display:"flex", gap:12, marginBottom:12, fontSize:13 }}>
            <span style={{ color:"#94A3B8", minWidth:160, flexShrink:0 }}>{k}</span>
            <span style={{ color:"#0F172A", fontWeight:500 }}>{v}</span>
          </div>
        ))}

        {!showRenew && (
          <button
            onClick={() => setShowRenew(true)}
            style={{
              marginTop: 16, padding: "11px 24px", borderRadius: 10, border: "none",
              background: "linear-gradient(135deg,#2C5282,#3B82F6)",
              color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
            }}
          >
            Renew / Pay with PayMongo →
          </button>
        )}
      </div>

      {showRenew && (
        <div style={{ background:"#fff", borderRadius:14, border:"1px solid #BFDBFE", padding:"24px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
            <button
              onClick={() => setShowRenew(false)}
              style={{ fontSize:12, color:"#64748B", background:"none", border:"none", cursor:"pointer", padding:0 }}
            >← Back</button>
            <div style={{ fontWeight:700, fontSize:15, color:"#0F172A" }}>Renew Your Plan</div>
          </div>
          <PayMongoPaymentForm defaultPlan="pro" onCancel={() => setShowRenew(false)} />
        </div>
      )}
    </div>
  );
}

function Quotations({ quotations, setActiveTab, accentColor = "#2C5282", onMessageBuilder, shop, projects, estimateConfig }) {
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

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────

export default function ShopDashboardPro() {
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

  useEffect(() => {
    getRecommendationConfig()
      .then(setEstimateConfig)
      .catch(() => setEstimateConfig(normalizeEngineDoc({})));
  }, []);
  const prevStatusRef = useRef(null);

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
      } catch (err) {
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

  const accepted    = quotations.filter(q => q.status === "accepted").length;
  const pending     = quotations.filter(q => q.status === "pending" || !q.status).length;
  const rejected    = quotations.filter(q => q.status === "rejected").length;
  const money       = getQuoteMoneyStats(quotations);
  const now         = new Date();
  const monthQuotes = quotations.filter(q => {
    const d = q.createdAt?.toDate?.() || new Date(q.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const Sidebar = () => (
    <aside
      className="db-sidebar"
      style={{
        width: sidebarCollapsed ? 72 : 228,
        minHeight: "100vh",
        flexShrink: 0,
        background: "#0F172A",
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
            <DashboardBrand subtitle="Shop Manager · Pro" compact>
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
          <List size={15} />
        </button>
      </div>
      {!sidebarCollapsed && (
        <div style={{ margin: "12px 14px", padding: "10px 14px", background: "rgba(59,130,246,0.12)", borderRadius: 10, border: "1px solid rgba(59,130,246,0.2)" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#93C5FD", marginBottom: 2 }}>PRO TOOLS ACTIVE</div>
          <div style={{ fontSize: 10, color: "rgba(148,163,184,0.7)" }}>Analytics · export · bid templates</div>
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
                background: isActive ? "rgba(59,130,246,0.15)" : "transparent",
                color: isActive ? "#93C5FD" : "rgba(148,163,184,0.65)",
                borderLeft: isActive ? "2px solid #3B82F6" : "2px solid transparent",
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
            <div style={{ fontSize: 12, fontWeight: 600, color: "#F1F5F9", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{shop.shopName}</div>
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
            <SignOut size={14} />
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
          <List size={20} />
        </button>
        <div style={{ fontSize:15, fontWeight:700, color:"#0F172A" }}>{NAV.find(n=>n.key===activeTab)?.label}</div>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <ShopNotificationBell />
        <PlanBadge />
        <div style={{ width:34, height:34, borderRadius:"50%", background:"linear-gradient(135deg,#1E3A5F,#3B82F6)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:"#fff" }}>
          {shop?.shopName?.[0] || "S"}
        </div>
      </div>
    </header>
  );

  const renderContent = () => {
    switch (activeTab) {
      case "overview":   return <Overview shop={shop} quotations={quotations} projects={projects} accepted={accepted} pending={pending} rejected={rejected} money={money} monthQuotes={monthQuotes} setQuoteModal={setQuoteModal} setActiveTab={setActiveTab} />;
      case "projects":   return <AllProjects projects={projects} quotations={quotations} setQuoteModal={setQuoteModal} estimateConfig={estimateConfig} suppliedCategories={shop?.suppliedCategories || []} />;
      case "quotations": return (
        <Quotations
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
          accentColor="#2C5282"
          bootstrapQuote={chatQuote}
          onBootstrapped={() => setChatQuote(null)}
        />
      );
      case "analytics":  return <PaidPlanAnalytics quotations={quotations} tier="pro" />;
      case "supply":     return <SupplyCoverageTab shop={shop} accentColor="#2C5282" onShopUpdated={(next) => setShop((s) => ({ ...s, ...next }))} />;
      case "storefront": return <StorefrontTab shop={shop} plan="pro" accentColor="#2C5282" onShopUpdated={(next) => setShop((s) => ({ ...s, ...next }))} />;
      case "billing":    return <Billing shop={shop} />;
      case "settings":
      case "profile":
        return (
          <SettingsTab
            shop={shop}
            accentColor="#2C5282"
            accentGradient="linear-gradient(135deg,#2C5282,#3B82F6)"
            onShopUpdated={(next) => setShop((s) => ({ ...s, ...next }))}
          />
        );
      default:           return <Overview shop={shop} quotations={quotations} projects={projects} accepted={accepted} pending={pending} rejected={rejected} money={money} monthQuotes={monthQuotes} setQuoteModal={setQuoteModal} setActiveTab={setActiveTab} />;
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
        accentColor="#3B82F6"
        subtitle="Shop Manager · Pro"
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
          accentGradient="linear-gradient(135deg, #2C5282, #3B82F6)"
          enableTemplates
          shopId={shop?.id || auth.currentUser?.uid}
          pricingGuide={money}
          estimateConfig={estimateConfig}
          plan="pro"
          suppliedCategories={shop?.suppliedCategories || []}
        />
      )}

      {toast && (
        <div style={{ position:"fixed", bottom:24, right:24, padding:"12px 18px", borderRadius:10, background:toast.type==="error"?"#DC2626":"#0F172A", color:"#fff", fontSize:12.5, fontWeight:500, boxShadow:"0 10px 30px rgba(0,0,0,0.25)", zIndex:500 }}>
          {toast.msg}
        </div>
      )}

      {showPlanActivatedModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.6)", backdropFilter:"blur(8px)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
          <div style={{ background:"#fff", borderRadius:20, padding:"40px 36px", width:"100%", maxWidth:420, textAlign:"center", boxShadow:"0 32px 80px rgba(0,0,0,0.25)", position:"relative", overflow:"hidden" }}>
            <div style={{ position:"absolute", top:0, left:0, right:0, height:4, background:"linear-gradient(90deg,#2C5282,#3B82F6)", borderRadius:"20px 20px 0 0" }} />
            <div style={{ width:72, height:72, borderRadius:"50%", background:"linear-gradient(135deg,#D1FAE5,#A7F3D0)", border:"2px solid #6EE7B7", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 20px" }}>
              <CheckCircle size={36} color="#059669" weight="fill" />
            </div>
            <div style={{ fontFamily:"var(--font-display)", fontSize:22, fontWeight:900, color:"#0F172A", marginBottom:8 }}>Subscription Activated!</div>
            <p style={{ fontSize:14, color:"#64748B", lineHeight:1.7, marginBottom:8 }}>Your plan has been confirmed by the admin and is now <strong style={{ color:"#059669" }}>active</strong>.</p>
            <p style={{ fontSize:13, color:"#94A3B8", lineHeight:1.6, marginBottom:28 }}>To apply your new subscription features, please <strong style={{ color:"#0F172A" }}>sign out and log back in</strong>.</p>
            <div style={{ background:"#FFF7ED", border:"1px solid #FED7AA", borderRadius:10, padding:"12px 16px", marginBottom:24, fontSize:12.5, color:"#92400E", lineHeight:1.6 }}>
              You must sign out and sign back in for your upgraded plan to take effect.
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => setShowPlanActivatedModal(false)} style={{ flex:1, padding:"12px", borderRadius:10, border:"1.5px solid rgba(44,62,80,0.15)", background:"transparent", color:"rgba(44,62,80,0.6)", fontSize:13, fontWeight:500, cursor:"pointer" }}>Remind Me Later</button>
              <button onClick={async () => { await logoutShop(); navigate("/login", { replace: true }); }} style={{ flex:2, padding:"12px", borderRadius:10, border:"none", background:"linear-gradient(135deg,#2C5282,#3B82F6)", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", boxShadow:"0 4px 14px rgba(44,82,130,0.3)" }}>
                Sign Out &amp; Log In Again →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}