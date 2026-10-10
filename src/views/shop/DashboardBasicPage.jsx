// src/views/shop/DashboardBasicPage.jsx
// FIX: All tab components moved OUTSIDE ShopDashboardBasic to prevent
// remount-on-every-keystroke. Each gets only the props it needs.

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  getShopProfile, getShopQuotations, getPostedProjects,
  submitQuotation, logoutShop, getMyPaymentRequest, watchShopQuotations,
} from "../../controllers/shopController";
import PaymentForm  from "../../components/forms/Paymentform";
import { auth, db } from "../../services/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { getPlanConfig } from "../../config/planConfig";
import { getRecommendationConfig } from "../../controllers/recommendationController";
import { normalizeEngineDoc } from "../../utils/recommendationEngine";
import { getShopRating } from "../../utils/shopRating";
import PayMongoPaymentForm from "../../components/forms/PayMongoPaymentForm";
import React from "react";
import QuoteModal from "../../components/QuoteModal";
import SettingsTab from "../../components/SettingsTab";
import MobileDrawerNav from "../../components/ui/MobileDrawerNav";
import ShopProjectsPanel from "../../components/shop/ShopProjectsPanel";
import ShopQuotationsPanel from "../../components/shop/ShopQuotationsPanel";
import ShopMessagesPanel from "../../components/shop/ShopMessagesPanel";
import DashboardBrand from "../../components/ui/DashboardBrand";
import ShopNotificationBell from "../../components/ui/ShopNotificationBell";
import { buildShopQuoteAlerts } from "../../utils/shopAlerts";
import TopProductsCard from "../../components/shop/TopProductsCard";
import SupplyCoverageTab from "../../components/shop/SupplyCoverageTab";
import StorefrontTab from "../../components/shop/StorefrontTab";

import {
  TbConfetti, TbAlertTriangle, TbCreditCard, TbBuildingBank,
  TbMenu2, TbLogout,
} from "react-icons/tb";
import {
  SquaresFour, Briefcase, Receipt, ChatCircleText, ListChecks, Storefront,
  CreditCard as CreditCardIcon, GearSix,
} from "@phosphor-icons/react";

const cfg           = getPlanConfig("basic");
const QUOTA_LIMIT   = cfg.quotaLimit;
const PROJECT_LIMIT = cfg.projectLimit;

const NAV = [
  { key: "overview",   label: "Dashboard",    icon: <SquaresFour size={16} /> },
  { key: "projects",   label: "Projects",     icon: <Briefcase size={16} /> },
  { key: "quotations", label: "Quotations",   icon: <Receipt size={16} /> },
  { key: "messages",   label: "Messages",       icon: <ChatCircleText size={16} /> },
  { key: "supply",     label: "What We Supply", icon: <ListChecks size={16} /> },
  { key: "storefront", label: "My Storefront",  icon: <Storefront size={16} /> },
  { key: "upgrade",    label: "Upgrade Plan",   icon: <CreditCardIcon size={16} />, isUpgrade: true },
  { key: "settings",   label: "Settings",       icon: <GearSix size={16} /> },
];

const LOCKED = [
  { title: "Unlimited Bidding",   desc: "Quote every open project with no monthly cap." },
  { title: "Revenue Analytics",   desc: "See money won, pipeline, and win rates from real bids." },
  { title: "CSV Export",          desc: "Download quotation history for your records." },
  { title: "Pricing Guide",       desc: "Get average winning bid tips while you quote." },
];

const initials = (name = "") =>
  name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "S";

function PlanBadge() {
  return <span className="db-plan-badge basic">Free · Basic</span>;
}

function StatusBadge({ status }) {
  return <span className={`db-status-badge ${status || "pending"}`}>{status || "pending"}</span>;
}

function StatCard({ label, value, color, sub }) {
  return (
    <div className="db-stat-card">
      <div className="db-stat-value" style={{ color }}>{value}</div>
      <div className="db-stat-label">{label}</div>
      <div className="db-stat-sub">{sub}</div>
    </div>
  );
}

// ─── TAB COMPONENTS (defined OUTSIDE parent — stable identity, no remount) ────

