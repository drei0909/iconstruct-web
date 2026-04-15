// src/views/admin/AdminDashboard.jsx
// KEY FIXES:
// 1. DUPLICATE EMAIL: handleConfirmPayment and handleRejectPayment were calling
//    sendPaymentConfirmedEmail/sendPaymentRejectedEmail directly in the component,
//    but confirmPayment() and rejectPayment() in adminController ALSO call them.
//    Removed the duplicate calls from the component — only adminController sends emails.
// 2. PRO→BUSINESS BUG: The ShopDashboardRouter now reads plan from live Firestore
//    snapshot, but the individual dashboard components (Basic/Pro/Business) still
//    have their own onSnapshot listeners that don't affect the router's plan state.
//    Those internal listeners are only for the "plan activated" modal — they are safe
//    as long as the ROUTER is the one determining which dashboard to render.
//    The fix is already in ShopDashboardRouter.jsx (shopMeta in ref, not state).

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAllShops,
  getShopStats,
  approveShop,
  rejectShop,
  logoutAdmin,
  getAllPayments,
  getPaymentStats,
  confirmPayment,
  rejectPayment,
} from "../../controllers/adminController";

// NOTE: Do NOT import email functions here.
// adminController.js already calls them inside confirmPayment() and rejectPayment().
// Importing and calling them here too is what caused the duplicate emails.

const STATUS_COLOR = {
  pending:   { bg: "#FEF3C7", border: "#FCD34D", text: "#92400E", dot: "#F59E0B" },
  approved:  { bg: "#D1FAE5", border: "#6EE7B7", text: "#065F46", dot: "#10B981" },
  rejected:  { bg: "#FEE2E2", border: "#FCA5A5", text: "#991B1B", dot: "#EF4444" },
  confirmed: { bg: "#D1FAE5", border: "#6EE7B7", text: "#065F46", dot: "#10B981" },
};

const DOCUMENT_TYPES = [
  { value: "dti",      label: "DTI Certificate" },
  { value: "business", label: "Business Permit" },
  { value: "mayors",   label: "Mayor's Permit" },
  { value: "bir",      label: "BIR Certificate" },
  { value: "shop",     label: "Shop Exterior Photo" },
  { value: "validId",  label: "Valid ID" },
  { value: "selfie",   label: "ID Selfie" },
  { value: "other",    label: "Other Document" },
];

function StatusBadge({ status }) {
  const c = STATUS_COLOR[status] || STATUS_COLOR.pending;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, background:c.bg, border:`1px solid ${c.border}`, borderRadius:20, padding:"3px 10px", fontSize:10, fontWeight:700, color:c.text, letterSpacing:"0.09em", textTransform:"uppercase" }}>
      <span style={{ width:5, height:5, borderRadius:"50%", background:c.dot }} />
      {status}
    </span>
  );
}

function Avatar({ name = "", size = 36 }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const colors = ["#3B5998","#E8643A","#6366F1","#0891B2","#7C3AED","#B45309"];
  const color = colors[(name.charCodeAt(0) || 0) % colors.length];
  return (
    <span style={{ width:size, height:size, borderRadius:"50%", background:color, color:"#fff", display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:size*0.36, fontWeight:700, fontFamily:"'Inter',sans-serif", flexShrink:0, letterSpacing:"0.02em" }}>
      {initials}
    </span>
  );
}

