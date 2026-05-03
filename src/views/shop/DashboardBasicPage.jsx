// src/views/shop/DashboardBasicPage.jsx
// FIX: All tab components moved OUTSIDE ShopDashboardBasic to prevent
// remount-on-every-keystroke. Each gets only the props it needs.

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  getShopProfile, getShopQuotations, getPostedProjects,
  submitQuotation, logoutShop, getMyPaymentRequest,
} from "../../controllers/shopController";
import ProductsTab  from "../../components/ProductsTab";
import PaymentForm  from "../../components/forms/Paymentform";
import SearchBar    from "../../components/ui/SearchBar";
import { useSearch } from "../../hooks/useSearch";
import { auth, db } from "../../services/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { getPlanConfig } from "../../config/planConfig";
import StripePaymentForm from "../../components/forms/StripePaymentForm";
import React from "react";
import QuoteModal from "../../components/QuoteModal";
import SettingsTab from "../../components/SettingsTab";

import {
  TbBolt, TbClipboardList, TbCurrencyDollar, TbRuler2, TbTag,
  TbMapPin, TbConfetti, TbAlertTriangle, TbCreditCard, TbBuildingBank,
} from "react-icons/tb";

const cfg           = getPlanConfig("basic");
const QUOTA_LIMIT   = cfg.quotaLimit;
const PROJECT_LIMIT = cfg.projectLimit;

