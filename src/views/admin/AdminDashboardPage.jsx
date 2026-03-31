// src/views/admin/AdminDashboard.jsx
// iConstruct — Super Admin Control Center
// Includes full Subscriptions tab with payment review, confirm, and reject

import { useState, useEffect, useRef } from "react";
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

/* ─────────────────── helpers ─────────────────── */
const STATUS_COLOR = {
  pending:   { bg: "#FEF3C7", border: "#FCD34D", text: "#92400E", dot: "#F59E0B" },
  approved:  { bg: "#D1FAE5", border: "#6EE7B7", text: "#065F46", dot: "#10B981" },
  rejected:  { bg: "#FEE2E2", border: "#FCA5A5", text: "#991B1B", dot: "#EF4444" },
  confirmed: { bg: "#D1FAE5", border: "#6EE7B7", text: "#065F46", dot: "#10B981" },
};

function StatusBadge({ status }) {
  const c = STATUS_COLOR[status] || STATUS_COLOR.pending;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: 20, padding: "3px 10px",
      fontSize: 10, fontWeight: 700, color: c.text,
      letterSpacing: "0.09em", textTransform: "uppercase",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: c.dot }} />
      {status}
    </span>
  );
}

function Avatar({ name = "", size = 36 }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const colors = ["#3B5998","#E8643A","#6366F1","#0891B2","#7C3AED","#B45309"];
  const color = colors[(name.charCodeAt(0) || 0) % colors.length];
  return (
    <span style={{
      width: size, height: size, borderRadius: "50%",
      background: color, color: "#fff",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.36, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
      flexShrink: 0, letterSpacing: "0.02em",
    }}>{initials}</span>
  );
}

