// src/views/shop/ShopDashboardBusiness.jsx
// iConstruct — Shop Owner Dashboard (Business Plan)
// All Pro features + featured placement, advanced analytics, priority support

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  getShopProfile,
  getShopQuotations,
  getPostedProjects,
  submitQuotation,
  getQuotationAnalytics,
  logoutShop,
} from "../../services/shopService";

/* ─── constants ─── */
const PLAN = { name: "Business", color: "#7C3AED", bg: "#F5F3FF", badge: "BUSINESS" };

const NAV = [
  { key: "overview",   label: "Overview",            },
  { key: "projects",   label: "All Projects",        },
  { key: "quotations", label: "Quotations",          },
  { key: "analytics",  label: "Advanced Analytics",  },
  { key: "featured",   label: "Featured Placement",  },
  { key: "profile",    label: "Shop Profile",        },
  { key: "billing",    label: "Billing",             },
];

/* ─── helpers ─── */
function PlanBadge() {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: "linear-gradient(135deg, #7C3AED, #6D28D9)",
      color: "#fff", borderRadius: 20, padding: "3px 12px",
      fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
    }}>💼 BUSINESS</span>
  );
}

function StatCard({ label, value, color, sub, trend, featured }) {
  return (
    <div style={{
      background: featured ? `linear-gradient(135deg, ${color}15, ${color}08)` : "#fff",
      borderRadius: 14, padding: "20px 22px",
      border: featured ? `1px solid ${color}30` : "1px solid #E2E8F0",
      position: "relative", overflow: "hidden",
      transition: "transform 0.2s, box-shadow 0.2s",
    }}
    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 8px 24px ${color}20`; }}
    onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${color}, ${color}80)`, borderRadius: "14px 14px 0 0" }} />
      <div style={{ fontSize: 28, fontWeight: 900, color, fontFamily: "'Playfair Display', serif", lineHeight: 1, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 11, color: "#94A3B8" }}>{sub}</div>
      {trend != null && (
        <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700, color: trend > 0 ? "#10B981" : "#EF4444" }}>
          {trend > 0 ? "↑" : "↓"} {Math.abs(trend)}% vs last month
        </div>
      )}
    </div>
  );
}

