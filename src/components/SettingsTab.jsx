// src/components/SettingsTab.jsx
// Combined shop profile + settings for all plan dashboards.
import { useEffect, useState } from "react";
import { auth, db } from "../services/firebase";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import {
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser,
} from "firebase/auth";
import { useNavigate } from "react-router-dom";

function toDate(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === "function") return ts.toDate();
  if (typeof ts.seconds === "number") return new Date(ts.seconds * 1000);
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Exact date + time in PH locale, e.g. Aug 7, 2026, 5:44:30 PM */
function formatDateTimeExact(ts) {
  const d = toDate(ts);
  if (!d) return null;
  return d.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function formatPlanLabel(plan) {
  const p = String(plan || "basic").toLowerCase();
  if (p === "pro") return "Pro";
  if (p === "business") return "Business";
  return "Basic";
}

const TABS = [
  { id: "profile", label: "Shop Profile" },
  { id: "security", label: "Security" },
  { id: "notifications", label: "Notifications" },
  { id: "danger", label: "Danger Zone" },
];

export default function SettingsTab({
  shop,
  accentColor = "#2C3E50",
  accentGradient,
  onShopUpdated,
}) {
  const navigate = useNavigate();
  const gradient = accentGradient || `linear-gradient(135deg,${accentColor},${accentColor}90)`;
  const [section, setSection] = useState("profile");

  const [profile, setProfile] = useState({
    shopName: "",
    ownerName: "",
    phone: "",
    address: "",
    barangay: "",
    description: "",
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState(null);

  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState(null);

  const [notifs, setNotifs] = useState({
    newProject: true,
    quotationReply: true,
    weeklyDigest: false,
    marketing: false,
  });
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifMsg, setNotifMsg] = useState(null);

  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState(null);

  // Keep form in sync when shop loads / live updates
  useEffect(() => {
    if (!shop) return;
    setProfile({
      shopName: shop.shopName || "",
      ownerName: shop.ownerName || "",
      phone: shop.phone || "",
      address: shop.address || "",
      barangay: shop.barangay || "",
      description: shop.description || "",
    });
    setNotifs({
      newProject: shop?.notifs?.newProject ?? true,
      quotationReply: shop?.notifs?.quotationReply ?? true,
      weeklyDigest: shop?.notifs?.weeklyDigest ?? false,
      marketing: shop?.notifs?.marketing ?? false,
    });
  }, [shop]);

  const plan = formatPlanLabel(shop?.subscriptionPlan);
  const subStatus = String(shop?.subscriptionStatus || "—");
  const expiryExact = formatDateTimeExact(shop?.subscriptionExpiry);
  const expDate = toDate(shop?.subscriptionExpiry);
  const isExpired = expDate ? expDate.getTime() < Date.now() : false;
  const isPaid = ["pro", "business"].includes(String(shop?.subscriptionPlan || "").toLowerCase());

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated.");
      if (!profile.shopName.trim()) throw new Error("Shop name is required.");
      if (!profile.ownerName.trim()) throw new Error("Owner name is required.");
      if (!profile.phone.trim()) throw new Error("Phone number is required.");

      const payload = {
        shopName: profile.shopName.trim(),
        ownerName: profile.ownerName.trim(),
        phone: profile.phone.trim(),
        address: profile.address.trim(),
        barangay: profile.barangay.trim(),
        description: profile.description.trim(),
        updatedAt: serverTimestamp(),
      };
      await updateDoc(doc(db, "shops", user.uid), payload);
      setProfileMsg({ type: "success", text: "Shop profile saved." });
      onShopUpdated?.({ ...shop, ...payload });
    } catch (err) {
      setProfileMsg({ type: "error", text: err.message || "Failed to update profile." });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPwMsg(null);
    if (!pwForm.current) {
      return setPwMsg({ type: "error", text: "Enter your current password." });
    }
    if (pwForm.next.length < 6) {
      return setPwMsg({ type: "error", text: "New password must be at least 6 characters." });
    }
    if (pwForm.next !== pwForm.confirm) {
      return setPwMsg({ type: "error", text: "Passwords do not match." });
    }
    setPwSaving(true);
    try {
      const user = auth.currentUser;
      if (!user?.email) throw new Error("Not authenticated.");
      const cred = EmailAuthProvider.credential(user.email, pwForm.current);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, pwForm.next);
      setPwForm({ current: "", next: "", confirm: "" });
      setPwMsg({ type: "success", text: "Password changed successfully." });
    } catch (err) {
      const code = err.code || "";
      setPwMsg({
        type: "error",
        text:
          code === "auth/wrong-password" || code === "auth/invalid-credential"
            ? "Current password is incorrect."
            : code === "auth/requires-recent-login"
              ? "Please sign out and sign in again, then change your password."
              : err.message || "Could not change password.",
      });
    } finally {
      setPwSaving(false);
    }
  };

  const handleSaveNotifs = async () => {
    setNotifSaving(true);
    setNotifMsg(null);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated.");
      await updateDoc(doc(db, "shops", user.uid), {
        notifs,
        updatedAt: serverTimestamp(),
      });
      setNotifMsg({ type: "success", text: "Notification preferences saved." });
      onShopUpdated?.({ ...shop, notifs });
    } catch (err) {
      setNotifMsg({ type: "error", text: err.message || "Failed to save preferences." });
    } finally {
      setNotifSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== "DELETE") {
      return setDeleteMsg({ type: "error", text: 'Type "DELETE" to confirm.' });
    }
    setDeleting(true);
    setDeleteMsg(null);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated.");
      // Soft-delete allowed by Firestore rules; Auth deletion needs recent login
      await updateDoc(doc(db, "shops", user.uid), {
        status: "deleted",
        updatedAt: serverTimestamp(),
      });
      try {
        await deleteUser(user);
      } catch {
        await auth.signOut();
      }
      navigate("/login", { replace: true });
    } catch (err) {
      setDeleteMsg({
        type: "error",
        text: err.message || "Failed. Sign in again and retry.",
      });
    } finally {
      setDeleting(false);
    }
  };

  const card = {
    background: "#fff",
    borderRadius: 14,
    border: "1px solid #E2E8F0",
    padding: "24px 28px",
    marginBottom: 20,
  };
  const sectionTitle = { fontSize: 14, fontWeight: 700, color: "#0F172A", marginBottom: 4 };
  const sectionSub = { fontSize: 12, color: "#64748B", marginBottom: 20 };
  const labelStyle = {
    fontSize: 11,
    fontWeight: 700,
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 6,
    display: "block",
  };
  const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1.5px solid #E2E8F0",
    fontSize: 13,
    color: "#0F172A",
    outline: "none",
    background: "#FAFAFA",
    transition: "border 0.15s",
    boxSizing: "border-box",
    fontFamily: "inherit",
  };
  const focusInput = (e) => {
    e.target.style.border = `1.5px solid ${accentColor}`;
  };
  const blurInput = (e) => {
    e.target.style.border = "1.5px solid #E2E8F0";
  };
  const primaryBtn = {
    padding: "10px 24px",
    borderRadius: 9,
    border: "none",
    background: gradient,
    color: "#fff",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
  };
  const msgBox = (type) => ({
    padding: "10px 14px",
    borderRadius: 8,
    fontSize: 12.5,
    marginTop: 12,
    background: type === "success" ? "#D1FAE5" : "#FEE2E2",
    color: type === "success" ? "#065F46" : "#991B1B",
    border: `1px solid ${type === "success" ? "#6EE7B7" : "#FCA5A5"}`,
  });

  const Toggle = ({ checked, onChange }) => (
    <div
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 40,
        height: 22,
        borderRadius: 11,
        cursor: "pointer",
        background: checked ? accentColor : "#CBD5E1",
        position: "relative",
        transition: "background 0.2s",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "#fff",
          position: "absolute",
          top: 3,
          left: checked ? 21 : 3,
          transition: "left 0.2s",
          boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
        }}
      />
    </div>
  );

  const InfoRow = ({ label, value }) => (
    <div
      style={{
        display: "flex",
        gap: 12,
        marginBottom: 10,
        fontSize: 13,
        flexWrap: "wrap",
      }}
    >
      <span style={{ color: "#94A3B8", minWidth: 140, flexShrink: 0 }}>{label}</span>
      <span style={{ color: "#0F172A", fontWeight: 500 }}>{value || "—"}</span>
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 19,
            fontWeight: 900,
            color: "#0F172A",
            marginBottom: 4,
            fontFamily: "var(--font-display)",
          }}
        >
          Settings
        </div>
        <div style={{ fontSize: 12, color: "#64748B" }}>
          Shop profile, subscription, security, and preferences in one place.
        </div>
      </div>

      {/* Section tabs */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 20,
        }}
      >
        {TABS.map((t) => {
          const active = section === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSection(t.id)}
              style={{
                padding: "8px 14px",
                borderRadius: 20,
                border: `1.5px solid ${active ? accentColor : "#E2E8F0"}`,
                background: active ? `${accentColor}14` : "#fff",
                color: active ? accentColor : "#64748B",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── PROFILE ──────────────────────────────────────────────────────── */}
      {section === "profile" && (
        <>
          <div style={card}>
            <div style={sectionTitle}>Account overview</div>
            <div style={sectionSub}>Read-only account and subscription details.</div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                marginBottom: 20,
                paddingBottom: 18,
                borderBottom: "1px solid #F1F5F9",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: gradient,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                  fontWeight: 800,
                  color: "#fff",
                  flexShrink: 0,
                }}
              >
                {(shop?.shopName || "S")[0]?.toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: "#0F172A" }}>
                  {shop?.shopName || "Your shop"}
                </div>
                <div style={{ fontSize: 12, color: "#64748B" }}>
                  {[shop?.city, shop?.province].filter(Boolean).join(", ") || "—"}
                </div>
                <span
                  style={{
                    display: "inline-block",
                    marginTop: 6,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    padding: "3px 10px",
                    borderRadius: 20,
                    background: "#EFF6FF",
                    color: accentColor,
                    border: "1px solid #BFDBFE",
                  }}
                >
                  {plan} plan · {shop?.status || "—"}
                </span>
              </div>
            </div>

            <InfoRow label="Login email" value={shop?.email || auth.currentUser?.email} />
            <InfoRow label="Owner" value={shop?.ownerName} />
            <InfoRow label="Subscription plan" value={plan} />
            <InfoRow label="Subscription status" value={subStatus} />
            <InfoRow
              label="Expires on"
              value={
                expiryExact
                  ? `${expiryExact}${isExpired ? " (expired)" : isPaid ? "" : ""}`
                  : isPaid
                    ? "Not set"
                    : "—"
              }
            />
            {expiryExact && (
              <div
                style={{
                  marginTop: 12,
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: isExpired ? "#FEF2F2" : "#F0FDF4",
                  border: `1px solid ${isExpired ? "#FCA5A5" : "#86EFAC"}`,
                  fontSize: 13,
                  color: isExpired ? "#991B1B" : "#166534",
                  lineHeight: 1.5,
                }}
              >
                {isExpired ? (
                  <>
                    Your paid plan expired on <strong>{expiryExact}</strong>. You are on Basic until you renew.
                  </>
                ) : isPaid ? (
                  <>
                    Your <strong>{plan}</strong> plan is active until{" "}
                    <strong>{expiryExact}</strong> (exact date &amp; time).
                  </>
                ) : (
                  <>Free Basic plan — upgrade anytime for Pro or Business.</>
                )}
              </div>
            )}
            {!expiryExact && isPaid && (
              <div style={{ marginTop: 12, fontSize: 12, color: "#D97706" }}>
                Paid plan is set but no expiry timestamp is stored yet. Contact support if this looks wrong.
              </div>
            )}
          </div>

          <div style={card}>
            <div style={sectionTitle}>Edit shop profile</div>
            <div style={sectionSub}>These details may appear to builders and admins.</div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
                marginBottom: 16,
              }}
              className="settings-profile-grid"
            >
              {[
                { key: "shopName", label: "Shop Name *", ph: "Your shop name" },
                { key: "ownerName", label: "Owner Name *", ph: "Full name" },
                { key: "phone", label: "Phone *", ph: "09XXXXXXXXX" },
                { key: "barangay", label: "Barangay", ph: "Barangay" },
                { key: "address", label: "Street address", ph: "Street / building" },
              ].map(({ key, label, ph }) => (
                <div key={key} style={key === "address" ? { gridColumn: "1 / -1" } : undefined}>
                  <label style={labelStyle}>{label}</label>
                  <input
                    style={inputStyle}
                    value={profile[key]}
                    onChange={(e) => setProfile((p) => ({ ...p, [key]: e.target.value }))}
                    onFocus={focusInput}
                    onBlur={blurInput}
                    placeholder={ph}
                  />
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Shop description</label>
              <textarea
                style={{ ...inputStyle, height: 90, resize: "vertical" }}
                value={profile.description}
                onChange={(e) => setProfile((p) => ({ ...p, description: e.target.value }))}
                onFocus={focusInput}
                onBlur={blurInput}
                placeholder="Specialties, delivery area, brands you sell…"
              />
            </div>

            <button type="button" style={primaryBtn} onClick={handleSaveProfile} disabled={profileSaving}>
              {profileSaving ? "Saving…" : "Save profile"}
            </button>
            {profileMsg && <div style={msgBox(profileMsg.type)}>{profileMsg.text}</div>}
          </div>
        </>
      )}

      {/* ── SECURITY ─────────────────────────────────────────────────────── */}
      {section === "security" && (
        <div style={card}>
          <div style={sectionTitle}>Change password</div>
          <div style={sectionSub}>
            Signed in as <strong>{auth.currentUser?.email || shop?.email || "—"}</strong>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 420 }}>
            {[
              { key: "current", label: "Current password", placeholder: "Current password" },
              { key: "next", label: "New password", placeholder: "Min. 6 characters" },
              { key: "confirm", label: "Confirm new password", placeholder: "Repeat new password" },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label style={labelStyle}>{label}</label>
                <input
                  type="password"
                  style={inputStyle}
                  value={pwForm[key]}
                  onChange={(e) => setPwForm((p) => ({ ...p, [key]: e.target.value }))}
                  onFocus={focusInput}
                  onBlur={blurInput}
                  placeholder={placeholder}
                  autoComplete={key === "current" ? "current-password" : "new-password"}
                />
              </div>
            ))}
          </div>

          <div style={{ marginTop: 16 }}>
            <button type="button" style={primaryBtn} onClick={handleChangePassword} disabled={pwSaving}>
              {pwSaving ? "Updating…" : "Update password"}
            </button>
          </div>
          {pwMsg && <div style={msgBox(pwMsg.type)}>{pwMsg.text}</div>}
        </div>
      )}

      {/* ── NOTIFICATIONS ────────────────────────────────────────────────── */}
      {section === "notifications" && (
        <div style={card}>
          <div style={sectionTitle}>Notification preferences</div>
          <div style={sectionSub}>These are saved on your shop profile for future alerts.</div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            {[
              {
                key: "newProject",
                label: "New project alerts",
                desc: "Notify when builders post new projects.",
              },
              {
                key: "quotationReply",
                label: "Quotation status updates",
                desc: "Know when a builder accepts or rejects your quote.",
              },
              {
                key: "weeklyDigest",
                label: "Weekly summary",
                desc: "Activity digest (when email summaries are enabled).",
              },
              {
                key: "marketing",
                label: "Promotions & updates",
                desc: "Product tips from iConstruct.",
              },
            ].map(({ key, label, desc }, i, arr) => (
              <div
                key={key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  padding: "14px 0",
                  borderBottom: i < arr.length - 1 ? "1px solid #F1F5F9" : "none",
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", marginBottom: 2 }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#94A3B8" }}>{desc}</div>
                </div>
                <Toggle
                  checked={!!notifs[key]}
                  onChange={(val) => setNotifs((n) => ({ ...n, [key]: val }))}
                />
              </div>
            ))}
          </div>

          <div style={{ marginTop: 16 }}>
            <button type="button" style={primaryBtn} onClick={handleSaveNotifs} disabled={notifSaving}>
              {notifSaving ? "Saving…" : "Save preferences"}
            </button>
          </div>
          {notifMsg && <div style={msgBox(notifMsg.type)}>{notifMsg.text}</div>}
        </div>
      )}

      {/* ── DANGER ───────────────────────────────────────────────────────── */}
      {section === "danger" && (
        <div style={{ ...card, border: "1px solid #FCA5A5", background: "#FFF5F5" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#DC2626", marginBottom: 4 }}>
            Danger zone
          </div>
          <div style={{ fontSize: 12, color: "#64748B", marginBottom: 16, lineHeight: 1.6 }}>
            Closing your shop sets status to deleted so you cannot sign in. Some data may remain for
            admin records.
          </div>
          <button
            type="button"
            onClick={() => setDeleteModal(true)}
            style={{
              padding: "10px 22px",
              borderRadius: 9,
              border: "none",
              cursor: "pointer",
              background: "linear-gradient(135deg,#DC2626,#EF4444)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              fontFamily: "inherit",
            }}
          >
            Close / delete shop account
          </button>
        </div>
      )}

      {deleteModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.55)",
            backdropFilter: "blur(6px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: "36px 32px",
              maxWidth: 420,
              width: "100%",
              boxShadow: "0 24px 60px rgba(0,0,0,0.2)",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 4,
                background: "linear-gradient(90deg,#DC2626,#EF4444)",
                borderRadius: "16px 16px 0 0",
              }}
            />
            <div style={{ fontSize: 20, fontWeight: 900, color: "#0F172A", marginBottom: 8 }}>
              Close shop account?
            </div>
            <p style={{ fontSize: 13, color: "#64748B", lineHeight: 1.7, marginBottom: 20 }}>
              Type <strong style={{ color: "#DC2626" }}>DELETE</strong> to confirm closing this shop.
            </p>
            <label style={labelStyle}>
              Type DELETE to confirm
            </label>
            <input
              style={{ ...inputStyle, marginBottom: 16 }}
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="DELETE"
            />
            {deleteMsg && (
              <div style={{ ...msgBox("error"), marginBottom: 12 }}>{deleteMsg.text}</div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  setDeleteModal(false);
                  setDeleteConfirm("");
                  setDeleteMsg(null);
                }}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: 9,
                  border: "1.5px solid #E2E8F0",
                  background: "transparent",
                  color: "#64748B",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleting}
                style={{
                  flex: 2,
                  padding: "10px",
                  borderRadius: 9,
                  border: "none",
                  background: "linear-gradient(135deg,#DC2626,#EF4444)",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {deleting ? "Closing…" : "Yes, close account"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 640px) {
          .settings-profile-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
