// src/views/shop/DashboardProPage.jsx
// FIX: All tab components moved OUTSIDE ShopDashboardPro to prevent
// remount-on-every-keystroke. Each gets only the props it needs.

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  getShopProfile, getShopQuotations, getPostedProjects,
  submitQuotation, logoutShop,
} from "../../controllers/shopController";
import SearchBar from "../../components/ui/SearchBar";
import { useSearch } from "../../hooks/useSearch";
import ProductsTab from "../../components/ProductsTab";
import { auth, db } from "../../services/firebase";
import { doc, onSnapshot } from "firebase/firestore";

import StripePaymentForm from "../../components/forms/StripePaymentForm";
import React from "react";

const NAV = [
  { key: "overview",   label: "Overview",     icon: "⊞" },
  { key: "projects",   label: "All Projects", icon: "📋" },
  { key: "quotations", label: "Quotations",   icon: "📄" },
  { key: "analytics",  label: "Analytics",    icon: "📊" },
  { key: "profile",    label: "Shop Profile", icon: "🏪" },
  { key: "products",   label: "My Products",  icon: "📦" },
  { key: "billing",    label: "Billing",      icon: "💳" },
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
    <div style={{ background:"#fff", borderRadius:14, padding:"20px 22px", border:"1px solid #E2E8F0", position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:color, borderRadius:"14px 14px 0 0" }} />
      <div style={{ fontSize:28, fontWeight:900, color, fontFamily:"'Playfair Display', serif", lineHeight:1, marginBottom:4 }}>{value}</div>
      <div style={{ fontSize:12, fontWeight:600, color:"#0F172A", marginBottom:2 }}>{label}</div>
      <div style={{ fontSize:11, color:"#94A3B8" }}>{sub}</div>
    </div>
  );
}

// ─── TAB COMPONENTS (defined OUTSIDE parent — stable identity, no remount) ────

function Overview({ quotations, projects, accepted, pending, rejected, winRate, monthQuotes, setQuoteModal, setActiveTab }) {
  return (
    <div>
      <div style={{ background:"linear-gradient(135deg,#1D4ED8,#3B82F6)", borderRadius:14, padding:"20px 24px", marginBottom:24, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ fontSize:14, fontWeight:700, color:"#fff", marginBottom:3 }}> Pro Plan Active</div>
          <div style={{ fontSize:12, color:"rgba(255,255,255,0.7)" }}>Priority listing · Unlimited bidding · Analytics · Promotional exposure</div>
        </div>
        <button onClick={() => setActiveTab("billing")} style={{ background:"rgba(255,255,255,0.15)", border:"1px solid rgba(255,255,255,0.3)", borderRadius:8, padding:"8px 16px", fontSize:11.5, fontWeight:600, color:"#fff", cursor:"pointer" }}>Manage Billing →</button>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:24 }}>
        <StatCard label="Total Quotes"    value={quotations.length}  color="#3B82F6" sub="All time submitted" />
        <StatCard label="This Month"      value={monthQuotes.length} color="#10B981" sub="Unlimited on Pro" />
        <StatCard label="Win Rate"        value={`${winRate}%`}      color="#F59E0B" sub="Accepted / submitted" />
        <StatCard label="Active Projects" value={projects.length}    color="#7C3AED" sub="Available to bid" />
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 300px", gap:20 }}>
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
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ background:"linear-gradient(135deg,#EFF6FF,#DBEAFE)", borderRadius:14, border:"1px solid #BFDBFE", padding:"16px 18px" }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#1D4ED8", marginBottom:6 }}>PROMOTIONAL ACTIVE</div>
            <div style={{ fontSize:11, color:"#1E40AF" }}>Your shop is featured in builder recommendations.</div>
          </div>
          <div style={{ background:"#fff", borderRadius:14, border:"1px solid #E2E8F0", padding:"16px 18px" }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#0F172A", marginBottom:8 }}>Recent Projects</div>
            {projects.length === 0
              ? <div style={{ fontSize:11, color:"#94A3B8" }}>No open projects yet.</div>
              : projects.slice(0, 3).map(p => (
                  <div key={p.id} style={{ fontSize:12, color:"#334155", marginBottom:6, display:"flex", justifyContent:"space-between" }}>
                    <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:120 }}>{p.title || "Project"}</span>
                    <button onClick={() => setQuoteModal(p)} style={{ fontSize:10, fontWeight:600, color:"#3B82F6", background:"none", border:"none", cursor:"pointer" }}>Quote</button>
                  </div>
                ))
            }
          </div>
        </div>
      </div>
    </div>
  );
}

