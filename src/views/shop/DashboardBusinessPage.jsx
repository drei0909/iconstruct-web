// src/views/shop/ShopDashboardPro.jsx
// iConstruct — Shop Owner Dashboard (Pro Plan)
// Unlocked: unlimited bidding, priority listing, promotional exposure, analytics

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  getShopProfile,
  getShopQuotations,
  getPostedProjects,
  submitQuotation,
  getQuotationAnalytics,
  logoutShop,
} from "../../controllers/shopController";

/* ─── constants ─── */
const PLAN = {
  name: "Pro",
  color: "#3B82F6",
  bg: "#EFF6FF",
  badge: "PRO",
};

const NAV = [
  { key: "overview",   label: "Overview",      icon: "⊞" },
  { key: "projects",   label: "All Projects",  icon: "📋" },
  { key: "quotations", label: "Quotations",    icon: "📄" },
  { key: "analytics",  label: "Analytics",     icon: "📊" },
  { key: "profile",    label: "Shop Profile",  icon: "🏪" },
  { key: "billing",    label: "Billing",       icon: "💳" },
];

/* ─── helpers ─── */
function PlanBadge() {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: "#EFF6FF", color: "#1D4ED8",
      border: "1px solid #BFDBFE",
      borderRadius: 20, padding: "3px 10px",
      fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
    }}>
      ⭐ PRO · Active
    </span>
  );
}

function StatCard({ label, value, color, sub, trend }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 14, padding: "20px 22px",
      border: "1px solid #E2E8F0", position: "relative", overflow: "hidden",
      transition: "transform 0.2s, box-shadow 0.2s",
    }}
    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.06)"; }}
    onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: color, borderRadius: "14px 14px 0 0" }} />
      <div style={{ fontSize: 28, fontWeight: 900, color, fontFamily: "'Playfair Display', serif", lineHeight: 1, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 11, color: "#94A3B8" }}>{sub}</div>
      {trend && (
        <div style={{ marginTop: 6, fontSize: 11, fontWeight: 600, color: trend > 0 ? "#10B981" : "#EF4444" }}>
          {trend > 0 ? "↑" : "↓"} {Math.abs(trend)}% vs last month
        </div>
      )}
    </div>
  );
}

