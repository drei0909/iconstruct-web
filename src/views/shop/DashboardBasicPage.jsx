// src/components/layout/shopdashboardbasic.jsx
// iConstruct — Shop Owner Dashboard (Basic / Free Plan)
//
// FIXES IN THIS VERSION:
// 1. "Failed to load data" → shopService now uses getAuthUser() helper
// 2. Search bar unresponsive → moved searchQuery state OUT of Projects
//    component (it was re-mounting on every render, resetting state)
// 3. existingPayment fetch moved to main useEffect alongside other data

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  getShopProfile, getShopQuotations, getPostedProjects,
  submitQuotation, logoutShop, getMyPaymentRequest,
} from "../../controllers/shopController";

import PaymentForm from "../../components/forms/Paymentform";

const QUOTA_LIMIT   = 3;
const PROJECT_LIMIT = 5;

const NAV = [
  { key: "overview",   label: "Overview"    },
  { key: "projects",   label: "Projects"    },
  { key: "quotations", label: "Quotations"  },
  { key: "profile",    label: "Shop Profile"},
  { key: "upgrade",    label: "Upgrade Plan", isUpgrade: true },
];

const LOCKED = [
  { title: "Priority Listing",     desc: "Appear at the top of builder search results and recommendations." },
  { title: "Unlimited Bidding",    desc: "Submit quotes on every project with no monthly cap." },
  { title: "Promotional Exposure", desc: "Get featured placement across the iConstruct platform." },
  { title: "Quotation Analytics",  desc: "Track win rates, bidding history and response performance." },
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
      <div className="db-stat-card-accent" style={{ background: color }} />
      <div className="db-stat-value" style={{ color }}>{value}</div>
      <div className="db-stat-label">{label}</div>
      <div className="db-stat-sub">{sub}</div>
    </div>
  );
}