function AllProjects({ filteredProjects, searchQuery, setSearchQuery, setQuoteModal }) {
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, gap:12 }}>
        <div>
          <h2 style={{ fontFamily:"'Playfair Display', serif", fontSize:19, fontWeight:900, color:"#0F172A", marginBottom:2 }}>All Projects</h2>
          <p style={{ fontSize:12, color:"#64748B" }}>Unlimited project access — Pro plan. {filteredProjects.length} available.</p>
        </div>
        <SearchBar
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search projects..."
          accentColor="#3B82F6"
          width={220}
        />
      </div>

      {filteredProjects.length === 0 ? (
        <div style={{ textAlign:"center", padding:64, color:"#94A3B8" }}>
          <div style={{ fontSize:32, marginBottom:8 }}></div>
          <div style={{ fontWeight:600, color:"#0F172A", marginBottom:4 }}>
            {searchQuery ? "No projects match your search" : "No open projects yet"}
          </div>
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} style={{ fontSize:12, color:"#3B82F6", background:"none", border:"none", cursor:"pointer" }}>
              Clear search
            </button>
          )}
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {filteredProjects.map(project => (
            <div key={project.id} style={{ background:"#fff", borderRadius:12, border:"1px solid #E2E8F0", padding:"16px 20px", display:"flex", alignItems:"center", gap:16 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13.5, fontWeight:700, color:"#0F172A", marginBottom:3 }}>{project.title || "Construction Project"}</div>
                <div style={{ fontSize:11.5, color:"#64748B" }}>{project.materials?.slice(0,3).join(", ") || "Materials TBD"} · {project.city || "—"}</div>
              </div>
              <div style={{ fontSize:13, fontWeight:700, color:"#0F172A" }}>₱{project.estimatedBudget?.toLocaleString() || "—"}</div>
              <button onClick={() => setQuoteModal(project)} style={{ padding:"8px 18px", borderRadius:8, border:"none", background:"#1D4ED8", color:"#fff", fontSize:12, fontWeight:600, cursor:"pointer" }}>Submit Quote</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Analytics({ quotations, accepted, pending, rejected, winRate, monthlyBreakdown }) {
  return (
    <div>
      <h2 style={{ fontFamily:"'Playfair Display', serif", fontSize:19, fontWeight:900, color:"#0F172A", marginBottom:4 }}>Analytics</h2>
      <p style={{ fontSize:12, color:"#64748B", marginBottom:20 }}>Quotation performance insights — Pro plan feature.</p>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:20 }}>
        <StatCard label="Total Bids"      value={quotations.length} color="#3B82F6" sub="All time" />
        <StatCard label="Accepted Quotes" value={accepted}          color="#10B981" sub="Won bids" />
        <StatCard label="Win Rate"        value={`${winRate}%`}     color="#F59E0B" sub="Accepted / total" />
      </div>

      <div style={{ background:"#fff", borderRadius:14, border:"1px solid #E2E8F0", overflow:"hidden", marginBottom:16 }}>
        <div style={{ padding:"16px 22px", borderBottom:"1px solid #F1F5F9", fontSize:13, fontWeight:700, color:"#0F172A" }}>Monthly Breakdown</div>
        {monthlyBreakdown.length === 0 ? (
          <div style={{ padding:48, textAlign:"center", color:"#94A3B8", fontSize:12 }}>No quotation data yet. Submit quotes to see your monthly performance.</div>
        ) : (
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"#F8FAFC" }}>
                {["Month","Bids Submitted","Accepted","Rejected","Win Rate"].map(h => (
                  <th key={h} style={{ padding:"10px 16px", fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:"#94A3B8", textAlign:"left", borderBottom:"1px solid #E2E8F0" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthlyBreakdown.map((row, i) => {
                const rate = row.bids > 0 ? Math.round((row.acc / row.bids) * 100) : 0;
                return (
                  <tr key={row.key} onMouseEnter={e => e.currentTarget.style.background="#F8FAFC"} onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                    <td style={{ padding:"12px 16px", fontSize:13, fontWeight:600, color:"#0F172A", borderBottom:i<monthlyBreakdown.length-1?"1px solid #F1F5F9":"none" }}>{row.label}</td>
                    <td style={{ padding:"12px 16px", fontSize:13, color:"#334155", borderBottom:i<monthlyBreakdown.length-1?"1px solid #F1F5F9":"none" }}>{row.bids}</td>
                    <td style={{ padding:"12px 16px", fontSize:13, color:"#10B981", fontWeight:600, borderBottom:i<monthlyBreakdown.length-1?"1px solid #F1F5F9":"none" }}>{row.acc}</td>
                    <td style={{ padding:"12px 16px", fontSize:13, color:"#EF4444", borderBottom:i<monthlyBreakdown.length-1?"1px solid #F1F5F9":"none" }}>{row.rej}</td>
                    <td style={{ padding:"12px 16px", borderBottom:i<monthlyBreakdown.length-1?"1px solid #F1F5F9":"none" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <div style={{ flex:1, height:5, background:"#F1F5F9", borderRadius:3 }}>
                          <div style={{ height:"100%", width:`${rate}%`, background:"#3B82F6", borderRadius:3 }} />
                        </div>
                        <span style={{ fontSize:11, fontWeight:700, color:"#3B82F6", minWidth:32 }}>{rate}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ background:"#fff", borderRadius:14, border:"1px solid #E2E8F0", overflow:"hidden" }}>
        <div style={{ padding:"16px 22px", borderBottom:"1px solid #F1F5F9", fontSize:13, fontWeight:700, color:"#0F172A" }}>Quotation History</div>
        {quotations.length === 0 ? (
          <div style={{ padding:48, textAlign:"center", color:"#94A3B8", fontSize:12 }}>No quotations yet.</div>
        ) : (
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"#F8FAFC" }}>
                {["Project","Amount","Date Submitted","Status"].map(h => (
                  <th key={h} style={{ padding:"10px 16px", fontSize:10, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"#94A3B8", textAlign:"left", borderBottom:"1px solid #E2E8F0" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {quotations.map((q, i) => (
                <tr key={q.id} onMouseEnter={e => e.currentTarget.style.background="#F8FAFC"} onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                  <td style={{ padding:"12px 16px", fontSize:13, fontWeight:600, color:"#0F172A", borderBottom:i<quotations.length-1?"1px solid #F1F5F9":"none" }}>{q.projectTitle || "Project"}</td>
                  <td style={{ padding:"12px 16px", fontSize:13, color:"#334155", borderBottom:i<quotations.length-1?"1px solid #F1F5F9":"none" }}>₱{q.amount?.toLocaleString()}</td>
                  <td style={{ padding:"12px 16px", fontSize:11.5, color:"#94A3B8", borderBottom:i<quotations.length-1?"1px solid #F1F5F9":"none" }}>{q.createdAt?.toDate?.()?.toLocaleDateString("en-PH") || "—"}</td>
                  <td style={{ padding:"12px 16px", borderBottom:i<quotations.length-1?"1px solid #F1F5F9":"none" }}>
                    <span style={{ fontSize:10, fontWeight:700, borderRadius:20, padding:"3px 10px", letterSpacing:"0.08em", textTransform:"uppercase", ...(q.status==="accepted"?{background:"#D1FAE5",color:"#065F46",border:"1px solid #6EE7B7"}:q.status==="rejected"?{background:"#FEE2E2",color:"#991B1B",border:"1px solid #FCA5A5"}:{background:"#FEF3C7",color:"#92400E",border:"1px solid #FCD34D"}) }}>{q.status || "pending"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Profile({ shop }) {
  return (
    <div>
      <h2 style={{ fontFamily:"'Playfair Display', serif", fontSize:19, fontWeight:900, color:"#0F172A", marginBottom:20 }}>Shop Profile</h2>
      {shop ? (
        <div style={{ background:"#fff", borderRadius:14, border:"1px solid #E2E8F0", padding:"28px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:24, paddingBottom:20, borderBottom:"1px solid #F1F5F9" }}>
            <div style={{ width:60, height:60, borderRadius:"50%", background:"linear-gradient(135deg,#1D4ED8,#3B82F6)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, fontWeight:900, color:"#fff" }}>{shop.shopName?.[0] || "S"}</div>
            <div>
              <div style={{ fontSize:18, fontWeight:700, color:"#0F172A", fontFamily:"'Playfair Display', serif" }}>{shop.shopName}</div>
              <div style={{ fontSize:12, color:"#64748B" }}>{shop.city}, {shop.province}</div>
              <div style={{ marginTop:6 }}><PlanBadge /></div>
            </div>
          </div>
          {[["Owner",shop.ownerName],["Email",shop.email],["Phone",shop.phone||"—"],["Address",shop.address],["City",shop.city],["Province",shop.province],["Description",shop.description||"—"]].map(([k,v]) => (
            <div key={k} style={{ display:"flex", gap:12, marginBottom:12, fontSize:13 }}>
              <span style={{ color:"#94A3B8", minWidth:100, flexShrink:0 }}>{k}</span>
              <span style={{ color:"#0F172A", fontWeight:500 }}>{v || "—"}</span>
            </div>
          ))}
        </div>
      ) : <div style={{ textAlign:"center", color:"#94A3B8", padding:48 }}>Loading...</div>}
    </div>
  );
}

// REPLACE the Billing function in BOTH DashboardProPage.jsx AND DashboardBusinessPage.jsx
// Also add this import at the TOP of both files:
// import StripePaymentForm from "../../components/forms/StripePaymentForm";

// ─── FOR DashboardProPage.jsx ────────────────────────────────────────────────
function Billing({ shop, setActiveTab }) {
  const [showRenew, setShowRenew] = React.useState(false);

  return (
    <div>
      <h2 style={{ fontFamily:"'Playfair Display', serif", fontSize:19, fontWeight:900, color:"#0F172A", marginBottom:20 }}>Billing & Subscription</h2>

      {/* Current Plan Info */}
      <div style={{ background:"#fff", borderRadius:14, border:"1px solid #E2E8F0", padding:"24px", marginBottom: 20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20, paddingBottom:20, borderBottom:"1px solid #F1F5F9" }}>
          <div>
            <div style={{ fontFamily:"'Playfair Display', serif", fontSize:18, fontWeight:900, color:"#0F172A", marginBottom:4 }}>Pro Plan</div>
            <div style={{ fontSize:22, fontWeight:900, color:"#3B82F6", fontFamily:"'Playfair Display', serif" }}>
              ₱499<span style={{ fontSize:13, fontWeight:400, color:"#94A3B8" }}>/month</span>
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
          ["Expires",             shop.subscriptionExpiry?.toDate ? shop.subscriptionExpiry.toDate().toLocaleDateString("en-PH",{month:"long",day:"numeric",year:"numeric"}) : "—"],
        ].map(([k,v]) => (
          <div key={k} style={{ display:"flex", gap:12, marginBottom:12, fontSize:13 }}>
            <span style={{ color:"#94A3B8", minWidth:160, flexShrink:0 }}>{k}</span>
            <span style={{ color:"#0F172A", fontWeight:500 }}>{v}</span>
          </div>
        ))}

        {/* Renew Button */}
        {!showRenew && (
          <button
            onClick={() => setShowRenew(true)}
            style={{
              marginTop: 16, padding: "11px 24px", borderRadius: 10, border: "none",
              background: "linear-gradient(135deg,#1D4ED8,#3B82F6)",
              color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
            }}
          >
            Renew / Pay with Stripe →
          </button>
        )}
      </div>

      {/* Stripe Renewal Form */}
      {showRenew && (
        <div style={{ background:"#fff", borderRadius:14, border:"1px solid #BFDBFE", padding:"24px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
            <button
              onClick={() => setShowRenew(false)}
              style={{ fontSize:12, color:"#64748B", background:"none", border:"none", cursor:"pointer", padding:0 }}
            >← Back</button>
            <div style={{ fontWeight:700, fontSize:15, color:"#0F172A" }}>Renew Your Plan</div>
          </div>
          <StripePaymentForm defaultPlan="pro" onCancel={() => setShowRenew(false)} />
        </div>
      )}
    </div>
  );
}


// ─── FOR DashboardBusinessPage.jsx ───────────────────────────────────────────
// Use this version instead — same logic, just different colors and plan
function BillingBusiness({ shop }) {
  const [showRenew, setShowRenew] = React.useState(false);

  return (
    <div>
      <h2 style={{ fontFamily:"'Lora', Georgia, serif", fontSize:19, fontWeight:900, color:"#0F172A", marginBottom:20 }}>Billing & Subscription</h2>

      {/* Current Plan Info */}
      <div style={{ background:"#fff", borderRadius:14, border:"1px solid #E2E8F0", padding:"24px", marginBottom: 20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20, paddingBottom:20, borderBottom:"1px solid #F1F5F9" }}>
          <div>
            <div style={{ fontFamily:"'Lora', Georgia, serif", fontSize:18, fontWeight:900, color:"#0F172A", marginBottom:4 }}>Business Plan</div>
            <div style={{ fontSize:26, fontWeight:900, color:"#7C3AED", fontFamily:"'Lora', Georgia, serif" }}>
              ₱4,499<span style={{ fontSize:13, fontWeight:400, color:"#94A3B8" }}>/year</span>
            </div>
          </div>
          <span style={{ display:"inline-flex", alignItems:"center", background:"linear-gradient(135deg,#7C3AED,#6D28D9)", color:"#fff", borderRadius:20, padding:"3px 12px", fontSize:10, fontWeight:700 }}>
            BUSINESS
          </span>
        </div>
        {shop && [
          ["Shop",                shop.shopName],
          ["Subscription Plan",   shop.subscriptionPlan?.toUpperCase() || "BUSINESS"],
          ["Subscription Status", shop.subscriptionStatus || "active"],
          ["Expires",             shop.subscriptionExpiry?.toDate ? shop.subscriptionExpiry.toDate().toLocaleDateString("en-PH",{month:"long",day:"numeric",year:"numeric"}) : "—"],
        ].map(([k,v]) => (
          <div key={k} style={{ display:"flex", gap:12, marginBottom:12, fontSize:13 }}>
            <span style={{ color:"#94A3B8", minWidth:160, flexShrink:0 }}>{k}</span>
            <span style={{ color:"#0F172A", fontWeight:500 }}>{v}</span>
          </div>
        ))}

        {/* Renew Button */}
        {!showRenew && (
          <button
            onClick={() => setShowRenew(true)}
            style={{
              marginTop: 16, padding: "11px 24px", borderRadius: 10, border: "none",
              background: "linear-gradient(135deg,#7C3AED,#6D28D9)",
              color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
            }}
          >
           Renew / Pay with Stripe →
          </button>
        )}
      </div>

      {/* Stripe Renewal Form */}
      {showRenew && (
        <div style={{ background:"#fff", borderRadius:14, border:"1px solid #DDD6FE", padding:"24px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
            <button
              onClick={() => setShowRenew(false)}
              style={{ fontSize:12, color:"#64748B", background:"none", border:"none", cursor:"pointer", padding:0 }}
            >← Back</button>
            <div style={{ fontWeight:700, fontSize:15, color:"#0F172A" }}>Renew Your Plan</div>
          </div>
          <StripePaymentForm defaultPlan="business" onCancel={() => setShowRenew(false)} />
        </div>
      )}
    </div>
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
  const [toast, setToast]           = useState(null);
  const [quoteModal, setQuoteModal] = useState(null);
  const [quoteForm, setQuoteForm]   = useState({ amount: "", note: "" });
  const [submitting, setSubmitting] = useState(false);
  const [showPlanActivatedModal, setShowPlanActivatedModal] = useState(false);
  const prevStatusRef = useRef(null);

  // Search state lives in parent — passed as props, NOT causing tab remount
  const [searchQuery, setSearchQuery, debouncedSearch] = useSearch("");

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

  const handleQuote = async () => {
    if (!quoteForm.amount) return;
    setSubmitting(true);
    try {
      await submitQuotation({ projectId: quoteModal.id, ...quoteForm });
      showToast("Quotation submitted!");
      setQuoteModal(null);
      setQuoteForm({ amount: "", note: "" });
      const updated = await getShopQuotations();
      setQuotations(updated);
    } catch { showToast("Failed to submit.", "error"); }
    finally { setSubmitting(false); }
  };

  // Derived stats
  const accepted    = quotations.filter(q => q.status === "accepted").length;
  const pending     = quotations.filter(q => q.status === "pending").length;
  const rejected    = quotations.filter(q => q.status === "rejected").length;
  const winRate     = quotations.length > 0 ? Math.round((accepted / quotations.length) * 100) : 0;
  const now         = new Date();
  const monthQuotes = quotations.filter(q => {
    const d = q.createdAt?.toDate?.() || new Date(q.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const monthlyBreakdown = (() => {
    const map = {};
    quotations.forEach(q => {
      const d = q.createdAt?.toDate?.() || new Date(q.createdAt);
      if (!d || isNaN(d)) return;
      const key   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-PH", { month: "long", year: "numeric" });
      if (!map[key]) map[key] = { key, label, bids: 0, acc: 0, rej: 0 };
      map[key].bids++;
      if (q.status === "accepted") map[key].acc++;
      if (q.status === "rejected") map[key].rej++;
    });
    return Object.values(map).sort((a, b) => b.key.localeCompare(a.key)).slice(0, 6);
  })();

  const filteredProjects = projects.filter(p =>
    p.title?.toLowerCase().includes(debouncedSearch.trim().toLowerCase()) ||
    p.city?.toLowerCase().includes(debouncedSearch.trim().toLowerCase())
  );

  // Sidebar and Topbar are safe inside — they don't contain search inputs
  const Sidebar = () => (
    <aside style={{ width:228, minHeight:"100vh", flexShrink:0, background:"#0F172A", display:"flex", flexDirection:"column" }}>
      <div style={{ padding:"22px 20px 18px", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ fontFamily:"'Playfair Display', serif", fontSize:17, fontWeight:900, color:"#F1F5F9", marginBottom:3 }}>iConstruct</div>
        <div style={{ fontSize:10, color:"rgba(148,163,184,0.6)", fontWeight:500, letterSpacing:"0.08em", textTransform:"uppercase" }}>Shop Manager</div>
        <div style={{ marginTop:10 }}><PlanBadge /></div>
      </div>
      <div style={{ margin:"12px 14px", padding:"10px 14px", background:"rgba(59,130,246,0.12)", borderRadius:10, border:"1px solid rgba(59,130,246,0.2)" }}>
        <div style={{ fontSize:10, fontWeight:700, color:"#93C5FD", marginBottom:2 }}>PRIORITY LISTING ACTIVE</div>
        <div style={{ fontSize:10, color:"rgba(148,163,184,0.7)" }}>Your shop ranks higher in search results.</div>
      </div>
      <nav style={{ flex:1, padding:"4px 0" }}>
        {NAV.map(item => {
          const isActive = activeTab === item.key;
          return (
            <button key={item.key} onClick={() => setActiveTab(item.key)} style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"10px 20px", border:"none", cursor:"pointer", fontFamily:"'DM Sans', sans-serif", fontSize:13, fontWeight:isActive?600:400, background:isActive?"rgba(59,130,246,0.15)":"transparent", color:isActive?"#93C5FD":"rgba(148,163,184,0.65)", borderLeft:isActive?"2px solid #3B82F6":"2px solid transparent", textAlign:"left", transition:"all 0.15s" }}>
              <span style={{ fontSize:14 }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div style={{ padding:"14px 20px", borderTop:"1px solid rgba(255,255,255,0.06)" }}>
        {shop && (
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:12, fontWeight:600, color:"#F1F5F9", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{shop.shopName}</div>
            <div style={{ fontSize:10, color:"rgba(148,163,184,0.5)" }}>{shop.ownerName}</div>
          </div>
        )}
        <button onClick={async () => { await logoutShop(); navigate("/login"); }} style={{ width:"100%", padding:"8px", borderRadius:8, border:"1px solid rgba(239,68,68,0.3)", background:"rgba(239,68,68,0.1)", color:"#F87171", fontSize:11.5, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans', sans-serif" }}>Sign Out</button>
      </div>
    </aside>
  );

  const Topbar = () => (
    <header style={{ height:58, background:"#fff", borderBottom:"1px solid #E2E8F0", display:"flex", alignItems:"center", padding:"0 28px", justifyContent:"space-between", position:"sticky", top:0, zIndex:50 }}>
      <div style={{ fontSize:15, fontWeight:700, color:"#0F172A" }}>{NAV.find(n=>n.key===activeTab)?.label}</div>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <PlanBadge />
        <div style={{ width:34, height:34, borderRadius:"50%", background:"linear-gradient(135deg,#1E3A5F,#3B82F6)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:"#fff" }}>
          {shop?.shopName?.[0] || "S"}
        </div>
      </div>
    </header>
  );

  const renderContent = () => {
    switch (activeTab) {
      case "overview":   return <Overview quotations={quotations} projects={projects} accepted={accepted} pending={pending} rejected={rejected} winRate={winRate} monthQuotes={monthQuotes} setQuoteModal={setQuoteModal} setActiveTab={setActiveTab} />;
      case "projects":   return <AllProjects filteredProjects={filteredProjects} searchQuery={searchQuery} setSearchQuery={setSearchQuery} setQuoteModal={setQuoteModal} />;
      case "quotations":
      case "analytics":  return <Analytics quotations={quotations} accepted={accepted} pending={pending} rejected={rejected} winRate={winRate} monthlyBreakdown={monthlyBreakdown} />;
      case "profile":    return <Profile shop={shop} />;
      case "products":   return <ProductsTab plan="pro" />;
      case "billing":    return <Billing shop={shop} setActiveTab={setActiveTab} />;
      default:           return <Overview quotations={quotations} projects={projects} accepted={accepted} pending={pending} rejected={rejected} winRate={winRate} monthQuotes={monthQuotes} setQuoteModal={setQuoteModal} setActiveTab={setActiveTab} />;
    }
  };

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700;900&display=swap');*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'DM Sans',sans-serif;}`}</style>
      <div style={{ display:"flex", minHeight:"100vh", background:"#F8FAFC" }}>
        <Sidebar />
        <div style={{ flex:1, display:"flex", flexDirection:"column" }}>
          <Topbar />
          <main style={{ flex:1, padding:28, overflowY:"auto" }}>
            {loading ? <div style={{ textAlign:"center", padding:80, color:"#94A3B8" }}>Loading dashboard...</div> : renderContent()}
          </main>
        </div>
      </div>

      {/* Quote Modal */}
      {quoteModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.5)", backdropFilter:"blur(6px)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}
          onClick={e => { if(e.target===e.currentTarget) setQuoteModal(null); }}>
          <div style={{ background:"#fff", borderRadius:18, width:"100%", maxWidth:440, padding:"28px", boxShadow:"0 40px 100px rgba(0,0,0,0.25)" }}>
            <h4 style={{ fontFamily:"'Playfair Display', serif", fontSize:17, fontWeight:700, color:"#0F172A", marginBottom:4 }}>Submit Quotation</h4>
            <p style={{ fontSize:12, color:"#64748B", marginBottom:20 }}>For: <strong style={{ color:"#0F172A" }}>{quoteModal.title || "Construction Project"}</strong></p>
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:11.5, fontWeight:600, color:"#334155", display:"block", marginBottom:5 }}>Quote Amount (₱)</label>
              <input type="number" placeholder="e.g. 15000" value={quoteForm.amount} onChange={e => setQuoteForm(f=>({...f,amount:e.target.value}))} style={{ width:"100%", padding:"10px 14px", border:"1.5px solid #E2E8F0", borderRadius:8, fontSize:13, fontFamily:"'DM Sans', sans-serif", outline:"none", color:"#0F172A" }} />
            </div>
            <div style={{ marginBottom:20 }}>
              <label style={{ fontSize:11.5, fontWeight:600, color:"#334155", display:"block", marginBottom:5 }}>Notes (optional)</label>
              <textarea rows={3} value={quoteForm.note} onChange={e => setQuoteForm(f=>({...f,note:e.target.value}))} style={{ width:"100%", padding:"10px 14px", border:"1.5px solid #E2E8F0", borderRadius:8, fontSize:13, fontFamily:"'DM Sans', sans-serif", resize:"none", outline:"none", color:"#0F172A" }} />
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => setQuoteModal(null)} style={{ padding:"11px 20px", borderRadius:8, border:"1px solid #E2E8F0", background:"#F8FAFC", fontSize:12.5, fontWeight:500, color:"#64748B", cursor:"pointer" }}>Cancel</button>
              <button disabled={!quoteForm.amount||submitting} onClick={handleQuote} style={{ flex:1, padding:"11px", borderRadius:8, border:"none", background:quoteForm.amount?"#3B82F6":"#F1F5F9", color:quoteForm.amount?"#fff":"#94A3B8", fontSize:12.5, fontWeight:600, cursor:"pointer" }}>
                {submitting ? "Submitting..." : "Submit Quotation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position:"fixed", bottom:24, right:24, padding:"12px 18px", borderRadius:10, background:toast.type==="error"?"#DC2626":"#0F172A", color:"#fff", fontSize:12.5, fontWeight:500, boxShadow:"0 10px 30px rgba(0,0,0,0.25)", zIndex:500 }}>
          {toast.msg}
        </div>
      )}

      {/* Plan Activation Modal */}
      {showPlanActivatedModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.6)", backdropFilter:"blur(8px)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
          <div style={{ background:"#fff", borderRadius:20, padding:"40px 36px", width:"100%", maxWidth:420, textAlign:"center", boxShadow:"0 32px 80px rgba(0,0,0,0.25)", position:"relative", overflow:"hidden" }}>
            <div style={{ position:"absolute", top:0, left:0, right:0, height:4, background:"linear-gradient(90deg,#1D4ED8,#3B82F6)", borderRadius:"20px 20px 0 0" }} />
            <div style={{ width:72, height:72, borderRadius:"50%", background:"linear-gradient(135deg,#D1FAE5,#A7F3D0)", border:"2px solid #6EE7B7", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 20px", fontSize:32 }}>🎉</div>
            <div style={{ fontFamily:"'Playfair Display', serif", fontSize:22, fontWeight:900, color:"#0F172A", marginBottom:8 }}>Subscription Activated!</div>
            <p style={{ fontSize:14, color:"#64748B", lineHeight:1.7, marginBottom:8 }}>Your plan has been confirmed by the admin and is now <strong style={{ color:"#059669" }}>active</strong>.</p>
            <p style={{ fontSize:13, color:"#94A3B8", lineHeight:1.6, marginBottom:28 }}>To apply your new subscription features, please <strong style={{ color:"#0F172A" }}>sign out and log back in</strong>.</p>
            <div style={{ background:"#FFF7ED", border:"1px solid #FED7AA", borderRadius:10, padding:"12px 16px", marginBottom:24, fontSize:12.5, color:"#92400E", lineHeight:1.6 }}>
              You must sign out and sign back in for your upgraded plan to take effect.
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => setShowPlanActivatedModal(false)} style={{ flex:1, padding:"12px", borderRadius:10, border:"1.5px solid rgba(44,62,80,0.15)", background:"transparent", color:"rgba(44,62,80,0.6)", fontSize:13, fontWeight:500, cursor:"pointer" }}>Remind Me Later</button>
              <button onClick={async () => { await logoutShop(); navigate("/login"); }} style={{ flex:2, padding:"12px", borderRadius:10, border:"none", background:"linear-gradient(135deg,#1D4ED8,#3B82F6)", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", boxShadow:"0 4px 14px rgba(29,78,216,0.3)" }}>
                Sign Out &amp; Log In Again →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}