function Overview({ shop, quotations, projects, quotaUsed, setActiveTab }) {
  const rating = getShopRating(shop);
  const accepted  = quotations.filter(q => q.status === "accepted").length;
  const pct       = Math.min((quotaUsed / QUOTA_LIMIT) * 100, 100);
  const barColor  = pct >= 100 ? "var(--db-red)" : pct >= 66 ? "var(--db-amber)" : "var(--db-green)";
  const quotesLeft = Math.max(QUOTA_LIMIT - quotaUsed, 0);
  const openCount  = projects.length;
  return (
    <div>
      <div className="db-status-bar">
        <div>
          <div className="db-status-bar-title" onClick={() => setActiveTab("projects")}>
            <Briefcase size={14} /> {openCount} open project{openCount === 1 ? "" : "s"} ready to bid
          </div>
          <div className="db-status-bar-sub">
            {quotesLeft} of {QUOTA_LIMIT} quotations left this month
          </div>
        </div>
        <button className="db-status-bar-link" onClick={() => setActiveTab("upgrade")}>Upgrade for unlimited →</button>
      </div>
      <div className="db-quota-card">
        <div className="db-quota-header">
          <span className="db-quota-label">Monthly Quotation Quota</span>
          <span className="db-quota-count" style={{ color: barColor }}>{quotaUsed} / {QUOTA_LIMIT} used</span>
        </div>
        <div className="db-quota-track">
          <div className="db-quota-fill" style={{ width: `${pct}%`, background: barColor }} />
        </div>
        {pct >= 100 && (
          <p className="db-quota-hint" style={{ color: "var(--db-red)" }}>
            Quota reached.{" "}
            <span style={{ color:"var(--db-accent-mid)", cursor:"pointer", textDecoration:"underline" }} onClick={() => setActiveTab("upgrade")}>
              Upgrade to Pro for unlimited access.
            </span>
          </p>
        )}
      </div>
      <div className="db-stat-grid">
        <StatCard label="Quotations Submitted" value={quotations.length} color="var(--db-accent-mid)" sub="All time" />
        <StatCard label="This Month"            value={quotaUsed}         color="var(--db-amber)"      sub={`of ${QUOTA_LIMIT} allowed`} />
        <StatCard label="Accepted"              value={accepted}          color="var(--db-green)"      sub={quotations.length ? `${Math.round((accepted / quotations.length) * 100)}% of submitted` : "No quotes yet"} />
        <StatCard
          label="Your Rating"
          value={rating.hasRatings ? `★ ${rating.average.toFixed(1)}` : "—"}
          color="var(--db-amber)"
          sub={rating.hasRatings ? `${rating.count} rating${rating.count === 1 ? "" : "s"} from builders` : "Not yet rated"}
        />
      </div>
      <div style={{ marginBottom: 20 }}>
        <TopProductsCard quotations={quotations} accentColor="#2C5282" plan="basic" onUpgrade={() => setActiveTab("upgrade")} />
      </div>
      <div className="db-card">
        <div className="db-card-header">
          <div>
            <div className="db-card-title">Premium Features</div>
            <div className="db-card-subtitle">Available on Pro &amp; Business plans</div>
          </div>
          <span style={{ fontSize:10, fontWeight:700, background:"#FEF3C7", color:"#92400E", border:"1px solid #FCD34D", borderRadius:20, padding:"2px 10px" }}>LOCKED</span>
        </div>
        <div className="db-locked-grid">
          {LOCKED.map((f, i) => (
            <div key={i} className="db-locked-cell">
              <div className="db-locked-title">{f.title}</div>
              <div className="db-locked-desc">{f.desc}</div>
              <div className="db-locked-tag">Requires Pro or Business</div>
            </div>
          ))}
        </div>
        <div className="db-locked-footer">
          <button className="db-btn-primary" onClick={() => setActiveTab("upgrade")} style={{ background:"linear-gradient(135deg,#D97706,#F59E0B)", boxShadow:"0 2px 8px rgba(217,119,6,0.35)" }}>
            Unlock All Features — Upgrade Now
          </button>
        </div>
      </div>
    </div>
  );
}

function Projects({ projects, quotaUsed, setQuoteModal, setActiveTab, loading, quotations = [], estimateConfig, suppliedCategories }) {
  return (
    <ShopProjectsPanel
      projects={projects}
      quotations={quotations}
      onQuote={setQuoteModal}
      loading={loading}
      quotaUsed={quotaUsed}
      quotaLimit={QUOTA_LIMIT}
      planLabel={`Basic: limited to ${PROJECT_LIMIT}`}
      showUpgradeBanner
      onUpgrade={() => setActiveTab("upgrade")}
      estimateConfig={estimateConfig}
      suppliedCategories={suppliedCategories}
    />
  );
}