const TABS = [
  { key: "dashboard",     label: "Dashboard",        icon: <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M3 4a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 8a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1v-4zm8-8a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V4zm0 8a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"/></svg> },
  { key: "applications",  label: "Shop Applications", icon: <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/></svg> },
  { key: "shops",         label: "Manage Shops",      icon: <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/></svg> },
  { key: "users",         label: "User Accounts",     icon: <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg> },
  { key: "subscriptions", label: "Subscriptions",     icon: <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/><path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd"/></svg> },
  { key: "settings",      label: "System Settings",   icon: <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd"/></svg> },
];

/* ─────────────────── main component ─────────────────── */
export default function AdminDashboard() {
  const navigate = useNavigate();
  const [shops, setShops]               = useState([]);
  const [stats, setStats]               = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [payments, setPayments]         = useState([]);
  const [payStats, setPayStats]         = useState({ total: 0, pending: 0, confirmed: 0, rejected: 0 });
  const [loading, setLoading]           = useState(true);
  const [activeTab, setActiveTab]       = useState("dashboard");
  const [filter, setFilter]             = useState("all");
  const [payFilter, setPayFilter]       = useState("all");
  const [search, setSearch]             = useState("");
  const [selected, setSelected]         = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [actionLoading, setActionLoading]     = useState(false);
  const [rejectModal, setRejectModal]   = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [payRejectModal, setPayRejectModal] = useState(false);
  const [payRejectReason, setPayRejectReason] = useState("");
  const [toast, setToast]               = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notifOpen, setNotifOpen]       = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [allShops, allStats, allPayments, allPayStats] = await Promise.all([
        getAllShops(),
        getShopStats(),
        getAllPayments(),
        getPaymentStats(),
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

  const handleApprove = async (uid) => {
    setActionLoading(true);
    try {
      await approveShop(uid);
      showToast("Shop approved successfully.");
      setSelected(null);
      load();
    } catch {
      showToast("Failed to approve. Try again.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setActionLoading(true);
    try {
      await rejectShop(selected.id, rejectReason);
      showToast("Application has been rejected.");
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

  const handleConfirmPayment = async (paymentId) => {
    setActionLoading(true);
    try {
      await confirmPayment(paymentId);
      showToast("Payment confirmed. Shop plan upgraded!");
      setSelectedPayment(null);
      load();
    } catch {
      showToast("Failed to confirm payment. Try again.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectPayment = async () => {
    if (!payRejectReason.trim()) return;
    setActionLoading(true);
    try {
      await rejectPayment(selectedPayment.id, payRejectReason);
      showToast("Payment rejected.");
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

  const filteredPayments = payments.filter(p =>
    payFilter === "all" || p.status === payFilter
  );

  const pendingShops    = shops.filter(s => s.status === "pending");
  const approvedShops   = shops.filter(s => s.status === "approved");
  const pendingPayments = payments.filter(p => p.status === "pending");

  /* ── Sidebar ── */
  const Sidebar = () => (
    <aside style={{
      width: sidebarCollapsed ? 72 : 240,
      minHeight: "100vh",
      background: "linear-gradient(175deg, #0F172A 0%, #1E2D3D 60%, #162032 100%)",
      display: "flex", flexDirection: "column",
      borderRight: "1px solid rgba(255,255,255,0.06)",
      transition: "width 0.25s cubic-bezier(0.4,0,0.2,1)",
      overflow: "hidden", flexShrink: 0,
      position: "relative", zIndex: 10,
    }}>
      <div style={{
        padding: sidebarCollapsed ? "24px 0" : "24px 20px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center",
        justifyContent: sidebarCollapsed ? "center" : "space-between", gap: 10,
      }}>
        {!sidebarCollapsed && (
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, color: "#F1F5F9", letterSpacing: "-0.01em", lineHeight: 1 }}>iConstruct</div>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(148,163,184,0.6)", marginTop: 3 }}>Admin Control Center</div>
          </div>
        )}
        <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} style={{
          width: 28, height: 28, borderRadius: 6,
          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)",
          color: "rgba(148,163,184,0.7)", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="12" height="12">
            <path d="M3 4h10M3 8h10M3 12h10"/>
          </svg>
        </button>
      </div>
      <nav style={{ flex: 1, padding: "12px 0", overflowY: "auto" }}>
        {!sidebarCollapsed && (
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(148,163,184,0.4)", padding: "8px 20px 4px" }}>Navigation</div>
        )}
        {TABS.map(tab => {
          const isActive = activeTab === tab.key;
          const pendingCount = tab.key === "applications" ? stats.pending : tab.key === "subscriptions" ? payStats.pending : 0;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10,
              padding: sidebarCollapsed ? "10px 0" : "10px 20px",
              justifyContent: sidebarCollapsed ? "center" : "flex-start",
              background: isActive ? "linear-gradient(90deg, rgba(59,130,246,0.15), rgba(59,130,246,0.05))" : "transparent",
              borderLeft: isActive ? "2px solid #3B82F6" : "2px solid transparent",
              border: "none", borderRight: "none",
              cursor: "pointer", transition: "all 0.15s",
              color: isActive ? "#93C5FD" : "rgba(148,163,184,0.65)",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13, fontWeight: isActive ? 600 : 400,
            }}>
              <span style={{ opacity: isActive ? 1 : 0.7, flexShrink: 0 }}>{tab.icon}</span>
              {!sidebarCollapsed && <span>{tab.label}</span>}
              {!sidebarCollapsed && pendingCount > 0 && (
                <span style={{ marginLeft: "auto", background: "#EF4444", color: "#fff", fontSize: 9, fontWeight: 700, borderRadius: 10, padding: "2px 6px" }}>{pendingCount}</span>
              )}
            </button>
          );
        })}
      </nav>
      <div style={{
        padding: sidebarCollapsed ? "16px 0" : "16px 20px",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", gap: 10,
        justifyContent: sidebarCollapsed ? "center" : "flex-start",
      }}>
        <Avatar name="Admin" size={32} />
        {!sidebarCollapsed && (
          <>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#F1F5F9" }}>Administrator</div>
              <div style={{ fontSize: 10, color: "rgba(148,163,184,0.5)" }}>Super Admin</div>
            </div>
            <button onClick={handleLogout} title="Sign Out" style={{
              width: 28, height: 28, borderRadius: 6,
              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
              color: "#F87171", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13"><path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h8a1 1 0 001-1v-2a1 1 0 10-2 0v1H4V5h6v1a1 1 0 102 0V4a1 1 0 00-1-1H3z" clipRule="evenodd"/><path d="M13.293 7.293a1 1 0 011.414 0l2 2a1 1 0 010 1.414l-2 2a1 1 0 01-1.414-1.414L14.586 10l-1.293-1.293a1 1 0 010-1.414z"/></svg>
            </button>
          </>
        )}
      </div>
    </aside>
  );

  /* ── Topbar ── */
  const Topbar = () => (
    <header style={{
      height: 60, background: "#ffffff",
      borderBottom: "1px solid #E2E8F0",
      display: "flex", alignItems: "center",
      padding: "0 28px", justifyContent: "space-between",
      position: "sticky", top: 0, zIndex: 50,
    }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", fontFamily: "'DM Sans', sans-serif" }}>
          {TABS.find(t => t.key === activeTab)?.label}
        </div>
        <div style={{ fontSize: 11, color: "#94A3B8" }}>iConstruct · Admin Control Center</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ position: "relative" }}>
          <button onClick={() => setNotifOpen(!notifOpen)} style={{
            width: 36, height: 36, borderRadius: 8, border: "1px solid #E2E8F0",
            background: "#F8FAFC", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B",
          }}>
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/></svg>
            {(stats.pending + payStats.pending) > 0 && (
              <span style={{
                position: "absolute", top: -4, right: -4,
                background: "#EF4444", color: "#fff",
                width: 16, height: 16, borderRadius: "50%",
                fontSize: 9, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "2px solid #fff",
              }}>{stats.pending + payStats.pending}</span>
            )}
          </button>
          {notifOpen && (
            <div style={{
              position: "absolute", top: 44, right: 0,
              width: 300, background: "#fff",
              border: "1px solid #E2E8F0", borderRadius: 12,
              boxShadow: "0 10px 40px rgba(0,0,0,0.1)", zIndex: 100, overflow: "hidden",
            }}>
              <div style={{ padding: "14px 16px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Notifications</span>
                <span style={{ fontSize: 10, color: "#3B82F6", fontWeight: 600, cursor: "pointer" }} onClick={() => setNotifOpen(false)}>Close</span>
              </div>
              {pendingShops.slice(0, 3).map(shop => (
                <div key={shop.id} style={{ padding: "12px 16px", borderBottom: "1px solid #F8FAFC", display: "flex", gap: 10, cursor: "pointer" }}
                  onClick={() => { setSelected(shop); setActiveTab("applications"); setNotifOpen(false); }}>
                  <Avatar name={shop.shopName || ""} size={28} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}>{shop.shopName}</div>
                    <div style={{ fontSize: 11, color: "#64748B" }}>New shop application</div>
                  </div>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#F59E0B", flexShrink: 0, marginTop: 4 }} />
                </div>
              ))}
              {pendingPayments.slice(0, 3).map(p => (
                <div key={p.id} style={{ padding: "12px 16px", borderBottom: "1px solid #F8FAFC", display: "flex", gap: 10, cursor: "pointer" }}
                  onClick={() => { setSelectedPayment(p); setActiveTab("subscriptions"); setNotifOpen(false); }}>
                  <Avatar name={p.shopName || ""} size={28} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}>{p.shopName}</div>
                    <div style={{ fontSize: 11, color: "#64748B" }}>Payment request · {p.planName}</div>
                  </div>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#3B82F6", flexShrink: 0, marginTop: 4 }} />
                </div>
              ))}
              {stats.pending === 0 && payStats.pending === 0 && (
                <div style={{ padding: "24px 16px", textAlign: "center", color: "#94A3B8", fontSize: 12 }}>No new notifications</div>
              )}
            </div>
          )}
        </div>
        <button onClick={load} title="Refresh" style={{
          width: 36, height: 36, borderRadius: 8, border: "1px solid #E2E8F0",
          background: "#F8FAFC", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B",
        }}>
          <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd"/></svg>
        </button>
        <div style={{ width: 1, height: 24, background: "#E2E8F0" }} />
        <Avatar name="Administrator" size={34} />
      </div>
    </header>
  );

  /* ── Dashboard tab ── */
  const DashboardTab = () => {
    const recentApplications = [...shops].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).slice(0, 5);
    const statCards = [
      { label: "Total Applications", value: stats.total, color: "#3B82F6", bg: "#EFF6FF", sub: "All time registrations",
        icon: <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd"/></svg> },
      { label: "Pending Review", value: stats.pending, color: "#F59E0B", bg: "#FFFBEB", sub: "Awaiting your decision", urgent: stats.pending > 0,
        icon: <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/></svg> },
      { label: "Approved Shops", value: stats.approved, color: "#10B981", bg: "#ECFDF5", sub: "Active on platform",
        icon: <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg> },
      { label: "Pending Payments", value: payStats.pending, color: "#7C3AED", bg: "#F5F3FF", sub: "Waiting for confirmation", urgent: payStats.pending > 0,
        icon: <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/><path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd"/></svg> },
    ];
    return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900, color: "#0F172A", marginBottom: 4 }}>Welcome back, Administrator</h2>
          <p style={{ fontSize: 13, color: "#64748B" }}>Here's what's happening with iConstruct today.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
          {statCards.map((card, i) => (
            <div key={i} style={{
              background: "#fff", borderRadius: 14,
              border: card.urgent ? `1px solid ${card.color}40` : "1px solid #E2E8F0",
              padding: "20px 22px",
              boxShadow: card.urgent ? `0 0 0 3px ${card.color}10` : "0 1px 4px rgba(0,0,0,0.04)",
              position: "relative", overflow: "hidden",
            }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: card.color, borderRadius: "14px 14px 0 0" }} />
              <div style={{ width: 40, height: 40, borderRadius: 10, background: card.bg, display: "flex", alignItems: "center", justifyContent: "center", color: card.color, marginBottom: 14 }}>{card.icon}</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 900, color: card.color, lineHeight: 1, marginBottom: 4 }}>{card.value}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", marginBottom: 2 }}>{card.label}</div>
              <div style={{ fontSize: 11, color: "#94A3B8" }}>{card.sub}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0", overflow: "hidden" }}>
            <div style={{ padding: "18px 22px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>Recent Applications</div>
                <div style={{ fontSize: 11, color: "#94A3B8" }}>Latest shop registrations</div>
              </div>
              <button onClick={() => setActiveTab("applications")} style={{ fontSize: 11, fontWeight: 600, color: "#3B82F6", background: "none", border: "none", cursor: "pointer" }}>View All →</button>
            </div>
            {loading ? <div style={{ padding: 32, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>Loading...</div>
              : recentApplications.length === 0 ? <div style={{ padding: 32, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>No applications yet.</div>
              : recentApplications.map((shop, i) => (
                <div key={shop.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 22px", borderBottom: i < recentApplications.length - 1 ? "1px solid #F8FAFC" : "none", cursor: "pointer" }}
                  onClick={() => { setSelected(shop); setActiveTab("applications"); }}
                  onMouseEnter={e => e.currentTarget.style.background = "#FAFAFA"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <Avatar name={shop.shopName || ""} size={38} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{shop.shopName}</div>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>{shop.ownerName} · {shop.city}</div>
                  </div>
                  <StatusBadge status={shop.status} />
                </div>
              ))
            }
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0", padding: "18px 20px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginBottom: 14 }}>Approval Rate</div>
              {[
                { label: "Approved", value: stats.approved, total: stats.total, color: "#10B981" },
                { label: "Pending",  value: stats.pending,  total: stats.total, color: "#F59E0B" },
                { label: "Rejected", value: stats.rejected, total: stats.total, color: "#EF4444" },
              ].map(({ label, value, total, color }) => {
                const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                return (
                  <div key={label} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: "#64748B" }}>{label}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color }}>{pct}%</span>
                    </div>
                    <div style={{ height: 5, background: "#F1F5F9", borderRadius: 4 }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 4 }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0", padding: "18px 20px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginBottom: 12 }}>Quick Actions</div>
              {[
                { label: "Review Applications", badge: stats.pending,   tab: "applications",  color: "#F59E0B" },
                { label: "Review Payments",      badge: payStats.pending, tab: "subscriptions", color: "#7C3AED" },
                { label: "Manage Shops",         badge: stats.approved,  tab: "shops",         color: "#10B981" },
              ].map(item => (
                <button key={item.tab} onClick={() => setActiveTab(item.tab)} style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "9px 12px", borderRadius: 8, marginBottom: 6,
                  background: "#F8FAFC", border: "1px solid #F1F5F9",
                  cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "#F1F5F9"}
                onMouseLeave={e => e.currentTarget.style.background = "#F8FAFC"}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "#334155" }}>{item.label}</span>
                  {item.badge > 0 && (
                    <span style={{ background: item.color + "20", color: item.color, fontSize: 10, fontWeight: 700, borderRadius: 10, padding: "1px 7px" }}>{item.badge}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ── Applications tab ── */
  const ApplicationsTab = () => (
    <div>
      <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: "#0F172A", marginBottom: 2 }}>Shop Applications</h2>
          <p style={{ fontSize: 12, color: "#64748B" }}>Review, approve, or reject hardware shop registration requests.</p>
        </div>
        <div style={{ fontSize: 12, color: "#94A3B8" }}>Showing <strong style={{ color: "#0F172A" }}>{filtered.length}</strong> of {shops.length}</div>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }}>
            <svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13"><path fillRule="evenodd" d="M9.965 11.026a5 5 0 111.06-1.06l2.755 2.754a.75.75 0 11-1.06 1.06l-2.755-2.754zM10.5 7a3.5 3.5 0 11-7 0 3.5 3.5 0 017 0z" clipRule="evenodd"/></svg>
          </span>
          <input placeholder="Search by shop, owner, email, city..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: "100%", paddingLeft: 34, paddingRight: 14, paddingTop: 9, paddingBottom: 9, border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 12, fontFamily: "'DM Sans', sans-serif", color: "#0F172A", background: "#fff", outline: "none" }} />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["all","pending","approved","rejected"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "8px 14px", borderRadius: 8, fontSize: 11.5, fontWeight: 500,
              cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s",
              ...(filter === f ? { background: "#0F172A", color: "#fff", border: "1px solid #0F172A" } : { background: "#fff", color: "#64748B", border: "1px solid #E2E8F0" }),
            }}>
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
              {f !== "all" && <span style={{ marginLeft: 5, opacity: 0.6 }}>({stats[f] ?? 0})</span>}
            </button>
          ))}
        </div>
      </div>
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <div style={{ width: 32, height: 32, border: "3px solid #E2E8F0", borderTopColor: "#3B82F6", borderRadius: "50%", animation: "icspin 0.8s linear infinite", margin: "0 auto 12px" }} />
            <div style={{ color: "#94A3B8", fontSize: 13 }}>Loading...</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 64, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🏗️</div>
            <div style={{ color: "#0F172A", fontWeight: 600, marginBottom: 4 }}>No applications found</div>
            <div style={{ color: "#94A3B8", fontSize: 12 }}>Try adjusting your search or filter.</div>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F8FAFC" }}>
                {["#","Shop","Owner","Location","Date Applied","Status","Action"].map(h => (
                  <th key={h} style={{ padding: "11px 16px", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#94A3B8", textAlign: "left", borderBottom: "1px solid #E2E8F0" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((shop, i) => (
                <tr key={shop.id}
                  onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "13px 16px", color: "#CBD5E1", fontSize: 11 }}>{String(i + 1).padStart(2, "0")}</td>
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar name={shop.shopName || ""} size={32} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{shop.shopName}</div>
                        <div style={{ fontSize: 11, color: "#94A3B8" }}>{shop.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "13px 16px", fontSize: 13, color: "#334155" }}>{shop.ownerName}</td>
                  <td style={{ padding: "13px 16px", fontSize: 12, color: "#64748B" }}>{shop.city}, {shop.province}</td>
                  <td style={{ padding: "13px 16px", fontSize: 11.5, color: "#94A3B8" }}>
                    {shop.createdAt?.toDate ? shop.createdAt.toDate().toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                  </td>
                  <td style={{ padding: "13px 16px" }}><StatusBadge status={shop.status} /></td>
                  <td style={{ padding: "13px 16px" }}>
                    <button onClick={() => setSelected(shop)} style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "6px 13px", borderRadius: 7,
                      border: "1px solid #E2E8F0", background: "#fff",
                      fontSize: 11.5, fontWeight: 600, color: "#334155",
                      cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "#0F172A"; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "#0F172A"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = "#334155"; e.currentTarget.style.borderColor = "#E2E8F0"; }}>
                      Review <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="10" height="10"><path d="M2 6h8M6 2l4 4-4 4"/></svg>
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

  /* ── Subscriptions / Payments tab ── */
  const SubscriptionsTab = () => {
    const payStatCards = [
      { label: "Total Payments",    value: payStats.total,     color: "#3B82F6", bg: "#EFF6FF" },
      { label: "Pending Review",    value: payStats.pending,   color: "#F59E0B", bg: "#FFFBEB", urgent: payStats.pending > 0 },
      { label: "Confirmed",         value: payStats.confirmed, color: "#10B981", bg: "#ECFDF5" },
      { label: "Rejected",          value: payStats.rejected,  color: "#EF4444", bg: "#FEF2F2" },
    ];
    return (
      <div>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: "#0F172A", marginBottom: 2 }}>Subscription Payments</h2>
          <p style={{ fontSize: 12, color: "#64748B" }}>Review payment requests from shop owners and activate their plans.</p>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
          {payStatCards.map((card, i) => (
            <div key={i} style={{
              background: "#fff", borderRadius: 12,
              border: card.urgent ? `1px solid ${card.color}40` : "1px solid #E2E8F0",
              padding: "16px 18px",
              boxShadow: card.urgent ? `0 0 0 3px ${card.color}10` : "none",
              position: "relative", overflow: "hidden",
            }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: card.color }} />
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 900, color: card.color }}>{card.value}</div>
              <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 2 }}>{card.label}</div>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {["all","pending","confirmed","rejected"].map(f => (
            <button key={f} onClick={() => setPayFilter(f)} style={{
              padding: "7px 14px", borderRadius: 8, fontSize: 11.5, fontWeight: 500,
              cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              ...(payFilter === f ? { background: "#0F172A", color: "#fff", border: "1px solid #0F172A" } : { background: "#fff", color: "#64748B", border: "1px solid #E2E8F0" }),
            }}>
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
              {f !== "all" && <span style={{ marginLeft: 4, opacity: 0.6 }}>({payStats[f] ?? 0})</span>}
            </button>
          ))}
        </div>

        {/* Payment list */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0", overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>Loading payments...</div>
          ) : filteredPayments.length === 0 ? (
            <div style={{ padding: 64, textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>💳</div>
              <div style={{ color: "#0F172A", fontWeight: 600, marginBottom: 4 }}>No payment requests</div>
              <div style={{ color: "#94A3B8", fontSize: 12 }}>Shop owners will appear here when they submit payment.</div>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F8FAFC" }}>
                  {["#","Shop","Plan","Method","Reference #","Submitted","Status","Action"].map(h => (
                    <th key={h} style={{ padding: "11px 14px", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#94A3B8", textAlign: "left", borderBottom: "1px solid #E2E8F0" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((p, i) => (
                  <tr key={p.id}
                    onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td style={{ padding: "12px 14px", color: "#CBD5E1", fontSize: 11 }}>{String(i + 1).padStart(2, "0")}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <Avatar name={p.shopName || ""} size={30} />
                        <div>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: "#0F172A" }}>{p.shopName}</div>
                          <div style={{ fontSize: 10.5, color: "#94A3B8" }}>{p.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{
                        fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em",
                        textTransform: "uppercase", padding: "3px 9px", borderRadius: 6,
                        background: p.planName === "pro" ? "#EFF6FF" : "#F5F3FF",
                        color: p.planName === "pro" ? "#1D4ED8" : "#6D28D9",
                      }}>{p.planName}</span>
                      <div style={{ fontSize: 10.5, color: "#94A3B8", marginTop: 2 }}>{p.planPrice}</div>
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: "#334155" }}>{p.paymentMethod}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <code style={{ fontSize: 11, background: "#F1F5F9", padding: "2px 6px", borderRadius: 4, color: "#334155" }}>{p.referenceNumber}</code>
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 11, color: "#94A3B8" }}>
                      {p.submittedAt?.toDate ? p.submittedAt.toDate().toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                    </td>
                    <td style={{ padding: "12px 14px" }}><StatusBadge status={p.status} /></td>
                    <td style={{ padding: "12px 14px" }}>
                      <button onClick={() => setSelectedPayment(p)} style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        padding: "5px 12px", borderRadius: 7,
                        border: "1px solid #E2E8F0", background: "#fff",
                        fontSize: 11.5, fontWeight: 600, color: "#334155",
                        cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = "#0F172A"; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "#0F172A"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = "#334155"; e.currentTarget.style.borderColor = "#E2E8F0"; }}>
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
  };

  /* ── Manage Shops tab ── */
  const ShopsTab = () => (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: "#0F172A", marginBottom: 2 }}>Manage Shops</h2>
        <p style={{ fontSize: 12, color: "#64748B" }}>All approved hardware shops on the platform.</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        {loading ? <div style={{ color: "#94A3B8", fontSize: 13, gridColumn: "1/-1", textAlign: "center", padding: 32 }}>Loading...</div>
          : approvedShops.length === 0 ? <div style={{ color: "#94A3B8", fontSize: 13, gridColumn: "1/-1", textAlign: "center", padding: 48 }}>No approved shops yet.</div>
          : approvedShops.map(shop => (
            <div key={shop.id} style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0", padding: "20px" }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.06)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
                <Avatar name={shop.shopName || ""} size={42} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{shop.shopName}</div>
                  <div style={{ fontSize: 11, color: "#64748B", marginBottom: 4 }}>{shop.ownerName}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <StatusBadge status={shop.status} />
                    {shop.subscriptionPlan && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 20, letterSpacing: "0.08em", textTransform: "uppercase",
                        background: shop.subscriptionPlan === "pro" ? "#EFF6FF" : shop.subscriptionPlan === "business" ? "#F5F3FF" : "#F1F5F9",
                        color: shop.subscriptionPlan === "pro" ? "#1D4ED8" : shop.subscriptionPlan === "business" ? "#6D28D9" : "#64748B",
                        border: `1px solid ${shop.subscriptionPlan === "pro" ? "#BFDBFE" : shop.subscriptionPlan === "business" ? "#DDD6FE" : "#E2E8F0"}`,
                      }}>{shop.subscriptionPlan}</span>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: 12 }}>
                {[shop.city + ", " + shop.province, shop.email, shop.phone || "—"].map((t, i) => (
                  <div key={i} style={{ fontSize: 11.5, color: "#64748B", marginBottom: 4 }}>{t}</div>
                ))}
              </div>
              <button onClick={() => setSelected(shop)} style={{
                width: "100%", marginTop: 12, padding: "8px", borderRadius: 8,
                border: "1px solid #E2E8F0", background: "#F8FAFC", cursor: "pointer",
                fontSize: 11.5, fontWeight: 600, color: "#334155", fontFamily: "'DM Sans', sans-serif",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "#E2E8F0"}
              onMouseLeave={e => e.currentTarget.style.background = "#F8FAFC"}>
                View Details
              </button>
            </div>
          ))
        }
      </div>
    </div>
  );

  const PlaceholderTab = ({ title, description, icon }) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 400 }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>{icon}</div>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: "#0F172A", marginBottom: 6 }}>{title}</h2>
      <p style={{ fontSize: 13, color: "#64748B", textAlign: "center", maxWidth: 320 }}>{description}</p>
      <div style={{ marginTop: 20, padding: "8px 18px", background: "#F1F5F9", borderRadius: 8, fontSize: 11, fontWeight: 600, color: "#64748B" }}>COMING SOON</div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":     return <DashboardTab />;
      case "applications":  return <ApplicationsTab />;
      case "shops":         return <ShopsTab />;
      case "subscriptions": return <SubscriptionsTab />;
      case "users":         return <PlaceholderTab title="User Accounts" description="Manage builder, contractor, and homeowner accounts." icon="👥" />;
      case "settings":      return <PlaceholderTab title="System Settings" description="Configure platform rules and security settings." icon="⚙️" />;
      default:              return null;
    }
  };

  /* ── Shop Detail Modal ── */
  const DetailModal = () => selected && (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", backdropFilter: "blur(6px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, animation: "icfadein 0.2s ease" }}
      onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}>
      <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 600, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 40px 100px rgba(0,0,0,0.3)", animation: "icslideup 0.3s cubic-bezier(0.22,1,0.36,1)" }}>
        <div style={{ padding: "22px 28px 18px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, position: "sticky", top: 0, background: "#fff", zIndex: 2 }}>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <Avatar name={selected.shopName || ""} size={44} />
            <div>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, color: "#0F172A", marginBottom: 4 }}>{selected.shopName}</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: "#94A3B8" }}>{selected.email}</span>
                <span style={{ color: "#E2E8F0" }}>·</span>
                <StatusBadge status={selected.status} />
              </div>
            </div>
          </div>
          <button onClick={() => setSelected(null)} style={{ width: 32, height: 32, borderRadius: "50%", background: "#F1F5F9", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B", fontSize: 16 }}>×</button>
        </div>
        <div style={{ padding: "22px 28px" }}>
          {[
            { title: "Owner Information", fields: [["Full Name", selected.ownerName], ["Email Address", selected.email], ["Phone Number", selected.phone]] },
            { title: "Shop Information",  fields: [["Shop Name", selected.shopName], ["Address", selected.address], ["City", selected.city], ["Province", selected.province], ["Description", selected.description || "Not provided"]] },
          ].map(section => (
            <div key={section.title} style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#3B82F6", marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid #F1F5F9" }}>{section.title}</div>
              {section.fields.map(([k, v]) => (
                <div key={k} style={{ display: "flex", gap: 12, fontSize: 13, marginBottom: 9 }}>
                  <span style={{ color: "#94A3B8", minWidth: 130, flexShrink: 0 }}>{k}</span>
                  <span style={{ color: "#0F172A", fontWeight: 500 }}>{v || "—"}</span>
                </div>
              ))}
            </div>
          ))}
          {selected.documentURL && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#3B82F6", marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid #F1F5F9" }}>Submitted Document</div>
              <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid #E2E8F0" }}>
                {selected.documentURL.startsWith("data:image") ? (
                  <img src={selected.documentURL} alt="Document" style={{ width: "100%", maxHeight: 200, objectFit: "cover", display: "block" }} />
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "#F8FAFC" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: "linear-gradient(135deg,#0F172A,#3B82F6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg viewBox="0 0 20 20" fill="rgba(255,255,255,0.9)" width="16" height="16"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd"/></svg>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#0F172A" }}>{selected.documentName || "Business document uploaded"}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          {selected.rejectionReason && (
            <div style={{ background: "#FEF2F2", borderRadius: 10, padding: "14px 16px", border: "1px solid #FECACA" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#EF4444", marginBottom: 6 }}>Rejection Reason</div>
              <p style={{ fontSize: 13, color: "#991B1B", lineHeight: 1.6 }}>{selected.rejectionReason}</p>
            </div>
          )}
        </div>
        {selected.status === "pending" && (
          <div style={{ padding: "16px 28px 22px", borderTop: "1px solid #F1F5F9", display: "flex", gap: 12 }}>
            <button disabled={actionLoading} onClick={() => setRejectModal(true)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "12px", borderRadius: 10, border: "1.5px solid #FECACA", background: "#FEF2F2", color: "#EF4444", fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}>
              Reject Application
            </button>
            <button disabled={actionLoading} onClick={() => handleApprove(selected.id)} style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "12px", borderRadius: 10, background: "linear-gradient(135deg,#059669,#10B981)", color: "#fff", fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", border: "none", opacity: actionLoading ? 0.7 : 1 }}>
              {actionLoading ? "Processing..." : "Approve Shop ✓"}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  /* ── Payment Detail Modal ── */
  const PaymentModal = () => selectedPayment && (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", backdropFilter: "blur(6px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, animation: "icfadein 0.2s ease" }}
      onClick={e => { if (e.target === e.currentTarget) setSelectedPayment(null); }}>
      <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 40px 100px rgba(0,0,0,0.3)", animation: "icslideup 0.3s cubic-bezier(0.22,1,0.36,1)" }}>
        {/* Header */}
        <div style={{ padding: "22px 28px 18px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "flex-start", justifyContent: "space-between", position: "sticky", top: 0, background: "#fff", zIndex: 2 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <Avatar name={selectedPayment.shopName || ""} size={44} />
            <div>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 900, color: "#0F172A", marginBottom: 4 }}>{selectedPayment.shopName}</h3>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", padding: "3px 10px", borderRadius: 20, background: selectedPayment.planName === "pro" ? "#EFF6FF" : "#F5F3FF", color: selectedPayment.planName === "pro" ? "#1D4ED8" : "#6D28D9" }}>{selectedPayment.planName} plan</span>
                <StatusBadge status={selectedPayment.status} />
              </div>
            </div>
          </div>
          <button onClick={() => setSelectedPayment(null)} style={{ width: 32, height: 32, borderRadius: "50%", background: "#F1F5F9", border: "none", cursor: "pointer", color: "#64748B", fontSize: 16 }}>×</button>
        </div>

        <div style={{ padding: "22px 28px" }}>
          {/* Payment details */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#3B82F6", marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid #F1F5F9" }}>Payment Details</div>
            {[
              ["Shop Owner", selectedPayment.ownerName],
              ["Email",      selectedPayment.email],
              ["Plan",       selectedPayment.planName?.toUpperCase() + " — " + selectedPayment.planPrice],
              ["Method",     selectedPayment.paymentMethod],
              ["Reference #", selectedPayment.referenceNumber],
              ["Submitted",  selectedPayment.submittedAt?.toDate ? selectedPayment.submittedAt.toDate().toLocaleString("en-PH") : "—"],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", gap: 12, fontSize: 13, marginBottom: 9 }}>
                <span style={{ color: "#94A3B8", minWidth: 130, flexShrink: 0 }}>{k}</span>
                <span style={{ color: "#0F172A", fontWeight: 500 }}>{v || "—"}</span>
              </div>
            ))}
          </div>

          {/* Screenshot proof */}
          {selectedPayment.screenshotBase64 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#3B82F6", marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid #F1F5F9" }}>Payment Screenshot</div>
              <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid #E2E8F0" }}>
                <img src={selectedPayment.screenshotBase64} alt="Payment proof" style={{ width: "100%", maxHeight: 280, objectFit: "contain", display: "block", background: "#F8FAFC" }} />
              </div>
            </div>
          )}

          {/* No screenshot */}
          {!selectedPayment.screenshotBase64 && (
            <div style={{ background: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 12.5, color: "#92400E" }}>
              ⚠️ No screenshot submitted. Verify the reference number manually before confirming.
            </div>
          )}

          {/* Rejection reason if already rejected */}
          {selectedPayment.rejectionReason && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "12px 16px", marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#EF4444", marginBottom: 4 }}>Rejection Reason</div>
              <p style={{ fontSize: 13, color: "#991B1B" }}>{selectedPayment.rejectionReason}</p>
            </div>
          )}
        </div>

        {/* Actions — only for pending */}
        {selectedPayment.status === "pending" && (
          <div style={{ padding: "16px 28px 22px", borderTop: "1px solid #F1F5F9", display: "flex", gap: 12 }}>
            <button disabled={actionLoading} onClick={() => setPayRejectModal(true)} style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              padding: "12px", borderRadius: 10, border: "1.5px solid #FECACA",
              background: "#FEF2F2", color: "#EF4444",
              fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
            }}>
              Reject Payment
            </button>
            <button disabled={actionLoading} onClick={() => handleConfirmPayment(selectedPayment.id)} style={{
              flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              padding: "12px", borderRadius: 10, border: "none",
              background: "linear-gradient(135deg,#059669,#10B981)",
              color: "#fff", fontSize: 13, fontWeight: 600,
              fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
              opacity: actionLoading ? 0.7 : 1,
              boxShadow: "0 4px 14px rgba(16,185,129,0.3)",
            }}>
              {actionLoading ? "Confirming..." : "✓ Confirm & Activate Plan"}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  /* ── Reject modals ── */
  const RejectModal = () => rejectModal && (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(6px)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 430, padding: "28px 28px 24px", boxShadow: "0 40px 100px rgba(0,0,0,0.3)", animation: "icslideup 0.25s cubic-bezier(0.22,1,0.36,1)" }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
          <svg viewBox="0 0 20 20" fill="#EF4444" width="20" height="20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
        </div>
        <h4 style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 700, color: "#0F172A", marginBottom: 6 }}>Reject Application</h4>
        <p style={{ fontSize: 12.5, color: "#64748B", lineHeight: 1.6, marginBottom: 18 }}>Provide a reason for rejecting <strong style={{ color: "#0F172A" }}>{selected?.shopName}</strong>.</p>
        <textarea placeholder="e.g. Submitted documents are incomplete." value={rejectReason} onChange={e => setRejectReason(e.target.value)} style={{ width: "100%", minHeight: 96, padding: "11px 14px", borderRadius: 8, border: "1.5px solid #E2E8F0", fontSize: 12.5, fontFamily: "'DM Sans', sans-serif", color: "#0F172A", resize: "none", outline: "none", background: "#F8FAFC", marginBottom: 16 }} onFocus={e => e.target.style.borderColor = "#EF4444"} onBlur={e => e.target.style.borderColor = "#E2E8F0"} />
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => { setRejectModal(false); setRejectReason(""); }} style={{ padding: "11px 20px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#F8FAFC", fontSize: 12.5, fontWeight: 500, color: "#64748B", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
          <button disabled={!rejectReason.trim() || actionLoading} onClick={handleReject} style={{ flex: 1, padding: "11px", borderRadius: 8, border: "none", background: rejectReason.trim() ? "linear-gradient(135deg,#DC2626,#EF4444)" : "#F1F5F9", color: rejectReason.trim() ? "#fff" : "#94A3B8", fontSize: 12.5, fontWeight: 600, cursor: rejectReason.trim() ? "pointer" : "not-allowed", fontFamily: "'DM Sans', sans-serif" }}>
            {actionLoading ? "Rejecting..." : "Confirm Rejection"}
          </button>
        </div>
      </div>
    </div>
  );

  const PayRejectModal = () => payRejectModal && (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(6px)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 430, padding: "28px 28px 24px", boxShadow: "0 40px 100px rgba(0,0,0,0.3)" }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
          💳
        </div>
        <h4 style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 700, color: "#0F172A", marginBottom: 6 }}>Reject Payment</h4>
        <p style={{ fontSize: 12.5, color: "#64748B", lineHeight: 1.6, marginBottom: 18 }}>
          Why is this payment being rejected? <strong style={{ color: "#0F172A" }}>{selectedPayment?.shopName}</strong> will be notified.
        </p>
        <textarea placeholder="e.g. Reference number could not be verified. Please resubmit with a valid transaction ID." value={payRejectReason} onChange={e => setPayRejectReason(e.target.value)} style={{ width: "100%", minHeight: 88, padding: "11px 14px", borderRadius: 8, border: "1.5px solid #E2E8F0", fontSize: 12.5, fontFamily: "'DM Sans', sans-serif", color: "#0F172A", resize: "none", outline: "none", background: "#F8FAFC", marginBottom: 16 }} />
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => { setPayRejectModal(false); setPayRejectReason(""); }} style={{ padding: "11px 20px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#F8FAFC", fontSize: 12.5, fontWeight: 500, color: "#64748B", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
          <button disabled={!payRejectReason.trim() || actionLoading} onClick={handleRejectPayment} style={{ flex: 1, padding: "11px", borderRadius: 8, border: "none", background: payRejectReason.trim() ? "linear-gradient(135deg,#DC2626,#EF4444)" : "#F1F5F9", color: payRejectReason.trim() ? "#fff" : "#94A3B8", fontSize: 12.5, fontWeight: 600, cursor: payRejectReason.trim() ? "pointer" : "not-allowed", fontFamily: "'DM Sans', sans-serif" }}>
            {actionLoading ? "Rejecting..." : "Reject Payment"}
          </button>
        </div>
      </div>
    </div>
  );

  const Toast = () => toast && (
    <div style={{ position: "fixed", bottom: 24, right: 24, display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", borderRadius: 10, background: toast.type === "error" ? "#DC2626" : "#0F172A", color: "#fff", fontSize: 12.5, fontWeight: 500, boxShadow: "0 10px 30px rgba(0,0,0,0.25)", zIndex: 500, animation: "ictoastin 0.3s ease", maxWidth: 320 }}>
      {toast.type === "error"
        ? <svg viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" width="14" height="14"><circle cx="8" cy="8" r="7"/><path d="M5 11L11 5M5 5l6 6"/></svg>
        : <svg viewBox="0 0 16 16" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" width="14" height="14"><path d="M13 4L6 11 3 8"/></svg>
      }
      {toast.msg}
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; }
        @keyframes icspin    { to { transform: rotate(360deg); } }
        @keyframes icfadein  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes icslideup { from { opacity: 0; transform: translateY(20px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes ictoastin { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 4px; }
      `}</style>
      <div style={{ display: "flex", minHeight: "100vh", background: "#F1F5F9" }}>
        <Sidebar />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <Topbar />
          <main style={{ flex: 1, padding: 28, overflowY: "auto" }}>
            {renderContent()}
          </main>
        </div>
      </div>
      <DetailModal />
      <PaymentModal />
      <RejectModal />
      <PayRejectModal />
      <Toast />
    </>
  );
}
