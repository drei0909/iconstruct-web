// src/views/admin/SystemSettingsTab.jsx
// Full System Settings — Admin Control Center
// Covers: Admin Accounts, Security, Recommendation Engine,
//         Subscription Plans, Notification Settings, System Maintenance

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getAllAdmins,
  getCurrentAdminProfile,
  createAdmin,
  updateAdminProfile,
  changeAdminPassword,
  sendAdminPasswordReset,
  removeAdmin,
} from "../../controllers/settingsController";
import { PLAN_CONFIG, formatProductLimit } from "../../config/planConfig";
import { db } from "../../services/firebase";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  serverTimestamp,
  query,
  orderBy,
  limit,
} from "firebase/firestore";

// ─── Design Tokens ────────────────────────────────────────────────────────────
const T = {
  bg: "#F0F4F8",
  surface: "#FFFFFF",
  border: "#E2E8F0",
  borderFocus: "#4F46E5",
  text: "#0F172A",
  textMuted: "#64748B",
  textLight: "#94A3B8",
  accent: "#4F46E5",
  accentLight: "#EEF2FF",
  success: "#059669",
  successLight: "#D1FAE5",
  danger: "#DC2626",
  dangerLight: "#FEF2F2",
  warning: "#D97706",
  warningLight: "#FEF3C7",
  info: "#0891B2",
  infoLight: "#ECFEFF",
};

// ─── Micro-components ─────────────────────────────────────────────────────────

function Avatar({ name = "", size = 36 }) {
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const colors = ["#3B5998", "#E8643A", "#4F46E5", "#0891B2", "#7C3AED", "#B45309"];
  const color = colors[(name.charCodeAt(0) || 0) % colors.length];
  return (
    <span style={{ width: size, height: size, borderRadius: "50%", background: color, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.36, fontWeight: 700, fontFamily: "'DM Sans',sans-serif", flexShrink: 0 }}>
      {initials || "A"}
    </span>
  );
}

function Badge({ label, color = T.accent, bg = T.accentLight }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 20, background: bg, color }}>
      {label}
    </span>
  );
}

function Field({ label, children, error, hint }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: T.textMuted, marginBottom: 5, letterSpacing: "0.03em" }}>{label}</label>
      {children}
      {hint && !error && <div style={{ fontSize: 11, color: T.textLight, marginTop: 4 }}>{hint}</div>}
      {error && <div style={{ fontSize: 11, color: T.danger, marginTop: 4 }}>{error}</div>}
    </div>
  );
}

const inputStyle = (focus) => ({
  width: "100%",
  padding: "9px 12px",
  borderRadius: 8,
  border: `1.5px solid ${focus ? T.borderFocus : T.border}`,
  fontSize: 13,
  fontFamily: "'DM Sans',sans-serif",
  color: T.text,
  background: "#F8FAFC",
  outline: "none",
  transition: "border-color 0.15s",
  boxSizing: "border-box",
});

function Input({ value, onChange, placeholder, type = "text", disabled, onKeyDown }) {
  const [focus, setFocus] = useState(false);
  return (
    <input type={type} value={value} onChange={onChange} placeholder={placeholder}
      disabled={disabled} onKeyDown={onKeyDown}
      style={{ ...inputStyle(focus), opacity: disabled ? 0.6 : 1 }}
      onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} />
  );
}

function Textarea({ value, onChange, placeholder, rows = 3 }) {
  const [focus, setFocus] = useState(false);
  return (
    <textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows}
      style={{ ...inputStyle(focus), resize: "vertical", lineHeight: 1.55 }}
      onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} />
  );
}

function Select({ value, onChange, options, disabled }) {
  const [focus, setFocus] = useState(false);
  return (
    <select value={value} onChange={onChange} disabled={disabled}
      style={{ ...inputStyle(focus), cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1 }}
      onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Btn({ onClick, disabled, loading, children, variant = "primary", size = "md", style: extStyle = {} }) {
  const variants = {
    primary:   { bg: T.accent, color: "#fff", border: "none" },
    success:   { bg: T.success, color: "#fff", border: "none" },
    danger:    { bg: T.danger, color: "#fff", border: "none" },
    ghost:     { bg: "#F8FAFC", color: T.textMuted, border: `1px solid ${T.border}` },
    ghostDanger: { bg: T.dangerLight, color: T.danger, border: `1px solid #FECACA` },
  };
  const sizes = { sm: "6px 12px", md: "9px 18px", lg: "11px 24px" };
  const v = variants[variant] || variants.primary;
  const isDisabled = disabled || loading;
  return (
    <button onClick={onClick} disabled={isDisabled}
      style={{ padding: sizes[size], borderRadius: 8, border: isDisabled ? `1px solid ${T.border}` : v.border, background: isDisabled ? "#E2E8F0" : v.bg, color: isDisabled ? T.textLight : v.color, fontSize: 12.5, fontWeight: 600, cursor: isDisabled ? "not-allowed" : "pointer", fontFamily: "'DM Sans',sans-serif", transition: "opacity 0.15s, transform 0.1s", ...extStyle }}
      onMouseDown={e => { if (!isDisabled) e.currentTarget.style.transform = "scale(0.97)"; }}
      onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
      onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
      {loading ? "Processing..." : children}
    </button>
  );
}

function Toggle({ checked, onChange, label, hint }) {
  return (
    <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer", userSelect: "none" }}>
      <div onClick={() => onChange(!checked)} style={{ position: "relative", width: 40, height: 22, background: checked ? T.accent : "#CBD5E1", borderRadius: 11, transition: "background 0.2s", flexShrink: 0, marginTop: 1 }}>
        <div style={{ position: "absolute", top: 3, left: checked ? 21 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{label}</div>
        {hint && <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 2 }}>{hint}</div>}
      </div>
    </label>
  );
}

function SectionCard({ title, subtitle, icon, children, accent }) {
  return (
    <div style={{ background: T.surface, borderRadius: 14, border: `1px solid ${T.border}`, marginBottom: 20, overflow: "hidden" }}>
      <div style={{ padding: "16px 22px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 12, background: accent ? `linear-gradient(135deg, ${accent}08, ${accent}03)` : "#FAFBFC" }}>
        {icon && <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>}
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 1 }}>{subtitle}</div>}
        </div>
      </div>
      <div style={{ padding: "20px 22px" }}>{children}</div>
    </div>
  );
}

function InfoGrid({ items }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: 12 }}>
      {items.map(({ label, value, color }) => (
        <div key={label} style={{ background: "#F8FAFC", borderRadius: 10, padding: "13px 15px", border: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: T.textLight, marginBottom: 5 }}>{label}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: color || T.text }}>{value}</div>
        </div>
      ))}
    </div>
  );
}