function Quotations({ quotations, setActiveTab, onMessageBuilder, shop, projects, estimateConfig }) {
  return (
    <ShopQuotationsPanel
      quotations={quotations}
      onGoProjects={() => setActiveTab("projects")}
      onMessageBuilder={onMessageBuilder}
      shop={shop}
      projects={projects}
      estimateConfig={estimateConfig}
    />
  );
}

function Upgrade({ existingPayment, onPaymentSuccess }) {
  const [paymentMode, setPaymentMode] = React.useState("choose");
  const [syncing, setSyncing] = React.useState(false);
  const [syncMsg, setSyncMsg] = React.useState("");

  if (existingPayment === undefined) {
    return <div className="db-loading-center"><div className="db-spinner" /></div>;
  }

  const handleConfirmPaid = async () => {
    setSyncing(true);
    setSyncMsg("");
    try {
      const { syncMyLatestPayment } = await import("../../controllers/paymongoController");
      const result = await syncMyLatestPayment();
      if (result.paid) {
        setSyncMsg(
          `Payment confirmed (${result.planId || "paid"}). Refreshing your dashboard…`
        );
        onPaymentSuccess?.();
        // Plan lives on shops/{uid}; router reads it on remount — force full reload so Pro opens
        setTimeout(() => {
          window.location.assign("/shop/dashboard");
        }, 800);
      } else {
        setSyncMsg(
          result.message ||
            "No paid session found yet. Start Pay with PayMongo, authorize in the PayMongo tab, then click Confirm (even if you closed that tab)."
        );
      }
    } catch (err) {
      setSyncMsg(err.message || "Could not confirm payment.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div>
      <div className="db-page-header">
        <div className="db-page-title">Upgrade Your Plan</div>
        <div className="db-page-sub">
          Choose how you'd like to pay — PayMongo (GCash, Maya, card), or manual transfer for admin review.
        </div>
      </div>

      <div style={{
        background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 12,
        padding: "14px 16px", marginBottom: 18, fontSize: 12.5, color: "#92400E", lineHeight: 1.55,
      }}>
        Already paid but still Free · Basic? Authorize GCash, then click{" "}
        <strong>Confirm my PayMongo payment</strong> below (works even if you closed the PayMongo tab).
        <div style={{ marginTop: 10 }}>
          <button
            type="button"
            disabled={syncing}
            onClick={handleConfirmPaid}
            style={{
              padding: "9px 14px", borderRadius: 8, border: "none", cursor: syncing ? "wait" : "pointer",
              background: "linear-gradient(135deg,#2C5282,#3B82F6)", color: "#fff", fontWeight: 700, fontSize: 12,
            }}
          >
            {syncing ? "Checking PayMongo…" : "Confirm my PayMongo payment →"}
          </button>
        </div>
        {syncMsg && <div style={{ marginTop: 8, color: "#78350F" }}>{syncMsg}</div>}
      </div>

      {paymentMode === "choose" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
          {/* PayMongo Option */}
          <div
            onClick={() => setPaymentMode("paymongo")}
            style={{ background: "#fff", borderRadius: 14, border: "2px solid #A8C5D8", padding: "24px 20px", cursor: "pointer", textAlign: "center", transition: "all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#154665"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(21,70,101,0.12)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#A8C5D8"; e.currentTarget.style.boxShadow = "none"; }}
          >
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
              <TbCreditCard size={36} color="#154665" />
            </div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#0F172A", marginBottom: 6 }}>Pay with PayMongo</div>
            <div style={{ fontSize: 11.5, color: "#64748B", lineHeight: 1.6, marginBottom: 12 }}>
              Instant activation via PayMongo.<br />GCash, Maya, and cards accepted.
            </div>
            <span style={{ display: "inline-block", fontSize: 10, fontWeight: 700, background: "#E8F1F7", color: "#154665", border: "1px solid #A8C5D8", borderRadius: 20, padding: "2px 10px" }}>RECOMMENDED</span>
          </div>

          {/* Manual Option */}
          <div
            onClick={() => setPaymentMode("manual")}
            style={{ background: "#fff", borderRadius: 14, border: "2px solid #E2E8F0", padding: "24px 20px", cursor: "pointer", textAlign: "center", transition: "all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#94A3B8"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.06)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.boxShadow = "none"; }}
          >
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
              <TbBuildingBank size={36} color="#64748B" />
            </div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#0F172A", marginBottom: 6 }}>Manual Transfer</div>
            <div style={{ fontSize: 11.5, color: "#64748B", lineHeight: 1.6, marginBottom: 12 }}>
              GCash receipt upload.<br />Admin confirms within 24hrs.
            </div>
            <span style={{ display: "inline-block", fontSize: 10, fontWeight: 700, background: "#F8FAFC", color: "#64748B", border: "1px solid #E2E8F0", borderRadius: 20, padding: "2px 10px" }}>MANUAL</span>
          </div>
        </div>
      )}

      {paymentMode === "paymongo" && (
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0", padding: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <button onClick={() => setPaymentMode("choose")} style={{ fontSize: 12, color: "#64748B", background: "none", border: "none", cursor: "pointer", padding: 0 }}>← Back</button>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#0F172A" }}>Pay with PayMongo</div>
          </div>
          <PayMongoPaymentForm onCancel={() => setPaymentMode("choose")} />
        </div>
      )}

      {paymentMode === "manual" && (
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0", padding: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <button onClick={() => setPaymentMode("choose")} style={{ fontSize: 12, color: "#64748B", background: "none", border: "none", cursor: "pointer", padding: 0 }}>← Back</button>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#0F172A" }}>Manual Bank Transfer</div>
          </div>
          <PaymentForm existingRequest={existingPayment || null} onSuccess={onPaymentSuccess} />
        </div>
      )}

      {paymentMode === "choose" && (
        <div className="db-info-box blue">
          <div className="db-info-box-title">Which should I choose?</div>
          <div style={{ fontSize: 12.5, color: "var(--db-ink-2)", lineHeight: 1.8 }}>
            <strong>PayMongo:</strong> Instant — your plan activates immediately after payment.<br />
            <strong>Manual Transfer:</strong> Slower — admin must verify within 24 hours before activation.
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────

export default function ShopDashboardBasic() {
  const navigate = useNavigate();

  const [shop, setShop]                       = useState(null);
  const [projects, setProjects]               = useState([]);
  const [quotations, setQuotations]           = useState([]);
  const [existingPayment, setExistingPayment] = useState(undefined);
  const [loading, setLoading]                 = useState(true);
  const [activeTab, setActiveTab]             = useState("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [toast, setToast]                     = useState(null);
  const [quoteModal, setQuoteModal]           = useState(null);
  const [submitting, setSubmitting]           = useState(false);
  const [chatQuote, setChatQuote]             = useState(null);
  const [estimateConfig, setEstimateConfig]  = useState(null);
  const [showPlanActivatedModal, setShowPlanActivatedModal] = useState(false);
  const prevStatusRef = useRef(null);

  useEffect(() => {
    getRecommendationConfig()
      .then(setEstimateConfig)
      .catch(() => setEstimateConfig(normalizeEngineDoc({})));
  }, []);

  const now = new Date();
  const quotaUsed = quotations.filter(q => {
    const d = q.createdAt?.toDate?.() || new Date(q.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  useEffect(() => {
    (async () => {
      try {
        const [shopData, quotData, paymentData, projectData] = await Promise.all([
          getShopProfile(),
          getShopQuotations().catch((err) => {
            console.warn("Quotations fetch failed:", err.message);
            return [];
          }),
          getMyPaymentRequest().catch(() => null),
          getPostedProjects().catch((err) => {
            console.warn("Projects fetch failed:", err.message);
            return [];
          }),
        ]);
        setShop(shopData);
        setProjects(projectData.slice(0, PROJECT_LIMIT));
        setQuotations(quotData);
        setExistingPayment(paymentData);
      } catch (err) {
        console.error("Dashboard load error:", err);
        showToast("Failed to load data. Please refresh.", "error");
        setExistingPayment(null);
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
      setShop((prev) => ({ id: snap.id, ...prev, ...data, id: snap.id }));
      const { subscriptionStatus } = data;
      if (prevStatusRef.current !== null && prevStatusRef.current !== "active" && subscriptionStatus === "active") {
        setShowPlanActivatedModal(true);
      }
      prevStatusRef.current = subscriptionStatus;
    });
    return () => unsubscribe();
  }, []);

  // Live quotations feed — when a builder accepts/unchecks items and re-submits,
  // that updates the quotation doc directly with no other signal to the shop,
  // so this dashboard needs to reflect it immediately instead of on next reload.
  useEffect(() => {
    if (!auth.currentUser) return;
    const unsubscribe = watchShopQuotations(
      (quotData) => setQuotations(quotData),
      () => {}
    );
    return () => unsubscribe();
  }, []);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handlePaymentSuccess = () => {
    getMyPaymentRequest().then(r => setExistingPayment(r)).catch(() => {});
  };

  const renderContent = () => {
    if (loading && activeTab === "overview") {
      return <div className="db-loading-center"><div className="db-spinner" />Loading dashboard...</div>;
    }
    switch (activeTab) {
      case "overview":   return <Overview shop={shop} quotations={quotations} projects={projects} quotaUsed={quotaUsed} setActiveTab={setActiveTab} />;
      case "projects":   return <Projects projects={projects} quotations={quotations} quotaUsed={quotaUsed} setQuoteModal={setQuoteModal} setActiveTab={setActiveTab} loading={loading} estimateConfig={estimateConfig} suppliedCategories={shop?.suppliedCategories || []} />;
      case "quotations": return (
        <Quotations
          quotations={quotations}
          setActiveTab={setActiveTab}
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
          accentColor="#2C3E50"
          bootstrapQuote={chatQuote}
          onBootstrapped={() => setChatQuote(null)}
        />
      );
      case "supply":     return <SupplyCoverageTab shop={shop} accentColor="#2C5282" onShopUpdated={(next) => setShop((s) => ({ ...s, ...next }))} />;
      case "storefront": return <StorefrontTab shop={shop} plan="basic" accentColor="#2C5282" onShopUpdated={(next) => setShop((s) => ({ ...s, ...next }))} />;
      case "upgrade":    return <Upgrade existingPayment={existingPayment} onPaymentSuccess={handlePaymentSuccess} />;
      case "settings":
      case "profile":
        return (
          <SettingsTab
            shop={shop}
            accentColor="#2C3E50"
            accentGradient="linear-gradient(135deg,#2C3E50,#648DB6)"
            onShopUpdated={(next) => setShop((s) => ({ ...s, ...next }))}
          />
        );
      default:           return <Overview shop={shop} quotations={quotations} projects={projects} quotaUsed={quotaUsed} setActiveTab={setActiveTab} />;
    }
  };

  return (
    <div className="db-shell">
      <aside className={`db-sidebar${sidebarCollapsed ? " is-collapsed" : ""}`}>
        <div className="db-sidebar-logo db-sidebar-logo--toggle">
          {sidebarCollapsed ? (
            <DashboardBrand collapsed />
          ) : (
            <div style={{ flex: 1, minWidth: 0 }}>
              <DashboardBrand subtitle="Shop Manager" compact>
                <PlanBadge />
              </DashboardBrand>
            </div>
          )}
          <button
            type="button"
            className="db-sidebar-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? "Expand menu" : "Collapse menu"}
          >
            <TbMenu2 size={15} />
          </button>
        </div>
        <nav className="db-sidebar-nav">
          {!sidebarCollapsed && <div className="db-nav-section-label">Navigation</div>}
          {NAV.map(item => (
            <button key={item.key}
              className={`db-nav-item${activeTab===item.key?" active":""}${item.isUpgrade?" upgrade-item":""}`}
              onClick={() => setActiveTab(item.key)}
              title={item.label}
            >
              <span style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>{item.icon}</span>
              {!sidebarCollapsed && (
                <>
                  <span>{item.label}</span>
                  {item.isUpgrade && <span className="db-nav-badge-new">UPGRADE</span>}
                </>
              )}
            </button>
          ))}
        </nav>
        <div className="db-sidebar-footer">
          <div className="db-sidebar-user">
            <div className="db-sidebar-avatar">{initials(shop?.shopName)}</div>
            {!sidebarCollapsed && (
              <div style={{ minWidth:0 }}>
                <div className="db-sidebar-user-name">{shop?.shopName || "Loading..."}</div>
                <div className="db-sidebar-user-role">{shop?.ownerName || ""}</div>
              </div>
            )}
          </div>
          {!sidebarCollapsed ? (
            <button className="db-signout-btn" onClick={async () => { await logoutShop(); navigate("/login", { replace: true }); }}>
              Sign Out
            </button>
          ) : (
            <button
              type="button"
              className="db-signout-btn db-signout-btn--icon"
              title="Sign Out"
              onClick={async () => { await logoutShop(); navigate("/login", { replace: true }); }}
            >
              <TbLogout size={15} />
            </button>
          )}
        </div>
      </aside>

      <div className="db-main-col">
        <header className="db-topbar">
          <div className="db-topbar-left">
            <button
              type="button"
              className="db-mobile-trigger"
              aria-label="Open menu"
              onClick={() => setMobileNavOpen(true)}
            >
              <TbMenu2 size={20} />
            </button>
            <div>
              <div className="db-topbar-title">{NAV.find(n=>n.key===activeTab)?.label}</div>
              <div className="db-topbar-breadcrumb">iConstruct · Shop Manager</div>
            </div>
          </div>
          <div className="db-topbar-right">
            <ShopNotificationBell
              extraItems={buildShopQuoteAlerts(quotations).map((a) => ({ ...a, onClick: () => setActiveTab("quotations") }))}
            />
            <PlanBadge />
            <div className="db-topbar-avatar">{initials(shop?.shopName)}</div>
          </div>
        </header>
        <main className="db-content">{renderContent()}</main>
      </div>

      <MobileDrawerNav
        items={NAV}
        activeTab={activeTab}
        onSelect={setActiveTab}
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        accentColor="#2C5282"
        subtitle="Shop Manager"
        onLogout={async () => { await logoutShop(); navigate("/login", { replace: true }); }}
      />

      {quoteModal && (
        <QuoteModal
          project={quoteModal}
          onClose={() => setQuoteModal(null)}
          onSubmit={async ({ projectId, amount, note, items }) => {
            if (quotaUsed >= QUOTA_LIMIT) {
              showToast("Monthly quota reached. Upgrade to Pro.", "error");
              return;
            }
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
          accentColor="#2C3E50"
          accentGradient="linear-gradient(180deg, #2C3E50 30%, #648DB6 100%)"
          estimateConfig={estimateConfig}
          plan="basic"
          suppliedCategories={shop?.suppliedCategories || []}
        />
      )}

      {toast && <div className={`db-toast ${toast.type}`}>{toast.msg}</div>}

      {showPlanActivatedModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.6)", backdropFilter:"blur(8px)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
          <div style={{ background:"#fff", borderRadius:20, padding:"40px 36px", width:"100%", maxWidth:420, textAlign:"center", boxShadow:"0 32px 80px rgba(0,0,0,0.25)", position:"relative", overflow:"hidden" }}>
            <div style={{ position:"absolute", top:0, left:0, right:0, height:4, background:"linear-gradient(90deg,#7C3AED,#6D28D9)", borderRadius:"20px 20px 0 0" }} />
            <div style={{ width:72, height:72, borderRadius:"50%", background:"linear-gradient(135deg,#D1FAE5,#A7F3D0)", border:"2px solid #6EE7B7", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 20px" }}>
              <TbConfetti size={36} color="#059669" />
            </div>
            <div style={{ fontFamily:"var(--font-display)", fontSize:22, fontWeight:900, color:"#0F172A", marginBottom:8 }}>Subscription Activated!</div>
            <p style={{ fontSize:14, color:"#64748B", lineHeight:1.7, marginBottom:8 }}>
              Your plan has been confirmed by the admin and is now <strong style={{ color:"#059669" }}>active</strong>.
            </p>
            <p style={{ fontSize:13, color:"#94A3B8", lineHeight:1.6, marginBottom:28 }}>
              To apply your new subscription features, please <strong style={{ color:"#0F172A" }}>sign out and log back in</strong>.
            </p>
            <div style={{ background:"#FFF7ED", border:"1px solid #FED7AA", borderRadius:10, padding:"12px 16px", marginBottom:24, fontSize:12.5, color:"#92400E", lineHeight:1.6, display:"flex", alignItems:"flex-start", gap:8 }}>
              <TbAlertTriangle size={15} style={{ flexShrink:0, marginTop:1 }} color="#D97706" />
              You must sign out and sign back in for your upgraded plan to take effect.
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => setShowPlanActivatedModal(false)} style={{ flex:1, padding:"12px", borderRadius:10, border:"1.5px solid rgba(44,62,80,0.15)", background:"transparent", color:"rgba(44,62,80,0.6)", fontSize:13, fontWeight:500, cursor:"pointer" }}>
                Remind Me Later
              </button>
              <button onClick={async () => { await logoutShop(); navigate("/login", { replace: true }); }} style={{ flex:2, padding:"12px", borderRadius:10, border:"none", background:"linear-gradient(135deg,#7C3AED,#6D28D9)", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", boxShadow:"0 4px 14px rgba(124,58,237,0.3)" }}>
                Sign Out &amp; Log In Again →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}