function MiniBarChart({ data, color }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 48 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <div style={{
            width: "100%", background: color + "20", borderRadius: "3px 3px 0 0",
            height: `${(d.value / max) * 44}px`,
            position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: color, height: `${(d.value / max) * 100}%`, borderRadius: "3px 3px 0 0" }} />
          </div>
          <span style={{ fontSize: 9, color: "#94A3B8" }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── main component ─── */
export default function ShopDashboardPro() {
  const navigate = useNavigate();
  const [shop, setShop]           = useState(null);
  const [projects, setProjects]   = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [toast, setToast]         = useState(null);
  const [quoteModal, setQuoteModal] = useState(null);
  const [quoteForm, setQuoteForm] = useState({ amount: "", note: "" });
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [shopData, projectData, quotData, analyticsData] = await Promise.all([
          getShopProfile(), getPostedProjects(), getShopQuotations(), getQuotationAnalytics(),
        ]);
        setShop(shopData);
        setProjects(projectData); // pro: ALL projects
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

  /* ── Sidebar ── */
  const Sidebar = () => (
    <aside style={{
      width: 228, minHeight: "100vh", flexShrink: 0,
      background: "#0F172A",
      display: "flex", flexDirection: "column",
    }}>
      <div style={{ padding: "22px 20px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 900, color: "#F1F5F9", marginBottom: 3 }}>iConstruct</div>
        <div style={{ fontSize: 10, color: "rgba(148,163,184,0.6)", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase" }}>Shop Manager</div>
        <div style={{ marginTop: 10 }}><PlanBadge /></div>
      </div>

      {/* Priority badge */}
      <div style={{ margin: "12px 14px", padding: "10px 14px", background: "rgba(59,130,246,0.12)", borderRadius: 10, border: "1px solid rgba(59,130,246,0.2)" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#93C5FD", marginBottom: 2 }}>📈 PRIORITY LISTING ACTIVE</div>
        <div style={{ fontSize: 10, color: "rgba(148,163,184,0.7)" }}>Your shop ranks higher in search results.</div>
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
              background: isActive ? "rgba(59,130,246,0.15)" : "transparent",
              color: isActive ? "#93C5FD" : "rgba(148,163,184,0.65)",
              borderLeft: isActive ? "2px solid #3B82F6" : "2px solid transparent",
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
            <div style={{ fontSize: 12, fontWeight: 600, color: "#F1F5F9", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{shop.shopName}</div>
            <div style={{ fontSize: 10, color: "rgba(148,163,184,0.5)" }}>{shop.ownerName}</div>
          </div>
        )}
        <button onClick={async () => { await logoutShop(); navigate("/shop/login"); }} style={{
          width: "100%", padding: "8px", borderRadius: 8,
          border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)",
          color: "#F87171", fontSize: 11.5, fontWeight: 600,
          cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
        }}>Sign Out</button>
      </div>
    </aside>
  );

  /* ── Topbar ── */
  const Topbar = () => (
    <header style={{ height: 58, background: "#fff", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", padding: "0 28px", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", fontFamily: "'DM Sans', sans-serif" }}>
        {NAV.find(n => n.key === activeTab)?.label}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <PlanBadge />
        <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg, #1E3A5F, #3B82F6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff" }}>
          {shop?.shopName?.[0] || "S"}
        </div>
      </div>
    </header>
  );

  /* ── Overview ── */
  const Overview = () => {
    const monthQuotes = quotations.filter(q => {
      const now = new Date();
      const d = q.createdAt?.toDate?.() || new Date(q.createdAt);
      return d.getMonth() === now.getMonth();
    });
    const accepted = quotations.filter(q => q.status === "accepted").length;
    const winRate = quotations.length > 0 ? Math.round((accepted / quotations.length) * 100) : 0;

    const chartData = [
      { label: "Jan", value: 2 }, { label: "Feb", value: 4 }, { label: "Mar", value: 3 },
      { label: "Apr", value: 6 }, { label: "May", value: 5 }, { label: "Jun", value: monthQuotes.length || 7 },
    ];

    return (
      <div>
        {/* Pro welcome banner */}
        <div style={{
          background: "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)",
          borderRadius: 14, padding: "20px 24px", marginBottom: 24,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 3 }}>⭐ Pro Plan Active</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
              Priority listing · Unlimited bidding · Analytics · Promotional exposure
            </div>
          </div>
          <button onClick={() => setActiveTab("billing")} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8, padding: "8px 16px", fontSize: 11.5, fontWeight: 600, color: "#fff", cursor: "pointer" }}>
            Manage Billing →
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
          <StatCard label="Total Quotes" value={quotations.length} color="#3B82F6" sub="All time submitted" trend={12} />
          <StatCard label="This Month" value={monthQuotes.length} color="#10B981" sub="Unlimited on Pro" />
          <StatCard label="Win Rate" value={`${winRate}%`} color="#F59E0B" sub="Accepted / submitted" trend={5} />
          <StatCard label="Active Projects" value={projects.length} color="#7C3AED" sub="Available to bid" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20 }}>
          {/* Quotes trend chart */}
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0", padding: "20px 22px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>Quotations Trend</div>
            <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 16 }}>Last 6 months activity</div>
            <MiniBarChart data={chartData} color="#3B82F6" />
          </div>

          {/* Quick stats sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0", padding: "18px 20px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", marginBottom: 12 }}>Bid Status Breakdown</div>
              {[
                { label: "Accepted", value: accepted, color: "#10B981" },
                { label: "Pending", value: quotations.filter(q => q.status === "pending").length, color: "#F59E0B" },
                { label: "Rejected", value: quotations.filter(q => q.status === "rejected").length, color: "#EF4444" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 12 }}>
                  <span style={{ color: "#64748B" }}>{label}</span>
                  <span style={{ fontWeight: 700, color }}>{value}</span>
                </div>
              ))}
            </div>

            <div style={{ background: "linear-gradient(135deg, #EFF6FF, #DBEAFE)", borderRadius: 14, border: "1px solid #BFDBFE", padding: "16px 18px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#1D4ED8", marginBottom: 6 }}>📣 PROMOTIONAL ACTIVE</div>
              <div style={{ fontSize: 11, color: "#1E40AF" }}>Your shop is featured in builder recommendations.</div>
            </div>
          </div>
        </div>

        {/* Recent projects */}
        <div style={{ marginTop: 20, background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0", overflow: "hidden" }}>
          <div style={{ padding: "16px 22px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Recent Projects</div>
            <button onClick={() => setActiveTab("projects")} style={{ fontSize: 11, color: "#3B82F6", fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>View All →</button>
          </div>
          {projects.slice(0, 4).map((p, i) => (
            <div key={p.id} style={{ padding: "13px 22px", borderBottom: i < 3 ? "1px solid #F8FAFC" : "none", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
              onMouseEnter={e => e.currentTarget.style.background = "#FAFAFA"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#3B82F6", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{p.title || "Construction Project"}</div>
                <div style={{ fontSize: 11, color: "#94A3B8" }}>{p.city || "Lipa City"}</div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>₱{p.estimatedBudget?.toLocaleString() || "—"}</div>
              <button onClick={() => setQuoteModal(p)} style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid #E2E8F0", background: "#fff", fontSize: 11, fontWeight: 600, color: "#334155", cursor: "pointer" }}>Quote</button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  /* ── All Projects ── */
  const AllProjects = () => (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, fontWeight: 900, color: "#0F172A", marginBottom: 2 }}>All Projects</h2>
          <p style={{ fontSize: 12, color: "#64748B" }}>Unlimited project access — Pro plan.</p>
        </div>
        <div style={{ position: "relative" }}>
          <input placeholder="Search projects..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: 32, paddingRight: 14, paddingTop: 8, paddingBottom: 8, border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 12, fontFamily: "'DM Sans', sans-serif", outline: "none", width: 220 }} />
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", fontSize: 12 }}>🔍</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filteredProjects.map(project => (
          <div key={project.id} style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", padding: "16px 20px", display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A", marginBottom: 3 }}>{project.title || "Construction Project"}</div>
              <div style={{ fontSize: 11.5, color: "#64748B" }}>{project.materials?.slice(0, 3).join(", ") || "Materials TBD"} · {project.city || "Lipa City"}</div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>₱{project.estimatedBudget?.toLocaleString() || "—"}</div>
            <button onClick={() => setQuoteModal(project)} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#0F172A", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
              Submit Quote
            </button>
          </div>
        ))}
        {filteredProjects.length === 0 && (
          <div style={{ textAlign: "center", padding: 64, color: "#94A3B8" }}>No projects found.</div>
        )}
      </div>
    </div>
  );

  /* ── Analytics ── */
  const Analytics = () => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
    const mockBids = [2, 4, 3, 6, 5, 7];
    const mockWins = [1, 2, 1, 3, 2, 4];

    return (
      <div>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, fontWeight: 900, color: "#0F172A", marginBottom: 4 }}>Analytics</h2>
        <p style={{ fontSize: 12, color: "#64748B", marginBottom: 20 }}>Quotation performance insights — Pro plan feature.</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
          <StatCard label="Total Bids" value={quotations.length} color="#3B82F6" sub="All time" />
          <StatCard label="Accepted Quotes" value={quotations.filter(q => q.status === "accepted").length} color="#10B981" sub="Won bids" />
          <StatCard label="Response Rate" value={quotations.length > 0 ? `${Math.round((quotations.filter(q => q.status !== "pending").length / quotations.length) * 100)}%` : "—"} color="#F59E0B" sub="Responded by clients" />
        </div>

        {/* Bids vs Wins chart */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0", padding: "22px 24px", marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>Bids vs Wins — Last 6 Months</div>
          <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#64748B" }}>
              <div style={{ width: 12, height: 4, background: "#3B82F6", borderRadius: 2 }} /> Bids Submitted
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#64748B" }}>
              <div style={{ width: 12, height: 4, background: "#10B981", borderRadius: 2 }} /> Accepted
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 80 }}>
            {months.map((m, i) => (
              <div key={m} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <div style={{ width: "100%", display: "flex", gap: 2, alignItems: "flex-end", height: 64 }}>
                  <div style={{ flex: 1, background: "#3B82F6", borderRadius: "3px 3px 0 0", height: `${(mockBids[i] / 7) * 100}%` }} />
                  <div style={{ flex: 1, background: "#10B981", borderRadius: "3px 3px 0 0", height: `${(mockWins[i] / 7) * 100}%` }} />
                </div>
                <span style={{ fontSize: 9, color: "#94A3B8" }}>{m}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent activity table */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0", overflow: "hidden" }}>
          <div style={{ padding: "16px 22px", borderBottom: "1px solid #F1F5F9", fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Quotation History</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F8FAFC" }}>
                {["Project", "Amount", "Date Submitted", "Status"].map(h => (
                  <th key={h} style={{ padding: "10px 16px", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#94A3B8", textAlign: "left", borderBottom: "1px solid #E2E8F0" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {quotations.map((q, i) => (
                <tr key={q.id} onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#0F172A", borderBottom: i < quotations.length - 1 ? "1px solid #F1F5F9" : "none" }}>{q.projectTitle || "Project"}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "#334155", borderBottom: i < quotations.length - 1 ? "1px solid #F1F5F9" : "none" }}>₱{q.amount?.toLocaleString()}</td>
                  <td style={{ padding: "12px 16px", fontSize: 11.5, color: "#94A3B8", borderBottom: i < quotations.length - 1 ? "1px solid #F1F5F9" : "none" }}>{q.createdAt?.toDate?.()?.toLocaleDateString("en-PH") || "—"}</td>
                  <td style={{ padding: "12px 16px", borderBottom: i < quotations.length - 1 ? "1px solid #F1F5F9" : "none" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 20, padding: "3px 10px", letterSpacing: "0.08em", textTransform: "uppercase", ...(q.status === "accepted" ? { background: "#D1FAE5", color: "#065F46", border: "1px solid #6EE7B7" } : q.status === "rejected" ? { background: "#FEE2E2", color: "#991B1B", border: "1px solid #FCA5A5" } : { background: "#FEF3C7", color: "#92400E", border: "1px solid #FCD34D" }) }}>{q.status || "pending"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  /* ── Billing ── */
  const Billing = () => (
    <div>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, fontWeight: 900, color: "#0F172A", marginBottom: 20 }}>Billing & Subscription</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0", padding: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, paddingBottom: 20, borderBottom: "1px solid #F1F5F9" }}>
            <div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, color: "#0F172A", marginBottom: 4 }}>Pro Plan</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#3B82F6", fontFamily: "'Playfair Display', serif" }}>₱499<span style={{ fontSize: 13, fontWeight: 400, color: "#94A3B8" }}>/month</span></div>
            </div>
            <PlanBadge />
          </div>
          {[["Next Billing Date", "July 15, 2026"], ["Payment Method", "GCash — 09XX XXX XXXX"], ["Member Since", "January 2026"]].map(([k, v]) => (
            <div key={k} style={{ display: "flex", gap: 12, marginBottom: 12, fontSize: 13 }}>
              <span style={{ color: "#94A3B8", minWidth: 150, flexShrink: 0 }}>{k}</span>
              <span style={{ color: "#0F172A", fontWeight: 500 }}>{v}</span>
            </div>
          ))}
          <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
            <button style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#F8FAFC", fontSize: 12.5, fontWeight: 600, color: "#64748B", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel Plan</button>
            <button style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #7C3AED, #6D28D9)", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Upgrade to Business — ₱4,499/yr</button>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: "#EFF6FF", borderRadius: 14, border: "1px solid #BFDBFE", padding: "18px 20px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#1D4ED8", marginBottom: 8 }}>Business Plan Savings</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#1D4ED8", fontFamily: "'Playfair Display', serif" }}>₱1,489</div>
            <div style={{ fontSize: 11, color: "#3B82F6", marginTop: 4 }}>saved per year vs monthly billing</div>
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
            <div style={{ width: 60, height: 60, borderRadius: "50%", background: "linear-gradient(135deg, #1D4ED8, #3B82F6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 900, color: "#fff", fontFamily: "'Playfair Display', serif" }}>{shop.shopName?.[0] || "S"}</div>
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
      case "quotations": return <Analytics />;
      case "analytics":  return <Analytics />;
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
          <input type="number" placeholder="e.g. 15000" value={quoteForm.amount} onChange={e => setQuoteForm(f => ({ ...f, amount: e.target.value }))} style={{ width: "100%", padding: "10px 14px", border: "1.5px solid #E2E8F0", borderRadius: 8, fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none", color: "#0F172A" }} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11.5, fontWeight: 600, color: "#334155", display: "block", marginBottom: 5 }}>Notes (optional)</label>
          <textarea rows={3} value={quoteForm.note} onChange={e => setQuoteForm(f => ({ ...f, note: e.target.value }))} style={{ width: "100%", padding: "10px 14px", border: "1.5px solid #E2E8F0", borderRadius: 8, fontSize: 13, fontFamily: "'DM Sans', sans-serif", resize: "none", outline: "none", color: "#0F172A" }} />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setQuoteModal(null)} style={{ padding: "11px 20px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#F8FAFC", fontSize: 12.5, fontWeight: 500, color: "#64748B", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
          <button disabled={!quoteForm.amount || submitting} onClick={handleQuote} style={{ flex: 1, padding: "11px", borderRadius: 8, border: "none", background: quoteForm.amount ? "#3B82F6" : "#F1F5F9", color: quoteForm.amount ? "#fff" : "#94A3B8", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
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