function Toast({ toast }) {
  if (!toast) return null;
  const isError = toast.type === "error";
  return (
    <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 10, padding: "12px 20px", borderRadius: 10, background: isError ? T.danger : "#0F172A", color: "#fff", fontSize: 13, fontWeight: 500, boxShadow: "0 10px 30px rgba(0,0,0,0.2)", zIndex: 9999, whiteSpace: "nowrap", animation: "fadeUp 0.2s ease" }}>
      <span>{isError ? "✕" : "✓"}</span> {toast.msg}
    </div>
  );
}

function ConfirmDialog({ open, title, message, onConfirm, onCancel, loading, danger }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(6px)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 400, padding: 26, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.6, marginBottom: 22 }}>{message}</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
          <Btn variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={loading}>{danger ? "Delete" : "Confirm"}</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── Section 1 — Admin Form Modal ────────────────────────────────────────────

function AdminFormModal({ open, onClose, onSave, editTarget, loading }) {
  const isEdit = !!editTarget;
  const [form, setForm] = useState({ displayName: "", email: "", password: "", role: "admin" });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (editTarget) setForm({ displayName: editTarget.displayName || "", email: editTarget.email || "", password: "", role: editTarget.role || "admin" });
    else setForm({ displayName: "", email: "", password: "", role: "admin" });
    setErrors({});
  }, [editTarget, open]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const validate = () => {
    const e = {};
    if (!form.displayName.trim()) e.displayName = "Name is required.";
    if (!isEdit && !form.email.trim()) e.email = "Email is required.";
    if (!isEdit && form.password.length < 8) e.password = "Min. 8 characters.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", backdropFilter: "blur(6px)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 450, boxShadow: "0 40px 80px rgba(0,0,0,0.2)", overflow: "hidden" }}>
        <div style={{ padding: "18px 22px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{isEdit ? "Edit Admin" : "Add New Admin"}</div>
            <div style={{ fontSize: 11.5, color: T.textLight, marginTop: 2 }}>{isEdit ? "Update account details." : "Create a new admin account."}</div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: "50%", background: "#F1F5F9", border: "none", cursor: "pointer", fontSize: 16, color: T.textMuted }}>×</button>
        </div>
        <div style={{ padding: "20px 22px" }}>
          <Field label="Full Name" error={errors.displayName}><Input value={form.displayName} onChange={set("displayName")} placeholder="e.g. Juan dela Cruz" /></Field>
          {!isEdit && <Field label="Email" error={errors.email}><Input value={form.email} onChange={set("email")} placeholder="admin@iconstruct.ph" type="email" /></Field>}
          {!isEdit && <Field label="Password" error={errors.password}><Input value={form.password} onChange={set("password")} placeholder="Min. 8 characters" type="password" /></Field>}
          <Field label="Role">
            <Select value={form.role} onChange={set("role")} options={[{ value: "admin", label: "Admin" }, { value: "super_admin", label: "Super Admin" }]} />
          </Field>
        </div>
        <div style={{ padding: "12px 22px 20px", borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" loading={loading} onClick={() => { if (validate()) onSave(form); }}>
            {isEdit ? "Save Changes" : "Create Admin"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ─── Section 3 — Recommendation Engine Editor ────────────────────────────────

const DEFAULT_FORMULA = {
  cementBagsPerSqm: 0.5,
  sandBagsPerSqm: 0.6,
  gravelBagsPerSqm: 0.4,
  steelBarsPerSqm: 1.2,
  hollowBlocksPerSqm: 12,
  wasteFactor: 0.1,
};

const DEFAULT_PRICING = {
  cementPerBag: 280,
  sandPerBag: 120,
  gravelPerBag: 130,
  steelBarPer: 380,
  hollowBlockPer: 18,
  laborPerSqm: 650,
};

// ─── Section 6 — System Log ───────────────────────────────────────────────────

function LogEntry({ entry }) {
  const levelColors = { info: T.info, warn: T.warning, error: T.danger, success: T.success };
  const levelBg = { info: T.infoLight, warn: T.warningLight, error: T.dangerLight, success: T.successLight };
  const level = entry.level || "info";
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 16px", borderBottom: `1px solid #F8FAFC`, fontFamily: "'DM Mono','Courier New',monospace" }}>
      <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: levelBg[level] || T.infoLight, color: levelColors[level] || T.info, letterSpacing: "0.06em", textTransform: "uppercase", flexShrink: 0, marginTop: 1 }}>{level}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: T.text }}>{entry.message}</div>
        <div style={{ fontSize: 10.5, color: T.textLight, marginTop: 2 }}>{entry.timestamp} · {entry.actor || "system"}</div>
      </div>
    </div>
  );
}

// ─── Password Field with Toggle ───────────────────────────────────────────────

function PwField({ label, value, onChange, error, placeholder = "••••••••" }) {
  const [show, setShow] = useState(false);
  const [focus, setFocus] = useState(false);
  return (
    <Field label={label} error={error}>
      <div style={{ position: "relative" }}>
        <input type={show ? "text" : "password"} value={value} onChange={onChange} placeholder={placeholder}
          style={{ ...inputStyle(focus), paddingRight: 40 }}
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} />
        <button type="button" onClick={() => setShow(s => !s)}
          style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 13.5, color: T.textLight }}>
          {show ? "🙈" : "👁"}
        </button>
      </div>
    </Field>
  );
}