/* ─── main component ─── */
export default function ShopDashboardBusiness() {
  const navigate = useNavigate();
  const [shop, setShop]             = useState(null);
  const [projects, setProjects]     = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [analytics, setAnalytics]   = useState(null);
  const [loading, setLoading]       = useState(true);
  const [activeTab, setActiveTab]   = useState("overview");
  const [toast, setToast]           = useState(null);
  const [quoteModal, setQuoteModal] = useState(null);
  const [quoteForm, setQuoteForm]   = useState({ amount: "", note: "" });
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [shopData, projectData, quotData, analyticsData] = await Promise.all([
          getShopProfile(), getPostedProjects(), getShopQuotations(), getQuotationAnalytics(),
        ]);
        setShop(shopData);
        setProjects(projectData);
        setQuotations(quotData);
        setAnalytics(analyticsData);
      } catch { showToast("Failed to load data.", "error"); }
      finally { setLoading(false); }
    })();
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
    } catch { showToast("Failed to submit.", "error"); }
    finally { setSubmitting(false); }
  };

  const filteredProjects = projects.filter(p =>
    p.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.city?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const accepted   = quotations.filter(q => q.status === "accepted").length;
  const pending    = quotations.filter(q => q.status === "pending").length;
  const rejected   = quotations.filter(q => q.status === "rejected").length;
  const winRate    = quotations.length > 0 ? Math.round((accepted / quotations.length) * 100) : 0;
  const monthQuotes = quotations.filter(q => {
    const now = new Date();
    const d = q.createdAt?.toDate?.() || new Date(q.createdAt);
    return d.getMonth() === now.getMonth();
  });

  /* ── Sidebar ── */
  const Sidebar = () => (
    <aside style={{
      width: 240, minHeight: "100vh", flexShrink: 0,
      background: "linear-gradient(175deg, #1E0B3A 0%, #2D1B69 60%, #1E0B3A 100%)",
      display: "flex", flexDirection: "column",
    }}>
      <div style={{ padding: "22px 20px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 900, color: "#F1F5F9", marginBottom: 3 }}>iConstruct</div>
        <div style={{ fontSize: 10, color: "rgba(196,181,253,0.6)", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase" }}>Shop Manager</div>
        <div style={{ marginTop: 10 }}><PlanBadge /></div>
      </div>

      {/* Featured active badge */}
      <div style={{ margin: "12px 14px", padding: "10px 14px", background: "rgba(124,58,237,0.2)", borderRadius: 10, border: "1px solid rgba(124,58,237,0.3)" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#C4B5FD", marginBottom: 2 }}>📣 FEATURED PLACEMENT ACTIVE</div>
        <div style={{ fontSize: 10, color: "rgba(196,181,253,0.6)" }}>Your shop is highlighted across the platform.</div>
      </div>

      {/* Priority listing badge */}
      <div style={{ margin: "0 14px 12px", padding: "10px 14px", background: "rgba(59,130,246,0.15)", borderRadius: 10, border: "1px solid rgba(59,130,246,0.2)" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#93C5FD", marginBottom: 2 }}>📈 PRIORITY LISTING ACTIVE</div>
        <div style={{ fontSize: 10, color: "rgba(147,197,253,0.6)" }}>Ranked #1 in search results.</div>
      </div>

      <nav style={{ flex: 1, padding: "4px 0" }}>
        {NAV.map(item => {
          const isActive = activeTab === item.key;
          return (
            <button key={item.key} onClick={() => setActiveTab(item.key)} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10,
              padding: "10px 20px", border: "none", cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif", fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              background: isActive ? "rgba(124,58,237,0.2)" : "transparent",
              color: isActive ? "#C4B5FD" : "rgba(196,181,253,0.55)",
              borderLeft: isActive ? "2px solid #7C3AED" : "2px solid transparent",
              textAlign: "left", transition: "all 0.15s",
            }}>
              <span style={{ fontSize: 14 }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div style={{ padding: "14px 20px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        {shop && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#F1F5F9" }}>{shop.shopName}</div>
            <div style={{ fontSize: 10, color: "rgba(196,181,253,0.5)" }}>{shop.ownerName}</div>
          </div>
        )}
        <button onClick={async () => { await logoutShop(); navigate("/shop/login"); }} style={{ width: "100%", padding: "8px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)", color: "#F87171", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Sign Out</button>
      </div>
    </aside>
  );

  /* ── Topbar ── */
  const Topbar = () => (
    <header style={{ height: 58, background: "#fff", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", padding: "0 28px", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>{NAV.find(n => n.key === activeTab)?.label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <PlanBadge />
        <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg, #7C3AED, #6D28D9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff" }}>
          {shop?.shopName?.[0] || "S"}
        </div>
      </div>
    </header>
  );

  /* ── Overview ── */
  const Overview = () => (
    <div>
      {/* Business welcome banner */}
      <div style={{
        background: "linear-gradient(135deg, #4C1D95 0%, #7C3AED 50%, #6D28D9 100%)",
        borderRadius: 14, padding: "22px 26px", marginBottom: 24,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        border: "1px solid rgba(196,181,253,0.2)",
        boxShadow: "0 8px 32px rgba(124,58,237,0.3)",
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 4 }}>💼 Business Plan Active</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>
            Featured placement · Priority listing · Unlimited bidding · Advanced analytics · Priority support
          </div>
        </div>
        <button onClick={() => setActiveTab("billing")} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8, padding: "8px 16px", fontSize: 11.5, fontWeight: 600, color: "#fff", cursor: "pointer", whiteSpace: "nowrap" }}>
          Manage Billing →
        </button>
      </div>

      {/* Stats — 5 cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 24 }}>
        <StatCard label="Total Bids" value={quotations.length} color="#7C3AED" sub="All time" trend={18} featured />
        <StatCard label="This Month" value={monthQuotes.length} color="#3B82F6" sub="Unlimited" />
        <StatCard label="Win Rate" value={`${winRate}%`} color="#10B981" sub="Accepted" trend={8} />
        <StatCard label="Active Projects" value={projects.length} color="#F59E0B" sub="All visible" />
        <StatCard label="Revenue Est." value={`₱${((accepted * 15000) / 1000).toFixed(0)}k`} color="#EF4444" sub="Est. from wins" featured />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20 }}>
        {/* Trend chart */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0", padding: "20px 22px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>Business Performance</div>
          <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 16 }}>Bids, wins & estimated revenue — last 6 months</div>
          {[
            { label: "Jan", bids: 3, wins: 2 }, { label: "Feb", bids: 5, wins: 3 },
            { label: "Mar", bids: 4, wins: 3 }, { label: "Apr", bids: 8, wins: 5 },
            { label: "May", bids: 7, wins: 5 }, { label: "Jun", bids: 10, wins: 7 },
          ].map(({ label, bids, wins }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 10, color: "#94A3B8", minWidth: 24 }}>{label}</span>
              <div style={{ flex: 1, height: 16, background: "#F1F5F9", borderRadius: 3, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${(bids / 10) * 100}%`, background: "#7C3AED20", borderRadius: 3 }} />
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${(wins / 10) * 100}%`, background: "#7C3AED", borderRadius: 3 }} />
              </div>
              <span style={{ fontSize: 10, color: "#7C3AED", fontWeight: 700, minWidth: 32 }}>{wins}/{bids}</span>
            </div>
          ))}
          <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 10, color: "#94A3B8" }}>
            <div style={{ display: "flex", gap: 5, alignItems: "center" }}><div style={{ width: 10, height: 10, background: "#7C3AED20", borderRadius: 2 }} /> Bids</div>
            <div style={{ display: "flex", gap: 5, alignItems: "center" }}><div style={{ width: 10, height: 10, background: "#7C3AED", borderRadius: 2 }} /> Wins</div>
          </div>
        </div>

        {/* Right panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Status breakdown */}
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0", padding: "16px 18px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", marginBottom: 12 }}>Quote Status</div>
            {[
              { label: "Accepted", value: accepted, color: "#10B981", bg: "#D1FAE5" },
              { label: "Pending",  value: pending,  color: "#F59E0B", bg: "#FEF3C7" },
              { label: "Rejected", value: rejected, color: "#EF4444", bg: "#FEE2E2" },
            ].map(({ label, value, color, bg }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: "#64748B" }}>{label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, background: bg, color, padding: "2px 10px", borderRadius: 12 }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Featured status */}
          <div style={{ background: "linear-gradient(135deg, #F5F3FF, #EDE9FE)", borderRadius: 14, border: "1px solid #DDD6FE", padding: "16px 18px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#7C3AED", marginBottom: 6 }}>📣 FEATURED STATUS</div>
            <div style={{ fontSize: 11, color: "#6D28D9", lineHeight: 1.6 }}>Your shop appears on the homepage and top of builder recommendations.</div>
            <button onClick={() => setActiveTab("featured")} style={{ marginTop: 10, fontSize: 11, fontWeight: 600, color: "#7C3AED", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Manage placement →</button>
          </div>

          {/* Priority support */}
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0", padding: "14px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>🎯 Priority Support</div>
            <div style={{ fontSize: 11, color: "#64748B" }}>Your issues are handled first. Contact us anytime.</div>
          </div>
        </div>
      </div>

      {/* Recent projects quick access */}
      <div style={{ marginTop: 20, background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0", overflow: "hidden" }}>
        <div style={{ padding: "16px 22px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Recent Projects</div>
          <button onClick={() => setActiveTab("projects")} style={{ fontSize: 11, color: "#7C3AED", fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>View All →</button>
        </div>
        {projects.slice(0, 4).map((p, i) => (
          <div key={p.id} style={{ padding: "13px 22px", borderBottom: i < 3 ? "1px solid #F8FAFC" : "none", display: "flex", alignItems: "center", gap: 12 }}
            onMouseEnter={e => e.currentTarget.style.background = "#FAFAFA"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#7C3AED", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{p.title || "Construction Project"}</div>
              <div style={{ fontSize: 11, color: "#94A3B8" }}>{p.city || "Lipa City"}</div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>₱{p.estimatedBudget?.toLocaleString() || "—"}</div>
            <button onClick={() => setQuoteModal(p)} style={{ padding: "5px 12px", borderRadius: 7, border: "none", background: "linear-gradient(135deg, #7C3AED, #6D28D9)", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Quote</button>
          </div>
        ))}
      </div>
    </div>
  );

  /* ── All Projects ── */
  const AllProjects = () => (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, fontWeight: 900, color: "#0F172A", marginBottom: 2 }}>All Projects</h2>
          <p style={{ fontSize: 12, color: "#64748B" }}>Unlimited project access. {filteredProjects.length} available.</p>
        </div>
        <div style={{ position: "relative" }}>
          <input placeholder="Search projects..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: 32, paddingRight: 14, paddingTop: 8, paddingBottom: 8, border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 12, fontFamily: "'DM Sans', sans-serif", outline: "none", width: 220 }} />
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", fontSize: 12 }}>🔍</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filteredProjects.map(project => (
          <div key={project.id} style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, transition: "box-shadow 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 16px rgba(124,58,237,0.08)"}
            onMouseLeave={e => e.currentTarget.style.boxShadow = ""}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A", marginBottom: 3 }}>{project.title || "Construction Project"}</div>
              <div style={{ fontSize: 11.5, color: "#64748B" }}>{project.materials?.slice(0, 3).join(", ") || "Materials TBD"} · {project.city || "Lipa City"}</div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>₱{project.estimatedBudget?.toLocaleString() || "—"}</div>
            <button onClick={() => setQuoteModal(project)} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #7C3AED, #6D28D9)", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
              Submit Quote
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  /* ── Advanced Analytics ── */
  const AdvancedAnalytics = () => (
    <div>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, fontWeight: 900, color: "#0F172A", marginBottom: 4 }}>Advanced Analytics</h2>
      <p style={{ fontSize: 12, color: "#64748B", marginBottom: 20 }}>Full performance insights — Business plan exclusive.</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
        <StatCard label="Total Bids" value={quotations.length} color="#7C3AED" sub="All time" trend={18} />
        <StatCard label="Win Rate" value={`${winRate}%`} color="#10B981" sub="Acceptance rate" trend={8} />
        <StatCard label="Avg. Response" value="2.4 days" color="#3B82F6" sub="Client response avg." />
        <StatCard label="Est. Revenue" value={`₱${((accepted * 15000) / 1000).toFixed(0)}k`} color="#F59E0B" sub="From accepted quotes" trend={22} />
      </div>

      {/* Detailed monthly table */}
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0", overflow: "hidden", marginBottom: 16 }}>
        <div style={{ padding: "16px 22px", borderBottom: "1px solid #F1F5F9", fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Monthly Breakdown</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#F8FAFC" }}>
              {["Month", "Bids Submitted", "Accepted", "Rejected", "Win Rate", "Est. Revenue"].map(h => (
                <th key={h} style={{ padding: "10px 16px", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#94A3B8", textAlign: "left", borderBottom: "1px solid #E2E8F0" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { month: "June 2026",    bids: 10, acc: 7, rej: 1, rate: 70,  rev: 105000 },
              { month: "May 2026",     bids: 7,  acc: 5, rej: 1, rate: 71,  rev: 75000  },
              { month: "April 2026",   bids: 8,  acc: 5, rej: 2, rate: 63,  rev: 75000  },
              { month: "March 2026",   bids: 4,  acc: 3, rej: 1, rate: 75,  rev: 45000  },
              { month: "February 2026",bids: 5,  acc: 3, rej: 1, rate: 60,  rev: 45000  },
              { month: "January 2026", bids: 3,  acc: 2, rej: 0, rate: 67,  rev: 30000  },
            ].map((row, i) => (
              <tr key={row.month} onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#0F172A", borderBottom: i < 5 ? "1px solid #F1F5F9" : "none" }}>{row.month}</td>
                <td style={{ padding: "12px 16px", fontSize: 13, color: "#334155", borderBottom: i < 5 ? "1px solid #F1F5F9" : "none" }}>{row.bids}</td>
                <td style={{ padding: "12px 16px", fontSize: 13, color: "#10B981", fontWeight: 600, borderBottom: i < 5 ? "1px solid #F1F5F9" : "none" }}>{row.acc}</td>
                <td style={{ padding: "12px 16px", fontSize: 13, color: "#EF4444", borderBottom: i < 5 ? "1px solid #F1F5F9" : "none" }}>{row.rej}</td>
                <td style={{ padding: "12px 16px", borderBottom: i < 5 ? "1px solid #F1F5F9" : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, height: 5, background: "#F1F5F9", borderRadius: 3 }}>
                      <div style={{ height: "100%", width: `${row.rate}%`, background: "#7C3AED", borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#7C3AED", minWidth: 32 }}>{row.rate}%</span>
                  </div>
                </td>
                <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, color: "#0F172A", borderBottom: i < 5 ? "1px solid #F1F5F9" : "none" }}>₱{row.rev.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  /* ── Featured Placement ── */
  const FeaturedPlacement = () => (
    <div>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, fontWeight: 900, color: "#0F172A", marginBottom: 4 }}>Featured Placement</h2>
      <p style={{ fontSize: 12, color: "#64748B", marginBottom: 20 }}>Manage how your shop is featured across the iConstruct platform.</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        {[
          { title: "Homepage Feature", desc: "Your shop appears in the 'Recommended Shops' section on the app homepage.", status: "Active", color: "#10B981" },
          { title: "Search Priority",  desc: "Ranked first when builders search for hardware shops in Lipa City.", status: "Active", color: "#10B981" },
          { title: "Bidding Board Badge", desc: "A 'Business' badge appears on all your submitted quotations.", status: "Active", color: "#10B981" },
          { title: "Promotional Banner", desc: "Rotating promotional slot in the builder's project feed.", status: "Active", color: "#10B981" },
        ].map((item) => (
          <div key={item.title} style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0", padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A" }}>{item.title}</div>
              <span style={{ fontSize: 10, fontWeight: 700, background: "#D1FAE5", color: "#065F46", border: "1px solid #6EE7B7", borderRadius: 20, padding: "2px 8px", whiteSpace: "nowrap" }}>{item.status}</span>
            </div>
            <p style={{ fontSize: 12, color: "#64748B", lineHeight: 1.6 }}>{item.desc}</p>
          </div>
        ))}
      </div>

      <div style={{ background: "linear-gradient(135deg, #F5F3FF, #EDE9FE)", borderRadius: 14, border: "1px solid #DDD6FE", padding: "20px 24px" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#7C3AED", marginBottom: 6 }}>💼 Business Plan Inclusion</div>
        <div style={{ fontSize: 12.5, color: "#6D28D9", lineHeight: 1.6 }}>
          All promotional features above are included in your Business plan at no extra cost. They renew automatically with your annual subscription.
        </div>
      </div>
    </div>
  );

  /* ── Billing ── */
  const Billing = () => (
    <div>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, fontWeight: 900, color: "#0F172A", marginBottom: 20 }}>Billing & Subscription</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20 }}>
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0", padding: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, paddingBottom: 20, borderBottom: "1px solid #F1F5F9" }}>
            <div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, color: "#0F172A", marginBottom: 4 }}>Business Plan</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: "#7C3AED", fontFamily: "'Playfair Display', serif" }}>₱4,499<span style={{ fontSize: 13, fontWeight: 400, color: "#94A3B8" }}>/year</span></div>
            </div>
            <PlanBadge />
          </div>
          {[["Billing Cycle", "Annual"], ["Next Renewal", "January 15, 2027"], ["Payment Method", "GCash — 09XX XXX XXXX"], ["Member Since", "January 2026"], ["Savings vs Monthly", "₱1,489 saved"]].map(([k, v]) => (
            <div key={k} style={{ display: "flex", gap: 12, marginBottom: 12, fontSize: 13 }}>
              <span style={{ color: "#94A3B8", minWidth: 150, flexShrink: 0 }}>{k}</span>
              <span style={{ color: k === "Savings vs Monthly" ? "#10B981" : "#0F172A", fontWeight: k === "Savings vs Monthly" ? 700 : 500 }}>{v}</span>
            </div>
          ))}
          <div style={{ marginTop: 20 }}>
            <button style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#F8FAFC", fontSize: 12.5, fontWeight: 600, color: "#64748B", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel Plan</button>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: "linear-gradient(135deg, #F5F3FF, #EDE9FE)", borderRadius: 14, border: "1px solid #DDD6FE", padding: "18px 20px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#7C3AED", marginBottom: 8 }}>You're saving</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#7C3AED", fontFamily: "'Playfair Display', serif" }}>₱1,489</div>
            <div style={{ fontSize: 11, color: "#6D28D9", marginTop: 4 }}>per year vs monthly Pro plan</div>
          </div>
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0", padding: "18px 20px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", marginBottom: 10 }}>Payment Methods Accepted</div>
            {["GCash", "Maya", "BDO Online", "BPI", "Visa / Mastercard", "UnionBank"].map(m => (
              <div key={m} style={{ fontSize: 11.5, color: "#64748B", marginBottom: 5 }}>✓ {m}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  /* ── Profile ── */
  const Profile = () => (
    <div>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, fontWeight: 900, color: "#0F172A", marginBottom: 20 }}>Shop Profile</h2>
      {shop ? (
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0", padding: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, paddingBottom: 20, borderBottom: "1px solid #F1F5F9" }}>
            <div style={{ width: 60, height: 60, borderRadius: "50%", background: "linear-gradient(135deg, #7C3AED, #6D28D9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 900, color: "#fff", fontFamily: "'Playfair Display', serif" }}>{shop.shopName?.[0] || "S"}</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", fontFamily: "'Playfair Display', serif" }}>{shop.shopName}</div>
              <div style={{ fontSize: 12, color: "#64748B" }}>{shop.city}, {shop.province}</div>
              <div style={{ marginTop: 6 }}><PlanBadge /></div>
            </div>
          </div>
          {[["Owner", shop.ownerName], ["Email", shop.email], ["Phone", shop.phone], ["Address", shop.address], ["Description", shop.description]].map(([k, v]) => (
            <div key={k} style={{ display: "flex", gap: 12, marginBottom: 12, fontSize: 13 }}>
              <span style={{ color: "#94A3B8", minWidth: 100, flexShrink: 0 }}>{k}</span>
              <span style={{ color: "#0F172A", fontWeight: 500 }}>{v || "—"}</span>
            </div>
          ))}
        </div>
      ) : <div style={{ textAlign: "center", color: "#94A3B8", padding: 48 }}>Loading...</div>}
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case "overview":   return <Overview />;
      case "projects":   return <AllProjects />;
      case "quotations": return <AdvancedAnalytics />;
      case "analytics":  return <AdvancedAnalytics />;
      case "featured":   return <FeaturedPlacement />;
      case "profile":    return <Profile />;
      case "billing":    return <Billing />;
      default:           return <Overview />;
    }
  };

  /* ── Quote modal ── */
  const QuoteModal = () => quoteModal && (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(6px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={e => { if (e.target === e.currentTarget) setQuoteModal(null); }}>
      <div style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 440, padding: "28px", boxShadow: "0 40px 100px rgba(0,0,0,0.25)" }}>
        <h4 style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>Submit Quotation</h4>
        <p style={{ fontSize: 12, color: "#64748B", marginBottom: 20 }}>For: <strong style={{ color: "#0F172A" }}>{quoteModal.title || "Construction Project"}</strong></p>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11.5, fontWeight: 600, color: "#334155", display: "block", marginBottom: 5 }}>Quote Amount (₱)</label>
          <input type="number" value={quoteForm.amount} onChange={e => setQuoteForm(f => ({ ...f, amount: e.target.value }))} style={{ width: "100%", padding: "10px 14px", border: "1.5px solid #E2E8F0", borderRadius: 8, fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none", color: "#0F172A" }} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11.5, fontWeight: 600, color: "#334155", display: "block", marginBottom: 5 }}>Notes (optional)</label>
          <textarea rows={3} value={quoteForm.note} onChange={e => setQuoteForm(f => ({ ...f, note: e.target.value }))} style={{ width: "100%", padding: "10px 14px", border: "1.5px solid #E2E8F0", borderRadius: 8, fontSize: 13, fontFamily: "'DM Sans', sans-serif", resize: "none", outline: "none", color: "#0F172A" }} />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setQuoteModal(null)} style={{ padding: "11px 20px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#F8FAFC", fontSize: 12.5, fontWeight: 500, color: "#64748B", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
          <button disabled={!quoteForm.amount || submitting} onClick={handleQuote} style={{ flex: 1, padding: "11px", borderRadius: 8, border: "none", background: quoteForm.amount ? "linear-gradient(135deg,#7C3AED,#6D28D9)" : "#F1F5F9", color: quoteForm.amount ? "#fff" : "#94A3B8", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
            {submitting ? "Submitting..." : "Submit Quotation"}
          </button>
        </div>
      </div>
    </div>
  );

  const Toast = () => toast && (
    <div style={{ position: "fixed", bottom: 24, right: 24, padding: "12px 18px", borderRadius: 10, background: toast.type === "error" ? "#DC2626" : "#0F172A", color: "#fff", fontSize: 12.5, fontWeight: 500, boxShadow: "0 10px 30px rgba(0,0,0,0.25)", zIndex: 500 }}>
      {toast.msg}
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; }
      `}</style>
      <div style={{ display: "flex", minHeight: "100vh", background: "#F8FAFC" }}>
        <Sidebar />
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <Topbar />
          <main style={{ flex: 1, padding: 28, overflowY: "auto" }}>
            {loading ? <div style={{ textAlign: "center", padding: 80, color: "#94A3B8" }}>Loading dashboard...</div> : renderContent()}
          </main>
        </div>
      </div>
      <QuoteModal />
      <Toast />
    </>
  );
}