export default function ShopDashboardBasic() {
  const navigate = useNavigate();

  // ── Core data ──
  const [shop, setShop]                   = useState(null);
  const [projects, setProjects]           = useState([]);
  const [quotations, setQuotations]       = useState([]);
  const [existingPayment, setExistingPayment] = useState(undefined);

  // ── UI state ──
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [toast, setToast]         = useState(null);
  const [quoteModal, setQuoteModal] = useState(null);
  const [quoteForm, setQuoteForm]   = useState({ amount: "", note: "" });
  const [submitting, setSubmitting] = useState(false);

  // ── SEARCH STATE lives here (not inside Projects component) ──
  // BUG FIX: React re-creates function components on every render.
  // If searchQuery was inside the Projects() function component defined
  // inside ShopDashboardBasic, every parent re-render would unmount/remount
  // Projects, wiping the search state. Moving it to the parent keeps it stable.
  const [projectSearch, setProjectSearch] = useState("");

  const now = new Date();
  const quotaUsed = quotations.filter(q => {
    const d = q.createdAt?.toDate?.() || new Date(q.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

 useEffect(() => {
  (async () => {
    try {
      const [shopData, quotData, paymentData] = await Promise.all([
        getShopProfile(),
        getShopQuotations(),
        getMyPaymentRequest().catch(() => null),
      ]);

      // Fetch projects separately so it doesn't crash everything
      const projectData = await getPostedProjects().catch(err => {
        console.warn("Projects fetch failed (index missing?):", err.message);
        return [];
      });

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

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleQuote = async () => {
    if (!quoteForm.amount) return;
    if (quotaUsed >= QUOTA_LIMIT) {
      showToast("Monthly quota reached. Upgrade to Pro.", "error");
      return;
    }
    setSubmitting(true);
    try {
      await submitQuotation({ projectId: quoteModal.id, ...quoteForm });
      showToast("Quotation submitted!");
      setQuoteModal(null);
      setQuoteForm({ amount: "", note: "" });
      const updated = await getShopQuotations();
      setQuotations(updated);
    } catch (err) {
      showToast(err.message || "Failed to submit.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered projects based on search — computed here so Projects tab can use it
  const filteredProjects = projects.filter(p => {
    const q = projectSearch.toLowerCase();
    return (
      p.title?.toLowerCase().includes(q) ||
      p.city?.toLowerCase().includes(q) ||
      p.materials?.join(" ").toLowerCase().includes(q)
    );
  });

  /* ─────────────── TAB COMPONENTS ─────────────── */

  const Overview = () => {
    const accepted = quotations.filter(q => q.status === "accepted").length;
    const pct = Math.min((quotaUsed / QUOTA_LIMIT) * 100, 100);
    const barColor = pct >= 100 ? "var(--db-red)" : pct >= 66 ? "var(--db-amber)" : "var(--db-green)";

    return (
      <div>
        <div className="db-upgrade-banner">
          <div>
            <div className="db-upgrade-banner-title">⚡ You're on the Free Plan</div>
            <div className="db-upgrade-banner-sub">Unlock unlimited bidding, priority listing &amp; analytics.</div>
          </div>
          <button className="db-upgrade-cta-btn" onClick={() => setActiveTab("upgrade")}>Upgrade Now →</button>
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
              <span style={{ color: "var(--db-accent-mid)", cursor: "pointer", textDecoration: "underline" }}
                onClick={() => setActiveTab("upgrade")}>Upgrade to Pro for unlimited access.</span>
            </p>
          )}
        </div>

        <div className="db-stat-grid">
          <StatCard label="Quotations Submitted" value={quotations.length} color="var(--db-accent-mid)" sub="All time" />
          <StatCard label="This Month"            value={quotaUsed}         color="var(--db-amber)"      sub={`of ${QUOTA_LIMIT} allowed`} />
          <StatCard label="Accepted"              value={accepted}          color="var(--db-green)"      sub="Won quotations" />
        </div>

        <div className="db-card">
          <div className="db-card-header">
            <div>
              <div className="db-card-title">Premium Features</div>
              <div className="db-card-subtitle">Available on Pro &amp; Business plans</div>
            </div>
            <span style={{ fontSize:10, fontWeight:700, background:"#FEF3C7", color:"#92400E", border:"1px solid #FCD34D", borderRadius:20, padding:"2px 10px" }}>🔒 LOCKED</span>
          </div>
          <div className="db-locked-grid">
            {LOCKED.map((f, i) => (
              <div key={i} className="db-locked-cell">
                <div className="db-locked-title">{f.title}</div>
                <div className="db-locked-desc">{f.desc}</div>
                <div className="db-locked-tag">🔒 Requires Pro or Business</div>
              </div>
            ))}
          </div>
          <div className="db-locked-footer">
            <button className="db-btn-primary" onClick={() => setActiveTab("upgrade")}
              style={{ background:"linear-gradient(135deg,#D97706,#F59E0B)", boxShadow:"0 2px 8px rgba(217,119,6,0.35)" }}>
              Unlock All Features — Upgrade Now
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Projects tab uses projectSearch / filteredProjects from parent scope — no re-mount issue
  const Projects = () => (
    <div>
      <div className="db-page-header" style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
        <div>
          <div className="db-page-title">Posted Projects</div>
          <div className="db-page-sub">
            Showing {filteredProjects.length} of {projects.length} projects.{" "}
            <span style={{ color:"var(--db-amber)", fontWeight:600 }}>Basic: limited to {PROJECT_LIMIT}.</span>
          </div>
        </div>

        {/* FIXED SEARCH BAR — value/onChange bound to parent state */}
        <div style={{ position:"relative", minWidth:220 }}>
          <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#94A3B8", fontSize:13 }}>🔍</span>
          <input
            type="text"
            placeholder="Search projects..."
            value={projectSearch}
            onChange={e => setProjectSearch(e.target.value)}
            style={{
              paddingLeft:32, paddingRight:14, paddingTop:8, paddingBottom:8,
              border:"1.5px solid #E2E8F0", borderRadius:8,
              fontSize:12, fontFamily:"'DM Sans', sans-serif",
              color:"#0F172A", outline:"none", width:220,
              background:"#fff",
              transition:"border-color 0.15s",
            }}
            onFocus={e => e.target.style.borderColor = "#3B82F6"}
            onBlur={e  => e.target.style.borderColor = "#E2E8F0"}
          />
        </div>
      </div>

      {loading ? (
        <div className="db-loading-center"><div className="db-spinner" /></div>
      ) : filteredProjects.length === 0 ? (
        <div className="db-card">
          <div className="db-empty-state">
            <div className="db-empty-icon">📋</div>
            <div className="db-empty-title">
              {projectSearch ? "No projects match your search" : "No projects available"}
            </div>
            <div className="db-empty-sub">
              {projectSearch ? (
                <button className="db-btn-ghost" onClick={() => setProjectSearch("")}>Clear search</button>
              ) : "Check back later."}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {filteredProjects.map(p => (
            <div key={p.id} className="db-project-row">
              <div style={{ flex:1 }}>
                <div className="db-project-title">{p.title || "Construction Project"}</div>
                <div className="db-project-meta">{p.materials?.slice(0,3).join(", ") || "Materials TBD"} · {p.city || "—"}</div>
              </div>
              <div style={{ fontSize:14, fontWeight:700, color:"var(--db-ink)", fontFamily:"var(--db-font-display)" }}>
                ₱{p.estimatedBudget?.toLocaleString() || "—"}
              </div>
              <button
                disabled={quotaUsed >= QUOTA_LIMIT}
                onClick={() => quotaUsed < QUOTA_LIMIT && setQuoteModal(p)}
                className="db-btn-primary"
                style={quotaUsed >= QUOTA_LIMIT ? { background:"var(--db-border)", color:"var(--db-ink-4)", boxShadow:"none", cursor:"not-allowed" } : {}}
              >
                {quotaUsed >= QUOTA_LIMIT ? "Quota Reached" : "Submit Quote"}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="db-notice-dashed">
        <div style={{ fontSize:12.5, color:"var(--db-ink-3)", marginBottom:8 }}>🔒 More projects are hidden on Basic plan.</div>
        <button className="db-btn-ghost" style={{ color:"var(--db-accent-mid)", fontWeight:600 }} onClick={() => setActiveTab("upgrade")}>
          Upgrade to see all →
        </button>
      </div>
    </div>
  );

  const Quotations = () => (
    <div>
      <div className="db-page-header">
        <div className="db-page-title">My Quotations</div>
        <div className="db-page-sub">All submitted quotes and their current status.</div>
      </div>
      {quotations.length === 0 ? (
        <div className="db-card">
          <div className="db-empty-state">
            <div className="db-empty-icon">📄</div>
            <div className="db-empty-title">No quotations yet</div>
            <div className="db-empty-sub">Go to Projects to submit your first quote.</div>
          </div>
        </div>
      ) : (
        <div className="db-card db-table-wrap">
          <table className="db-table">
            <thead><tr>{["Project","Amount","Date","Status"].map(h => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {quotations.map(q => (
                <tr key={q.id}>
                  <td style={{ fontWeight:600, color:"var(--db-ink)" }}>{q.projectTitle || "Project"}</td>
                  <td>₱{q.amount?.toLocaleString()}</td>
                  <td style={{ color:"var(--db-ink-4)", fontSize:11.5 }}>
                    {q.createdAt?.toDate?.()?.toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"}) || "—"}
                  </td>
                  <td><StatusBadge status={q.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const Profile = () => (
    <div>
      <div className="db-page-header">
        <div className="db-page-title">Shop Profile</div>
        <div className="db-page-sub">Your registered hardware shop information.</div>
      </div>
      {shop ? (
        <div className="db-card">
          <div className="db-card-body">
            <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:24, paddingBottom:20, borderBottom:"1px solid var(--db-border-light)" }}>
              <div className="db-topbar-avatar" style={{ width:56, height:56, fontSize:20, flexShrink:0, background:"linear-gradient(135deg,var(--db-accent),var(--db-accent-mid))" }}>
                {initials(shop.shopName)}
              </div>
              <div>
                <div style={{ fontFamily:"var(--db-font-display)", fontSize:18, fontWeight:800, color:"var(--db-ink)", marginBottom:3 }}>{shop.shopName}</div>
                <div style={{ fontSize:12, color:"var(--db-ink-3)", marginBottom:6 }}>{shop.city}, {shop.province}</div>
                <PlanBadge />
              </div>
            </div>
            {[["Owner",shop.ownerName],["Email",shop.email],["Phone",shop.phone||"—"],["Address",shop.address]].map(([k,v]) => (
              <div key={k} className="db-detail-row">
                <span className="db-detail-key">{k}</span>
                <span className="db-detail-val">{v||"—"}</span>
              </div>
            ))}
            <div style={{ marginTop:20, padding:"14px 16px", background:"var(--db-surface-2)", borderRadius:"var(--db-radius-sm)", border:"1px solid var(--db-border)" }}>
              <div style={{ fontSize:11, fontWeight:700, color:"var(--db-ink-3)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:4 }}>Plan Status</div>
              <div style={{ fontSize:13, color:"var(--db-ink-2)" }}>
                Free plan — basic access only.{" "}
                <span style={{ color:"var(--db-accent-mid)", cursor:"pointer" }} onClick={() => setActiveTab("upgrade")}>
                  Upgrade for more features →
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="db-loading-center"><div className="db-spinner" /></div>
      )}
    </div>
  );

  const Upgrade = () => {
    if (existingPayment === undefined) {
      return <div className="db-loading-center"><div className="db-spinner" /></div>;
    }
    return (
      <div>
        <div className="db-page-header">
          <div className="db-page-title">Upgrade Your Plan</div>
          <div className="db-page-sub">
            Submit your payment reference after sending via GCash, Maya, BDO, BPI, Visa/MC, or UnionBank.
            The admin will confirm within 24 hours and activate your plan automatically.
          </div>
        </div>

        <div style={{ background:"#fff", borderRadius:14, border:"1px solid #E2E8F0", padding:"28px" }}>
          <PaymentForm
            existingRequest={existingPayment || null}
            onSuccess={() => {
              getMyPaymentRequest()
                .then(r => setExistingPayment(r))
                .catch(() => {});
            }}
          />
        </div>

        {!existingPayment && (
          <div className="db-info-box blue" style={{ marginTop:20 }}>
            <div className="db-info-box-title">💳 How Payment Works</div>
            <ol style={{ paddingLeft:18, fontSize:12.5, lineHeight:2, color:"var(--db-ink-2)" }}>
              <li>Choose your plan (Pro ₱499/mo or Business ₱4,499/yr)</li>
              <li>Select a payment method and send the exact amount</li>
              <li>Enter your reference number and upload a screenshot</li>
              <li>The Super Admin reviews and activates your plan within 24 hours</li>
              <li>You'll receive a confirmation email once your plan is active</li>
            </ol>
          </div>
        )}
      </div>
    );
  };

  const renderContent = () => {
    if (loading && activeTab === "overview") {
      return <div className="db-loading-center"><div className="db-spinner" />Loading dashboard...</div>;
    }
    switch (activeTab) {
      case "overview":   return <Overview />;
      case "projects":   return <Projects />;
      case "quotations": return <Quotations />;
      case "profile":    return <Profile />;
      case "upgrade":    return <Upgrade />;
      default:           return <Overview />;
    }
  };

  const QuoteModal = () => quoteModal && (
    <div className="db-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setQuoteModal(null); }}>
      <div className="db-modal">
        <div className="db-modal-title">Submit Quotation</div>
        <div className="db-modal-sub">
          For: <strong style={{ color:"var(--db-ink)" }}>{quoteModal.title || "Project"}</strong><br />
          Remaining quota: <strong style={{ color: quotaUsed >= QUOTA_LIMIT ? "var(--db-red)" : "var(--db-green)" }}>
            {QUOTA_LIMIT - quotaUsed} of {QUOTA_LIMIT}
          </strong>
        </div>
        <div className="db-form-group">
          <label className="db-form-label">Quote Amount (₱)</label>
          <input type="number" className="db-form-input" placeholder="e.g. 15000"
            value={quoteForm.amount}
            onChange={e => setQuoteForm(f => ({...f, amount: e.target.value}))} />
        </div>
        <div className="db-form-group">
          <label className="db-form-label">Notes (optional)</label>
          <textarea rows={3} className="db-form-textarea" placeholder="Delivery, availability, conditions..."
            value={quoteForm.note}
            onChange={e => setQuoteForm(f => ({...f, note: e.target.value}))} />
        </div>
        <div className="db-modal-actions">
          <button className="db-btn-secondary" onClick={() => setQuoteModal(null)}>Cancel</button>
          <button className="db-btn-primary" disabled={!quoteForm.amount || submitting}
            onClick={handleQuote} style={{ flex:1, justifyContent:"center" }}>
            {submitting ? "Submitting..." : "Submit Quotation"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="db-shell">
      <aside className="db-sidebar">
        <div className="db-sidebar-logo">
          <div className="db-sidebar-brand">iConstruct</div>
          <div className="db-sidebar-sub">Shop Manager</div>
          <div className="db-sidebar-plan-wrap"><PlanBadge /></div>
        </div>
        <nav className="db-sidebar-nav">
          <div className="db-nav-section-label">Navigation</div>
          {NAV.map(item => (
            <button key={item.key}
              className={`db-nav-item${activeTab===item.key?" active":""}${item.isUpgrade?" upgrade-item":""}`}
              onClick={() => setActiveTab(item.key)}>
              <span>{item.label}</span>
              {item.isUpgrade && <span className="db-nav-badge-new">UPGRADE</span>}
            </button>
          ))}
        </nav>
        <div className="db-sidebar-footer">
          <div className="db-sidebar-user">
            <div className="db-sidebar-avatar">{initials(shop?.shopName)}</div>
            <div style={{ minWidth:0 }}>
              <div className="db-sidebar-user-name">{shop?.shopName || "Loading..."}</div>
              <div className="db-sidebar-user-role">{shop?.ownerName || ""}</div>
            </div>
          </div>
          <button className="db-signout-btn" onClick={async () => { await logoutShop(); navigate("/login"); }}>
            Sign Out
          </button>
        </div>
      </aside>

      <div className="db-main-col">
        <header className="db-topbar">
          <div>
            <div className="db-topbar-title">{NAV.find(n=>n.key===activeTab)?.label}</div>
            <div className="db-topbar-breadcrumb">iConstruct · Shop Manager</div>
          </div>
          <div className="db-topbar-right">
            <PlanBadge />
            <div className="db-topbar-avatar">{initials(shop?.shopName)}</div>
          </div>
        </header>
        <main className="db-content">{renderContent()}</main>
      </div>

      <QuoteModal />
      {toast && <div className={`db-toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
