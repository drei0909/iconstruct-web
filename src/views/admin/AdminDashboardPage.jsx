  // src/views/admin/AdminDashboardPage.jsx
  // FIX: All tab components moved OUTSIDE AdminDashboard to prevent
  // remount-on-every-keystroke. Each gets only the props it needs.

  import { useSearch } from "../../hooks/useSearch";
  import { useState, useEffect } from "react";
  import { useNavigate } from "react-router-dom";
  import SearchBar from "../../components/ui/SearchBar";
  import {
    getAllShops, approveShop, rejectShop, logoutAdmin,
    getAllPayments, confirmPayment, rejectPayment,
    getContactMessages, suspendShop, reopenShop,
    watchAdminInbox,
  } from "../../controllers/adminController";

  import {
    Bell,
    ArrowCounterClockwise,
    CreditCard,
    CheckCircle,
    XCircle,
    ArrowRight,
    List,
    SignOut,
    FileText,
    MagnifyingGlass,
    Warning,
    X,
    Buildings,
    Storefront,
    CurrencyCircleDollar,
    GearSix,
    SquaresFour,
    EnvelopeSimple,
  } from "@phosphor-icons/react";

  import SystemSettingsTab from "./SystemSettingsTab";
  import ContactMessagesTab from "./ContactMessagesTab";
  import DashboardOverview from "./DashboardOverview";
  import ShopApplicationsTab, { getDocCompleteness } from "./ShopApplicationsTab";
  import ManageShopsTab from "./ManageShopsTab";
  import DashboardBrand from "../../components/ui/DashboardBrand";
  import MobileDrawerNav from "../../components/ui/MobileDrawerNav";
  import { auth } from "../../services/firebase";
  import { formatDate, formatTime, formatDateTime, formatRelative, toMillis } from "../../utils/dateTime";

  const STATUS_COLOR = {
    pending:   { bg: "#FEF3C7", border: "#FCD34D", text: "#92400E", dot: "#F59E0B" },
    approved:  { bg: "#D1FAE5", border: "#6EE7B7", text: "#065F46", dot: "#10B981" },
    rejected:  { bg: "#FEE2E2", border: "#FCA5A5", text: "#991B1B", dot: "#EF4444" },
    suspended: { bg: "#F1F5F9", border: "#CBD5E1", text: "#334155", dot: "#64748B" },
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

  /** KYC uploads are frequently PDFs, not just photos — an <img> tag can't
   *  render those. Used to pick a real thumbnail/preview vs. a file tile. */
  function isImageDoc(d) {
    return Boolean(
      d?.type?.startsWith("image")
      || /\.(jpe?g|png|webp|gif)$/i.test(d?.url || "")
      || /\.(jpe?g|png|webp|gif)$/i.test(d?.name || "")
    );
  }

  const TABS = [
    { key:"dashboard", label:"Dashboard", icon: <SquaresFour size={16} /> },
    { key:"applications",  label:"Shop Applications",  icon: <Storefront size={16} /> },
    { key:"shops",         label:"Manage Shops",        icon: <Buildings size={16} /> },
    { key:"subscriptions", label:"Subscriptions",       icon: <CurrencyCircleDollar size={16} /> },
    { key:"messages",      label:"Contact Messages",    icon: <EnvelopeSimple size={16} /> },
    { key:"settings",      label:"System Settings",     icon: <GearSix size={16} /> },
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
      <span style={{ width:size, height:size, borderRadius:"50%", background:color, color:"#fff", display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:size*0.36, fontWeight:700, fontFamily:"var(--font-ui)", flexShrink:0, letterSpacing:"0.02em" }}>
        {initials}
      </span>
    );
  }

  // ─── TAB COMPONENTS (defined OUTSIDE parent — stable identity, no remount) ────

  function DashboardTab(props) {
    return (
      <DashboardOverview
        {...props}
        Avatar={Avatar}
        StatusBadge={StatusBadge}
      />
    );
  }

  const REJECT_PRESETS = [
    "Submitted documents are incomplete or unclear.",
    "Business documents appear expired or invalid.",
    "Shop exterior photo is missing or not clear.",
    "Valid ID / selfie with ID could not be verified.",
    "Shop is outside Lipa City coverage area.",
  ];

  function SubscriptionsTabFull({ filteredPayments, payFilter, setPayFilter, paySearch, setPaySearch, payStats, setSelectedPayment }) {
    return (
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
          ].map((c, i) => (
            <div key={i} style={{ background:"#fff", borderRadius:12, border:c.urgent?`1px solid ${c.color}40`:"1px solid #E2E8F0", padding:"16px 18px" }}>
              <div style={{ fontFamily:"'Lora',Georgia,serif", fontSize:26, fontWeight:900, color:c.color }}>{c.value}</div>
              <div style={{ fontSize:11.5, color:"#64748B", marginTop:2 }}>{c.label}</div>
            </div>
          ))}
        </div>
        <SearchBar
          value={paySearch}
          onChange={e => setPaySearch(e.target.value)}
          placeholder="Search by shop, email, reference, or plan..."
          accentColor="#154665"
          style={{ marginBottom:12 }}
          width="100%"
        />
        <div style={{ display:"flex", gap:6, marginBottom:14 }}>
          {["all","pending","confirmed","rejected"].map(f => (
            <button key={f} onClick={() => setPayFilter(f)} style={{ padding:"7px 14px", borderRadius:8, fontSize:11.5, fontWeight:500, cursor:"pointer", fontFamily:"var(--font-ui)", ...(payFilter===f?{background:"#0F172A",color:"#fff",border:"1px solid #0F172A"}:{background:"#fff",color:"#64748B",border:"1px solid #E2E8F0"}) }}>
              {f==="all"?"All":f.charAt(0).toUpperCase()+f.slice(1)}
            </button>
          ))}
        </div>
        <div style={{ background:"#fff", borderRadius:14, border:"1px solid #E2E8F0", overflow:"hidden" }}>
          {filteredPayments.length === 0 ? (
            <div style={{ padding:64, textAlign:"center", color:"#94A3B8" }}>
              <div style={{ display:"flex", justifyContent:"center", marginBottom:8 }}>
                <CreditCard size={36} weight="thin" color="#CBD5E1" />
              </div>
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
                {filteredPayments.map((p, i) => (
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
                      <div style={{ color:"#64748B" }}>{formatDate(p.submittedAt)}</div>
                      <div>{formatTime(p.submittedAt)}</div>
                    </td>
                    <td style={{ padding:"12px 14px" }}><StatusBadge status={p.status} /></td>
                    <td style={{ padding:"12px 14px" }}>
                      <button onClick={() => setSelectedPayment(p)} style={{ padding:"5px 12px", borderRadius:7, border:"1px solid #E2E8F0", background:"#fff", fontSize:11.5, fontWeight:600, color:"#334155", cursor:"pointer", fontFamily:"var(--font-ui)" }}
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
  }

  // ─── MAIN COMPONENT ────────────────────────────────────────────────────────

  export default function AdminDashboard() {
    const navigate = useNavigate();

    const [shops, setShops]         = useState([]);
    const [stats, setStats]         = useState({ total:0, pending:0, approved:0, rejected:0 });
    const [payments, setPayments]   = useState([]);
    const [payStats, setPayStats]   = useState({ total:0, pending:0, confirmed:0, rejected:0 });
    const [contactMessages, setContactMessages] = useState([]);
    const [loading, setLoading]     = useState(true);
    const [activeTab, setActiveTab] = useState("dashboard");
    const [filter, setFilter]       = useState("all");
    const [payFilter, setPayFilter] = useState("all");
    const [lastRefreshed, setLastRefreshed] = useState(null);

    const [search,    setSearch,    debouncedSearch]    = useSearch("");
    const [paySearch, setPaySearch, debouncedPaySearch] = useSearch("");

    const [selected, setSelected]               = useState(null);
    const [selectedPayment, setSelectedPayment] = useState(null);
    const [actionLoading, setActionLoading]     = useState(false);
    const [rejectModal, setRejectModal]         = useState(false);
    const [rejectReason, setRejectReason]       = useState("");
    const [payRejectModal, setPayRejectModal]   = useState(false);
    const [payRejectReason, setPayRejectReason] = useState("");
    const [toast, setToast]                     = useState(null);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const [notifOpen, setNotifOpen]             = useState(false);
    const [previewModal, setPreviewModal]       = useState(null);
    const [inbox, setInbox] = useState({ shops: [], payments: [], messages: [] });

    // `silent` refreshes data in the background (no full-page spinner) —
    // used when a live notification arrives so the tables catch up too.
    const load = async (opts) => {
      const silent = opts?.silent === true;
      if (!silent) setLoading(true);
      try {
        // Load independently so one failed query (messages/payments) cannot wipe shops.
        // Stats are counted from the lists already fetched — getShopStats /
        // getPaymentStats each re-downloaded the entire collection just to
        // count it, doubling every admin page load's reads.
        const results = await Promise.allSettled([
          getAllShops(),
          getAllPayments(),
          getContactMessages(),
        ]);

        const [shopsRes, paymentsRes, messagesRes] = results;
        const failed = results.filter((r) => r.status === "rejected");

        if (shopsRes.status === "fulfilled") {
          const list = shopsRes.value || [];
          setShops(list);
          setStats({
            total:    list.length,
            pending:  list.filter((s) => s.status === "pending").length,
            approved: list.filter((s) => s.status === "approved").length,
            rejected: list.filter((s) => s.status === "rejected").length,
          });
        }
        if (paymentsRes.status === "fulfilled") {
          const list = paymentsRes.value || [];
          setPayments(list);
          setPayStats({
            total:     list.length,
            pending:   list.filter((p) => p.status === "pending").length,
            confirmed: list.filter((p) => p.status === "confirmed").length,
            rejected:  list.filter((p) => p.status === "rejected").length,
          });
        }
        if (messagesRes.status === "fulfilled") setContactMessages(messagesRes.value || []);
        else setContactMessages([]);

        setLastRefreshed(new Date());

        if (shopsRes.status === "rejected") {
          console.warn(shopsRes.reason);
          showToast("Could not load shops. Check Firestore rules / refresh.", "error");
        } else if (failed.length) {
          console.warn("Partial admin load failures:", failed.map((f) => f.reason));
        }
      } catch (err) {
        console.warn(err);
        if (!silent) showToast("Failed to load data. Please refresh.", "error");
      } finally {
        if (!silent) setLoading(false);
      }
    };

    useEffect(() => { load(); }, []);

    // Live admin inbox. The bell used to be derived from data loaded once on
    // page open, so new applications/payments/messages never appeared until
    // a manual refresh. This keeps it current and announces new arrivals.
    useEffect(() => {
      const LABEL = {
        shops:    (d) => `New shop application: ${d.shopName || "Unnamed shop"}`,
        payments: (d) => `New payment: ${d.shopName || "A shop"} · ${(d.planName || "").toUpperCase()}`,
        messages: (d) => `New message from ${d.name || "a visitor"}`,
      };
      const unsub = watchAdminInbox(
        ({ shops, payments, messages, added }) => {
          setInbox({ shops, payments, messages });
          if (added.length) {
            showToast(
              added.length === 1
                ? LABEL[added[0].kind](added[0])
                : `${added.length} new items need your attention`
            );
            load({ silent: true });
          }
        },
        (key, err) => console.warn(`Admin inbox (${key}) listener failed:`, err?.message || err)
      );
      return () => unsub();
    }, []);

    const showToast = (msg, type = "success") => {
      setToast({ msg, type });
      setTimeout(() => setToast(null), 3500);
    };

    const handleApprove = async (uid) => {
      setActionLoading(true);
      try {
        await approveShop(uid);
        showToast("Shop approved! Confirmation email sent.");
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

    const handleConfirmPayment = async (paymentId, planName, shopId) => {
      setActionLoading(true);
      try {
        await confirmPayment(paymentId, planName, shopId);
        showToast(`Payment confirmed. ${planName.toUpperCase()} plan activated!`);
        setSelectedPayment(null);
        load();
      } catch (err) {
        showToast(err?.message || "Failed to confirm payment. Try again.", "error");
        load({ silent: true });
      } finally {
        setActionLoading(false);
      }
    };

    const handleRejectPayment = async () => {
      if (!payRejectReason.trim()) return;
      setActionLoading(true);
      try {
        await rejectPayment(selectedPayment.id, payRejectReason, selectedPayment.shopId);
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

    const handleSuspendShop = async (uid, reason) => {
      setActionLoading(true);
      try {
        await suspendShop(uid, reason);
        showToast("Shop suspended. They cannot sign in.");
        await load();
      } catch {
        showToast("Failed to suspend shop.", "error");
      } finally {
        setActionLoading(false);
      }
    };

    const handleReopenShop = async (uid) => {
      setActionLoading(true);
      try {
        await reopenShop(uid);
        showToast("Shop restored. They can sign in again.");
        await load();
      } catch {
        showToast("Failed to restore shop.", "error");
      } finally {
        setActionLoading(false);
      }
    };

    const handleLogout = async () => {
  try {
    await logoutAdmin();
    navigate("/admin", { replace: true });
  } catch (err) {
    console.warn(err);
    showToast("Failed to sign out. Try again.", "error");
  }
};


    const filtered = shops.filter(s => {
      const matchFilter = filter === "all" || s.status === filter;
      const q = debouncedSearch.toLowerCase();
      const matchSearch =
        !q ||
        s.shopName?.toLowerCase().includes(q) ||
        s.ownerName?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.city?.toLowerCase().includes(q) ||
        s.province?.toLowerCase().includes(q) ||
        String(s.phone || "").toLowerCase().includes(q);
      return matchFilter && matchSearch;
    });

    const filteredPayments = payments.filter(p => {
      const matchFilter = payFilter === "all" || p.status === payFilter;
      const q = debouncedPaySearch.toLowerCase();
      const matchSearch =
        p.shopName?.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q) ||
        p.referenceNumber?.toLowerCase().includes(q) ||
        p.planName?.toLowerCase().includes(q);
      return matchFilter && matchSearch;
    });

    const newContactCount = inbox.messages.length;
    const pendingShopCount = inbox.shops.length;
    const pendingPayCount  = inbox.payments.length;
    const notifTotal = pendingShopCount + pendingPayCount + newContactCount;

    // One newest-first feed across all three sources, each with its own
    // arrival timestamp so the admin sees exactly when it came in.
    const notifications = [
      ...inbox.shops.map((s) => ({
        key: `shop-${s.id}`, name: s.shopName || "Unnamed shop",
        sub: "New shop application", at: s.createdAt,
        open: () => { setSelected(s); setActiveTab("applications"); },
      })),
      ...inbox.payments.map((p) => ({
        key: `pay-${p.id}`, name: p.shopName || "A shop",
        sub: `Payment · ${(p.planName || "").toUpperCase()} plan`, at: p.submittedAt,
        open: () => { setSelectedPayment(p); setActiveTab("subscriptions"); },
      })),
      ...inbox.messages.map((m) => ({
        key: `msg-${m.id}`, name: m.name || "Visitor",
        sub: `Message · ${m.subject || m.email || "Contact form"}`, at: m.createdAt,
        open: () => setActiveTab("messages"),
      })),
    ].sort((a, b) => toMillis(b.at) - toMillis(a.at));

    useEffect(() => {
      const base = "iConstruct Admin";
      document.title = notifTotal > 0 ? `(${notifTotal}) ${base}` : base;
    }, [notifTotal]);
    useEffect(() => () => { document.title = "iConstruct"; }, []);

    const renderContent = () => {
      switch (activeTab) {
        case "dashboard":
          return (
            <DashboardTab
              shops={shops}
              payments={payments}
              contactMessages={contactMessages}
              stats={stats}
              payStats={payStats}
              setActiveTab={setActiveTab}
              setSelected={setSelected}
              setSelectedPayment={setSelectedPayment}
              setFilter={setFilter}
              setPayFilter={setPayFilter}
              lastRefreshed={lastRefreshed}
              onRefresh={load}
              newContactCount={newContactCount}
            />
          );
        case "applications":
          return (
            <ShopApplicationsTab
              filtered={filtered}
              filter={filter}
              setFilter={setFilter}
              search={search}
              setSearch={setSearch}
              setSelected={setSelected}
              shopsCount={shops.length}
              stats={stats}
              onQuickApprove={handleApprove}
              actionLoading={actionLoading}
              Avatar={Avatar}
              StatusBadge={StatusBadge}
            />
          );
        case "shops":
          return (
            <ManageShopsTab
              shops={shops}
              actionLoading={actionLoading}
              onSuspend={handleSuspendShop}
              onReopen={handleReopenShop}
              Avatar={Avatar}
              StatusBadge={StatusBadge}
            />
          );
        case "subscriptions": return <SubscriptionsTabFull filteredPayments={filteredPayments} payFilter={payFilter} setPayFilter={setPayFilter} paySearch={paySearch} setPaySearch={setPaySearch} payStats={payStats} setSelectedPayment={setSelectedPayment} />;
        case "messages":
          return (
            <ContactMessagesTab
              messages={contactMessages}
              onReload={load}
              showToast={showToast}
              onPatchMessage={(id, patch) => {
                setContactMessages((prev) =>
                  prev.map((m) => (m.id === id ? { ...m, ...patch } : m))
                );
              }}
              onRemoveMessage={(id) => {
                setContactMessages((prev) => prev.filter((m) => m.id !== id));
              }}
            />
          );
        case "settings":      return <SystemSettingsTab currentUser={auth.currentUser} />;
      }
    };

    const Sidebar = () => (
      <aside className="db-sidebar" style={{ width:sidebarCollapsed?72:240, minHeight:"100vh", background:"var(--db-ink)", display:"flex", flexDirection:"column", borderRight:"1px solid rgba(255,255,255,0.06)", transition:"width 0.25s cubic-bezier(0.4,0,0.2,1)", overflow:"hidden", flexShrink:0 }}>
        <div style={{ padding:sidebarCollapsed?"16px 0 14px":"24px 20px", borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", flexDirection:sidebarCollapsed?"column":"row", alignItems:"center", justifyContent:sidebarCollapsed?"center":"space-between", gap:10 }}>
          {sidebarCollapsed ? (
            <DashboardBrand collapsed />
          ) : (
            <DashboardBrand subtitle="Admin Control Center" compact />
          )}
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} style={{ width:28, height:28, borderRadius:6, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.08)", color:"rgba(148,163,184,0.7)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <List size={15} />
          </button>
        </div>
        <nav style={{ flex:1, padding:"12px 0" }}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.key;
            const badge =
              tab.key === "applications" ? pendingShopCount
              : tab.key === "subscriptions" ? pendingPayCount
              : tab.key === "messages" ? newContactCount
              : 0;
            return (
              <button
                key={tab.key}
                onClick={() => {
                  if (tab.key === "applications") setFilter("all");
                  if (tab.key === "subscriptions") setPayFilter("all");
                  setActiveTab(tab.key);
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: sidebarCollapsed ? "10px 0" : "10px 20px",
                  justifyContent: sidebarCollapsed ? "center" : "flex-start",
                  background: isActive
                    ? "linear-gradient(90deg,rgba(59,130,246,0.15),rgba(59,130,246,0.05))"
                    : "transparent",
                  borderTop: "none",
                  borderRight: "none",
                  borderBottom: "none",
                  borderLeft: isActive ? "2px solid #3B82F6" : "2px solid transparent",
                  cursor: "pointer",
                  color: isActive ? "#93C5FD" : "rgba(148,163,184,0.65)",
                  fontFamily: "var(--font-ui)",
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                <span style={{ flexShrink:0, display:"flex", alignItems:"center" }}>{tab.icon}</span>
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
              <button onClick={handleLogout} title="Sign Out" style={{ width:28, height:28, borderRadius:6, background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.2)", color:"#F87171", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <SignOut size={14} />
              </button>
            </>
          )}
        </div>
      </aside>
    );

    const Topbar = () => (
      <header style={{ height:60, background:"#ffffff", borderBottom:"1px solid #E2E8F0", display:"flex", alignItems:"center", padding:"0 28px", justifyContent:"space-between", position:"sticky", top:0, zIndex:50 }}>
        <div className="db-topbar-left">
          <button
            type="button"
            className="db-mobile-trigger"
            aria-label="Open menu"
            onClick={() => setMobileNavOpen(true)}
          >
            <List size={20} />
          </button>
          <div>
            <div style={{ fontSize:16, fontWeight:700, color:"#0F172A" }}>{TABS.find(t=>t.key===activeTab)?.label}</div>
            <div style={{ fontSize:11, color:"#94A3B8" }}>iConstruct · Admin Control Center</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ position:"relative" }}>
            <button onClick={() => setNotifOpen(!notifOpen)} style={{ width:36, height:36, borderRadius:8, border:"1px solid #E2E8F0", background:"#F8FAFC", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"#64748B", position:"relative" }}>
              <Bell size={17} />
              {notifTotal > 0 && (
                <span style={{ position:"absolute", top:-5, right:-5, background:"#EF4444", color:"#fff", minWidth:17, height:17, padding:"0 4px", borderRadius:9, fontSize:9, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", border:"2px solid #fff" }}>
                  {notifTotal > 99 ? "99+" : notifTotal}
                </span>
              )}
            </button>
            {notifOpen && (
              <div style={{ position:"absolute", top:44, right:0, width:340, maxWidth:"calc(100vw - 32px)", background:"#fff", border:"1px solid #E2E8F0", borderRadius:12, boxShadow:"0 10px 40px rgba(0,0,0,0.1)", zIndex:100, overflow:"hidden" }}>
                <div style={{ padding:"14px 16px", borderBottom:"1px solid #F1F5F9", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:13, fontWeight:700, color:"#0F172A" }}>
                    Notifications{notifTotal > 0 ? ` (${notifTotal})` : ""}
                  </span>
                  <span style={{ fontSize:10, color:"#3B82F6", fontWeight:600, cursor:"pointer" }} onClick={() => setNotifOpen(false)}>Close</span>
                </div>
                <div style={{ maxHeight:380, overflowY:"auto" }}>
                  {notifications.slice(0, 15).map((n) => (
                    <div key={n.key} style={{ padding:"12px 16px", borderBottom:"1px solid #F8FAFC", display:"flex", gap:10, cursor:"pointer" }}
                      onClick={() => { n.open(); setNotifOpen(false); }}
                      onMouseEnter={e => e.currentTarget.style.background="#F8FAFC"}
                      onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                      <Avatar name={n.name} size={28} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", gap:8 }}>
                          <span style={{ fontSize:12, fontWeight:600, color:"#0F172A", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{n.name}</span>
                          <span style={{ fontSize:10, color:"#94A3B8", flexShrink:0 }}>{formatRelative(n.at)}</span>
                        </div>
                        <div style={{ fontSize:11, color:"#64748B", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{n.sub}</div>
                        <div style={{ fontSize:10, color:"#94A3B8", marginTop:1 }}>{formatDateTime(n.at)}</div>
                      </div>
                    </div>
                  ))}
                  {notifications.length > 15 && (
                    <div style={{ padding:"10px 16px", textAlign:"center", color:"#64748B", fontSize:11 }}>
                      +{notifications.length - 15} more — open the matching tab to see all
                    </div>
                  )}
                  {notifTotal === 0 && (
                    <div style={{ padding:"24px 16px", textAlign:"center", color:"#94A3B8", fontSize:12 }}>You're all caught up</div>
                  )}
                </div>
              </div>
            )}
          </div>
          <button onClick={load} title="Refresh" style={{ width:36, height:36, borderRadius:8, border:"1px solid #E2E8F0", background:"#F8FAFC", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"#64748B" }}>
            <ArrowCounterClockwise size={17} />
          </button>
          <Avatar name="Administrator" size={34} />
        </div>
      </header>
    );

    return (
      <>
        <style>{`
          *{box-sizing:border-box;margin:0;padding:0;}
          @keyframes spin{to{transform:rotate(360deg)}}
        `}</style>
        <div style={{ display:"flex", minHeight:"100vh", background:"#F1F5F9" }}>
          <Sidebar />
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
            <Topbar />
            <main style={{ flex:1, padding:28, overflowY:"auto" }}>
              {loading ? (
                <div style={{ textAlign:"center", padding:80 }}>
                  <div style={{ width:32, height:32, borderTop:"3px solid #3B82F6", borderRight:"3px solid #E2E8F0", borderBottom:"3px solid #E2E8F0", borderLeft:"3px solid #E2E8F0", borderRadius:"50%", animation:"spin .8s linear infinite", margin:"0 auto 12px" }} />
                  <div style={{ color:"#94A3B8", fontSize:13 }}>Loading...</div>
                </div>
              ) : renderContent()}
            </main>
          </div>
        </div>

        <MobileDrawerNav
          items={TABS.map(tab => ({
            ...tab,
            badge:
              tab.key === "applications" ? pendingShopCount
              : tab.key === "subscriptions" ? pendingPayCount
              : tab.key === "messages" ? newContactCount
              : 0,
          }))}
          activeTab={activeTab}
          onSelect={(key) => {
            if (key === "applications") setFilter("all");
            if (key === "subscriptions") setPayFilter("all");
            setActiveTab(key);
          }}
          open={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          accentColor="#3B82F6"
          subtitle="Admin Control Center"
          onLogout={handleLogout}
        />

        {/* Detail Modal */}
        {selected && (() => {
          const docInfo = getDocCompleteness(selected);
          return (
          <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.55)", backdropFilter:"blur(6px)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}
            onClick={e => { if(e.target===e.currentTarget) setSelected(null); }}>
            <div style={{ background:"#fff", borderRadius:20, width:"100%", maxWidth:720, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 40px 100px rgba(0,0,0,0.3)" }}>
              <div style={{ padding:"22px 28px 18px", borderBottom:"1px solid #F1F5F9", display:"flex", alignItems:"flex-start", justifyContent:"space-between", position:"sticky", top:0, background:"#fff", zIndex:2 }}>
                <div style={{ display:"flex", gap:14, alignItems:"flex-start" }}>
                  <Avatar name={selected.shopName||""} size={44} />
                  <div>
                    <h3 style={{ fontFamily:"'Lora',Georgia,serif", fontSize:18, fontWeight:900, color:"#0F172A", marginBottom:4 }}>{selected.shopName}</h3>
                    <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                      <span style={{ fontSize:11, color:"#94A3B8" }}>{selected.email}</span>
                      <StatusBadge status={selected.status} />
                      <span style={{
                        fontSize:10, fontWeight:700, padding:"3px 8px", borderRadius:20,
                        background: docInfo.complete ? "#ECFDF5" : "#FFF7ED",
                        color: docInfo.complete ? "#065F46" : "#9A3412",
                        border: `1px solid ${docInfo.complete ? "#A7F3D0" : "#FED7AA"}`,
                      }}>
                        Docs {docInfo.score}/{docInfo.total}
                      </span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setSelected(null)} style={{ width:32, height:32, borderRadius:"50%", background:"#F1F5F9", border:"none", cursor:"pointer", color:"#64748B", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <X size={16} weight="bold" />
                </button>
              </div>
              <div style={{ padding:"22px 28px" }}>
                {/* Quick contact */}
                <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:18 }}>
                  {selected.email ? (
                    <a href={`mailto:${selected.email}`} style={{ fontSize:12, fontWeight:600, color:"#2563EB", textDecoration:"none", padding:"7px 12px", borderRadius:8, border:"1px solid #BFDBFE", background:"#EFF6FF" }}>
                      Email owner
                    </a>
                  ) : null}
                  {selected.phone ? (
                    <a href={`tel:${String(selected.phone).replace(/\s/g,"")}`} style={{ fontSize:12, fontWeight:600, color:"#059669", textDecoration:"none", padding:"7px 12px", borderRadius:8, border:"1px solid #A7F3D0", background:"#ECFDF5" }}>
                      Call {selected.phone}
                    </a>
                  ) : null}
                  {selected.createdAt ? (
                    <span style={{ fontSize:12, color:"#64748B", padding:"7px 12px" }}>
                      Submitted {formatDateTime(selected.createdAt)}
                      {selected.reviewedAt ? ` · Reviewed ${formatDateTime(selected.reviewedAt)}` : ""}
                    </span>
                  ) : null}
                </div>

                {[["Owner",selected.ownerName],["Email",selected.email],["Phone",selected.phone],["Address",selected.address],["City",selected.city],["Province",selected.province],["Description",selected.description||"Not provided"]].map(([k,v]) => (
                  <div key={k} style={{ display:"flex", gap:12, fontSize:13, marginBottom:9 }}>
                    <span style={{ color:"#94A3B8", minWidth:110, flexShrink:0 }}>{k}</span>
                    <span style={{ color:"#0F172A", fontWeight:500 }}>{v||"—"}</span>
                  </div>
                ))}

                {/* Document checklist */}
                <div style={{ marginTop:18, background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:12, padding:"14px 16px" }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"#0F172A", marginBottom:10 }}>
                    Registration checklist ({docInfo.score}/{docInfo.total})
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                    {docInfo.groups.map((g) => (
                      <div key={g.key} style={{ display:"flex", alignItems:"center", gap:8, fontSize:12.5, color: g.found ? "#065F46" : "#94A3B8" }}>
                        {g.found
                          ? <CheckCircle size={15} weight="fill" color="#10B981" />
                          : <XCircle size={15} weight="fill" color="#CBD5E1" />}
                        {g.label}
                      </div>
                    ))}
                  </div>
                  {!docInfo.complete && docInfo.missing.length > 0 ? (
                    <div style={{ marginTop:10, fontSize:12, color:"#9A3412", display:"flex", gap:6, alignItems:"flex-start" }}>
                      <Warning size={14} weight="bold" color="#F59E0B" style={{ marginTop:1, flexShrink:0 }} />
                      Missing: {docInfo.missing.join(", ")}. You can still approve if files are present under another label.
                    </div>
                  ) : null}
                </div>

                {selected.status === "rejected" && selected.rejectionReason ? (
                  <div style={{ marginTop:16, background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:10, padding:"12px 14px", fontSize:12.5, color:"#991B1B" }}>
                    <strong>Rejection reason:</strong> {selected.rejectionReason}
                  </div>
                ) : null}

                {selected.documents?.length > 0 ? (
                  <div style={{ marginTop:20 }}>
                    <div style={{ fontSize:9.5, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase", color:"#3B82F6", marginBottom:12, paddingBottom:8, borderBottom:"1px solid #F1F5F9" }}>
                      Submitted Documents ({selected.documents.length})
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))", gap:10 }}>
                      {selected.documents.map((docItem, i) => (
                        <div key={i} onClick={() => setPreviewModal(docItem)} style={{ borderRadius:10, overflow:"hidden", border:"1px solid #E2E8F0", cursor:"pointer" }}
                          onMouseEnter={e => e.currentTarget.style.borderColor="#3B82F6"}
                          onMouseLeave={e => e.currentTarget.style.borderColor="#E2E8F0"}>
                          {isImageDoc(docItem) ? (
                            <img src={docItem.url} alt={docItem.name} style={{ width:"100%", height:110, objectFit:"cover", display:"block", background:"#F8FAFC" }} />
                          ) : (
                            <div style={{ height:110, background:"#F8FAFC", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:6 }}>
                              <FileText size={28} weight="thin" color="#94A3B8" />
                              <span style={{ fontSize:10, color:"#64748B", textAlign:"center", padding:"0 8px" }}>{docItem.name}</span>
                            </div>
                          )}
                          <div style={{ padding:"6px 8px", background:"#F8FAFC", borderTop:"1px solid #E2E8F0" }}>
                            <div style={{ fontSize:10, fontWeight:600, color:"#334155", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                              {DOCUMENT_TYPES.find(t => t.value === docItem.docType)?.label || docItem.docType || "Document"}
                            </div>
                            <div style={{ fontSize:9, color:"#94A3B8" }}>{isImageDoc(docItem) ? "Click to enlarge" : "Click to open"}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop:18, background:"#FFFBEB", border:"1px solid #FCD34D", borderRadius:10, padding:"12px 14px", fontSize:12.5, color:"#92400E", display:"flex", gap:8, alignItems:"center" }}>
                    <Warning size={16} weight="bold" color="#F59E0B" />
                    No documents attached to this application.
                  </div>
                )}
              </div>
              {selected.status === "pending" && (
                <div style={{ padding:"16px 28px 22px", borderTop:"1px solid #F1F5F9", display:"flex", gap:12, position:"sticky", bottom:0, background:"#fff" }}>
                  <button disabled={actionLoading} onClick={() => setRejectModal(true)} style={{ flex:1, padding:"12px", borderRadius:10, border:"1.5px solid #FECACA", background:"#FEF2F2", color:"#EF4444", fontSize:13, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:7 }}>
                    <XCircle size={15} weight="bold" /> Reject
                  </button>
                  <button disabled={actionLoading} onClick={() => handleApprove(selected.id)} style={{ flex:2, padding:"12px", borderRadius:10, border:"none", background:"linear-gradient(135deg,#059669,#10B981)", color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer", opacity:actionLoading?0.7:1, display:"flex", alignItems:"center", justifyContent:"center", gap:7 }}>
                    <CheckCircle size={15} weight="bold" /> {actionLoading ? "Processing..." : "Approve Shop"}
                  </button>
                </div>
              )}
              {/* Rejected or suspended shops had no action here at all — a shop
                  suspended before "suspended" became its own status was saved
                  as "rejected" and could never be brought back. */}
              {["rejected", "suspended"].includes(String(selected.status || "").toLowerCase()) && (
                <div style={{ padding:"16px 28px 22px", borderTop:"1px solid #F1F5F9", display:"flex", gap:12, position:"sticky", bottom:0, background:"#fff" }}>
                  <button
                    disabled={actionLoading}
                    onClick={async () => {
                      if (!window.confirm(`Restore "${selected.shopName || "this shop"}"? It will be approved and able to sign in again.`)) return;
                      await handleReopenShop(selected.id);
                      setSelected(null);
                    }}
                    style={{ flex:1, padding:"12px", borderRadius:10, border:"none", background:"linear-gradient(135deg,#059669,#10B981)", color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer", opacity:actionLoading?0.7:1, display:"flex", alignItems:"center", justifyContent:"center", gap:7 }}
                  >
                    <CheckCircle size={15} weight="bold" /> {actionLoading ? "Processing..." : "Restore shop (approve)"}
                  </button>
                </div>
              )}
            </div>
          </div>
          );
        })()}

        {/* Payment Modal */}
        {selectedPayment && (
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
                <button onClick={() => setSelectedPayment(null)} style={{ width:32, height:32, borderRadius:"50%", background:"#F1F5F9", border:"none", cursor:"pointer", color:"#64748B", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <X size={16} weight="bold" />
                </button>
              </div>
              <div style={{ padding:"22px 28px" }}>
                {[
                  ["Shop Owner",  selectedPayment.ownerName],
                  ["Email",       selectedPayment.email],
                  ["Plan",        `${selectedPayment.planName?.toUpperCase()} — ${selectedPayment.planPrice}`],
                  ["Method",      selectedPayment.paymentMethod],
                  ["Reference #", selectedPayment.referenceNumber || "—"],
                  ["Submitted",   formatDateTime(selectedPayment.submittedAt)],
                  ...(selectedPayment.reviewedAt ? [["Reviewed", formatDateTime(selectedPayment.reviewedAt)]] : []),
                ].map(([k,v]) => (
                  <div key={k} style={{ display:"flex", gap:12, fontSize:13, marginBottom:9 }}>
                    <span style={{ color:"#94A3B8", minWidth:130, flexShrink:0 }}>{k}</span>
                    <span style={{ color:"#0F172A", fontWeight:500 }}>{v||"—"}</span>
                  </div>
                ))}
                {selectedPayment.screenshotBase64 && (
                  <div style={{ marginTop:16 }}>
                    <div style={{ fontSize:9.5, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase", color:"#3B82F6", marginBottom:10, paddingBottom:8, borderBottom:"1px solid #F1F5F9" }}>Payment Screenshot</div>
                    <div onClick={() => setPreviewModal({ url: selectedPayment.screenshotBase64, name: "Payment Screenshot", type: "image/png" })} style={{ borderRadius:10, overflow:"hidden", border:"2px solid #E2E8F0", cursor:"zoom-in" }} onMouseEnter={e => e.currentTarget.style.borderColor="#3B82F6"} onMouseLeave={e => e.currentTarget.style.borderColor="#E2E8F0"}>
                      <img src={selectedPayment.screenshotBase64} alt="Payment proof" style={{ width:"100%", maxHeight:280, objectFit:"cover", display:"block", background:"#F8FAFC" }} />
                    </div>
                    <div style={{ fontSize:11, color:"#94A3B8", marginTop:6, textAlign:"center" }}>Click to view full size</div>
                  </div>
                )}
                {!selectedPayment.screenshotBase64 && (
                  <div style={{ background:"#FFFBEB", border:"1px solid #FCD34D", borderRadius:10, padding:"12px 16px", marginTop:16, fontSize:12.5, color:"#92400E", display:"flex", alignItems:"center", gap:8 }}>
                    <Warning size={16} weight="bold" color="#F59E0B" />
                    No screenshot submitted. Verify the reference number manually before confirming.
                  </div>
                )}
              </div>
              {selectedPayment.status === "pending" && (
                <div style={{ padding:"16px 28px 22px", borderTop:"1px solid #F1F5F9", display:"flex", gap:12 }}>
                  <button disabled={actionLoading} onClick={() => setPayRejectModal(true)} style={{ flex:1, padding:"12px", borderRadius:10, border:"1.5px solid #FECACA", background:"#FEF2F2", color:"#EF4444", fontSize:13, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:7 }}>
                    <XCircle size={15} weight="bold" /> Reject Payment
                  </button>
                  <button disabled={actionLoading} onClick={() => handleConfirmPayment(selectedPayment.id, selectedPayment.planName, selectedPayment.shopId)} style={{ flex:2, padding:"12px", borderRadius:10, border:"none", background:"linear-gradient(135deg,#059669,#10B981)", color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer", opacity:actionLoading?0.7:1, boxShadow:"0 4px 14px rgba(16,185,129,0.3)", display:"flex", alignItems:"center", justifyContent:"center", gap:7 }}>
                    <CheckCircle size={15} weight="bold" /> {actionLoading ? "Confirming..." : "Confirm & Activate Plan"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Reject Shop Modal */}
        {rejectModal && (
          <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.6)", backdropFilter:"blur(6px)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
            <div style={{ background:"#fff", borderRadius:18, width:"100%", maxWidth:430, padding:"28px" }}>
              <h4 style={{ fontFamily:"'Lora',Georgia,serif", fontSize:17, fontWeight:700, color:"#0F172A", marginBottom:6 }}>Reject Application</h4>
              <p style={{ fontSize:12.5, color:"#64748B", lineHeight:1.6, marginBottom:12 }}>Reason for rejecting <strong style={{ color:"#0F172A" }}>{selected?.shopName}</strong>:</p>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:12 }}>
                {REJECT_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setRejectReason(preset)}
                    style={{
                      fontSize:11,
                      fontWeight:500,
                      padding:"5px 10px",
                      borderRadius:20,
                      border: rejectReason === preset ? "1px solid #F87171" : "1px solid #E2E8F0",
                      background: rejectReason === preset ? "#FEF2F2" : "#F8FAFC",
                      color: rejectReason === preset ? "#B91C1C" : "#64748B",
                      cursor:"pointer",
                      fontFamily:"inherit",
                      textAlign:"left",
                      maxWidth:"100%",
                    }}
                  >
                    {preset.length > 42 ? `${preset.slice(0, 40)}…` : preset}
                  </button>
                ))}
              </div>
              <textarea placeholder="e.g. Submitted documents are incomplete." value={rejectReason} onChange={e => setRejectReason(e.target.value)} style={{ width:"100%", minHeight:96, padding:"11px 14px", borderRadius:8, border:"1.5px solid #E2E8F0", fontSize:12.5, fontFamily:"var(--font-ui)", color:"#0F172A", resize:"none", outline:"none", background:"#F8FAFC", marginBottom:16 }} />
              <div style={{ display:"flex", gap:10 }}>
                <button onClick={() => { setRejectModal(false); setRejectReason(""); }} style={{ padding:"11px 20px", borderRadius:8, border:"1px solid #E2E8F0", background:"#F8FAFC", fontSize:12.5, fontWeight:500, color:"#64748B", cursor:"pointer" }}>Cancel</button>
                <button disabled={!rejectReason.trim()||actionLoading} onClick={handleReject} style={{ flex:1, padding:"11px", borderRadius:8, border:"none", background:rejectReason.trim()?"linear-gradient(135deg,#DC2626,#EF4444)":"#F1F5F9", color:rejectReason.trim()?"#fff":"#94A3B8", fontSize:12.5, fontWeight:600, cursor:rejectReason.trim()?"pointer":"not-allowed" }}>
                  {actionLoading ? "Rejecting..." : "Confirm Rejection"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reject Payment Modal */}
        {payRejectModal && (
          <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.6)", backdropFilter:"blur(6px)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
            <div style={{ background:"#fff", borderRadius:18, width:"100%", maxWidth:430, padding:"28px" }}>
              <h4 style={{ fontFamily:"'Lora',Georgia,serif", fontSize:17, fontWeight:700, color:"#0F172A", marginBottom:6 }}>Reject Payment</h4>
              <p style={{ fontSize:12.5, color:"#64748B", lineHeight:1.6, marginBottom:18 }}>
                Reason for rejecting payment from <strong style={{ color:"#0F172A" }}>{selectedPayment?.shopName}</strong>:
              </p>
              <textarea placeholder="e.g. Reference number could not be verified." value={payRejectReason} onChange={e => setPayRejectReason(e.target.value)} style={{ width:"100%", minHeight:88, padding:"11px 14px", borderRadius:8, border:"1.5px solid #E2E8F0", fontSize:12.5, fontFamily:"var(--font-ui)", color:"#0F172A", resize:"none", outline:"none", background:"#F8FAFC", marginBottom:16 }} />
              <div style={{ display:"flex", gap:10 }}>
                <button onClick={() => { setPayRejectModal(false); setPayRejectReason(""); }} style={{ padding:"11px 20px", borderRadius:8, border:"1px solid #E2E8F0", background:"#F8FAFC", fontSize:12.5, fontWeight:500, color:"#64748B", cursor:"pointer" }}>Cancel</button>
                <button disabled={!payRejectReason.trim()||actionLoading} onClick={handleRejectPayment} style={{ flex:1, padding:"11px", borderRadius:8, border:"none", background:payRejectReason.trim()?"linear-gradient(135deg,#DC2626,#EF4444)":"#F1F5F9", color:payRejectReason.trim()?"#fff":"#94A3B8", fontSize:12.5, fontWeight:600, cursor:payRejectReason.trim()?"pointer":"not-allowed" }}>
                  {actionLoading ? "Rejecting..." : "Reject Payment"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Image Preview Modal */}
        {previewModal && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.88)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}
            onClick={() => setPreviewModal(null)}>
            <div style={{ position:"relative", maxWidth:900, width:"100%", maxHeight:"90vh" }} onClick={e => e.stopPropagation()}>
              <button onClick={() => setPreviewModal(null)} style={{ position:"absolute", top:-16, right:-16, width:36, height:36, borderRadius:"50%", background:"#fff", border:"none", fontSize:20, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 2px 12px rgba(0,0,0,0.3)", zIndex:1 }}>
                <X size={18} weight="bold" />
              </button>
              {isImageDoc(previewModal) ? (
                <img src={previewModal.url} alt={previewModal.name} style={{ width:"100%", maxHeight:"85vh", objectFit:"contain", borderRadius:12, display:"block", background:"#111" }} />
              ) : (
                <div style={{ width:"100%", minHeight:280, borderRadius:12, background:"#1A2332", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:14, padding:32 }}>
                  <FileText size={48} weight="thin" color="#94A3B8" />
                  <div style={{ color:"#fff", fontSize:13, textAlign:"center" }}>
                    This file type can't be previewed here.
                  </div>
                  <a
                    href={previewModal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ padding:"10px 20px", borderRadius:8, background:"#3B82F6", color:"#fff", fontSize:12.5, fontWeight:600, textDecoration:"none" }}
                  >
                    Open {previewModal.name || "file"} in a new tab
                  </a>
                </div>
              )}
              <div style={{ textAlign:"center", marginTop:10, color:"rgba(255,255,255,0.6)", fontSize:12 }}>{previewModal.name}</div>
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div style={{ position:"fixed", bottom:24, right:24, display:"flex", alignItems:"center", gap:10, padding:"12px 18px", borderRadius:10, background:toast.type==="error"?"#DC2626":"#0F172A", color:"#fff", fontSize:12.5, fontWeight:500, boxShadow:"0 10px 30px rgba(0,0,0,0.25)", zIndex:500, maxWidth:320 }}>
            {toast.type === "error"
              ? <XCircle size={15} weight="bold" />
              : <CheckCircle size={15} weight="bold" />
            }
            {toast.msg}
          </div>
        )}
      </>
    );
  }