const NAV = [
  { key: "overview",   label: "Overview"    },
  { key: "projects",   label: "Projects"    },
  { key: "quotations", label: "Quotations"  },
  { key: "profile",    label: "Shop Profile" },
  { key: "products",   label: "My Products" },
  { key: "upgrade",    label: "Upgrade Plan", isUpgrade: true },
  { key: "settings",   label: "Settings" },
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

// ─── TAB COMPONENTS (defined OUTSIDE parent — stable identity, no remount) ────

function Overview({ quotations, projects, quotaUsed, setActiveTab }) {
  const accepted = quotations.filter(q => q.status === "accepted").length;
  const pct      = Math.min((quotaUsed / QUOTA_LIMIT) * 100, 100);
  const barColor = pct >= 100 ? "var(--db-red)" : pct >= 66 ? "var(--db-amber)" : "var(--db-green)";
  return (
    <div>
      <div className="db-upgrade-banner">
        <div>
          <div className="db-upgrade-banner-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <TbBolt size={14} /> You're on the Free Plan
          </div>
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
            <span style={{ color:"var(--db-accent-mid)", cursor:"pointer", textDecoration:"underline" }} onClick={() => setActiveTab("upgrade")}>
              Upgrade to Pro for unlimited access.
            </span>
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

function Projects({ filteredProjects, projects, projectSearch, setProjectSearch, quotaUsed, setQuoteModal, setActiveTab, loading }) {
  return (
    <div>
      <div className="db-page-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div className="db-page-title">Posted Projects</div>
          <div className="db-page-sub">
            Showing {filteredProjects.length} of {projects.length} projects.{" "}
            <span style={{ color: "var(--db-amber)", fontWeight: 600 }}>Basic: limited to {PROJECT_LIMIT}.</span>
          </div>
        </div>
        <SearchBar
          value={projectSearch}
          onChange={e => setProjectSearch(e.target.value)}
          placeholder="Search projects..."
          accentColor="#3B82F6"
          width={220}
        />
      </div>

      {loading ? (
        <div className="db-loading-center"><div className="db-spinner" /></div>
      ) : filteredProjects.length === 0 ? (
        <div className="db-card">
          <div className="db-empty-state">
            <div className="db-empty-icon" style={{ display: "flex", justifyContent: "center" }}>
              <TbClipboardList size={36} color="#CBD5E1" />
            </div>
            <div className="db-empty-title">{projectSearch ? "No projects match your search" : "No projects available"}</div>
            <div className="db-empty-sub">
              {projectSearch
                ? <button className="db-btn-ghost" onClick={() => setProjectSearch("")}>Clear search</button>
                : "Check back later."}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filteredProjects.map(p => (
            <div key={p.id} style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0", padding: "18px 20px", display: "flex", alignItems: "center", gap: 16, transition: "box-shadow 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 16px rgba(44,62,80,0.08)"}
              onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>
                  {p.projectName || "Project"}
                </div>
                <div style={{ fontSize: 12, color: "#64748B", marginBottom: 8 }}>
                  {p.projectType || "—"}
                  {p.materials?.length > 0 && ` · ${p.materials.slice(0, 3).map(m => m.name || m).join(", ")}`}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {p.totalAreaSqm != null && (
                    <span style={{ fontSize: 11, fontWeight: 600, background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE", borderRadius: 20, padding: "3px 10px", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <TbRuler2 size={11} /> {p.totalAreaSqm} sqm
                    </span>
                  )}
                  {p.budget && (
                    <span style={{ fontSize: 11, fontWeight: 600, background: "#F0FDF4", color: "#166534", border: "1px solid #86EFAC", borderRadius: 20, padding: "3px 10px", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <TbCurrencyDollar size={11} /> {p.budget}
                    </span>
                  )}
                  {p.quotationCount != null && (
                    <span style={{ fontSize: 11, fontWeight: 600, background: "#FEF3C7", color: "#92400E", border: "1px solid #FCD34D", borderRadius: 20, padding: "3px 10px", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <TbTag size={11} /> {p.quotationCount} bid{p.quotationCount !== 1 ? "s" : ""}
                    </span>
                  )}
                  {p.locationCity && (
                    <span style={{ fontSize: 11, fontWeight: 600, background: "#F8FAFC", color: "#64748B", border: "1px solid #E2E8F0", borderRadius: 20, padding: "3px 10px", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <TbMapPin size={11} /> {p.locationCity}
                    </span>
                  )}
                </div>
              </div>

              <button
                disabled={quotaUsed >= QUOTA_LIMIT}
                onClick={() => quotaUsed < QUOTA_LIMIT && setQuoteModal(p)}
                className="db-btn-primary"
                style={quotaUsed >= QUOTA_LIMIT
                  ? { background: "var(--db-border)", color: "var(--db-ink-4)", boxShadow: "none", cursor: "not-allowed", flexShrink: 0 }
                  : { flexShrink: 0 }}
              >
                {quotaUsed >= QUOTA_LIMIT ? "Quota Reached" : "Submit Quote"}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="db-notice-dashed">
        <div style={{ fontSize: 12.5, color: "var(--db-ink-3)", marginBottom: 8 }}>More projects are hidden on Basic plan.</div>
        <button className="db-btn-ghost" style={{ color: "var(--db-accent-mid)", fontWeight: 600 }} onClick={() => setActiveTab("upgrade")}>
          Upgrade to see all →
        </button>
      </div>
    </div>
  );
}

function Quotations({ quotations }) {
  const [expanded, setExpanded] = useState(null);
  const toggle = (id) => setExpanded(prev => prev === id ? null : id);

  return (
    <div>
      <div className="db-page-header">
        <div className="db-page-title">My Quotations</div>
        <div className="db-page-sub">All submitted quotes and their current status.</div>
      </div>

      {quotations.length === 0 ? (
        <div className="db-card">
          <div className="db-empty-state">
            <div className="db-empty-icon" style={{ display: "flex", justifyContent: "center" }}>
              <TbClipboardList size={36} color="#CBD5E1" />
            </div>
            <div className="db-empty-title">No quotations yet</div>
            <div className="db-empty-sub">Go to Projects to submit your first quote.</div>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {quotations.map(q => {
            const isOpen   = expanded === q.id;
            const date     = q.createdAt?.toDate?.()?.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) || "—";
            const statusColors = {
              accepted: { bg: "#D1FAE5", color: "#065F46", border: "#6EE7B7" },
              rejected: { bg: "#FEE2E2", color: "#991B1B", border: "#FCA5A5" },
              pending:  { bg: "#FEF3C7", color: "#92400E", border: "#FCD34D" },
            };
            const sc = statusColors[q.status] || statusColors.pending;

            return (
              <div key={q.id} style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0", overflow: "hidden", transition: "box-shadow 0.2s" }}>
                <div onClick={() => toggle(q.id)} style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", cursor: "pointer" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {q.projectTitle || "Project"}
                    </div>
                    <div style={{ fontSize: 11.5, color: "#64748B" }}>{date}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", fontFamily: "var(--font-base)" }}>
                      ₱{q.amount?.toLocaleString()}
                    </div>
                    {q.items?.length > 0 && (
                      <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>
                        {q.items.length} item{q.items.length > 1 ? "s" : ""}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 20, padding: "4px 12px", border: `1px solid ${sc.border}`, background: sc.bg, color: sc.color, letterSpacing: "0.08em", textTransform: "uppercase", flexShrink: 0 }}>
                    {q.status || "pending"}
                  </span>
                  <span style={{ color: "#94A3B8", fontSize: 16, flexShrink: 0, transition: "transform 0.2s", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}>›</span>
                </div>

                {isOpen && (
                  <div style={{ borderTop: "1px solid #F1F5F9", padding: "16px 20px", background: "#FAFAFA" }}>
                    {q.items?.length > 0 ? (
                      <>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Items Quoted</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                          {q.items.map((item, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, padding: "10px 14px" }}>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{item.productName}</div>
                                <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                                  {item.qty} {item.unit} × ₱{item.price?.toLocaleString()}
                                </div>
                              </div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>₱{item.subtotal?.toLocaleString()}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: "1px solid #E2E8F0" }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Total</span>
                          <span style={{ fontSize: 18, fontWeight: 900, color: "#2C3E50", fontFamily: "var(--font-base)" }}>₱{q.amount?.toLocaleString()}</span>
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: 13, color: "#94A3B8" }}>No item breakdown available.</div>
                    )}
                    {q.note && (
                      <div style={{ marginTop: 12, padding: "10px 14px", background: "#F8FAFC", borderRadius: 8, border: "1px solid #E4E9F0" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Note</div>
                        <div style={{ fontSize: 12.5, color: "#334155", lineHeight: 1.6 }}>{q.note}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Profile({ shop, setActiveTab }) {
  return (
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
}

function Upgrade({ existingPayment, onPaymentSuccess }) {
  const [paymentMode, setPaymentMode] = React.useState("choose");

  if (existingPayment === undefined) {
    return <div className="db-loading-center"><div className="db-spinner" /></div>;
  }

  return (
    <div>
      <div className="db-page-header">
        <div className="db-page-title">Upgrade Your Plan</div>
        <div className="db-page-sub">
          Choose how you'd like to pay — instant card payment via Stripe, or manual bank transfer.
        </div>
      </div>

      {paymentMode === "choose" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
          {/* Stripe Option */}
          <div
            onClick={() => setPaymentMode("stripe")}
            style={{ background: "#fff", borderRadius: 14, border: "2px solid #BFDBFE", padding: "24px 20px", cursor: "pointer", textAlign: "center", transition: "all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#3B82F6"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(59,130,246,0.12)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#BFDBFE"; e.currentTarget.style.boxShadow = "none"; }}
          >
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
              <TbCreditCard size={36} color="#3B82F6" />
            </div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#0F172A", marginBottom: 6 }}>Pay with Card</div>
            <div style={{ fontSize: 11.5, color: "#64748B", lineHeight: 1.6, marginBottom: 12 }}>
              Instant activation via Stripe.<br />Visa, Mastercard accepted.
            </div>
            <span style={{ display: "inline-block", fontSize: 10, fontWeight: 700, background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE", borderRadius: 20, padding: "2px 10px" }}>RECOMMENDED</span>
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
              GCash, Maya, BDO, BPI.<br />Admin confirms within 24hrs.
            </div>
            <span style={{ display: "inline-block", fontSize: 10, fontWeight: 700, background: "#F8FAFC", color: "#64748B", border: "1px solid #E2E8F0", borderRadius: 20, padding: "2px 10px" }}>MANUAL</span>
          </div>
        </div>
      )}

      {paymentMode === "stripe" && (
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0", padding: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <button onClick={() => setPaymentMode("choose")} style={{ fontSize: 12, color: "#64748B", background: "none", border: "none", cursor: "pointer", padding: 0 }}>← Back</button>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#0F172A" }}>Pay with Card (Stripe)</div>
          </div>
          <StripePaymentForm onCancel={() => setPaymentMode("choose")} />
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
            <strong>Stripe (Card):</strong> Instant — your plan activates immediately after payment.<br />
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
  const [toast, setToast]                     = useState(null);
  const [quoteModal, setQuoteModal]           = useState(null);
  const [submitting, setSubmitting]           = useState(false);
  const [showPlanActivatedModal, setShowPlanActivatedModal] = useState(false);
  const prevStatusRef = useRef(null);

  const [projectSearch, setProjectSearch, debouncedSearch] = useSearch("");

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
        const projectData = await getPostedProjects().catch(err => {
          console.warn("Projects fetch failed:", err.message);
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

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, "shops", user.uid), (snap) => {
      if (!snap.exists()) return;
      const { subscriptionStatus } = snap.data();
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

  const filteredProjects = projects.filter(p => {
    const q = debouncedSearch.toLowerCase();
    return (
      p.projectName?.toLowerCase().includes(q) ||
      p.locationCity?.toLowerCase().includes(q) ||
      p.materials?.map(m => m.name || m).join(" ").toLowerCase().includes(q)
    );
  });

  const handlePaymentSuccess = () => {
    getMyPaymentRequest().then(r => setExistingPayment(r)).catch(() => {});
  };

  const renderContent = () => {
    if (loading && activeTab === "overview") {
      return <div className="db-loading-center"><div className="db-spinner" />Loading dashboard...</div>;
    }
    switch (activeTab) {
      case "overview":   return <Overview quotations={quotations} projects={projects} quotaUsed={quotaUsed} setActiveTab={setActiveTab} />;
      case "projects":   return <Projects filteredProjects={filteredProjects} projects={projects} projectSearch={projectSearch} setProjectSearch={setProjectSearch} quotaUsed={quotaUsed} setQuoteModal={setQuoteModal} setActiveTab={setActiveTab} loading={loading} />;
      case "quotations": return <Quotations quotations={quotations} />;
      case "profile":    return <Profile shop={shop} setActiveTab={setActiveTab} />;
      case "products":   return <ProductsTab plan="basic" />;
      case "upgrade":    return <Upgrade existingPayment={existingPayment} onPaymentSuccess={handlePaymentSuccess} />;
      case "settings":   return <SettingsTab shop={shop} accentColor="#2C3E50" accentGradient="linear-gradient(135deg,#2C3E50,#648DB6)" />;
      default:           return <Overview quotations={quotations} projects={projects} quotaUsed={quotaUsed} setActiveTab={setActiveTab} />;
    }
  };

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
            <div style={{ fontFamily:"var(--font-base)", fontSize:22, fontWeight:900, color:"#0F172A", marginBottom:8 }}>Subscription Activated!</div>
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
              <button onClick={async () => { await logoutShop(); navigate("/login"); }} style={{ flex:2, padding:"12px", borderRadius:10, border:"none", background:"linear-gradient(135deg,#7C3AED,#6D28D9)", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", boxShadow:"0 4px 14px rgba(124,58,237,0.3)" }}>
                Sign Out &amp; Log In Again →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}