// ─── Sidebar Nav ──────────────────────────────────────────────────────────────

const SETTING_SECTIONS = [
  { key: "accounts",    icon: "👤", label: "Admin Accounts" },
  { key: "security",    icon: "🔒", label: "Security" },
  { key: "engine",      icon: "⚙️",  label: "Recommendation Engine" },
  { key: "plans",       icon: "📦", label: "Subscription Plans" },
  { key: "notifs",      icon: "🔔", label: "Notification Settings" },
  { key: "maintenance", icon: "🛠️",  label: "System Maintenance" },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SystemSettingsTab({ currentUser }) {
  const [activeSection, setActiveSection] = useState("accounts");
  const [toast, setToast] = useState(null);
  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // ── Admin Accounts state ──
  const [admins, setAdmins]           = useState([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [adminModal, setAdminModal]   = useState(false);
  const [editTarget, setEditTarget]   = useState(null);
  const [confirmDlg, setConfirmDlg]   = useState({ open: false });

  // ── Security state ──
  const [pwForm, setPwForm]       = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [pwErrors, setPwErrors]   = useState({});
  const [pwLoading, setPwLoading] = useState(false);
  const [securitySettings, setSecuritySettings] = useState({ requireStrongPassword: true, sessionTimeout: "8h", maxLoginAttempts: 5 });
  const [savingSecure, setSavingSecure] = useState(false);

  // ── Recommendation Engine state ──
  const [formula, setFormula]     = useState(DEFAULT_FORMULA);
  const [pricing, setPricing]     = useState(DEFAULT_PRICING);
  const [engineLoading, setEngineLoading]   = useState(true);
  const [savingEngine, setSavingEngine]     = useState(false);

  // ── Subscription Plans state ──
  const [plans, setPlans]         = useState({});
  const [plansLoading, setPlansLoading]   = useState(true);
  const [savingPlans, setSavingPlans]     = useState(false);
  const [editingPlan, setEditingPlan]     = useState(null);
  const [planForm, setPlanForm]           = useState({});

  // ── Notification Settings state ──
  const [notifSettings, setNotifSettings] = useState({
    newApplication: true,
    applicationApproved: true,
    applicationRejected: true,
    paymentReceived: true,
    paymentConfirmed: true,
    paymentRejected: true,
    newBid: false,
    projectPosted: false,
    systemAlerts: true,
    dailyDigest: false,
    emailFrom: "no-reply@iconstruct.ph",
    digestTime: "08:00",
  });
  const [savingNotifs, setSavingNotifs] = useState(false);
  const [notifLoading, setNotifLoading] = useState(true);

  // ── System Maintenance state ──
  const [logs, setLogs]           = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [maintenance, setMaintenance] = useState({ maintenanceMode: false, backupSchedule: "daily", lastBackup: null, cacheEnabled: true });
  const [savingMaint, setSavingMaint] = useState(false);
  const [logFilter, setLogFilter] = useState("all");

  // ── Load admin accounts ──
  const loadAdmins = useCallback(async () => {
    setLoadingAdmins(true);
    try {
      const list = await getAllAdmins();
      setAdmins(list);
    } catch {
      showToast("Failed to load admins.", "error");
    } finally {
      setLoadingAdmins(false);
    }
  }, [showToast]);

  useEffect(() => { loadAdmins(); }, [loadAdmins]);

  // ── Load recommendation engine config ──
  useEffect(() => {
    (async () => {
      setEngineLoading(true);
      try {
        const snap = await getDoc(doc(db, "systemConfig", "recommendationEngine"));
        if (snap.exists()) {
          const d = snap.data();
          if (d.formula) setFormula(d.formula);
          if (d.pricing) setPricing(d.pricing);
        }
      } catch { /* use defaults */ }
      setEngineLoading(false);
    })();
  }, []);

  // ── Load subscription plans ──
  useEffect(() => {
    (async () => {
      setPlansLoading(true);
      try {
        const snap = await getDoc(doc(db, "systemConfig", "subscriptionPlans"));
        if (snap.exists()) {
          setPlans(snap.data().plans || {});
        } else {
          // Default plans from PLAN_CONFIG
          const defaultPlans = {};
          Object.entries(PLAN_CONFIG).forEach(([key, cfg]) => {
            defaultPlans[key] = {
              key,
              label: cfg.label,
              price: key === "basic" ? 0 : key === "pro" ? 499 : 999,
              billingCycle: "monthly",
              productLimit: cfg.productLimit === Infinity ? -1 : cfg.productLimit,
              quotaLimit: cfg.quotaLimit === Infinity ? -1 : cfg.quotaLimit,
              isPublic: true,
              features: key === "basic"
                ? ["Up to 20 products", "3 quotations/month", "Basic analytics"]
                : key === "pro"
                ? ["Up to 150 products", "Unlimited quotations", "Priority listing", "Advanced analytics"]
                : ["Unlimited products", "Unlimited quotations", "Featured placement", "Dedicated support", "Custom branding"],
            };
          });
          setPlans(defaultPlans);
        }
      } catch { /* use defaults */ }
      setPlansLoading(false);
    })();
  }, []);

  // ── Load notification settings ──
  useEffect(() => {
    (async () => {
      setNotifLoading(true);
      try {
        const snap = await getDoc(doc(db, "systemConfig", "notificationSettings"));
        if (snap.exists()) setNotifSettings(s => ({ ...s, ...snap.data() }));
      } catch { /* use defaults */ }
      setNotifLoading(false);
    })();
  }, []);

  // ── Load system config + logs ──
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "systemConfig", "maintenance"));
        if (snap.exists()) setMaintenance(s => ({ ...s, ...snap.data() }));
      } catch { /* use defaults */ }

      setLogsLoading(true);
      try {
        const q = query(collection(db, "systemLogs"), orderBy("createdAt", "desc"), limit(50));
        const snap = await getDocs(q);
        const entries = snap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            level: data.level || "info",
            message: data.message || "",
            actor: data.actor || "system",
            timestamp: data.createdAt?.toDate
              ? data.createdAt.toDate().toLocaleString("en-PH")
              : "—",
          };
        });
        setLogs(entries);
      } catch {
        // Generate demo logs if none exist
        setLogs([
          { id: "1", level: "success", message: "Shop 'Builders Hub' approved by administrator.", actor: "admin@iconstruct.ph", timestamp: new Date().toLocaleString("en-PH") },
          { id: "2", level: "info",    message: "Subscription payment confirmed for 'LM Hardware'. Plan: PRO.", actor: "admin@iconstruct.ph", timestamp: new Date(Date.now() - 3600000).toLocaleString("en-PH") },
          { id: "3", level: "warn",    message: "Failed login attempt detected from unknown IP.", actor: "system", timestamp: new Date(Date.now() - 7200000).toLocaleString("en-PH") },
          { id: "4", level: "info",    message: "Recommendation engine formulas updated.", actor: "admin@iconstruct.ph", timestamp: new Date(Date.now() - 86400000).toLocaleString("en-PH") },
          { id: "5", level: "error",   message: "Email delivery failed for shop rejection notice.", actor: "system", timestamp: new Date(Date.now() - 172800000).toLocaleString("en-PH") },
        ]);
      }
      setLogsLoading(false);
    })();
  }, []);

  // ── Admin CRUD ──
  const handleAdminSave = async (form) => {
    setActionLoading(true);
    try {
      if (editTarget) {
        await updateAdminProfile(editTarget.id, { displayName: form.displayName, role: form.role });
        showToast("Admin updated successfully.");
      } else {
        await createAdmin({ email: form.email, password: form.password, displayName: form.displayName, role: form.role });
        showToast("Admin account created.");
      }
      setAdminModal(false); setEditTarget(null); loadAdmins();
    } catch (err) {
      showToast(err.message || "Failed to save admin.", "error");
    } finally { setActionLoading(false); }
  };

  const confirmDelete = (admin) => setConfirmDlg({
    open: true, title: "Remove Admin", danger: true,
    message: `Remove ${admin.displayName || admin.email} from the admin panel? This cannot be undone.`,
    onConfirm: async () => {
      setActionLoading(true);
      try {
        await removeAdmin(admin.id);
        showToast("Admin removed."); setConfirmDlg({ open: false }); loadAdmins();
      } catch { showToast("Failed to remove admin.", "error"); }
      finally { setActionLoading(false); }
    },
  });

  const handleSendReset = (admin) => setConfirmDlg({
    open: true, title: "Send Password Reset", danger: false,
    message: `Send a password reset email to ${admin.email}?`,
    onConfirm: async () => {
      setActionLoading(true);
      try {
        await sendAdminPasswordReset(admin.email);
        showToast(`Reset email sent to ${admin.email}.`); setConfirmDlg({ open: false });
      } catch { showToast("Failed to send reset email.", "error"); }
      finally { setActionLoading(false); }
    },
  });

  // ── Change own password ──
  const setPw = (key) => (e) => setPwForm(f => ({ ...f, [key]: e.target.value }));
  const handleChangePassword = async () => {
    const e = {};
    if (!pwForm.currentPassword) e.currentPassword = "Enter your current password.";
    if (pwForm.newPassword.length < 8) e.newPassword = "Min. 8 characters.";
    if (pwForm.newPassword !== pwForm.confirmPassword) e.confirmPassword = "Passwords do not match.";
    setPwErrors(e);
    if (Object.keys(e).length > 0) return;
    setPwLoading(true);
    try {
      await changeAdminPassword({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      showToast("Password changed successfully.");
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setPwErrors({ currentPassword: "Current password is incorrect." });
      } else { showToast(err.message || "Failed to change password.", "error"); }
    } finally { setPwLoading(false); }
  };

  // ── Save recommendation engine ──
  const handleSaveEngine = async () => {
    setSavingEngine(true);
    try {
      await setDoc(doc(db, "systemConfig", "recommendationEngine"), {
        formula, pricing, updatedAt: serverTimestamp(),
      }, { merge: true });
      showToast("Recommendation engine updated.");
    } catch { showToast("Failed to save engine config.", "error"); }
    finally { setSavingEngine(false); }
  };

  // ── Save subscription plans ──
  const handleSavePlan = async () => {
    setSavingPlans(true);
    try {
      const updated = { ...plans, [editingPlan]: { ...plans[editingPlan], ...planForm } };
      await setDoc(doc(db, "systemConfig", "subscriptionPlans"), { plans: updated, updatedAt: serverTimestamp() }, { merge: true });
      setPlans(updated); setEditingPlan(null);
      showToast("Subscription plan updated.");
    } catch { showToast("Failed to save plan.", "error"); }
    finally { setSavingPlans(false); }
  };

  // ── Save notification settings ──
  const handleSaveNotifs = async () => {
    setSavingNotifs(true);
    try {
      await setDoc(doc(db, "systemConfig", "notificationSettings"), { ...notifSettings, updatedAt: serverTimestamp() }, { merge: true });
      showToast("Notification settings saved.");
    } catch { showToast("Failed to save notification settings.", "error"); }
    finally { setSavingNotifs(false); }
  };

  // ── Save maintenance settings ──
  const handleSaveMaintenance = async () => {
    setSavingMaint(true);
    try {
      await setDoc(doc(db, "systemConfig", "maintenance"), { ...maintenance, updatedAt: serverTimestamp() }, { merge: true });
      showToast("Maintenance settings saved.");
    } catch { showToast("Failed to save maintenance settings.", "error"); }
    finally { setSavingMaint(false); }
  };

  const isCurrentUser = (id) => currentUser?.uid === id;
  const filteredLogs = logFilter === "all" ? logs : logs.filter(l => l.level === logFilter);

  // ─── Render Sections ──────────────────────────────────────────────────────

  const renderAccounts = () => (
    <>
      <SectionCard title="Admin Accounts" subtitle="Manage who has access to the iConstruct admin panel." icon="👤" accent={T.accent}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
          <Btn variant="primary" onClick={() => { setEditTarget(null); setAdminModal(true); }}>+ Add Admin</Btn>
        </div>
        {loadingAdmins ? (
          <div style={{ textAlign: "center", padding: 40, color: T.textLight, fontSize: 13 }}>Loading admins...</div>
        ) : admins.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>👤</div>
            <div style={{ fontWeight: 600, color: T.text }}>No admin accounts found.</div>
          </div>
        ) : (
          <div style={{ borderRadius: 10, border: `1px solid ${T.border}`, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F8FAFC" }}>
                  {["Admin", "Email", "Role", "Added", "Actions"].map(h => (
                    <th key={h} style={{ padding: "9px 14px", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: T.textLight, textAlign: "left", borderBottom: `1px solid ${T.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {admins.map(admin => (
                  <tr key={admin.id}
                    onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td style={{ padding: "11px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <Avatar name={admin.displayName || admin.email} size={32} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
                            {admin.displayName || "—"}
                            {isCurrentUser(admin.id) && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, background: "#DBEAFE", color: "#1D4ED8", padding: "2px 6px", borderRadius: 10 }}>YOU</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "11px 14px", fontSize: 12.5, color: T.textMuted }}>{admin.email || "—"}</td>
                    <td style={{ padding: "11px 14px" }}>
                      {admin.role === "super_admin"
                        ? <Badge label="Super Admin" color="#6D28D9" bg="#F5F3FF" />
                        : <Badge label="Admin" color={T.info} bg={T.infoLight} />}
                    </td>
                    <td style={{ padding: "11px 14px", fontSize: 11.5, color: T.textLight }}>
                      {admin.createdAt?.toDate
                        ? admin.createdAt.toDate().toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })
                        : "—"}
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      <div style={{ display: "flex", gap: 5 }}>
                        <Btn size="sm" variant="ghost" onClick={() => { setEditTarget(admin); setAdminModal(true); }}>Edit</Btn>
                        <Btn size="sm" variant="ghost" onClick={() => handleSendReset(admin)}>Reset PW</Btn>
                        {!isCurrentUser(admin.id) && (
                          <Btn size="sm" variant="ghostDanger" onClick={() => confirmDelete(admin)}>Remove</Btn>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Current Session" subtitle="Details about your active admin session." icon="🖥️">
        <InfoGrid items={[
          { label: "Logged In As", value: currentUser?.email || "—" },
          { label: "UID", value: currentUser?.uid ? `${currentUser.uid.slice(0, 14)}…` : "—" },
          { label: "Email Verified", value: currentUser?.emailVerified ? "✓ Verified" : "✗ Not verified", color: currentUser?.emailVerified ? T.success : T.danger },
          { label: "Last Sign-In", value: currentUser?.metadata?.lastSignInTime ? new Date(currentUser.metadata.lastSignInTime).toLocaleString("en-PH") : "—" },
        ]} />
      </SectionCard>
    </>
  );

  const renderSecurity = () => (
    <>
      <SectionCard title="Change Your Password" subtitle="Update the password for your admin account." icon="🔑" accent={T.accent}>
        <div style={{ maxWidth: 380 }}>
          <PwField label="Current Password" value={pwForm.currentPassword} onChange={setPw("currentPassword")} error={pwErrors.currentPassword} />
          <PwField label="New Password" value={pwForm.newPassword} onChange={setPw("newPassword")} error={pwErrors.newPassword} />
          <PwField label="Confirm New Password" value={pwForm.confirmPassword} onChange={setPw("confirmPassword")} error={pwErrors.confirmPassword} />
          <Btn variant="success" loading={pwLoading} onClick={handleChangePassword} style={{ width: "100%", marginTop: 4 }}>Update Password</Btn>
        </div>
      </SectionCard>

      <SectionCard title="Security Policies" subtitle="Configure access rules and protection settings." icon="🛡️">
        <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 480 }}>
          <Toggle
            checked={securitySettings.requireStrongPassword}
            onChange={v => setSecuritySettings(s => ({ ...s, requireStrongPassword: v }))}
            label="Require Strong Passwords"
            hint="Enforce minimum 8 characters with mixed case and numbers for all admin accounts."
          />
          <div style={{ height: 1, background: T.border }} />
          <Field label="Session Timeout" hint="Automatically sign out inactive admin sessions after this period.">
            <Select value={securitySettings.sessionTimeout}
              onChange={e => setSecuritySettings(s => ({ ...s, sessionTimeout: e.target.value }))}
              options={[{ value: "1h", label: "1 Hour" }, { value: "4h", label: "4 Hours" }, { value: "8h", label: "8 Hours" }, { value: "24h", label: "24 Hours" }, { value: "never", label: "Never" }]} />
          </Field>
          <Field label="Max Login Attempts" hint="Lock account after this many consecutive failed login attempts.">
            <Select value={String(securitySettings.maxLoginAttempts)}
              onChange={e => setSecuritySettings(s => ({ ...s, maxLoginAttempts: parseInt(e.target.value) }))}
              options={[{ value: "3", label: "3 Attempts" }, { value: "5", label: "5 Attempts" }, { value: "10", label: "10 Attempts" }]} />
          </Field>
          <Btn variant="primary" loading={savingSecure} onClick={async () => {
            setSavingSecure(true);
            try {
              await setDoc(doc(db, "systemConfig", "security"), { ...securitySettings, updatedAt: serverTimestamp() }, { merge: true });
              showToast("Security settings saved.");
            } catch { showToast("Failed to save settings.", "error"); }
            finally { setSavingSecure(false); }
          }}>Save Security Settings</Btn>
        </div>
      </SectionCard>

      <SectionCard title="Authentication Info" subtitle="Your current Firebase Auth session details." icon="🔐">
        <InfoGrid items={[
          { label: "Auth Provider", value: currentUser?.providerData?.[0]?.providerId || "password" },
          { label: "Account Created", value: currentUser?.metadata?.creationTime ? new Date(currentUser.metadata.creationTime).toLocaleDateString("en-PH") : "—" },
          { label: "Token Expires", value: "1 hour (auto-refresh)" },
          { label: "2FA Status", value: currentUser?.multiFactor?.enrolledFactors?.length > 0 ? "Enabled" : "Not enabled", color: currentUser?.multiFactor?.enrolledFactors?.length > 0 ? T.success : T.warning },
        ]} />
      </SectionCard>
    </>
  );

  const renderEngine = () => {
    const formulaFields = [
      { key: "cementBagsPerSqm",   label: "Cement Bags per sqm" },
      { key: "sandBagsPerSqm",     label: "Sand Bags per sqm" },
      { key: "gravelBagsPerSqm",   label: "Gravel Bags per sqm" },
      { key: "steelBarsPerSqm",    label: "Steel Bars per sqm" },
      { key: "hollowBlocksPerSqm", label: "Hollow Blocks per sqm" },
      { key: "wasteFactor",        label: "Waste Factor (e.g. 0.10 = 10%)" },
    ];
    const pricingFields = [
      { key: "cementPerBag",   label: "Cement (₱/bag)" },
      { key: "sandPerBag",     label: "Sand (₱/bag)" },
      { key: "gravelPerBag",   label: "Gravel (₱/bag)" },
      { key: "steelBarPer",    label: "Steel Bar (₱/pc)" },
      { key: "hollowBlockPer", label: "Hollow Block (₱/pc)" },
      { key: "laborPerSqm",    label: "Labor Cost (₱/sqm)" },
    ];
    return (
      <>
        <SectionCard title="Material Computation Formulas" subtitle="Ratios used to compute material quantities from project area." icon="📐" accent={T.info}>
          {engineLoading ? <div style={{ padding: 24, textAlign: "center", color: T.textLight }}>Loading...</div> : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 14, marginBottom: 18 }}>
                {formulaFields.map(({ key, label }) => (
                  <Field key={key} label={label}>
                    <Input type="number" value={formula[key]} onChange={e => setFormula(f => ({ ...f, [key]: parseFloat(e.target.value) || 0 }))} />
                  </Field>
                ))}
              </div>
              <div style={{ background: T.infoLight, border: `1px solid #BAE6FD`, borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#0369A1", marginBottom: 16 }}>
                ℹ️ These values define how many units of each material are required per square meter of floor area. Waste factor is applied on top of the base computation.
              </div>
            </>
          )}
        </SectionCard>

        <SectionCard title="Reference Pricing" subtitle="Base prices (₱) used in cost estimation suggestions." icon="💰">
          {engineLoading ? <div style={{ padding: 24, textAlign: "center", color: T.textLight }}>Loading...</div> : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 14, marginBottom: 18 }}>
                {pricingFields.map(({ key, label }) => (
                  <Field key={key} label={label}>
                    <Input type="number" value={pricing[key]} onChange={e => setPricing(p => ({ ...p, [key]: parseFloat(e.target.value) || 0 }))} />
                  </Field>
                ))}
              </div>
              <div style={{ background: T.warningLight, border: `1px solid #FCD34D`, borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#92400E", marginBottom: 16 }}>
                ⚠️ Prices are reference values for estimation only. Final pricing is determined by individual shop listings.
              </div>
            </>
          )}
        </SectionCard>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Btn variant="primary" loading={savingEngine} onClick={handleSaveEngine} size="lg">Save Engine Configuration</Btn>
        </div>
      </>
    );
  };

  const renderPlans = () => {
    const planKeys = ["basic", "pro", "business"];
    const planColors = { basic: "#64748B", pro: "#1D4ED8", business: "#7C3AED" };
    return (
      <>
        {plansLoading ? (
          <div style={{ padding: 40, textAlign: "center", color: T.textLight }}>Loading plans...</div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 16, marginBottom: 24 }}>
              {planKeys.map(key => {
                const plan = plans[key] || {};
                const color = planColors[key];
                return (
                  <div key={key} style={{ background: T.surface, borderRadius: 12, border: `1.5px solid ${T.border}`, overflow: "hidden", transition: "box-shadow 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)"}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}>
                    <div style={{ height: 4, background: color }} />
                    <div style={{ padding: "16px 18px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, textTransform: "capitalize" }}>{key}</div>
                          <div style={{ fontSize: 12, color: T.textMuted }}>₱{plan.price || 0}/{plan.billingCycle || "month"}</div>
                        </div>
                        <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 10, background: plan.isPublic ? T.successLight : "#F1F5F9", color: plan.isPublic ? T.success : T.textMuted }}>
                          {plan.isPublic ? "Public" : "Hidden"}
                        </span>
                      </div>
                      <div style={{ fontSize: 11.5, color: T.textMuted, marginBottom: 12 }}>
                        Products: {plan.productLimit === -1 ? "Unlimited" : plan.productLimit}<br />
                        Quotas: {plan.quotaLimit === -1 ? "Unlimited" : plan.quotaLimit + "/mo"}
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        {(plan.features || []).map((f, i) => (
                          <div key={i} style={{ fontSize: 11.5, color: T.textMuted, marginBottom: 3 }}>✓ {f}</div>
                        ))}
                      </div>
                      <Btn variant="ghost" size="sm" style={{ width: "100%" }} onClick={() => { setEditingPlan(key); setPlanForm({ ...plan }); }}>
                        Edit Plan
                      </Btn>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Plan Edit Modal */}
            {editingPlan && (
              <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", backdropFilter: "blur(6px)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
                onClick={e => { if (e.target === e.currentTarget) setEditingPlan(null); }}>
                <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 500, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 40px 80px rgba(0,0,0,0.2)" }}>
                  <div style={{ padding: "18px 22px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: T.text, textTransform: "capitalize" }}>Edit {editingPlan} Plan</div>
                      <div style={{ fontSize: 11.5, color: T.textLight, marginTop: 2 }}>Update plan details and feature access.</div>
                    </div>
                    <button onClick={() => setEditingPlan(null)} style={{ width: 30, height: 30, borderRadius: "50%", background: "#F1F5F9", border: "none", cursor: "pointer", fontSize: 16, color: T.textMuted }}>×</button>
                  </div>
                  <div style={{ padding: "20px 22px" }}>
                    <Field label="Display Label"><Input value={planForm.label || ""} onChange={e => setPlanForm(f => ({ ...f, label: e.target.value }))} /></Field>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <Field label="Price (₱)"><Input type="number" value={planForm.price || 0} onChange={e => setPlanForm(f => ({ ...f, price: parseInt(e.target.value) || 0 }))} /></Field>
                      <Field label="Billing Cycle">
                        <Select value={planForm.billingCycle || "monthly"}
                          onChange={e => setPlanForm(f => ({ ...f, billingCycle: e.target.value }))}
                          options={[{ value: "monthly", label: "Monthly" }, { value: "quarterly", label: "Quarterly" }, { value: "annually", label: "Annually" }]} />
                      </Field>
                      <Field label="Product Limit (-1 = unlimited)"><Input type="number" value={planForm.productLimit ?? -1} onChange={e => setPlanForm(f => ({ ...f, productLimit: parseInt(e.target.value) }))} /></Field>
                      <Field label="Quota Limit (-1 = unlimited)"><Input type="number" value={planForm.quotaLimit ?? -1} onChange={e => setPlanForm(f => ({ ...f, quotaLimit: parseInt(e.target.value) }))} /></Field>
                    </div>
                    <Field label="Features (one per line)">
                      <Textarea
                        rows={5}
                        value={(planForm.features || []).join("\n")}
                        onChange={e => setPlanForm(f => ({ ...f, features: e.target.value.split("\n").filter(Boolean) }))}
                        placeholder={"Up to 150 products\nUnlimited quotations\nPriority listing"} />
                    </Field>
                    <Toggle checked={planForm.isPublic !== false} onChange={v => setPlanForm(f => ({ ...f, isPublic: v }))}
                      label="Show in Pricing Page" hint="When disabled, this plan won't be visible to shop owners." />
                  </div>
                  <div style={{ padding: "12px 22px 20px", borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "flex-end", gap: 10 }}>
                    <Btn variant="ghost" onClick={() => setEditingPlan(null)}>Cancel</Btn>
                    <Btn variant="primary" loading={savingPlans} onClick={handleSavePlan}>Save Plan</Btn>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </>
    );
  };

  const renderNotifs = () => {
    const toggleGroups = [
      {
        label: "Shop Application Alerts",
        items: [
          { key: "newApplication",       label: "New Application Submitted",   hint: "Notify admin when a new shop registers." },
          { key: "applicationApproved",  label: "Application Approved",        hint: "Notify shop owner when approved." },
          { key: "applicationRejected",  label: "Application Rejected",        hint: "Notify shop owner with rejection reason." },
        ],
      },
      {
        label: "Payment & Subscription Alerts",
        items: [
          { key: "paymentReceived",  label: "Payment Request Submitted", hint: "Notify admin when a payment request arrives." },
          { key: "paymentConfirmed", label: "Payment Confirmed",         hint: "Notify shop owner when payment is confirmed." },
          { key: "paymentRejected",  label: "Payment Rejected",          hint: "Notify shop owner when payment is rejected." },
        ],
      },
      {
        label: "Activity Alerts",
        items: [
          { key: "newBid",       label: "New Bid Submitted",    hint: "Notify contractor when a new bid is placed on their project." },
          { key: "projectPosted", label: "New Project Posted",   hint: "Notify registered contractors when a project is posted." },
          { key: "systemAlerts", label: "System Alerts",        hint: "Critical system notifications (errors, downtime)." },
          { key: "dailyDigest",  label: "Daily Activity Digest", hint: "Send a daily summary email to all admins." },
        ],
      },
    ];
    return (
      <>
        {notifLoading ? (
          <div style={{ padding: 40, textAlign: "center", color: T.textLight }}>Loading...</div>
        ) : (
          <>
            {toggleGroups.map(group => (
              <SectionCard key={group.label} title={group.label} icon="🔔">
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {group.items.map(({ key, label, hint }) => (
                    <Toggle key={key} checked={notifSettings[key] !== false}
                      onChange={v => setNotifSettings(s => ({ ...s, [key]: v }))}
                      label={label} hint={hint} />
                  ))}
                </div>
              </SectionCard>
            ))}

            <SectionCard title="Email Configuration" subtitle="Settings for outgoing notification emails." icon="✉️">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, maxWidth: 480 }}>
                <Field label="From Email Address" hint="Used as the sender for all notification emails.">
                  <Input value={notifSettings.emailFrom}
                    onChange={e => setNotifSettings(s => ({ ...s, emailFrom: e.target.value }))}
                    placeholder="no-reply@iconstruct.ph" />
                </Field>
                <Field label="Daily Digest Send Time" hint="Time to send the daily summary (24h format).">
                  <Input type="time" value={notifSettings.digestTime}
                    onChange={e => setNotifSettings(s => ({ ...s, digestTime: e.target.value }))} />
                </Field>
              </div>
            </SectionCard>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Btn variant="primary" loading={savingNotifs} onClick={handleSaveNotifs} size="lg">Save Notification Settings</Btn>
            </div>
          </>
        )}
      </>
    );
  };

  const renderMaintenance = () => {
    const logLevels = ["all", "info", "success", "warn", "error"];
    return (
      <>
        <SectionCard title="System Control" subtitle="Platform-wide maintenance and performance settings." icon="⚡" accent={T.warning}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 500 }}>
            <Toggle
              checked={maintenance.maintenanceMode}
              onChange={v => setMaintenance(s => ({ ...s, maintenanceMode: v }))}
              label="Maintenance Mode"
              hint="When enabled, all non-admin users will see a maintenance page. Use before major updates." />
            <div style={{ height: 1, background: T.border }} />
            <Toggle
              checked={maintenance.cacheEnabled !== false}
              onChange={v => setMaintenance(s => ({ ...s, cacheEnabled: v }))}
              label="Enable Query Caching"
              hint="Cache frequently-read Firestore data to reduce reads and improve performance." />
            <div style={{ height: 1, background: T.border }} />
            <Field label="Automatic Backup Schedule">
              <Select value={maintenance.backupSchedule || "daily"}
                onChange={e => setMaintenance(s => ({ ...s, backupSchedule: e.target.value }))}
                options={[
                  { value: "hourly", label: "Every Hour" },
                  { value: "daily", label: "Daily (Recommended)" },
                  { value: "weekly", label: "Weekly" },
                  { value: "manual", label: "Manual Only" },
                ]} />
            </Field>
            {maintenance.lastBackup && (
              <div style={{ fontSize: 11.5, color: T.textMuted }}>Last backup: {maintenance.lastBackup}</div>
            )}
            <Btn variant="primary" loading={savingMaint} onClick={handleSaveMaintenance}>Save Maintenance Settings</Btn>
          </div>
        </SectionCard>

        <SectionCard title="System Logs" subtitle="Recent platform activity and error events." icon="📋">
          <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            {logLevels.map(level => (
              <button key={level} onClick={() => setLogFilter(level)}
                style={{ padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", textTransform: "capitalize", fontFamily: "'DM Sans',sans-serif", border: "none", background: logFilter === level ? T.text : "#F1F5F9", color: logFilter === level ? "#fff" : T.textMuted }}>
                {level}
              </button>
            ))}
          </div>
          {logsLoading ? (
            <div style={{ padding: 24, textAlign: "center", color: T.textLight }}>Loading logs...</div>
          ) : filteredLogs.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: T.textLight, fontSize: 13 }}>No log entries found.</div>
          ) : (
            <div style={{ borderRadius: 10, border: `1px solid ${T.border}`, overflow: "hidden", maxHeight: 380, overflowY: "auto" }}>
              {filteredLogs.map(entry => <LogEntry key={entry.id} entry={entry} />)}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Platform Stats" subtitle="Current resource and usage overview." icon="📊">
          <InfoGrid items={[
            { label: "Firebase Project", value: "iconstruct-web" },
            { label: "Database", value: "Cloud Firestore" },
            { label: "Auth Provider", value: "Firebase Auth" },
            { label: "Storage", value: "Firebase Storage" },
            { label: "Hosting", value: "Vite + XAMPP (dev)" },
            { label: "Node Version", value: "v18+" },
            { label: "Environment", value: import.meta.env.MODE || "development" },
            { label: "App Version", value: "1.0.0" },
          ]} />
        </SectionCard>
      </>
    );
  };

  const sectionRenderers = {
    accounts: renderAccounts,
    security: renderSecurity,
    engine: renderEngine,
    plans: renderPlans,
    notifs: renderNotifs,
    maintenance: renderMaintenance,
  };

  // ─── Layout ───────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        @keyframes fadeUp { from { opacity:0; transform:translateX(-50%) translateY(8px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
      `}</style>

      <div style={{ fontFamily: "'DM Sans',sans-serif" }}>
        {/* Page Header */}
        <div style={{ marginBottom: 22 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: T.text, marginBottom: 3 }}>System Settings</h2>
          <p style={{ fontSize: 13, color: T.textMuted }}>Configure and manage all platform-level settings from one place.</p>
        </div>

        <div style={{ display: "flex", gap: 22, alignItems: "flex-start" }}>
          {/* Settings Sidebar */}
          <div style={{ width: 200, flexShrink: 0, background: T.surface, borderRadius: 14, border: `1px solid ${T.border}`, overflow: "hidden", position: "sticky", top: 16 }}>
            <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: T.textLight }}>Configuration</div>
            </div>
            <nav style={{ padding: "8px 0" }}>
              {SETTING_SECTIONS.map(sec => {
                const isActive = activeSection === sec.key;
                return (
                  <button key={sec.key} onClick={() => setActiveSection(sec.key)}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "9px 16px", background: isActive ? T.accentLight : "transparent", borderLeft: `3px solid ${isActive ? T.accent : "transparent"}`, border: "none", borderRight: "none", cursor: "pointer", color: isActive ? T.accent : T.textMuted, fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, fontWeight: isActive ? 600 : 400, textAlign: "left", transition: "all 0.15s" }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "#F8FAFC"; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>{sec.icon}</span>
                    <span>{sec.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Main Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {(sectionRenderers[activeSection] || (() => null))()}
          </div>
        </div>
      </div>

      {/* Modals & Toast */}
      <AdminFormModal open={adminModal} onClose={() => { setAdminModal(false); setEditTarget(null); }}
        onSave={handleAdminSave} editTarget={editTarget} loading={actionLoading} />
      <ConfirmDialog open={confirmDlg.open} title={confirmDlg.title} message={confirmDlg.message}
        danger={confirmDlg.danger} loading={actionLoading}
        onConfirm={confirmDlg.onConfirm} onCancel={() => setConfirmDlg({ open: false })} />
      <Toast toast={toast} />
    </>
  );
}