const TABS = [
  { key:"dashboard",     label:"Dashboard",         icon:"⊞" },
  { key:"applications",  label:"Shop Applications",  icon:"📋" },
  { key:"shops",         label:"Manage Shops",       icon:"🏪" },
  { key:"subscriptions", label:"Subscriptions",      icon:"💳" },
  { key:"settings",      label:"System Settings",    icon:"⚙️" },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [shops, setShops]           = useState([]);
  const [stats, setStats]           = useState({ total:0, pending:0, approved:0, rejected:0 });
  const [payments, setPayments]     = useState([]);
  const [payStats, setPayStats]     = useState({ total:0, pending:0, confirmed:0, rejected:0 });
  const [loading, setLoading]       = useState(true);
  const [activeTab, setActiveTab]   = useState("dashboard");
  const [filter, setFilter]         = useState("all");
  const [payFilter, setPayFilter]   = useState("all");
  const [search, setSearch]         = useState("");
  const [paySearch, setPaySearch]   = useState("");
  const [selected, setSelected]     = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [actionLoading, setActionLoading]     = useState(false);
  const [rejectModal, setRejectModal]   = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [payRejectModal, setPayRejectModal]   = useState(false);
  const [payRejectReason, setPayRejectReason] = useState("");
  const [toast, setToast]           = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notifOpen, setNotifOpen]   = useState(false);
  const [previewModal, setPreviewModal] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [allShops, allStats, allPayments, allPayStats] = await Promise.all([
        getAllShops(), getShopStats(), getAllPayments(), getPaymentStats(),
      ]);
      setShops(allShops);
      setStats(allStats);
      setPayments(allPayments);
      setPayStats(allPayStats);
    } catch {
      showToast("Failed to load data. Please refresh.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Shop approval ──────────────────────────────────────────────────────────
  // adminController.approveShop() already sends the approval email internally.
  // Do NOT call sendApprovalEmail here — that would double-send.
  const handleApprove = async (uid) => {
    setActionLoading(true);
    try {
      await approveShop(uid); // email is sent inside this function
      showToast("Shop approved! Confirmation email sent.");
      setSelected(null);
      load();
    } catch {
      showToast("Failed to approve. Try again.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // adminController.rejectShop() already sends the rejection email internally.
  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setActionLoading(true);
    try {
      await rejectShop(selected.id, rejectReason); // email is sent inside this function
      showToast("Shop rejected. Notification email sent.");
      setRejectModal(false);
      setSelected(null);
      setRejectReason("");
      load();
    } catch {
      showToast("Failed to reject. Try again.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // ── Payment confirmation ───────────────────────────────────────────────────
  // adminController.confirmPayment() already:
  //   1. Updates subscriptionPayments status → "confirmed"
  //   2. Updates shops subscriptionPlan → planName (e.g. "pro")
  //   3. Updates shops subscriptionStatus → "active"
  //   4. Calls sendPaymentConfirmedEmail once
  //
  // DO NOT call sendPaymentConfirmedEmail here — that was causing duplicate emails.
  const handleConfirmPayment = async (paymentId, planName, shopId) => {
    setActionLoading(true);
    try {
      await confirmPayment(paymentId, planName, shopId); // email sent inside
      showToast(`Payment confirmed. ${planName.toUpperCase()} plan activated!`);
      setSelectedPayment(null);
      load();
    } catch (err) {
      showToast("Failed to confirm payment. Try again.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // adminController.rejectPayment() already sends the rejection email internally.
  const handleRejectPayment = async () => {
    if (!payRejectReason.trim()) return;
    setActionLoading(true);
    try {
      await rejectPayment(selectedPayment.id, payRejectReason, selectedPayment.shopId); // email sent inside
      showToast("Payment rejected. Notification email sent.");
      setPayRejectModal(false);
      setSelectedPayment(null);
      setPayRejectReason("");
      load();
    } catch {
      showToast("Failed to reject payment. Try again.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = async () => {
    await logoutAdmin();
    navigate("/admin");
  };

  const filtered = shops.filter(s => {
    const matchFilter = filter === "all" || s.status === filter;
    const matchSearch =
      s.shopName?.toLowerCase().includes(search.toLowerCase()) ||
      s.ownerName?.toLowerCase().includes(search.toLowerCase()) ||
      s.email?.toLowerCase().includes(search.toLowerCase()) ||
      s.city?.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const filteredPayments = payments.filter(p => {
    const matchFilter = payFilter === "all" || p.status === payFilter;
    const matchSearch =
      p.shopName?.toLowerCase().includes(paySearch.toLowerCase()) ||
      p.email?.toLowerCase().includes(paySearch.toLowerCase()) ||
      p.referenceNumber?.toLowerCase().includes(paySearch.toLowerCase()) ||
      p.planName?.toLowerCase().includes(paySearch.toLowerCase());
    return matchFilter && matchSearch;
  });

  const pendingShops    = shops.filter(s => s.status === "pending");
  const approvedShops   = shops.filter(s => s.status === "approved");
  const pendingPayments = payments.filter(p => p.status === "pending");

  /* ── Sidebar ── */
  const Sidebar = () => (
    <aside style={{ width:sidebarCollapsed?72:240, minHeight:"100vh", background:"linear-gradient(175deg,#0F172A 0%,#1E2D3D 60%,#162032 100%)", display:"flex", flexDirection:"column", borderRight:"1px solid rgba(255,255,255,0.06)", transition:"width 0.25s cubic-bezier(0.4,0,0.2,1)", overflow:"hidden", flexShrink:0 }}>
      <div style={{ padding:sidebarCollapsed?"24px 0":"24px 20px", borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", alignItems:"center", justifyContent:sidebarCollapsed?"center":"space-between", gap:10 }}>
        {!sidebarCollapsed && (
          <div>
            <div style={{ fontFamily:"'Lora',Georgia,serif", fontSize:18, fontWeight:900, color:"#F1F5F9" }}>iConstruct</div>
            <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.16em", textTransform:"uppercase", color:"rgba(148,163,184,0.6)", marginTop:3 }}>Admin Control Center</div>
          </div>
        )}
        <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} style={{ width:28, height:28, borderRadius:6, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.08)", color:"rgba(148,163,184,0.7)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:14 }}>
          ☰
        </button>
      </div>
      <nav style={{ flex:1, padding:"12px 0" }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.key;
          const badge = tab.key === "applications" ? stats.pending : tab.key === "subscriptions" ? payStats.pending : 0;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:sidebarCollapsed?"10px 0":"10px 20px", justifyContent:sidebarCollapsed?"center":"flex-start", background:isActive?"linear-gradient(90deg,rgba(59,130,246,0.15),rgba(59,130,246,0.05))":"transparent", borderLeft:isActive?"2px solid #3B82F6":"2px solid transparent", border:"none", borderRight:"none", cursor:"pointer", color:isActive?"#93C5FD":"rgba(148,163,184,0.65)", fontFamily:"'Inter',sans-serif", fontSize:13, fontWeight:isActive?600:400 }}>
              <span style={{ flexShrink:0 }}>{tab.icon}</span>
              {!sidebarCollapsed && <span>{tab.label}</span>}
              {!sidebarCollapsed && badge > 0 && (
                <span style={{ marginLeft:"auto", background:"#EF4444", color:"#fff", fontSize:9, fontWeight:700, borderRadius:10, padding:"2px 6px" }}>{badge}</span>
              )}
            </button>
          );
        })}
      </nav>
      <div style={{ padding:sidebarCollapsed?"16px 0":"16px 20px", borderTop:"1px solid rgba(255,255,255,0.06)", display:"flex", alignItems:"center", gap:10, justifyContent:sidebarCollapsed?"center":"flex-start" }}>
        <Avatar name="Admin" size={32} />
        {!sidebarCollapsed && (
          <>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, fontWeight:600, color:"#F1F5F9" }}>Administrator</div>
              <div style={{ fontSize:10, color:"rgba(148,163,184,0.5)" }}>Super Admin</div>
            </div>
            <button onClick={handleLogout} title="Sign Out" style={{ width:28, height:28, borderRadius:6, background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.2)", color:"#F87171", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>→</button>
          </>
        )}
      </div>
    </aside>
  );

  /* ── Topbar ── */
  const Topbar = () => (
    <header style={{ height:60, background:"#ffffff", borderBottom:"1px solid #E2E8F0", display:"flex", alignItems:"center", padding:"0 28px", justifyContent:"space-between", position:"sticky", top:0, zIndex:50 }}>
      <div>
        <div style={{ fontSize:16, fontWeight:700, color:"#0F172A" }}>{TABS.find(t=>t.key===activeTab)?.label}</div>
        <div style={{ fontSize:11, color:"#94A3B8" }}>iConstruct · Admin Control Center</div>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ position:"relative" }}>
          <button onClick={() => setNotifOpen(!notifOpen)} style={{ width:36, height:36, borderRadius:8, border:"1px solid #E2E8F0", background:"#F8FAFC", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"#64748B", position:"relative" }}>
            🔔
            {(stats.pending + payStats.pending) > 0 && (
              <span style={{ position:"absolute", top:-4, right:-4, background:"#EF4444", color:"#fff", width:16, height:16, borderRadius:"50%", fontSize:9, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", border:"2px solid #fff" }}>
                {stats.pending + payStats.pending}
              </span>
            )}
          </button>
          {notifOpen && (
            <div style={{ position:"absolute", top:44, right:0, width:300, background:"#fff", border:"1px solid #E2E8F0", borderRadius:12, boxShadow:"0 10px 40px rgba(0,0,0,0.1)", zIndex:100, overflow:"hidden" }}>
              <div style={{ padding:"14px 16px", borderBottom:"1px solid #F1F5F9", display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontSize:13, fontWeight:700, color:"#0F172A" }}>Notifications</span>
                <span style={{ fontSize:10, color:"#3B82F6", fontWeight:600, cursor:"pointer" }} onClick={() => setNotifOpen(false)}>Close</span>
              </div>
              {pendingShops.slice(0,3).map(shop => (
                <div key={shop.id} style={{ padding:"12px 16px", borderBottom:"1px solid #F8FAFC", display:"flex", gap:10, cursor:"pointer" }} onClick={() => { setSelected(shop); setActiveTab("applications"); setNotifOpen(false); }}>
                  <Avatar name={shop.shopName||""} size={28} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:"#0F172A" }}>{shop.shopName}</div>
                    <div style={{ fontSize:11, color:"#64748B" }}>New shop application</div>
                  </div>
                </div>
              ))}
              {pendingPayments.slice(0,3).map(p => (
                <div key={p.id} style={{ padding:"12px 16px", borderBottom:"1px solid #F8FAFC", display:"flex", gap:10, cursor:"pointer" }} onClick={() => { setSelectedPayment(p); setActiveTab("subscriptions"); setNotifOpen(false); }}>
                  <Avatar name={p.shopName||""} size={28} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:"#0F172A" }}>{p.shopName}</div>
                    <div style={{ fontSize:11, color:"#64748B" }}>Payment · {p.planName} plan</div>
                  </div>
                </div>
              ))}
              {stats.pending === 0 && payStats.pending === 0 && (
                <div style={{ padding:"24px 16px", textAlign:"center", color:"#94A3B8", fontSize:12 }}>No new notifications</div>
              )}
            </div>
          )}
        </div>
        <button onClick={load} title="Refresh" style={{ width:36, height:36, borderRadius:8, border:"1px solid #E2E8F0", background:"#F8FAFC", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"#64748B" }}>↻</button>
        <Avatar name="Administrator" size={34} />
      </div>
    </header>
  );

  /* ── Dashboard tab ── */
  const DashboardTab = () => {
    const recentApps = [...shops].sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0)).slice(0,5);
    const cards = [
      { label:"Total Applications", value:stats.total,     color:"#3B82F6" },
      { label:"Pending Review",      value:stats.pending,   color:"#F59E0B", urgent:stats.pending>0 },
      { label:"Approved Shops",      value:stats.approved,  color:"#10B981" },
      { label:"Pending Payments",    value:payStats.pending, color:"#7C3AED", urgent:payStats.pending>0 },
    ];
    return (
      <div>
        <div style={{ marginBottom:24 }}>
          <h2 style={{ fontFamily:"'Lora',Georgia,serif", fontSize:22, fontWeight:900, color:"#0F172A", marginBottom:4 }}>Welcome back, Administrator</h2>
          <p style={{ fontSize:13, color:"#64748B" }}>Here's what's happening with iConstruct today.</p>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:28 }}>
          {cards.map((c,i) => (
            <div key={i} style={{ background:"#fff", borderRadius:14, border:c.urgent?`1px solid ${c.color}40`:"1px solid #E2E8F0", padding:"20px 22px", position:"relative", overflow:"hidden", boxShadow:c.urgent?`0 0 0 3px ${c.color}10`:"none" }}>
              <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:c.color, borderRadius:"14px 14px 0 0" }} />
              <div style={{ fontFamily:"'Lora',Georgia,serif", fontSize:32, fontWeight:900, color:c.color, lineHeight:1, marginBottom:4 }}>{c.value}</div>
              <div style={{ fontSize:12, fontWeight:600, color:"#0F172A" }}>{c.label}</div>
            </div>
          ))}
        </div>
        <div style={{ background:"#fff", borderRadius:14, border:"1px solid #E2E8F0", overflow:"hidden" }}>
          <div style={{ padding:"18px 22px", borderBottom:"1px solid #F1F5F9", display:"flex", justifyContent:"space-between" }}>
            <div style={{ fontSize:14, fontWeight:700, color:"#0F172A" }}>Recent Applications</div>
            <button onClick={() => setActiveTab("applications")} style={{ fontSize:11, fontWeight:600, color:"#3B82F6", background:"none", border:"none", cursor:"pointer" }}>View All →</button>
          </div>
          {recentApps.map((shop,i) => (
            <div key={shop.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"13px 22px", borderBottom:i<recentApps.length-1?"1px solid #F8FAFC":"none", cursor:"pointer" }}
              onClick={() => { setSelected(shop); setActiveTab("applications"); }}
              onMouseEnter={e => e.currentTarget.style.background="#FAFAFA"}
              onMouseLeave={e => e.currentTarget.style.background="transparent"}>
              <Avatar name={shop.shopName||""} size={38} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600, color:"#0F172A", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{shop.shopName}</div>
                <div style={{ fontSize:11, color:"#94A3B8" }}>{shop.ownerName} · {shop.city}</div>
              </div>
              <StatusBadge status={shop.status} />
            </div>
          ))}
        </div>
      </div>
    );
  };

  /* ── Applications tab ── */
  const ApplicationsTab = () => (
    <div>
      <div style={{ marginBottom:20, display:"flex", justifyContent:"space-between", alignItems:"flex-end" }}>
        <div>
          <h2 style={{ fontFamily:"'Lora',Georgia,serif", fontSize:20, fontWeight:900, color:"#0F172A", marginBottom:2 }}>Shop Applications</h2>
          <p style={{ fontSize:12, color:"#64748B" }}>Review, approve, or reject hardware shop registration requests.</p>
        </div>
      </div>
      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
        <div style={{ position:"relative", flex:1, minWidth:220 }}>
          <input placeholder="Search by shop, owner, email, city..." value={search} onChange={e => setSearch(e.target.value)} style={{ width:"100%", paddingLeft:34, paddingRight:14, paddingTop:9, paddingBottom:9, border:"1px solid #E2E8F0", borderRadius:8, fontSize:12, fontFamily:"'Inter',sans-serif", color:"#0F172A", background:"#fff", outline:"none" }} />
        </div>
        <div style={{ display:"flex", gap:6 }}>
          {["all","pending","approved","rejected"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding:"8px 14px", borderRadius:8, fontSize:11.5, fontWeight:500, cursor:"pointer", fontFamily:"'Inter',sans-serif", ...(filter===f?{background:"#0F172A",color:"#fff",border:"1px solid #0F172A"}:{background:"#fff",color:"#64748B",border:"1px solid #E2E8F0"}) }}>
              {f==="all"?"All":f.charAt(0).toUpperCase()+f.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div style={{ background:"#fff", borderRadius:14, border:"1px solid #E2E8F0", overflow:"hidden" }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ background:"#F8FAFC" }}>
              {["#","Shop","Owner","Location","Date","Status","Action"].map(h => (
                <th key={h} style={{ padding:"11px 16px", fontSize:10, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"#94A3B8", textAlign:"left", borderBottom:"1px solid #E2E8F0" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((shop,i) => (
              <tr key={shop.id} onMouseEnter={e => e.currentTarget.style.background="#F8FAFC"} onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                <td style={{ padding:"13px 16px", color:"#CBD5E1", fontSize:11 }}>{String(i+1).padStart(2,"0")}</td>
                <td style={{ padding:"13px 16px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <Avatar name={shop.shopName||""} size={32} />
                    <div>
                      <div style={{ fontSize:13, fontWeight:600, color:"#0F172A" }}>{shop.shopName}</div>
                      <div style={{ fontSize:11, color:"#94A3B8" }}>{shop.email}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding:"13px 16px", fontSize:13, color:"#334155" }}>{shop.ownerName}</td>
                <td style={{ padding:"13px 16px", fontSize:12, color:"#64748B" }}>{shop.city}, {shop.province}</td>
                <td style={{ padding:"13px 16px", fontSize:11.5, color:"#94A3B8" }}>
                  {shop.createdAt?.toDate ? shop.createdAt.toDate().toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"}) : "—"}
                </td>
                <td style={{ padding:"13px 16px" }}><StatusBadge status={shop.status} /></td>
                <td style={{ padding:"13px 16px" }}>
                  <button onClick={() => setSelected(shop)} style={{ padding:"6px 13px", borderRadius:7, border:"1px solid #E2E8F0", background:"#fff", fontSize:11.5, fontWeight:600, color:"#334155", cursor:"pointer", fontFamily:"'Inter',sans-serif" }}
                    onMouseEnter={e => { e.currentTarget.style.background="#0F172A"; e.currentTarget.style.color="#fff"; }}
                    onMouseLeave={e => { e.currentTarget.style.background="#fff"; e.currentTarget.style.color="#334155"; }}>
                    Review →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  /* ── Subscriptions tab ── */
  const SubscriptionsTab = () => (
    <div>
      <div style={{ marginBottom:20 }}>
        <h2 style={{ fontFamily:"'Lora',Georgia,serif", fontSize:20, fontWeight:900, color:"#0F172A", marginBottom:2 }}>Subscription Payments</h2>
        <p style={{ fontSize:12, color:"#64748B" }}>Review payment requests and activate shop plans.</p>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:20 }}>
        {[
          { label:"Total",     value:payStats.total,     color:"#3B82F6" },
          { label:"Pending",   value:payStats.pending,   color:"#F59E0B", urgent:payStats.pending>0 },
          { label:"Confirmed", value:payStats.confirmed, color:"#10B981" },
          { label:"Rejected",  value:payStats.rejected,  color:"#EF4444" },
        ].map((c,i) => (
          <div key={i} style={{ background:"#fff", borderRadius:12, border:c.urgent?`1px solid ${c.color}40`:"1px solid #E2E8F0", padding:"16px 18px", position:"relative", overflow:"hidden" }}>
            <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:c.color }} />
            <div style={{ fontFamily:"'Lora',Georgia,serif", fontSize:26, fontWeight:900, color:c.color }}>{c.value}</div>
            <div style={{ fontSize:11.5, color:"#64748B", marginTop:2 }}>{c.label}</div>
          </div>
        ))}
      </div>
      <div style={{ position:"relative", marginBottom:12 }}>
        <input placeholder="Search by shop, email, reference, or plan..." value={paySearch} onChange={e => setPaySearch(e.target.value)} style={{ width:"100%", paddingLeft:34, paddingRight:14, paddingTop:9, paddingBottom:9, border:"1px solid #E2E8F0", borderRadius:8, fontSize:12, fontFamily:"'Inter',sans-serif", color:"#0F172A", background:"#fff", outline:"none" }} />
      </div>
      <div style={{ display:"flex", gap:6, marginBottom:14 }}>
        {["all","pending","confirmed","rejected"].map(f => (
          <button key={f} onClick={() => setPayFilter(f)} style={{ padding:"7px 14px", borderRadius:8, fontSize:11.5, fontWeight:500, cursor:"pointer", fontFamily:"'Inter',sans-serif", ...(payFilter===f?{background:"#0F172A",color:"#fff",border:"1px solid #0F172A"}:{background:"#fff",color:"#64748B",border:"1px solid #E2E8F0"}) }}>
            {f==="all"?"All":f.charAt(0).toUpperCase()+f.slice(1)}
          </button>
        ))}
      </div>
      <div style={{ background:"#fff", borderRadius:14, border:"1px solid #E2E8F0", overflow:"hidden" }}>
        {filteredPayments.length === 0 ? (
          <div style={{ padding:64, textAlign:"center", color:"#94A3B8" }}>
            <div style={{ fontSize:32, marginBottom:8 }}>💳</div>
            <div style={{ fontWeight:600, color:"#0F172A", marginBottom:4 }}>No payment requests</div>
          </div>
        ) : (
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"#F8FAFC" }}>
                {["#","Shop","Plan","Method","Reference #","Submitted","Status","Action"].map(h => (
                  <th key={h} style={{ padding:"11px 14px", fontSize:10, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"#94A3B8", textAlign:"left", borderBottom:"1px solid #E2E8F0" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map((p,i) => (
                <tr key={p.id} onMouseEnter={e => e.currentTarget.style.background="#F8FAFC"} onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                  <td style={{ padding:"12px 14px", color:"#CBD5E1", fontSize:11 }}>{String(i+1).padStart(2,"0")}</td>
                  <td style={{ padding:"12px 14px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:9 }}>
                      <Avatar name={p.shopName||""} size={30} />
                      <div>
                        <div style={{ fontSize:12.5, fontWeight:600, color:"#0F172A" }}>{p.shopName}</div>
                        <div style={{ fontSize:10.5, color:"#94A3B8" }}>{p.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding:"12px 14px" }}>
                    <span style={{ fontSize:10.5, fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", padding:"3px 9px", borderRadius:6, background:p.planName==="pro"?"#EFF6FF":"#F5F3FF", color:p.planName==="pro"?"#1D4ED8":"#6D28D9" }}>{p.planName}</span>
                    <div style={{ fontSize:10.5, color:"#94A3B8", marginTop:2 }}>{p.planPrice}</div>
                  </td>
                  <td style={{ padding:"12px 14px", fontSize:12, color:"#334155" }}>{p.paymentMethod}</td>
                  <td style={{ padding:"12px 14px" }}>
                    <code style={{ fontSize:11, background:"#F1F5F9", padding:"2px 6px", borderRadius:4, color:"#334155" }}>{p.referenceNumber || "—"}</code>
                  </td>
                  <td style={{ padding:"12px 14px", fontSize:11, color:"#94A3B8" }}>
                    {p.submittedAt?.toDate ? p.submittedAt.toDate().toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"}) : "—"}
                  </td>
                  <td style={{ padding:"12px 14px" }}><StatusBadge status={p.status} /></td>
                  <td style={{ padding:"12px 14px" }}>
                    <button onClick={() => setSelectedPayment(p)} style={{ padding:"5px 12px", borderRadius:7, border:"1px solid #E2E8F0", background:"#fff", fontSize:11.5, fontWeight:600, color:"#334155", cursor:"pointer", fontFamily:"'Inter',sans-serif" }}
                      onMouseEnter={e => { e.currentTarget.style.background="#0F172A"; e.currentTarget.style.color="#fff"; }}
                      onMouseLeave={e => { e.currentTarget.style.background="#fff"; e.currentTarget.style.color="#334155"; }}>
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  /* ── Shops tab ── */
  const ShopsTab = () => (
    <div>
      <h2 style={{ fontFamily:"'Lora',Georgia,serif", fontSize:20, fontWeight:900, color:"#0F172A", marginBottom:20 }}>Manage Shops</h2>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:16 }}>
        {approvedShops.map(shop => (
          <div key={shop.id} style={{ background:"#fff", borderRadius:14, border:"1px solid #E2E8F0", padding:"20px" }}>
            <div style={{ display:"flex", alignItems:"flex-start", gap:12, marginBottom:14 }}>
              <Avatar name={shop.shopName||""} size={42} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:700, color:"#0F172A" }}>{shop.shopName}</div>
                <div style={{ fontSize:11, color:"#64748B", marginBottom:4 }}>{shop.ownerName}</div>
                <div style={{ display:"flex", gap:6 }}>
                  <StatusBadge status={shop.status} />
                  {shop.subscriptionPlan && (
                    <span style={{ fontSize:9, fontWeight:700, padding:"3px 8px", borderRadius:20, textTransform:"uppercase", background:shop.subscriptionPlan==="pro"?"#EFF6FF":shop.subscriptionPlan==="business"?"#F5F3FF":"#F1F5F9", color:shop.subscriptionPlan==="pro"?"#1D4ED8":shop.subscriptionPlan==="business"?"#6D28D9":"#64748B", border:`1px solid ${shop.subscriptionPlan==="pro"?"#BFDBFE":shop.subscriptionPlan==="business"?"#DDD6FE":"#E2E8F0"}` }}>{shop.subscriptionPlan}</span>
                  )}
                </div>
              </div>
            </div>
            <div style={{ borderTop:"1px solid #F1F5F9", paddingTop:12 }}>
              <div style={{ fontSize:11.5, color:"#64748B", marginBottom:4 }}>{shop.city}, {shop.province}</div>
              <div style={{ fontSize:11.5, color:"#64748B", marginBottom:4 }}>{shop.email}</div>
            </div>
            <button onClick={() => setSelected(shop)} style={{ width:"100%", marginTop:12, padding:"8px", borderRadius:8, border:"1px solid #E2E8F0", background:"#F8FAFC", cursor:"pointer", fontSize:11.5, fontWeight:600, color:"#334155", fontFamily:"'Inter',sans-serif" }}>View Details</button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":     return <DashboardTab />;
      case "applications":  return <ApplicationsTab />;
      case "shops":         return <ShopsTab />;
      case "subscriptions": return <SubscriptionsTab />;
      default:              return <div style={{ textAlign:"center", padding:80, color:"#94A3B8" }}>Coming soon</div>;
    }
  };

  /* ── Shop Detail Modal ── */
  const DetailModal = () => selected && (
    <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.55)", backdropFilter:"blur(6px)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}
      onClick={e => { if(e.target===e.currentTarget) setSelected(null); }}>
      <div style={{ background:"#fff", borderRadius:20, width:"100%", maxWidth:600, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 40px 100px rgba(0,0,0,0.3)" }}>
        <div style={{ padding:"22px 28px 18px", borderBottom:"1px solid #F1F5F9", display:"flex", alignItems:"flex-start", justifyContent:"space-between", position:"sticky", top:0, background:"#fff", zIndex:2 }}>
          <div style={{ display:"flex", gap:14, alignItems:"flex-start" }}>
            <Avatar name={selected.shopName||""} size={44} />
            <div>
              <h3 style={{ fontFamily:"'Lora',Georgia,serif", fontSize:18, fontWeight:900, color:"#0F172A", marginBottom:4 }}>{selected.shopName}</h3>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:11, color:"#94A3B8" }}>{selected.email}</span>
                <StatusBadge status={selected.status} />
              </div>
            </div>
          </div>
          <button onClick={() => setSelected(null)} style={{ width:32, height:32, borderRadius:"50%", background:"#F1F5F9", border:"none", cursor:"pointer", color:"#64748B", fontSize:16 }}>×</button>
        </div>
        <div style={{ padding:"22px 28px" }}>
          {[["Owner",selected.ownerName],["Email",selected.email],["Phone",selected.phone],["Address",selected.address],["City",selected.city],["Province",selected.province],["Description",selected.description||"Not provided"]].map(([k,v]) => (
            <div key={k} style={{ display:"flex", gap:12, fontSize:13, marginBottom:9 }}>
              <span style={{ color:"#94A3B8", minWidth:130, flexShrink:0 }}>{k}</span>
              <span style={{ color:"#0F172A", fontWeight:500 }}>{v||"—"}</span>
            </div>
          ))}

          {/* Documents */}
          {selected.documents?.length > 0 && (
            <div style={{ marginTop:20 }}>
              <div style={{ fontSize:9.5, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase", color:"#3B82F6", marginBottom:12, paddingBottom:8, borderBottom:"1px solid #F1F5F9" }}>
                Submitted Documents ({selected.documents.length})
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:10 }}>
                {selected.documents.map((docItem, i) => (
                  <div key={i} onClick={() => setPreviewModal(docItem)} style={{ borderRadius:10, overflow:"hidden", border:"1px solid #E2E8F0", cursor:"pointer" }}>
                    {docItem.type?.startsWith("image") ? (
                      <img src={docItem.url} alt={docItem.name} style={{ width:"100%", height:120, objectFit:"cover", display:"block" }} />
                    ) : (
                      <div style={{ height:120, background:"#F8FAFC", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:6 }}>
                        <span style={{ fontSize:28 }}>📄</span>
                        <span style={{ fontSize:10, color:"#64748B", textAlign:"center", padding:"0 8px" }}>{docItem.name}</span>
                      </div>
                    )}
                    <div style={{ padding:"6px 8px", background:"#F8FAFC", borderTop:"1px solid #E2E8F0" }}>
                      <div style={{ fontSize:10, fontWeight:600, color:"#334155", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                        {DOCUMENT_TYPES.find(t => t.value === docItem.docType)?.label || docItem.docType || "Document"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {selected.status === "pending" && (
          <div style={{ padding:"16px 28px 22px", borderTop:"1px solid #F1F5F9", display:"flex", gap:12 }}>
            <button disabled={actionLoading} onClick={() => setRejectModal(true)} style={{ flex:1, padding:"12px", borderRadius:10, border:"1.5px solid #FECACA", background:"#FEF2F2", color:"#EF4444", fontSize:13, fontWeight:600, cursor:"pointer" }}>Reject Application</button>
            <button disabled={actionLoading} onClick={() => handleApprove(selected.id)} style={{ flex:2, padding:"12px", borderRadius:10, border:"none", background:"linear-gradient(135deg,#059669,#10B981)", color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer", opacity:actionLoading?0.7:1 }}>
              {actionLoading ? "Processing..." : "✓ Approve Shop"}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  /* ── Payment Detail Modal ── */
  const PaymentModal = () => selectedPayment && (
    <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.55)", backdropFilter:"blur(6px)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}
      onClick={e => { if(e.target===e.currentTarget) setSelectedPayment(null); }}>
      <div style={{ background:"#fff", borderRadius:20, width:"100%", maxWidth:560, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 40px 100px rgba(0,0,0,0.3)" }}>
        <div style={{ padding:"22px 28px 18px", borderBottom:"1px solid #F1F5F9", display:"flex", alignItems:"flex-start", justifyContent:"space-between", position:"sticky", top:0, background:"#fff", zIndex:2 }}>
          <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
            <Avatar name={selectedPayment.shopName||""} size={44} />
            <div>
              <h3 style={{ fontFamily:"'Lora',Georgia,serif", fontSize:17, fontWeight:900, color:"#0F172A", marginBottom:4 }}>{selectedPayment.shopName}</h3>
              <div style={{ display:"flex", gap:8 }}>
                <span style={{ fontSize:10.5, fontWeight:700, textTransform:"uppercase", padding:"3px 10px", borderRadius:20, background:selectedPayment.planName==="pro"?"#EFF6FF":"#F5F3FF", color:selectedPayment.planName==="pro"?"#1D4ED8":"#6D28D9" }}>{selectedPayment.planName} plan</span>
                <StatusBadge status={selectedPayment.status} />
              </div>
            </div>
          </div>
          <button onClick={() => setSelectedPayment(null)} style={{ width:32, height:32, borderRadius:"50%", background:"#F1F5F9", border:"none", cursor:"pointer", color:"#64748B", fontSize:16 }}>×</button>
        </div>
        <div style={{ padding:"22px 28px" }}>
          {[
            ["Shop Owner",  selectedPayment.ownerName],
            ["Email",       selectedPayment.email],
            ["Plan",        `${selectedPayment.planName?.toUpperCase()} — ${selectedPayment.planPrice}`],
            ["Method",      selectedPayment.paymentMethod],
            ["Reference #", selectedPayment.referenceNumber || "—"],
            ["Submitted",   selectedPayment.submittedAt?.toDate ? selectedPayment.submittedAt.toDate().toLocaleString("en-PH") : "—"],
          ].map(([k,v]) => (
            <div key={k} style={{ display:"flex", gap:12, fontSize:13, marginBottom:9 }}>
              <span style={{ color:"#94A3B8", minWidth:130, flexShrink:0 }}>{k}</span>
              <span style={{ color:"#0F172A", fontWeight:500 }}>{v||"—"}</span>
            </div>
          ))}

          {/* Screenshot — click to enlarge */}
          {selectedPayment.screenshotBase64 && (
            <div style={{ marginTop:16 }}>
              <div style={{ fontSize:9.5, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase", color:"#3B82F6", marginBottom:10, paddingBottom:8, borderBottom:"1px solid #F1F5F9" }}>Payment Screenshot</div>
              <div
                onClick={() => setPreviewModal({ url: selectedPayment.screenshotBase64, name: "Payment Screenshot", type: "image/png" })}
                style={{ borderRadius:10, overflow:"hidden", border:"2px solid #E2E8F0", cursor:"zoom-in", transition:"border-color 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.borderColor="#3B82F6"}
                onMouseLeave={e => e.currentTarget.style.borderColor="#E2E8F0"}
              >
                <img src={selectedPayment.screenshotBase64} alt="Payment proof" style={{ width:"100%", maxHeight:280, objectFit:"cover", display:"block", background:"#F8FAFC" }} />
              </div>
              <div style={{ fontSize:11, color:"#94A3B8", marginTop:6, textAlign:"center" }}>Click to view full size</div>
            </div>
          )}

          {!selectedPayment.screenshotBase64 && (
            <div style={{ background:"#FFFBEB", border:"1px solid #FCD34D", borderRadius:10, padding:"12px 16px", marginTop:16, fontSize:12.5, color:"#92400E" }}>
              ⚠️ No screenshot submitted. Verify the reference number manually before confirming.
            </div>
          )}
        </div>

        {selectedPayment.status === "pending" && (
          <div style={{ padding:"16px 28px 22px", borderTop:"1px solid #F1F5F9", display:"flex", gap:12 }}>
            <button disabled={actionLoading} onClick={() => setPayRejectModal(true)} style={{ flex:1, padding:"12px", borderRadius:10, border:"1.5px solid #FECACA", background:"#FEF2F2", color:"#EF4444", fontSize:13, fontWeight:600, cursor:"pointer" }}>Reject Payment</button>
            <button disabled={actionLoading} onClick={() => handleConfirmPayment(selectedPayment.id, selectedPayment.planName, selectedPayment.shopId)} style={{ flex:2, padding:"12px", borderRadius:10, border:"none", background:"linear-gradient(135deg,#059669,#10B981)", color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer", opacity:actionLoading?0.7:1, boxShadow:"0 4px 14px rgba(16,185,129,0.3)" }}>
              {actionLoading ? "Confirming..." : "✓ Confirm & Activate Plan"}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  /* ── Reject modals ── */
  const RejectModal = () => rejectModal && (
    <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.6)", backdropFilter:"blur(6px)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:"#fff", borderRadius:18, width:"100%", maxWidth:430, padding:"28px" }}>
        <h4 style={{ fontFamily:"'Lora',Georgia,serif", fontSize:17, fontWeight:700, color:"#0F172A", marginBottom:6 }}>Reject Application</h4>
        <p style={{ fontSize:12.5, color:"#64748B", lineHeight:1.6, marginBottom:18 }}>Reason for rejecting <strong style={{ color:"#0F172A" }}>{selected?.shopName}</strong>:</p>
        <textarea placeholder="e.g. Submitted documents are incomplete." value={rejectReason} onChange={e => setRejectReason(e.target.value)} style={{ width:"100%", minHeight:96, padding:"11px 14px", borderRadius:8, border:"1.5px solid #E2E8F0", fontSize:12.5, fontFamily:"'Inter',sans-serif", color:"#0F172A", resize:"none", outline:"none", background:"#F8FAFC", marginBottom:16 }} />
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={() => { setRejectModal(false); setRejectReason(""); }} style={{ padding:"11px 20px", borderRadius:8, border:"1px solid #E2E8F0", background:"#F8FAFC", fontSize:12.5, fontWeight:500, color:"#64748B", cursor:"pointer" }}>Cancel</button>
          <button disabled={!rejectReason.trim()||actionLoading} onClick={handleReject} style={{ flex:1, padding:"11px", borderRadius:8, border:"none", background:rejectReason.trim()?"linear-gradient(135deg,#DC2626,#EF4444)":"#F1F5F9", color:rejectReason.trim()?"#fff":"#94A3B8", fontSize:12.5, fontWeight:600, cursor:rejectReason.trim()?"pointer":"not-allowed" }}>
            {actionLoading ? "Rejecting..." : "Confirm Rejection"}
          </button>
        </div>
      </div>
    </div>
  );

  const PayRejectModal = () => payRejectModal && (
    <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.6)", backdropFilter:"blur(6px)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:"#fff", borderRadius:18, width:"100%", maxWidth:430, padding:"28px" }}>
        <h4 style={{ fontFamily:"'Lora',Georgia,serif", fontSize:17, fontWeight:700, color:"#0F172A", marginBottom:6 }}>Reject Payment</h4>
        <p style={{ fontSize:12.5, color:"#64748B", lineHeight:1.6, marginBottom:18 }}>
          Reason for rejecting payment from <strong style={{ color:"#0F172A" }}>{selectedPayment?.shopName}</strong>:
        </p>
        <textarea placeholder="e.g. Reference number could not be verified." value={payRejectReason} onChange={e => setPayRejectReason(e.target.value)} style={{ width:"100%", minHeight:88, padding:"11px 14px", borderRadius:8, border:"1.5px solid #E2E8F0", fontSize:12.5, fontFamily:"'Inter',sans-serif", color:"#0F172A", resize:"none", outline:"none", background:"#F8FAFC", marginBottom:16 }} />
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={() => { setPayRejectModal(false); setPayRejectReason(""); }} style={{ padding:"11px 20px", borderRadius:8, border:"1px solid #E2E8F0", background:"#F8FAFC", fontSize:12.5, fontWeight:500, color:"#64748B", cursor:"pointer" }}>Cancel</button>
          <button disabled={!payRejectReason.trim()||actionLoading} onClick={handleRejectPayment} style={{ flex:1, padding:"11px", borderRadius:8, border:"none", background:payRejectReason.trim()?"linear-gradient(135deg,#DC2626,#EF4444)":"#F1F5F9", color:payRejectReason.trim()?"#fff":"#94A3B8", fontSize:12.5, fontWeight:600, cursor:payRejectReason.trim()?"pointer":"not-allowed" }}>
            {actionLoading ? "Rejecting..." : "Reject Payment"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Inter',sans-serif;}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
      <div style={{ display:"flex", minHeight:"100vh", background:"#F1F5F9" }}>
        <Sidebar />
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
          <Topbar />
          <main style={{ flex:1, padding:28, overflowY:"auto" }}>
            {loading ? (
              <div style={{ textAlign:"center", padding:80 }}>
                <div style={{ width:32, height:32, border:"3px solid #E2E8F0", borderTopColor:"#3B82F6", borderRadius:"50%", animation:"spin .8s linear infinite", margin:"0 auto 12px" }} />
                <div style={{ color:"#94A3B8", fontSize:13 }}>Loading...</div>
              </div>
            ) : renderContent()}
          </main>
        </div>
      </div>

      <DetailModal />
      <PaymentModal />
      <RejectModal />
      <PayRejectModal />

      {/* Fullscreen image preview */}
      {previewModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.88)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}
          onClick={() => setPreviewModal(null)}>
          <div style={{ position:"relative", maxWidth:900, width:"100%", maxHeight:"90vh" }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setPreviewModal(null)} style={{ position:"absolute", top:-16, right:-16, width:36, height:36, borderRadius:"50%", background:"#fff", border:"none", fontSize:20, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 2px 12px rgba(0,0,0,0.3)", zIndex:1 }}>×</button>
            <img src={previewModal.url} alt={previewModal.name} style={{ width:"100%", maxHeight:"85vh", objectFit:"contain", borderRadius:12, display:"block", background:"#111" }} />
            <div style={{ textAlign:"center", marginTop:10, color:"rgba(255,255,255,0.6)", fontSize:12 }}>{previewModal.name}</div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position:"fixed", bottom:24, right:24, display:"flex", alignItems:"center", gap:10, padding:"12px 18px", borderRadius:10, background:toast.type==="error"?"#DC2626":"#0F172A", color:"#fff", fontSize:12.5, fontWeight:500, boxShadow:"0 10px 30px rgba(0,0,0,0.25)", zIndex:500, maxWidth:320 }}>
          {toast.msg}
        </div>
      )}
    </>
  );
}